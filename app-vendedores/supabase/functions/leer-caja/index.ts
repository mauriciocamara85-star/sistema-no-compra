// Edge Function: leer-caja
// La app la llama después de registrar cada foto del cierre (orden_caja_registrar_foto).
// Body: { "foto_id": "<uuid>" }  → devuelve los montos leídos para precargar el formulario.
import { clienteServicio, clienteUsuario, cors, descargarFoto, env, json } from "../_shared/comun.ts";
import { leerFotoCaja, type TipoFoto } from "../_shared/caja_ia.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Usar POST" }, 405);

  let fotoId: string | undefined;
  try {
    ({ foto_id: fotoId } = await req.json());
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  if (!fotoId) return json({ error: "Falta foto_id" }, 400);

  const { data: ctx, error } = await clienteUsuario(req).rpc("orden_caja_preparar_lectura", { p_foto: fotoId });
  if (error || !ctx) return json({ error: error?.message ?? "Sin acceso" }, 403);

  const sb = clienteServicio();
  const modelo = Deno.env.get("ORDEN_IA_MODELO") ?? "claude-sonnet-5-5";
  try {
    const foto = await descargarFoto(sb, ctx.foto_path);
    const lectura = await leerFotoCaja({
      tipo: ctx.tipo as TipoFoto, fecha: ctx.fecha, local: ctx.local, foto, modelo, apiKey: env("ANTHROPIC_API_KEY"),
    });
    await sb.rpc("orden_caja_aplicar_lectura", { p_foto: fotoId, p_resultado: lectura, p_modelo: modelo });
    return json({ ok: true, tipo: ctx.tipo, lectura });
  } catch (e) {
    console.error("leer-caja", fotoId, e);
    await sb.from("orden_caja_fotos").update({ ia_estado: "error" }).eq("id", fotoId);
    // Si la IA falla, se cargan los números a mano: no se traba el cierre.
    return json({ ok: false, mensaje: "No pudimos leer la foto. Cargá los números a mano." });
  }
});
