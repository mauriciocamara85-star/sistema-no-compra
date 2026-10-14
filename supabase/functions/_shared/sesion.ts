/**
 * VDH · La persona que entró, en lugar del PIN compartido (13/10/2026).
 *
 * Las pantallas del No Compra mandan pin = 'sesion' y, en Authorization, la
 * sesión de la persona que entró con su usuario (persona.js). Estas
 * funciones hablan con la base con la service role, y ahí no hay auth.uid():
 * por eso la sesión se revisa acá, preguntándole a la base quién es
 * (nc_yo, con SU token). Si es de la oficina, la base arma la marca
 * 'sesion:<id>:<sello>' (nc_marca_persona, sólo con la service role): el
 * sello lo sabe sólo la base, así que una marca armada en la pantalla no
 * pasa. pin_ok (SQL 107) la acepta SÓLO con la service role, y también la
 * aceptan las funciones que corren con ella (wa_preparar_envio y las demás).
 *
 * Todo lo que empiece con "sesion" y no sea exactamente 'sesion' (una marca
 * que vino de afuera), y una sesión que no sirve, pasan a 'sesion:no': pin_ok
 * lo rechaza sin gastar un intento del PIN compartido (con un pin vacío, en
 * cambio, lo contaría).
 */
const OFICINA = ['admin', 'atencion', 'gerencia'];

export async function pinDeLaPersona(pin: unknown, req: Request): Promise<unknown> {
  if (typeof pin !== 'string' || !pin.startsWith('sesion')) return pin;
  if (pin !== 'sesion') return 'sesion:no';
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!token || !url || !anon || !servicio || token === anon || token === servicio) return 'sesion:no';
  try {
    const r = await fetch(url + '/rest/v1/rpc/nc_yo', {
      method: 'POST',
      headers: { apikey: anon, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!r.ok) return 'sesion:no';
    const y = await r.json();
    if (!y || typeof y.id !== 'string' || y.activo === false || y.aprobado !== true || !OFICINA.includes(String(y.rol))) return 'sesion:no';
    /* La marca, con el sello: la arma la base, que vuelve a mirar que sea de
       la oficina (y que tenga el PIN de 6). */
    const m = await fetch(url + '/rest/v1/rpc/nc_marca_persona', {
      method: 'POST',
      headers: { apikey: servicio, Authorization: 'Bearer ' + servicio, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_persona: y.id }),
    });
    if (!m.ok) return 'sesion:no';
    const marca = await m.json();
    return typeof marca === 'string' && marca.startsWith('sesion:' + y.id + ':') ? marca : 'sesion:no';
  } catch {
    return 'sesion:no';
  }
}
