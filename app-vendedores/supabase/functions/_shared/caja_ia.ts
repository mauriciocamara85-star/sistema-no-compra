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
  // (7/11, Unicenter 6/11) De la caja de ventas: la «Caja Fuerte» tiene la misma pantalla y no sirve.
  sistema:
    'la pantalla "Cierre de caja" del sistema del local, de la caja de ventas (no la «Caja Fuerte»): a la derecha "Resultados del día" y a la izquierda el recuadro "TOTAL EFECTIVO" con el mensaje de sobrante o faltante (puede verse sólo "Resultados del día")',
  // (5/11) El cierre de lote puede ser el ticket impreso o la pantalla del posnet (Mauricio: "a veces también puede ser
  // la pantalla, directamente la pantalla del posnet").
  lote: "el cierre de lote del posnet (Payway, Getnet u otro), en el ticket impreso o en la pantalla del posnet; puede haber dos o más posnet en la misma foto",
  mp: "el resumen de cobros de Mercado Pago del día",
  gocuotas: "el resumen de cobros de Go Cuotas del día",
};

/** (5/11) Lo que tiene que leerse para que la foto sirva. Si esto se lee, la foto vale aunque esté torcida, con reflejo o
 *  un poco cortada (Mauricio: "Dale bastante margen … no rechazar ninguna, excepto que sea algo muy evidente"). Si no se
 *  lee, se rechaza: aceptarla dejaría el casillero vacío y trabado, peor que pedir otra foto. */
const LO_PRINCIPAL: Record<TipoFoto, string> = {
  sistema: 'los montos de "Resultados del día"',
  lote: "el total del cierre de lote",
  mp: "el total del día o los cobros del día en la lista",
  gocuotas: "el total del día o los cobros de la lista",
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
    foto_valida: { type: "boolean", description: "false SÓLO si es claramente otra cosa o si no se lee lo principal" },
    motivo: { type: "string", description: 'Si foto_valida es false: UNA sola frase corta y simple (12 palabras como mucho) con qué está mal y qué hacer; si no, ""' },
    fecha: { type: "string", description: 'Fecha que aparece en la foto, formato AAAA-MM-DD; "" si no aparece' },
    // (7/11) Qué caja es (texto: no suma anyOf). La «Caja Fuerte» la rechaza el código (cajaDeVentas).
    ...(tipo === "sistema"
      ? { caja: { type: "string", description: 'Lo que dice el casillero «CAJA» de arriba, tal cual (por ejemplo "Caja Fuerte"); "" si no se ve' } }
      : {}),
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
              // (7/11, San Justo 6/11) Lo cobrado, lo anulado y lo devuelto por separado: la resta la hace el código
              // (sumarPosnets). Antes la IA daba las compras ($ 627.510) y el sistema decía el neto ($ 556.110).
              total: numeroONulo(
                "Las compras (ventas) de ese posnet tal como figuran, SIN restar anulaciones ni devoluciones (en Payway o Sistema POS: el monto de «Co» en TOTALES EN PESOS; en Getnet: VENTAS del TOTAL GENERAL)",
              ),
              anulaciones: numeroONulo("Lo anulado en ese cierre (en Payway o Sistema POS: el monto de «An» en TOTALES EN PESOS); 0 si no hay o figura en $ 0"),
              devoluciones: numeroONulo("Lo devuelto en ese cierre (en Payway o Sistema POS: el monto de «Dv» en TOTALES EN PESOS); 0 si no hay o figura en $ 0"),
            },
            required: ["nombre", "total", "anulaciones", "devoluciones"],
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
    lista_cortada: { type: "boolean", description: "true si pueden quedar cobros del día de la caja fuera de la foto" },
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
${tipo === "sistema" ? `- Arriba, en «CAJA», dice qué caja es: copialo en "caja". Tiene que ser la caja de ventas: la «Caja Fuerte» es otra pantalla.
` : ""}${tipo === "lote" ? `- Si se ven dos o más posnet (por ejemplo un Payway y un Getnet), anotá cada uno en "posnets" con su nombre y su total; no los sumes. Si dos tickets son del mismo posnet (el mismo terminal), va una sola vez.
- En cada posnet, el total son las compras tal como figuran, sin restar nada. Si el cierre trae anulaciones («An») o devoluciones («Dv») con monto, anotalas aparte en "anulaciones" y "devoluciones" (0 si no hay): no las restes, la cuenta la hace el sistema.
` : ""}${tipo === "mp" ? `- Si se ve la lista de cobros, anotá cada uno en "operaciones", en el orden de la pantalla: la hora tal como aparece, el número de operación si se ve y el monto. Un renglón cortado por el borde de la foto va sólo si se leen la hora y el monto. No los sumes: la cuenta la hace el sistema.
- En "operaciones" van sólo los cobros del día de la caja: si la lista separa los días («Hoy», «Ayer» o una fecha), los de otros días no van. "lista_cortada" = true sólo si pueden quedar cobros de ese día fuera de la foto (si abajo ya empiezan los de otro día, la lista del día está completa). Si no se ve de qué día son (ni «Hoy» ni una fecha), "lista_cortada" = true.
` : ""}${tipo === "mp" || tipo === "gocuotas" ? `- Si la pantalla dice que no hay cobros ni ventas (por ejemplo «No tenés ninguna venta»), la foto vale y el total es 0.
` : ""}- Dale margen a la foto: si se lee ${LO_PRINCIPAL[tipo]}, foto_valida = true aunque esté torcida, con reflejo o sombra, un poco cortada o algo borrosa. Lo que no se lea bien va en null y en "dudas".
- foto_valida = false SÓLO en dos casos: es claramente otra cosa (otra pantalla, el cupón de una venta, una foto en negro o de otra cosa) o no se lee ${LO_PRINCIPAL[tipo]}. Ante la duda, true.
- Si foto_valida es false, en "motivo" escribí UNA sola frase corta, muy simple, como para un chico de 10 años: qué está mal y qué hacer. Como mucho 12 palabras, sin montos, sin horas ni nombres de campos. Ejemplos: "Es otra pantalla: sacale a la del cierre de caja.", "Falta la parte de abajo: que entre toda la pantalla.", "Salió borrosa: sacala quieta, de frente y sin reflejos.", "Es el cupón de una venta: sacale al cierre de lote.", "No se ven los montos: abrí la lista de cobros de hoy.". Si está bien, "".
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
  if (opts.tipo === "sistema") { efectivoContado(r); ventasEnCero(r); cajaDeVentas(r); }
  r.fecha = fechaValida(r.fecha);
  // Sin motivo, null como antes (la base y la app preguntan si hay motivo).
  if (typeof r.motivo !== "string" || !r.motivo.trim()) r.motivo = null;
  else r.motivo = r.motivo.trim();
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

/** Los renglones de ventas de "Resultados del día" (la foto del sistema), con el nombre que ve el supervisor. */
export const VENTAS_SISTEMA: Record<string, string> = {
  ventas_tarjeta: "Tarjeta", ventas_efectivo: "Efectivo", ventas_mercado_pago: "Mercado Pago",
  ventas_cuenta_corriente: "Cuenta Corriente", ventas_deposito_bancario: "Depósito Bancario", ventas_debito_go: "Go Cuotas",
};

/** (6/11, San Justo Shopping 2/11) Renglones de ventas que no se ven en la foto del sistema (la lista corrida, la fila
 *  tapada por la barra): si los que se ven ya suman las Ventas Totales del Día, los otros dan $ 0. Así Mercado Pago o
 *  Go Cuotas salen «No hace falta» en vez de pedir la foto de algo que no se vendió (Mauricio: "me gusta"). En las 57
 *  fotos leídas con los seis renglones a la vista, la suma dio exacto el total. Lado seguro: si falta plata en lo que
 *  no se ve, no se toca nada; y si el efectivo es uno de los que no se ven y la cuenta del efectivo (saldo inicial +
 *  ventas en efectivo − gastos − salidas = saldo final) dice que hubo, tampoco. */
export function ventasEnCero(r: Record<string, unknown>) {
  const n = (k: string) => (typeof r[k] === "number" && Number.isFinite(r[k]) ? r[k] as number : null);
  const total = n("ventas_totales");
  const claves = Object.keys(VENTAS_SISTEMA);
  const faltan = claves.filter((k) => n(k) == null);
  if (total == null || !faltan.length) return;
  const suma = claves.reduce((s, k) => s + (n(k) ?? 0), 0);
  if (Math.abs(total - suma) >= 0.01) return;
  if (faltan.includes("ventas_efectivo")) {
    const [ini, fin, g, og, sal] = ["saldo_inicial", "saldo_final_efectivo", "gastos_efectivo", "otros_gastos", "otras_salidas"].map(n);
    if (ini != null && fin != null && g != null && og != null && sal != null && Math.abs(fin - ini + g + og + sal) >= 0.01) return;
  }
  for (const k of faltan) r[k] = 0;
  r.ventas_en_cero = faltan;
  const nombres = faltan.map((k) => VENTAS_SISTEMA[k]);
  const lista = nombres.length > 1 ? `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}` : nombres[0];
  r.dudas = [...(Array.isArray(r.dudas) ? r.dudas : []),
    `${lista} en $ 0: no ${nombres.length > 1 ? "se ven" : "se ve"}, pero lo que se ve ya suma las Ventas Totales del Día`];
}

/** (4/11) El lote con dos o más posnet en la foto: el total es la suma de los de cada uno (la cuenta la hace el
 *  código, no la IA). Si uno no se lee, el total queda sin leer y va a dudas: mejor que lo carguen a mano. */
export function sumarPosnets(r: Record<string, unknown>) {
  const lista = Array.isArray(r.posnets) ? r.posnets as Record<string, unknown>[] : [];
  const posnets = lista.map((p) => netoDelPosnet(p, r));
  r.posnets = posnets;
  if (posnets.length < 2) {
    // (7/11) Con anulaciones vale el neto del posnet, no el total de arriba (que la IA copia del ticket, sin restar).
    if (posnets[0] && "compras" in posnets[0]) r.total = posnets[0].total;
    else if (r.total == null && posnets[0]?.total != null) r.total = posnets[0].total;
    return;
  }
  const sinLeer = posnets.filter((p) => p.total == null);
  if (sinLeer.length) {
    r.total = null;
    // (El que no cierra lo anulado ya tiene su duda.)
    r.dudas = [...(Array.isArray(r.dudas) ? r.dudas : []),
      ...sinLeer.filter((p) => !("compras" in p)).map((p) => `No se lee el total del posnet ${p.nombre || "sin nombre"}`)];
  } else r.total = posnets.reduce((s, p) => s + (p.total as number), 0);
}

/** (7/11, San Justo 6/11: Co $ 627.510, An $ 71.400; el sistema decía $ 556.110) El posnet neto: las compras menos lo
 *  anulado y lo devuelto. La resta la hace el código. Sin anulaciones el posnet queda como siempre ({nombre, total}); con
 *  anulaciones, total = el neto (la base y la app suman ese) y quedan aparte compras, anulaciones y devoluciones. Una
 *  anulación sin leer (null) cuenta como que no hubo, como antes. Si lo anulado pasa lo cobrado, no cierra: sin leer. */
export function netoDelPosnet(p: Record<string, unknown> | null | undefined, r: Record<string, unknown>) {
  const nombre = typeof p?.nombre === "string" ? p.nombre.trim() : "";
  const compras = aNumero(p?.total);
  const anulaciones = Math.abs(aNumero(p?.anulaciones) ?? 0), devoluciones = Math.abs(aNumero(p?.devoluciones) ?? 0);
  if (compras == null || anulaciones + devoluciones === 0) return { nombre, total: compras };
  const neto = Math.round((compras - anulaciones - devoluciones) * 100) / 100;
  if (neto < 0) {
    r.dudas = [...(Array.isArray(r.dudas) ? r.dudas : []), `No cierra lo anulado del posnet ${nombre || "sin nombre"}`];
    return { nombre, total: null, compras, anulaciones, devoluciones };
  }
  return { nombre, total: neto, compras, anulaciones, devoluciones };
}

/** (7/11, Unicenter 6/11) La foto del cierre de la «Caja Fuerte» no sirve: tiene la misma pantalla, pero no las ventas
 *  del día (todas en $ 0 con un total de $ 993.000), y el sistema no pedía ni el lote ni Mercado Pago porque «daban» $ 0.
 *  Se rechaza si «CAJA» dice Caja Fuerte, o si hay Ventas Totales y todas las ventas por medio están en $ 0 (eso no pasa
 *  en una caja de ventas: de las 88 fotos del sistema leídas hasta el 6/11, sólo la de Unicenter). */
export function cajaDeVentas(r: Record<string, unknown>) {
  const fuerte = typeof r.caja === "string" && /fuerte/i.test(r.caja);
  const n = (k: string) => (typeof r[k] === "number" && Number.isFinite(r[k]) ? r[k] as number : null);
  const total = n("ventas_totales");
  const enCero = r.foto_valida !== false && total != null && total > 0 && Object.keys(VENTAS_SISTEMA).every((k) => n(k) === 0);
  if (!fuerte && !enCero) return;
  r.foto_valida = false;
  r.motivo = fuerte ? "Es la Caja Fuerte: elegí la caja de ventas." : "Es otra caja: elegí la caja de ventas.";
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
