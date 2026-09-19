/**
 * VDH · Sistema No Compra
 * Registro de clientes que se van del local sin encontrar la prenda.
 *
 * ⚠️ RECONSTRUCCIÓN PARCIAL
 * Este archivo fue reconstruido a partir del contrato que usa el formulario
 * publicado (Index.html). Reproduce fielmente doGet() y submitForm(), pero
 * getHtml() y crearResumen() son stubs: hay que pegar el código real desde
 * el editor de Apps Script para reemplazarlos.
 */

// ── Configuración ──────────────────────────────────────────────────────────
const CONFIG = {
  SHEET_ID: '',           // ID de la planilla. Vacío = usa la planilla contenedora.
  HOJA: 'No Compra',      // Nombre exacto de la pestaña.
  TITULO: 'VDH · No Compra'
};

// Orden de las columnas en la planilla. Debe coincidir con el encabezado real.
const COLUMNAS = [
  'Fecha',
  'Sucursal',
  'Vendedor',
  'Nombre',
  'WhatsApp',
  'Mail',
  'Producto',
  'Talle',
  'Observaciones',
  'Estado'
];

// ── Web app ────────────────────────────────────────────────────────────────
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(CONFIG.TITULO)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Guarda un registro. Invocado desde el cliente vía google.script.run.
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
      'Pendiente'
    ]);

    return { status: 'ok' };

  } catch (e) {
    console.error('submitForm: ' + e.stack);
    return { status: 'error', msg: e.message };
  } finally {
    lock.releaseLock();
  }
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

/** Deja el teléfono sólo con dígitos, para que no se rompa el link de WhatsApp. */
function normalizarTel_(tel) {
  return String(tel).replace(/[^\d+]/g, '');
}

// ── Pendiente de pegar desde el editor de Apps Script ──────────────────────
function getHtml() {
  throw new Error('getHtml(): pegar la implementación real desde Apps Script.');
}

function crearResumen() {
  throw new Error('crearResumen(): pegar la implementación real desde Apps Script.');
}
