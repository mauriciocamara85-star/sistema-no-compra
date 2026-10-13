// Envío de avisos: notificación push (web push, para la app de los vendedores)
// y Telegram (para supervisores y admins).
//
// Variables: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (ej. mailto:alguien@vdh.com.ar),
//            TELEGRAM_BOT_TOKEN (opcional), APP_URL (ej. https://orden.vdh.com.ar)
// Para generar las claves VAPID una sola vez:  npx web-push generate-vapid-keys
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

let vapidListo = false;
function prepararVapid(): boolean {
  if (vapidListo) return true;
  const pub = Deno.env.get("VAPID_PUBLIC_KEY");
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT");
  if (!pub || !priv || !subject) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidListo = true;
  return true;
}

export async function enviarTelegram(chatId: string, texto: string): Promise<void> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN");
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
          // 404/410: la suscripción ya no existe (desinstaló la app o cambió de teléfono)
          if (status === 404 || status === 410) await sb.from("orden_push_subs").delete().eq("id", s.id);
          else errores.push(`push ${status ?? ""} ${String(e).slice(0, 120)}`);
        }
      }
    }

    if (a.canal.includes("telegram") && a.persona?.telegram_chat_id) {
      try {
        const link = a.url && appUrl ? `\n${appUrl}${a.url}` : "";
        await enviarTelegram(a.persona.telegram_chat_id, `${a.titulo}${a.cuerpo ? `\n${a.cuerpo}` : ""}${link}`);
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
