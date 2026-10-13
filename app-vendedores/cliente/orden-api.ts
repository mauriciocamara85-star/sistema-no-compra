// =====================================================================
// Módulo VDH · funciones para la app (vendedor y supervisor)
// Sirve para cualquier frontend (React, Vue, HTML suelto) con @supabase/supabase-js v2.
// Todas las reglas viven en la base: acá solo se llaman.
// =====================================================================
import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "orden-fotos";

export type Nivel = "impecable" | "bien" | "a_mejorar" | "fuera_de_estandar";
export const NIVEL_TEXTO: Record<Nivel, string> = {
  impecable: "Impecable",
  bien: "Bien",
  a_mejorar: "A mejorar",
  fuera_de_estandar: "Fuera de estándar",
};

/** Las 4 preguntas de "Antes de enviar" según el sector. */
export const PREGUNTAS = {
  salon: [
    { clave: "dobladas", texto: "¿Prendas dobladas y prolijas?" },
    { clave: "frontales", texto: "¿Frontales completos (4 prendas)?" },
    { clave: "etiquetas", texto: "¿Etiquetas adentro y con precio?" },
    { clave: "limpieza", texto: "¿Limpio y sin faltantes?" },
  ],
  deposito: [
    { clave: "dobladas", texto: "¿Dobladas en tamaño A4?" },
    { clave: "rotulado", texto: "¿Estantes y cajas rotulados?" },
    { clave: "talles", texto: "¿Separado por segmento y talle?" },
    { clave: "limpieza", texto: "¿Pasillos libres y limpio?" },
  ],
} as const;

export type Analisis = {
  ia_activa: boolean;
  error_ia?: boolean;
  mensaje?: string;
  foto_valida?: boolean;
  motivo?: string;
  nivel?: Nivel;
  nivel_texto?: string;
  checks?: Record<string, "ok" | "mal" | "no_se_ve">;
  hallazgos?: { check: string; titulo: string; detalle?: string; gravedad: "corregir" | "sugerencia" }[];
  comentario?: string;
  tareas_creadas?: { id: string; titulo: string }[];
  tareas_resueltas?: number;
};

function hoyArgentina(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

function falla(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------

/** Achica la foto antes de subirla (lado largo 1280 px, JPEG 75%): sube rápido, ocupa ~150 KB y alcanza para la IA. */
export async function comprimirFoto(archivo: Blob, ladoMax = 1280, calidad = 0.75): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return await new Promise<Blob>((ok, mal) =>
    canvas.toBlob((b) => (b ? ok(b) : mal(new Error("No se pudo procesar la foto"))), "image/jpeg", calidad)
  );
}

async function subir(sb: SupabaseClient, path: string, foto: Blob): Promise<string> {
  const { error } = await sb.storage.from(BUCKET).upload(path, foto, { contentType: "image/jpeg", upsert: false });
  falla(error);
  return path;
}

export async function urlFoto(sb: SupabaseClient, path: string, segundos = 3600): Promise<string> {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, segundos);
  falla(error);
  return data!.signedUrl;
}

/** Pide a la IA que revise una foto ya registrada. */
export async function analizarFoto(sb: SupabaseClient, fotoId: string): Promise<Analisis> {
  const { data, error } = await sb.functions.invoke("analizar-foto", { body: { foto_id: fotoId } });
  if (error) return { ia_activa: true, error_ia: true, mensaje: "No pudimos revisar la foto. Podés enviarla igual." };
  return data as Analisis;
}

// ---------------------------------------------------------------------
// Vendedor
// ---------------------------------------------------------------------

/** Controles de hoy y los pendientes (incluye el depósito de la semana). */
export async function misControles(sb: SupabaseClient) {
  const { data, error } = await sb
    .from("orden_v_controles")
    .select("*")
    .or(`fecha.eq.${hoyArgentina()},estado.eq.pendiente`)
    .neq("tipo", "correccion")
    .order("sector_tipo")
    .order("modulo_numero");
  falla(error);
  return data ?? [];
}

/**
 * Saca la foto de un control: comprime, sube, registra y la IA la revisa al instante.
 * Se puede llamar varias veces (repetir foto) hasta enviar el control.
 */
export async function fotoDeControl(
  sb: SupabaseClient,
  c: { id: string; local_id: string },
  archivo: Blob,
): Promise<{ fotoId: string; analisis: Analisis }> {
  const foto = await comprimirFoto(archivo);
  const path = `${c.local_id}/${hoyArgentina()}/${c.id}/${crypto.randomUUID()}.jpg`;
  await subir(sb, path, foto);
  const { data: fotoId, error } = await sb.rpc("orden_registrar_foto", { p_control: c.id, p_foto_path: path });
  falla(error);
  return { fotoId: fotoId as string, analisis: await analizarFoto(sb, fotoId as string) };
}

/** Envía el control con las 4 respuestas: { dobladas: true, frontales: false, ... } */
export async function enviarControl(sb: SupabaseClient, controlId: string, respuestas: Record<string, boolean>) {
  const { data, error } = await sb.rpc("orden_enviar_control", { p_control: controlId, p_respuestas: respuestas });
  falla(error);
  return data;
}

export async function misTareas(sb: SupabaseClient) {
  const { data, error } = await sb
    .from("orden_v_tareas")
    .select("*")
    .in("estado", ["pendiente", "vencida"])
    .order("vence_en");
  falla(error);
  return data ?? [];
}

/** Marca la tarea como hecha. Si manda foto de un módulo, la IA la revisa. */
export async function completarTarea(
  sb: SupabaseClient,
  t: { id: string; local_id: string },
  archivo?: Blob,
): Promise<{ analisis?: Analisis }> {
  let path: string | null = null;
  if (archivo) {
    path = `${t.local_id}/tareas/${t.id}/${crypto.randomUUID()}.jpg`;
    await subir(sb, path, await comprimirFoto(archivo));
  }
  const { data, error } = await sb.rpc("orden_completar_tarea", { p_tarea: t.id, p_foto_path: path });
  falla(error);
  const fotoId = (data as { foto_id: string | null }).foto_id;
  return fotoId ? { analisis: await analizarFoto(sb, fotoId) } : {};
}

export async function noPudeTarea(sb: SupabaseClient, tareaId: string, motivo: string) {
  falla((await sb.rpc("orden_no_pude_tarea", { p_tarea: tareaId, p_motivo: motivo })).error);
}

export async function pedirMasTiempo(sb: SupabaseClient, tareaId: string, motivo: string) {
  falla((await sb.rpc("orden_pedir_prorroga", { p_tarea: tareaId, p_motivo: motivo })).error);
}

export async function misAvisos(sb: SupabaseClient, limite = 30) {
  const { data, error } = await sb.from("orden_avisos").select("*").order("creado_en", { ascending: false }).limit(limite);
  falla(error);
  return data ?? [];
}

export async function marcarLeidos(sb: SupabaseClient, ids: string[]) {
  falla((await sb.rpc("orden_marcar_avisos_leidos", { p_ids: ids })).error);
}

/** Mi resumen por semana (para "Mi historial"). */
export async function miHistorial(sb: SupabaseClient, semanas = 8) {
  const { data, error } = await sb.from("orden_v_persona_semana").select("*").order("semana", { ascending: false }).limit(semanas);
  falla(error);
  return data ?? [];
}

export async function reglaDeColores(sb: SupabaseClient) {
  const { data, error } = await sb.from("orden_colores").select("nombre, hex").eq("activo", true).order("orden");
  falla(error);
  return data ?? [];
}

export async function tableros(sb: SupabaseClient) {
  const { data, error } = await sb.from("orden_tableros").select("*").eq("activo", true)
    .order("destacado", { ascending: false }).order("orden");
  falla(error);
  return data ?? [];
}

// ---------- Desafío semanal ----------
export async function miDesafio(sb: SupabaseClient) {
  const { data, error } = await sb.rpc("orden_desafio_mio");
  falla(error);
  return data as null | {
    id: string; categoria: "producto" | "retail"; vence_en: string; terminado_en: string | null;
    puntaje: number; total: number;
    preguntas: {
      id: string; tema: string; pregunta: string; imagen_path: string | null; opciones: string[];
      respondida: boolean; elegida: number | null; correcta: number | null; explicacion: string | null;
    }[];
  };
}

/** opcion: 1..4. Devuelve si acertó y la explicación (para aprender). */
export async function responderDesafio(sb: SupabaseClient, desafioId: string, preguntaId: string, opcion: number) {
  const { data, error } = await sb.rpc("orden_desafio_responder", {
    p_desafio: desafioId, p_pregunta: preguntaId, p_opcion: opcion,
  });
  falla(error);
  return data as { acerto: boolean; correcta: number; explicacion: string | null; puntaje: number; total: number; terminado: boolean };
}

// ---------- Notificaciones push ----------
function base64UrlABytes(base64: string): ArrayBuffer {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
}

/**
 * Activa las notificaciones en este teléfono. Llamar desde un toque del usuario (botón "Activar avisos").
 * En iPhone solo funciona si la app está instalada en la pantalla de inicio (iOS 16.4 o más).
 */
export async function activarAvisos(sb: SupabaseClient, vapidPublicKey: string): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  const permiso = await Notification.requestPermission();
  if (permiso !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlABytes(vapidPublicKey) }));
  const json = sub.toJSON();
  const { error } = await sb.rpc("orden_guardar_push", {
    p_endpoint: json.endpoint, p_p256dh: json.keys!.p256dh, p_auth: json.keys!.auth,
  });
  falla(error);
  return true;
}

/** Lo único que cada uno configura de sí mismo: nombre y foto. */
export async function actualizarPerfil(sb: SupabaseClient, localId: string, cambios: { nombre?: string; foto?: Blob }) {
  let path: string | null = null;
  if (cambios.foto) {
    path = `${localId}/perfiles/${crypto.randomUUID()}.jpg`;
    await subir(sb, path, await comprimirFoto(cambios.foto, 512, 0.8));
  }
  const { data, error } = await sb.rpc("orden_actualizar_perfil", { p_nombre: cambios.nombre ?? null, p_foto_path: path });
  falla(error);
  return data;
}

// ---------- Control de caja (lo carga quien cierra el local) ----------
export type TipoFotoCaja = "sistema" | "lote" | "mp" | "gocuotas";

export async function cajaDeHoy(sb: SupabaseClient) {
  const { data, error } = await sb.rpc("orden_caja_hoy");
  falla(error);
  return data as { id: string; local_id: string; fecha: string; estado: string; [k: string]: unknown };
}

/** Sube una foto del cierre y devuelve lo que leyó la IA para precargar el formulario. */
export async function fotoDeCaja(
  sb: SupabaseClient,
  caja: { id: string; local_id: string; fecha: string },
  tipo: TipoFotoCaja,
  archivo: Blob,
): Promise<{ ok: boolean; lectura?: Record<string, number | string | null>; mensaje?: string }> {
  const path = `${caja.local_id}/cajas/${caja.fecha}/${tipo}-${crypto.randomUUID()}.jpg`;
  await subir(sb, path, await comprimirFoto(archivo, 1800, 0.85)); // un poco más de resolución: son números
  const { data: fotoId, error } = await sb.rpc("orden_caja_registrar_foto", { p_caja: caja.id, p_tipo: tipo, p_foto_path: path });
  falla(error);
  const { data, error: e2 } = await sb.functions.invoke("leer-caja", { body: { foto_id: fotoId } });
  if (e2) return { ok: false, mensaje: "No pudimos leer la foto. Cargá los números a mano." };
  return data;
}

/**
 * Guarda los montos confirmados. Claves: sis_tarjeta, sis_efectivo, sis_mp, sis_gocuotas, sis_total,
 * sis_saldo_final_efvo, real_lote, real_mp, real_gocuotas, real_efectivo (obligatorio), etc.
 * Devuelve la caja con los desvíos y las alertas.
 */
export async function guardarCaja(sb: SupabaseClient, cajaId: string, valores: Record<string, number>, observaciones?: string) {
  const { data, error } = await sb.rpc("orden_caja_guardar", { p_caja: cajaId, p_valores: valores, p_observaciones: observaciones ?? null });
  falla(error);
  return data;
}

// ---------------------------------------------------------------------
// Supervisor / admin (app del supervisor y sistema No Compra)
// ---------------------------------------------------------------------

/** Cajas para controlar (pestaña Cajas del supervisor y "Control de cajas" en No Compra). */
export async function cajas(sb: SupabaseClient, filtros: { localId?: string; mes?: string; soloSinControlar?: boolean } = {}) {
  let q = sb.from("orden_v_cajas").select("*").order("fecha", { ascending: false });
  if (filtros.localId) q = q.eq("local_id", filtros.localId);
  if (filtros.mes) q = q.eq("mes", filtros.mes);
  if (filtros.soloSinControlar) q = q.eq("estado", "cargada");
  const { data, error } = await q;
  falla(error);
  return data ?? [];
}

export async function cajasDelMes(sb: SupabaseClient, mes: string) {
  const { data, error } = await sb.from("orden_v_cajas_mes").select("*").eq("mes", mes).order("local_nombre");
  falla(error);
  return data ?? [];
}

export async function controlarCaja(sb: SupabaseClient, cajaId: string, nota?: string) {
  falla((await sb.rpc("orden_caja_controlar", { p_caja: cajaId, p_nota: nota ?? null })).error);
}

/** Personas con sus avisos (para ver en No Compra quién no activó las notificaciones). */
export async function personas(sb: SupabaseClient, localId?: string) {
  let q = sb.from("orden_v_personas").select("*").eq("activo", true).order("nombre");
  if (localId) q = q.eq("local_id", localId);
  const { data, error } = await q;
  falla(error);
  return data ?? [];
}

/** Cola de revisión: primero lo dudoso (no coincide con la IA), después lo peor. */
export async function porRevisar(sb: SupabaseClient, localId?: string) {
  let q = sb.from("orden_v_por_revisar").select("*");
  if (localId) q = q.eq("local_id", localId);
  const { data, error } = await q;
  falla(error);
  return data ?? [];
}

export async function revisarControl(sb: SupabaseClient, controlId: string, nivel: Nivel, comentario?: string) {
  const { data, error } = await sb.rpc("orden_revisar_control", { p_control: controlId, p_nivel: nivel, p_comentario: comentario ?? null });
  falla(error);
  return data;
}

export async function crearTarea(
  sb: SupabaseClient,
  t: { personas: string[]; titulo: string; detalle?: string; moduloId?: string; plazo?: "hoy" | "manana" | "semana"; requiereFoto?: boolean },
) {
  const { data, error } = await sb.rpc("orden_crear_tarea", {
    p_personas: t.personas, p_titulo: t.titulo, p_detalle: t.detalle ?? null, p_modulo: t.moduloId ?? null,
    p_plazo: t.plazo ?? null, p_requiere_foto: t.requiereFoto ?? false,
  });
  falla(error);
  return data as string[];
}

/** Botón "Recordar" de la pantalla Equipo. Devuelve false si no tiene nada pendiente o ya se le recordó en la última hora. */
export async function recordar(sb: SupabaseClient, personaId: string): Promise<boolean> {
  const { data, error } = await sb.rpc("orden_recordar", { p_persona: personaId });
  falla(error);
  return data as boolean;
}

export async function cancelarTarea(sb: SupabaseClient, tareaId: string, motivo: string) {
  falla((await sb.rpc("orden_cancelar_tarea", { p_tarea: tareaId, p_motivo: motivo })).error);
}

export async function responderProrroga(sb: SupabaseClient, tareaId: string, aprobar: boolean, plazo: "hoy" | "manana" | "semana" = "manana") {
  falla((await sb.rpc("orden_responder_prorroga", { p_tarea: tareaId, p_aprobar: aprobar, p_plazo: plazo })).error);
}

export async function faltasParaDecidir(sb: SupabaseClient) {
  // orden_faltas tiene dos relaciones con orden_personas (persona y quien decide): hay que nombrar cuál
  const { data, error } = await sb.from("orden_faltas")
    .select("*, persona:orden_personas!orden_faltas_persona_id_fkey(nombre)").eq("estado", "sugerida").order("creado_en");
  falla(error);
  return data ?? [];
}

export async function decidirFalta(sb: SupabaseClient, faltaId: string, confirmar: boolean, nota?: string) {
  falla((await sb.rpc("orden_decidir_falta", { p_falta: faltaId, p_confirmar: confirmar, p_tipo: null, p_nota: nota ?? null })).error);
}

/**
 * "Cómo está el local": la última foto de cada módulo y del depósito, con nivel, fecha, responsable
 * y tareas abiertas. Primera pantalla de Seguimiento en No Compra (para Mau, supervisores y gerencia).
 */
export async function estadoLocal(sb: SupabaseClient, localId: string) {
  const { data, error } = await sb.from("orden_v_estado_local").select("*")
    .eq("local_id", localId).order("sector_tipo", { ascending: false }).order("modulo_numero");
  falla(error);
  return data ?? [];
}

/** Historial de fotos de un módulo (las que todavía se guardan: por defecto, el último mes). */
export async function fotosDelModulo(sb: SupabaseClient, moduloId: string) {
  const { data, error } = await sb.from("orden_v_controles").select("*")
    .eq("modulo_id", moduloId).not("foto_path", "is", null).order("fecha", { ascending: false }).limit(20);
  falla(error);
  return data ?? [];
}

/** Estadísticas por vendedor y semana (pantalla Equipo / Seguimiento). */
export async function estadisticas(sb: SupabaseClient, localId: string, desde: string) {
  const { data, error } = await sb.from("orden_v_persona_semana").select("*")
    .eq("local_id", localId).gte("semana", desde).order("semana", { ascending: false });
  falla(error);
  return data ?? [];
}
