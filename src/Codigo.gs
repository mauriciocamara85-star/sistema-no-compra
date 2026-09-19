/**
 * VDH · Sistema No Compra
 * Registro de clientes que se van del local sin encontrar la prenda.
 *
 * Vistas (aplicación web):
 *   ?           → formulario de carga para el vendedor (Index.html)
 *   ?v=panel    → panel de seguimiento de Atención al Cliente (Panel.html)
 *
 * IMPORTANTE SOBRE LA PLANILLA
 * La hoja 'No Compra' tiene 22 columnas en uso: A-I las carga el vendedor
 * desde el formulario, y J-V las completa Atención al Cliente a mano durante
 * el seguimiento. Nunca escribir en J-V sin saber qué había: son datos vivos.
 * La fila de encabezados se detecta sola con getFilaEncabezado_(), así que el
 * código no se rompe si la planilla arranca en otra fila.
 */

// ── Configuración ──────────────────────────────────────────────────────────
// El ID de la planilla, el PIN y el mail de avisos viven en las propiedades
// del script, NO en el repo, porque el repo es público.
//
// Se cargan a mano una sola vez desde el editor de Apps Script, en
// Configuración del proyecto → Propiedades de la secuencia de comandos:
//   SHEET_ID      ID de la planilla
//   PANEL_PIN     PIN de Atención al Cliente
//   NOTIFICAR_A   mail que recibe el aviso (vacío = sin aviso)

const HOJA = 'No Compra';
const TZ = 'America/Argentina/Buenos_Aires';
const FORMATO_FECHA = 'dd/MM/yyyy HH:mm';

/** Posición de cada columna (0 = A). Refleja la planilla real. */
const COL = {
  FECHA:        0,   // A
  SUCURSAL:     1,   // B
  VENDEDOR:     2,   // C
  NOMBRE:       3,   // D
  WHATSAPP:     4,   // E
  MAIL:         5,   // F
  PRODUCTO:     6,   // G
  TALLE:        7,   // H
  OBS:          8,   // I
  // ── de acá en adelante lo completa Atención al Cliente ──
  CONTACTAMOS:  9,   // J  Nos contactamos?
  AL_WHAT:     10,   // K  Agregado al What
  RESPONSABLE: 11,   // L  Responsable Seguim.
  FECHA_1:     12,   // M  Fecha 1er Contacto
  RESULTADO_1: 13,   // N  Resultado 1er Contacto
  FECHA_2:     14,   // O  Fecha 2do Contacto
  CANAL_2:     15,   // P  Canal 2do Contacto
  RESULTADO_2: 16,   // Q  Resultado 2do Contacto
  ESTADO:      17,   // R  Estado Actual
  OBS_SEGUIM:  18,   // S  Observaciones Seguim.
  COMPRO:      19,   // T  Compró?
  PROD_FINAL:  20,   // U  Producto Final
  MONTO:       21    // V  Monto Venta ($)
};

const ANCHO = 22;  // columnas A-V

/** Vocabulario real, tomado de lo que ya cargó el equipo. No inventar valores. */
const VOCAB = {
  CONTACTAMOS: ['si', 'no'],
  RESULTADO_1: ['Respondió - interesado', 'Respondió - no interesado', 'No respondió'],
  ESTADO:      ['En seguimiento', 'Esperando respuesta', 'Cerrado - compró',
                'Cerrado - no compró', 'Descartado'],
  COMPRO:      ['Sí - local', 'Sí - online', 'No']
};

/**
 * Alternativa por código a cargar las propiedades a mano. Desde el editor no
 * se le pueden pasar argumentos, así que sirve sobre todo llamada desde otra
 * función o desde clasp.
 */
function configurar(sheetId, pin, mailAvisos) {
  const props = PropertiesService.getScriptProperties();
  if (sheetId)   props.setProperty('SHEET_ID', sheetId);
  if (pin)       props.setProperty('PANEL_PIN', String(pin));
  if (mailAvisos !== undefined) props.setProperty('NOTIFICAR_A', mailAvisos);
  return 'Configuración guardada.';
}

// ── Web app ────────────────────────────────────────────────────────────────
function doGet(e) {
  const vista = (e && e.parameter && e.parameter.v) || 'form';
  const archivo = vista === 'panel' ? 'Panel' : 'Index';

  return HtmlService.createHtmlOutputFromFile(archivo)
    .setTitle('VDH · No Compra')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Carga (vendedor) ───────────────────────────────────────────────────────
/**
 * Guarda un registro. Escribe únicamente A-I; J en adelante queda vacío para
 * que lo complete Atención al Cliente.
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
    const fecha = Utilities.formatDate(new Date(), TZ, FORMATO_FECHA);

    hoja.appendRow([
      fecha,
      data.sucursal || '',
      data.vendedor || '',
      data.nombre   || '',
      data.whatsapp || '',
      data.mail     || '',
      data.producto || '',
      data.talle    || '',
      data.obs      || ''
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
 * @param {string} filtro 'Pendiente' | uno de VOCAB.ESTADO | 'Todos'
 */
function getRegistros(pin, filtro) {
  if (!verificarPin_(pin)) return { status: 'error', msg: 'PIN incorrecto.' };

  try {
    const hoja = getHoja_();
    const inicio = getFilaEncabezado_(hoja) + 1;
    const ultima = hoja.getLastRow();
    if (ultima < inicio) return { status: 'ok', registros: [] };

    const ancho = Math.min(ANCHO, hoja.getLastColumn());
    const valores = hoja.getRange(inicio, 1, ultima - inicio + 1, ancho).getValues();
    const registros = [];

    for (let i = 0; i < valores.length; i++) {
      const f = valores[i];
      if (!f[COL.FECHA] && !f[COL.WHATSAPP]) continue;   // fila vacía

      const estado = String(f[COL.ESTADO] || '').trim();
      const contactado = String(f[COL.CONTACTAMOS] || '').trim().toLowerCase() === 'si';

      // 'Pendiente' no es un estado de la planilla: es "todavía nadie lo tocó".
      if (filtro === 'Pendiente') {
        if (estado || contactado) continue;
      } else if (filtro && filtro !== 'Todos' && estado !== filtro) {
        continue;
      }

      const fecha = parseFecha_(f[COL.FECHA]);
      registros.push({
        fila:        inicio + i,
        fecha:       String(f[COL.FECHA] || ''),
        dias:        fecha ? Math.floor((Date.now() - fecha.getTime()) / 86400000) : null,
        sucursal:    String(f[COL.SUCURSAL] || ''),
        vendedor:    String(f[COL.VENDEDOR] || ''),
        nombre:      String(f[COL.NOMBRE] || ''),
        whatsapp:    String(f[COL.WHATSAPP] || ''),
        mail:        String(f[COL.MAIL] || ''),
        producto:    String(f[COL.PRODUCTO] || ''),
        talle:       String(f[COL.TALLE] || ''),
        obs:         String(f[COL.OBS] || ''),
        contactamos: String(f[COL.CONTACTAMOS] || ''),
        responsable: String(f[COL.RESPONSABLE] || ''),
        fecha1:      String(f[COL.FECHA_1] || ''),
        resultado1:  String(f[COL.RESULTADO_1] || ''),
        estado:      estado,
        obsSeguim:   String(f[COL.OBS_SEGUIM] || ''),
        compro:      String(f[COL.COMPRO] || '')
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
 * Escribe el seguimiento de un registro. Sólo toca las celdas que vienen en
 * `campos`; lo que no viene, no se pisa.
 * @param {Object} campos {contactamos, responsable, fecha1, resultado1, estado, obsSeguim, compro}
 */
function guardarSeguimiento(pin, fila, campos) {
  if (!verificarPin_(pin)) return { status: 'error', msg: 'PIN incorrecto.' };
  if (!campos) return { status: 'error', msg: 'Nada para guardar.' };

  const invalido = validarVocab_(campos);
  if (invalido) return { status: 'error', msg: invalido };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const hoja = getHoja_();
    const inicio = getFilaEncabezado_(hoja) + 1;
    if (fila < inicio || fila > hoja.getLastRow()) {
      return { status: 'error', msg: 'Fila inexistente.' };
    }

    const mapa = [
      ['contactamos', COL.CONTACTAMOS],
      ['responsable', COL.RESPONSABLE],
      ['fecha1',      COL.FECHA_1],
      ['resultado1',  COL.RESULTADO_1],
      ['estado',      COL.ESTADO],
      ['obsSeguim',   COL.OBS_SEGUIM],
      ['compro',      COL.COMPRO]
    ];

    mapa.forEach(function (par) {
      const valor = campos[par[0]];
      if (valor === undefined) return;               // no vino, no se toca
      hoja.getRange(fila, par[1] + 1).setValue(valor);
    });

    return { status: 'ok' };

  } catch (err) {
    console.error('guardarSeguimiento: ' + err.stack);
    return { status: 'error', msg: err.message };
  } finally {
    lock.releaseLock();
  }
}

/** Totales para los contadores del panel. */
function getResumenPanel(pin) {
  if (!verificarPin_(pin)) return { status: 'error', msg: 'PIN incorrecto.' };

  const hoja = getHoja_();
  const inicio = getFilaEncabezado_(hoja) + 1;
  const ultima = hoja.getLastRow();
  const conteo = { Total: 0, Pendiente: 0 };
  VOCAB.ESTADO.forEach(function (e) { conteo[e] = 0; });

  if (ultima >= inicio) {
    const ancho = Math.min(ANCHO, hoja.getLastColumn());
    const v = hoja.getRange(inicio, 1, ultima - inicio + 1, ancho).getValues();
    v.forEach(function (f) {
      if (!f[COL.FECHA] && !f[COL.WHATSAPP]) return;
      conteo.Total++;
      const estado = String(f[COL.ESTADO] || '').trim();
      const contactado = String(f[COL.CONTACTAMOS] || '').trim().toLowerCase() === 'si';
      if (!estado && !contactado) { conteo.Pendiente++; return; }
      if (conteo[estado] === undefined) conteo[estado] = 0;
      if (estado) conteo[estado]++;
    });
  }

  return { status: 'ok', conteo: conteo, vocab: VOCAB };
}

// ── Aviso por mail ─────────────────────────────────────────────────────────
function notificar_(data) {
  const destino = PropertiesService.getScriptProperties().getProperty('NOTIFICAR_A');
  if (!destino) return;

  try {
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
      to: destino,
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

// ── Helpers ────────────────────────────────────────────────────────────────
function getHoja_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Falta configurar SHEET_ID. Correr configurar() una vez.');

  const hoja = SpreadsheetApp.openById(id).getSheetByName(HOJA);
  if (!hoja) throw new Error('No existe la pestaña "' + HOJA + '".');
  return hoja;
}

/**
 * Ubica la fila de encabezados buscando 'Fecha' en la columna A.
 * Evita hardcodear una fila que puede moverse.
 */
function getFilaEncabezado_(hoja) {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get('FILA_ENC');
  if (guardado) return Number(guardado);

  const tope = Math.min(10, hoja.getLastRow());
  const col = hoja.getRange(1, 1, tope, 1).getValues();
  for (let i = 0; i < col.length; i++) {
    if (String(col[i][0]).trim().toLowerCase() === 'fecha') {
      cache.put('FILA_ENC', String(i + 1), 21600);   // 6 h
      return i + 1;
    }
  }
  throw new Error('No encontré la fila de encabezados (celda con "Fecha" en la columna A).');
}

function validarVocab_(campos) {
  const chequeos = [
    ['contactamos', VOCAB.CONTACTAMOS],
    ['resultado1',  VOCAB.RESULTADO_1],
    ['estado',      VOCAB.ESTADO],
    ['compro',      VOCAB.COMPRO]
  ];
  for (let i = 0; i < chequeos.length; i++) {
    const clave = chequeos[i][0];
    const valor = campos[clave];
    if (valor === undefined || valor === '') continue;
    if (chequeos[i][1].indexOf(valor) === -1) {
      return 'Valor no permitido en ' + clave + ': ' + valor;
    }
  }
  return null;
}

/** Las fechas se guardan como texto dd/MM/yyyy HH:mm. Devuelve Date o null. */
function parseFecha_(v) {
  if (v instanceof Date) return v;
  const m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
}

/** Arma el link de wa.me. Los números se cargan como área + número, sin 0. */
function linkWhatsapp_(tel) {
  let n = String(tel).replace(/\D/g, '').replace(/^0/, '');
  if (n.indexOf('54') !== 0) n = '549' + n;
  return 'https://wa.me/' + n;
}

function verificarPin_(pin) {
  const guardado = PropertiesService.getScriptProperties().getProperty('PANEL_PIN');
  if (!guardado) return false;          // sin PIN configurado, el panel queda cerrado
  return String(pin) === guardado;
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
