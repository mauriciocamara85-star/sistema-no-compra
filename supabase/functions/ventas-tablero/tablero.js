/* ═══════════════════════════════════════════════════════════════════════
   tablero.js — las tablas del dashboard y del Ranking, armadas con lo que
   se carga en el Sistema VDH.

   Pedido de Mauricio (23/10/2026): que el dashboard lea directo del
   sistema, "sin Drive, sin un consolidador de planilla, sin nada". Hasta
   ahora las armaba el consolidador (el Apps Script de la planilla
   CONSOLIDADORA) leyendo las 14 planillas y la del e-commerce cada hora.
   Esto arma las MISMAS tablas, con las MISMAS columnas y los mismos
   nombres de local, así el dashboard y el Ranking sólo cambian el enlace:

     LOCAL_DIARIO      · un renglón por día y local
     VENDEDOR_DIARIO   · un renglón por día, local y vendedor
     VENDEDOR_SEMANAL  · un renglón por semana, local y vendedor
     ECOM_DIARIO       · un renglón por día del e-commerce
     ECOM_SEMANAL      · embudo y Meta Ads por semana

   VENDEDOR_FOTOS no está: ni el dashboard ni el Ranking la leían (era para
   el mail de control del consolidador).

   Las cuentas son las de la planilla, en VentasCalc (ventas-calc.js, una
   COPIA del de la raíz del repo, la misma que usa la pantalla Ventas: no se
   edita acá: se copia tal cual desde la raíz antes de publicar la función, y
   la prueba avisa si quedaron distintas). Lo de los locales es lo que
   hacía el consolidador v15 con los meses que venían del sistema
   (filasDelSistema), que se comparó al peso contra las planillas el 15/10.

   Lo usan la función (index.ts) y las pruebas de Node.
   ═══════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';

  /* Los locales en el orden del consolidador, con el nombre que tenían en las tablas (la celda C18 de
     cada planilla): el dashboard y el Ranking los conocen así. Un local nuevo que no esté acá sale con su
     nombre en mayúsculas, al final. */
  var LOCALES = [
    { id: '7ce69820-6c1b-48a2-bdaa-4a546f448522', tablero: 'RIVADAVIA' },
    { id: '962a073e-88f4-486a-80e3-e8c0925cc7e5', tablero: 'FLORES' },
    { id: 'cf783678-15cb-4a79-bde1-ae3c3a2b72fb', tablero: 'PARQUE BROWN' },
    { id: 'bbbf96cf-82a8-49b2-bf58-d21212a24583', tablero: 'UNICENTER' },
    { id: '8687a0de-4a0a-4c16-aca6-6f01ba8be79a', tablero: 'MORÓN' },
    { id: '241bc62d-deb0-4699-ae43-d6bcc45bacaa', tablero: 'SAN JUSTO SHOPPING' },
    { id: '451e6952-11ab-4d94-a694-a4eebc90d100', tablero: 'ITUZAINGÓ' },
    { id: '5ed0fd42-25dd-46d3-b58f-50701f971881', tablero: 'PACHECO' },
    { id: 'e174eba0-c90e-4797-90cc-b51e5d846a80', tablero: 'VILLA DEL PARQUE' },
    { id: '9a155106-4599-4345-adf9-7b6333cc2372', tablero: 'GRAND BOURG' },
    { id: '4458a46f-5295-4b6a-844f-5884c77f66f9', tablero: 'LOMAS DE ZAMORA' },
    { id: '53cf8547-894a-4aa0-ab97-ea3c4025cbda', tablero: 'CASEROS' },
    { id: '8835ca44-79d4-40bd-a2a3-77dc9325584b', tablero: 'DOT' },
    { id: '45e376c7-6139-43f4-84de-173cd5346c77', tablero: 'SAN JUSTO 1' }
  ];
  var DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  var PXT_OBJETIVO = 2.5;            // el consolidador lo mandaba fijo para los 14 locales
  var CANAL = 'E-COMMERCE ';         // con el espacio del final: así venía de la celda C18 de la planilla

  var COLUMNAS = {
    LOCAL_DIARIO: ['Fecha', 'Local', 'Mes', 'Semana', 'Día', 'Objetivo', 'Venta real',
                   'Tráfico nec.', 'Tráfico real', 'Conversión', 'Ticket prom.',
                   'Efectivo', 'Tarjeta', 'Descuento', 'Conversión obj', 'Ticket obj',
                   'PxT real', 'PxT obj', 'Precio perfume', 'Precio boxer', 'Factor accesorios'],
    VENDEDOR_DIARIO: ['Fecha', 'Local', 'Mes', 'Semana', 'Día', 'Vendedor', 'Venta real', 'Objetivo del día'],
    VENDEDOR_SEMANAL: ['Local', 'Mes', 'Semana', 'Vendedor', 'Venta obj', 'Venta real',
                       'Tráfico obj', 'Tráfico real', 'Conv obj', 'Conv real', 'TP obj', 'TP real',
                       'Perfumes obj', 'Perfumes real', 'Boxer obj', 'Boxer real', 'PxT obj', 'PxT real'],
    ECOM_DIARIO: ['Fecha', 'Canal', 'Mes', 'Semana', 'Día', 'Objetivo', 'Venta real',
                  'Visitas', 'Q Ventas', 'Conversión', 'Ticket prom.'],
    ECOM_SEMANAL: ['Canal', 'Mes', 'Semana', 'Visitas', 'Carritos', 'Compras', 'Facturación',
                   '% Car/Vis', '% Com/Car', 'Conversión', 'Ticket prom.',
                   'Inversión sin imp.', 'Inversión con imp.', 'Facturación Meta',
                   'Ventas Meta', 'Visitas Meta', 'Carritos Meta',
                   'ROAS', 'ROAS con imp.', 'Costo x compra', 'Costo x carrito',
                   'Costo x visita', '% Inv / Fact', 'Ticket obj', 'Conversión obj']
  };
  var TABLAS = Object.keys(COLUMNAS);

  function vc() {
    var x = raiz.VentasCalc || (typeof require === 'function' ? require('./ventas-calc.js') : null);
    if (!x) throw new Error('falta ventas-calc.js');
    return x;
  }
  /* Una celda vacía vale 0, como num() del consolidador. Lo que llega acá ya es número o null. */
  function num(v) {
    if (v === '' || v === null || v === undefined) return 0;
    var n = Number(v);
    return isFinite(n) ? n : 0;
  }
  function dos(n) { return ('0' + n).slice(-2); }
  function fecha(anio, nMes, d) { return anio + '-' + dos(nMes + 1) + '-' + dos(d); }
  /* El renglón como objeto, con las columnas de su tabla en orden (como lo devolvía el consolidador). */
  function fila(tabla, valores) {
    var o = {}, cab = COLUMNAS[tabla];
    for (var i = 0; i < cab.length; i++) o[cab[i]] = valores[i] === undefined ? null : valores[i];
    return o;
  }

  /* Las filas de un mes de un local (lo que hacía filasDelSistema en el consolidador v15). */
  function filasLocal(D, nombre, T) {
    var VC = vc(), p = String(D.mes).split('-'), anio = +p[0], nMes = +p[1] - 1, mes = VC.MESES[nMes];
    var C = VC.calcular(D), c = C.c;
    var conNombre = C.V.filter(function (v) { return !v.sin; });
    if (!conNombre.length) return;                                       // como un mes de planilla sin vendedores
    var iv = {};
    C.iv.forEach(function (x) { iv[x.v.id] = x; });

    C.sem.forEach(function (w, b) {
      w.dias.forEach(function (x) {
        var f = fecha(anio, nMes, x.d), dia = DIAS_SEMANA[x.k];
        T.LOCAL_DIARIO.push(fila('LOCAL_DIARIO', [f, nombre, mes, w.n, dia,
          x.obj, x.real, x.nec, num(x.t), num(x.cv), num(x.tk),
          C.efectivoPct, C.tarjetaPct, C.descPct, c.conv, c.tp,
          C.traf.pxt, PXT_OBJETIVO, c.perfume, c.boxer, c.factor]));
        /* El objetivo del día de cada vendedor: su objetivo de la semana por el peso del día. */
        var pesoDia = w.obj > 0 ? x.obj / w.obj : (1 / 7);
        conNombre.forEach(function (v) {
          T.VENDEDOR_DIARIO.push(fila('VENDEDOR_DIARIO', [f, nombre, mes, w.n, dia, v.nombre,
            num(x.porV[v.id]), Math.round(iv[v.id].semanas[b].o.venta * pesoDia)]));
        });
      });
    });

    conNombre.forEach(function (v) {
      iv[v.id].semanas.forEach(function (s) {
        if (!s.empezo) return;                                           // sólo las semanas que ya arrancaron
        var o = s.o, r = s.r;
        T.VENDEDOR_SEMANAL.push(fila('VENDEDOR_SEMANAL', [nombre, mes, s.n, v.nombre,
          o.venta, num(r.venta), o.t, num(r.t), o.c, num(r.c), o.tp, num(r.tp),
          o.pf, num(r.pf), o.bx, num(r.bx), o.pxt, num(r.pxt)]));
      });
    });
  }

  /* Las filas de un mes del e-commerce: los bloques de cada día (filas 22 a 80 de la planilla) y el embudo
     y Meta Ads de cada semana (filas 92 a 114), como los leía el consolidador. */
  function filasEcom(D, T) {
    var VC = vc(), p = String(D.mes).split('-'), anio = +p[0], nMes = +p[1] - 1, mes = VC.MESES[nMes];
    var C = VC.ecom(D), c = C.c;
    /* La conversión objetivo viaja como fracción; un "1" mal cargado quería decir 1% (consolidador v11). */
    var convObj = c.conv >= 1 ? c.conv / 100 : c.conv;
    C.sem.forEach(function (w, i) {
      w.dias.forEach(function (x) {
        T.ECOM_DIARIO.push(fila('ECOM_DIARIO', [fecha(anio, nMes, x.d), CANAL, mes, w.n, DIAS_SEMANA[x.k],
          x.obj, num(x.real), num(x.vis), num(x.q), num(x.conv), num(x.tk)]));
      });
      var e = C.emb[i], m = w.meta;
      var f = [CANAL, mes, w.n, num(e.vis), num(e.car), num(e.com), num(e.fact),
               e.carVis, e.comCar, e.conv, e.tk,
               m.inv, m.invImp, m.fact, m.vtas, m.vis, m.car,
               m.roas, m.roasImp, m.cpa, m.cCar, m.cVis, m.pctInv,
               c.tp, convObj];
      if (f[3] + f[6] + f[11] === 0) return;                             // sin visitas, ni facturación, ni inversión
      T.ECOM_SEMANAL.push(fila('ECOM_SEMANAL', f));
    });
  }

  /* datos = lo que devuelve ventas_tablero(): { hoy, meses: [ventas_mes_datos…], ecom: [ventas_ecom_datos…] }. */
  function armar(datos) {
    var T = {};
    TABLAS.forEach(function (t) { T[t] = []; });
    var meses = (datos && datos.meses) || [], porLocal = {}, orden = LOCALES.map(function (l) { return l.id; });
    meses.forEach(function (D) {
      if (!D || !D.local || !D.cfg) return;
      var id = D.local.id;
      if (!porLocal[id]) porLocal[id] = [];
      porLocal[id].push(D);
      if (orden.indexOf(id) < 0) orden.push(id);
    });
    orden.forEach(function (id) {
      var L = porLocal[id];
      if (!L) return;
      var conocido = LOCALES.filter(function (l) { return l.id === id; })[0];
      var nombre = conocido ? conocido.tablero : String(L[0].local.nombre || '').toUpperCase();
      L.sort(function (a, b) { return String(a.mes) < String(b.mes) ? -1 : 1; })
       .forEach(function (D) { filasLocal(D, nombre, T); });
    });
    ((datos && datos.ecom) || []).slice()
      .sort(function (a, b) { return String(a.mes) < String(b.mes) ? -1 : 1; })
      .forEach(function (D) { filasEcom(D, T); });
    return T;
  }

  var api = { armar: armar, TABLAS: TABLAS, COLUMNAS: COLUMNAS, LOCALES: LOCALES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Tablero = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
