// Pruebas sin red de la parte de IA:  deno test supabase/functions/_shared/ia_test.ts
import { armarEsquema, armarSistema, type Contexto, normalizar } from "./ia.ts";

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

Deno.test("descarta basura de la IA y limita a 4 hallazgos", () => {
  const r = normalizar({
    foto_valida: true, confianza: "alta", nivel_sugerido: "otra_cosa" as never, checks: {} as never,
    hallazgos: [
      { check: "inventado", titulo: "x", gravedad: "corregir" },
      ...Array.from({ length: 6 }, (_, i) => ({ check: "limpieza", titulo: `cosa ${i}`, gravedad: "corregir" as const })),
    ],
  }, ctx);
  igual(r.hallazgos.length, 4, "máximo 4");
  igual(r.nivel_sugerido, "bien", "nivel inválido → bien");
});

Deno.test("foto inválida trae un motivo para el vendedor", () => {
  const r = normalizar({ foto_valida: false, confianza: "alta", nivel_sugerido: "bien", checks: {} as never, hallazgos: [] }, ctx);
  igual(r.foto_valida, false, "inválida");
  if (!r.motivo_foto_invalida) throw new Error("Falta el motivo");
});

import { aNumero, efectivoContado, esquemaCaja, fechaValida } from "./caja_ia.ts";

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
