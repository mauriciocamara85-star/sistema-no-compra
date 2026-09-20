/**
 * VDH · Sistema No Compra — equipo, objetivos e historial
 *
 * Tres pestañas nuevas en la misma planilla:
 *
 *   Equipo      Local · Vendedor · Activo · Agregado · Por
 *   Objetivos   Local · Período · Meta
 *   Log         Fecha · Acción · Local · Detalle · Quién
 *
 * ── Por qué esto no tiene PIN ─────────────────────────────────────────────
 * El panel sí lo tiene, porque ahí están los teléfonos de los clientes. Acá
 * no hay datos de nadie: hay nombres de vendedores y números de objetivo. Una
 * puerta en el medio haría que cada local tenga que pedir una clave para algo
 * que necesita hacer una sola vez, y este sistema ya se murió una vez por
 * fricción.
 *
 * En lugar de una puerta hay un HISTORIAL: todo lo que se agrega, desactiva o
 * cambia queda anotado con quién y cuándo. Si un día aparece un local sin
 * vendedores, se ve qué pasó y se restaura. Es la diferencia entre impedir el
 * error y poder deshacerlo, y para este caso lo segundo cuesta menos y sirve
 * más.
 */

const HOJA_EQUIPO = 'Equipo';
const HOJA_OBJETIVOS = 'Objetivos';
const HOJA_LOG = 'Log';

/** Períodos válidos para un objetivo. */
const PERIODOS = ['dia', 'semana', 'mes'];

/**
 * Los 14 locales, iguales a los de la app de Ranking VDH.
 *
 * Sí, esta lista también está en index.html. La copia de allá existe para que
 * el formulario pueda elegir local SIN CONEXIÓN, que es media razón de ser de
 * esta app; la de acá es para que la pantalla de configuración sepa qué
 * ofrecer. Cuando la pestaña Equipo tenga datos, ella manda: acá esto queda
 * sólo como semilla del primer día.
 */
const LOCALES_BASE = [
  'CASEROS', 'DOT', 'FLORES', 'GRAND BOURG', 'ITUZAINGÓ', 'LOMAS DE ZAMORA',
  'MORÓN', 'PACHECO', 'PARQUE BROWN', 'RIVADAVIA', 'SAN JUSTO 1',
  'SAN JUSTO SHOPPING', 'UNICENTER', 'VILLA DEL PARQUE'
];

// ── Acceso a la planilla ───────────────────────────────────────────────────
function getLibro_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Falta configurar SHEET_ID.');
  return SpreadsheetApp.openById(id);
}

/**
 * Devuelve la pestaña, creándola con sus encabezados si no existe.
 *
 * Nunca toca una que ya está: si alguien le agregó columnas a mano, se
 * respetan. Sólo escribe los encabezados en el momento de crearla.
 */
function asegurarPestana_(nombre, encabezados, color) {
  const libro = getLibro_();
  let hoja = libro.getSheetByName(nombre);
  if (hoja) return hoja;

  hoja = libro.insertSheet(nombre);
  hoja.getRange(1, 1, 1, encabezados.length)
      .setValues([encabezados])
      .setFontWeight('bold')
      .setBackground('#111111')
      .setFontColor('#FFFFFF');
  hoja.setFrozenRows(1);
  if (color) hoja.setTabColor(color);
  return hoja;
}

/** Para comparar nombres sin pelearse con tildes, mayúsculas ni espacios. */
function clave_(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim();
}

// ── Historial ──────────────────────────────────────────────────────────────
/**
 * Anota un cambio.
 *
 * Nunca tumba la operación que lo generó: si el log falla, el cambio ya se
 * hizo, y perderlo por no poder escribir la anotación sería exactamente al
 * revés de lo que se busca.
 */
function registrarLog_(accion, local, detalle, quien) {
  try {
    const hoja = asegurarPestana_(HOJA_LOG,
      ['Fecha', 'Acción', 'Local', 'Detalle', 'Quién'], '#64748B');
    hoja.appendRow([
      Utilities.formatDate(new Date(), TZ, FORMATO_FECHA),
      accion,
      local || '',
      detalle || '',
      quien || 'sin identificar'
    ]);
  } catch (err) {
    console.error('registrarLog_: ' + err.message);
  }
}

// ── Equipo ─────────────────────────────────────────────────────────────────
/** Filas crudas de la pestaña Equipo, junto con la hoja para poder escribirla. */
function equipoFilas_() {
  const hoja = asegurarPestana_(HOJA_EQUIPO,
    ['Local', 'Vendedor', 'Activo', 'Agregado', 'Por'], '#9B7DFF');
  const ultima = hoja.getLastRow();
  if (ultima < 2) return { hoja: hoja, filas: [] };
  return { hoja: hoja, filas: hoja.getRange(2, 1, ultima - 1, 5).getValues() };
}

/**
 * Los vendedores activos de un local, ordenados alfabéticamente.
 *
 * "Activo" se lee al revés —sólo un 'no' desactiva— para que una celda vacía,
 * un 'si', un 'sí' o cualquier cosa que alguien escriba a mano en la planilla
 * siga contando como activo. Perder un vendedor por una tilde sería peor que
 * mostrar uno de más.
 */
function equipoDe_(local) {
  const k = clave_(local);
  return equipoFilas_().filas
    .filter(function (f) {
      return clave_(f[0]) === k &&
             String(f[1]).trim() &&
             clave_(f[2]) !== 'no';
    })
    .map(function (f) { return String(f[1]).trim(); })
    .sort(function (a, b) { return a.localeCompare(b, 'es'); });
}

/**
 * Lo que pide el FORMULARIO al abrir: a quién mostrar como botones.
 * @param {string} local
 */
function getEquipo(local) {
  if (!local) return { status: 'error', msg: 'Falta el local.' };
  return {
    status: 'ok',
    local: local,
    vendedores: equipoDe_(local),
    objetivo: objetivoDe_(local)
  };
}

/**
 * Suma un vendedor. Si ya estaba pero desactivado lo reactiva en vez de
 * duplicarlo: el caso real es alguien que se fue y volvió.
 */
function equipoAgregar(local, nombre, quien) {
  if (!local) return { status: 'error', msg: 'Falta el local.' };
  const limpio = String(nombre || '').trim();
  if (!limpio) return { status: 'error', msg: 'Falta el nombre.' };
  if (limpio.length > 40) return { status: 'error', msg: 'Ese nombre es demasiado largo.' };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const datos = equipoFilas_();
    const kLocal = clave_(local), kNombre = clave_(limpio);

    for (let i = 0; i < datos.filas.length; i++) {
      const f = datos.filas[i];
      if (clave_(f[0]) !== kLocal || clave_(f[1]) !== kNombre) continue;

      if (clave_(f[2]) === 'no') {
        datos.hoja.getRange(i + 2, 3).setValue('si');
        registrarLog_('Reactivó vendedor', local, limpio, quien);
        return { status: 'ok', vendedores: equipoDe_(local), msg: limpio + ' volvió a la lista.' };
      }
      return { status: 'ok', vendedores: equipoDe_(local), msg: limpio + ' ya estaba en la lista.' };
    }

    datos.hoja.appendRow([
      local, limpio, 'si',
      Utilities.formatDate(new Date(), TZ, FORMATO_FECHA),
      quien || 'sin identificar'
    ]);
    registrarLog_('Agregó vendedor', local, limpio, quien);
    return { status: 'ok', vendedores: equipoDe_(local), msg: limpio + ' quedó agregado.' };

  } catch (err) {
    console.error('equipoAgregar: ' + err.stack);
    return { status: 'error', msg: err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Saca a alguien de la lista. NO borra la fila: la marca inactiva.
 *
 * Borrarla perdería quién lo agregó y cuándo, y dejaría los registros viejos
 * de esa persona sin explicación. Desactivar conserva el rastro entero y se
 * deshace volviéndolo a agregar.
 */
function equipoDesactivar(local, nombre, quien) {
  if (!local || !nombre) return { status: 'error', msg: 'Falta el local o el nombre.' };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const datos = equipoFilas_();
    const kLocal = clave_(local), kNombre = clave_(nombre);

    for (let i = 0; i < datos.filas.length; i++) {
      const f = datos.filas[i];
      if (clave_(f[0]) === kLocal && clave_(f[1]) === kNombre) {
        datos.hoja.getRange(i + 2, 3).setValue('no');
        registrarLog_('Desactivó vendedor', local, String(f[1]).trim(), quien);
        return { status: 'ok', vendedores: equipoDe_(local) };
      }
    }
    return { status: 'error', msg: 'No encontré a ' + nombre + ' en ' + local + '.' };

  } catch (err) {
    console.error('equipoDesactivar: ' + err.stack);
    return { status: 'error', msg: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ── Objetivos ──────────────────────────────────────────────────────────────
/**
 * Mapa local → {periodo, meta}.
 *
 * Una fila con el local vacío vale como objetivo por defecto: sirve para
 * ponerle una meta a todos de una y después ajustar sólo los que difieren.
 */
function objetivos_() {
  const hoja = asegurarPestana_(HOJA_OBJETIVOS, ['Local', 'Período', 'Meta'], '#36D6E7');
  const ultima = hoja.getLastRow();
  const mapa = {};
  if (ultima < 2) return mapa;

  hoja.getRange(2, 1, ultima - 1, 3).getValues().forEach(function (f) {
    const meta = Number(String(f[2]).replace(/\D/g, ''));
    if (!meta) return;
    const periodo = PERIODOS.indexOf(clave_(f[1])) > -1 ? clave_(f[1]) : 'semana';
    mapa[clave_(f[0]) || '*'] = { periodo: periodo, meta: meta };
  });
  return mapa;
}

/** El objetivo de un local, o el general si ese local no tiene el suyo. */
function objetivoDe_(local) {
  const mapa = objetivos_();
  return mapa[clave_(local)] || mapa['*'] || null;
}

/**
 * Guarda el objetivo de un local desde la pantalla de configuración.
 *
 * Una meta en 0 borra la fila: es la forma de decir "este local no tiene
 * objetivo propio" y que vuelva a regir el general.
 */
function objetivoGuardar(local, periodo, meta, quien) {
  if (!local) return { status: 'error', msg: 'Falta el local.' };

  const p = clave_(periodo);
  if (PERIODOS.indexOf(p) === -1) {
    return { status: 'error', msg: 'Período no permitido: ' + periodo };
  }
  const n = Number(String(meta).replace(/\D/g, ''));
  if (n > 100000) return { status: 'error', msg: 'Esa meta es demasiado grande.' };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const hoja = asegurarPestana_(HOJA_OBJETIVOS, ['Local', 'Período', 'Meta'], '#36D6E7');
    const ultima = hoja.getLastRow();
    const k = clave_(local);
    let fila = 0;

    if (ultima >= 2) {
      const filas = hoja.getRange(2, 1, ultima - 1, 1).getValues();
      for (let i = 0; i < filas.length; i++) {
        if (clave_(filas[i][0]) === k) { fila = i + 2; break; }
      }
    }

    if (!n) {
      if (fila) {
        hoja.deleteRow(fila);
        registrarLog_('Borró objetivo', local, '', quien);
      }
      return { status: 'ok', objetivo: null };
    }

    if (fila) hoja.getRange(fila, 1, 1, 3).setValues([[local, p, n]]);
    else      hoja.appendRow([local, p, n]);

    registrarLog_('Puso objetivo', local, n + ' por ' + p, quien);
    return { status: 'ok', objetivo: { periodo: p, meta: n } };

  } catch (err) {
    console.error('objetivoGuardar: ' + err.stack);
    return { status: 'error', msg: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ── Lo que pide la pantalla de configuración ───────────────────────────────
/**
 * Todo junto: qué locales hay, quién trabaja en cada uno y qué objetivo tiene.
 *
 * Los locales salen de LOCALES_BASE más cualquiera que aparezca en la pestaña
 * Equipo u Objetivos. Así, el día que abra una sucursal nueva, alcanza con
 * agregarla desde la configuración: no hace falta publicar la app de nuevo.
 */
function getConfig() {
  const equipo = equipoFilas_().filas;
  const metas = objetivos_();

  const vistos = {};
  LOCALES_BASE.forEach(function (l) { vistos[clave_(l)] = l; });
  equipo.forEach(function (f) {
    const n = String(f[0]).trim();
    if (n && !vistos[clave_(n)]) vistos[clave_(n)] = n;
  });

  const locales = Object.keys(vistos).sort().map(function (k) {
    const nombre = vistos[k];
    return {
      local: nombre,
      vendedores: equipoDe_(nombre),
      objetivo: metas[k] || null
    };
  });

  return {
    status: 'ok',
    locales: locales,
    periodos: PERIODOS,
    general: metas['*'] || null
  };
}
