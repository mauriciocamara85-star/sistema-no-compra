// Pruebas sin red de la parte de IA:  deno test supabase/functions/_shared/ia_test.ts
import { analizarConClaude, armarEsquema, armarSistema, type Contexto, listaColores, normalizar, RUBROS } from "./ia.ts";

function igual(a: unknown, b: unknown, msg: string) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
}

const ctx: Contexto = {
  foto_id: "f", foto_path: "l/x.jpg", control_tipo: "programado", sector_tipo: "salon", modulo_nombre: "Módulo 4",
  referencia_path: null, reglas_extra: null,
  exhibidor: { nombre: "Perchero de colección nueva", prendas_min: 8, prendas_max: 12, notas: null },
  checks: ["dobladas", "frontales", "etiquetas", "limpieza", "exhibicion"],
  reglas: [{ check: "frontales", texto: "Cada frontal lleva 4 prendas." }],
  colores: ["Blanco", "Beige", "Negro"],
  ia_activa: true, ia_sugerencias: false,
};

Deno.test("el texto para la IA incluye reglas, colores, cantidades y la etapa actual", () => {
  const s = armarSistema(ctx);
  for (const t of ["Cada frontal lleva 4 prendas.", "Blanco → Beige → Negro", "entre 8 y 12", "SOLO problemas puntuales", "cambiá la prenda por otro producto"]) {
    if (!s.includes(t)) throw new Error(`Falta en el prompt: ${t}`);
  }
  if (s.includes("piso")) throw new Error("No tiene que mencionar el piso");
});

Deno.test("las reglas de sugerencia: aparte y sólo con las sugerencias prendidas (SQL 123)", () => {
  const reglas = [{ check: "dobladas", texto: "Prendas finas: 4 por estante." }, { check: "exhibicion", texto: "Colores que combinen entre pilas vecinas.", sugerencia: true }];
  const apagadas = armarSistema({ ...ctx, reglas });
  if (!apagadas.includes("Prendas finas: 4 por estante.")) throw new Error("Falta la obligatoria");
  if (apagadas.includes("Colores que combinen")) throw new Error("Con las sugerencias apagadas, la de estilo no va");
  const prendidas = armarSistema({ ...ctx, reglas, ia_sugerencias: true });
  const corte = prendidas.indexOf("SUGERENCIAS DE ESTILO");
  if (corte < 0 || prendidas.indexOf("Colores que combinen") < corte) throw new Error("La de estilo va en su bloque, no entre las que se corrigen");
  if (!prendidas.slice(corte).includes('nunca "corregir"')) throw new Error("Tiene que decir que nunca es para corregir");
});

Deno.test("la foto modelo y la foto ejemplo se explican distinto, y va el tipo de mueble (SQL 123)", () => {
  const modelo = armarSistema({ ...ctx, referencia_path: "l/ref.jpg", referencia_tipo: "modulo", mueble: "Módulo de pared con estantes" });
  if (!modelo.includes("Compará contra la foto modelo") || !modelo.includes("MUEBLE (dato aproximado, sale del croquis): Módulo de pared con estantes.")) throw new Error("Modelo: " + modelo);
  if (!modelo.includes("nunca invalides la foto por eso")) throw new Error("El mueble es una pista: no invalida la foto (SQL 125)");
  if (!modelo.includes("La ropa cambia con la temporada")) throw new Error("La foto modelo es del orden, no de la ropa (si no, tareas falsas)");
  const ejemplo = armarSistema({ ...ctx, referencia_path: "ejemplos/x.jpg", referencia_tipo: "ejemplo" });
  if (!ejemplo.includes("OTRO mueble del mismo tipo") || ejemplo.includes("Compará contra la foto modelo")) throw new Error("Ejemplo: " + ejemplo);
  const sinFoto = armarSistema(ctx);
  if (sinFoto.includes("OTRO mueble") || sinFoto.includes("Compará contra la foto modelo")) throw new Error("Sin foto no menciona ninguna");
  const viejo = armarSistema({ ...ctx, referencia_path: "l/ref.jpg" });   // antes del SQL 123: sin referencia_tipo, es la del módulo
  if (!viejo.includes("Compará contra la foto modelo")) throw new Error("Sin el dato, es la del módulo");
});

Deno.test("el sentido del degradé según el lado del local, como lo ve el cliente (SQL 125)", () => {
  const izq = armarSistema({ ...ctx, lado: "izquierda" }), der = armarSistema({ ...ctx, lado: "derecha" });
  if (!izq.includes("pared izquierda") || !izq.includes("del lado IZQUIERDO de la foto")) throw new Error("Izquierda: " + izq);
  if (!der.includes("pared derecha") || !der.includes("del lado DERECHO de la foto") || !der.includes("nunca pidas invertirlo")) throw new Error("Derecha: " + der);
  for (const lado of ["fondo", "frente", "centro", "vidriera", null, undefined]) {
    const s = armarSistema({ ...ctx, lado });
    if (!s.includes("puede arrancar de cualquier lado") || s.includes("LADO DEL LOCAL")) throw new Error(`Sin sentido fijo (${lado}): ` + s);
  }
  const dep = armarSistema({ ...ctx, sector_tipo: "deposito", lado: "deposito" });
  if (dep.includes("degradé") || dep.includes("REGLA DE COLORES") || dep.includes("liquidación")) throw new Error("En el depósito no se habla de degradé: " + dep);
});

Deno.test("liquidación: va por talle y no se pide degradé; lo propio del módulo manda (SQL 125)", () => {
  const liq = armarSistema({ ...ctx, lado: "derecha", liquidacion: true });
  if (!liq.includes("LIQUIDACIÓN") || !liq.includes("por TALLE")) throw new Error("Liquidación: " + liq);
  if (liq.includes("REGLA DE COLORES") || liq.includes("LADO DEL LOCAL") || liq.includes("Blanco → Beige")) throw new Error("Con liquidación no va el degradé: " + liq);
  if (!armarSistema(ctx).includes('cartel de liquidación, "sale"')) throw new Error("Un cartel de liquidación también lo saca del degradé");
  if (!armarSistema({ ...ctx, reglas_extra: "Va por talle." }).includes("PROPIO DE ESTE MÓDULO (manda sobre las reglas generales): Va por talle.")) throw new Error("Lo propio manda");
});

Deno.test("las preguntas según el mueble: sin frontales fuera de la pared, y el mueble elegido no es una suposición (SQL 129)", () => {
  const vidrio = { check: "limpieza", texto: "En la vidriera: el vidrio sin marcas ni huellas y el piso limpio." };
  const mesa = armarSistema({ ...ctx, mueble: "Mesa o exhibidor del medio", checks: ["dobladas", "exhibicion", "etiquetas", "limpieza", "colgado"],
    reglas: [{ check: "colgado", texto: "Perchas iguales, todas mirando para el mismo lado." }, { check: "frontales", texto: "Cada frontal lleva 4 prendas." }, vidrio] });
  if (!mesa.includes("• colgado — Lo colgado (perchas y prendas colgadas)") || !mesa.includes("Perchas iguales, todas mirando para el mismo lado.")) throw new Error("Mesa: " + mesa);
  if (/frontal/i.test(mesa.replace(/ \(acá no hay frontales[^)]*\)/, ""))) throw new Error("En una mesa no se habla de frontales: " + mesa);
  if (!mesa.includes("lo que dicen las reglas de los estantes vale para las pilas de la mesa") || mesa.includes("no la apliques")) throw new Error("Las reglas de los estantes, en la mesa, valen para las pilas (ronda 2): " + mesa);
  if (!mesa.includes("• dobladas — Prendas dobladas (pilas parejas y completas)") || mesa.includes("estantes completos")) throw new Error("En la mesa, el doblado son las pilas: " + mesa);
  if (!mesa.includes("Mirá lo esencial de ESTE mueble") || !mesa.includes("los mira después el supervisor")) throw new Error("Lo esencial: " + mesa);
  if (!mesa.includes("Emprolijá las pilas de la mesa") || mesa.includes("vidrio")) throw new Error("Mesa: el ejemplo de la mesa y sin la regla del vidrio: " + mesa);
  const vid = armarSistema({ ...ctx, mueble: "Vidriera", mueble_elegido: true, referencia_path: "l/ref.jpg", referencia_tipo: "modulo", lado: "vidriera",
    checks: ["armado", "carteles", "limpieza", "luces"], reglas: [vidrio] });
  for (const t of ["• armado — Armado de la vidriera", "• carteles — Carteles y precios", "• luces — Luces", "MUEBLE (lo eligió el supervisor): Vidriera.",
                   "Compará contra la foto modelo el ORDEN: la disposición y lo lleno que está.", "el vidrio sin marcas", "maniquí de la izquierda"]) {
    if (!vid.includes(t)) throw new Error(`Falta en la vidriera: ${t}`);
  }
  for (const t of ["dato aproximado", "doblado", "degradé", "REGLA DE COLORES", "liquidación"]) {
    if (vid.toLowerCase().includes(t.toLowerCase())) throw new Error(`En la vidriera no va: ${t}\n${vid}`);
  }
  const perchero = armarSistema({ ...ctx, mueble: "Perchero", lado: "izquierda", referencia_path: "l/ref.jpg", referencia_tipo: "modulo",
    checks: ["colgado", "exhibicion", "etiquetas", "limpieza"], reglas: [vidrio] });
  if (!perchero.includes("la disposición y lo lleno que está") || /doblado/i.test(perchero) || !perchero.includes("Blanco → Beige → Negro") ||
      !perchero.includes("LADO DEL LOCAL") || !perchero.includes("perchas mirando para el mismo lado") || perchero.includes("vidrio") ||
      !perchero.includes("acá no hay estantes ni frontales")) throw new Error("Perchero: " + perchero);
  const dep = armarSistema({ ...ctx, sector_tipo: "deposito", lado: "deposito", mueble: "Depósito", checks: ["dobladas", "rotulado", "talles", "limpieza"], reglas: [vidrio] });
  for (const t of ["Separá por talle las remeras del segundo estante", "• dobladas — Prendas dobladas y estantes completos", "(acá no hay frontales: no los nombres)"]) {
    if (!dep.includes(t)) throw new Error(`Falta en el depósito (ronda 2): ${t}\n${dep}`);
  }
  for (const t of ["pilas de la mesa", "no la apliques", "vidrio"]) {
    if (dep.includes(t)) throw new Error(`En el depósito no va (tiene estantes; no es una mesa): ${t}\n${dep}`);
  }
  const pared = armarSistema({ ...ctx, referencia_path: "l/ref.jpg", referencia_tipo: "modulo", reglas: [...ctx.reglas, vidrio] });
  if (!pared.includes("cambiá la prenda por otro producto") || !pared.includes("la disposición, los frontales, el doblado y lo lleno que está") ||
      pared.includes("acá no hay frontales") || pared.includes("piso")) throw new Error("La pared sigue igual: " + pared);
  igual(armarEsquema(["armado", "carteles", "limpieza", "luces"]).properties.checks.required, ["armado", "carteles", "limpieza", "luces"], "el formato pide los de la vidriera");
  const r = normalizar({ foto_valida: true, confianza: "alta", nivel_sugerido: "bien", checks: { armado: "ok", luces: "Mal" } as never,
    hallazgos: [{ check: "frontales", titulo: "Completá el frontal", gravedad: "corregir" }, { check: "Luces", titulo: "Prendé la luz de la izquierda", gravedad: "corregir" }] },
    { ...ctx, checks: ["armado", "carteles", "limpieza", "luces"] });
  igual(r.hallazgos.map((h) => h.check), ["luces"], "un hallazgo de un punto que este mueble no tiene se descarta");
  igual([r.checks.armado, r.checks.luces, r.checks.carteles], ["ok", "mal", "no_se_ve"], "los puntos de la vidriera");
});

Deno.test("el formato pide exactamente los puntos del sector", () => {
  igual(armarEsquema(ctx.checks).properties.checks.required, ctx.checks, "checks");
});

Deno.test("lo que la IA manda como null (el esquema estricto no deja que falte) queda como si no estuviera", () => {
  const r = normalizar({
    foto_valida: true, confianza: "alta", nivel_sugerido: "bien", checks: {} as never,
    motivo_foto_invalida: null, prendas_por_frontal: null, comentario: null, que_hay: "",
    hallazgos: [{ check: "frontales", titulo: "Completá el frontal", detalle: null, gravedad: "corregir" }],
  } as never, ctx);
  igual([r.motivo_foto_invalida, r.prendas_por_frontal, r.comentario, r.que_hay, r.hallazgos[0].detalle], [undefined, undefined, undefined, undefined, undefined], "nulls");
});

Deno.test("sugerencias apagadas: solo quedan las cosas para corregir", () => {
  const r = normalizar({
    foto_valida: true, confianza: "alta", nivel_sugerido: "a_mejorar",
    checks: { frontales: "ok" } as never,
    hallazgos: [
      { check: "frontales", titulo: "Completá el frontal", gravedad: "corregir" },
      { check: "exhibicion", titulo: "Probá ordenar por color", gravedad: "sugerencia" },
    ],
  }, ctx);
  igual(r.hallazgos.map((h) => h.titulo), ["Completá el frontal"], "hallazgos");
  igual(r.checks.frontales, "mal", "si hay algo para corregir, el punto no puede estar ok");
  igual(r.checks.etiquetas, "no_se_ve", "lo que falta queda como no_se_ve");
});

Deno.test("los valores de las listas valen con otra mayúscula (OK, Impecable, Corregir, Frontales)", () => {
  const r = normalizar({
    foto_valida: true, confianza: "Alta" as never, nivel_sugerido: "Impecable" as never,
    checks: { dobladas: "OK", frontales: "Mal", etiquetas: "No_se_ve" } as never,
    hallazgos: [{ check: "Frontales", titulo: "Completá el frontal", gravedad: "Corregir" as never }],
  }, ctx);
  igual(r.nivel_sugerido, "impecable", "nivel");
  igual(r.confianza, "alta", "confianza");
  igual([r.checks.dobladas, r.checks.frontales, r.checks.etiquetas], ["ok", "mal", "no_se_ve"], "checks");
  igual(r.hallazgos.map((h) => [h.check, h.gravedad]), [["frontales", "corregir"]], "el hallazgo sigue siendo para corregir, con el punto como está en la base");
});

Deno.test("con confianza baja no se generan tareas", () => {
  const r = normalizar({
    foto_valida: true, confianza: "baja", nivel_sugerido: "a_mejorar", checks: {} as never,
    hallazgos: [{ check: "frontales", titulo: "Completá el frontal", gravedad: "corregir" }],
  }, { ...ctx, ia_sugerencias: true });
  igual(r.hallazgos[0].gravedad, "sugerencia", "baja confianza → sugerencia");
});

Deno.test("descarta basura de la IA y limita a 2 hallazgos (24/10; antes, 4)", () => {
  const r = normalizar({
    foto_valida: true, confianza: "alta", nivel_sugerido: "otra_cosa" as never, checks: {} as never,
    hallazgos: [
      { check: "inventado", titulo: "x", gravedad: "corregir" },
      ...Array.from({ length: 6 }, (_, i) => ({ check: "limpieza", titulo: `cosa ${i}`, gravedad: "corregir" as const })),
    ],
  }, ctx);
  igual(r.hallazgos.map((h) => h.titulo), ["cosa 0", "cosa 1"], "máximo 2, en el orden de la IA");
  igual(r.nivel_sugerido, "bien", "nivel inválido → bien");
});

Deno.test("de los 2, lo que hay que corregir va primero, aunque la IA lo ponga después (24/10)", () => {
  const r = normalizar({
    foto_valida: true, confianza: "alta", nivel_sugerido: "a_mejorar", checks: {} as never,
    hallazgos: [
      { check: "exhibicion", titulo: "Probá sumar un cinto", gravedad: "sugerencia" },
      { check: "exhibicion", titulo: "Probá otro color arriba", gravedad: "sugerencia" },
      { check: "frontales", titulo: "Completá el frontal", gravedad: "corregir" },
    ],
  }, { ...ctx, ia_sugerencias: true });
  igual(r.hallazgos.map((h) => h.titulo), ["Completá el frontal", "Probá sumar un cinto"], "corregir primero, después una sugerencia");
  if (!armarSistema(ctx).includes("máximo 2, lo más importante primero")) throw new Error("El pedido tiene que decir máximo 2");
  const e = armarEsquema(ctx.checks) as unknown as { properties: { hallazgos: { description: string } } };
  igual(e.properties.hallazgos.description.startsWith("Máximo 2"), true, "el formato también lo dice");
});

Deno.test("con un conjunto armado (look) no se pide degradé: la regla en el pedido y el filtro (24/10)", () => {
  const s = armarSistema(ctx);
  if (!s.includes("CONJUNTOS: si lo colgado está armado por conjuntos") || !s.includes("no pidas degradé")) throw new Error("Falta la regla de los conjuntos: " + s);
  for (const otro of [armarSistema({ ...ctx, liquidacion: true }), armarSistema({ ...ctx, sector_tipo: "deposito" }), armarSistema({ ...ctx, checks: ["armado", "carteles", "limpieza", "luces"] })]) {
    if (otro.includes("CONJUNTOS:")) throw new Error("En la liquidación, el depósito y la vidriera no va: " + otro);
  }
  const hall = [
    { check: "exhibicion", titulo: "Ordená en degradé", detalle: "Del más claro al más oscuro.", gravedad: "corregir" as const },
    { check: "exhibicion", titulo: "Separá los colores", detalle: "Los colores están mezclados en el perchero.", gravedad: "corregir" as const },
    { check: "exhibicion", titulo: "Poné lo claro a la izquierda", detalle: "Y lo oscuro a la derecha.", gravedad: "corregir" as const },
    { check: "etiquetas", titulo: "Escondé la etiqueta", detalle: "La del segundo pantalón se ve.", gravedad: "corregir" as const },
  ];
  const base = { foto_valida: true, confianza: "alta", nivel_sugerido: "a_mejorar", checks: {} as never, hallazgos: hall };
  igual(normalizar({ ...base, look: true } as never, ctx).hallazgos.map((h) => h.titulo), ["Escondé la etiqueta"], "con look: fuera lo del degradé");
  igual(normalizar({ ...base, look: false } as never, ctx).hallazgos.map((h) => h.titulo), ["Ordená en degradé", "Separá los colores"], "sin look, sigue como antes");
  igual(normalizar({ ...base, look: true } as never, { ...ctx, sector_tipo: "deposito" }).hallazgos.length, 2, "en el depósito no hay look");
});

Deno.test("las lecciones del supervisor van en el pedido, cortas y en un renglón (SQL 170)", () => {
  igual(armarSistema(ctx).includes("LO QUE EL SUPERVISOR YA TE CORRIGIÓ"), false, "sin lecciones, no hay bloque");
  const s = armarSistema({ ...ctx, lecciones: [
    { titulo: "Ordená en degradé", motivo: "Es un conjunto:\npantalón y remera", modulo: "Módulo 4", este_modulo: true },
    { titulo: "Completá el frontal", modulo: "Módulo 9" },
    { titulo: "   " },
    { titulo: "x".repeat(300), motivo: "y".repeat(500) },
  ] });
  const corte = s.indexOf("LO QUE EL SUPERVISOR YA TE CORRIGIÓ");
  if (corte < 0) throw new Error("Falta el bloque: " + s);
  const bloque = s.slice(corte);
  for (const t of ['- "Ordená en degradé" (en este mismo módulo): el supervisor dijo «Es un conjunto: pantalón y remera»', '- "Completá el frontal" (en Módulo 9)']) {
    if (!bloque.includes(t)) throw new Error(`Falta la lección: ${t}\n${bloque}`);
  }
  igual(bloque.split("\n").filter((l) => l.startsWith("  - ")).length, 3, "la vacía no va");
  igual(bloque.includes("x".repeat(101)) || bloque.includes("y".repeat(201)), false, "con tope");
  const muchas = armarSistema({ ...ctx, lecciones: Array.from({ length: 20 }, (_, i) => ({ titulo: `cosa ${i}` })) });
  igual(muchas.split("\n").filter((l) => /^ {2}- "cosa \d+"/.test(l)).length, 12, "hasta 12");
});

Deno.test("foto inválida trae un motivo para el vendedor", () => {
  const r = normalizar({ foto_valida: false, confianza: "alta", nivel_sugerido: "bien", checks: {} as never, hallazgos: [] }, ctx);
  igual(r.foto_valida, false, "inválida");
  if (!r.motivo_foto_invalida) throw new Error("Falta el motivo");
});

Deno.test("rubros, colores y look: de las listas, como en la lista, sin repetir y hasta 4 (24/10)", () => {
  const base = { foto_valida: true, confianza: "alta", nivel_sugerido: "bien", checks: {} as never, hallazgos: [] };
  const r = normalizar({ ...base, rubros: ["remeras", "Jeans", "PANTALONES", "Remeras", "short de baño", "Buzos", "Camisas"], colores: ["negro", "Estampado", "Fucsia", "Blanco"], look: true } as never, ctx);
  igual(r.rubros, ["Remeras", "Pantalones", "Short de Baño", "Buzos"], "rubros: los de la lista, escritos como en el catálogo, hasta 4");
  igual(r.colores, ["Negro", "Estampado", "Blanco"], "colores: los del degradé y los de afuera; el que no está, afuera");
  igual(r.look, true, "look");
  const vacio = normalizar({ ...base, rubros: [], colores: ["Fucsia"], look: false } as never, ctx);
  igual([vacio.rubros, vacio.colores, vacio.look], [undefined, undefined, false], "nada de la lista: no se guarda");
  const dep = normalizar({ ...base, rubros: ["Buzos"], look: true } as never, { ...ctx, sector_tipo: "deposito" });
  igual([dep.rubros, dep.colores, dep.look], [["Buzos"], undefined, false], "en el depósito no hay look");
  const mala = normalizar({ ...base, foto_valida: false, rubros: ["Buzos"], colores: ["Negro"], look: true } as never, ctx);
  igual([mala.rubros, mala.colores, mala.look], [undefined, undefined, undefined], "foto inválida: nada");
  const viejo = normalizar(base as never, ctx);   // una respuesta sin los campos nuevos (o el esquema de antes)
  igual([viejo.rubros, viejo.colores, viejo.look], [undefined, undefined, undefined], "sin los campos");
});

Deno.test("el formato pide rubros y colores como listas cerradas, sin sumar anyOf (24/10)", () => {
  const e = armarEsquema(ctx.checks, ctx.colores) as unknown as { properties: Record<string, { items?: { enum: string[] }; type: string }>; required: string[] };
  igual(e.properties.rubros.items!.enum, RUBROS, "rubros del catálogo");
  igual(e.properties.colores.items!.enum, ["Blanco", "Beige", "Negro", "Rojo", "Naranja", "Amarillo", "Verde", "Rosa", "Violeta", "Estampado"], "el degradé y los de afuera");
  igual(e.properties.look.type, "boolean", "look");
  igual(["rubros", "colores", "look"].every((k) => e.required.includes(k)), true, "obligatorios (esquema estricto)");
  igual(uniones(armarEsquema(ctx.checks, ctx.colores)), uniones(armarEsquema(ctx.checks)), "los mismos anyOf de antes");
  igual(listaColores(["Blanco", "blanco ", "Negro", "Rojo"]), ["Blanco", "Negro", "Rojo", "Naranja", "Amarillo", "Verde", "Rosa", "Violeta", "Estampado"], "sin repetir (aunque cambie la mayúscula)");
  igual(listaColores([]).includes("Azul marino"), true, "sin degradé en la base: los de siempre");
  const s = armarSistema(ctx);
  for (const t of ["rubros: los rubros que se ven, de esta lista (Remeras, Pantalones,", "son \"Pantalones\"", "(Blanco, Beige, Negro, Rojo,", "look: true si hay un conjunto armado"]) {
    if (!s.includes(t)) throw new Error(`Falta en el prompt: ${t}`);
  }
  if (s.includes("En el depósito, siempre false.")) throw new Error("En el salón no se habla del depósito");
  if (!armarSistema({ ...ctx, sector_tipo: "deposito" }).includes("En el depósito, siempre false.")) throw new Error("En el depósito, el look es false");
});

Deno.test("si la API rechaza el formato nuevo (400), la foto se revisa igual con el de antes (24/10)", async () => {
  const informe = { foto_valida: true, motivo_foto_invalida: null, checks: { limpieza: "ok" }, prendas_por_frontal: null, hallazgos: [], nivel_sugerido: "bien", comentario: null, confianza: "alta", que_hay: "Remeras" };
  const pedidos: Record<string, unknown>[] = [];
  const api = (rechaza: boolean) => (async (_u: string, init: { body: string }) => {
    const b = JSON.parse(init.body); pedidos.push(b);
    const props = b.output_config.format.schema.properties;
    if (rechaza && "rubros" in props) return new Response('{"error":{"message":"invalid schema"}}', { status: 400 });
    return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ ...informe, ...("rubros" in props ? { rubros: ["Remeras"], colores: ["Negro"], look: false } : {}) }) }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const foto = { media_type: "image/jpeg", data: "eA==" };
  const bien = await analizarConClaude({ ctx, foto, referencia: null, modelo: "m", apiKey: "k", pedir: api(false) });
  igual([pedidos.length, bien.rubros, bien.colores], [1, ["Remeras"], ["Negro"]], "con el formato nuevo, un solo pedido");
  pedidos.length = 0;
  const plan = await analizarConClaude({ ctx, foto, referencia: null, modelo: "m", apiKey: "k", pedir: api(true) });
  igual([pedidos.length, plan.que_hay, plan.rubros, plan.nivel_sugerido], [2, "Remeras", undefined, "bien"], "rechazado: el de antes, y la foto se revisa");
  const viejo = (pedidos[1] as { output_config: { format: { schema: { properties: object; required: string[] } } } }).output_config.format.schema;
  igual(["rubros" in viejo.properties, viejo.required.includes("look")], [false, false], "el de antes no tiene los campos nuevos");
  let error = "";
  try { await analizarConClaude({ ctx, foto, referencia: null, modelo: "m", apiKey: "k", pedir: (async () => new Response("no", { status: 401 })) as unknown as typeof fetch }); }
  catch (e) { error = (e as Error).message; }
  igual(error.startsWith("API 401"), true, "otro error no se reintenta: sigue como antes");
});

import { aNumero, efectivoContado, esquemaCaja, fechaValida, leerFotoCaja, MAX_UNIONES } from "./caja_ia.ts";

/** Las propiedades con anyOf o con una lista de tipos, en todo el esquema (la API acepta hasta 16). */
function uniones(s: unknown): number {
  if (Array.isArray(s)) return s.reduce((n, x) => n + uniones(x), 0);
  if (!s || typeof s !== "object") return 0;
  const o = s as Record<string, unknown>;
  const propia = Array.isArray(o.anyOf) || Array.isArray(o.type) ? 1 : 0;
  return propia + Object.values(o).reduce((n: number, x) => n + uniones(x), 0);
}

Deno.test("los esquemas no pasan el límite de anyOf de la API (18/10: el del sistema tenía 18)", () => {
  for (const tipo of ["sistema", "lote", "mp", "gocuotas"] as const) {
    const n = uniones(esquemaCaja(tipo));
    if (n > MAX_UNIONES) throw new Error(`caja ${tipo}: ${n} anyOf (máximo ${MAX_UNIONES})`);
  }
  igual(uniones(esquemaCaja("sistema")), 15, "el sistema: sólo los 15 montos");
  igual("suma_operaciones" in esquemaCaja("sistema").properties, false, "la suma de la lista es sólo de MP y Go Cuotas");
  igual("suma_operaciones" in esquemaCaja("mp").properties, true, "MP la tiene");
  const n = uniones(armarEsquema(ctx.checks));
  if (n > MAX_UNIONES) throw new Error(`fotos del local: ${n} anyOf`);
});

Deno.test("caja: motivo y fecha vacíos vuelven como null, como antes (18/10)", async () => {
  const respuesta = (lectura: Record<string, unknown>) => (async () =>
    new Response(JSON.stringify({
      stop_reason: "end_turn",
      content: [{ type: "text", text: JSON.stringify(lectura) }],
    }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
  const base = { foto_valida: true, lista_cortada: false, dudas: [] as string[] };
  const r = await leerFotoCaja({
    tipo: "sistema", fecha: "2026-10-17", local: "Rivadavia", foto: { media_type: "image/jpeg", data: "eA==" },
    modelo: "m", apiKey: "k", pedir: respuesta({ ...base, motivo: "", fecha: "", saldo_final_efectivo: 143100, total_efectivo: 143100, sobrante_faltante: 0 }),
  });
  igual([r.motivo, r.fecha, r.suma_operaciones, r.total_efectivo], [null, null, null, 143100], "sistema");
  const mp = await leerFotoCaja({
    tipo: "mp", fecha: "2026-10-17", local: "Rivadavia", foto: { media_type: "image/jpeg", data: "eA==" },
    modelo: "m", apiKey: "k", pedir: respuesta({ ...base, foto_valida: false, motivo: "Sacala de más cerca", fecha: "2026-10-17", total: null, suma_operaciones: null }),
  });
  igual([mp.motivo, mp.fecha], ["Sacala de más cerca", "2026-10-17"], "mp inválida con motivo");
});

Deno.test("caja: montos en formato argentino y fechas imposibles", () => {
  igual(aNumero("$ 1.440.100,00"), 1440100, "con miles y decimales");
  igual(aNumero("708.000"), 708000, "solo miles");
  igual(aNumero(45100), 45100, "número");
  igual(aNumero("abc"), null, "basura");
  igual(fechaValida("2026-10-11"), "2026-10-11", "fecha válida");
  igual(fechaValida("2026-13-10"), null, "mes 13");
  igual(fechaValida("2026-02-30"), null, "30 de febrero");
});

Deno.test("caja: el efectivo contado sale del TOTAL EFECTIVO de la foto del sistema (16/10)", () => {
  const props = (esquemaCaja("sistema") as { properties: Record<string, unknown>; required: string[] });
  igual("total_efectivo" in props.properties && props.required.includes("sobrante_faltante"), true, "el esquema lo pide");
  igual("total_efectivo" in esquemaCaja("lote").properties, false, "el lote no");
  const leido = (r: Record<string, unknown>) => (efectivoContado(r), r);
  igual(leido({ total_efectivo: 143100, sobrante_faltante: 0, saldo_final_efectivo: 143100 }).total_efectivo, 143100, "se lee");
  igual(leido({ total_efectivo: null, sobrante_faltante: 0, saldo_final_efectivo: 143100 }).total_efectivo, 143100, "en verde sin número: el saldo final");
  igual(leido({ total_efectivo: null, sobrante_faltante: -500, saldo_final_efectivo: 143100 }).total_efectivo, null, "con faltante no se calcula");
  const cero = leido({ total_efectivo: 0, sobrante_faltante: -143100, saldo_final_efectivo: 143100, dudas: [] });
  igual(cero.total_efectivo, null, "en $ 0 todavía no se contó");
  igual((cero.dudas as string[]).length, 1, "y queda en dudas");
  igual(leido({ total_efectivo: 0, sobrante_faltante: 0, saldo_final_efectivo: 0 }).total_efectivo, 0, "sin efectivo de verdad: 0");
});
