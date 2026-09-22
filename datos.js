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
 */

var BASE = 'https://gfjdjupuwxohkgchqykx.supabase.co';
var CLAVE = 'sb_publishable_A81zY5i4zCXZyIv2fOpokA_jOxiccNU';

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

  return fetch(BASE + '/rest/v1' + ruta, {
    method: opciones.metodo || 'GET',
    headers: cabeceras,
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined
  }).then(function (r) {
    if (!r.ok) {
      return r.text().then(function (t) {
        var msg = t;
        try { msg = JSON.parse(t).message || JSON.parse(t).hint || t; } catch (e) {}
        throw new Error('La base respondió ' + r.status + ': ' + msg);
      });
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
        throw new Error(msg);
      });
    }
    return r.json();
  });
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

var datos = {

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

  /** Si este cliente tiene un descuento sin usar. Se busca por teléfono. */
  beneficio: function (telefono) {
    return funcion('beneficio_buscar', { telefono: telefono }).then(function (filas) {
      return Array.isArray(filas) ? (filas[0] || null) : filas;
    });
  },

  /** Lo usa: marca el descuento y deja la venta registrada, todo junto. */
  usarBeneficio: function (telefono, local, vendedor, monto, producto) {
    return funcion('beneficio_usar', {
      telefono: telefono, p_local: local, p_vendedor: vendedor,
      p_monto: monto, p_producto: producto || null
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
