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
  if (h === 'desafio' && !esSupervision()) { marcarPestana('hoy'); abrirDesafio(); return true; }
  if (h === 'testigo' && !esSupervision()) { marcarPestana('hoy'); pantallaTestigo(); return true; }
  if (/^ver\/[0-9a-f-]{36}$/i.test(h)) { if (esSupervision() && !_espejo) { verSuAppPorId(h.slice(4)); return true; } return false; }
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
  return '<div class="cabeza"><div>' +
    '<h1>' + esc(titulo) + '</h1>' +
    '<p class="bajada" style="margin:0">' + esc(debajo != null ? debajo : [per.local, fechaLarga()].filter(Boolean).join(' · ')) + '</p>' +
    '</div><div class="cabeza-botones">' +
    '<button class="campanita" id="campanita" aria-label="' + textoCampanita() + '">' + CAMPANA +
      '<i class="sin-leer"' + (sinLeer() ? '' : ' hidden') + '>' + (sinLeer() > 9 ? '9+' : sinLeer()) + '</i></button>' +
    (esSupervision() ? '' : '<button class="avatar" id="avatar" aria-label="Tu perfil">' + esc(inicial) + '</button>') + '</div></div>';
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
  var desdeHoy = new Date(hoy + 'T03:00:00Z').toISOString();
  Promise.all([
    /* Lo de hoy y lo que quedó pendiente (el depósito vence el viernes). */
    leer('/orden_v_controles?select=id,estado,vence_en&persona_id=eq.' + id + '&tipo=neq.correccion&or=(fecha.eq.' + hoy + ',estado.eq.pendiente)'),
    leer('/orden_v_persona_semana?select=nivel_semana,controles,controles_a_tiempo&persona_id=eq.' + id + '&semana=eq.' + lunesAR()).catch(fallo),
    leer('/orden_sectores?select=id&or=(responsable_id.eq.' + id + ',suplente_id.eq.' + id + ')&limit=1').catch(nada),
    llamar('orden_desafio_mio').catch(fallo),
    /* Las tareas abiertas y las que se cerraron hoy (para tacharlas). */
    leer('/orden_v_tareas?select=id,titulo,estado,completada_en&persona_id=eq.' + id +
         '&or=(estado.in.(pendiente,vencida),completada_en.gte.' + desdeHoy + ')&order=vence_en.asc').catch(fallo),
    estadoAvisos().catch(function () { return 'no-soportado'; }),
    /* SQL 99: lo que hay que acordarse hoy (martes entra mercadería…). */
    per.local_id ? leer('/orden_recordatorios?select=texto&local_id=eq.' + valor(per.local_id) + '&dia=eq.' + diaSemanaAR() + '&activo=is.true&order=creado_en.asc').catch(nada) : Promise.resolve(null),
    /* SQL 102: producto testigo de mañana, de hoy, uno atrasado sin mandar, o el que se mandó hoy. */
    per.local_id ? leer('/testigo_semanas?select=id,fecha,cargada_en,testigo_items(item,producto,color)&local_id=eq.' + valor(per.local_id) +
                        '&fecha=gte.' + sumarDias(hoy, -6) + '&fecha=lte.' + sumarDias(hoy, 1) + '&cerrada=is.false' +
                        '&or=(cargada_en.is.null,cargada_en.gte.' + desdeHoy + ')&order=fecha.asc').catch(fallo)
                 : Promise.resolve(null),
    /* La caja de hoy y si el local la controla (se pregunta acá: la primera vez en un celular todavía no se sabe). */
    per.local_id ? Promise.all([leer('/orden_config?select=caja_activa&local_id=eq.' + valor(per.local_id)),
                                leer('/orden_cajas?select=estado&local_id=eq.' + valor(per.local_id) + '&fecha=eq.' + hoy)]).catch(fallo) : Promise.resolve(null)
  ]).then(function (r) {
    if (_pestana !== 'hoy') return;
    var incompleto = [r[3], r[4], r[7], r[8]].indexOf(FALLO) > -1, semanaFallo = r[1] === FALLO;
    r = r.map(function (v) { return v === FALLO ? null : v; });
    var testigos = (r[7] || []).filter(function (s) { return (s.testigo_items || []).length; });
    dibujarHoy({
      controles: r[0] || [], semana: (r[1] || [])[0], sinModulos: Array.isArray(r[2]) && r[2].length === 0, desafio: r[3],
      tareas: r[4] || [], avisos: r[5], recordatorios: r[6] || [], incompleto: incompleto, semanaFallo: semanaFallo,
      caja: r[8] ? { activa: !!(r[8][0] && r[8][0][0] && r[8][0][0].caja_activa), hoy: (r[8][1] || [])[0] || null } : null,
      testigoPend: testigos.filter(function (s) { return !s.cargada_en && s.fecha <= hoy; })[0] || null,
      testigoMan: testigos.filter(function (s) { return !s.cargada_en && s.fecha > hoy; })[0] || null,
      testigoHecho: testigos.filter(function (s) { return s.cargada_en; })[0] || null
    });
    revisarCaja();
  }).catch(function (e) { pantallaError(e, pantallaHoy); });
}

function estadoDe(c, corregir) {
  if (c.estado === 'enviado' || c.estado === 'revisado') return { clase: 'listo', texto: 'Listo', hecho: true };
  if (c.estado === 'vencido') return { clase: 'vencido', texto: 'No se mandó', hecho: true };
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
    '<div class="grande">' + esc(nivel ? NIVEL[nivel] || nivel : 'Todavía sin fotos') + '</div>' +
    '<div class="chico">' + (s && s.controles ? s.controles_a_tiempo + ' de ' + s.controles + ' fotos a tiempo' : 'Cuando mandes tus fotos, acá ves cómo vas.') + '</div>' +
    '</div>';
}

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
    /* Lo que venció sin foto no se tacha: queda con una cruz (y no hay festejo). */
    var vencidas = total - env - pend.length;
    var vence = pend.map(function (c) { return c.vence_en; }).filter(Boolean).sort()[0];
    filas.push({ id: 'hFotos', titulo: 'Fotos de tus módulos', hecho: !pend.length && !vencidas, perdido: !pend.length && vencidas > 0,
      texto: pend.length ? env + ' de ' + total + ' mandadas' + (vence ? ' · ' + textoVence(vence) : '')
           : !vencidas ? (total === 1 ? 'Mandaste la foto.' : 'Mandaste las ' + total + '.')
           : env ? 'Mandaste ' + env + ' de ' + total + '; ' + (vencidas === 1 ? 'una venció' : vencidas + ' vencieron') + ' sin foto.'
           : (vencidas === 1 ? 'Venció sin foto.' : 'Vencieron las ' + vencidas + ' sin foto.') });
  }

  if (x.testigoPend) {
    var s = x.testigoPend, n = (s.testigo_items || []).length;
    filas.push({ id: 'hTestigo', titulo: 'Producto testigo', hecho: false, alerta: s.fecha < hoy,
      texto: s.fecha < hoy ? 'Era del ' + diaYFecha(s.fecha) + ': cargalo y mandalo.'
           : (n === 1 ? '1 producto' : n + ' productos') + ': los números del sistema, contar y un video de cada uno.' });
  } else if (x.testigoHecho) {
    filas.push({ id: 'hTestigo', titulo: 'Producto testigo', hecho: true, texto: 'Mandado.' });
  }

  var abiertas = x.tareas.filter(function (t) { return t.estado === 'pendiente' || t.estado === 'vencida'; });
  var hechas = x.tareas.filter(function (t) { return t.estado === 'hecha'; });
  if (abiertas.length) {
    filas.push({ id: 'hTareas', titulo: abiertas.length === 1 ? '1 tarea' : abiertas.length + ' tareas', hecho: false,
      alerta: abiertas.some(function (t) { return t.estado === 'vencida'; }),
      texto: abiertas[0].titulo + (abiertas.length > 1 ? ' y ' + (abiertas.length - 1) + ' más' : '') });
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
    else if (horaAR() >= 19) filas.push({ id: 'hCaja', titulo: 'Caja del día', hecho: false, texto: 'Las fotos del cierre y el efectivo que contaste.' });
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
  /* Mañana hay producto testigo: para saberlo (todavía no se carga). */
  if (x.testigoMan) html += tarjetaTestigoHoy(x.testigoMan);
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
  if ((b = document.getElementById('irTestigo'))) b.onclick = function () { pantallaTestigo(x.testigoMan.id); };
  if ((b = document.getElementById('reintentarHoy'))) b.onclick = pantallaHoy;
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
  app.innerHTML = cabeza('Fotos') + '<p class="cargando">Cargando…</p>';
  engancharCabeza();
  Promise.all([
    leer('/orden_v_controles?select=id,local_id,modulo_id,modulo_numero,modulo_nombre,foto_referencia_path,sector_tipo,tipo,estado,vence_en,nivel' +
         '&persona_id=eq.' + id + '&tipo=neq.correccion&or=(fecha.eq.' + hoy + ',estado.eq.pendiente)' +
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
  var mapa = x.mapa, mios = {}, marcas = {}, enMapa = {};
  var hayMapa = !!(mapa && mapa.pared.length + mapa.islas.length + mapa.dep.length);
  if (hayMapa) {
    /* Si un módulo tiene dos controles (el del día y una sorpresa), manda lo que falta hacer. */
    var PESO = { corregir: 5, sorpresa: 4, pendiente: 3, vencido: 2, listo: 1 };
    x.controles.forEach(function (c) {
      var e = estadoDe(c, corregir);
      var marca = e.hecho ? (c.estado === 'vencido' ? 'vencido' : 'listo') : e.clase === 'corregir' ? 'corregir' : e.clase === 'sorpresa' ? 'sorpresa' : 'pendiente';
      if (!marcas[c.modulo_id] || PESO[marca] > PESO[marcas[c.modulo_id]]) marcas[c.modulo_id] = marca;
      mios[c.modulo_id] = true;
    });
    var yoId = yo().id;
    mapa.modulos.forEach(function (m) { enMapa[m.id] = true; var s = mapa.sectorDe[m.sector_id]; if (s && s.responsable_id === yoId) mios[m.id] = true; });
    var hayMios = Object.keys(mios).length;
    html += '<div class="mapa-caja" id="mapaFotos">' +
      svgMapa(mapa, { mios: hayMios ? mios : null, marcas: marcas }) + svgDeposito(mapa, { mios: hayMios ? mios : null, marcas: marcas }) + '</div>' + leyendaNombres(mapa) +
      '<p class="bajada">' + (x.controles.some(function (c) { return !estadoDe(c, corregir).hecho; }) ? 'Tocá un módulo con la cámara para mandar su foto. Los que tienen ✓ ya están.'
                              : total ? 'Por hoy no te queda ninguna foto para mandar.'
                              : hayMios ? 'Lo tuyo está marcado con tu color.' : 'Todavía no tenés módulos asignados: tocá uno para ver de quién es.') + '</p>' +
      /* El modo observador: todo el local con volumen y la foto de cada módulo (para mirar). */
      '<button class="tarjeta-accion" id="verLocal"><b>Ver el local</b><span>Todos los módulos con su foto, y cómo están</span></button>';
  }

  /* La lista: sin croquis, todo; con croquis, sólo lo que no está dibujado. */
  var sueltos = x.controles.filter(function (c) { return !enMapa[c.modulo_id]; });
  [['salon', hayMapa ? 'Otros' : 'En el salón'], ['deposito', 'Depósito']].forEach(function (g) {
    var lista = sueltos.filter(function (c) { return c.sector_tipo === g[0]; });
    if (!lista.length) return;
    html += '<div class="seccion">' + g[1] + '</div>';
    lista.forEach(function (c) {
      var e = estadoDe(c, corregir);
      var vence = !e.hecho && c.vence_en ? textoVence(c.vence_en) : '';
      html += '<div class="modulo' + (e.hecho ? ' hecho' : '') + '">' +
        '<div class="que"><div class="nombre">' + esc(c.modulo_nombre) + '</div>' +
        '<div class="info"><span class="chip ' + e.clase + '">' + e.texto + '</span>' +
        (vence ? '<span class="chip vence">' + esc(vence) + '</span>' : '') + '</div></div>' +
        '<button class="camara" data-id="' + esc(c.id) + '" aria-label="Sacar foto de ' + esc(c.modulo_nombre) + '">' + CAMARA + '</button>' +
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
    bt.onclick = function () { pantallaFoto(_controles[bt.dataset.id]); };
  });
  var vl = document.getElementById('verLocal');
  if (vl) vl.onclick = function () { pantallaMapa({ id: yo().local_id, nombre: yo().local || 'Tu local' }, 'fotos'); };
  /* Tocar el croquis: si ese módulo tiene tu control pendiente, la cámara; si no, de quién es. */
  app.querySelectorAll('#mapaFotos .mapa-mod').forEach(function (g) {
    g.onclick = function () {
      var suyos = x.controles.filter(function (k) { return k.modulo_id === g.dataset.mod; });
      var falta = suyos.filter(function (k) { return !estadoDe(k, corregir).hecho; })[0];
      if (falta) { pantallaFoto(falta); return; }
      var m = mapa.modulos.filter(function (k) { return k.id === g.dataset.mod; })[0], s = m && mapa.sectorDe[m.sector_id];
      var quien = s && mapa.persona[s.responsable_id];
      var que = nombreModulo(m, s, mapa);
      avisar(!suyos.length ? que + (quien ? ' es de ' + nombreLista(quien) + '.' : ' no tiene responsable.')
        : suyos.some(function (k) { return k.estado === 'vencido'; }) ? que + ': la foto de hoy ya venció.' : que + ': ya mandaste la foto de hoy.');
    };
  });
}

/* ════════════════════════════════════════════════════════════════════════
   LA FOTO DE UN CONTROL
   La cámara se abre adentro de la app (getUserMedia), con un recuadro guía
   y la foto de referencia en chiquito. Si el teléfono no la deja usar, se
   abre la cámara del teléfono (capture): igual es cámara, no galería.
   La foto se achica, se sube a orden-fotos, se registra y la IA la revisa
   al instante. Cada foto se revisa UNA vez: para volver a revisar, se saca
   otra. Si la IA falla, el vendedor no queda trabado.
   ════════════════════════════════════════════════════════════════════════ */

var PREGUNTAS = {
  salon: [['dobladas', '¿Las prendas están dobladas y prolijas?'],
          ['frontales', '¿Los frontales están completos (4 prendas)?'],
          ['etiquetas', '¿Las etiquetas están adentro y con precio?'],
          ['limpieza', '¿Está limpio y sin faltantes?']],
  deposito: [['dobladas', '¿Está doblado en tamaño A4?'],
             ['rotulado', '¿Está rotulado y se lee bien?'],
             ['talles', '¿Está separado por segmento y talle?'],
             ['limpieza', '¿Está limpio y con los pasillos libres?']]
};
var CHECK = { dobladas: 'Doblado', frontales: 'Frontales', etiquetas: 'Etiquetas', limpieza: 'Limpieza',
              exhibicion: 'Exhibición', rotulado: 'Rotulado', talles: 'Segmento y talle' };

var _stream = null;
function apagarCamara() {
  pararGrabador();   // si estaba grabando un video de producto testigo, se descarta
  if (_stream) { _stream.getTracks().forEach(function (t) { t.stop(); }); _stream = null; }
}

function analizar(fotoId) {
  return llamarFuncion('analizar-foto', { foto_id: fotoId }).then(function (d) {
    /* Cualquier otra respuesta se toma como "no se pudo revisar": puede enviar igual. */
    if (!d._ok) return { ia_activa: true, error_ia: true, mensaje: 'No pudimos revisar la foto automáticamente. Podés enviarla igual.' };
    return d;
  });
}

function pantallaFoto(c) {
  if (!c) { irA('fotos'); return; }
  var estado = { intentos: 0, respuestas: {}, url: null, fotoId: null, resultado: null };
  /* Las fotos que ya sacó para este control cuentan para el "Enviar igual". */
  leer('/orden_fotos?select=id&control_id=eq.' + valor(c.id))
    .then(function (f) { estado.intentos = Math.max(estado.intentos, (f || []).length); })
    .catch(function () {});
  abrirCamara(c, estado);
}

/** La cámara a pantalla completa. alSacar(blob) recibe la foto ya achicada. */
function camara(titulo, referencia, guia, alSacar, alCerrar) {
  apagarCamara();
  barra.hidden = true;
  app.className = 'app';
  app.innerHTML =
    '<div class="camara-vista" id="vista">' +
      '<video id="video" playsinline muted autoplay></video>' +
      '<div class="guia"><span>' + esc(guia) + '</span></div>' +
      '<div class="camara-arriba"><button class="volver" id="cerrar">‹ Volver</button><span class="titulo">' + esc(titulo) + '</span><span style="width:60px"></span></div>' +
      '<img class="referencia" id="ref" alt="Cómo tiene que quedar" hidden>' +
      '<div class="camara-abajo">' +
        '<button class="disparar" id="disparar" aria-label="Sacar la foto"></button>' +
        '<button class="enlace" id="otra">¿No anda la cámara?</button>' +
      '</div>' +
      '<input type="file" id="archivo" accept="image/*" capture="environment" hidden>' +
    '</div>';
  var video = document.getElementById('video');
  var archivo = document.getElementById('archivo');
  document.getElementById('cerrar').onclick = function () { apagarCamara(); alCerrar(); };
  document.getElementById('otra').onclick = function () { archivo.click(); };
  archivo.onchange = function () {
    var f = archivo.files && archivo.files[0];
    if (!f) return;
    archivoAJpeg(f).then(function (b) { apagarCamara(); alSacar(b); }, function (e) { avisar(e.message); });
  };
  if (referencia) {
    urlFirmada(referencia).then(function (u) {
      var ref = document.getElementById('ref');
      if (u && ref) { ref.src = u; ref.hidden = false; }
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
    aJpeg(video, video.videoWidth, video.videoHeight).then(function (b) { apagarCamara(); alSacar(b); }, function (e) { avisar(e.message); });
  };

  /* Sin permiso o sin cámara adentro de la app: la del teléfono. */
  function sinCamara() {
    var g = document.querySelector('.guia span');
    if (g) g.textContent = 'Tocá el botón para abrir la cámara del teléfono';
    disparar.onclick = function () { archivo.click(); };
  }
}

function abrirCamara(c, estado) {
  camara(c.modulo_nombre, c.foto_referencia_path, 'Que entre todo el módulo en el recuadro',
    function (blob) { procesar(c, estado, blob); },
    function () { if (estado.url) abrirRevision(c, estado); else irA('fotos'); });
}

function procesar(c, estado, blob) {
  estado.intentos++;
  if (estado.url) URL.revokeObjectURL(estado.url);
  estado.url = URL.createObjectURL(blob);
  estado.blob = blob;
  estado.fotoId = null;
  estado.ruta = null;
  estado.resultado = null;
  mandarFoto(c, estado);
}

/* Sube, registra y pide la revisión. Si se corta la señal, "Reintentar"
   sigue desde donde quedó (la misma foto, sin subirla dos veces si ya subió). */
function mandarFoto(c, estado) {
  estado.resultado = { revisando: true };
  abrirRevision(c, estado);
  var subida = estado.ruta ? Promise.resolve(estado.ruta)
    : subirArchivo(c.local_id + '/' + hoyAR() + '/' + c.id + '/' + nombreArchivo(), estado.blob)
        .then(function (ruta) { estado.ruta = ruta; return ruta; });
  var paso = estado.fotoId ? Promise.resolve(estado.fotoId)
    : subida.then(function (ruta) { return llamar('orden_registrar_foto', { p_control: c.id, p_foto_path: ruta }); })
        .then(function (id) { estado.fotoId = id; return id; });
  paso.then(analizar).then(function (r) {
    estado.resultado = r || {};
    abrirRevision(c, estado);
  }).catch(function (e) {
    if (e && e.sinSesion) { pantallaError(e); return; }
    estado.resultado = { fallo: esDeRed(e) ? 'Sin señal: la foto no se pudo mandar. Quedó acá; tocá "Reintentar" cuando haya señal.' : mensajeDe(e) };
    abrirRevision(c, estado);
  });
}

function tarjetaRevision(r) {
  var hallazgos = Array.isArray(r.hallazgos) ? r.hallazgos : [];
  if (r.revisando) return '<div class="revision"><div class="revisando"><i class="ruedita"></i>Revisando la foto…</div></div>';
  if (r.fallo) return '<div class="revision mala"><div class="titulo">No se pudo mandar</div><div>' + esc(r.fallo) + '</div></div>';
  if (r.ia_activa === false) return '<div class="revision"><div class="titulo">Revisión automática apagada</div><div class="bajada" style="margin:0">La revisa tu supervisor.</div></div>';
  if (r.error_ia) return '<div class="revision"><div class="titulo">Revisión automática</div><div class="bajada" style="margin:0">' + esc(r.mensaje || 'No pudimos revisar la foto. Podés enviarla igual.') + '</div></div>';
  if (r.foto_valida === false) return '<div class="revision mala"><div class="titulo">Esta foto no sirve</div><div>' + esc(r.motivo || 'Sacala de nuevo, que se vea todo el módulo.') + '</div></div>';
  return '<div class="revision"><div class="titulo">Revisión automática' +
    (r.nivel ? '<span class="chip nivel-' + esc(r.nivel) + '">' + esc(r.nivel_texto || NIVEL[r.nivel] || '') + '</span>' : '') + '</div>' +
    (r.comentario ? '<div class="bajada" style="margin:0 0 6px">' + esc(r.comentario) + '</div>' : '') +
    (hallazgos.length
      ? hallazgos.map(function (h) {
          return '<div class="hallazgo ' + (h.gravedad === 'corregir' ? 'corregir' : 'sugerencia') + '"><b>' + esc(h.titulo) + '</b>' +
                 (h.detalle ? '<small>' + esc(h.detalle) + '</small>' : '') + '</div>';
        }).join('')
      : '<div class="bajada" style="margin:0">No encontró nada para corregir.</div>') +
    (r.tareas_resueltas ? '<div class="bajada" style="margin:8px 0 0">Se cerró sola ' + (r.tareas_resueltas === 1 ? '1 tarea' : r.tareas_resueltas + ' tareas') + ' que ya está bien.</div>' : '') +
    /* Qué hay (SQL 118): lo anotó en el croquis, o lo deja como sugerencia si lo había escrito alguien. */
    (r.que_hay && r.que_hay_estado === 'puesto' ? '<div class="bajada" style="margin:8px 0 0">En el croquis anotó qué hay: <b>' + esc(r.que_hay) + '</b>.</div>' : '') +
    (r.que_hay && r.que_hay_estado === 'sugerido' ? '<div class="bajada" style="margin:8px 0 0">Ve <b>' + esc(r.que_hay) + '</b>, y en el croquis dice otra cosa. Si cambió, en Fotos → Ver el local tocá el módulo y "Usar esto".</div>' : '') +
    '</div>';
}

function abrirRevision(c, estado) {
  barra.hidden = true;
  app.className = 'app';
  var r = estado.resultado || {};
  var preguntas = PREGUNTAS[c.sector_tipo] || PREGUNTAS.salon;
  var aCorregir = (Array.isArray(r.hallazgos) ? r.hallazgos : []).filter(function (h) { return h.gravedad === 'corregir'; });
  var invalida = r.foto_valida === false;
  var marcada = !invalida && aCorregir.length > 0;
  var listo = !r.revisando && !r.fallo;

  var html =
    '<button class="volver" id="volver">‹ Volver a Hoy</button>' +
    '<h1>' + esc(c.modulo_nombre) + '</h1>' +
    '<img class="foto-grande" src="' + esc(estado.url) + '" alt="La foto que sacaste">' +
    tarjetaRevision(r);

  if (!r.fallo) {
    html += '<div class="revision"><div class="titulo">Antes de enviar</div>' +
      preguntas.map(function (q) {
        var v = estado.respuestas[q[0]];
        return '<div class="pregunta"><span>' + esc(q[1]) + '</span><div class="sino">' +
          '<button class="si' + (v === true ? ' elegido' : '') + '" data-k="' + q[0] + '" data-v="1">Sí</button>' +
          '<button class="no' + (v === false ? ' elegido' : '') + '" data-k="' + q[0] + '" data-v="0">No</button></div></div>';
      }).join('') + '</div>';
  }

  html += '<div class="acciones">';
  if (r.revisando) {
    html += '<button class="boton lima" disabled>Esperá la revisión…</button>';
  } else if (r.fallo) {
    html += '<button class="boton lima" id="reintentar">Reintentar</button><button class="boton" id="repetir">Sacar otra foto</button>';
  } else if (marcada || invalida) {
    html += '<button class="boton lima" id="repetir">' + (invalida ? 'Sacar otra foto' : 'Corregí y sacá otra foto') + '</button>';
    if (estado.intentos >= 2) html += '<button class="boton" id="enviar">Enviar igual</button>';
  } else {
    html += '<button class="boton lima" id="enviar">Enviar</button><button class="boton" id="repetir">Repetir foto</button>';
  }
  html += '</div>';

  app.innerHTML = html;
  document.getElementById('volver').onclick = function () { if (estado.url) URL.revokeObjectURL(estado.url); irA('fotos'); };
  app.querySelectorAll('.sino button').forEach(function (b) {
    b.onclick = function () {
      estado.respuestas[b.dataset.k] = b.dataset.v === '1';
      b.parentNode.querySelectorAll('button').forEach(function (x) { x.classList.toggle('elegido', x === b); });
    };
  });
  var bRep = document.getElementById('repetir');
  if (bRep) bRep.onclick = function () { abrirCamara(c, estado); };
  var bRe = document.getElementById('reintentar');
  if (bRe) bRe.onclick = function () { mandarFoto(c, estado); };
  var bEnv = document.getElementById('enviar');
  if (bEnv && listo) unaVez(bEnv, function () { return enviarControl(c, estado, preguntas, bEnv); });
}

function enviarControl(c, estado, preguntas, boton) {
  var faltan = preguntas.filter(function (q) { return typeof estado.respuestas[q[0]] !== 'boolean'; });
  if (faltan.length) { avisar('Respondé las 4 preguntas antes de enviar.'); return; }
  boton.textContent = 'Enviando…';
  return llamar('orden_enviar_control', { p_control: c.id, p_respuestas: estado.respuestas }).then(function () {
    if (estado.url) URL.revokeObjectURL(estado.url);
    irA('fotos');
    avisar('¡Listo! Mandaste el ' + c.modulo_nombre + '.');
  }, function (e) {
    /* Si ya estaba enviado (se tocó dos veces, o se cortó la señal después de
       que llegara), es lo mismo que "listo". */
    if (/ya fue enviado/i.test(mensajeDe(e))) { irA('fotos'); avisar('Ese control ya estaba enviado.'); return; }
    throw e;
  });
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
  leer('/orden_v_tareas?select=id,titulo,detalle,origen,estado,vence_en,requiere_foto,prorroga_estado,local_id,completada_en' +
       '&persona_id=eq.' + id + '&or=(estado.in.(pendiente,vencida),completada_en.gte.' + semana + ')&order=vence_en.asc').then(function (r) {
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
    html += '<div class="tarea" data-id="' + esc(t.id) + '">' +
      '<small class="origen">' + esc(ORIGEN[t.origen] || '') + '</small>' +
      '<div class="nombre">' + esc(t.titulo) + '</div>' +
      (t.detalle ? '<div class="detalle">' + esc(t.detalle) + '</div>' : '') +
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
  var volver = esSupervision() ? '' : '<button class="volver" id="volverPerfil">‹ Volver</button>';
  app.innerHTML = volver + '<h1>Perfil</h1><p class="cargando">Cargando…</p>';
  var bv = document.getElementById('volverPerfil');
  if (bv) bv.onclick = volverDeAparte;
  var id = valor(per.id);
  Promise.all([
    esSupervision() ? Promise.resolve([]) :
      leer('/orden_v_persona_semana?select=semana,nivel_semana,controles,controles_a_tiempo,tareas,tareas_a_tiempo,desafio_puntaje,desafio_total' +
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
              (s.nivel_semana ? '<span class="chip nivel-' + esc(s.nivel_semana) + '">' + esc(NIVEL[s.nivel_semana]) + '</span>' : '<span class="chip pendiente">Sin fotos</span>') +
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
  sistema: { ventas_tarjeta: 'sis_tarjeta', ventas_mercado_pago: 'sis_mp', ventas_debito_go: 'sis_gocuotas', saldo_final_efectivo: 'sis_saldo_final_efvo' },
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
    leer('/orden_config?select=caja_tolerancia_pesos&local_id=eq.' + valor(yo().local_id)).then(function (f) {
      var v = f && f[0] ? Number(f[0].caja_tolerancia_pesos) : NaN;
      if (isFinite(v) && v >= 0) { _tolCaja = v; revisarFilasCaja(); }
    }).catch(function () {});
  }
  llamar('orden_caja_hoy').then(function (caja) {
    return leer('/orden_caja_fotos?select=tipo,ia_estado,ia_resultado&caja_id=eq.' + valor(caja.id) + '&order=tomada_en.desc')
      .then(function (f) { if (_pestana === 'caja') dibujarCaja(caja, f || []); });
  }).catch(function (e) { pantallaError(e, pantallaCaja); });
}

function dibujarCaja(caja, fotos) {
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

  var html = cabeza('Caja del ' + diaMes(caja.fecha)) +
    '<p class="bajada">' + (cerrada ? 'Tu supervisor ya la controló.' : 'Sacá las fotos del cierre: los números se cargan solos. Revisalos y escribí el efectivo que contaste.') + '</p>';
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
  engancharCabeza();

  app.querySelectorAll('.caja-fila input').forEach(function (i) { i.addEventListener('input', revisarFilasCaja); });
  revisarFilasCaja();
  var input = document.getElementById('fotoCaja');
  app.querySelectorAll('.foto-caja').forEach(function (b) {
    unaVez(b, function () { return fotoCaja(caja, b.dataset.tipo, input, b); });
  });
  var g = document.getElementById('guardarCaja');
  if (g) unaVez(g, function () { return guardarCaja(caja, g); });
}

function fotoCaja(caja, tipo, input, boton) {
  return new Promise(function (ok, mal) {
    input.value = '';
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (!f) { ok(); return; }
      boton.querySelector('.chip').textContent = 'Leyendo…';
      archivoAJpeg(f)
        .then(function (blob) { return subirArchivo(caja.local_id + '/cajas/' + caja.fecha + '/' + tipo + '-' + nombreArchivo(), blob); })
        .then(function (ruta) { return llamar('orden_caja_registrar_foto', { p_caja: caja.id, p_tipo: tipo, p_foto_path: ruta }); })
        .then(function (fotoId) { return llamarFuncion('leer-caja', { foto_id: fotoId }); })
        .then(function (r) {
          var lectura = r && r.ok ? r.lectura : null;
          if (lectura && lectura.foto_valida !== false) {
            var mapa = LECTURA_A_CAMPO[tipo] || {};
            Object.keys(mapa).forEach(function (k) {
              var campo = app.querySelector('[data-campo="' + mapa[k] + '"]');
              if (campo && lectura[k] != null) campo.value = lectura[k];
            });
            boton.querySelector('.chip').textContent = 'Leída';
            revisarFilasCaja();
            avisar('Listo: revisá los números que se cargaron.');
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

function guardarCaja(caja, boton) {
  var valores = {}, malo = null;
  app.querySelectorAll('[data-campo]').forEach(function (c) {
    var v = String(c.value || '').trim();
    if (v === '') { valores[c.dataset.campo] = null; return; }   // vacío: se borra (para corregir)
    var n = numeroCaja(v);
    if (n == null) malo = malo || c; else valores[c.dataset.campo] = String(n);
  });
  if (malo) { malo.focus(); avisar('Hay un monto que no se entiende: escribilo sólo con números.'); return; }
  if (!valores.real_efectivo) { avisar('Falta el efectivo que contaste.'); return; }
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
    return leer('/orden_v_por_revisar?select=id,modulo_nombre,persona_nombre,sector_tipo,tipo,foto_path,nivel_ia,nivel_declarado,respuestas,ia_resultado,discrepancia,enviado_en' +
                '&local_id=eq.' + valor(loc.id) + '&limit=60').then(function (cola) {
      if (_pestana !== 'revisar') return;
      dibujarRevisar(loc, cola || []);
    });
  }).catch(function (e) { pantallaError(e, pantallaRevisar); });
}

function dibujarRevisar(loc, cola) {
  if (_revisarSaltear >= cola.length) _revisarSaltear = 0;
  var c = cola[_revisarSaltear];
  var html = cabeza('Revisar', loc.nombre) + selectorLocal(loc);
  if (!c) {
    html += '<div class="vacio">No hay fotos para revisar.</div>';
    app.innerHTML = html; engancharCabeza(); engancharSelector(pantallaRevisar);
    return;
  }
  var ia = c.ia_resultado || {};
  var checks = (PREGUNTAS[c.sector_tipo] || PREGUNTAS.salon);
  html += '<p class="bajada">' + cola.length + (cola.length === 1 ? ' foto para revisar' : ' fotos para revisar') + (soloMira() ? ' (sólo mirar)' : '') + '</p>' +
    '<div class="revision"><div class="titulo">' + esc(c.modulo_nombre) + '<span class="chip pendiente">' + esc(c.persona_nombre || '') + '</span></div>' +
    '<div class="bajada" style="margin:0 0 8px">' + esc((c.tipo === 'sorpresa' ? 'Control sorpresa · ' : '') + 'Enviado ' + diaMes(c.enviado_en) + ' ' + hora(c.enviado_en)) + '</div>' +
    (c.foto_path ? '<img class="foto-grande" data-foto="' + esc(c.foto_path) + '" alt="La foto del módulo">' : '<div class="vacio">Sin foto</div>') +
    (c.discrepancia ? '<div class="nota alerta">Lo que respondió no coincide con lo que vio la IA: miralo con atención.</div>' : '') +
    '<div class="info" style="margin:10px 0">' +
      (c.nivel_ia ? '<span class="chip nivel-' + esc(c.nivel_ia) + '">IA: ' + esc(NIVEL[c.nivel_ia]) + '</span>' : '<span class="chip pendiente">Sin revisión de la IA</span>') +
      (c.nivel_declarado ? '<span class="chip nivel-' + esc(c.nivel_declarado) + '">Según él: ' + esc(NIVEL[c.nivel_declarado]) + '</span>' : '') + '</div>' +
    checks.map(function (q) {
      var dijo = c.respuestas ? c.respuestas[q[0]] : null, vio = ia.checks ? ia.checks[q[0]] : null;
      return '<div class="pregunta"><span>' + esc(CHECK[q[0]]) + '</span><div class="info">' +
        '<span class="chip ' + (dijo === true ? 'listo' : dijo === false ? 'vencido' : 'pendiente') + '">' + (dijo === true ? 'Dijo sí' : dijo === false ? 'Dijo no' : '—') + '</span>' +
        (vio ? '<span class="chip ' + (vio === 'ok' ? 'listo' : vio === 'mal' ? 'vencido' : 'pendiente') + '">IA: ' + (vio === 'ok' ? 'bien' : vio === 'mal' ? 'mal' : 'no se ve') + '</span>' : '') +
        '</div></div>';
    }).join('') +
    ((ia.hallazgos || []).length ? ia.hallazgos.map(function (h) {
      return '<div class="hallazgo ' + (h.gravedad === 'corregir' ? 'corregir' : 'sugerencia') + '"><b>' + esc(h.titulo) + '</b>' + (h.detalle ? '<small>' + esc(h.detalle) + '</small>' : '') + '</div>';
    }).join('') : '') +
    '</div>';
  if (!soloMira()) {
    html += '<label class="campo"><span>Comentario (obligatorio si cambiás más de un nivel)</span><textarea id="coment" rows="2"></textarea></label>' +
      '<div class="niveles">' + ['impecable', 'bien', 'a_mejorar', 'fuera_de_estandar'].map(function (n) {
        return '<button class="boton nivel nivel-' + n + '" data-nivel="' + n + '">' + NIVEL[n] + '</button>';
      }).join('') + '</div>';
  }
  if (cola.length > 1) html += '<button class="boton" id="saltear" style="margin-top:10px">Ver la siguiente</button>';
  app.innerHTML = html;
  engancharCabeza();
  engancharSelector(function () { _revisarSaltear = 0; pantallaRevisar(); });
  cargarFotos(app);
  var s = document.getElementById('saltear');
  if (s) s.onclick = function () { _revisarSaltear++; dibujarRevisar(loc, cola); };
  var niveles = app.querySelectorAll('[data-nivel]');
  niveles.forEach(function (b) {
    unaVez(b, function () {
      /* Uno a la vez: dos niveles tocados casi juntos dejaban un nivel y avisaban otro. */
      niveles.forEach(function (x) { x.disabled = true; });
      return llamar('orden_revisar_control', { p_control: c.id, p_nivel: b.dataset.nivel, p_comentario: document.getElementById('coment').value || null })
        .then(function () { avisar(c.modulo_nombre + ': ' + NIVEL[b.dataset.nivel]); pantallaRevisar(); },
              function (e) { niveles.forEach(function (x) { x.disabled = false; }); throw e; });
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
      leer('/orden_v_persona_semana?select=persona_id,semana,controles,controles_a_tiempo,nivel_semana,tareas,tareas_a_tiempo,tareas_fuera_de_plazo,desafio_puntaje,desafio_total' +
           '&local_id=eq.' + L + '&semana=gte.' + desde),
      leer('/orden_controles?select=persona_id&local_id=eq.' + L + '&estado=eq.pendiente&fecha=eq.' + hoyAR()),
      leer('/orden_v_tareas?select=id,titulo,persona_nombre,prorroga_motivo,vence_en&local_id=eq.' + L + '&prorroga_estado=eq.pedida&estado=in.(pendiente,vencida)'),
      leer('/orden_faltas?select=id,persona_id,tipo,motivo,creado_en&local_id=eq.' + L + '&estado=eq.sugerida&order=creado_en.desc'),
      leer('/orden_v_tareas?select=id,titulo,persona_nombre,origen,vence_en,estado&local_id=eq.' + L + '&estado=in.(pendiente,vencida)&order=vence_en.asc&limit=40'),
      /* Los supervisores de varios locales y lo que esperan (SQL 120; sin él, nada). */
      esAdmin() ? llamar('orden_supervision_lista').catch(function () { return []; }) : Promise.resolve([])
    ]).then(function (r) {
      if (_pestana !== 'equipo') return;
      /* Esperan el OK los que ya entraron (crearon su PIN) o se anotaron solos.
         Los que todavía no entraron siguen en el equipo como siempre. */
      var todos = r[0] || [];
      var espera = function (p) { return p.aprobado === false && (!!p.auth_user_id || !!p.alta_propia); };
      dibujarEquipo(loc, { gente: todos.filter(function (p) { return !espera(p); }), esperan: todos.filter(espera),
                           semanas: r[1] || [], pendientes: r[2] || [], prorrogas: r[3] || [], faltas: r[4] || [], tareas: r[5] || [],
                           supervisores: Array.isArray(r[6]) ? r[6] : [] });
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

  /* Supervisores y administración sin local (SQL 120): su PIN y los locales que piden, para aprobar. No son de
     este local: se ven en cualquiera. */
  var sups = x.supervisores || [];
  var esperanSup = sups.filter(function (p) { return (p.aprobado === false && p.entro) || (p.locales || []).some(function (l) { return !l.aprobado; }); });
  if (esperanSup.length && !mira) {
    html += '<div class="seccion">Supervisores: esperan tu OK</div>' + esperanSup.map(function (p) {
      var nom = p.nombre + (p.apellido ? ' ' + p.apellido : ''), pend = (p.locales || []).filter(function (l) { return !l.aprobado; });
      var datos = ' data-aprobar="' + esc(p.id) + '" data-nombre="' + esc(p.nombre) + '" data-nuevo="0"';
      var sup = ' data-sup="' + esc(p.id) + '" data-nombre="' + esc(p.nombre) + '"';
      return '<div class="tarea"><div class="nombre">' + esc(nom) + (p.rol && p.rol !== 'supervisor' ? ' · ' + esc(ROL[p.rol] || p.rol) : '') + '</div>' +
        (p.aprobado === false && p.entro
          ? '<div class="detalle">Creó su PIN. Confirmá en persona que fue quien lo creó.</div><div class="botones">' +
            '<button class="boton lima chico"' + datos + ' data-si="1">Sí, fue</button><button class="boton chico"' + datos + ' data-si="0">No fue</button></div>' : '') +
        (pend.length ? '<div class="detalle">Pide ver estos locales:</div>' + pend.map(function (l) {
            return '<div class="fila"><span>' + esc(l.nombre) + '</span><span class="botones"><button class="boton lima chico"' + sup + ' data-sup-local="' + esc(l.id) + '" data-si="1">Sí</button>' +
              '<button class="boton chico"' + sup + ' data-sup-local="' + esc(l.id) + '" data-si="0">No</button></span></div>';
          }).join('') + (pend.length > 1 ? '<div class="botones"><button class="boton lima chico"' + sup + ' data-sup-local="" data-si="1">Aprobar los ' + pend.length + '</button></div>' : '') : '') +
        '</div>';
    }).join('');
  }

  /* Por vendedor: se suman las semanas del período. */
  var tot = {};
  x.semanas.forEach(function (s) {
    var t = tot[s.persona_id] || (tot[s.persona_id] = { controles: 0, a_tiempo: 0, tareas: 0, tareas_ok: 0, fuera: 0, des: 0, desT: 0, nivel: null, semana: '' });
    t.controles += s.controles; t.a_tiempo += s.controles_a_tiempo; t.tareas += s.tareas; t.tareas_ok += s.tareas_a_tiempo;
    t.fuera += s.tareas_fuera_de_plazo; t.des += s.desafio_puntaje || 0; t.desT += s.desafio_total || 0;
    if (s.semana >= t.semana) { t.semana = s.semana; t.nivel = s.nivel_semana; }
  });
  html += '<div class="seccion">Por vendedor</div>';
  if (!x.gente.length) html += '<div class="vacio">Todavía no hay vendedores en este local.</div>';
  html += x.gente.map(function (p) {
    var t = tot[p.id] || { controles: 0, a_tiempo: 0, tareas: 0, tareas_ok: 0, des: 0, desT: 0, nivel: null };
    return '<div class="fila"><span><b>' + esc(nombres[p.id]) + '</b>' + (p.aprobado ? ' <button class="boton chico ver-app" data-ver="' + esc(p.id) + '">Ver su app</button>' : '') + '</span>' +
      (t.nivel ? '<span class="chip nivel-' + esc(t.nivel) + '">' + esc(NIVEL[t.nivel]) + '</span>' : '<span class="chip pendiente">Sin fotos</span>') +
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

  /* Todos los supervisores de varios locales, con lo que ven (tocar un local se lo saca). */
  var supsLista = sups.filter(function (p) { return p.rol === 'supervisor'; });
  if (supsLista.length) {
    html += '<div class="seccion">Supervisores</div>' + supsLista.map(function (p) {
      var ve = (p.locales || []).filter(function (l) { return l.aprobado; });
      return '<div class="tarea"><div class="nombre">' + esc(p.nombre + (p.apellido ? ' ' + p.apellido : '')) + '</div>' +
        (ve.length ? '<div class="botones">' + ve.map(function (l) {
            return mira ? '<span class="chip listo">' + esc(l.nombre) + '</span>'
              : '<button class="boton chico" data-sup="' + esc(p.id) + '" data-nombre="' + esc(p.nombre) + '" data-sup-local="' + esc(l.id) + '" data-local-nombre="' + esc(l.nombre) + '" data-si="0" data-sacar="1">' + esc(l.nombre) + ' ×</button>';
          }).join('') + '</div>'
          : '<div class="detalle">' + (!p.entro ? 'Todavía no entró a la app.' : (p.locales || []).length ? 'Esperan tu OK sus locales.' : 'Todavía no eligió sus locales.') + '</div>') + '</div>';
    }).join('');
  }

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
  app.querySelectorAll('[data-sup]').forEach(function (b) {
    unaVez(b, function () {
      var si = b.dataset.si === '1', local = b.dataset.supLocal || null, nombre = b.dataset.nombre;
      return (b.dataset.sacar ? confirmar('¿Sacarle ' + b.dataset.localNombre + ' a ' + nombre + '? Deja de verlo.') : Promise.resolve(true)).then(function (seguro) {
        if (!seguro) return;
        return llamar('orden_supervision_aprobar', { p_persona: b.dataset.sup, p_local: local, p_aprobar: si }).then(function () {
          avisar(si ? 'Listo: ' + nombre + ' ya lo ve.' : b.dataset.sacar ? 'Listo: ' + nombre + ' ya no lo ve.' : 'Listo: no se lo aprobaste.');
          pantallaEquipo();
        });
      });
    });
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
    '<label class="check"><input type="checkbox" id="pideFoto"> Pide foto al terminarla</label>' +
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
      return '<div class="fila"><span>' + f[0] + '</span><span>' + pesos(c[f[1]]) + '</span><span>' + pesos(c[f[2]]) + '</span><span class="' + (Math.abs(d) > 0.5 ? 'rojo' : '') + '">' + pesos(d) + '</span></div>';
    }).join('') + '</div>' +
    ((c.alertas || []).length ? '<div class="revision mala"><div class="titulo">Alertas</div>' + c.alertas.map(function (a) { return '<div>' + esc(textoAlerta(a)) + '</div>'; }).join('') + '</div>' : '') +
    (c.observaciones ? '<div class="nota">' + esc(c.observaciones) + '</div>' : '');
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
  if (c.estado === 'controlada') {
    html += '<div class="nota">Controlada' + (c.controlada_por_nombre ? ' por ' + esc(c.controlada_por_nombre) : '') + (c.nota_control ? ': ' + esc(c.nota_control) : '.') + '</div>';
  } else if (c.estado === 'cargada' && !soloMira()) {
    html += '<label class="campo"><span>' + ((c.alertas || []).length ? 'Qué pasó (obligatorio: tiene alertas)' : 'Nota (opcional)') + '</span><textarea id="notaCaja" rows="2"></textarea></label>' +
      '<button class="boton lima" id="controlar">Dar por controlada</button>';
  }
  app.innerHTML = html;
  cargarFotos(app);
  document.getElementById('volver').onclick = function () { irA('cajas'); };
  var b = document.getElementById('controlar');
  if (b) unaVez(b, function () {
    var nota = document.getElementById('notaCaja').value;
    if ((c.alertas || []).length && !String(nota).trim()) { avisar('Tiene alertas: escribí qué pasó.'); return; }
    return llamar('orden_caja_controlar', { p_caja: c.id, p_nota: nota || null }).then(function () { avisar('Caja controlada.'); irA('cajas'); });
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
llamar = function (nombre, args) {
  if (!_espejo) return _llamarReal(nombre, args);
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
    dondeAsignar: 'se asigna desde la computadora (No Compra → Equipo VDH → Por local)',
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
/* Lo escrito y todavía sin guardar, por producto: sobrevive a ir a grabar un video. */
var _borradorTestigo = {};

/** La tarjeta de Hoy: mañana, hoy o atrasado. */
function tarjetaTestigoHoy(s) {
  if (!s) return '';
  var hoy = hoyAR(), n = (s.testigo_items || []).length;
  var lista = (s.testigo_items || []).slice().sort(function (a, b) { return a.item - b.item; })
    .map(function (i) { return i.producto + (i.color ? ' ' + i.color : ''); }).join(', ');
  var titulo = s.fecha > hoy ? 'Mañana tienen producto testigo' : s.fecha === hoy ? 'Hoy: producto testigo' : 'Producto testigo sin mandar';
  var texto = s.fecha > hoy ? lista
    : s.fecha === hoy ? (n === 1 ? '1 producto' : n + ' productos') + ': copiá los números del sistema, contá y grabá un video de cada uno.'
    : 'Era del ' + diaYFecha(s.fecha) + '. Cargalo y mandalo.';
  return '<button class="tarjeta-accion testigo' + (s.fecha < hoy ? ' alerta' : '') + '" id="irTestigo"><b>' + esc(titulo) + '</b><span>' + esc(texto) + '</span></button>';
}

function pantallaTestigo(semId) {
  apagarCamara();
  barra.hidden = true;
  app.className = 'app';
  app.innerHTML = '<p class="cargando">Cargando…</p>';
  var per = yo(), hoy = hoyAR();
  var buscar = semId
    ? leer('/testigo_semanas?select=*&id=eq.' + valor(semId))
    : leer('/testigo_semanas?select=*&local_id=eq.' + valor(per.local_id) + '&fecha=lte.' + sumarDias(hoy, 1) + '&fecha=gte.' + sumarDias(hoy, -6) +
           '&cerrada=is.false&order=cargada_en.desc.nullsfirst,fecha.desc&limit=1');
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
  /* El vendedor carga desde el día del control, durante una semana, hasta mandarla. Después la corrige el supervisor. */
  var hoy = hoyAR(), antes = !!(sem.fecha && sem.fecha > hoy), cerro = !!(sem.fecha && sumarDias(sem.fecha, 6) < hoy);
  var bloqueado = antes || sem.cerrada || !!sem.cargada_en || cerro || !sem.fecha;
  var html = '<button class="volver" id="volver">‹ Volver a Hoy</button><h1>Producto testigo</h1>' +
    '<p class="bajada">' + (sem.fecha ? esc(diaYFecha(sem.fecha)).replace(/^./, function (c) { return c.toUpperCase(); }) + ' · ' : '') +
    'Copiá los números del sistema, contá lo que hay y grabá un video cortito de cada producto.</p>';
  if (antes) html += '<div class="nota">Se carga el ' + esc(diaYFecha(sem.fecha)) + '. Mientras, ya podés ver qué productos son.</div>';
  else if (sem.cerrada) html += '<div class="nota">Esta semana ya está cerrada.</div>';
  else if (sem.cargada_en) html += '<div class="nota">Ya la mandaron el ' + esc(diaMes(sem.cargada_en)) + ' a las ' + esc(hora(sem.cargada_en)) + '. Si hay que corregir algo, avisale a tu supervisor.</div>';
  else if (cerro || !sem.fecha) html += '<div class="nota">Este control ya cerró' + (sem.fecha ? ' (era del ' + esc(diaYFecha(sem.fecha)) + ')' : '') + '. Si hay que cargar algo, avisale a tu supervisor.</div>';
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
    '<div class="ti-cab"><b>' + esc(it.item + ' · ' + it.producto) + '</b>' + (it.color ? '<span class="chip pendiente">' + esc(it.color) + '</span>' : '') + '</div>' +
    '<div class="ti-grilla">' + CAMPOS_TESTIGO.map(function (c) {
      return '<label class="campo"><span>' + esc(c[1]) + '</span><input inputmode="numeric" maxlength="5" autocomplete="off" data-k="' + c[0] + '" value="' + esc(val(c[0])) + '"' + (bloqueado ? ' disabled' : '') + '></label>';
    }).join('') + '</div>' +
    '<label class="campo"><span>Observaciones</span><input maxlength="300" autocomplete="off" data-k="observacion" value="' + esc(val('observacion')) + '"' + (bloqueado ? ' disabled' : '') + '></label>' +
    '<div class="ti-res" data-res></div>' +
    (bloqueado ? '' : '<button class="boton chico' + (conVideo ? '' : ' lima') + '" data-video>' + (conVideo ? 'Video listo ✓ · Grabar de nuevo' : 'Grabar el video (hasta 20 s)') + '</button>') +
    '</div>';
}

/** Diferencia y desvío mientras escriben, como en la planilla. */
function resultadoTestigo(card) {
  var n = function (k) { var v = String((card.querySelector('[data-k="' + k + '"]') || {}).value || '').trim(); return /^\d{1,5}$/.test(v) ? Number(v) : null; };
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
      var k = inp.dataset.k, v = String(inp.value || '').trim();
      datos[k] = v;
      if (v !== String(it[k] == null ? '' : it[k])) distinto = true;
      if (k !== 'observacion' && v !== '' && !/^\d{1,5}$/.test(v) && !malo) {
        malo = it.producto + ': en "' + CAMPOS_TESTIGO.filter(function (c) { return c[0] === k; })[0][1] + '" va un número entero.';
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

/* ---------- El video: hasta 20 segundos, liviano (640×480), sin sonido ---------- */

var _grabador = null;

function tipoGrabable() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return null;
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm'].filter(function (t) {
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
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
    .then(function (s) {
      if (!document.getElementById('video')) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      _stream = s;
      video.srcObject = s;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
    }).catch(sinGrabar);
  grabar.onclick = function () {
    if (_grabador) { if (_grabador.state === 'recording') _grabador.stop(); return; }
    if (!_stream) { archivo.click(); return; }
    var partes = [], seg = 20, rec;
    try { rec = new MediaRecorder(_stream, { mimeType: tipo, videoBitsPerSecond: 900000 }); } catch (e) { sinGrabar(); return; }
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
