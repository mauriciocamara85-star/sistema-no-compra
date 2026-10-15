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

import { aNumero, fechaValida } from "./caja_ia.ts";

Deno.test("caja: montos en formato argentino y fechas imposibles", () => {
  igual(aNumero("$ 1.440.100,00"), 1440100, "con miles y decimales");
  igual(aNumero("708.000"), 708000, "solo miles");
  igual(aNumero(45100), 45100, "número");
  igual(aNumero("abc"), null, "basura");
  igual(fechaValida("2026-10-11"), "2026-10-11", "fecha válida");
  igual(fechaValida("2026-13-10"), null, "mes 13");
  igual(fechaValida("2026-02-30"), null, "30 de febrero");
});
