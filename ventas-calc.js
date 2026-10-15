/* ═══════════════════════════════════════════════════════════════════════
   ventas-calc.js — las cuentas de la planilla del local, sin pantalla.

   Pedido de Mauricio (15/10/2026): pasar al sistema las planillas de cada
   local (Ventas, Tráfico, Informe Vendedor e Informe Temporada) "con las
   mismas fórmulas": los encargados se capacitaron con ellas. Acá están todas,
   una por una, tal como quedaron después del arreglo del 01/10 (totales
   ponderados por tickets, porcentajes enteros y días trabajados por vendedor).
   Al lado de cada cuenta, la celda de la planilla de la que sale.

   La base guarda sólo lo que se tipea; esto calcula el resto. Lo usan la
   pantalla (ventas.html) y la prueba que compara cada mes importado con la
   planilla al peso. Por eso no toca el DOM: entra lo que devuelve
   ventas_mes_leer y sale un objeto con todo calculado. El Informe Temporada
   (temporada, más abajo) junta los 6 meses del semestre ya calculados.

   Tres diferencias con la planilla, a propósito:
     · los vendedores no tienen tope (la planilla tenía 5 lugares fijos);
     · "Faltan vender" resta la venta de TODAS las semanas: la planilla
       dejaba afuera la 6.ª (G4 suma hasta J71), y en un mes de 6 semanas el
       último día no descontaba;
     · el ranking deja afuera la fila "Sin vendedor" (la planilla rankeaba
       también la 5.ª fila, la del guion).
   ═══════════════════════════════════════════════════════════════════════ */
(function (raiz) {
  'use strict';

  function def(x) { return x !== undefined && x !== null && x !== ''; }
  function n(x) { return def(x) ? Number(x) : null; }
  function cero(x) { return def(x) ? Number(x) || 0 : 0; }       // una celda vacía en una cuenta vale 0
  function suma(a) { var s = 0; for (var i = 0; i < a.length; i++) s += Number(a[i]) || 0; return s; }
  /* ROUND y ROUNDUP de la planilla: redondean "lejos del cero", y antes se limpia el ruido de la coma flotante. */
  function limpio(x) { return Math.round(x * 1e6) / 1e6; }
  function redondear(x) { return x < 0 ? -Math.round(limpio(-x)) : Math.round(limpio(x)); }
  function roundup(x) { return x < 0 ? -Math.ceil(limpio(-x)) : Math.ceil(limpio(x)); }
  function promPos(a) { var b = a.filter(function (x) { return def(x) && x > 0; }); return b.length ? suma(b) / b.length : null; }

  /* El mes: cuántos días tiene, qué día de la semana es el 1 (0 = lunes) y las semanas de la planilla
     (la 1 va del día 1 al primer domingo; después, de lunes a domingo). */
  function mesInfo(mes) {
    var p = String(mes).split('-'), a = +p[0], m = +p[1];
    var dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
    var primerDow = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7;
    return {
      anio: a, mes: m, dias: dias, primerDow: primerDow,
      dow: function (d) { return (primerDow + d - 1) % 7; },
      semana: function (d) { return Math.floor((d - 1 + primerDow) / 7) + 1; },
      semanas: Math.floor((dias - 1 + primerDow) / 7) + 1
    };
  }

  /* Hasta qué día del mes se puede haber cargado: el mes pasado entero, el que viene nada. */
  function diaHoy(hoy, M) {
    var p = String(hoy).split('-'), a = +p[0], m = +p[1], d = +p[2];
    if (a * 12 + m > M.anio * 12 + M.mes) return M.dias;
    if (a * 12 + m < M.anio * 12 + M.mes) return 0;
    return d;
  }

  function calcular(D) {
    var M = mesInfo(D.mes), HOY = diaHoy(D.hoy, M), cf = D.cfg || {};
    var c = {
      obj: cero(cf.objetivo), conv: cero(cf.conversion), tp: cero(cf.ticket), diasHabiles: cero(cf.dias_habiles),
      efectivo: cero(cf.efectivo), descuento: cero(cf.descuento), qLineas: cero(cf.q_lineas), qPrendas: cero(cf.q_prendas),
      pxtObj: cero(cf.pxt_obj), factor: cero(cf.factor), perfume: cero(cf.precio_perfume), boxer: cero(cf.precio_boxer),
      premios: (cf.premios || [null, null, null, null]).map(n),
      conDias: cf.con_dias !== false
    };
    var C = { M: M, hoy: HOY, cerrado: HOY >= M.dias, c: c };

    /* ── Lo cargado, en mapas ── */
    var V = (D.vendedores || []).map(function (v, i) {
      return { id: v.id, fila: i, nombre: v.nombre || '', sin: !v.nombre, pct: cero(v.pct), persona: v.persona || null,
               francos: (v.francos || []).map(function (k) { return (Number(k) + 6) % 7; }) };   // ISO 1..7 → 0 = lunes
    });
    var venta = {}, sem = {}, traf = {}, pesoDia = {}, pesoSem = {};
    (D.ventas || []).forEach(function (r) { (venta[r[0]] = venta[r[0]] || {})[r[1]] = Number(r[2]); });
    (D.semanal || []).forEach(function (r) {
      (sem[r.v] = sem[r.v] || {})[r.s] = { d: n(r.d), t: n(r.t), c: n(r.c), tp: n(r.tp), pf: n(r.pf), bx: n(r.bx), pxt: n(r.pxt) };
    });
    (D.trafico || []).forEach(function (r) { traf[r[0]] = [n(r[1]), n(r[2]), n(r[3])]; });
    (D.dias || []).forEach(function (r) { pesoDia[r[0]] = cero(r[1]); });
    (D.semanas || []).forEach(function (r) { pesoSem[r[0]] = cero(r[1]); });
    function vta(vid, d) { return (venta[vid] || {})[d]; }
    C.V = V;

    /* ── Ventas: los bloques semanales (filas 24 a 88) ── */
    var semanas = [];
    for (var s = 1; s <= M.semanas; s++) semanas.push({ n: s, peso: pesoSem[s] || 0, dias: [] });
    for (var d = 1; d <= M.dias; d++) {
      var w = semanas[M.semana(d) - 1];
      var obj = c.obj * (pesoDia[d] || 0) * w.peso;                                    // F26 = $G$18 * F24 * $J$24
      var real = 0, cargado = false, porV = {};
      V.forEach(function (v) { var x = vta(v.id, d); if (def(x)) { real += x; cargado = true; porV[v.id] = x; } });
      var tr = traf[d] || [];
      w.dias.push({
        d: d, k: M.dow(d), peso: pesoDia[d] || 0, obj: obj, real: real, cargado: cargado, porV: porV,
        nec: c.tp * c.conv > 0 ? roundup(obj / (c.tp * c.conv)) : 0,                  // Tráfico F24 = ROUNDUP(obj / (TP * conv))
        t: tr[0], cv: tr[1], tk: tr[2], futuro: d > HOY
      });
    }
    semanas.forEach(function (w) {
      w.obj = suma(w.dias.map(function (x) { return x.obj; }));                         // J26
      w.real = suma(w.dias.map(function (x) { return x.real; }));                       // J27
      w.desv = w.real - w.obj;                                                          // K27
      w.porVend = {};
      V.forEach(function (v) { w.porVend[v.id] = suma(w.dias.map(function (x) { return vta(v.id, x.d); })); });  // J29
      w.sinV = suma(V.filter(function (v) { return v.sin; }).map(function (v) { return w.porVend[v.id]; }));
      w.empezo = w.dias[0].d <= HOY;
      w.hab = Math.min(6, w.dias.length);                                               // IV C114 = MIN(6, días de la semana)
    });
    C.sem = semanas;
    var todos = [];
    semanas.forEach(function (w) { todos = todos.concat(w.dias); });
    C.todos = todos;

    C.E4 = suma(semanas.map(function (w) { return w.real; }));                          // E4
    var objDist = suma(semanas.map(function (w) { return w.obj; }));
    C.avance = objDist ? C.E4 / objDist : 0;                                            // C4
    C.faltan = Math.max(c.obj - C.E4, 0);                                               // G4 (con las 6 semanas)
    C.C22 = todos.filter(function (x) { return x.cargado; }).length;                    // C22 días transcurridos
    var prim = todos.slice(0, C.C22);
    C.desvAcum = suma(prim.map(function (x) { return x.real; })) - suma(prim.map(function (x) { return x.obj; }));  // I4 = AC26 - AC25
    C.L18 = Math.max(c.diasHabiles - C.C22, 1);                                         // L18 días restantes
    var fr = suma(todos.filter(function (x) { return x.real > 0; }).map(function (x) { return x.peso * semanas[M.semana(x.d) - 1].peso; }));
    C.proyPond = fr ? C.E4 / fr : null;                                                 // C13
    var conVenta = todos.filter(function (x) { return x.real > 0; }).length;
    C.proyLin = C.E4 ? C.E4 / Math.max(conVenta, 1) * M.dias : null;                   // F13
    C.efectivoPct = C.E4 ? c.efectivo / C.E4 : 0;                                       // I13
    C.tarjetaPct = C.E4 ? (C.E4 - c.efectivo) / C.E4 : 0;                               // J13
    C.descPct = (C.E4 + c.descuento) ? c.descuento / (C.E4 + c.descuento) : 0;          // K13

    /* Rankings (B9:K11): la semana es la última con venta; la planilla desempata a favor de la fila de más abajo. */
    var conNombre = V.filter(function (v) { return !v.sin; });
    var act = semanas.slice().reverse().filter(function (w) { return w.real > 0; })[0] || semanas[0];
    C.semAct = act.n;
    function top3(lista, k) {
      return lista.map(function (x, i) { x._o = x[k] + (i + 1) / 1000; return x; })
        .sort(function (a, b) { return b._o - a._o; }).slice(0, 3);
    }
    C.rkSem = top3(conNombre.map(function (v) {
      var o = c.obj * v.pct * act.peso;
      return { v: v, nombre: v.nombre, venta: act.porVend[v.id], av: o ? act.porVend[v.id] / o : 0 };   // E9
    }), 'venta');
    C.rkMes = top3(conNombre.map(function (v) {
      var real = suma(semanas.map(function (w) { return w.porVend[v.id]; })), o = c.obj * v.pct;
      return { v: v, nombre: v.nombre, obj: o, real: real, av: o ? real / o : 0 };                         // I9:K9
    }), 'real');
    C.pctSuma = suma(conNombre.map(function (v) { return v.pct; }));

    /* Escalón de objetivos (filas 92 a 95). */
    var ritmo = C.E4 / Math.max(C.C22, 1);                                              // J92
    C.escalon = [1, 1.1, 1.2, 1.3].map(function (k, i) {
      var meta = c.obj * k, falta = Math.max(meta - C.E4, 0), objDia = falta / C.L18;
      return { nivel: i ? '+' + i * 10 + '%' : 'Objetivo', meta: meta, premio: c.premios[i], falta: falta,
               desv: meta ? C.E4 / meta : 0, diasRest: C.L18, objDia: objDia, ritmo: ritmo, ok: ritmo >= objDia };
    });

    /* ── Tráfico ── */
    var T = C.traf = {};
    semanas.forEach(function (w) {
      var conT = w.dias.filter(function (x) { return x.t > 0; });
      w.tNec = suma(w.dias.map(function (x) { return x.nec; }));                        // J24
      w.tReal = w.dias.some(function (x) { return def(x.t); }) ? suma(w.dias.map(function (x) { return x.t; })) : null;   // J25
      var st = suma(conT.map(function (x) { return x.t; }));
      w.tConv = st ? suma(conT.map(function (x) { return x.t * (x.cv || 0); })) / st : null;                             // J26
      var conTk = w.dias.filter(function (x) { return x.tk > 0; }), tks = suma(conTk.map(function (x) { return x.real / x.tk; }));
      w.tTk = tks ? suma(conTk.map(function (x) { return x.real; })) / tks : null;                                         // J27
    });
    var dT = todos.filter(function (x) { return x.t > 0; });
    T.sumT = suma(semanas.map(function (w) { return w.tReal; }));                       // B4
    T.necTot = suma(semanas.map(function (w) { return w.tNec; }));                      // H5 "necesario"
    T.necCon = suma(dT.map(function (x) { return x.nec; }));
    T.L5 = T.necCon ? T.sumT / T.necCon - 1 : 0;                                        // L5 ritmo de tráfico
    var sT = suma(dT.map(function (x) { return x.t; }));
    T.D4 = sT ? suma(dT.map(function (x) { return x.t * (x.cv || 0); })) / sT : null;   // D4 conversión real
    var dTk = todos.filter(function (x) { return x.tk > 0; }), tk = suma(dTk.map(function (x) { return x.real / x.tk; }));
    T.F4 = tk ? suma(dTk.map(function (x) { return x.real; })) / tk : null;             // F4 ticket promedio
    T.H4 = T.sumT ? redondear(T.sumT / Math.max(dT.length, 1) * M.dias) : null;        // H4 proyección
    T.pxt = c.qLineas ? c.qPrendas / c.qLineas : 0;                                     // J4
    var resto = T.necTot - T.sumT;
    T.tpNec = [1, 1.1, 1.2, 1.3].map(function (k, i) {                                 // E8:E11, G8, I8
      var nec = resto <= 0 || !T.D4 ? null : Math.max(c.obj * k - C.E4, 0) / (resto * (1 + T.L5) * T.D4);
      return { nivel: i ? '+' + i * 10 + '%' : 'Objetivo', nec: nec, act: T.F4, desv: def(nec) && def(T.F4) ? T.F4 - nec : null };
    });
    T.sinDatos = !T.sumT;
    T.convNec = T.sinDatos || T.L5 >= 0 || !T.F4 || resto <= 0 ? null : (c.obj - C.E4) / (resto * (1 + T.L5) * T.F4);   // G14
    T.tpComp = T.sinDatos || T.L5 >= 0 ? null : T.tpNec[0].nec;                         // J14

    /* ── Informe Vendedor ── */
    C.iv = V.map(function (v) {
      var sv = sem[v.id] || {};
      var diasV = semanas.map(function (w) { var x = sv[w.n]; return x && def(x.d) ? x.d : w.hab; });   // C115 (vacío = los hábiles)
      /* SUMPRODUCT($N$21:$S$21, $C$115:$H$115 / $C$114:$H$114): el peso de cada semana según los días que trabajó. */
      var denom = suma(semanas.map(function (w, j) { return w.peso * diasV[j] / w.hab; }));
      var semV = semanas.map(function (w, j) {
        var crudo = !c.conDias ? c.obj * v.pct * w.peso                                // C26 sin la tabla: ROUND($D$14*$N$19*$N$21)
          : denom ? c.obj * v.pct * w.peso / denom * (diasV[j] / w.hab) : 0;
        var o = {
          venta: redondear(crudo),                                                      // C26
          t: c.tp * c.conv ? redondear(crudo / (c.tp * c.conv)) : 0,                    // C28
          c: c.conv, tp: c.tp,                                                          // C30, C32
          pf: c.perfume ? redondear(crudo * c.factor / c.perfume) : 0,                  // C34
          bx: c.boxer ? redondear(crudo * c.factor / c.boxer) : 0,                      // C36
          pxt: c.pxtObj                                                                 // C38
        };
        var x = sv[w.n] || {};
        var r = { venta: w.empezo ? w.porVend[v.id] : null, t: x.t, c: x.c, tp: x.tp, pf: x.pf, bx: x.bx, pxt: x.pxt };
        return { n: w.n, empezo: w.empezo, hab: w.hab, dias: diasV[j], diasCargado: !!(sv[w.n] && def(sv[w.n].d)),
                 crudo: crudo, o: o, r: r, desvio: w.porVend[v.id] - crudo };           // Ventas K29 = J29 - obj
      });
      var ob = {
        venta: suma(semV.map(function (s) { return s.o.venta; })), t: suma(semV.map(function (s) { return s.o.t; })),   // I26, I28
        c: c.conv, tp: c.tp, pf: suma(semV.map(function (s) { return s.o.pf; })), bx: suma(semV.map(function (s) { return s.o.bx; })), pxt: c.pxtObj
      };
      var R = semV.map(function (s) { return s.r; });
      function tot(k) { return R.some(function (r) { return def(r[k]); }) ? suma(R.map(function (r) { return r[k]; })) : null; }
      var t = { venta: tot('venta'), t: tot('t'), pf: tot('pf'), bx: tot('bx') };      // I27, I29, I35, I37
      /* Los ponderados del 01/10: tickets de la semana = venta / TP. */
      var conTp = R.filter(function (r) { return r.tp > 0; });
      var tickets = suma(conTp.map(function (r) { return cero(r.venta) / r.tp; }));
      var sumT = suma(R.map(function (r) { return r.t; }));
      t.c = sumT ? tickets / sumT : null;                                               // I31
      t.tp = tickets ? suma(conTp.map(function (r) { return cero(r.venta); })) / tickets : null;                          // I33
      t.pxt = tickets ? suma(conTp.map(function (r) { return cero(r.venta) / r.tp * cero(r.pxt); })) / tickets : null;    // I39
      function dv(a, b) { return def(a) && a !== 0 && b ? a / b - 1 : null; }
      var desv = { venta: dv(t.venta, ob.venta), t: dv(t.t, ob.t), c: dv(t.c, ob.c), tp: dv(t.tp, ob.tp),            // J27..J39
                   pf: dv(t.pf, ob.pf), bx: dv(t.bx, ob.bx), pxt: dv(t.pxt, ob.pxt) };
      return { v: v, fila: v.fila, semanas: semV, ob: ob, tot: t, desv: desv,
               conDatos: v.sin ? R.some(function (r) { return def(r.t) || def(r.c) || def(r.tp) || def(r.pf) || def(r.bx) || def(r.pxt); }) || t.venta > 0 : true };
    });

    /* Resumen del local por semana (filas 5 a 11): suma también la fila sin vendedor, como la planilla. */
    C.res = semanas.map(function (w, j) {
      var R = C.iv.map(function (x) { return x.semanas[j].r; });
      function sm(k) { return R.some(function (r) { return def(r[k]); }) ? suma(R.map(function (r) { return r[k]; })) : null; }
      return {
        venta: w.empezo ? w.real : null,                                                // C5
        t: sm('t'), c: promPos(R.map(function (r) { return r.c; })), tp: promPos(R.map(function (r) { return r.tp; })),   // C6:C8
        pf: sm('pf'), bx: sm('bx'), pxt: promPos(R.map(function (r) { return r.pxt; }))                                   // C9:C11
      };
    });
    function sumaTot(k) { var a = C.iv.map(function (x) { return x.tot[k]; }); return a.some(def) ? suma(a) : null; }
    C.resT = {
      venta: sumaTot('venta'), t: sumaTot('t'),                                         // I5, I6
      c: promPos(C.res.map(function (r) { return r.c; })), tp: promPos(C.res.map(function (r) { return r.tp; })),   // I7, I8
      pf: sumaTot('pf'), bx: sumaTot('bx'), pxt: promPos(C.res.map(function (r) { return r.pxt; }))                   // I9:I11
    };
    var pfObj = suma(C.iv.map(function (x) { return x.ob.pf; })), bxObj = suma(C.iv.map(function (x) { return x.ob.bx; }));
    var tObj = c.tp * c.conv ? c.obj / (c.tp * c.conv) : 0, rt = C.resT;
    C.resD = {                                                                          // J5:J11
      venta: c.obj && def(rt.venta) ? rt.venta / c.obj - 1 : null,
      t: tObj && def(rt.t) ? rt.t / tObj - 1 : null,
      c: def(rt.c) ? rt.c - c.conv : null,
      tp: def(rt.tp) && c.tp ? rt.tp / c.tp - 1 : null,
      pf: pfObj && def(rt.pf) ? rt.pf / pfObj - 1 : null,
      bx: bxObj && def(rt.bx) ? rt.bx / bxObj - 1 : null,
      pxt: def(rt.pxt) && c.pxtObj ? rt.pxt / c.pxtObj - 1 : null
    };
    return C;
  }

  /* ═══ Informe Temporada ═══
     El semestre comercial (septiembre a febrero, o marzo a agosto) mes por mes, con lo que calcula cada
     mes. Entran los 6 meses en orden: { mes, D: lo de ventas_mes_leer (o null), C: calcular(D) (o null
     si ese mes no tiene planilla) }. Lo que en la planilla sale "de septiembre" (conversión, ticket y PxT
     objetivo, factor y precios) es lo del primer mes del semestre que tenga planilla.
     Dos diferencias con la planilla, a propósito:
       · el ranking muestra a todos los vendedores del semestre (la planilla mostraba a los 5 del último
         mes y el resto iba a "Otros del semestre"); lo que quedó sin vendedor va en su propia fila;
       · entre un mes y otro se reconoce al vendedor por su usuario de Equipo VDH y, si no tiene, por el
         nombre (la planilla, sólo por el nombre). */
  var MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  /* Los 6 meses del semestre de un mes ('2026-10-01' → septiembre 2026 a febrero 2027). */
  function semestre(mes) {
    var p = String(mes).split('-'), a = +p[0], m = +p[1];
    var a0 = m <= 2 ? a - 1 : a, m0 = m >= 3 && m <= 8 ? 3 : 9, r = [];
    for (var i = 0; i < 6; i++) {
      var k = m0 - 1 + i, aa = a0 + Math.floor(k / 12), mm = k % 12 + 1;
      r.push(aa + '-' + (mm < 10 ? '0' : '') + mm + '-01');
    }
    return r;
  }

  function estado(real, av) { return !real ? 'sin' : av >= 1 ? 'ok' : av >= 0.95 ? 'cerca' : 'atencion'; }   // H12
  function norm(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  function temporada(meses) {
    var T = { filas: [] }, base = null;
    meses.forEach(function (x) { if (!base && x.C) base = x.C.c; });
    T.base = base;
    var acR = 0, acO = 0;
    meses.forEach(function (x) {
      var C = x.C, p = String(x.mes).split('-');
      var f = { mes: x.mes, nombre: MESES[+p[1] - 1], anio: +p[0], hay: !!C, empezo: !!C && C.hoy > 0 };
      f.obj = C ? C.c.obj : 0;                                                          // C12 = Ventas G18
      f.real = C ? C.E4 : 0;                                                            // D12 = Ventas E4
      f.av = f.obj ? f.real / f.obj : 0;                                                // E12
      acR += f.real; acO += f.obj;
      f.acum = acR; f.acumObj = acO; f.desvAcum = acR - acO;                            // F12, V12, G12
      f.estado = estado(f.real, f.av);                                                  // H12
      f.t = C ? C.traf.sumT || 0 : 0;                                                   // K12 = Tráfico B4
      f.conv = C && C.traf.D4 ? C.traf.D4 : 0;                                          // L12 = Tráfico D4
      f.tk = f.t * f.conv ? f.real / (f.t * f.conv) : 0;                                // M12
      f.pxt = C ? C.traf.pxt : 0;                                                       // N12 = Tráfico J4
      f.ant = x.D && def(x.D.venta_anterior) ? Number(x.D.venta_anterior) : null;       // C22 (ámbar)
      f.pf = C ? cero(C.resT.pf) : 0;                                                   // Informe Vendedor I9
      f.bx = C ? cero(C.resT.bx) : 0;                                                   // Informe Vendedor I10
      f.w = f.real ? f.av : 9999;                                                       // W12
      T.filas.push(f);
    });
    var F = T.filas;
    function col(k) { return F.map(function (f) { return f[k]; }); }
    T.obj = suma(col('obj')); T.real = suma(col('real'));                               // C18, D18 (= C6)
    T.av = T.obj ? T.real / T.obj : 0;                                                  // E18 (= F6)
    T.desv = T.real - T.obj;                                                            // G18 (= F7)
    T.estado = estado(T.real, T.av);                                                    // H18
    T.t = suma(col('t'));                                                               // K18 (= J6)
    T.conv = promPos(col('conv')) || 0;                                                 // L18 (= J7)
    T.tk = T.t * T.conv ? T.real / (T.t * T.conv) : 0;                                  // M18 (= N6)
    T.pxt = promPos(col('pxt')) || 0;                                                   // N18
    T.tkObj = base ? base.tp : 0;
    T.tkDesv = T.tk - T.tkObj;                                                          // N7

    /* Contra el semestre anterior (filas 22 a 28). */
    T.ant = suma(col('ant'));                                                           // C28
    F.forEach(function (f) {
      f.antVar = f.ant ? f.real / f.ant - 1 : 0;                                        // E22 (sin dato anterior: 0)
      f.antDif = f.real - cero(f.ant);                                                  // F22
      f.peso = T.real ? f.real / T.real : 0;                                            // G22
      f.tend = f.antVar > 0 ? '▲' : f.antVar < 0 ? '▼' : '=';                          // H22
    });
    T.antVar = T.ant ? T.real / T.ant - 1 : 0;                                          // E28
    T.antDif = T.real - T.ant;                                                          // F28 (= C7)
    T.antTend = T.antVar > 0 ? '▲' : T.antVar < 0 ? '▼' : '=';                         // H28

    /* Foco del semestre (M22:M28). MATCH se queda con el primero. */
    var hayVenta = F.some(function (f) { return f.real > 0; });
    function primero(k, mejor) {
      var b = null;
      F.forEach(function (f) { if (b === null || (mejor ? f[k] > b[k] : f[k] < b[k])) b = f; });
      return b;
    }
    T.mejor = hayVenta ? primero('av', true) : null;                                    // M22
    T.peor = hayVenta ? primero('w', false) : null;                                     // M23
    T.sobreObj = F.filter(function (f) { return f.av >= 1; }).length;                  // M24
    T.brechaConv = T.conv - (base ? base.conv : 0);                                     // M25
    T.brechaPxt = T.pxt - (base ? base.pxtObj : 0);                                     // M26
    T.pf = redondear(suma(col('pf')));                                                  // M27
    T.pfObj = base && base.perfume ? redondear(T.obj * base.factor / base.perfume) : null;
    T.bx = redondear(suma(col('bx')));                                                  // M28
    T.bxObj = base && base.boxer ? redondear(T.obj * base.factor / base.boxer) : null;

    /* Ranking semestral (P12:T18): la venta de cada uno es la suma de su total de Informe Vendedor (I27)
       de cada mes; el PxT, el promedio de sus PxT de cada mes (I39) que no sean 0. */
    var porNombre = {}, vend = {}, lista = [];
    meses.forEach(function (x) { if (x.C) x.C.V.forEach(function (v) { if (!v.sin && v.persona) porNombre[norm(v.nombre)] = v.persona; }); });
    T.sinV = 0;
    meses.forEach(function (x) {
      if (!x.C) return;
      x.C.iv.forEach(function (iv) {
        var v = iv.v, venta = cero(iv.tot.venta);
        if (v.sin) { T.sinV += venta; return; }
        var k = v.persona || porNombre[norm(v.nombre)] || 'n:' + norm(v.nombre);
        if (!vend[k]) { vend[k] = { clave: k, nombre: v.nombre, venta: 0, pxts: [] }; lista.push(vend[k]); }
        var r = vend[k];
        r.nombre = v.nombre;                                                            // el nombre del último mes
        r.venta += venta;
        if (iv.tot.pxt > 0) r.pxts.push(iv.tot.pxt);
      });
    });
    T.rk = lista.map(function (r, i) {
      var venta = Math.floor(limpio(r.venta));                                          // R12 = INT(...)
      return { nombre: r.nombre, venta: venta, part: T.real ? venta / T.real : 0, pxt: promPos(r.pxts), _o: i };
    }).filter(function (r) { return r.venta > 0; })
      .sort(function (a, b) { return b.venta - a.venta || a._o - b._o; });
    T.rkPxt = promPos(T.rk.map(function (r) { return r.pxt; }));                       // T18
    T.sinV = Math.floor(limpio(T.sinV));
    T.otros = Math.max(0, T.real - suma(T.rk.map(function (r) { return r.venta; })) - T.sinV);
    if (T.otros < 1) T.otros = 0;
    return T;
  }

  var api = { calcular: calcular, mesInfo: mesInfo, diaHoy: diaHoy, redondear: redondear, roundup: roundup, def: def,
              semestre: semestre, temporada: temporada, MESES: MESES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.VentasCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);   // globalThis: también en Apps Script (el consolidador lleva una copia)
