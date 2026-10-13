// Edge Function: tick  (la llama pg_cron cada 15 minutos; ver migración 3)
// 1) orden_tick(): genera controles y desafíos, vence lo atrasado, escala al supervisor/admin
//    y sugiere faltas;
// 2) orden_tick_cajas(): avisa si un local no cargó la caja o si el supervisor no la controló;
// 3) manda por push y Telegram los avisos pendientes;
// 4) una vez por día (03:00 de Argentina) borra fotos viejas para no llenar el espacio.
// Desplegar con:  supabase functions deploy tick --no-verify-jwt
import { BUCKET, clienteServicio, esLlamadaDelReloj, json } from "../_shared/comun.ts";
import { enviarAvisosPendientes } from "../_shared/envios.ts";

Deno.serve(async (req) => {
  if (!esLlamadaDelReloj(req)) return json({ error: "No autorizado" }, 401);
  const sb = clienteServicio();
  try {
    const { data: resumen, error } = await sb.rpc("orden_tick");
    if (error) throw new Error(error.message);
    const { data: cajas, error: e2 } = await sb.rpc("orden_tick_cajas");
    if (e2) throw new Error(e2.message);
    const envio = await enviarAvisosPendientes(sb);

    let borradas = 0;
    const ahora = new Date();
    if (ahora.getUTCHours() === 6 && ahora.getUTCMinutes() < 15) borradas = await limpiarFotos(sb);

    return json({ resumen, cajas, envio, borradas });
  } catch (e) {
    console.error("tick", e);
    return json({ error: String(e) }, 500);
  }
});

async function limpiarFotos(sb: ReturnType<typeof clienteServicio>): Promise<number> {
  const { data, error } = await sb.rpc("orden_fotos_para_borrar", { p_limite: 500 });
  if (error || !data?.length) return 0;
  const filas = data as { origen: string; id: string; foto_path: string }[];
  const { error: e } = await sb.storage.from(BUCKET).remove(filas.map((f) => f.foto_path));
  if (e) {
    console.error("limpiarFotos", e);
    return 0;
  }
  await sb.rpc("orden_marcar_fotos_borradas", {
    p_modulo: filas.filter((f) => f.origen === "modulo").map((f) => f.id),
    p_caja: filas.filter((f) => f.origen === "caja").map((f) => f.id),
  });
  return filas.length;
}
