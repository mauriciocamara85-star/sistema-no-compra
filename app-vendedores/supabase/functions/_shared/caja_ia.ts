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
  lote: { total: "Total en pesos del cierre de lote" },
  mp: { total: "Total cobrado en el día (si la pantalla muestra un total)" },
  gocuotas: { total: "Total cobrado en el día" },
};

const QUE_ES: Record<TipoFoto, string> = {
  sistema:
    'la pantalla "Cierre de caja" del sistema del local: a la derecha "Resultados del día" y a la izquierda el recuadro "TOTAL EFECTIVO" con el mensaje de sobrante o faltante (puede verse sólo "Resultados del día")',
  lote: "el cierre de lote del posnet (Payway u otro)",
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
- Si la foto no es la pantalla pedida o no se lee, foto_valida = false y explicá en "motivo" cómo sacarla de nuevo; si está bien, "".
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
  // Si Mercado Pago/Go Cuotas no muestran total pero la lista está completa, usamos la suma.
  if ((opts.tipo === "mp" || opts.tipo === "gocuotas") && r.total == null && typeof r.suma_operaciones === "number" && !r.lista_cortada) {
    r.total = r.suma_operaciones;
  }
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
