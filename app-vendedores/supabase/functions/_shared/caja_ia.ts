// Lectura de fotos del cierre de caja con la API de Claude.
// La IA solo LEE números: quien cierra los confirma, y la base compara lo leído con lo cargado.
// La respuesta se pide como JSON con un esquema (structured outputs): la herramienta forzada
// de antes (tool_choice) la rechazan Claude Sonnet 5.5 / Opus 5.5.
import { type Imagen, pedirJson } from "./ia.ts";

export type TipoFoto = "sistema" | "lote" | "mp" | "gocuotas";

const CAMPOS: Record<TipoFoto, Record<string, string>> = {
  sistema: {
    saldo_inicial: "Saldo Inicial",
    ventas_tarjeta: "Ventas Tarjeta",
    ventas_efectivo: "Ventas Efectivo",
    ventas_mercado_pago: "Ventas Mercado Pago",
    ventas_cuenta_corriente: "Ventas Cuenta Corriente",
    ventas_deposito_bancario: "Ventas Depósito Bancario",
    ventas_debito_go: "Ventas DebitoGo",
    ventas_totales: "Ventas Totales del Día",
    gastos_efectivo: "Gastos en Efectivo",
    otros_gastos: "Otros Gastos",
    otras_salidas: "Otras salidas",
    descuentos: "Descuentos",
    saldo_final_efectivo: "Saldo Final en Efectivo",
    // (16/10) El efectivo contado: el recuadro de la izquierda de la pantalla "Cierre de caja".
    total_efectivo:
      'TOTAL EFECTIVO: el recuadro de la izquierda, arriba del mensaje de sobrante o faltante (es el efectivo que se contó; no es "Saldo Final en Efectivo"). null si no aparece en la foto',
    sobrante_faltante:
      'El mensaje debajo de TOTAL EFECTIVO: 0 si dice "No hay sobrante ni faltante de caja"; si dice sobrante, el monto en positivo; si dice faltante, el monto en negativo; null si no se ve',
  },
  lote: { total: "Total en pesos del cierre de lote (si se ven dos o más posnet, el del primero: cada uno va en posnets)" },
  mp: { total: "Total cobrado en el día, sólo si la pantalla lo muestra escrito (no lo calcules)" },
  gocuotas: { total: "Total cobrado en el día" },
};

const QUE_ES: Record<TipoFoto, string> = {
  sistema:
    'la pantalla "Cierre de caja" del sistema del local: a la derecha "Resultados del día" y a la izquierda el recuadro "TOTAL EFECTIVO" con el mensaje de sobrante o faltante (puede verse sólo "Resultados del día")',
  lote: "el cierre de lote del posnet (Payway, Getnet u otro); puede haber dos o más posnet en la misma foto",
  mp: "el resumen de cobros de Mercado Pago del día",
  gocuotas: "el resumen de cobros de Go Cuotas del día",
};

const numeroONulo = (description: string) => ({ anyOf: [{ type: "number" }, { type: "null" }], description });

/** (18/10) La API rechaza el esquema ("Schema is too complex for compilation", 400) con más de 16 propiedades
 *  con anyOf. Con total_efectivo y sobrante_faltante el del sistema llegó a 18 y la foto del 17/10 no se leyó:
 *  sólo los montos van con anyOf; motivo y fecha son texto (vacío si no hay). */
export const MAX_UNIONES = 16;

/** El formato de la lectura (structured outputs): objeto cerrado y todas las propiedades obligatorias. */
export function esquemaCaja(tipo: TipoFoto) {
  const montos = Object.fromEntries(Object.entries(CAMPOS[tipo]).map(([k, etiqueta]) => [k, numeroONulo(etiqueta)]));
  const conLista = tipo === "mp" || tipo === "gocuotas";
  const properties = {
    foto_valida: { type: "boolean", description: "false si no se leen los números o no es la pantalla pedida" },
    motivo: { type: "string", description: 'Si foto_valida es false, cómo sacarla de nuevo; si no, ""' },
    fecha: { type: "string", description: 'Fecha que aparece en la foto, formato AAAA-MM-DD; "" si no aparece' },
    ...montos,
    ...(conLista
      ? { suma_operaciones: numeroONulo("Si NO hay total y se ve una lista, la suma de los montos visibles; si no, null") }
      : {}),
    // (4/11) Parque Brown mandó el Payway y el Getnet en la misma foto y se leyó uno solo: la IA lista cada
    // posnet y el código los suma (la IA nunca calcula el total del lote).
    ...(tipo === "lote"
      ? {
        posnets: {
          type: "array",
          description: "Cada posnet que se ve en la foto, uno por renglón, con su nombre y el total de su cierre (uno solo si hay uno)",
          items: {
            type: "object",
            properties: {
              nombre: { type: "string", description: 'El nombre del posnet o de la empresa ("Payway", "Getnet"…); "" si no se ve' },
              total: numeroONulo("El total en pesos del cierre de ese posnet"),
            },
            required: ["nombre", "total"],
            additionalProperties: false,
          },
        },
      }
      : {}),
    // (4/11, SQL 242) Mercado Pago en dos fotos: la IA lista cada venta y el código cuenta una sola vez la que se ve en
    // las dos (Mauricio: "que se dé cuenta si hay ventas de la primera foto para que no las sume en la segunda").
    ...(tipo === "mp"
      ? {
        operaciones: {
          type: "array",
          description: "Cada cobro de la lista que se ve, en el orden de la pantalla (vacío si no hay lista)",
          items: {
            type: "object",
            properties: {
              hora: { type: "string", description: 'La hora del cobro tal como aparece ("18:42"); "" si no se ve' },
              numero: { type: "string", description: 'El número de operación, si se ve; "" si no' },
              monto: numeroONulo("El monto en pesos de ese cobro"),
            },
            required: ["hora", "numero", "monto"],
            additionalProperties: false,
          },
        },
      }
      : {}),
    lista_cortada: { type: "boolean", description: "true si la lista sigue fuera de la foto (no se ven todas)" },
    dudas: { type: "array", items: { type: "string" }, description: "Números que no se leen bien (vacío si no hay)" },
  };
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

export function sistemaCaja(tipo: TipoFoto, fechaCaja: string, local: string): string {
  return `Leés fotos de cierres de caja de VDH (local ${local}, día ${fechaCaja}).
Esta foto debería ser ${QUE_ES[tipo]}.
- Los montos están en pesos argentinos con formato "$ 1.440.100,00": el punto separa miles y la coma, decimales. Devolvé números simples (1440100).
- Copiá SOLO lo que se lee claramente. Si un número no se lee bien, dejalo en null y anotalo en "dudas". Nunca inventes ni calcules un monto que no está.
- Si en la foto aparece una fecha, devolvela (sirve para detectar fotos de otro día); si no, "".
${tipo === "lote" ? `- Si se ven dos o más posnet (por ejemplo un Payway y un Getnet), anotá cada uno en "posnets" con su nombre y su total; no los sumes. Si dos tickets son del mismo posnet (el mismo terminal), va una sola vez.
` : ""}${tipo === "mp" ? `- Si se ve la lista de cobros, anotá cada uno en "operaciones", en el orden de la pantalla: la hora tal como aparece, el número de operación si se ve y el monto. Un renglón cortado por el borde de la foto va sólo si se leen la hora y el monto. No los sumes: la cuenta la hace el sistema.
` : ""}- Si la foto no es la pantalla pedida o no se lee, foto_valida = false y explicá en "motivo" cómo sacarla de nuevo; si está bien, "".
Respondé SOLO con la lectura, en el formato JSON pedido.`;
}

export async function leerFotoCaja(opts: {
  tipo: TipoFoto; fecha: string; local: string; foto: Imagen; modelo: string; apiKey: string; pedir?: typeof fetch;
}): Promise<Record<string, unknown>> {
  const r = await pedirJson({
    apiKey: opts.apiKey,
    pedir: opts.pedir,
    cuerpo: {
      model: opts.modelo,
      // El modelo piensa antes de contestar y eso cuenta dentro de max_tokens: margen de sobra.
      max_tokens: 8000,
      system: sistemaCaja(opts.tipo, opts.fecha, opts.local),
      output_config: { format: { type: "json_schema", schema: esquemaCaja(opts.tipo) } },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", ...opts.foto } },
          { type: "text", text: "Leé los montos de esta foto." },
        ],
      }],
    },
  });

  // Montos: siempre número o null (por si la IA devuelve "1.440.100,00" como texto)
  for (const k of [...Object.keys(CAMPOS[opts.tipo]), "suma_operaciones"]) r[k] = aNumero(r[k]);
  if (opts.tipo === "mp") ventasDeLaLista(r);
  // Si Mercado Pago/Go Cuotas no muestran total pero la lista está completa, usamos la suma.
  if ((opts.tipo === "mp" || opts.tipo === "gocuotas") && r.total == null && typeof r.suma_operaciones === "number" && !r.lista_cortada) {
    r.total = r.suma_operaciones;
    // (SQL 241) Con dos fotos de Mercado Pago, el total de la pantalla vale una vez y lo de cada lista se suma.
    r.total_de_lista = true;
  }
  if (opts.tipo === "lote") sumarPosnets(r);
  if (opts.tipo === "sistema") efectivoContado(r);
  r.fecha = fechaValida(r.fecha);
  // Sin motivo, null como antes (la base y la app preguntan si hay motivo).
  if (typeof r.motivo !== "string" || !r.motivo.trim()) r.motivo = null;
  return r;
}

/** (16/10) El efectivo contado de la foto del sistema. Si TOTAL EFECTIVO no se lee pero el mensaje dice
 *  "No hay sobrante ni faltante", es el saldo final. En $ 0 con saldo final, todavía no se había contado: null. */
export function efectivoContado(r: Record<string, unknown>) {
  const saldo = r.saldo_final_efectivo, dif = r.sobrante_faltante;
  if (r.total_efectivo == null && dif === 0 && typeof saldo === "number" && saldo > 0) r.total_efectivo = saldo;
  else if (r.total_efectivo === 0 && typeof saldo === "number" && saldo > 0) {
    r.total_efectivo = null;
    r.dudas = [...(Array.isArray(r.dudas) ? r.dudas : []), "TOTAL EFECTIVO en $ 0: todavía no se había contado el efectivo"];
  }
}

/** (4/11) El lote con dos o más posnet en la foto: el total es la suma de los de cada uno (la cuenta la hace el
 *  código, no la IA). Si uno no se lee, el total queda sin leer y va a dudas: mejor que lo carguen a mano. */
export function sumarPosnets(r: Record<string, unknown>) {
  const lista = Array.isArray(r.posnets) ? r.posnets as Record<string, unknown>[] : [];
  const posnets = lista.map((p) => ({ nombre: typeof p?.nombre === "string" ? p.nombre.trim() : "", total: aNumero(p?.total) }));
  r.posnets = posnets;
  if (posnets.length < 2) {
    if (r.total == null && posnets[0]?.total != null) r.total = posnets[0].total;
    return;
  }
  const sinLeer = posnets.filter((p) => p.total == null);
  if (sinLeer.length) {
    r.total = null;
    r.dudas = [...(Array.isArray(r.dudas) ? r.dudas : []), ...sinLeer.map((p) => `No se lee el total del posnet ${p.nombre || "sin nombre"}`)];
  } else r.total = posnets.reduce((s, p) => s + (p.total as number), 0);
}

/** (SQL 242) Las ventas de la lista de Mercado Pago: la hora como "18:42" y el número sólo con sus dígitos (así la misma
 *  venta en dos fotos se reconoce), y la suma la hace el código. Si un monto no se lee, la suma queda sin leer y va a
 *  dudas. Un "total" igual a la suma de la lista no es el total del día de la pantalla: con dos fotos se cuentan las ventas. */
export function ventasDeLaLista(r: Record<string, unknown>) {
  const lista = Array.isArray(r.operaciones) ? r.operaciones as Record<string, unknown>[] : [];
  const ops = lista.map((o) => ({ hora: horaDeVenta(o?.hora), numero: String(o?.numero ?? "").replace(/\D/g, ""), monto: aNumero(o?.monto) }));
  r.operaciones = ops;
  if (!ops.length) return;
  const sinLeer = ops.filter((o) => o.monto == null);
  if (sinLeer.length) {
    r.suma_operaciones = null;
    r.dudas = [...(Array.isArray(r.dudas) ? r.dudas : []), ...sinLeer.map((o) => `No se lee el monto de la venta${o.hora ? ` de las ${o.hora}` : ""}`)];
    return;
  }
  r.suma_operaciones = Math.round(ops.reduce((s, o) => s + (o.monto as number), 0) * 100) / 100;
  if (typeof r.total === "number" && Math.abs(r.total - (r.suma_operaciones as number)) < 0.01) r.total_de_lista = true;
}

/** "18:42" | "18.42 hs" | "9:05" → "18:42" / "09:05"; cualquier otra cosa ("hace 5 minutos") → "" */
export function horaDeVenta(v: unknown): string {
  const m = typeof v === "string" ? v.match(/(\d{1,2})\s*[:.h]\s*(\d{2})/) : null;
  return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** "1.440.100,00" | "$ 708.000" | 708000 → número; cualquier otra cosa → null */
export function aNumero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const limpio = v.replace(/[^0-9,.-]/g, "");
  if (!/\d/.test(limpio)) return null; // sin dígitos no es un monto (nunca convertir basura en $0)
  const n = limpio.includes(",")
    ? Number(limpio.replace(/\./g, "").replace(",", "."))
    : Number(limpio.replace(/\./g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Solo fechas reales en formato AAAA-MM-DD (descarta "2026-13-10") */
export function fechaValida(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}
