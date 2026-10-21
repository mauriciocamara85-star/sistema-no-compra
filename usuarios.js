/**
 * VDH · Sistema No Compra — Config → Usuarios (13/10/2026).
 *
 * El administrador ve y maneja a todos; el encargado, a los vendedores de su
 * local (crearlos, aprobarlos, borrarles el PIN y desactivarlos, pero no
 * cambiarles el rol ni el local). Lo decide la base (nc_usuarios y las
 * nc_usuario_*, en supabase/personas.sql): esta pantalla sólo no ofrece lo
 * que después se va a rechazar.
 *
 * Los francos de cada uno también se cargan acá (SQL 154, 21/10): el
 * administrador a cualquiera y el encargado a sus vendedores. Antes estaban
 * en Supervisión → Ajustes → Personas, que se sacó porque repetía esta pantalla.
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
  /* SQL 141: en la base, el encargado y el supervisor son el mismo rol ('supervisor'): el encargado
     tiene su local y el supervisor no, y sus locales van aparte (orden_supervision). En la pantalla
     son dos opciones; 'zona' es la del supervisor. Gerencia ya no se ofrece (Mauricio, 19/10): sólo
     aparece si alguien ya la tiene. */
  var ROLES_ADMIN = ['vendedor', 'supervisor', 'zona', 'atencion', 'admin'];
  var NOMBRE_ROL = { vendedor: 'Vendedor', supervisor: 'Encargado (un local)', zona: 'Supervisor (varios locales)',
                     atencion: 'Atención al cliente', admin: 'Administrador', gerencia: 'Gerencia' };
  var QUE_VE = 'Vendedor: Carga, Cobrar, Gift Cards, Asistente, las estadísticas de su local y la app Equipo VDH. ' +
               'Encargado: lo mismo, más Supervisión de su local, y crea los vendedores de su local. Supervisor: como el encargado, en los ' +
               'locales que le elijas (las planillas de Ventas, el No Compra y Supervisión de cada uno), sin crear usuarios. ' +
               'Atención al cliente: todo menos Supervisión y Equipo VDH; en Ventas, sólo el E-commerce (entra por "E-commerce"). Administrador: todo. Un vendedor, encargado o supervisor ' +
               'que además atiende clientes ("También atiende clientes", en Cambiar) suma lo de Atención, con un PIN de 6 números.';
  function esZona(p) { return p.rol === 'supervisor' && !p.local_id; }
  /** El rol como lo muestra la pantalla: el supervisor sin local es 'zona'. */
  function rolEd(p) { return esZona(p) ? 'zona' : p.rol; }
  /* SQL 135: la casilla es para quien es de un local; Atención y Administración ya ven todo eso. */
  function puedeAtencion(rol) { return rol === 'vendedor' || rol === 'supervisor' || rol === 'zona'; }
  /** Los locales de un supervisor, por nombre ("Flores, Ituzaingó, Morón"); los que pidió y nadie aprobó, marcados. */
  function susLocales(p) {
    return (p.supervisa || []).map(function (s) { return { n: nombreLocal(s.id), ok: s.aprobado }; })
      .sort(function (a, b) { return a.n.localeCompare(b.n, 'es'); })
      .map(function (s) { return s.n + (s.ok ? '' : ' (lo pidió)'); }).join(', ');
  }
  function rolDe(p) {
    var r = esZona(p) ? 'Supervisor' : (ROL[p.rol] || p.rol);
    if (p.tambien_atencion && puedeAtencion(p.rol)) r += ' + Atención al cliente';
    if (esZona(p)) r += ' · ' + (susLocales(p) || 'sin locales todavía');
    return r;
  }
  /* SQL 154: los francos (antes en Supervisión → Ajustes → Personas). Los tiene quien es de un local, el
     vendedor y el encargado: los usan los vencimientos de Equipo VDH, los avisos y la planilla de Ventas.
     En la base van de 1 (lunes) a 7 (domingo). */
  var DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  var DIAS_LARGO = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  var LOS_DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'];
  function tieneFranco(rol) { return rol === 'vendedor' || rol === 'supervisor'; }
  function conFranco(p) { return !!p.local_id && tieneFranco(p.rol); }
  /** "los martes", "los lunes, viernes, sábados y domingos". */
  function losDias(dias) {
    var d = dias.map(function (k) { return LOS_DIAS[k - 1]; });
    return 'los ' + (d.length > 1 ? d.slice(0, -1).join(', ') + ' y ' + d[d.length - 1] : d[0]);
  }
  function francoDe(p) { return (p.francos || []).length ? 'franco ' + losDias(p.francos) : 'sin franco fijo'; }

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
    if (!yo && persona.hay()) {
      c.innerHTML = bloque('Usuarios', 'Tu usuario está esperando el OK. Cuando te aprueben, si sos encargado o administrador, acá vas a ver la lista.');
      return;
    }
    if (!yo) {
      c.innerHTML = bloque('Usuarios',
        'Cada persona entra con su local, su nombre y su PIN. Los usuarios los crean el administrador (a todos) y los encargados (a los vendedores de su local).',
        '<button type="button" class="btn btn-pri" id="usEntrar">Entrar con tu usuario</button>' +
        '<p class="us-nota">' + esc(QUE_VE) + '</p>');
      document.getElementById('usEntrar').onclick = function () { persona.entrar(); };
      return;
    }
    /* El supervisor de varios locales no maneja usuarios (nc_quien_maneja): los de sus locales los crean
       los encargados. Se lo reconoce por la 'zona' de nc_yo (SQL 141): el encargado que recién entró por
       Equipo VDH todavía no tiene su local acá. */
    var zonaYo = yo.rol === 'supervisor' && Array.isArray(yo.zona);
    if (yo.rol !== 'admin' && (yo.rol !== 'supervisor' || zonaYo)) {
      c.innerHTML = bloque('Usuarios', 'Los usuarios los manejan el administrador y los encargados. Entraste como ' +
        esc(yo.nombre) + ' (' + esc(zonaYo ? 'Supervisor' : ROL[yo.rol]) + ').');
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
    if (!(e && e.delServidor && (e.status === 401 || e.status === 403 || /JWT/i.test(e.message)))) return false;
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
  /* Sin el SQL 154, nc_usuarios no trae los francos: no se muestran ni se ofrecen. */
  function hayFrancos() { return !!datos && datos.personas.some(function (p) { return 'francos' in p; }); }

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
            '<span>' + esc(rolDe(p)) + (esZona(p) ? '' : ' · ' + esc(nombreLocal(p.local_id))) + (p.alta_propia ? ' · se anotó solo' : '') + '</span></div>' +
            '<div class="us-acciones">' +
              '<button type="button" class="btn btn-pri btn-chico" data-acc="aprobar">Sí, es ' + (p.alta_propia ? 'de acá' : 'él o ella') + '</button>' +
              '<button type="button" class="btn btn-sec btn-chico" data-acc="rechazar">' + (p.alta_propia ? 'No lo conozco' : 'No fue') + '</button>' +
            '</div></div>';
        }).join('') + '</div>');
    }

    var sub = admin
      ? 'Todos los que entran al No Compra y a Equipo VDH. ' + (hayFrancos() ? 'El rol, el local y los francos' : 'El rol y el local') + ' los cambiás vos.'
      : 'Los vendedores de ' + esc(nombreLocal(datos.yo.local_id)) + '. Podés crearlos, aprobarlos, ' + (hayFrancos() ? 'cambiarles los francos, ' : '') +
        'borrarles el PIN y desactivarlos. Reactivar a alguien lo hace el administrador.';
    var filtros = '';
    if (admin) {
      filtros = '<div class="us-filtros"><select id="usFiltroLocal" aria-label="Local">' +
        '<option value="">Todos los locales</option>' +
        datos.locales.map(function (l) { return '<option value="' + esc(l.id) + '"' + (filtro.local === l.id ? ' selected' : '') + '>' + esc(l.nombre) + '</option>'; }).join('') +
        '<option value="z"' + (filtro.local === 'z' ? ' selected' : '') + '>Supervisores</option>' +
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
    /* Un local muestra también a los supervisores que lo tienen (SQL 141). */
    var supervisa = function (p, id) { return (p.supervisa || []).some(function (s) { return s.id === id; }); };
    var gente = datos.personas.filter(function (p) {
      if (!filtro.desactivados && !p.activo) return false;
      if (filtro.local === 'z') return esZona(p);
      if (filtro.local === '-') return !p.local_id && !esZona(p);
      if (filtro.local) return p.local_id === filtro.local || (esZona(p) && supervisa(p, filtro.local));
      return true;
    });
    if (!gente.length) return '<p class="us-vacio">No hay nadie' + (filtro.local && filtro.local !== 'z' && filtro.local !== '-' ? ' en este local' : '') + '. Crealo con el formulario.</p>';
    /* Con "todos", agrupados por local; después los supervisores y, al final, los sin local. */
    var orden = function (p) { return p.local_id ? 0 : esZona(p) ? 1 : 2; };
    gente.sort(function (a, b) {
      return (orden(a) - orden(b)) ||
        nombreLocal(a.local_id).localeCompare(nombreLocal(b.local_id), 'es') ||
        (b.activo - a.activo) || String(a.nombre).localeCompare(b.nombre, 'es');
    });
    var html = '', grupo = null;
    gente.forEach(function (p) {
      if (admin && !filtro.local) {
        var g = p.local_id ? nombreLocal(p.local_id) : esZona(p) ? 'Supervisores' : 'Administración y Atención';
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
    /* El encargado sólo cambia los francos de sus vendedores (SQL 154). */
    else if (!admin && toca && p.activo && hayFrancos()) acc += '<button type="button" class="btn btn-sec btn-chico" data-acc="cambiar">Francos</button>';
    if (toca && p.activo && (p.pin || !p.en_lista)) {
      acc += '<button type="button" class="btn btn-sec btn-chico" data-acc="pin">' + (p.en_lista ? 'Borrar PIN' : 'Poner en la lista') + '</button>';
    }
    /* Reactivar es del administrador, como en Impecable: el encargado
       desactiva, pero no vuelve a dejar entrar a alguien que sacó otro. */
    if (toca && (p.activo || admin)) acc += '<button type="button" class="btn btn-sec btn-chico" data-acc="' + (p.activo ? 'desactivar' : 'reactivar') + '">' + (p.activo ? 'Desactivar' : 'Reactivar') + '</button>';
    return '<div class="us-fila' + (p.activo ? '' : ' apagada') + '" data-id="' + esc(p.id) + '">' +
      '<div class="us-quien"><b>' + esc(p.nombre + ' ' + (p.apellido || '')) + (p.soy ? ' <small>(vos)</small>' : '') + '</b>' +
      /* El local no se repite: la lista ya está agrupada (o filtrada) por local. */
      '<span>' + esc(rolDe(p)) + (hayFrancos() && conFranco(p) ? ' · ' + esc(francoDe(p)) : '') + '</span></div>' +
      '<span class="pill pill-' + e[0] + '">' + esc(e[1]) + '</span>' +
      (acc ? '<div class="us-acciones">' + acc + '</div>' : '') +
      '</div>';
  }

  function opcionesLocal(sel, conSinLocal) {
    return (conSinLocal ? '<option value="">Sin local</option>' : '<option value="">Elegí el local…</option>') +
      datos.locales.map(function (l) { return '<option value="' + esc(l.id) + '"' + (sel === l.id ? ' selected' : '') + '>' + esc(l.nombre) + '</option>'; }).join('');
  }
  function opcionesRol(sel) {
    var roles = ROLES_ADMIN.concat(sel === 'gerencia' ? ['gerencia'] : []);
    return roles.map(function (r) { return '<option value="' + r + '"' + (sel === r ? ' selected' : '') + '>' + esc(NOMBRE_ROL[r]) + '</option>'; }).join('');
  }
  function sinLocal(rol) { return rol === 'atencion' || rol === 'admin' || rol === 'zona'; }
  /** Las casillas de los locales del supervisor (SQL 141). marcados: {id: true|'pidio'}. */
  function casillasLocales(marcados) {
    return datos.locales.map(function (l) {
      var m = marcados[l.id];
      return '<label class="us-loc"><input type="checkbox" value="' + esc(l.id) + '"' + (m ? ' checked' : '') + '> ' +
        esc(l.nombre) + (m === 'pidio' ? ' <small>(lo pidió)</small>' : '') + '</label>';
    }).join('');
  }
  function marcadosDe(p) {
    var m = {};
    (p.supervisa || []).forEach(function (s) { m[s.id] = s.aprobado ? true : 'pidio'; });
    return m;
  }
  function tildados(cont) {
    return Array.prototype.map.call(cont.querySelectorAll('.us-locales input:checked'), function (i) { return i.value; });
  }
  /** Los 7 días para marcar los francos (SQL 154): como en Supervisión, botones que se prenden. */
  function casillasDias(marcados) {
    return '<div class="us-dias-fila">' + DIAS.map(function (d, i) {
      return '<label class="us-dia" title="' + DIAS_LARGO[i] + '"><input type="checkbox" value="' + (i + 1) + '" aria-label="' + DIAS_LARGO[i] + '"' +
        (marcados.indexOf(i + 1) > -1 ? ' checked' : '') + '><span aria-hidden="true">' + d + '</span></label>';
    }).join('') + '</div>';
  }
  function diasTildados(cont) {
    return Array.prototype.map.call(cont.querySelectorAll('.us-dias input:checked'), function (i) { return +i.value; })
      .sort(function (a, b) { return a - b; });
  }
  function mismosDias(a, b) { return (a || []).join() === (b || []).slice().sort(function (x, y) { return x - y; }).join(); }

  function filaEditor(p) {
    var r = rolEd(p), fr = hayFrancos();
    var dias = fr ? '<div class="us-dias" data-ed-dias role="group" aria-label="Francos"' + (tieneFranco(r) ? '' : ' hidden') + '>' +
      '<span class="us-dias-tit">Francos</span>' + casillasDias(p.francos || []) + '</div>' : '';
    var botones = '<button type="button" class="btn btn-pri btn-chico" data-acc="guardar">Guardar</button>' +
      '<button type="button" class="btn btn-sec btn-chico" data-acc="cancelar">Cancelar</button>';
    /* El encargado, con uno de sus vendedores: sólo los francos. */
    if (!esAdmin()) {
      return '<div class="us-fila us-editando" data-id="' + esc(p.id) + '">' +
        '<div class="us-quien"><b>' + esc(p.nombre + ' ' + (p.apellido || '')) + '</b><span>Los días de la semana que no trabaja</span></div>' +
        '<div class="us-editor solo-dias">' + dias + botones + '</div></div>';
    }
    return '<div class="us-fila us-editando" data-id="' + esc(p.id) + '">' +
      '<div class="us-quien"><b>' + esc(p.nombre + ' ' + (p.apellido || '')) + '</b><span>Cambiar el rol, el local' + (fr ? ', los francos' : '') + ' o si también atiende clientes</span></div>' +
      '<div class="us-editor">' +
        '<select data-ed="rol" aria-label="Rol">' + opcionesRol(r) + '</select>' +
        '<select data-ed="local" aria-label="Local"' + (sinLocal(r) ? ' hidden' : '') + '>' + opcionesLocal(p.local_id || '', r === 'gerencia') + '</select>' +
        '<div class="us-locales" data-ed-locales role="group" aria-label="Sus locales"' + (r === 'zona' ? '' : ' hidden') + '>' +
          '<span class="us-locales-tit">Sus locales</span>' + casillasLocales(marcadosDe(p)) + '</div>' +
        dias +
        '<label class="us-check" data-ed-atencion' + (puedeAtencion(r) ? '' : ' hidden') + ' title="Entra también al CRM, Socios, el Club y Gift Cards, con un PIN de 6 números">' +
          '<input type="checkbox" data-ed="atencion"' + (p.tambien_atencion ? ' checked' : '') + '> También atiende clientes</label>' +
        botones +
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
            '<div class="campo" id="usCampoLocal"><label for="usLocal">Local</label><select id="usLocal">' + opcionesLocal('', false) + '</select></div>' +
            '<div class="campo ancho" id="usCampoLocales" hidden><span class="campo-lbl">Sus locales</span>' +
              '<div class="us-locales" role="group" aria-label="Sus locales">' + casillasLocales({}) + '</div></div>'
          : '<div class="campo ancho"><span class="campo-lbl">Rol</span><span class="us-fijo">Vendedor de ' + esc(nombreLocal(datos.yo.local_id)) + '</span></div>') +
        /* SQL 154: los francos, si ya los sabés (se pueden poner después, en Cambiar). */
        (hayFrancos() ? '<div class="campo ancho" id="usCampoFrancos"><span class="campo-lbl">Francos <small>(si tiene fijos)</small></span>' +
          '<div class="us-dias" role="group" aria-label="Francos">' + casillasDias([]) + '</div></div>' : '') +
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
      /* Sin mensaje (o la función no devuelve nada): sigue otro paso, que avisa él. */
      var m = typeof mensajeOk === 'function' ? mensajeOk(r) : mensajeOk;
      if (m) avisar('ok', m);
      return traer().then(function () { return true; });
    }).catch(function (e) {
      ocupado = false;
      if (e && e.sinSesion) { avisar('err', e.message); datos = null; mostrar(); return false; }
      if (sesionMuerta(e)) return false;
      avisar('err', e && e.delServidor ? e.message : 'Sin conexión. Probá de nuevo.');
      return false;
    });
  }

  /** Los francos (SQL 154): el administrador a cualquiera, el encargado a sus vendedores. Sin cambios, no llama. */
  function guardarFrancos(p, dias) {
    if (mismosDias(dias, p.francos)) return Promise.resolve(true);
    return hacer('nc_usuario_francos', { p_persona: p.id, p_dias: dias }, function () {
      return 'Guardado: ' + p.nombre + (dias.length ? ' tiene franco ' + losDias(dias) + '.' : ' no tiene franco fijo.');
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
          if (!esAdmin()) {
            guardarFrancos(p, diasTildados(f)).then(function (ok) { if (ok) { editando = null; document.getElementById('usLista').innerHTML = lista(); } });
            break;
          }
          var rol = f.querySelector('[data-ed="rol"]').value, loc = f.querySelector('[data-ed="local"]').value || null;
          var dias = hayFrancos() && tieneFranco(rol) ? diasTildados(f) : null;
          var zona = rol === 'zona', locs = zona ? tildados(f) : [];
          if (zona && !locs.length) { avisar('err', 'Tildá al menos un local para ' + p.nombre + '.'); return; }
          if (p.local_id && loc && loc !== p.local_id && p.rol === 'vendedor' && !sinLocal(rol) &&
              !confirm('¿Pasar a ' + nom + ' a ' + nombreLocal(loc) + '? Sale de la lista de No Compra de ' + nombreLocal(p.local_id) + ' y entra en la del local nuevo.')) return;
          if (zona && p.local_id &&
              !confirm('¿Pasar a ' + nom + ' a supervisor de varios locales? Deja de estar fijo en ' + nombreLocal(p.local_id) +
                       (p.rol === 'vendedor' ? ' y sale de su lista de No Compra.' : '.'))) return;
          if (!zona && esZona(p) && (p.supervisa || []).length &&
              !confirm('¿Sacarle a ' + nom + ' los locales que supervisa (' + susLocales(p) + ')?')) return;
          var cas = f.querySelector('[data-ed="atencion"]');
          var conAt = puedeAtencion(rol) && !!(cas && cas.checked), cambiaAt = conAt !== !!p.tambien_atencion;
          hacer('nc_usuario_cambiar', { p_persona: p.id, p_rol: zona ? 'supervisor' : rol, p_local: sinLocal(rol) ? null : loc }, function () {
            if (zona) return null;   // avisa el paso de los locales
            /* SQL 110: lo de la oficina pide un PIN de 6 números; el suyo
               queda, y lo cambia la próxima vez que entre. */
            var seis = { admin: 1, atencion: 1, gerencia: 1 };
            return p.pin && seis[rol] && !seis[p.rol] && !p.tambien_atencion ? 'Guardado. La próxima vez que entre, ' + p.nombre + ' cambia su PIN por uno de 6 números.' : 'Guardado.';
          })
            /* SQL 141: los locales del supervisor van aparte, ya aprobados. */
            .then(function (ok) {
              if (!ok || !zona) return ok;
              return hacer('nc_usuario_locales', { p_persona: p.id, p_locales: locs }, function (r) {
                return 'Guardado: ' + p.nombre + ' supervisa ' + ((r && r.locales) || 'sus locales') + '.';
              });
            })
            /* SQL 135: la casilla va aparte (sólo la pone el administrador). */
            .then(function (ok) {
              if (!ok || !cambiaAt) return ok;
              return hacer('nc_usuario_atencion', { p_persona: p.id, p_si: conAt }, function (r) {
                if (!conAt) return 'Guardado: ' + p.nombre + ' ya no entra a lo de Atención al cliente.';
                return 'Guardado: ' + p.nombre + ' también atiende clientes (CRM, Socios, el Club y Gift Cards).' +
                  (r && r.pin_corto ? ' La próxima vez que entre, cambia su PIN por uno de 6 números.' : '');
              });
            })
            /* SQL 154: los francos, también aparte (si no cambiaron, no llama). */
            .then(function (ok) { return ok && dias ? guardarFrancos(p, dias) : ok; })
            .then(function (ok) { if (ok) { editando = null; document.getElementById('usLista').innerHTML = lista(); } });
          break;
        case 'pin':
          if (p.en_lista && !confirm('¿Borrarle el PIN a ' + nom + '? La próxima vez que entre crea uno nuevo, y lo tenés que aprobar otra vez.')) return;
          hacer('nc_usuario_pin_borrar', { p_persona: p.id }, p.en_lista ? 'PIN borrado: la próxima vez crea uno nuevo.' : nom + ' ya aparece para crear su PIN.');
          break;
        case 'desactivar':
          if (!confirm('¿Desactivar a ' + nom + '? No va a poder entrar (ni acá ni en Equipo VDH) y sale de la lista de No Compra. ' +
                       (esAdmin() ? 'Se puede reactivar.' : 'Para volver a activarlo, se lo pedís al administrador.'))) return;
          hacer('nc_usuario_activar', { p_persona: p.id, p_activo: false }, nom + ' quedó desactivado.');
          break;
        case 'reactivar':
          hacer('nc_usuario_activar', { p_persona: p.id, p_activo: true }, nom + ' volvió a estar activo.');
          break;
      }
    };
    /* En el editor, el local se esconde para los roles que no tienen; el supervisor tilda los suyos. */
    c.onchange = function (ev) {
      var s = ev.target;
      if (s.dataset && s.dataset.ed === 'rol') {
        var ed = s.closest('.us-editor');
        var loc = ed.querySelector('[data-ed="local"]');
        loc.hidden = sinLocal(s.value);
        var at = ed.querySelector('[data-ed-atencion]');
        if (at) at.hidden = !puedeAtencion(s.value);
        var locs = ed.querySelector('[data-ed-locales]');
        if (locs) locs.hidden = s.value !== 'zona';
        var di = ed.querySelector('[data-ed-dias]');
        if (di) di.hidden = !tieneFranco(s.value);
        loc.innerHTML = opcionesLocal(loc.value, s.value === 'gerencia');
      }
    };

    var rolSel = document.getElementById('usRol');
    if (rolSel) rolSel.onchange = function () {
      var l = document.getElementById('usLocal');
      document.getElementById('usCampoLocal').hidden = sinLocal(rolSel.value);
      document.getElementById('usCampoLocales').hidden = rolSel.value !== 'zona';
      var cf = document.getElementById('usCampoFrancos');
      if (cf) cf.hidden = !tieneFranco(rolSel.value);
      /* Sin el campo Local, el rol ocupa la fila: "Supervisor (varios locales)" no entra en media. */
      rolSel.parentNode.classList.toggle('ancho', sinLocal(rolSel.value));
      l.innerHTML = opcionesLocal(l.value, rolSel.value === 'gerencia');
    };
    var crear = function () {
      var n = document.getElementById('usNombre').value.trim(), a = document.getElementById('usApellido').value.trim();
      if (!n) { avisar('err', 'Escribí el nombre.'); document.getElementById('usNombre').focus(); return; }
      if (!a) { avisar('err', 'Escribí el apellido.'); document.getElementById('usApellido').focus(); return; }
      var rol = rolSel ? rolSel.value : 'vendedor';
      var loc = rolSel ? (document.getElementById('usLocal').value || null) : datos.yo.local_id;
      var zona = rol === 'zona', locs = zona ? tildados(document.getElementById('usCampoLocales')) : [], nuevo = null;
      if ((rol === 'vendedor' || rol === 'supervisor') && !loc) { avisar('err', 'Elegí el local.'); document.getElementById('usLocal').focus(); return; }
      if (zona && !locs.length) { avisar('err', 'Tildá al menos un local.'); return; }
      var cf = document.getElementById('usCampoFrancos');
      var dias = cf && tieneFranco(rol) ? diasTildados(cf) : [];
      if (dias.length === 7) { avisar('err', 'Con los 7 días de franco no trabajaría nunca: dejale al menos uno.'); return; }
      /* SQL 148: Atención entra por "E-commerce"; Administración, por su botón. */
      var por = rol === 'atencion' ? 'que entre por "E-commerce", toque su nombre' :
                rol === 'admin' ? 'que entre por "Administración", toque su nombre' : 'que entre con su local y su nombre';
      var b = document.getElementById('usCrear');
      b.disabled = true;
      hacer('nc_usuario_crear', { p_nombre: n, p_apellido: a, p_rol: zona ? 'supervisor' : rol, p_local: sinLocal(rol) ? null : loc },
            function (r) {
              nuevo = r && r.id;
              return zona || dias.length ? null : n + ' quedó creado. Decile ' + por + ' y que cree su PIN.';
            })
        /* SQL 154: sus francos, si se marcaron (avisa este paso). */
        .then(function (ok) {
          if (!ok || !dias.length) return ok;
          return hacer('nc_usuario_francos', { p_persona: nuevo, p_dias: dias }, function () {
            return n + ' quedó creado, con franco ' + losDias(dias) + '. Decile ' + por + ' y que cree su PIN.';
          });
        })
        /* SQL 141: al supervisor nuevo, sus locales (ya aprobados). Para entrar, su nombre aparece en
           cada uno de ellos (nc_login_personas, SQL 121). */
        .then(function (ok) {
          if (!ok || !zona) return ok;
          return hacer('nc_usuario_locales', { p_persona: nuevo, p_locales: locs }, function (r) {
            return n + ' quedó creado, con ' + ((r && r.locales) || 'sus locales') + '. Decile que entre con su nombre y que cree su PIN.';
          });
        })
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
