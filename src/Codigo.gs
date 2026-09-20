/**
 * VDH · Sistema No Compra
 * Registro de clientes que se van del local sin encontrar la prenda.
 *
 * Este proyecto es SÓLO EL BACKEND. La interfaz (formulario y panel) vive en
 * GitHub Pages y le habla acá por POST; doGet sólo manda a la dirección nueva
 * a quien entre por un link viejo de Apps Script.
 *
 * IMPORTANTE SOBRE LA PLANILLA
 * En la hoja 'No Compra':
 *   A-I  las carga el vendedor desde el formulario
 *   J-V  las completa Atención al Cliente a mano durante el seguimiento
 *   W, Y tabla aparte del equipo (Orden / Total por mes) — NO TOCAR
 *   Z    Motivo del no-compra, lo carga el formulario
 * Nunca escribir en J-V ni en W-Y sin saber qué había: son datos vivos.
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

/** Se sube a mano al publicar. Sirve para responder "¿qué versión tenés?"
    cuando alguien dice que algo no le anda. El formulario muestra la suya en
    el pie; si no coinciden, el celular tiene la app vieja cacheada. */
const VERSION = '2026.09.20';

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
  MONTO:       21,   // V  Monto Venta ($)
  // ── vuelve a ser dato del vendedor, pero vive al final ──
  MOTIVO:      25    // Z  Motivo (ver ANCHO)
};

/**
 * Se leen las columnas A-Z.
 *
 * El motivo quedó en la Z y no pegado a Observaciones porque las columnas W
 * ("Orden") e Y ("Total") ya están ocupadas: la planilla tiene ahí una
 * tablita aparte con los totales por mes, cargada a mano. Meter el motivo en
 * el medio, o insertar una columna nueva después de la I, habría corrido esa
 * tabla y todas las fórmulas del equipo. La Z es la primera libre de verdad.
 */
const ANCHO = 26;

/** Vocabulario real, tomado de lo que ya cargó el equipo. No inventar valores. */
const VOCAB = {
  CONTACTAMOS: ['si', 'no'],
  RESULTADO_1: ['Respondió - interesado', 'Respondió - no interesado', 'No respondió'],
  ESTADO:      ['En seguimiento', 'Esperando respuesta', 'Cerrado - compró',
                'Cerrado - no compró', 'Descartado'],
  COMPRO:      ['Sí - local', 'Sí - online', 'No'],
  // Por qué el cliente se fue sin llevar. Es el dato que le dice a Compras qué
  // falta en el local; el formulario lo pide de a un toque. Los textos son
  // exactamente los de los botones del formulario, para que lo que toca el
  // vendedor sea lo que queda escrito en la planilla.
  MOTIVO:      ['Sin talle', 'Sin stock', 'Precio', 'No le gustó',
                'Fue a comparar', 'Otro']
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
/** Dónde vive la interfaz de verdad. */
const SITIO = 'https://mauriciocamara85-star.github.io/sistema-no-compra/';

/**
 * Las vistas ya no se sirven desde acá: mandan al sitio de GitHub Pages.
 *
 * Antes este proyecto tenía copias del formulario y del panel (Index.html y
 * Panel.html) para que los links viejos no se rompieran. Eran copias de
 * verdad, y cada cambio de interfaz había que hacerlo dos veces: se
 * desincronizaron. Ahora hay una sola interfaz y esto sólo lleva hasta ella.
 *
 * NO es una redirección automática, y no puede serlo. Apps Script no devuelve
 * 302, y la página servida corre dentro de un iframe con
 * sandbox="… allow-top-navigation-by-user-activation …": la pestaña sólo se
 * puede navegar a partir de un clic real de la persona, nunca por código. Por
 * eso Redirect.html es un botón con target="_top" y no un salto con
 * window.top.location, que queda bloqueado en silencio.
 */
function doGet(e) {
  const vista = (e && e.parameter && e.parameter.v) || 'form';
  const destino = SITIO + (vista === 'panel' ? 'panel.html' : '');

  const t = HtmlService.createTemplateFromFile('Redirect');
  t.destino = destino;

  return t.evaluate()
    .setTitle('VDH · No Compra')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Punto de entrada para la interfaz alojada en GitHub Pages.
 *
 * Esa interfaz no corre adentro de Apps Script, así que no puede usar
 * google.script.run: le habla a este endpoint por POST y recibe JSON.
 * Las vistas servidas desde acá (doGet) siguen andando igual.
 */
function doPost(e) {
  let salida;
  try {
    const p = JSON.parse(e.postData.contents);

    switch (p.accion) {
      case 'submit':      salida = submitForm(p.datos);                       break;
      case 'registros':   salida = getRegistros(p.pin, p.filtro);             break;
      case 'seguimiento': salida = guardarSeguimiento(p.pin, p.fila, p.campos); break;
      case 'resumen':     salida = getResumenPanel(p.pin);                    break;

      // Configuración: equipo y objetivos. Sin PIN a propósito — ver Config.gs.
      case 'equipo':      salida = getEquipo(p.local);                        break;
      case 'config':      salida = getConfig();                               break;
      case 'agregarVend': salida = equipoAgregar(p.local, p.nombre, p.quien); break;
      case 'sacarVend':   salida = equipoDesactivar(p.local, p.nombre, p.quien); break;
      case 'objetivo':    salida = objetivoGuardar(p.local, p.periodo, p.meta, p.quien); break;

      // Tablero del local, sin PIN por el mismo motivo: son cuentas del
      // propio local, no hay un dato de ningún cliente adentro.
      case 'metricas':    salida = getMetricas(p.local);                      break;

      case 'version':     salida = { status: 'ok', version: VERSION };        break;
      default:            salida = { status: 'error', msg: 'Acción desconocida.' };
    }

  } catch (err) {
    console.error('doPost: ' + err.stack);
    salida = { status: 'error', msg: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(salida))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Carga (vendedor) ───────────────────────────────────────────────────────
/**
 * Guarda un registro. Escribe A-I y el motivo en la Z; J a Y no se tocan,
 * porque son del seguimiento de Atención al Cliente y de la tabla de totales.
 * @param {Object} data {sucursal, vendedor, nombre, whatsapp, mail, producto, talle, obs, motivo}
 * @return {{status: string, msg: string=}}
 */
function submitForm(data) {
  // Las validaciones van ANTES del candado: un pedido mal formado no tiene por
  // qué hacer cola detrás de las cargas buenas.
  if (!data || !data.sucursal) return { status: 'error', msg: 'Falta la sucursal.' };
  if (!data.whatsapp)          return { status: 'error', msg: 'Falta el WhatsApp.' };
  if (!data.vendedor)          return { status: 'error', msg: 'Falta el vendedor.' };

  // El motivo sí se valida contra el vocabulario: si alguien manda cualquier
  // cosa, el conteo por motivo deja de servir, que es para lo único que está.
  if (data.motivo && VOCAB.MOTIVO.indexOf(data.motivo) === -1) {
    return { status: 'error', msg: 'Motivo no permitido: ' + data.motivo };
  }

  // ── Con candado: sólo la escritura en la planilla ──
  // El candado existe para que dos vendedores que cargan al mismo tiempo no se
  // pisen la fila. Tiene que durar lo mínimo: son 14 locales cargando contra
  // la misma planilla y todo lo que pase acá adentro hace esperar al resto.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const hoja = getHoja_();
    const fecha = Utilities.formatDate(new Date(), TZ, FORMATO_FECHA);

    // appendRow con las 9 primeras: deja intactas J a Y de la fila nueva.
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

    if (data.motivo) {
      asegurarMotivo_(hoja);
      hoja.getRange(hoja.getLastRow(), COL.MOTIVO + 1).setValue(data.motivo);
    }

  } catch (err) {
    console.error('submitForm: ' + err.stack);
    return { status: 'error', msg: err.message };
  } finally {
    lock.releaseLock();
  }

  // ── Sin candado: lo que sale del sistema ──
  // El mail y Kommo son llamadas a servicios de afuera y pueden tardar
  // segundos. Adentro del candado, un Kommo lento dejaba a los otros 13
  // locales esperando para guardar. Acá ya está guardado: que tarden sólo
  // demora la respuesta de ESTE vendedor, y ninguno de los dos puede hacer
  // fallar un registro que ya está en la planilla.
  // El tablero del local está cacheado medio minuto. Si no se borra acá, el
  // vendedor carga un cliente y ve el mismo número que antes, que es
  // justamente la señal que esa pantalla existe para darle.
  olvidarMetricas_(data.sucursal);

  // Si el nombre no estaba en la lista del local, entra ahora. Se hace acá y
  // no cuando lo escribe porque un nombre a medio tipear no tiene que
  // ensuciar la configuración: se suma recién cuando esa persona cargó un
  // cliente de verdad. Ver sumarVendedor_ en Config.gs.
  sumarVendedor_(data.sucursal, data.vendedor);

  notificar_(data);
  sincronizarCrm_(data);
  return { status: 'ok' };
}

// ── Seguimiento (Atención al Cliente) ──────────────────────────────────────
/**
 * Devuelve los registros para el panel, del más nuevo al más viejo.
 * @param {string} pin
 * @param {string} filtro 'Pendiente' | uno de VOCAB.ESTADO | 'Todos'
 */
function getRegistros(pin, filtro) {
  if (!verificarPin_(pin)) return { status: 'error', msg: mensajePin_() };

  try {
    const hoja = getHoja_();
    const inicio = getFilaEncabezado_(hoja) + 1;
    const ultima = hoja.getLastRow();
    if (ultima < inicio) return { status: 'ok', registros: [] };

    // getMaxColumns y no getLastColumn: la Z del motivo puede estar todavía
    // vacía en toda la hoja, y con getLastColumn nunca se leería.
    const ancho = Math.min(ANCHO, hoja.getMaxColumns());
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
        motivo:      String(f[COL.MOTIVO] || ''),
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
  if (!verificarPin_(pin)) return { status: 'error', msg: mensajePin_() };
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

/**
 * Totales para el tablero del panel.
 *
 * Además de los conteos por estado devuelve la plata que entró de gente que ya
 * se había ido del local sin comprar. Es el único número que contesta si el
 * sistema sirve o no, y hasta ahora estaba cargado en la columna V pero no se
 * mostraba en ninguna parte.
 *
 * Va separada en LOCAL y ONLINE porque un no-compra se puede resolver de dos
 * maneras —que el producto llegue al local y el cliente vuelva, o que se lo
 * venda la tienda online— y sumarlas esconde justamente lo que hay que ver:
 * cuánta venta le está empujando esto al ecommerce.
 */
function getResumenPanel(pin) {
  if (!verificarPin_(pin)) return { status: 'error', msg: mensajePin_() };

  const hoja = getHoja_();
  const inicio = getFilaEncabezado_(hoja) + 1;
  const ultima = hoja.getLastRow();
  const conteo = { Total: 0, Pendiente: 0 };
  VOCAB.ESTADO.forEach(function (e) { conteo[e] = 0; });

  const recuperado = { local: 0, online: 0, total: 0 };
  const compraron  = { local: 0, online: 0, total: 0 };
  const porMotivo = {};

  if (ultima >= inicio) {
    const ancho = Math.min(ANCHO, hoja.getMaxColumns());
    const v = hoja.getRange(inicio, 1, ultima - inicio + 1, ancho).getValues();
    v.forEach(function (f) {
      if (!f[COL.FECHA] && !f[COL.WHATSAPP]) return;
      conteo.Total++;

      const motivo = String(f[COL.MOTIVO] || '').trim();
      if (motivo) porMotivo[motivo] = (porMotivo[motivo] || 0) + 1;

      // "Compró" son los Sí del vocabulario (local u online), no el texto libre.
      const compro = String(f[COL.COMPRO] || '').trim();
      if (compro.indexOf('Sí') === 0) {
        const monto = parseMonto_(f[COL.MONTO]);
        compraron.total++;
        recuperado.total += monto;
        // Lo que no diga "online" cuenta como local: el vocabulario sólo tiene
        // esas dos opciones, y ante un valor raro es preferible no inflar el
        // número del ecommerce, que es el que estamos tratando de mover.
        const via = compro.toLowerCase().indexOf('online') > -1 ? 'online' : 'local';
        compraron[via]++;
        recuperado[via] += monto;
      }

      const estado = String(f[COL.ESTADO] || '').trim();
      const contactado = String(f[COL.CONTACTAMOS] || '').trim().toLowerCase() === 'si';
      if (!estado && !contactado) { conteo.Pendiente++; return; }
      if (conteo[estado] === undefined) conteo[estado] = 0;
      if (estado) conteo[estado]++;
    });
  }

  return {
    status: 'ok',
    conteo: conteo,
    vocab: VOCAB,
    recuperado: recuperado,   // {local, online, total}
    compraron: compraron,     // {local, online, total}
    porMotivo: porMotivo,
    // Si el puente con Kommo se rompió, el panel lo tiene que decir: es la
    // única pantalla que Atención al Cliente mira todos los días.
    crm: estadoCrm_(),
    // Mismo criterio que el CRM: un respaldo que dejó de correr no puede
    // enterarse nadie recién el día que hace falta.
    respaldo: (typeof estadoRespaldo_ === 'function') ? estadoRespaldo_() : { activo: false }
  };
}

// ── Tablero del local (vendedor) ───────────────────────────────────────────
/** Nombre base de la clave de caché del tablero. Una por local. */
const CACHE_METRICAS = 'metricas_';

/**
 * Los números que el formulario muestra arriba, del local que está cargando:
 * cuántos registros van hoy y este mes, cómo viene contra su objetivo y
 * cuánta plata volvió gracias a esos registros.
 *
 * No pide PIN, igual que el equipo y los objetivos: son cuentas del propio
 * local y un total en pesos, no hay un dato de ningún cliente adentro.
 *
 * **El recuperado se corta por la fecha del REGISTRO, no por la de la venta.**
 * La planilla no guarda cuándo se cerró la compra, así que "recuperado este
 * mes" quiere decir "de lo que se registró este mes, esto ya volvió". Es la
 * pregunta que le importa al local y la única que los datos pueden contestar
 * sin inventar nada.
 *
 * Los registros viejos tienen los nombres anteriores de los locales
 * ('MD2 - Mar del Plata Rivadavia'), así que no entran en la cuenta de
 * RIVADAVIA. Es el mismo corte que ya tiene el Resumen por sucursal.
 *
 * @param {string} local
 */
function getMetricas(local) {
  if (!local) return { status: 'error', msg: 'Falta el local.' };

  const k = clave_(local);
  const cache = CacheService.getScriptCache();
  const enCache = cache.get(CACHE_METRICAS + k);
  if (enCache) return JSON.parse(enCache);

  const hoja = getHoja_();
  const inicio = getFilaEncabezado_(hoja) + 1;
  const ultima = hoja.getLastRow();
  const corte = cortes_();

  const registros  = { dia: 0, semana: 0, mes: 0, total: 0 };
  const recuperado = { mes: 0, total: 0 };
  const ventas     = { mes: 0, total: 0 };

  if (ultima >= inicio) {
    const ancho = Math.min(ANCHO, hoja.getMaxColumns());
    hoja.getRange(inicio, 1, ultima - inicio + 1, ancho).getValues().forEach(function (f) {
      if (!f[COL.FECHA] && !f[COL.WHATSAPP]) return;
      if (clave_(f[COL.SUCURSAL]) !== k) return;

      registros.total++;
      const fecha = parseFecha_(f[COL.FECHA]);
      const delMes = !!fecha && fecha >= corte.mes;
      if (fecha) {
        if (fecha >= corte.dia)    registros.dia++;
        if (fecha >= corte.semana) registros.semana++;
        if (delMes)                registros.mes++;
      }

      // "Compró" son los Sí del vocabulario, no el texto libre. Mismo criterio
      // que el panel: ver getResumenPanel.
      if (String(f[COL.COMPRO] || '').trim().indexOf('Sí') !== 0) return;
      const monto = parseMonto_(f[COL.MONTO]);
      ventas.total++;
      recuperado.total += monto;
      if (delMes) { ventas.mes++; recuperado.mes += monto; }
    });
  }

  const meta = objetivoDe_(local);
  const salida = {
    status: 'ok',
    local: local,
    registros: registros,
    recuperado: recuperado,
    ventas: ventas,
    // El objetivo se compara contra el período con el que está cargado: si el
    // local se puso una meta semanal, la tarjeta cuenta la semana.
    objetivo: meta
      ? { periodo: meta.periodo, meta: meta.meta, hechos: registros[meta.periodo] || 0 }
      : null
  };

  // Medio minuto alcanza. Sin caché, cada vez que un vendedor abre el
  // formulario se lee la planilla entera, y son 14 locales abriéndola todo el
  // día; con caché, la carga propia igual se ve al instante porque submitForm
  // la borra (olvidarMetricas_).
  cache.put(CACHE_METRICAS + k, JSON.stringify(salida), 30);
  return salida;
}

/** Borra el tablero cacheado de un local. Nunca tumba lo que lo llamó. */
function olvidarMetricas_(local) {
  try {
    CacheService.getScriptCache().remove(CACHE_METRICAS + clave_(local));
  } catch (err) {
    console.error('olvidarMetricas_: ' + err.message);
  }
}

/**
 * Dónde arrancan el día, la semana y el mes de hoy.
 *
 * El proyecto corre en hora argentina (`timeZone` en appsscript.json), así
 * que alcanza con la fecha local: no hace falta convertir nada.
 */
function cortes_() {
  const ahora = new Date();
  const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  // getDay() cuenta el domingo como 0; la semana del equipo arranca el lunes.
  const semana = new Date(dia);
  semana.setDate(dia.getDate() - ((dia.getDay() + 6) % 7));
  return { dia: dia, semana: semana, mes: new Date(ahora.getFullYear(), ahora.getMonth(), 1) };
}

// ── Aviso por mail ─────────────────────────────────────────────────────────
function notificar_(data) {
  const destino = PropertiesService.getScriptProperties().getProperty('NOTIFICAR_A');
  if (!destino) return;

  try {
    // Naranja #F97316, el mismo de la app y del resto de los sistemas VDH.
    const cuerpo =
      '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0B1220">' +
      '<h2 style="color:#C2410C;margin:0 0 4px">Nuevo pedido · No Compra</h2>' +
      '<p style="color:#33475F;margin:0 0 16px">' + esc_(data.sucursal) + '</p>' +
      '<table cellpadding="6" style="border-collapse:collapse">' +
      filaMail_('Cliente',       data.nombre) +
      filaMail_('WhatsApp',      data.whatsapp) +
      filaMail_('Mail',          data.mail) +
      filaMail_('Producto',      data.producto) +
      filaMail_('Talle',         data.talle) +
      filaMail_('Por qué no compró', data.motivo) +
      filaMail_('Vendedor',      data.vendedor) +
      filaMail_('Observaciones', data.obs) +
      '</table>' +
      '<p style="margin-top:20px">' +
      '<a href="' + linkWhatsapp_(data.whatsapp) + '" ' +
      'style="background:#F97316;color:#fff;padding:10px 20px;font-weight:bold;' +
      'text-decoration:none;border-radius:8px;display:inline-block">Escribir por WhatsApp</a>' +
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

// ── CRM ────────────────────────────────────────────────────────────────────
/**
 * Manda el registro a Kommo, si el puente está configurado (ver Kommo.gs).
 *
 * Envuelto en try/catch por la misma razón que el aviso por mail: la planilla
 * es la fuente de verdad y un CRM caído, un token vencido o un cambio de
 * campos en Kommo NO pueden hacerle perder la carga a un vendedor que ya hizo
 * su trabajo. El error queda en el log.
 */
function sincronizarCrm_(data) {
  // typeof y no una llamada directa: si algún día se borra Kommo.gs, el
  // sistema tiene que seguir andando sin tocar nada más.
  if (typeof kommoEnviar_ !== 'function') return;

  const props = PropertiesService.getScriptProperties();
  try {
    kommoEnviar_(data);
    // Sólo si había algo anotado: esto corre en cada carga y escribir las
    // propiedades del script en cada no-compra es gasto al pedo.
    if (props.getProperty('KOMMO_ULTIMO_ERROR')) props.deleteProperty('KOMMO_ULTIMO_ERROR');
  } catch (err) {
    console.error('sincronizarCrm_: ' + err.message);
    // Además del log, queda anotado para que el PANEL lo muestre. Un token
    // vencido corta los leads sin hacer ruido, y el log de Apps Script no lo
    // mira nadie: el día que pase, Atención al Cliente tiene que verlo en la
    // pantalla que usa todos los días.
    props.setProperty('KOMMO_ULTIMO_ERROR', JSON.stringify({
      msg: String(err.message).slice(0, 300),
      cuando: Utilities.formatDate(new Date(), TZ, FORMATO_FECHA)
    }));
  }
}

/** Cómo viene el puente con el CRM. Lo muestra el panel. */
function estadoCrm_() {
  if (typeof kommoActivo_ !== 'function' || !kommoActivo_()) return { activo: false };

  const guardado = PropertiesService.getScriptProperties().getProperty('KOMMO_ULTIMO_ERROR');
  if (!guardado) return { activo: true, ok: true };

  try {
    const e = JSON.parse(guardado);
    return { activo: true, ok: false, msg: e.msg, cuando: e.cuando };
  } catch (err) {
    return { activo: true, ok: false, msg: String(guardado) };
  }
}

function filaMail_(etiqueta, valor) {
  if (!valor) return '';
  return '<tr><td style="color:#33475F">' + esc_(etiqueta) + '</td>' +
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

/**
 * Deja listo el encabezado del motivo en la Z. Se llama recién cuando entra el
 * primer registro con motivo, así una planilla que todavía no lo usa no se
 * toca para nada.
 */
function asegurarMotivo_(hoja) {
  if (hoja.getMaxColumns() < ANCHO) {
    hoja.insertColumnsAfter(hoja.getMaxColumns(), ANCHO - hoja.getMaxColumns());
  }
  const filaEnc = getFilaEncabezado_(hoja);
  const celda = hoja.getRange(filaEnc, COL.MOTIVO + 1);
  if (!String(celda.getValue()).trim()) {
    celda.setValue('Motivo').setFontWeight('bold');
  }
}

/**
 * Los montos de la columna V están cargados a mano, como texto y en formato
 * argentino: "$34.647", "34.647,50", a veces como número. Devuelve 0 si no se
 * puede leer, nunca NaN: un monto ilegible no tiene que romper el tablero.
 */
function parseMonto_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const t = String(v == null ? '' : v).replace(/[^\d,.-]/g, '');
  if (!t) return 0;
  // Con coma, la coma es el decimal y los puntos son miles. Sin coma, los
  // puntos son miles igual ("34.647" son treinta y cuatro mil, no 34,647).
  const n = t.indexOf(',') > -1
    ? t.replace(/\./g, '').replace(',', '.')
    : t.replace(/\./g, '');
  const x = Number(n);
  return isFinite(x) ? x : 0;
}

/**
 * Sin PIN cargado en las propiedades, verificarPin_ devuelve false para
 * cualquier valor. Decir "PIN incorrecto" ahí manda a Atención al Cliente a
 * probar números para siempre, cuando lo que falta es configurarlo.
 */
function mensajePin_() {
  const guardado = PropertiesService.getScriptProperties().getProperty('PANEL_PIN');
  if (!guardado) {
    return 'El panel todavía no tiene PIN. Cargalo en Apps Script → Configuración ' +
           'del proyecto → Propiedades de la secuencia de comandos, en PANEL_PIN.';
  }
  return 'PIN incorrecto.';
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
