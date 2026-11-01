// Edge Function: leer-papel (SQL 219, 31/10/2026)
// La IA lee un certificado médico o un apercibimiento y devuelve los datos para completar el formulario de Papeles.
// Body, una de dos:
//  - { tipo, hojas: ["<jpeg en base64>", …], persona_id?, local_ids? }: las hojas recién sacadas, antes de guardar.
//    persona_id: el papel es de esa persona (el vendedor, su certificado); local_ids: de alguien de esos locales
//    (el supervisor que anota: la IA elige a quién por el nombre del papel). Un apercibimiento firmado lo sube
//    también cualquiera de su local (SQL 221): con local_ids = su local.
//  - { legajo_id }: un papel ya guardado: lee sus hojas del lugar privado y le pega la lectura ("Leer con la IA", o
//    el certificado que se sumó a una ausencia ya anotada).
// Devuelve { ok: true, lectura, lectura_id, pegada } o { ok: false, mensaje }. Si la IA falla, se completa a mano.
// Lo que se lee y a quién se ve lo decide la base con la sesión de quien pide (clienteUsuario): sólo lo suyo, lo de
// los locales que supervisa o, si es un apercibimiento, la gente de su local.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { aBase64, clienteServicio, clienteUsuario, cors, env, json } from "../_shared/comun.ts";
import type { Imagen } from "../_shared/ia.ts";
import { type Candidato, leerPapel, type TipoPapel } from "../_shared/papel_ia.ts";

const MAX_HOJAS = 4;          // un certificado es una hoja; con 4 alcanza y el pedido no pesa de más
const LEGAJOS = "legajos";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La gente a la que puede corresponder el papel, con la seguridad de quien pide. */
async function gente(usuario: SupabaseClient, filtro: { persona: string } | { locales: string[] }): Promise<Candidato[]> {
  let q = usuario.from("orden_personas").select("id,nombre,inicial,apellido").eq("activo", true);
  q = "persona" in filtro ? q.eq("id", filtro.persona)
    : q.in("local_id", filtro.locales).in("rol", ["vendedor", "supervisor"]).order("nombre").limit(150);
  const { data, error } = await q;
  if (error) throw new Error(`No se pudo leer la gente: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    nombre: [p.nombre, p.apellido || (p.inicial ? `${p.inicial}.` : "")].filter(Boolean).join(" "),
  }));
}

async function esSupervisor(usuario: SupabaseClient, local: string | null): Promise<boolean> {
  if (!local) return false;
  const { data } = await usuario.rpc("orden_es_supervisor_de", { p_local: local });
  return data === true;
}

/** Una hoja del lugar privado, con la sesión de quien pide (si no la puede ver, falla). */
async function bajar(usuario: SupabaseClient, ruta: string): Promise<Imagen> {
  const { data, error } = await usuario.storage.from(LEGAJOS).download(ruta);
  if (error || !data) throw new Error(`No se pudo bajar la hoja: ${error?.message}`);
  const tipo = ["image/jpeg", "image/png", "image/webp"].includes(data.type) ? data.type : "image/jpeg";
  return { media_type: tipo, data: aBase64(new Uint8Array(await data.arrayBuffer())) };
}

function hoyAR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Usar POST" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }

  const usuario = clienteUsuario(req);
  const { data: yo } = await usuario.rpc("orden_yo_id");
  if (typeof yo !== "string" || !UUID.test(yo)) return json({ error: "Entrá de nuevo a la app." }, 401);

  let tipo: TipoPapel, imagenes: Imagen[], candidatos: Candidato[], legajoId: string | null = null;
  try {
    if (typeof body.legajo_id === "string") {
      // Un papel ya guardado: si quien pide no lo ve, para la base no existe.
      const { data: f } = await usuario.from("orden_legajo").select("id,tipo,persona_id,local_id,fotos")
        .eq("id", body.legajo_id).maybeSingle();
      if (!f) return json({ error: "No encontramos ese papel." }, 404);
      // La lectura se le pega sólo si quien pide es la persona o quien supervisa el local (como en la base).
      if (f.persona_id !== yo && !(await esSupervisor(usuario, f.local_id))) return json({ error: "No podés leer este papel." }, 403);
      const fotos: string[] = Array.isArray(f.fotos) ? f.fotos : [];
      if (!fotos.length) return json({ ok: false, mensaje: "Ese papel todavía no tiene la foto." });
      tipo = f.tipo;
      legajoId = f.id;
      imagenes = await Promise.all(fotos.slice(0, MAX_HOJAS).map((r) => bajar(usuario, r)));
      candidatos = await gente(usuario, { persona: f.persona_id });
    } else {
      if (body.tipo !== "ausencia" && body.tipo !== "apercibimiento") return json({ error: "Falta el tipo de papel" }, 400);
      tipo = body.tipo;
      const hojas = Array.isArray(body.hojas) ? body.hojas.slice(0, MAX_HOJAS) : [];
      if (!hojas.length || hojas.some((h) => typeof h !== "string" || h.length > 7_000_000 || !/^[A-Za-z0-9+/]+=*$/.test(h))) {
        return json({ error: "Faltan las hojas" }, 400);
      }
      imagenes = hojas.map((data) => ({ media_type: "image/jpeg", data: data as string }));
      if (typeof body.persona_id === "string" && UUID.test(body.persona_id)) {
        const pid = body.persona_id;
        candidatos = await gente(usuario, { persona: pid });
        if (pid !== yo) {
          const { data: p } = await usuario.from("orden_personas").select("local_id").eq("id", pid).maybeSingle();
          if (!(await esSupervisor(usuario, p?.local_id ?? null))) return json({ error: "No podés leer papeles de esa persona." }, 403);
        }
      } else {
        const pedidos = (Array.isArray(body.local_ids) ? body.local_ids : []).filter((l): l is string => typeof l === "string" && UUID.test(l)).slice(0, 30);
        /* El apercibimiento firmado lo sube cualquiera de su local (SQL 221): la gente de su propio local, sí. */
        let miLocal: string | null = null;
        if (tipo === "apercibimiento") {
          const { data: m } = await usuario.from("orden_personas").select("local_id").eq("id", yo).maybeSingle();
          miLocal = m?.local_id ?? null;
        }
        const locales: string[] = [];
        for (const l of pedidos) if (l === miLocal || await esSupervisor(usuario, l)) locales.push(l);
        if (!locales.length) return json({ error: "No podés leer papeles de esos locales." }, 403);
        candidatos = await gente(usuario, { locales });
      }
      if (!candidatos.length) return json({ error: "No encontramos a esa gente." }, 403);
    }
  } catch (e) {
    console.error("leer-papel: preparar", e);
    return json({ ok: false, mensaje: "No pudimos leer la hoja: completá los datos a mano." });
  }

  const sb = clienteServicio();
  const modelo = Deno.env.get("ORDEN_IA_MODELO_PAPELES") ?? "claude-opus-5-5";
  try {
    const lectura = await leerPapel({ tipo, imagenes, candidatos, hoy: hoyAR(), modelo, apiKey: env("ANTHROPIC_API_KEY") });
    // Queda anotada (SQL 219) para pegarla al papel; sin la tabla, la lectura sirve igual para completar el formulario.
    const { data: fila, error: eFila } = await sb.from("orden_legajo_lecturas")
      .insert({ tipo, pedido_por: yo, persona_id: lectura.persona_id, lectura, modelo }).select("id").maybeSingle();
    if (eFila) console.error("leer-papel: no se anotó la lectura", eFila.message);
    const lecturaId: string | null = fila?.id ?? null;
    let pegada = false;
    if (legajoId && lecturaId) {
      const { error } = await usuario.rpc("orden_legajo_con_lectura", { p_id: legajoId, p_lectura: lecturaId });
      if (error) console.error("leer-papel: no se pegó la lectura", error.message);
      pegada = !error;
    }
    return json({ ok: true, lectura, lectura_id: lecturaId, pegada });
  } catch (e) {
    console.error("leer-papel", legajoId, e);
    const motivo = (e instanceof Error ? e.message : String(e)).slice(0, 1000);
    await sb.from("orden_legajo_lecturas").insert({ tipo, pedido_por: yo, error: motivo, modelo });
    return json({ ok: false, mensaje: "No pudimos leer la hoja: completá los datos a mano." });
  }
});
