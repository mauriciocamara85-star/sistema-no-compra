/**
 * VDH · Sistema No Compra
 * Arma la pestaña Resumen con tres conteos: por sucursal, por vendedor y
 * productos más buscados.
 *
 * Correr a mano desde el editor de Apps Script o desde el menú de la planilla.
 */

function crearResumen() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Falta configurar SHEET_ID. Correr configurar() una vez.');

  const ss = SpreadsheetApp.openById(id);
  const datos = ss.getSheetByName(HOJA);
  if (!datos) throw new Error('No existe la pestaña "' + HOJA + '".');

  // Los datos arrancan justo debajo del encabezado, esté en la fila que esté.
  const inicio = getFilaEncabezado_(datos) + 1;

  let resumen = ss.getSheetByName('Resumen');
  if (!resumen) resumen = ss.insertSheet('Resumen');
  resumen.clear();
  resumen.setTabColor('#e8ff3b');

  const h = function (cell, texto) {
    cell.setValue(texto).setFontWeight('bold').setBackground('#111111').setFontColor('#e8ff3b');
  };

  const sub = function (rango, a, b) {
    resumen.getRange(rango.split(':')[0]).setValue(a);
    resumen.getRange(rango.split(':')[1]).setValue(b);
    resumen.getRange(rango).setFontWeight('bold').setBackground('#222222').setFontColor('#ffffff');
  };

  /** Conteo agrupado por una columna, de mayor a menor. */
  const conteo = function (columna, etiqueta) {
    return '=IFERROR(QUERY(\'' + HOJA + '\'!A' + inicio + ':I,' +
           '"SELECT ' + columna + ', COUNT(A) WHERE ' + columna + ' <> \'\' ' +
           'GROUP BY ' + columna + ' ORDER BY COUNT(A) DESC ' +
           'LABEL ' + columna + ' \'' + etiqueta + '\', COUNT(A) \'Cantidad\'",0),"Sin datos")';
  };

  // ── BLOQUE 1: Por sucursal ──
  h(resumen.getRange('A1'), 'NO COMPRAS POR SUCURSAL');
  sub('A2:B2', 'Sucursal', 'Cantidad');
  resumen.getRange('A3').setFormula(conteo('B', 'Sucursal'));

  // ── BLOQUE 2: Por vendedor ──
  h(resumen.getRange('D1'), 'NO COMPRAS POR VENDEDOR');
  sub('D2:E2', 'Vendedor', 'Cantidad');
  resumen.getRange('D3').setFormula(conteo('C', 'Vendedor'));

  // ── BLOQUE 3: Productos más buscados ──
  h(resumen.getRange('G1'), 'PRODUCTOS MÁS BUSCADOS');
  sub('G2:H2', 'Producto', 'Cantidad');
  resumen.getRange('G3').setFormula(conteo('G', 'Producto'));

  // Formato general
  const anchos = [220, 90, 30, 150, 90, 30, 180, 90];
  anchos.forEach(function (ancho, i) { resumen.setColumnWidth(i + 1, ancho); });

  // getUi() sólo existe cuando se corre desde la planilla, no desde el editor.
  try {
    SpreadsheetApp.getUi().alert('✓ Pestaña Resumen creada correctamente.');
  } catch (err) {
    console.log('Pestaña Resumen creada correctamente.');
  }
}
