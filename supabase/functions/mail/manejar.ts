/**
 * Sistema VDH · La puerta de la función «mail» (12/11/2026).
 *
 * Pedido de Mauricio (12/11, con la foto de un Ticket B): «No le mandé el ticket, me olvidé. Estaría bueno que haya la
 * opción de mandarlo. Pongamos el mail y se mande.» En los locales no hay impresora: la factura se entrega por mail,
 * como hace BlueSoft.
 *
 *   POST /functions/v1/mail   { accion: 'factura', venta_id, mail }   con la sesión de la persona (Authorization)
 *     → { ok: true, mail, comprobante } | { ok: false, error, codigo }
 *
 * Qué hace:
 *   1. le pregunta a la base, CON LA SESIÓN DE LA PERSONA, si puede ver esa venta y si se puede mandar
 *      (pos_venta_mail_preparar, SQL 281): tiene que tener la factura electrónica con su CAE;
 *   2. arma el PDF de la factura (factura.ts: la misma hoja de «Exportar PDF») y el mail (este archivo);
 *   3. se lo entrega a la casilla del sistema (correo.ts);
 *   4. anota en la base a quién se mandó, cuándo y quién lo mandó (pos_venta_mail_anotar). El ticket lo muestra.
 *
 * Se publica con --no-verify-jwt: quién entra lo decide esta función (y la base).
 */
// deno-lint-ignore-file no-explicit-any
import { armarMensaje, casilla, entregar, MailError } from './correo.ts';
import { comprobante, fechaLarga, n2, pdfFactura } from './factura.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

function responder(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
const ANONIMA = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Lo que dijo la base cuando dijo que no (el «raise exception» de la función). */
async function porqueBase(r: Response): Promise<string> {
  try {
    const j = await r.json();
    return String(j?.message || j?.error || 'La base dijo que no (' + r.status + ').');
  } catch {
    return 'La base dijo que no (' + r.status + ').';
  }
}

/** Una función de la base. Con el token de la persona, la base mira sus permisos; sin token, va como el servidor. */
async function base(funcion: string, cuerpo: unknown, token?: string): Promise<any> {
  let r: Response;
  try {
    r = await fetch(URL_BASE + '/rest/v1/rpc/' + funcion, {
      method: 'POST',
      headers: { apikey: token ? ANONIMA : SERVICIO, Authorization: 'Bearer ' + (token ?? SERVICIO), 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new MailError('base', 'No se pudo hablar con la base.');
  }
  if (r.status === 401) {
    await r.body?.cancel();
    throw new MailError('sin_sesion', 'Se cerró tu sesión: entrá de nuevo.');
  }
  if (r.status === 404) {
    await r.body?.cancel();
    throw new MailError('sin_sql', 'Todavía falta correr el SQL 281 (mandar la factura por mail) en Supabase.');
  }
  if (!r.ok) throw new MailError(token ? 'venta' : 'base', await porqueBase(r));
  return r.json();
}

/* ── El mail de la factura ──────────────────────────────────────────────── */

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** «rivadavia» → «Rivadavia», «san justo» → «San Justo». */
const bonito = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase());
/** $70.000 (sin los centavos si son ,00). */
const plata = (x: unknown) => '$' + n2(x).replace(/,00$/, '');

/** El nombre de pila, si la venta tiene un cliente con nombre (no el «Consumidor final» ni una razón social). */
function nombreDePila(t: any): string {
  const n = String(t.cliente_nombre ?? '').trim();
  if (!n || /consumidor final|gen[eé]rico/i.test(n) || t.cliente_condicion === 'responsable_inscripto' || /\b(s\.?r\.?l|s\.?a\.?s?)\b\.?$/i.test(n)) return '';
  return bonito(n.split(/\s+/)[0]);
}

export function mailFactura(t: any, pdf: Uint8Array, c: { desde: string }, para: string) {
  const f = t.factura, comp = comprobante(f), deP = f.ambiente === 'homologacion';
  const local = bonito(t.local), fecha = fechaLarga(f.fecha), total = plata(t.total), pila = nombreDePila(t);
  const hola = pila ? 'Hola, ' + pila + ':' : 'Hola:';
  const prueba = 'Este comprobante es de prueba: lo aprobó el ARCA de prueba y no tiene valor fiscal.';
  const texto = [
    hola, '',
    '¡Gracias por tu compra en VDH' + (local ? ' ' + local : '') + '! Te mandamos la factura adjunta, en PDF.', '',
    'Factura ' + comp,
    'Fecha: ' + fecha,
    'Total: ' + total,
    'CAE: ' + f.cae + ' (vence el ' + fechaLarga(f.cae_vence) + ')',
    ...(deP ? ['', prueba] : []), '',
    'Si la factura no es para vos, avisanos respondiendo este mail.', '',
    'VDH', 'vdh.com.ar',
  ].join('\r\n');
  const fila = (a: string, b: string) =>
    '<tr><td style="padding:4px 18px 4px 0;color:#6b6259;">' + esc(a) + '</td><td style="padding:4px 0;color:#1f1a16;"><b>' + esc(b) + '</b></td></tr>';
  const html = '<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#f6f2ee;">' +
    '<div style="max-width:520px;margin:0 auto;padding:28px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f1a16;">' +
      '<div style="font-size:26px;font-weight:bold;letter-spacing:3px;color:#1f1a16;">VDH</div>' +
      '<div style="height:3px;width:44px;background:#b87333;margin:8px 0 22px;"></div>' +
      '<p style="margin:0 0 14px;">' + esc(hola) + '</p>' +
      '<p style="margin:0 0 18px;">¡Gracias por tu compra en VDH' + (local ? ' ' + esc(local) : '') + '! Te mandamos la factura <b>adjunta, en PDF</b>.</p>' +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px;font-size:15px;">' +
        fila('Factura', comp) + fila('Fecha', fecha) + fila('Total', total) + fila('CAE', f.cae + ' · vence el ' + fechaLarga(f.cae_vence)) +
      '</table>' +
      (deP ? '<p style="margin:0 0 18px;padding:10px 12px;border:1px dashed #1f1a16;font-size:13.5px;">' + esc(prueba) + '</p>' : '') +
      '<p style="margin:0 0 22px;color:#6b6259;font-size:13.5px;">Si la factura no es para vos, avisanos respondiendo este mail.</p>' +
      '<p style="margin:0;color:#6b6259;font-size:13.5px;">VDH · <a href="https://vdh.com.ar" style="color:#6b6259;">vdh.com.ar</a></p>' +
    '</div></body></html>';
  return armarMensaje({
    desde: c.desde, para,
    asunto: 'Tu factura de VDH · ' + comp + (deP ? ' (de prueba)' : ''),
    texto, html,
    adjuntos: [{ nombre: 'Factura ' + comp + '.pdf', tipo: 'application/pdf', bytes: pdf }],
  });
}

/* ── La puerta ──────────────────────────────────────────────────────────── */

/* Sólo letras sin acento, números y . _ % + - : lo que entiende cualquier servidor de mails. Igual que en la base (SQL 281). */
const MAIL_OK = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

async function mandarFactura(token: string, ventaId: string, mail: string) {
  /* 1. ¿Puede ver esa venta? ¿Se puede mandar? La base contesta con la venta entera (lo mismo que ve el ticket). */
  const prep = await base('pos_venta_mail_preparar', { p_venta: ventaId, p_mail: mail }, token);
  const t = prep?.venta;
  if (!t?.factura?.cae) throw new MailError('base', 'La base contestó algo que no se entiende al preparar el mail.');
  const c = casilla();   // sin la casilla conectada, se corta acá (antes de armar nada)
  const comp = comprobante(t.factura);
  const anotar = (estado: 'enviado' | 'fallo', error: string | null) =>
    base('pos_venta_mail_anotar', {
      p_venta: ventaId, p_mail: mail, p_persona: prep.persona ?? null, p_estado: estado, p_error: error, p_comprobante: comp,
    });
  /* 2 y 3. El PDF, el mail y la entrega. Si algo falla, queda anotado por qué (para poder mirarlo después). */
  try {
    const pdf = await pdfFactura(t);
    await entregar(c, mail, mailFactura(t, pdf, c, mail));
  } catch (e) {
    const x = e instanceof MailError ? e : new MailError('interno', 'No se pudo armar la factura en PDF.');
    if (!(e instanceof MailError)) console.error('mail:', e);
    await anotar('fallo', x.codigo + ': ' + x.message).catch(() => {});
    throw x;
  }
  /* 4. Salió. Si justo falla la anotación, el mail ya está mandado: se avisa igual que salió. */
  const nota = await anotar('enviado', null).catch((e) => { console.error('mail: salió pero no se anotó:', e); return null; });
  return { ok: true, mail, comprobante: comp, envio: nota };
}

export async function manejar(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return responder({ ok: false, error: 'Sólo POST.' }, 405);

  let p: any;
  try { p = await req.json(); } catch { p = null; }
  if (!p || typeof p !== 'object') return responder({ ok: false, error: 'El pedido no se entiende.' }, 400);
  if (p.accion !== 'factura') return responder({ ok: false, error: 'Esa acción no existe.' }, 400);

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token || token === ANONIMA || token === SERVICIO) {
    return responder({ ok: false, error: 'Se cerró tu sesión: entrá de nuevo.', codigo: 'sin_sesion' }, 401);
  }
  if (typeof p.venta_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(p.venta_id)) return responder({ ok: false, error: 'Falta la venta.' }, 400);
  const mail = typeof p.mail === 'string' ? p.mail.trim().toLowerCase() : '';
  if (!mail || mail.length > 120 || !MAIL_OK.test(mail)) {
    return responder({ ok: false, error: 'El mail no está bien escrito.', codigo: 'direccion' }, 400);
  }
  try {
    return responder(await mandarFactura(token, p.venta_id, mail));
  } catch (e) {
    if (e instanceof MailError) return responder({ ok: false, error: e.message, codigo: e.codigo }, e.codigo === 'sin_sesion' ? 401 : 200);
    console.error('mail:', e);
    return responder({ ok: false, error: 'Algo falló al mandar el mail.', codigo: 'interno' });
  }
}
