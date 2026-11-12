/**
 * Sistema VDH · La factura en PDF, para mandarla por mail (12/11/2026).
 *
 * Es la misma hoja A4 de «Exportar PDF» del ticket (hojaFactura, en pos.js), que copia la que manda BlueSoft por mail:
 * la empresa y el local, la letra con su código, el punto de venta y el número, el cliente, los productos, el «IVA
 * contenido» de la Ley 27.743 (en la B; en la A, el neto y el IVA), los totales, ARCA con el CAE y el QR de la RG 4892.
 * Allá la dibuja el navegador («Imprimir» → «Guardar como PDF»); acá se dibuja a mano, porque el servidor no tiene
 * navegador. SI CAMBIA UNA, CAMBIAR LA OTRA: los mismos datos en los mismos lugares.
 *
 * La del ARCA de prueba lleva la franja «SIN VALOR FISCAL».
 *
 * La nota de crédito (SQL 279, f.clase === 'nota_credito') es la misma hoja con su nombre, su código (003 la A, 008 la B)
 * y la factura que anula: pdfFactura(t, nota.factura). Hoy por mail sale sólo la factura; la hoja ya está lista.
 */
// deno-lint-ignore-file no-explicit-any
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';
import qrcode from 'npm:qrcode-generator@1.4.4';

/* Lo mismo que EMPRESA, MEDIOS_VENTA y CONDICION de pos.js. */
const EMPRESA = { razon: 'Black Fish SRL', cuit: '30715597523', iibb: '30-71559752-3', inicio: '14/03/2017', iva: 'Responsable Inscripto', web: 'vdh.com.ar' };
const MEDIOS: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', mercadopago: 'Mercado Pago', modo: 'MODO', go_cuotas: 'Go Cuotas',
  transferencia: 'Transferencia', giftcard: 'Gift card',
};
const CONDICION: Record<string, string> = {
  consumidor_final: 'Consumidor final', responsable_inscripto: 'Responsable inscripto', monotributo: 'Monotributo', exento: 'Exento',
};

/** 1234.5 → «1.234,50» (a mano: no depende del idioma que tenga cargado el servidor). */
export function n2(x: unknown): string {
  const n = Math.round((Number(x) || 0) * 100) / 100;
  const [e, d] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + e.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d;
}
/** '20261111' o '2026-11-11' → '11/11/2026'. */
export function fechaLarga(s: unknown): string {
  const d = String(s ?? '').replace(/\D/g, '');
  return d.length === 8 ? d.slice(6, 8) + '/' + d.slice(4, 6) + '/' + d.slice(0, 4) : String(s ?? '');
}
export function cuit(d: unknown): string {
  const s = String(d ?? '');
  return s.length === 11 ? s.slice(0, 2) + '-' + s.slice(2, 10) + '-' + s.slice(10) : s;
}
/** «B 00034-00000002», como compArca de pos.js. */
export function comprobante(f: any): string {
  const pv = ('0000' + String(f?.punto_venta ?? '').replace(/\D/g, '')).slice(-5);
  const n = String(f?.numero ?? '').replace(/\D/g, '');
  return (f?.tipo || '') + ' ' + pv + '-' + ('0000000' + n).slice(-Math.max(8, n.length));
}

/** El documento del cliente como se le mandó a ARCA (SQL 276 lo guarda en la factura) o, si no está, con la misma regla. */
function docArca(t: any, f: any): { tipo: number; nro: string } {
  if (f?.doc_tipo) return { tipo: Number(f.doc_tipo), nro: String(f.doc_nro || '0') };
  const d = String(t.cliente_doc || '').replace(/\D/g, '');
  return d.length === 11 ? { tipo: 80, nro: d } : d.length >= 7 && d.length <= 8 ? { tipo: 96, nro: d } : { tipo: 99, nro: '0' };
}
function fechaIso(s: unknown): string {
  const d = String(s ?? '').replace(/\D/g, '');
  return d.length === 8 ? d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6) : '';
}
/** El enlace del QR de ARCA (RG 4892), igual que qrArca de pos.js. Sin el CUIT que facturó, no hay QR. */
export function qrArca(t: any, f: any): string {
  const e = String(f.cuit || '').replace(/\D/g, ''), d = docArca(t, f), fe = fechaIso(f.fecha);
  if (e.length !== 11 || !fe || !f.numero || !/^\d{14}$/.test(String(f.cae))) return '';
  const j = {
    ver: 1, fecha: fe, cuit: Number(e), ptoVta: Number(f.punto_venta),
    tipoCmp: f.clase === 'nota_credito' ? (f.tipo === 'A' ? 3 : 8) : (f.tipo === 'A' ? 1 : 6), nroCmp: Number(f.numero),
    importe: Number(f.importe != null ? f.importe : t.total), moneda: 'PES', ctz: 1, tipoDocRec: d.tipo, nroDocRec: Number(d.nro) || 0,
    tipoCodAut: 'E', codAut: Number(f.cae),
  };
  return 'https://www.afip.gob.ar/fe/qr/?p=' + btoa(JSON.stringify(j));
}

const MM = 72 / 25.4;                 // un milímetro, en puntos
const ANCHO = 595.28, ALTO = 841.89;  // A4
const MARGEN = 12 * MM;
const NEGRO = rgb(0, 0, 0), AZUL = rgb(0x1f / 255, 0x2a / 255, 0x5a / 255);

/** t: la venta como la da pos_venta. de: el comprobante a dibujar; si falta, la factura de la venta. */
export async function pdfFactura(t: any, de?: any): Promise<Uint8Array> {
  const f = de ?? t?.factura;
  if (!f || !f.cae) throw new Error('La venta no tiene factura electrónica.');
  const nc = f.clase === 'nota_credito', an = nc && f.anula && f.anula.numero ? f.anula : null;
  const clase = nc ? 'Nota de crédito ' : 'Factura ';
  const pdf = await PDFDocument.create();
  const comp = comprobante(f);
  pdf.setTitle(clase + comp);
  pdf.setAuthor(EMPRESA.razon);
  pdf.setSubject(clase + comp);
  pdf.setProducer('Sistema VDH');
  pdf.setCreator('Sistema VDH');
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negra = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cursiva = await pdf.embedFont(StandardFonts.HelveticaOblique);

  /* Las letras de estas fuentes son las de Windows-1252: lo que no entra (un emoji, una letra rara pegada de otro lado)
     se cambia por «?», en vez de que falle el PDF entero. */
  const letras = new Set<number>(normal.getCharacterSet());
  const limpio = (s: unknown): string => {
    let r = '';
    for (const ch of String(s ?? '').replace(/\s+/g, ' ').trim()) r += letras.has(ch.codePointAt(0)!) ? ch : '?';
    return r;
  };
  const ancho = (s: string, fu: PDFFont, tam: number) => fu.widthOfTextAtSize(s, tam);
  /** El texto que entra en ese ancho; si no entra, se corta con «…». */
  const entra = (s: string, fu: PDFFont, tam: number, max: number): string => {
    if (ancho(s, fu, tam) <= max) return s;
    let r = s;
    while (r.length > 1 && ancho(r + '…', fu, tam) > max) r = r.slice(0, -1);
    return r.trimEnd() + '…';
  };

  let pag: PDFPage = pdf.addPage([ANCHO, ALTO]);
  /* y se cuenta desde arriba (como en la pantalla); pdf-lib cuenta desde abajo. */
  const texto = (s: unknown, x: number, y: number, o: { tam?: number; fu?: PDFFont; der?: boolean; centro?: boolean; max?: number; color?: any } = {}) => {
    const tam = o.tam ?? 9.5, fu = o.fu ?? normal;
    let v = limpio(s);
    if (o.max) v = entra(v, fu, tam, o.max);
    const a = ancho(v, fu, tam);
    pag.drawText(v, { x: o.der ? x - a : o.centro ? x - a / 2 : x, y: ALTO - y, size: tam, font: fu, color: o.color ?? NEGRO });
    return a;
  };
  const linea = (x1: number, y1: number, x2: number, y2: number, grosor = 0.75) =>
    pag.drawLine({ start: { x: x1, y: ALTO - y1 }, end: { x: x2, y: ALTO - y2 }, thickness: grosor, color: NEGRO });
  const caja = (x: number, y: number, w: number, h: number, o: { blanco?: boolean; rayas?: boolean; grosor?: number } = {}) =>
    pag.drawRectangle({
      x, y: ALTO - y - h, width: w, height: h, borderColor: NEGRO, borderWidth: o.grosor ?? 0.75,
      color: o.blanco ? rgb(1, 1, 1) : undefined, borderDashArray: o.rayas ? [4, 3] : undefined,
    });

  const izq = MARGEN, der = ANCHO - MARGEN, largo = der - izq, medio = ANCHO / 2;
  const deP = f.ambiente === 'homologacion', esA = f.tipo === 'A';
  const fe = fechaLarga(f.fecha);
  const pv = ('000' + String(f.punto_venta ?? '').replace(/\D/g, '')).slice(-4), nro = ('0000000' + String(f.numero)).slice(-8);
  const d = docArca(t, f);
  const docTxt = d.tipo === 80 ? 'CUIT: ' + cuit(d.nro) : d.tipo === 96 ? 'DNI: ' + d.nro : 'CUIT:';
  const medios: string[] = [];
  for (const g of (t.pagos ?? [])) if (g?.medio && !medios.includes(g.medio)) medios.push(g.medio);
  const forma = medios.length > 1 ? 'Múltiple' : medios.length ? (MEDIOS[medios[0]] || medios[0]) : '';
  const total = Number(t.total) || 0, neto = Math.round(total / 1.21 * 100) / 100, iva = Math.round((total - neto) * 100) / 100;

  let y = MARGEN;

  /* La franja del comprobante de prueba. */
  if (deP) {
    caja(izq, y, largo, 7.5 * MM, { rayas: true, grosor: 1.2 });
    texto('COMPROBANTE DE PRUEBA · lo aprobó el ARCA de prueba (homologación) · SIN VALOR FISCAL', medio, y + 5 * MM, { fu: negra, tam: 9, centro: true });
    y += 10.5 * MM;
  }

  /* La cabecera: la empresa a la izquierda, el comprobante a la derecha y la letra en el medio. */
  const altoCab = 36 * MM;
  caja(izq, y, largo, altoCab);
  linea(medio, y, medio, y + altoCab);
  const lado = 14 * MM;
  caja(medio - lado / 2, y, lado, lado, { blanco: true });
  texto(f.tipo || '', medio, y + 8.6 * MM, { fu: negra, tam: 20, centro: true });
  texto('COD. ' + (nc ? (esA ? '003' : '008') : esA ? '001' : '006'), medio, y + 12 * MM, { tam: 5.5, centro: true });

  const xe = izq + 4 * MM, anchoLado = medio - lado / 2 - xe - 2 * MM;
  let ye = y + 10 * MM;
  texto(EMPRESA.razon, xe, ye, { tam: 19, max: anchoLado });
  ye += 7 * MM;
  for (const r of [f.domicilio, f.localidad, EMPRESA.web, 'Condición frente al IVA: ' + EMPRESA.iva]) {
    if (!r) continue;
    texto(r, xe, ye, { max: medio - xe - 3 * MM });
    ye += 4.9 * MM;
  }
  const xc = medio + 12 * MM;
  let yc = y + 9 * MM;
  texto(nc ? 'Nota de Crédito' : 'Factura', xc, yc, { fu: negra, tam: 17 });
  yc += 5.5 * MM;
  texto('Punto de Venta: ' + pv, xc, yc);
  yc += 5.3 * MM;
  texto('Número Comprobante: ' + nro, xc, yc, { fu: negra, tam: 12 });
  yc += 5 * MM;
  texto('Fecha: ' + fe, xc, yc);
  texto('CUIT: ' + cuit(EMPRESA.cuit), der - 4 * MM, yc, { der: true });
  yc += 4.9 * MM;
  texto('Ingresos Brutos: ' + EMPRESA.iibb, xc, yc);
  yc += 4.9 * MM;
  texto('Inicio de Actividades: ' + EMPRESA.inicio, xc, yc);
  y += altoCab;

  /* El cliente. */
  y += 10 * MM;
  texto('Cliente: ' + (t.cliente_nombre || 'Consumidor final'), xe, y, { max: medio - xe - 4 * MM });
  texto('Condición frente al IVA: ' + (CONDICION[t.cliente_condicion] || 'Consumidor final'), medio + 3 * MM, y, { max: der - medio - 5 * MM });
  y += 5.7 * MM;
  texto(docTxt, xe, y);
  texto('Forma de Pago: ' + forma, medio + 3 * MM, y, { max: der - medio - 5 * MM });
  y += 5.7 * MM;
  texto('Condición de Pago: No Aplica', medio + 3 * MM, y);

  /* El vencimiento, en su recuadro a la derecha. */
  y += 6 * MM;
  const vto = 'Fecha de vencimiento: ' + fe, anchoVto = ancho(vto, normal, 9.5) + 10 * MM;
  caja(der - anchoVto, y, anchoVto, 8 * MM);
  texto(vto, der - anchoVto / 2, y + 5.2 * MM, { centro: true });
  if (an) {   // la nota de crédito dice qué factura anula, a la izquierda del vencimiento
    texto('Comprobante asociado: Factura ' + comprobante(an) + (fechaIso(an.fecha) ? ' del ' + fechaLarga(an.fecha) : ''), xe, y + 5.2 * MM,
      { max: der - anchoVto - xe - 4 * MM });
  }
  y += 13 * MM;

  /* Los productos. Las columnas, como las de BlueSoft. */
  const col = { cant: izq + 20 * MM, prod: izq + 22 * MM, desc: izq + 46 * MM, um: izq + 130 * MM, precio: izq + 160 * MM, total: der };
  const titulos = () => {
    linea(izq, y, der, y);
    texto('Cantidad', col.cant, y + 3.6 * MM, { fu: negra, tam: 8, der: true });
    texto('Producto', col.prod, y + 3.6 * MM, { fu: negra, tam: 8 });
    texto('Descripción', col.desc, y + 3.6 * MM, { fu: negra, tam: 8 });
    texto('UM', col.um, y + 3.6 * MM, { fu: negra, tam: 8 });
    texto('Precio', col.precio, y + 3.6 * MM, { fu: negra, tam: 8, der: true });
    texto('Total', col.total, y + 3.6 * MM, { fu: negra, tam: 8, der: true });
    y += 5.2 * MM;
    linea(izq, y, der, y);
    y += 4 * MM;
  };
  titulos();
  type Fila = { cant?: string; prod?: string; desc: string; um?: string; precio?: string; total: string };
  const filas: Fila[] = [];
  for (const i of (t.items ?? [])) {
    filas.push({ cant: n2(i.cantidad), prod: String(i.codigo || ''), desc: String(i.descripcion || ''), um: 'UN', precio: n2(i.precio), total: n2(i.total) });
  }
  for (const x of (t.descuentos_detalle ?? [])) filas.push({ desc: String(x.descripcion || ''), total: '-' + n2(x.monto) });
  if (Number(t.interes)) filas.push({ desc: String(t.interes_nota || 'Interés de las cuotas'), total: n2(t.interes) });

  /* Lo de abajo (la ley, los totales y ARCA) va pegado al pie de la última hoja: ocupa 62 mm. */
  const altoPie = 62 * MM, renglon = 4.4 * MM;
  /** Cuántos renglones entran desde y hasta ese tope. */
  const entran = (tope: number) => (y > tope ? 0 : Math.floor((tope - y) / renglon) + 1);
  let i = 0;
  while (i < filas.length) {
    const quedan = filas.length - i;
    const conPie = entran(ALTO - MARGEN - altoPie - 4 * MM), sinPie = entran(ALTO - MARGEN - 2 * MM);
    /* Si lo que queda entra arriba del pie, va todo acá. Si no, la hoja se llena hasta abajo y sigue en otra. */
    const n = quedan <= conPie ? quedan : Math.min(quedan, sinPie);
    for (const r of filas.slice(i, i + n)) {
      if (r.cant) texto(r.cant, col.cant, y, { tam: 8.5, der: true });
      if (r.prod) texto(r.prod, col.prod, y, { tam: 8.5, max: col.desc - col.prod - 2 * MM });
      texto(r.desc, col.desc, y, { tam: 8.5, max: col.um - col.desc - 3 * MM });
      if (r.um) texto(r.um, col.um, y, { tam: 8.5 });
      if (r.precio) texto(r.precio, col.precio, y, { tam: 8.5, der: true });
      texto(r.total, col.total, y, { tam: 8.5, der: true });
      y += renglon;
    }
    i += n;
    if (quedan > conPie) {   // esta hoja quedó sin lugar para el pie: otra hoja (con los títulos, si siguen productos)
      pag = pdf.addPage([ANCHO, ALTO]);
      y = MARGEN + 4 * MM;
      if (i < filas.length) titulos();
    }
  }

  /* El pie. A la izquierda, la Ley 27.743 (en la B); a la derecha, los totales. */
  let yp = ALTO - MARGEN - altoPie;
  const xt = der - 72 * MM;
  if (!esA) {
    linea(izq, yp, xt - 8 * MM, yp);
    texto('Régimen de Transparencia Fiscal al Consumidor (Ley 27.743):', izq, yp + 4.4 * MM, { tam: 8.5 });
    linea(izq, yp + 5 * MM, izq + ancho('Régimen de Transparencia Fiscal al Consumidor (Ley 27.743):', normal, 8.5), yp + 5 * MM, 0.4);
    texto('IVA contenido: $ ' + n2(iva), izq, yp + 9.2 * MM, { tam: 8.5 });
    linea(izq, yp + 12 * MM, xt - 8 * MM, yp + 12 * MM);
  }
  let yt = yp + 4 * MM;
  const renglonTotal = (rot: string, val: string, tam = 9.5) => {
    texto(rot, xt, yt, { tam });
    texto(val, der, yt, { tam, der: true });
    yt += 5.6 * MM;
  };
  if (esA) {
    renglonTotal('Neto gravado: $', n2(neto));
    renglonTotal('IVA 21 %: $', n2(iva));
  } else {
    renglonTotal('Neto: $', n2(total));
  }
  yt += 1 * MM;
  linea(xt, yt - 3.6 * MM, der, yt - 3.6 * MM);
  yt += 3.4 * MM;
  renglonTotal('Total: $', n2(total), 14);

  /* ARCA: la marca, «Comprobante Autorizado», el CAE con su vencimiento y el QR. */
  const ya = ALTO - MARGEN - 30 * MM;
  texto('ARCA', izq, ya + 15.5 * MM, { fu: negra, tam: 32, color: AZUL });
  texto('AGENCIA DE RECAUDACIÓN Y CONTROL ADUANERO', izq + 0.4 * MM, ya + 18.8 * MM, { fu: negra, tam: 4.6, color: AZUL });
  const xa = izq + 57 * MM;
  texto(deP ? 'Comprobante de prueba (sin valor fiscal)' : 'Comprobante Autorizado', xa, ya + 13 * MM, { fu: cursiva, tam: 13 });
  texto('CAE: ' + f.cae + '   VENCIMIENTO: ' + fechaLarga(f.cae_vence), xa, ya + 19.5 * MM, { tam: 8 });

  const url = qrArca(t, f);
  if (url) {
    const q = qrcode(0, 'M');
    q.addData(url);
    q.make();
    const n = q.getModuleCount(), ladoQr = 30 * MM, m = ladoQr / n, x0 = der - ladoQr, y0 = ya;
    for (let r = 0; r < n; r++) {
      /* Las celdas seguidas de un renglón van en un solo rectángulo: el PDF pesa menos y no quedan rayitas blancas. */
      for (let c = 0; c < n; c++) {
        if (!q.isDark(r, c)) continue;
        let fin = c;
        while (fin + 1 < n && q.isDark(r, fin + 1)) fin++;
        pag.drawRectangle({ x: x0 + c * m, y: ALTO - (y0 + (r + 1) * m), width: (fin - c + 1) * m + 0.05, height: m + 0.05, color: NEGRO });
        c = fin;
      }
    }
  }

  return await pdf.save();
}
