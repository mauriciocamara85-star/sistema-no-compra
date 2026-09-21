/**
 * VDH · Sistema No Compra — el recordatorio de la mañana.
 *
 * Todos los días, temprano, cae en el grupo de Telegram un mensaje corto:
 * cuántos entraron ayer y a cuántos falta contestarles.
 *
 * ── Por qué existe ─────────────────────────────────────────────────────────
 * El sistema se murió la primera vez del lado del seguimiento: 139 registros
 * cargados y 8 trabajados. El número de pendientes SIEMPRE estuvo disponible
 * —lo único que había que hacer era abrir el panel—, y eso fue exactamente el
 * problema: **lo que hay que ir a buscar no se mira.**
 *
 * La pantalla de Resultados lo mide y el aviso de cada carga lo notifica, pero
 * ninguno de los dos le dice a nadie "hoy te faltan seis". Esto sí.
 *
 * ── Por qué es un recordatorio y no un informe ─────────────────────────────
 * Dos números y un botón. Nada de porcentajes, plata ni comparaciones contra
 * el mes pasado: eso está en Resultados para el que lo quiera. Un informe
 * diario se lee tres días y después se saltea; un recordatorio de dos
 * renglones se lee siempre.
 *
 * Y por lo mismo: **si no hay nada que hacer ni nada que contar, no manda
 * nada.** Un mensaje diario que dice "cero y cero" enseña a ignorar el grupo,
 * y el día que diga algo importante ya nadie lo va a estar leyendo.
 */

/** A qué hora sale. Temprano, antes de que abran los locales. */
const RECORDATORIO_HORA = 9;

/**
 * "$ 1.670.000". A mano y no con toLocaleString: el formato de la plata es de
 * las cosas que no pueden depender de qué biblioteca de idiomas tenga cargada
 * el servidor ese día.
 */
function pesos_(n) {
  const entero = Math.round(Number(n) || 0);
  return '$ ' + String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Un pendiente se pone viejo a los 3 días, igual que en el panel. */
const RECORDATORIO_DIAS = 3;

/**
 * Cuenta lo de ayer y lo que está esperando. Una sola pasada por la planilla.
 *
 * "Ayer" es el día calendario anterior, no las últimas 24 horas: el mensaje
 * sale a la mañana y tiene que hablar de la jornada que cerró, no de un
 * pedazo de hoy.
 */
function recordatorioNumeros_() {
  const hoja = getHoja_();
  const inicio = getFilaEncabezado_(hoja) + 1;
  const ultima = hoja.getLastRow();

  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  // Lo del mes en curso, que es el acumulado que mira el dueño.
  const arrancaMes = cortes_().mes;
  let mesCargados = 0, mesCompraron = 0, mesPlata = 0;

  let ayer = 0, total = 0, pendientes = 0, viejos = 0, dias = 0;

  if (ultima >= inicio) {
    const ancho = Math.min(ANCHO, hoja.getMaxColumns());
    hoja.getRange(inicio, 1, ultima - inicio + 1, ancho).getValues().forEach(function (f) {
      if (!f[COL.FECHA] && !f[COL.WHATSAPP]) return;
      if (antesDelArranque_(f[COL.FECHA])) return;

      total++;
      const cuando = parseFecha_(f[COL.FECHA]);
      if (cuando && cuando >= desde && cuando < hasta) ayer++;

      /* El mes se corta por la fecha del REGISTRO, no por la de la venta: la
         planilla no guarda cuándo se cerró la compra. "Este mes" quiere decir
         "de lo que entró este mes, esto ya volvió", que es la única pregunta
         que los datos pueden contestar sin inventar nada. Mismo criterio que
         el tablero del local. */
      const delMes = !!cuando && cuando >= arrancaMes;
      if (delMes) {
        mesCargados++;
        if (String(f[COL.COMPRO] || '').trim().indexOf('Sí') === 0) {
          mesCompraron++;
          mesPlata += parseMonto_(f[COL.MONTO]);
        }
      }

      // Pendiente es lo mismo que en el panel: nadie le puso estado ni marcó
      // que se contactó.
      const estado = String(f[COL.ESTADO] || '').trim();
      const contactado = String(f[COL.CONTACTAMOS] || '').trim().toLowerCase() === 'si';
      if (estado || contactado) return;

      pendientes++;
      const espera = cuando ? Math.floor((Date.now() - cuando.getTime()) / 86400000) : 0;
      if (espera >= RECORDATORIO_DIAS) viejos++;
      if (espera > dias) dias = espera;
    });
  }

  return {
    ayer: ayer,
    total: total,
    // A cuántos ya les escribieron. Es el mismo criterio que el pendiente,
    // dado vuelta: el trabajo hecho, no el que falta.
    contactados: total - pendientes,
    pendientes: pendientes,
    viejos: viejos,
    dias: dias,
    mes: { cargados: mesCargados, compraron: mesCompraron, plata: mesPlata }
  };
}

/**
 * Arma y manda el mensaje. Es el que corre el disparador cada mañana.
 *
 * Se puede correr a mano desde el editor para ver qué diría hoy.
 */
function recordatorioDiario() {
  if (typeof telegramActivo_ !== 'function' || !telegramActivo_()) {
    console.log('El aviso por Telegram está apagado: no hay a dónde mandarlo.');
    return;
  }

  let n;
  try {
    n = recordatorioNumeros_();
  } catch (err) {
    console.error('recordatorioDiario: ' + err.message);
    return;
  }

  /* Silencio cuando no hay nada. Ver la cabecera: un "cero y cero" diario
     entrena a saltearse el grupo. */
  if (!n.ayer && !n.pendientes) {
    console.log('Ni entradas ayer ni pendientes: no se manda nada.');
    return;
  }

  const lineas = ['<b>Buen día.</b>', ''];

  lineas.push(n.ayer
    ? ((n.ayer === 1 ? 'Ayer entró <b>1</b> no-compra' : 'Ayer entraron <b>' + n.ayer + '</b> no-compra') + '.')
    : 'Ayer no entró ningún registro.');

  /* El trabajo HECHO va antes que el que falta, y es deliberado. Este mensaje
     lo leen el dueño y el que atiende: si arranca por la deuda, todos los días
     es un reclamo. Arrancando por lo hecho, el que atendió a veinte ve que se
     ve, y el que falta también. */
  if (n.contactados) {
    lineas.push(n.contactados === n.total
      ? ('Se les escribió a <b>los ' + n.total + '</b>.')
      : ('Se les escribió a <b>' + n.contactados + '</b> de ' + n.total + '.'));
  }

  if (n.pendientes) {
    let falta = 'Falta contestarle a <b>' + n.pendientes +
                (n.pendientes === 1 ? '</b> cliente' : '</b> clientes');
    if (n.viejos) {
      falta += ', ' + (n.viejos === 1 ? 'uno' : n.viejos) + ' de ellos hace más de ' +
               RECORDATORIO_DIAS + ' días';
      if (n.dias > RECORDATORIO_DIAS) {
        falta += ' (el más viejo lleva ' + n.dias + ' días)';
      }
    }
    lineas.push(falta + '.');
  } else if (n.total) {
    lineas.push('No quedó nadie esperando.');
  }

  /* El acumulado del mes, separado del resto: es la única línea que no le
     pide nada a nadie. Contesta para qué sirvió todo lo de arriba, que es lo
     que mira el dueño.

     Aparece recién cuando hay una venta. Un "0 volvieron · $ 0" todas las
     mañanas del primer mes no informa nada y desanima a los que sí están
     haciendo el trabajo de cargar y llamar. */
  if (n.mes.compraron) {
    lineas.push('');
    lineas.push('Este mes: <b>' + n.mes.compraron + '</b> de ' + n.mes.cargados +
                ' volvieron a comprar · <b>' + pesos_(n.mes.plata) + '</b> recuperados.');
  }

  const c = telegramConfig_();
  try {
    telegramFetch_(c.token, 'sendMessage', {
      chat_id: c.chat,
      text: lineas.join('\n'),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      // El botón es lo que convierte el recordatorio en una acción: se toca y
      // ya está adentro de la lista que hay que trabajar.
      reply_markup: {
        inline_keyboard: [[{ text: 'Abrir el panel', url: SITIO + 'panel.html' }]]
      }
    });
    console.log('✓ Mandado: ' + lineas.join(' | '));
  } catch (err) {
    console.error('recordatorioDiario: no salió — ' + err.message);
  }
}

/**
 * Correr UNA VEZ desde el editor. Deja el recordatorio andando todas las
 * mañanas y manda uno en el momento, para no tener que esperar a mañana para
 * saber si funciona.
 */
function instalarRecordatorio() {
  quitarRecordatorio();

  ScriptApp.newTrigger('recordatorioDiario')
    .timeBased()
    .atHour(RECORDATORIO_HORA)
    .everyDays(1)
    .inTimezone(TZ)
    .create();

  console.log('✓ Recordatorio instalado: todos los días alrededor de las ' +
              RECORDATORIO_HORA + ' de la mañana.');
  console.log('Mandando uno ahora para probar…');
  recordatorioDiario();
}

/** Apaga el recordatorio diario. El aviso de cada carga sigue igual. */
function quitarRecordatorio() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'recordatorioDiario') ScriptApp.deleteTrigger(t);
  });
}
