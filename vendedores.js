/**
 * Impecable · la app de los vendedores (y del supervisor del local).
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
    '<p class="marca"><b>' + NOMBRE_APP + '</b> VDH</p>' +
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

function preguntarTexto(titulo) {
  var t = window.prompt(titulo);
  return t == null ? null : String(t).trim();
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
      '<p class="marca"><b>' + NOMBRE_APP + '</b> VDH</p>' +
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

function pantallaPin(local, persona, extra) {
  var pin = '';
  var ocupado = false;
  var crear = !!persona.nuevo;   // todavía no tiene PIN: lo crea, poniéndolo dos veces
  var primero = null;
  var primerNombre = String(persona.nombre).split(' ')[0];
  app.innerHTML =
    '<button class="volver" id="volver">‹ ' + (extra.alta ? 'Volver' : 'No soy ' + esc(primerNombre)) + '</button>' +
    '<h1 id="tituloPin"></h1>' +
    '<p class="bajada" id="bajadaPin"></p>' +
    '<div class="puntos" id="puntos"><i class="punto"></i><i class="punto"></i><i class="punto"></i><i class="punto"></i></div>' +
    '<p class="aviso-pin" id="avisoPin"></p>' +
    '<div class="teclado" id="teclado">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button class="tecla" data-n="' + n + '">' + n + '</button>'; }).join('') +
      '<button class="tecla vacia" tabindex="-1" aria-hidden="true"></button>' +
      '<button class="tecla" data-n="0">0</button>' +
      '<button class="tecla borrar" data-n="x" aria-label="Borrar">⌫</button>' +
    '</div>';
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
      !crear ? 'Poné tu PIN de 4 números. Te lo pide una sola vez en este celular.'
      : (primero === null ? 'Hola, ' + primerNombre + '. Elegí 4 números que te acuerdes: es tu PIN para entrar.'
                          : 'Poné los mismos 4 números otra vez.');
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
      else if (pin.length < 4) { pin += t.dataset.n; }
      aviso.textContent = '';
      dibujar();
      if (pin.length < 4) return;
      if (crear && primero === null) { primero = pin; pin = ''; dibujar(); textos(); return; }
      if (crear && pin !== primero) { primero = null; textos(); mal('No coinciden. Empezá de nuevo.'); return; }
      mandar();
    };
  });
}

/* ════════════════════════════════════════════════════════════════════════
   ADENTRO: LA BARRA Y LAS PESTAÑAS
   ════════════════════════════════════════════════════════════════════════ */

var ICONO = {
  hoy: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/>',
  tareas: '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h9"/>',
  ideas: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  revisar: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><path d="M9 14l2 2 4-4"/>',
  equipo: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  cajas: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>'
};
ICONO.caja = ICONO.cajas;
var PESTANAS_SUPERVISION = [['revisar', 'Revisar'], ['equipo', 'Equipo'], ['cajas', 'Cajas'], ['ideas', 'Ideas'], ['perfil', 'Perfil']];
var _pestana = 'hoy';

/* La Caja es una pestaña más del vendedor, sólo en los locales con el control
   de caja prendido (se recuerda en el teléfono para armar la barra enseguida). */
var K_CAJA = 'vdh_vend_caja_activa';
function cajaActiva() { try { return !!yo().local_id && localStorage.getItem(K_CAJA) === yo().local_id; } catch (e) { return false; } }
function pestanasVendedor() {
  return [['hoy', 'Hoy'], ['tareas', 'Tareas']].concat(cajaActiva() ? [['caja', 'Caja']] : []).concat([['ideas', 'Ideas'], ['perfil', 'Perfil']]);
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
  marcarPestana(p);
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  if (p === 'hoy') pantallaHoy();
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
function entrarApp(recien) {
  if (yo().rol === 'atencion') { pantallaSinImpecable(); return; }
  if (yo().aprobado === false) { pantallaEspera(); return; }
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
   sesión), pero Impecable es de los locales: no ve nada de acá. */
function pantallaSinImpecable() {
  barra.hidden = true;
  app.className = 'app';
  app.innerHTML = '<p class="marca"><b>' + NOMBRE_APP + '</b> VDH</p><h1>Sin acceso a Impecable</h1>' +
    '<p class="bajada">Hola, ' + esc(primerNombre()) + '. Tu usuario es de Atención al cliente: Impecable es para los locales. Lo tuyo está en el No Compra.</p>' +
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
    '<button class="boton" id="salirEspera" style="margin-top:10px">No soy yo</button>';
  document.getElementById('salirEspera').onclick = preguntarSalir;
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
function irPorEnlace() {
  var h = String(location.hash || '').replace(/^#\/?/, '');
  if (!h) return false;
  var mapa = { hoy: 'hoy', tareas: 'tareas', caja: 'caja', ideas: 'ideas', perfil: 'perfil', historial: 'perfil',
               revisar: 'revisar', equipo: 'equipo', faltas: 'equipo', cajas: 'cajas' };
  if (h === 'desafio' && !esSupervision()) { marcarPestana('hoy'); abrirDesafio(); return true; }
  if (h === 'testigo' && !esSupervision()) { marcarPestana('hoy'); pantallaTestigo(); return true; }
  if ((h === 'admin' || h === 'admin-testigo') && esSupervision()) { location.replace('impecable-admin.html' + (h === 'admin-testigo' ? '#testigo' : '')); return true; }
  var p = mapa[h];
  if (!p || (esSupervision() ? ['hoy', 'tareas', 'caja'].indexOf(p) > -1 : ['revisar', 'equipo', 'cajas'].indexOf(p) > -1)) return false;
  irA(p);
  return true;
}

function adentro() {
  barra.hidden = false;
  app.className = 'app con-barra';
}

function cabeza(titulo, debajo) {
  var per = yo();
  return '<div class="cabeza"><div>' +
    '<h1>' + esc(titulo) + '</h1>' +
    '<p class="bajada" style="margin:0">' + esc(debajo != null ? debajo : [per.local, fechaLarga()].filter(Boolean).join(' · ')) + '</p>' +
    '</div><button class="noesyo" id="noesyo">No soy yo</button></div>';
}

function engancharNoSoyYo() {
  var b = document.getElementById('noesyo');
  if (b) b.onclick = preguntarSalir;
}

function preguntarSalir() {
  var nombre = String(yo().nombre || '').split(' ')[0];
  if (!confirm('¿No sos ' + nombre + '? Se cierra la sesión y para volver a entrar hace falta el PIN.')) return;
  /* Las notificaciones de este celular dejan de llegarle a esa persona: si
     no, el próximo que entre recibiría las de otro. */
  soltarAvisos().then(function () {
    cerrarSesion();
    barra.innerHTML = '';
    pantallaLocales();
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
  engancharNoSoyYo();

  var hoy = hoyAR();
  var id = valor(per.id);
  var nada = function () { return null; };
  Promise.all([
    /* Lo de hoy y lo que quedó pendiente (el depósito vence el viernes). */
    leer('/orden_v_controles?select=id,local_id,modulo_id,modulo_numero,modulo_nombre,foto_referencia_path,sector_tipo,tipo,estado,vence_en,nivel' +
         '&persona_id=eq.' + id + '&tipo=neq.correccion&or=(fecha.eq.' + hoy + ',estado.eq.pendiente)' +
         '&order=sector_tipo.asc,modulo_numero.asc'),
    leer('/orden_v_persona_semana?select=nivel_semana,controles&persona_id=eq.' + id + '&semana=eq.' + lunesAR()),
    /* Lo que la IA marcó y está sin corregir: ese módulo dice "Corregir". */
    leer('/orden_tareas?select=modulo_id&persona_id=eq.' + id + '&estado=eq.pendiente&origen=eq.ia'),
    /* Las extras no frenan Hoy si fallan. */
    leer('/orden_sectores?select=id&or=(responsable_id.eq.' + id + ',suplente_id.eq.' + id + ')&limit=1').catch(nada),
    llamar('orden_desafio_mio').catch(nada),
    Promise.resolve(null),   // (la caja pasó a ser una pestaña: la mira revisarCaja)
    leer('/orden_tareas?select=id&persona_id=eq.' + id + '&estado=in.(pendiente,vencida)').catch(nada),
    estadoAvisos().catch(function () { return 'no-soportado'; }),
    /* SQL 99: lo que hay que acordarse hoy (martes entra mercadería…). */
    per.local_id ? leer('/orden_recordatorios?select=texto&local_id=eq.' + valor(per.local_id) + '&dia=eq.' + diaSemanaAR() + '&activo=is.true&order=creado_en.asc').catch(nada) : Promise.resolve(null),
    /* SQL 99: el croquis del local, con lo de cada uno marcado. */
    per.local_id ? cargarMapa(per.local_id).catch(nada) : Promise.resolve(null),
    /* SQL 102: producto testigo de mañana, de hoy o atrasado (sin mandar). */
    per.local_id ? leer('/testigo_semanas?select=id,fecha,cargada_en,testigo_items(item,producto,color)&local_id=eq.' + valor(per.local_id) +
                        '&fecha=gte.' + sumarDias(hoy, -6) + '&fecha=lte.' + sumarDias(hoy, 1) + '&cargada_en=is.null&cerrada=is.false&order=fecha.asc').catch(nada)
                 : Promise.resolve(null)
  ]).then(function (r) {
    if (_pestana !== 'hoy') return;
    dibujarHoy({
      controles: r[0] || [], semana: (r[1] || [])[0], tareasIA: r[2] || [],
      sinModulos: Array.isArray(r[3]) && r[3].length === 0, desafio: r[4],
      tareas: (r[6] || []).length, avisos: r[7], recordatorios: r[8] || [], mapa: r[9],
      testigo: (r[10] || []).filter(function (s) { return (s.testigo_items || []).length; })[0] || null
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

function dibujarHoy(x) {
  var corregir = {};
  x.tareasIA.forEach(function (t) { if (t.modulo_id) corregir[t.modulo_id] = true; });
  _controles = {};
  x.controles.forEach(function (c) { _controles[c.id] = c; });

  var total = x.controles.length;
  var hechos = x.controles.filter(function (c) { return c.estado === 'enviado' || c.estado === 'revisado'; }).length;
  var nivel = x.semana && x.semana.nivel_semana ? NIVEL[x.semana.nivel_semana] : null;

  var html = cabeza('Hola, ' + primerNombre()) + bannerAvisos(x.avisos) +
    (x.recordatorios || []).map(function (t) {
      return '<div class="recordatorio"><b>' + esc(DIAS_SEMANA[diaSemanaAR() - 1]) + '</b>' + esc(t.texto) + '</div>';
    }).join('') + tarjetaTestigoHoy(x.testigo);

  html += '<div class="resumen">' +
    (total
      ? '<div class="grande">' + hechos + ' de ' + total + ' controles</div>' +
        '<div class="progreso"><i style="width:' + Math.round(100 * hechos / total) + '%"></i></div>'
      : '<div class="grande">Hoy no tenés controles</div><div class="progreso"><i style="width:100%"></i></div>') +
    '<div class="chico">' + (nivel ? 'Tu orden esta semana: ' + esc(nivel) : 'Tu orden esta semana: todavía sin fotos') + '</div>' +
    '</div>';

  /* El croquis del local: lo tuyo con tu color, lo demás apagado. Tocás un
     módulo con la cámara y mandás su foto. */
  var mapa = x.mapa, mios = {}, marcas = {};
  if (mapa && mapa.pared.length + mapa.islas.length + mapa.dep.length) {
    /* Si un módulo tiene dos controles (el del día y una sorpresa), manda lo que falta hacer. */
    var PESO = { corregir: 5, sorpresa: 4, pendiente: 3, vencido: 2, listo: 1 };
    x.controles.forEach(function (c) {
      var e = estadoDe(c, corregir);
      var marca = e.hecho ? (c.estado === 'vencido' ? 'vencido' : 'listo') : e.clase === 'corregir' ? 'corregir' : e.clase === 'sorpresa' ? 'sorpresa' : 'pendiente';
      if (!marcas[c.modulo_id] || PESO[marca] > PESO[marcas[c.modulo_id]]) marcas[c.modulo_id] = marca;
      mios[c.modulo_id] = true;
    });
    var yoId = yo().id;
    mapa.modulos.forEach(function (m) { var s = mapa.sectorDe[m.sector_id]; if (s && s.responsable_id === yoId) mios[m.id] = true; });
    var hayMios = Object.keys(mios).length;
    html += '<div class="seccion">Tu parte del local</div><div class="mapa-caja" id="mapaHoy">' +
      svgMapa(mapa, { mios: hayMios ? mios : null, marcas: marcas }) + svgDeposito(mapa, { mios: hayMios ? mios : null, marcas: marcas }) + '</div>' + leyendaNombres(mapa) +
      '<p class="bajada">' + (total ? 'Tocá un módulo con la cámara para mandar su foto. Los que tienen ✓ ya están.'
                                    : hayMios ? 'Lo tuyo está marcado con tu color.' : 'Todavía no tenés módulos asignados: tocá uno para ver de quién es.') + '</p>';
  }

  if (x.sinModulos && !total) {
    html += '<div class="nota">Todavía no tenés módulos asignados. Cuando tu supervisor te los asigne, tus controles aparecen acá.</div>';
  }

  var d = x.desafio;
  if (d && !d.terminado_en && new Date(d.vence_en) > new Date()) {
    var faltan = (d.preguntas || []).filter(function (q) { return !q.respondida; }).length;
    html += '<button class="tarjeta-accion" id="desafio"><b>Tu desafío de la semana</b><span>' +
      (faltan === d.total ? d.total + ' preguntas rápidas. Si le errás, no pasa nada.' : 'Te quedan ' + faltan + ' preguntas.') + '</span></button>';
  } else if (d && d.terminado_en && d.semana === lunesAR()) {
    html += '<div class="nota">Desafío de la semana: acertaste ' + d.puntaje + ' de ' + d.total + '.</div>';
  }
  if (x.tareas) {
    html += '<button class="tarjeta-accion" id="irTareas"><b>' + (x.tareas === 1 ? 'Tenés 1 tarea' : 'Tenés ' + x.tareas + ' tareas') + '</b><span>Tocá para verlas.</span></button>';
  }
  [['salon', 'En lista'], ['deposito', 'Depósito']].forEach(function (g) {
    var lista = x.controles.filter(function (c) { return c.sector_tipo === g[0]; });
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

  if (!total && !x.sinModulos) {
    html += '<div class="vacio">Cuando te toque un control, aparece acá y te llega un aviso.</div>';
  }

  app.innerHTML = html;
  engancharNoSoyYo();
  var b;
  if ((b = document.getElementById('banner'))) b.onclick = function () { pantallaBienvenida(pantallaHoy); };
  if ((b = document.getElementById('desafio'))) b.onclick = function () { pantallaDesafio(d); };
  if ((b = document.getElementById('irTareas'))) b.onclick = function () { irA('tareas'); };
  if ((b = document.getElementById('irTestigo'))) b.onclick = function () { pantallaTestigo(x.testigo.id); };
  app.querySelectorAll('.camara').forEach(function (bt) {
    bt.onclick = function () { pantallaFoto(_controles[bt.dataset.id]); };
  });
  /* Tocar el croquis: si ese módulo tiene tu control pendiente, la cámara; si no, de quién es. */
  app.querySelectorAll('#mapaHoy .mapa-mod').forEach(function (g) {
    g.onclick = function () {
      var suyos = x.controles.filter(function (k) { return k.modulo_id === g.dataset.mod; });
      var falta = suyos.filter(function (k) { return !estadoDe(k, corregir).hecho; })[0];
      if (falta) { pantallaFoto(falta); return; }
      var m = mapa.modulos.filter(function (k) { return k.id === g.dataset.mod; })[0], s = m && mapa.sectorDe[m.sector_id];
      var quien = s && mapa.persona[s.responsable_id];
      var que = nombreModulo(m, s);
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
  if (!c) { pantallaHoy(); return; }
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
    function () { if (estado.url) abrirRevision(c, estado); else pantallaHoy(); });
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
  document.getElementById('volver').onclick = function () { if (estado.url) URL.revokeObjectURL(estado.url); pantallaHoy(); };
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
    pantallaHoy();
    avisar('¡Listo! Mandaste el ' + c.modulo_nombre + '.');
  }, function (e) {
    /* Si ya estaba enviado (se tocó dos veces, o se cortó la señal después de
       que llegara), es lo mismo que "listo". */
    if (/ya fue enviado/i.test(mensajeDe(e))) { pantallaHoy(); avisar('Ese control ya estaba enviado.'); return; }
    throw e;
  });
}

/* ════════════════════════════════════════════════════════════════════════
   TAREAS (y los avisos)
   ════════════════════════════════════════════════════════════════════════ */

var ORIGEN = { ia: 'Detectada por la IA', supervisor: 'Pedida por tu supervisor', admin: 'Pedida por la administración', sistema: 'Del sistema' };
var ESTADO_TAREA = { hecha: 'Hecha', no_pude: 'No pudiste', cancelada: 'Cancelada', vencida: 'Vencida', pendiente: 'Pendiente' };

function pantallaTareas() {
  marcarPestana('tareas');
  adentro();
  app.innerHTML = cabeza('Tareas', '') + '<p class="cargando">Cargando…</p>';
  engancharNoSoyYo();
  var id = valor(yo().id);
  var semana = new Date(Date.now() - 7 * 864e5).toISOString();
  Promise.all([
    leer('/orden_avisos?select=id,titulo,cuerpo,creado_en,leido_en&persona_id=eq.' + id + '&order=creado_en.desc&limit=15'),
    leer('/orden_v_tareas?select=id,titulo,detalle,origen,estado,vence_en,requiere_foto,prorroga_estado,local_id,completada_en' +
         '&persona_id=eq.' + id + '&or=(estado.in.(pendiente,vencida),completada_en.gte.' + semana + ')&order=vence_en.asc')
  ]).then(function (r) {
    if (_pestana !== 'tareas') return;
    dibujarTareas(r[0] || [], r[1] || []);
  }).catch(function (e) { pantallaError(e, pantallaTareas); });
}

function dibujarTareas(avisos, tareas) {
  var abiertas = tareas.filter(function (t) { return t.estado === 'pendiente' || t.estado === 'vencida'; });
  var cerradas = tareas.filter(function (t) { return t.estado !== 'pendiente' && t.estado !== 'vencida'; });
  var html = cabeza('Tareas', '');

  if (avisos.length) {
    html += '<div class="seccion">Avisos</div><div class="avisos">' + avisos.slice(0, 8).map(function (a) {
      return '<div class="aviso' + (a.leido_en ? '' : ' nuevo') + '"><b>' + esc(a.titulo) + '</b>' +
        (a.cuerpo ? '<span>' + esc(a.cuerpo) + '</span>' : '') +
        '<small>' + esc(diaMes(a.creado_en) + ' ' + hora(a.creado_en)) + '</small></div>';
    }).join('') + '</div>';
  }

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
  engancharNoSoyYo();
  var porId = {};
  tareas.forEach(function (t) { porId[t.id] = t; });
  app.querySelectorAll('.tarea [data-accion]').forEach(function (b) {
    var t = porId[b.closest('.tarea').dataset.id];
    unaVez(b, function () { return accionTarea(t, b.dataset.accion, b); });
  });

  /* Los avisos que se acaban de ver quedan leídos. */
  var nuevos = avisos.filter(function (a) { return !a.leido_en; }).map(function (a) { return a.id; });
  if (nuevos.length) llamar('orden_marcar_avisos_leidos', { p_ids: nuevos }).catch(function () {});
}

function accionTarea(t, accion, boton) {
  if (accion === 'nopude') {
    var m = preguntarTexto('Contá en una línea por qué no pudiste:');
    if (!m) return;
    return llamar('orden_no_pude_tarea', { p_tarea: t.id, p_motivo: m }).then(function () { avisar('Le avisamos a tu supervisor.'); pantallaTareas(); });
  }
  if (accion === 'tiempo') {
    var m2 = preguntarTexto('¿Por qué necesitás más tiempo?');
    if (!m2) return;
    return llamar('orden_pedir_prorroga', { p_tarea: t.id, p_motivo: m2 }).then(function () { avisar('Le pediste más tiempo a tu supervisor.'); pantallaTareas(); });
  }
  if (!t.requiere_foto) {
    if (!confirm('¿Ya la terminaste?')) return;
    return llamar('orden_completar_tarea', { p_tarea: t.id, p_foto_path: null }).then(function () { avisar('¡Bien! Tarea hecha.'); pantallaTareas(); });
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
  engancharNoSoyYo();
  Promise.all([
    leer('/orden_tableros?select=id,titulo,url,destacado&activo=is.true&order=destacado.desc,orden.asc'),
    leer('/orden_colores?select=nombre,hex&activo=is.true&order=orden.asc')
  ]).then(function (r) {
    if (_pestana !== 'ideas') return;
    var tableros = r[0] || [], colores = r[1] || [];
    var dest = tableros.filter(function (t) { return t.destacado; });
    var resto = tableros.filter(function (t) { return !t.destacado; });
    var enlace = function (t, clase) {
      return /^https:\/\//i.test(t.url) ? '<a class="' + clase + '" href="' + esc(t.url) + '" target="_blank" rel="noopener">' + esc(t.titulo) + '</a>' : '';
    };
    var html = cabeza('Ideas', '') +
      dest.map(function (t) { return enlace(t, 'tablero destacado'); }).join('') +
      (resto.length ? '<div class="grilla">' + resto.map(function (t) { return enlace(t, 'tablero'); }).join('') + '</div>' : '') +
      (!tableros.length ? '<div class="vacio">Todavía no hay tableros cargados.</div>' : '') +
      '<button class="boton" id="verColores" style="margin-top:14px">Regla de colores</button>' +
      '<div id="colores" hidden><p class="bajada" style="margin:14px 0 8px">En los percheros, del más claro al más oscuro:</p>' +
      colores.map(function (c) {
        return '<div class="color"><i style="background:' + esc(c.hex) + '"></i><span>' + esc(c.nombre) + '</span></div>';
      }).join('') + '</div>';
    app.innerHTML = html;
    engancharNoSoyYo();
    document.getElementById('verColores').onclick = function () {
      var c = document.getElementById('colores');
      c.hidden = !c.hidden;
    };
  }).catch(function (e) { pantallaError(e, pantallaIdeas); });
}

/* ════════════════════════════════════════════════════════════════════════
   PERFIL: historial, faltas, avisos, instalar
   ════════════════════════════════════════════════════════════════════════ */

function pantallaPerfil() {
  marcarPestana('perfil');
  adentro();
  var per = yo();
  app.innerHTML = '<h1>Perfil</h1><p class="cargando">Cargando…</p>';
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
    var html = '<h1>Perfil</h1>' +
      '<div class="perfil"><div class="nombre">' + esc(per.nombre) + '</div>' +
      '<div class="bajada" style="margin:4px 0 0">' + esc((per.local || SIN_LOCAL) + ' · ' + (ROL[per.rol] || '')) + '</div></div>';

    html += '<div class="seccion">Avisos</div><div class="perfil">' +
      (avisos === 'activos' ? '<div>Los avisos están activados en este celular.</div>'
       : avisos === 'no-soportado' ? '<div class="bajada" style="margin:0">Este navegador no recibe avisos.</div>'
       : '<div class="bajada" style="margin:0 0 10px">' + (avisos === 'bloqueados' ? 'Los avisos están bloqueados.' : avisos === 'instalar' ? 'Primero instalá la app en tu iPhone.' : 'Los avisos están apagados.') + '</div>' +
         '<button class="boton lima" id="activar">Activar los avisos</button>') +
      (_instalar ? '<button class="boton" id="instalar" style="margin-top:10px">Instalar la app</button>' : '') + '</div>';

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
              (s.desafio_total ? ' · Desafío ' + s.desafio_puntaje + '/' + s.desafio_total : '') + '</small></div>';
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
    document.getElementById('salir').onclick = preguntarSalir;
    var b;
    if ((b = document.getElementById('activar'))) b.onclick = function () { pantallaBienvenida(pantallaPerfil); };
    if ((b = document.getElementById('instalar'))) b.onclick = instalarApp;
    app.querySelectorAll('[data-descargo]').forEach(function (bt) {
      unaVez(bt, function () {
        var t = preguntarTexto('Escribí tu descargo (lo lee tu supervisor):');
        if (!t) return;
        return llamar('orden_registrar_descargo', { p_falta: bt.dataset.descargo, p_texto: t }).then(function () { avisar('Descargo guardado.'); pantallaPerfil(); });
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
    if (d && !d.terminado_en) pantallaDesafio(d); else { pantallaHoy(); avisar('No tenés un desafío abierto.'); }
  }).catch(function (e) { pantallaError(e, pantallaHoy); });
}

function pantallaDesafio(d) {
  barra.hidden = true;
  app.className = 'app';
  var preguntas = d.preguntas || [];
  var i = preguntas.findIndex(function (q) { return !q.respondida; });
  if (i < 0) {
    var ok = preguntas.filter(function (q) { return q.elegida === q.correcta; }).length;
    app.innerHTML = '<p class="marca"><b>Desafío</b> de la semana</p><h1>Acertaste ' + ok + ' de ' + preguntas.length + '</h1>' +
      '<p class="bajada">' + (ok === preguntas.length ? '¡Impecable!' : 'Lo que erraste te vuelve a aparecer más adelante, para que lo aprendas.') + '</p>' +
      '<button class="boton lima" id="fin">Volver a Hoy</button>';
    document.getElementById('fin').onclick = function () { irA('hoy'); };
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
        document.getElementById('siguiente').onclick = function () { pantallaDesafio(d); };
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
var CAMPOS_CAJA = [
  ['Cierre del sistema', [['sis_tarjeta', 'Tarjeta'], ['sis_mp', 'Mercado Pago'], ['sis_gocuotas', 'Go Cuotas'], ['sis_saldo_final_efvo', 'Saldo final en efectivo']]],
  ['Lo real', [['real_lote', 'Cierre de lote'], ['real_mp', 'Mercado Pago'], ['real_gocuotas', 'Go Cuotas'], ['real_efectivo', 'Efectivo contado']]]
];
var LECTURA_A_CAMPO = {
  sistema: { ventas_tarjeta: 'sis_tarjeta', ventas_mercado_pago: 'sis_mp', ventas_debito_go: 'sis_gocuotas', saldo_final_efectivo: 'sis_saldo_final_efvo' },
  lote: { total: 'real_lote' }, mp: { total: 'real_mp' }, gocuotas: { total: 'real_gocuotas' }
};

function textoAlerta(a) {
  if (a.tipo === 'desvio') return 'Diferencia en ' + a.campo + ': ' + pesos(a.monto) + (Number(a.monto) > 0 ? ' (falta plata)' : ' (sobra)');
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
  engancharNoSoyYo();
  llamar('orden_caja_hoy').then(function (caja) {
    return leer('/orden_caja_fotos?select=tipo,ia_estado,ia_resultado&caja_id=eq.' + valor(caja.id) + '&order=tomada_en.desc')
      .then(function (f) { if (_pestana === 'caja') dibujarCaja(caja, f || []); });
  }).catch(function (e) { pantallaError(e, pantallaCaja); });
}

function dibujarCaja(caja, fotos) {
  var ultima = {};
  fotos.forEach(function (f) { if (!ultima[f.tipo]) ultima[f.tipo] = f; });
  var valores = {};
  CAMPOS_CAJA.forEach(function (g) { g[1].forEach(function (c) { valores[c[0]] = caja[c[0]] != null ? caja[c[0]] : ''; }); });
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
  CAMPOS_CAJA.forEach(function (g) {
    html += '<div class="seccion">' + esc(g[0]) + '</div><div class="perfil">' + g[1].map(function (c) {
      return '<label class="campo fila-campo"><span>' + esc(c[1]) + '</span><input inputmode="decimal" data-campo="' + c[0] + '" value="' + esc(valores[c[0]]) + '"' + (cerrada ? ' disabled' : '') + ' placeholder="$"></label>';
    }).join('') + '</div>';
  });
  html += '<label class="campo"><span>Observaciones</span><textarea id="obs" rows="2"' + (cerrada ? ' disabled' : '') + '>' + esc(caja.observaciones || '') + '</textarea></label>';
  if ((caja.alertas || []).length) {
    html += '<div class="revision mala"><div class="titulo">Para revisar</div>' + caja.alertas.map(function (a) { return '<div>' + esc(textoAlerta(a)) + '</div>'; }).join('') + '</div>';
  } else if (caja.estado !== 'pendiente') {
    html += '<div class="nota">Guardada. Dio bien.</div>';
  }
  if (!cerrada) html += '<button class="boton lima" id="guardarCaja">Guardar</button>';
  html += '<input type="file" id="fotoCaja" accept="image/*" capture="environment" hidden>';
  app.innerHTML = html;
  engancharNoSoyYo();

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
  var valores = {};
  app.querySelectorAll('[data-campo]').forEach(function (c) {
    var v = String(c.value || '').trim();
    if (v !== '') valores[c.dataset.campo] = v;
  });
  if (!valores.real_efectivo) { avisar('Falta el efectivo que contaste.'); return; }
  boton.textContent = 'Guardando…';
  return llamar('orden_caja_guardar', { p_caja: caja.id, p_valores: valores, p_observaciones: document.getElementById('obs').value || null })
    .then(function (c) {
      avisar((c.alertas || []).length ? 'Guardada, con cosas para revisar.' : 'Guardada. Dio bien.');
      revisarCaja();
      return leer('/orden_caja_fotos?select=tipo,ia_estado,ia_resultado&caja_id=eq.' + valor(c.id) + '&order=tomada_en.desc')
        .then(function (f) { dibujarCaja(c, f || []); });
    });
}

/* ════════════════════════════════════════════════════════════════════════
   SUPERVISIÓN: Revisar · Equipo · Cajas
   El supervisor ve su local; el administrador y la gerencia eligen el local.
   ════════════════════════════════════════════════════════════════════════ */

var K_LOCAL_SUP = 'vdh_vend_local_sup';
var _locales = null;

/** El local que se está mirando: {id, nombre}. */
function localSup() {
  var per = yo();
  if (per.local_id) return Promise.resolve({ id: per.local_id, nombre: per.local || '', fijo: true });
  var cargar = _locales ? Promise.resolve(_locales) : leer('/orden_locales?select=id,nombre&activo=is.true&order=nombre.asc').then(function (l) { _locales = l || []; return _locales; });
  return cargar.then(function (lista) {
    var guardado = null;
    try { guardado = localStorage.getItem(K_LOCAL_SUP); } catch (e) {}
    var l = lista.filter(function (x) { return x.id === guardado; })[0] || lista[0];
    return l ? { id: l.id, nombre: l.nombre, lista: lista } : null;
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
  engancharNoSoyYo();
  localSup().then(function (loc) {
    if (!loc) { app.innerHTML = cabeza('Revisar', '') + '<div class="vacio">No hay locales cargados.</div>'; engancharNoSoyYo(); return; }
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
    app.innerHTML = html; engancharNoSoyYo(); engancharSelector(pantallaRevisar);
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
  engancharNoSoyYo();
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
  engancharNoSoyYo();
  localSup().then(function (loc) {
    if (!loc) { app.innerHTML = cabeza('Equipo', '') + '<div class="vacio">No hay locales cargados.</div>'; engancharNoSoyYo(); return; }
    var L = valor(loc.id);
    var desde = _equipoMes ? lunesAR(hoyAR().slice(0, 8) + '01') : lunesAR();
    return Promise.all([
      leer('/orden_personas?select=id,nombre,apellido,inicial,aprobado,alta_propia,auth_user_id&local_id=eq.' + L + '&activo=is.true&rol=eq.vendedor&order=nombre.asc'),
      leer('/orden_v_persona_semana?select=persona_id,semana,controles,controles_a_tiempo,nivel_semana,tareas,tareas_a_tiempo,tareas_fuera_de_plazo,desafio_puntaje,desafio_total' +
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
    return '<div class="fila"><span><b>' + esc(nombres[p.id]) + '</b></span>' +
      (t.nivel ? '<span class="chip nivel-' + esc(t.nivel) + '">' + esc(NIVEL[t.nivel]) + '</span>' : '<span class="chip pendiente">Sin fotos</span>') +
      '<small>Controles a tiempo ' + t.a_tiempo + ' de ' + t.controles + ' · Tareas a tiempo ' + t.tareas_ok + ' de ' + t.tareas +
      (t.desT ? ' · Desafío ' + t.des + '/' + t.desT : '') + '</small></div>';
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
  engancharNoSoyYo();
  engancharSelector(pantallaEquipo);
  document.getElementById('irMapa').onclick = function () { pantallaMapa(loc); };
  document.getElementById('vSemana').onclick = function () { _equipoMes = false; pantallaEquipo(); };
  document.getElementById('vMes').onclick = function () { _equipoMes = true; pantallaEquipo(); };
  app.querySelectorAll('[data-aprobar]').forEach(function (b) {
    var mismos = function () { return app.querySelectorAll('[data-aprobar="' + b.dataset.aprobar + '"]'); };
    unaVez(b, function () {
      var si = b.dataset.si === '1', nuevo = b.dataset.nuevo === '1', nombre = b.dataset.nombre;
      if (!si && !confirm(nuevo ? '¿No conocés a ' + nombre + '? Se le cierra el acceso a la app.'
                                : '¿No fue ' + nombre + '? Se borra ese PIN y se cierra esa sesión. ' + nombre + ' va a poder crear el suyo.')) return;
      mismos().forEach(function (x) { x.disabled = true; });
      return llamar('orden_aprobar_persona', { p_persona: b.dataset.aprobar, p_aprobar: si })
        .then(function () { avisar(si ? 'Aprobado: ya puede usar la app.' : nuevo ? 'Listo: no va a poder entrar.' : 'Listo: se borró ese PIN.'); pantallaEquipo(); },
              function (e) { mismos().forEach(function (x) { x.disabled = false; }); throw e; });
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
      if (si && !confirm('¿Confirmás la falta? Le llega el aviso al vendedor.')) return;
      var nota = preguntarTexto(si ? 'Nota (opcional):' : '¿Por qué la descartás? (opcional)');
      if (nota === null) return;
      return llamar('orden_decidir_falta', { p_falta: b.dataset.falta, p_confirmar: si, p_tipo: null, p_nota: nota || null })
        .then(function () { avisar(si ? 'Falta confirmada.' : 'Falta descartada.'); pantallaEquipo(); });
    });
  });
  app.querySelectorAll('[data-cancelar]').forEach(function (b) {
    unaVez(b, function () {
      var m = preguntarTexto('¿Por qué se cancela la tarea?');
      if (!m) return;
      return llamar('orden_cancelar_tarea', { p_tarea: b.dataset.cancelar, p_motivo: m }).then(function () { avisar('Tarea cancelada.'); pantallaEquipo(); });
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
  engancharNoSoyYo();
  localSup().then(function (loc) {
    if (!loc) { app.innerHTML = cabeza('Cajas', '') + '<div class="vacio">No hay locales cargados.</div>'; engancharNoSoyYo(); return; }
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
      engancharNoSoyYo();
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

registroSW().catch(function () { /* sin service worker la app anda igual (sin avisos) */ });

if (_vend && _vend.refresco) entrarApp(false);
else pantallaLocales();

/* ════════════════════════════════════════════════════════════════════════
   EL MAPA DEL LOCAL (supervisión, para mirar). La cantidad y el reparto se
   hacen en la administración, desde la computadora (pedido de Mauricio).
   ════════════════════════════════════════════════════════════════════════ */

function pantallaMapa(loc) {
  apagarCamara();
  barra.hidden = true;
  app.className = 'app';
  app.innerHTML = '<button class="enlace" id="volverMapa">‹ Volver a Equipo</button><h1>El mapa de ' + esc(loc.nombre) + '</h1>' +
    '<p class="bajada">Quién tiene cada módulo y quién cubre. Se reparte desde la computadora: No Compra → Impecable → Por local.</p><div id="mapaZona"><p class="cargando">Cargando…</p></div>';
  document.getElementById('volverMapa').onclick = function () { irA('equipo'); };
  cargarMapa(loc.id).then(function (d) {
    var z = document.getElementById('mapaZona');
    if (!z) return;
    z.innerHTML = (d.aprox && d.pared.length ? '<div class="nota">Todavía no se armó el mapa de este local: los módulos están en las paredes a ojo.</div>' : '') +
      (d.modulos.length ? '<div class="mapa-caja">' + svgMapa(d) + svgDeposito(d) + '</div>' + leyendaNombres(d) + leyendaPersonas(d) : '<div class="vacio">Este local todavía no tiene módulos cargados.</div>');
  }).catch(function (e) { pantallaError(e, function () { pantallaMapa(loc); }); });
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
    if (sinVideo && !confirm(sinVideo === items.length ? 'Todavía no grabaste ningún video. ¿Mandar igual, sólo con los números?'
                                                       : 'Falta el video de ' + sinVideo + (sinVideo === 1 ? ' producto' : ' productos') + '. ¿Mandar igual?')) return;
    return guardarTestigo(items).then(function () { return llamar('testigo_terminar', { p_semana: sem.id }); }).then(function (r) {
      avisar(r && r.con_diferencia
        ? 'Mandado. ' + (r.con_diferencia === 1 ? 'Un producto dio diferencia' : r.con_diferencia + ' productos dieron diferencia') + ': le avisamos a tu supervisor.'
        : 'Mandado: dio todo justo.');
      irA('hoy');
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
