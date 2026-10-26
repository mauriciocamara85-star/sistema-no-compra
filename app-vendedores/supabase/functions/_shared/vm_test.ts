// Pruebas sin red de la distribución con la IA:  deno test supabase/functions/_shared/vm_test.ts
import {
  armarPedidoVM, armarSistemaVM, type ContextoVM, errorParaElSupervisor, esquemaVM, maximoPropuestas, type ModuloVM,
  normalizarVM, sugerirConClaude,
} from "./vm.ts";

function igual(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
}
function tiene(s: string, partes: string[], msg: string) {
  for (const p of partes) if (!s.includes(p)) throw new Error(`${msg}: falta «${p}»`);
}

const mod = (ref: string, extra: Partial<ModuloVM> = {}): ModuloVM => ({
  ref, nombre: "Módulo " + ref, zona: "media", lugar: "izquierda", mueble: "estantes", liquidacion: false, contenido: null, foto: null, ...extra,
});
const modulos: ModuloVM[] = [
  mod("1", { zona: "entrada", lugar: "frente", contenido: "Remeras", foto: { fecha: "20/10", dias: 5, que_hay: "Remeras", rubros: ["Remeras", "Camisas"], colores: ["Negro", "Blanco"], look: true } }),
  mod("2", { zona: "fondo", liquidacion: true, contenido: "Buzos", foto: { fecha: "25/10", dias: 0, que_hay: "Buzos", rubros: [], colores: [], look: null } }),
  ...["3", "4", "5", "6", "7", "8"].map((r) => mod(r)),
  mod("9", { nombre: "Exhibidor 1", zona: "caliente", lugar: "centro", mueble: "mesa" }),
  mod("Vidriera izq.", { nombre: "Vidriera izq.", zona: "vidriera", lugar: "vidriera", mueble: "vidriera" }),
];
const ctx: ContextoVM = {
  sugerencia_id: "s1", local: "Local de prueba", fecha: "25/10/2026", estacion: "primavera", coleccion: 41, temporada: "primavera-verano",
  momento: "cambio", fecha_clave: null, reglas: "  # Reglas de prueba\n- Lo nuevo va adelante.\n",
  colecciones: {
    nueva: { numero: 41, temporada: "primavera-verano", articulos: 40, unidades: 4000, rubros: [{ rubro: "Remeras", articulos: 15, unidades: 1500 }], colores: ["Negro", "Crudo"] },
    anterior: { numero: 40, temporada: "otoño-invierno", articulos: 48, unidades: 365, rubros: [{ rubro: "Pantalones", articulos: 18, unidades: 161 }], colores: [] },
    basicos: { numero: 99, temporada: "todo el año", articulos: 39, unidades: 1931, rubros: [{ rubro: "Accesorios", articulos: 4, unidades: 590 }], colores: ["Negro"] },
  },
  modulos,
  lecciones: [{ modulo: "2", propuso: "Sacar los buzos", motivo: "El 2 es de buzos siempre", local: "este" }, { modulo: "5", propuso: "Jeans", motivo: null, local: "Otro local" }],
  recientes: [{ modulo: "1", pedido: "Poné las remeras de la 41", fecha: "24/10" }],
};

Deno.test("como mucho el 30 % de los módulos, y al menos uno", () => {
  igual([maximoPropuestas(25), maximoPropuestas(10), maximoPropuestas(3), maximoPropuestas(1)], [7, 3, 1, 1], "máximo");
});

Deno.test("las instrucciones llevan las reglas de VDH, el máximo y las reglas de la liquidación", () => {
  const s = armarSistemaVM(ctx);
  tiene(s, ["<reglas_vdh>\n# Reglas de prueba\n- Lo nuevo va adelante.\n</reglas_vdh>", "como mucho 3 cambios (el 30 % de los 10 módulos)",
    "Nada de liquidación en la vidriera, la entrada ni la zona caliente", "es el de la fábrica, no el del local", "decilo en \"falta\"",
    "español rioplatense", "No repitas lo que el supervisor ya descartó"], "sistema");
  const total = armarSistemaVM({ ...ctx, momento: "liquidacion_total" });
  if (total.includes("Nada de liquidación en la vidriera")) throw new Error("En liquidación total la liquidación puede subir");
  tiene(total, ["Es liquidación total"], "liquidación total");
});

Deno.test("el pedido: el local, el momento, la colección, lo que trae cada una y un renglón por módulo", () => {
  const p = armarPedidoVM(ctx);
  tiene(p, ["LOCAL: Local de prueba · hoy 25/10/2026 (primavera)", "MOMENTO: Cambio de temporada",
    "COLECCIÓN NUEVA: la 41 (primavera-verano). La anterior, la 40, va a liquidación.",
    "- Nueva (41, primavera-verano): 40 artículos. Remeras 15 art. (1500 u.). Colores que más hay: Negro, Crudo.",
    "- Anterior (40, otoño-invierno): 48 artículos. Pantalones 18 art. (161 u.).",
    "- Básicos (99): 39 artículos.",
    "- [1] Entrada · pared del frente · pared con estantes · qué hay: Remeras · última foto 20/10 (hace 5 días): Remeras, Camisas; colores Negro, Blanco; con un look armado",
    "- [2] Fondo · pared izquierda · pared con estantes · LIQUIDACIÓN · qué hay: Buzos · última foto 25/10 (hoy): Buzos",
    "- [3] Zona media · pared izquierda · pared con estantes · qué hay: no está anotado · sin foto revisada",
    "- [9] Exhibidor 1 · Zona caliente · en el medio del salón · mesa o exhibidor",
    "- [Vidriera izq.] Vidriera y frente · qué hay",
    "Módulo 2: \"Sacar los buzos\" → El 2 es de buzos siempre", "(en Otro local) Módulo 5: \"Jeans\" (sin decir por qué)",
    "- 24/10, módulo 1: \"Poné las remeras de la 41\""], "pedido");
  if (p.includes("Más viejas")) throw new Error("Sin viejas, no se nombran");
  const clave = armarPedidoVM({ ...ctx, momento: "fecha_clave", fecha_clave: "Día del Padre", lecciones: [], recientes: [] });
  tiene(clave, ["MOMENTO: Fecha clave: Día del Padre"], "fecha clave");
  if (clave.includes("YA DESCARTÓ") || clave.includes("HACE POCO")) throw new Error("Sin lecciones ni recientes, no van esos bloques");
  tiene(armarPedidoVM({ ...ctx, coleccion: null, temporada: null, colecciones: {} }), ["COLECCIÓN NUEVA: no se sabe", "- No hay datos."], "sin colección");
});

Deno.test("el formato: el módulo es uno de la lista, sin anyOf, todo cerrado y obligatorio", () => {
  const e = esquemaVM(modulos.map((m) => m.ref));
  const txt = JSON.stringify(e);
  if (txt.includes("anyOf")) throw new Error("Sin anyOf");
  igual(e.properties.propuestas.items.properties.modulo.enum, modulos.map((m) => m.ref), "las refs");
  igual(e.properties.propuestas.items.properties.prioridad.enum, ["alta", "media", "baja"], "prioridades");
  igual([e.additionalProperties, e.properties.propuestas.items.additionalProperties], [false, false], "cerrado");
  igual(e.required, ["resumen", "falta", "propuestas"], "obligatorio arriba");
  igual(e.properties.propuestas.items.required, Object.keys(e.properties.propuestas.items.properties), "obligatorio en cada propuesta");
});

Deno.test("normalizar: sólo módulos de la lista, uno por módulo, lo más importante primero y como mucho el 30 %", () => {
  const r = normalizarVM({
    resumen: "  La 41   al frente. ", falta: "",
    propuestas: [
      { modulo: "3", hoy: "x", propone: "Camisas", mover: "", porque: "p", prioridad: "baja" },
      { modulo: "99", hoy: "", propone: "no existe", mover: "", porque: "", prioridad: "alta" },
      { modulo: "1", hoy: "Remeras", propone: "Look de la 41", mover: "Las remeras al 4", porque: "Entrada", prioridad: "alta" },
      { modulo: "1", hoy: "", propone: "repetido", mover: "", porque: "", prioridad: "alta" },
      { modulo: "4", hoy: "", propone: "   ", mover: "", porque: "", prioridad: "alta" },
      { modulo: "Vidriera izq.", hoy: "", propone: "Un look", mover: "", porque: "", prioridad: "urgente" as "alta" },
      { modulo: " 5 ", hoy: "", propone: "Buzos", mover: "", porque: "", prioridad: "media" },
    ],
  }, ctx);
  igual(r.resumen, "La 41 al frente.", "resumen limpio");
  igual(r.propuestas.map((p) => [p.modulo, p.prioridad]), [["1", "alta"], ["Vidriera izq.", "media"], ["5", "media"]], "filtradas, ordenadas y cortadas en 3");
  igual(normalizarVM(null, ctx), { resumen: "", falta: "", propuestas: [] }, "sin nada");
  const largo = normalizarVM({ resumen: "x".repeat(900), falta: "", propuestas: [{ modulo: "1", hoy: "", propone: "y".repeat(500), mover: "", porque: "", prioridad: "alta" }] }, ctx);
  igual([largo.resumen.length, largo.propuestas[0].propone.length, largo.propuestas[0].propone.endsWith("…")], [600, 400, true], "se cortan los largos");
});

Deno.test("le pide a Claude con el modelo, el pensar adaptativo, el esfuerzo y el formato, y devuelve lo limpio", async () => {
  let cuerpo: Record<string, unknown> = {};
  let senal: AbortSignal | null | undefined;
  const pedir = ((_url: string, init: RequestInit) => {
    cuerpo = JSON.parse(String(init.body));
    senal = init.signal;
    const texto = JSON.stringify({ resumen: "ok", falta: "", propuestas: [{ modulo: "2", hoy: "Buzos", propone: "Liquidación agrupada", mover: "", porque: "Fondo", prioridad: "alta" }] });
    return Promise.resolve(new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "thinking", thinking: "…" }, { type: "text", text: texto }] }), { status: 200 }));
  }) as unknown as typeof fetch;
  const corte = new AbortController();
  const r = await sugerirConClaude({ ctx, modelo: "claude-opus-5-5", apiKey: "k", esfuerzo: "low", pedir, senal: corte.signal });
  igual(r.propuestas.map((p) => p.modulo), ["2"], "la respuesta");
  igual([cuerpo.model, (cuerpo.thinking as { type: string }).type, cuerpo.max_tokens], ["claude-opus-5-5", "adaptive", 16000], "el pedido");
  const oc = cuerpo.output_config as { effort: string; format: { type: string; schema: { properties: { propuestas: { items: { properties: { modulo: { enum: string[] } } } } } } } };
  igual([oc.effort, oc.format.type, oc.format.schema.properties.propuestas.items.properties.modulo.enum.length], ["low", "json_schema", modulos.length], "el formato");
  if (senal !== corte.signal) throw new Error("La señal de corte tiene que llegar al pedido");
  if (!String(cuerpo.system).includes("<reglas_vdh>") || !String((cuerpo.messages as { content: string }[])[0].content).includes("[Vidriera izq.]")) {
    throw new Error("Las reglas van en el sistema y los módulos en el mensaje");
  }
});

Deno.test("si la IA se queda sin lugar, falla (y el supervisor ve un mensaje claro)", async () => {
  const pedir = (() => Promise.resolve(new Response(JSON.stringify({ stop_reason: "max_tokens", content: [] }), { status: 200 }))) as unknown as typeof fetch;
  let error: unknown;
  try { await sugerirConClaude({ ctx, modelo: "m", apiKey: "k", pedir }); } catch (e) { error = e; }
  if (!error) throw new Error("Tenía que fallar");
  igual(errorParaElSupervisor(error), "La IA se quedó sin lugar para contestar: probá de nuevo", "max_tokens");
  const abort = new Error("The signal has been aborted"); abort.name = "AbortError";
  igual(errorParaElSupervisor(abort), "La IA tardó demasiado: probá de nuevo", "corte");
  igual(errorParaElSupervisor(new Error("API 529: overloaded")), "La IA está saturada: probá de nuevo en unos minutos", "saturada");
  igual(errorParaElSupervisor(new Error("API 400: invalid")), "La IA no aceptó el pedido: avisale a Mauricio", "400");
  igual(errorParaElSupervisor(new Error("La IA no quiso revisar la foto (refusal)")), "La IA no quiso contestar este pedido", "refusal");
  igual(errorParaElSupervisor("cualquier cosa"), "No pudimos hablar con la IA: probá de nuevo", "otro");
});
