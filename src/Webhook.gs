/**
 * VDH · Sistema No Compra — la vuelta del CRM
 *
 * Hasta acá el camino era de ida: el vendedor carga, la fila entra en la
 * planilla y de ahí sale el lead a Kommo. El resultado —si el cliente al
 * final compró y por cuánta plata— quedaba a cargo de que alguien lo
 * escribiera A MANO en las columnas T y V. De 93 registros, se completó en
 * 9. Por eso la tarjeta de "Recuperado" mostraba cero aunque hubiera ventas.
 *
 * Esto es la vuelta. Cuando Atención al Cliente mueve el lead a otra etapa en
 * Kommo, Kommo avisa acá y el backend escribe solo el Estado (R), el Compró?
 * (T) y el Monto (V). Nadie carga nada dos veces.
 *
 * ── Cómo se prende ────────────────────────────────────────────────────────
 * 1. Desde el editor de Apps Script, correr urlWebhook() UNA vez. Genera el
 *    token y escribe en el log la dirección completa que hay que pegar.
 * 2. En Kommo: Ajustes → Integraciones → la integración "Sistema No Compra" →
 *    Webhooks → agregar esa dirección con el evento "Estado del lead
 *    cambiado".
 *
 * ── Por qué el token va en la dirección ───────────────────────────────────
 * Los webhooks de Kommo no mandan encabezados propios, así que no hay dónde
 * poner una clave salvo en la URL. La aplicación web está publicada como
 * ANYONE_ANONYMOUS —tiene que estarlo para que la usen los locales—, o sea
 * que sin token cualquiera que adivine la dirección podría marcar ventas
 * falsas. El token vive en las propiedades del script, nunca en el repo.
 *
 * ── Regla de oro, la misma de siempre ─────────────────────────────────────
 * Esto NUNCA puede romper una carga ni escribir de más. Si el lead no se
 * puede ubicar en la planilla, no se toca ninguna fila y queda en el log.
 */

/** La dirección publicada de la app web. Ya es pública: vive en comun.js. */
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxI373Id-FVEbyhErLlM5wvvyVApwdEBl2tmg_WfVgvXXpdy6ZgGDB0fGdHBQFHMVqu/exec';

/**
 * Las dos etapas que Kommo no deja renombrar, traducidas al vocabulario de la
 * planilla. El resto de las etapas del embudo se llaman IGUAL que los estados
 * de la planilla —están calcadas a propósito—, así que se traducen solas.
 */
const ETAPAS_TRADUCIDAS = {
  'closed - won':  'Cerrado - compró',
  'closed - lost': 'Cerrado - no compró'
};

// ── Puesta en marcha ───────────────────────────────────────────────────────
/**
 * Correr UNA vez desde el editor. Genera el token si no existe y escribe en
 * el log la dirección para pegar en Kommo. No cambia nada más.
 */
function urlWebhook() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty('WEBHOOK_TOKEN');

  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('WEBHOOK_TOKEN', token);
    console.log('Token nuevo generado y guardado en las propiedades del script.');
  }

  const url = ENDPOINT + '?t=' + token;
  console.log('Pegá esta dirección en Kommo → Ajustes → Integraciones →\n' +
              'Sistema No Compra → Webhooks, con el evento "Estado del lead cambiado":\n\n' +
              url + '\n');
  return url;
}

// ── Entrada ────────────────────────────────────────────────────────────────
/**
 * ¿Este POST es un webhook de Kommo y no la interfaz?
 *
 * Kommo no manda JSON: manda un formulario con claves anidadas del tipo
 * `leads[status][0][id]`. La interfaz manda JSON con un campo `accion`. Se
 * distinguen por eso, y hay que preguntarlo ANTES de parsear, porque un
 * JSON.parse sobre un formulario tira excepción.
 */
function esWebhookKommo_(e) {
  if (!e || !e.parameter) return false;
  return Object.keys(e.parameter).some(function (k) { return k.indexOf('leads[') === 0; });
}

/**
 * Atiende el aviso de Kommo. Siempre contesta 200 con un JSON: un webhook que
 * recibe error se reintenta solo, y reintentar algo que ya se aplicó no
 * arregla nada.
 */
function recibirWebhookKommo_(e) {
  const responder = function (o) {
    return ContentService.createTextOutput(JSON.stringify(o))
      .setMimeType(ContentService.MimeType.JSON);
  };

  const esperado = PropertiesService.getScriptProperties().getProperty('WEBHOOK_TOKEN');
  if (!esperado) {
    console.error('Webhook: llegó un aviso pero no hay WEBHOOK_TOKEN configurado. Correr urlWebhook().');
    return responder({ status: 'error', msg: 'Webhook sin configurar.' });
  }
  if (String(e.parameter.t || '') !== esperado) {
    console.error('Webhook: token incorrecto. Aviso ignorado.');
    return responder({ status: 'error', msg: 'No autorizado.' });
  }

  let aplicados = 0;
  try {
    const leads = leadsDelAviso_(e.parameter);
    leads.forEach(function (lead) {
      if (aplicarEstadoKommo_(lead)) aplicados++;
    });
    console.log('Webhook: ' + leads.length + ' aviso(s), ' + aplicados + ' aplicado(s) en la planilla.');
  } catch (err) {
    console.error('Webhook: ' + err.stack);
    return responder({ status: 'error', msg: err.message });
  }

  return responder({ status: 'ok', aplicados: aplicados });
}

/**
 * Desarma el formulario de Kommo en objetos de lead.
 *
 * Llega aplanado —`leads[status][0][id]`, `leads[status][0][price]`…— y puede
 * traer varios leads y varios tipos de evento en el mismo aviso. Se agrupan
 * por tipo e índice para no mezclar el id de uno con el precio de otro.
 */
function leadsDelAviso_(parametros) {
  const juntados = {};

  Object.keys(parametros).forEach(function (clave) {
    const m = clave.match(/^leads\[([a-z_]+)\]\[(\d+)\]\[([a-z_]+)\]$/i);
    if (!m) return;
    const id = m[1] + '#' + m[2];
    juntados[id] = juntados[id] || {};
    juntados[id][m[3]] = parametros[clave];
  });

  return Object.keys(juntados)
    .map(function (k) { return juntados[k]; })
    .filter(function (l) { return l.id; });
}

// ── Aplicar el resultado ───────────────────────────────────────────────────
/**
 * Escribe en la planilla lo que pasó con un lead.
 *
 * Sólo toca tres celdas y sólo cuando tiene algo que decir:
 *   R  Estado Actual   con el nombre de la etapa, traducido al vocabulario
 *   T  Compró?         nada más al ganar o perder
 *   V  Monto Venta     nada más si el lead trae un monto mayor a cero
 *
 * Lo que el equipo escribió a mano en las OTRAS columnas del seguimiento no
 * se toca nunca: el CRM manda sobre el resultado, no sobre las anotaciones
 * de nadie.
 *
 * @return {boolean} si se escribió algo
 */
function aplicarEstadoKommo_(lead) {
  // Los movimientos de los OTROS embudos —Ventas, Tiendanube— llegan al mismo
  // webhook y no son de este sistema. Se descartan acá, antes de leer la
  // planilla y antes de preguntarle nada a Kommo: sin este filtro, cada lead
  // ajeno que alguien mueva cuesta dos llamadas a la API buscando un teléfono
  // que nunca va a estar en la planilla.
  if (!esDelEmbudo_(lead)) return false;

  const fila = filaDelLead_(lead.id);
  if (!fila) {
    console.log('Webhook: el lead ' + lead.id + ' no está en la planilla. No se tocó nada.');
    return false;
  }

  const estado = estadoDeEtapa_(lead.status_id);
  if (!estado) {
    console.log('Webhook: la etapa ' + lead.status_id + ' no corresponde a ningún estado de la planilla.');
    return false;
  }

  const hoja = getHoja_();
  const anotado = ['Estado: ' + estado];
  hoja.getRange(fila, COL.ESTADO + 1).setValue(estado);

  if (estado === 'Cerrado - compró') {
    // Kommo no deja tener dos etapas de "ganado" ni renombrar la que trae, así
    // que la venta en el local y la online no se pueden distinguir por etapa.
    // Se asume LOCAL, que es el caso de este sistema —el cliente estuvo
    // parado en el mostrador—, y si fue online se corrige a mano. Mismo
    // criterio que usa el panel al contar: ante la duda, no inflar el online.
    hoja.getRange(fila, COL.COMPRO + 1).setValue('Sí - local');
    anotado.push('Compró: Sí - local');

    // El monto sale del "Presupuesto" del lead. En cero no se escribe: sería
    // pisar con un cero el importe que alguien pudo haber cargado a mano.
    const monto = Number(String(lead.price || '0').replace(/[^\d.-]/g, ''));
    if (monto > 0) {
      hoja.getRange(fila, COL.MONTO + 1).setValue(monto);
      anotado.push('Monto: ' + monto);
    }
  }

  if (estado === 'Cerrado - no compró') {
    hoja.getRange(fila, COL.COMPRO + 1).setValue('No');
    anotado.push('Compró: No');
  }

  // Las tarjetas del local tienen que mostrar la plata recién recuperada sin
  // esperar a que venza el caché.
  const sucursal = hoja.getRange(fila, COL.SUCURSAL + 1).getValue();
  if (typeof olvidarMetricas_ === 'function') olvidarMetricas_(sucursal);

  console.log('Webhook: lead ' + lead.id + ' → fila ' + fila + '. ' + anotado.join(' · '));
  return true;
}

/**
 * ¿Este lead es del embudo del sistema?
 *
 * Si no hay embudo configurado (KOMMO_PIPELINE_ID vacío) no se filtra nada:
 * es el caso de una cuenta con un solo embudo, donde todo lo que llega es de
 * acá. Tampoco se filtra si el aviso no dice de qué embudo viene, porque
 * descartar por falta de dato sería perder ventas de verdad.
 */
function esDelEmbudo_(lead) {
  const propio = PropertiesService.getScriptProperties().getProperty('KOMMO_PIPELINE_ID');
  if (!propio || !lead.pipeline_id) return true;
  return String(lead.pipeline_id).trim() === String(propio).trim();
}

/**
 * En qué fila de la planilla vive un lead.
 *
 * Primero por el id de Kommo, que se guarda en la columna AA cuando se crea
 * el lead: es una coincidencia exacta y no se equivoca nunca.
 *
 * Los registros cargados ANTES de que existiera esa columna no lo tienen, así
 * que como segundo intento se le pregunta el teléfono a Kommo y se busca por
 * ahí. Se comparan los últimos 8 dígitos porque la planilla guarda
 * "2234979871" y Kommo "+5492234979871": el prefijo internacional lo agrega
 * el puente, el número es el mismo.
 *
 * @return {number} fila, o 0 si no se pudo ubicar
 */
function filaDelLead_(leadId) {
  const hoja = getHoja_();
  const inicio = getFilaEncabezado_(hoja) + 1;
  const ultima = hoja.getLastRow();
  if (ultima < inicio) return 0;

  const ancho = Math.min(ANCHO, hoja.getMaxColumns());
  const filas = hoja.getRange(inicio, 1, ultima - inicio + 1, ancho).getValues();
  const buscado = String(leadId).trim();

  for (let i = 0; i < filas.length; i++) {
    if (String(filas[i][COL.LEAD] || '').trim() === buscado) return inicio + i;
  }

  const tel = (typeof kommoTelefonoDeLead_ === 'function') ? kommoTelefonoDeLead_(leadId) : '';
  const cola = soloDigitos_(tel).slice(-8);
  if (cola.length < 8) return 0;

  for (let i = 0; i < filas.length; i++) {
    if (soloDigitos_(filas[i][COL.WHATSAPP]).slice(-8) === cola) return inicio + i;
  }
  return 0;
}

/**
 * El nombre de la etapa de Kommo, traducido al vocabulario de la planilla.
 *
 * Se traduce por NOMBRE y no por id a propósito: los ids son distintos en
 * cada cuenta y el día que alguien recree una etapa, hardcodearlos rompería
 * el puente en silencio. Los nombres, en cambio, están calcados del
 * VOCAB.ESTADO de la planilla desde que se armó el embudo.
 *
 * @return {string} un valor de VOCAB.ESTADO, o '' si esa etapa no representa
 *                  ningún estado (por ejemplo "Sin contactar", que es
 *                  justamente un registro que todavía nadie tocó)
 */
function estadoDeEtapa_(statusId) {
  const nombre = (typeof etapasKommo_ === 'function') ? etapasKommo_()[String(statusId)] : '';
  if (!nombre) return '';

  const k = kommoClave_(nombre);
  if (ETAPAS_TRADUCIDAS[k]) return ETAPAS_TRADUCIDAS[k];

  const igual = VOCAB.ESTADO.filter(function (v) { return kommoClave_(v) === k; })[0];
  return igual || '';
}

/** Deja sólo los números de un teléfono, venga como venga. */
function soloDigitos_(v) {
  return String(v == null ? '' : v).replace(/\D/g, '');
}
