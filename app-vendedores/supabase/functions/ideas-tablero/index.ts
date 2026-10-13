// Edge Function: ideas-tablero
// Las fotos de un tablero de Pinterest de Ideas, para verlas adentro de la app
// (pedido de Mauricio, 13/10). Pinterest no deja que el navegador lea el
// tablero (no manda CORS): lo lee esta función por su RSS público.
// Body: { "tablero_id": "<uuid>" } → { ok, enlace, fotos: [{ foto, chica, pin, titulo }] }.
// Sólo lee tableros cargados en orden_tableros que quien llama puede ver (va
// con su sesión, respeta RLS): no sirve para leer cualquier página.
import { clienteUsuario, cors, json } from "../_shared/comun.ts";
import { type FotoIdea, leerRss, tableroDe } from "../_shared/pinterest.ts";

// Mientras la función sigue prendida, el mismo tablero no se pide de nuevo por media hora.
// Si Pinterest no contesta, se recuerda medio minuto (así no espera cada vendedor 8 segundos);
// un tablero que no existe (o es secreto), 10 minutos.
const guardados = new Map<string, { hasta: number; fotos: FotoIdea[]; fallo?: string }>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Usar POST" }, 405);

  let id: string | undefined;
  try {
    ({ tablero_id: id } = await req.json());
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  if (!id) return json({ error: "Falta tablero_id" }, 400);

  const { data, error } = await clienteUsuario(req).from("orden_tableros")
    .select("url").eq("id", id).eq("activo", true).maybeSingle();
  if (error || !data) return json({ error: "No encontramos ese tablero" }, 404);

  const t = tableroDe(data.url);
  if (!t) return json({ ok: false, motivo: "no-es-tablero" });
  // El enlace para "Ver en Pinterest", sin el código para sumarse a editar el tablero.
  const enlace = `https://ar.pinterest.com/${t.usuario}/${t.tablero}/`;
  const ya = guardados.get(enlace);
  if (ya && ya.hasta > Date.now()) return json(ya.fallo ? { ok: false, enlace, motivo: ya.fallo } : { ok: true, enlace, fotos: ya.fotos });

  try {
    const r = await fetch(`https://ar.pinterest.com/${t.usuario}/${t.tablero}.rss`, {
      headers: { "User-Agent": "Mozilla/5.0 (Equipo VDH)" },
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 404) {
      guardados.set(enlace, { hasta: Date.now() + 10 * 60_000, fotos: [], fallo: "no-existe" });
      return json({ ok: false, enlace, motivo: "no-existe" });
    }
    if (!r.ok) throw new Error("Pinterest respondió " + r.status);
    const fotos = leerRss(await r.text());
    guardados.set(enlace, { hasta: Date.now() + 30 * 60_000, fotos });
    return json({ ok: true, enlace, fotos });
  } catch (e) {
    console.error("ideas-tablero", enlace, e);
    guardados.set(enlace, { hasta: Date.now() + 30_000, fotos: [], fallo: "pinterest" });
    return json({ ok: false, enlace, motivo: "pinterest" });
  }
});
