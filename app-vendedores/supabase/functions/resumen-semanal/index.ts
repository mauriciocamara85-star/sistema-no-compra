// Edge Function: resumen-semanal  (la llama pg_cron los lunes 08:30; ver migración 3)
// Manda por Telegram, a los admins y al supervisor de cada local, cómo vino la semana anterior.
// Desplegar con:  supabase functions deploy resumen-semanal --no-verify-jwt
import { clienteServicio, esLlamadaDelReloj, json } from "../_shared/comun.ts";
import { enviarTelegram } from "../_shared/envios.ts";

type Persona = {
  nombre: string; nivel: string | null; controles: number; controles_a_tiempo: number;
  tareas: number; tareas_hechas: number; tareas_fuera_de_plazo: number;
  desafio_puntaje: number | null; desafio_total: number | null;
};
type Resumen = {
  local: string; semana: string; controles: number; controles_a_tiempo: number; controles_vencidos: number;
  controles_tarde: number; tareas: number; tareas_hechas: number; tareas_fuera_de_plazo: number;
  tareas_pendientes: number; nivel_local: string | null; personas: Persona[]; sin_revisar: number;
  faltas_sugeridas: string[]; sin_avisos?: string[];
};

function lunesAnterior(hoy = new Date()): string {
  // Fecha de Argentina (UTC-3)
  const ar = new Date(hoy.getTime() - 3 * 3600_000);
  const dow = (ar.getUTCDay() + 6) % 7; // 0 = lunes
  ar.setUTCDate(ar.getUTCDate() - dow - 7);
  return ar.toISOString().slice(0, 10);
}

function pct(a: number, b: number): string {
  return b > 0 ? ` (${Math.round((a / b) * 100)}%)` : "";
}

export function formatear(r: Resumen): string {
  const [y, m, d] = r.semana.split("-");
  const lineas = [
    `📋 Orden · ${r.local} · semana del ${d}/${m}/${y}`,
    "",
    `Controles: ${r.controles_a_tiempo} de ${r.controles} a tiempo${pct(r.controles_a_tiempo, r.controles)}` +
      (r.controles_vencidos ? ` · ${r.controles_vencidos} sin mandar` : "") +
      (r.controles_tarde ? ` · ${r.controles_tarde} tarde` : ""),
    `Tareas: ${r.tareas_hechas} hechas de ${r.tareas}` +
      (r.tareas_fuera_de_plazo ? ` · ${r.tareas_fuera_de_plazo} fuera de plazo` : "") +
      (r.tareas_pendientes ? ` · ${r.tareas_pendientes} pendiente${r.tareas_pendientes === 1 ? "" : "s"}` : ""),
    `Nivel del local: ${r.nivel_local ?? "sin datos"}`,
    "",
    "Por vendedor",
    ...r.personas.map((p) =>
      `• ${p.nombre}: ${p.nivel ?? "sin datos"} · controles ${p.controles_a_tiempo}/${p.controles}` +
      ` · tareas ${p.tareas_hechas}/${p.tareas}` +
      (p.tareas_fuera_de_plazo ? ` (${p.tareas_fuera_de_plazo} fuera de plazo)` : "") +
      (p.desafio_total ? ` · desafío ${p.desafio_puntaje}/${p.desafio_total}` : "")
    ),
  ];
  if (r.sin_revisar) lineas.push("", `⚠️ Fotos sin revisar: ${r.sin_revisar}`);
  if (r.faltas_sugeridas?.length) lineas.push(`⚠️ Faltas para decidir: ${r.faltas_sugeridas.join(", ")}`);
  if (r.sin_avisos?.length) lineas.push(`🔕 Sin notificaciones activadas: ${r.sin_avisos.join(", ")}`);
  return lineas.join("\n");
}

Deno.serve(async (req) => {
  const sb = clienteServicio();
  if (!(await esLlamadaDelReloj(req, sb))) return json({ error: "No autorizado" }, 401);
  const semana = new URL(req.url).searchParams.get("semana") ?? lunesAnterior();

  const { data: locales, error } = await sb.from("orden_locales").select("id, nombre").eq("activo", true);
  if (error) return json({ error: error.message }, 500);

  const { data: admins } = await sb.from("orden_personas")
    .select("telegram_chat_id").eq("rol", "admin").eq("activo", true).not("telegram_chat_id", "is", null);

  const salida: unknown[] = [];
  for (const l of locales ?? []) {
    const { data: resumen, error: e } = await sb.rpc("orden_resumen_semanal", { p_local: l.id, p_semana: semana });
    if (e || !resumen || !(resumen as Resumen).controles) {
      salida.push({ local: l.nombre, omitido: e?.message ?? "sin datos" });
      continue;
    }
    const texto = formatear(resumen as Resumen);
    const { data: sups } = await sb.from("orden_personas")
      .select("telegram_chat_id").eq("rol", "supervisor").eq("local_id", l.id).eq("activo", true)
      .not("telegram_chat_id", "is", null);
    const destinos = [...new Set([...(admins ?? []), ...(sups ?? [])].map((p) => p.telegram_chat_id as string))];
    for (const chat of destinos) {
      try {
        await enviarTelegram(chat, texto, sb);
      } catch (err) {
        console.error("resumen-semanal", l.nombre, chat, err);
      }
    }
    salida.push({ local: l.nombre, destinos: destinos.length });
  }
  return json({ semana, locales: salida });
});
