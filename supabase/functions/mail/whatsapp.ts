/**
 * Sistema VDH · La factura por WhatsApp (12/11/2026).
 *
 * Mauricio (12/11): «yo quiero que nuestros sistemas sean los mejores, así que me gustaría armar esto de WhatsApp también».
 *
 * Al cliente que no nos escribió (o que escribió hace más de 24 horas) Meta sólo deja mandarle una PLANTILLA que revisó y
 * aprobó. La de la factura se llama «factura_vdh», es de utilidad (no de marketing) y lleva el PDF arriba, como documento:
 *
 *     [ Factura B 00034-00021654.pdf ]
 *     Hola, ¡gracias por tu compra en VDH Rivadavia! Te mandamos la factura B 00034-00021654 del 11/11/2026 por
 *     $155.520. La encontrás adjunta en este mensaje.
 *     VDH · vdh.com.ar
 *
 * Sale del número del CRM (la primera cuenta de WA_CUENTAS, «VDH Indumentaria»), con el mismo token que usa la función
 * «whatsapp» (WA_TOKEN). Con el secreto WA_FACTURAS_NUMERO (el id del número) se puede elegir otro de esa cuenta.
 * Si el texto de la plantilla cambia, hay que crearla de nuevo con otro nombre: Meta no deja editar una aprobada a gusto.
 *
 * Lo que Meta contesta al mandar es «lo acepté», no «llegó»: si el número no tiene WhatsApp, el aviso llega después a la
 * función «whatsapp», que lo deja en wa_mensajes. Por eso se guarda el identificador del mensaje (wamid): el ticket
 * muestra con él si se entregó, si lo leyó o si no llegó.
 */
// deno-lint-ignore-file no-explicit-any
import { MailError } from './correo.ts';

/* WA_GRAPH existe sólo para las pruebas (un Meta de mentira). */
const GRAPH = (Deno.env.get('WA_GRAPH') ?? '').trim() || 'https://graph.facebook.com/v23.0';

export const PLANTILLA = 'factura_vdh';
export const IDIOMA = 'es_AR';
export const CUERPO = 'Hola, ¡gracias por tu compra en VDH {{local}}! Te mandamos la factura {{comprobante}} del {{fecha}} por {{total}}. La encontrás adjunta en este mensaje.';
export const PIE = 'VDH · vdh.com.ar';
const EJEMPLOS: Record<string, string> = { local: 'Rivadavia', comprobante: 'B 00034-00021654', fecha: '11/11/2026', total: '$155.520' };

export type DatosPlantilla = { local: string; comprobante: string; fecha: string; total: string };

/** El texto como lo va a leer el cliente (para dejarlo anotado en el CRM). */
export function textoPlantilla(d: DatosPlantilla): string {
  return CUERPO.replace(/\{\{([a-z_]+)\}\}/g, (_m, k) => String((d as any)[k] ?? ''));
}

/** La cuenta de WhatsApp de la que salen las facturas: la primera de WA_CUENTAS (la del CRM), con su token. */
function cuenta(): { id: string; token: string } {
  const primera = (Deno.env.get('WA_CUENTAS') ?? '668621112856892').split(',').map((s) => s.trim()).filter(Boolean)[0] ?? '';
  const [id, nombre] = primera.split(':');
  const token = (Deno.env.get(nombre || 'WA_TOKEN') ?? '').trim();
  if (!id || !token) throw new MailError('sin_whatsapp', 'El WhatsApp del sistema no está conectado.');
  return { id, token };
}

/** Lo que dijo Meta cuando dijo que no: su mensaje (y el que escribe para la persona, si lo trae) y su código. */
function errorDeMeta(x: any, http: number): { mensaje: string; codigo: string } {
  const e = x?.error ?? {};
  const usuario = [e.error_user_title, e.error_user_msg].filter(Boolean).join(': ');
  const detalle = String(e?.error_data?.details ?? '');
  return { mensaje: String(usuario || detalle || e.message || 'Meta contestó ' + http + '.'), codigo: String(e.code ?? http) };
}

/** Una llamada a Meta. Devuelve lo que contestó; si dijo que no, tira MetaError con su código. */
class MetaError extends Error {
  codigo: string;
  constructor(mensaje: string, codigo: string) { super(mensaje); this.codigo = codigo; }
}
async function meta(ruta: string, o: { metodo?: string; token: string; json?: unknown; cuerpo?: BodyInit; cabeceras?: Record<string, string>; oauth?: boolean } ): Promise<any> {
  const cabeceras: Record<string, string> = { Authorization: (o.oauth ? 'OAuth ' : 'Bearer ') + o.token, ...(o.cabeceras ?? {}) };
  let cuerpo: BodyInit | undefined = o.cuerpo;
  if (o.json !== undefined) { cuerpo = JSON.stringify(o.json); cabeceras['Content-Type'] = 'application/json'; }
  let r: Response;
  try {
    r = await fetch(GRAPH + ruta, { method: o.metodo ?? 'GET', headers: cabeceras, body: cuerpo, signal: AbortSignal.timeout(25_000) });
  } catch {
    throw new MailError('whatsapp', 'No se pudo hablar con WhatsApp. Probá de nuevo en un minuto.');
  }
  const x = await r.json().catch(() => ({}));
  if (!r.ok || x?.error) {
    const e = errorDeMeta(x, r.status);
    throw new MetaError(e.mensaje, e.codigo);
  }
  return x;
}

/* ── El número ──────────────────────────────────────────────────────────── */

export type Numero = { id: string; display: string; digitos: string; nombre: string; cuenta: string; token: string };
let NUMERO: { cuando: number; n: Numero } | null = null;

/** El número del que salen las facturas: el primero conectado de la cuenta (o el de WA_FACTURAS_NUMERO). Se le pregunta
 *  a Meta cada diez minutos como mucho. */
export async function numero(): Promise<Numero> {
  if (NUMERO && Date.now() - NUMERO.cuando < 10 * 60_000) return NUMERO.n;
  const c = cuenta();
  const fijo = (Deno.env.get('WA_FACTURAS_NUMERO') ?? '').trim();
  let r: any;
  try {
    r = await meta('/' + c.id + '/phone_numbers?fields=id,display_phone_number,verified_name,status,platform_type', { token: c.token });
  } catch (e) {
    if (e instanceof MailError) throw e;
    console.error('mail/whatsapp: Meta no dio los números:', (e as Error).message);
    throw new MailError('sin_whatsapp', 'El WhatsApp del sistema no está conectado.');
  }
  const n = (r?.data ?? []).find((x: any) => (!fijo || String(x.id) === fijo) && x.status === 'CONNECTED' && x.platform_type === 'CLOUD_API');
  if (!n) throw new MailError('sin_whatsapp', 'El número de WhatsApp del sistema no está conectado.');
  const num: Numero = {
    id: String(n.id), display: String(n.display_phone_number ?? ''), digitos: String(n.display_phone_number ?? '').replace(/\D/g, ''),
    nombre: String(n.verified_name ?? ''), cuenta: c.id, token: c.token,
  };
  NUMERO = { cuando: Date.now(), n: num };
  return num;
}

/* ── La plantilla ───────────────────────────────────────────────────────── */

export type EstadoPlantilla = { estado: string; categoria?: string; motivo?: string; id?: string };
let PLANT: { cuando: number; e: EstadoPlantilla } | null = null;

/** Cómo está la plantilla en Meta: APPROVED (se puede mandar), PENDING (la está revisando), REJECTED, PAUSED… o
 *  «no_existe». Aprobada, se recuerda cinco minutos; si no, medio minuto (para enterarse rápido cuando la aprueban). */
export async function plantilla(fresca = false): Promise<EstadoPlantilla> {
  if (!fresca && PLANT && Date.now() - PLANT.cuando < (PLANT.e.estado === 'APPROVED' ? 5 * 60_000 : 30_000)) return PLANT.e;
  const c = cuenta();
  let r: any;
  try {
    r = await meta('/' + c.id + '/message_templates?name=' + PLANTILLA + '&fields=id,name,status,category,language,rejected_reason&limit=50', { token: c.token });
  } catch (e) {
    if (e instanceof MailError) throw e;
    throw new MailError('whatsapp', 'WhatsApp no dijo cómo está la plantilla de la factura: ' + (e as Error).message);
  }
  const t = (r?.data ?? []).find((x: any) => x.name === PLANTILLA && x.language === IDIOMA);
  const e: EstadoPlantilla = t
    ? { estado: String(t.status), categoria: String(t.category ?? ''), id: String(t.id ?? ''),
        ...(t.rejected_reason && t.rejected_reason !== 'NONE' ? { motivo: String(t.rejected_reason) } : {}) }
    : { estado: 'no_existe' };
  PLANT = { cuando: Date.now(), e };
  return e;
}

/** Crea la plantilla en Meta (que la revisa). Con un PDF de ejemplo: Meta lo pide para las que llevan un documento.
 *  Si ya existe, no hace nada y dice cómo está. */
export async function crearPlantilla(pdfEjemplo: Uint8Array): Promise<EstadoPlantilla & { creada: boolean }> {
  const ya = await plantilla(true);
  if (ya.estado !== 'no_existe') return { ...ya, creada: false };
  const c = cuenta();
  try {
    /* El ejemplo se sube aparte, en dos pasos (la «subida reanudable» de Meta), y devuelve un identificador (h). */
    const app = await meta('/app?fields=id', { token: c.token });
    const sesion = await meta('/' + app.id + '/uploads?file_name=' + encodeURIComponent('Factura de ejemplo.pdf') + '&file_length=' + pdfEjemplo.length +
      '&file_type=' + encodeURIComponent('application/pdf'), { metodo: 'POST', token: c.token });
    const subida = await meta('/' + sesion.id, { metodo: 'POST', token: c.token, oauth: true, cuerpo: pdfEjemplo as unknown as BodyInit, cabeceras: { file_offset: '0' } });
    if (!subida?.h) throw new MetaError('Meta no devolvió el identificador del PDF de ejemplo.', 'subida');
    const vars = Object.keys(EJEMPLOS);
    const r = await meta('/' + c.id + '/message_templates', {
      metodo: 'POST', token: c.token,
      json: {
        name: PLANTILLA, language: IDIOMA, category: 'UTILITY', parameter_format: 'named',
        components: [
          { type: 'HEADER', format: 'DOCUMENT', example: { header_handle: [subida.h] } },
          { type: 'BODY', text: CUERPO, example: { body_text_named_params: vars.map((v) => ({ param_name: v, example: EJEMPLOS[v] })) } },
          { type: 'FOOTER', text: PIE },
        ],
      },
    });
    PLANT = null;
    return { estado: String(r?.status ?? 'PENDING'), categoria: String(r?.category ?? ''), id: String(r?.id ?? ''), creada: true };
  } catch (e) {
    if (e instanceof MailError) throw e;
    console.error('mail/whatsapp: Meta no aceptó la plantilla:', (e as Error).message);
    throw new MailError('whatsapp', 'Meta no aceptó la plantilla: ' + (e as Error).message);
  }
}

/* ── Mandar ─────────────────────────────────────────────────────────────── */

/** Lo que dijo Meta al mandar, en criollo. */
function porque(e: MetaError): MailError {
  const c = e.codigo;
  if (['132000', '132001', '132005', '132007', '132012', '132015', '132016'].includes(c)) {
    PLANT = null;
    return new MailError('sin_plantilla', 'WhatsApp no aceptó la plantilla de la factura (puede estar en revisión o pausada). Mandala por mail.');
  }
  if (['131048', '131056', '130429', '80007', '4'].includes(c)) {
    return new MailError('tope', 'WhatsApp frenó los envíos por un rato (son muchos seguidos). Probá en unos minutos o mandala por mail.');
  }
  if (['131042', '131031', '368', '190', '10', '200'].includes(c)) {
    return new MailError('sin_whatsapp', 'La cuenta de WhatsApp del sistema tiene un problema y no deja mandar. Mandala por mail y avisale a la oficina.');
  }
  if (['131026', '131030', '100', '131009', '131021'].includes(c)) {
    return new MailError('direccion', 'WhatsApp no aceptó ese número: fijate si está bien escrito (con la característica, sin el 0 y sin el 15).');
  }
  return new MailError('whatsapp', 'WhatsApp no lo aceptó: ' + e.message);
}

/** Sube el PDF a WhatsApp y devuelve su identificador (dura 30 días; se usa en el mensaje). */
export async function subirPdf(n: Numero, pdf: Uint8Array, archivo: string): Promise<string> {
  const f = new FormData();
  f.append('messaging_product', 'whatsapp');
  f.append('type', 'application/pdf');
  f.append('file', new Blob([pdf as unknown as BlobPart], { type: 'application/pdf' }), archivo);
  try {
    const r = await meta('/' + n.id + '/media', { metodo: 'POST', token: n.token, cuerpo: f });
    if (!r?.id) throw new MetaError('Meta no devolvió el identificador del PDF.', 'media');
    return String(r.id);
  } catch (e) {
    if (e instanceof MailError) throw e;
    console.error('mail/whatsapp: no se pudo subir el PDF:', (e as Error).message);
    throw porque(e as MetaError);
  }
}

/** Un dato para Meta: una sola línea, sin muchos espacios seguidos (si no, rechaza el envío). */
const limpio = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);

/** Manda la plantilla con el PDF. tel: 549 + los diez números. Devuelve el identificador del mensaje (wamid). */
export async function mandarFacturaWa(n: Numero, tel: string, mediaId: string, archivo: string, d: DatosPlantilla): Promise<string> {
  try {
    const r = await meta('/' + n.id + '/messages', {
      metodo: 'POST', token: n.token, cabeceras: { Connection: 'close' },   // una conexión nueva: si se corta, no se reintenta sola (saldría dos veces)
      json: {
        messaging_product: 'whatsapp', recipient_type: 'individual', to: tel, type: 'template',
        template: {
          name: PLANTILLA, language: { code: IDIOMA },
          components: [
            { type: 'header', parameters: [{ type: 'document', document: { id: mediaId, filename: archivo } }] },
            { type: 'body', parameters: (['local', 'comprobante', 'fecha', 'total'] as const).map((k) => ({ type: 'text', parameter_name: k, text: limpio(d[k]) })) },
          ],
        },
      },
    });
    const wamid = r?.messages?.[0]?.id;
    if (!wamid) throw new MetaError('Meta no devolvió el identificador del mensaje.', 'sin_wamid');
    return String(wamid);
  } catch (e) {
    if (e instanceof MailError) throw e;
    console.error('mail/whatsapp: Meta no aceptó la factura:', (e as MetaError).codigo, (e as Error).message);
    throw porque(e as MetaError);
  }
}
