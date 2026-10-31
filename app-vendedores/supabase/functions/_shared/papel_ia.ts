// Lectura de los papeles (SQL 219, 31/10/2026) con la API de Claude: el certificado médico de una ausencia y el
// apercibimiento firmado. Pedido de Mauricio: "si un vendedor sube su certificado o su apercibimiento, que la IA lo
// lea y complete todo sola". La IA sólo LEE: de quién es, las fechas, el médico y el motivo; la persona revisa el
// formulario completo y lo manda, y lo leído queda con el papel para que el supervisor vea si alguien lo cambió.
// El diagnóstico no se anota nunca: es un dato de salud y el motivo se ve en las listas y en el Excel.
// Como la caja: la respuesta se pide como JSON con un esquema (structured outputs).
import { type Imagen, pedirJson } from "./ia.ts";

export type TipoPapel = "ausencia" | "apercibimiento";
/** Alguien a quien puede corresponder el papel (la gente del local, o la persona misma). */
export type Candidato = { id: string; nombre: string };

/** Lo que leyó, ya revisado: las fechas en AAAA-MM-DD; lo que no se leyó, null. */
export type Lectura = {
  tipo: TipoPapel;
  /** Es el papel pedido y se lee. Si no, motivo_invalido dice cómo sacar la foto de nuevo y no se completa nada. */
  valido: boolean;
  motivo_invalido: string | null;
  /** El nombre tal como figura en el papel. */
  nombre: string | null;
  /** De la lista: a quién corresponde el nombre (null si no está o no se lee). */
  persona_id: string | null;
  desde: string | null;
  hasta: string | null;
  dias: number | null;
  fecha_papel: string | null;
  /** Ausencia: "reposo" (unos días), "constancia" (lo atendieron ese día) u "otro". */
  clase: "reposo" | "constancia" | "otro" | null;
  medico: string | null;
  /** Apercibimiento: se ve la firma del empleado. */
  firmado: boolean | null;
  /** Para el campo Motivo: sin el diagnóstico. */
  motivo: string | null;
  confianza: "alta" | "media" | "baja";
  dudas: string[];
};

/** Las claves de la lista que ve la IA: p1, p2… (nunca los ids). */
const clave = (i: number) => `p${i + 1}`;
const NINGUNO = "ninguno";

/** "Juan Pérez" sin saltos ni comillas raras, para la lista del pedido. */
function unaLinea(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function sistemaPapel(tipo: TipoPapel, candidatos: Candidato[], hoy: string): string {
  const lista = candidatos.length
    ? candidatos.map((c, i) => `${clave(i)}: ${unaLinea(c.nombre, 60)}`).join("\n")
    : "(vacía)";
  const comun = `Leés papeles del personal de VDH, una cadena de locales de ropa de Argentina.
Hoy es ${hoy} (Argentina). En el papel las fechas van día/mes/año; si falta el año, usá el que deja la fecha más cerca de hoy. Devolvé las fechas como AAAA-MM-DD, o "" si no están.`;
  const persona = `- persona: la clave de LA LISTA que corresponde a ese nombre. El nombre puede venir con el apellido primero, con iniciales o con alguna letra distinta. Si no está en la lista o no se lee, "${NINGUNO}". No adivines.`;
  const cierre = `- confianza: qué tan seguro estás de lo que leíste ("baja" si la letra o la foto no dejan leer bien).
- dudas: lo que no se lee bien, en frases cortas (vacío si no hay).
Copiá sólo lo que se lee: nunca inventes fechas, nombres ni números.

LA LISTA (clave: nombre)
${lista}

Respondé SOLO con la lectura, en el formato JSON pedido.`;

  if (tipo === "ausencia") {
    return `${comun}
Te mandan la foto (ya enderezada) del CERTIFICADO MÉDICO que trae alguien que faltó a trabajar.

QUÉ COMPLETAR
- es_el_papel: true si es un certificado médico, un certificado de reposo o una constancia de atención médica; false si es otra cosa o no se lee. Si es false, en motivo_invalido explicá en una frase cómo sacarle la foto de nuevo; si no, "".
- nombre_en_el_papel: el nombre del paciente, como figura ("" si no se lee).
${persona}
- fecha_papel: la fecha en que se hizo el certificado.
- clase: "reposo" si indica reposo o licencia por unos días; "constancia" si sólo dice que lo atendieron ese día; "otro" si es otra cosa.
- desde y hasta: los días que el certificado justifica, inclusive. Reposo "por 48 horas" o "por 2 días" desde una fecha: desde esa fecha, y hasta el día siguiente. Si dice "a partir de hoy" o no dice desde cuándo, desde es fecha_papel. Una constancia de atención: desde y hasta son el día de la atención.
- dias: cuántos días en total (null si no se puede saber).
- medico: el nombre del médico y su matrícula, si se leen (ej.: "Dra. Ana López, MN 123456"); "" si no.
- motivo: una frase corta para el legajo, SIN el diagnóstico ni la enfermedad (es un dato de salud privado). Ej.: "Certificado médico: reposo de 2 días (Dra. Ana López)" o "Constancia de atención médica (Hospital Privado)".
${cierre}`;
  }
  return `${comun}
Te mandan la foto (ya enderezada) de un APERCIBIMIENTO: una sanción por escrito que se le hace a un empleado y que él firma.

QUÉ COMPLETAR
- es_el_papel: true si es un apercibimiento, una advertencia o una sanción por escrito a un empleado; false si es otra cosa o no se lee. Si es false, en motivo_invalido explicá en una frase cómo sacarle la foto de nuevo; si no, "".
- nombre_en_el_papel: el nombre del empleado sancionado, como figura ("" si no se lee).
${persona}
- fecha_papel: la fecha del apercibimiento (la que tiene el papel).
- fecha_hecho: la fecha de lo que pasó, si el papel la dice ("" si no).
- motivo: qué pasó, en una o dos frases cortas en español rioplatense, como lo anotaría el encargado (ej.: "Llegó 40 minutos tarde el 28/10 sin avisar."). Hasta 250 letras.
- firmado: true si se ve la firma del empleado (no cuenta la del encargado).
${cierre}`;
}

/** El formato de la lectura (structured outputs): todo obligatorio, sólo "dias" con anyOf (el tope es 16). */
export function esquemaPapel(tipo: TipoPapel, nCandidatos: number) {
  const claves = [...Array.from({ length: nCandidatos }, (_, i) => clave(i)), NINGUNO];
  const texto = (description: string) => ({ type: "string", description });
  const properties: Record<string, unknown> = {
    es_el_papel: { type: "boolean" },
    motivo_invalido: texto('Si es_el_papel es false, cómo sacar la foto de nuevo; si no, ""'),
    nombre_en_el_papel: texto('Como figura en el papel; "" si no se lee'),
    persona: { type: "string", enum: claves },
    fecha_papel: texto('AAAA-MM-DD o ""'),
  };
  if (tipo === "ausencia") {
    Object.assign(properties, {
      clase: { type: "string", enum: ["reposo", "constancia", "otro"] },
      desde: texto('AAAA-MM-DD o ""'),
      hasta: texto('AAAA-MM-DD o ""'),
      dias: { anyOf: [{ type: "integer" }, { type: "null" }], description: "Días en total; null si no se sabe" },
      medico: texto('Nombre y matrícula; "" si no se leen'),
      motivo: texto("Frase corta, sin el diagnóstico"),
    });
  } else {
    Object.assign(properties, {
      fecha_hecho: texto('AAAA-MM-DD o ""'),
      motivo: texto("Qué pasó, una o dos frases"),
      firmado: { type: "boolean" },
    });
  }
  Object.assign(properties, {
    confianza: { type: "string", enum: ["alta", "media", "baja"] },
    dudas: { type: "array", items: { type: "string" } },
  });
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

/** Un texto limpio de un renglón con tope, o null si viene vacío. */
function texto(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim().slice(0, max).trim();
  return t || null;
}

function minuscula(v: unknown): string {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

/** AAAA-MM-DD que existe de verdad y está a menos de un año de hoy; si no, null. */
export function fechaOk(v: unknown, hoy: string): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return null;
  const f = v.trim(), d = new Date(f + "T12:00:00Z");
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== f) return null;
  return Math.abs(entre(hoy, f)) <= 366 ? f : null;
}

/** Días de a hasta b (b - a). */
export function entre(a: string, b: string): number {
  return Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 864e5);
}

export function sumarDias(f: string, n: number): string {
  const d = new Date(f + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Deja la lectura prolija y sin contradicciones; si no es el papel, no completa nada. */
export function normalizarLectura(r: Record<string, unknown>, tipo: TipoPapel, candidatos: Candidato[], hoy: string): Lectura {
  const dudas = (Array.isArray(r.dudas) ? r.dudas : []).map((d) => texto(d, 140)).filter((d): d is string => !!d).slice(0, 4);
  const conf = minuscula(r.confianza);
  const confianza = conf === "alta" || conf === "media" || conf === "baja" ? conf : "media";
  const valido = r.es_el_papel !== false;
  const k = minuscula(r.persona).match(/^p(\d+)$/);
  const persona = k ? candidatos[Number(k[1]) - 1] : undefined;
  const base: Lectura = {
    tipo, valido,
    motivo_invalido: valido ? null : (texto(r.motivo_invalido, 200) ?? "No se lee bien: sacale la foto de nuevo, de frente y con luz."),
    nombre: texto(r.nombre_en_el_papel, 80),
    persona_id: valido && persona ? persona.id : null,
    desde: null, hasta: null, dias: null,
    fecha_papel: fechaOk(r.fecha_papel, hoy),
    clase: null, medico: null, firmado: null, motivo: null,
    confianza, dudas,
  };
  if (!valido) return base;

  if (tipo === "apercibimiento") {
    let f = base.fecha_papel ?? fechaOk(r.fecha_hecho, hoy);
    if (f && f > hoy) { base.dudas.push("La fecha del papel es posterior a hoy: revisala."); f = null; }
    base.desde = base.hasta = f;
    base.motivo = texto(r.motivo, 300);
    base.firmado = typeof r.firmado === "boolean" ? r.firmado : null;
    return base;
  }

  const c = minuscula(r.clase);
  base.clase = c === "reposo" || c === "constancia" ? c : "otro";
  base.medico = texto(r.medico, 120);
  base.motivo = texto(r.motivo, 300);
  const dias = typeof r.dias === "number" && Number.isInteger(r.dias) && r.dias >= 1 && r.dias <= 90 ? r.dias : null;
  let desde = fechaOk(r.desde, hoy) ?? base.fecha_papel;
  let hasta = fechaOk(r.hasta, hoy);
  if (desde && !hasta) hasta = dias ? sumarDias(desde, dias - 1) : base.clase === "constancia" ? desde : null;
  if (desde && hasta && hasta < desde) hasta = null;
  if (desde && hasta && entre(desde, hasta) > 60) {
    base.dudas.push("Son más de 60 días: revisá las fechas.");
    hasta = null;
  }
  if (!desde) hasta = null;
  base.desde = desde;
  base.hasta = hasta;
  base.dias = desde && hasta ? entre(desde, hasta) + 1 : dias;
  // Sin la frase de la IA, una armada con lo leído (nunca con el diagnóstico).
  if (!base.motivo) {
    base.motivo = (base.clase === "constancia" ? "Constancia de atención médica" : "Certificado médico") +
      (base.clase === "reposo" && base.dias ? `: reposo de ${base.dias} ${base.dias === 1 ? "día" : "días"}` : "") +
      (base.medico ? ` (${base.medico})` : "");
  }
  return base;
}

/** Lee las hojas (hasta 4) y devuelve la lectura revisada. */
export async function leerPapel(opts: {
  tipo: TipoPapel; imagenes: Imagen[]; candidatos: Candidato[]; hoy: string; modelo: string; apiKey: string; pedir?: typeof fetch;
}): Promise<Lectura> {
  const { tipo, imagenes, candidatos, hoy } = opts;
  const contenido: unknown[] = [];
  imagenes.forEach((img, i) => {
    if (imagenes.length > 1) contenido.push({ type: "text", text: `HOJA ${i + 1}:` });
    contenido.push({ type: "image", source: { type: "base64", ...img } });
  });
  contenido.push({ type: "text", text: tipo === "ausencia" ? "Leé el certificado y completá la lectura." : "Leé el apercibimiento y completá la lectura." });
  const cuerpo = {
    model: opts.modelo,
    // El modelo piensa antes de contestar y eso cuenta dentro de max_tokens: margen de sobra.
    max_tokens: 16000,
    system: sistemaPapel(tipo, candidatos, hoy),
    output_config: { effort: "medium", format: { type: "json_schema", schema: esquemaPapel(tipo, candidatos.length) } },
    messages: [{ role: "user", content: contenido }],
  };
  let r: Record<string, unknown>;
  try {
    // Si el control de seguridad de la IA frena el pedido (un certificado médico puede parecerle un tema de
    // salud delicado), lo hace otro modelo en vez de devolver un rechazo.
    r = await pedirJson({ apiKey: opts.apiKey, pedir: opts.pedir, beta: "server-side-fallback-2026-07-01", cuerpo: { ...cuerpo, fallbacks: "default" } });
  } catch (e) {
    // Si la API no acepta el respaldo, se lee igual sin él (que un 400 no deje sin leer ningún papel, como el 12/10).
    if (!/^API 400:.*fallback/is.test(String((e as Error)?.message))) throw e;
    console.error("leer-papel: sin el respaldo", (e as Error).message);
    r = await pedirJson({ apiKey: opts.apiKey, pedir: opts.pedir, cuerpo });
  }
  return normalizarLectura(r, tipo, candidatos, hoy);
}
