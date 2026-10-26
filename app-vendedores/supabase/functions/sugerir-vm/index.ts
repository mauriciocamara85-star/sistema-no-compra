// Edge Function: sugerir-vm
// La llama el croquis (vista Zonas → "Sugerir distribución"), sólo el supervisor del local o Administración.
// Body: { "local_id": "<uuid>", "modulos": [{ "id", "ref", "nombre", "zona" }] }   (los del salón, en el orden del croquis)
// Contesta al instante con { sugerencia_id, estado: "pensando" }: la IA piensa por detrás (EdgeRuntime.waitUntil) y
// deja lo que propone en orden_vm_sugerencias; el croquis lo va a buscar con orden_vm_ultima.
//
// Variables: ANTHROPIC_API_KEY (obligatoria), ORDEN_VM_MODELO (opcional, por defecto claude-opus-5-5),
// ORDEN_VM_ESFUERZO (opcional: low, medium o high; por defecto medium).
import { clienteServicio, clienteUsuario, cors, env, json } from "../_shared/comun.ts";
import { type ContextoVM, errorParaElSupervisor, sugerirConClaude } from "../_shared/vm.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Usar POST" }, 405);

  let cuerpo: { local_id?: string; modulos?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: "Body inválido" }, 400);
  }
  if (!cuerpo?.local_id || !Array.isArray(cuerpo.modulos)) return json({ error: "Faltan el local o los módulos" }, 400);

  // 1) Como el usuario: valida que sea supervisor del local, arma lo que lee la IA y deja la sugerencia "pensando"
  const usuario = clienteUsuario(req);
  const { data, error } = await usuario.rpc("orden_vm_preparar", { p_local: cuerpo.local_id, p_modulos: cuerpo.modulos });
  if (error || !data) return json({ error: error?.message ?? "Sin acceso" }, 400);
  const ctx = data as ContextoVM;

  const sb = clienteServicio();
  const modelo = Deno.env.get("ORDEN_VM_MODELO") ?? "claude-opus-5-5";
  const esfuerzo = Deno.env.get("ORDEN_VM_ESFUERZO") ?? "medium";

  const pensar = async () => {
    // Antes del corte de la función (150 s en el plan gratis): si no contestó, queda como error y se puede pedir de nuevo.
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 135_000);
    try {
      const resultado = await sugerirConClaude({ ctx, modelo, esfuerzo, apiKey: env("ANTHROPIC_API_KEY"), senal: corte.signal });
      const r = await sb.rpc("orden_vm_resultado", { p_sugerencia: ctx.sugerencia_id, p_resultado: resultado, p_modelo: modelo });
      if (r.error) throw new Error(r.error.message);
    } catch (e) {
      console.error("sugerir-vm", ctx.sugerencia_id, e);
      const r = await sb.rpc("orden_vm_resultado", {
        p_sugerencia: ctx.sugerencia_id, p_resultado: null, p_modelo: modelo, p_error: errorParaElSupervisor(e),
      });
      if (r.error) console.error("sugerir-vm (anotar el error)", ctx.sugerencia_id, r.error.message);
    } finally {
      clearTimeout(reloj);
    }
  };

  const tarea = pensar();
  const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(tarea);
  else await tarea;
  return json({ sugerencia_id: ctx.sugerencia_id, estado: "pensando" });
});
