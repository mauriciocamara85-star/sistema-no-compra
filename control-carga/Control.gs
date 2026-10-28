/* ═══ VDH · Control de carga ═══════════════════════════════════════════════
   El mail de cada mañana con lo cargado en Ventas el día anterior: qué local no
   cargó la venta, el tráfico o el Informe por vendedor, qué números no cierran
   y qué números raros quedaron (SQL 185, ventas_control). Pedido de Mauricio
   (28/10/2026) para Cintia, que controla la carga de los locales.

   · Lo arma la base: este script sólo lo pide con la llave y lo manda por mail.
   · La llave está en Llave.gs (LLAVE_CONTROL), que NO va al repo (es público).
   · Para empezar (una sola vez, desde el editor): correr "activar". Pide los
     permisos, deja el mail programado todos los días a las HORA y manda uno de
     prueba a PRUEBA.
   · Para mandarlo ahora a PRUEBA: correr "probar".
   ══════════════════════════════════════════════════════════════════════════ */

var PARA = 'cintiacast15@gmail.com';
var COPIA = 'mauriciocamara85@gmail.com';    // más de uno: 'a@x.com, b@y.com'
var PRUEBA = 'mauriciocamara85@gmail.com';   // la prueba, y el aviso si algo falla
var HORA = 9;                                // hora de Argentina (el proyecto está en esa zona); para cambiarla, correr activar de nuevo
var BASE = 'https://gfjdjupuwxohkgchqykx.supabase.co';
var CLAVE = 'sb_publishable_A81zY5i4zCXZyIv2fOpokA_jOxiccNU';   // la pública, la misma de datos.js

/** Lo que corre todos los días. */
function mandarControl() { enviar_(PARA, COPIA); }

/** El mismo mail, ahora, sólo a PRUEBA. */
function probar() { enviar_(PRUEBA, ''); }

/** Una sola vez: programa el mail de todos los días y manda uno de prueba. */
function activar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'mandarControl') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('mandarControl').timeBased().atHour(HORA).nearMinute(0).everyDays(1).create();
  probar();
  Logger.log('Listo: el control sale todos los días a las ' + HORA + ' a ' + PARA + '. Te mandé uno de prueba a ' + PRUEBA + '.');
}

/** Para apagarlo. */
function desactivar() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'mandarControl') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Apagado: ya no sale el control de carga.');
}

function leer_(fecha) {
  var r = UrlFetchApp.fetch(BASE + '/rest/v1/rpc/ventas_control_mail', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: CLAVE },
    payload: JSON.stringify({ p_llave: LLAVE_CONTROL, p_fecha: fecha || null }),
    muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) {
    throw new Error('La base contestó ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
  }
  return JSON.parse(r.getContentText());
}

function enviar_(para, copia, fecha) {
  var c;
  try {
    c = leer_(fecha);
  } catch (e) {
    /* Si la base no contesta, el aviso va a PRUEBA (no a quien controla, que no puede arreglarlo). */
    MailApp.sendEmail({ to: PRUEBA, name: 'VDH · Control de carga',
      subject: 'VDH · Control de carga: hoy no se pudo armar',
      body: 'El control de carga de hoy no salió porque no se pudo leer la base.\n\n' + e.message });
    throw e;
  }
  var m = armarMail(c);
  var o = { to: para, subject: m.asunto, htmlBody: m.html, name: 'VDH · Control de carga' };
  if (copia) o.cc = copia;
  MailApp.sendEmail(o);
}

/* ─── El mail (sin nada de Google: se prueba también fuera de Apps Script) ─── */

function armarMail(c) {
  var locales = c.locales || [];
  var conAlgo = locales.filter(function (l) { return (l.problemas || []).length > 0; });
  var asunto = 'VDH · Control de carga del ' + c.dia + ' — ' +
    (conAlgo.length === 0 ? 'todo en orden' : conAlgo.length + (conAlgo.length === 1 ? ' local para revisar' : ' locales para revisar'));

  var ok = '#15803D', mal = '#B91C1C', ojo = '#B45309', gris = '#6B7280', linea = '#E5E7EB';
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function pesos(n) {
    var s = String(Math.round(Number(n) || 0)), out = '';
    while (s.length > 3) { out = '.' + s.slice(-3) + out; s = s.slice(0, -3); }
    return '$' + s + out;
  }
  function marca(color, txt) { return '<span style="color:' + color + ';font-weight:bold">' + txt + '</span>'; }
  var ETIQ = { falta: ['Falta', mal, '#FEE2E2'], revisar: ['Revisar', ojo, '#FEF3C7'], ojo: ['Ojo', '#1D4ED8', '#DBEAFE'] };

  var h = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;max-width:760px">' +
    '<div style="background:#0B0B0C;color:#fff;padding:14px 18px;border-radius:8px 8px 0 0">' +
      '<div style="font-size:12px;letter-spacing:2px;color:#D4AF37;font-weight:bold">VDH · CONTROL DE CARGA</div>' +
      '<div style="font-size:20px;font-weight:bold;margin-top:4px">Ventas del ' + esc(c.dia) + '</div>' +
    '</div>' +
    '<div style="border:1px solid ' + linea + ';border-top:0;padding:14px 18px;border-radius:0 0 8px 8px">' +
    '<p style="margin:0 0 12px;font-size:15px">' +
      (conAlgo.length === 0
        ? marca(ok, '✔ Todo cargado y en orden.')
        : 'Hay <b>' + conAlgo.length + (conAlgo.length === 1 ? ' local' : ' locales') + '</b> con algo para revisar (abajo, el detalle).') +
    '</p>';

  /* Cuatro columnas y quién cargó abajo del local: en el celular entra entera. */
  var td = '<td style="padding:7px 5px;white-space:nowrap">';
  h += '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">' +
    '<tr style="background:#F3F4F6;text-align:left"><th style="padding:7px 5px">Local</th><th style="padding:7px 5px">Venta</th>' +
    '<th style="padding:7px 5px">Tráfico</th><th style="padding:7px 5px">Informe</th></tr>';
  locales.forEach(function (l) {
    var trabajo = l.abre || Number(l.venta) > 0 || Number(l.trafico) > 0;
    var venta, trafico, informe;
    if (!trabajo) {
      venta = trafico = informe = '<span style="color:' + gris + '">No abre</span>';
    } else {
      venta = Number(l.venta) > 0 ? pesos(l.venta) : marca(mal, '✖ falta');
      trafico = l.trafico == null ? marca(mal, '✖ falta') : l.trafico_mal ? marca(ojo, '⚠ ' + esc(l.trafico)) : esc(l.trafico);
      informe = l.informe === 'ok' ? marca(ok, '✔') : l.informe === 'falta' ? marca(mal, '✖ falta')
              : l.informe === 'revisar' ? marca(ojo, '⚠ revisar') : '<span style="color:' + gris + '">—</span>';
    }
    h += '<tr style="border-top:1px solid ' + linea + '">' +
      '<td style="padding:7px 5px"><b>' + esc(l.local) + '</b>' +
        (l.cargo ? '<div style="color:' + gris + ';font-size:11px;margin-top:2px">' + esc(l.cargo) + (l.cuando ? ' · ' + esc(l.cuando) : '') + '</div>' : '') + '</td>' +
      td + venta + '</td>' + td + trafico + '</td>' + td + informe + '</td></tr>';
  });
  h += '</table>';

  if (conAlgo.length) {
    h += '<h3 style="margin:22px 0 6px;font-size:16px">Qué revisar</h3>';
    conAlgo.forEach(function (l) {
      h += '<div style="margin:12px 0 4px;font-weight:bold">' + esc(l.local) + '</div>';
      l.problemas.forEach(function (p) {
        var e = ETIQ[p.g] || ETIQ.revisar;
        h += '<div style="margin:4px 0 4px 2px;line-height:1.45">' +
          '<span style="display:inline-block;min-width:54px;text-align:center;font-size:11px;font-weight:bold;color:' + e[1] +
          ';background:' + e[2] + ';border-radius:4px;padding:1px 6px;margin-right:6px">' + e[0] + '</span>' + esc(p.t) + '</div>';
      });
    });
  }

  h += '<p style="color:' + gris + ';font-size:12px;margin:22px 0 0;line-height:1.5">' +
    'Lo arma el Sistema VDH con lo cargado en Ventas (semana ' + esc(c.semana) + '). Llega todos los días a las ' + HORA + '. ' +
    '<b>Informe</b>: el Informe por vendedor de la semana. <b>Falta</b>: no está cargado. <b>Revisar</b>: los números no cierran o son raros. <b>Ojo</b>: algo para mirar.</p>' +
    '</div></div>';
  return { asunto: asunto, html: h };
}
