/**
 * VDH · El WhatsApp propio del CRM — el receptor de Meta.
 *
 * La app "VDH CRM" (portfolio Vdhstore) recibe acá todo lo que pasa en las
 * cuentas de WhatsApp: lo que escribe el cliente, lo que contestan desde el
 * celular (la cuenta es de coexistencia) y los estados de lo que sale.
 * Kommo sigue conectado igual: Meta deja que varias apps miren la misma
 * cuenta. Ver PARTE 62 en supabase/crm.sql.
 *
 * ── Qué entra por acá ─────────────────────────────────────────────────────
 *   GET  ?hub.mode=subscribe…   Meta comprobando la dirección (una vez).
 *   POST con firma de Meta      Un aviso. Se comprueba la firma con la clave
 *                               secreta de la app y se le pasa a la base.
 *   POST {accion}               Para configurar desde acá, sin pantallas:
 *                               "estado", "suscribir" y "webhook". No
 *                               devuelven nada secreto y repetirlas no
 *                               cambia nada, por eso no piden PIN.
 *   POST {accion:"enviar"}      Contestar desde el CRM (SQL 64). Con PIN: la
 *                               base lo comprueba, y también que estemos
 *                               dentro de las 24 h, antes de mandar nada.
 *
 * ── Siempre contesta 200 a Meta ───────────────────────────────────────────
 * Igual que el de Kommo: un aviso que recibe un error se reintenta, y si el
 * problema es nuestro el reintento no lo arregla. Lo único que se rechaza es
 * una firma que no coincide: eso no lo mandó Meta.
 *
 * Los secretos (WA_TOKEN, WA_APP_SECRET, WA_VERIFICA) viven sólo en los
 * Secrets de Supabase. Nunca se devuelven ni se escriben en el log.
 */

const TOKEN = Deno.env.get('WA_TOKEN') ?? '';
const SECRETO = Deno.env.get('WA_APP_SECRET') ?? '';
const VERIFICA = Deno.env.get('WA_VERIFICA') ?? '';
const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/* Hay DOS apps de Meta, una por portfolio, y las dos avisan acá:
   - "VDH CRM" (Vdhstore): WA_TOKEN y WA_APP_SECRET.
   - "VDH CRM Tienda" (VDH): WA_TOKEN_VDH y WA_APP_SECRET_VDH.
   ¿Por qué dos? El número de la tienda es del portfolio VDH y su cuenta de
   WhatsApp admite un solo socio: lo ocupaba Kommo y, al sacarlo (09/10),
   Meta bloqueó sumar socios hasta el 01/11/2026. Tampoco se puede compartir
   la app de Vdhstore: es una empresa nueva para Meta. Así que VDH tiene su
   propia app, con su usuario del sistema. */
const APPS = [
  { token: TOKEN, secreto: SECRETO },
  { token: Deno.env.get('WA_TOKEN_VDH') ?? '', secreto: Deno.env.get('WA_APP_SECRET_VDH') ?? '' },
].filter((a) => a.token && a.secreto);

/* Las cuentas de WhatsApp que mira el CRM, separadas por coma, cada una con
   el nombre del Secret de su token: "id" (usa WA_TOKEN) o "id:WA_TOKEN_VDH".
   Los identificadores no son secretos. */
const CUENTAS = (Deno.env.get('WA_CUENTAS') ?? '668621112856892').split(',').map((s) => s.trim()).filter(Boolean)
  .map((s) => {
    const [id, nombre] = s.split(':');
    return { id, nombreToken: nombre || 'WA_TOKEN', token: (nombre ? Deno.env.get(nombre) : TOKEN) ?? '' };
  });
/* Los tokens que puede haber, para "estado" (sólo sí/no). */
const TOKENS: Record<string, string> = { WA_TOKEN: TOKEN, WA_TOKEN_VDH: Deno.env.get('WA_TOKEN_VDH') ?? '' };
const GRAPH = 'https://graph.facebook.com/v23.0';
const AQUI = URL_BASE + '/functions/v1/whatsapp';
const CAMPOS = 'messages,smb_message_echoes';

// El CRM llama desde GitHub Pages: hace falta decirle al navegador que puede.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

/** Firma HMAC-SHA256 del cuerpo, como la calcula Meta, en hexadecimal. */
async function firmar(cuerpo: Uint8Array, secreto: string): Promise<string> {
  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const f = new Uint8Array(await crypto.subtle.sign('HMAC', llave, cuerpo));
  return Array.from(f, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Compara sin cortar en la primera diferencia, para no dar pistas por el tiempo. */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Una llamada a Meta con el token del usuario del sistema. Los mensajes
 *  van en JSON (tienen partes adentro); lo demás, como formulario. */
async function meta(ruta: string, metodo = 'GET', datos?: Record<string, unknown>, token = TOKEN, enJson = false): Promise<any> {
  const url = new URL(GRAPH + ruta);
  let cuerpo: URLSearchParams | string | undefined;
  const cabeceras: Record<string, string> = {};
  if (metodo === 'GET') {
    url.searchParams.set('access_token', token);
  } else if (enJson) {
    cuerpo = JSON.stringify(datos ?? {});
    cabeceras['Content-Type'] = 'application/json';
    cabeceras['Authorization'] = 'Bearer ' + token;
  } else {
    cuerpo = new URLSearchParams({ ...(datos as Record<string, string> ?? {}), access_token: token });
  }
  const r = await fetch(url, { method: metodo, body: cuerpo, headers: cabeceras });
  const x = await r.json().catch(() => ({}));
  // Los errores de Meta traen mensaje y código; nunca el token.
  if (!r.ok) return { error: { mensaje: x?.error?.message, codigo: x?.error?.code, sub: x?.error?.error_subcode } };
  return x;
}

/** Cómo está todo: qué secretos hay (sí/no), la app, las cuentas y los números. */
async function estado() {
  const salida: Record<string, unknown> = {
    secretos: { ...Object.fromEntries(Object.entries(TOKENS).map(([k, v]) => [k, !!v])),
                WA_APP_SECRET: !!SECRETO, WA_APP_SECRET_VDH: !!Deno.env.get('WA_APP_SECRET_VDH'), WA_VERIFICA: !!VERIFICA },
    direccion: AQUI,
  };
  if (!TOKEN) return salida;
  salida.app = await meta('/app?fields=id,name');
  salida.cuentas = await Promise.all(CUENTAS.map(async (c) => ({
    id: c.id, token: c.nombreToken + (c.token ? '' : ' (FALTA)'),
    cuenta: await meta('/' + c.id + '?fields=name,currency,timezone_id,business_verification_status', 'GET', undefined, c.token),
    numeros: await meta('/' + c.id + '/phone_numbers?fields=display_phone_number,verified_name,quality_rating,platform_type,status,messaging_limit_tier,is_on_biz_app', 'GET', undefined, c.token),
    apps: await meta('/' + c.id + '/subscribed_apps', 'GET', undefined, c.token),
  })));
  return salida;
}

/** Suscribe la app a las cuentas: sin esto Meta no le manda nada. */
async function suscribir() {
  return Promise.all(CUENTAS.map(async (c) => ({ id: c.id, r: await meta('/' + c.id + '/subscribed_apps', 'POST', undefined, c.token) })));
}

/** El token del número desde el que se manda: el de la cuenta que lo tiene.
 *  Se arma una vez por arranque de la función, preguntándole a cada cuenta
 *  sus números. */
let TOKEN_DEL_NUMERO: Record<string, string> | null = null;
async function tokenDelNumero(numeroId: string): Promise<string> {
  if (!TOKEN_DEL_NUMERO) {
    const mapa: Record<string, string> = {};
    for (const c of CUENTAS) {
      if (!c.token) continue;
      const r = await meta('/' + c.id + '/phone_numbers?fields=id', 'GET', undefined, c.token);
      (r?.data ?? []).forEach((n: any) => { mapa[n.id] = c.token; });
    }
    TOKEN_DEL_NUMERO = mapa;
  }
  return TOKEN_DEL_NUMERO[numeroId] ?? TOKEN;
}

/**
 * Le dice a Meta la dirección de este receptor y qué avisos queremos. Se
 * hace con el token de la APP (id|clave secreta), no el del usuario.
 * Meta comprueba la dirección en el momento: llama al GET de acá abajo.
 */
async function webhook() {
  if (!VERIFICA) return { error: 'falta WA_VERIFICA en los Secrets' };
  return Promise.all(APPS.map(async (a) => {
    const app = await meta('/app?fields=id,name', 'GET', undefined, a.token);
    if (!app?.id) return { error: 'no se pudo leer la app', app };
    const tokenApp = app.id + '|' + a.secreto;
    const r = await meta('/' + app.id + '/subscriptions', 'POST', {
      object: 'whatsapp_business_account', callback_url: AQUI, verify_token: VERIFICA, fields: CAMPOS,
    }, tokenApp);
    const ahora = await meta('/' + app.id + '/subscriptions', 'GET', undefined, tokenApp);
    return { app: app.name, r, ahora };
  }));
}

/** ¿La firma es de alguna de nuestras apps? */
async function firmaValida(firma: string, cuerpo: Uint8Array): Promise<boolean> {
  for (const a of APPS) {
    if (iguales(firma, 'sha256=' + await firmar(cuerpo, a.secreto))) return true;
  }
  return false;
}

/** Una función de la base, con permisos de servicio. */
async function rpc(nombre: string, args: unknown): Promise<any> {
  const r = await fetch(URL_BASE + '/rest/v1/rpc/' + nombre, {
    method: 'POST',
    headers: { apikey: SERVICIO, Authorization: 'Bearer ' + SERVICIO, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const texto = await r.text();
  if (!r.ok) {
    let msg = texto;
    try { msg = JSON.parse(texto).message ?? texto; } catch { /* queda el texto */ }
    throw new Error(String(msg).slice(0, 300));
  }
  try { return JSON.parse(texto); } catch { return texto; }
}

/** Le pasa el aviso a la base, que es la que lo desarma y lo guarda. */
const guardar = (aviso: unknown) => rpc('wa_recibir', { p: aviso });

/**
 * Contestar desde el CRM. La base comprueba el PIN y las 24 h y dice a qué
 * número y desde cuál; Meta lo manda; la base lo guarda con quién fue.
 * Si Meta lo rechaza, no se guarda nada y se dice por qué.
 */
async function enviar(p: { pin?: string; clave?: string; texto?: string; quien?: string }) {
  const texto = String(p.texto ?? '').trim();
  if (!texto) return { ok: false, error: 'El mensaje está vacío.' };
  if (texto.length > 4000) return { ok: false, error: 'El mensaje es demasiado largo.' };
  let prep: any;
  try {
    prep = await rpc('wa_preparar_envio', { p_pin: String(p.pin ?? ''), p_clave: String(p.clave ?? '') });
  } catch (e) {
    return { ok: false, error: /PIN/.test(String(e)) ? 'PIN incorrecto.' : 'No se pudo preparar el envío.' };
  }
  if (!prep?.ok) {
    return { ok: false, motivo: prep?.motivo, ventana: prep?.ventana,
             error: prep?.motivo === 'ventana' ? 'Pasaron más de 24 horas desde que escribió: hace falta una plantilla.'
                                               : 'Esta persona no escribió a nuestro WhatsApp.' };
  }
  const r = await meta('/' + prep.numero_id + '/messages', 'POST', {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: prep.tel,
    type: 'text', text: { body: texto, preview_url: true },
  }, await tokenDelNumero(prep.numero_id), true);
  const wamid = r?.messages?.[0]?.id;
  if (!wamid) {
    console.error('whatsapp: Meta no aceptó el envío:', JSON.stringify(r?.error ?? r));
    return { ok: false, error: 'WhatsApp no lo aceptó' + (r?.error?.mensaje ? ': ' + r.error.mensaje : '.'), codigo: r?.error?.codigo };
  }
  try {
    await rpc('wa_anotar_envio', { p: { wamid, numero_id: prep.numero_id, numero: prep.numero, tel: prep.tel,
                                        texto, quien: String(p.quien ?? '').slice(0, 60) } });
  } catch (e) {
    // Salió igual: el estado de Meta va a dejar la marca y la conversación sigue bien.
    console.error('whatsapp: salió pero no se pudo guardar:', String(e));
  }
  return { ok: true, wamid };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // Meta comprobando la dirección.
  if (req.method === 'GET') {
    if (url.searchParams.get('hub.mode') === 'subscribe' && VERIFICA &&
        iguales(url.searchParams.get('hub.verify_token') ?? '', VERIFICA)) {
      return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
    }
    return new Response('VDH CRM · WhatsApp', { status: 200 });
  }
  if (req.method !== 'POST') return new Response('', { status: 405 });

  const cuerpo = new Uint8Array(await req.arrayBuffer());
  const firma = req.headers.get('x-hub-signature-256');

  // Un aviso de Meta.
  if (firma) {
    if (!(await firmaValida(firma, cuerpo))) {
      // Se anota que pasó (sin el cuerpo, que no sabemos de quién es): si
      // la clave secreta se pegó mal, es la única pista de que Meta llama.
      console.warn('whatsapp: firma que no coincide, se rechaza');
      await guardar({ rechazado: 'firma', largo: cuerpo.length }).catch(() => {});
      return new Response('firma', { status: 401 });
    }
    try {
      const r = await guardar(JSON.parse(new TextDecoder().decode(cuerpo)));
      console.log('whatsapp:', JSON.stringify(r));
    } catch (e) {
      console.error('whatsapp: no se pudo guardar:', String(e));
    }
    return new Response('ok', { status: 200 });
  }

  // Configuración.
  let pedido: { accion?: string; [k: string]: unknown } = {};
  try { pedido = JSON.parse(new TextDecoder().decode(cuerpo)); } catch { /* vacío */ }
  try {
    if (pedido.accion === 'enviar') return json(await enviar(pedido as any));
    if (pedido.accion === 'estado') return json(await estado());
    if (pedido.accion === 'suscribir') return json(await suscribir());
    if (pedido.accion === 'webhook') return json(await webhook());
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
  return json({ error: 'accion: enviar, estado, suscribir o webhook' }, 400);
});
