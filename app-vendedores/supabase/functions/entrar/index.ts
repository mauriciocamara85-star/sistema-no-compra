// Edge Function: entrar
// La llama la pantalla de login (sin sesión) cuando la persona elige su nombre y pone el PIN.
// Body: { "persona_id": "<uuid>", "pin": "1234" }
// Responde la sesión de Supabase ({ access_token, refresh_token, expires_at, persona })
// o { error, porque, espera?, restantes? } si el PIN está mal o hay que esperar.
//
// El PIN NO es la contraseña de la cuenta: el freno y el PIN se revisan en la base
// (orden_login_probar) y recién ahí se abre la sesión con una contraseña larga que
// arma esta función y nadie ve. La primera vez que alguien entra, le crea la cuenta.
//
// Deploy: supabase functions deploy entrar --no-verify-jwt   (se llama antes de tener sesión)
import { createClient } from "npm:@supabase/supabase-js@2";
import { clienteServicio, cors, env, json } from "../_shared/comun.ts";

function claveLarga(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Usar POST" }, 405);

  // Body: { persona_id, pin, apellido? }  o, para darse de alta: { alta: { local_id, nombre, apellido }, pin }
  let personaId: string | undefined, pin: string | undefined, apellido: string | undefined;
  let alta: { local_id?: string; nombre?: string; apellido?: string } | undefined;
  try {
    ({ persona_id: personaId, pin, apellido, alta } = await req.json());
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  if ((!personaId && !alta) || typeof pin !== "string") return json({ error: "Faltan la persona o el PIN" }, 400);

  const sb = clienteServicio();

  // 1) El alta propia, o el freno y el PIN (si está mal, la base lo anota y no tira error).
  //    El apellido va sólo si vino: así esto anda también con la base de antes del SQL 93.
  const { data: r, error: errProbar } = alta
    ? await sb.rpc("orden_alta_vendedor", { p_local: alta.local_id, p_nombre: alta.nombre ?? "", p_apellido: alta.apellido ?? "", p_pin: pin })
    : await sb.rpc("orden_login_probar", apellido
        ? { p_persona: personaId, p_pin: pin, p_apellido: apellido }
        : { p_persona: personaId, p_pin: pin });
  if (errProbar) return json({ error: "base", porque: errProbar.message }, 500);
  if (!r?.ok) {
    return json({ error: alta ? "alta" : "pin", porque: r?.porque, espera: r?.espera ?? 0, restantes: r?.restantes, crear: r?.crear }, alta ? 400 : 401);
  }

  // 2) La cuenta de Supabase: se crea la primera vez; si falta la contraseña, se le pone una nueva
  let uid: string | null = r.auth_user_id;
  let clave: string | null = r.clave;
  try {
    if (!uid) {
      clave = claveLarga();
      const { data, error } = await sb.auth.admin.createUser({
        email: r.mail, password: clave, email_confirm: true,
        user_metadata: { persona_id: r.persona_id },
      });
      if (error || !data.user) {
        /* Si una vez anterior se creó la cuenta pero se cortó antes de anotarla,
           Supabase dice que el mail ya existe: se la busca y se sigue con ésa. */
        const { data: existente } = await sb.rpc("orden_cuenta_de", { p_persona: r.persona_id });
        if (!existente) throw new Error(error?.message ?? "no se pudo crear la cuenta");
        uid = existente as string;
        clave = await claveNueva(uid);
      } else {
        uid = data.user.id;
        await vincular(uid, clave);
      }
    } else if (!clave) {
      clave = await claveNueva(uid);
    }
  } catch (e) {
    return json({ error: "cuenta", porque: String(e) }, 500);
  }

  // 3) La sesión, con la contraseña larga (si no anda, se renueva una vez)
  const anon = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let { data: s, error: errSesion } = await anon.auth.signInWithPassword({ email: r.mail, password: clave! });
  if (errSesion) {
    try {
      clave = await claveNueva(uid!);
    } catch (e) {
      return json({ error: "cuenta", porque: String(e) }, 500);
    }
    ({ data: s, error: errSesion } = await anon.auth.signInWithPassword({ email: r.mail, password: clave }));
  }
  if (errSesion || !s.session) return json({ error: "sesion", porque: errSesion?.message ?? "sin sesión" }, 500);

  return json({
    access_token: s.session.access_token,
    refresh_token: s.session.refresh_token,
    expires_at: s.session.expires_at,
    persona: { id: r.persona_id, nombre: r.nombre, rol: r.rol, local_id: r.local_id, aprobado: r.aprobado !== false,
               cambiar_pin: r.cambiar_pin === true },
    // SQL 110: entró con el PIN de 4 de antes y su rol pide 6 (admin, Atención,
    // gerencia): la app le pide uno nuevo ya (orden_pin_cambiar, con esta sesión).
    cambiar_pin: r.cambiar_pin === true,
  });

  async function vincular(id: string, c: string) {
    const { error } = await sb.rpc("orden_login_vincular", { p_persona: r.persona_id, p_auth: id, p_clave: c });
    if (error) throw new Error(error.message);
  }

  async function claveNueva(id: string): Promise<string> {
    const c = claveLarga();
    const { error } = await sb.auth.admin.updateUserById(id, { password: c });
    if (error) throw new Error(error.message);
    await vincular(id, c);
    return c;
  }
});
