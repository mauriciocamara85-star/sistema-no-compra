// Revisión de fotos con la API de Claude (visión).
// No hay que "entrenar" nada: le mandamos la foto, la foto modelo del módulo (o, si no
// tiene, la foto ejemplo de su tipo de mueble) y las reglas de orden que están cargadas
// en la base (orden_reglas). Las reglas marcadas como sugerencia (SQL 123) van aparte y
// sólo cuando las sugerencias están prendidas: nunca se vuelven "corregir".
// Desde el SQL 170 también van las "lecciones": lo que marcó y el supervisor dijo que estaba
// mal (orden_ia_opiniones), para que no lo repita. Es lo que la "entrena".
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
  /** El supervisor eligió el mueble a mano en la ficha (SQL 129): ya no es una suposición del croquis. */
  mueble_elegido?: boolean | null;
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
  /** Modo práctica (SQL 170): revisa y anota, pero al vendedor no le llega nada. Sin el SQL, no hay. */
  ia_practica?: boolean;
  /** Lo que marcó antes y el supervisor dijo que estaba mal (SQL 170): primero los de este módulo. */
  lecciones?: Leccion[];
};

export type Leccion = { titulo: string; detalle?: string | null; motivo?: string | null; modulo?: string | null; este_modulo?: boolean };

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
  /** Los rubros que se ven, de RUBROS, el que más se ve primero (24/10: el historial de qué hubo en cada módulo). */
  rubros?: string[];
  /** Los colores que más se ven, de la lista del degradé más los de afuera (COLORES_EXTRA). */
  colores?: string[];
  /** Hay un conjunto armado de prendas de distintos rubros (un maniquí, un look colgado junto). */
  look?: boolean;
};

const NIVELES = ["impecable", "bien", "a_mejorar", "fuera_de_estandar"] as const;

/** Los rubros de VDH: los mismos del catálogo (stock_fabrica.rubro, el del POS), para cruzar después lo que hubo en
    cada módulo con lo que se vendió (paso 4 del plan de visual merchandising, 24/10/2026). */
export const RUBROS = ["Remeras", "Pantalones", "Bermudas", "Buzos", "Camisas", "Camperas", "Sweaters", "Chombas", "Sacos", "Short de Baño", "Calzado", "Accesorios"];
/** Los que no están en el degradé pero aparecen en la ropa; "Estampado", la prenda con un dibujo grande. */
const COLORES_EXTRA = ["Rojo", "Naranja", "Amarillo", "Verde", "Rosa", "Violeta", "Estampado"];
/** Si la base no manda el degradé (orden_colores vacío), éstos. */
const COLORES_BASE = ["Blanco", "Crudo", "Beige", "Gris claro", "Celeste", "Camel", "Gris", "Verde oliva", "Azul", "Bordó", "Marrón", "Azul marino", "Negro"];
/** La lista de colores que puede anotar la IA: los del degradé (o los de base) y los de afuera, sin repetir. */
export function listaColores(degrade: string[]): string[] {
  const vistos = new Set<string>();
  return [...(degrade.length ? degrade : COLORES_BASE), ...COLORES_EXTRA]
    .map((c) => String(c).trim()).filter((c) => c && !vistos.has(c.toLowerCase()) && vistos.add(c.toLowerCase()));
}

const NOMBRE_CHECK: Record<string, string> = {
  dobladas: "Prendas dobladas y estantes completos",
  frontales: "Frontales",
  etiquetas: "Etiquetas",
  limpieza: "Limpieza",
  exhibicion: "Exhibición (colores, cantidades, percheros)",
  rotulado: "Rotulado",
  talles: "Separado por segmento y talle",
  // Los de cada mueble (SQL 129): mesas y percheros, y la vidriera.
  colgado: "Lo colgado (perchas y prendas colgadas)",
  armado: "Armado de la vidriera (maniquíes y prendas)",
  carteles: "Carteles y precios",
  luces: "Luces",
};

/** "a, b y c", salteando los que no van. */
function enLista(partes: (string | false)[]): string {
  const p = partes.filter((x): x is string => !!x);
  return p.length > 1 ? `${p.slice(0, -1).join(", ")} y ${p[p.length - 1]}` : p.join("");
}

/** Un texto en un solo renglón y con tope, para meterlo en el pedido. */
function unaLinea(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Un comentario que habla del degradé o de los colores mezclados: con un conjunto armado no va (Mauricio, 24/10). */
export const HABLA_DE_DEGRADE = /degrad|claro.{0,30}oscur|oscur.{0,30}clar|\btonos?\b|colores?\s+(est[aá]n\s+)?mezclad|mezcl\w*\s+(los\s+)?colores/i;

export function armarSistema(ctx: Contexto): string {
  // La vidriera se reconoce por sus puntos (SQL 129): ahí no hay degradé ni liquidación, y las
  // reglas que empiezan con "En la vidriera:" son sólo para ella.
  const esVidriera = ctx.checks.includes("armado");
  const obligatorias = ctx.reglas.filter((r) => !r.sugerencia && (esVidriera || !/^En la vidriera:/i.test(r.texto)));
  const sugerencias = ctx.reglas.filter((r) => r.sugerencia);
  // Los frontales son sólo de la pared con estantes, y el doblado de la pared, la mesa y el depósito:
  // en los muebles que no los tienen no se nombran (SQL 129). En la mesa, el doblado son las pilas.
  const conFrontales = ctx.checks.includes("frontales");
  const conDoblado = ctx.checks.includes("dobladas");
  const deposito = ctx.sector_tipo === "deposito";
  const esMesa = conDoblado && !conFrontales && !deposito;
  const nombre = (c: string) => esMesa && c === "dobladas" ? "Prendas dobladas (pilas parejas y completas)" : NOMBRE_CHECK[c] ?? c;
  const reglasPorCheck = ctx.checks.map((c) => {
    const lineas = obligatorias.filter((r) => r.check === c).map((r) => `  - ${r.texto}`);
    return `• ${c} — ${nombre(c)}\n${lineas.join("\n") || "  - (sin reglas cargadas)"}`;
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
  // El tipo de mueble se deduce del croquis y puede fallar (el 20 de Rivadavia es un carro y figura con estantes);
  // desde el SQL 129 el supervisor lo puede elegir en la ficha, y entonces es seguro.
  const mueble = !ctx.mueble ? ""
    : ctx.mueble_elegido
    ? `\nMUEBLE (lo eligió el supervisor): ${ctx.mueble}. Si en la foto se ve otro mueble, revisá el que se ve: nunca invalides la foto por eso.`
    : `\nMUEBLE (dato aproximado, sale del croquis): ${ctx.mueble}. Si en la foto se ve otro mueble (un perchero, un carro, una mesa), revisá el que se ve: nunca invalides la foto por eso.`;
  // El sentido del degradé es como lo ve el cliente que entra (SQL 125): el más claro, del lado de la entrada.
  // En la liquidación lo colgado va por talle y no se pide degradé. En la vidriera, nada de eso.
  const salon = ctx.sector_tipo === "salon" && !esVidriera;
  const colores = salon && !ctx.liquidacion && ctx.colores.length
    ? `\nREGLA DE COLORES (el orden del degradé, del más claro al más oscuro): ${ctx.colores.join(" → ")}.`
    : "";
  const sentido = !salon ? ""
    : ctx.liquidacion
    ? "\nLIQUIDACIÓN: este módulo es de liquidación: lo colgado va ordenado por TALLE, no por color. No pidas degradé ni que los colores combinen o coincidan con los estantes; sí mirá que esté prolijo, completo y limpio."
    : ctx.lado === "izquierda" || ctx.lado === "derecha"
    ? `\nLADO DEL LOCAL: pared ${ctx.lado} (mirando desde la entrada). El degradé arranca con el más claro del lado ${ctx.lado === "izquierda" ? "IZQUIERDO" : "DERECHO"} de la foto y va oscureciendo hacia el ${ctx.lado === "izquierda" ? "derecho" : "izquierdo"}: así lo ve el cliente que entra. Si ya está así, está bien: nunca pidas invertirlo.`
    : "\nSENTIDO DEL DEGRADÉ: en este mueble puede arrancar de cualquier lado; mirá sólo que sea un degradé parejo, sin colores cortados.";
  // Mauricio (24/10): la colección nueva va armada por conjuntos (pantalón, remera, pantalón, remera…) y la IA lo
  // marcaba como un degradé mal hecho. Con conjuntos no se pide degradé (y si igual lo pide, normalizar lo saca).
  const conjuntos = salon && !ctx.liquidacion
    ? "\nCONJUNTOS: si lo colgado está armado por conjuntos que se repiten (pantalón, remera, pantalón, remera…) o hay un look completo, como en la colección nueva, el orden es por conjunto: no pidas degradé ni marques que los colores están mezclados; sí mirá que esté prolijo y completo."
    : "";
  // Lo que el supervisor ya le corrigió (SQL 170): lo marcó y no era un problema. Primero los de este módulo.
  const lecciones = (ctx.lecciones ?? []).filter((l) => l && typeof l.titulo === "string" && l.titulo.trim()).slice(0, 12);
  const deLecciones = lecciones.length
    ? `\n\nLO QUE EL SUPERVISOR YA TE CORRIGIÓ (lo marcaste y no era un problema: en casos parecidos, no lo vuelvas a marcar):\n${lecciones.map((l) =>
        `  - "${unaLinea(l.titulo, 100)}"${l.este_modulo ? " (en este mismo módulo)" : l.modulo ? ` (en ${unaLinea(l.modulo, 40)})` : ""}` +
        (l.motivo ? `: el supervisor dijo «${unaLinea(l.motivo, 200)}»` : "")).join("\n")}`
    : "";
  const guiaReferencia = !ctx.referencia_path ? ""
    : ctx.referencia_tipo === "ejemplo"
    ? "\n- La foto de ejemplo es de OTRO mueble del mismo tipo, bien ordenado: usala sólo para ver el nivel de orden que se espera. No marques que la ropa, los colores, la cantidad o la disposición son distintos."
    : `\n- Compará contra la foto modelo el ORDEN: ${enLista(["la disposición", conFrontales && "los frontales", conDoblado && "el doblado", "lo lleno que está"])}. La ropa cambia con la temporada: no marques que las prendas, los colores o los modelos son otros.`;
  // El ejemplo de hallazgo, del mueble que se revisa
  const ejemplo = conFrontales ? '"Completá el frontal: faltan 2 prendas"'
    : esVidriera ? '"Acomodá la remera del maniquí de la izquierda"'
    : deposito ? '"Separá por talle las remeras del segundo estante"'
    : conDoblado ? '"Emprolijá las pilas de la mesa"'
    : '"Poné las perchas mirando para el mismo lado"';
  // Lo que no tiene este mueble (ronda 2 del árbitro: en la mesa, las reglas de los estantes valen para las pilas;
  // el depósito sí tiene estantes).
  const otroMueble = conFrontales ? ""
    : deposito ? " (acá no hay frontales: no los nombres)"
    : esMesa ? " (acá no hay frontales: no los nombres; lo que dicen las reglas de los estantes vale para las pilas de la mesa)"
    : " (acá no hay estantes ni frontales: no los nombres; si una regla habla de ellos, no la apliques)";

  const etapa = ctx.ia_sugerencias
    ? "Si queda lugar en los 2, podés dejar una sugerencia para que quede más lindo (gravedad \"sugerencia\"); lo que hay que corregir va siempre primero."
    : "ETAPA ACTUAL: marcá SOLO problemas puntuales que hay que corregir hoy. No des sugerencias de estilo ni de combinación.";

  return `Sos el control de orden de los locales de VDH, una marca de ropa urbana para hombres.
Revisás la foto que sacó un vendedor de ${ctx.sector_tipo === "salon" ? "un módulo de exhibición del salón" : "su sector del depósito"}: "${ctx.modulo_nombre}".

QUÉ MIRAR (cada punto tiene una clave):
${reglasPorCheck}
${colores}${sentido}${conjuntos}${mueble}${exhibidor}${ctx.reglas_extra ? `\nPROPIO DE ESTE MÓDULO (manda sobre las reglas generales): ${ctx.reglas_extra}` : ""}${deEstilo}${deLecciones}

CÓMO RESPONDER
- Sé estricto pero justo: marcá solo lo que se ve CLARAMENTE en la foto. Ante la duda, no lo marques.
- Mirá lo esencial de ESTE mueble: sólo los puntos de la lista de arriba. No pidas cosas de otro tipo de mueble${otroMueble}. Los detalles finos los mira después el supervisor.
- Si un punto no se puede ver (por ejemplo, etiquetas adentro de la prenda), ponelo como "no_se_ve". Nunca es un error.
- Si la foto está borrosa, muy oscura, cortada o no muestra ningún mueble con ropa (estantes, perchero, carro, mesa o vidriera) ni un depósito, devolvé foto_valida = false y explicá en una frase cómo sacarla de nuevo.${salon ? `
- Si en el módulo se ve un cartel de liquidación, "sale" o descuentos, no pidas degradé de color: esos percheros van por talle.` : ""}
- No inventes problemas por no tener una foto para comparar: las reglas alcanzan.${guiaReferencia}
- Hallazgos: máximo 2, lo más importante primero. Cortitos, para que el vendedor los lea de un vistazo: el título de hasta 6 palabras, en español rioplatense y en imperativo (ej.: ${ejemplo}). En "detalle", una sola frase corta de dónde está el problema.
${conFrontales ? `- Si un frontal está incompleto, el detalle tiene que decir: "Si no hay más stock, cambiá la prenda por otro producto." Nunca sugieras dejarlo incompleto.\n` : ""}- ${etapa}
- Nivel: impecable = todo bien; bien = un detalle menor; a_mejorar = un problema claro para corregir; fuera_de_estandar = varios problemas o el módulo desarmado.
- confianza: qué tan seguro estás de lo que viste ("baja" si la foto no deja ver bien).
- que_hay: qué ropa hay en ${ctx.sector_tipo === "salon" ? "el módulo" : "este sector del depósito"}, en 1 a 4 palabras, como lo diría un vendedor: la prenda que más se ve primero (ej.: "Remeras", "Buzos y camperas", "Jeans", "Accesorios", "Zapatillas"). Sin colores, marcas ni cantidades. Si no se distingue, dejalo vacío.
- rubros: los rubros que se ven, de esta lista (${RUBROS.join(", ")}), hasta 4, el que más se ve primero. Los jeans y joggers son "Pantalones"; gorras, cintos, boxers, medias, corbatas, bufandas y billeteras son "Accesorios"; las zapatillas y botas son "Calzado". Vacío si no se distingue.
- colores: los colores que más se ven en la ropa, de esta lista (${listaColores(ctx.colores).join(", ")}), hasta 4, el que más se ve primero. Una prenda con un dibujo o una estampa grande es "Estampado". Vacío si no se distingue.
- look: true si hay un conjunto armado con prendas de distintos rubros que van juntas (un maniquí vestido, un pantalón con su remera y su campera colgados juntos, o un perchero armado por conjuntos: pantalón, remera, pantalón, remera…); si no, false.${deposito ? " En el depósito, siempre false." : ""}
Respondé SOLO con el informe, en el formato JSON pedido.`;
}

/** Un valor que puede faltar: va como null (en el esquema estricto todas las propiedades son obligatorias). */
function oNulo(t: Record<string, unknown>) {
  const { description, ...resto } = t;
  return { anyOf: [resto, { type: "null" }], ...(description ? { description } : {}) };
}

/** El formato del informe (structured outputs): todos los objetos cerrados y todas las propiedades obligatorias.
    degrade: los colores del degradé (ctx.colores); los rubros y los colores van como listas cerradas, sin anyOf. */
export function armarEsquema(checks: string[], degrade: string[] = []) {
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
        description: "Máximo 2, lo que hay que corregir primero.",
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
      rubros: { type: "array", items: { type: "string", enum: RUBROS }, description: "Hasta 4, el que más se ve primero. Vacío si no se distingue." },
      colores: { type: "array", items: { type: "string", enum: listaColores(degrade) }, description: "Hasta 4, el que más se ve primero. Vacío si no se distingue." },
      look: { type: "boolean", description: "Hay un conjunto armado de prendas de distintos rubros." },
    },
    required: ["foto_valida", "motivo_foto_invalida", "checks", "prendas_por_frontal", "hallazgos", "nivel_sugerido", "comentario", "confianza", "que_hay", "rubros", "colores", "look"],
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

  const conLook = r.foto_valida !== false && ctx.sector_tipo === "salon" && r.look === true;
  let hallazgos = (Array.isArray(r.hallazgos) ? r.hallazgos : [])
    .filter((h) => h && checkDe(h.check) && typeof h.titulo === "string" && h.titulo.trim())
    .map((h) => ({
      check: checkDe(h.check)!,
      titulo: h.titulo.trim().slice(0, 100),
      detalle: h.detalle?.trim().slice(0, 300),
      gravedad: minuscula(h.gravedad) === "corregir" ? "corregir" as const : "sugerencia" as const,
    }))
    // Con un conjunto armado no se pide degradé: si igual lo pidió, se saca.
    .filter((h) => !conLook || !HABLA_DE_DEGRADE.test(`${h.titulo} ${h.detalle ?? ""}`));
  const nivel = minuscula(r.nivel_sugerido);

  // Con confianza baja, nada se convierte en tarea: quedan como sugerencias.
  if (confianza === "baja") hallazgos = hallazgos.map((h) => ({ ...h, gravedad: "sugerencia" as const }));
  // Sugerencias apagadas en esta etapa: se descartan.
  if (!ctx.ia_sugerencias) hallazgos = hallazgos.filter((h) => h.gravedad === "corregir");
  // Dos como máximo, para que el vendedor las vea de un vistazo (Mauricio, 24/10; antes eran hasta 4):
  // lo que hay que corregir primero.
  hallazgos = [...hallazgos.filter((h) => h.gravedad === "corregir"), ...hallazgos.filter((h) => h.gravedad !== "corregir")].slice(0, 2);
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
    rubros: r.foto_valida === false ? undefined : deLaLista(r.rubros, RUBROS),
    colores: r.foto_valida === false ? undefined : deLaLista(r.colores, listaColores(ctx.colores)),
    look: r.foto_valida === false || typeof r.look !== "boolean" ? undefined : ctx.sector_tipo === "salon" && r.look,
  };
}

/** Los de la lista, escritos como en la lista (aunque vengan con otra mayúscula), sin repetir y hasta 4; nada si no hay. */
export function deLaLista(v: unknown, lista: string[]): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const x of v) {
    const c = lista.find((l) => l.toLowerCase() === minuscula(x));
    if (c && !out.includes(c)) out.push(c);
  }
  return out.length ? out.slice(0, 4) : undefined;
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
  pedir?: typeof fetch;
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

  const pedido = (schema: unknown) => pedirJson({
    apiKey,
    pedir: opts.pedir,
    cuerpo: {
      model: modelo,
      // El modelo piensa antes de contestar y eso cuenta dentro de max_tokens: margen de sobra.
      max_tokens: 8000,
      // Si la foto de referencia no se pudo bajar, el texto no la nombra.
      system: armarSistema(referencia ? ctx : { ...ctx, referencia_path: null }),
      output_config: { format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: contenido }],
    },
  });
  const esquema = armarEsquema(ctx.checks, ctx.colores);
  let r: Record<string, unknown>;
  try {
    r = await pedido(esquema);
  } catch (e) {
    // Si la API no acepta el formato con los rubros y los colores (24/10), la foto se revisa igual con el de antes:
    // que no pase lo del 12/10, cuando un 400 dejó todas las fotos sin revisar.
    if (!/^API 400:/.test(String((e as Error)?.message))) throw e;
    console.error("analizar-foto: el formato con rubros y colores no pasó; va el de antes", (e as Error).message);
    r = await pedido(sinHistorial(esquema));
  }
  return normalizar(r as Partial<Resultado>, ctx);
}

/** El formato de antes del 24/10: sin rubros, colores ni look. */
export function sinHistorial(e: ReturnType<typeof armarEsquema>) {
  const { rubros: _r, colores: _c, look: _l, ...properties } = e.properties;
  return { ...e, properties, required: e.required.filter((k) => k !== "rubros" && k !== "colores" && k !== "look") };
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
