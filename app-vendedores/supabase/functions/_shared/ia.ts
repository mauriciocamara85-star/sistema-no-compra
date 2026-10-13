// Revisión de fotos con la API de Claude (visión).
// No hay que "entrenar" nada: le mandamos la foto, la foto de referencia del módulo
// (si hay) y las reglas de orden que están cargadas en la base (orden_reglas).
// La respuesta llega siempre con el mismo formato gracias a una herramienta forzada.

export type Contexto = {
  foto_id: string;
  foto_path: string;
  control_tipo: string;
  sector_tipo: "salon" | "deposito";
  modulo_nombre: string;
  referencia_path: string | null;
  reglas_extra: string | null;
  exhibidor: { nombre: string; prendas_min: number | null; prendas_max: number | null; notas: string | null } | null;
  checks: string[];
  reglas: { check: string; texto: string }[];
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
  const reglasPorCheck = ctx.checks.map((c) => {
    const lineas = ctx.reglas.filter((r) => r.check === c).map((r) => `  - ${r.texto}`);
    return `• ${c} — ${NOMBRE_CHECK[c] ?? c}\n${lineas.join("\n") || "  - (sin reglas cargadas)"}`;
  }).join("\n");

  const exhibidor = ctx.exhibidor
    ? `\nEXHIBIDOR: ${ctx.exhibidor.nombre}.` +
      (ctx.exhibidor.prendas_min != null || ctx.exhibidor.prendas_max != null
        ? ` Cantidad ideal de prendas: entre ${ctx.exhibidor.prendas_min ?? "?"} y ${ctx.exhibidor.prendas_max ?? "?"}.`
        : "") +
      (ctx.exhibidor.notas ? ` ${ctx.exhibidor.notas}` : "")
    : "";

  const etapa = ctx.ia_sugerencias
    ? "Además de lo que hay que corregir, podés dejar hasta 2 sugerencias para que quede más lindo (gravedad \"sugerencia\")."
    : "ETAPA ACTUAL: marcá SOLO problemas puntuales que hay que corregir hoy. No des sugerencias de estilo ni de combinación.";

  return `Sos el control de orden de los locales de VDH, una marca de ropa urbana para hombres.
Revisás la foto que sacó un vendedor de ${ctx.sector_tipo === "salon" ? "un módulo de exhibición del salón" : "su sector del depósito"}: "${ctx.modulo_nombre}".

QUÉ MIRAR (cada punto tiene una clave):
${reglasPorCheck}
${ctx.sector_tipo === "salon" && ctx.colores.length ? `\nREGLA DE COLORES (degradé del más claro al más oscuro): ${ctx.colores.join(" → ")}.` : ""}${exhibidor}${ctx.reglas_extra ? `\nPROPIO DE ESTE MÓDULO: ${ctx.reglas_extra}` : ""}

CÓMO RESPONDER
- Sé estricto pero justo: marcá solo lo que se ve CLARAMENTE en la foto. Ante la duda, no lo marques.
- Si un punto no se puede ver (por ejemplo, etiquetas adentro de la prenda), ponelo como "no_se_ve". Nunca es un error.
- Si la foto está borrosa, muy oscura, cortada o no muestra un módulo o un depósito, devolvé foto_valida = false y explicá en una frase cómo sacarla de nuevo.
- Si hay foto de referencia, compará contra ella.
- Hallazgos: máximo 4, en español rioplatense, cortos y en imperativo (ej.: "Completá el frontal: faltan 2 prendas"). En "detalle", una frase concreta de dónde está el problema.
- Si un frontal está incompleto, el detalle tiene que decir: "Si no hay más stock, cambiá la prenda por otro producto." Nunca sugieras dejarlo incompleto.
- ${etapa}
- Nivel: impecable = todo bien; bien = un detalle menor; a_mejorar = un problema claro para corregir; fuera_de_estandar = varios problemas o el módulo desarmado.
- confianza: qué tan seguro estás de lo que viste ("baja" si la foto no deja ver bien).
Respondé SOLO usando la herramienta informe_modulo.`;
}

export function armarHerramienta(checks: string[]) {
  return {
    name: "informe_modulo",
    description: "Informe del control de orden de la foto.",
    input_schema: {
      type: "object",
      properties: {
        foto_valida: { type: "boolean" },
        motivo_foto_invalida: { type: "string", description: "Solo si foto_valida es false." },
        checks: {
          type: "object",
          properties: Object.fromEntries(checks.map((c) => [c, { type: "string", enum: ["ok", "mal", "no_se_ve"] }])),
          required: checks,
        },
        prendas_por_frontal: {
          type: "array",
          items: { type: "integer" },
          description: "Solo salón: cuántas prendas ves en cada frontal, de izquierda a derecha.",
        },
        hallazgos: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            properties: {
              check: { type: "string", enum: checks },
              titulo: { type: "string" },
              detalle: { type: "string" },
              gravedad: { type: "string", enum: ["corregir", "sugerencia"] },
            },
            required: ["check", "titulo", "gravedad"],
          },
        },
        nivel_sugerido: { type: "string", enum: [...NIVELES] },
        comentario: { type: "string", description: "Una frase corta para el vendedor." },
        confianza: { type: "string", enum: ["alta", "media", "baja"] },
      },
      required: ["foto_valida", "checks", "hallazgos", "nivel_sugerido", "confianza"],
    },
  };
}

/** Deja la respuesta prolija y aplica reglas de seguridad para no generar tareas injustas. */
export function normalizar(r: Partial<Resultado>, ctx: Contexto): Resultado {
  const checks: Resultado["checks"] = {};
  for (const c of ctx.checks) {
    const v = r.checks?.[c];
    checks[c] = v === "ok" || v === "mal" || v === "no_se_ve" ? v : "no_se_ve";
  }
  const confianza = r.confianza === "alta" || r.confianza === "media" || r.confianza === "baja" ? r.confianza : "media";

  let hallazgos = (Array.isArray(r.hallazgos) ? r.hallazgos : [])
    .filter((h) => h && ctx.checks.includes(h.check) && typeof h.titulo === "string" && h.titulo.trim())
    .slice(0, 4)
    .map((h) => ({
      check: h.check,
      titulo: h.titulo.trim().slice(0, 100),
      detalle: h.detalle?.trim().slice(0, 300),
      gravedad: h.gravedad === "corregir" ? "corregir" as const : "sugerencia" as const,
    }));

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
    nivel_sugerido: NIVELES.includes(r.nivel_sugerido as never) ? r.nivel_sugerido! : "bien",
    comentario: r.comentario?.trim().slice(0, 200),
    confianza,
  };
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
    contenido.push({ type: "text", text: "FOTO DE REFERENCIA (así tiene que verse):" });
    contenido.push({ type: "image", source: { type: "base64", ...referencia } });
  }
  contenido.push({ type: "text", text: "FOTO A REVISAR:" });
  contenido.push({ type: "image", source: { type: "base64", ...foto } });
  contenido.push({ type: "text", text: `Revisá "${ctx.modulo_nombre}" y completá el informe.` });

  const cuerpo = {
    model: modelo,
    max_tokens: 1500,
    system: armarSistema(ctx),
    tools: [armarHerramienta(ctx.checks)],
    tool_choice: { type: "tool", name: "informe_modulo" },
    messages: [{ role: "user", content: contenido }],
  };

  let ultimoError = "";
  for (let intento = 1; intento <= 3; intento++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(cuerpo),
    });
    if (res.ok) {
      const msg = await res.json();
      const bloque = (msg.content ?? []).find((b: { type: string; name?: string }) =>
        b.type === "tool_use" && b.name === "informe_modulo"
      );
      if (!bloque) throw new Error("La IA no devolvió el informe");
      return normalizar(bloque.input as Partial<Resultado>, ctx);
    }
    ultimoError = `API ${res.status}: ${(await res.text()).slice(0, 300)}`;
    // Reintenta solo si está saturada o hubo un error del servidor
    if (![429, 500, 502, 503, 529].includes(res.status)) break;
    await new Promise((r) => setTimeout(r, 1500 * intento));
  }
  throw new Error(ultimoError);
}
