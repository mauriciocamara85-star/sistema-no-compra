/**
 * VDH Club — la tarjeta en Google Wallet.
 *
 * Pedido de Mauricio (03/10/2026): la tarjeta del Club en la billetera del
 * celular, como las de Starbucks, Macro y Día. Se muestra en la caja sin
 * abrir la app, los puntos se actualizan solos y, cerca de un local, Google
 * avisa en la pantalla bloqueada ("Estás cerca de VDH Flores").
 *
 * ── Por qué es una Edge Function ──────────────────────────────────────────
 * Todo lo que se le pide a Google va FIRMADO con la llave privada de la
 * cuenta de servicio (RS256). La llave no puede viajar en la página del
 * socio, y Postgres no firma RSA. Es el mismo motivo que mandar-avisos.
 *
 * ── Qué hace ──────────────────────────────────────────────────────────────
 *   { accion: 'enlace', codigo }  Desde el botón "Agregar a Google Wallet"
 *       de Inicio. Crea (o pone al día) el pase de ese socio y devuelve el
 *       enlace para guardarlo. El código ES la credencial, como en toda la
 *       app: quien lo tiene ya ve la tarjeta.
 *   { accion: 'actualizar' }      Desde el reloj de pg_cron (SQL 47), sólo
 *       cuando algún pase quedó atrás de sus puntos. Manda los puntos y el
 *       nivel nuevos a Google. No recibe nada de afuera ni devuelve datos:
 *       que la llame cualquiera no le sirve a nadie.
 *   { accion: 'clase' }           Vuelve a mandar el diseño de la tarjeta
 *       (colores, logo, enlace). Se usa al cambiarlo acá.
 *
 * La llave va en el secreto GOOGLE_WALLET_KEY (el JSON entero de la cuenta
 * id-vdh-wallet del proyecto vdh-club). Nunca en este archivo: el
 * repositorio es público.
 */

const EMISOR = '3388000000023209945';
const CLASE = EMISOR + '.vdh_club';
const APP = 'https://vdhclub.com/tarjeta.html';
const WALLET = 'https://walletobjects.googleapis.com/walletobjects/v1';

const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/* Los locales con sus coordenadas, para el aviso "Estás cerca". Copia de
   locales.js del Club: si se abre o se muda un local, cambia en los dos.
   Google acepta hasta DIEZ por pase, y son catorce: a cada socio le van los
   diez más cercanos a su local. */
const LOCALES: Array<[string, string, number, number]> = [
  ['CASEROS', 'Caseros', -34.6082063, -58.5641809],
  ['DOT', 'DOT', -34.5457549, -58.4886799],
  ['FLORES', 'Flores', -34.6280613, -58.4607126],
  ['GRAND BOURG', 'Grand Bourg', -34.4864512, -58.7256373],
  ['ITUZAINGÓ', 'Ituzaingó', -34.6592212, -58.6682757],
  ['LOMAS DE ZAMORA', 'Lomas de Zamora', -34.7605528, -58.4019821],
  ['MAR DEL PLATA', 'Mar del Plata', -38.0003352, -57.5472193],
  ['MORÓN', 'Morón', -34.6493715, -58.6209339],
  ['PACHECO', 'Pacheco', -34.4601914, -58.6346208],
  ['PARQUE BROWN', 'Parque Brown', -34.675453, -58.459394],
  ['SAN JUSTO', 'San Justo', -34.678939, -58.5601992],
  ['SAN JUSTO SHOPPING', 'San Justo Shopping', -34.6848089, -58.5573727],
  ['UNICENTER', 'Unicenter', -34.5081762, -58.527121],
  ['VILLA DEL PARQUE', 'Villa del Parque', -34.6029909, -58.4939357],
];

/* ── La llave y las firmas ─────────────────────────────────────────────── */

interface Llave { client_email: string; private_key: string }

function llave(): Llave {
  /* .trim(): se carga pegando a mano en el panel, y un salto de línea de
     más ya nos costó una noche con VAPID. */
  return JSON.parse((Deno.env.get('GOOGLE_WALLET_KEY') ?? '').trim());
}

const b64url = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const texto64 = (s: string) => b64url(new TextEncoder().encode(s));

async function firmar(datos: Record<string, unknown>, k: Llave): Promise<string> {
  const pem = k.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const clave = await crypto.subtle.importKey('pkcs8', der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const cuerpo = texto64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + texto64(JSON.stringify(datos));
  const firma = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', clave, new TextEncoder().encode(cuerpo)));
  return cuerpo + '.' + b64url(firma);
}

/** El permiso de una hora para hablar con la API de Wallet. */
async function permiso(k: Llave): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  const jwt = await firmar({
    iss: k.client_email, scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
    aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600
  }, k);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt
  });
  const j = await r.json();
  if (!j.access_token) { throw new Error('Google no dio el permiso: ' + JSON.stringify(j).slice(0, 300)); }
  return j.access_token;
}

async function google(tok: string, metodo: string, ruta: string, cuerpo?: unknown) {
  const r = await fetch(WALLET + ruta, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
  });
  const t = await r.text();
  return { status: r.status, ok: r.ok, cuerpo: t ? JSON.parse(t) : null };
}

/* ── La tarjeta ────────────────────────────────────────────────────────── */

const es = (value: string) => ({ defaultValue: { language: 'es-AR', value } });

/** El diseño, igual para todos: carbón, el logo y el enlace a la app. */
function clase() {
  return {
    id: CLASE,
    issuerName: 'VDH',
    programName: 'VDH Club',
    programLogo: { sourceUri: { uri: 'https://vdhclub.com/logo-wallet.png' }, contentDescription: es('VDH') },
    hexBackgroundColor: '#1C1C1A',
    countryCode: 'AR',
    reviewStatus: 'UNDER_REVIEW',
    multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES',
    accountIdLabel: 'Socio',
    accountNameLabel: 'Nombre',
    linksModuleData: { uris: [{ id: 'app', uri: APP, description: 'Abrir VDH Club' }] }
  };
}

interface Socio { cliente: number; codigo: string; nombre: string; puntos: number; nivel: string; local_alta: string | null }

const bonito = (d: string) => d.replace(/(\d{4})(?=\d)/g, '$1 ');
const objetoId = (cliente: number) => EMISOR + '.socio-' + cliente;

/** Los diez locales más cerca del suyo (en línea recta: alcanza para
    ordenar). Sin local conocido, desde Flores. */
function cercanos(local: string | null) {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  const suyo = LOCALES.find((l) => norm(l[0]) === norm(local ?? '')) ?? LOCALES.find((l) => l[0] === 'FLORES')!;
  return LOCALES
    .map((l) => ({ l, d: (l[2] - suyo[2]) ** 2 + (l[3] - suyo[3]) ** 2 }))
    .sort((a, b) => a.d - b.d).slice(0, 10)
    .map(({ l }) => ({ latitude: l[2], longitude: l[3] }));
}

/** Lo que cambia con cada compra. Va aparte para mandar sólo esto. */
const puntosDe = (s: Socio) => ({
  accountName: s.nombre,
  /* Como texto y no como número: con { int } Google escribe "8,901", a la
     americana, aunque el pase esté en castellano. */
  loyaltyPoints: { label: 'Puntos', balance: { string: String(Math.floor(Number(s.puntos) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') } },
  secondaryLoyaltyPoints: { label: 'Nivel', balance: { string: s.nivel } }
});

function objeto(s: Socio) {
  return {
    id: objetoId(s.cliente),
    classId: CLASE,
    state: 'ACTIVE',
    accountId: bonito(s.codigo),
    ...puntosDe(s),
    /* El mismo Code 128 de la app: en la caja se escanea igual. */
    barcode: { type: 'CODE_128', value: s.codigo, alternateText: bonito(s.codigo) },
    merchantLocations: cercanos(s.local_alta)
  };
}

/* ── La base ───────────────────────────────────────────────────────────── */

async function base(ruta: string, init: RequestInit = {}) {
  return await fetch(URL_BASE + '/rest/v1/' + ruta, {
    ...init,
    headers: { apikey: SERVICIO, Authorization: 'Bearer ' + SERVICIO, 'Content-Type': 'application/json', ...(init.headers ?? {}) }
  });
}

async function anotar(s: Socio) {
  await base('club_wallet?on_conflict=cliente', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ cliente: s.cliente, puntos: s.puntos, nivel: s.nivel, nombre: s.nombre, actualizado: new Date().toISOString() })
  });
}

/* ── Las acciones ──────────────────────────────────────────────────────── */

async function asegurarClase(tok: string, forzar = false) {
  const r = await google(tok, 'GET', '/loyaltyClass/' + CLASE);
  if (r.status === 404) {
    const n = await google(tok, 'POST', '/loyaltyClass', clase());
    if (!n.ok) { throw new Error('No se pudo crear la tarjeta: ' + JSON.stringify(n.cuerpo).slice(0, 400)); }
  } else if (forzar) {
    const n = await google(tok, 'PUT', '/loyaltyClass/' + CLASE, clase());
    if (!n.ok) { throw new Error('No se pudo cambiar la tarjeta: ' + JSON.stringify(n.cuerpo).slice(0, 400)); }
  } else if (!r.ok) {
    throw new Error('Google no contestó la tarjeta: ' + JSON.stringify(r.cuerpo).slice(0, 400));
  }
}

async function enlace(codigo: string, k: Llave) {
  const r = await base('rpc/club_wallet_socio', { method: 'POST', body: JSON.stringify({ p_codigo: codigo }) });
  const s: Socio | null = r.ok ? await r.json() : null;
  if (!s || !s.cliente) { return { ok: false, porque: 'No encontramos esa tarjeta.' }; }

  const tok = await permiso(k);
  await asegurarClase(tok);
  const o = objeto(s);
  const ya = await google(tok, 'GET', '/loyaltyObject/' + o.id);
  const hecho = ya.status === 404
    ? await google(tok, 'POST', '/loyaltyObject', o)
    : await google(tok, 'PUT', '/loyaltyObject/' + o.id, o);
  if (!hecho.ok) { throw new Error('No se pudo armar el pase: ' + JSON.stringify(hecho.cuerpo).slice(0, 400)); }
  await anotar(s);

  const jwt = await firmar({
    iss: k.client_email, aud: 'google', typ: 'savetowallet', iat: Math.floor(Date.now() / 1000),
    origins: ['https://vdhclub.com'],
    payload: { loyaltyObjects: [{ id: o.id }] }
  }, k);
  /* ver: el enlace directo al pase ya guardado (04/10/2026). La app lo
     guarda y "Ver en la Billetera" lo abre al instante, sin volver a pasar
     por acá; con la app de Google Wallet anda hasta sin señal. */
  return { ok: true, url: 'https://pay.google.com/gp/v/save/' + jwt, ver: 'https://pay.google.com/gp/v/object/' + o.id };
}

async function actualizar(k: Llave) {
  const r = await base('rpc/club_wallet_pendientes', { method: 'POST', body: '{}' });
  const lista: Socio[] = r.ok ? await r.json() : [];
  if (!lista.length) { return { ok: true, actualizados: 0 }; }
  const tok = await permiso(k);
  let bien = 0, mal = 0;
  for (const s of lista) {
    const x = await google(tok, 'PATCH', '/loyaltyObject/' + objetoId(s.cliente), puntosDe(s));
    if (x.ok) { bien++; await anotar(s); } else { mal++; }
  }
  return { ok: true, actualizados: bien, fallaron: mal };
}

Deno.serve(async (req) => {
  const responder = (cuerpo: unknown, codigo = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status: codigo,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });
  if (req.method === 'OPTIONS') { return responder({ ok: true }); }

  let k: Llave;
  try { k = llave(); } catch (_) { return responder({ ok: false, porque: 'Falta el secreto GOOGLE_WALLET_KEY.' }, 500); }

  try {
    const p = await req.json().catch(() => ({}));
    if (p.accion === 'enlace') { return responder(await enlace(String(p.codigo ?? '').replace(/\D/g, ''), k)); }
    if (p.accion === 'actualizar') { return responder(await actualizar(k)); }
    if (p.accion === 'clase') { await asegurarClase(await permiso(k), true); return responder({ ok: true }); }
    return responder({ ok: false, porque: 'Acción desconocida.' }, 400);
  } catch (e) {
    return responder({ ok: false, porque: String((e as Error).message ?? e) }, 500);
  }
});
