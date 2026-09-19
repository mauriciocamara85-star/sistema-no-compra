/**
 * VDH · Sistema No Compra
 * Registro de clientes que se van del local sin encontrar la prenda.
 *
 * Vistas (aplicación web):
 *   ?           → formulario de carga para el vendedor (Index.html)
 *   ?v=panel    → panel de seguimiento de Atención al Cliente (Panel.html)
 *
 * ⚠️ getHtml() y crearResumen() son stubs: existían en el proyecto original
 *    y hay que pegar su código real desde el editor de Apps Script.
 */

// ── Configuración ──────────────────────────────────────────────────────────
const CONFIG = {
  SHEET_ID: '',            // ID de la planilla. Vacío = planilla contenedora.
  HOJA: 'No Compra',       // Nombre exacto de la pestaña.
  TITULO: 'VDH · No Compra',

  // Mail de Atención al Cliente. Vacío = no se envía aviso.
  NOTIFICAR_A: '',

  // Copia al encargado de la sucursal, si está cargado en MAILS_SUCURSAL.
  NOTIFICAR_SUCURSAL: false
};

const COLUMNAS = [
  'Fecha',          // 0
  'Sucursal',       // 1
  'Vendedor',       // 2
  'Nombre',         // 3
  'WhatsApp',       // 4
  'Mail',           // 5
  'Producto',       // 6
  'Talle',          // 7
  'Observaciones',  // 8
  'Estado',         // 9
  'Atendido por',   // 10
  'Fecha contacto'  // 11
];

const ESTADOS = ['Pendiente', 'Contactado', 'Vendido', 'Sin stock', 'No responde'];

/** Mail del encargado por sucursal. Opcional. */
const MAILS_SUCURSAL = {
  // 'MD2 - Mar del Plata Rivadavia': 'rivadavia@vdh.com',
};

// ── Web app ────────────────────────────────────────────────────────────────
function doGet(e) {
  const vista = (e && e.parameter && e.parameter.v) || 'form';
  const archivo = vista === 'panel' ? 'Panel' : 'Index';

  return HtmlService.createHtmlOutputFromFile(archivo)
    .setTitle(CONFIG.TITULO)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

// ── Carga (vendedor) ───────────────────────────────────────────────────────
/**
 * Guarda un registro. Invocado desde Index.html vía google.script.run.
 * @param {Object} data {sucursal, vendedor, nombre, whatsapp, mail, producto, talle, obs}
 * @return {{status: string, msg: string=}}
 */
function submitForm(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    if (!data || !data.sucursal) return { status: 'error', msg: 'Falta la sucursal.' };
    if (!data.whatsapp)          return { status: 'error', msg: 'Falta el WhatsApp.' };
    if (!data.vendedor)          return { status: 'error', msg: 'Falta el vendedor.' };

    const hoja = getHoja_();

    hoja.appendRow([
      new Date(),
      data.sucursal,
      data.vendedor,
      data.nombre   || '',
      normalizarTel_(data.whatsapp),
      data.mail     || '',
      data.producto || '',
      data.talle    || '',
      data.obs      || '',
      'Pendiente',
      '',
      ''
    ]);

    notificar_(data);
    return { status: 'ok' };

  } catch (err) {
    console.error('submitForm: ' + err.stack);
    return { status: 'error', msg: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ── Seguimiento (Atención al Cliente) ──────────────────────────────────────
/**
 * Devuelve los registros para el panel, del más nuevo al más viejo.
 * @param {string} pin
 * @param {string} estado Filtro por estado. 'Todos' trae todo.
 * @return {{status: string, registros: Array<Object>=, msg: string=}}
 */
function getRegistros(pin, estado) {
  if (!verificarPin_(pin)) return { status: 'error', msg: 'PIN incorrecto.' };

  try {
    const hoja = getHoja_();
    const ultima = hoja.getLastRow();
    if (ultima < 2) return { status: 'ok', registros: [] };

    const valores = hoja.getRange(2, 1, ultima - 1, COLUMNAS.length).getValues();
    const tz = Session.getScriptTimeZone();
    const registros = [];

    for (let i = 0; i < valores.length; i++) {
      const f = valores[i];
      const est = f[9] || 'Pendiente';
      if (estado && estado !== 'Todos' && est !== estado) continue;

      registros.push({
        fila:     i + 2,                        // fila real en la planilla
        fecha:    f[0] ? Utilities.formatDate(new Date(f[0]), tz, 'dd/MM/yy HH:mm') : '',
        sucursal: f[1],
        vendedor: f[2],
        nombre:   f[3],
        whatsapp: String(f[4] || ''),
        mail:     f[5],
        producto: f[6],
        talle:    f[7],
        obs:      f[8],
        estado:   est,
        atendido: f[10],
        dias:     f[0] ? Math.floor((Date.now() - new Date(f[0]).getTime()) / 86400000) : 0
      });
    }

    registros.reverse();
    return { status: 'ok', registros: registros };

  } catch (err) {
    console.error('getRegistros: ' + err.stack);
    return { status: 'error', msg: err.message };
  }
}

/**
 * Cambia el estado de un registro y deja constancia de quién y cuándo.
 * @return {{status: string, msg: string=}}
 */
function actualizarEstado(pin, fila, estado, atendidoPor) {
  if (!verificarPin_(pin)) return { status: 'error', msg: 'PIN incorrecto.' };
  if (ESTADOS.indexOf(estado) === -1) return { status: 'error', msg: 'Estado inválido.' };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const hoja = getHoja_();
    if (fila < 2 || fila > hoja.getLastRow()) return { status: 'error', msg: 'Fila inexistente.' };

    hoja.getRange(fila, 10).setValue(estado);
    hoja.getRange(fila, 11).setValue(atendidoPor || '');
    hoja.getRange(fila, 12).setValue(new Date());

    return { status: 'ok' };

  } catch (err) {
    console.error('actualizarEstado: ' + err.stack);
    return { status: 'error', msg: err.message };
  } finally {
    lock.releaseLock();
  }
}

/** Totales por estado, para los contadores del panel. */
function getResumen(pin) {
  if (!verificarPin_(pin)) return { status: 'error', msg: 'PIN incorrecto.' };

  const hoja = getHoja_();
  const ultima = hoja.getLastRow();
  const conteo = { Total: 0 };
  ESTADOS.forEach(function (e) { conteo[e] = 0; });

  if (ultima >= 2) {
    const estados = hoja.getRange(2, 10, ultima - 1, 1).getValues();
    estados.forEach(function (f) {
      const e = f[0] || 'Pendiente';
      if (conteo[e] === undefined) conteo[e] = 0;
      conteo[e]++;
      conteo.Total++;
    });
  }

  return { status: 'ok', conteo: conteo };
}

// ── Aviso por mail ─────────────────────────────────────────────────────────
function notificar_(data) {
  if (!CONFIG.NOTIFICAR_A) return;

  try {
    const destinos = [CONFIG.NOTIFICAR_A];
    if (CONFIG.NOTIFICAR_SUCURSAL && MAILS_SUCURSAL[data.sucursal]) {
      destinos.push(MAILS_SUCURSAL[data.sucursal]);
    }

    const cuerpo =
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111827">' +
      '<h2 style="color:#22C55E;margin:0 0 4px">Nuevo pedido · No Compra</h2>' +
      '<p style="color:#6B7280;margin:0 0 16px">' + esc_(data.sucursal) + '</p>' +
      '<table cellpadding="6" style="border-collapse:collapse">' +
      filaMail_('Cliente',       data.nombre) +
      filaMail_('WhatsApp',      data.whatsapp) +
      filaMail_('Mail',          data.mail) +
      filaMail_('Producto',      data.producto) +
      filaMail_('Talle',         data.talle) +
      filaMail_('Vendedor',      data.vendedor) +
      filaMail_('Observaciones', data.obs) +
      '</table>' +
      '<p style="margin-top:20px">' +
      '<a href="' + linkWhatsapp_(data.whatsapp) + '" ' +
      'style="background:#22C55E;color:#fff;padding:10px 20px;' +
      'text-decoration:none;border-radius:6px;display:inline-block">Escribir por WhatsApp</a>' +
      '</p></div>';

    MailApp.sendEmail({
      to: destinos.join(','),
      subject: 'No Compra · ' + data.sucursal + ' · ' + (data.producto || 'sin producto'),
      htmlBody: cuerpo
    });

  } catch (err) {
    // El aviso nunca debe tumbar la carga del registro.
    console.error('notificar_: ' + err.message);
  }
}

function filaMail_(etiqueta, valor) {
  if (!valor) return '';
  return '<tr><td style="color:#6B7280">' + esc_(etiqueta) + '</td>' +
         '<td style="font-weight:600">' + esc_(valor) + '</td></tr>';
}

// ── Setup de la planilla ───────────────────────────────────────────────────
/**
 * Prepara la hoja: encabezados, desplegable de Estado y colores por estado.
 * Correr una sola vez desde el editor de Apps Script.
 */
function setupHoja() {
  const hoja = getHoja_();

  hoja.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS])
      .setFontWeight('bold').setBackground('#DCFCE7');
  hoja.setFrozenRows(1);

  const rango = hoja.getRange(2, 10, hoja.getMaxRows() - 1, 1);
  rango.setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).build()
  );

  const colores = {
    'Pendiente':   '#FEF3C7',
    'Contactado':  '#DBEAFE',
    'Vendido':     '#DCFCE7',
    'Sin stock':   '#FEE2E2',
    'No responde': '#F3F4F6'
  };

  const reglas = Object.keys(colores).map(function (estado) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(estado)
      .setBackground(colores[estado])
      .setRanges([rango])
      .build();
  });

  hoja.setConditionalFormatRules(reglas);
  hoja.autoResizeColumns(1, COLUMNAS.length);
}

/** Define el PIN del panel. Correr una vez desde el editor, con tu PIN. */
function setPin(pin) {
  PropertiesService.getScriptProperties().setProperty('PANEL_PIN', String(pin));
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getHoja_() {
  const ss = CONFIG.SHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  let hoja = ss.getSheetByName(CONFIG.HOJA);
  if (!hoja) {
    hoja = ss.insertSheet(CONFIG.HOJA);
    hoja.appendRow(COLUMNAS);
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function verificarPin_(pin) {
  const guardado = PropertiesService.getScriptProperties().getProperty('PANEL_PIN');
  if (!guardado) return false;          // sin PIN configurado, el panel queda cerrado
  return String(pin) === guardado;
}

/** Deja el teléfono sólo con dígitos, para que no se rompa el link de WhatsApp. */
function normalizarTel_(tel) {
  return String(tel).replace(/[^\d+]/g, '');
}

/** Arma el link de wa.me agregando el 549 de Argentina si falta. */
function linkWhatsapp_(tel) {
  let n = String(tel).replace(/\D/g, '');
  if (n.indexOf('54') !== 0) n = '549' + n.replace(/^0/, '').replace(/^15/, '');
  return 'https://wa.me/' + n;
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Pendiente de pegar desde el editor de Apps Script ──────────────────────
function getHtml() {
  throw new Error('getHtml(): pegar la implementación real desde Apps Script.');
}

function crearResumen() {
  throw new Error('crearResumen(): pegar la implementación real desde Apps Script.');
}
