/**
 * VDH · El WhatsApp propio del CRM — el receptor de Meta.
 *
 * La app "VDH CRM" (portfolio Vdhstore) recibe acá todo lo que pasa en las
 * cuentas de WhatsApp: lo que escribe el cliente, lo que contestan desde el
 * celular (la cuenta es de coexistencia) y los estados de lo que sale.
 * Kommo sigue conectado igual: Meta deja que varias apps miren la misma
 * cuenta. Ver PARTES 62 a 65 en supabase/crm.sql.
 *
 * ── Qué entra por acá ─────────────────────────────────────────────────────
 *   GET  ?hub.mode=subscribe…   Meta comprobando la dirección (una vez).
 *   POST con firma de Meta      Un aviso. Se comprueba la firma con la clave
 *                               secreta de la app y se le pasa a la base.
 *   POST {accion}               Para configurar desde acá, sin pantallas:
 *                               "estado", "suscribir" y "webhook". No
 *                               devuelven nada secreto y repetirlas no
 *                               cambia nada, por eso no piden PIN.
 *                               "historial" (con numero_id) le pide a Meta
 *                               los chats viejos del celular (coexistencia);
 *                               con tipo "contactos", la agenda del celular.
 *   POST {accion, pin, …}       Lo que usa el CRM, siempre con PIN:
 *       "enviar"                Contestar dentro de las 24 h (SQL 64).
 *       "plantillas"            Las plantillas de cada cuenta, como las tiene
 *                               Meta (aprobadas, en revisión, rechazadas).
 *       "plantilla_crear"       Una plantilla nueva, que Meta revisa.
 *       "plantilla_borrar"      Borrarla.
 *       "plantillas_para"       Las aprobadas con las que se le puede
 *                               escribir a una persona, y desde qué número.
 *       "enviar_plantilla"      Mandarle una (SQL 65).
 *
 * ── Siempre contesta 200 a Meta ───────────────────────────────────────────
 * Igual que el de Kommo: un aviso que recibe un error se reintenta, y si el
 * problema es nuestro el reintento no lo arregla. Lo único que se rechaza es
 * una firma que no coincide: eso no lo mandó Meta.
 *
 * Los secretos (WA_TOKEN, WA_APP_SECRET, WA_VERIFICA…) viven sólo en los
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
   La primera es la del CRM (VDH Indumentaria): de ahí sale lo que se le
   manda a alguien que nunca escribió. Los identificadores no son secretos. */
const CUENTAS = (Deno.env.get('WA_CUENTAS') ?? '668621112856892').split(',').map((s) => s.trim()).filter(Boolean)
  .map((s) => {
    const [id, nombre] = s.split(':');
    return { id, nombreToken: nombre || 'WA_TOKEN', token: (nombre ? Deno.env.get(nombre) : TOKEN) ?? '' };
  });
/* Los tokens que puede haber, para "estado" (sólo sí/no). */
const TOKENS: Record<string, string> = { WA_TOKEN: TOKEN, WA_TOKEN_VDH: Deno.env.get('WA_TOKEN_VDH') ?? '' };
const GRAPH = 'https://graph.facebook.com/v23.0';
const AQUI = URL_BASE + '/functions/v1/whatsapp';
/* "history": los chats viejos del celular, cuando se piden (ver historial).
   "smb_app_state_sync": los contactos agendados en el celular (al pedirlos,
   y después cada vez que agendan, cambian o borran uno). */
const CAMPOS = 'messages,smb_message_echoes,history,smb_app_state_sync';
const CAMPOS_PLANTILLA = 'id,name,status,category,language,components,rejected_reason,parameter_format';

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

/** Una llamada a Meta con el token del usuario del sistema. Los mensajes y
 *  las plantillas van en JSON (tienen partes adentro); lo demás, como
 *  formulario. GET y DELETE llevan el token en la dirección. */
async function meta(ruta: string, metodo = 'GET', datos?: Record<string, unknown>, token = TOKEN, enJson = false): Promise<any> {
  const url = new URL(GRAPH + ruta);
  let cuerpo: URLSearchParams | string | undefined;
  const cabeceras: Record<string, string> = {};
  if (metodo === 'GET' || metodo === 'DELETE') {
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
  // Los errores de Meta traen mensaje y código (y a veces una explicación
  // para la persona: error_user_msg); nunca el token.
  if (!r.ok) {
    return { error: { mensaje: x?.error?.message, codigo: x?.error?.code, sub: x?.error?.error_subcode,
                      usuario: [x?.error?.error_user_title, x?.error?.error_user_msg].filter(Boolean).join(': ') } };
  }
  return x;
}

/** El PIN del CRM, contra la base: cuenta los intentos fallidos igual que
 *  el resto (y frena al que prueba de a muchos). */
async function pinValido(pin: unknown): Promise<boolean> {
  try { return !!(await rpc('pin_ok', { p_pin: String(pin ?? '') }))?.ok; } catch { return false; }
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
  salida.cuentas = await Promise.all(CUENTAS.map(async (c) => {
    const numeros = await meta('/' + c.id + '/phone_numbers?fields=display_phone_number,verified_name,quality_rating,platform_type,status,messaging_limit_tier,is_on_biz_app', 'GET', undefined, c.token);
    return {
      id: c.id, token: c.nombreToken + (c.token ? '' : ' (FALTA)'),
      cuenta: await meta('/' + c.id + '?fields=name,currency,timezone_id,business_verification_status', 'GET', undefined, c.token),
      numeros,
      apps: await meta('/' + c.id + '/subscribed_apps', 'GET', undefined, c.token),
      /* Para cuando un número no avisa: a dónde le manda Meta los avisos a
         esta app, en qué modo está y si algo lo frena (health_status). */
      detalle: await Promise.all((numeros?.data ?? []).map((n: any) =>
        meta('/' + n.id + '?fields=account_mode,name_status,code_verification_status,webhook_configuration,health_status', 'GET', undefined, c.token))),
    };
  }));
  return salida;
}

/** Coexistencia: pedirle a Meta los chats de los últimos 6 meses del
 *  celular, si el negocio aceptó compartirlos al conectar. Con tipo
 *  "contactos", la agenda del celular (el nombre con que guardaron a cada
 *  uno). Se puede sólo en las primeras 24 h después del alta. Llegan de a
 *  partes como avisos "history" o "smb_app_state_sync", y la base los
 *  guarda enteros en wa_avisos: se leen después, con calma. */
async function historial(p: { numero_id?: unknown; tipo?: unknown }) {
  const num = (await numeros()).find((n) => n.id === String(p.numero_id ?? ''));
  if (!num) return { ok: false, error: 'Ese número no es nuestro.' };
  const sync = p.tipo === 'contactos' ? 'smb_app_state_sync' : 'history';
  const r = await meta('/' + num.id + '/smb_app_data', 'POST', { messaging_product: 'whatsapp', sync_type: sync }, num.token, true);
  return r?.error ? { ok: false, error: r.error } : { ok: true, r };
}

/** Suscribe la app a las cuentas: sin esto Meta no le manda nada. */
async function suscribir() {
  return Promise.all(CUENTAS.map(async (c) => ({ id: c.id, r: await meta('/' + c.id + '/subscribed_apps', 'POST', undefined, c.token) })));
}

/** Nuestros números, de todas las cuentas, con su token. Se le pregunta a
 *  Meta cada diez minutos como mucho: si el de la tienda se reconecta, a los
 *  diez minutos ya se puede usar. "conectado" es que está en la API. */
interface Numero { id: string; digitos: string; display: string; nombre: string; conectado: boolean; cuenta: string; token: string; }
let NUMEROS: { cuando: number; lista: Numero[] } | null = null;
async function numeros(): Promise<Numero[]> {
  if (!NUMEROS || Date.now() - NUMEROS.cuando > 10 * 60 * 1000) {
    const lista: Numero[] = [];
    for (const c of CUENTAS) {
      if (!c.token) continue;
      const r = await meta('/' + c.id + '/phone_numbers?fields=id,display_phone_number,verified_name,status,platform_type', 'GET', undefined, c.token);
      (r?.data ?? []).forEach((n: any) => lista.push({
        id: String(n.id), display: n.display_phone_number, digitos: String(n.display_phone_number ?? '').replace(/\D/g, ''),
        nombre: n.verified_name, conectado: n.status === 'CONNECTED' && n.platform_type === 'CLOUD_API', cuenta: c.id, token: c.token,
      }));
    }
    NUMEROS = { cuando: Date.now(), lista };
  }
  return NUMEROS.lista;
}
/** Desde qué número sale: el mismo por el que hablaron, si sigue conectado;
 *  si no, el del CRM (el primero conectado, en el orden de WA_CUENTAS). */
async function numeroPara(numeroId?: string | null): Promise<Numero | undefined> {
  const l = await numeros();
  return l.find((n) => n.id === String(numeroId ?? '') && n.conectado) ?? l.find((n) => n.conectado);
}
const cuentaDe = (id: unknown) => CUENTAS.find((c) => c.id === String(id ?? '') && c.token);

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

/** Guarda lo que salió. Si falla, salió igual: el estado de Meta deja la
 *  marca y la conversación sigue bien. */
async function anotar(p: Record<string, unknown>) {
  try { await rpc('wa_anotar_envio', { p }); } catch (e) { console.error('whatsapp: salió pero no se pudo guardar:', String(e)); }
}

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
  const num = (await numeros()).find((n) => n.id === String(prep.numero_id));
  if (!num?.conectado) return { ok: false, error: 'El número al que escribió no está conectado al CRM.' };
  const r = await meta('/' + num.id + '/messages', 'POST', {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: prep.tel,
    type: 'text', text: { body: texto, preview_url: true },
  }, num.token, true);
  const wamid = r?.messages?.[0]?.id;
  if (!wamid) {
    console.error('whatsapp: Meta no aceptó el envío:', JSON.stringify(r?.error ?? r));
    return { ok: false, error: 'WhatsApp no lo aceptó' + (r?.error?.mensaje ? ': ' + r.error.mensaje : '.'), codigo: r?.error?.codigo };
  }
  await anotar({ wamid, numero_id: num.id, numero: prep.numero ?? num.digitos, tel: prep.tel, texto, quien: String(p.quien ?? '').slice(0, 60) });
  return { ok: true, wamid };
}

/* ═══ Plantillas (10/10/2026) ═══════════════════════════════════════════
   Para escribirle a alguien que no escribió, o pasadas las 24 h, Meta sólo
   deja mandar plantillas que revisó y aprobó. Los datos que cambian van con
   nombre ({{nombre}}, {{producto}}…): Meta los acepta así desde 2024
   (parameter_format "named"), y en el CRM se entiende qué es cada uno. */

/** Las plantillas de todas las cuentas, como las tiene Meta. */
async function plantillas(p: { pin?: string }) {
  if (!(await pinValido(p.pin))) return { ok: false, error: 'PIN incorrecto.' };
  const nums = await numeros();
  const cuentas = await Promise.all(CUENTAS.filter((c) => c.token).map(async (c) => {
    const r = await meta('/' + c.id + '/message_templates?fields=' + CAMPOS_PLANTILLA + '&limit=200', 'GET', undefined, c.token);
    return {
      id: c.id,
      numeros: nums.filter((n) => n.cuenta === c.id).map((n) => ({ id: n.id, display: n.display, nombre: n.nombre, conectado: n.conectado })),
      plantillas: r?.data ?? [],
      error: r?.error ? (r.error.usuario || r.error.mensaje) : undefined,
    };
  }));
  return { ok: true, cuentas };
}

/** Lo que Meta exige, revisado antes de mandárselo: así el error se dice
 *  en castellano y en el momento, no en un rechazo una hora después. */
function revisarPlantilla(p: any): { error?: string; datos?: Record<string, unknown> } {
  const nombre = String(p.nombre ?? '').trim().toLowerCase();
  if (!/^[a-z0-9_]{1,512}$/.test(nombre)) return { error: 'El nombre sólo puede tener letras minúsculas, números y guiones bajos.' };
  const cuerpo = String(p.cuerpo ?? '').trim();
  if (!cuerpo) return { error: 'Falta el mensaje.' };
  if (cuerpo.length > 1024) return { error: 'El mensaje no puede pasar de 1024 caracteres.' };
  const marcas = cuerpo.match(/\{\{[^}]*\}\}/g) ?? [];
  if (marcas.some((m) => !/^\{\{[a-z_]+\}\}$/.test(m))) return { error: 'Hay un dato mal escrito: tiene que ser como {{nombre}}.' };
  if (/^\{\{/.test(cuerpo) || /\}\}$/.test(cuerpo)) return { error: 'El mensaje no puede empezar ni terminar con un dato: sumale texto antes o después.' };
  if (/\}\}\s*\{\{/.test(cuerpo)) return { error: 'Hay dos datos seguidos: poné algo de texto entre medio.' };
  const vars = [...new Set(marcas.map((m) => m.slice(2, -2)))];
  const ejemplos = p.ejemplos ?? {};
  for (const v of vars) {
    if (!String(ejemplos[v] ?? '').trim()) return { error: 'Falta un ejemplo para {{' + v + '}}: Meta lo pide para revisarla.' };
  }
  const encabezado = String(p.encabezado ?? '').trim();
  if (encabezado.length > 60) return { error: 'El título no puede pasar de 60 caracteres.' };
  if (/\{\{/.test(encabezado)) return { error: 'El título no puede llevar datos.' };
  const pie = String(p.pie ?? '').trim();
  if (pie.length > 60) return { error: 'El pie no puede pasar de 60 caracteres.' };
  const botones = (Array.isArray(p.botones) ? p.botones : []).filter((b: any) => String(b?.texto ?? '').trim());
  if (botones.length > 10) return { error: 'Como mucho, 10 botones.' };
  if (botones.filter((b: any) => b.tipo === 'URL').length > 2) return { error: 'Como mucho, 2 botones con link.' };
  for (const b of botones) {
    if (String(b.texto).trim().length > 25) return { error: 'El texto de un botón no puede pasar de 25 caracteres.' };
    if (b.tipo === 'URL' && !/^https:\/\/\S+$/.test(String(b.url ?? '').trim())) return { error: 'El link de un botón tiene que empezar con https://' };
  }
  const componentes: unknown[] = [];
  if (encabezado) componentes.push({ type: 'HEADER', format: 'TEXT', text: encabezado });
  componentes.push(vars.length
    ? { type: 'BODY', text: cuerpo, example: { body_text_named_params: vars.map((v) => ({ param_name: v, example: String(ejemplos[v]).trim() })) } }
    : { type: 'BODY', text: cuerpo });
  if (pie) componentes.push({ type: 'FOOTER', text: pie });
  if (botones.length) {
    componentes.push({ type: 'BUTTONS', buttons: botones.map((b: any) => b.tipo === 'URL'
      ? { type: 'URL', text: String(b.texto).trim(), url: String(b.url).trim() }
      : { type: 'QUICK_REPLY', text: String(b.texto).trim() }) });
  }
  return { datos: {
    name: nombre, language: p.idioma === 'es' ? 'es' : 'es_AR', category: p.categoria === 'UTILITY' ? 'UTILITY' : 'MARKETING',
    ...(vars.length ? { parameter_format: 'named' } : {}), components: componentes,
  } };
}

async function plantillaCrear(p: any) {
  if (!(await pinValido(p.pin))) return { ok: false, error: 'PIN incorrecto.' };
  const c = cuentaDe(p.cuenta);
  if (!c) return { ok: false, error: 'Esa cuenta de WhatsApp no está conectada al CRM.' };
  const rev = revisarPlantilla(p);
  if (rev.error) return { ok: false, error: rev.error };
  const r = await meta('/' + c.id + '/message_templates', 'POST', rev.datos, c.token, true);
  if (r?.error) {
    console.error('whatsapp: Meta no aceptó la plantilla:', JSON.stringify(r.error));
    return { ok: false, error: 'Meta no la aceptó' + (r.error.usuario || r.error.mensaje ? ': ' + (r.error.usuario || r.error.mensaje) : '.') };
  }
  return { ok: true, id: r.id, estado: r.status, categoria: r.category };
}

async function plantillaBorrar(p: any) {
  if (!(await pinValido(p.pin))) return { ok: false, error: 'PIN incorrecto.' };
  const c = cuentaDe(p.cuenta);
  if (!c) return { ok: false, error: 'Esa cuenta de WhatsApp no está conectada al CRM.' };
  const nombre = String(p.nombre ?? '');
  if (!/^[a-z0-9_]{1,512}$/.test(nombre)) return { ok: false, error: 'Falta el nombre de la plantilla.' };
  const r = await meta('/' + c.id + '/message_templates?name=' + encodeURIComponent(nombre) +
                       (p.id ? '&hsm_id=' + encodeURIComponent(String(p.id)) : ''), 'DELETE', undefined, c.token);
  if (r?.error) return { ok: false, error: 'Meta no la borró' + (r.error.usuario || r.error.mensaje ? ': ' + (r.error.usuario || r.error.mensaje) : '.') };
  return { ok: true };
}

/** Antes de mandar una plantilla: la base dice a qué número (y si se puede:
 *  "No escribir" es un no), y acá se elige desde cuál de los nuestros. */
async function prepararPlantilla(p: any): Promise<{ error?: Record<string, unknown>; prep?: any; num?: Numero }> {
  let prep: any;
  try {
    prep = await rpc('wa_preparar_plantilla', { p_pin: String(p.pin ?? ''), p_clave: String(p.clave ?? '') });
  } catch (e) {
    return { error: { ok: false, error: /PIN/.test(String(e)) ? 'PIN incorrecto.'
      : /wa_preparar_plantilla|Could not find/i.test(String(e)) ? 'Falta correr el SQL 65 en Supabase.' : 'No se pudo preparar el envío.' } };
  }
  if (!prep?.ok) {
    return { error: { ok: false, motivo: prep?.motivo,
      error: prep?.motivo === 'no_escribir' ? 'Tiene la etiqueta "No escribir": no se le manda nada.'
           : 'No tiene un teléfono para escribirle por WhatsApp.' } };
  }
  const num = await numeroPara(prep.numero_id);
  if (!num) return { error: { ok: false, error: 'No hay ningún número de WhatsApp conectado al CRM.' } };
  return { prep, num };
}

async function plantillasPara(p: any) {
  const x = await prepararPlantilla(p);
  if (x.error) return x.error;
  const { prep, num } = x as { prep: any; num: Numero };
  const r = await meta('/' + num.cuenta + '/message_templates?fields=' + CAMPOS_PLANTILLA + '&limit=200', 'GET', undefined, num.token);
  return {
    ok: true,
    contacto: { nombre: prep.nombre, acepta: prep.acepta, ventana: prep.ventana },
    numero: { id: num.id, display: num.display, nombre: num.nombre, cuenta: num.cuenta },
    plantillas: (r?.data ?? []).filter((t: any) => t.status === 'APPROVED'),
    error: r?.error ? (r.error.usuario || r.error.mensaje) : undefined,
  };
}

/** Un dato para Meta: una sola línea, sin tabulaciones ni muchos espacios
 *  seguidos (si no, rechaza el envío). */
const limpio = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 1000);

async function enviarPlantilla(p: any) {
  const nombre = String(p.nombre ?? '');
  if (!/^[a-z0-9_]{1,512}$/.test(nombre)) return { ok: false, error: 'Falta elegir la plantilla.' };
  const x = await prepararPlantilla(p);
  if (x.error) return x.error;
  const { prep, num } = x as { prep: any; num: Numero };
  const conNombre = p.formato === 'named';
  const parametros = (l: unknown) => (Array.isArray(l) ? l : []).map((v: any) => conNombre
    ? { type: 'text', parameter_name: String(v?.nombre ?? ''), text: limpio(v?.texto) }
    : { type: 'text', text: limpio(v?.texto ?? v) });
  const cuerpo = parametros(p.parametros?.cuerpo), titulo = parametros(p.parametros?.titulo);
  if ([...cuerpo, ...titulo].some((v: any) => !v.text)) return { ok: false, error: 'Completá todos los datos de la plantilla.' };
  const componentes: unknown[] = [];
  if (titulo.length) componentes.push({ type: 'header', parameters: titulo });
  if (cuerpo.length) componentes.push({ type: 'body', parameters: cuerpo });
  const r = await meta('/' + num.id + '/messages', 'POST', {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: prep.tel, type: 'template',
    template: { name: nombre, language: { code: String(p.idioma || 'es_AR') }, ...(componentes.length ? { components: componentes } : {}) },
  }, num.token, true);
  const wamid = r?.messages?.[0]?.id;
  if (!wamid) {
    console.error('whatsapp: Meta no aceptó la plantilla:', JSON.stringify(r?.error ?? r));
    return { ok: false, error: 'WhatsApp no la aceptó' + (r?.error?.usuario || r?.error?.mensaje ? ': ' + (r.error.usuario || r.error.mensaje) : '.'),
             codigo: r?.error?.codigo };
  }
  await anotar({ wamid, numero_id: num.id, numero: num.digitos, tel: prep.tel, tipo: 'template',
                 texto: String(p.texto ?? '').slice(0, 4000), media: { plantilla: nombre, idioma: String(p.idioma || 'es_AR') },
                 quien: String(p.quien ?? '').slice(0, 60) });
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

  // Lo que pide el CRM, y la configuración.
  let pedido: { accion?: string; [k: string]: unknown } = {};
  try { pedido = JSON.parse(new TextDecoder().decode(cuerpo)); } catch { /* vacío */ }
  try {
    switch (pedido.accion) {
      case 'enviar': return json(await enviar(pedido as any));
      case 'plantillas': return json(await plantillas(pedido as any));
      case 'plantilla_crear': return json(await plantillaCrear(pedido));
      case 'plantilla_borrar': return json(await plantillaBorrar(pedido));
      case 'plantillas_para': return json(await plantillasPara(pedido));
      case 'enviar_plantilla': return json(await enviarPlantilla(pedido));
      case 'estado': return json(await estado());
      case 'suscribir': return json(await suscribir());
      case 'webhook': return json(await webhook());
      case 'historial': return json(await historial(pedido));
    }
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
  return json({ error: 'accion desconocida' }, 400);
});
