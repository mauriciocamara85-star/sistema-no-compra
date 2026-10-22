/**
 * Equipo VDH (antes "Impecable") · la app de los vendedores (y del supervisor del local).
 *
 * Usa impecable-comun.js (sesión, base, fotos, fechas) y, de datos.js,
 * BASE, CLAVE, pedir() y funcion().
 *
 * ── El login ──────────────────────────────────────────────────────────────
 * Local → nombre → PIN de 4 números, UNA vez por celular. La primera vez
 * cada uno CREA su PIN (lo pone dos veces); el que no está en la lista se da
 * de alta solo (nombre y apellido) y queda como vendedor de ese local. El PIN
 * lo revisa la Edge Function "entrar" (freno: 5 mal seguidos y 5 minutos de
 * espera, por persona) y devuelve una sesión de Supabase, que se guarda acá y
 * se renueva sola. "No soy yo" la cierra y vuelve a la lista.
 *
 * ── Qué ve cada uno ──────────────────────────────────────────────────────
 * Vendedor: Hoy · Tareas · Ideas · Perfil (y la Caja, si el local la usa).
 * Supervisor, administrador y gerencia: Revisar · Equipo · Cajas · Ideas ·
 * Perfil. La gerencia mira y no cambia nada. Qué datos ve cada uno lo decide
 * la base (RLS), no esta pantalla.
 */

var app = document.getElementById('app');
var barra = document.getElementById('barra');
var cartel = document.getElementById('cartel');

var _cartelTimer = null;
function avisar(texto) {
  cartel.textContent = texto;
  cartel.hidden = false;
  clearTimeout(_cartelTimer);
  _cartelTimer = setTimeout(function () { cartel.hidden = true; }, 3500);
}

function pantallaError(e, reintentar) {
  if (e && e.sinSesion) { guardarVend_(null); pantallaLocales(e.message); return; }
  barra.hidden = !_vend;
  app.innerHTML =
    '<p class="marca"><b>Equipo</b> VDH</p>' +
    '<h1>' + (esDeRed(e) ? 'Sin conexión' : 'Algo falló') + '</h1>' +
    '<p class="bajada">' + esc(esDeRed(e) ? 'No hay señal o internet anda lento. Probá de nuevo en un rato.' : mensajeDe(e)) + '</p>' +
    '<button class="boton lima" id="reintentar">Probar de nuevo</button>';
  document.getElementById('reintentar').onclick = reintentar;
}

/** Un botón que no se puede tocar dos veces mientras su acción está en camino. */
function unaVez(boton, accion) {
  boton.onclick = function () {
    if (boton.disabled) return;
    var texto = boton.textContent;
    boton.disabled = true;
    Promise.resolve().then(accion).then(function () {
      if (document.body.contains(boton)) { boton.disabled = false; boton.textContent = texto; }
    }, function (e) {
      if (document.body.contains(boton)) { boton.disabled = false; boton.textContent = texto; }
      if (e && e.sinSesion) { pantallaError(e); return; }
      avisar(esDeRed(e) ? 'Sin señal: no se hizo. Probá de nuevo.' : mensajeDe(e));
    });
  };
}

/* Las preguntas van en una ventanita de la app: la del navegador muestra
   arriba la dirección de la página ("mauriciocamara85-star.github.io dice").
   op: { texto, campo (si pide un texto: lo que dice adentro), opcional, si, no }.
   Devuelve una promesa: sin campo, true o false; con campo, el texto (sin
   espacios de más) o null si se cancela. */
function preguntar(op) {
  return new Promise(function (listo) {
    var conCampo = op.campo != null;
    /* Una sola a la vez: un segundo toque no abre otra encima. */
    if (document.querySelector('.dialogo-capa')) { listo(conCampo ? null : false); return; }
    var capa = document.createElement('div');
    capa.className = 'dialogo-capa' + (conCampo ? ' con-campo' : '');
    capa.innerHTML = '<div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="dialogoTexto">' +
      '<p class="dialogo-texto" id="dialogoTexto">' + esc(op.texto) + '</p>' +
      (conCampo ? '<textarea class="dialogo-campo" rows="3" maxlength="500" placeholder="' + esc(op.campo) + '"></textarea>' : '') +
      '<div class="dialogo-botones"><button type="button" class="boton" data-r="no">' + esc(op.no || 'Cancelar') + '</button>' +
      '<button type="button" class="boton lima" data-r="si">' + esc(op.si || 'Aceptar') + '</button></div></div>';
    document.body.appendChild(capa);
    var campo = capa.querySelector('.dialogo-campo');
    var cerrada = false;
    /* El "atrás" de Android (o cambiar de pantalla) la cierra como "Cancelar". */
    var alAtras = function () { cerrar(conCampo ? null : false, true); };
    abrirCapa(alAtras);
    function cerrar(r, sinHistoria) {
      if (cerrada) return;
      cerrada = true;
      document.removeEventListener('keydown', tecla, true);
      capa.remove();
      if (!sinHistoria) soltarCapa(alAtras);
      listo(r);
    }
    function no() { cerrar(conCampo ? null : false); }
    function si() {
      if (!conCampo) { cerrar(true); return; }
      var t = campo.value.trim();
      if (!t && !op.opcional) { campo.classList.add('falta'); campo.focus(); return; }
      cerrar(t);
    }
    function tecla(e) { if (e.key === 'Escape') { e.preventDefault(); no(); } }
    document.addEventListener('keydown', tecla, true);
    capa.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-r]') : null;
      if (b) { if (b.dataset.r === 'si') si(); else no(); return; }
      /* Tocar afuera cierra, salvo que ya haya algo escrito. */
      if (e.target === capa && !(campo && campo.value.trim())) no();
    });
    (campo || capa.querySelector('[data-r="si"]')).focus();
  });
}
/** Pide un texto en una ventanita: el texto, o null si cancela. */
function preguntarTexto(titulo, opcional) {
  return preguntar({ texto: titulo, campo: opcional ? 'Opcional' : 'Escribilo acá', opcional: !!opcional, si: 'Listo' });
}
/** ¿Sí o no?, en una ventanita: true o false. */
function confirmar(texto, si) { return preguntar({ texto: texto, si: si || 'Sí', no: 'No' }); }

/* El "atrás" de Android cierra lo que está encima (una ventanita, la foto
   grande, los avisos, el perfil) en vez de salir de la app. Mientras haya
   algo encima hay UNA sola marca en el historial (nunca se acumulan): el
   "atrás" la saca y cierra lo de más arriba; si queda algo, se vuelve a
   poner. Cuando lo de encima se cierra con un botón o al cambiar de
   pantalla, la marca se saca sola, así ningún "atrás" queda sin hacer nada. */
var _capas = [], _marca = false, _quitando = 0;
function ponerMarca() {
  if (_marca) return;
  try { history.pushState({ vdhCapa: true }, ''); _marca = true; } catch (e) {}
}
function sacarMarca() {
  if (!_marca) return;
  _marca = false;
  _quitando++;
  try { history.back(); } catch (e) { _quitando--; }
}
function abrirCapa(alAtras) { _capas.push(alAtras); ponerMarca(); }
/** Se cerró con un botón de la app. */
function soltarCapa(alAtras) {
  var i = _capas.lastIndexOf(alAtras);
  if (i > -1) _capas.splice(i, 1);
  if (!_capas.length) sacarMarca();
}
/** Hace fn cuando terminó el "atrás" que la app pidió al cerrar algo (es asincrónico).
    Abrir enseguida una pantalla completa pondría su marca antes, y ese "atrás"
    atrasado se la comería: al salir, la app haría un "atrás" de más (y se cerraría). */
function despuesDelAtras(fn) {
  var desde = Date.now();
  (function mirar() { if (!_quitando || Date.now() - desde > 800) fn(); else setTimeout(mirar, 20); })();
}
/** Al cambiar de pantalla se cierra todo lo que estaba encima. */
function cerrarCapas() {
  _capas.splice(0).reverse().forEach(function (c) { try { c(true); } catch (e) {} });
  sacarMarca();
}
/* En las pantallas completas (sin la barra de abajo: la cámara y la revisión
   de la foto, el producto testigo, el test, los pasos de la entrada, las del
   supervisor), el "atrás" de Android hace lo mismo que su "‹ Volver" (o
   "Cerrar", o "Volver a Hoy"). Se mira cada vez que cambia la pantalla. */
var _capaPantalla = null, _mirandoAtras = false;
function botonVolver() { return app.querySelector('#volver, #cerrar, #fin, #volverMapa'); }
function revisarAtras() {
  _mirandoAtras = false;
  var hace = barra.hidden && !!botonVolver();
  if (hace && !_capaPantalla) {
    _capaPantalla = function (porNavegar) {
      _capaPantalla = null;
      if (porNavegar) return;
      var b = botonVolver();
      if (b) b.click();
    };
    abrirCapa(_capaPantalla);
  } else if (!hace && _capaPantalla) {
    var c = _capaPantalla;
    _capaPantalla = null;
    soltarCapa(c);
  }
}
new MutationObserver(function () {
  if (_mirandoAtras) return;
  _mirandoAtras = true;
  Promise.resolve().then(revisarAtras);
}).observe(app, { childList: true });

window.addEventListener('popstate', function () {
  if (_quitando) { _quitando--; return; }   // la sacó la app
  _marca = false;
  /* Un aviso tocado llega con #/tareas y también pasa por acá: de eso se
     ocupa hashchange (que cierra lo de encima y lleva adonde dice). */
  if (/^#\/./.test(location.hash)) return;
  var c = _capas.pop();
  if (c) { c(false); if (_capas.length) ponerMarca(); }
});
/** Un festejo: papelitos de colores que caen y un cartel (si acertaste todo el test, si terminaste lo del día). */
var _ultimoFestejo = 0;
function festejar(texto) {
  _ultimoFestejo = Date.now();
  var capa = document.createElement('div');
  capa.className = 'festejo';
  capa.setAttribute('aria-hidden', 'true');
  var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var colores = ['#C6F432', '#2FE38A', '#4D9FFF', '#F0C66A', '#FF8A65', '#B38BFF', '#FFFFFF'];
  for (var k = 0; !quieto && k < 90; k++) {
    var p = document.createElement('i');
    p.style.left = (Math.random() * 100).toFixed(1) + '%';
    p.style.background = colores[k % colores.length];
    p.style.width = (6 + Math.random() * 6).toFixed(1) + 'px';
    p.style.height = (9 + Math.random() * 8).toFixed(1) + 'px';
    p.style.animationDelay = (Math.random() * 0.7).toFixed(2) + 's';
    p.style.animationDuration = (2.2 + Math.random() * 1.6).toFixed(2) + 's';
    p.style.setProperty('--x', (Math.random() * 140 - 70).toFixed(0) + 'px');
    p.style.setProperty('--giro', (Math.random() * 900 - 450).toFixed(0) + 'deg');
    capa.appendChild(p);
  }
  if (texto) { var t = document.createElement('div'); t.className = 'festejo-texto'; t.textContent = texto; capa.appendChild(t); }
  document.body.appendChild(capa);
  try { if (navigator.vibrate) navigator.vibrate([60, 40, 90]); } catch (e) {}
  setTimeout(function () { capa.remove(); }, 4300);
}

/* ════════════════════════════════════════════════════════════════════════
   EL LOGIN: LOCAL → NOMBRE → PIN (o "No estoy en la lista")
   ════════════════════════════════════════════════════════════════════════ */

var RE_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,30}$/;
function prolijo(t) { return String(t || '').trim().replace(/\s+/g, ' '); }

function pantallaLocales(mensaje) {
  barra.hidden = true;
  app.className = 'app';
  app.innerHTML = '<p class="cargando">Cargando…</p>';
  funcion('orden_login_locales', {}).then(function (locales) {
    app.innerHTML =
      '<p class="marca"><b>Equipo</b> VDH</p>' +
      '<h1>¿En qué local trabajás?</h1>' +
      '<p class="bajada">' + esc(mensaje || 'Elegí tu local. Esto se hace una sola vez en este celular.') + '</p>' +
      '<div class="lista">' + locales.map(function (l, i) {
        return '<button class="opcion" data-i="' + i + '">' + esc(nombreLocal(l)) + '</button>';
      }).join('') + '</div>';
    app.querySelectorAll('.opcion').forEach(function (b) {
      b.onclick = function () { pantallaPersonas(locales[+b.dataset.i]); };
    });
  }).catch(function (e) { pantallaError(e, function () { pantallaLocales(mensaje); }); });
}

function pantallaPersonas(local) {
  app.innerHTML = '<p class="cargando">Cargando…</p>';
  funcion('orden_login_personas', { p_local: local.id }).then(function (gente) {
    app.innerHTML =
      '<button class="volver" id="volver">‹ Cambiar de local</button>' +
      '<h1>¿Quién sos?</h1>' +
      '<p class="bajada">' + esc(nombreLocal(local)) + '</p>' +
      '<div class="lista">' + gente.map(function (p, i) {
        return '<button class="opcion" data-i="' + i + '">' + esc(p.nombre) + '</button>';
      }).join('') + '</div>' +
      /* El alta propia es sólo como vendedor de un local: a "Administrador"
         no se entra solo, a esa gente la carga el administrador. */
      (local.id ? '<button class="boton suave" id="nuevo" style="margin-top:14px">No estoy en la lista</button>'
                : (gente.length ? '' : '<div class="vacio">Todavía no hay nadie cargado acá.</div>'));
    document.getElementById('volver').onclick = function () { pantallaLocales(); };
    app.querySelectorAll('.opcion').forEach(function (b) {
      b.onclick = function () {
        var p = gente[+b.dataset.i];
        if (p.nuevo && p.pide_apellido) pantallaApellido(local, p);
        else pantallaPin(local, p, {});
      };
    });
    var n = document.getElementById('nuevo');
    if (n) n.onclick = function () { pantallaAlta(local); };
  }).catch(function (e) { pantallaError(e, function () { pantallaPersonas(local); }); });
}

function formulario(campos) {
  return campos.map(function (c) {
    return '<label class="campo"><span>' + esc(c[1]) + '</span><input id="' + c[0] + '" autocomplete="' + (c[2] || 'off') +
           '" autocapitalize="words" maxlength="30" value="' + esc(c[3] || '') + '"></label>';
  }).join('');
}

function pantallaApellido(local, persona) {
  var primerNombre = String(persona.nombre).split(' ')[0];
  app.innerHTML =
    '<button class="volver" id="volver">‹ No soy ' + esc(primerNombre) + '</button>' +
    '<h1>Hola, ' + esc(primerNombre) + '</h1>' +
    '<p class="bajada">Antes de crear tu PIN, poné tu apellido. Así no te confundimos con otro ' + esc(primerNombre) + '.</p>' +
    formulario([['apellido', 'Apellido', 'family-name']]) +
    '<p class="aviso-pin error" id="avisoForm"></p>' +
    '<button class="boton lima" id="seguir">Seguir</button>';
  document.getElementById('volver').onclick = function () { pantallaPersonas(local); };
  var campo = document.getElementById('apellido');
  campo.focus();
  document.getElementById('seguir').onclick = function () {
    var ap = prolijo(campo.value);
    if (!RE_NOMBRE.test(ap)) { document.getElementById('avisoForm').textContent = 'Poné tu apellido: sólo letras, de 2 a 30.'; return; }
    pantallaPin(local, persona, { apellido: ap });
  };
}

function pantallaAlta(local) {
  app.innerHTML =
    '<button class="volver" id="volver">‹ Volver a la lista</button>' +
    '<h1>Anotate</h1>' +
    '<p class="bajada">Vas a quedar como vendedor de ' + esc(local.nombre) + '. Tus módulos te los asigna tu supervisor.</p>' +
    formulario([['nombre', 'Nombre', 'given-name'], ['apellido', 'Apellido', 'family-name']]) +
    '<p class="aviso-pin error" id="avisoForm"></p>' +
    '<button class="boton lima" id="seguir">Seguir</button>';
  document.getElementById('volver').onclick = function () { pantallaPersonas(local); };
  document.getElementById('nombre').focus();
  document.getElementById('seguir').onclick = function () {
    var n = prolijo(document.getElementById('nombre').value);
    var a = prolijo(document.getElementById('apellido').value);
    var aviso = document.getElementById('avisoForm');
    if (!RE_NOMBRE.test(n)) { aviso.textContent = 'Poné tu nombre: sólo letras, de 2 a 30.'; return; }
    if (!RE_NOMBRE.test(a)) { aviso.textContent = 'Poné tu apellido: sólo letras, de 2 a 30.'; return; }
    pantallaPin(local, { id: null, nombre: n, nuevo: true }, { alta: { nombre: n, apellido: a } });
  };
}

/** Los puntos y el teclado del PIN (4 números; 6 para admin, Atención y gerencia, SQL 110). */
function tecladoPin(largo) {
  return '<div class="puntos' + (largo > 4 ? ' seis' : '') + '" id="puntos">' + new Array(largo + 1).join('<i class="punto"></i>') + '</div>' +
    '<p class="aviso-pin" id="avisoPin"></p>' +
    '<div class="teclado" id="teclado">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button class="tecla" data-n="' + n + '">' + n + '</button>'; }).join('') +
      '<button class="tecla vacia" tabindex="-1" aria-hidden="true"></button>' +
      '<button class="tecla" data-n="0">0</button>' +
      '<button class="tecla borrar" data-n="x" aria-label="Borrar">⌫</button>' +
    '</div>';
}

function pantallaPin(local, persona, extra) {
  var pin = '';
  var ocupado = false;
  var crear = !!persona.nuevo;   // todavía no tiene PIN: lo crea, poniéndolo dos veces
  var primero = null;
  var primerNombre = String(persona.nombre).split(' ')[0];
  var largo = persona.digitos === 6 ? 6 : 4;   // cuántos números (la lista lo dice desde el SQL 110)
  app.innerHTML =
    '<button class="volver" id="volver">‹ ' + (extra.alta ? 'Volver' : 'No soy ' + esc(primerNombre)) + '</button>' +
    '<h1 id="tituloPin"></h1>' +
    '<p class="bajada" id="bajadaPin"></p>' +
    tecladoPin(largo);
  document.getElementById('volver').onclick = function () {
    if (extra.alta) pantallaAlta(local); else pantallaPersonas(local);
  };
  var puntos = document.getElementById('puntos');
  var aviso = document.getElementById('avisoPin');
  var teclas = app.querySelectorAll('.tecla[data-n]');

  function textos() {
    document.getElementById('tituloPin').textContent =
      !crear ? 'Hola, ' + primerNombre : (primero === null ? 'Creá tu PIN' : 'Repetí tu PIN');
    document.getElementById('bajadaPin').textContent =
      !crear ? 'Poné tu PIN de ' + largo + ' números. Te lo pide una sola vez en este celular.'
      : (primero === null ? 'Hola, ' + primerNombre + '. Elegí ' + largo + ' números que te acuerdes: es tu PIN para entrar.'
                          : 'Poné los mismos ' + largo + ' números otra vez.');
  }
  textos();

  function dibujar() {
    puntos.querySelectorAll('.punto').forEach(function (p, i) { p.classList.toggle('lleno', i < pin.length); });
  }
  function trabar(seg) {
    teclas.forEach(function (t) { t.disabled = true; });
    setTimeout(function () {
      teclas.forEach(function (t) { t.disabled = false; });
      aviso.className = 'aviso-pin';
      aviso.textContent = 'Ya podés probar de nuevo.';
    }, seg * 1000);
  }
  function mal(texto, seg) {
    pin = '';
    dibujar();
    puntos.classList.remove('mal');
    void puntos.offsetWidth;          // reinicia la animación
    puntos.classList.add('mal');
    aviso.className = 'aviso-pin error';
    aviso.textContent = texto;
    if (seg) trabar(seg);
  }
  function mandar() {
    ocupado = true;
    puntos.classList.add('esperando');
    aviso.className = 'aviso-pin';
    aviso.textContent = 'Revisando…';
    var cuerpo = extra.alta
      ? { alta: { local_id: local.id, nombre: extra.alta.nombre, apellido: extra.alta.apellido }, pin: pin }
      : { persona_id: persona.id, pin: pin };
    if (!extra.alta && extra.apellido) cuerpo.apellido = extra.apellido;
    fetch(BASE + '/functions/v1/entrar', {
      method: 'POST',
      headers: { apikey: CLAVE, Authorization: 'Bearer ' + CLAVE, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; });
    }).then(function (x) {
      ocupado = false;
      puntos.classList.remove('esperando');
      if (x.ok && x.d.access_token) {
        var p = x.d.persona || {};
        p.local = local.id ? local.nombre : '';
        anotarVend_(x.d, p);
        /* Entró con el PIN de 4 de antes y su rol pide 6: lo cambia ya. */
        if (x.d.cambiar_pin || p.cambiar_pin) { pantallaCambiarPin(function () { entrarApp(true); }, pin); return; }
        entrarApp(true);
        return;
      }
      var d = x.d || {};
      if (extra.alta) {
        primero = null; textos();
        if (d.error === 'base') mal('El alta todavía no está habilitada. Avisale a tu supervisor.');
        else mal(d.porque || 'No se pudo anotar. Probá de nuevo.');
        return;
      }
      /* Iba a crearlo, pero alguien ya lo creó en su nombre (o lo creó él en
         otro celular): de acá en más es entrar con ese PIN. */
      if (crear && d.restantes != null) {
        crear = false;
        primero = null;
        textos();
        mal('Ese nombre ya tiene PIN. Si no lo creaste vos, avisale a tu supervisor.');
        return;
      }
      if (d.espera > 0) {
        mal((d.porque || 'Esperá un rato.') + ' Faltan ' + Math.ceil(d.espera / 60) + ' min.', d.espera);
      } else if (d.restantes != null) {
        mal('PIN incorrecto. ' + (d.restantes === 1 ? 'Te queda 1 intento.' : 'Te quedan ' + d.restantes + ' intentos.'));
      } else {
        if (crear) { primero = null; textos(); }
        mal(d.porque || 'No se pudo entrar. Probá de nuevo.');
      }
    }).catch(function () {
      ocupado = false;
      puntos.classList.remove('esperando');
      mal('Sin conexión. Probá de nuevo cuando haya señal.');
    });
  }

  teclas.forEach(function (t) {
    t.onclick = function () {
      if (ocupado) return;
      if (t.dataset.n === 'x') { pin = pin.slice(0, -1); }
      else if (pin.length < largo) { pin += t.dataset.n; }
      aviso.textContent = '';
      dibujar();
      if (pin.length < largo) return;
      if (crear && primero === null) { primero = pin; pin = ''; dibujar(); textos(); return; }
      if (crear && pin !== primero) { primero = null; textos(); mal('No coinciden. Empezá de nuevo.'); return; }
      mandar();
    };
  });
}

/* El PIN de 4 de antes por uno de 6 (admin, Atención y gerencia, SQL 110).
   Justo después de entrar, con el PIN que acaba de poner; si abre la app
   con la sesión guardada, primero le pide el de ahora (así nadie que se
   siente en una PC donde quedó adentro se lo puede cambiar). Si cierra la
   app, se lo vuelve a pedir al abrirla.
   Por ahora se puede dejar para más adelante (PIN_SEIS_OPCIONAL): el No
   Compra publicado todavía tiene el teclado de 4, y con el PIN de 6 no
   podría entrar ahí (la base sigue aceptando el de 4 mientras no lo cambie).
   Cuando la otra sesión publique su entrada de 6, se pone en false. */
var PIN_SEIS_OPCIONAL = false;   // 14/10: la otra sesión publicó la entrada de 6 del No Compra (d0ca1f8)
function pantallaCambiarPin(despues, actual, largoActual) {
  barra.hidden = true;
  app.className = 'app';
  var paso = actual ? 'nuevo' : 'actual';   // actual → nuevo → repetir
  var largo = paso === 'actual' ? (largoActual || 4) : 6, pin = '', primero = null, ocupado = false;
  function armar() {
    app.innerHTML = '<p class="marca"><b>Equipo</b> VDH</p><h1 id="tituloPin"></h1><p class="bajada" id="bajadaPin"></p>' + tecladoPin(largo) +
      (PIN_SEIS_OPCIONAL ? '<button class="enlace" id="pinLuego" style="display:block;margin:14px auto 0">Cambiarlo más adelante (sigo con el de 4)</button>' : '');
    enganchar();
    textos();
    var luego = document.getElementById('pinLuego');
    /* Sigue con el de 4; en esta vez no se lo vuelve a pedir. */
    if (luego) luego.onclick = function () { if (ocupado) return; _pinRevisado = yo().id; despues(); };
  }
  function textos() {
    document.getElementById('tituloPin').textContent = paso === 'actual' ? 'Tu PIN ahora es de 6 números' : paso === 'nuevo' ? 'Elegí tu PIN nuevo' : 'Repetí tu PIN nuevo';
    document.getElementById('bajadaPin').textContent =
      paso === 'actual' ? 'Con tu PIN entrás también al CRM, los socios y las gift cards: por eso ahora es más largo. Primero, poné tu PIN de ahora (' + largo + ' números).'
      : paso === 'nuevo' ? 'Con tu PIN entrás también al CRM, los socios y las gift cards: por eso ahora es más largo. Elegí 6 números que te acuerdes.'
      : 'Poné los mismos 6 números otra vez.';
  }
  function dibujar() { document.getElementById('puntos').querySelectorAll('.punto').forEach(function (p, i) { p.classList.toggle('lleno', i < pin.length); }); }
  function mal(texto, aPaso) {
    pin = ''; primero = null;
    if (aPaso && aPaso !== paso) { paso = aPaso; largo = paso === 'actual' ? (largoActual || 4) : 6; armar(); }
    else { if (paso === 'repetir') paso = 'nuevo'; textos(); dibujar(); }
    var puntos = document.getElementById('puntos'), aviso = document.getElementById('avisoPin');
    puntos.classList.remove('mal'); void puntos.offsetWidth; puntos.classList.add('mal');
    aviso.className = 'aviso-pin error'; aviso.textContent = texto;
  }
  function mandar() {
    var puntos = document.getElementById('puntos'), aviso = document.getElementById('avisoPin');
    ocupado = true;
    puntos.classList.add('esperando');
    aviso.className = 'aviso-pin'; aviso.textContent = 'Guardando…';
    llamar('orden_pin_cambiar', { p_actual: actual, p_nuevo: pin }).then(function (r) {
      ocupado = false; puntos.classList.remove('esperando');
      if (!r || !r.ok) {
        /* El de ahora estaba mal: se vuelve a pedir (y cuenta para el freno). */
        if (r && r.actual) { actual = null; mal(r.porque || 'Tu PIN de ahora no es ése.', 'actual'); return; }
        mal((r && r.porque) || 'No se pudo cambiar. Probá de nuevo.');
        return;
      }
      avisar('Listo: tu PIN nuevo es de 6 números.');
      despues();
    }, function (e) {
      ocupado = false; puntos.classList.remove('esperando');
      mal(esDeRed(e) ? 'Sin conexión. Probá de nuevo cuando haya señal.' : mensajeDe(e));
    });
  }
  function enganchar() {
    app.querySelectorAll('.tecla[data-n]').forEach(function (t) {
      t.onclick = function () {
        if (ocupado) return;
        if (t.dataset.n === 'x') pin = pin.slice(0, -1);
        else if (pin.length < largo) pin += t.dataset.n;
        document.getElementById('avisoPin').textContent = '';
        dibujar();
        if (pin.length < largo) return;
        if (paso === 'actual') { actual = pin; pin = ''; paso = 'nuevo'; largo = 6; armar(); return; }
        if (paso === 'nuevo') { primero = pin; pin = ''; paso = 'repetir'; dibujar(); textos(); return; }
        if (pin !== primero) { mal('No coinciden. Empezá de nuevo.'); return; }
        mandar();
      };
    });
  }
  armar();
}

/* ════════════════════════════════════════════════════════════════════════
   ADENTRO: LA BARRA Y LAS PESTAÑAS
   ════════════════════════════════════════════════════════════════════════ */

var ICONO = {
  hoy: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>',
  tareas: '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h9"/>',
  ideas: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  fotos: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  revisar: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><path d="M9 14l2 2 4-4"/>',
  equipo: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  cajas: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>'
};
ICONO.caja = ICONO.cajas;
var PESTANAS_SUPERVISION = [['revisar', 'Revisar'], ['equipo', 'Equipo'], ['cajas', 'Cajas'], ['ideas', 'Ideas'], ['perfil', 'Perfil']];
var _pestana = 'hoy';

/* Las pestañas del vendedor (13/10): Hoy (lo que falta hoy) · Fotos (el mapa
   con las cámaras) · Tareas · Caja · Ideas. El Perfil, en la inicial de arriba.
   La Caja, sólo en los locales con el control de caja prendido (se recuerda en
   el teléfono para armar la barra enseguida). */
var K_CAJA = 'vdh_vend_caja_activa';
function cajaActiva() { try { return !!yo().local_id && localStorage.getItem(K_CAJA) === yo().local_id; } catch (e) { return false; } }
function pestanasVendedor() {
  return [['hoy', 'Hoy'], ['fotos', 'Fotos'], ['tareas', 'Tareas']].concat(cajaActiva() ? [['caja', 'Caja']] : []).concat([['ideas', 'Ideas']]);
}

function armarBarra() {
  var lista = esSupervision() ? PESTANAS_SUPERVISION : pestanasVendedor();
  barra.innerHTML = '<nav style="grid-template-columns:repeat(' + lista.length + ',1fr)">' + lista.map(function (p) {
    return '<button class="pestana" data-pestana="' + p[0] + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
           'stroke-linecap="round" stroke-linejoin="round">' + ICONO[p[0]] + '</svg>' + p[1] + '</button>';
  }).join('') + '</nav>';
  barra.querySelectorAll('.pestana').forEach(function (b) { b.onclick = function () { irA(b.dataset.pestana); }; });
}

function marcarPestana(p) {
  _pestana = p;
  barra.querySelectorAll('.pestana').forEach(function (b) { b.classList.toggle('activa', b.dataset.pestana === p); });
}

/* ¿El local tiene el control de caja? Y, desde las 19, si falta guardar la de
   hoy: un puntito en la pestaña. */
function revisarCaja() {
  var per = yo();
  if (esSupervision() || !per.local_id) return Promise.resolve();
  var L = valor(per.local_id);
  return Promise.all([
    leer('/orden_config?select=caja_activa&local_id=eq.' + L),
    leer('/orden_cajas?select=estado&local_id=eq.' + L + '&fecha=eq.' + hoyAR())
  ]).then(function (r) {
    var activa = !!(r[0] && r[0][0] && r[0][0].caja_activa);
    if (activa !== cajaActiva()) {
      try { if (activa) localStorage.setItem(K_CAJA, per.local_id); else localStorage.removeItem(K_CAJA); } catch (e) {}
      armarBarra();
      marcarPestana(_pestana);
    }
    var horaAR = Number(new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
    var caja = (r[1] || [])[0];
    var b = barra.querySelector('[data-pestana="caja"]');
    if (b) b.classList.toggle('con-punto', activa && horaAR >= 19 && (!caja || caja.estado === 'pendiente'));
  }).catch(function () {});
}

function irA(p) {
  apagarCamara();
  cerrarCapas();
  marcarPestana(p);
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  if (p === 'hoy') pantallaHoy();
  else if (p === 'fotos') pantallaFotos();
  else if (p === 'avisos') pantallaAvisos();
  else if (p === 'tareas') pantallaTareas();
  else if (p === 'caja') pantallaCaja();
  else if (p === 'ideas') pantallaIdeas();
  else if (p === 'perfil') pantallaPerfil();
  else if (p === 'revisar') pantallaRevisar();
  else if (p === 'equipo') pantallaEquipo();
  else if (p === 'cajas') pantallaCajasSup();
}

function irInicio() { irA(esSupervision() ? 'revisar' : 'hoy'); }

window.addEventListener('hashchange', function () {
  if (!_vend || !_vend.refresco) return;
  if (yo().aprobado === false) { revisarAprobacion(true); return; }
  irPorEnlace();
});
/* Cuándo se usó por última vez un campo de foto: al sacar una foto con la
   cámara del teléfono la app queda "oculta" y vuelve sola. */
var _ultimoArchivo = 0, _oculta = 0;
document.addEventListener('click', function (e) { if (e.target && e.target.type === 'file') _ultimoArchivo = Date.now(); }, true);
document.addEventListener('change', function (e) { if (e.target && e.target.type === 'file') _ultimoArchivo = Date.now(); }, true);
document.addEventListener('visibilitychange', function () {
  /* Al volver a la app (desde otra o desde un aviso), se vuelve a cargar la
     pestaña que está a la vista. No se toca si estuvo afuera un ratito, si
     vuelve de la cámara, si algo se está mandando, si está en un formulario
     de pantalla completa o con algo escrito a medias. */
  if (document.visibilityState !== 'visible') { _oculta = Date.now(); return; }
  if (!_vend || !_vend.refresco) return;
  if (yo().aprobado === false) { revisarAprobacion(true); return; }
  if (Date.now() - _ultimoArchivo < 10 * 60e3 || Date.now() - _oculta < 30e3) return;
  if (barra.hidden || hayAlgoEscrito() || app.querySelector('button:disabled')) return;
  irA(_pestana);
});

function hayAlgoEscrito() {
  return Array.prototype.some.call(app.querySelectorAll('input, textarea'), function (x) {
    if (x.type === 'file' || x.type === 'hidden') return false;
    if (x.type === 'checkbox' || x.type === 'radio') return x.checked !== x.defaultChecked;
    return x.value !== x.defaultValue;
  });
}

/** Al entrar (recién o con la sesión guardada). */
var _pinRevisado = null;   // de quién ya se miró si el PIN tiene los números que pide su rol
function entrarApp(recien) {
  if (_espejo) salirEspejo();
  if (yo().rol === 'atencion') { pantallaSinImpecable(); return; }
  if (yo().aprobado === false) { pantallaEspera(); return; }
  /* Admin y gerencia con el PIN de 4 de antes (SQL 110): primero, uno de 6. */
  if ((yo().rol === 'admin' || yo().rol === 'gerencia') && _pinRevisado !== yo().id) {
    _pinRevisado = yo().id;
    llamar('orden_pin_estado').then(function (e) {
      if (e && e.cambiar) pantallaCambiarPin(function () { entrarApp(recien); }, null, e.digitos); else entrarApp(recien);
    }, function () { entrarApp(recien); });
    return;
  }
  _locales = null;
  refrescarYo();
  armarBarra();
  revisarCaja();
  avisosAlDia();
  var per = yo();
  if (recien && !bienvenidaVista(per.id)) { pantallaBienvenida(irInicio); return; }
  if (!irPorEnlace()) irInicio();
}

/* La persona guardada en el teléfono puede quedar vieja (le cambiaron el rol o
   el local, o lo desaprobaron): se relee en silencio y, si cambió, se rearma. */
function refrescarYo() {
  if (_espejo) return;
  var per = yo();
  leer('/orden_personas?select=nombre,rol,local_id,aprobado,activo&id=eq.' + valor(per.id)).then(function (f) {
    var x = (f || [])[0];
    if (!x || !x.rol) return;
    /* Desactivado cuenta como sin aprobar: la base ya no le muestra nada. */
    var aprobado = !!(x.aprobado && x.activo);
    var cambio = x.rol !== per.rol || x.local_id !== per.local_id || aprobado !== (per.aprobado !== false) || x.activo !== (per.activo !== false);
    if (!cambio) return;
    per.rol = x.rol; per.local_id = x.local_id; per.aprobado = aprobado; per.activo = x.activo;
    anotarVend_({ access_token: _vend.token, refresh_token: _vend.refresco, expires_at: Math.floor(_vend.vence / 1000) + 60 }, per);
    entrarApp(false);
  }).catch(function () {});
}

/* Atención al cliente entra al No Compra con el mismo usuario (y la misma
   sesión), pero Equipo VDH es de los locales: no ve nada de acá. */
function pantallaSinImpecable() {
  barra.hidden = true;
  app.className = 'app';
  app.innerHTML = '<p class="marca"><b>' + NOMBRE_APP + '</b> VDH</p><h1>Sin acceso a Equipo VDH</h1>' +
    '<p class="bajada">Hola, ' + esc(primerNombre()) + '. Tu usuario es de Atención al cliente: Equipo VDH es para los locales. Lo tuyo está en el No Compra.</p>' +
    '<a class="boton lima" href="panel.html">Ir al No Compra</a>' +
    '<button class="boton" id="salirSin" style="margin-top:10px">No soy yo</button>';
  document.getElementById('salirSin').onclick = preguntarSalir;
}

/* Quien entró por primera vez espera el OK de su supervisor (o del
   administrador): hasta entonces la base no le muestra nada del local. */
function pantallaEspera() {
  barra.hidden = true;
  app.className = 'app';
  var quien = yo().rol === 'vendedor' ? 'Tu supervisor' : 'El administrador';
  var afuera = yo().activo === false;
  app.innerHTML = '<p class="marca"><b>' + NOMBRE_APP + '</b> VDH</p><h1>' + (afuera ? 'Sin acceso' : 'Esperando la aprobación') + '</h1>' +
    '<p class="bajada">Hola, ' + esc(primerNombre()) + '. ' +
    (afuera ? 'Tu acceso a la app está cerrado. Si es un error, hablá con tu supervisor.'
            : quien + ' tiene que confirmar que sos del equipo. Ya le avisamos: cuando te apruebe, tocá el botón de abajo.') + '</p>' +
    (afuera ? '' : '<button class="boton lima" id="yaMe">Ya me aprobaron</button>') +
    (afuera || !esSupervisorZona() ? '' : '<button class="boton" id="misLocalesEspera" style="margin-top:10px">Mientras tanto, elegí tus locales</button>') +
    '<button class="boton" id="salirEspera" style="margin-top:10px">No soy yo</button>';
  document.getElementById('salirEspera').onclick = preguntarSalir;
  var ml = document.getElementById('misLocalesEspera');
  if (ml) ml.onclick = function () { pantallaMisLocales(pantallaEspera); };
  if (!afuera) unaVez(document.getElementById('yaMe'), function () { return revisarAprobacion(false); });
  /* Si ya lo aprobaron mientras la app estaba cerrada, entra solo. */
  revisarAprobacion(true);
}

/** ¿Ya lo aprobaron? Si sí, entra; si no, lo dice (salvo en silencio). */
function revisarAprobacion(silencio) {
  return leer('/orden_personas?select=aprobado,activo,rol,local_id&id=eq.' + valor(yo().id)).then(function (f) {
    var x = (f || [])[0];
    if (yo().aprobado !== false) return;   // ya entró por otro lado
    if (x && x.aprobado && x.activo) {
      var per = yo();
      per.aprobado = true; per.activo = true; per.rol = x.rol; per.local_id = x.local_id;
      anotarVend_({ access_token: _vend.token, refresh_token: _vend.refresco, expires_at: Math.floor(_vend.vence / 1000) + 60 }, per);
      entrarApp(true);
    } else if (x && !x.activo) {
      /* Lo desactivaron: la pantalla deja de decir "ya le avisamos". */
      if (yo().activo !== false) {
        var p2 = yo(); p2.activo = false;
        anotarVend_({ access_token: _vend.token, refresh_token: _vend.refresco, expires_at: Math.floor(_vend.vence / 1000) + 60 }, p2);
        pantallaEspera();
      }
      if (!silencio) avisar('Tu acceso a la app está cerrado. Si es un error, hablá con tu supervisor.');
    } else if (silencio) {
      return;
    } else {
      avisar('Todavía no te aprobaron. Probá en un rato.');
    }
  }, function (e) { if (!silencio) throw e; });
}

/* Los avisos traen a qué pantalla llevan ("/tareas", "/revisar"…): llegan
   como #/tareas al tocar la notificación. */
function irPorEnlace() { return irAEnlace(location.hash); }

/** "#/tareas", "/tareas", "vendedores.html#/tareas" o "tareas" → esa pantalla. false si no es de esta persona. */
function irAEnlace(enlace) {
  var h = String(enlace || '').replace(/^.*#/, '').replace(/^\/+/, '').replace(/[?#].*$/, '');
  if (!h) return false;
  var mapa = { hoy: 'hoy', fotos: 'fotos', tareas: 'tareas', caja: 'caja', ideas: 'ideas', perfil: 'perfil', historial: 'perfil', avisos: 'avisos',
               revisar: 'revisar', equipo: 'equipo', faltas: 'equipo', cajas: 'cajas' };
  /* Las pantallas completas ponen una marca en el historial para el "atrás" de Android: si el #/… del aviso quedaba
     en la dirección, al volver la app regresaba a él y la abría de nuevo por debajo de Hoy, sin la barra de abajo
     (21/10). Se saca antes de abrirlas; las pestañas lo sacan en irA. */
  var sinEnlace = function () { try { if (location.hash) history.replaceState(null, '', location.pathname + location.search); } catch (e) {} };
  if (h === 'desafio' && !esSupervision()) { sinEnlace(); marcarPestana('hoy'); abrirDesafio(); return true; }
  if (h === 'testigo' && !esSupervision()) { sinEnlace(); marcarPestana('hoy'); pantallaTestigo(); return true; }
  if (/^ver\/[0-9a-f-]{36}$/i.test(h)) { if (esSupervision() && !_espejo) { verSuAppPorId(h.slice(4)); return true; } return false; }
  /* El aviso de una revisión con sugerencia o marcas (SQL 150): la foto revisada. */
  if (/^revision\/[0-9a-f-]{36}$/i.test(h)) { if (esSupervision()) return false; sinEnlace(); marcarPestana('hoy'); verRevision(h.slice(9)); return true; }
  if ((h === 'admin' || h === 'admin-testigo') && esSupervision()) { location.replace('impecable-admin.html' + (h === 'admin-testigo' ? '#testigo' : '')); return true; }
  var p = mapa[h];
  if (!p || (esSupervision() ? ['hoy', 'fotos', 'tareas', 'caja'].indexOf(p) > -1 : ['revisar', 'equipo', 'cajas'].indexOf(p) > -1)) return false;
  irA(p);
  return true;
}

function adentro() {
  barra.hidden = false;
  app.className = 'app con-barra';
}

/* Arriba de cada pantalla: el título y, a la derecha, la campanita de los
   avisos (con los nuevos en rojo) y el círculo con la inicial, que abre el
   Perfil ("No soy yo" está adentro). Pedido de Mauricio (13/10): "No soy yo"
   arriba todo el tiempo no le gustaba. */
var CAMPANA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
var _sinLeer = 0, _sinLeerEn = 0, _sinLeerDe = null;   // cuántos, cuándo se preguntó y de quién
function cabeza(titulo, debajo) {
  var per = yo();
  var inicial = String(per.nombre || '').trim().charAt(0).toUpperCase() || '?';
  return '<div class="cabeza"><div>' + volverAlSistema() +
    '<h1>' + esc(titulo) + '</h1>' +
    '<p class="bajada" style="margin:0">' + esc(debajo != null ? debajo : [per.local, fechaLarga()].filter(Boolean).join(' · ')) + '</p>' +
    '</div><div class="cabeza-botones">' +
    '<button class="campanita" id="campanita" aria-label="' + textoCampanita() + '">' + CAMPANA +
      '<i class="sin-leer"' + (sinLeer() ? '' : ' hidden') + '>' + (sinLeer() > 9 ? '9+' : sinLeer()) + '</i></button>' +
    (esSupervision() ? '' : '<button class="avatar" id="avatar" aria-label="Tu perfil">' + esc(inicial) + '</button>') + '</div></div>';
}
/* Si a la app se llegó desde Supervisión de la compu (impecable-admin.js lo anota en la pestaña), arriba de todo
   "‹ Volver al sistema" (Mauricio, 20/10: "acá no tengo manera de salir de vuelta al sistema"). Al vendedor, nunca. */
function volverAlSistema() {
  var v = null;
  try { v = sessionStorage.getItem('vdh_volver_sistema'); } catch (e) {}
  if (!esSupervision() || !v || !/^impecable-admin\.html(#[a-z]+)?$/.test(v)) return '';
  return '<a class="volver volver-sistema" id="volverSistema" href="' + esc(v) + '">‹ Volver al sistema</a>';
}
function sinLeer() { return _sinLeerDe === yo().id ? _sinLeer : 0; }
function textoCampanita() { var n = sinLeer(); return 'Avisos' + (n ? ' (' + (n > 9 ? 'más de 9' : n) + ' sin leer)' : ''); }

function engancharCabeza() {
  var b = document.getElementById('campanita');
  if (b) b.onclick = function () { pantallaAvisos(); };
  var a = document.getElementById('avatar');
  if (a) a.onclick = function () { apagarCamara(); cerrarCapas(); pantallaPerfil(); };
  contarSinLeer();
}

/* Avisos y el Perfil del vendedor se abren desde arriba, no son pestañas:
   "‹ Volver" y el "atrás" de Android vuelven a la pestaña de antes. */
var _deDonde = null, _capaAparte = null;
/** Una pestaña de esta persona (la supervisión y el vendedor tienen barras distintas). */
function pestanaValida(p) {
  var lista = (esSupervision() ? PESTANAS_SUPERVISION : pestanasVendedor()).map(function (x) { return x[0]; });
  return lista.indexOf(p) > -1 && p !== 'perfil' ? p : lista[0];
}
function abrirAparte(nombre) {
  if (_pestana !== nombre && ['avisos', 'perfil'].indexOf(_pestana) < 0) _deDonde = _pestana;
  _deDonde = pestanaValida(_deDonde);
  if (!_capaAparte) {
    _capaAparte = function (porNavegar) { _capaAparte = null; if (!porNavegar) irA(_deDonde); };
    abrirCapa(_capaAparte);
  }
}
function volverDeAparte() {
  var c = _capaAparte;
  _capaAparte = null;
  if (c) soltarCapa(c);
  irA(_deDonde);
}

/** Cuántos avisos sin leer (se pregunta como mucho cada 30 segundos). */
/** Los avisos que se ven: los programados (SQL 113: una tarea a alguien de franco) esperan a su hora. */
function avisosALaVista(lista) { return (lista || []).filter(function (a) { return a.estado !== 'programado'; }); }
function contarSinLeer() {
  var quien = yo().id;
  if (_sinLeerDe === quien && Date.now() - _sinLeerEn < 30e3) { pintarSinLeer(); return; }
  _sinLeerEn = Date.now();
  leer('/orden_avisos?select=id,estado&persona_id=eq.' + valor(yo().id) + '&leido_en=is.null&limit=20').then(function (f) {
    if (yo().id !== quien) return;
    _sinLeer = Math.min(10, avisosALaVista(f).length); _sinLeerDe = quien;
    pintarSinLeer();
  }).catch(function () {});
}
function pintarSinLeer() {
  var b = document.getElementById('campanita');
  if (!b) return;
  var i = b.querySelector('.sin-leer');
  var n = sinLeer();
  i.hidden = !n;
  i.textContent = n > 9 ? '9+' : String(n);
  b.setAttribute('aria-label', textoCampanita());
}

function preguntarSalir() {
  var nombre = String(yo().nombre || '').split(' ')[0];
  return confirmar('¿No sos ' + nombre + '? Se cierra la sesión y para volver a entrar hace falta el PIN.', 'Cerrar sesión').then(function (si) {
    if (!si) return;
    /* Las notificaciones de este celular dejan de llegarle a esa persona: si
       no, el próximo que entre recibiría las de otro. */
    soltarAvisos().then(function () {
      cerrarSesion();
      barra.innerHTML = '';
      _sinLeer = 0; _sinLeerEn = 0;
      cerrarCapas();
      pantallaLocales();
    });
  });
}

function primerNombre() { return String(yo().nombre || '').split(' ')[0]; }

/* ════════════════════════════════════════════════════════════════════════
   HOY (vendedor)
   ════════════════════════════════════════════════════════════════════════ */

var CAMARA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>';
var _controles = {};   // id → control: lo último que mostró Hoy

function pantallaHoy() {
  if (!_vend) { pantallaLocales(); return; }
  marcarPestana('hoy');
  adentro();
  var per = yo();
  app.innerHTML = cabeza('Hola, ' + primerNombre()) + '<p class="cargando">Cargando…</p>';
  engancharCabeza();

  var hoy = hoyAR();
  var id = valor(per.id);
  var nada = function () { return null; };
  /* Lo que no cargó (sin señal) se anota: así Hoy no dice "¡Listo!" por error. */
  var FALLO = {}, fallo = function () { return FALLO; };
  /* Desde cuándo cuenta "hoy" (la Argentina está en UTC−3 todo el año). */
  var desdeHoy = new Date(hoy + 'T03:00:00Z').toISOString(), desdeAyer = new Date(sumarDias(hoy, -1) + 'T03:00:00Z').toISOString();
  Promise.all([
    /* Lo de hoy, lo que quedó pendiente y lo que se mandó hoy (el depósito
       se crea un día y se manda otro: así no desaparece apenas se manda, y se puede sacar de nuevo). Y lo que
       venció ayer u hoy: se puede mandar igual al otro día y queda como tarde (Mauricio, 15/10). */
    leer('/orden_v_controles?select=id,estado,vence_en,frontal&persona_id=eq.' + id + '&tipo=neq.correccion&or=(fecha.eq.' + hoy + ',estado.eq.pendiente,enviado_en.gte.' + desdeHoy + ',and(estado.eq.vencido,vence_en.gte.' + desdeAyer + '))'),
    leer('/orden_v_persona_semana?select=nivel_semana,controles,controles_a_tiempo,controles_tarde&persona_id=eq.' + id + '&semana=eq.' + lunesAR()).catch(fallo),
    leer('/orden_sectores?select=id&or=(responsable_id.eq.' + id + ',suplente_id.eq.' + id + ')&limit=1').catch(nada),
    llamar('orden_desafio_mio').catch(fallo),
    /* Las tareas abiertas y las que se cerraron hoy (para tacharlas). foto_antes (SQL 150): una corrección. */
    leer150('/orden_v_tareas?select=id,titulo,estado,completada_en,correccion&persona_id=eq.' + id +
         '&or=(estado.in.(pendiente,vencida),completada_en.gte.' + desdeHoy + ')&order=vence_en.asc', 'foto_antes').catch(fallo),
    estadoAvisos().catch(function () { return 'no-soportado'; }),
    /* SQL 99: lo que hay que acordarse hoy (martes entra mercadería…). */
    per.local_id ? leer('/orden_recordatorios?select=texto&local_id=eq.' + valor(per.local_id) + '&dia=eq.' + diaSemanaAR() + '&activo=is.true&order=creado_en.asc').catch(nada) : Promise.resolve(null),
    /* SQL 102/151: producto testigo para contar (desde que se programa hasta la fecha límite), uno vencido sin mandar, o el que se mandó hoy. */
    per.local_id ? leer('/testigo_semanas?select=id,fecha,cargada_en,testigo_items(item,producto,color)&local_id=eq.' + valor(per.local_id) +
                        '&fecha=gte.' + sumarDias(hoy, -6) + '&cerrada=is.false' +
                        '&or=(cargada_en.is.null,cargada_en.gte.' + desdeHoy + ')&order=fecha.asc').catch(fallo)
                 : Promise.resolve(null),
    /* La caja de hoy y si el local la controla (se pregunta acá: la primera vez en un celular todavía no se sabe). */
    per.local_id ? Promise.all([leer('/orden_config?select=caja_activa&local_id=eq.' + valor(per.local_id)),
                                leer('/orden_cajas?select=estado&local_id=eq.' + valor(per.local_id) + '&fecha=eq.' + hoy)]).catch(fallo) : Promise.resolve(null),
    /* SQL 150: lo que le dejó el supervisor al revisar sus fotos (una sugerencia o marcas, sin pedirle corregir), de los últimos 2 días. */
    leer('/orden_v_controles?select=id,modulo_nombre,nivel_final,comentario,marcas&persona_id=eq.' + id + '&estado=eq.revisado&tipo=neq.correccion' +
         '&correccion_pedida=is.false&revisado_en=gte.' + new Date(Date.now() - 2 * 864e5).toISOString() +
         '&or=(comentario.not.is.null,marcas.not.is.null)&order=revisado_en.desc&limit=3').catch(nada)
  ]).then(function (r) {
    if (_pestana !== 'hoy') return;
    var incompleto = [r[3], r[4], r[7], r[8]].indexOf(FALLO) > -1, semanaFallo = r[1] === FALLO;
    r = r.map(function (v) { return v === FALLO ? null : v; });
    var testigos = (r[7] || []).filter(function (s) { return (s.testigo_items || []).length; });
    dibujarHoy({
      controles: r[0] || [], semana: (r[1] || [])[0], sinModulos: Array.isArray(r[2]) && r[2].length === 0, desafio: r[3],
      tareas: r[4] || [], avisos: r[5], recordatorios: r[6] || [], incompleto: incompleto, semanaFallo: semanaFallo, sugerencias: r[9] || [],
      caja: r[8] ? { activa: !!(r[8][0] && r[8][0][0] && r[8][0][0].caja_activa), hoy: (r[8][1] || [])[0] || null } : null,
      testigoPend: testigos.filter(function (s) { return !s.cargada_en; })[0] || null,
      testigoHecho: testigos.filter(function (s) { return s.cargada_en; })[0] || null
    });
    revisarCaja();
  }).catch(function (e) { pantallaError(e, pantallaHoy); });
}

function estadoDe(c, corregir) {
  if (c.estado === 'enviado' || c.estado === 'revisado') {
    return { clase: 'listo', texto: c.enviado_en && c.vence_en && c.enviado_en > c.vence_en ? 'Mandada tarde' : 'Listo', hecho: true };
  }
  /* Vencida: se puede mandar igual (ayer u hoy) y queda como tarde (Mauricio, 15/10). */
  if (c.estado === 'vencido') return { clase: 'vencido', texto: 'Vencida: mandala igual' };
  if (corregir[c.modulo_id]) return { clase: 'corregir', texto: 'Corregir' };
  if (c.tipo === 'sorpresa') return { clase: 'sorpresa', texto: 'Control sorpresa' };
  return { clase: 'pendiente', texto: 'Pendiente' };
}

function bannerAvisos(estado) {
  if (estado === 'activos' || estado === 'no-soportado') return '';
  var t = estado === 'bloqueados' ? 'Los avisos están bloqueados en este celular. Tocá para ver cómo prenderlos.'
        : estado === 'instalar' ? 'Para recibir avisos, instalá la app en tu iPhone. Tocá para ver cómo.'
        : 'Activá los avisos para enterarte de tus controles y tareas.';
  return '<button class="banner" id="banner">' + esc(t) + '</button>';
}

function horaAR() { return Number(new Intl.DateTimeFormat('en-US', { timeZone: ZONA, hour: 'numeric', hourCycle: 'h23' }).format(new Date())); }

/** "Tu orden esta semana": la tarjeta de colores, del color del nivel. */
function tarjetaOrden(s, fallo) {
  if (fallo) return '<div class="resumen"><div class="chico">Tu orden esta semana</div><div class="grande">—</div><div class="chico">Con esta señal no se pudo cargar.</div></div>';
  var nivel = s && s.nivel_semana;
  return '<div class="resumen' + (nivel ? ' nivel-' + esc(nivel) : '') + '">' +
    '<div class="chico">Tu orden esta semana</div>' +
    '<div class="grande">' + esc(nivel ? NIVEL[nivel] || nivel : mandoFotos(s) ? 'Esperando revisión' : 'Todavía sin fotos') + '</div>' +
    '<div class="chico">' + (s && s.controles ? s.controles_a_tiempo + ' de ' + s.controles + ' fotos a tiempo' : 'Cuando mandes tus fotos, acá ves cómo vas.') + '</div>' +
    '</div>';
}

/** Si en esa semana mandó alguna foto (a tiempo o tarde): sin nivel todavía, es que espera la revisión (la IA dijo que no
    sirve, o falló, y nadie la revisó), no que no haya fotos. */
function mandoFotos(s) { return !!s && (Number(s.controles_a_tiempo) || 0) + (Number(s.controles_tarde) || 0) > 0; }

/** El festejo, una sola vez por cosa (y por persona) en este teléfono. */
function festejarUnaVez(clave, texto) {
  var k = 'vdh_vend_festejo_' + yo().id;
  try { if (localStorage.getItem(k) === clave) return; localStorage.setItem(k, clave); } catch (e) { return; }
  /* Si recién hubo otro (el del test), espera a que termine. */
  setTimeout(function () { festejar(texto); }, Math.max(300, 4600 - (Date.now() - _ultimoFestejo)));
}

/* Hoy (13/10, pedido de Mauricio): sólo lo que hay que hacer hoy, como una
   lista para ir tachando; cada renglón lleva a su lugar. Aparte, la tarjeta
   de colores "Tu orden esta semana". Con todo hecho, el festejo. */
function dibujarHoy(x) {
  var hoy = hoyAR(), filas = [];

  var total = x.controles.length;
  var pend = x.controles.filter(function (c) { return c.estado === 'pendiente'; });
  var env = x.controles.filter(function (c) { return c.estado === 'enviado' || c.estado === 'revisado'; }).length;
  if (total) {
    /* Lo que venció (ayer u hoy) se puede mandar igual: queda como tarde. No se tacha (y no hay festejo). */
    var vencidas = total - env - pend.length;
    var vence = pend.map(function (c) { return c.vence_en; }).filter(Boolean).sort()[0];
    /* El día del frontal nuevo (SQL 132): primero se cambia el frontal, después la foto (sirve de las dos cosas). */
    var frontal = pend.some(function (c) { return c.frontal; });
    filas.push({ id: 'hFotos', titulo: frontal ? 'Frontal nuevo: cambialo y sacale la foto' : 'Fotos de tus módulos', hecho: !pend.length && !vencidas, alerta: vencidas > 0,
      texto: pend.length || vencidas
           ? env + ' de ' + total + ' mandadas' + (pend.length && vence ? ' · ' + textoVence(vence) : '') +
             (vencidas ? ' · ' + (vencidas === 1 ? '1 vencida: mandala igual' : vencidas + ' vencidas: mandalas igual') : '')
           : (total === 1 ? 'Mandaste la foto.' : 'Mandaste las ' + total + '.') });
  }

  if (x.testigoPend) {
    /* SQL 152: se cuenta cualquier día hasta la fecha límite; vencido, todavía se manda. */
    var s = x.testigoPend, n = (s.testigo_items || []).length;
    filas.push({ id: 'hTestigo', titulo: 'Producto testigo', hecho: false, alerta: s.fecha < hoy,
      texto: s.fecha < hoy ? 'Venció el ' + diaYFecha(s.fecha) + ': cargalo y mandalo igual.'
           : (s.fecha === hoy ? 'Vence hoy · ' : 'Hasta el ' + diaYFecha(s.fecha) + ' · ') +
             (n === 1 ? '1 producto' : n + ' productos') + ': los números del sistema, contar y un video de cada uno.' });
  } else if (x.testigoHecho) {
    filas.push({ id: 'hTestigo', titulo: 'Producto testigo', hecho: true, texto: 'Mandado.' });
  }

  var abiertas = x.tareas.filter(function (t) { return t.estado === 'pendiente' || t.estado === 'vencida'; });
  var hechas = x.tareas.filter(function (t) { return t.estado === 'hecha'; });
  if (abiertas.length) {
    filas.push({ id: 'hTareas', titulo: abiertas.length === 1 ? '1 tarea' : abiertas.length + ' tareas', hecho: false,
      alerta: abiertas.some(function (t) { return t.estado === 'vencida'; }),
      /* La que el supervisor mandó a corregir va primero (SQL 132; con foto_antes, la que pidió al revisar: SQL 150). */
      texto: (function () {
        var corr = abiertas.filter(function (t) { return t.correccion || t.foto_antes; })[0], t = corr || abiertas[0];
        return (corr ? 'Para corregir: ' : '') + t.titulo + (abiertas.length > 1 ? ' y ' + (abiertas.length - 1) + ' más' : '');
      })() });
  } else if (hechas.length) {
    filas.push({ id: 'hTareas', titulo: 'Tareas', hecho: true, texto: hechas.length === 1 ? 'Hiciste la de hoy.' : 'Hiciste las ' + hechas.length + ' de hoy.' });
  }

  var d = x.desafio;
  if (d && !d.terminado_en && new Date(d.vence_en) > new Date()) {
    var faltanQ = (d.preguntas || []).filter(function (q) { return !q.respondida; }).length;
    filas.push({ id: 'hTest', titulo: 'Test de conocimiento' + (d.titulo ? ': ' + d.titulo : '') + (d.abiertos > 1 ? ' (+' + (d.abiertos - 1) + ')' : ''), hecho: false,
      texto: faltanQ === d.total ? d.total + ' preguntas de opción múltiple. Si le errás, no pasa nada.' : 'Te quedan ' + faltanQ + ' preguntas.' });
  } else if (d && d.terminado_en && hoyAR(new Date(d.terminado_en)) === hoy) {
    filas.push({ id: 'hTest', titulo: 'Test de conocimiento', hecho: true, texto: 'Acertaste ' + d.puntaje + ' de ' + d.total + '.' });
  }

  if (x.caja && x.caja.activa) {
    var caja = x.caja.hoy;
    if (caja && caja.estado !== 'pendiente') filas.push({ id: 'hCaja', titulo: 'Caja del día', hecho: true, texto: 'Guardada.' });
    else if (horaAR() >= 19) filas.push({ id: 'hCaja', titulo: 'Caja del día', hecho: false, texto: 'Las fotos del cierre y los números del día.' });
    else filas.push({ id: 'hCaja', titulo: 'Caja del día', luego: true, texto: 'Desde las 19 h: las fotos del cierre y el efectivo.' });
  }

  var faltan = filas.filter(function (f) { return !f.hecho && !f.perdido && !f.luego; }).length;
  var perdidos = filas.filter(function (f) { return f.perdido; }).length;
  var luego = filas.filter(function (f) { return f.luego; }).length;
  var titulo = x.incompleto ? 'No pudimos cargar todo'
    : faltan ? (faltan === 1 ? 'Te falta 1 cosa' : 'Te faltan ' + faltan + ' cosas')
    : perdidos ? 'Hoy quedó algo sin hacer'
    : luego ? 'Por ahora, listo'
    : '¡Listo por hoy!';
  var html = cabeza('Hola, ' + primerNombre()) + bannerAvisos(x.avisos) +
    (x.recordatorios || []).map(function (r) {
      return '<div class="recordatorio"><b>' + esc(DIAS_SEMANA[diaSemanaAR() - 1]) + '</b>' + esc(r.texto) + '</div>';
    }).join('');

  if (x.incompleto) {
    html += '<div class="nota alerta">Con esta señal no se cargó todo: puede faltar algo en la lista. <button class="boton chico" id="reintentarHoy" style="margin-top:8px">Probar de nuevo</button></div>';
  }
  if (filas.length) {
    html += '<div class="seccion">' + titulo + '</div>' +
      '<div class="lista-hoy">' + filas.map(function (f) {
        var estado = f.hecho ? 'Hecho: ' : f.perdido ? 'No se hizo: ' : f.luego ? 'Más tarde: ' : 'Falta: ';
        return '<button class="item-hoy' + (f.hecho ? ' hecho' : '') + (f.perdido ? ' perdido' : '') + (f.luego ? ' luego' : '') + (f.alerta && !f.hecho ? ' alerta' : '') + '" id="' + f.id + '"' +
          ' aria-label="' + esc(estado + f.titulo + '. ' + f.texto) + '">' +
          '<i class="tilde" aria-hidden="true">' + (f.hecho ? '✓' : f.perdido ? '✕' : '') + '</i>' +
          '<span><b>' + esc(f.titulo) + '</b><small>' + esc(f.texto) + '</small></span><em aria-hidden="true">›</em></button>';
      }).join('') + '</div>';
  } else if (!x.sinModulos && !x.incompleto) {
    html += '<div class="vacio">Hoy no tenés nada pendiente.</div>';
  }
  if (x.sinModulos && !total) {
    html += '<div class="nota">Todavía no tenés módulos asignados. Cuando tu supervisor te los asigne, tus fotos de cada día aparecen acá.</div>';
  }
  /* Lo que le dejó el supervisor al revisar (SQL 150): tocarla abre la foto con las marcas. */
  html += (x.sugerencias || []).map(function (s, i) {
    return '<button class="sugerencia-sup" data-sug="' + i + '"><b>Sugerencia de tu supervisor · ' + esc(s.modulo_nombre) + (s.nivel_final ? ' (' + esc(NIVEL[s.nivel_final]) + ')' : '') + '</b>' +
      '<span>' + esc(s.comentario || 'Te marcó algo en la foto.') + '</span><em>Ver la foto ›</em></button>';
  }).join('');
  html += tarjetaOrden(x.semana, x.semanaFallo);

  app.innerHTML = html;
  engancharCabeza();
  var ir = {
    hFotos: function () { irA('fotos'); },
    hTestigo: function () { pantallaTestigo((x.testigoPend || x.testigoHecho).id); },
    hTareas: function () { irA('tareas'); },
    hTest: function () { pantallaDesafio(d); },
    hCaja: function () { irA('caja'); }
  };
  Object.keys(ir).forEach(function (k) { var b = document.getElementById(k); if (b) b.onclick = ir[k]; });
  var b;
  if ((b = document.getElementById('banner'))) b.onclick = function () { pantallaBienvenida(pantallaHoy); };
  if ((b = document.getElementById('reintentarHoy'))) b.onclick = pantallaHoy;
  app.querySelectorAll('[data-sug]').forEach(function (s) { s.onclick = function () { verRevision(x.sugerencias[+s.dataset.sug].id); }; });
  /* Con todo lo tuyo hecho (y todo cargado): el festejo, una vez por día. La
     caja no cuenta: la cierra uno solo y a la noche (si no, casi nadie lo vería). */
  var propias = filas.filter(function (f) { return f.id !== 'hCaja'; });
  if (propias.length && !x.incompleto && propias.every(function (f) { return f.hecho; })) {
    festejarUnaVez('dia-' + hoy, filas.every(function (f) { return f.hecho; }) ? '¡Terminaste todo lo de hoy!' : '¡Terminaste lo tuyo de hoy!');
  }
}

/* ════════════════════════════════════════════════════════════════════════
   FOTOS: el croquis del local con lo tuyo de tu color y las cámaras en lo
   que falta (13/10: antes estaba en Hoy, con una lista que repetía lo mismo).
   La lista queda sólo para lo que no está en el croquis (o si el local
   todavía no tiene el croquis armado).
   ════════════════════════════════════════════════════════════════════════ */

function pantallaFotos() {
  if (!_vend) { pantallaLocales(); return; }
  marcarPestana('fotos');
  adentro();
  var per = yo(), hoy = hoyAR(), id = valor(per.id), nada = function () { return null; };
  var desdeHoy = new Date(hoy + 'T03:00:00Z').toISOString(), desdeAyer = new Date(sumarDias(hoy, -1) + 'T03:00:00Z').toISOString();
  app.innerHTML = cabeza('Fotos') + '<p class="cargando">Cargando…</p>';
  engancharCabeza();
  Promise.all([
    /* Como en Hoy: lo de hoy, lo pendiente, lo que se mandó hoy (tomada_en: la de la foto mandada) y lo que venció ayer u hoy. */
    leerConMueble('/orden_v_controles?select=id,local_id,modulo_id,modulo_numero,modulo_nombre,foto_referencia_path,sector_tipo,mueble,tipo,estado,vence_en,enviado_en,tomada_en,nivel,frontal' +
         '&persona_id=eq.' + id + '&tipo=neq.correccion&or=(fecha.eq.' + hoy + ',estado.eq.pendiente,enviado_en.gte.' + desdeHoy + ',and(estado.eq.vencido,vence_en.gte.' + desdeAyer + '))' +
         '&order=sector_tipo.asc,modulo_numero.asc'),
    /* Lo que la IA marcó y está sin corregir: ese módulo dice "Corregir". */
    leer('/orden_tareas?select=modulo_id&persona_id=eq.' + id + '&estado=eq.pendiente&origen=eq.ia'),
    leer('/orden_sectores?select=id&or=(responsable_id.eq.' + id + ',suplente_id.eq.' + id + ')&limit=1').catch(nada),
    per.local_id ? cargarMapa(per.local_id).catch(nada) : Promise.resolve(null)
  ]).then(function (r) {
    if (_pestana !== 'fotos') return;
    dibujarFotos({ controles: r[0] || [], tareasIA: r[1] || [], sinModulos: Array.isArray(r[2]) && r[2].length === 0, mapa: r[3] });
  }).catch(function (e) { pantallaError(e, pantallaFotos); });
}

/* Sacar de nuevo una foto ya mandada (SQL 126, 15/10, pedido de Mauricio:
   "durante el día la podés sacar de vuelta… solo mientras no la revisé").
   La regla de verdad está en la base; esto es para ofrecerlo. */
function sePuedeRehacer(c) {
  return !!c && c.estado === 'enviado' && c.tipo !== 'correccion' && !!c.enviado_en && !!c.vence_en &&
    new Date(c.vence_en) > new Date() && hoyAR(new Date(c.enviado_en)) === hoyAR();
}

function ofrecerRehacer(c) {
  /* Se puede hasta el final del día en que se mandó, o antes si vence hoy. */
  var hasta = hoyAR(new Date(c.vence_en)) === hoyAR() ? 'hasta las ' + hora(c.vence_en) : 'hasta el final del día';
  preguntar({ texto: c.modulo_nombre + ': ya mandaste la foto. Si salió mal, la podés sacar de nuevo ' + hasta +
                     ', mientras tu supervisor no la revise. Hasta que mandes la nueva, queda la que mandaste.',
              si: 'Sacar de nuevo', no: 'Dejarla así' })
    .then(function (si) { if (si) despuesDelAtras(function () { pantallaFoto(c); }); });
}

function dibujarFotos(x) {
  var corregir = {};
  x.tareasIA.forEach(function (t) { if (t.modulo_id) corregir[t.modulo_id] = true; });
  _controles = {};
  x.controles.forEach(function (c) { _controles[c.id] = c; });

  var total = x.controles.length;
  var hechos = x.controles.filter(function (c) { return c.estado === 'enviado' || c.estado === 'revisado'; }).length;
  var html = cabeza('Fotos') + '<div class="progreso-fotos">' + (total
    ? '<b>' + hechos + ' de ' + total + '</b> ' + (total === 1 ? 'foto mandada' : 'fotos mandadas') +
      '<div class="progreso"><i style="width:' + Math.round(100 * hechos / total) + '%"></i></div>'
    : '<b>Hoy no tenés fotos para mandar.</b>') + '</div>';

  /* El croquis del local: lo tuyo con tu color, lo demás apagado. Tocás un
     módulo con la cámara y mandás su foto. */
  var mapa = x.mapa, mios = {}, marcas = {}, enMapa = {}, vidrieras = [];
  var hayMapa = !!(mapa && mapa.pared.length + mapa.islas.length + mapa.dep.length);
  if (hayMapa) {
    /* Si un módulo tiene dos controles (el del día y una sorpresa), manda lo que falta hacer. */
    var PESO = { corregir: 5, sorpresa: 4, pendiente: 3, vencido: 2, listo: 1 };
    x.controles.forEach(function (c) {
      var e = estadoDe(c, corregir);
      var marca = c.estado === 'vencido' ? 'vencido' : e.hecho ? 'listo' : e.clase === 'corregir' ? 'corregir' : e.clase === 'sorpresa' ? 'sorpresa' : 'pendiente';
      if (!marcas[c.modulo_id] || PESO[marca] > PESO[marcas[c.modulo_id]]) marcas[c.modulo_id] = marca;
      mios[c.modulo_id] = true;
    });
    var yoId = yo().id;
    mapa.modulos.forEach(function (m) { enMapa[m.id] = true; var s = mapa.sectorDe[m.sector_id]; if (s && s.responsable_id === yoId) mios[m.id] = true; });
    /* La vidriera es de todos (SQL 145, Mauricio 20/10: "que eso siempre esté habilitado"): cualquiera del local le
       saca foto, cualquier día. Con la cámara mientras no tenga una suya de hoy (con una, su marca). */
    vidrieras = yo().local_id ? mapa.modulos.filter(esVidriera) : [];
    vidrieras.forEach(function (m) { mios[m.id] = true; if (!marcas[m.id]) marcas[m.id] = 'pendiente'; });
    var hayMios = Object.keys(mios).length;
    /* Simple (16/10): sólo la instrucción. Sin la lista de nombres ni "Ver el local": el mapa entero es para el
       supervisor y el encargado (Equipo → El mapa del local). */
    html += '<div class="mapa-caja" id="mapaFotos">' +
      svgMapa(mapa, { mios: hayMios ? mios : null, marcas: marcas }) + svgDeposito(mapa, { mios: hayMios ? mios : null, marcas: marcas }) + '</div>' +
      '<p class="bajada">' + (x.controles.some(function (c) { return !estadoDe(c, corregir).hecho; }) ? (x.controles.some(function (c) { return c.frontal && !estadoDe(c, corregir).hecho; }) ? 'Hoy toca frontal nuevo: cambialo y tocá el módulo con la cámara para mandar su foto.' : 'Tocá un módulo con la cámara para mandar su foto.')
                              : total ? 'Por hoy no te queda ninguna foto para mandar.'
                              : hayMios ? 'Lo tuyo está marcado con tu color.' : 'Todavía no tenés módulos asignados: tocá uno para ver de quién es.') +
      (vidrieras.length ? ' La vidriera es de todos: tocala para mandarle una foto cuando quieras.' : '') + '</p>';
  }

  /* La lista: sin croquis, todo; con croquis, sólo lo que no está dibujado. */
  var sueltos = x.controles.filter(function (c) { return !enMapa[c.modulo_id]; });
  [['salon', hayMapa ? 'Otros' : 'En el salón'], ['deposito', 'Depósito']].forEach(function (g) {
    var lista = sueltos.filter(function (c) { return c.sector_tipo === g[0]; });
    if (!lista.length) return;
    html += '<div class="seccion">' + g[1] + '</div>';
    lista.forEach(function (c) {
      var e = estadoDe(c, corregir);
      var vence = !e.hecho && c.estado !== 'vencido' && c.vence_en ? textoVence(c.vence_en) : '';
      /* Mandada: la cámara sólo si todavía se puede sacar de nuevo (si no, la base la rechaza). */
      var otra = sePuedeRehacer(c), cerrada = !otra && (c.estado === 'enviado' || c.estado === 'revisado');
      html += '<div class="modulo' + (e.hecho ? ' hecho' : '') + '">' +
        '<div class="que"><div class="nombre">' + esc(c.modulo_nombre) + '</div>' +
        '<div class="info"><span class="chip ' + e.clase + '">' + e.texto + '</span>' +
        (vence ? '<span class="chip vence">' + esc(vence) + '</span>' : '') + '</div></div>' +
        (cerrada ? '' : '<button class="camara' + (otra ? ' otra-vez' : '') + '" data-id="' + esc(c.id) + '" aria-label="' +
                        (otra ? 'Sacar de nuevo la foto de ' : 'Sacar foto de ') + esc(c.modulo_nombre) + '">' + CAMARA + '</button>') +
        '</div>';
    });
  });

  if (x.sinModulos && !total) {
    html += '<div class="nota">Todavía no tenés módulos asignados. Cuando tu supervisor te los asigne, tus controles aparecen acá.</div>';
  } else if (!total && !hayMapa) {
    html += '<div class="vacio">Cuando te toque un control, aparece acá y te llega un aviso.</div>';
  }

  app.innerHTML = html;
  engancharCabeza();
  app.querySelectorAll('.camara').forEach(function (bt) {
    bt.onclick = function () {
      var c = _controles[bt.dataset.id];
      if (sePuedeRehacer(c)) { ofrecerRehacer(c); return; }
      /* La lista quedó abierta y ya pasó la hora: se avisa sin abrir la cámara. */
      if (c && (c.estado === 'enviado' || c.estado === 'revisado')) { avisar(c.modulo_nombre + ': ya no se puede cambiar la foto; queda la que mandaste.'); pantallaFotos(); return; }
      pantallaFoto(c);
    };
  });
  /* Tocar el croquis: si ese módulo tiene tu control pendiente, la cámara; si no, de quién es. */
  app.querySelectorAll('#mapaFotos .mapa-mod').forEach(function (g) {
    g.onclick = function () {
      var suyos = x.controles.filter(function (k) { return k.modulo_id === g.dataset.mod; });
      var falta = suyos.filter(function (k) { return !estadoDe(k, corregir).hecho && k.estado !== 'vencido'; })[0] ||
                  suyos.filter(function (k) { return k.estado === 'vencido'; })[0];
      if (falta) { pantallaFoto(falta); return; }
      var deNuevo = suyos.filter(sePuedeRehacer)[0];
      if (deNuevo) { ofrecerRehacer(deNuevo); return; }
      var m = mapa.modulos.filter(function (k) { return k.id === g.dataset.mod; })[0], s = m && mapa.sectorDe[m.sector_id];
      /* La vidriera, de todos (SQL 145): una foto nueva (también si ya mandó una y se la revisaron). */
      if (esVidriera(m) && vidrieras.length) { pantallaFoto(vidrieraLibre(m)); return; }
      var quien = s && mapa.persona[s.responsable_id];
      var que = nombreModulo(m, s, mapa);
      avisar(!suyos.length ? que + (quien ? ' es de ' + nombreLista(quien) + '.' : ' no tiene responsable.')
        : suyos.some(function (k) { return k.estado === 'vencido'; }) ? que + ': la foto de hoy ya venció.'
        : suyos.some(function (k) { return k.estado === 'revisado'; }) ? que + ': tu supervisor ya revisó la foto.'
        : que + ': ya mandaste la foto de hoy.');
    };
  });
}

/* ════════════════════════════════════════════════════════════════════════
   LA FOTO DE UN CONTROL
   La cámara se abre adentro de la app (getUserMedia), con un recuadro (la
   foto es lo de adentro) y la foto de referencia en chiquito. Si el teléfono no la deja usar, se
   abre la cámara del teléfono (capture): igual es cámara, no galería.
   La foto se achica, se sube a orden-fotos, se registra y la IA la revisa
   al instante. Cada foto se revisa UNA vez: para volver a revisar, se saca
   otra. Si la IA falla, el vendedor no queda trabado.
   ════════════════════════════════════════════════════════════════════════ */

/* Las 4 preguntas según el tipo de mueble (SQL 129): las mismas claves que orden_checks_mueble en la base.
   Sin el dato del mueble (una vista de antes), las del sector. */
var PREGUNTAS = {
  estantes: [['dobladas', '¿Las prendas están dobladas y prolijas?'],
             ['frontales', '¿Los frontales están completos (4 prendas)?'],
             ['etiquetas', '¿Las etiquetas están adentro y con precio?'],
             ['limpieza', '¿Está limpio y sin faltantes?']],
  mesa: [['dobladas', '¿Las pilas están dobladas y parejas?'],
         ['exhibicion', '¿Está ordenado por color (o por talle, si es liquidación) y bien cargado?'],
         ['etiquetas', '¿Las etiquetas están adentro y con precio?'],
         ['limpieza', '¿Está limpio y sin faltantes?']],
  perchero: [['colgado', '¿Las perchas son iguales y miran para el mismo lado?'],
             ['exhibicion', '¿Está ordenado por color (o por talle, si es liquidación)?'],
             ['etiquetas', '¿Las etiquetas están adentro y con precio?'],
             ['limpieza', '¿Está limpio y sin faltantes?']],
  vidriera: [['armado', '¿Los maniquíes están vestidos completos y prolijos?'],
             ['carteles', '¿Los carteles y precios están derechos y a la vista?'],
             ['limpieza', '¿El vidrio y el piso están limpios?'],
             ['luces', '¿Están todas las luces prendidas?']],
  deposito: [['dobladas', '¿Está doblado en tamaño A4?'],
             ['rotulado', '¿Está rotulado y se lee bien?'],
             ['talles', '¿Está separado por segmento y talle?'],
             ['limpieza', '¿Está limpio y con los pasillos libres?']]
};
PREGUNTAS.salon = PREGUNTAS.estantes;
var CHECK = { dobladas: 'Doblado', frontales: 'Frontales', etiquetas: 'Etiquetas', limpieza: 'Limpieza',
              exhibicion: 'Exhibición', rotulado: 'Rotulado', talles: 'Segmento y talle',
              colgado: 'Colgado', armado: 'Armado', carteles: 'Carteles', luces: 'Luces' };
/* Sin el SQL 129 las vistas no tienen la columna mueble: se lee de nuevo sin ella (y van las del sector). */
function leerConMueble(ruta) {
  return leer(ruta).catch(function (e) {
    var t = (e && e.message) || '';
    if (e && !e.sinSesion && /mueble/.test(t) && /does not exist|42703/i.test(t)) return leer(ruta.replace(',mueble,', ','));
    throw e;
  });
}
function preguntasDe(c) { return PREGUNTAS[c.mueble] || PREGUNTAS[c.sector_tipo] || PREGUNTAS.estantes; }
/** Lo que se le preguntó de verdad: las del mueble, o, si respondió otras (la app de antes, o le cambiaron el
    mueble después), las que respondió, en el orden de siempre. */
function preguntasRespondidas(c) {
  var lista = preguntasDe(c), r = c.respuestas || {};
  var claves = Object.keys(r);
  if (!claves.length || lista.every(function (q) { return q[0] in r; })) return lista;
  var orden = Object.keys(CHECK);
  return claves.sort(function (a, b) { return orden.indexOf(a) - orden.indexOf(b); }).map(function (k) { return [k, CHECK[k] || k]; });
}

var _stream = null, _marcoObs = null;
function apagarCamara() {
  pararGrabador();   // si estaba grabando un video de producto testigo, se descarta
  window.removeEventListener('devicemotion', alMoverse);
  window.removeEventListener('resize', ponerMarco);
  if (_marcoObs) { _marcoObs.disconnect(); _marcoObs = null; }
  if (_stream) { _stream.getTracks().forEach(function (t) { t.stop(); }); _stream = null; }
}

/* La foto horizontal (15/10, pedido de Mauricio, para los módulos más anchos
   que altos). La app está trabada en vertical (el manifest): con el teléfono
   acostado la pantalla no gira, la cámara sigue dando un cuadro vertical y la
   foto salía de costado. El sensor dice hacia dónde está acostado: la guía se
   gira para leerse derecha y la foto se endereza al sacarla. Si la pantalla
   gira sola (iPhone, o el navegador sin instalar), el cuadro ya viene ancho y
   no se toca. _giro: -90 = acostado con la parte de arriba a la izquierda
   (la foto se gira a la izquierda), 90 = a la derecha, 0 = parado. */
var _giro = 0, _signoY = 1, _calibrado = false, _grav = null;
function alMoverse(e) {
  var a = e.accelerationIncludingGravity;
  if (!a || a.x == null || a.y == null) return;
  _grav = _grav ? { x: _grav.x * 0.7 + a.x * 0.3, y: _grav.y * 0.7 + a.y * 0.3 } : { x: a.x, y: a.y };
  var x = _grav.x, y = _grav.y, ax = Math.abs(x), ay = Math.abs(y);
  /* Parado: de ahí sale el signo (hay teléfonos que lo dan al revés). Se toma
     UNA vez, la primera que lo ve parado: después, dado vuelta para un estante
     bajo no lo cambia. Mirando al piso o al techo (una mesa desde arriba) no
     se sabe: queda como estaba. */
  if (ay > 6 && ay > 2 * ax) {
    if (!_calibrado) { _signoY = y > 0 ? 1 : -1; _calibrado = true; }
    ponerGiro(0);
  } else if (ax > 6 && ax > 1.5 * ay) ponerGiro(x * _signoY > 0 ? -90 : 90);
}
function ponerGiro(g) {
  if (window.innerWidth > window.innerHeight) g = 0;   // la pantalla ya giró sola
  if (g === _giro) return;
  _giro = g;
  var v = document.getElementById('vista');
  if (v) { v.classList.toggle('acostado-izq', g === -90); v.classList.toggle('acostado-der', g === 90); }
}

/** Como aJpeg, pero sólo la parte r del cuadro ({x, y, w, h}, ver recorteMarco) y girada 90° a la
    izquierda (giro -90) o a la derecha (90). */
function aJpegGirado(fuente, r, giro) {
  var escala = Math.min(1, 1280 / Math.max(r.w, r.h));
  var w = Math.round(r.w * escala), h = Math.round(r.h * escala);
  var cv = document.createElement('canvas');
  cv.width = giro ? h : w;
  cv.height = giro ? w : h;
  var x = cv.getContext('2d');
  if (giro < 0) { x.translate(0, w); x.rotate(-Math.PI / 2); } else if (giro > 0) { x.translate(h, 0); x.rotate(Math.PI / 2); }
  x.drawImage(fuente, r.x, r.y, r.w, r.h, 0, 0, w, h);
  return new Promise(function (ok, mal) {
    cv.toBlob(function (b) { b ? ok(b) : mal(new Error('No se pudo procesar la foto')); }, 'image/jpeg', 0.75);
  });
}

/* El recuadro (21/10, pedido de Mauricio con la captura de otra app): la
   cámara llena la pantalla, lo de afuera del recuadro se ve oscurecido y la
   foto es exactamente lo de adentro. Antes el recuadro era una guía nomás: la
   pantalla recortaba los costados del cuadro y la foto salía mucho más ancha
   que lo que se veía. El recuadro es lo más grande que entra entre el cartel
   y el botón (los módulos son grandes: así no hay que irse tan para atrás) y
   parado, como los módulos: entre 9:16 y 3:4. Si la pantalla giró sola, al
   revés. */
function ponerMarco() {
  var video = document.getElementById('video'), marco = document.querySelector('.con-marco .guia');
  if (!video || !marco) return;
  var W = video.clientWidth, H = video.clientHeight, borde = 14;
  var arriba = document.querySelector('.con-marco .camara-arriba').offsetHeight + marco.firstChild.offsetHeight + 12;
  var ancho = W - 2 * borde, alto = H - arriba - borde;
  if (ancho <= 0 || alto <= 0) return;
  var min = ancho < alto ? 9 / 16 : 4 / 3, max = ancho < alto ? 3 / 4 : 16 / 9;
  if (ancho / alto > max) ancho = alto * max;
  else if (ancho / alto < min) alto = ancho / min;
  marco.style.left = Math.round((W - ancho) / 2) + 'px';
  marco.style.top = Math.round(arriba + (H - borde - arriba - alto) / 2) + 'px';
  marco.style.width = Math.round(ancho) + 'px';
  marco.style.height = Math.round(alto) + 'px';
}

/** Lo que se ve adentro del recuadro, en píxeles del cuadro de la cámara (el video se muestra con
    object-fit: cover, centrado). Sin recuadro, el cuadro entero. */
function recorteMarco(video) {
  var vw = video.videoWidth, vh = video.videoHeight, marco = document.querySelector('.con-marco .guia');
  if (!marco) return { x: 0, y: 0, w: vw, h: vh };
  var v = video.getBoundingClientRect(), m = marco.getBoundingClientRect();
  var s = Math.max(v.width / vw, v.height / vh);
  var x = Math.max(0, (m.left - v.left - (v.width - vw * s) / 2) / s), y = Math.max(0, (m.top - v.top - (v.height - vh * s) / 2) / s);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(Math.min(vw - x, m.width / s)), h: Math.round(Math.min(vh - y, m.height / s)) };
}

function analizar(fotoId) {
  return llamarFuncion('analizar-foto', { foto_id: fotoId }).then(function (d) {
    /* Cualquier otra respuesta se toma como "no se pudo revisar": puede enviar igual. */
    if (!d._ok) return { ia_activa: true, error_ia: true, mensaje: 'No pudimos revisar la foto automáticamente. Podés enviarla igual.' };
    return d;
  });
}

var _revisiones = 0;
function pantallaFoto(c) {
  if (!c) { irA('fotos'); return; }
  /* rehacer: ya la había mandado (SQL 126); la nueva reemplaza a esa sólo si la manda.
     ia: lo que dice la IA de la foto (llega aparte: no hace falta esperarla para mandar). */
  var estado = { url: null, fotoId: null, resultado: null, ia: null, rehacer: c.estado === 'enviado', tarde: c.estado === 'vencido', vista: ++_revisiones };
  abrirCamara(c, estado);
}

/** La foto de la vidriera sin control todavía (SQL 145): el control nace cuando se registra la foto
    (orden_vidriera_foto). Así, si abre la cámara y se arrepiente, no queda nada pendiente. */
function vidrieraLibre(m) {
  return { id: null, libre: true, local_id: yo().local_id, modulo_id: m.id, modulo_nombre: m.nombre, foto_referencia_path: m.foto_referencia_path || null,
           sector_tipo: 'salon', mueble: 'vidriera', tipo: 'programado', estado: 'pendiente', frontal: false };
}

/** Registra la foto en su control; la de la vidriera libre, en el suyo de hoy (o en uno nuevo). */
function registrarFoto(c, estado, ruta) {
  if (c.id) return llamar('orden_registrar_foto', { p_control: c.id, p_foto_path: ruta });
  return llamar('orden_vidriera_foto', { p_modulo: c.modulo_id, p_foto_path: ruta }).then(function (r) {
    c.id = r.control;
    /* Ya había mandado una hoy y todavía se puede cambiar: la nueva va a ese control y la reemplaza si la manda. */
    if (r.estado === 'enviado') { c.estado = 'enviado'; estado.rehacer = true; }
    return r.foto;
  }, function (e) {
    /* La base todavía no tiene el SQL 145. */
    if (/orden_vidriera_foto/.test(mensajeDe(e))) { e = new Error('Falta actualizar el sistema: avisale a tu supervisor.'); e.delServidor = true; }
    throw e;
  });
}

/** La cámara a pantalla completa. alSacar(blob) recibe la foto ya achicada. */
function camara(titulo, referencia, guia, alSacar, alCerrar) {
  apagarCamara();
  barra.hidden = true;
  app.className = 'app';
  app.innerHTML =
    '<div class="camara-vista con-marco" id="vista">' +
      '<div class="visor">' +
        '<video id="video" playsinline muted autoplay></video>' +
        '<div class="guia"><span>' + esc(guia) + '</span></div>' +
        '<div class="camara-arriba"><button class="volver" id="cerrar">‹ Volver</button><span class="titulo">' + esc(titulo) + '</span><span style="width:60px"></span></div>' +
      '</div>' +
      '<div class="camara-abajo">' +
        /* La foto modelo, al costado del botón como la última foto en la cámara del teléfono: tocarla la agranda. */
        '<button class="ref-caja" id="refCaja" type="button" hidden><img class="referencia" id="ref" alt="Cómo tiene que quedar"><small>Modelo</small></button>' +
        '<button class="disparar" id="disparar" aria-label="Sacar la foto"></button>' +
        '<button class="enlace" id="otra">¿No anda la cámara?</button>' +
      '</div>' +
      '<input type="file" id="archivo" accept="image/*" capture="environment" hidden>' +
    '</div>';
  var video = document.getElementById('video');
  var archivo = document.getElementById('archivo');
  _giro = 0;
  _grav = null;
  window.addEventListener('devicemotion', alMoverse);
  ponerMarco();
  window.addEventListener('resize', ponerMarco);
  /* Si cambia el lugar de la imagen (aparece la foto modelo abajo, se esconde la barra del navegador), se rehace. */
  if (window.ResizeObserver) { _marcoObs = new ResizeObserver(function () { ponerMarco(); }); _marcoObs.observe(video); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ponerMarco);   // con la letra, el cartel cambia de alto
  document.getElementById('cerrar').onclick = function () { apagarCamara(); alCerrar(); };
  document.getElementById('otra').onclick = function () { archivo.click(); };
  archivo.onchange = function () {
    var f = archivo.files && archivo.files[0];
    if (!f) return;
    archivoAJpeg(f).then(function (b) { apagarCamara(); alSacar(b); }, function (e) { avisar(e.message); });
  };
  var refCaja = document.getElementById('refCaja');
  refCaja.onclick = function () { refCaja.classList.toggle('grande'); };
  if (referencia) {
    urlFirmada(referencia).then(function (u) {
      var ref = document.getElementById('ref');
      if (u && ref) { ref.src = u; refCaja.hidden = false; }
    });
  }

  var disparar = document.getElementById('disparar');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { sinCamara(); return; }
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false
  }).then(function (s) {
    if (!document.getElementById('video')) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
    _stream = s;
    video.srcObject = s;
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }).catch(sinCamara);

  disparar.onclick = function () {
    if (!_stream || !video.videoWidth) { archivo.click(); return; }
    /* Lo de adentro del recuadro; acostado con el cuadro vertical, se endereza (ver alMoverse). */
    var giro = video.videoHeight > video.videoWidth ? _giro : 0;
    ponerMarco();   // por si la pantalla recién giró y el recuadro todavía no se rehizo
    aJpegGirado(video, recorteMarco(video), giro).then(function (b) { apagarCamara(); alSacar(b); }, function (e) { avisar(e.message); });
  };

  /* Sin permiso o sin cámara adentro de la app: la del teléfono. */
  function sinCamara() {
    var g = document.querySelector('.guia span');
    if (g) g.textContent = 'Tocá el botón para abrir la cámara del teléfono';
    ponerMarco();
    disparar.onclick = function () { archivo.click(); };
  }
}

function abrirCamara(c, estado) {
  camara(c.modulo_nombre + (c.frontal ? ' · frontal nuevo' : ''), c.foto_referencia_path, c.frontal ? 'Con el frontal nuevo puesto: que entre todo el módulo' : 'Que entre todo el módulo en el recuadro',
    function (blob) { procesar(c, estado, blob); },
    function () { if (estado.url) abrirRevision(c, estado); else irA('fotos'); });
}

function procesar(c, estado, blob) {
  if (estado.url) URL.revokeObjectURL(estado.url);
  estado.url = URL.createObjectURL(blob);
  estado.blob = blob;
  estado.fotoId = null;
  estado.ruta = null;
  estado.resultado = null;
  estado.ia = null;
  mandarFoto(c, estado);
}

/* Sube y registra la foto; con eso ya se puede mandar, salga como salga (Mauricio, 15/10: "que la suba, por más
   que esté mal, y después nosotros se la corregimos"). La IA la revisa aparte y lo que dice se muestra después de
   mandarla, como sugerencia. Si se corta la señal, "Reintentar" sigue desde donde quedó (la misma foto, sin
   subirla dos veces si ya subió). */
function mandarFoto(c, estado) {
  estado.resultado = { subiendo: true };
  abrirRevision(c, estado);
  var subida = estado.ruta ? Promise.resolve(estado.ruta)
    : subirArchivo(c.local_id + '/' + hoyAR() + '/' + (c.id || 'vidriera-' + c.modulo_id) + '/' + nombreArchivo(), estado.blob)
        .then(function (ruta) { estado.ruta = ruta; return ruta; });
  var paso = estado.fotoId ? Promise.resolve(estado.fotoId)
    : subida.then(function (ruta) { return registrarFoto(c, estado, ruta); })
        .then(function (id) { estado.fotoId = id; return id; });
  paso.then(function (id) {
    estado.resultado = {};
    if (!estado.enviado && enSuRevision(estado)) abrirRevision(c, estado);
    if (estado.ia && !estado.ia.error_ia) return;   // ya la revisó (o la está revisando): un "Reintentar" no la pide de nuevo
    estado.ia = { revisando: true };
    analizar(id).then(function (r) { return r || {}; }, function () {
      return { error_ia: true };
    }).then(function (r) {
      if (estado.fotoId !== id) return;   // sacó otra mientras tanto
      estado.ia = r;
      if (estado.enviado) pantallaMandada(c, estado);
    });
  }).catch(function (e) {
    if (e && e.sinSesion) { pantallaError(e); return; }
    /* Ya no se puede cambiar (la revisaron, o pasó la hora): no hay nada que reintentar. */
    var cerrado = !esDeRed(e) && /ya revisó|Ya enviaste|no se puede cambiar/i.test(mensajeDe(e));
    estado.resultado = { fallo: esDeRed(e) ? 'Sin señal: la foto no se pudo mandar. Quedó acá; tocá "Reintentar" cuando haya señal.' : mensajeDe(e), cerrado: cerrado };
    if (enSuRevision(estado)) abrirRevision(c, estado);
  });
}

/** Si lo que está a la vista es la revisión de esta foto: si se fue ("Volver", el "atrás" del teléfono, un aviso)
    mientras subía o se mandaba, lo que llega después no se dibuja encima de otra pantalla. */
function enSuRevision(estado) {
  var v = document.getElementById('volver');
  return !!v && v.getAttribute('data-vista') === String(estado.vista);
}

/** Lo que dice la IA, como sugerencia para la próxima (nunca frena: la foto ya se mandó). */
function tarjetaSugerencias(ia) {
  if (ia.revisando) return '<div class="revision"><div class="revisando"><i class="ruedita"></i>La IA la está revisando…</div></div>';
  if (ia.foto_valida === false) {
    return '<div class="revision"><div class="titulo">Para la próxima</div><div class="bajada" style="margin:0">' +
      esc(ia.motivo || 'Que entre todo el módulo en la foto.') + '</div></div>';
  }
  var hs = Array.isArray(ia.hallazgos) ? ia.hallazgos : [], tareas = Array.isArray(ia.tareas_creadas) ? ia.tareas_creadas.length : 0;
  return '<div class="revision"><div class="titulo">Sugerencias de la IA</div>' +
    (ia.comentario ? '<div class="bajada" style="margin:0 0 6px">' + esc(ia.comentario) + '</div>' : '') +
    (hs.length
      ? hs.map(function (h) {
          return '<div class="hallazgo sugerencia"><b>' + esc(h.titulo) + '</b>' + (h.detalle ? '<small>' + esc(h.detalle) + '</small>' : '') + '</div>';
        }).join('')
      : '<div class="bajada" style="margin:0">No encontró nada para mejorar.</div>') +
    (tareas ? '<div class="bajada" style="margin:8px 0 0">' + (tareas === 1 ? 'Quedó 1 tarea' : 'Quedaron ' + tareas + ' tareas') + ' en Tareas.</div>' : '') +
    (ia.tareas_resueltas ? '<div class="bajada" style="margin:8px 0 0">Se cerró sola ' + (ia.tareas_resueltas === 1 ? '1 tarea' : ia.tareas_resueltas + ' tareas') + ' que ya está bien.</div>' : '') +
    /* Qué hay (SQL 118): lo anotó en el croquis, o lo deja como sugerencia si lo había escrito alguien. */
    (ia.que_hay && ia.que_hay_estado === 'puesto' ? '<div class="bajada" style="margin:8px 0 0">En el croquis anotó qué hay: <b>' + esc(ia.que_hay) + '</b>.</div>' : '') +
    (ia.que_hay && ia.que_hay_estado === 'sugerido' ? '<div class="bajada" style="margin:8px 0 0">Ve <b>' + esc(ia.que_hay) + '</b>, y en el croquis dice otra cosa: queda para que lo vea tu supervisor.</div>' : '') +
    '</div>';
}
/** Si lo que volvió de la IA es una revisión (no un error, ni la IA apagada, ni "ya se revisó"). */
function iaUtil(ia) { return !!ia && !ia.error_ia && ia.ia_activa !== false && !ia.ya_analizada; }
/** Si la IA tiene algo para sugerir después de mandarla (lo que sólo informa, como una tarea que se cerró sola,
    no frena: va directo a Fotos). */
function iaParaContar(ia) {
  if (!iaUtil(ia)) return false;
  return !!(ia.revisando || ia.foto_valida === false || (Array.isArray(ia.hallazgos) && ia.hallazgos.length) ||
            (Array.isArray(ia.tareas_creadas) && ia.tareas_creadas.length) || ia.que_hay_estado === 'sugerido');
}
/** Lo que hay que mirar en ese mueble, como recordatorio (eran las 4 preguntas de "Antes de enviar"; Mauricio,
    15/10: "sacalas y dejalas como recordatorio, chiquito abajo"). */
function recordatorioFoto(c) {
  return '<p class="ayuda-foto">Para que salga bien: ' + preguntasDe(c).map(function (q) { return esc(CHECK[q[0]] || q[0]); }).join(' · ') + '.</p>';
}
function textoListo(c, estado) {
  /* "Vidriera izq." ya termina en punto: sin otro. */
  return (estado.rehacer ? '¡Listo! Cambiaste la foto: ' : '¡Listo! Mandaste la foto: ') + c.modulo_nombre + (estado.tarde ? ' (tarde).' : /\.$/.test(c.modulo_nombre) ? '' : '.');
}

/* La foto que sacó: sólo "Enviar" (y "Sacar otra" si quiere). Nada la frena: ni lo que diga la IA, ni preguntas
   para responder (15/10, Seba no pudo mandar dos porque la IA marcó cosas "a corregir" y faltaban los Sí/No). */
function abrirRevision(c, estado) {
  barra.hidden = true;
  app.className = 'app';
  var r = estado.resultado || {};
  var html =
    '<button class="volver" id="volver" data-vista="' + estado.vista + '">' + (r.cerrado ? '‹ Fotos' : estado.rehacer ? '‹ Dejar la que mandé' : '‹ Volver a Fotos') + '</button>' +
    '<h1>' + esc(c.modulo_nombre) + '</h1>' +
    /* Si ya no se puede cambiar, la nueva no queda: no se muestra como si fuera la del módulo. Más chica que en otras
       pantallas, así "Enviar" entra sin bajar en un celular chico. */
    (r.cerrado ? '' : '<img class="foto-grande foto-revision" src="' + esc(estado.url) + '" alt="La foto que sacaste">') +
    (r.fallo ? '<div class="revision mala"><div class="titulo">' + (r.cerrado ? 'Ya no se puede cambiar' : 'No se pudo mandar') + '</div><div>' + esc(r.fallo) + '</div></div>' : '');

  if (estado.rehacer && !r.cerrado) {
    html += '<div class="nota">Ya habías mandado una foto de este módulo. Si mandás esta, reemplaza a la otra; si volvés sin mandarla, queda la que mandaste.</div>';
  }

  html += '<div class="acciones">';
  if (r.cerrado) {
    html += '<button class="boton lima" id="aFotos">Volver a Fotos</button>';
  } else if (r.fallo) {
    html += '<button class="boton lima" id="reintentar">Reintentar</button><button class="boton" id="repetir">Sacar otra foto</button>';
  } else if (r.subiendo) {
    html += '<button class="boton lima" disabled><i class="ruedita"></i> Subiendo la foto…</button>';
  } else {
    html += '<button class="boton lima" id="enviar">' + (estado.rehacer ? 'Mandar esta en lugar de la otra' : 'Enviar') + '</button><button class="boton" id="repetir">Sacar otra foto</button>';
  }
  html += '</div>' + (r.cerrado ? '' : recordatorioFoto(c));

  app.innerHTML = html;
  /* Anda siempre, también mientras sube o se manda: lo que esté en camino sigue y, si ya no está acá, avisa con un
     cartel cómo terminó (ver enSuRevision). */
  document.getElementById('volver').onclick = function () { if (estado.url) URL.revokeObjectURL(estado.url); irA('fotos'); };
  var bRep = document.getElementById('repetir');
  if (bRep) bRep.onclick = function () { abrirCamara(c, estado); };
  var bRe = document.getElementById('reintentar');
  if (bRe) bRe.onclick = function () { mandarFoto(c, estado); };
  var bFotos = document.getElementById('aFotos');
  if (bFotos) bFotos.onclick = function () { document.getElementById('volver').click(); };
  var bEnv = document.getElementById('enviar');
  if (bEnv) unaVez(bEnv, function () { return enviarControl(c, estado, bEnv); });
}

function enviarControl(c, estado, boton) {
  boton.textContent = 'Enviando…';
  /* Mientras se manda no se puede sacar otra (la respuesta quedaría con la foto nueva). "Volver" y el "atrás" sí
     (árbitro, ronda 2: trabados, el "atrás" no hacía nada y el segundo cerraba la app y cortaba el envío). */
  var bRep = document.getElementById('repetir');
  if (bRep) bRep.disabled = true;
  var foto = estado.fotoId;
  var mandada = function () {
    estado.enviado = true;
    estado.fotoMandada = foto;
    pantallaMandada(c, estado);
  };
  /* Sin respuestas: las 4 preguntas pasaron a ser un recordatorio (SQL 130). Con 30 s de tope: si no contesta,
     queda como "sin señal" y se puede tocar "Enviar" de nuevo (si había llegado, la base dice "ya fue enviado"). */
  return llamar('orden_enviar_control', { p_control: c.id, p_respuestas: {} }, 30000).then(mandada, function (e) {
    var aca = enSuRevision(estado), m = mensajeDe(e);
    /* Si ya estaba enviado (se tocó dos veces, o se cortó la señal después de
       que llegara), es lo mismo que "listo". Rehaciendo, quiere decir que la
       nueva ya llegó. */
    if (/ya fue enviado/i.test(m)) { mandada(); return; }
    /* La revisaron, o pasó la hora, mientras sacaba la nueva: queda la que mandó. */
    if (/ya revisó/i.test(m)) { if (aca) irA('fotos'); avisar('Tu supervisor ya la revisó: quedó la que habías mandado.'); return; }
    if (/no se puede cambiar/i.test(m)) { if (aca) irA('fotos'); avisar('Ya pasó la hora: no se pudo cambiar y quedó la que habías mandado.'); return; }
    /* La base todavía no tiene el SQL 130: pide las respuestas que la app ya no pregunta. */
    if (/Respondé las 4 preguntas|Cambiaron las preguntas/i.test(m)) {
      e = new Error('Falta actualizar el sistema: avisale a tu supervisor.');
      e.delServidor = true;   // no es "sin señal"
    }
    if (aca || (e && e.sinSesion)) {
      var b = document.getElementById('repetir');
      if (b) b.disabled = false;
      throw e;
    }
    /* Se fue antes de que terminara: el cartel dice de qué foto es. */
    avisar('No se mandó la foto de ' + c.modulo_nombre + (esDeRed(e) ? ' (no había señal): sacala de nuevo.' : ': ' + mensajeDe(e)));
  });
}

/** Ya mandada: si la IA tiene algo para decir, sus sugerencias para la próxima (Mauricio, 15/10: "la sugerencia va
    después de que la subió"); si no, directo a Fotos. Si la IA todavía la está revisando, se completa sola; si
    termina sin nada para decir, vuelve sola a Fotos. */
function pantallaMandada(c, estado) {
  var listo = textoListo(c, estado);
  var ahi = document.getElementById('mandada');
  if (ahi && ahi.dataset.foto !== String(estado.fotoMandada)) return;       // la pantalla es de otra foto
  /* Se fue antes de que terminara ("Volver", el "atrás", un aviso), o ya tocó "Listo" y la IA llegó tarde: sólo
     el cartel, una vez, sin sacarlo de donde está. */
  if (!ahi && !enSuRevision(estado)) {
    if (!estado.avisado) { estado.avisado = true; avisar(listo); }
    return;
  }
  if (!iaParaContar(estado.ia)) {
    estado.avisado = true;
    if (estado.url) URL.revokeObjectURL(estado.url);
    irA('fotos');
    avisar(listo);
    return;
  }
  /* Llegó la IA mientras miraba la pantalla: su tarjeta. */
  if (ahi) { var t = ahi.querySelector('.revision'); if (t) t.outerHTML = tarjetaSugerencias(estado.ia); return; }
  estado.avisado = true;
  barra.hidden = true;
  app.className = 'app';
  app.innerHTML = '<div id="mandada" data-foto="' + esc(String(estado.fotoMandada)) + '">' +
    '<h1>' + esc(listo) + '</h1>' +
    tarjetaSugerencias(estado.ia) +
    '<div class="acciones"><button class="boton lima" id="fin">Listo</button></div></div>';
  document.getElementById('fin').onclick = function () { if (estado.url) URL.revokeObjectURL(estado.url); irA('fotos'); };
}

/* ════════════════════════════════════════════════════════════════════════
   TAREAS (los avisos están en la campanita de arriba)
   ════════════════════════════════════════════════════════════════════════ */

var ORIGEN = { ia: 'Detectada por la IA', supervisor: 'Pedida por tu supervisor', admin: 'Pedida por la administración', sistema: 'Del sistema' };
var ESTADO_TAREA = { hecha: 'Hecha', no_pude: 'No pudiste', cancelada: 'Cancelada', vencida: 'Vencida', pendiente: 'Pendiente' };

function pantallaTareas() {
  marcarPestana('tareas');
  adentro();
  app.innerHTML = cabeza('Tareas', '') + '<p class="cargando">Cargando…</p>';
  engancharCabeza();
  var id = valor(yo().id);
  var semana = new Date(Date.now() - 7 * 864e5).toISOString();
  /* SQL 150: la foto sobre la que le piden la corrección, con sus marcas, y la foto modelo para la cámara. */
  leer150('/orden_v_tareas?select=id,titulo,detalle,origen,estado,vence_en,requiere_foto,prorroga_estado,local_id,completada_en,correccion,modulo_id,modulo_nombre' +
       '&persona_id=eq.' + id + '&or=(estado.in.(pendiente,vencida),completada_en.gte.' + semana + ')&order=vence_en.asc',
       'foto_antes,marcas,control_nivel,modulo_referencia').then(function (r) {
    if (_pestana !== 'tareas') return;
    dibujarTareas(r || []);
  }).catch(function (e) { pantallaError(e, pantallaTareas); });
}

function dibujarTareas(tareas) {
  var abiertas = tareas.filter(function (t) { return t.estado === 'pendiente' || t.estado === 'vencida'; });
  var cerradas = tareas.filter(function (t) { return t.estado !== 'pendiente' && t.estado !== 'vencida'; });
  var html = cabeza('Tareas', '');

  html += '<div class="seccion">Para hacer</div>';
  if (!abiertas.length) html += '<div class="vacio">No tenés tareas pendientes.</div>';
  abiertas.forEach(function (t) {
    var chips = '<span class="chip ' + (t.estado === 'vencida' ? 'vencido' : 'vence') + '">' + esc(textoVence(t.vence_en, t.estado)) + '</span>';
    if (t.prorroga_estado === 'pedida') chips += '<span class="chip pendiente">Pediste más tiempo</span>';
    if (t.prorroga_estado === 'aprobada') chips += '<span class="chip listo">Te dieron más tiempo</span>';
    if (t.prorroga_estado === 'rechazada') chips += '<span class="chip corregir">No se aprobó más tiempo</span>';
    /* Una corrección que le pidieron al revisar su foto (SQL 150): la foto con las marcas y qué corregir. */
    var pedido = t.correccion || (t.foto_antes ? t.detalle : null);
    if (t.foto_antes && !t.correccion && (t.control_nivel === 'bien' || t.control_nivel === 'impecable')) {
      chips += '<span class="chip nivel-' + esc(t.control_nivel) + '">Tu foto: ' + esc(NIVEL[t.control_nivel]) + '</span>';
    }
    html += '<div class="tarea" data-id="' + esc(t.id) + '">' +
      '<small class="origen">' + esc(ORIGEN[t.origen] || '') + '</small>' +
      '<div class="nombre">' + esc(t.titulo) + '</div>' +
      (t.detalle && t.detalle !== pedido ? '<div class="detalle">' + esc(t.detalle) + '</div>' : '') +
      /* El supervisor la mandó a corregir (SQL 132): lo que pidió, bien a la vista. */
      (pedido ? '<div class="nota alerta tarea-corregir"><b>Corregí:</b> ' + esc(pedido) + '</div>' : '') +
      (t.foto_antes ? fotoConMarcas(t.foto_antes, t.marcas, { etiqueta: (t.marcas || []).length ? 'Mirá las marcas' : 'Tu foto', alt: 'Tu foto, con lo que hay que corregir' }) : '') +
      '<div class="info">' + chips + '</div>' +
      '<div class="botones">' +
        '<button class="boton lima chico" data-accion="hecha">' + (t.requiere_foto ? 'Hecha + foto' : 'Hecha') + '</button>' +
        (t.estado === 'pendiente' ? '<button class="boton chico" data-accion="nopude">No pude</button>' : '') +
        (t.estado === 'pendiente' && !t.prorroga_estado ? '<button class="boton chico" data-accion="tiempo">Pedir más tiempo</button>' : '') +
      '</div></div>';
  });

  if (cerradas.length) {
    html += '<div class="seccion">Últimos 7 días</div>' + cerradas.map(function (t) {
      return '<div class="fila"><span>' + esc(t.titulo) + '</span><span class="chip ' + (t.estado === 'hecha' ? 'listo' : 'pendiente') + '">' + esc(ESTADO_TAREA[t.estado] || t.estado) + '</span></div>';
    }).join('');
  }
  html += '<input type="file" id="fotoTarea" accept="image/*" capture="environment" hidden>';

  app.innerHTML = html;
  engancharCabeza();
  cargarFotos(app);
  var porId = {};
  tareas.forEach(function (t) { porId[t.id] = t; });
  app.querySelectorAll('.tarea [data-accion]').forEach(function (b) {
    var t = porId[b.closest('.tarea').dataset.id];
    unaVez(b, function () { return accionTarea(t, b.dataset.accion, b); });
  });
}

/* ════════════════════════════════════════════════════════════════════════
   LOS AVISOS (la campanita de arriba): los últimos, y tocar uno lleva a su
   pantalla. Al verlos quedan leídos.
   ════════════════════════════════════════════════════════════════════════ */

function pantallaAvisos() {
  apagarCamara();
  adentro();
  abrirAparte('avisos');
  marcarPestana('avisos');
  var arriba = '<button class="volver" id="volver">‹ Volver</button><h1>Avisos</h1>';
  app.innerHTML = arriba + '<p class="cargando">Cargando…</p>';
  document.getElementById('volver').onclick = volverDeAparte;
  var alAbrir = new Date().toISOString();
  leer('/orden_avisos?select=id,titulo,cuerpo,url,creado_en,leido_en,estado&persona_id=eq.' + valor(yo().id) + '&order=creado_en.desc&limit=40').then(function (avisos) {
    if (_pestana !== 'avisos') return;
    avisos = avisosALaVista(avisos).slice(0, 30);
    app.innerHTML = arriba + (avisos.length ? '<div class="avisos">' + avisos.map(function (a, k) {
      var lleva = !!String(a.url || '').replace(/^.*#/, '').replace(/^\/+/, '');
      var tag = lleva ? 'button' : 'div';
      return '<' + tag + ' class="aviso' + (a.leido_en ? '' : ' nuevo') + (lleva ? ' con-enlace' : '') + '"' + (lleva ? ' data-k="' + k + '"' : '') + '><b>' + esc(a.titulo) + '</b>' +
        (a.cuerpo ? '<span>' + esc(a.cuerpo) + '</span>' : '') +
        '<small>' + esc(diaMes(a.creado_en) + ' ' + hora(a.creado_en)) + '</small></' + tag + '>';
    }).join('') + '</div>' : '<div class="vacio">Todavía no tenés avisos.</div>');
    document.getElementById('volver').onclick = volverDeAparte;
    app.querySelectorAll('.aviso[data-k]').forEach(function (b) {
      b.onclick = function () { if (!irAEnlace(avisos[+b.dataset.k].url)) avisar('Ese aviso ya no lleva a ningún lado.'); };
    });
    /* Quedan leídos todos los sin leer (también los más viejos que no entran en la lista): si no, el número no se va nunca. */
    _sinLeer = 0; _sinLeerEn = Date.now(); _sinLeerDe = yo().id;
    leer('/orden_avisos?select=id,estado&persona_id=eq.' + valor(yo().id) + '&leido_en=is.null&creado_en=lte.' + alAbrir + '&limit=1000').then(function (f) {
      var ids = avisosALaVista(f).map(function (a) { return a.id; });
      if (ids.length) return llamar('orden_marcar_avisos_leidos', { p_ids: ids });
    }).catch(function () { _sinLeerEn = 0; });
  }).catch(function (e) { pantallaError(e, pantallaAvisos); });
}

function accionTarea(t, accion, boton) {
  if (accion === 'nopude') {
    return preguntarTexto('Contá en una línea por qué no pudiste:').then(function (m) {
      if (!m) return;
      return llamar('orden_no_pude_tarea', { p_tarea: t.id, p_motivo: m }).then(function () { avisar('Le avisamos a tu supervisor.'); pantallaTareas(); });
    });
  }
  if (accion === 'tiempo') {
    return preguntarTexto('¿Por qué necesitás más tiempo?').then(function (m) {
      if (!m) return;
      return llamar('orden_pedir_prorroga', { p_tarea: t.id, p_motivo: m }).then(function () { avisar('Le pediste más tiempo a tu supervisor.'); pantallaTareas(); });
    });
  }
  if (!t.requiere_foto) {
    return confirmar('¿Ya la terminaste?', 'Sí, la terminé').then(function (si) {
      if (!si) return;
      return llamar('orden_completar_tarea', { p_tarea: t.id, p_foto_path: null }).then(function () { avisar('¡Bien! Tarea hecha.'); pantallaTareas(); });
    });
  }
  /* La tarea de un módulo (una corrección): la cámara con el recuadro, como en los controles (SQL 150). Así la foto
     nueva sale encuadrada igual que la de antes y se pueden comparar. */
  if (t.modulo_id) {
    camara((t.modulo_nombre || 'El módulo') + ' · corrección', t.modulo_referencia || null, 'Que entre todo el módulo en el recuadro',
      function (blob) { mandarFotoTarea(t, blob, null); },
      function () { irA('tareas'); });
    return;
  }
  /* Con foto: la cámara del teléfono, la foto achicada a la carpeta de la tarea. */
  return new Promise(function (ok, mal) {
    var input = document.getElementById('fotoTarea');
    input.value = '';
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) { ok(); return; }
      boton.textContent = 'Subiendo…';
      archivoAJpeg(f)
        .then(function (blob) { return subirArchivo(t.local_id + '/tareas/' + t.id + '/' + nombreArchivo(), blob); })
        .then(function (ruta) { return llamar('orden_completar_tarea', { p_tarea: t.id, p_foto_path: ruta }); })
        .then(function (r) {
          /* Si la tarea es de un módulo, la IA revisa la foto: lo que quedó bien se cierra solo. */
          if (r && r.foto_id) analizar(r.foto_id).catch(function () {});
          avisar('¡Bien! Tarea hecha.');
          pantallaTareas();
          ok();
        }, function (e) {
          if (/ya está cerrada/i.test(mensajeDe(e))) { pantallaTareas(); ok(); return; }
          mal(e);
        });
    };
    input.click();
  });
}

/** Una foto suya ya revisada (SQL 150): la foto con las marcas, el nivel y lo que le dejó el supervisor. */
function verRevision(id) {
  apagarCamara();
  barra.hidden = true;
  app.className = 'app';
  var vista = 'rev-' + (++_revisiones);
  var arriba = '<button class="volver" id="volver" data-vista="' + vista + '">‹ Volver a Hoy</button>';
  var volver = function () { document.getElementById('volver').onclick = function () { irA('hoy'); }; };
  app.innerHTML = arriba + '<p class="cargando">Cargando…</p>';
  volver();
  leer150('/orden_v_controles?select=id,modulo_nombre,nivel_final,nivel,comentario,foto_path,revisado_en&id=eq.' + valor(id) + '&persona_id=eq.' + valor(yo().id),
          'marcas,correccion_pedida').then(function (r) {
    var c = (r || [])[0];
    var v = document.getElementById('volver');
    if (!v || v.getAttribute('data-vista') !== vista) return;   // ya se fue a otra pantalla
    if (!c) { app.innerHTML = arriba + '<div class="vacio">Esa foto ya no está.</div>'; volver(); return; }
    var nivel = c.nivel_final || c.nivel, marcas = c.marcas || [];
    app.innerHTML = arriba + '<h1>' + esc(c.modulo_nombre) + '</h1>' +
      '<p class="bajada">' + esc(c.revisado_en ? 'Tu supervisor la revisó el ' + diaMes(c.revisado_en) + ' a las ' + hora(c.revisado_en) + '.' : 'Todavía sin revisar.') + '</p>' +
      (nivel ? '<div class="info" style="margin:0 0 10px"><span class="chip nivel-' + esc(nivel) + '">' + esc(NIVEL[nivel]) + '</span></div>' : '') +
      (c.foto_path ? fotoConMarcas(c.foto_path, marcas, { alt: 'Tu foto' }) : '<div class="vacio">La foto ya no está (se guardan 30 días).</div>') +
      (c.comentario ? '<div class="nota"><b>' + (c.correccion_pedida ? 'Corregí:' : 'Sugerencia:') + '</b> ' + esc(c.comentario) + '</div>'
        : marcas.length ? '<div class="nota">Mirá lo que te marcó en la foto.</div>' : '') +
      (c.correccion_pedida ? '<button class="boton lima" id="irTareas" style="margin-top:12px">Ir a Tareas para mandar la corrección</button>' : '');
    volver();
    cargarFotos(app);
    var b = document.getElementById('irTareas');
    if (b) b.onclick = function () { irA('tareas'); };
  }).catch(function (e) { pantallaError(e, function () { verRevision(id); }); });
}

/** La foto de la corrección, recién sacada con la cámara del recuadro: se sube y la tarea queda hecha.
    Sin señal, "Reintentar" sigue con la misma foto (y no la sube dos veces si ya subió). */
function mandarFotoTarea(t, blob, ruta) {
  barra.hidden = true;
  app.className = 'app';
  var vista = 'tarea-' + (++_revisiones);
  var arriba = '<button class="volver" id="volver" data-vista="' + vista + '">‹ Volver a Tareas</button><h1>' + esc(t.modulo_nombre || 'La corrección') + '</h1>';
  /* Si se fue ("Volver", el "atrás" del teléfono) mientras se mandaba, lo que llega después no se dibuja encima de otra pantalla. */
  var aca = function () { var v = document.getElementById('volver'); return !!v && v.getAttribute('data-vista') === vista; };
  app.innerHTML = arriba + '<div class="revisando"><span class="ruedita"></span>Mandando la foto…</div>';
  document.getElementById('volver').onclick = function () { irA('tareas'); };
  (ruta ? Promise.resolve(ruta) : subirArchivo(t.local_id + '/tareas/' + t.id + '/' + nombreArchivo(), blob))
    .then(function (r) { ruta = r; return llamar('orden_completar_tarea', { p_tarea: t.id, p_foto_path: r }, 30000); })
    .then(function (r) {
      /* La IA también la mira (lo que quedó bien de lo que ella había marcado se cierra solo). */
      if (r && r.foto_id) analizar(r.foto_id).catch(function () {});
      avisar('¡Listo! Mandaste la corrección. Tu supervisor la va a mirar.');
      if (aca() || (_pestana === 'tareas' && !barra.hidden)) irA('tareas');
    }, function (e) {
      if (e && e.sinSesion) { pantallaError(e); return; }
      if (/ya está cerrada/i.test(mensajeDe(e))) { if (aca()) irA('tareas'); return; }
      if (!aca()) { avisar('No se pudo mandar la foto de la corrección: sacala de nuevo desde Tareas.'); return; }
      app.innerHTML = arriba +
        '<div class="nota alerta">' + esc(esDeRed(e) ? 'Sin señal: la foto no se pudo mandar. Quedó acá; tocá "Reintentar" cuando haya señal.' : mensajeDe(e)) + '</div>' +
        '<div class="acciones"><button class="boton lima" id="reintentar">Reintentar</button></div>';
      document.getElementById('volver').onclick = function () { irA('tareas'); };
      document.getElementById('reintentar').onclick = function () { mandarFotoTarea(t, blob, ruta); };
    });
}

/* ════════════════════════════════════════════════════════════════════════
   IDEAS: los tableros de Pinterest y la regla de colores
   ════════════════════════════════════════════════════════════════════════ */

function pantallaIdeas() {
  marcarPestana('ideas');
  adentro();
  app.innerHTML = cabeza('Ideas', '') + '<p class="cargando">Cargando…</p>';
  engancharCabeza();
  Promise.all([
    /* Sin la dirección: el enlace para "Ver en Pinterest" lo da la función, limpio (el de "Compartir" deja editar el tablero). */
    leer('/orden_tableros?select=id,titulo,destacado&activo=is.true&order=destacado.desc,orden.asc'),
    leer('/orden_colores?select=nombre,hex&activo=is.true&order=orden.asc')
  ]).then(function (r) {
    if (_pestana !== 'ideas') return;
    var tableros = r[0] || [], colores = r[1] || [];
    /* Cada tablero con sus fotos adentro de la app (pedido de Mauricio, 13/10):
       las trae la función ideas-tablero; tocás una y se ve grande. */
    var html = cabeza('Ideas', '') +
      tableros.map(function (t, k) {
        return '<section class="tablero-ideas' + (t.destacado ? ' destacado' : '') + '" data-k="' + k + '">' +
          '<div class="tablero-cabeza"><h2>' + esc(t.titulo) + '</h2><a class="ver-pinterest" target="_blank" rel="noopener" hidden>Ver en Pinterest ›</a></div>' +
          '<div class="fotos-ideas"><p class="cargando">Cargando las fotos…</p></div></section>';
      }).join('') +
      (!tableros.length ? '<div class="vacio">Todavía no hay tableros cargados.</div>' : '') +
      '<button class="boton" id="verColores" style="margin-top:14px">Regla de colores</button>' +
      '<div id="colores" hidden><p class="bajada" style="margin:14px 0 8px">En los percheros, del más claro al más oscuro:</p>' +
      colores.map(function (c) {
        return '<div class="color"><i style="background:' + esc(c.hex) + '"></i><span>' + esc(c.nombre) + '</span></div>';
      }).join('') + '</div>';
    app.innerHTML = html;
    engancharCabeza();
    document.getElementById('verColores').onclick = function () {
      var c = document.getElementById('colores');
      c.hidden = !c.hidden;
    };
    tableros.forEach(function (t, k) { mostrarTablero(t, app.querySelector('.tablero-ideas[data-k="' + k + '"]')); });
  }).catch(function (e) { pantallaError(e, pantallaIdeas); });
}

var _fotosIdeas = {};   // tablero → lo que trajo la función (mientras la app está abierta)
function mostrarTablero(t, caja) {
  if (!caja) return;
  var lugar = caja.querySelector('.fotos-ideas'), link = caja.querySelector('.ver-pinterest');
  var sinFotos = function (texto) { lugar.innerHTML = '<p class="bajada" style="margin:0">' + esc(texto) + '</p>'; };
  var deNuevo = function () {
    lugar.innerHTML = '<p class="bajada" style="margin:0 0 8px">No pudimos traer las fotos' + (link.hidden ? '.' : ': también podés verlas en Pinterest.') + '</p>' +
      '<button class="boton chico" data-de-nuevo>Probar de nuevo</button>';
    lugar.querySelector('[data-de-nuevo]').onclick = function () { lugar.innerHTML = '<p class="cargando">Cargando las fotos…</p>'; mostrarTablero(t, caja); };
  };
  (_fotosIdeas[t.id] ? Promise.resolve(_fotosIdeas[t.id]) : llamarFuncion('ideas-tablero', { tablero_id: t.id })).then(function (r) {
    if (r && r.ok) _fotosIdeas[t.id] = r;
    if (!document.body.contains(caja)) return;
    if (r && r.enlace) { link.href = r.enlace; link.hidden = false; }
    if (!(r && r.ok)) {
      if (r && r.motivo === 'no-es-tablero') sinFotos('Este tablero está mal cargado: avisale a tu supervisor.');
      else if (r && r.motivo === 'no-existe') sinFotos('Este tablero no existe o es secreto: avisale a tu supervisor.');
      else deNuevo();
      return;
    }
    var fotos = r.fotos || [];
    if (!fotos.length) { sinFotos('Este tablero todavía no tiene fotos.'); return; }
    lugar.innerHTML = fotos.map(function (f, i) {
      return '<button class="foto-idea" data-i="' + i + '" aria-label="Ver la idea ' + (i + 1) + ' grande">' +
        '<img src="' + esc(f.chica) + '" loading="lazy" referrerpolicy="no-referrer" alt="' + esc(f.titulo || '') + '" onerror="this.parentNode.hidden=true"></button>';
    }).join('');
    lugar.querySelectorAll('.foto-idea').forEach(function (b) { b.onclick = function () { verIdea(fotos, +b.dataset.i); }; });
  }, function () {
    if (document.body.contains(caja)) deNuevo();
  });
}

/** Una idea grande, a pantalla completa: ‹ › (o deslizando) para pasar; "Cerrar" o tocar afuera para volver. */
function verIdea(fotos, i) {
  if (document.querySelector('.visor-idea')) return;   // dos toques: no abre otro encima
  var v = document.createElement('div');
  v.className = 'visor-idea';
  v.setAttribute('role', 'dialog');
  v.setAttribute('aria-modal', 'true');
  v.setAttribute('aria-label', 'Idea grande');
  var varias = fotos.length > 1;
  function dibujar() {
    var f = fotos[i];
    v.innerHTML = '<img src="' + esc(f.foto) + '" referrerpolicy="no-referrer" alt="' + esc(f.titulo || 'Idea ' + (i + 1)) + '">' +
      '<div class="visor-barra">' + (varias ? '<button data-paso="-1" aria-label="La anterior">‹</button>' : '') +
      '<span>' + (i + 1) + ' de ' + fotos.length + '</span>' + (varias ? '<button data-paso="1" aria-label="La siguiente">›</button>' : '') +
      '<button data-paso="cerrar">Cerrar</button></div>';
  }
  function pasar(n) { i = (i + n + fotos.length) % fotos.length; dibujar(); }
  var alAtras = function () { cerrar(true); };
  function cerrar(sinHistoria) {
    if (!v.parentNode) return;
    document.removeEventListener('keydown', tecla, true);
    v.remove();
    if (!sinHistoria) soltarCapa(alAtras);
  }
  function tecla(e) {
    if (e.key === 'Escape') cerrar();
    else if (varias && e.key === 'ArrowLeft') pasar(-1);
    else if (varias && e.key === 'ArrowRight') pasar(1);
  }
  v.onclick = function (e) {
    var b = e.target.closest ? e.target.closest('[data-paso]') : null;
    if (b) { if (b.dataset.paso === 'cerrar') cerrar(); else pasar(+b.dataset.paso); return; }
    if (e.target === v) cerrar();
  };
  var x0 = null;
  v.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  v.addEventListener('touchend', function (e) {
    if (x0 == null || !varias) return;
    var dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) pasar(dx < 0 ? 1 : -1);
  });
  document.addEventListener('keydown', tecla, true);
  document.body.appendChild(v);
  abrirCapa(alAtras);
  dibujar();
  var c = v.querySelector('[data-paso="cerrar"]');
  if (c) c.focus();
}

/* ════════════════════════════════════════════════════════════════════════
   PERFIL: historial, faltas, avisos, instalar
   ════════════════════════════════════════════════════════════════════════ */

function pantallaPerfil() {
  if (!esSupervision()) abrirAparte('perfil');   // el vendedor llega desde la inicial de arriba
  marcarPestana('perfil');
  adentro();
  var per = yo();
  var volver = esSupervision() ? volverAlSistema() : '<button class="volver" id="volverPerfil">‹ Volver</button>';
  app.innerHTML = volver + '<h1>Perfil</h1><p class="cargando">Cargando…</p>';
  var bv = document.getElementById('volverPerfil');
  if (bv) bv.onclick = volverDeAparte;
  var id = valor(per.id);
  Promise.all([
    esSupervision() ? Promise.resolve([]) :
      leer('/orden_v_persona_semana?select=semana,nivel_semana,controles,controles_a_tiempo,controles_tarde,tareas,tareas_a_tiempo,desafio_puntaje,desafio_total' +
           '&persona_id=eq.' + id + '&order=semana.desc&limit=8'),
    leer('/orden_faltas?select=id,tipo,motivo,decidida_en,descargo&persona_id=eq.' + id + '&estado=eq.confirmada&order=creado_en.desc'),
    estadoAvisos().catch(function () { return 'no-soportado'; })
  ]).then(function (r) {
    if (_pestana !== 'perfil') return;
    var semanas = r[0] || [], faltas = r[1] || [], avisos = r[2];
    var html = volver + '<h1>Perfil</h1>' +
      '<div class="perfil"><div class="nombre">' + esc(per.nombre) + '</div>' +
      '<div class="bajada" style="margin:4px 0 0">' + esc(per.local ? per.local + ' · ' + (ROL[per.rol] || '') : ROL[per.rol] || '') + '</div></div>';

    html += '<div class="seccion">Avisos</div><div class="perfil">' +
      (avisos === 'activos' ? '<div>Los avisos están activados en este celular.</div>'
       : avisos === 'no-soportado' ? '<div class="bajada" style="margin:0">Este navegador no recibe avisos.</div>'
       : '<div class="bajada" style="margin:0 0 10px">' + (avisos === 'bloqueados' ? 'Los avisos están bloqueados.' : avisos === 'instalar' ? 'Primero instalá la app en tu iPhone.' : 'Los avisos están apagados.') + '</div>' +
         '<button class="boton lima" id="activar">Activar los avisos</button>') +
      (_instalar ? '<button class="boton" id="instalar" style="margin-top:10px">Instalar la app</button>' : '') + '</div>';

    if (esSupervisorZona()) {
      html += '<div class="seccion">Mis locales</div>' +
        '<button class="boton" id="misLocales">Elegir mis locales</button>' +
        '<p class="bajada" style="margin:8px 0 0">Los que supervisás. Los nuevos los aprueba el administrador.</p>';
    }
    if (esSupervision()) {
      html += '<div class="seccion">Administración</div>' +
        '<a class="boton enlace-boton" href="impecable-admin.html">Abrir la administración</a>' +
        '<p class="bajada" style="margin:8px 0 0">Cómo está cada local, las estadísticas y los ajustes. Mejor en la compu.</p>';
    } else {
      html += '<div class="seccion">Mi historial</div>' + (semanas.length
        ? '<div class="tabla">' + semanas.map(function (s) {
            return '<div class="fila"><span>Semana del ' + esc(diaMes(s.semana)) + '</span>' +
              (s.nivel_semana ? '<span class="chip nivel-' + esc(s.nivel_semana) + '">' + esc(NIVEL[s.nivel_semana]) + '</span>' : '<span class="chip pendiente">' + (mandoFotos(s) ? 'Esperando revisión' : 'Sin fotos') + '</span>') +
              '<small>Controles a tiempo ' + s.controles_a_tiempo + ' de ' + s.controles + ' · Tareas a tiempo ' + s.tareas_a_tiempo + ' de ' + s.tareas +
              (s.desafio_total ? ' · Test ' + s.desafio_puntaje + '/' + s.desafio_total : '') + '</small></div>';
          }).join('') + '</div>'
        : '<div class="vacio">Todavía no hay semanas para mostrar.</div>');
    }

    if (faltas.length) {
      html += '<div class="seccion">Faltas</div>' + faltas.map(function (f) {
        return '<div class="tarea" data-falta="' + esc(f.id) + '"><div class="nombre">' + esc(f.tipo.charAt(0).toUpperCase() + f.tipo.slice(1)) +
          (f.decidida_en ? ' · ' + esc(diaMes(f.decidida_en)) : '') + '</div><div class="detalle">' + esc(f.motivo) + '</div>' +
          (f.descargo ? '<div class="detalle"><b>Tu descargo:</b> ' + esc(f.descargo) + '</div>'
                      : '<div class="botones"><button class="boton chico" data-descargo="' + esc(f.id) + '">Escribir mi descargo</button></div>') + '</div>';
      }).join('');
    }

    html += '<button class="boton" id="salir" style="margin-top:22px">No soy yo</button>';
    app.innerHTML = html;
    if ((bv = document.getElementById('volverPerfil'))) bv.onclick = volverDeAparte;
    unaVez(document.getElementById('salir'), preguntarSalir);
    var b;
    if ((b = document.getElementById('activar'))) b.onclick = function () { pantallaBienvenida(pantallaPerfil); };
    if ((b = document.getElementById('misLocales'))) b.onclick = function () { pantallaMisLocales(function () { irA('perfil'); }); };
    if ((b = document.getElementById('instalar'))) b.onclick = instalarApp;
    app.querySelectorAll('[data-descargo]').forEach(function (bt) {
      unaVez(bt, function () {
        return preguntarTexto('Escribí tu descargo (lo lee tu supervisor):').then(function (t) {
          if (!t) return;
          return llamar('orden_registrar_descargo', { p_falta: bt.dataset.descargo, p_texto: t }).then(function () { avisar('Descargo guardado.'); pantallaPerfil(); });
        });
      });
    });
  }).catch(function (e) { pantallaError(e, pantallaPerfil); });
}

/* ════════════════════════════════════════════════════════════════════════
   LOS AVISOS (notificaciones) Y LA INSTALACIÓN
   Van por el service worker propio (sw-vendedores.js), con la llave del Club.
   En iPhone sólo funcionan con la app instalada en la pantalla de inicio.
   ════════════════════════════════════════════════════════════════════════ */

var _instalar = null;
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); _instalar = e; });

function instalarApp() {
  if (!_instalar) return;
  _instalar.prompt();
  _instalar.userChoice.then(function () { _instalar = null; if (_pestana === 'perfil') pantallaPerfil(); });
}

var _registro = null;
function registroSW() {
  if (!('serviceWorker' in navigator)) return Promise.reject(new Error('Sin service worker'));
  if (!_registro) {
    _registro = navigator.serviceWorker.register('sw-vendedores.js', { scope: './vendedores' })
      .then(function (reg) { return reg; });
    _registro.catch(function () { _registro = null; });
  }
  return _registro;
}

function esIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function instalada() {
  return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}

/** 'activos' | 'apagados' | 'bloqueados' | 'instalar' | 'no-soportado' */
function estadoAvisos() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return Promise.resolve(esIOS() && !instalada() ? 'instalar' : 'no-soportado');
  }
  if (Notification.permission === 'denied') return Promise.resolve('bloqueados');
  return registroSW().then(function (reg) { return reg.pushManager.getSubscription(); })
    .then(function (s) { return s && Notification.permission === 'granted' ? 'activos' : 'apagados'; });
}

function base64AUint8(b64) {
  var s = (b64 + '='.repeat((4 - b64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  var raw = atob(s), out = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function guardarSuscripcion(s) {
  var j = s.toJSON();
  return llamar('orden_guardar_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
}

function activarAvisos() {
  return Notification.requestPermission().then(function (p) {
    if (p !== 'granted') throw new Error(p === 'denied' ? 'bloqueados' : 'sin permiso');
    return registroSW();
  }).then(function (reg) {
    return reg.pushManager.getSubscription().then(function (s) {
      return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64AUint8(VAPID_PUBLICA) });
    });
  }).then(guardarSuscripcion);
}

/* Si este celular ya tiene los avisos prendidos, se le vuelven a asignar a
   quien entró (por si antes estaba otra persona). No molesta: es en silencio. */
function avisosAlDia() {
  estadoAvisos().then(function (e) {
    if (e !== 'activos') return;
    return registroSW().then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (s) { if (s) return guardarSuscripcion(s); });
  }).catch(function () {});
}

/* Al salir: la suscripción se borra de la base y del celular. */
function soltarAvisos() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return Promise.resolve();
  return registroSW().then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (s) {
    if (!s) return;
    return escribir('/orden_push_subs?endpoint=eq.' + valor(s.endpoint), 'DELETE').catch(function () {})
      .then(function () { return s.unsubscribe(); });
  }).catch(function () {});
}

function bienvenidaVista(id) { try { return localStorage.getItem('vdh_vend_bienvenida_' + id) === '1'; } catch (e) { return true; } }
function marcarBienvenida(id) { try { localStorage.setItem('vdh_vend_bienvenida_' + id, '1'); } catch (e) {} }

function pantallaBienvenida(despues) {
  barra.hidden = true;
  app.className = 'app';
  marcarBienvenida(yo().id);
  estadoAvisos().catch(function () { return 'no-soportado'; }).then(function (estado) {
    var html = '<p class="marca"><b>' + NOMBRE_APP + '</b> VDH</p><h1>Activá los avisos</h1>' +
      '<p class="bajada">Te avisamos cuando te toca un control, cuando tenés una tarea y cuando está por vencer. Sin avisos, te enterás tarde.</p>';
    if (estado === 'instalar') {
      html += '<div class="pasos">' +
        '<div class="paso"><b>1</b><span>Tocá el botón <b>Compartir</b> (el cuadrado con la flecha para arriba), abajo en Safari.</span></div>' +
        '<div class="paso"><b>2</b><span>Elegí <b>Agregar a inicio</b>.</span></div>' +
        '<div class="paso"><b>3</b><span>Abrí <b>' + NOMBRE_APP + '</b> desde el ícono nuevo y activá los avisos.</span></div></div>';
    } else if (estado === 'bloqueados') {
      html += '<div class="nota">Los avisos están bloqueados para esta app. Entrá a los ajustes del navegador (el candadito al lado de la dirección), buscá <b>Notificaciones</b> y elegí <b>Permitir</b>.</div>';
    } else if (estado === 'activos') {
      html += '<div class="nota">Ya los tenés activados. ¡Bien!</div>';
    } else if (estado === 'no-soportado') {
      html += '<div class="nota">Este navegador no recibe avisos. Probá con Chrome (Android) o con la app instalada (iPhone).</div>';
    } else {
      html += '<button class="boton lima" id="activar">Activar los avisos</button>';
    }
    html += '<button class="boton" id="luego" style="margin-top:10px">' + (estado === 'activos' ? 'Seguir' : 'Ahora no') + '</button>';
    app.innerHTML = html;
    document.getElementById('luego').onclick = function () { despues(); };
    var b = document.getElementById('activar');
    if (b) unaVez(b, function () {
      b.textContent = 'Activando…';
      return activarAvisos().then(function () { avisar('¡Listo! Los avisos quedaron activados.'); despues(); }, function (e) {
        if (e && e.message === 'bloqueados') { avisar('Los bloqueaste. Para prenderlos, mirá los ajustes del navegador.'); pantallaBienvenida(despues); return; }
        throw e;
      });
    });
  });
}

/* ════════════════════════════════════════════════════════════════════════
   EL DESAFÍO DE LA SEMANA (es para aprender: no cuenta para faltas)
   ════════════════════════════════════════════════════════════════════════ */

function abrirDesafio() {
  llamar('orden_desafio_mio').then(function (d) {
    if (d && !d.terminado_en) pantallaDesafio(d); else { pantallaHoy(); avisar('No tenés un test abierto.'); }
  }).catch(function (e) { pantallaError(e, pantallaHoy); });
}

function pantallaDesafio(d, recien) {
  barra.hidden = true;
  app.className = 'app';
  var preguntas = d.preguntas || [];
  var i = preguntas.findIndex(function (q) { return !q.respondida; });
  if (i < 0) {
    var ok = preguntas.filter(function (q) { return q.elegida === q.correcta; }).length;
    app.innerHTML = '<p class="marca"><b>Test</b> de conocimiento' + (d.titulo ? ' · ' + esc(d.titulo) : '') + '</p><h1>Acertaste ' + ok + ' de ' + preguntas.length + '</h1>' +
      '<p class="bajada">' + (ok === preguntas.length ? '¡Impecable!' : 'Lo que erraste te vuelve a aparecer más adelante, para que lo aprendas.') + '</p>' +
      '<button class="boton lima" id="fin">Volver a Hoy</button>';
    document.getElementById('fin').onclick = function () { irA('hoy'); };
    if (recien && preguntas.length && ok === preguntas.length) setTimeout(function () { festejar('¡' + ok + ' de ' + ok + '!'); }, 250);
    return;
  }
  var q = preguntas[i];
  app.innerHTML =
    '<button class="volver" id="volver">‹ Seguir después</button>' +
    '<p class="marca">Pregunta ' + (i + 1) + ' de ' + preguntas.length + '</p>' +
    '<h1 class="pregunta-desafio">' + esc(q.pregunta) + '</h1>' +
    (q.imagen_path ? '<img class="foto-grande" data-foto="' + esc(q.imagen_path) + '" alt="">' : '') +
    '<div class="lista" id="opciones">' + (q.opciones || []).map(function (o, k) {
      return '<button class="opcion-desafio" data-k="' + (k + 1) + '">' + esc(o) + '</button>';
    }).join('') + '</div><div id="explicacion"></div>';
  cargarFotos(app);
  document.getElementById('volver').onclick = function () { irA('hoy'); };
  var botones = app.querySelectorAll('.opcion-desafio');
  botones.forEach(function (b) {
    b.onclick = function () {
      if (b.disabled) return;
      botones.forEach(function (x) { x.disabled = true; });
      var k = +b.dataset.k;
      llamar('orden_desafio_responder', { p_desafio: d.id, p_pregunta: q.id, p_opcion: k }).then(function (r) {
        q.respondida = true; q.elegida = k; q.correcta = r.correcta; q.explicacion = r.explicacion;
        botones.forEach(function (x) {
          var n = +x.dataset.k;
          if (n === r.correcta) x.classList.add('correcta');
          else if (n === k) x.classList.add('incorrecta');
        });
        document.getElementById('explicacion').innerHTML =
          '<div class="revision"><div class="titulo">' + (r.acerto ? '¡Bien!' : 'Casi') + '</div><div>' + esc(r.explicacion || '') + '</div></div>' +
          '<button class="boton lima" id="siguiente">' + (r.terminado ? 'Ver cómo te fue' : 'Siguiente') + '</button>';
        document.getElementById('siguiente').onclick = function () { pantallaDesafio(d, !!r.terminado); };
      }).catch(function (e) {
        if (/Ya respondiste/i.test(mensajeDe(e))) { abrirDesafio(); return; }
        botones.forEach(function (x) { x.disabled = false; });
        avisar(esDeRed(e) ? 'Sin señal: no se guardó la respuesta. Probá de nuevo.' : mensajeDe(e));
      });
    };
  });
}

/* ════════════════════════════════════════════════════════════════════════
   LA CAJA DE HOY (si el local la usa): fotos del cierre → la IA lee los
   números y precarga → quien cierra confirma y escribe el efectivo contado.
   ════════════════════════════════════════════════════════════════════════ */

var FOTOS_CAJA = [['sistema', 'Cierre del sistema'], ['lote', 'Cierre de lote (posnet)'], ['mp', 'Mercado Pago'], ['gocuotas', 'Go Cuotas (si hubo)']];
/* La caja en 4 renglones (13/10, pedido de Mauricio: "Lo real" no se
   entendía): lo que dice el sistema, lo que dice el comprobante y, al lado,
   si da. La cuenta es la de la base: sistema − comprobante, con la tolerancia
   del local ($ 100 si no se cambió). */
var FILAS_CAJA = [
  ['Tarjeta', 'sis_tarjeta', 'real_lote', 'Posnet (cierre de lote)'],
  ['Mercado Pago', 'sis_mp', 'real_mp', 'App de Mercado Pago'],
  ['Go Cuotas', 'sis_gocuotas', 'real_gocuotas', 'Go Cuotas'],
  ['Efectivo', 'sis_saldo_final_efvo', 'real_efectivo', 'Lo que contaste']
];
var _tolCaja = 100;
/* (SQL 134) La IA de la caja se puede apagar por local (Ajustes → El local → La caja): las fotos se guardan y los
   números se cargan a mano. Sin el dato (todavía sin el SQL), prendida. */
var _cajaIA = true;
function iaDeCaja(cfg) { return !(cfg && cfg.caja_ia === false); }
function textoBajadaCaja() {
  return _cajaIA ? 'Sacá las fotos del cierre: los números se cargan solos, también el efectivo. Revisalos y guardá.'
                 : 'Sacá las fotos del cierre y cargá los números a mano.';
}

/** "$ 1.440.100,50", "95.000", "95000" o "1440100.5" → número; vacío o raro → null.
    (La base leía "95.000" como 95: por eso se manda ya convertido.) */
function numeroCaja(v) {
  var t = String(v == null ? '' : v).replace(/[\s$]/g, '');
  if (!t || !/\d/.test(t) || /[^0-9.,-]/.test(t)) return null;
  var coma = t.lastIndexOf(','), punto = t.lastIndexOf('.');
  if (coma > -1 && punto > -1) t = coma > punto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');   // 1.440.100,50 o 1,440,100.50
  else if (coma > -1) t = t.replace(',', '.');                                                                       // 95,5
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');                                            // 95.000
  var n = Number(t);
  return isFinite(n) ? n : null;
}

/** Al lado de cada renglón: ✓ si da, o cuánto falta o sobra. */
function revisarFilasCaja() {
  app.querySelectorAll('.caja-fila').forEach(function (fila) {
    var ins = fila.querySelectorAll('input'), el = fila.querySelector('.caja-da');
    var a = numeroCaja(ins[0].value), b = numeroCaja(ins[1].value);
    var nada = function () { el.className = 'caja-da'; el.textContent = ''; };
    if (a == null && b == null) { nada(); return; }
    /* Como en la base, lo vacío cuenta como 0: si el sistema dice algo y falta el comprobante, ya es diferencia. */
    if (b == null) { if (Math.abs(a) <= _tolCaja) nada(); else { el.className = 'caja-da falta'; el.textContent = 'Sin cargar: así faltan ' + pesos(a); } return; }
    if (a == null) { if (Math.abs(b) <= _tolCaja) nada(); else { el.className = 'caja-da sobra'; el.textContent = 'Falta lo del sistema: así sobran ' + pesos(b); } return; }
    var d = a - b;
    if (Math.abs(d) <= _tolCaja) { el.className = 'caja-da da'; el.textContent = '✓ Da'; }
    else if (d > 0) { el.className = 'caja-da falta'; el.textContent = 'Faltan ' + pesos(d); }
    else { el.className = 'caja-da sobra'; el.textContent = 'Sobran ' + pesos(-d); }
  });
}
var LECTURA_A_CAMPO = {
  sistema: { ventas_tarjeta: 'sis_tarjeta', ventas_mercado_pago: 'sis_mp', ventas_debito_go: 'sis_gocuotas', saldo_final_efectivo: 'sis_saldo_final_efvo', total_efectivo: 'real_efectivo' },
  lote: { total: 'real_lote' }, mp: { total: 'real_mp' }, gocuotas: { total: 'real_gocuotas' }
};

function textoAlerta(a) {
  if (a.tipo === 'desvio') return 'Diferencia en ' + a.campo + ': ' + pesos(a.monto) + (Number(a.monto) > 0 ? ' (falta plata)' : ' (sobra)');
  /* (SQL 122) Un lado tiene número y el otro está vacío: falta cargar, no es un desvío. */
  if (a.tipo === 'falta') return 'Falta cargar ' + a.campo + (a.falta === 'sistema' ? ' (lo que dice el sistema)' : '') + (a.motivo ? ': la foto no se lee.' : '.');
  if (a.tipo === 'no_coincide_foto') return 'Un monto no coincide con la foto (' + a.campo + ').';
  if (a.tipo === 'foto_otro_dia') return 'La foto de ' + a.foto + ' parece de otro día' + (a.fecha_foto ? ' (' + a.fecha_foto + ')' : '') + '.';
  return 'Revisar.';
}

/* La Caja, como pestaña (pedido de Mauricio, 13/10): antes era una tarjeta en Hoy. */
function pantallaCaja() {
  apagarCamara();
  adentro();
  marcarPestana('caja');
  app.innerHTML = cabeza('Caja') + '<p class="cargando">Cargando…</p>';
  engancharCabeza();
  if (yo().local_id) {
    /* select=*: así también trae caja_ia (SQL 134) sin romperse si todavía no está. */
    leer('/orden_config?select=*&local_id=eq.' + valor(yo().local_id)).then(function (f) {
      var v = f && f[0] ? Number(f[0].caja_tolerancia_pesos) : NaN;
      if (isFinite(v) && v >= 0) { _tolCaja = v; revisarFilasCaja(); }
      _cajaIA = iaDeCaja(f && f[0]);
      var b = document.getElementById('bajadaCaja');
      if (b) b.textContent = textoBajadaCaja();
    }).catch(function () {});
  }
  llamar('orden_caja_hoy').then(function (caja) {
    return leer('/orden_caja_fotos?select=tipo,ia_estado,ia_resultado&caja_id=eq.' + valor(caja.id) + '&order=tomada_en.desc')
      .then(function (f) { if (_pestana === 'caja') dibujarCaja(caja, f || []); });
  }).catch(function (e) { pantallaError(e, pantallaCaja); });
}

/* corrige (SQL 124): el supervisor corrige (o carga) la caja de un día desde Revisar → Cajas:
   la misma pantalla, con "‹ Volver a la caja" y, al guardar, vuelve al día. */
function dibujarCaja(caja, fotos, corrige) {
  var ultima = {};
  fotos.forEach(function (f) { if (!ultima[f.tipo]) ultima[f.tipo] = f; });
  var valores = {};
  FILAS_CAJA.forEach(function (f) { [f[1], f[2]].forEach(function (k) { valores[k] = caja[k] != null ? caja[k] : ''; }); });
  /* Lo que la IA leyó precarga lo que todavía está vacío. */
  Object.keys(ultima).forEach(function (tipo) {
    var f = ultima[tipo];
    if (f.ia_estado !== 'ok' || !f.ia_resultado) return;
    var mapa = LECTURA_A_CAMPO[tipo] || {};
    Object.keys(mapa).forEach(function (k) { if (valores[mapa[k]] === '' && f.ia_resultado[k] != null) valores[mapa[k]] = f.ia_resultado[k]; });
  });
  var cerrada = caja.estado === 'controlada';

  var html = corrige
    ? '<button class="volver" id="volverCaja">‹ Volver a la caja</button><h1>' + (caja.estado === 'pendiente' ? 'Cargar' : 'Corregir') + ' la caja del ' + esc(diaMes(caja.fecha)) + '</h1>' +
      '<p class="bajada">' + esc((caja.local_nombre ? caja.local_nombre + ' · ' : '') + (_cajaIA
        ? 'Si se corrigió en el sistema, sacá la foto del cierre nuevo: la IA carga los números. Si no, corregilos a mano. Al guardar queda anotado quién cambió qué.'
        : 'Corregí los números a mano (si se corrigió en el sistema, sacá también la foto del cierre nuevo). Al guardar queda anotado quién cambió qué.')) + '</p>'
    : cabeza('Caja del ' + diaMes(caja.fecha)) +
      (cerrada ? '<p class="bajada">Tu supervisor ya la controló.</p>' : '<p class="bajada" id="bajadaCaja">' + esc(textoBajadaCaja()) + '</p>');
  if (!cerrada) {
    html += '<div class="grilla">' + FOTOS_CAJA.map(function (t) {
      var f = ultima[t[0]];
      var est = !f ? 'Falta' : f.ia_estado === 'ok' ? 'Leída' : f.ia_estado === 'pendiente' ? 'Subida' : 'Cargá a mano';
      return '<button class="foto-caja" data-tipo="' + t[0] + '"><b>' + esc(t[1]) + '</b><span class="chip ' + (f ? 'listo' : 'pendiente') + '">' + est + '</span></button>';
    }).join('') + '</div>';
  }
  var dis = cerrada ? ' disabled' : '';
  html += '<div class="seccion">Los números</div><div class="perfil caja-filas">' + FILAS_CAJA.map(function (f) {
    return '<div class="caja-fila"><div class="caja-nombre">' + esc(f[0]) + '</div>' +
      '<label class="campo caja-monto"><span>Dice el sistema</span><input inputmode="decimal" data-campo="' + f[1] + '" value="' + esc(valores[f[1]]) + '"' + dis +
        ' placeholder="$" aria-label="' + esc(f[0]) + ': lo que dice el sistema"></label>' +
      '<label class="campo caja-monto"><span>' + esc(f[3]) + '</span><input inputmode="decimal" data-campo="' + f[2] + '" value="' + esc(valores[f[2]]) + '"' + dis +
        ' placeholder="$" aria-label="' + esc(f[0] + ': ' + f[3]) + '"></label>' +
      '<div class="caja-da" aria-live="polite"></div></div>';
  }).join('') + '</div>';
  html += '<label class="campo"><span>Observaciones</span><textarea id="obs" rows="2"' + (cerrada ? ' disabled' : '') + '>' + esc(caja.observaciones || '') + '</textarea></label>';
  if ((caja.alertas || []).length) {
    html += '<div class="revision mala"><div class="titulo">Para revisar</div>' + caja.alertas.map(function (a) { return '<div>' + esc(textoAlerta(a)) + '</div>'; }).join('') + '</div>';
  } else if (caja.estado !== 'pendiente') {
    html += '<div class="nota">Guardada. Dio bien.</div>';
  }
  if (!cerrada) html += '<button class="boton lima" id="guardarCaja">Guardar</button>';
  html += '<input type="file" id="fotoCaja" accept="image/*" capture="environment" hidden>';
  app.innerHTML = html;
  if (corrige) document.getElementById('volverCaja').onclick = function () { volverAlDiaCaja(caja.id); };
  else engancharCabeza();

  app.querySelectorAll('.caja-fila input').forEach(function (i) { i.addEventListener('input', revisarFilasCaja); });
  revisarFilasCaja();
  var input = document.getElementById('fotoCaja');
  /* Sin unaVez: al terminar, unaVez vuelve a poner el texto de antes y se borraba la etiqueta ("Leída", "Guardada"). */
  app.querySelectorAll('.foto-caja').forEach(function (b) {
    b.onclick = function () {
      if (b.disabled) return;
      b.disabled = true;
      fotoCaja(caja, b.dataset.tipo, input, b).catch(function (e) {
        if (e && e.sinSesion) { pantallaError(e); return; }
        avisar(esDeRed(e) ? 'Sin señal: no se subió. Probá de nuevo.' : mensajeDe(e));
      }).then(function () { b.disabled = false; });
    };
  });
  var g = document.getElementById('guardarCaja');
  if (g) unaVez(g, function () { return guardarCaja(caja, g, corrige); });
}

/** (SQL 124) Corregir o cargar la caja de un día desde Revisar → Cajas (supervisor y administración). */
function corregirCaja(c) {
  app.innerHTML = '<p class="cargando">Cargando…</p>';
  /* La IA de la caja de ESE local (SQL 134): si está apagada, la foto se guarda y se corrige a mano. */
  var ia = leer('/orden_config?select=*&local_id=eq.' + valor(c.local_id)).then(function (r) { return iaDeCaja(r && r[0]); }, function () { return true; });
  return Promise.all([leer('/orden_caja_fotos?select=tipo,ia_estado,ia_resultado&caja_id=eq.' + valor(c.id) + '&order=tomada_en.desc'), ia])
    .then(function (r) { _cajaIA = r[1]; dibujarCaja(c, r[0] || [], true); }, function (e) { detalleCaja(c); throw e; });
}

/** Vuelve al día de la caja, con lo que quedó guardado. */
function volverAlDiaCaja(id) {
  return leer('/orden_v_cajas?select=*&id=eq.' + valor(id)).then(function (r) {
    if (r && r[0]) detalleCaja(r[0]); else irA('cajas');
  });
}

function fotoCaja(caja, tipo, input, boton) {
  return new Promise(function (ok, mal) {
    input.value = '';
    input.oncancel = function () { ok(); };   // cerraron la cámara sin sacar la foto: el botón no queda trabado
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) { ok(); return; }
      boton.querySelector('.chip').textContent = _cajaIA ? 'Leyendo…' : 'Subiendo…';
      archivoAJpeg(f)
        .then(function (blob) { return subirArchivo(caja.local_id + '/cajas/' + caja.fecha + '/' + tipo + '-' + nombreArchivo(), blob); })
        .then(function (ruta) { return llamar('orden_caja_registrar_foto', { p_caja: caja.id, p_tipo: tipo, p_foto_path: ruta }); })
        .then(function (fotoId) { return _cajaIA ? llamarFuncion('leer-caja', { foto_id: fotoId }) : { apagada: true }; })
        .then(function (r) {
          if (r && r.apagada) {
            boton.querySelector('.chip').textContent = 'Guardada';
            boton.querySelector('.chip').className = 'chip listo';
            avisar('Foto guardada: cargá los números del cierre.');
            ok();
            return;
          }
          var lectura = r && r.ok ? r.lectura : null;
          if (lectura && lectura.foto_valida !== false) {
            var mapa = LECTURA_A_CAMPO[tipo] || {};
            Object.keys(mapa).forEach(function (k) {
              var campo = app.querySelector('[data-campo="' + mapa[k] + '"]');
              if (campo && lectura[k] != null) campo.value = lectura[k];
            });
            boton.querySelector('.chip').textContent = 'Leída';
            revisarFilasCaja();
            var sinEfectivo = tipo === 'sistema' && !String(app.querySelector('[data-campo="real_efectivo"]').value || '').trim();
            avisar(sinEfectivo ? 'Listo, pero no se leyó el TOTAL EFECTIVO: escribí el efectivo que contaste.' : 'Listo: revisá los números que se cargaron.');
          } else {
            boton.querySelector('.chip').textContent = 'Cargá a mano';
            avisar(lectura && lectura.motivo ? lectura.motivo : 'No pudimos leer la foto: cargá los números a mano.');
          }
          boton.querySelector('.chip').className = 'chip listo';
          ok();
        }, function (e) { boton.querySelector('.chip').textContent = 'Probá de nuevo'; mal(e); });
    };
    input.click();
  });
}

function guardarCaja(caja, boton, corrige) {
  var valores = {}, malo = null;
  app.querySelectorAll('[data-campo]').forEach(function (c) {
    var v = String(c.value || '').trim();
    if (v === '') { valores[c.dataset.campo] = null; return; }   // vacío: se borra (para corregir)
    var n = numeroCaja(v);
    if (n == null) malo = malo || c; else valores[c.dataset.campo] = String(n);
  });
  if (malo) { malo.focus(); avisar('Hay un monto que no se entiende: escribilo sólo con números.'); return; }
  if (!valores.real_efectivo) { avisar(_cajaIA ? 'Falta el efectivo que contaste: sacá la foto del cierre del sistema (con el TOTAL EFECTIVO a la vista) o escribilo.' : 'Falta el efectivo que contaste.'); return; }
  /* (14/10, pedido de Mauricio) Un renglón con un número de un lado y el otro vacío: falta cargar
     algo (por ejemplo, la foto de Mercado Pago no se leyó). Se avisa antes de guardar. */
  var faltan = FILAS_CAJA.filter(function (f) {
    var s = valores[f[1]], r = valores[f[2]];
    return (s == null) !== (r == null) && Number(s != null ? s : r) !== 0;
  }).map(function (f) { return f[0] + ' (' + (valores[f[1]] == null ? 'Dice el sistema' : f[3]) + ')'; });
  var seguir = faltan.length
    ? confirmar('Falta ' + faltan.join(' y ') + ': sacá la foto de nuevo o cargalo a mano. ¿Guardar igual?', 'Guardar igual')
    : Promise.resolve(true);
  return seguir.then(function (si) {
    if (!si) return;
    boton.textContent = 'Guardando…';
    return llamar('orden_caja_guardar', { p_caja: caja.id, p_valores: valores, p_observaciones: document.getElementById('obs').value || null })
      .then(function (c) {
        avisar((c.alertas || []).length ? 'Guardada, con cosas para revisar.' : 'Guardada. Dio bien.');
        if (corrige) return volverAlDiaCaja(c.id);
        revisarCaja();
        return leer('/orden_caja_fotos?select=tipo,ia_estado,ia_resultado&caja_id=eq.' + valor(c.id) + '&order=tomada_en.desc')
          .then(function (f) { dibujarCaja(c, f || []); });
      });
  });
}

/* ════════════════════════════════════════════════════════════════════════
   SUPERVISIÓN: Revisar · Equipo · Cajas
   El encargado (supervisor con local fijo) ve su local; el administrador y la gerencia eligen entre todos; el
   supervisor de varios locales (SQL 120), entre los que eligió y le aprobaron.
   ════════════════════════════════════════════════════════════════════════ */

var K_LOCAL_SUP = 'vdh_vend_local_sup';
var _locales = null;

/** El local que se está mirando: {id, nombre}. */
function localSup() {
  var per = yo();
  if (per.local_id) return Promise.resolve({ id: per.local_id, nombre: per.local || '', fijo: true });
  var cargar = _locales ? Promise.resolve(_locales) : llamar('orden_mis_locales').catch(function (e) {
    /* Sin el SQL 120 todavía: todos, como antes (sólo el administrador y la gerencia llegan acá). */
    if (!/orden_mis_locales|PGRST202|could not find the function/i.test(String(e && e.message))) throw e;
    return leer('/orden_locales?select=id,nombre&activo=is.true&order=nombre.asc');
  }).then(function (l) { _locales = Array.isArray(l) ? l : []; return _locales; });
  return cargar.then(function (lista) {
    var guardado = null;
    try { guardado = localStorage.getItem(K_LOCAL_SUP); } catch (e) {}
    var l = lista.filter(function (x) { return x.id === guardado; })[0] || lista[0];
    return l ? { id: l.id, nombre: l.nombre, lista: lista } : null;
  });
}

/** Sin locales para mirar: el supervisor de varios locales todavía no eligió los suyos, o esperan el OK. */
function sinLocales(titulo) {
  var elige = esSupervisorZona();
  app.innerHTML = cabeza(titulo, '') + (elige
    ? '<div class="vacio">Todavía no tenés locales para mirar. Elegí los tuyos: cuando el administrador los apruebe, aparecen acá.</div>' +
      '<button class="boton lima" id="irMisLocales">Elegir mis locales</button>'
    : '<div class="vacio">No hay locales cargados.</div>');
  engancharCabeza();
  var b = document.getElementById('irMisLocales');
  if (b) b.onclick = function () { pantallaMisLocales(); };
}

/** Supervisor sin local fijo: elige sus locales (SQL 120). El que tiene local fijo es el encargado de ese local. */
function esSupervisorZona() { return yo().rol === 'supervisor' && !yo().local_id; }

/* ── Mis locales (SQL 120): los marca el supervisor; los nuevos esperan el OK del administrador (le llega el aviso). ── */
function pantallaMisLocales(alVolver) {
  alVolver = alVolver || function () { irA(_pestana || 'revisar'); };
  barra.hidden = true;
  app.className = 'app';
  app.innerHTML = '<button class="volver" id="volver">‹ Volver</button><h1>Mis locales</h1><p class="cargando">Cargando…</p>';
  document.getElementById('volver').onclick = alVolver;
  llamar('orden_supervision_mia').then(function (m) {
    var locs = (m && m.locales) || [];
    app.innerHTML = '<button class="volver" id="volver">‹ Volver</button><h1>Mis locales</h1>' +
      '<p class="bajada">Marcá los locales que supervisás. Los nuevos los aprueba el administrador: hasta entonces no ves nada de ellos.</p>' +
      '<div class="lista-locales">' + locs.map(function (l) {
        return '<label class="check-local"><input type="checkbox" value="' + esc(l.id) + '"' + (l.estado ? ' checked' : '') + '><span>' + esc(l.nombre) + '</span>' +
          (l.estado === 'si' ? '<small class="chip listo">Ya lo ves</small>' : l.estado === 'pedido' ? '<small class="chip pendiente">Esperando el OK</small>' : '') + '</label>';
      }).join('') + '</div>' +
      '<button class="boton lima" id="guardarLocales" style="margin-top:16px">Guardar</button>';
    document.getElementById('volver').onclick = alVolver;
    unaVez(document.getElementById('guardarLocales'), function () {
      var ids = [].map.call(app.querySelectorAll('.check-local input:checked'), function (x) { return x.value; });
      var saca = locs.filter(function (l) { return l.estado === 'si' && ids.indexOf(l.id) < 0; }).map(function (l) { return l.nombre; });
      return (saca.length ? confirmar('Vas a dejar de ver ' + saca.join(', ') + '. Para volver a verlo, lo tiene que aprobar de nuevo el administrador.') : Promise.resolve(true)).then(function (seguro) {
        if (!seguro) return;
        return llamar('orden_supervision_pedir', { p_locales: ids }).then(function (r) {
          _locales = null;
          avisar(r && r.pedidos ? 'Listo: le avisamos al administrador para que apruebe ' + (r.pedidos === 1 ? 'el local nuevo.' : 'los ' + r.pedidos + ' locales nuevos.') : 'Listo: guardado.');
          pantallaMisLocales(alVolver);
        });
      });
    });
  }).catch(function (e) {
    if (/orden_supervision_mia|PGRST202|could not find the function/i.test(String(e && e.message))) {
      app.innerHTML = '<button class="volver" id="volver">‹ Volver</button><h1>Mis locales</h1><div class="vacio">Falta correr el SQL 120 en Supabase.</div>';
      document.getElementById('volver').onclick = alVolver;
      return;
    }
    pantallaError(e, function () { pantallaMisLocales(alVolver); });
  });
}

function selectorLocal(loc, alCambiar) {
  if (!loc || loc.fijo || !loc.lista) return '';
  return '<label class="campo selector"><span>Local</span><select id="selLocal">' + loc.lista.map(function (l) {
    return '<option value="' + esc(l.id) + '"' + (l.id === loc.id ? ' selected' : '') + '>' + esc(l.nombre) + '</option>';
  }).join('') + '</select></label>';
}

function engancharSelector(alCambiar) {
  var s = document.getElementById('selLocal');
  if (s) s.onchange = function () { try { localStorage.setItem(K_LOCAL_SUP, s.value); } catch (e) {} alCambiar(); };
}

/* ── Revisar ── */
var _revisarSaltear = 0;
function pantallaRevisar() {
  marcarPestana('revisar');
  adentro();
  app.innerHTML = cabeza('Revisar', '') + '<p class="cargando">Cargando…</p>';
  engancharCabeza();
  localSup().then(function (loc) {
    if (!loc) { sinLocales('Revisar'); return; }
    return Promise.all([
      leerConMueble('/orden_v_por_revisar?select=id,modulo_nombre,persona_nombre,sector_tipo,mueble,tipo,foto_path,ultimo_intento_id,nivel_ia,nivel_declarado,respuestas,ia_resultado,discrepancia,enviado_en,frontal' +
           '&local_id=eq.' + valor(loc.id) + '&limit=60'),
      /* El producto testigo de los locales que mira: si no se puede leer, Revisar sigue igual. */
      testigosRevisar(loc).catch(function () { return []; }),
      /* Las tareas con foto (SQL 132): sin ese SQL, null y no se muestra la tarjeta. */
      tareasConFoto(loc.id).catch(function () { return null; })
    ]).then(function (r) {
      if (_pestana !== 'revisar') return;
      dibujarRevisar(loc, r[0] || [], r[1] || [], r[2]);
    });
  }).catch(function (e) { pantallaError(e, pantallaRevisar); });
}

/* ── El producto testigo en Revisar (14/10, pedido de Mauricio): una tarjeta por local que se
   mira, cuando tiene uno para contar (SQL 152: hasta su fecha límite), sin mandar (en rojo si
   venció) o mandado en la última semana ("N con faltante"). Tocándola, el resultado para mirar.
   Programarlo sigue en la compu. ── */
function testigosRevisar(loc) {
  var lista = loc.lista || [{ id: loc.id, nombre: loc.nombre }], hoy = hoyAR(), nombre = {};
  if (!lista.length) return Promise.resolve([]);
  lista.forEach(function (l) { nombre[l.id] = l.nombre; });
  return leer('/testigo_semanas?select=id,local_id,fecha,cargada_en,cerrada,testigo_items(id,stock_sistema,cantidad_real)' +
      '&local_id=in.(' + lista.map(function (l) { return valor(l.id); }).join(',') + ')' +
      '&fecha=gte.' + sumarDias(hoy, -7) + '&order=fecha.desc').then(function (filas) {
    var porLocal = {};
    (filas || []).forEach(function (s) {
      var t = (s.testigo_items || []).length ? estadoTestigoRevisar(s, hoy) : null;
      if (!t) return;
      var ya = porLocal[s.local_id];
      if (!ya || t.orden < ya.orden) { t.sem = s; t.local = nombre[s.local_id] || 'Otro local'; porLocal[s.local_id] = t; }
    });
    return Object.keys(porLocal).map(function (k) { return porLocal[k]; })
      .sort(function (a, b) { return a.orden - b.orden || a.local.localeCompare(b.local); });
  });
}

/** Cómo está un control de producto testigo, para la tarjeta (el más urgente primero). */
function estadoTestigoRevisar(s, hoy) {
  var items = s.testigo_items || [], n = items.length + (items.length === 1 ? ' producto' : ' productos');
  if (!s.cargada_en) {
    if (s.cerrada) return null;
    if (s.fecha < hoy) return { orden: 0, alerta: true, texto: 'Sin mandar: venció el ' + diaYFecha(s.fecha) + ' (' + n + ')' };
    if (s.fecha === hoy) return { orden: 1, texto: 'Vence hoy, sin mandar (' + n + ')' };
    return { orden: 2, texto: 'Hasta el ' + diaYFecha(s.fecha) + ', sin mandar (' + n + ')' };
  }
  var falta = items.filter(function (i) { return i.stock_sistema != null && i.cantidad_real != null && Number(i.stock_sistema) > Number(i.cantidad_real); }).length;
  return { orden: 3, alerta: falta > 0, texto: 'Mandado el ' + diaMes(s.cargada_en) + ': ' + (falta ? falta + ' con faltante' : 'sin faltantes') + ' (' + n + ')' };
}

function tarjetasTestigoRevisar(ts) {
  if (!ts.length) return '';
  return '<div class="seccion">Producto testigo</div>' + ts.map(function (t, i) {
    return '<button class="tarjeta-accion testigo' + (t.alerta ? ' alerta' : '') + '" data-trev="' + i + '"><b>' + esc(t.local) + '</b><span>' + esc(t.texto) + '</span></button>';
  }).join('');
}

/** El resultado de un control de producto testigo, para mirar: los números, la diferencia y los videos. */
function verTestigoRevisar(t) {
  barra.hidden = true;
  app.className = 'app';
  var volver = function () { var b = document.getElementById('volver'); if (b) b.onclick = function () { irA('revisar'); }; };
  app.innerHTML = '<button class="volver" id="volver">‹ Volver a Revisar</button><h1>Producto testigo</h1><p class="cargando">Cargando…</p>';
  volver();
  return leer('/testigo_v_items?select=*&semana_id=eq.' + valor(t.sem.id) + '&order=item.asc').then(function (items) {
    var s = t.sem, porId = {};
    (items || []).forEach(function (it) { porId[it.id] = it; });
    var html = '<button class="volver" id="volver">‹ Volver a Revisar</button><h1>Producto testigo</h1>' +
      '<p class="bajada">' + esc(t.local + (s.fecha ? ' · fecha límite: ' + diaYFecha(s.fecha) : '')) + '</p>' +
      '<div class="nota' + (t.alerta ? ' alerta' : '') + '">' + esc(t.texto) + '</div>' +
      (items || []).map(function (it) {
        var dif = Number(it.diferencia), txt = textoDiferencia(it.diferencia);
        return '<div class="testigo-ver' + (dif > 0 ? ' falta' : '') + '"><div class="que"><b>' + esc(it.item + ' · ' + it.producto + (it.color ? ' ' + it.color : '')) + '</b>' +
          '<small>' + esc((it.rubro ? it.rubro + ' · ' : '') + (it.stock_sistema != null && it.cantidad_real != null ? 'Sistema ' + it.stock_sistema + ' · contaron ' + it.cantidad_real : 'Todavía sin contar') +
                          (it.enviada != null ? ' · enviadas ' + it.enviada : '')) + '</small></div>' +
          (txt ? '<span class="chip ' + (dif > 0 ? 'vencido' : dif < 0 ? 'pendiente' : 'listo') + '">' + esc(txt) + '</span>' : '') +
          (it.video_path && !it.video_borrado ? '<button class="boton chico" data-video="' + esc(it.id) + '">▶ Video</button>' : '') + '</div>';
      }).join('') +
      '<p class="bajada" style="margin-top:12px">Es para mirar: programarlo y corregir un número se hace en la compu (Supervisión → Productos testigo).</p>';
    app.innerHTML = html;
    volver();
    app.querySelectorAll('[data-video]').forEach(function (b) {
      b.onclick = function () {
        var it = porId[b.dataset.video], v = document.createElement('video');
        v.className = 'video-testigo'; v.controls = true; v.setAttribute('playsinline', '');
        b.replaceWith(v);
        urlFirmadaEn(VIDEOS_TESTIGO, it.video_path).then(function (u) {
          if (u) { v.src = u; return; }
          var p = document.createElement('small'); p.textContent = 'No se pudo abrir el video (puede que ya se haya borrado).'; v.replaceWith(p);
        });
      };
    });
  }).catch(function (e) { pantallaError(e, function () { verTestigoRevisar(t); }); });
}

/* ── Las tareas con foto (16/10, pedido de Mauricio): el supervisor mira la foto de cada tarea hecha y la da
   por buena, o se la manda a corregir con un mensaje ("corregí esto"); le vuelve como pendiente hasta que manda
   otra foto (SQL 132). Las hechas en las últimas 2 semanas y las que esperan la corrección.
   SQL 150 (21/10): también las correcciones que se pidieron al revisar una foto, con la de antes al lado
   (Antes | Ahora) y sus marcas: "Quedó bien" o "Pedir otra corrección", que también marca la foto. ── */
function tareasConFoto(L) {
  var desde = new Date(Date.now() - 14 * 864e5).toISOString();
  var base = '/orden_v_tareas?select=id,titulo,detalle,estado,persona_nombre,foto_path,completada_en,completada_a_tiempo,correccion,correccion_en,correcciones,revisada_en' +
    '&local_id=eq.' + valor(L) + '&order=completada_en.desc.nullslast&limit=80';
  return leer(base.replace('select=', 'select=foto_antes,marcas,ia_correccion,creado_en,') +
              '&or=(and(estado.eq.hecha,foto_path.not.is.null,completada_en.gte.' + desde + '),and(estado.in.(pendiente,vencida),or(correccion.not.is.null,foto_antes.not.is.null)))')
    .catch(function (e) {
      if (!e || e.sinSesion || esDeRed(e)) throw e;
      /* La base todavía sin el SQL 150: como antes. */
      return leer(base + '&foto_path=not.is.null&or=(and(estado.eq.hecha,completada_en.gte.' + desde + '),and(estado.in.(pendiente,vencida),correccion.not.is.null))');
    });
}
/** Hecha y todavía sin mirar (o vuelta a mandar después de una corrección). */
function tareaParaMirar(t) { return t.estado === 'hecha' && (!t.revisada_en || new Date(t.revisada_en) < new Date(t.completada_en)); }

function tarjetaTareasFoto(tareas) {
  if (!tareas) return '';
  var mirar = tareas.filter(tareaParaMirar).length, corrigiendo = tareas.filter(function (t) { return t.estado !== 'hecha'; }).length;
  return '<div class="seccion">Correcciones y tareas con foto</div><button class="tarjeta-accion tareas-foto' + (mirar ? ' alerta' : '') + '" id="verTareasFoto"><b>' +
    (mirar ? (mirar === 1 ? '1 para mirar' : mirar + ' para mirar') : 'Nada nuevo para mirar') + '</b><span>' +
    (corrigiendo ? (corrigiendo === 1 ? '1 esperando la corrección' : corrigiendo + ' esperando la corrección') : 'Las fotos corregidas y las de las tareas') + '</span></button>';
}

function pantallaTareasFoto(loc) {
  barra.hidden = true;
  app.className = 'app';
  var arriba = '<button class="volver" id="volver">‹ Volver a Revisar</button><h1>Correcciones y tareas</h1><p class="bajada">' + esc(loc.nombre) + '</p>';
  var volver = function () { document.getElementById('volver').onclick = function () { irA('revisar'); }; };
  app.innerHTML = arriba + '<p class="cargando">Cargando…</p>';
  volver();
  return tareasConFoto(loc.id).then(function (lista) {
    lista = lista || [];
    var porId = {};
    lista.forEach(function (t) { porId[t.id] = t; });
    var mirar = lista.filter(tareaParaMirar), corrigiendo = lista.filter(function (t) { return t.estado !== 'hecha'; }),
        vistas = lista.filter(function (t) { return t.estado === 'hecha' && !tareaParaMirar(t); });
    var html = arriba + '<div class="seccion">Para mirar</div>' +
      (mirar.length ? mirar.map(tarjetaTareaFoto).join('') : '<div class="vacio">No hay nada nuevo para mirar.</div>');
    if (corrigiendo.length) html += '<div class="seccion">Esperando la corrección</div>' + corrigiendo.map(tarjetaTareaFoto).join('');
    if (vistas.length) html += '<details class="tareas-vistas"><summary>Ya miradas (' + vistas.length + ')</summary>' + vistas.map(tarjetaTareaFoto).join('') + '</details>';
    app.innerHTML = html;
    volver();
    cargarFotos(app);
    app.querySelectorAll('.tarea-foto').forEach(function (caja) {
      var t = porId[caja.dataset.id], bien = caja.querySelector('[data-bien]'), corr = caja.querySelector('[data-corregir]'),
          form = caja.querySelector('.corregir-form'), mandar = caja.querySelector('[data-mandar]'), marcador = null;
      if (bien) unaVez(bien, function () {
        return revisarTarea(t, true).then(function () {
          avisar(t.foto_antes ? 'Listo: la corrección quedó bien.' : 'Listo: «' + t.titulo + '» está bien.'); return pantallaTareasFoto(loc);
        });
      });
      if (corr) corr.onclick = function () {
        form.hidden = false; corr.hidden = true;
        /* La foto que mandó se marca (Antes | Ahora pasan a ir una abajo de la otra: así se marca bien). */
        var ahora = caja.querySelector('.fm-ahora'), dos = caja.querySelector('.antes-ahora');
        if (dos) dos.classList.add('marcando');
        if (ahora) marcador = marcarEnFoto(ahora);
        form.querySelector('textarea').focus();
      };
      if (mandar) unaVez(mandar, function () {
        var msg = String(form.querySelector('textarea').value || '').trim();
        if (!msg) { avisar('Escribí qué tiene que corregir.'); return; }
        return revisarTarea(t, false, msg, marcador && marcador.marcas()).then(function () {
          avisar('Se la mandaste a corregir' + (t.persona_nombre ? ' a ' + t.persona_nombre : '') + '.'); return pantallaTareasFoto(loc);
        });
      });
    });
  }).catch(function (e) { pantallaError(e, function () { pantallaTareasFoto(loc); }); });
}

function tarjetaTareaFoto(t) {
  var hecha = t.estado === 'hecha', puede = tareaParaMirar(t) && !soloMira(), vueltas = (t.correcciones || []).length;
  /* Una corrección (SQL 150): hay una foto de antes, con lo que se marcó. */
  var antes = !!t.foto_antes, pedido = t.correccion || (antes ? t.detalle : null);
  var fotos = antes && hecha
    ? '<div class="antes-ahora">' + fotoConMarcas(t.foto_antes, t.marcas, { etiqueta: 'Antes', alt: 'La foto de antes' }) +
      fotoConMarcas(t.foto_path, null, { etiqueta: 'Ahora', clase: 'fm-ahora', alt: 'La foto corregida' }) + '</div>'
    : antes ? fotoConMarcas(t.foto_antes, t.marcas, { etiqueta: 'Antes', alt: 'La foto que tiene que corregir' })
    : fotoConMarcas(t.foto_path, null, { clase: 'fm-ahora', alt: 'La foto de la tarea' });
  return '<div class="revision tarea-foto" data-id="' + esc(t.id) + '"><div class="titulo">' + esc(t.titulo) + '<span class="chip pendiente">' + esc(t.persona_nombre || '') + '</span></div>' +
    '<div class="bajada" style="margin:0 0 8px">' + esc(hecha
      ? 'Hecha ' + diaMes(t.completada_en) + ' ' + hora(t.completada_en) + (t.completada_a_tiempo === false ? ' · tarde' : '') + (vueltas ? ' · corregida' : '')
      : t.correccion_en ? 'Se la mandaste a corregir el ' + diaMes(t.correccion_en) + ' ' + hora(t.correccion_en)
      : 'Le pediste la corrección el ' + diaMes(t.creado_en) + ' ' + hora(t.creado_en)) + '</div>' +
    fotos +
    (antes && hecha && t.ia_correccion ? '<div class="info" style="margin:8px 0 0"><span class="chip nivel-' + esc(t.ia_correccion) + '">IA: ' + esc(NIVEL[t.ia_correccion]) + '</span></div>' : '') +
    (t.detalle && pedido !== t.detalle ? '<div class="bajada" style="margin:8px 0 0">' + esc(t.detalle) + '</div>' : '') +
    (pedido ? '<div class="nota pedido' + (hecha ? '' : ' alerta') + '"><b>' + (hecha ? 'Le habías pedido:' : 'Le pediste:') + '</b> ' + esc(pedido) + '</div>' : '') +
    (puede ? '<div class="botones"><button class="boton lima chico" data-bien>' + (antes ? 'Quedó bien' : 'Está bien') + '</button>' +
      '<button class="boton chico" data-corregir>' + (antes ? 'Pedir otra corrección' : 'Corregir') + '</button></div>' +
      '<div class="corregir-form" hidden><p class="ayuda-marcas">Tocá la foto' + (antes ? ' de «Ahora»' : '') + ' para marcar dónde. Tocá una marca para sacarla.</p>' +
      '<label class="campo"><span>Qué tiene que corregir</span><textarea rows="2" maxlength="500" placeholder="Ej.: 1) la pila de la izquierda sigue con 3"></textarea></label>' +
      '<button class="boton lima chico" data-mandar>Mandar a corregir</button></div>' : '') +
    '</div>';
}

function dibujarRevisar(loc, cola, testigos, tareas) {
  testigos = testigos || [];
  if (_revisarSaltear >= cola.length) _revisarSaltear = 0;
  var c = cola[_revisarSaltear];
  var html = cabeza('Revisar', loc.nombre) + selectorLocal(loc) + tarjetasTestigoRevisar(testigos) + tarjetaTareasFoto(tareas);
  var conTarjetas = testigos.length || !!tareas;
  var engancharTestigo = function () {
    app.querySelectorAll('[data-trev]').forEach(function (b) { b.onclick = function () { verTestigoRevisar(testigos[+b.dataset.trev]); }; });
    var vt = document.getElementById('verTareasFoto');
    if (vt) vt.onclick = function () { pantallaTareasFoto(loc); };
  };
  if (!c) {
    html += (conTarjetas ? '<div class="seccion">Fotos</div>' : '') + '<div class="vacio">No hay fotos para revisar.</div>';
    app.innerHTML = html; engancharCabeza(); engancharSelector(pantallaRevisar); engancharTestigo();
    return;
  }
  if (conTarjetas) html += '<div class="seccion">Fotos</div>';
  var ia = c.ia_resultado || {};
  /* Desde el SQL 130 no se pregunta nada al mandar: sin respuestas, los puntos que miró la IA. */
  var respondio = !!c.respuestas && Object.keys(c.respuestas).length > 0;
  var orden = preguntasDe(c).map(function (q) { return q[0]; });   // primero las del mueble, en su orden
  orden = orden.concat(Object.keys(CHECK).filter(function (k) { return orden.indexOf(k) < 0; }));
  var lugar = function (k) { var i = orden.indexOf(k); return i < 0 ? 99 : i; };
  var checks = respondio ? preguntasRespondidas(c)
    : Object.keys(ia.checks || {}).sort(function (a, b) { return lugar(a) - lugar(b); }).map(function (k) { return [k, CHECK[k] || k]; });
  html += '<p class="bajada">' + cola.length + (cola.length === 1 ? ' foto para revisar' : ' fotos para revisar') + (soloMira() ? ' (sólo mirar)' : '') + '</p>' +
    '<div class="revision"><div class="titulo">' + esc(c.modulo_nombre) + '<span class="chip pendiente">' + esc(c.persona_nombre || '') + '</span></div>' +
    '<div class="bajada" style="margin:0 0 8px">' + esc((c.tipo === 'sorpresa' ? 'Control sorpresa · ' : '') + (c.frontal ? 'Frontal nuevo · ' : '') + 'Enviado ' + diaMes(c.enviado_en) + ' ' + hora(c.enviado_en)) + '</div>' +
    /* SQL 150: tocar la foto pone una marca (un círculo con número) donde está lo que hay que corregir. */
    (c.foto_path ? fotoConMarcas(c.foto_path, null, { alt: 'La foto del módulo' }) +
                   (soloMira() ? '' : '<p class="ayuda-marcas">Tocá la foto para marcar dónde. Tocá una marca para sacarla.</p>')
                 : '<div class="vacio">Sin foto</div>') +
    (c.discrepancia ? '<div class="nota alerta">Lo que respondió no coincide con lo que vio la IA: miralo con atención.</div>' : '') +
    '<div class="info" style="margin:10px 0">' +
      (c.nivel_ia ? '<span class="chip nivel-' + esc(c.nivel_ia) + '">IA: ' + esc(NIVEL[c.nivel_ia]) + '</span>'
        /* Desde el SQL 130 la foto que no sirve se manda igual: que se vea que la IA la miró y por qué no sirve. */
        : ia.foto_valida === false ? '<span class="chip vencido">IA: la foto no sirve</span>'
        : '<span class="chip pendiente">Sin revisión de la IA</span>') +
      (c.nivel_declarado ? '<span class="chip nivel-' + esc(c.nivel_declarado) + '">Según él: ' + esc(NIVEL[c.nivel_declarado]) + '</span>' : '') + '</div>' +
    (!c.nivel_ia && ia.foto_valida === false && (ia.motivo_foto_invalida || ia.motivo)
      ? '<div class="bajada" style="margin:0 0 8px">' + esc(ia.motivo_foto_invalida || ia.motivo) + '</div>' : '') +
    checks.map(function (q) {
      var dijo = c.respuestas ? c.respuestas[q[0]] : null, vio = ia.checks ? ia.checks[q[0]] : null;
      return '<div class="pregunta"><span>' + esc(CHECK[q[0]] || q[0]) + '</span><div class="info">' +
        (respondio ? '<span class="chip ' + (dijo === true ? 'listo' : dijo === false ? 'vencido' : 'pendiente') + '">' + (dijo === true ? 'Dijo sí' : dijo === false ? 'Dijo no' : '—') + '</span>' : '') +
        (vio ? '<span class="chip ' + (vio === 'ok' ? 'listo' : vio === 'mal' ? 'vencido' : 'pendiente') + '">IA: ' + (vio === 'ok' ? 'bien' : vio === 'mal' ? 'mal' : 'no se ve') + '</span>' : '') +
        '</div></div>';
    }).join('') +
    ((ia.hallazgos || []).length ? ia.hallazgos.map(function (h) {
      return '<div class="hallazgo ' + (h.gravedad === 'corregir' ? 'corregir' : 'sugerencia') + '"><b>' + esc(h.titulo) + '</b>' + (h.detalle ? '<small>' + esc(h.detalle) + '</small>' : '') + '</div>';
    }).join('') : '') +
    '</div>';
  if (!soloMira()) {
    /* SQL 150 (Mauricio, 21/10): una sugerencia, o pedirle que lo corrija y mande otra foto aunque esté "Bien". */
    html += '<label class="campo"><span>Sugerencia o corrección</span><textarea id="coment" rows="2" maxlength="500" placeholder="Ej.: 1) falta una camisa en cada pila, que sean 4"></textarea></label>' +
      '<label class="check pedir-correccion"><input type="checkbox" id="corregir"> Que lo corrija y mande otra foto</label>' +
      '<p class="ayuda-chica">Con «A mejorar» o «Fuera de estándar» se le pide siempre. Si cambiás más de un nivel de lo que vio la IA, contá por qué.</p>' +
      '<div class="niveles">' + ['impecable', 'bien', 'a_mejorar', 'fuera_de_estandar'].map(function (n) {
        return '<button class="boton nivel nivel-' + n + '" data-nivel="' + n + '">' + NIVEL[n] + '</button>';
      }).join('') + '</div>';
  }
  if (cola.length > 1) html += '<button class="boton" id="saltear" style="margin-top:10px">Ver la siguiente</button>';
  app.innerHTML = html;
  engancharCabeza();
  engancharSelector(function () { _revisarSaltear = 0; pantallaRevisar(); });
  engancharTestigo();
  cargarFotos(app);
  var s = document.getElementById('saltear');
  if (s) s.onclick = function () { _revisarSaltear++; dibujarRevisar(loc, cola, testigos, tareas); };
  var fotoRev = app.querySelector('.revision .foto-marcas');
  var marcador = fotoRev && !soloMira() ? marcarEnFoto(fotoRev) : null;
  var niveles = app.querySelectorAll('[data-nivel]');
  niveles.forEach(function (b) {
    unaVez(b, function () {
      var n = b.dataset.nivel, texto = String(document.getElementById('coment').value || '').trim(), bajo = n === 'a_mejorar' || n === 'fuera_de_estandar';
      var corregir = bajo || document.getElementById('corregir').checked;
      /* Con "Bien" o "Impecable" y la casilla: que diga qué (si no, el vendedor no sabe qué corregir). */
      if (corregir && !bajo && !texto) { avisar('Escribí qué tiene que corregir.'); document.getElementById('coment').focus(); return; }
      /* Uno a la vez: dos niveles tocados casi juntos dejaban un nivel y avisaban otro. */
      niveles.forEach(function (x) { x.disabled = true; });
      /* p_foto (SQL 126): la foto que está mirando. Si el vendedor la cambió mientras tanto, la base no deja. */
      return revisarControl(c, n, texto, corregir, marcador && marcador.marcas())
        .then(function () { avisar(c.modulo_nombre + ': ' + NIVEL[n] + (corregir ? '. Le pediste que lo corrija.' : '')); pantallaRevisar(); },
              function (e) {
                if (/cambió la foto/i.test(mensajeDe(e))) { avisar(c.modulo_nombre + ': el vendedor cambió la foto recién. Mirala de nuevo.'); pantallaRevisar(); return; }
                niveles.forEach(function (x) { x.disabled = false; }); throw e;
              });
    });
    /* unaVez traba sólo el botón tocado, y la acción arranca un instante
       después: si ya se está mandando otro nivel, este toque no cuenta. */
    var tocar = b.onclick;
    b.onclick = function () {
      if (Array.prototype.some.call(niveles, function (x) { return x.disabled; })) return;
      return tocar.apply(this, arguments);
    };
  });
}

/* ── Equipo ── */
var _equipoMes = false;
function pantallaEquipo() {
  marcarPestana('equipo');
  adentro();
  app.innerHTML = cabeza('Equipo', '') + '<p class="cargando">Cargando…</p>';
  engancharCabeza();
  localSup().then(function (loc) {
    if (!loc) { sinLocales('Equipo'); return; }
    var L = valor(loc.id);
    var desde = _equipoMes ? lunesAR(hoyAR().slice(0, 8) + '01') : lunesAR();
    return Promise.all([
      leer('/orden_personas?select=id,nombre,apellido,inicial,aprobado,alta_propia,auth_user_id&local_id=eq.' + L + '&activo=is.true&rol=eq.vendedor&order=nombre.asc'),
      leer('/orden_v_persona_semana?select=persona_id,semana,controles,controles_a_tiempo,controles_tarde,nivel_semana,tareas,tareas_a_tiempo,tareas_fuera_de_plazo,desafio_puntaje,desafio_total' +
           '&local_id=eq.' + L + '&semana=gte.' + desde),
      leer('/orden_controles?select=persona_id&local_id=eq.' + L + '&estado=eq.pendiente&fecha=eq.' + hoyAR()),
      leer('/orden_v_tareas?select=id,titulo,persona_nombre,prorroga_motivo,vence_en&local_id=eq.' + L + '&prorroga_estado=eq.pedida&estado=in.(pendiente,vencida)'),
      leer('/orden_faltas?select=id,persona_id,tipo,motivo,creado_en&local_id=eq.' + L + '&estado=eq.sugerida&order=creado_en.desc'),
      leer('/orden_v_tareas?select=id,titulo,persona_nombre,origen,vence_en,estado&local_id=eq.' + L + '&estado=in.(pendiente,vencida)&order=vence_en.asc&limit=40')
    ]).then(function (r) {
      if (_pestana !== 'equipo') return;
      /* Esperan el OK los que ya entraron (crearon su PIN) o se anotaron solos.
         Los que todavía no entraron siguen en el equipo como siempre. */
      var todos = r[0] || [];
      var espera = function (p) { return p.aprobado === false && (!!p.auth_user_id || !!p.alta_propia); };
      dibujarEquipo(loc, { gente: todos.filter(function (p) { return !espera(p); }), esperan: todos.filter(espera),
                           semanas: r[1] || [], pendientes: r[2] || [], prorrogas: r[3] || [], faltas: r[4] || [], tareas: r[5] || [] });
    });
  }).catch(function (e) { pantallaError(e, pantallaEquipo); });
}

function nombreCorto(p) { return p.nombre + (p.inicial ? ' ' + p.inicial + '.' : ''); }

function dibujarEquipo(loc, x) {
  var nombres = {};
  x.gente.forEach(function (p) { nombres[p.id] = nombreCorto(p); });
  var mira = soloMira();
  var html = cabeza('Equipo', loc.nombre) + selectorLocal(loc) +
    '<div class="pestanitas"><button class="' + (!_equipoMes ? 'activa' : '') + '" id="vSemana">Esta semana</button><button class="' + (_equipoMes ? 'activa' : '') + '" id="vMes">Este mes</button></div>';

  html += '<button class="tarjeta-accion" id="irMapa"><b>El mapa del local</b><span>' +
    'Quién tiene cada módulo y quién cubre.' + '</span></button>';

  if ((x.esperan || []).length) {
    html += '<div class="seccion">Esperan tu OK</div><p class="bajada">Hasta que los apruebes no ven nada del local.</p>' + x.esperan.map(function (p) {
      /* Quien se anotó solo: "¿es de acá?". Quien ya estaba y creó su PIN:
         "¿fue él?" (cualquiera con el enlace podría haberlo creado). */
      var nuevo = !!p.alta_propia;
      var datos = ' data-aprobar="' + esc(p.id) + '" data-nombre="' + esc(p.nombre) + '" data-nuevo="' + (nuevo ? '1' : '0') + '"';
      return '<div class="tarea"><div class="nombre">' + esc(p.nombre + (p.apellido ? ' ' + p.apellido : '')) + '</div>' +
        '<div class="detalle">' + (nuevo ? 'Se anotó solo en la app.' : 'Creó su PIN. Confirmá en persona que fue quien lo creó.') + '</div>' +
        (mira ? '' : '<div class="botones"><button class="boton lima chico"' + datos + ' data-si="1">' + (nuevo ? 'Es de acá' : 'Sí, fue') + '</button>' +
                     '<button class="boton chico"' + datos + ' data-si="0">' + (nuevo ? 'No lo conozco' : 'No fue') + '</button></div>') + '</div>';
    }).join('');
  }

  /* Los supervisores de varios locales (su PIN y sus locales) se manejan en el sistema, en Usuarios: en la app no
     van (Mauricio, 20/10: "desde la aplicación no me interesa"). */

  /* Por vendedor: se suman las semanas del período. */
  var tot = {};
  x.semanas.forEach(function (s) {
    var t = tot[s.persona_id] || (tot[s.persona_id] = { controles: 0, a_tiempo: 0, tareas: 0, tareas_ok: 0, fuera: 0, des: 0, desT: 0, nivel: null, semana: '' });
    t.controles += s.controles; t.a_tiempo += s.controles_a_tiempo; t.tareas += s.tareas; t.tareas_ok += s.tareas_a_tiempo;
    t.fuera += s.tareas_fuera_de_plazo; t.des += s.desafio_puntaje || 0; t.desT += s.desafio_total || 0;
    if (s.semana >= t.semana) { t.semana = s.semana; t.nivel = s.nivel_semana; t.mando = mandoFotos(s); }
  });
  html += '<div class="seccion">Por vendedor</div>';
  if (!x.gente.length) html += '<div class="vacio">Todavía no hay vendedores en este local.</div>';
  html += x.gente.map(function (p) {
    var t = tot[p.id] || { controles: 0, a_tiempo: 0, tareas: 0, tareas_ok: 0, des: 0, desT: 0, nivel: null };
    return '<div class="fila"><span><b>' + esc(nombres[p.id]) + '</b>' + (p.aprobado ? ' <button class="boton chico ver-app" data-ver="' + esc(p.id) + '">Ver su app</button>' : '') + '</span>' +
      (t.nivel ? '<span class="chip nivel-' + esc(t.nivel) + '">' + esc(NIVEL[t.nivel]) + '</span>' : '<span class="chip pendiente">' + (t.mando ? 'Esperando revisión' : 'Sin fotos') + '</span>') +
      '<small>Controles a tiempo ' + t.a_tiempo + ' de ' + t.controles + ' · Tareas a tiempo ' + t.tareas_ok + ' de ' + t.tareas +
      (t.desT ? ' · Test ' + t.des + '/' + t.desT : '') + '</small></div>';
  }).join('');

  var pend = {};
  x.pendientes.forEach(function (c) { pend[c.persona_id] = (pend[c.persona_id] || 0) + 1; });
  var conPend = Object.keys(pend);
  if (conPend.length) {
    html += '<div class="seccion">Sin hacer hoy</div>' + conPend.map(function (id) {
      return '<div class="fila"><span>' + esc(nombres[id] || 'Alguien') + ' · ' + pend[id] + (pend[id] === 1 ? ' control' : ' controles') + '</span>' +
        (mira ? '' : '<button class="boton chico" data-recordar="' + esc(id) + '">Recordar</button>') + '</div>';
    }).join('');
  }
  if (x.prorrogas.length) {
    html += '<div class="seccion">Piden más tiempo</div>' + x.prorrogas.map(function (t) {
      return '<div class="tarea"><div class="nombre">' + esc(t.titulo) + '</div><div class="detalle">' + esc(t.persona_nombre + ': ' + (t.prorroga_motivo || '')) + '</div>' +
        (mira ? '' : '<div class="botones"><button class="boton lima chico" data-prorroga="' + esc(t.id) + '" data-si="1">Darle hasta mañana</button><button class="boton chico" data-prorroga="' + esc(t.id) + '" data-si="0">No</button></div>') + '</div>';
    }).join('');
  }
  if (x.faltas.length) {
    html += '<div class="seccion">Faltas sugeridas</div><p class="bajada">El sistema sólo sugiere: decidís vos.</p>' + x.faltas.map(function (f) {
      return '<div class="tarea"><div class="nombre">' + esc((nombres[f.persona_id] || '') + ' · ' + f.tipo) + '</div><div class="detalle">' + esc(f.motivo) + '</div>' +
        (mira ? '' : '<div class="botones"><button class="boton chico" data-falta="' + esc(f.id) + '" data-si="1">Confirmar</button><button class="boton chico" data-falta="' + esc(f.id) + '" data-si="0">Descartar</button></div>') + '</div>';
    }).join('');
  }
  html += '<div class="seccion">Tareas abiertas</div>';
  if (!x.tareas.length) html += '<div class="vacio">No hay tareas abiertas.</div>';
  html += x.tareas.map(function (t) {
    return '<div class="fila"><span>' + esc(t.titulo) + '<small>' + esc((t.persona_nombre || '') + ' · ' + textoVence(t.vence_en, t.estado)) + '</small></span>' +
      (mira ? '' : '<button class="boton chico" data-cancelar="' + esc(t.id) + '">Cancelar</button>') + '</div>';
  }).join('');
  if (!mira && x.gente.length) html += '<button class="boton lima" id="nuevaTarea" style="margin-top:16px">Nueva tarea</button>';

  app.innerHTML = html;
  engancharCabeza();
  engancharSelector(pantallaEquipo);
  document.getElementById('irMapa').onclick = function () { pantallaMapa(loc); };
  app.querySelectorAll('[data-ver]').forEach(function (b) {
    b.onclick = function () { var p = x.gente.filter(function (g) { return g.id === b.dataset.ver; })[0]; if (p) verSuApp(p, loc); };
  });
  document.getElementById('vSemana').onclick = function () { _equipoMes = false; pantallaEquipo(); };
  document.getElementById('vMes').onclick = function () { _equipoMes = true; pantallaEquipo(); };
  app.querySelectorAll('[data-aprobar]').forEach(function (b) {
    var mismos = function () { return app.querySelectorAll('[data-aprobar="' + b.dataset.aprobar + '"]'); };
    unaVez(b, function () {
      var si = b.dataset.si === '1', nuevo = b.dataset.nuevo === '1', nombre = b.dataset.nombre;
      return (si ? Promise.resolve(true) : confirmar(nuevo ? '¿No conocés a ' + nombre + '? Se le cierra el acceso a la app.'
                                : '¿No fue ' + nombre + '? Se borra ese PIN y se cierra esa sesión. ' + nombre + ' va a poder crear el suyo.')).then(function (seguro) {
        if (!seguro) return;
        mismos().forEach(function (x) { x.disabled = true; });
        return llamar('orden_aprobar_persona', { p_persona: b.dataset.aprobar, p_aprobar: si })
          .then(function () { avisar(si ? 'Aprobado: ya puede usar la app.' : nuevo ? 'Listo: no va a poder entrar.' : 'Listo: se borró ese PIN.'); pantallaEquipo(); },
                function (e) { mismos().forEach(function (x) { x.disabled = false; }); throw e; });
      });
    });
    /* Los dos botones de la misma persona van juntos: "Sí" y "No" tocados casi
       a la vez mandaban los dos y ganaba el último. */
    var tocar = b.onclick;
    b.onclick = function () {
      if (Array.prototype.some.call(mismos(), function (x) { return x.disabled; })) return;
      return tocar.apply(this, arguments);
    };
  });
  app.querySelectorAll('[data-recordar]').forEach(function (b) {
    unaVez(b, function () {
      return llamar('orden_recordar', { p_persona: b.dataset.recordar }).then(function (ok) {
        avisar(ok ? 'Le llegó el recordatorio.' : 'Ya se le recordó hace un rato, o no tiene nada pendiente.');
      });
    });
  });
  app.querySelectorAll('[data-prorroga]').forEach(function (b) {
    unaVez(b, function () {
      return llamar('orden_responder_prorroga', { p_tarea: b.dataset.prorroga, p_aprobar: b.dataset.si === '1', p_plazo: 'manana' })
        .then(function () { avisar('Listo.'); pantallaEquipo(); });
    });
  });
  app.querySelectorAll('[data-falta]').forEach(function (b) {
    unaVez(b, function () {
      var si = b.dataset.si === '1';
      return preguntar(si ? { texto: '¿Confirmás la falta? Le llega el aviso al vendedor.', campo: 'Nota (opcional)', opcional: true, si: 'Confirmar la falta' }
                          : { texto: '¿Por qué la descartás?', campo: 'Opcional', opcional: true, si: 'Descartarla' }).then(function (nota) {
        if (nota === null) return;
        return llamar('orden_decidir_falta', { p_falta: b.dataset.falta, p_confirmar: si, p_tipo: null, p_nota: nota || null })
          .then(function () { avisar(si ? 'Falta confirmada.' : 'Falta descartada.'); pantallaEquipo(); });
      });
    });
  });
  app.querySelectorAll('[data-cancelar]').forEach(function (b) {
    unaVez(b, function () {
      return preguntarTexto('¿Por qué se cancela la tarea?').then(function (m) {
        if (!m) return;
        return llamar('orden_cancelar_tarea', { p_tarea: b.dataset.cancelar, p_motivo: m }).then(function () { avisar('Tarea cancelada.'); pantallaEquipo(); });
      });
    });
  });
  var n = document.getElementById('nuevaTarea');
  if (n) n.onclick = function () { pantallaNuevaTarea(loc, x.gente); };
}

function pantallaNuevaTarea(loc, gente) {
  barra.hidden = true;
  app.className = 'app';
  app.innerHTML = '<button class="volver" id="volver">‹ Volver al equipo</button><h1>Nueva tarea</h1>' +
    '<p class="bajada">' + esc(loc.nombre) + '</p>' +
    '<div class="seccion">Para quién</div><div class="perfil">' + gente.map(function (p) {
      return '<label class="check"><input type="checkbox" value="' + esc(p.id) + '"> ' + esc(nombreCorto(p)) + '</label>';
    }).join('') + '</div>' +
    '<label class="campo"><span>Qué hay que hacer</span><input id="titulo" maxlength="140"></label>' +
    '<label class="campo"><span>Detalle (opcional)</span><textarea id="detalle" rows="2"></textarea></label>' +
    '<label class="campo"><span>Plazo</span><select id="plazo"><option value="hoy">Hoy</option><option value="manana" selected>Mañana</option><option value="semana">Esta semana</option></select></label>' +
    /* Con foto de entrada (16/10): con la foto se ve que se hizo. Se destilda para lo que no se puede fotografiar. */
    '<label class="check"><input type="checkbox" id="pideFoto" checked> Pide foto al terminarla</label>' +
    '<button class="boton lima" id="crear" style="margin-top:14px">Mandar la tarea</button>';
  document.getElementById('volver').onclick = function () { irA('equipo'); };
  var b = document.getElementById('crear');
  unaVez(b, function () {
    var ids = [].map.call(app.querySelectorAll('.check input[type=checkbox][value]:checked'), function (c) { return c.value; });
    var titulo = String(document.getElementById('titulo').value || '').trim();
    if (!ids.length) { avisar('Elegí para quién es.'); return; }
    if (!titulo) { avisar('Escribí qué hay que hacer.'); return; }
    b.textContent = 'Mandando…';
    return llamar('orden_crear_tarea', {
      p_personas: ids, p_titulo: titulo, p_detalle: document.getElementById('detalle').value || null, p_modulo: null,
      p_plazo: document.getElementById('plazo').value, p_requiere_foto: document.getElementById('pideFoto').checked
    }).then(function () { avisar(ids.length === 1 ? 'Tarea mandada.' : 'Tarea mandada a ' + ids.length + ' personas.'); irA('equipo'); });
  });
}

/* ── Cajas ── */
function pantallaCajasSup() {
  marcarPestana('cajas');
  adentro();
  app.innerHTML = cabeza('Cajas', '') + '<p class="cargando">Cargando…</p>';
  engancharCabeza();
  localSup().then(function (loc) {
    if (!loc) { sinLocales('Cajas'); return; }
    var L = valor(loc.id);
    return Promise.all([
      leer('/orden_v_cajas?select=*&local_id=eq.' + L + '&order=fecha.desc&limit=31'),
      leer('/orden_config?select=caja_activa&local_id=eq.' + L)
    ]).then(function (r) {
      if (_pestana !== 'cajas') return;
      var cajas = r[0] || [], activa = !!(r[1] && r[1][0] && r[1][0].caja_activa);
      var html = cabeza('Cajas', loc.nombre) + selectorLocal(loc);
      if (!activa) html += '<div class="nota">El control de caja está apagado en este local. Se prende desde la administración.</div>';
      var sin = cajas.filter(function (c) { return c.estado === 'cargada'; });
      if (sin.length) html += '<div class="seccion">Sin controlar</div>' + sin.map(filaCaja).join('');
      var resto = cajas.filter(function (c) { return c.estado !== 'cargada'; });
      if (resto.length) html += '<div class="seccion">Últimos días</div>' + resto.map(filaCaja).join('');
      if (!cajas.length) html += '<div class="vacio">Todavía no hay cajas cargadas.</div>';
      app.innerHTML = html;
      engancharCabeza();
      engancharSelector(pantallaCajasSup);
      var porId = {};
      cajas.forEach(function (c) { porId[c.id] = c; });
      app.querySelectorAll('[data-caja]').forEach(function (b) { b.onclick = function () { detalleCaja(porId[b.dataset.caja]); }; });
    });
  }).catch(function (e) { pantallaError(e, pantallaCajasSup); });
}

function filaCaja(c) {
  var n = (c.alertas || []).length;
  var est = c.estado === 'controlada' ? ['listo', 'Controlada'] : c.estado === 'cargada' ? ['sorpresa', 'Para controlar'] : ['pendiente', 'Sin cargar'];
  return '<button class="fila fila-boton" data-caja="' + esc(c.id) + '"><span><b>' + esc(diaMes(c.fecha)) + '</b></span>' +
    '<span class="chip ' + est[0] + '">' + est[1] + '</span>' + (n ? '<span class="chip vencido">' + n + (n === 1 ? ' alerta' : ' alertas') + '</span>' : '') + '</button>';
}

function detalleCaja(c) {
  barra.hidden = true;
  app.className = 'app';
  var filas = [['Mercado Pago', 'sis_mp', 'real_mp', 'desvio_mp'], ['Tarjeta', 'sis_tarjeta', 'real_lote', 'desvio_tarjeta'],
               ['Go Cuotas', 'sis_gocuotas', 'real_gocuotas', 'desvio_gocuotas'], ['Efectivo', 'sis_saldo_final_efvo', 'real_efectivo', 'desvio_efectivo']];
  var html = '<button class="volver" id="volver">‹ Volver a cajas</button><h1>Caja del ' + esc(diaMes(c.fecha)) + '</h1>' +
    '<p class="bajada">' + esc(c.local_nombre + (c.cargada_por_nombre ? ' · la cargó ' + c.cargada_por_nombre : '')) + '</p>' +
    '<div class="tabla-caja"><div class="fila cab"><span></span><span>Cierre</span><span>Real</span><span>Desvío</span></div>' + filas.map(function (f) {
      var d = Number(c[f[3]] || 0);
      /* (SQL 122) Vacío con el otro lado escrito: falta cargarlo. */
      var lado = function (a, b) { return c[a] == null && c[b] != null && Number(c[b]) !== 0 ? '<b class="falta-cargar">Falta</b>' : pesos(c[a]); };
      return '<div class="fila"><span>' + f[0] + '</span><span>' + lado(f[1], f[2]) + '</span><span>' + lado(f[2], f[1]) + '</span><span class="' + (Math.abs(d) > 0.5 ? 'rojo' : '') + '">' + pesos(d) + '</span></div>';
    }).join('') + '</div>' +
    ((c.alertas || []).length ? '<div class="revision mala"><div class="titulo">Alertas</div>' + c.alertas.map(function (a) { return '<div>' + esc(textoAlerta(a)) + '</div>'; }).join('') + '</div>' : '') +
    (c.observaciones ? '<div class="nota">' + esc(c.observaciones) + '</div>' : '') +
    /* (SQL 124) Corregirla con el cierre nuevo o a mano, o cargarla si no la cargaron. */
    (c.estado !== 'controlada' && !soloMira()
      ? '<button class="boton" id="corregirCaja">' + (c.estado === 'pendiente' ? 'Cargar la caja' : 'Corregir: cierre nuevo o a mano') + '</button>' : '');
  var fotos = c.fotos || {};
  if (Object.keys(fotos).length) {
    html += '<div class="seccion">Fotos</div><div class="grilla">' + FOTOS_CAJA.filter(function (t) { return fotos[t[0]]; }).map(function (t) {
      return '<figure class="foto-chica"><img data-foto="' + esc(fotos[t[0]]) + '" alt=""><figcaption>' + esc(t[1]) + '</figcaption></figure>';
    }).join('') + '</div>';
  }
  if ((c.historial || []).length) {
    html += '<div class="seccion">Cambios después de cargarla</div>' + c.historial.map(function (h) {
      return '<div class="fila"><span>' + esc((h.por || '') + ' · ' + diaMes(h.en) + ' ' + hora(h.en)) + '</span><small>Antes: ' +
        esc(Object.keys(h.antes || {}).map(function (k) { return k.replace(/^(sis|real)_/, '') + ' ' + pesos(h.antes[k]); }).join(' · ')) + '</small></div>';
    }).join('');
  }
  /* Lo que falta de plata: la suma de los desvíos positivos (el sistema dice más de lo que hay). */
  var faltaPlata = (c.alertas || []).reduce(function (s, a) { return s + (a.tipo === 'desvio' && Number(a.monto) > 0 ? Number(a.monto) : 0); }, 0);
  if (c.estado === 'controlada') {
    html += '<div class="nota">Controlada' + (c.controlada_por_nombre ? ' por ' + esc(c.controlada_por_nombre) : '') + (c.nota_control ? ': ' + esc(c.nota_control) : '.') +
      (c.diferencia_persona ? '<br><b>Diferencia a cargo de ' + esc(c.diferencia_persona_nombre || '—') + ': ' + pesos(c.diferencia_monto) + '</b>' : '') + '</div>';
  } else if (c.estado === 'cargada' && !soloMira()) {
    html += '<label class="campo"><span>' + ((c.alertas || []).length ? 'Qué pasó (obligatorio: tiene alertas)' : 'Nota (opcional)') + '</span><textarea id="notaCaja" rows="2"></textarea></label>';
    /* (SQL 124) Si la diferencia no tiene arreglo: quién se hace cargo y cuánto. */
    if ((c.alertas || []).length) {
      html += '<label class="campo"><span>Si la diferencia no tiene arreglo, ¿quién se hace cargo?</span><select id="aCargo"><option value="">Nadie: se resolvió o no corresponde</option></select></label>' +
        '<label class="campo" id="montoCargoCampo" hidden><span>Monto a su cargo</span><input inputmode="decimal" id="montoCargo" value="' + (faltaPlata > 0 ? esc(String(Math.round(faltaPlata))) : '') + '" placeholder="$"></label>';
    }
    html += '<button class="boton lima" id="controlar">Dar por controlada</button>';
  }
  app.innerHTML = html;
  cargarFotos(app);
  document.getElementById('volver').onclick = function () { irA('cajas'); };
  var bc = document.getElementById('corregirCaja');
  if (bc) unaVez(bc, function () { return corregirCaja(c); });
  var sel = document.getElementById('aCargo');
  if (sel) {
    var montoCampo = document.getElementById('montoCargoCampo');
    sel.onchange = function () { montoCampo.hidden = !sel.value; };
    /* La gente del local; de entrada, quien la cargó (si falta plata). */
    leer('/orden_personas?select=id,nombre,inicial,rol&local_id=eq.' + valor(c.local_id) + '&activo=is.true&order=nombre.asc').then(function (gente) {
      (gente || []).forEach(function (p) {
        var o = document.createElement('option'); o.value = p.id; o.textContent = nombreLista(p); sel.appendChild(o);
      });
      if (faltaPlata > 0 && c.cargada_por && (gente || []).some(function (p) { return p.id === c.cargada_por; })) { sel.value = c.cargada_por; montoCampo.hidden = false; }
    }).catch(function () {});
  }
  var b = document.getElementById('controlar');
  if (b) unaVez(b, function () {
    var nota = document.getElementById('notaCaja').value;
    if ((c.alertas || []).length && !String(nota).trim()) { avisar('Tiene alertas: escribí qué pasó.'); return; }
    var persona = sel ? sel.value : '', monto = null;
    if (persona) {
      monto = numeroCaja(document.getElementById('montoCargo').value);
      if (!(monto > 0)) { avisar('Escribí cuánto queda a su cargo.'); return; }
    }
    var seguir = persona
      ? confirmar('La diferencia de ' + pesos(monto) + ' queda a cargo de ' + sel.selectedOptions[0].textContent + '. ¿Confirmás?', 'Sí, confirmar')
      : Promise.resolve(true);
    return seguir.then(function (si) {
      if (!si) return;
      var args = { p_caja: c.id, p_nota: nota || null };
      if (persona) { args.p_persona = persona; args.p_monto = monto; }
      return llamar('orden_caja_controlar', args).then(function () { avisar('Caja controlada.'); irA('cajas'); });
    });
  });
}

/* ════════════════════════════════════════════════════════════════════════
   ARRANQUE
   ════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════
   VER SU APP (14/10, pedido de Mauricio: "ver lo que hacen los chicos, cómo les aparece"). La supervisión (y la
   gerencia) abre la app de un vendedor tal cual la ve él, con sus datos: Hoy, Fotos, Tareas, Caja, Ideas, los avisos y
   el Perfil. Sólo para mirar: lo que se hace (fotos, tareas, test, caja, producto testigo, descargos, marcar avisos)
   queda trabado. Lo que se ve lo sigue decidiendo la base (la supervisión lee lo de su local; escribir como otro, no).
   ════════════════════════════════════════════════════════════════════════ */
var _espejo = null;
var _yoReal = yo;
yo = function () { return _espejo || _yoReal(); };
function textoEspejo() { return 'Estás mirando la app de ' + (_espejo ? _espejo.nombre : 'otra persona') + ': esto lo hace desde su celular.'; }
function trabado() { return Promise.reject(rechazo(textoEspejo())); }

/* Lo que escribe, trabado. Lo que se pregunta "como yo" (el test, la caja de hoy), se lee de sus tablas. */
var _llamarReal = llamar, _escribirReal = escribir, _subirReal = subirArchivo, _subirEnReal = subirArchivoEn, _funcionReal = llamarFuncion;
llamar = function (nombre, args, tope) {
  if (!_espejo) return _llamarReal(nombre, args, tope);
  if (nombre === 'orden_desafio_mio') return desafioEspejo();
  if (nombre === 'orden_caja_hoy') return cajaEspejo();
  return trabado();
};
escribir = function (ruta, metodo, cuerpo) { return _espejo ? trabado() : _escribirReal(ruta, metodo, cuerpo); };
subirArchivo = function (ruta, blob) { return _espejo ? trabado() : _subirReal(ruta, blob); };
subirArchivoEn = function (b, ruta, blob, tipo) { return _espejo ? trabado() : _subirEnReal(b, ruta, blob, tipo); };
llamarFuncion = function (nombre, cuerpo) { return _espejo && nombre !== 'ideas-tablero' ? trabado() : _funcionReal(nombre, cuerpo); };
/* Lo que abre la cámara o pregunta algo antes de escribir: ni se abre. */
[['abrirCamara'], ['accionTarea'], ['abrirDesafio'], ['pantallaDesafio'], ['grabarVideo'], ['activarAvisos'], ['instalarApp']].forEach(function (x) {
  var real = window[x[0]];
  window[x[0]] = function () { if (_espejo) { avisar(textoEspejo()); return Promise.resolve(); } return real.apply(this, arguments); };
});
/* Sus avisos: si los tiene activados en su celular (no en éste). */
var _estadoAvisosReal = estadoAvisos;
estadoAvisos = function () {
  if (!_espejo) return _estadoAvisosReal();
  return leer('/orden_v_personas?select=avisos_activos&id=eq.' + valor(_espejo.id)).then(function (f) { return f && f[0] && f[0].avisos_activos ? 'activos' : 'apagados'; }, function () { return 'activos'; });
};
/* "No soy yo", en el espejo, es salir del espejo (no cerrar la sesión). */
var _preguntarSalirReal = preguntarSalir;
preguntarSalir = function () { if (_espejo) { salirEspejo(); return Promise.resolve(); } return _preguntarSalirReal(); };

/** El test, como lo devuelve orden_desafio_mio (el abierto primero), leído de sus tests. */
function desafioEspejo() {
  return leer('/orden_desafios?select=id,semana,titulo,vence_en,terminado_en,puntaje,total,preguntas,respuestas&persona_id=eq.' + valor(_espejo.id) + '&order=creado_en.desc&limit=20').then(function (f) {
    f = f || [];
    var ahora = new Date(), abierto = function (d) { return !d.terminado_en && new Date(d.vence_en) > ahora; };
    var d = f.filter(abierto)[0] || f[0];
    if (!d) return null;
    var resp = d.respuestas || {};
    return { id: d.id, semana: d.semana, titulo: d.titulo, vence_en: d.vence_en, terminado_en: d.terminado_en, puntaje: d.puntaje, total: d.total,
             abiertos: f.filter(abierto).length, preguntas: (d.preguntas || []).map(function (q) { return { id: q, respondida: Object.prototype.hasOwnProperty.call(resp, q) }; }) };
  });
}
/** La caja de hoy de su local (si todavía no la cargaron, vacía). */
function cajaEspejo() {
  if (!_espejo.local_id) return Promise.reject(rechazo('No tiene local.'));
  return leer('/orden_cajas?select=*&local_id=eq.' + valor(_espejo.local_id) + '&fecha=eq.' + hoyAR()).then(function (f) {
    return (f || [])[0] || { id: '00000000-0000-0000-0000-000000000000', local_id: _espejo.local_id, fecha: hoyAR(), estado: 'pendiente' };
  });
}

/* Mientras se mira: los campos no se pueden tocar, y "No soy yo" dice "Salir". */
var _vigiaEspejo = new MutationObserver(function () {
  if (!_espejo) return;
  app.querySelectorAll('input, textarea, select').forEach(function (x) { x.disabled = true; });
  var s = document.getElementById('salir');
  if (s && s.textContent !== 'Salir de la app de ' + _espejo.nombre) s.textContent = 'Salir de la app de ' + _espejo.nombre;
});

/** Entrar a mirar la app de p (una persona del local loc). */
function verSuApp(p, loc) {
  if (!esSupervision() || _espejo) return;
  apagarCamara();
  cerrarCapas();
  _espejo = { id: p.id, nombre: p.nombre, inicial: p.inicial || null, rol: 'vendedor', local_id: loc.id, local: loc.nombre, aprobado: true, activo: true };
  _espejoVolver = loc;
  _sinLeer = 0; _sinLeerEn = 0; _sinLeerDe = null;
  document.body.classList.add('espejo');
  var banda = document.createElement('div');
  banda.className = 'espejo-banda';
  banda.id = 'espejoBanda';
  banda.innerHTML = '<span>Estás viendo la app de <b>' + esc(nombreCorto(p)) + '</b> · sólo para mirar</span><button type="button" id="salirEspejo">Salir</button>';
  document.body.appendChild(banda);
  document.getElementById('salirEspejo').onclick = salirEspejo;
  _vigiaEspejo.observe(app, { childList: true, subtree: true });
  armarBarra();
  revisarCaja();
  irA('hoy');
}
var _espejoVolver = null;
function salirEspejo() {
  if (!_espejo) return;
  _espejo = null;
  _vigiaEspejo.disconnect();
  document.body.classList.remove('espejo');
  var b = document.getElementById('espejoBanda');
  if (b) b.remove();
  _sinLeer = 0; _sinLeerEn = 0; _sinLeerDe = null;
  apagarCamara();
  cerrarCapas();
  armarBarra();
  revisarCaja();
  irA('equipo');
}
/** Desde la administración: vendedores.html#/ver/<id>. */
function verSuAppPorId(id) {
  return leer('/orden_personas?select=id,nombre,inicial,rol,local_id,aprobado&id=eq.' + valor(id)).then(function (f) {
    var p = (f || [])[0];
    if (!p || !p.local_id) { avisar('No encontramos a esa persona.'); irInicio(); return; }
    return leer('/orden_locales?select=id,nombre&id=eq.' + valor(p.local_id)).then(function (l) {
      verSuApp(p, (l || [])[0] || { id: p.local_id, nombre: '' });
    });
  }).catch(function (e) { pantallaError(e, irInicio); });
}

registroSW().catch(function () { /* sin service worker la app anda igual (sin avisos) */ });

if (_vend && _vend.refresco) entrarApp(false);
else pantallaLocales();

/* ════════════════════════════════════════════════════════════════════════
   EL MAPA DEL LOCAL (supervisión, para mirar). La cantidad y el reparto se
   hacen en la administración, desde la computadora (pedido de Mauricio).
   ════════════════════════════════════════════════════════════════════════ */

/* Desde el 13/10 es el modo observador (croquis-visor.js): el local con volumen, la foto de cada módulo, y tocándolo,
   su vista de frente para dejarle una sugerencia al que lo tiene. Se arma y se reparte desde la computadora.
   Desde el 14/10 lo ven también los vendedores (pedido de Mauricio), desde Fotos: sólo para mirar. volverA: la
   pestaña a la que vuelve ("‹ Volver" y el "atrás" de Android). */
function pantallaMapa(loc, volverA) {
  apagarCamara();
  barra.hidden = true;
  app.className = 'app';
  var supervisa = esSupervision() && !soloMira();
  abrirVisor(app, {
    local: loc, puedeSugerir: supervisa, puedeEditar: false,
    /* Qué hay: el supervisor en todos; el vendedor en los suyos (o los que cubre) y en la vidriera, que es de todos (SQL 118). */
    puedeNombrar: supervisa || (!soloMira() && function (m, d) {
      if (!('contenido_origen' in m)) return false;   // sin el SQL 118 la base sólo deja al supervisor
      var s = d.sectorDe[m.sector_id], id = yo().id;
      return esVidriera(m) || !!(s && id && (s.responsable_id === id || s.suplente_id === id));
    }),
    dondeAsignar: 'se asigna desde la computadora (No Compra → Supervisión → Por local)',
    capa: { abrir: abrirCapa, soltar: soltarCapa },
    alVolver: function () { irA(volverA || 'equipo'); }
  });
}

/* ════════════════════════════════════════════════════════════════════════
   PRODUCTO TESTIGO (SQL 102). Desde la administración se programa el día y
   los productos; el local copia los números del sistema, cuenta lo que hay y
   graba un video cortito de cada producto (en el celular). Anda igual en la
   PC del local. La diferencia y el desvío se calculan solos.
   ════════════════════════════════════════════════════════════════════════ */

var CAMPOS_TESTIGO = [['enviada', 'Cantidad enviada'], ['stock_sistema', 'Stock sistema'], ['vendida', 'Cantidad vendida'],
                      ['cantidad_real', 'Cantidad real (contada)'], ['dev_fabrica', 'Dev. a fábrica'], ['salieron', 'Salieron'], ['entraron', 'Entraron']];
/* El stock del sistema puede dar negativo (22/10, pedido de Mauricio: "suele pasar,
   indica que hay algún error en el stock"); los demás números, no. */
var NEGATIVO_TESTIGO = { stock_sistema: true };
/* Lo escrito y todavía sin guardar, por producto: sobrevive a ir a grabar un video. */
var _borradorTestigo = {};

/** El número como lo escribieron, con el menos de cualquier teclado ("− 5" → "-5"). */
function limpiarNumeroTestigo(v) { return String(v == null ? '' : v).trim().replace(/^[-−–]\s*/, '-'); }

function numeroTestigoOk(k, v) { return (NEGATIVO_TESTIGO[k] ? /^-?\d{1,5}$/ : /^\d{1,5}$/).test(v); }

function pantallaTestigo(semId) {
  apagarCamara();
  barra.hidden = true;
  app.className = 'app';
  app.innerHTML = '<p class="cargando">Cargando…</p>';
  var per = yo(), hoy = hoyAR();
  /* Sin uno elegido: el que falta mandar con la fecha límite más cercana (SQL 152: se ve apenas se programa). */
  var buscar = semId
    ? leer('/testigo_semanas?select=*&id=eq.' + valor(semId))
    : leer('/testigo_semanas?select=*&local_id=eq.' + valor(per.local_id) + '&fecha=gte.' + sumarDias(hoy, -6) +
           '&cerrada=is.false&order=cargada_en.desc.nullsfirst,fecha.asc&limit=1');
  buscar.then(function (s) {
    var sem = (s || [])[0];
    if (!sem) {
      app.innerHTML = '<button class="volver" id="volver">‹ Volver a Hoy</button><h1>Producto testigo</h1>' +
        '<div class="vacio">No hay ningún producto testigo para cargar. Cuando lo programen, te aparece en Hoy.</div>';
      document.getElementById('volver').onclick = function () { irA('hoy'); };
      return;
    }
    return leer('/testigo_v_items?select=*&semana_id=eq.' + valor(sem.id) + '&order=item.asc')
      .then(function (items) { dibujarTestigo(sem, items || []); });
  }).catch(function (e) { pantallaError(e, function () { pantallaTestigo(semId); }); });
}

function dibujarTestigo(sem, items) {
  /* SQL 152: el vendedor carga desde que se programa hasta la fecha límite (vencido, seis días más), hasta mandarla.
     Después la corrige el supervisor. */
  var hoy = hoyAR(), cerro = !!(sem.fecha && sumarDias(sem.fecha, 6) < hoy);
  var bloqueado = sem.cerrada || !!sem.cargada_en || cerro || !sem.fecha;
  var html = '<button class="volver" id="volver">‹ Volver a Hoy</button><h1>Producto testigo</h1>' +
    '<p class="bajada">' + (sem.fecha ? 'Fecha límite: ' + esc(sem.fecha === hoy ? 'hoy, ' + diaYFecha(sem.fecha) : diaYFecha(sem.fecha)) + ' · ' : '') +
    'Copiá los números del sistema, contá lo que hay y grabá un video cortito de cada producto.</p>';
  if (sem.cerrada) html += '<div class="nota">Esta semana ya está cerrada.</div>';
  else if (sem.cargada_en) html += '<div class="nota">Ya la mandaron el ' + esc(diaMes(sem.cargada_en)) + ' a las ' + esc(hora(sem.cargada_en)) + '. Si hay que corregir algo, avisale a tu supervisor.</div>';
  else if (cerro || !sem.fecha) html += '<div class="nota">Este control ya cerró' + (sem.fecha ? ' (la fecha límite era el ' + esc(diaYFecha(sem.fecha)) + ')' : '') + '. Si hay que cargar algo, avisale a tu supervisor.</div>';
  else if (sem.fecha < hoy) html += '<div class="nota alerta">Venció el ' + esc(diaYFecha(sem.fecha)) + ': cargalo y mandalo igual.</div>';
  html += items.map(function (it) { return tarjetaTestigo(it, bloqueado); }).join('');
  if (!items.length) html += '<div class="vacio">Todavía no hay productos cargados.</div>';
  if (!bloqueado && items.length) {
    html += '<button class="boton" id="tGuardar">Guardar</button>' +
            '<button class="boton lima" id="tMandar" style="margin-top:10px">Listo, mandar</button>';
  }
  app.innerHTML = html;
  document.getElementById('volver').onclick = function () { irA('hoy'); };
  var porId = {};
  items.forEach(function (it) { porId[it.id] = it; });
  app.querySelectorAll('.testigo-item').forEach(function (card) {
    card.addEventListener('input', function (e) {
      var k = e.target.dataset && e.target.dataset.k;
      if (!k) return;
      var b = _borradorTestigo[card.dataset.item] = _borradorTestigo[card.dataset.item] || {};
      b[k] = e.target.value;
      resultadoTestigo(card);
    });
    resultadoTestigo(card);
    card.querySelectorAll('[data-signo]').forEach(function (bs) {
      bs.onclick = function (e) {
        e.preventDefault();
        var inp = card.querySelector('[data-k="' + bs.dataset.signo + '"]'), v = limpiarNumeroTestigo(inp.value);
        inp.value = v.charAt(0) === '-' ? v.slice(1) : '-' + v;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.focus();
      };
    });
    var bv = card.querySelector('[data-video]');
    if (bv) bv.onclick = function () { grabarVideo(sem, porId[card.dataset.item], function () { pantallaTestigo(sem.id); }); };
  });
  var g = document.getElementById('tGuardar'), m = document.getElementById('tMandar');
  if (g) unaVez(g, function () {
    return guardarTestigo(items).then(function (n) { avisar(n ? 'Guardado.' : 'No había nada nuevo para guardar.'); });
  });
  if (m) unaVez(m, function () {
    var sinVideo = items.filter(function (it) { return !it.video_path || it.video_borrado; }).length;
    return (sinVideo ? confirmar(sinVideo === items.length ? 'Todavía no grabaste ningún video. ¿Mandar igual, sólo con los números?'
                                                          : 'Falta el video de ' + sinVideo + (sinVideo === 1 ? ' producto' : ' productos') + '. ¿Mandar igual?', 'Mandar igual')
                     : Promise.resolve(true)).then(function (seguro) {
      if (!seguro) return;
      return guardarTestigo(items).then(function () { return llamar('testigo_terminar', { p_semana: sem.id }); }).then(function (r) {
        avisar(r && r.con_diferencia
          ? 'Mandado. ' + (r.con_diferencia === 1 ? 'Un producto dio diferencia' : r.con_diferencia + ' productos dieron diferencia') + ': le avisamos a tu supervisor.'
          : 'Mandado: dio todo justo.');
        irA('hoy');
      });
    });
  });
}

function tarjetaTestigo(it, bloqueado) {
  var b = _borradorTestigo[it.id] || {};
  var val = function (k) { return b[k] != null ? b[k] : it[k] == null ? '' : it[k]; };
  var conVideo = it.video_path && !it.video_borrado;
  return '<div class="testigo-item" data-item="' + esc(it.id) + '">' +
    (it.rubro ? '<small class="ti-rubro">' + esc(it.rubro) + '</small>' : '') +
    '<div class="ti-cab"><b>' + esc(it.item + ' · ' + it.producto) + '</b>' + (it.color ? '<span class="chip pendiente">' + esc(it.color) + '</span>' : '') + '</div>' +
    '<div class="ti-grilla">' + CAMPOS_TESTIGO.map(function (c) {
      var neg = NEGATIVO_TESTIGO[c[0]];
      /* El ± va después del casillero: así la etiqueta sigue siendo del casillero (en el teclado de números del iPhone no hay "-"). */
      return '<label class="campo"><span>' + esc(c[1]) + '</span>' + (neg ? '<span class="con-signo">' : '') +
        '<input inputmode="numeric" maxlength="' + (neg ? 6 : 5) + '" autocomplete="off" data-k="' + c[0] + '" value="' + esc(val(c[0])) + '"' + (bloqueado ? ' disabled' : '') + '>' +
        (neg ? (bloqueado ? '' : '<button type="button" class="signo" data-signo="' + c[0] + '" aria-label="Poner o sacar el menos (stock negativo)">±</button>') + '</span>' : '') + '</label>';
    }).join('') + '</div>' +
    '<label class="campo"><span>Observaciones</span><input maxlength="300" autocomplete="off" data-k="observacion" value="' + esc(val('observacion')) + '"' + (bloqueado ? ' disabled' : '') + '></label>' +
    '<div class="ti-res" data-res></div>' +
    (bloqueado ? '' : '<button class="boton chico' + (conVideo ? '' : ' lima') + '" data-video>' + (conVideo ? 'Video listo ✓ · Grabar de nuevo' : 'Grabar el video (hasta 20 s)') + '</button>') +
    '</div>';
}

/** Diferencia y desvío mientras escriben, como en la planilla. */
function resultadoTestigo(card) {
  var n = function (k) { var v = limpiarNumeroTestigo((card.querySelector('[data-k="' + k + '"]') || {}).value); return numeroTestigoOk(k, v) ? Number(v) : null; };
  var stock = n('stock_sistema'), real = n('cantidad_real'), env = n('enviada'), res = card.querySelector('[data-res]');
  if (stock == null || real == null) { res.textContent = ''; res.className = 'ti-res'; return; }
  var dif = stock - real;
  res.textContent = textoDiferencia(dif) + (env > 0 && dif !== 0 ? ' · desvío ' + textoDesvio(100 * dif / env) : '');
  res.className = 'ti-res ' + (dif > 0 ? 'falta' : dif < 0 ? 'sobra' : 'justo');
}

/** Guarda los productos que cambiaron. Devuelve cuántos guardó. */
function guardarTestigo(items) {
  var porId = {}, cambios = [], malo = null;
  items.forEach(function (it) { porId[it.id] = it; });
  app.querySelectorAll('.testigo-item').forEach(function (card) {
    var it = porId[card.dataset.item], datos = {}, distinto = false;
    card.querySelectorAll('[data-k]').forEach(function (inp) {
      var k = inp.dataset.k, v = k === 'observacion' ? String(inp.value || '').trim() : limpiarNumeroTestigo(inp.value);
      datos[k] = v;
      if (v !== String(it[k] == null ? '' : it[k])) distinto = true;
      if (k !== 'observacion' && v !== '' && !numeroTestigoOk(k, v) && !malo) {
        malo = it.producto + ': en "' + CAMPOS_TESTIGO.filter(function (c) { return c[0] === k; })[0][1] + '" va un número entero' + (NEGATIVO_TESTIGO[k] ? '.' : ', sin negativos.');
      }
    });
    if (distinto) cambios.push({ it: it, datos: datos });
  });
  if (malo) return Promise.reject(rechazo(malo));
  return cambios.reduce(function (p, c) {
    return p.then(function () {
      return llamar('testigo_cargar', { p_item: c.it.id, p_datos: c.datos }).then(function (fila) {
        if (fila) Object.keys(fila).forEach(function (k) { c.it[k] = fila[k]; });
        delete _borradorTestigo[c.it.id];
      });
    });
  }, Promise.resolve()).then(function () { return cambios.length; });
}

/* ---------- El video: hasta 20 segundos, liviano (640×480), con sonido ----------
   Con sonido desde el 22/10 (pedido de Mauricio: que se escuche cómo cuentan).
   Si no dejan usar el micrófono, se graba igual, sin sonido. */

var _grabador = null;

function tipoGrabable(conSonido) {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return null;
  return (conSonido
    ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/webm;codecs=vp8,opus', 'video/mp4', 'video/webm']
    : ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm']).filter(function (t) {
    try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; }
  })[0] || null;
}

function tipoDeVideo(t, nombre) {
  t = String(t || '').split(';')[0];
  if (t === 'video/webm' || t === 'video/mp4' || t === 'video/quicktime') return t;
  return /\.webm$/i.test(nombre || '') ? 'video/webm' : /\.mov$/i.test(nombre || '') ? 'video/quicktime' : 'video/mp4';
}

function megas(n) { return String(Math.max(0.1, Math.round(n / 104857.6) / 10)).replace('.', ',') + ' MB'; }

function pararGrabador() {
  if (!_grabador) return;
  var r = _grabador;
  _grabador = null;
  r.onstop = null;
  clearInterval(r._reloj);
  try { if (r.state !== 'inactive') r.stop(); } catch (e) {}
}

function grabarVideo(sem, it, alTerminar) {
  pararGrabador();
  apagarCamara();
  barra.hidden = true;
  app.className = 'app';
  app.innerHTML =
    '<div class="camara-vista" id="vista">' +
      '<video id="video" playsinline muted autoplay></video>' +
      '<div class="guia"><span id="guiaV">Mostrá y contá las prendas: hasta 20 segundos</span></div>' +
      '<div class="camara-arriba"><button class="volver" id="cerrar">‹ Volver</button><span class="titulo">' + esc(it.producto + (it.color ? ' ' + it.color : '')) + '</span>' +
        '<span class="cuenta-video" id="cuenta"></span></div>' +
      '<div class="camara-abajo">' +
        '<button class="disparar grabar" id="grabar" aria-label="Grabar el video"></button>' +
        '<button class="enlace" id="otra">¿No anda la cámara?</button>' +
      '</div>' +
      '<input type="file" id="archivo" accept="video/*" capture="environment" hidden>' +
    '</div>';
  var video = document.getElementById('video'), archivo = document.getElementById('archivo'), grabar = document.getElementById('grabar');
  var tipo = tipoGrabable();
  document.getElementById('cerrar').onclick = function () { pararGrabador(); apagarCamara(); alTerminar(false); };
  document.getElementById('otra').onclick = function () { pararGrabador(); archivo.click(); };
  archivo.onchange = function () {
    var f = archivo.files && archivo.files[0];
    if (!f) return;
    /* Con la cámara del teléfono los videos pesan mucho más que grabados en la app (20 s en alta calidad, unos 40 MB). */
    if (f.size > 20 * 1024 * 1024) { avisar('El video pesa ' + megas(f.size) + ': grabalo más corto, de unos 10 segundos.'); return; }
    apagarCamara();
    verVideoGrabado(sem, it, f, tipoDeVideo(f.type, f.name), alTerminar);
  };
  /* Sin cámara adentro de la app (o sin poder grabar): la del teléfono. */
  function sinGrabar() {
    var g = document.getElementById('guiaV');
    if (g) g.textContent = 'Tocá el botón para grabar con la cámara del teléfono (hasta 20 segundos)';
    grabar.onclick = function () { archivo.click(); };
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !tipo) { sinGrabar(); return; }
  var pedir = function (conSonido) {
    return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: conSonido });
  };
  pedir(true).catch(function () { return pedir(false); })
    .then(function (s) {
      if (!document.getElementById('video')) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      if (s.getAudioTracks().length) tipo = tipoGrabable(true) || tipo;
      _stream = s;
      video.srcObject = s;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }).catch(sinGrabar);
  grabar.onclick = function () {
    if (_grabador) { if (_grabador.state === 'recording') _grabador.stop(); return; }
    if (!_stream) { archivo.click(); return; }
    var partes = [], seg = 20, rec;
    try { rec = new MediaRecorder(_stream, { mimeType: tipo, videoBitsPerSecond: 900000, audioBitsPerSecond: 64000 }); } catch (e) { sinGrabar(); return; }
    _grabador = rec;
    rec.ondataavailable = function (e) { if (e.data && e.data.size) partes.push(e.data); };
    rec.onstop = function () {
      clearInterval(rec._reloj);
      _grabador = null;
      var base = tipo.split(';')[0];
      var blob = new Blob(partes, { type: base });
      apagarCamara();
      if (!blob.size) { avisar('No se grabó nada. Probá de nuevo.'); grabarVideo(sem, it, alTerminar); return; }
      verVideoGrabado(sem, it, blob, base, alTerminar);
    };
    rec.start(1000);
    grabar.classList.add('grabando');
    document.getElementById('guiaV').textContent = 'Grabando… tocá de nuevo para terminar';
    var cuenta = document.getElementById('cuenta');
    cuenta.textContent = seg + ' s';
    rec._reloj = setInterval(function () {
      seg--;
      if (cuenta) cuenta.textContent = Math.max(0, seg) + ' s';
      if (seg <= 0 && rec.state === 'recording') rec.stop();
    }, 1000);
  };
}

function verVideoGrabado(sem, it, blob, tipo, alTerminar) {
  barra.hidden = true;
  app.className = 'app';
  var url = URL.createObjectURL(blob);
  app.innerHTML = '<button class="volver" id="volverV">‹ Volver</button><h1>' + esc(it.producto + (it.color ? ' ' + it.color : '')) + '</h1>' +
    '<p class="bajada">Fijate que se vean bien las prendas. Pesa ' + megas(blob.size) + '.</p>' +
    '<video class="video-testigo" id="videoV" src="' + url + '" controls playsinline></video>' +
    '<button class="boton lima" id="mandarV">Mandar el video</button>' +
    '<button class="boton" id="otraV" style="margin-top:10px">Grabar de nuevo</button>';
  var salir = function (ok) { URL.revokeObjectURL(url); alTerminar(ok); };
  document.getElementById('volverV').onclick = function () { salir(false); };
  document.getElementById('otraV').onclick = function () { URL.revokeObjectURL(url); grabarVideo(sem, it, alTerminar); };
  unaVez(document.getElementById('mandarV'), function () {
    var ext = tipo === 'video/webm' ? 'webm' : tipo === 'video/quicktime' ? 'mov' : 'mp4';
    var ruta = sem.local_id + '/' + sem.id + '/' + it.id + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    document.getElementById('mandarV').textContent = 'Mandando…';
    return subirArchivoEn(VIDEOS_TESTIGO, ruta, blob, tipo)
      .then(function () { return llamar('testigo_video_guardar', { p_item: it.id, p_path: ruta }); })
      .then(function () { avisar('Video mandado.'); salir(true); });
  });
}
