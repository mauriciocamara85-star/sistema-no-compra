// La distribución del salón con la IA (visual merchandising, SQL 173).
// La base arma todo lo que tiene que saber (orden_vm_preparar): las reglas VDH que editan los supervisores, la
// fecha, la temporada, la colección nueva (sale del final del código), lo que trae cada colección en el stock de
// fábrica, cada módulo del croquis con su zona y lo que vio la IA en su última foto, y lo que el supervisor ya
// descartó. Claude devuelve como mucho el 30 % de los módulos para cambiar; la propuesta es para el supervisor,
// que la manda al responsable como tarea o la descarta. Al vendedor no le llega nada de la IA.
import { pedirJson } from "./ia.ts";

export type ModuloVM = {
  ref: string;
  nombre: string;
  zona: string | null;
  lugar: string | null;
  mueble: string | null;
  liquidacion: boolean;
  contenido: string | null;
  foto: {
    fecha: string;
    dias: number;
    que_hay: string | null;
    rubros: string[];
    colores: string[];
    look: boolean | null;
  } | null;
};

export type GrupoColeccion = {
  numero: number | null;
  temporada: string | null;
  articulos: number;
  unidades: number;
  rubros: { rubro: string; articulos: number; unidades: number }[];
  colores: string[];
};

export type ContextoVM = {
  sugerencia_id: string;
  local: string;
  fecha: string;
  estacion: string;
  coleccion: number | null;
  temporada: string | null;
  momento: string;
  fecha_clave: string | null;
  reglas: string;
  colecciones: Partial<Record<"nueva" | "anterior" | "viejas" | "basicos", GrupoColeccion>>;
  modulos: ModuloVM[];
  lecciones: { modulo: string; propuso: string; motivo: string | null; local: string }[];
  recientes: { modulo: string; pedido: string; fecha: string }[];
};

export type PropuestaVM = {
  modulo: string;
  hoy: string;
  propone: string;
  mover: string;
  porque: string;
  prioridad: "alta" | "media" | "baja";
};

export type ResultadoVM = { resumen: string; falta: string; propuestas: PropuestaVM[] };

export const MOMENTOS: Record<string, string> = {
  lanzamiento: "Lanzamiento de colección nueva",
  cambio: "Cambio de temporada",
  mitad: "Mitad de temporada, sin lanzamiento",
  liquidacion_parcial: "Liquidación parcial",
  liquidacion_total: "Liquidación total",
  fecha_clave: "Fecha clave",
};

const ZONAS: Record<string, string> = {
  vidriera: "Vidriera y frente",
  entrada: "Entrada",
  caliente: "Zona caliente",
  media: "Zona media",
  fondo: "Fondo",
  caja: "Caja y probadores",
};

const LUGARES: Record<string, string> = {
  izquierda: "pared izquierda",
  derecha: "pared derecha",
  fondo: "pared del fondo",
  frente: "pared del frente",
  centro: "en el medio del salón",
};

const MUEBLES: Record<string, string> = {
  estantes: "pared con estantes",
  perchero: "perchero",
  mesa: "mesa o exhibidor",
  vidriera: "vidriera",
};

const PRIORIDADES = ["alta", "media", "baja"] as const;

/** Como mucho el 30 % de los módulos (y al menos uno). */
export function maximoPropuestas(n: number): number {
  return Math.max(1, Math.floor(n * 0.3));
}

function grupo(nombre: string, g: GrupoColeccion | undefined): string {
  if (!g) return "";
  const rubros = g.rubros.slice(0, 8).map((r) => `${r.rubro} ${r.articulos} art. (${r.unidades} u.)`).join(", ");
  const colores = g.colores.length ? ` Colores que más hay: ${g.colores.join(", ")}.` : "";
  return `\n- ${nombre}: ${g.articulos} artículos. ${rubros}.${colores}`;
}

function renglon(m: ModuloVM): string {
  // El nombre, si dice algo más que el número ("Exhibidor 1"; no "Módulo 3")
  const partes = [m.nombre && m.nombre !== m.ref && m.nombre !== "Módulo " + m.ref ? m.nombre : null];
  partes.push(m.zona ? ZONAS[m.zona] ?? m.zona : "sin zona");
  if (m.lugar && LUGARES[m.lugar]) partes.push(LUGARES[m.lugar]);
  if (m.mueble && m.mueble !== "vidriera") partes.push(MUEBLES[m.mueble] ?? m.mueble);
  if (m.liquidacion) partes.push("LIQUIDACIÓN");
  partes.push(m.contenido ? `qué hay: ${m.contenido}` : "qué hay: no está anotado");
  if (m.foto) {
    const vio = [m.foto.rubros.length ? m.foto.rubros.join(", ") : m.foto.que_hay];
    if (m.foto.colores.length) vio.push(`colores ${m.foto.colores.join(", ")}`);
    if (m.foto.look) vio.push("con un look armado");
    const hace = m.foto.dias === 0 ? "hoy" : m.foto.dias === 1 ? "ayer" : `hace ${m.foto.dias} días`;
    partes.push(`última foto ${m.foto.fecha} (${hace})${vio.filter(Boolean).length ? ": " + vio.filter(Boolean).join("; ") : ""}`);
  } else partes.push("sin foto revisada");
  return `- [${m.ref}] ${partes.filter(Boolean).join(" · ")}`;
}

/** Las instrucciones: las reglas de VDH y cómo tiene que contestar. */
export function armarSistemaVM(ctx: ContextoVM): string {
  const max = maximoPropuestas(ctx.modulos.length);
  const liqTotal = ctx.momento === "liquidacion_total";
  return `Sos el visual merchandiser de VDH, una marca argentina de ropa de hombre. Ayudás al supervisor a decidir cómo distribuir el salón de un local: qué va en cada módulo según su zona, la temporada, la colección nueva y la liquidación. El supervisor lee tus propuestas, las corrige y decide cuáles le manda como tarea al vendedor responsable de cada módulo.

Seguí las reglas de visual merchandising de VDH. Las armaron los supervisores y mandan sobre cualquier costumbre general:

<reglas_vdh>
${ctx.reglas.trim()}
</reglas_vdh>

Cómo trabajar:
- Usá sólo los datos que te pasan: cada módulo del croquis con su zona y su lugar, lo anotado en cada uno, lo que vio la IA en su última foto y lo que trae cada colección en el stock de fábrica (es el de la fábrica, no el del local). No inventes stock, ventas ni talles del local: no los tenés. Si te falta un dato para decidir bien, decilo en "falta" en vez de suponerlo.
- Proponé como mucho ${max} cambios (el 30 % de los ${ctx.modulos.length} módulos): los que más mejoran el local. Si el local ya está bien, proponé menos o ninguno. Los módulos que no cambian no los nombres.
- Una propuesta por módulo. En "modulo" va exactamente lo que está entre corchetes en la lista.
- La colección nueva va adelante: vidriera, entrada y zona caliente. La anterior y las más viejas, a liquidación agrupada en el fondo. Los básicos (99), en la zona media o el fondo.${liqTotal ? "\n- Es liquidación total: la liquidación puede ocupar la zona media y parte de la caliente, pero la vidriera y la entrada siguen con producto de marca." : "\n- Nada de liquidación en la vidriera, la entrada ni la zona caliente."}
- Los marcados LIQUIDACIÓN son los módulos de liquidación de hoy. Si proponés que uno deje de serlo, o que otro pase a serlo, decilo en "mover".
- La vidriera, con un look completo de la colección nueva que también esté adentro, con talles.
- Pensá el local entero: si sacás algo de un módulo, decí a cuál va, y que dos módulos vecinos no compitan.
- No repitas lo que el supervisor ya descartó (salvo que haya cambiado algo y lo expliques en "porque"), ni lo que ya se pidió hace poco.
- Escribí para un vendedor de local: frases cortas y concretas, en español rioplatense ("poné", "sacá", "pasá"). Sin palabras en inglés ni nombres de reglas en mayúsculas.

Cada propuesta:
- hoy: qué hay hoy en el módulo, en pocas palabras (de lo anotado o de la última foto; si no se sabe, "No se sabe").
- propone: qué poner: el rubro o el look, de qué colección, el color que manda y la prenda estrella.
- mover: qué sale y a qué módulo va (vacío si no sale nada).
- porque: la regla de VDH que aplica, en una línea.
- prioridad: alta, media o baja, según lo que mejora el local.
resumen: la idea general de la distribución, en 1 o 2 frases.
falta: lo que te faltó saber para proponer mejor, en una o dos frases (vacío si no faltó nada).`;
}

/** Los datos del local de hoy. */
export function armarPedidoVM(ctx: ContextoVM): string {
  const c = ctx.colecciones;
  const momento = (MOMENTOS[ctx.momento] ?? ctx.momento) + (ctx.momento === "fecha_clave" && ctx.fecha_clave ? `: ${ctx.fecha_clave}` : "");
  const nueva = ctx.coleccion
    ? `COLECCIÓN NUEVA: la ${ctx.coleccion} (${ctx.temporada}). La anterior, la ${ctx.coleccion - 1}, va a liquidación. La 99 son los básicos.`
    : "COLECCIÓN NUEVA: no se sabe (no hay códigos en el stock de fábrica).";
  const colecciones = [grupo(`Nueva (${c.nueva?.numero}, ${c.nueva?.temporada})`, c.nueva), grupo(`Anterior (${c.anterior?.numero}, ${c.anterior?.temporada})`, c.anterior),
    grupo("Más viejas", c.viejas), grupo("Básicos (99)", c.basicos)].join("");
  const lecciones = ctx.lecciones.length
    ? `\n\nLO QUE EL SUPERVISOR YA DESCARTÓ (no lo repitas):\n${ctx.lecciones.map((l) =>
      `- ${l.local === "este" ? "" : `(en ${l.local}) `}Módulo ${l.modulo}: "${l.propuso}"${l.motivo ? ` → ${l.motivo}` : " (sin decir por qué)"}`).join("\n")}`
    : "";
  const recientes = ctx.recientes.length
    ? `\n\nLO QUE YA SE LE PIDIÓ AL EQUIPO HACE POCO:\n${ctx.recientes.map((r) => `- ${r.fecha}, módulo ${r.modulo}: "${r.pedido}"`).join("\n")}`
    : "";
  return `LOCAL: ${ctx.local} · hoy ${ctx.fecha} (${ctx.estacion})
MOMENTO: ${momento}
${nueva}

LO QUE TRAE CADA COLECCIÓN (stock de fábrica):${colecciones || "\n- No hay datos."}

EL SALÓN (en el orden del croquis: la numeración arranca en la puerta; las vidrieras no tienen número):
${ctx.modulos.map(renglon).join("\n")}${lecciones}${recientes}

Proponé la distribución.`;
}

/** El formato de la respuesta: el módulo sólo puede ser uno de la lista (sin anyOf). */
export function esquemaVM(refs: string[]) {
  const texto = (description: string) => ({ type: "string", description });
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      resumen: texto("La idea general, en 1 o 2 frases."),
      falta: texto("Lo que faltó saber para proponer mejor; vacío si nada."),
      propuestas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            modulo: { type: "string", enum: refs, description: "Lo que está entre corchetes en la lista." },
            hoy: texto("Qué hay hoy, en pocas palabras."),
            propone: texto("Qué poner: rubro o look, colección, color que manda y prenda estrella."),
            mover: texto("Qué sale y a qué módulo va; vacío si no sale nada."),
            porque: texto("La regla de VDH que aplica, en una línea."),
            prioridad: { type: "string", enum: [...PRIORIDADES] },
          },
          required: ["modulo", "hoy", "propone", "mover", "porque", "prioridad"],
        },
      },
    },
    required: ["resumen", "falta", "propuestas"],
  };
}

function corto(v: unknown, max: number): string {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

/** Lo que devolvió la IA, limpio: sólo módulos de la lista, uno por módulo, lo más importante primero y como mucho el 30 %. */
export function normalizarVM(r: Partial<ResultadoVM> | null | undefined, ctx: ContextoVM): ResultadoVM {
  const refs = new Set(ctx.modulos.map((m) => m.ref));
  const vistos = new Set<string>();
  const propuestas: PropuestaVM[] = [];
  for (const p of Array.isArray(r?.propuestas) ? r!.propuestas : []) {
    const modulo = typeof p?.modulo === "string" ? p.modulo.trim() : "";
    const propone = corto(p?.propone, 400);
    if (!refs.has(modulo) || vistos.has(modulo) || !propone) continue;
    vistos.add(modulo);
    propuestas.push({
      modulo,
      hoy: corto(p.hoy, 300),
      propone,
      mover: corto(p.mover, 300),
      porque: corto(p.porque, 400),
      prioridad: (PRIORIDADES as readonly string[]).includes(p.prioridad as string) ? p.prioridad as PropuestaVM["prioridad"] : "media",
    });
  }
  // Lo más importante primero; entre iguales, en el orden en que las dio
  const orden = propuestas.map((p, i) => ({ p, i })).sort((a, b) => PRIORIDADES.indexOf(a.p.prioridad) - PRIORIDADES.indexOf(b.p.prioridad) || a.i - b.i);
  return {
    resumen: corto(r?.resumen, 600),
    falta: corto(r?.falta, 400),
    propuestas: orden.map((x) => x.p).slice(0, maximoPropuestas(ctx.modulos.length)),
  };
}

/** Le pide la distribución a Claude. El modelo piensa antes de contestar (y eso cuenta en max_tokens): margen de sobra. */
export async function sugerirConClaude(opts: {
  ctx: ContextoVM;
  modelo: string;
  apiKey: string;
  esfuerzo?: string;
  pedir?: typeof fetch;
  senal?: AbortSignal;
}): Promise<ResultadoVM> {
  const { ctx } = opts;
  const pedir: typeof fetch = opts.senal
    ? (url, init) => (opts.pedir ?? fetch)(url, { ...init, signal: opts.senal })
    : opts.pedir ?? fetch;
  const r = await pedirJson({
    apiKey: opts.apiKey,
    pedir,
    cuerpo: {
      model: opts.modelo,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: armarSistemaVM(ctx),
      output_config: { effort: opts.esfuerzo ?? "medium", format: { type: "json_schema", schema: esquemaVM(ctx.modulos.map((m) => m.ref)) } },
      messages: [{ role: "user", content: armarPedidoVM(ctx) }],
    },
  });
  return normalizarVM(r as Partial<ResultadoVM>, ctx);
}

/** Lo que ve el supervisor si la IA falla (el detalle queda en el log). */
export function errorParaElSupervisor(e: unknown): string {
  const m = String((e as Error)?.message ?? e);
  if ((e as Error)?.name === "AbortError" || /abort/i.test(m)) return "La IA tardó demasiado: probá de nuevo";
  if (/max_tokens/.test(m)) return "La IA se quedó sin lugar para contestar: probá de nuevo";
  if (/refusal/.test(m)) return "La IA no quiso contestar este pedido";
  if (/^API (429|5\d\d|529)/.test(m)) return "La IA está saturada: probá de nuevo en unos minutos";
  if (/^API 4\d\d/.test(m)) return "La IA no aceptó el pedido: avisale a Mauricio";
  return "No pudimos hablar con la IA: probá de nuevo";
}
