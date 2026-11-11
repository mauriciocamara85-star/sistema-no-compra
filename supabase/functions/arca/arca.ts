/**
 * Sistema VDH · Hablar con ARCA (factura electrónica), 11/11/2026.
 *
 * ── Cómo es ARCA por dentro ───────────────────────────────────────────────
 * Son dos servicios:
 *   · WSAA: le mandamos un pedido firmado con nuestro certificado y nos da un
 *     «ticket de acceso» (token + sign) que dura 12 horas.
 *   · WSFE: con ese ticket se piden las facturas. Cada una vuelve con su CAE.
 *
 * ── Las tres reglas de este archivo ───────────────────────────────────────
 *   1. La llave del certificado vive SÓLO acá, como secreto de la función
 *      (ARCA_HOMO_KEY_B64 / ARCA_PROD_KEY_B64). Nunca viaja a una pantalla.
 *   2. El ticket se guarda en la base (arca_tickets, SQL 273) y se reusa hasta
 *      que vence: WSAA no da otro mientras haya uno vigente. Por eso NUNCA se
 *      pide un ticket si no hay dónde guardarlo.
 *   3. El CUIT que factura no está escrito en ningún lado: sale del
 *      certificado. El de prueba y el de verdad no se pueden cruzar.
 *
 * Hay dos ambientes: 'homologacion' (el de prueba de ARCA, sin valor fiscal)
 * y 'produccion' (el de verdad). Cada uno con su certificado y sus servidores.
 */
// deno-lint-ignore-file no-explicit-any
import forge from 'npm:node-forge@1.3.1';

export type Ambiente = 'homologacion' | 'produccion';

const SERVIDORES: Record<Ambiente, { wsaa: string; wsfe: string }> = {
  homologacion: {
    wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
  },
  produccion: {
    wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms',
    wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx',
  },
};

const NOMBRE: Record<Ambiente, string> = { homologacion: 'prueba', produccion: 'producción' };

/** Cuánto se espera a ARCA antes de darlo por caído. */
const ESPERA_MS = 25_000;

/** Un error que se le puede mostrar a la persona tal cual. `codigo` dice de qué lado vino. */
export class ArcaError extends Error {
  codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
  }
}

export function esAmbiente(x: unknown): x is Ambiente {
  return x === 'homologacion' || x === 'produccion';
}

/* ── El XML, a mano: son cuatro etiquetas ─────────────────────────────── */

/** Lo de adentro de la primera <nombre>…</nombre> (con o sin prefijo). '' si no está. */
export function etiqueta(xml: string, nombre: string): string {
  const m = new RegExp('<(?:[\\w.-]+:)?' + nombre + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?' + nombre + '>').exec(xml);
  return m ? m[1].trim() : '';
}

/** Todas las <nombre>…</nombre>. */
export function etiquetas(xml: string, nombre: string): string[] {
  const re = new RegExp('<(?:[\\w.-]+:)?' + nombre + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?' + nombre + '>', 'g');
  const todas: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) todas.push(m[1].trim());
  return todas;
}

function desescapar(t: string): string {
  return t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function escapar(t: unknown): string {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── El certificado ───────────────────────────────────────────────────── */

type Credencial = { cert: any; llave: any; cuit: string; vence: string };
const credenciales: Partial<Record<Ambiente, Credencial>> = {};

/** El certificado y la llave del ambiente, de los secretos de la función. El CUIT sale del certificado. */
export function credencial(amb: Ambiente): Credencial {
  const ya = credenciales[amb];
  if (ya) return ya;
  const pre = amb === 'produccion' ? 'ARCA_PROD' : 'ARCA_HOMO';
  const cert64 = (Deno.env.get(pre + '_CERT_B64') ?? '').trim();
  const llave64 = (Deno.env.get(pre + '_KEY_B64') ?? '').trim();
  if (!cert64 || !llave64) {
    throw new ArcaError('sin_certificado', 'Falta cargar el certificado de ARCA de ' + NOMBRE[amb] + '.');
  }
  let cert: any, llave: any;
  try {
    cert = forge.pki.certificateFromPem(atob(cert64));
    llave = forge.pki.privateKeyFromPem(atob(llave64));
  } catch {
    throw new ArcaError('sin_certificado', 'El certificado de ARCA de ' + NOMBRE[amb] + ' está mal cargado.');
  }
  /* 2.5.4.5 = serialNumber: ahí ARCA pone «CUIT 30715597523». */
  const serie = (cert.subject.attributes as any[]).find((a) => a.type === '2.5.4.5');
  const cuit = String(serie?.value ?? '').replace(/\D/g, '');
  if (cuit.length !== 11) {
    throw new ArcaError('sin_certificado', 'El certificado de ARCA de ' + NOMBRE[amb] + ' no trae el CUIT.');
  }
  const c = { cert, llave, cuit, vence: (cert.validity.notAfter as Date).toISOString() };
  credenciales[amb] = c;
  return c;
}

/* ── WSAA: el ticket de acceso ────────────────────────────────────────── */

/** La hora de Argentina (UTC−3, sin horario de verano) como la pide WSAA. */
function horaArgentina(ms: number): string {
  return new Date(ms - 3 * 3600_000).toISOString().slice(0, 19) + '-03:00';
}

/** El pedido de ticket: quién lo pide lo dice la firma; acá va para qué servicio y por cuánto vale el pedido. */
function pedidoDeTicket(servicio: string): string {
  const ahora = Date.now();
  return '<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header>' +
    '<uniqueId>' + Math.floor(ahora / 1000) + '</uniqueId>' +
    '<generationTime>' + horaArgentina(ahora - 600_000) + '</generationTime>' +
    '<expirationTime>' + horaArgentina(ahora + 600_000) + '</expirationTime>' +
    '</header><service>' + escapar(servicio) + '</service></loginTicketRequest>';
}

/** El pedido firmado con el certificado (CMS / PKCS#7, con el contenido adentro), en base64. */
function firmar(texto: string, c: Credencial): string {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(texto, 'utf8');
  p7.addCertificate(c.cert);
  p7.addSigner({
    key: c.llave,
    certificate: c.cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

/** Un pedido SOAP. Devuelve el XML de la respuesta (también el de un rechazo, que llega con error 500). */
async function pedir(url: string, sobre: string, accion: string): Promise<string> {
  let r: Response;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"' + accion + '"' },
      body: sobre,
      signal: AbortSignal.timeout(ESPERA_MS),
    });
  } catch (e) {
    const tardo = (e as Error)?.name === 'TimeoutError';
    throw new ArcaError('sin_respuesta', tardo ? 'ARCA tardó demasiado en contestar.' : 'No se pudo conectar con ARCA.');
  }
  const texto = await r.text();
  if (!r.ok && !/<(?:[\w.-]+:)?Fault[\s>]/.test(texto)) {
    throw new ArcaError('sin_respuesta', 'ARCA contestó con un error (' + r.status + ').');
  }
  return texto;
}

export type Ticket = { token: string; sign: string; vence: string };

/** Le pide un ticket nuevo a WSAA. Sólo lo llama ticket(), que antes reservó el pedido en la base. */
async function pedirTicket(amb: Ambiente, servicio: string): Promise<Ticket> {
  const cms = firmar(pedidoDeTicket(servicio), credencial(amb));
  const sobre = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body>' +
    '<wsaa:loginCms><wsaa:in0>' + cms + '</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>';
  const xml = await pedir(SERVIDORES[amb].wsaa, sobre, '');
  const falla = desescapar(etiqueta(xml, 'faultstring'));
  if (falla) {
    const codigo = etiqueta(xml, 'faultcode');
    if (/alreadyAuthenticated/i.test(codigo)) {
      throw new ArcaError('ticket_vigente', 'ARCA ya nos dio un permiso que sigue vigente y no lo tenemos guardado. Hay que esperar a que venza para pedir otro.');
    }
    throw new ArcaError('wsaa', 'ARCA no dio el permiso: ' + falla);
  }
  const dentro = desescapar(etiqueta(xml, 'loginCmsReturn'));
  const token = etiqueta(dentro, 'token');
  const sign = etiqueta(dentro, 'sign');
  const vence = new Date(etiqueta(dentro, 'expirationTime'));
  if (!token || !sign || isNaN(vence.getTime())) {
    throw new ArcaError('wsaa', 'ARCA contestó algo que no se entiende al pedir el permiso.');
  }
  return { token, sign, vence: vence.toISOString() };
}

/* ── La base: dónde se guarda el ticket (SQL 273) ─────────────────────── */

const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function base(funcion: string, cuerpo: unknown): Promise<any> {
  let r: Response;
  try {
    r = await fetch(URL_BASE + '/rest/v1/rpc/' + funcion, {
      method: 'POST',
      headers: { apikey: SERVICIO, Authorization: 'Bearer ' + SERVICIO, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ArcaError('base', 'No se pudo hablar con la base.');
  }
  if (r.status === 404) {
    await r.body?.cancel();
    throw new ArcaError('sin_sql', 'Falta correr el SQL 273: es donde se guarda el permiso de ARCA.');
  }
  if (!r.ok) throw new ArcaError('base', 'La base contestó ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}

const dormir = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

/**
 * El ticket vigente del ambiente. Si no hay, lo pide: la base deja pasar UN solo pedido por vez (si dos cajas
 * facturan en el mismo segundo, la segunda espera a que la primera lo guarde) y, si WSAA falló hace menos de un
 * minuto, devuelve ese error sin volver a molestarlo.
 */
export async function ticket(amb: Ambiente, servicio = 'wsfe'): Promise<Ticket> {
  for (let vuelta = 0; vuelta < 12; vuelta++) {
    const x = await base('arca_ticket_pedir', { p_ambiente: amb, p_servicio: servicio });
    if (x?.ticket) return x.ticket as Ticket;
    if (x?.error) throw new ArcaError('wsaa', String(x.error));
    if (x?.esperar) { await dormir(2500); continue; }
    if (!x?.pedir) throw new ArcaError('base', 'La base contestó algo que no se entiende al pedir el permiso de ARCA.');
    let nuevo: Ticket;
    try {
      nuevo = await pedirTicket(amb, servicio);
    } catch (e) {
      const porque = e instanceof ArcaError ? e.message : 'No se pudo pedir el permiso de ARCA.';
      await base('arca_ticket_guardar', {
        p_ambiente: amb, p_servicio: servicio, p_token: null, p_sign: null, p_vence: null, p_error: porque,
      }).catch(() => {});
      throw e;
    }
    /* Ya lo tenemos: guardarlo sí o sí (si se pierde, WSAA no da otro hasta que venza). */
    for (let intento = 0; ; intento++) {
      try {
        await base('arca_ticket_guardar', {
          p_ambiente: amb, p_servicio: servicio, p_token: nuevo.token, p_sign: nuevo.sign, p_vence: nuevo.vence, p_error: null,
        });
        break;
      } catch (e) {
        if (intento >= 3) { console.error('arca: el ticket no se pudo guardar', (e as Error).message); break; }
        await dormir(800);
      }
    }
    return nuevo;
  }
  throw new ArcaError('wsaa', 'ARCA está tardando en dar el permiso. Probá de nuevo en un minuto.');
}

/* ── WSFE: las facturas ───────────────────────────────────────────────── */

const ESPACIO = 'http://ar.gov.afip.dif.FEV1/';

export type Aviso = { codigo: string; mensaje: string };

function avisos(xml: string, grupo: string, renglon: string): Aviso[] {
  return etiquetas(etiqueta(xml, grupo), renglon).map((x) => ({
    codigo: etiqueta(x, 'Code'),
    mensaje: desescapar(etiqueta(x, 'Msg')),
  }));
}

/** Un método de WSFE. Con `conPermiso`, le pone el ticket y el CUIT. Devuelve el XML de la respuesta. */
async function wsfe(amb: Ambiente, metodo: string, cuerpo: string, conPermiso = true): Promise<string> {
  let permiso = '';
  if (conPermiso) {
    const t = await ticket(amb);
    permiso = '<ar:Auth><ar:Token>' + t.token + '</ar:Token><ar:Sign>' + t.sign + '</ar:Sign><ar:Cuit>' +
      credencial(amb).cuit + '</ar:Cuit></ar:Auth>';
  }
  const sobre = '<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:ar="' + ESPACIO + '"><soap:Body><ar:' + metodo + '>' + permiso + cuerpo + '</ar:' + metodo + '></soap:Body></soap:Envelope>';
  const xml = await pedir(SERVIDORES[amb].wsfe, sobre, ESPACIO + metodo);
  const falla = desescapar(etiqueta(xml, 'faultstring'));
  if (falla) throw new ArcaError('wsfe', 'ARCA rechazó el pedido: ' + falla);
  return xml;
}

/** ¿Están andando los servidores de facturación? No necesita permiso. */
export async function servidores(amb: Ambiente): Promise<{ app: string; db: string; auth: string; ok: boolean }> {
  const xml = await wsfe(amb, 'FEDummy', '', false);
  const app = etiqueta(xml, 'AppServer'), db = etiqueta(xml, 'DbServer'), auth = etiqueta(xml, 'AuthServer');
  return { app, db, auth, ok: app === 'OK' && db === 'OK' && auth === 'OK' };
}

/** El último número que ARCA autorizó en ese punto de venta para ese tipo de comprobante (0 si ninguno). */
export async function ultimoNumero(amb: Ambiente, puntoVenta: number, tipo: number): Promise<number> {
  const xml = await wsfe(amb, 'FECompUltimoAutorizado',
    '<ar:PtoVta>' + puntoVenta + '</ar:PtoVta><ar:CbteTipo>' + tipo + '</ar:CbteTipo>');
  const errores = avisos(xml, 'Errors', 'Err');
  if (errores.length) throw new ArcaError('wsfe', 'ARCA: ' + errores.map((e) => e.mensaje + ' (' + e.codigo + ')').join(' · '));
  const n = Number(etiqueta(xml, 'CbteNro'));
  if (!Number.isInteger(n) || n < 0) throw new ArcaError('wsfe', 'ARCA no dijo cuál fue el último comprobante.');
  return n;
}

/** Un comprobante para pedirle el CAE a ARCA. Los importes, en pesos con dos decimales. */
export type Comprobante = {
  punto_venta: number;
  /** 1 = Factura A, 6 = Factura B, 3 = Nota de crédito A, 8 = Nota de crédito B. */
  tipo: number;
  numero: number;
  /** 'AAAAMMDD' */
  fecha: string;
  /** 99 = consumidor final sin identificar, 80 = CUIT, 96 = DNI. */
  doc_tipo: number;
  doc_nro: string;
  /** La condición frente al IVA de quien recibe (5 = consumidor final, 1 = responsable inscripto…). */
  condicion_iva: number;
  total: number;
  neto: number;
  iva: number;
  /** Id de ARCA de cada alícuota (5 = 21 %, 4 = 10,5 %) con su base y su IVA. */
  alicuotas: { id: number; base: number; importe: number }[];
  /** Para una nota de crédito: la factura que anula. */
  asociados?: { tipo: number; punto_venta: number; numero: number }[];
};

export type Resultado = {
  aprobada: boolean;
  /** 'A' aprobada, 'R' rechazada, 'P' parcial. */
  resultado: string;
  cae: string;
  /** 'AAAAMMDD' */
  cae_vence: string;
  observaciones: Aviso[];
  errores: Aviso[];
};

const plata = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** Le pide el CAE a ARCA para UN comprobante. No reintenta: quien llama decide qué hacer con un rechazo. */
export async function pedirCae(amb: Ambiente, c: Comprobante): Promise<Resultado> {
  const asociados = (c.asociados ?? []).map((a) =>
    '<ar:CbteAsoc><ar:Tipo>' + a.tipo + '</ar:Tipo><ar:PtoVta>' + a.punto_venta + '</ar:PtoVta><ar:Nro>' + a.numero +
    '</ar:Nro></ar:CbteAsoc>').join('');
  const alicuotas = c.alicuotas.map((a) =>
    '<ar:AlicIva><ar:Id>' + a.id + '</ar:Id><ar:BaseImp>' + plata(a.base) + '</ar:BaseImp><ar:Importe>' + plata(a.importe) +
    '</ar:Importe></ar:AlicIva>').join('');
  const cuerpo = '<ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>' + c.punto_venta + '</ar:PtoVta><ar:CbteTipo>' +
    c.tipo + '</ar:CbteTipo></ar:FeCabReq><ar:FeDetReq><ar:FECAEDetRequest>' +
    '<ar:Concepto>1</ar:Concepto>' +   // 1 = productos
    '<ar:DocTipo>' + c.doc_tipo + '</ar:DocTipo><ar:DocNro>' + escapar(c.doc_nro) + '</ar:DocNro>' +
    '<ar:CbteDesde>' + c.numero + '</ar:CbteDesde><ar:CbteHasta>' + c.numero + '</ar:CbteHasta>' +
    '<ar:CbteFch>' + escapar(c.fecha) + '</ar:CbteFch>' +
    '<ar:ImpTotal>' + plata(c.total) + '</ar:ImpTotal><ar:ImpTotConc>0</ar:ImpTotConc>' +
    '<ar:ImpNeto>' + plata(c.neto) + '</ar:ImpNeto><ar:ImpOpEx>0</ar:ImpOpEx><ar:ImpTrib>0</ar:ImpTrib>' +
    '<ar:ImpIVA>' + plata(c.iva) + '</ar:ImpIVA><ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>' +
    '<ar:CondicionIVAReceptorId>' + c.condicion_iva + '</ar:CondicionIVAReceptorId>' +
    (asociados ? '<ar:CbtesAsoc>' + asociados + '</ar:CbtesAsoc>' : '') +
    (alicuotas ? '<ar:Iva>' + alicuotas + '</ar:Iva>' : '') +
    '</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq>';
  const xml = await wsfe(amb, 'FECAESolicitar', cuerpo);
  const detalle = etiqueta(xml, 'FECAEDetResponse');
  const resultado = etiqueta(detalle, 'Resultado') || etiqueta(xml, 'Resultado');
  const cae = etiqueta(detalle, 'CAE');
  return {
    aprobada: resultado === 'A' && /^\d{14}$/.test(cae),
    resultado,
    cae,
    cae_vence: etiqueta(detalle, 'CAEFchVto'),
    observaciones: avisos(detalle, 'Observaciones', 'Obs'),
    errores: avisos(xml, 'Errors', 'Err'),
  };
}

/** Hoy en Argentina, como lo pide ARCA: 'AAAAMMDD'. */
export function hoyArca(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '');
}
