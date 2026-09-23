/**
 * VDH · Sistema No Compra — el puente con la base.
 *
 * Reemplaza a `llamar()` de comun.js, que le hablaba a Apps Script. Mismo
 * lugar en la app, otro destino.
 *
 * ── Sin librería, a propósito ─────────────────────────────────────────────
 * Supabase tiene un cliente de JavaScript que resolvería esto en menos
 * líneas, pero hay que bajarlo de un CDN. Esta app se instala en el celular
 * del local y tiene que abrir con el WiFi del shopping caído: un archivo más
 * que buscar afuera es un punto más donde la pantalla se queda en blanco.
 *
 * Con `fetch` pelado no hay nada que bajar y el service worker la cachea como
 * a cualquier otro archivo propio.
 *
 * ── La clave es pública y está bien ───────────────────────────────────────
 * Va escrita acá, en un repo público, y cualquiera que abra el inspector la
 * ve. No protege nada: sólo dice a qué proyecto se le habla. Lo que protege
 * son las políticas de la base, que se probaron una por una.
 *
 * Con esta clave, desde afuera, NO se puede: leer un registro, ver un
 * teléfono, contar cuántos clientes hay, borrar nada ni crearse una cuenta.
 *
 * ── Se llama `base`, no `datos` ──────────────────────────────────────────
 * Porque "datos" es como se llama el registro que arma el formulario, en
 * todas las pantallas. Un objeto global con ese nombre lo tapa adentro de
 * cada función que arme uno, y la pantalla falla sin decir por qué.
 */

var BASE = 'https://gfjdjupuwxohkgchqykx.supabase.co';
var CLAVE = 'sb_publishable_A81zY5i4zCXZyIv2fOpokA_jOxiccNU';

/**
 * Un "no" de la base, distinguible de un "no llegué".
 *
 * La cola de lo que se cargó sin señal necesita esa diferencia y no la
 * puede sacar del mensaje: **sin señal se reintenta, rechazado se
 * descarta.** Un registro que la base rechaza, reintentado, tapa la cola
 * para siempre y el vendedor ve "esperando conexión" con señal llena.
 *
 * Sólo lleva la marca lo que el servidor contestó. Si `fetch` no llegó a
 * destino tira su propio error, sin marca, que es justo lo que se quiere.
 */
function rechazo(mensaje) {
  var e = new Error(mensaje);
  e.delServidor = true;
  return e;
}

/**
 * Una llamada a la base.
 *
 * Tira excepción si la respuesta no viene bien, igual que hacía `llamar()`:
 * la cola offline del formulario depende de que un fallo de red se distinga
 * de un rechazo del servidor.
 */
function pedir(ruta, opciones) {
  opciones = opciones || {};
  var cabeceras = {
    apikey: CLAVE,
    Authorization: 'Bearer ' + (opciones.sesion || CLAVE),
    'Content-Type': 'application/json'
  };
  /* Sin esto, PostgREST devuelve la fila escrita — y devolverla exige poder
     LEERLA, que es justo lo que el vendedor no puede. Pedir "mínimo" no es
     una optimización: sin eso el alta falla. */
  if (opciones.metodo && opciones.metodo !== 'GET') cabeceras.Prefer = 'return=minimal';
  /* Un PATCH que no toca ninguna fila contesta igual que uno que tocó diez.
     Pidiendo el conteo, PostgREST lo dice en la cabecera Content-Range, que
     es la única forma de distinguir "se guardó" de "no había nada que
     guardar" sin poder leer la tabla. */
  if (opciones.contar) cabeceras.Prefer = cabeceras.Prefer + ',count=exact';

  return fetch(BASE + '/rest/v1' + ruta, {
    method: opciones.metodo || 'GET',
    headers: cabeceras,
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined
  }).then(function (r) {
    if (!r.ok) {
      return r.text().then(function (t) {
        var msg = t;
        try { msg = JSON.parse(t).message || JSON.parse(t).hint || t; } catch (e) {}
        throw rechazo('La base respondió ' + r.status + ': ' + msg);
      });
    }
    /* Content-Range viene como "0-0/1", y con un asterisco adelante de la
       barra cuando no tocó ninguna fila. Lo que interesa es el número de
       después de la barra, que es el total. */
    if (opciones.contar) {
      var rango = String(r.headers.get('content-range') || '');
      return Number(rango.split('/')[1] || 0);
    }
    /* Un POST con `return=minimal` contesta 201 con el cuerpo VACÍO, no 204.
       Pedirle json() a eso explota, así que se mira el texto: vacío es que
       salió bien y no hay nada que devolver. */
    return r.text().then(function (t) {
      return t ? JSON.parse(t) : null;
    });
  });
}

/** Una función de la base (las que devuelven algo sin dejar leer la tabla). */
function funcion(nombre, args, sesion) {
  return fetch(BASE + '/rest/v1/rpc/' + nombre, {
    method: 'POST',
    headers: {
      apikey: CLAVE,
      Authorization: 'Bearer ' + (sesion || CLAVE),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args || {})
  }).then(function (r) {
    if (!r.ok) {
      return r.text().then(function (t) {
        var msg = t;
        try { msg = JSON.parse(t).message || t; } catch (e) {}
        throw rechazo(msg);
      });
    }
    return r.json();
  });
}

/**
 * El nombre de un local o de un vendedor, para comparar.
 *
 * "Lau", "lau" y " Lau " tienen que ser la misma persona, y "MORÓN" el mismo
 * local que "Morón". La base ya lo resuelve con índices sobre lower(trim(…));
 * esto es lo mismo del lado de acá, para cuando hay que cruzar dos listas.
 */
function clave_(v) {
  return String(v == null ? '' : v).trim().toLowerCase();
}

/**
 * Un valor dentro de un filtro.
 *
 * Sin comillas: PostgREST NO las saca en un `eq.`, se las queda como parte
 * del texto buscado y la consulta no encuentra nada. Alcanza con escapar
 * para la URL.
 */
function valor(v) {
  return encodeURIComponent(String(v == null ? '' : v));
}


/* ════════════════════════════════════════════════════════════════════════
   LA SESIÓN

   Sólo el Panel la necesita: es la única pantalla que ve nombres, teléfonos
   y mails de clientes. Todo lo demás anda con la clave pública.

   ── Por qué un enlace por mail y no una contraseña ──────────────────────
   Una contraseña compartida por todo Atención al Cliente termina escrita en
   un papel al lado de la compu, y el día que alguien se va no se puede
   cambiar sin avisarle a todos. Con el enlace no hay nada que recordar ni
   que compartir: se pone el mail, llega un enlace, se entra. Y dar de baja a
   alguien es sacarle el mail, sin tocarle nada a los demás.

   **El registro público está cerrado.** Un mail que no esté dado de alta no
   recibe ningún enlace. Eso es lo que hace que esto sea una puerta y no un
   formulario.
   ════════════════════════════════════════════════════════════════════════ */

var K_SESION = 'nc_sesion';

function leerSesion_() {
  try { return JSON.parse(localStorage.getItem(K_SESION) || 'null'); } catch (e) { return null; }
}

function guardarSesion_(s) {
  try {
    if (s) localStorage.setItem(K_SESION, JSON.stringify(s));
    else localStorage.removeItem(K_SESION);
  } catch (e) { /* modo incógnito: la sesión dura lo que la pestaña */ }
  _sesion = s;
}

var _sesion = leerSesion_();

/** Guarda lo que contesta el servidor de sesiones, en el formato de acá. */
function anotarSesion_(r, mail) {
  if (!r || !r.access_token) return null;
  guardarSesion_({
    token: r.access_token,
    refresco: r.refresh_token,
    /* Un minuto antes de que venza de verdad. El margen no es paranoia: sin
       él, una petición que sale justo en el límite llega vencida y el
       usuario ve un error que no tiene forma de entender ni de arreglar. */
    vence: Date.now() + (Number(r.expires_in || 3600) - 60) * 1000,
    mail: mail || (r.user && r.user.email) || (_sesion && _sesion.mail) || ''
  });
  return _sesion;
}

/**
 * Un token válido, renovándolo si hace falta.
 *
 * Tira si no hay sesión, y el que llama traduce eso a "volvé a entrar". Es a
 * propósito que no redirija solo: el Panel tiene cosas a medio escribir en
 * pantalla y mandarlo al portón sin avisar se las come.
 */
function token() {
  if (!_sesion || !_sesion.refresco) return Promise.reject(sinSesion_());
  if (Date.now() < _sesion.vence) return Promise.resolve(_sesion.token);

  return fetch(BASE + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { apikey: CLAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: _sesion.refresco })
  }).then(function (r) {
    if (!r.ok) { guardarSesion_(null); throw sinSesion_(); }
    return r.json();
  }).then(function (d) {
    var s = anotarSesion_(d);
    if (!s) throw sinSesion_();
    return s.token;
  });
}

function sinSesion_() {
  var e = new Error('Se cerró la sesión. Entrá de nuevo con tu mail.');
  e.sinSesion = true;
  return e;
}

var sesion = {

  /** El mail de quien entró, o vacío. No pregunta al servidor. */
  quien: function () { return (_sesion && _sesion.mail) || ''; },

  /** Si hay algo guardado. No garantiza que siga sirviendo: eso lo dice token(). */
  hay: function () { return !!(_sesion && _sesion.refresco); },

  /**
   * Pide el enlace. `volver` es a dónde tiene que traer el mail: la misma
   * pantalla desde donde se pidió, así el que entra termina donde quería ir.
   */
  pedirEnlace: function (mail, volver) {
    return fetch(BASE + '/auth/v1/otp?redirect_to=' + encodeURIComponent(volver || ''), {
      method: 'POST',
      headers: { apikey: CLAVE, 'Content-Type': 'application/json' },
      /* create_user en false: si el mail no está dado de alta, que falle.
         El proyecto ya tiene el registro cerrado, pero decirlo acá también
         hace que el día que alguien lo abra sin querer esto no se convierta
         solo en un formulario de alta. */
      body: JSON.stringify({ email: String(mail || '').trim(), create_user: false })
    }).then(function (r) {
      if (r.ok) return true;
      return r.text().then(function (t) {
        var cuerpo = {};
        try { cuerpo = JSON.parse(t); } catch (e) {}
        var codigo = cuerpo.error_code || '';
        var msg = cuerpo.msg || cuerpo.error_description || t;

        /* Se mira el CÓDIGO y no el texto. El texto cambia con la
           redacción y son todos parecidos entre sí: "email rate limit
           exceeded" y "For security purposes you can only request this
           after 60 seconds" son dos problemas muy distintos que una
           expresión regular sobre la palabra "rate" confunde. */
        if (codigo === 'otp_disabled' || /signup|not allowed|not found/i.test(msg)) {
          throw new Error('Ese mail no tiene acceso al panel.');
        }
        /* La cuota del servicio de mail, que se cuenta por hora. NO se
           arregla esperando un minuto, y decir que sí manda a la persona a
           probar diez veces seguidas sin enterarse nunca de qué pasa. */
        if (codigo === 'over_email_send_rate_limit') {
          throw new Error('El servicio de mail llegó a su límite por hora. ' +
            'Probá más tarde, o configurá un SMTP propio en Supabase.');
        }
        // Ésta sí es la de los 60 segundos entre dos pedidos del mismo mail.
        if (codigo === 'over_request_rate_limit' || /after \d+ seconds/i.test(msg)) {
          throw new Error('Recién se pidió un enlace. Esperá un minuto y probá de nuevo.');
        }
        throw new Error(msg);
      });
    });
  },

  /**
   * Recoge la sesión al volver del mail.
   *
   * El enlace trae el token en el # de la dirección. Se guarda y se BORRA de
   * la barra: un token en la barra se copia sin querer, queda en el historial
   * y entra en la próxima captura de pantalla que alguien mande por WhatsApp.
   *
   * Devuelve una promesa: true si entró recién, false si no había nada.
   */
  recoger: function () {
    var h = String(location.hash || '').replace(/^#/, '');
    if (!h) return Promise.resolve(false);

    var p = {};
    h.split('&').forEach(function (par) {
      var i = par.indexOf('=');
      if (i > 0) p[decodeURIComponent(par.slice(0, i))] = decodeURIComponent(par.slice(i + 1));
    });

    var limpiar = function () {
      try { history.replaceState(null, '', location.pathname + location.search); }
      catch (e) { location.hash = ''; }
    };

    if (p.error || p.error_description) {
      limpiar();
      var m = p.error_description || p.error;
      /* El enlace se usa una sola vez y dura una hora. Es el error más común
         de todos: alguien lo abre al otro día, o dos veces. */
      if (/expired|invalid/i.test(m)) m = 'Ese enlace ya no sirve. Pedí uno nuevo.';
      return Promise.reject(new Error(m));
    }

    if (!p.access_token) return Promise.resolve(false);
    anotarSesion_({ access_token: p.access_token, refresh_token: p.refresh_token,
                    expires_in: p.expires_in });
    limpiar();

    // El # no trae el mail, y la cabecera lo muestra. Se pregunta una vez.
    return fetch(BASE + '/auth/v1/user', {
      headers: { apikey: CLAVE, Authorization: 'Bearer ' + p.access_token }
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (u) {
        if (u && u.email && _sesion) { _sesion.mail = u.email; guardarSesion_(_sesion); }
        return true;
      })
      .catch(function () { return true; });   // entró igual; sólo falta el nombre
  },

  /** Cierra. Le avisa al servidor, pero lo de acá se borra pase lo que pase. */
  salir: function () {
    var t = _sesion && _sesion.token;
    guardarSesion_(null);
    if (!t) return Promise.resolve();
    return fetch(BASE + '/auth/v1/logout', {
      method: 'POST',
      headers: { apikey: CLAVE, Authorization: 'Bearer ' + t }
    }).then(function () {}).catch(function () {});
  }
};

var base = {

  /**
   * Carga un no-compra. Devuelve {id, creado}, que es lo único que la base le
   * deja saber al vendedor sobre lo que acaba de escribir — y lo que después
   * le permite corregirlo.
   */
  cargar: function (d) {
    return funcion('cargar_registro', {
      p_sucursal: d.sucursal, p_vendedor: d.vendedor, p_whatsapp: d.whatsapp,
      p_nombre: d.nombre, p_mail: d.mail, p_producto: d.producto,
      p_talle: d.talle, p_obs: d.obs, p_motivo: d.motivo
    }).then(function (filas) {
      var f = Array.isArray(filas) ? filas[0] : filas;
      if (!f || !f.id) throw new Error('La base no devolvió el registro.');
      return f;
    });
  },

  /**
   * Corrige uno propio y reciente. `creado` va tal como vino: es la prueba de
   * que este celular fue el que lo cargó, y se compara al microsegundo — por
   * eso nunca hay que pasarlo por un Date, que redondea.
   */
  corregir: function (id, creado, d) {
    return funcion('corregir_registro', {
      p_id: id, p_creado: creado,
      p_sucursal: d.sucursal, p_vendedor: d.vendedor, p_whatsapp: d.whatsapp,
      p_nombre: d.nombre, p_mail: d.mail, p_producto: d.producto,
      p_talle: d.talle, p_obs: d.obs, p_motivo: d.motivo
    });
  },

  /** Los vendedores activos del local, ordenados como los muestra la lista. */
  equipo: function (local) {
    return pedir('/equipo?select=vendedor&activo=is.true&local=eq.' + valor(local) +
                 '&order=vendedor.asc')
      .then(function (filas) {
        return (filas || []).map(function (f) { return f.vendedor; });
      });
  },

  /** Se anota en la lista del local. */
  anotarse: function (local, vendedor) {
    return pedir('/equipo', {
      metodo: 'POST',
      cuerpo: { local: local, vendedor: vendedor, por: vendedor + ' (se anotó)' }
    }).catch(function (err) {
      // Que ya esté en la lista no es un error para quien se está anotando.
      if (/duplicate|unique/i.test(err.message)) return null;
      throw err;
    });
  },

  /**
   * Los números del local: el total y el detalle por vendedor, en una sola
   * consulta. La vista los trae por persona y acá se suman, así el tablero y
   * la lista del equipo salen del mismo viaje.
   */
  metricas: function (local) {
    /* Los objetivos se traen TODOS y se elige acá. Son quince filas como
       mucho, y filtrarlos en el servidor obligaría a meter el nombre del
       local adentro de un `or=(...)`, donde una coma en el nombre partiría
       la condición en dos. */
    return Promise.all([
      pedir('/v_metricas?sucursal=eq.' + valor(local)),
      pedir('/objetivos?select=local,periodo,meta')
    ]).then(function (r) {
      var filas = r[0] || [], todas = r[1] || [];
      var metas = todas.filter(function (m) {
        return !m.local || String(m.local).trim().toLowerCase() === String(local).trim().toLowerCase();
      });

      var total = { dia: 0, semana: 0, mes: 0, total: 0 };
      var recuperado = { mes: 0, total: 0 };
      var ventas = { mes: 0, total: 0 };

      var equipo = filas.map(function (f) {
        total.dia    += Number(f.hoy);
        total.semana += Number(f.semana);
        total.mes    += Number(f.mes);
        total.total  += Number(f.total);
        recuperado.mes   += Number(f.recuperado_mes);
        recuperado.total += Number(f.recuperado_total);
        ventas.mes   += Number(f.ventas_mes);
        ventas.total += Number(f.ventas_total);

        return {
          nombre: f.vendedor,
          dia: Number(f.hoy), mes: Number(f.mes), total: Number(f.total),
          recuperado: { mes: Number(f.recuperado_mes), total: Number(f.recuperado_total) }
        };
      });

      /* El propio del local manda; si no tiene, rige el general, que es la
         fila con el local en NULL. La consulta trae los dos y acá se elige. */
      var propio = null, general = null;
      metas.forEach(function (m) {
        if (m.local) propio = m; else general = m;
      });
      var meta = propio || general;

      return {
        local: local,
        registros: total,
        recuperado: recuperado,
        ventas: ventas,
        equipo: equipo,
        objetivo: meta ? { periodo: meta.periodo, meta: meta.meta, hechos: total[meta.periodo] || 0 } : null
      };
    });
  },

  /**
   * Por qué se va la gente. Un local vacío es toda la cadena; un motivo,
   * si viene, filtra los productos y los talles pero NO el ranking.
   *
   * Viene armado de la base en un solo viaje, con la misma forma que tenía
   * cuando esto lo contestaba Apps Script: por eso la pantalla no cambió.
   */
  motivos: function (local, motivo) {
    return funcion('resumen_motivos', { p_local: local || '', p_motivo: motivo || '' });
  },

  /** El embudo: cuántos se cargaron, a cuántos se trabajó y cuánto volvió. */
  resultados: function (local) {
    return funcion('resumen_resultados', { p_local: local || '' });
  },

  /* ── Los beneficios ───────────────────────────────────────────────────
     Reemplazan a la planilla "VDH cupones". Son DOS cosas distintas y por
     eso hay dos llaves:

       · el DESCUENTO se regala para recuperar una venta perdida, y la llave
         es el teléfono del cliente que se fue;
       · la GIFT CARD se vende, y la llave es el número de la tarjeta,
         porque casi siempre es un regalo: la usa el que la tiene en la
         mano, que no es el que la pagó.

     El buscador acepta las dos y la base decide cuál es cuál. */

  /**
   * Busca por teléfono o por número de tarjeta. Devuelve una lista corta —lo
   * que tenga ESE número— o vacía.
   *
   * No es un listado: es lo que hay detrás de una llave que el que busca ya
   * tenía. El listado que se puede recorrer sin saber a quién buscar pide
   * sesión; ver `beneficios()`.
   */
  beneficio: function (clave) {
    return funcion('beneficio_buscar', { clave: clave }).then(function (filas) {
      return Array.isArray(filas) ? filas : (filas ? [filas] : []);
    });
  },

  /**
   * Canjea. Para el descuento hace además algo que el cupón de papel no
   * podía: deja el registro como venta recuperada, así el "Recuperado" del
   * tablero sube solo cuando el cliente vuelve.
   *
   * Devuelve {canjeado:false, porque:'…'} y no una excepción cuando no se
   * puede: que esté usado o vencido es una respuesta, no un error.
   */
  canjear: function (id, local, vendedor, monto, producto) {
    return funcion('canjear_beneficio', {
      p_id: id, p_local: local, p_vendedor: vendedor,
      p_monto: monto || null, p_producto: producto || null
    });
  },

  /** El próximo número de tarjeta, para mostrarlo antes de vender. */
  siguienteSerie: function () {
    return funcion('siguiente_serie', {});
  },

  /**
   * Vende una Gift Card. El número lo pone la base y el vendedor lo escribe
   * en la tarjeta física.
   *
   * `valor` es lo que se puede canjear; `cobrado` es lo que entró a la caja.
   * Con el 10% de efectivo no son iguales, y los dos hacen falta para cuadrar.
   */
  venderGiftcard: function (d) {
    return funcion('vender_giftcard', {
      p_valor: d.valor, p_local: d.local, p_vendedor: d.vendedor,
      p_cobrado: d.cobrado || null, p_pago: d.pago || null,
      p_dias: d.dias || 30,
      p_telefono: d.telefono || null, p_nombre: d.nombre || null, p_obs: d.obs || null
    });
  },

  /* ── Y lo que pide sesión ────────────────────────────────────────────── */

  /**
   * Le da el descuento a un cliente, desde la ficha del Panel. Va por id de
   * REGISTRO y no por teléfono a propósito: tipear un número a mano es la
   * forma más fácil de dárselo al cliente equivocado.
   */
  darDescuento: function (registro, pct, dias, quien) {
    return token().then(function (t) {
      return funcion('dar_descuento', {
        p_registro: registro, p_pct: pct, p_dias: dias || 30, p_quien: quien || null
      }, t);
    });
  },

  /** El listado, con su filtro. Pide sesión: un listado es un directorio. */
  beneficios: function (estado) {
    var cond = estado && estado !== 'todos' ? '&estado=eq.' + valor(estado) : '';
    return token().then(function (t) {
      return pedir('/v_beneficios?select=*&order=creado.desc&limit=200' + cond, { sesion: t });
    });
  },

  /** Cuántos hay en cada filtro, y cuánta plata hay comprometida. */
  resumenBeneficios: function () {
    return token().then(function (t) { return funcion('resumen_beneficios', {}, t); });
  },

  /** Anular: es la única acción que le saca algo a un cliente. */
  anularBeneficio: function (id, quien, motivo) {
    return token().then(function (t) {
      return funcion('anular_beneficio', { p_id: id, p_quien: quien, p_motivo: motivo || null }, t);
    });
  },

  /** Correr el vencimiento. Queda anotado en las observaciones. */
  extenderBeneficio: function (id, dias, quien) {
    return token().then(function (t) {
      return funcion('extender_beneficio', { p_id: id, p_dias: dias, p_quien: quien }, t);
    });
  },

  /* ── Lo del Panel ──────────────────────────────────────────────────────
     Todo lo de acá abajo exige haber entrado con el mail: es lo único que
     toca datos de clientes. Si la sesión venció, token() tira con la marca
     `sinSesion` y la pantalla manda a entrar de nuevo. */

  /** Los números de arriba, los conteos de cada filtro y el vocabulario. */
  panel: function () {
    return token().then(function (t) { return funcion('resumen_panel', {}, t); });
  },

  /**
   * La lista de fichas del filtro elegido.
   *
   * "Pendiente" no es un estado guardado: es no haber sido tocado. Tiene que
   * ser el MISMO criterio que usa resumen_panel, o el número del filtro no
   * coincide con la cantidad de fichas que abre y el panel se ve roto.
   */
  registros: function (filtro) {
    var cond = '';
    if (filtro === 'Pendiente') cond = '&contactado=is.false&estado=is.null';
    else if (filtro && filtro !== 'Todos') cond = '&estado=eq.' + valor(filtro);

    return token().then(function (t) {
      /* El id desempata: dos registros que caen en el mismo instante —dos
         celulares del mismo local, a la vez— dejarían el orden librado a lo
         que devuelva Postgres, y la lista se reacomodaría sola al refrescar.

         Y el beneficio viene ANIDADO en el mismo viaje. Vive en su propia
         tabla desde que existen las gift cards, y pedirlo aparte serían dos
         consultas que después hay que cruzar a mano. */
      return pedir('/registros?select=*,beneficios(id,pct,usado,anulado,vence)' +
                   '&order=creado.desc,id.desc' + cond, { sesion: t });
    }).then(function (filas) {
      return (filas || []).map(deLaBase_);
    });
  },

  /**
   * Guarda el seguimiento de una ficha.
   *
   * Recibe los nombres que usa la pantalla y los traduce a los campos de la
   * base; ver aLaBase_. El id va aparte del resto a propósito: es lo único
   * que no se puede cambiar desde acá.
   */
  seguimiento: function (id, campos) {
    var cuerpo = aLaBase_(campos);
    if (!Object.keys(cuerpo).length) return Promise.resolve(true);
    return token().then(function (t) {
      return pedir('/registros?id=eq.' + valor(id), {
        metodo: 'PATCH', cuerpo: cuerpo, sesion: t
      });
    }).then(function () { return true; });
  },

  /* ── Lo de Configuración ───────────────────────────────────────────────
     Sin identificarse, igual que hoy: el equipo de cada local y sus
     objetivos los maneja el encargado desde el celular del mostrador, y
     ponerle una clave sería garantizar que nadie los actualice nunca.
     Adentro no hay un solo dato de un cliente. */

  /**
   * Todo lo que la pantalla necesita, en tres consultas.
   *
   * Se arma acá y no en una función de la base porque son tres tablas
   * chicas —catorce locales, un puñado de vendedores, quince objetivos— y
   * cruzarlas del lado del navegador cuesta menos que mantener una función
   * más.
   */
  config: function () {
    return Promise.all([
      pedir('/locales?select=codigo&activo=is.true&order=codigo.asc'),
      pedir('/equipo?select=local,vendedor,activo&order=vendedor.asc'),
      pedir('/objetivos?select=id,local,periodo,meta')
    ]).then(function (r) {
      var locales = (r[0] || []).map(function (l) { return l.codigo; });
      var equipo = r[1] || [], metas = r[2] || [];

      /* Un local que tiene gente cargada pero ya no está en la tabla sigue
         apareciendo: si cerró, su lista tiene que poder mirarse igual. */
      var vistos = {};
      locales.forEach(function (l) { vistos[clave_(l)] = l; });
      equipo.forEach(function (f) {
        var n = String(f.local || '').trim();
        if (n && !vistos[clave_(n)]) vistos[clave_(n)] = n;
      });

      var general = null, porLocal = {};
      metas.forEach(function (m) {
        if (!m.local) general = { periodo: m.periodo, meta: m.meta };
        else porLocal[clave_(m.local)] = { periodo: m.periodo, meta: m.meta };
      });

      return {
        status: 'ok',
        locales: Object.keys(vistos).sort().map(function (k) {
          return {
            local: vistos[k],
            vendedores: equipo.filter(function (f) {
              return clave_(f.local) === k && f.activo;
            }).map(function (f) { return f.vendedor; }),
            objetivo: porLocal[k] || null
          };
        }),
        periodos: ['dia', 'semana', 'mes'],
        general: general
      };
    });
  },

  /** Saca a alguien de la lista de un local. No lo borra: lo desactiva. */
  sacarVendedor: function (local, nombre) {
    return pedir('/equipo?local=eq.' + valor(local) + '&vendedor=eq.' + valor(nombre), {
      metodo: 'PATCH', cuerpo: { activo: false }
    }).then(function () { return true; });
  },

  /**
   * Pone, cambia o saca el objetivo de un local.
   *
   * `local` en '*' es el GENERAL: el que vale para todo local que no tenga
   * el suyo. En la base vive con el local en NULL. Se manda con un asterisco
   * y no vacío para que un error de la pantalla no termine escribiendo el
   * objetivo de todos sin querer.
   *
   * Una meta en cero lo borra, que es como se apaga.
   */
  objetivo: function (local, periodo, meta) {
    var general = local === '*';
    var n = Number(String(meta).replace(/[^0-9]/g, ''));
    if (n > 100000) return Promise.reject(new Error('Esa meta es demasiado grande.'));

    /* Se lee la tabla entera y se busca acá. Son quince filas, y filtrar en
       el servidor por un nombre de local con coma adentro parte la condición
       de PostgREST en dos. */
    return pedir('/objetivos?select=id,local').then(function (filas) {
      var k = general ? '' : clave_(local);
      var suyo = null;
      (filas || []).forEach(function (f) {
        if (clave_(f.local || '') === k) suyo = f;
      });

      if (!n) {
        if (!suyo) return null;
        return pedir('/objetivos?id=eq.' + suyo.id, { metodo: 'DELETE' })
          .then(function () { return null; });
      }

      var fila = { local: general ? null : local, periodo: periodo, meta: n };
      var camino = suyo
        ? pedir('/objetivos?id=eq.' + suyo.id, { metodo: 'PATCH', cuerpo: fila })
        : pedir('/objetivos', { metodo: 'POST', cuerpo: fila });
      return camino.then(function () { return { periodo: periodo, meta: n }; });
    });
  },

  /** Deja constancia en el historial. Nunca tumba lo que la llamó. */
  anotar: function (accion, local, detalle, quien) {
    return pedir('/log', {
      metodo: 'POST',
      cuerpo: { accion: accion, local: local, detalle: detalle, quien: quien }
    }).catch(function () { /* el historial no puede romper una carga */ });
  }
};


/* ════════════════════════════════════════════════════════════════════════
   LA TRADUCCIÓN DEL PANEL

   La pantalla habla como hablaba la planilla —`fecha1`, `obsSeguim`,
   `compro` con el texto "Sí - local"— y la base habla con tipos. Las dos
   funciones de acá abajo son el único lugar donde se cruzan.

   Se podría haber renombrado todo en el HTML. No se hizo: el panel son 765
   líneas de pantalla que ya funcionan, y cambiarlas entero para ganar dos
   funciones de veinte líneas es más superficie para romper.
   ════════════════════════════════════════════════════════════════════════ */

/** Una fila de la base, como la espera la pantalla. */
function deLaBase_(f) {
  var canal = f.compro_canal;
  return {
    id:          f.id,
    creado:      f.creado,
    fecha:       fechaLinda_(f.creado),
    dias:        Math.floor((Date.now() - new Date(f.creado).getTime()) / 86400000),
    sucursal:    f.sucursal || '',
    vendedor:    f.vendedor || '',
    nombre:      f.nombre || '',
    whatsapp:    f.whatsapp || '',
    mail:        f.mail || '',
    producto:    f.producto || '',
    talle:       f.talle || '',
    obs:         f.obs || '',
    motivo:      f.motivo || '',
    contactamos: f.contactado ? 'si' : '',
    responsable: f.responsable || '',
    fecha1:      f.contacto1_fecha ? fechaCorta_(f.contacto1_fecha) : '',
    resultado1:  f.contacto1_result || '',
    estado:      f.estado || '',
    obsSeguim:   f.obs_seguimiento || '',
    // Los dos campos de la base, de vuelta en el texto del desplegable.
    compro:      f.compro ? ('Sí - ' + (canal === 'online' ? 'online' : 'local')) : (f.estado || f.contactado ? 'No' : ''),
    productoFinal: f.producto_final || '',
    // El lead en Kommo, para poder abrirlo desde la ficha: el seguimiento se
    // trabaja allá y esta pantalla tiene que poder llevar hasta ahí.
    lead:        f.lead_kommo || '',
    // El descuento, para que la ficha sepa si ya se dio y no lo ofrezca dos
    // veces. Viene anidado desde la tabla `beneficios`; se toma el vivo, o
    // el último si no hay ninguno vivo.
    beneficio: beneficioDe_(f.beneficios),
    /* Con el punto de los miles: es un campo que se lee de un vistazo en
       una lista de fichas, y "92500" obliga a contar ceros. Vuelve a entrar
       bien porque aLaBase_ saca los puntos antes de guardarlo. */
    monto:       f.monto == null ? '' : Math.round(Number(f.monto)).toLocaleString('es-AR')
  };
}

/** Lo que toca la pantalla, como lo guarda la base. */
function aLaBase_(campos) {
  var c = {};
  if (campos.contactamos !== undefined) c.contactado = String(campos.contactamos).toLowerCase() === 'si';
  if (campos.responsable !== undefined) c.responsable = campos.responsable || null;
  if (campos.resultado1  !== undefined) c.contacto1_result = campos.resultado1 || null;
  if (campos.estado      !== undefined) c.estado = campos.estado || null;
  if (campos.obsSeguim   !== undefined) c.obs_seguimiento = campos.obsSeguim || null;

  /* La fecha del primer contacto: la pantalla manda "hoy" y acá se escribe
     como fecha de verdad. Antes era texto "23/4" y había que interpretarlo
     cada vez que alguien quería contar algo. */
  if (campos.fecha1 !== undefined) {
    c.contacto1_fecha = campos.fecha1 ? new Date().toISOString().slice(0, 10) : null;
  }

  /* "Compró" es un desplegable de tres opciones y en la base son dos campos.
     Y al decir que NO compró hay que limpiar el monto y el producto final: la
     base tiene una regla que prohíbe un monto sin venta, así que dejarlos
     puestos no guardaría "no compró", guardaría un error. */
  if (campos.compro !== undefined) {
    var v = String(campos.compro || '');
    c.compro = v.indexOf('Sí') === 0;
    c.compro_canal = c.compro ? (v.toLowerCase().indexOf('online') > -1 ? 'online' : 'local') : null;
    if (!c.compro) { c.monto = null; c.producto_final = null; }
  }

  if (campos.productoFinal !== undefined) c.producto_final = campos.productoFinal || null;
  if (campos.monto !== undefined) {
    var n = Number(String(campos.monto).replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.'));
    c.monto = (campos.monto === '' || isNaN(n)) ? null : n;
  }
  return c;
}

/**
 * De los beneficios de un cliente, el que la ficha tiene que mostrar.
 *
 * Gana el que todavía se puede usar. Si no hay ninguno vivo se muestra el
 * último, que es lo que contesta "sí, ya se le dio uno" cuando alguien está
 * por dar otro.
 */
function beneficioDe_(lista) {
  if (!lista || !lista.length) return null;
  var hoy = new Date().toISOString().slice(0, 10);
  var vivos = lista.filter(function (b) {
    return !b.usado && !b.anulado && (!b.vence || b.vence >= hoy);
  });
  var b = vivos[0] || lista[lista.length - 1];
  return {
    id: b.id,
    pct: b.pct,
    usado: !!b.usado,
    anulado: !!b.anulado,
    vencido: !b.usado && !b.anulado && !!b.vence && b.vence < hoy,
    vive: vivos.indexOf(b) > -1
  };
}

/** "sábado 20 de septiembre, 14:35" — lo que la ficha muestra arriba. */
function fechaLinda_(iso) {
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  } catch (e) { return String(iso || ''); }
}

/** "23/04" — corto, que es como se anotaba a mano. */
function fechaCorta_(fecha) {
  var p = String(fecha).slice(0, 10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] : String(fecha);
}
