/**
 * VDH · Sistema No Compra — quién entró (13/10/2026).
 *
 * Cada persona entra con su local, su nombre y su PIN, como en BlueSoft. La
 * sesión es LA MISMA de Impecable —la llave vdh_vend_sesion, con el mismo
 * formato y la misma forma de renovarla—: quien entra acá ya está adentro
 * allá, y al revés. La abre la Edge Function `entrar` de Impecable, que es la
 * que revisa el PIN y lleva el freno de 5 intentos.
 *
 * Se carga en el <head>, antes que comun.js y datos.js. Lo primero que hace es
 * marcar el rol en <html> (data-nc-rol): con eso estilos.css esconde de la
 * barra lo que ese rol no usa ANTES de pintar, sin parpadeo. Todo lo demás
 * (hablar con la base, el cartel para entrar) espera a que cargue la página.
 *
 * Mientras dure la transición, entrar es optativo: sin usuario la app anda
 * como siempre, y el PIN compartido sigue cuidando el CRM, Socios y el Club.
 */
var persona = (function () {
  'use strict';

  var K_SESION = 'vdh_vend_sesion';   // la de Impecable: no cambiar el formato sin avisarle
  var K_YO = 'nc_yo';                 // lo que dijo la base de esa persona (rol, local, nombre en la Carga)
  var K_VEND_DE = 'nc_vend_de';       // la Carga ya eligió el vendedor para esta persona (index.html)

  var ROL = { vendedor: 'Vendedor', supervisor: 'Encargado', atencion: 'Atención al cliente', admin: 'Administrador', gerencia: 'Gerencia' };

  /* Las pantallas que cada rol NO usa. La barra no las muestra y, si alguien
     llega igual con la dirección, la pantalla se tapa con un cartel. Es
     cosmética a propósito: lo que protege de verdad sigue siendo el PIN
     compartido (y, en la parte 3, la base mirando a cada persona). */
  var NO_VE = {
    /* La administración de Impecable es de los encargados: el vendedor usa
       su app (vendedores.html), que es adonde lo lleva la barra. */
    /* El POS (pos.html y su Gestión, 20/10), mientras está en construcción, es sólo de Administración. */
    vendedor: ['panel.html', 'club-numeros.html', 'config.html', 'impecable-admin.html', 'pos.html', 'gestion.html'],
    /* También el supervisor de varios locales (sin local fijo, SQL 120). Mauricio, 14/10:
       "acceso a todo, excepto la parte del CRM". Socios y los números del Club son de la
       oficina (la base sólo los abre a Administración, Atención y Gerencia), como para el
       encargado. */
    supervisor: ['panel.html', 'club-numeros.html', 'pos.html', 'gestion.html'],
    atencion: ['impecable-admin.html', 'pos.html', 'gestion.html'],
    admin: [],
    gerencia: ['pos.html', 'gestion.html']
  };

  function leerLS(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function guardarLS(k, v) {
    try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* incógnito */ }
  }
  function txt(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function primerNombre(n) { return String(n || '').split(' ')[0]; }

  /* La sesión se cerró por otro lado (el "No soy yo" de Impecable, que
     comparte la sesión pero no sabe de la Carga): lo que la Carga dejó a
     nombre de esa persona se limpia como con "No soy" de acá. Si no, el
     que sigue cargaba sin darse cuenta a nombre del anterior, y cuando el
     anterior volvía a entrar la Carga ya no lo elegía. Corre antes de que
     la Carga lea "quién carga" (este archivo va en el <head>). */
  function limpiarSiSalio() {
    if (leerLS(K_SESION)) return;
    var marca = null;
    try { marca = localStorage.getItem(K_VEND_DE); } catch (e) { return; }
    if (!marca) return;
    var y = leerLS(K_YO);
    try {
      if (y && y.id === marca && y.vendedor && localStorage.getItem('nc_vendedor') === y.vendedor) localStorage.removeItem('nc_vendedor');
      localStorage.removeItem(K_VEND_DE);
      localStorage.removeItem(K_YO);
    } catch (e) {}
  }
  limpiarSiSalio();

  var _ses = leerLS(K_SESION);
  var _yo = leerLS(K_YO);
  /* Lo guardado vale sólo si es de la persona de la sesión. Si entró por
     Impecable todavía no hay nada guardado: se usa lo que trajo la sesión
     hasta que conteste la base. */
  if (!_ses || !_ses.persona || !_yo || _yo.id !== _ses.persona.id) {
    _yo = _ses && _ses.persona ? { id: _ses.persona.id, nombre: _ses.persona.nombre, rol: _ses.persona.rol,
                                   aprobado: _ses.persona.aprobado !== false, activo: true, provisorio: true } : null;
  }

  /* Cuenta sólo quien está activo y aprobado: un PIN recién creado espera. */
  function vigente(y) { return !!(y && y.activo !== false && y.aprobado === true && ROL[y.rol]); }
  function rol() { return vigente(_yo) ? _yo.rol : ''; }
  /* SQL 135: un vendedor (o encargado) que además atiende clientes: ve lo de su rol y lo de Atención. */
  function conAtencion() { return vigente(_yo) && _yo.tambien_atencion === true; }
  /* La oficina: lo que antes abría el PIN compartido (CRM, Socios, el Club,
     la lista de gift cards) lo abre su usuario. La base dice lo mismo
     (nc_es_oficina, SQL 107; con la casilla de Atención, SQL 135). */
  var OFICINA = { admin: 1, atencion: 1, gerencia: 1 };
  function oficina() { return !!OFICINA[rol()] || conAtencion(); }

  /* La compu habilitada de un local (el enlace de Cajas habilitadas: la llave de Cobrar, 'nc_caja'). */
  function compuDelLocal() {
    try { return /^caja_/.test(localStorage.getItem('nc_caja') || '') && !!localStorage.getItem('nc_caja_local'); }
    catch (e) { return false; }
  }

  function marcar() {
    var r = rol();
    if (r) document.documentElement.setAttribute('data-nc-rol', r);
    else document.documentElement.removeAttribute('data-nc-rol');
    /* Con la casilla de Atención, estilos.css no esconde el CRM ni el Club. */
    if (conAtencion()) document.documentElement.setAttribute('data-nc-atencion', '');
    else document.documentElement.removeAttribute('data-nc-atencion');
    /* Mauricio, 25/10: la compu de un local, sin nadie adentro, ve sólo lo del local (la barra del
       vendedor: sin CRM, Socios, Config ni Supervisión). Al entrar alguien, manda su rol. Es sólo la
       barra: cada pantalla de la oficina sigue con su portón. */
    if (!r && compuDelLocal()) document.documentElement.setAttribute('data-nc-compu', '');
    else document.documentElement.removeAttribute('data-nc-compu');
  }
  marcar();

  function pagina() {
    var p = location.pathname.split('/').pop();
    return p || 'index.html';
  }
  function puede(pag) {
    var r = rol(), p = pag || pagina();
    return !r || NO_VE[r].indexOf(p) < 0 || (conAtencion() && NO_VE.atencion.indexOf(p) < 0);
  }
  /** "Encargado" es el supervisor de un local; el de varios locales (sin local fijo, SQL 120), "Supervisor".
      Con la casilla de Atención (SQL 135): "Vendedor y Atención al cliente". */
  function nombreRol(y) {
    var n = y.rol === 'supervisor' && !y.local_id ? 'Supervisor' : ROL[y.rol];
    return y.tambien_atencion === true && !OFICINA[y.rol] ? n + ' y Atención al cliente' : n;
  }

  /* ════════════════════════════════════════════════════════════════════
     LA SESIÓN (mismo protocolo que impecable-comun.js)
     ════════════════════════════════════════════════════════════════════ */

  function anotar(r, p) {
    _ses = {
      token: r.access_token,
      refresco: r.refresh_token,
      /* Un minuto antes de que venza: una llamada que sale justo en el
         límite llega vencida. expires_at viene en segundos. */
      vence: r.expires_at ? (r.expires_at - 60) * 1000 : Date.now() + 3540 * 1000,
      persona: p || (_ses && _ses.persona)
    };
    guardarLS(K_SESION, _ses);
  }

  function sinSesion() {
    var e = new Error('Se cerró tu sesión. Entrá de nuevo con tu PIN.');
    e.sinSesion = true;
    return e;
  }

  function olvidar() {
    _ses = null;
    guardarLS(K_SESION, null);
    try { localStorage.removeItem(K_VEND_DE); } catch (e) {}
    fijarYo(null);
  }

  /* Si dos pedidos encuentran el token vencido, se renueva UNA vez: el
     refresco es de un solo uso, y usarlo dos veces cerraría la sesión. */
  var _renovando = null;

  function token() {
    /* Otra pestaña (o Impecable) pudo haberla renovado o cerrado. */
    var g = leerLS(K_SESION);
    if (!g) { if (_ses) olvidar(); return Promise.reject(sinSesion()); }
    if (!_ses || g.refresco !== _ses.refresco) _ses = g;
    if (!_ses.refresco) return Promise.reject(sinSesion());
    if (Date.now() < _ses.vence) return Promise.resolve(_ses.token);
    if (!_renovando) {
      var refresco = _ses.refresco;
      _renovando = fetch(BASE + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { apikey: CLAVE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresco })
      }).then(function (r) {
        if (r.status === 400 || r.status === 401) {
          var otra = leerLS(K_SESION);
          if (otra && otra.refresco && otra.refresco !== refresco) { _ses = otra; return null; }
          olvidar();
          throw sinSesion();
        }
        if (!r.ok) throw new Error('Supabase respondió ' + r.status);
        return r.json().then(function (d) {
          anotar({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at });
          return _ses.token;
        });
      });
      _renovando.then(function () { _renovando = null; }, function () { _renovando = null; });
    }
    return _renovando.then(function (t) { return t || token(); });
  }

  /* Para la Carga: el token sólo si hay alguien habilitado, y nunca un
     error. Sin token la carga sale igual, como siempre. */
  function tokenSiHay() {
    if (!vigente(_yo)) return Promise.resolve(null);
    return token().catch(function () { return null; });
  }

  /* ════════════════════════════════════════════════════════════════════
     QUIÉN SOY (lo pregunta cada pantalla: el rol pudo cambiar)
     ════════════════════════════════════════════════════════════════════ */

  var _pidioSinPila = false, _recargado = false, _respondio = false;
  /* Una recarga automática cada 30 segundos, como mucho (por pestaña). */
  function unaVezPorPestana() {
    try {
      var antes = Number(sessionStorage.getItem('nc_recargo_pila')) || 0, ahora = Date.now();
      if (ahora - antes < 30000) return false;
      sessionStorage.setItem('nc_recargo_pila', String(ahora));
      return sessionStorage.getItem('nc_recargo_pila') === String(ahora);
    } catch (e) { return false; }
  }
  function fijarYo(y) {
    /* SQL 141: también los locales del supervisor (Estadísticas le muestra sólo esos). */
    var clave = function () {
      return rol() + '|' + (_yo && _yo.id) + '|' + (_yo && _yo.aprobado) + '|' + !!(_yo && _yo.pin_corto) + '|' + !!(_yo && _yo.tambien_atencion) +
        '|' + (_yo && _yo.zona ? _yo.zona.map(function (z) { return z.codigo; }).join(',') : '');
    };
    var antes = clave();
    _yo = y;
    guardarLS(K_YO, y && !y.provisorio ? y : null);
    marcar();
    /* La pantalla ya preguntó por la marca y no la tuvo (faltaba 'pila'):
       ahora que la base contestó, se rearma una vez. Sólo si 'pila' quedó
       guardada (si no, al recargar volvería a faltar: sin fin) y no más de
       una vez cada 30 segundos; si no, el portón ofrece entrar con un toque. */
    if (_pidioSinPila && !_recargado && oficina() && _yo && _yo.pila) {
      _recargado = true;
      var guardado = leerLS(K_YO);
      if (guardado && guardado.pila && unaVezPorPestana()) { location.reload(); return; }
    }
    if (antes !== clave()) {
      pintarBarra();
      revisarAcceso();
      try { document.dispatchEvent(new CustomEvent('persona', { detail: vigente(_yo) ? _yo : null })); } catch (e) {}
    }
  }

  function sesionRechazada(e) {
    return !!(e && e.delServidor && (e.status === 401 || e.status === 403 || /JWT/i.test(e.message)));
  }

  function refrescar() {
    if (!leerLS(K_SESION)) { if (_ses || _yo) olvidar(); return Promise.resolve(null); }
    return token()
      .then(function (t) { return funcion('nc_yo', {}, t); })
      .then(function (y) {
        _respondio = true;
        /* Null: la sesión ya no es de nadie de la lista (lo desactivaron y
           se le cerró la cuenta). Desactivado: lo mismo. */
        if (!y || y.activo === false) { cerrarSesion(); return null; }
        fijarYo(y);
        return y;
      })
      .catch(function (e) {
        /* La sesión ya no vale (le borraron la cuenta, o la base no reconoce
           la firma): afuera. Por el estado, no por el texto, y antes que
           sinSesion, que datos.js también le pone a un 401. */
        if (sesionRechazada(e)) { cerrarSesion(); return null; }
        if (e && e.sinSesion) return null;
        /* Sin señal, o la base todavía sin el SQL 101: se sigue con lo
           guardado. Nada de esto puede frenar la pantalla. */
        return vigente(_yo) ? _yo : null;
      });
  }

  /* Las notificaciones de Impecable de este aparato dejan de llegarle a esa
     persona (lo mismo que hace Impecable al salir): si no, el próximo que
     entre recibiría las del anterior. No registra nada: busca la que haya. */
  function soltarAvisos() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return Promise.resolve();
    return navigator.serviceWorker.getRegistration('vendedores.html').then(function (reg) {
      if (!reg || !reg.pushManager) return null;
      return reg.pushManager.getSubscription().then(function (s) {
        if (!s) return null;
        return token().then(function (t) {
          return fetch(BASE + '/rest/v1/orden_push_subs?endpoint=eq.' + encodeURIComponent(s.endpoint), {
            method: 'DELETE',
            headers: { apikey: CLAVE, Authorization: 'Bearer ' + t, Prefer: 'return=minimal' }
          });
        }).catch(function () {}).then(function () { return s.unsubscribe(); });
      });
    }).catch(function () {});
  }

  function cerrarSesion() {
    var t = _ses && _ses.token;
    olvidar();
    if (t) {
      /* scope=local: cierra sólo este aparato. */
      fetch(BASE + '/auth/v1/logout?scope=local', { method: 'POST', headers: { apikey: CLAVE, Authorization: 'Bearer ' + t } })
        .catch(function () {});
    }
  }

  function salir() {
    /* Si en "quién carga" quedó su nombre, se saca: el que sigue en este
       aparato no tiene que cargar a nombre de otro sin darse cuenta. */
    var y = _yo;
    return soltarAvisos().then(function () {
      try {
        if (y && y.vendedor && localStorage.getItem('nc_vendedor') === y.vendedor) localStorage.removeItem('nc_vendedor');
      } catch (e) {}
      cerrarSesion();
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     LA BARRA: el botón de quién entró, y lo que cada rol ve
     ════════════════════════════════════════════════════════════════════ */

  var ICONO_YO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  var ICONO_ENTRAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>';
  /* Supervisión lleva un local con un tilde (en los HTML); al vendedor, el mismo botón lo lleva a Equipo VDH y le muestra la percha de siempre. */
  var DIBUJO_PERCHA = '<path d="M9.5 6.5a2.5 2.5 0 1 1 3.4 2.33c-.55.21-.9.73-.9 1.31V11"/><path d="M12 11 2.9 17.1a1 1 0 0 0 .56 1.9h17.08a1 1 0 0 0 .56-1.9z"/>';

  function pintarBarra() {
    var rail = document.querySelector('.rail-in');
    if (!rail) return;
    /* Impecable: el vendedor va a su app; el resto, a la administración. */
    var imp = rail.querySelector('.rail-item[data-impecable], .rail-item[href="impecable-admin.html"], .rail-item[href="vendedores.html"]');
    if (imp) {
      imp.setAttribute('data-impecable', '1');
      imp.setAttribute('href', rol() === 'vendedor' ? 'vendedores.html' : 'impecable-admin.html');
      /* La parte de la compu es "Supervisión"; la app de los chicos sigue siendo "Equipo VDH" (Mauricio, 19/10). */
      var etiqueta = Array.prototype.filter.call(imp.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); })[0];
      if (etiqueta) etiqueta.textContent = '\n      ' + (rol() === 'vendedor' ? 'Equipo VDH' : 'Supervisión') + '\n    ';
      var dibujo = imp.querySelector('.rail-icono svg');
      if (dibujo) {
        if (dibujo._local == null) { dibujo._local = dibujo.innerHTML; dibujo._cual = 'local'; }
        var cual = rol() === 'vendedor' ? 'percha' : 'local';
        if (dibujo._cual !== cual) { dibujo.innerHTML = cual === 'percha' ? DIBUJO_PERCHA : dibujo._local; dibujo._cual = cual; }
      }
    }
    var b = rail.querySelector('.rail-yo');
    if (!b) {
      b = document.createElement('button');
      b.type = 'button';
      b.className = 'rail-item rail-yo';
      b.onclick = function () { if (_ses && _yo) abrirFicha(); else entrar(); };
      rail.appendChild(b);
    }
    /* En la Carga (la única con pie en el rail) también va uno redondo en el
       renglón del local (23/10; antes, al lado de "Cambiar de local"): en la
       PC ancha es el que se ve (estilos.css). */
    var pie = document.querySelector('.rail-pie');
    var mini = document.querySelector('.rail-yo-mini');
    if (pie && !mini) {
      mini = document.createElement('button');
      mini.type = 'button';
      mini.className = 'rail-yo-mini';
      mini.onclick = b.onclick;
      (pie.querySelector('.rail-fila') || pie).appendChild(mini);
      document.querySelector('.rail').classList.add('con-pie');
    }
    var hay = !!(_ses && _yo);
    var espera = hay && !vigente(_yo);
    var texto = hay ? (espera ? 'En espera' : primerNombre(_yo.nombre)) : 'Entrar';
    var titulo = hay ? (espera ? 'Esperando el OK' : _yo.nombre + ' · ' + nombreRol(_yo)) : 'Entrar con tu usuario';
    var etiqueta = hay ? (espera ? 'Tu usuario está esperando el OK' : 'Entraste como ' + _yo.nombre) : 'Entrar con tu usuario';
    [b, mini].forEach(function (x) {
      if (!x) return;
      x.classList.toggle('adentro', hay && !espera);
      x.classList.toggle('espera', espera);
      x.title = titulo;
      x.setAttribute('aria-label', etiqueta);
      x.setAttribute('data-texto', texto);
    });
    b.innerHTML = '<span class="rail-icono">' + (hay ? ICONO_YO : ICONO_ENTRAR) + '</span>' + txt(texto);
    if (mini) mini.innerHTML = hay ? ICONO_YO : ICONO_ENTRAR;
  }

  /* Llegó con la dirección a una pantalla que no es de su rol. */
  function revisarAcceso() {
    var viejo = document.getElementById('ncpSinAcceso');
    if (puede()) { if (viejo) viejo.remove(); return; }
    if (viejo || !document.body) return;
    var d = document.createElement('div');
    d.id = 'ncpSinAcceso';
    d.className = 'ncp-sinacceso';
    d.innerHTML = '<div class="ncp-caja" role="alert">' +
      '<h2>Esta sección no es para tu usuario</h2>' +
      '<p>Entraste como <b>' + txt(_yo.nombre) + '</b> (' + txt(nombreRol(_yo)) + '). Lo que podés usar está en la barra.</p>' +
      '<div class="ncp-pie"><a class="btn btn-pri" href="index.html">Ir a No Compra</a>' +
      '<button type="button" class="btn btn-sec" data-salir>No soy ' + txt(primerNombre(_yo.nombre)) + '</button></div></div>';
    d.querySelector('[data-salir]').onclick = function () { salir().then(function () { location.reload(); }); };
    document.body.appendChild(d);
  }

  /* ════════════════════════════════════════════════════════════════════
     EL AVISO DE LAS DIFERENCIAS DE LOS REMITOS (SQL 167, 24/10/2026)
     Mauricio: "el mismo sistema tendría que avisar. Cuando abra el
     sistema, le tendría que aparecer un mensaje". A Administración (la que
     las resuelve, por ahora): en "Gestión" de la barra, cuántas faltan
     resolver; y si llegó alguna desde la última vez que las vio, un cartel
     abajo con lo que pasó, "Ver las diferencias" y la ×. El mail queda para
     cuando haya una dirección. Nunca frena nada: sin el SQL 167 o sin
     conexión, no aparece.
     ════════════════════════════════════════════════════════════════════ */

  var K_DIF_VISTO = 'nc_dif_visto';   // la última diferencia que ya vio (su número): el cartel sale por las que vengan después
  var _dif = null;

  function enDiferencias() { return pagina() === 'gestion.html' && /^#\/?diferencias$/.test(location.hash); }
  function difVisto() { try { return Number(localStorage.getItem(K_DIF_VISTO)) || 0; } catch (e) { return 0; } }
  /** Ya las vio (abrió Gestión → Diferencias, tocó "Ver" o la ×): el cartel se va y no vuelve por éstas. */
  function difVistas() {
    var c = document.getElementById('ncpDif');
    if (c) c.remove();
    if (_dif && _dif.ultimo > difVisto()) { try { localStorage.setItem(K_DIF_VISTO, String(_dif.ultimo)); } catch (e) {} }
  }

  function avisoDiferencias() {
    if (rol() !== 'admin' || !document.querySelector('.rail')) {
      /* Si entró otro que no es de Administración, lo del anterior se va. */
      _dif = null;
      pintarCuentaDif();
      var c = document.getElementById('ncpDif');
      if (c) c.remove();
      return Promise.resolve(null);
    }
    return token().then(function (t) { return funcion('pos_diferencias_aviso', {}, t); }).then(function (a) {
      _dif = { pendientes: Number(a && a.pendientes) || 0, ultimo: Number(a && a.ultimo) || 0, productos: (a && a.productos) || [] };
      pintarCuentaDif();
      if (enDiferencias()) difVistas(); else pintarCartelDif();
      return _dif;
    }).catch(function () { return null; });
  }

  /* El número, en la esquina del ícono de "Gestión" (en la barra parada y en la de abajo del celular). */
  function pintarCuentaDif() {
    var n = _dif ? _dif.pendientes : 0;
    document.querySelectorAll('.rail-item[href="gestion.html"] .rail-icono').forEach(function (ic) {
      var b = ic.querySelector('.rail-cuenta');
      if (!n) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('span'); b.className = 'rail-cuenta'; ic.appendChild(b); }
      b.textContent = n > 99 ? '99+' : String(n);
      b.title = n + (n === 1 ? ' diferencia de remitos sin resolver' : ' diferencias de remitos sin resolver');
    });
  }

  function fechaCortaDif(ts) {
    try {
      return new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
        .format(new Date(ts)).replace(',', '');
    } catch (e) { return ''; }
  }

  function pintarCartelDif() {
    var visto = difVisto(), viejo = document.getElementById('ncpDif');
    var nuevos = _dif.productos.filter(function (p) { return Number(p.ultimo) > visto; });
    if (viejo) viejo.remove();
    if (!_dif.pendientes || !nuevos.length || !document.body) return;
    /* El nombre del producto, si la pantalla tiene el catálogo (el POS); si no, el que vino en el remito, o el código. */
    var cat = {};
    (window.CATALOGO || []).forEach(function (p) { cat[p[0]] = p[1]; });
    var d = document.createElement('div');
    d.id = 'ncpDif';
    d.className = 'ncp-dif';
    d.setAttribute('role', 'status');
    d.innerHTML = '<div class="ncp-dif-cab"><b>' + (nuevos.length === 1 ? 'Llegó un producto con diferencias' : 'Llegaron productos con diferencias') + '</b>' +
        '<button type="button" class="ncp-dif-x" aria-label="Cerrar el aviso" title="Ya lo vi">×</button></div>' +
      '<ul>' + nuevos.slice(0, 3).map(function (p) {
        var que = [p.faltan > 0 ? 'faltó ' + p.faltan : '', p.sobran > 0 ? 'sobró ' + p.sobran : ''].filter(Boolean).join(' y ');
        return '<li><b>' + txt(p.local) + '</b> · R-' + txt(p.numero) + ' · ' + txt(p.codigo) + (cat[p.codigo] || p.descripcion ? ' ' + txt(cat[p.codigo] || p.descripcion) : '') +
          ': <span class="ncp-dif-que">' + txt(que) + '</span>' +
          '<small>' + txt([p.recibio ? 'Lo recibió ' + p.recibio : '', fechaCortaDif(p.fecha)].filter(Boolean).join(', ')) + '</small></li>';
      }).join('') + '</ul>' +
      (nuevos.length > 3 ? '<p>Y ' + (nuevos.length - 3) + ' más.</p>' : '') +
      '<div class="ncp-dif-pie"><span>' + _dif.pendientes + (_dif.pendientes === 1 ? ' sin resolver' : ' sin resolver en total') + '</span>' +
        '<a class="btn btn-pri btn-chico" href="gestion.html#diferencias">Ver las diferencias</a></div>';
    d.querySelector('.ncp-dif-x').onclick = difVistas;
    d.querySelector('a').addEventListener('click', difVistas);
    document.body.appendChild(d);
  }
  /* Si llega a Diferencias por la dirección (o con la flecha de atrás), también cuentan como vistas. */
  window.addEventListener('hashchange', function () { if (_dif && enDiferencias()) difVistas(); });

  /* ════════════════════════════════════════════════════════════════════
     LA VENTANA: entrar, esperar el OK, o ver quién entró
     ════════════════════════════════════════════════════════════════════ */

  var _velo = null, _teclas = null;
  /* Lo que una pantalla suma a la ficha de quién entró (ver ponerEnFicha). */
  var _enFicha = null;

  function abrirVelo() {
    cerrarVelo();
    _velo = document.createElement('div');
    _velo.className = 'ncp-velo';
    _velo.innerHTML = '<div class="ncp-caja ncp-entrar" role="dialog" aria-modal="true" aria-labelledby="ncpTit" tabindex="-1">' +
      '<button type="button" class="ncp-x" aria-label="Cerrar">×</button><div class="ncp-cuerpo"></div></div>';
    _velo.querySelector('.ncp-x').onclick = cerrarVelo;
    _velo.addEventListener('mousedown', function (e) { if (e.target === _velo) cerrarVelo(); });
    document.body.appendChild(_velo);
    /* El foco arranca adentro de la ventana (para el teclado y los lectores de pantalla). */
    _velo.querySelector('.ncp-caja').focus();
    document.addEventListener('keydown', teclado, true);
    return _velo.querySelector('.ncp-cuerpo');
  }
  function cerrarVelo() {
    if (_velo) { _velo.remove(); _velo = null; }
    _teclas = null;
    document.removeEventListener('keydown', teclado, true);
  }
  function teclado(e) {
    if (!_velo) return;
    if (e.key === 'Escape') { e.preventDefault(); cerrarVelo(); return; }
    /* En el PIN se puede escribir con el teclado de la PC. */
    if (_teclas && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); _teclas(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); _teclas('x'); }
    }
  }
  function cargando(c) { c.innerHTML = '<p class="ncp-cargando">Cargando…</p>'; }
  function fallo(c, e, otraVez) {
    c.innerHTML = '<h2 id="ncpTit">No se pudo</h2><p class="ncp-bajada">' +
      txt(e && e.delServidor ? e.message : 'Sin conexión. Probá de nuevo cuando haya señal.') + '</p>' +
      '<div class="ncp-pie"><button type="button" class="btn btn-pri" data-otra>Probar de nuevo</button></div>';
    c.querySelector('[data-otra]').onclick = otraVez;
  }

  var RE_NOMBRE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]{2,30}$/;
  function prolijo(t) { return String(t || '').trim().replace(/\s+/g, ' '); }

  /* cual: el código donde arrancar (la bienvenida de la Carga manda 'ECOMMERCE');
     si no viene, el local de este aparato. */
  function entrar(cual) {
    /* Ya hay alguien adentro (o esperando el OK): se muestra quién, con su
       "No soy", en vez de abrir otra sesión encima de la que hay. */
    if (_ses && _yo) { abrirFicha(); return; }
    var c = abrirVelo();
    var aparato = typeof cual === 'string' ? cual : '';
    if (!aparato) try { aparato = localStorage.getItem('nc_local') || ''; } catch (e) {}
    pasoLocales(c, aparato);
  }

  function pasoLocales(c, saltarA) {
    _teclas = null;
    cargando(c);
    funcion('nc_login_locales', {}).then(function (locales) {
      if (saltarA) {
        for (var i = 0; i < locales.length; i++) {
          if (locales[i].codigo && locales[i].codigo === saltarA) { pasoPersonas(c, locales[i]); return; }
        }
      }
      /* SQL 148: al final, "E-commerce" (Atención al cliente) y "Administración", con una raya que los separa
         de los locales. Sin el 148 hay un solo botón, "Administración", con todos los sin local. */
      var conEcom = locales.some(function (l) { return l.grupo === 'atencion'; }), raya = false;
      c.innerHTML = '<h2 id="ncpTit">Entrá con tu usuario</h2>' +
        '<p class="ncp-bajada">' + (conEcom
          ? '¿En qué local trabajás? Al final están E-commerce (atención al cliente) y Administración.'
          : '¿En qué local trabajás? Atención y administración están al final.') + '</p>' +
        '<div class="chips-local ncp-lista">' + locales.map(function (l, i) {
          var antes = '';
          if (!l.id && !raya && i > 0) { raya = true; antes = '<span class="ncp-raya" aria-hidden="true"></span>'; }
          return antes + '<button type="button" class="chip" data-i="' + i + '">' + txt(l.nombre) + '</button>';
        }).join('') + '</div>';
      [].forEach.call(c.querySelectorAll('[data-i]'), function (b) {
        b.onclick = function () { pasoPersonas(c, locales[+b.dataset.i]); };
      });
    }).catch(function (e) { fallo(c, e, function () { pasoLocales(c, saltarA); }); });
  }

  function pasoPersonas(c, local) {
    _teclas = null;
    cargando(c);
    /* SQL 148: "E-commerce" y "Administración" no tienen id: se piden por su grupo. */
    funcion('nc_login_personas', local.grupo ? { p_local: null, p_grupo: local.grupo } : { p_local: local.id }).then(function (gente) {
      c.innerHTML = '<button type="button" class="ncp-volver" data-volver>‹ Otro local</button>' +
        '<h2 id="ncpTit">¿Quién sos?</h2><p class="ncp-bajada">' + txt(local.nombre) + '</p>' +
        (gente.length
          ? '<div class="chips-local ncp-lista">' + gente.map(function (p, i) {
              return '<button type="button" class="chip" data-i="' + i + '">' + txt(p.nombre) + '</button>';
            }).join('') + '</div>'
          : '<p class="ncp-vacio">Todavía no hay nadie cargado acá.' + (local.id ? ' Pedile a tu encargado que te cree el usuario, o anotate.' : '') + '</p>') +
        /* Anotarse solo es como vendedor de un local: a Administración no se entra solo. */
        (local.id ? '<button type="button" class="btn btn-sec btn-chico ncp-nuevo" data-nuevo>No estoy en la lista</button>' : '');
      c.querySelector('[data-volver]').onclick = function () { pasoLocales(c, ''); };
      [].forEach.call(c.querySelectorAll('[data-i]'), function (b) {
        b.onclick = function () {
          var p = gente[+b.dataset.i];
          if (p.nuevo && p.pide_apellido) pasoApellido(c, local, p);
          else pasoPin(c, local, p, {});
        };
      });
      var n = c.querySelector('[data-nuevo]');
      if (n) n.onclick = function () { pasoAlta(c, local); };
    }).catch(function (e) { fallo(c, e, function () { pasoPersonas(c, local); }); });
  }

  function campos(lista) {
    return '<div class="ncp-campos">' + lista.map(function (x) {
      return '<div class="campo"><label for="ncp_' + x[0] + '">' + txt(x[1]) + '</label>' +
        '<input type="text" id="ncp_' + x[0] + '" autocomplete="' + x[2] + '" autocapitalize="words" maxlength="30"></div>';
    }).join('') + '</div><p class="ncp-aviso mal" data-aviso></p>';
  }

  function pasoApellido(c, local, p) {
    _teclas = null;
    var nom = primerNombre(p.nombre);
    c.innerHTML = '<button type="button" class="ncp-volver" data-volver>‹ No soy ' + txt(nom) + '</button>' +
      '<h2 id="ncpTit">Hola, ' + txt(nom) + '</h2>' +
      '<p class="ncp-bajada">Antes de crear tu PIN, poné tu apellido. Así no te confundimos con otro ' + txt(nom) + '.</p>' +
      campos([['apellido', 'Apellido', 'family-name']]) +
      '<div class="ncp-pie"><button type="button" class="btn btn-pri" data-seguir>Seguir</button></div>';
    c.querySelector('[data-volver]').onclick = function () { pasoPersonas(c, local); };
    var campo = c.querySelector('#ncp_apellido');
    var seguir = function () {
      var ap = prolijo(campo.value);
      if (!RE_NOMBRE.test(ap)) { c.querySelector('[data-aviso]').textContent = 'Poné tu apellido: sólo letras, de 2 a 30.'; campo.focus(); return; }
      pasoPin(c, local, p, { apellido: ap });
    };
    c.querySelector('[data-seguir]').onclick = seguir;
    campo.onkeydown = function (e) { if (e.key === 'Enter') seguir(); };
    campo.focus();
  }

  function pasoAlta(c, local) {
    _teclas = null;
    c.innerHTML = '<button type="button" class="ncp-volver" data-volver>‹ Volver a la lista</button>' +
      '<h2 id="ncpTit">Anotate</h2>' +
      '<p class="ncp-bajada">Vas a quedar como vendedor de ' + txt(local.nombre) + '. Tu encargado te confirma antes de que puedas usarlo.</p>' +
      campos([['nombre', 'Nombre', 'given-name'], ['apellido', 'Apellido', 'family-name']]) +
      '<div class="ncp-pie"><button type="button" class="btn btn-pri" data-seguir>Seguir</button></div>';
    c.querySelector('[data-volver]').onclick = function () { pasoPersonas(c, local); };
    var seguir = function () {
      var n = prolijo(c.querySelector('#ncp_nombre').value), a = prolijo(c.querySelector('#ncp_apellido').value);
      var aviso = c.querySelector('[data-aviso]');
      if (!RE_NOMBRE.test(n)) { aviso.textContent = 'Poné tu nombre: sólo letras, de 2 a 30.'; return; }
      if (!RE_NOMBRE.test(a)) { aviso.textContent = 'Poné tu apellido: sólo letras, de 2 a 30.'; return; }
      pasoPin(c, local, { id: null, nombre: n, nuevo: true }, { alta: { nombre: n, apellido: a } });
    };
    c.querySelector('[data-seguir]').onclick = seguir;
    c.querySelector('#ncp_apellido').onkeydown = function (e) { if (e.key === 'Enter') seguir(); };
    c.querySelector('#ncp_nombre').focus();
  }

  /* Los puntos del PIN: 4 o 6 (SQL 110: 6 para Administración, Atención y
     Gerencia; la lista dice cuántos tiene el de cada uno). */
  function puntosDe(largo) { return '<div class="ncp-puntos" data-puntos>' + new Array(largo + 1).join('<i></i>') + '</div>'; }
  var TECLADO = '<div class="ncp-teclado">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button type="button" data-n="' + n + '">' + n + '</button>'; }).join('') +
      '<span></span><button type="button" data-n="0">0</button>' +
      '<button type="button" data-n="x" aria-label="Borrar">⌫</button>' +
    '</div>';

  function pasoPin(c, local, p, extra) {
    var pin = '', ocupado = false, crear = !!p.nuevo, primero = null;
    var largo = extra.alta ? 4 : (Number(p.digitos) === 6 ? 6 : 4);
    var nom = primerNombre(p.nombre);
    c.innerHTML = '<button type="button" class="ncp-volver" data-volver>‹ ' + (extra.alta ? 'Volver' : 'No soy ' + txt(nom)) + '</button>' +
      '<h2 id="ncpTit"></h2><p class="ncp-bajada" data-bajada></p>' +
      puntosDe(largo) +
      '<p class="ncp-aviso" data-aviso aria-live="polite"></p>' + TECLADO;
    c.querySelector('[data-volver]').onclick = function () { if (extra.alta) pasoAlta(c, local); else pasoPersonas(c, local); };
    var puntos = c.querySelector('[data-puntos]'), aviso = c.querySelector('[data-aviso]');
    var botones = c.querySelectorAll('.ncp-teclado [data-n]');

    function textos() {
      c.querySelector('#ncpTit').textContent = !crear ? 'Hola, ' + nom : (primero === null ? 'Creá tu PIN' : 'Repetí tu PIN');
      c.querySelector('[data-bajada]').textContent = !crear ? 'Poné tu PIN de ' + largo + ' números.'
        : (primero === null ? 'Hola, ' + nom + '. Elegí ' + largo + ' números que te acuerdes: es tu PIN para entrar (también a Equipo VDH).'
                            : 'Poné los mismos ' + largo + ' números otra vez.');
    }
    function dibujar() {
      [].forEach.call(puntos.children, function (d, i) { d.classList.toggle('lleno', i < pin.length); });
    }
    function trabar(seg) {
      [].forEach.call(botones, function (t) { t.disabled = true; });
      ocupado = true;
      setTimeout(function () {
        if (!c.isConnected) return;
        [].forEach.call(botones, function (t) { t.disabled = false; });
        ocupado = false;
        aviso.className = 'ncp-aviso';
        aviso.textContent = 'Ya podés probar de nuevo.';
      }, seg * 1000);
    }
    function mal(texto, seg) {
      pin = '';
      dibujar();
      puntos.classList.remove('mal');
      void puntos.offsetWidth;
      puntos.classList.add('mal');
      aviso.className = 'ncp-aviso mal';
      aviso.textContent = texto;
      if (seg) trabar(seg);
    }
    function mandar() {
      ocupado = true;
      puntos.classList.add('esperando');
      aviso.className = 'ncp-aviso';
      aviso.textContent = 'Revisando…';
      var cuerpo = extra.alta
        ? { alta: { local_id: local.id, nombre: extra.alta.nombre, apellido: extra.alta.apellido }, pin: pin }
        : { persona_id: p.id, pin: pin };
      if (!extra.alta && extra.apellido) cuerpo.apellido = extra.apellido;
      fetch(BASE + '/functions/v1/entrar', {
        method: 'POST',
        headers: { apikey: CLAVE, Authorization: 'Bearer ' + CLAVE, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, d: d }; });
      }).then(function (x) {
        ocupado = false;
        puntos.classList.remove('esperando');
        if (x.ok && x.d.access_token) {
          var per = x.d.persona || {};
          per.local = local.id ? local.nombre : '';   // como lo guarda Impecable
          _teclas = null;
          var abrir = function () {
            anotar(x.d, per);
            /* Lo que trajo la sesión, hasta que conteste la base (y la barra ya
               dice quién entró, o que espera el OK). */
            fijarYo({ id: per.id, nombre: per.nombre, rol: per.rol, aprobado: per.aprobado !== false, activo: true, provisorio: true });
            adentro(c);
          };
          /* SQL 110: entró con un PIN de 4 y su rol pide 6. Lo cambia con
             el que acaba de poner (orden_pin_cambiar pide el de ahora), y
             recién entonces se guarda la sesión. */
          if (x.d.cambiar_pin || per.cambiar_pin) { pasoCambiarPin(c, 6, cuerpo.pin, x.d.access_token, abrir); return; }
          abrir();
          return;
        }
        var d = x.d || {};
        /* Iba a crearlo y la base pide otro largo (la lista era de antes, o
           le cambiaron el rol mientras tanto): se vuelve a pedir con ése. */
        var otroLargo = crear && d.crear && /tener (\d) números/.exec(d.porque || '');
        if (otroLargo && Number(otroLargo[1]) !== largo) {
          pasoPin(c, local, Object.assign({}, p, { digitos: Number(otroLargo[1]) }), extra);
          return;
        }
        if (extra.alta) {
          primero = null; textos();
          mal(d.error === 'base' ? 'El alta todavía no está habilitada. Avisale a tu encargado.' : (d.porque || 'No se pudo anotar. Probá de nuevo.'));
          return;
        }
        /* Iba a crearlo, pero ya lo había creado (él en otro aparato, o
           alguien en su nombre): de acá en más es entrar con ese PIN. */
        if (crear && d.restantes != null) {
          crear = false; primero = null; textos();
          mal('Ese nombre ya tiene PIN. Si no lo creaste vos, avisale a tu encargado.');
          return;
        }
        if (d.espera > 0) mal((d.porque || 'Esperá un rato.') + ' Faltan ' + Math.ceil(d.espera / 60) + ' min.', d.espera);
        else if (d.restantes != null) mal('PIN incorrecto. ' + (d.restantes === 1 ? 'Te queda 1 intento.' : 'Te quedan ' + d.restantes + ' intentos.'));
        else { if (crear) { primero = null; textos(); } mal(d.porque || 'No se pudo entrar. Probá de nuevo.'); }
      }).catch(function () {
        ocupado = false;
        puntos.classList.remove('esperando');
        mal('Sin conexión. Probá de nuevo cuando haya señal.');
      });
    }
    _teclas = function (n) {
      if (ocupado) return;
      if (n === 'x') pin = pin.slice(0, -1);
      else if (pin.length < largo) pin += n;
      aviso.textContent = '';
      dibujar();
      if (pin.length < largo) return;
      if (crear && primero === null) { primero = pin; pin = ''; dibujar(); textos(); return; }
      if (crear && pin !== primero) { primero = null; textos(); mal('No coinciden. Empezá de nuevo.'); return; }
      mandar();
    };
    [].forEach.call(botones, function (t) { t.onclick = function () { _teclas(t.dataset.n); }; });
    textos();
  }

  /* Su rol pide un PIN más largo (SQL 110: 6 números para Administración,
     Atención y Gerencia) y acaba de entrar con el de antes: lo cambia ahora
     mismo, con la sesión recién abierta (todavía sin guardar) y el PIN que
     acaba de poner (sin volver a pedirlo). SÓLO acá: al abrir una pantalla,
     la sesión de una PC compartida puede ser de otro. La sesión se guarda
     recién con el PIN cambiado (abrir): si cierra la ventana, no entró. */
  /* "Cambiar mi PIN" del portón: su rol pide 6 números y el suyo es de 4
     (SQL 107: la base no lo deja entrar a lo de la oficina hasta cambiarlo).
     Con la sesión abierta, pide primero el PIN de ahora: en una PC
     compartida, el que se sienta después no puede cambiárselo. */
  function cambiarMiPin() {
    var c = abrirVelo();
    pasoPinActual(c, '');
  }
  function pasoPinActual(c, msg) {
    var pin = '', largo = 4, ocupado = false;
    c.innerHTML = '<h2 id="ncpTit">Tu PIN de ahora</h2>' +
      '<p class="ncp-bajada">Lo de la oficina pide un PIN de 6 números. Primero poné el de ahora (el de 4).</p>' +
      puntosDe(largo) + '<p class="ncp-aviso" data-aviso aria-live="polite"></p>' + TECLADO;
    var puntos = c.querySelector('[data-puntos]'), aviso = c.querySelector('[data-aviso]');
    if (msg) { aviso.className = 'ncp-aviso mal'; aviso.textContent = msg; }
    function dibujar() { [].forEach.call(puntos.children, function (d, i) { d.classList.toggle('lleno', i < pin.length); }); }
    _teclas = function (n) {
      if (ocupado) return;
      if (n === 'x') pin = pin.slice(0, -1);
      else if (pin.length < largo) pin += n;
      aviso.textContent = '';
      dibujar();
      if (pin.length < largo) return;
      ocupado = true;
      pasoCambiarPin(c, 6, pin, null, function () {
        cargando(c);
        refrescar().then(function () { cerrarVelo(); location.reload(); });
      }, function (porque) { pasoPinActual(c, porque); });
    };
    [].forEach.call(c.querySelectorAll('.ncp-teclado [data-n]'), function (b) { b.onclick = function () { _teclas(b.dataset.n); }; });
  }

  /* volver (opcional): el PIN de ahora no le sirvió; si no está, se cierra. */
  function pasoCambiarPin(c, largo, actual, tok, abrir, volver) {
    var pin = '', primero = null, ocupado = false;
    c.innerHTML = '<h2 id="ncpTit"></h2><p class="ncp-bajada" data-bajada></p>' + puntosDe(largo) +
      '<p class="ncp-aviso" data-aviso aria-live="polite"></p>' + TECLADO;
    var puntos = c.querySelector('[data-puntos]'), aviso = c.querySelector('[data-aviso]');
    var botones = c.querySelectorAll('.ncp-teclado [data-n]');
    function textos() {
      c.querySelector('#ncpTit').textContent = primero === null ? 'Tu PIN ahora es de ' + largo + ' números' : 'Repetí tu PIN nuevo';
      c.querySelector('[data-bajada]').textContent = primero === null
        ? 'Por seguridad, lo de la oficina pide un PIN de ' + largo + ' números. Para entrar, elegí uno nuevo: el de antes deja de servir.'
        : 'Poné los mismos ' + largo + ' números otra vez.';
    }
    function dibujar() { [].forEach.call(puntos.children, function (d, i) { d.classList.toggle('lleno', i < pin.length); }); }
    function mal(texto) {
      pin = ''; dibujar();
      puntos.classList.remove('mal'); void puntos.offsetWidth; puntos.classList.add('mal');
      aviso.className = 'ncp-aviso mal'; aviso.textContent = texto;
    }
    _teclas = function (n) {
      if (ocupado) return;
      if (n === 'x') pin = pin.slice(0, -1);
      else if (pin.length < largo) pin += n;
      aviso.textContent = '';
      dibujar();
      if (pin.length < largo) return;
      if (primero === null) { primero = pin; pin = ''; dibujar(); textos(); return; }
      if (pin !== primero) { primero = null; textos(); mal('No coinciden. Empezá de nuevo.'); return; }
      ocupado = true;
      aviso.className = 'ncp-aviso'; aviso.textContent = 'Guardando…';
      (tok ? Promise.resolve(tok) : token()).then(function (t) {
        return funcion('orden_pin_cambiar', { p_actual: actual, p_nuevo: pin }, t);
      }).then(function (r) {
        ocupado = false;
        if (!r || !r.ok) {
          primero = null; textos(); mal((r && r.porque) || 'No se pudo cambiar. Probá de nuevo.');
          /* El de ahora no le sirvió (lo cambiaron en otro lado, o quedó
             trabado): que entre de nuevo. */
          if (r && r.actual) {
            ocupado = true;
            if (volver) { setTimeout(function () { volver(r.porque || 'Tu PIN de ahora no es ése.'); }, 1200); }
            else { setTimeout(cerrarVelo, 2500); }
          }
          return;
        }
        _teclas = null;
        abrir();
      }).catch(function (e) {
        ocupado = false; primero = null; textos();
        mal(e && e.delServidor ? e.message : 'Sin conexión. Probá de nuevo cuando haya señal.');
      });
    };
    [].forEach.call(botones, function (b) { b.onclick = function () { _teclas(b.dataset.n); }; });
    textos();
  }

  /* Ya tiene sesión: si está aprobado se recarga la pantalla (la barra, la
     Carga y lo demás se arman con su rol); si no, espera el OK. */
  function adentro(c) {
    cargando(c);
    refrescar().then(function (y) {
      if (vigente(y)) { cerrarVelo(); location.reload(); return; }
      if (_ses) pasoEspera(c); else cerrarVelo();
    });
  }

  function pasoEspera(c) {
    _teclas = null;
    var y = _yo || {};
    var quien = y.rol === 'vendedor' ? 'tu encargado (o el administrador)' : 'el administrador';
    c.innerHTML = '<h2 id="ncpTit">Falta el OK</h2>' +
      '<p class="ncp-bajada">Hola, ' + txt(primerNombre(y.nombre)) + '. Tu PIN quedó creado. Antes de usarlo, ' + quien +
      ' tiene que confirmar que sos vos: pedíselo en persona. Mientras tanto la app se usa como siempre.</p>' +
      '<p class="ncp-aviso" data-aviso aria-live="polite"></p>' +
      '<div class="ncp-pie"><button type="button" class="btn btn-pri" data-ya>Ya me aprobaron</button>' +
      '<button type="button" class="btn btn-sec" data-salir>Salir</button></div>';
    c.querySelector('[data-ya]').onclick = function () {
      var aviso = c.querySelector('[data-aviso]');
      aviso.className = 'ncp-aviso';
      aviso.textContent = 'Revisando…';
      refrescar().then(function (y2) {
        if (vigente(y2)) { cerrarVelo(); location.reload(); return; }
        if (!_ses) { cerrarVelo(); return; }
        aviso.className = 'ncp-aviso mal';
        aviso.textContent = 'Todavía no. Pedíselo y probá de nuevo.';
      });
    };
    c.querySelector('[data-salir]').onclick = function () { salir().then(function () { cerrarVelo(); location.reload(); }); };
  }

  function abrirFicha() {
    var c = abrirVelo();
    if (!vigente(_yo)) { pasoEspera(c); return; }
    var y = _yo;
    /* El supervisor de varios locales (nc_yo le trae 'zona', aunque esté vacía) no maneja usuarios:
       sólo el administrador y el encargado (nc_quien_maneja). */
    var gestiona = y.rol === 'admin' || (y.rol === 'supervisor' && !y.zona);
    var zona = y.zona && y.zona.length ? y.zona.map(function (z) { return z.nombre; }).join(', ') : '';
    var extra = _enFicha && _enFicha(y);
    c.innerHTML = '<h2 id="ncpTit">' + txt(y.nombre) + '</h2>' +
      '<p class="ncp-bajada">' + txt(nombreRol(y)) + (y.local_nombre ? ' · ' + txt(y.local_nombre) : zona ? ' · ' + txt(zona) : '') + '</p>' +
      (y.rol === 'vendedor' || y.rol === 'supervisor'
        ? '<p class="ncp-nota">En No Compra aparecés como <b>' + txt(y.vendedor || y.nombre) + '</b>. Si carga otro, cambiá el vendedor ahí mismo.</p>' : '') +
      '<div class="ncp-pie">' +
        (gestiona && pagina() !== 'config.html' ? '<a class="btn btn-sec" href="config.html#usuarios">Usuarios</a>' : '') +
        (extra ? '<button type="button" class="btn btn-sec" data-extra>' + txt(extra.texto) + '</button>' : '') +
        '<button type="button" class="btn btn-pri" data-salir>No soy ' + txt(primerNombre(y.nombre)) + '</button>' +
      '</div>';
    if (extra) c.querySelector('[data-extra]').onclick = function () { cerrarVelo(); extra.hacer(); };
    c.querySelector('[data-salir]').onclick = function () {
      var b = this;
      b.disabled = true;
      salir().then(function () { cerrarVelo(); location.reload(); });
    };
  }

  /* ════════════════════════════════════════════════════════════════════
     EL PORTÓN de lo que antes pedía el PIN compartido (CRM, Socios, el
     Club, la lista de gift cards): entrar con su usuario, esperar el OK, o
     "esto no es de tu usuario". Cada pantalla le pasa dónde va y qué es.
     ════════════════════════════════════════════════════════════════════ */
  /* frase: qué es y de quién, entera ("El CRM es de Administración, Atención al cliente y Gerencia."). */
  function porton(cont, frase) {
    if (!cont) return;
    var y = _yo, hay = !!(_ses && _yo), html;
    if (!hay) {
      html = '<p class="ncp-porton-txt">' + txt(frase) + ' Entrá con tu usuario.</p>' +
             '<button type="button" class="btn btn-pri btn-ancho" data-porton="entrar">Entrar con tu usuario</button>';
    } else if (!vigente(y)) {
      html = '<p class="ncp-porton-txt">Tu usuario está esperando el OK. Cuando te aprueben, si sos de Administración, Atención al cliente o Gerencia, vas a poder entrar.</p>' +
             '<button type="button" class="btn btn-sec btn-ancho" data-porton="ficha">Ver mi usuario</button>';
    } else if (!oficina()) {
      html = '<p class="ncp-porton-txt">Entraste como <b>' + txt(y.nombre) + '</b> (' + txt(nombreRol(y)) + '). ' +
             txt(frase) + '</p>' +
             '<button type="button" class="btn btn-sec btn-ancho" data-porton="salir">No soy ' + txt(primerNombre(y.nombre)) + '</button>';
    } else if (!(y && y.pila)) {
      /* De la oficina, pero la base todavía no contestó (o le falta el SQL 107). */
      _pidioSinPila = true;
      html = '<p class="ncp-porton-txt">Entrando…</p>';
      listo.then(function () {
        if (!cont.isConnected || !oficina()) return;
        if (_yo && _yo.pila) {
          /* Contestó, pero no se pudo recargar sola (ver fijarYo). */
          cont.innerHTML = '<button type="button" class="btn btn-pri btn-ancho">Entrar</button>';
        } else if (_respondio) {
          cont.innerHTML = '<p class="ncp-porton-txt">Todavía no se puede entrar con el usuario: falta correr un paso en la base (el SQL 107). Avisale a Mauricio.</p>';
          return;
        } else {
          cont.innerHTML = '<p class="ncp-porton-txt">No se pudo hablar con la base. Revisá la conexión y probá de nuevo.</p>' +
                           '<button type="button" class="btn btn-sec btn-ancho">Probar de nuevo</button>';
        }
        cont.querySelector('button').onclick = function () { location.reload(); };
      });
    } else if (y.pin_corto) {
      /* SQL 107: su PIN es de 4 y su rol pide 6; la base no lo deja entrar. */
      html = '<p class="ncp-porton-txt">Tu PIN es de 4 números y lo de la oficina pide uno de 6. Cambialo para entrar.</p>' +
             '<button type="button" class="btn btn-pri btn-ancho" data-porton="pin">Cambiar mi PIN</button>';
    } else {
      html = '';   // es de la oficina: la pantalla ya está entrando
    }
    cont.innerHTML = html;
    var b = cont.querySelector('[data-porton]');
    if (b) b.onclick = function () {
      var a = b.getAttribute('data-porton');
      if (a === 'entrar') entrar();
      else if (a === 'ficha') abrirFicha();
      else if (a === 'pin') cambiarMiPin();
      else { b.disabled = true; salir().then(function () { location.reload(); }); }
    };
  }

  /* ════════════════════════════════════════════════════════════════════
     ARRANQUE
     ════════════════════════════════════════════════════════════════════ */

  var listo = new Promise(function (resolver) {
    var arrancar = function () {
      pintarBarra();
      revisarAcceso();
      refrescar().then(resolver, function () { resolver(null); });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
    else arrancar();
  });

  /* El aviso de las diferencias de los remitos: cuando la base dijo quién es, y de nuevo si entra otro. */
  var _listoYa = false;
  listo.then(function () { _listoYa = true; avisoDiferencias(); });
  document.addEventListener('persona', function () { if (_listoYa) avisoDiferencias(); });

  /* La Carga mandó la sesión y la base no la aceptó (datos.js): se pregunta
     de nuevo, y si tampoco vale, se cierra. */
  document.addEventListener('nc-sesion-rechazada', function () { refrescar(); });

  /* Entró o salió en otra pestaña (o en Impecable): la barra se pone al día. */
  window.addEventListener('storage', function (e) {
    if (e.key !== K_SESION) return;
    var g = leerLS(K_SESION);
    if (!g) { limpiarSiSalio(); _ses = null; fijarYo(null); return; }
    var otra = !_ses || !_ses.persona || !g.persona || g.persona.id !== _ses.persona.id;
    _ses = g;
    if (otra) {
      /* Entró otra persona en otra pestaña: se usa enseguida lo que esa
         pestaña dejó guardado de ella (su rol), y la base lo confirma. */
      var c = leerLS(K_YO), p = g.persona || {};
      fijarYo(c && c.id === p.id ? c : (p.id ? { id: p.id, nombre: p.nombre, rol: p.rol, aprobado: p.aprobado !== false, activo: true, provisorio: true } : null));
      refrescar();
    }
  });

  return {
    ROL: ROL,
    listo: listo,
    /** Las diferencias de los remitos (SQL 167): volver a preguntar (el POS, al resolver o anular) y darlas por vistas. */
    avisoDiferencias: avisoDiferencias,
    difVistas: difVistas,
    /** La persona habilitada (activa y aprobada), o null. */
    yo: function () { return vigente(_yo) ? _yo : null; },
    rol: rol,
    /** Quien entró es de la oficina (Administración, Atención o Gerencia, o un vendedor con la casilla de Atención). */
    oficina: oficina,
    /** Lo que va en lugar del PIN: la marca de la sesión, o '' si no es de la oficina. */
    pin: function () {
      if (!oficina()) return '';
      /* 'pila' la devuelve nc_yo recién con el SQL 107, que es el que sabe
         qué es la marca: antes, la base la contaría como un PIN compartido
         equivocado y trabaría a todos. Si llega después, se recarga (ver fijarYo). */
      if (!(_yo && _yo.pila)) { _pidioSinPila = true; return ''; }
      /* Su PIN es de 4 y su rol pide 6: la base no lo deja (el portón lo dice). */
      if (_yo.pin_corto) return '';
      return 'sesion';
    },
    /** El nombre de pila, para el "¿Quién sos?" del CRM ("Ale", "Lau"). */
    pila: function () {
      var y = vigente(_yo) ? _yo : null;
      return y ? (y.pila || String(y.nombre || '').replace(/\s+[A-ZÁÉÍÓÚÑ]\.$/, '')) : '';
    },
    porton: porton,
    /** Un botón más en la ficha de quién entró: fn(yo) devuelve {texto, hacer} o nada.
        La Carga pone ahí "Local de esta compu" para el administrador (23/10). */
    ponerEnFicha: function (fn) { _enFicha = fn; },
    /** Hay una sesión en este aparato (aunque esté esperando el OK). */
    hay: function () { return !!(_ses && _yo); },
    puede: puede,
    token: token,
    tokenSiHay: tokenSiHay,
    entrar: entrar,
    /** Cambiar el PIN de 4 por uno de 6 (el de ahora y el nuevo dos veces). */
    cambiarPin: cambiarMiPin,
    salir: salir,
    refrescar: refrescar
  };
})();
