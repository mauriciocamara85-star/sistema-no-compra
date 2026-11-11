/**
 * Sistema VDH · La puerta de la función «arca» (11/11/2026).
 *
 * ── El POS (paso 2) ───────────────────────────────────────────────────────
 *   POST /functions/v1/arca   { accion: 'facturar', venta_id }   con la sesión de la persona (Authorization)
 *     → { ok: true, factura } | { ok: true, no_va } | { ok: false, error }        (ver facturar.ts)
 *   La base decide qué factura le toca y si la persona puede ver esa venta.
 *
 * ── Diagnóstico (paso 1) ──────────────────────────────────────────────────
 * Sólo con la llave de diagnóstico (el secreto ARCA_DIAG, en la cabecera x-arca-llave):
 *   POST /functions/v1/arca   { accion, ambiente? }     ambiente: 'homologacion' (por defecto) | 'produccion'
 *     · estado      → ¿andan los servidores de ARCA?, ¿está cargado el certificado?, ¿hay permiso vigente?
 *     · ultimo      → { punto_venta, tipo }: el último número autorizado
 *     · consultar   → { punto_venta, tipo, numero }: un comprobante como lo tiene ARCA
 *     · condiciones → { clase: 'A' | 'B' }: las condiciones de IVA que ARCA acepta para esa clase
 *     · probar      → SÓLO en homologación: pide una Factura B de prueba de $1.210 (sin valor fiscal)
 *
 * Se publica con --no-verify-jwt: quién entra lo decide esta función.
 */
import { ArcaError, condicionesIva, consultar, credencial, esAmbiente, hoyArca, pedirCae, servidores, ticket, ultimoNumero } from './arca.ts';
import { facturar } from './facturar.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-arca-llave',
};

function responder(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Comparar dos textos sin que el tiempo que tarda diga cuántas letras coinciden. */
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** ¿Trae la llave de diagnóstico? Sin el secreto cargado (o con uno corto), no entra nadie. */
function conLlave(req: Request): boolean {
  const llave = Deno.env.get('ARCA_DIAG') ?? '';
  return llave.length >= 32 && igual(llave, req.headers.get('x-arca-llave') ?? '');
}

function porque(e: unknown): { error: string; codigo: string } {
  if (e instanceof ArcaError) return { error: e.message, codigo: e.codigo };
  console.error('arca:', e);
  return { error: 'Algo falló al hablar con ARCA.', codigo: 'interno' };
}

function entero(x: unknown, desde: number, hasta: number): number | null {
  const n = typeof x === 'number' ? x : typeof x === 'string' && /^\d+$/.test(x) ? Number(x) : NaN;
  return Number.isInteger(n) && n >= desde && n <= hasta ? n : null;
}

export async function manejar(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return responder({ ok: false, error: 'Sólo POST.' }, 405);

  // deno-lint-ignore no-explicit-any
  let p: any;
  try { p = await req.json(); } catch { p = null; }
  if (!p || typeof p !== 'object') return responder({ ok: false, error: 'El pedido no se entiende.' }, 400);

  /* El POS: con la sesión de la persona que entró (la base mira sus permisos). */
  if (p.accion === 'facturar') {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    const anonima = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!token || token === anonima) return responder({ ok: false, error: 'Se cerró tu sesión: entrá de nuevo.', codigo: 'sin_sesion' }, 401);
    if (typeof p.venta_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(p.venta_id)) return responder({ ok: false, error: 'Falta la venta.' }, 400);
    try {
      return responder(await facturar(token, p.venta_id));
    } catch (e) {
      const x = porque(e);
      return responder({ ok: false, ...x }, x.codigo === 'sin_sesion' ? 401 : 200);
    }
  }

  if (!conLlave(req)) return responder({ ok: false, error: 'No autorizado.' }, 401);
  const amb = p.ambiente ?? 'homologacion';
  if (!esAmbiente(amb)) return responder({ ok: false, error: 'El ambiente es «homologacion» o «produccion».' }, 400);

  try {
    if (p.accion === 'estado') {
      /* Cada parte por separado: que una falle no tapa a las otras. */
      const srv = await servidores(amb).catch((e) => ({ ok: false, ...porque(e) }));
      let certificado: Record<string, unknown>;
      let permiso: Record<string, unknown> | null = null;
      try {
        const c = credencial(amb);
        certificado = { ok: true, cuit: c.cuit, vence: c.vence };
        permiso = await ticket(amb).then((t) => ({ ok: true, vence: t.vence }), (e) => ({ ok: false, ...porque(e) }));
      } catch (e) {
        certificado = { ok: false, ...porque(e) };
      }
      return responder({ ok: true, ambiente: amb, servidores: srv, certificado, permiso });
    }

    if (p.accion === 'ultimo') {
      const pv = entero(p.punto_venta, 1, 99999), tipo = entero(p.tipo, 1, 999);
      if (pv === null || tipo === null) return responder({ ok: false, error: 'Faltan el punto de venta o el tipo de comprobante.' }, 400);
      return responder({ ok: true, ambiente: amb, punto_venta: pv, tipo, numero: await ultimoNumero(amb, pv, tipo) });
    }

    if (p.accion === 'consultar') {
      const pv = entero(p.punto_venta, 1, 99999), tipo = entero(p.tipo, 1, 999), n = entero(p.numero, 1, 99999999);
      if (pv === null || tipo === null || n === null) return responder({ ok: false, error: 'Faltan el punto de venta, el tipo o el número.' }, 400);
      return responder({ ok: true, ambiente: amb, comprobante: await consultar(amb, pv, tipo, n) });
    }

    if (p.accion === 'condiciones') {
      const clase = String(p.clase ?? '').toUpperCase();
      if (!['A', 'B', 'C'].includes(clase)) return responder({ ok: false, error: 'La clase es A, B o C.' }, 400);
      return responder({ ok: true, ambiente: amb, clase, condiciones: await condicionesIva(amb, clase) });
    }

    if (p.accion === 'probar') {
      if (amb !== 'homologacion') return responder({ ok: false, error: 'La factura de prueba sólo se pide en homologación.' }, 400);
      const pv = entero(p.punto_venta ?? 1, 1, 99999);
      if (pv === null) return responder({ ok: false, error: 'El punto de venta va del 1 al 99999.' }, 400);
      const numero = (await ultimoNumero(amb, pv, 6)) + 1;
      const r = await pedirCae(amb, {
        punto_venta: pv, tipo: 6, numero, fecha: hoyArca(),
        doc_tipo: 99, doc_nro: '0', condicion_iva: 5,
        total: 1210, neto: 1000, iva: 210, alicuotas: [{ id: 5, base: 1000, importe: 210 }],
      });
      return responder({
        ok: r.aprobada, ambiente: amb,
        factura: r.aprobada ? { cae: r.cae, cae_vence: r.cae_vence, tipo: 'B', punto_venta: pv, numero } : null,
        resultado: r.resultado, observaciones: r.observaciones, errores: r.errores,
        ...(r.aprobada ? {} : { error: 'ARCA no aprobó la factura de prueba.' }),
      });
    }

    return responder({ ok: false, error: 'Esa acción no existe.' }, 400);
  } catch (e) {
    return responder({ ok: false, ...porque(e) });
  }
}
