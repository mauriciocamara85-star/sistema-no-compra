/**
 * Sistema VDH · El mail del IVA Ventas del mes (13/11/2026, SQL 286).
 *
 * Pedido de Mauricio (12/11): «Automáticamente a todos los primeros se les tiene que mandar un mail… Todos los primeros
 * automáticamente reciben un mail con la consulta de IVA de todo el mes». Hasta hoy cada local bajaba el «Reporte IVA
 * Ventas» y se lo mandaba a la fábrica a mano.
 *
 * Qué lleva el mail: en el cuerpo, el resumen por local (facturas, notas de crédito, base imponible, IVA y total) con el
 * total de todos; y adjunto, UN EXCEL POR LOCAL con el detalle comprobante por comprobante.
 *
 * REGLA: el Excel es EL MISMO que baja «Bajar para Excel» en la pantalla del IVA Ventas (pos.js, verIva): las mismas
 * columnas, en el mismo orden, con la misma fila del total. Si cambia uno, cambiar el otro.
 */
// deno-lint-ignore-file no-explicit-any
import { type Adjunto, armarMensaje } from './correo.ts';
import { cuit, n2 } from './factura.ts';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CONDICION: Record<string, string> = {
  consumidor_final: 'Consumidor final', responsable_inscripto: 'Responsable inscripto', monotributo: 'Monotributo', exento: 'Exento',
};
const TIPO: Record<string, string> = { ticket: 'Ticket', nc: 'Nota de crédito' };
const COLUMNAS = ['Fecha', 'L', 'Tipo', 'Comprobante', 'Anula', 'Sucursal', 'CAE', 'Cliente', 'Condición IVA', 'CUIT / DNI',
                  'Base imponible', 'No gravado', 'IVA 21 %', 'Perc. IIBB', 'IIBB CABA', 'IIBB BSAS', 'Total'];

const codificar = new TextEncoder();
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
/** La plata en centavos (enteros): se suma comprobante por comprobante, como la pantalla. */
const cent = (x: unknown) => Math.round((Number(x) || 0) * 100);
/** Los centavos como los quiere el Excel en castellano: «50702,48», «-28925,62». */
const nro = (c: number) => (c / 100).toFixed(2).replace('.', ',');
/** $1.234,50 */
const plata = (c: number) => '$' + n2(c / 100);
/** «2026-10-01» → «1/10/2026», como la fecha de la pantalla. */
const diaCorto = (d: unknown) => { const p = String(d ?? '').split('-'); return p.length === 3 ? Number(p[2]) + '/' + Number(p[1]) + '/' + p[0] : String(d ?? ''); };
/** «2026-10-01» → «octubre 2026». */
export function nombreMes(mes: unknown): string {
  const p = String(mes ?? '').split('-');
  return (MESES[Number(p[1]) - 1] ?? '') + ' ' + (p[0] ?? '');
}

/** Una celda del Excel (igual que celdaCsv de pos.js): lo que parece una fórmula va como texto; un número negativo, no. */
function celda(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s) && isNaN(Number(s)) && !/^-\d+(,\d+)?$/.test(s)) s = "'" + s;
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export type Totales = { tickets: number; notas: number; base: number; iva: number; total: number; sinCae: number };
function sumar(filas: any[]): Totales {
  return filas.reduce((t: Totales, f: any) => {
    t.base += cent(f.base); t.iva += cent(f.iva); t.total += cent(f.total);
    if (f.tipo === 'nc') t.notas++; else t.tickets++;
    if (!f.cae) t.sinCae++;
    return t;
  }, { tickets: 0, notas: 0, base: 0, iva: 0, total: 0, sinCae: 0 });
}

/** El Excel de un local: las columnas de la pantalla, con BOM (los acentos) y separado con «;» (el Excel en castellano). */
export function csvIva(filas: any[]): Uint8Array {
  const t = sumar(filas);
  const renglones = filas.map((f) => {
    const nc = f.tipo === 'nc';
    return [diaCorto(f.dia), f.letra, TIPO[f.tipo] ?? f.tipo, nc ? 'NC-' + f.nc : 'Nº ' + f.numero, nc ? 'Nº ' + f.numero : '',
            f.local ?? '', f.cae ?? '', f.cliente ?? '', CONDICION[f.condicion] ?? f.condicion ?? '', f.doc ? cuit(f.doc) : '',
            nro(cent(f.base)), '0,00', nro(cent(f.iva)), '0,00', '0,00', '0,00', nro(cent(f.total))];
  });
  renglones.push(['Total', '', '', '', '', '', '', '', '', '', nro(t.base), '0,00', nro(t.iva), '0,00', '0,00', '0,00', nro(t.total)]);
  return codificar.encode('﻿' + [COLUMNAS, ...renglones].map((x) => x.map(celda).join(';')).join('\r\n'));
}

export type Resumen = { mes: string; nombre: string; parcial: boolean; locales: { local: string; filas: any[]; t: Totales }[]; t: Totales; cortado: boolean };
/** Lo que contestó la base (pos_iva_mail_preparar), separado por local (por nombre) y sumado. */
export function resumenIva(d: any): Resumen {
  const filas: any[] = Array.isArray(d?.iva?.filas) ? d.iva.filas : [];
  const por = new Map<string, any[]>();
  for (const f of filas) { const k = String(f.local ?? ''); if (!por.has(k)) por.set(k, []); por.get(k)!.push(f); }
  const locales = [...por.entries()].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([local, fs]) => ({ local, filas: fs, t: sumar(fs) }));
  return {
    mes: String(d?.mes ?? ''), nombre: nombreMes(d?.mes),
    /* El mes todavía no terminó (mandado a mano antes de fin de mes): va hasta hoy. */
    parcial: !!d?.hoy && !!d?.hasta && String(d.hoy) <= String(d.hasta),
    locales, t: sumar(filas), cortado: !!d?.iva?.mas,
  };
}

/** El mail, como viaja: el resumen en el cuerpo y un Excel por local adjunto. */
export function mailIva(d: any, c: { desde: string }, para: string): Uint8Array {
  const r = resumenIva(d), hay = r.t.tickets + r.t.notas > 0;
  const hasta = r.parcial ? ' (hasta el ' + diaCorto(d.hoy) + ': el mes no terminó)' : '';
  const sinCae = r.t.sinCae
    ? (r.t.sinCae === 1 ? 'Un comprobante figura' : r.t.sinCae + ' de los ' + (r.t.tickets + r.t.notas) + ' comprobantes figuran') +
      ' sin CAE en el sistema (' + (r.t.sinCae === 1 ? 'no se facturó' : 'no se facturaron') + ' desde acá, o su factura todavía está pendiente): en el Excel tiene' + (r.t.sinCae === 1 ? '' : 'n') + ' la columna CAE vacía.'
    : '';
  const cortado = r.cortado ? 'Son más de 20.000 comprobantes: acá van los primeros 20.000. El resto se baja desde el sistema, local por local.' : '';
  const pie = d?.automatico ? 'Este mail sale solo el 1.º de cada mes, con el IVA Ventas del mes anterior.'
    : 'Lo mandó ' + (d?.persona?.nombre || 'la oficina') + ' desde el sistema.';
  const intro = hay ? 'Va el IVA Ventas de ' + r.nombre + hasta + ' de los locales de VDH: las facturas A y B y las notas de crédito hechas desde el sistema. ' +
      'Adjunto, un Excel por local con el detalle comprobante por comprobante.'
    : 'En ' + r.nombre + hasta + ' no hubo facturas A ni B ni notas de crédito hechas desde el sistema en ningún local.';

  const col = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, Math.max(n, s.length));
  const texto = [
    'Hola:', '', intro, '',
    ...(hay ? [
      ...r.locales.map((l) => col(l.local, 20) + ' ' + l.t.tickets + ' factura' + (l.t.tickets === 1 ? '' : 's') + (l.t.notas ? ' y ' + l.t.notas + ' nota' + (l.t.notas === 1 ? '' : 's') + ' de crédito' : '') +
        ' · base ' + plata(l.t.base) + ' · IVA ' + plata(l.t.iva) + ' · total ' + plata(l.t.total)),
      ...(r.locales.length > 1 ? [col('Total', 20) + ' base ' + plata(r.t.base) + ' · IVA ' + plata(r.t.iva) + ' · total ' + plata(r.t.total)] : []), '',
    ] : []),
    ...(sinCae ? [sinCae, ''] : []), ...(cortado ? [cortado, ''] : []),
    pie, '', 'VDH', 'vdh.com.ar',
  ].join('\r\n');

  const th = 'padding:8px 10px;text-align:right;font-size:12px;color:#6b6259;border-bottom:2px solid #1f1a16;white-space:nowrap;';
  const td = 'padding:8px 10px;text-align:right;border-bottom:1px solid #e6dfd8;white-space:nowrap;';
  const fila = (nombre: string, t: Totales, fuerte: boolean) =>
    '<tr' + (fuerte ? ' style="font-weight:bold;"' : '') + '><td style="' + td + 'text-align:left;">' + esc(nombre) + '</td><td style="' + td + '">' + t.tickets + '</td><td style="' + td + '">' + (t.notas || '—') + '</td>' +
    '<td style="' + td + '">' + plata(t.base) + '</td><td style="' + td + '">' + plata(t.iva) + '</td><td style="' + td + '"><b>' + plata(t.total) + '</b></td></tr>';
  const html = '<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#f6f2ee;">' +
    '<div style="max-width:640px;margin:0 auto;padding:28px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f1a16;">' +
      '<div style="font-size:26px;font-weight:bold;letter-spacing:3px;color:#1f1a16;">VDH</div>' +
      '<div style="height:3px;width:44px;background:#b87333;margin:8px 0 22px;"></div>' +
      '<p style="margin:0 0 6px;font-size:18px;"><b>IVA Ventas · ' + esc(r.nombre) + '</b></p>' +
      '<p style="margin:0 0 18px;">' + esc(intro) + '</p>' +
      (hay ? '<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px;font-size:14px;width:100%;">' +
        '<tr><th style="' + th + 'text-align:left;">Local</th><th style="' + th + '">Facturas</th><th style="' + th + '">Notas de crédito</th>' +
        '<th style="' + th + '">Base imponible</th><th style="' + th + '">IVA 21 %</th><th style="' + th + '">Total</th></tr>' +
        r.locales.map((l) => fila(l.local, l.t, false)).join('') + (r.locales.length > 1 ? fila('Total', r.t, true) : '') + '</table>' : '') +
      (sinCae ? '<p style="margin:0 0 18px;padding:10px 12px;border:1px dashed #1f1a16;font-size:13.5px;">' + esc(sinCae) + '</p>' : '') +
      (cortado ? '<p style="margin:0 0 18px;padding:10px 12px;border:1px dashed #1f1a16;font-size:13.5px;">' + esc(cortado) + '</p>' : '') +
      '<p style="margin:0 0 22px;color:#6b6259;font-size:13.5px;">' + esc(pie) + '</p>' +
      '<p style="margin:0;color:#6b6259;font-size:13.5px;">VDH · <a href="https://vdh.com.ar" style="color:#6b6259;">vdh.com.ar</a></p>' +
    '</div></body></html>';

  const adjuntos: Adjunto[] = r.locales.map((l) => ({ nombre: 'IVA Ventas ' + l.local + ' ' + r.nombre + '.csv', tipo: 'text/csv', bytes: csvIva(l.filas) }));
  return armarMensaje({ desde: c.desde, para, asunto: 'IVA Ventas de ' + r.nombre + (r.parcial ? ' (hasta el ' + diaCorto(d.hoy) + ')' : '') + ' · VDH', texto, html, adjuntos });
}
