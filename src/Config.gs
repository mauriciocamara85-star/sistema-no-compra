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
 *
 * La única excepción es a quién le llega el AVISO POR MAIL: ese mail lleva
 * adentro el teléfono del cliente, así que cambiarlo sí pide el PIN del panel.
 * No se protege la configuración, se protege el dato que viaja.
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
 * Suma al vendedor a la lista del local cuando entra un registro con un
 * nombre que no estaba. Lo llama submitForm().
 *
 * Es lo que hace que el sistema se arregle solo: el que entra un sábado y no
 * está en la configuración escribe su nombre UNA vez, y del registro
 * siguiente en adelante ya aparece en el desplegable de todos los celulares
 * del local, escrito siempre igual. Antes ese nombre vivía suelto en cada
 * teléfono y la lista del local nunca se enteraba.
 *
 * Dos cuidados:
 *
 *  - **Si el nombre ya figura, activo o no, no se toca nada.** Reactivar en
 *    silencio a alguien que el encargado desactivó a propósito sería
 *    deshacerle la decisión sin avisarle. Para eso está el botón de
 *    configuración, que es una persona decidiendo.
 *  - Queda en el `Log` como agregado *desde el formulario*, para poder
 *    distinguirlo de lo que cargó alguien a mano.
 *
 * Nunca tumba el registro: el cliente ya está guardado, que es lo que
 * importa. Un error acá sólo significa que el nombre se va a sumar la
 * próxima vez.
 */
function sumarVendedor_(local, vendedor) {
  const limpio = String(vendedor || '').trim();
  if (!local || !limpio || limpio.length > 40) return;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const datos = equipoFilas_();
    const kLocal = clave_(local), kNombre = clave_(limpio);

    for (let i = 0; i < datos.filas.length; i++) {
      const f = datos.filas[i];
      if (clave_(f[0]) === kLocal && clave_(f[1]) === kNombre) return;
    }

    const firma = limpio + ' (desde el formulario)';
    datos.hoja.appendRow([
      local, limpio, 'si',
      Utilities.formatDate(new Date(), TZ, FORMATO_FECHA),
      firma
    ]);
    registrarLog_('Agregó vendedor', local, limpio, firma);

  } catch (err) {
    console.error('sumarVendedor_: ' + err.message);
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

  /* '*' es el objetivo GENERAL: el que vale para todo local que no tenga el
     suyo. En la planilla vive como una fila con el local vacío —así lo lee
     objetivos_()—, así que acá se traduce a eso. Se manda con un asterisco y
     no con una cadena vacía para que un error de la pantalla no termine
     escribiendo el objetivo de todos sin querer. */
  const general = local === '*';
  const nombre = general ? '' : local;
  const enLog = general ? 'Todos los locales' : local;

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
    const k = general ? '' : clave_(local);
    let fila = 0;

    if (ultima >= 2) {
      const filas = hoja.getRange(2, 1, ultima - 1, 3).getValues();
      for (let i = 0; i < filas.length; i++) {
        if (clave_(filas[i][0]) !== k) continue;
        /* El general se busca por un nombre VACÍO, así que una fila en blanco
           perdida en el medio de la hoja también coincide. Pedirle además una
           meta escrita la descarta: si el objetivo terminara ahí, la fila
           general de más abajo seguiría existiendo y objetivos_() se quedaría
           con la última, que es la vieja. */
        if (general && !String(filas[i][2]).trim()) continue;
        fila = i + 2;
        break;
      }
    }

    if (!n) {
      if (fila) {
        hoja.deleteRow(fila);
        registrarLog_('Borró objetivo', enLog, '', quien);
      }
      return { status: 'ok', objetivo: null };
    }

    if (fila) hoja.getRange(fila, 1, 1, 3).setValues([[nombre, p, n]]);
    else      hoja.appendRow([nombre, p, n]);

    registrarLog_('Puso objetivo', enLog, n + ' por ' + p, quien);
    return { status: 'ok', objetivo: { periodo: p, meta: n } };

  } catch (err) {
    console.error('objetivoGuardar: ' + err.stack);
    return { status: 'error', msg: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ── A quién le llega el aviso ──────────────────────────────────────────────
/**
 * El mail que recibe un aviso por cada registro nuevo.
 *
 * Vive en la propiedad NOTIFICAR_A del script y no en la planilla porque el
 * repo es público y las propiedades no se publican. Vacío significa que no se
 * manda nada: notificar_() (Codigo.gs) se vuelve sin hacer nada.
 */
function avisosLeer_() {
  const destino = String(
    PropertiesService.getScriptProperties().getProperty('NOTIFICAR_A') || ''
  ).trim();
  return { mail: destino, activo: !!destino };
}

/** Un mail con forma de mail. Que exista lo dice el rebote, no esto. */
function mailValido_(m) {
  return /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/.test(m);
}

/**
 * Cambia a quién le llega el aviso. Es lo ÚNICO de esta pantalla que pide el
 * PIN, y no por proteger un ajuste.
 *
 * Ese mail lleva adentro el nombre, el teléfono y el mail del cliente. Sin
 * PIN, cualquiera que tenga la dirección del backend —que está en un repo
 * público— podría mandarse los datos de cada persona que pasa por los locales
 * a su propia casilla, y nadie se enteraría: el sistema seguiría andando
 * igual. Es el mismo dato que protege el panel, sólo que saliendo por otra
 * puerta.
 *
 * Vacío apaga el aviso. Se pueden poner varias casillas separadas por coma:
 * MailApp las acepta tal cual en el campo "to".
 */
function avisosGuardar(pin, mail, quien) {
  if (!verificarPin_(pin)) return { status: 'error', msg: mensajePin_() };

  // Sin espacios en ninguna parte: un mail no los lleva, y pegado desde el
  // celular casi siempre viene con uno adelante o atrás.
  const limpio = String(mail || '').replace(/\s+/g, '').replace(/,+$/, '');
  if (limpio.length > 200) {
    return { status: 'error', msg: 'Esa lista de mails es demasiado larga.' };
  }

  if (limpio) {
    const partes = limpio.split(',');
    if (partes.length > 5) {
      return { status: 'error', msg: 'Como mucho cinco casillas.' };
    }
    for (let i = 0; i < partes.length; i++) {
      if (!mailValido_(partes[i])) {
        return { status: 'error', msg: 'Esto no parece un mail: ' + partes[i] };
      }
    }
  }

  PropertiesService.getScriptProperties().setProperty('NOTIFICAR_A', limpio);
  registrarLog_('Cambió el aviso', '', limpio || 'sin aviso', quien);
  return { status: 'ok', avisos: avisosLeer_() };
}

// ── El aviso por Telegram ──────────────────────────────────────────────────
/**
 * El estado del aviso por Telegram, para mostrarlo.
 *
 * **Nunca devuelve el token.** Es una llave: con ella se puede escribir como
 * el bot. Sale de acá sólo si está puesto o no, y el id del chat, que sin el
 * token no sirve para nada. Mismo criterio que el de Kommo.
 */
function telegramLeer_() {
  const p = PropertiesService.getScriptProperties();
  const token = String(p.getProperty('TELEGRAM_TOKEN') || '').trim();
  const chat  = String(p.getProperty('TELEGRAM_CHAT') || '').trim();
  return {
    activo: !!(token && chat),
    tieneToken: !!token,
    chat: chat,
    nombre: String(p.getProperty('TELEGRAM_NOMBRE') || '').trim(),
    error: String(p.getProperty('TELEGRAM_ULTIMO_ERROR') || '').trim()
  };
}

/**
 * Busca los chats donde está el bot, para elegir uno por nombre.
 *
 * Pide el PIN porque devuelve los nombres de los grupos de la empresa y
 * porque es el paso previo a redirigir los avisos, que es lo que el PIN
 * cuida acá.
 *
 * El token puede venir en el pedido —todavía no se guardó— o estar ya
 * cargado: así se puede volver a elegir el chat sin tener que pegar el token
 * de nuevo.
 */
function telegramBuscar(pin, token) {
  if (!verificarPin_(pin)) return { status: 'error', msg: mensajePin_() };

  const limpio = String(token || '').trim() ||
    String(PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN') || '').trim();
  if (!limpio) return { status: 'error', msg: 'Falta el token del bot.' };

  try {
    const chats = telegramChats_(limpio);
    if (!chats.length) {
      return {
        status: 'error',
        msg: 'No encontré ningún chat. Escribí un mensaje cualquiera en el grupo ' +
             'donde está el bot y probá de nuevo: Telegram sólo cuenta los mensajes recientes.'
      };
    }
    return { status: 'ok', chats: chats };

  } catch (err) {
    console.error('telegramBuscar: ' + err.message);
    return { status: 'error', msg: 'Telegram dijo: ' + err.message };
  }
}

/**
 * Guarda el bot y el chat, y manda un mensaje de prueba.
 *
 * La prueba no es un adorno: sin ella, el que configura se entera de que algo
 * está mal recién cuando un cliente no recibió el llamado. Si el mensaje no
 * sale, no se guarda nada y se dice por qué.
 *
 * Vacío apaga el aviso.
 */
function telegramGuardar(pin, token, chat, quien) {
  if (!verificarPin_(pin)) return { status: 'error', msg: mensajePin_() };

  const props = PropertiesService.getScriptProperties();
  const elToken = String(token || '').trim() ||
                  String(props.getProperty('TELEGRAM_TOKEN') || '').trim();
  const elChat = String(chat || '').trim();

  // Apagar: alcanza con vaciar el chat, que es lo que se elige en la pantalla.
  if (!elChat) {
    props.deleteProperty('TELEGRAM_CHAT');
    props.deleteProperty('TELEGRAM_NOMBRE');
    registrarLog_('Cambió el aviso de Telegram', '', 'apagado', quien);
    return { status: 'ok', telegram: telegramLeer_() };
  }

  if (!elToken) return { status: 'error', msg: 'Falta el token del bot.' };

  // Antes de guardar, que funcione.
  let nombre = '';
  try {
    const chats = telegramChats_(elToken);
    chats.forEach(function (c) { if (c.id === elChat) nombre = c.nombre; });

    telegramFetch_(elToken, 'sendMessage', {
      chat_id: elChat,
      text: 'Listo: los avisos de <b>No Compra</b> van a llegar acá.',
      parse_mode: 'HTML'
    });
  } catch (err) {
    console.error('telegramGuardar: ' + err.message);
    return { status: 'error', msg: 'No se pudo mandar el mensaje de prueba. Telegram dijo: ' + err.message };
  }

  props.setProperty('TELEGRAM_TOKEN', elToken);
  props.setProperty('TELEGRAM_CHAT', elChat);
  if (nombre) props.setProperty('TELEGRAM_NOMBRE', nombre);
  props.deleteProperty('TELEGRAM_ULTIMO_ERROR');

  registrarLog_('Cambió el aviso de Telegram', '', nombre || elChat, quien);
  return { status: 'ok', telegram: telegramLeer_() };
}

// ── Desde cuándo cuentan los números ───────────────────────────────────────
/**
 * Cambia la línea de arranque del sistema. Pide el PIN por el mismo motivo
 * que el aviso: no por proteger un ajuste, sino por lo que hace.
 *
 * Mover esta fecha para adelante le esconde registros a Atención al Cliente
 * —clientes que estaban esperando que los llamen— sin borrar nada y sin que
 * se note más que en un número que bajó. Es la clase de cambio que tiene que
 * poder hacer alguien que sabe lo que está haciendo.
 *
 * Vacío significa contar todo, incluida la etapa vieja del sistema. Ver la
 * LÍNEA DE ARRANQUE en Codigo.gs.
 */
function arranqueGuardar(pin, desde, quien) {
  if (!verificarPin_(pin)) return { status: 'error', msg: mensajePin_() };

  const txt = String(desde || '').trim();

  if (txt) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
      return { status: 'error', msg: 'La fecha va como 2026-09-21.' };
    }
    // Que además sea una fecha que existe: el formato no alcanza, 2026-02-31
    // lo pasa igual.
    const p = txt.split('-');
    const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    if (isNaN(d.getTime()) ||
        d.getFullYear() !== Number(p[0]) ||
        d.getMonth() !== Number(p[1]) - 1 ||
        d.getDate() !== Number(p[2])) {
      return { status: 'error', msg: 'Esa fecha no existe.' };
    }
  }

  PropertiesService.getScriptProperties().setProperty('DESDE', txt);
  registrarLog_('Cambió el arranque', '', txt || 'cuenta todo', quien);
  return { status: 'ok', arranque: txt };
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
    general: metas['*'] || null,
    // A quién le llega el aviso de cada registro nuevo. La pantalla lo muestra
    // siempre; cambiarlo pide el PIN (ver avisosGuardar).
    avisos: avisosLeer_(),
    // El aviso por Telegram. Devuelve si está puesto y a qué grupo, nunca el
    // token: ver telegramLeer_.
    telegram: telegramLeer_(),
    // Desde cuándo cuentan los números. Mismo criterio que el aviso: se lee
    // sin PIN y se cambia con PIN (ver arranqueGuardar y la LÍNEA DE ARRANQUE
    // en Codigo.gs).
    arranque: arranqueISO_()
  };
}
