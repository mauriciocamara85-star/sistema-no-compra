// Utilidades compartidas por las Edge Functions del Módulo VDH.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export function env(nombre: string): string {
  const valor = Deno.env.get(nombre);
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

/** Cliente con la clave de servicio: salta RLS. Usar solo del lado del servidor. */
export function clienteServicio(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Cliente "como el usuario" que llamó: respeta RLS y las validaciones de las funciones SQL. */
export function clienteUsuario(req: Request): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Para las funciones que llama el reloj (pg_cron): exige el secreto compartido. */
export function esLlamadaDelReloj(req: Request): boolean {
  const secreto = Deno.env.get("ORDEN_CRON_SECRET");
  return !!secreto && req.headers.get("x-orden-cron") === secreto;
}

/** Bytes → base64 sin pasarse del tamaño de pila (fotos de ~1 MB). */
export function aBase64(bytes: Uint8Array): string {
  let binario = "";
  const trozo = 0x8000;
  for (let i = 0; i < bytes.length; i += trozo) {
    binario += String.fromCharCode(...bytes.subarray(i, i + trozo));
  }
  return btoa(binario);
}

export const BUCKET = "orden-fotos";

export async function descargarFoto(
  sb: SupabaseClient,
  path: string,
): Promise<{ media_type: string; data: string }> {
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`No se pudo descargar ${path}: ${error?.message}`);
  const bytes = new Uint8Array(await data.arrayBuffer());
  const tipo = ["image/jpeg", "image/png", "image/webp"].includes(data.type) ? data.type : "image/jpeg";
  return { media_type: tipo, data: aBase64(bytes) };
}
