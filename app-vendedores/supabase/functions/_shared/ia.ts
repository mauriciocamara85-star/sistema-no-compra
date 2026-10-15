// Revisión de fotos con la API de Claude (visión).
// No hay que "entrenar" nada: le mandamos la foto, la foto modelo del módulo (o, si no
// tiene, la foto ejemplo de su tipo de mueble) y las reglas de orden que están cargadas
// en la base (orden_reglas). Las reglas marcadas como sugerencia (SQL 123) van aparte y
// sólo cuando las sugerencias están prendidas: nunca se vuelven "corregir".
// La respuesta llega siempre con el mismo formato: se pide como JSON con un esquema
// (structured outputs). Antes era una herramienta forzada (tool_choice), pero Claude
// Sonnet 5.5 / Opus 5.5 la rechazan con un 400 y ninguna foto se revisaba.

export type Contexto = {
  foto_id: string;
  foto_path: string;
  control_tipo: string;
  sector_tipo: "salon" | "deposito";
  modulo_nombre: string;
  referencia_path: string | null;
  /** "modulo": la foto modelo de ese módulo; "ejemplo": la de su tipo de mueble (SQL 123). Sin el dato, es la del módulo. */
  referencia_tipo?: "modulo" | "ejemplo" | null;
  /** El tipo de mueble ("Módulo de pared con estantes", "Mesa o exhibidor del medio"…), sacado del croquis (SQL 123). */
  mueble?: string | null;
  /** En qué pared está ("izquierda", "fondo", "derecha", "frente") o "centro", "vidriera", "deposito" (SQL 125). */
  lado?: string | null;
  /** Es de liquidación: lo colgado va por talle, no por color (SQL 125). */
  liquidacion?: boolean | null;
  reglas_extra: string | null;
  exhibidor: { nombre: string; prendas_min: number | null; prendas_max: number | null; notas: string | null } | null;
  checks: string[];
  reglas: { check: string; texto: string; sugerencia?: boolean }[];
  colores: string[];
  ia_activa: boolean;
  ia_sugerencias: boolean;
};

export type Imagen = { media_type: string; data: string };

export type Resultado = {
  foto_valida: boolean;
  motivo_foto_invalida?: string;
  checks: Record<string, "ok" | "mal" | "no_se_ve">;
  prendas_por_frontal?: number[];
  hallazgos: { check: string; titulo: string; detalle?: string; gravedad: "corregir" | "sugerencia" }[];
  nivel_sugerido: "impecable" | "bien" | "a_mejorar" | "fuera_de_estandar";
  comentario?: string;
  confianza: "alta" | "media" | "baja";
  /** Qué ropa hay en el módulo ("Remeras", "Buzos y camperas"); vacío si no se distingue (SQL 118). */
  que_hay?: string;
};

const NIVELES = ["impecable", "bien", "a_mejorar", "fuera_de_estandar"] as const;

const NOMBRE_CHECK: Record<string, string> = {
  dobladas: "Prendas dobladas y estantes completos",
  frontales: "Frontales",
  etiquetas: "Etiquetas",
  limpieza: "Limpieza",
  exhibicion: "Exhibición (colores, cantidades, percheros)",
  rotulado: "Rotulado",
  talles: "Separado por segmento y talle",
};

export function armarSistema(ctx: Contexto): string {
  const obligatorias = ctx.reglas.filter((r) => !r.sugerencia);
  const sugerencias = ctx.reglas.filter((r) => r.sugerencia);
  const reglasPorCheck = ctx.checks.map((c) => {
    const lineas = obligatorias.filter((r) => r.check === c).map((r) => `  - ${r.texto}`);
    return `• ${c} — ${NOMBRE_CHECK[c] ?? c}\n${lineas.join("\n") || "  - (sin reglas cargadas)"}`;
  }).join("\n");

  const exhibidor = ctx.exhibidor
    ? `\nEXHIBIDOR: ${ctx.exhibidor.nombre}.` +
      (ctx.exhibidor.prendas_min != null || ctx.exhibidor.prendas_max != null
        ? ` Cantidad ideal de prendas: entre ${ctx.exhibidor.prendas_min ?? "?"} y ${ctx.exhibidor.prendas_max ?? "?"}.`
        : "") +
      (ctx.exhibidor.notas ? ` ${ctx.exhibidor.notas}` : "")
    : "";

  // Las de estilo ("colores que combinen"): sólo con las sugerencias prendidas, y nunca como algo para corregir.
  const deEstilo = ctx.ia_sugerencias && sugerencias.length
    ? `\n\nSUGERENCIAS DE ESTILO (no son errores: si algo de esto no se cumple, como mucho dejá una sugerencia, nunca "corregir"):\n${sugerencias.map((r) => `  - ${r.texto}`).join("\n")}`
    : "";
  // El tipo de mueble se deduce del croquis y puede fallar (el 20 de Rivadavia es un carro y figura con estantes).
  const mueble = ctx.mueble
    ? `\nMUEBLE (dato aproximado, sale del croquis): ${ctx.mueble}. Si en la foto se ve otro mueble (un perchero, un carro, una mesa), revisá el que se ve: nunca invalides la foto por eso.`
    : "";
  // El sentido del degradé es como lo ve el cliente que entra (SQL 125): el más claro, del lado de la entrada.
  // En la liquidación lo colgado va por talle y no se pide degradé.
  const salon = ctx.sector_tipo === "salon";
  const colores = salon && !ctx.liquidacion && ctx.colores.length
    ? `\nREGLA DE COLORES (el orden del degradé, del más claro al más oscuro): ${ctx.colores.join(" → ")}.`
    : "";
  const sentido = !salon ? ""
    : ctx.liquidacion
    ? "\nLIQUIDACIÓN: este módulo es de liquidación: lo colgado va ordenado por TALLE, no por color. No pidas degradé ni que los colores combinen o coincidan con los estantes; sí mirá que esté prolijo, completo y limpio."
    : ctx.lado === "izquierda" || ctx.lado === "derecha"
    ? `\nLADO DEL LOCAL: pared ${ctx.lado} (mirando desde la entrada). El degradé arranca con el más claro del lado ${ctx.lado === "izquierda" ? "IZQUIERDO" : "DERECHO"} de la foto y va oscureciendo hacia el ${ctx.lado === "izquierda" ? "derecho" : "izquierdo"}: así lo ve el cliente que entra. Si ya está así, está bien: nunca pidas invertirlo.`
    : "\nSENTIDO DEL DEGRADÉ: en este mueble puede arrancar de cualquier lado; mirá sólo que sea un degradé parejo, sin colores cortados.";
  const guiaReferencia = !ctx.referencia_path ? ""
    : ctx.referencia_tipo === "ejemplo"
    ? "\n- La foto de ejemplo es de OTRO mueble del mismo tipo, bien ordenado: usala sólo para ver el nivel de orden que se espera. No marques que la ropa, los colores, la cantidad o la disposición son distintos."
    : "\n- Compará contra la foto modelo el ORDEN: la disposición, los frontales, el doblado y lo lleno que está. La ropa cambia con la temporada: no marques que las prendas, los colores o los modelos son otros.";

  const etapa = ctx.ia_sugerencias
    ? "Además de lo que hay que corregir, podés dejar hasta 2 sugerencias para que quede más lindo (gravedad \"sugerencia\")."
    : "ETAPA ACTUAL: marcá SOLO problemas puntuales que hay que corregir hoy. No des sugerencias de estilo ni de combinación.";

  return `Sos el control de orden de los locales de VDH, una marca de ropa urbana para hombres.
Revisás la foto que sacó un vendedor de ${ctx.sector_tipo === "salon" ? "un módulo de exhibición del salón" : "su sector del depósito"}: "${ctx.modulo_nombre}".

QUÉ MIRAR (cada punto tiene una clave):
${reglasPorCheck}
${colores}${sentido}${mueble}${exhibidor}${ctx.reglas_extra ? `\nPROPIO DE ESTE MÓDULO (manda sobre las reglas generales): ${ctx.reglas_extra}` : ""}${deEstilo}

CÓMO RESPONDER
- Sé estricto pero justo: marcá solo lo que se ve CLARAMENTE en la foto. Ante la duda, no lo marques.
- Si un punto no se puede ver (por ejemplo, etiquetas adentro de la prenda), ponelo como "no_se_ve". Nunca es un error.
- Si la foto está borrosa, muy oscura, cortada o no muestra ningún mueble con ropa (estantes, perchero, carro, mesa o vidriera) ni un depósito, devolvé foto_valida = false y explicá en una frase cómo sacarla de nuevo.${salon ? `
- Si en el módulo se ve un cartel de liquidación, "sale" o descuentos, no pidas degradé de color: esos percheros van por talle.` : ""}
- No inventes problemas por no tener una foto para comparar: las reglas alcanzan.${guiaReferencia}
- Hallazgos: máximo 4, en español rioplatense, cortos y en imperativo (ej.: "Completá el frontal: faltan 2 prendas"). En "detalle", una frase concreta de dónde está el problema.
- Si un frontal está incompleto, el detalle tiene que decir: "Si no hay más stock, cambiá la prenda por otro producto." Nunca sugieras dejarlo incompleto.
- ${etapa}
- Nivel: impecable = todo bien; bien = un detalle menor; a_mejorar = un problema claro para corregir; fuera_de_estandar = varios problemas o el módulo desarmado.
- confianza: qué tan seguro estás de lo que viste ("baja" si la foto no deja ver bien).
- que_hay: qué ropa hay en ${ctx.sector_tipo === "salon" ? "el módulo" : "este sector del depósito"}, en 1 a 4 palabras, como lo diría un vendedor: la prenda que más se ve primero (ej.: "Remeras", "Buzos y camperas", "Jeans", "Accesorios", "Zapatillas"). Sin colores, marcas ni cantidades. Si no se distingue, dejalo vacío.
Respondé SOLO con el informe, en el formato JSON pedido.`;
}

/** Un valor que puede faltar: va como null (en el esquema estricto todas las propiedades son obligatorias). */
function oNulo(t: Record<string, unknown>) {
  const { description, ...resto } = t;
  return { anyOf: [resto, { type: "null" }], ...(description ? { description } : {}) };
}

/** El formato del informe (structured outputs): todos los objetos cerrados y todas las propiedades obligatorias. */
export function armarEsquema(checks: string[]) {
  return {
    type: "object",
    properties: {
      foto_valida: { type: "boolean" },
      motivo_foto_invalida: oNulo({ type: "string", description: "Solo si foto_valida es false; si no, null." }),
      checks: {
        type: "object",
        properties: Object.fromEntries(checks.map((c) => [c, { type: "string", enum: ["ok", "mal", "no_se_ve"] }])),
        required: checks,
        additionalProperties: false,
      },
      prendas_por_frontal: oNulo({
        type: "array",
        items: { type: "integer" },
        description: "Solo salón: cuántas prendas ves en cada frontal, de izquierda a derecha; null si no aplica.",
      }),
      hallazgos: {
        type: "array",
        description: "Máximo 4.",
        items: {
          type: "object",
          properties: {
            check: checks.length ? { type: "string", enum: checks } : { type: "string" },
            titulo: { type: "string" },
            detalle: oNulo({ type: "string" }),
            gravedad: { type: "string", enum: ["corregir", "sugerencia"] },
          },
          required: ["check", "titulo", "detalle", "gravedad"],
          additionalProperties: false,
        },
      },
      nivel_sugerido: { type: "string", enum: [...NIVELES] },
      comentario: oNulo({ type: "string", description: "Una frase corta para el vendedor." }),
      confianza: { type: "string", enum: ["alta", "media", "baja"] },
      que_hay: { type: "string", description: "Qué ropa hay, en 1 a 4 palabras (\"Remeras\", \"Buzos y camperas\"). Vacío si no se distingue." },
    },
    required: ["foto_valida", "motivo_foto_invalida", "checks", "prendas_por_frontal", "hallazgos", "nivel_sugerido", "comentario", "confianza", "que_hay"],
    additionalProperties: false,
  };
}

/** Deja la respuesta prolija y aplica reglas de seguridad para no generar tareas injustas. */
export function normalizar(r: Partial<Resultado>, ctx: Contexto): Resultado {
  const checks: Resultado["checks"] = {};
  // Con el formato JSON la IA puede devolver un valor de la lista con otra mayúscula ("OK", "Impecable"):
  // se compara siempre en minúscula (lo avisa la documentación de structured outputs).
  for (const c of ctx.checks) {
    const v = minuscula(r.checks?.[c]);
    checks[c] = v === "ok" || v === "mal" || v === "no_se_ve" ? v : "no_se_ve";
  }
  const conf = minuscula(r.confianza);
  const confianza = conf === "alta" || conf === "media" || conf === "baja" ? conf : "media";
  const checkDe = (v: unknown) => ctx.checks.find((c) => c.toLowerCase() === minuscula(v));

  let hallazgos = (Array.isArray(r.hallazgos) ? r.hallazgos : [])
    .filter((h) => h && checkDe(h.check) && typeof h.titulo === "string" && h.titulo.trim())
    .slice(0, 4)
    .map((h) => ({
      check: checkDe(h.check)!,
      titulo: h.titulo.trim().slice(0, 100),
      detalle: h.detalle?.trim().slice(0, 300),
      gravedad: minuscula(h.gravedad) === "corregir" ? "corregir" as const : "sugerencia" as const,
    }));
  const nivel = minuscula(r.nivel_sugerido);

  // Con confianza baja, nada se convierte en tarea: quedan como sugerencias.
  if (confianza === "baja") hallazgos = hallazgos.map((h) => ({ ...h, gravedad: "sugerencia" as const }));
  // Sugerencias apagadas en esta etapa: se descartan.
  if (!ctx.ia_sugerencias) hallazgos = hallazgos.filter((h) => h.gravedad === "corregir");
  // Coherencia: si hay algo para corregir en un punto, ese punto no puede estar "ok".
  for (const h of hallazgos) if (h.gravedad === "corregir" && checks[h.check] === "ok") checks[h.check] = "mal";

  return {
    foto_valida: r.foto_valida !== false,
    motivo_foto_invalida: r.foto_valida === false ? (r.motivo_foto_invalida ?? "Sacá la foto de nuevo, con más luz y de frente.") : undefined,
    checks,
    prendas_por_frontal: Array.isArray(r.prendas_por_frontal) ? r.prendas_por_frontal.filter(Number.isInteger) : undefined,
    hallazgos,
    nivel_sugerido: NIVELES.includes(nivel as never) ? nivel as Resultado["nivel_sugerido"] : "bien",
    comentario: r.comentario?.trim().slice(0, 200),
    confianza,
    que_hay: r.foto_valida === false ? undefined : limpiarQueHay(r.que_hay),
  };
}

/** Un valor de una lista, en minúscula y sin espacios alrededor ("" si no es texto). */
function minuscula(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

/** "remeras  y buzos." → "Remeras y buzos" (sin punto final, la primera en mayúscula, hasta 40 letras). */
export function limpiarQueHay(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim().replace(/[.;:,]+$/, "").slice(0, 40).trim();
  if (!t || /^(no se (ve|distingue)|nada|vac[ií]o|-+)$/i.test(t)) return undefined;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export async function analizarConClaude(opts: {
  ctx: Contexto;
  foto: Imagen;
  referencia: Imagen | null;
  modelo: string;
  apiKey: string;
}): Promise<Resultado> {
  const { ctx, foto, referencia, modelo, apiKey } = opts;

  const contenido: unknown[] = [];
  if (referencia) {
    contenido.push({ type: "text", text: ctx.referencia_tipo === "ejemplo"
      ? "FOTO DE EJEMPLO (otro mueble del mismo tipo, bien ordenado: muestra el nivel de orden que se espera):"
      : "FOTO MODELO (así tiene que quedar el orden de este módulo; la ropa puede ser otra):" });
    contenido.push({ type: "image", source: { type: "base64", ...referencia } });
  }
  contenido.push({ type: "text", text: "FOTO A REVISAR:" });
  contenido.push({ type: "image", source: { type: "base64", ...foto } });
  contenido.push({ type: "text", text: `Revisá "${ctx.modulo_nombre}" y completá el informe.` });

  const r = await pedirJson({
    apiKey,
    cuerpo: {
      model: modelo,
      // El modelo piensa antes de contestar y eso cuenta dentro de max_tokens: margen de sobra.
      max_tokens: 8000,
      // Si la foto de referencia no se pudo bajar, el texto no la nombra.
      system: armarSistema(referencia ? ctx : { ...ctx, referencia_path: null }),
      output_config: { format: { type: "json_schema", schema: armarEsquema(ctx.checks) } },
      messages: [{ role: "user", content: contenido }],
    },
  });
  return normalizar(r as Partial<Resultado>, ctx);
}

/**
 * Pide a Claude una respuesta en JSON (structured outputs) y la devuelve ya leída.
 * Reintenta si la API está saturada o hubo un error del servidor. Lo usan las fotos de
 * los módulos y las del cierre de caja.
 */
export async function pedirJson(opts: {
  apiKey: string;
  cuerpo: Record<string, unknown>;
  pedir?: typeof fetch;
  espera?: number;
}): Promise<Record<string, unknown>> {
  const pedir = opts.pedir ?? fetch;
  let ultimoError = "";
  for (let intento = 1; intento <= 3; intento++) {
    const res = await pedir("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": opts.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(opts.cuerpo),
    });
    if (res.ok) {
      const msg = await res.json();
      if (msg.stop_reason === "max_tokens") throw new Error("La IA se quedó sin lugar para contestar (max_tokens)");
      if (msg.stop_reason === "refusal") throw new Error("La IA no quiso revisar la foto (refusal)");
      // Antes del JSON pueden venir bloques de "thinking": se toma el texto.
      const texto = (msg.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
      if (!texto.trim()) throw new Error("La IA no devolvió el informe");
      try {
        return JSON.parse(texto);
      } catch {
        throw new Error(`La IA devolvió algo que no es JSON: ${texto.slice(0, 120)}`);
      }
    }
    ultimoError = `API ${res.status}: ${(await res.text()).slice(0, 300)}`;
    // Reintenta solo si está saturada o hubo un error del servidor
    if (![429, 500, 502, 503, 529].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, (opts.espera ?? 1500) * intento));
  }
  throw new Error(ultimoError);
}
