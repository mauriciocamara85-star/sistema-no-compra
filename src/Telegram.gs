/**
 * VDH · Sistema No Compra — el aviso por Telegram.
 *
 * ── Por qué Telegram y no (sólo) mail ──────────────────────────────────────
 * El mail del local no lo mira nadie. Un mensaje de Telegram suena en el
 * celular en el momento, que es cuando sirve: el cliente se acaba de ir y
 * todavía está a tiempo de recibir un WhatsApp.
 *
 * Va a un GRUPO, no a una persona. Atención al Cliente entra y sale del grupo
 * sin que haya que tocar ninguna configuración, y el que se suma ve el
 * historial de lo que pasó antes.
 *
 * Y el botón de WhatsApp funciona de verdad: en Telegram es un botón abajo
 * del mensaje que abre el chat con el cliente de un toque.
 *
 * ── Convive con el mail ────────────────────────────────────────────────────
 * No lo reemplaza: son dos avisos independientes y cada uno se prende solo.
 * Con NOTIFICAR_A vacío no hay mail; sin TELEGRAM_TOKEN o TELEGRAM_CHAT no
 * hay Telegram. Se pueden tener los dos, uno, o ninguno.
 *
 * ── Configuración ──────────────────────────────────────────────────────────
 *   TELEGRAM_TOKEN   el que devuelve @BotFather al crear el bot
 *   TELEGRAM_CHAT    el id del grupo (negativo) o de la persona
 *
 * El token es una llave: quien lo tenga puede escribir como el bot. Vive en
 * las propiedades del script y NUNCA se devuelve al navegador, igual que el
 * de Kommo. La pantalla de configuración lo escribe y no lo lee.
 *
 * No hace falta reautorizar el proyecto: `script.external_request` ya está
 * declarado en appsscript.json desde que existe el puente con Kommo.
 */

const TELEGRAM_URL = 'https://api.telegram.org/bot';

/** Dónde queda anotado el último error, para poder mostrarlo. */
const TELEGRAM_ERROR = 'TELEGRAM_ULTIMO_ERROR';

function telegramConfig_() {
  const p = PropertiesService.getScriptProperties();
  return {
    token: String(p.getProperty('TELEGRAM_TOKEN') || '').trim(),
    chat:  String(p.getProperty('TELEGRAM_CHAT') || '').trim()
  };
}

/** Apagado mientras falte cualquiera de los dos. */
function telegramActivo_() {
  const c = telegramConfig_();
  return !!(c.token && c.chat);
}

function telegramFetch_(token, metodo, cuerpo) {
  const opciones = {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true
  };
  if (cuerpo) opciones.payload = JSON.stringify(cuerpo);

  const res = UrlFetchApp.fetch(TELEGRAM_URL + token + '/' + metodo, opciones);
  const texto = res.getContentText();
  const datos = texto ? JSON.parse(texto) : null;

  if (!datos || !datos.ok) {
    /* Telegram contesta 200 con ok:false y el motivo adentro, así que mirar
       sólo el código HTTP no alcanza para saber si salió. */
    throw new Error((datos && datos.description) || ('Telegram respondió ' + res.getResponseCode()));
  }
  return datos.result;
}

/**
 * Manda el aviso de un registro nuevo.
 *
 * Nunca tumba la carga, por lo mismo que el mail y que Kommo: la planilla es
 * la fuente de verdad y el vendedor ya hizo su trabajo. Un error queda
 * anotado y la pantalla de configuración lo muestra, para que un aviso que
 * dejó de salir no se entere nadie recién dentro de un mes.
 */
function telegramEnviar_(data) {
  if (!telegramActivo_()) return;

  const c = telegramConfig_();

  try {
    const lineas = ['<b>Nuevo no-compra · ' + esc_(data.sucursal) + '</b>', ''];
    const poner = function (etiqueta, valor) {
      if (valor) lineas.push('<b>' + etiqueta + ':</b> ' + esc_(valor));
    };

    poner('Cliente', data.nombre);
    poner('WhatsApp', data.whatsapp);
    poner('Mail', data.mail);
    poner('Buscaba', data.producto);
    poner('Talle', data.talle);
    poner('Por qué se fue', data.motivo);
    poner('Vendedor', data.vendedor);
    if (data.obs) lineas.push('', '<i>' + esc_(data.obs) + '</i>');

    const mensaje = {
      chat_id: c.chat,
      text: lineas.join('\n'),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    };

    /* El botón es la razón de ser de todo esto: un toque y se abre el chat de
       WhatsApp con el cliente. Sin número no hay botón, pero el aviso sale
       igual: que falte el teléfono no puede hacer que nadie se entere.

       Se mira el TELÉFONO y no el link: linkWhatsapp_ nunca devuelve vacío
       —con la cadena vacía arma 'wa.me/549'—, así que preguntarle a él daría
       siempre que sí y el botón llevaría a un chat que no existe. */
    if (String(data.whatsapp || '').replace(/\D/g, '')) {
      const link = linkWhatsapp_(data.whatsapp);
      mensaje.reply_markup = {
        inline_keyboard: [[{ text: 'Escribirle por WhatsApp', url: link }]]
      };
    }

    telegramFetch_(c.token, 'sendMessage', mensaje);
    PropertiesService.getScriptProperties().deleteProperty(TELEGRAM_ERROR);

  } catch (err) {
    console.error('telegramEnviar_: ' + err.message);
    try {
      PropertiesService.getScriptProperties().setProperty(
        TELEGRAM_ERROR,
        Utilities.formatDate(new Date(), TZ, FORMATO_FECHA) + ' · ' + err.message
      );
    } catch (e) { /* si ni esto se puede guardar, queda en el log y listo */ }
  }
}

/**
 * Los chats donde está el bot, para elegir uno sin tener que saber qué es un
 * chat_id.
 *
 * **La trampa:** `getUpdates` sólo devuelve mensajes de las últimas 24 horas
 * y sólo si nadie leyó esos updates antes. Por eso la pantalla pide escribir
 * un mensaje en el grupo justo antes de buscar: sin un mensaje reciente, la
 * lista vuelve vacía aunque el bot esté bien puesto en el grupo.
 *
 * Devuelve los chats distintos que aparezcan, con su nombre, para que la
 * persona elija por nombre y el id quede adentro.
 */
function telegramChats_(token) {
  const updates = telegramFetch_(token, 'getUpdates', { limit: 100 }) || [];
  const vistos = {};
  const chats = [];

  updates.forEach(function (u) {
    const m = u.message || u.channel_post || u.my_chat_member;
    const chat = m && m.chat;
    if (!chat || vistos[chat.id]) return;
    vistos[chat.id] = true;

    const nombre = chat.title ||
      [chat.first_name, chat.last_name].filter(function (x) { return x; }).join(' ') ||
      chat.username || ('Chat ' + chat.id);

    chats.push({
      id: String(chat.id),
      nombre: nombre,
      // 'group' y 'supergroup' son grupos; 'private', una persona sola.
      grupo: chat.type !== 'private'
    });
  });

  return chats;
}

/**
 * Prueba manual desde el editor de Apps Script, para cuando algo no sale y
 * hay que saber si el problema es el token, el chat o el mensaje.
 */
function telegramProbar() {
  if (!telegramActivo_()) {
    console.log('Apagado: falta TELEGRAM_TOKEN o TELEGRAM_CHAT.');
    return;
  }
  telegramEnviar_({
    sucursal: 'PRUEBA',
    vendedor: 'Sistema',
    nombre:   'Cliente de prueba',
    whatsapp: '1122334455',
    producto: 'Campera de abrigo negra',
    talle:    '42',
    motivo:   'Sin talle',
    obs:      'Esto es una prueba: si lo ves en el grupo, el aviso funciona.'
  });
  const err = PropertiesService.getScriptProperties().getProperty(TELEGRAM_ERROR);
  console.log(err ? ('No salió: ' + err) : '✓ Mandado. Miralo en el grupo.');
}
