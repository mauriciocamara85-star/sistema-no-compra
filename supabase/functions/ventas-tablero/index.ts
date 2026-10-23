/**
 * Sistema VDH — las tablas de ventas para el dashboard y el Ranking, directo del sistema.
 *
 * ── Qué reemplaza ─────────────────────────────────────────────────────────
 * Hasta el 26/10/2026 el dashboard (dashboard-vdh) y el Ranking (ranking-vdh)
 * leían un enlace de Google (el /exec del consolidador), que armaba las tablas
 * leyendo cada hora las 14 planillas de los locales y la del e-commerce. Desde
 * que los locales cargan en el sistema (la pantalla Ventas), esto devuelve
 * exactamente lo mismo, armado con lo cargado: las dos apps sólo cambian el
 * enlace. Pedido de Mauricio (23/10): "sin Drive, sin un consolidador de
 * planilla, sin nada".
 *
 * ── Cómo se pide ──────────────────────────────────────────────────────────
 *   GET /functions/v1/ventas-tablero                 → { LOCAL_DIARIO, VENDEDOR_DIARIO, VENDEDOR_SEMANAL,
 *                                                        ECOM_DIARIO, ECOM_SEMANAL }
 *   GET /functions/v1/ventas-tablero?tabla=ECOM_DIARIO → sólo esa tabla (como ?tabla= del consolidador)
 * Sin llave, como el /exec de antes: se publica con --no-verify-jwt.
 *
 * Los datos los junta ventas_tablero() en la base (supabase/ventas-tablero.sql)
 * y las cuentas las hace tablero.js con ventas-calc.js, las mismas de la pantalla.
 */
import './ventas-calc.js';
import './tablero.js';

// deno-lint-ignore no-explicit-any
const Tablero = (globalThis as any).Tablero;

/* Éstos los pone Supabase sola en toda Edge Function: no hay que cargarlos. */
const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
};

/* Si entran muchos juntos (el Ranking lo abren los vendedores), la misma cuenta sirve un minuto: la
   carga de un local tarda eso en verse. El consolidador tardaba hasta una hora. */
const VIDA_MS = 60_000;
let guardado: { en: number; tablas: Record<string, unknown[]> } | null = null;

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

async function tablas() {
  if (guardado && Date.now() - guardado.en < VIDA_MS) return guardado.tablas;
  const r = await fetch(URL_BASE + '/rest/v1/rpc/ventas_tablero', {
    method: 'POST',
    headers: { apikey: SERVICIO, Authorization: 'Bearer ' + SERVICIO, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!r.ok) throw new Error('la base contestó ' + r.status + ': ' + (await r.text()).slice(0, 200));
  guardado = { en: Date.now(), tablas: Tablero.armar(await r.json()) };
  return guardado.tablas;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'GET') return responder({ error: 'Sólo GET' }, 405);
  const tabla = (new URL(req.url).searchParams.get('tabla') ?? '').trim();
  if (tabla && !Tablero.TABLAS.includes(tabla)) {
    return responder({ error: 'Tabla no permitida', tablas: Tablero.TABLAS }, 400);
  }
  try {
    const t = await tablas();
    return responder(tabla ? t[tabla] : t);
  } catch (e) {
    return responder({ error: String((e as Error).message ?? e) }, 500);
  }
});
