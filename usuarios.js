/**
 * VDH · Sistema No Compra — Config → Usuarios (13/10/2026).
 *
 * El administrador ve y maneja a todos; el encargado, a los vendedores de su
 * local (crearlos, aprobarlos, borrarles el PIN y desactivarlos, pero no
 * cambiarles el rol ni el local). Lo decide la base (nc_usuarios y las
 * nc_usuario_*, en supabase/personas.sql): esta pantalla sólo no ofrece lo
 * que después se va a rechazar.
 *
 * Crear un usuario no le pone el PIN: la persona lo crea la primera vez que
 * entra, y ahí queda esperando que alguien confirme en persona que fue ella
 * (es lo que impide que alguien cree el PIN de otro). Aprobar es la misma
 * función de Impecable, así que un vendedor aprobado entra también en la
 * lista de la Carga de su local.
 */
var usuarios = (function () {
  'use strict';

  var ROL = persona.ROL;
  var ROLES_ADMIN = ['vendedor', 'supervisor', 'atencion', 'gerencia', 'admin'];
  var QUE_VE = 'Vendedor: Carga, Cobrar, Gift Cards, Asistente, las estadísticas de su local e Impecable. ' +
               'Encargado: lo mismo, y crea los vendedores de su local. Atención al cliente: todo menos Impecable. ' +
               'Administrador y Gerencia: todo.';

  var datos = null;
  var filtro = { local: '', desactivados: false };
  var editando = null;
  var ocupado = false;

  function cuerpo() { return document.getElementById('usuariosCuerpo'); }
  function llamar(nombre, args) {
    return persona.token().then(function (t) { return funcion(nombre, args || {}, t); });
  }
  function bloque(tit, sub, resto) {
    return '<div class="bloque"><h2 class="bloque-tit">' + esc(tit) + '</h2>' +
      (sub ? '<p class="bloque-sub">' + sub + '</p>' : '') + (resto || '') + '</div>';
  }

  /* ═══ Qué se ve, según quién entró ═════════════════════════════════════ */
  function mostrar() {
    var c = cuerpo();
    if (!c) return;
    var yo = persona.yo();
    if (!yo) {
      c.innerHTML = bloque('Usuarios',
        'Cada persona entra con su local, su nombre y su PIN. Los usuarios los crean el administrador (a todos) y los encargados (a los vendedores de su local).',
        '<button type="button" class="btn btn-pri" id="usEntrar">Entrar con tu usuario</button>' +
        '<p class="us-nota">' + esc(QUE_VE) + '</p>');
      document.getElementById('usEntrar').onclick = function () { persona.entrar(); };
      return;
    }
    if (yo.rol !== 'admin' && yo.rol !== 'supervisor') {
      c.innerHTML = bloque('Usuarios', 'Los usuarios los manejan el administrador y los encargados. Entraste como ' +
        esc(yo.nombre) + ' (' + esc(ROL[yo.rol]) + ').');
      return;
    }
    if (!datos) c.innerHTML = '<div class="bloque"><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>';
    traer();
  }

  function traer() {
    return llamar('nc_usuarios').then(function (d) {
      if (!d || d.error) {
        cuerpo().innerHTML = bloque('Usuarios', esc((d && d.porque) || 'No se pudo traer la lista.'));
        return;
      }
      datos = d;
      dibujar();
    }).catch(function (e) {
      if (e && e.sinSesion) { datos = null; mostrar(); return; }
      if (sesionMuerta(e)) return;
      cuerpo().innerHTML = bloque('Usuarios', esc(e && e.delServidor ? e.message : 'No se pudo conectar. Revisá la señal y recargá.'));
    });
  }

  /* La base ya no acepta el token (le borraron la cuenta: lo desactivaron o
     le borraron el PIN). persona.refrescar() cierra la sesión y la pantalla
     vuelve a pedir que entre. */
  function sesionMuerta(e) {
    if (!(e && e.delServidor && /JWT/i.test(e.message))) return false;
    datos = null;
    persona.refrescar().then(mostrar);
    return true;
  }

  /* ═══ La pantalla ═══════════════════════════════════════════════════════ */
  function nombreLocal(id) {
    if (!id) return 'Sin local';
    for (var i = 0; i < datos.locales.length; i++) if (datos.locales[i].id === id) return datos.locales[i].nombre;
    return 'Otro local';
  }
  function esAdmin() { return datos && datos.yo.rol === 'admin'; }

  function dibujar() {
    var admin = esAdmin();
    var pend = datos.personas.filter(function (p) { return p.activo && !p.aprobado && p.pin && !p.soy; });
    var html = '<div class="us-grilla"><div class="us-col">';

    if (pend.length) {
      html += bloque('Esperan tu OK (' + pend.length + ')',
        'Crearon su PIN. Confirmá en persona que fue cada uno antes de aprobarlo.',
        '<div class="us-lista">' + pend.map(function (p) {
          return '<div class="us-fila us-pend" data-id="' + esc(p.id) + '">' +
            '<div class="us-quien"><b>' + esc(p.nombre + ' ' + (p.apellido || '')) + '</b>' +
            '<span>' + esc(ROL[p.rol] || p.rol) + ' · ' + esc(nombreLocal(p.local_id)) + (p.alta_propia ? ' · se anotó solo' : '') + '</span></div>' +
            '<div class="us-acciones">' +
              '<button type="button" class="btn btn-pri btn-chico" data-acc="aprobar">Sí, es ' + (p.alta_propia ? 'de acá' : 'él o ella') + '</button>' +
              '<button type="button" class="btn btn-sec btn-chico" data-acc="rechazar">' + (p.alta_propia ? 'No lo conozco' : 'No fue') + '</button>' +
            '</div></div>';
        }).join('') + '</div>');
    }

    var sub = admin
      ? 'Todos los que entran al No Compra y a Impecable. El rol y el local los cambiás vos.'
      : 'Los vendedores de ' + esc(nombreLocal(datos.yo.local_id)) + '. Podés crearlos, aprobarlos, borrarles el PIN y desactivarlos.';
    var filtros = '';
    if (admin) {
      filtros = '<div class="us-filtros"><select id="usFiltroLocal" aria-label="Local">' +
        '<option value="">Todos los locales</option>' +
        datos.locales.map(function (l) { return '<option value="' + esc(l.id) + '"' + (filtro.local === l.id ? ' selected' : '') + '>' + esc(l.nombre) + '</option>'; }).join('') +
        '<option value="-"' + (filtro.local === '-' ? ' selected' : '') + '>Sin local (Administración y Atención)</option></select>' +
        '<label class="us-check"><input type="checkbox" id="usVerDesact"' + (filtro.desactivados ? ' checked' : '') + '> Ver desactivados</label></div>';
    } else {
      filtros = '<div class="us-filtros"><label class="us-check"><input type="checkbox" id="usVerDesact"' + (filtro.desactivados ? ' checked' : '') + '> Ver desactivados</label></div>';
    }
    html += bloque(admin ? 'Usuarios' : 'Tu equipo', sub, filtros + '<div class="us-lista" id="usLista">' + lista() + '</div>');
    html += '</div><div class="us-col">' + formCrear() + '</div></div>';

    cuerpo().innerHTML = html;
    enganchar();
  }

  function lista() {
    var admin = esAdmin();
    var gente = datos.personas.filter(function (p) {
      if (!filtro.desactivados && !p.activo) return false;
      if (filtro.local === '-') return !p.local_id;
      if (filtro.local) return p.local_id === filtro.local;
      return true;
    });
    if (!gente.length) return '<p class="us-vacio">No hay nadie' + (filtro.local ? ' en este local' : '') + '. Crealo con el formulario.</p>';
    /* Con "todos", agrupados por local (los sin local, al final). */
    gente.sort(function (a, b) {
      return (!a.local_id - !b.local_id) ||
        nombreLocal(a.local_id).localeCompare(nombreLocal(b.local_id), 'es') ||
        (b.activo - a.activo) || String(a.nombre).localeCompare(b.nombre, 'es');
    });
    var html = '', grupo = null;
    gente.forEach(function (p) {
      if (admin && !filtro.local) {
        var g = p.local_id ? nombreLocal(p.local_id) : 'Administración y Atención';
        if (g !== grupo) { html += '<h3 class="us-grupo">' + esc(g) + '</h3>'; grupo = g; }
      }
      html += fila(p);
    });
    return html;
  }

  function estado(p) {
    if (!p.activo) return ['neutra', 'Desactivado'];
    if (!p.pin) return ['info', p.en_lista ? 'Falta crear su PIN' : 'Fuera de la lista'];
    if (!p.aprobado) return ['warn', 'Espera el OK'];
    return ['ok', 'Activo'];
  }

  function fila(p) {
    var admin = esAdmin();
    var e = estado(p);
    var toca = !p.soy && (admin || p.rol === 'vendedor');
    var acc = '';
    if (editando === p.id) return filaEditor(p);
    if (admin && !p.soy) acc += '<button type="button" class="btn btn-sec btn-chico" data-acc="cambiar">Cambiar</button>';
    if (toca && p.activo && (p.pin || !p.en_lista)) {
      acc += '<button type="button" class="btn btn-sec btn-chico" data-acc="pin">' + (p.en_lista ? 'Borrar PIN' : 'Poner en la lista') + '</button>';
    }
    if (toca) acc += '<button type="button" class="btn btn-sec btn-chico" data-acc="' + (p.activo ? 'desactivar' : 'reactivar') + '">' + (p.activo ? 'Desactivar' : 'Reactivar') + '</button>';
    return '<div class="us-fila' + (p.activo ? '' : ' apagada') + '" data-id="' + esc(p.id) + '">' +
      '<div class="us-quien"><b>' + esc(p.nombre + ' ' + (p.apellido || '')) + (p.soy ? ' <small>(vos)</small>' : '') + '</b>' +
      /* El local no se repite: la lista ya está agrupada (o filtrada) por local. */
      '<span>' + esc(ROL[p.rol] || p.rol) + '</span></div>' +
      '<span class="pill pill-' + e[0] + '">' + esc(e[1]) + '</span>' +
      (acc ? '<div class="us-acciones">' + acc + '</div>' : '') +
      '</div>';
  }

  function opcionesLocal(sel, conSinLocal) {
    return (conSinLocal ? '<option value="">Sin local</option>' : '<option value="">Elegí el local…</option>') +
      datos.locales.map(function (l) { return '<option value="' + esc(l.id) + '"' + (sel === l.id ? ' selected' : '') + '>' + esc(l.nombre) + '</option>'; }).join('');
  }
  function opcionesRol(sel) {
    return ROLES_ADMIN.map(function (r) { return '<option value="' + r + '"' + (sel === r ? ' selected' : '') + '>' + esc(ROL[r]) + '</option>'; }).join('');
  }
  function sinLocal(rol) { return rol === 'atencion' || rol === 'admin'; }

  function filaEditor(p) {
    return '<div class="us-fila us-editando" data-id="' + esc(p.id) + '">' +
      '<div class="us-quien"><b>' + esc(p.nombre + ' ' + (p.apellido || '')) + '</b><span>Cambiar el rol o el local</span></div>' +
      '<div class="us-editor">' +
        '<select data-ed="rol" aria-label="Rol">' + opcionesRol(p.rol) + '</select>' +
        '<select data-ed="local" aria-label="Local"' + (sinLocal(p.rol) ? ' hidden' : '') + '>' + opcionesLocal(p.local_id || '', p.rol === 'gerencia') + '</select>' +
        '<button type="button" class="btn btn-pri btn-chico" data-acc="guardar">Guardar</button>' +
        '<button type="button" class="btn btn-sec btn-chico" data-acc="cancelar">Cancelar</button>' +
      '</div></div>';
  }

  function formCrear() {
    var admin = esAdmin();
    return bloque('Crear un usuario',
      'Después, esa persona entra con su local y su nombre y crea su PIN. Ahí te aparece en "Esperan tu OK" para que confirmes que fue ella.',
      '<div class="campos">' +
        '<div class="campo"><label for="usNombre">Nombre</label><input type="text" id="usNombre" maxlength="30" autocomplete="off" autocapitalize="words"></div>' +
        '<div class="campo"><label for="usApellido">Apellido</label><input type="text" id="usApellido" maxlength="30" autocomplete="off" autocapitalize="words"></div>' +
        (admin
          ? '<div class="campo"><label for="usRol">Rol</label><select id="usRol">' + opcionesRol('vendedor') + '</select></div>' +
            '<div class="campo" id="usCampoLocal"><label for="usLocal">Local</label><select id="usLocal">' + opcionesLocal('', false) + '</select></div>'
          : '<div class="campo ancho"><span class="campo-lbl">Rol</span><span class="us-fijo">Vendedor de ' + esc(nombreLocal(datos.yo.local_id)) + '</span></div>') +
        '<div class="campo ancho"><button type="button" class="btn btn-pri" id="usCrear">Crear usuario</button></div>' +
      '</div>' +
      (admin ? '<p class="us-nota">' + esc(QUE_VE) + '</p>' : ''));
  }

  /* ═══ Lo que se toca ════════════════════════════════════════════════════ */
  function persona_(id) {
    for (var i = 0; i < datos.personas.length; i++) if (datos.personas[i].id === id) return datos.personas[i];
    return null;
  }

  /* Las funciones nuevas contestan {ok:false, porque}; la de aprobar, de
     Impecable, tira error. Las dos cosas terminan en el mismo cartel. */
  function hacer(nombre, args, mensajeOk) {
    if (ocupado) return Promise.resolve(false);
    ocupado = true;
    return llamar(nombre, args).then(function (r) {
      ocupado = false;
      if (r && r.ok === false) { avisar('err', r.porque || 'No se pudo.'); return false; }
      if (mensajeOk) avisar('ok', mensajeOk);
      return traer().then(function () { return true; });
    }).catch(function (e) {
      ocupado = false;
      if (e && e.sinSesion) { avisar('err', e.message); datos = null; mostrar(); return false; }
      if (sesionMuerta(e)) return false;
      avisar('err', e && e.delServidor ? e.message : 'Sin conexión. Probá de nuevo.');
      return false;
    });
  }

  function enganchar() {
    var c = cuerpo();
    var fl = document.getElementById('usFiltroLocal');
    if (fl) fl.onchange = function () { filtro.local = fl.value; document.getElementById('usLista').innerHTML = lista(); };
    var vd = document.getElementById('usVerDesact');
    if (vd) vd.onchange = function () { filtro.desactivados = vd.checked; document.getElementById('usLista').innerHTML = lista(); };

    c.onclick = function (ev) {
      var b = ev.target.closest('[data-acc]');
      if (!b) return;
      var f = b.closest('[data-id]'), p = f && persona_(f.dataset.id);
      if (!p) return;
      var nom = p.nombre + ' ' + (p.apellido || '');
      switch (b.dataset.acc) {
        case 'aprobar':
          hacer('orden_aprobar_persona', { p_persona: p.id, p_aprobar: true }, nom + ' quedó aprobado.');
          break;
        case 'rechazar':
          if (!confirm(p.alta_propia
            ? '¿No conocés a ' + nom + '? Queda desactivado y no puede entrar.'
            : '¿No fue ' + nom + ' quien creó ese PIN? Se borra ese PIN y ' + p.nombre + ' vuelve a la lista para crear el suyo.')) return;
          hacer('orden_aprobar_persona', { p_persona: p.id, p_aprobar: false }, p.alta_propia ? nom + ' quedó afuera.' : 'Listo: ese PIN se borró.');
          break;
        case 'cambiar':
          editando = p.id;
          document.getElementById('usLista').innerHTML = lista();
          break;
        case 'cancelar':
          editando = null;
          document.getElementById('usLista').innerHTML = lista();
          break;
        case 'guardar':
          var rol = f.querySelector('[data-ed="rol"]').value, loc = f.querySelector('[data-ed="local"]').value || null;
          if (p.local_id && loc && loc !== p.local_id && p.rol === 'vendedor' &&
              !confirm('¿Pasar a ' + nom + ' a ' + nombreLocal(loc) + '? Sale de la lista de la Carga de ' + nombreLocal(p.local_id) + ' y entra en la del local nuevo.')) return;
          hacer('nc_usuario_cambiar', { p_persona: p.id, p_rol: rol, p_local: sinLocal(rol) ? null : loc }, 'Guardado.')
            .then(function (ok) { if (ok) { editando = null; document.getElementById('usLista').innerHTML = lista(); } });
          break;
        case 'pin':
          if (p.en_lista && !confirm('¿Borrarle el PIN a ' + nom + '? La próxima vez que entre crea uno nuevo, y lo tenés que aprobar otra vez.')) return;
          hacer('nc_usuario_pin_borrar', { p_persona: p.id }, p.en_lista ? 'PIN borrado: la próxima vez crea uno nuevo.' : nom + ' ya aparece para crear su PIN.');
          break;
        case 'desactivar':
          if (!confirm('¿Desactivar a ' + nom + '? No va a poder entrar (ni acá ni en Impecable) y sale de la lista de la Carga. Se puede reactivar.')) return;
          hacer('nc_usuario_activar', { p_persona: p.id, p_activo: false }, nom + ' quedó desactivado.');
          break;
        case 'reactivar':
          hacer('nc_usuario_activar', { p_persona: p.id, p_activo: true }, nom + ' volvió a estar activo.');
          break;
      }
    };
    /* En el editor, el local se esconde para los roles que no tienen. */
    c.onchange = function (ev) {
      var s = ev.target;
      if (s.dataset && s.dataset.ed === 'rol') {
        var loc = s.closest('.us-editor').querySelector('[data-ed="local"]');
        loc.hidden = sinLocal(s.value);
        loc.innerHTML = opcionesLocal(loc.value, s.value === 'gerencia');
      }
    };

    var rolSel = document.getElementById('usRol');
    if (rolSel) rolSel.onchange = function () {
      var l = document.getElementById('usLocal');
      document.getElementById('usCampoLocal').hidden = sinLocal(rolSel.value);
      l.innerHTML = opcionesLocal(l.value, rolSel.value === 'gerencia');
    };
    var crear = function () {
      var n = document.getElementById('usNombre').value.trim(), a = document.getElementById('usApellido').value.trim();
      if (!n) { avisar('err', 'Escribí el nombre.'); document.getElementById('usNombre').focus(); return; }
      if (!a) { avisar('err', 'Escribí el apellido.'); document.getElementById('usApellido').focus(); return; }
      var rol = rolSel ? rolSel.value : 'vendedor';
      var loc = rolSel ? (document.getElementById('usLocal').value || null) : datos.yo.local_id;
      if ((rol === 'vendedor' || rol === 'supervisor') && !loc) { avisar('err', 'Elegí el local.'); document.getElementById('usLocal').focus(); return; }
      var b = document.getElementById('usCrear');
      b.disabled = true;
      hacer('nc_usuario_crear', { p_nombre: n, p_apellido: a, p_rol: rol, p_local: sinLocal(rol) ? null : loc },
            n + ' quedó creado. Decile que entre con su local y su nombre, y que cree su PIN.')
        .then(function (ok) {
          var b2 = document.getElementById('usCrear');
          if (b2) b2.disabled = false;
          if (!ok) return;
          /* traer() volvió a dibujar todo: el formulario quedó vacío. */
        });
    };
    var bc = document.getElementById('usCrear');
    if (bc) bc.onclick = crear;
    var ap = document.getElementById('usApellido');
    if (ap) ap.onkeydown = function (e) { if (e.key === 'Enter') crear(); };
  }

  return { mostrar: mostrar };
})();
