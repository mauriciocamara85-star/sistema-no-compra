// Envío de avisos: notificación push (web push, para la app de los vendedores)
// y Telegram (para supervisores y admins).
//
// Las llaves VAPID son las MISMAS del VDH Club (mandar-avisos): la pública va acá
// y en la app (impecable-comun.js); la privada es el secreto VAPID_PRIVADA, que ya
// está cargado en Supabase. Rotarlas obliga a todos a volver a activar los avisos.
// Telegram usa el bot del No Compra: su token se lee del Vault (TELEGRAM_TOKEN) con
// orden_telegram_token() (SQL 94), o de TELEGRAM_BOT_TOKEN si se carga.
// APP_URL (opcional): la dirección de la app para los enlaces de Telegram.
import webpush from "npm:web-push@3.6.7";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

type Aviso = {
  id: string;
  persona_id: string;
  titulo: string;
  cuerpo: string | null;
  url: string | null;
  canal: string[];
  persona: { telegram_chat_id: string | null } | null;
};
type Sub = { id: string; persona_id: string; endpoint: string; p256dh: string; auth: string };

const VAPID_PUBLICA = "BCG_mGNkME20VL9WrdVAUqSnPOPdNqQOIdyDGnY3UG8WbC-CbxV87N83mGVW71SZW_wrRYXMv2ZGkEWzRGLBxoo";

let vapidListo = false;
function prepararVapid(): boolean {
  if (vapidListo) return true;
  const pub = Deno.env.get("VAPID_PUBLIC_KEY") ?? VAPID_PUBLICA;
  const priv = (Deno.env.get("VAPID_PRIVATE_KEY") ?? Deno.env.get("VAPID_PRIVADA") ?? "").trim();
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:mauriciocamara85@gmail.com";
  if (!priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidListo = true;
  return true;
}

let tokenTelegram: string | null = null;
async function leerTokenTelegram(sb?: SupabaseClient): Promise<string | null> {
  if (tokenTelegram) return tokenTelegram;
  tokenTelegram = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? null;
  if (!tokenTelegram && sb) {
    const { data } = await sb.rpc("orden_telegram_token");
    tokenTelegram = typeof data === "string" && data ? data : null;
  }
  return tokenTelegram;
}

export async function enviarTelegram(chatId: string, texto: string, sb?: SupabaseClient): Promise<void> {
  const token = await leerTokenTelegram(sb);
  if (!token) throw new Error("Falta el token de Telegram");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: texto, disable_web_page_preview: true }),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Manda los avisos pendientes. Devuelve cuántos salieron. */
export async function enviarAvisosPendientes(sb: SupabaseClient, limite = 300): Promise<{ enviados: number; con_error: number }> {
  const { data: avisos, error } = await sb
    .from("orden_avisos")
    .select("id, persona_id, titulo, cuerpo, url, canal, persona:orden_personas(telegram_chat_id)")
    .eq("estado", "pendiente")
    .order("creado_en")
    .limit(limite);
  if (error) throw new Error(error.message);
  if (!avisos?.length) return { enviados: 0, con_error: 0 };

  const personas = [...new Set(avisos.map((a) => a.persona_id))];
  const { data: subs } = await sb.from("orden_push_subs").select("*").in("persona_id", personas);
  const subsPorPersona = new Map<string, Sub[]>();
  for (const s of (subs ?? []) as Sub[]) {
    subsPorPersona.set(s.persona_id, [...(subsPorPersona.get(s.persona_id) ?? []), s]);
  }

  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
  const pushDisponible = prepararVapid();
  let enviados = 0, conError = 0;

  for (const a of avisos as unknown as Aviso[]) {
    const errores: string[] = [];
    let alguno = false;

    if (a.canal.includes("push") && pushDisponible) {
      for (const s of subsPorPersona.get(a.persona_id) ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ id: a.id, titulo: a.titulo, cuerpo: a.cuerpo, url: a.url ?? "/" }),
            { TTL: 60 * 60 * 12 },
          );
          alguno = true;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // 404/410: la suscripción ya no existe (desinstaló la app o cambió de teléfono).
          // 403: se hizo con OTRA llave VAPID; tampoco va a andar nunca (lo aprendió el Club).
          if (status === 403 || status === 404 || status === 410) await sb.from("orden_push_subs").delete().eq("id", s.id);
          else errores.push(`push ${status ?? ""} ${String(e).slice(0, 120)}`);
        }
      }
    }

    if (a.canal.includes("telegram") && a.persona?.telegram_chat_id) {
      try {
        const link = a.url && appUrl ? `\n${appUrl}${a.url}` : "";
        await enviarTelegram(a.persona.telegram_chat_id, `${a.titulo}${a.cuerpo ? `\n${a.cuerpo}` : ""}${link}`, sb);
        alguno = true;
      } catch (e) {
        errores.push(String(e).slice(0, 200));
      }
    }

    // Aunque no salga por ningún canal, el aviso queda visible dentro de la app.
    await sb.from("orden_avisos").update({
      estado: alguno ? "enviado" : "error",
      enviado_en: new Date().toISOString(),
      error: alguno ? null : (errores.join(" | ") || "Sin canal: no activó notificaciones ni tiene Telegram"),
    }).eq("id", a.id);

    if (alguno) enviados++;
    else conError++;
  }
  return { enviados, con_error: conError };
}
