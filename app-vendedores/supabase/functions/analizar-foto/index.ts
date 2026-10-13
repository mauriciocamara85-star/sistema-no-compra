// Edge Function: analizar-foto
// La llama la app del vendedor justo después de registrar la foto.
// Body: { "foto_id": "<uuid>" }   (lo devuelve orden_registrar_foto u orden_completar_tarea)
// Responde al instante con lo que vio la IA y las tareas que se crearon.
//
// Variables: ANTHROPIC_API_KEY (obligatoria), ORDEN_IA_MODELO (opcional, por defecto claude-sonnet-5-5).
import { clienteServicio, clienteUsuario, cors, descargarFoto, env, json } from "../_shared/comun.ts";
import { analizarConClaude, type Contexto } from "../_shared/ia.ts";

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

  // 1) Como el usuario: valida que la foto sea suya (o que sea supervisor) y trae el contexto
  const usuario = clienteUsuario(req);
  const { data: ctx, error: errCtx } = await usuario.rpc("orden_preparar_analisis", { p_foto: fotoId });
  if (errCtx || !ctx) return json({ error: errCtx?.message ?? "Sin acceso" }, 403);
  const contexto = ctx as Contexto & { ia_estado: string };
  if (!contexto.ia_activa) return json({ ia_activa: false });
  // Cada foto se analiza una sola vez (evita gastar en la API y "probar suerte" con la misma foto)
  if (contexto.ia_estado === "ok" || contexto.ia_estado === "invalida") {
    return json({ ia_activa: true, ya_analizada: true, mensaje: "Esta foto ya se revisó. Para volver a revisar, sacá otra." });
  }

  const sb = clienteServicio();
  const modelo = Deno.env.get("ORDEN_IA_MODELO") ?? "claude-sonnet-5-5";

  try {
    // 2) Descarga la foto y la de referencia (si hay)
    const foto = await descargarFoto(sb, contexto.foto_path);
    const referencia = contexto.referencia_path
      ? await descargarFoto(sb, contexto.referencia_path).catch(() => null)
      : null;

    // 3) Le pregunta a Claude
    const resultado = await analizarConClaude({
      ctx: contexto,
      foto,
      referencia,
      modelo,
      apiKey: env("ANTHROPIC_API_KEY"),
    });

    // 4) Guarda el resultado, crea las tareas y cierra las que ya se corrigieron
    const { data, error } = await sb.rpc("orden_aplicar_resultado_ia", {
      p_foto: fotoId,
      p_resultado: resultado,
      p_modelo: modelo,
    });
    if (error) throw new Error(error.message);
    return json({ ia_activa: true, ...data });
  } catch (e) {
    // Si la IA falla, el vendedor NO queda trabado: puede enviar igual y lo revisa el supervisor.
    console.error("analizar-foto", fotoId, e);
    await sb.rpc("orden_marcar_error_ia", { p_foto: fotoId, p_error: String(e) });
    return json({
      ia_activa: true,
      error_ia: true,
      mensaje: "No pudimos revisar la foto automáticamente. Podés enviarla igual.",
    });
  }
});
