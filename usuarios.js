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
 * Y las vacaciones (SQL 181, 26/10), con las mismas reglas: esos días no se
 * carga la venta en Ventas y Equipo VDH no le manda controles.
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
  /* SQL 183: a quien todavía no lo eligió, la app se lo pregunta al entrar. */
  function francoDe(p) { return (p.francos || []).length ? 'franco ' + losDias(p.francos) : p.falta_franco ? 'falta que elija su franco' : 'sin franco fijo'; }

  /* SQL 181: las vacaciones (orden_ausencias), para los mismos que tienen francos. Las usan Ventas (esos días
     no se carga la venta) y Equipo VDH (no recibe controles). Fechas 'AAAA-MM-DD'; null = sin el SQL 181. */
  var vacs = null, vacEditando = null;
  function hayVacaciones() { return vacs !== null; }
  function vacDe(p) { return (vacs || []).filter(function (a) { return a.persona === p.id; }); }
  function dosCifras(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + dosCifras(d.getMonth() + 1) + '-' + dosCifras(d.getDate()); }
  function hoyIso() { return iso(new Date()); }
  /** Lo más atrás que se cargan (como la base): el 1 del mes pasado. */
  function minVac() { var d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function dm(f) { var x = String(f).split('-'); return +x[2] + '/' + +x[1]; }   // '2026-10-19' → '19/10'
  /** "de vacaciones hasta el 31/10" o "vacaciones del 3/11 al 10/11" (la que sigue); '' si no tiene. */
  function vacTexto(p) {
    var h = hoyIso(), a = vacDe(p).filter(function (x) { return x.hasta >= h; })[0];
    if (!a) return '';
    return a.desde <= h ? 'de vacaciones hasta el ' + dm(a.hasta) : 'vacaciones del ' + dm(a.desde) + ' al ' + dm(a.hasta);
  }

  /* SQL 190: el POS de cada persona. «Usa el POS» y seis casillas; cada rol arranca con las suyas
     (pos_permisos_lista trae las de cada rol y las de cada persona). null = no es Administración o falta el SQL. */
  var posLista = null;
  var POS_K = ['usa', 'anular', 'envios', 'caja', 'dias', 'locales', 'precios'];
  var POS_CASILLAS = [['anular', 'Anular ventas y cambios', ''],
                      ['envios', 'Hacer envíos internos y devoluciones a fábrica', ''],
                      ['caja', 'Caja: gastos, movimientos de salida, retiros y cierre de caja', ''],
                      ['dias', 'Ver otros días', 'sin esto, sólo lo de hoy'],
                      ['locales', 'Ver otros locales', 'sin esto, sólo el suyo o los que supervisa'],
                      ['precios', 'Ver los precios y totales en remitos y envíos', '']];
  function usaPos(p) { return !!posLista && p.rol !== 'admin' && !!(posLista.personas[p.id] || {}).usa; }
  /** El bloque del editor. Al administrador no se le toca: tiene todo. */
  function posBloque(p, r) {
    if (!posLista) return '';
    var adm = r === 'admin', e = posLista.personas[p.id] || posLista.roles[r] || {}, usa = !adm && !!e.usa;
    return '<div class="us-pos" data-ed-pos role="group" aria-label="POS">' +
      '<span class="us-pos-tit">POS</span>' +
      '<label class="us-pos-usa"' + (adm ? ' hidden' : '') + '><input type="checkbox" data-pos="usa"' + (usa ? ' checked' : '') + '> Usa el POS</label>' +
      '<div class="us-pos-casillas"' + (usa ? '' : ' hidden') + '>' +
        '<p class="us-pos-nota">Nueva venta, Tickets, Cambios, Venta fallida, recibir remitos y Stock los tiene todo el que usa el POS. Además:</p>' +
        POS_CASILLAS.map(function (c) {
          return '<label class="us-pos-cas"><input type="checkbox" data-pos="' + c[0] + '"' + (e[c[0]] ? ' checked' : '') + '> <span>' + esc(c[1]) +
            (c[2] ? ' <small>(' + esc(c[2]) + ')</small>' : '') + '</span></label>';
        }).join('') + '</div>' +
      '<p class="us-pos-admin"' + (adm ? '' : ' hidden') + '>Administrador: todo el POS y la Gestión.</p>' +
    '</div>';
  }
  /** Cambió el rol en el editor: las casillas vuelven a las del rol nuevo («Usa el POS» queda como está). */
  function posRol(pb, rol) {
    var adm = rol === 'admin', def = posLista.roles[rol] || {};
    POS_CASILLAS.forEach(function (c) { pb.querySelector('[data-pos="' + c[0] + '"]').checked = !!def[c[0]]; });
    pb.querySelector('.us-pos-usa').hidden = adm;
    pb.querySelector('.us-pos-admin').hidden = !adm;
    pb.querySelector('.us-pos-casillas').hidden = adm || !pb.querySelector('[data-pos="usa"]').checked;
  }
  /** Lo que quedó marcado (null: sin el bloque, o es administrador). */
  function posDelEditor(f, rol) {
    var pb = f.querySelector('[data-ed-pos]');
    if (!pb || !posLista || rol === 'admin') return null;
    var v = {};
    POS_K.forEach(function (k) { v[k] = pb.querySelector('[data-pos="' + k + '"]').checked; });
    return v;
  }
  /** ¿Lo marcado es distinto de lo que tendría con su rol (el nuevo, si cambió) y lo que ya le cambiaron? */
  function posCambia(p, rol, v) {
    var pr = (posLista.personas[p.id] || {}).propios || {}, def = posLista.roles[rol] || {};
    return POS_K.some(function (k) { return v[k] !== (k in pr ? pr[k] : !!def[k]); });
  }

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
    /* Sin el SQL 181 no está nc_vacaciones: la lista sale igual, sin las vacaciones. */
    /* SQL 190: los permisos del POS, sólo para Administración; sin el SQL, la lista sale igual, sin el bloque POS. */
    return Promise.all([llamar('nc_usuarios'), llamar('nc_vacaciones').catch(function () { return null; }),
                        persona.rol() === 'admin' ? llamar('pos_permisos_lista').catch(function () { return null; }) : null]).then(function (rr) {
      var d = rr[0];
      if (!d || d.error) {
        cuerpo().innerHTML = bloque('Usuarios', esc((d && d.porque) || 'No se pudo traer la lista.'));
        return;
      }
      datos = d;
      vacs = rr[1] && Array.isArray(rr[1].vacaciones) ? rr[1].vacaciones : null;
      posLista = rr[2] && rr[2].roles && rr[2].personas ? rr[2] : null;
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
      ? 'Todos los que entran al No Compra y a Equipo VDH. ' + (hayFrancos() ? 'El rol, el local' + (hayVacaciones() ? ', los francos y las vacaciones' : ' y los francos') : 'El rol y el local') + ' los cambiás vos.'
      : 'Los vendedores de ' + esc(nombreLocal(datos.yo.local_id)) + '. Podés crearlos, aprobarlos, ' + (hayFrancos() ? 'cambiarles los francos, ' : '') + (hayVacaciones() ? 'cargarles las vacaciones, ' : '') +
        'borrarles el PIN y desactivarlos. Reactivar a alguien lo hace el administrador.';
    var filtros = '';
    if (admin) {
      filtros = '<div class="us-filtros"><select id="usFiltroLocal" class="desplegable" aria-label="Local">' +
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
    if (vacEditando === p.id) return filaVacaciones(p);
    if (admin && !p.soy) acc += '<button type="button" class="btn btn-sec btn-chico" data-acc="cambiar">Cambiar</button>';
    /* El encargado sólo cambia los francos de sus vendedores (SQL 154). */
    else if (!admin && toca && p.activo && hayFrancos()) acc += '<button type="button" class="btn btn-sec btn-chico" data-acc="cambiar">Francos</button>';
    /* SQL 181: las vacaciones, a los mismos que tienen francos (nc_puede_tocar, como los francos). */
    if (toca && p.activo && conFranco(p) && hayVacaciones()) acc += '<button type="button" class="btn btn-sec btn-chico" data-acc="vacaciones">Vacaciones</button>';
    var vt = hayVacaciones() ? vacTexto(p) : '';
    if (toca && p.activo && (p.pin || !p.en_lista)) {
      acc += '<button type="button" class="btn btn-sec btn-chico" data-acc="pin">' + (p.en_lista ? 'Borrar PIN' : 'Poner en la lista') + '</button>';
    }
    /* Reactivar es del administrador, como en Impecable: el encargado
       desactiva, pero no vuelve a dejar entrar a alguien que sacó otro. */
    if (toca && (p.activo || admin)) acc += '<button type="button" class="btn btn-sec btn-chico" data-acc="' + (p.activo ? 'desactivar' : 'reactivar') + '">' + (p.activo ? 'Desactivar' : 'Reactivar') + '</button>';
    return '<div class="us-fila' + (p.activo ? '' : ' apagada') + '" data-id="' + esc(p.id) + '">' +
      '<div class="us-quien"><b>' + esc(p.nombre + ' ' + (p.apellido || '')) + (p.soy ? ' <small>(vos)</small>' : '') + '</b>' +
      /* El local no se repite: la lista ya está agrupada (o filtrada) por local. */
      '<span>' + esc(rolDe(p)) + (hayFrancos() && conFranco(p) ? ' · ' + esc(francoDe(p)) : '') + (vt ? ' · ' + esc(vt) : '') +
        (usaPos(p) ? ' · Usa el POS' : '') + '</span></div>' +
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
      '<div class="us-quien"><b>' + esc(p.nombre + ' ' + (p.apellido || '')) + '</b><span>Cambiar el rol, el local' + (fr ? ', los francos' : '') +
        (posLista ? ', si también atiende clientes o el POS' : ' o si también atiende clientes') + '</span></div>' +
      '<div class="us-editor">' +
        '<select data-ed="rol" aria-label="Rol">' + opcionesRol(r) + '</select>' +
        '<select data-ed="local" class="desplegable" aria-label="Local"' + (sinLocal(r) ? ' hidden' : '') + '>' + opcionesLocal(p.local_id || '', r === 'gerencia') + '</select>' +
        '<div class="us-locales" data-ed-locales role="group" aria-label="Sus locales"' + (r === 'zona' ? '' : ' hidden') + '>' +
          '<span class="us-locales-tit">Sus locales</span>' + casillasLocales(marcadosDe(p)) + '</div>' +
        dias +
        '<label class="us-check" data-ed-atencion' + (puedeAtencion(r) ? '' : ' hidden') + ' title="Entra también al CRM, Socios, el Club y Gift Cards, con un PIN de 6 números">' +
          '<input type="checkbox" data-ed="atencion"' + (p.tambien_atencion ? ' checked' : '') + '> También atiende clientes</label>' +
        posBloque(p, r) +
        botones +
      '</div></div>';
  }

  /** Las vacaciones de alguien (SQL 181): las que tiene, cada una con "Quitar", y abajo para sumar otras. */
  function filaVacaciones(p) {
    var h = hoyIso(), min = minVac();
    var tiene = vacDe(p).map(function (a) {
      return '<li><span>Del ' + dm(a.desde) + ' al ' + dm(a.hasta) + (a.motivo ? ' · ' + esc(a.motivo) : '') +
        (a.hasta < h ? ' <small>(ya pasaron)</small>' : '') + '</span>' +
        '<button type="button" class="btn btn-sec btn-chico" data-acc="vac-quitar" data-vac="' + esc(a.id) + '">Quitar</button></li>';
    }).join('');
    return '<div class="us-fila us-editando" data-id="' + esc(p.id) + '">' +
      '<div class="us-quien"><b>Vacaciones de ' + esc(p.nombre + ' ' + (p.apellido || '')) + '</b>' +
        '<span>Esos días no se carga su venta en Ventas y Equipo VDH no le manda controles ni tareas.</span></div>' +
      '<div class="us-vac">' +
        (tiene ? '<ul class="us-vac-lista">' + tiene + '</ul>' : '') +
        '<div class="us-vac-nueva">' +
          '<label class="us-vac-campo"><span>Desde</span><input type="date" data-vac="desde" min="' + min + '"></label>' +
          '<label class="us-vac-campo"><span>Hasta <small>(incluido)</small></span><input type="date" data-vac="hasta" min="' + min + '"></label>' +
          '<label class="us-vac-campo"><span>Motivo <small>(si querés)</small></span><input type="text" data-vac="motivo" maxlength="80" autocomplete="off" placeholder="Vacaciones, licencia…"></label>' +
        '</div>' +
        '<div class="us-acciones">' +
          '<button type="button" class="btn btn-pri btn-chico" data-acc="vac-agregar">Agregar</button>' +
          '<button type="button" class="btn btn-sec btn-chico" data-acc="vac-cerrar">Listo</button>' +
        '</div>' +
      '</div></div>';
  }

  function formCrear() {
    var admin = esAdmin();
    return bloque('Crear un usuario',
      /* SQL 162: a quien da de alta otro, crear el PIN le alcanza para entrar; "Esperan tu OK" es del que se anota solo. */
      'Después, esa persona entra, toca su nombre y crea su PIN: con eso ya puede entrar. A "Esperan tu OK" van sólo los que se anotan solos.',
      '<div class="campos">' +
        '<div class="campo"><label for="usNombre">Nombre</label><input type="text" id="usNombre" maxlength="30" autocomplete="off" autocapitalize="words"></div>' +
        '<div class="campo"><label for="usApellido">Apellido</label><input type="text" id="usApellido" maxlength="30" autocomplete="off" autocapitalize="words"></div>' +
        (admin
          ? '<div class="campo"><label for="usRol">Rol</label><select id="usRol">' + opcionesRol('vendedor') + '</select></div>' +
            /* E-commerce no es un local: se elige con el rol (27/10, lo buscó acá). */
            '<div class="campo" id="usCampoLocal"><label for="usLocal">Local</label><select id="usLocal" class="desplegable">' + opcionesLocal('', false) + '</select>' +
              '<small class="us-pista">¿Es de E-commerce? Elegí el rol "Atención al cliente".</small></div>' +
            '<div class="campo ancho" id="usCampoLocales" hidden><span class="campo-lbl">Sus locales</span>' +
              '<div class="us-locales" role="group" aria-label="Sus locales">' + casillasLocales({}) + '</div></div>'
          : '<div class="campo ancho"><span class="campo-lbl">Rol</span><span class="us-fijo">Vendedor de ' + esc(nombreLocal(datos.yo.local_id)) + '</span></div>') +
        /* SQL 154: los francos, si ya los sabés (se pueden poner después, en Cambiar). */
        /* SQL 183: si se dejan vacíos, la app se los pregunta cuando entra por primera vez. */
        (hayFrancos() ? '<div class="campo ancho" id="usCampoFrancos"><span class="campo-lbl">Francos <small>' +
          (datos.personas.some(function (p) { return 'falta_franco' in p; }) ? '(si no los sabés, los elige al entrar)' : '(si tiene fijos)') + '</small></span>' +
          '<div class="us-dias" role="group" aria-label="Francos">' + casillasDias([]) + '</div></div>' : '') +
        '<div class="campo ancho"><button type="button" class="btn btn-pri" id="usCrear">Crear usuario</button></div>' +
      '</div>' +
      (admin ? '<p class="us-nota">' + esc(QUE_VE) + (posLista ? ' El POS: a quien le prendas «Usa el POS» en Cambiar.' : '') + '</p>' : ''));
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
          editando = p.id; vacEditando = null;
          document.getElementById('usLista').innerHTML = lista();
          break;
        /* SQL 181: las vacaciones, en su propio renglón (como Cambiar). */
        case 'vacaciones':
          vacEditando = p.id; editando = null;
          document.getElementById('usLista').innerHTML = lista();
          var de = document.getElementById('usLista').querySelector('[data-id="' + p.id + '"] [data-vac="desde"]');
          if (de) de.focus();
          break;
        case 'vac-cerrar':
          vacEditando = null;
          document.getElementById('usLista').innerHTML = lista();
          break;
        case 'vac-agregar':
          var desde = f.querySelector('[data-vac="desde"]').value, hasta = f.querySelector('[data-vac="hasta"]').value;
          if (!desde) { avisar('err', 'Poné desde qué día.'); f.querySelector('[data-vac="desde"]').focus(); return; }
          if (!hasta) { avisar('err', 'Poné hasta qué día (el último que no viene).'); f.querySelector('[data-vac="hasta"]').focus(); return; }
          if (hasta < desde) { avisar('err', 'El "hasta" no puede ser antes del "desde".'); return; }
          hacer('nc_vacacion_guardar', { p_persona: p.id, p_desde: desde, p_hasta: hasta, p_motivo: f.querySelector('[data-vac="motivo"]').value.trim() || null },
            'Guardado: ' + p.nombre + ' de vacaciones del ' + dm(desde) + ' al ' + dm(hasta) + '. Esos días no se carga su venta y Equipo VDH no le manda controles.');
          break;
        case 'vac-quitar':
          var a = (vacs || []).filter(function (x) { return x.id === b.dataset.vac; })[0];
          if (!a || !confirm('¿Sacarle a ' + nom + ' las vacaciones del ' + dm(a.desde) + ' al ' + dm(a.hasta) + '? Esos días vuelve a trabajar: se carga su venta y recibe controles.')) return;
          hacer('nc_vacacion_borrar', { p_id: a.id }, 'Listo: se sacaron las vacaciones del ' + dm(a.desde) + ' al ' + dm(a.hasta) + '.');
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
          /* SQL 190: se lee antes, porque cada paso vuelve a dibujar la lista. */
          var posVa = posDelEditor(f, rol), cambiaPos = !!posVa && posCambia(p, rol, posVa);
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
            /* SQL 190: el POS, también aparte (la base guarda sólo lo distinto de lo de su rol). */
            .then(function (ok) {
              if (!ok || !cambiaPos) return ok;
              return hacer('pos_permisos_guardar', { p_persona: p.id, p: posVa },
                'Guardado: ' + p.nombre + (posVa.usa ? ' usa el POS.' : ' no usa el POS.'));
            })
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
        var pb = ed.querySelector('[data-ed-pos]');
        if (pb && posLista) posRol(pb, s.value);
      }
      if (s.dataset && s.dataset.pos === 'usa') s.closest('[data-ed-pos]').querySelector('.us-pos-casillas').hidden = !s.checked;
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
      /* SQL 148: Atención entra por "E-commerce"; Administración, por "Oficina" (el botón de la bienvenida, 27/10). */
      var por = rol === 'atencion' ? 'que entre por "E-commerce", toque su nombre' :
                rol === 'admin' ? 'que entre por "Oficina", toque su nombre' : 'que entre con su local y su nombre';
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
