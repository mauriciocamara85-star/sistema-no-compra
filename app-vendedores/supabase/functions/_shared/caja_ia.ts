// Lectura de fotos del cierre de caja con la API de Claude.
// La IA solo LEE números: quien cierra los confirma, y la base compara lo leído con lo cargado.
import type { Imagen } from "./ia.ts";

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
  },
  lote: { total: "Total en pesos del cierre de lote" },
  mp: { total: "Total cobrado en el día (si la pantalla muestra un total)" },
  gocuotas: { total: "Total cobrado en el día" },
};

const QUE_ES: Record<TipoFoto, string> = {
  sistema: 'la pantalla "Resultados del día" del cierre de caja del sistema del local',
  lote: "el cierre de lote del posnet (Payway u otro)",
  mp: "el resumen de cobros de Mercado Pago del día",
  gocuotas: "el resumen de cobros de Go Cuotas del día",
};

export function herramientaCaja(tipo: TipoFoto) {
  const montos = Object.fromEntries(
    Object.entries(CAMPOS[tipo]).map(([k, etiqueta]) => [k, { type: ["number", "null"], description: etiqueta }]),
  );
  return {
    name: "lectura_caja",
    description: "Montos leídos de la foto.",
    input_schema: {
      type: "object",
      properties: {
        foto_valida: { type: "boolean", description: "false si no se leen los números o no es la pantalla pedida" },
        motivo: { type: "string" },
        fecha: { type: ["string", "null"], description: "Fecha que aparece en la foto, formato AAAA-MM-DD; null si no aparece" },
        ...montos,
        suma_operaciones: {
          type: ["number", "null"],
          description: "Solo Mercado Pago/Go Cuotas: si NO hay total y se ve una lista, la suma de los montos visibles",
        },
        lista_cortada: { type: "boolean", description: "true si la lista sigue fuera de la foto (no se ven todas)" },
        dudas: { type: "array", items: { type: "string" }, description: "Números que no se leen bien" },
      },
      required: ["foto_valida"],
    },
  };
}

export function sistemaCaja(tipo: TipoFoto, fechaCaja: string, local: string): string {
  return `Leés fotos de cierres de caja de VDH (local ${local}, día ${fechaCaja}).
Esta foto debería ser ${QUE_ES[tipo]}.
- Los montos están en pesos argentinos con formato "$ 1.440.100,00": el punto separa miles y la coma, decimales. Devolvé números simples (1440100).
- Copiá SOLO lo que se lee claramente. Si un número no se lee bien, dejalo en null y anotalo en "dudas". Nunca inventes ni calcules un monto que no está.
- Si en la foto aparece una fecha, devolvela (sirve para detectar fotos de otro día).
- Si la foto no es la pantalla pedida o no se lee, foto_valida = false y explicá en "motivo" cómo sacarla de nuevo.
Respondé SOLO con la herramienta lectura_caja.`;
}

export async function leerFotoCaja(opts: {
  tipo: TipoFoto; fecha: string; local: string; foto: Imagen; modelo: string; apiKey: string;
}): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: opts.modelo,
      max_tokens: 1200,
      system: sistemaCaja(opts.tipo, opts.fecha, opts.local),
      tools: [herramientaCaja(opts.tipo)],
      tool_choice: { type: "tool", name: "lectura_caja" },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", ...opts.foto } },
          { type: "text", text: "Leé los montos de esta foto." },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const msg = await res.json();
  const bloque = (msg.content ?? []).find((b: { type: string }) => b.type === "tool_use");
  if (!bloque) throw new Error("La IA no devolvió la lectura");
  const r = bloque.input as Record<string, unknown>;

  // Montos: siempre número o null (por si la IA devuelve "1.440.100,00" como texto)
  for (const k of [...Object.keys(CAMPOS[opts.tipo]), "suma_operaciones"]) r[k] = aNumero(r[k]);
  // Si Mercado Pago/Go Cuotas no muestran total pero la lista está completa, usamos la suma.
  if ((opts.tipo === "mp" || opts.tipo === "gocuotas") && r.total == null && typeof r.suma_operaciones === "number" && !r.lista_cortada) {
    r.total = r.suma_operaciones;
  }
  r.fecha = fechaValida(r.fecha);
  return r;
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
