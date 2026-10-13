// Edge Function: resumen-cajas  (pg_cron, todas las noches a las 23:30 de Argentina)
// Manda al grupo de Telegram de encargados/supervisores cómo dieron las cajas del día.
// Variables: TELEGRAM_BOT_TOKEN y TELEGRAM_GRUPO_CAJAS (id del grupo; si son varios, separados por coma).
// El bot tiene que estar agregado al grupo. Desplegar con --no-verify-jwt.
import { clienteServicio, esLlamadaDelReloj, json } from "../_shared/comun.ts";
import { enviarTelegram } from "../_shared/envios.ts";

type Alerta = { tipo: string; campo?: string; monto?: number; foto?: string };
type Resumen = {
  fecha: string; locales: number; ok: string[]; sin_cargar: string[];
  con_alertas: { local: string; alertas: Alerta[] }[];
};

const pesos = (n: number) => "$" + Math.round(n).toLocaleString("es-AR");

export function formatearCajas(r: Resumen): string {
  const [, m, d] = r.fecha.split("-");
  const lineas = [`💰 Cierres de caja · ${d}/${m}`];
  if (!r.sin_cargar.length && !r.con_alertas.length) {
    lineas.push("", `✅ Todas las cajas dieron bien (${r.locales} locales).`);
    return lineas.join("\n");
  }
  if (r.ok.length) lineas.push("", `✅ Bien: ${r.ok.join(", ")}`);
  if (r.con_alertas.length) {
    lineas.push("", "⚠️ Con diferencias:");
    for (const l of r.con_alertas) {
      const detalle = l.alertas.map((a) =>
        a.tipo === "desvio"
          ? `${a.campo} ${(a.monto ?? 0) > 0 ? "falta" : "sobra"} ${pesos(Math.abs(a.monto ?? 0))}`
          : a.tipo === "foto_otro_dia"
          ? `foto de ${a.foto} de otro día`
          : "un monto no coincide con la foto"
      ).join(" · ");
      lineas.push(`• ${l.local}: ${detalle}`);
    }
  }
  if (r.sin_cargar.length) lineas.push("", `❌ Sin cargar: ${r.sin_cargar.join(", ")} — verificar mañana`);
  return lineas.join("\n");
}

Deno.serve(async (req) => {
  if (!esLlamadaDelReloj(req)) return json({ error: "No autorizado" }, 401);
  const grupos = (Deno.env.get("TELEGRAM_GRUPO_CAJAS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!grupos.length) return json({ error: "Falta TELEGRAM_GRUPO_CAJAS" }, 500);

  // Fecha de hoy en Argentina (o ?fecha=AAAA-MM-DD para reenviar un día)
  const fecha = new URL(req.url).searchParams.get("fecha") ??
    new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

  const { data, error } = await clienteServicio().rpc("orden_resumen_cajas_dia", { p_fecha: fecha });
  if (error) return json({ error: error.message }, 500);
  const r = data as Resumen;
  if (!r.locales) return json({ fecha, omitido: "ningún local con control de caja activo" });

  const texto = formatearCajas(r);
  for (const g of grupos) await enviarTelegram(g, texto);
  return json({ fecha, enviado: grupos.length });
});
