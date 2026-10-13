/**
 * VDH · La persona que entró, en lugar del PIN compartido (13/10/2026).
 *
 * Las pantallas del No Compra mandan pin = 'sesion' y, en Authorization, la
 * sesión de la persona que entró con su usuario (persona.js). Estas
 * funciones hablan con la base con la service role, y ahí no hay auth.uid():
 * por eso la sesión se revisa acá, preguntándole a la base quién es
 * (nc_yo, con SU token), y si es de la oficina (Administración, Atención o
 * Gerencia, activa y aprobada) el pin pasa a ser 'sesion:<id>'. pin_ok (SQL
 * 107) acepta eso SÓLO con la service role, y también lo aceptan las
 * funciones que corren con ella (wa_preparar_envio y las demás).
 *
 * Si la sesión no sirve, devuelve 'sesion:no': pin_ok lo rechaza sin gastar
 * un intento del PIN compartido (con un pin vacío, en cambio, lo contaría).
 */
const OFICINA = ['admin', 'atencion', 'gerencia'];

export async function pinDeLaPersona(pin: unknown, req: Request): Promise<unknown> {
  if (pin !== 'sesion') return pin;
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!token || !url || !anon || token === anon) return 'sesion:no';
  try {
    const r = await fetch(url + '/rest/v1/rpc/nc_yo', {
      method: 'POST',
      headers: { apikey: anon, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!r.ok) return 'sesion:no';
    const y = await r.json();
    if (!y || typeof y.id !== 'string' || y.activo === false || y.aprobado !== true || !OFICINA.includes(String(y.rol))) return 'sesion:no';
    return 'sesion:' + y.id;
  } catch {
    return 'sesion:no';
  }
}
