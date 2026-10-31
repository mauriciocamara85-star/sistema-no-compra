/**
 * El escáner de papeles (31/10/2026). Pedido de Mauricio: el certificado médico y el apercibimiento se sacan con la
 * cámara "tipo la aplicación Scanner": encuentra la hoja, la endereza y la deja blanca y nítida.
 *
 * Sin librerías (nada que bajar en el celular del local): todo es cuenta sobre los píxeles.
 *  1. La hoja: el gris de la imagen achicada, el corte de Otsu (la hoja es lo claro), la mancha clara más grande con
 *     sus agujeros (la letra) rellenos, y las 4 esquinas que encierran más superficie de su contorno. Si no se parece
 *     a una hoja (muy chica, torcida o es toda la mesa), no la marca y quedan 4 esquinas para mover a mano.
 *  2. Enderezar: la homografía de las 4 esquinas a un rectángulo del tamaño de la hoja (lado largo 1600 px).
 *  3. Realzar: el fondo de cada color (lo claro de cada zona) se lleva a blanco, así la sombra y la luz amarilla se
 *     van y la letra queda oscura. "Color" deja los sellos azules; "Blanco y negro" es el gris con más contraste.
 *
 * Tres pantallas: la cámara (con la hoja marcada en vivo), las esquinas (para corregir) y el resultado (color o
 * blanco y negro, girar, otra hoja). Escaner.abrir(op) arranca por la cámara; Escaner.desdeArchivo(archivo, op), por
 * las esquinas (la compu, o la foto que llegó por WhatsApp). op: { titulo, guia, maxHojas, alTerminar(blobs),
 * alCerrar(), confirmar(texto) → promesa de true o false, sinCamara, unaSola, textoListo }. Las cuentas también
 * corren en Node, para las pruebas (module.exports).
 */
(function (raiz) {
  'use strict';

  /* ════════════════════════════════════════════════════════════════════
     LAS CUENTAS (imágenes como { width, height, data: RGBA })
     ════════════════════════════════════════════════════════════════════ */

  /** El gris (0-255) de cada píxel. */
  function gris(img) {
    var n = img.width * img.height, g = new Float32Array(n), d = img.data;
    for (var i = 0, j = 0; i < n; i++, j += 4) g[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    return g;
  }

  /** Promedio en un cuadrado de (2r+1) de lado (dos pasadas, con sumas corridas). */
  function suavizar(g, w, h, r) {
    var t = new Float32Array(w * h), o = new Float32Array(w * h), x, y, s, k;
    for (y = 0; y < h; y++) {
      s = 0; k = 0;
      for (x = -r; x <= r; x++) { var xx = Math.min(w - 1, Math.max(0, x)); s += g[y * w + xx]; k++; }
      for (x = 0; x < w; x++) {
        t[y * w + x] = s / k;
        var sale = Math.max(0, x - r), entra = Math.min(w - 1, x + r + 1);
        s += g[y * w + entra] - g[y * w + sale];
      }
    }
    for (x = 0; x < w; x++) {
      s = 0; k = 0;
      for (y = -r; y <= r; y++) { var yy = Math.min(h - 1, Math.max(0, y)); s += t[yy * w + x]; k++; }
      for (y = 0; y < h; y++) {
        o[y * w + x] = s / k;
        var sa = Math.max(0, y - r), en = Math.min(h - 1, y + r + 1);
        s += t[en * w + x] - t[sa * w + x];
      }
    }
    return o;
  }

  /** El corte de Otsu: el gris que mejor separa lo claro de lo oscuro. */
  function otsu(g) {
    var hist = new Float64Array(256), n = g.length, i;
    for (i = 0; i < n; i++) hist[Math.max(0, Math.min(255, g[i] | 0))]++;
    var total = 0;
    for (i = 0; i < 256; i++) total += i * hist[i];
    var sB = 0, wB = 0, mejor = 0, corte = 127;
    for (i = 0; i < 256; i++) {
      wB += hist[i];
      if (!wB) continue;
      var wF = n - wB;
      if (!wF) break;
      sB += i * hist[i];
      var mB = sB / wB, mF = (total - sB) / wF, entre = wB * wF * (mB - mF) * (mB - mF);
      if (entre > mejor) { mejor = entre; corte = i; }
    }
    return corte;
  }

  /** La envolvente convexa (cadena monótona), en orden antihorario en coordenadas de pantalla. */
  function envolvente(pts) {
    pts = pts.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; });
    if (pts.length < 3) return pts;
    var cruz = function (o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); };
    var abajo = [], arriba = [], i;
    for (i = 0; i < pts.length; i++) {
      while (abajo.length >= 2 && cruz(abajo[abajo.length - 2], abajo[abajo.length - 1], pts[i]) <= 0) abajo.pop();
      abajo.push(pts[i]);
    }
    for (i = pts.length - 1; i >= 0; i--) {
      while (arriba.length >= 2 && cruz(arriba[arriba.length - 2], arriba[arriba.length - 1], pts[i]) <= 0) arriba.pop();
      arriba.push(pts[i]);
    }
    abajo.pop(); arriba.pop();
    return abajo.concat(arriba);
  }

  function superficie(q) {
    var s = 0;
    for (var i = 0; i < q.length; i++) { var a = q[i], b = q[(i + 1) % q.length]; s += a.x * b.y - b.x * a.y; }
    return Math.abs(s) / 2;
  }

  /** Las 4 esquinas en orden: arriba-izq, arriba-der, abajo-der, abajo-izq. */
  function ordenarEsquinas(q) {
    var cx = 0, cy = 0;
    q.forEach(function (p) { cx += p.x / q.length; cy += p.y / q.length; });
    var r = q.slice().sort(function (a, b) { return Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx); });
    /* Empieza por la de arriba a la izquierda (la de menor x+y) y sigue en el sentido de las agujas del reloj. */
    var k = 0;
    r.forEach(function (p, i) { if (p.x + p.y < r[k].x + r[k].y) k = i; });
    return r.slice(k).concat(r.slice(0, k));
  }

  function angulo(a, b, c) {
    var ux = a.x - b.x, uy = a.y - b.y, vx = c.x - b.x, vy = c.y - b.y;
    var cos = (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1);
    return Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI;
  }

  /**
   * Busca la hoja en una imagen (conviene achicada: lado largo ~360). Devuelve { esquinas, cubre } en píxeles de esa
   * imagen, o null si no hay nada que parezca una hoja.
   */
  function detectarHoja(img) {
    var w = img.width, h = img.height, n = w * h;
    var g = suavizar(gris(img), w, h, 2);
    var corte = otsu(g);
    var claro = new Uint8Array(n), i;
    for (i = 0; i < n; i++) claro[i] = g[i] > corte ? 1 : 0;

    /* La mancha clara más grande (vecinos de a 4). */
    var marca = new Int32Array(n), pila = new Int32Array(n), mejor = 0, mejorTam = 0, nro = 0;
    for (i = 0; i < n; i++) {
      if (!claro[i] || marca[i]) continue;
      nro++;
      var tam = 0, tope = 0;
      pila[tope++] = i; marca[i] = nro;
      while (tope) {
        var p = pila[--tope]; tam++;
        var x = p % w, y = (p / w) | 0;
        if (x > 0 && claro[p - 1] && !marca[p - 1]) { marca[p - 1] = nro; pila[tope++] = p - 1; }
        if (x < w - 1 && claro[p + 1] && !marca[p + 1]) { marca[p + 1] = nro; pila[tope++] = p + 1; }
        if (y > 0 && claro[p - w] && !marca[p - w]) { marca[p - w] = nro; pila[tope++] = p - w; }
        if (y < h - 1 && claro[p + w] && !marca[p + w]) { marca[p + w] = nro; pila[tope++] = p + w; }
      }
      if (tam > mejorTam) { mejorTam = tam; mejor = nro; }
    }
    if (mejorTam < n * 0.08) return null;

    /* Sus agujeros (la letra, los sellos) cuentan como hoja: lo de afuera es lo que se alcanza desde el borde. */
    var afuera = new Uint8Array(n), tope2 = 0;
    var empujar = function (q) { if (!afuera[q] && marca[q] !== mejor) { afuera[q] = 1; pila[tope2++] = q; } };
    for (i = 0; i < w; i++) { empujar(i); empujar((h - 1) * w + i); }
    for (i = 0; i < h; i++) { empujar(i * w); empujar(i * w + w - 1); }
    while (tope2) {
      var q = pila[--tope2], qx = q % w, qy = (q / w) | 0;
      if (qx > 0) empujar(q - 1);
      if (qx < w - 1) empujar(q + 1);
      if (qy > 0) empujar(q - w);
      if (qy < h - 1) empujar(q + w);
    }
    var hoja = 0, borde = [], tocaBorde = 0;
    for (i = 0; i < n; i++) {
      if (afuera[i]) continue;
      hoja++;
      var bx = i % w, by = (i / w) | 0;
      var esBorde = bx === 0 || by === 0 || bx === w - 1 || by === h - 1;
      if (esBorde) tocaBorde++;
      if (esBorde || afuera[i - 1] || afuera[i + 1] || afuera[i - w] || afuera[i + w]) borde.push({ x: bx, y: by });
    }
    /* Toda la imagen clara (la hoja en una mesa blanca, o tan cerca que no se le ven los bordes): no se sabe. */
    if (hoja > n * 0.97 || tocaBorde > 2 * (w + h) * 0.6) return null;

    var env = envolvente(borde);
    if (env.length < 4) return null;
    /* Arranque: los extremos en las cuatro diagonales; después, cada esquina se mueve al punto de la envolvente que
       más agranda el cuadrilátero (quedándose entre sus vecinas, así sigue convexo). */
    var idx = [0, 0, 0, 0];
    env.forEach(function (p, k) {
      if (p.x + p.y < env[idx[0]].x + env[idx[0]].y) idx[0] = k;
      if (p.x - p.y > env[idx[1]].x - env[idx[1]].y) idx[1] = k;
      if (p.x + p.y > env[idx[2]].x + env[idx[2]].y) idx[2] = k;
      if (p.y - p.x > env[idx[3]].y - env[idx[3]].x) idx[3] = k;
    });
    var m = env.length;
    for (var vuelta = 0; vuelta < 4; vuelta++) {
      for (var e = 0; e < 4; e++) {
        var orden = idx.slice().sort(function (a, b) { return a - b; });
        var pos = orden.indexOf(idx[e]), antes = orden[(pos + 3) % 4], despues = orden[(pos + 1) % 4];
        var mejorSup = -1, mejorK = idx[e];
        for (var k = (antes + 1) % m; k !== despues; k = (k + 1) % m) {
          var prueba = orden.map(function (o) { return o === idx[e] ? env[k] : env[o]; });
          var sup = superficie(prueba);
          if (sup > mejorSup) { mejorSup = sup; mejorK = k; }
        }
        idx[e] = mejorK;
      }
    }
    var esquinas = ordenarEsquinas(idx.map(function (k) { return env[k]; }));
    var supQ = superficie(esquinas);
    if (supQ < n * 0.12) return null;
    /* Una hoja llena su cuadrilátero; una mancha cualquiera, no. */
    if (hoja / supQ < 0.86) return null;
    for (var a = 0; a < 4; a++) {
      var ang = angulo(esquinas[(a + 3) % 4], esquinas[a], esquinas[(a + 1) % 4]);
      if (ang < 50 || ang > 130) return null;
    }
    return { esquinas: esquinas, cubre: supQ / n };
  }

  /** La homografía que lleva los 4 puntos de "de" a los 4 de "a" (matriz de 3x3 en un arreglo de 9). */
  function homografia(de, a) {
    var M = [], i;
    for (i = 0; i < 4; i++) {
      var x = de[i].x, y = de[i].y, u = a[i].x, v = a[i].y;
      M.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
      M.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
    }
    /* Gauss con pivote. */
    for (var c = 0; c < 8; c++) {
      var piv = c;
      for (i = c + 1; i < 8; i++) if (Math.abs(M[i][c]) > Math.abs(M[piv][c])) piv = i;
      var t = M[c]; M[c] = M[piv]; M[piv] = t;
      for (i = 0; i < 8; i++) {
        if (i === c) continue;
        var f = M[i][c] / M[c][c];
        for (var j = c; j < 9; j++) M[i][j] -= f * M[c][j];
      }
    }
    var hh = [];
    for (i = 0; i < 8; i++) hh.push(M[i][8] / M[i][i]);
    hh.push(1);
    return hh;
  }

  function distancia(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  /** El tamaño de la hoja enderezada: lo que miden sus lados, con el lado largo en maxLado como mucho. */
  function tamanoHoja(esq, maxLado) {
    var ancho = Math.max(distancia(esq[0], esq[1]), distancia(esq[3], esq[2]));
    var alto = Math.max(distancia(esq[0], esq[3]), distancia(esq[1], esq[2]));
    var e = Math.min(1, (maxLado || 1600) / Math.max(ancho, alto));
    return { w: Math.max(8, Math.round(ancho * e)), h: Math.max(8, Math.round(alto * e)) };
  }

  /** La hoja derecha: cada píxel del rectángulo sale de su lugar en la foto (bilineal). */
  function enderezar(img, esq, maxLado, crear) {
    var t = tamanoHoja(esq, maxLado), W = t.w, H = t.h;
    var H3 = homografia([{ x: 0, y: 0 }, { x: W - 1, y: 0 }, { x: W - 1, y: H - 1 }, { x: 0, y: H - 1 }], esq);
    var sal = crear ? crear(W, H) : { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) };
    var d = img.data, o = sal.data, iw = img.width, ih = img.height;
    for (var v = 0; v < H; v++) {
      for (var u = 0; u < W; u++) {
        var z = H3[6] * u + H3[7] * v + 1;
        var x = (H3[0] * u + H3[1] * v + H3[2]) / z, y = (H3[3] * u + H3[4] * v + H3[5]) / z;
        var x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
        if (x0 < 0) { x0 = 0; fx = 0; } if (y0 < 0) { y0 = 0; fy = 0; }
        if (x0 >= iw - 1) { x0 = iw - 2; fx = 1; } if (y0 >= ih - 1) { y0 = ih - 2; fy = 1; }
        var p = (y0 * iw + x0) * 4, q = (v * W + u) * 4;
        for (var c = 0; c < 3; c++) {
          var a = d[p + c], b = d[p + 4 + c], cc = d[p + iw * 4 + c], dd = d[p + iw * 4 + 4 + c];
          o[q + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (cc * (1 - fx) + dd * fx) * fy;
        }
        o[q + 3] = 255;
      }
    }
    return sal;
  }

  /**
   * Realza la hoja: el fondo de cada color (lo más claro de cada zona, suavizado) pasa a blanco. modo 'color' o 'byn'.
   * Cambia la imagen que recibe y la devuelve.
   */
  function realzar(img, modo) {
    var w = img.width, h = img.height, d = img.data;
    /* Celdas de ~1/50 del lado largo: más grandes que una letra, más chicas que una sombra. */
    var celda = Math.max(6, Math.round(Math.max(w, h) / 50));
    var cw = Math.ceil(w / celda), ch = Math.ceil(h / celda);
    var fondo = [0, 1, 2].map(function () { return new Float32Array(cw * ch); });
    var cx, cy, x, y, c;
    for (cy = 0; cy < ch; cy++) {
      for (cx = 0; cx < cw; cx++) {
        /* Lo claro de la celda: el promedio del 25 % más claro (con el máximo, un brillo suelto la arruinaba). */
        var vals = [[], [], []];
        for (y = cy * celda; y < Math.min(h, (cy + 1) * celda); y += 2) {
          for (x = cx * celda; x < Math.min(w, (cx + 1) * celda); x += 2) {
            var p = (y * w + x) * 4;
            for (c = 0; c < 3; c++) vals[c].push(d[p + c]);
          }
        }
        for (c = 0; c < 3; c++) {
          var vs = vals[c].sort(function (a, b) { return b - a; }), k = Math.max(1, Math.round(vs.length / 4)), s = 0;
          for (var i = 0; i < k; i++) s += vs[i];
          fondo[c][cy * cw + cx] = s / k;
        }
      }
    }
    /* Una zona toda de letra (un título grande, un sello) toma el fondo de sus vecinas: se toma el más claro alrededor
       y después se suaviza. */
    fondo = fondo.map(function (f) {
      var m = new Float32Array(cw * ch);
      for (cy = 0; cy < ch; cy++) for (cx = 0; cx < cw; cx++) {
        var mx = 0;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var yy = Math.min(ch - 1, Math.max(0, cy + dy)), xx = Math.min(cw - 1, Math.max(0, cx + dx));
          mx = Math.max(mx, f[yy * cw + xx]);
        }
        m[cy * cw + cx] = mx;
      }
      return suavizar(suavizar(m, cw, ch, 1), cw, ch, 1);
    });
    var gan = modo === 'byn' ? null : 1;
    for (y = 0; y < h; y++) {
      var fy = Math.min(ch - 1.001, Math.max(0, (y + 0.5) / celda - 0.5)), y0 = Math.floor(fy), ty = fy - y0;
      for (x = 0; x < w; x++) {
        var fx = Math.min(cw - 1.001, Math.max(0, (x + 0.5) / celda - 0.5)), x0 = Math.floor(fx), tx = fx - x0;
        var q = (y * w + x) * 4, i0 = y0 * cw + x0, i1 = i0 + 1, i2 = i0 + cw, i3 = i2 + 1;
        var r = [0, 0, 0];
        for (c = 0; c < 3; c++) {
          var f = fondo[c], bg = (f[i0] * (1 - tx) + f[Math.min(i1, f.length - 1)] * tx) * (1 - ty) +
                                 (f[Math.min(i2, f.length - 1)] * (1 - tx) + f[Math.min(i3, f.length - 1)] * tx) * ty;
          r[c] = 255 * d[q + c] / Math.max(40, bg);
        }
        if (gan) {
          /* Color: un poco más de contraste para que la letra no quede gris. */
          for (c = 0; c < 3; c++) d[q + c] = curva(r[c], 35, 245);
        } else {
          var g = 0.299 * r[0] + 0.587 * r[1] + 0.114 * r[2], v = curva(g, 80, 225);
          d[q] = d[q + 1] = d[q + 2] = v;
        }
      }
    }
    return img;
  }
  /** Estira [bajo, alto] a [0, 255], con una S suave. */
  function curva(v, bajo, alto) {
    var t = Math.max(0, Math.min(1, (v - bajo) / (alto - bajo)));
    return Math.round(255 * t * t * (3 - 2 * t) * 0.35 + 255 * t * 0.65);
  }

  var Cuentas = { gris: gris, suavizar: suavizar, otsu: otsu, envolvente: envolvente, superficie: superficie,
                  ordenarEsquinas: ordenarEsquinas, detectarHoja: detectarHoja, homografia: homografia,
                  tamanoHoja: tamanoHoja, enderezar: enderezar, realzar: realzar };
  if (typeof module !== 'undefined' && module.exports) { module.exports = Cuentas; return; }

  /* ════════════════════════════════════════════════════════════════════
     LAS PANTALLAS (sólo en el navegador)
     ════════════════════════════════════════════════════════════════════ */

  var CSS =
    '.esc{position:fixed;inset:0;z-index:60;background:#000;color:#F4F6F8;display:flex;flex-direction:column;font-family:inherit;touch-action:none;' +
      '-webkit-user-select:none;user-select:none}' +
    '.esc-arriba{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:calc(10px + env(safe-area-inset-top)) 12px 10px;background:rgba(0,0,0,.72);z-index:2}' +
    '.esc-arriba b{font-size:17px;font-weight:800;text-align:center;line-height:1.15}.esc-arriba small{display:block;font-size:12px;font-weight:700;color:var(--lima,#C6F432)}' +
    '.esc-btn{background:none;border:0;color:#F4F6F8;font:inherit;font-weight:700;font-size:15px;padding:8px 6px;cursor:pointer;min-width:64px;text-align:left}' +
    '.esc-btn.der{text-align:right}' +
    '.esc-medio{position:relative;flex:1;min-height:0;overflow:hidden;display:grid;place-items:center}' +
    '.esc-medio video,.esc-medio img,.esc-medio canvas.esc-foto{max-width:100%;max-height:100%;display:block}' +
    '.esc-medio video{width:100%;height:100%;object-fit:contain}' +
    '.esc-capa{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}' +
    '.esc-guia{position:absolute;left:12px;right:12px;bottom:12px;text-align:center;font-size:14px;font-weight:700;' +
      'background:rgba(0,0,0,.6);border-radius:12px;padding:8px 10px;pointer-events:none}' +
    '.esc-guia.lista{color:var(--sobre-lima,#0E1116);background:var(--lima,#C6F432)}' +
    '.esc-abajo{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:14px 16px calc(16px + env(safe-area-inset-bottom));background:rgba(0,0,0,.72)}' +
    '.esc-disparar{width:74px;height:74px;border-radius:50%;border:5px solid #F4F6F8;background:var(--lima,#C6F432);cursor:pointer}' +
    '.esc-disparar:active{transform:scale(.94)}' +
    '.esc-hojas{justify-self:start;position:relative;width:52px;height:64px;border-radius:8px;overflow:hidden;border:2px solid #F4F6F8;background:#222;padding:0;cursor:pointer}' +
    '.esc-hojas img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.esc-hojas i{position:absolute;right:2px;top:2px;min-width:20px;height:20px;border-radius:10px;background:var(--lima,#C6F432);color:#0E1116;font:800 12px/20px inherit;font-style:normal}' +
    '.esc-subir{justify-self:end;font-size:13px;text-align:center;max-width:110px;line-height:1.2}' +
    '.esc-esquina{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid var(--lima,#C6F432);' +
      'background:rgba(198,244,50,.18);touch-action:none;cursor:grab;z-index:3}' +
    '.esc-pie{display:flex;flex-wrap:wrap;gap:10px;padding:12px 16px calc(14px + env(safe-area-inset-bottom));background:rgba(0,0,0,.72)}' +
    '.esc-pie button{flex:1 1 40%;min-height:48px;border-radius:14px;border:1px solid #39404A;background:#1A1F27;color:#F4F6F8;font:inherit;font-weight:800;font-size:15px;cursor:pointer}' +
    '.esc-pie button.lima{background:var(--lima,#C6F432);border-color:var(--lima,#C6F432);color:var(--sobre-lima,#0E1116)}' +
    '.esc-pie button:disabled{opacity:.5}' +
    '.esc-modos{display:flex;gap:8px;justify-content:center;padding:10px 12px 0;background:rgba(0,0,0,.72)}' +
    '.esc-modos button{border-radius:999px;border:1px solid #39404A;background:#1A1F27;color:#F4F6F8;font:inherit;font-weight:700;font-size:14px;padding:8px 14px;cursor:pointer}' +
    '.esc-modos button[aria-pressed="true"]{background:#F4F6F8;color:#0E1116;border-color:#F4F6F8}' +
    '.esc-tira{display:flex;gap:8px;overflow-x:auto;padding:10px 16px 0;background:rgba(0,0,0,.72)}' +
    '.esc-tira div{position:relative;flex:none}.esc-tira img{height:64px;border-radius:6px;display:block;border:2px solid transparent}' +
    '.esc-tira button{position:absolute;right:-6px;top:-6px;width:24px;height:24px;border-radius:50%;border:0;background:#E5484D;color:#fff;font-weight:800;cursor:pointer;line-height:24px;padding:0}' +
    '.esc-espera{position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.55);font-weight:800;font-size:16px}' +
    '@media (min-width:900px){.esc{inset:24px;border-radius:18px;overflow:hidden;box-shadow:0 0 0 100vmax rgba(0,0,0,.6)}}';

  function ponerCss() {
    if (document.getElementById('escaner-css')) return;
    var s = document.createElement('style');
    s.id = 'escaner-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  var LADO_VIVO = 320;      // la imagen achicada para buscar la hoja en vivo
  var LADO_HOJA = 1600;     // el lado largo de la hoja que se guarda
  var _vista = null, _stream = null, _reloj = 0, _op = null, _hojas = [];

  function cerrar(sinAviso) {
    clearInterval(_reloj); _reloj = 0;
    if (_stream) { _stream.getTracks().forEach(function (t) { t.stop(); }); _stream = null; }
    if (_vista) { _vista.remove(); _vista = null; }
    _hojas.forEach(function (h) { if (h.url) URL.revokeObjectURL(h.url); });
    var op = _op;
    _op = null; _hojas = [];
    if (!sinAviso && op && op.alCerrar) op.alCerrar();
  }

  function vista(html) {
    ponerCss();
    if (!_vista) { _vista = document.createElement('div'); _vista.className = 'esc'; document.body.appendChild(_vista); }
    clearInterval(_reloj); _reloj = 0;
    _vista.innerHTML = html;
    return _vista;
  }
  function cabeza(izq, titulo, sub, der) {
    return '<div class="esc-arriba"><button class="esc-btn" data-izq>' + izq + '</button><div><b>' + esc(titulo) + '</b>' +
      (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div><button class="esc-btn der" data-der>' + (der || '') + '</button></div>';
  }
  function maxHojas() { return (_op && _op.maxHojas) || 8; }
  /** "¿Salir sin guardar?": con la ventanita de la app (op.confirmar, una promesa de true o false) o la del navegador. */
  function siSale(texto) {
    var op = _op;
    Promise.resolve(op && op.confirmar ? op.confirmar(texto) : window.confirm(texto)).then(function (si) { if (si && _op === op) cerrar(); });
  }
  function textoHoja() { return 'Hoja ' + (_hojas.length + 1); }

  /** Las fotos chicas de las hojas ya sacadas (para el botón de la cámara y la tira del resultado). */
  function miniatura(canvas) {
    return new Promise(function (ok) { canvas.toBlob(function (b) { ok(b ? URL.createObjectURL(b) : ''); }, 'image/jpeg', 0.6); });
  }

  /** La imagen de un canvas o un video, achicada a lado largo l (para buscar la hoja). */
  function achicar(fuente, ancho, alto, l) {
    var e = Math.min(1, l / Math.max(ancho, alto)), w = Math.max(8, Math.round(ancho * e)), h = Math.max(8, Math.round(alto * e));
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(fuente, 0, 0, w, h);
    return { img: cx.getImageData(0, 0, w, h), escala: 1 / e };
  }

  /* ── 1. La cámara ─────────────────────────────────────────────────── */

  function abrir(op) {
    cerrar(true);
    _op = op || {};
    _hojas = [];
    pantallaCamara();
  }

  function pantallaCamara() {
    var v = vista(cabeza('‹ Volver', _op.titulo || 'Escanear', textoHoja()) +
      '<div class="esc-medio"><video playsinline muted autoplay></video><canvas class="esc-capa"></canvas>' +
      '<div class="esc-guia">' + esc(_op.guia || 'Apoyá la hoja sobre algo oscuro y que entre entera') + '</div></div>' +
      '<div class="esc-abajo"><button class="esc-hojas" data-hojas' + (_hojas.length ? '' : ' hidden') + ' aria-label="Ver las hojas">' +
        (_hojas.length ? '<img src="' + _hojas[_hojas.length - 1].url + '" alt=""><i>' + _hojas.length + '</i>' : '') + '</button>' +
        '<button class="esc-disparar" data-disparar aria-label="Sacar la foto"></button>' +
        '<button class="esc-btn esc-subir" data-subir>Subir una foto</button></div>' +
      /* Dos: "Subir una foto" deja elegir de la galería (el certificado que llegó por WhatsApp); el otro abre la
         cámara del teléfono cuando la de adentro no anda. */
      '<input type="file" accept="image/*" hidden data-archivo><input type="file" accept="image/*" capture="environment" hidden data-camara-tel>');
    var video = v.querySelector('video'), capa = v.querySelector('.esc-capa'), guia = v.querySelector('.esc-guia');
    var archivo = v.querySelector('[data-archivo]'), camTel = v.querySelector('[data-camara-tel]');
    v.querySelector('[data-izq]').onclick = function () {
      if (!_hojas.length) { cerrar(); return; }
      siSale('¿Salir sin guardar ' + (_hojas.length === 1 ? 'la hoja que sacaste' : 'las ' + _hojas.length + ' hojas que sacaste') + '?');
    };
    v.querySelector('[data-subir]').onclick = function () { archivo.click(); };
    archivo.onchange = camTel.onchange = function () { var f = this.files && this.files[0]; if (f) cargarArchivo(f); };
    var bh = v.querySelector('[data-hojas]');
    if (bh) bh.onclick = function () { pantallaResultado(); };
    var ultima = null;   // la última hoja encontrada en vivo (en píxeles del video)

    var disparar = v.querySelector('[data-disparar]');
    disparar.onclick = function () {
      if (!_stream || !video.videoWidth) { camTel.click(); return; }
      var cv = document.createElement('canvas');
      cv.width = video.videoWidth; cv.height = video.videoHeight;
      cv.getContext('2d').drawImage(video, 0, 0);
      if (_stream) { _stream.getTracks().forEach(function (t) { t.stop(); }); _stream = null; }
      pantallaEsquinas(cv, ultima);
    };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { sinCamara(); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false })
      .then(function (s) {
        if (!_vista || !document.body.contains(video)) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        _stream = s;
        video.srcObject = s;
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
        /* Cada 1/4 de segundo se busca la hoja y se marca encima. */
        var suave = null;
        _reloj = setInterval(function () {
          if (!video.videoWidth || !_vista) return;
          var a = achicar(video, video.videoWidth, video.videoHeight, LADO_VIVO), r = null;
          try { r = detectarHoja(a.img); } catch (e) { r = null; }
          if (r) {
            var q = r.esquinas.map(function (p) { return { x: p.x * a.escala, y: p.y * a.escala }; });
            /* Suavizado: si se movió poco, la marca no tiembla; si saltó, la sigue. */
            if (suave && q.every(function (p, i) { return Math.hypot(p.x - suave[i].x, p.y - suave[i].y) < video.videoWidth * 0.06; })) {
              q = q.map(function (p, i) { return { x: suave[i].x * 0.6 + p.x * 0.4, y: suave[i].y * 0.6 + p.y * 0.4 }; });
            }
            suave = q;
          } else suave = null;
          ultima = suave;
          dibujarMarca(capa, video, suave);
          guia.classList.toggle('lista', !!suave);
          guia.textContent = suave ? 'Hoja encontrada: sacá la foto' : (_op.guia || 'Apoyá la hoja sobre algo oscuro y que entre entera');
        }, 250);
      }).catch(sinCamara);

    function sinCamara() {
      guia.textContent = 'La cámara no se pudo abrir acá: tocá el botón para sacarla con la del teléfono o subí una foto.';
      disparar.onclick = function () { camTel.click(); };
    }
  }

  /** Dónde se ve el video adentro de su caja (object-fit: contain). */
  function rectoDelVideo(el, w, h) {
    var cw = el.clientWidth, chh = el.clientHeight, e = Math.min(cw / w, chh / h);
    return { x: (cw - w * e) / 2, y: (chh - h * e) / 2, e: e };
  }

  function dibujarMarca(capa, video, q) {
    var W = capa.clientWidth, H = capa.clientHeight, dpr = window.devicePixelRatio || 1;
    if (capa.width !== Math.round(W * dpr) || capa.height !== Math.round(H * dpr)) { capa.width = Math.round(W * dpr); capa.height = Math.round(H * dpr); }
    var cx = capa.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);
    if (!q) return;
    var r = rectoDelVideo(video, video.videoWidth, video.videoHeight);
    cx.beginPath();
    q.forEach(function (p, i) { var x = r.x + p.x * r.e, y = r.y + p.y * r.e; if (i) cx.lineTo(x, y); else cx.moveTo(x, y); });
    cx.closePath();
    cx.fillStyle = 'rgba(198,244,50,.18)'; cx.fill();
    cx.lineWidth = 3; cx.strokeStyle = '#C6F432'; cx.stroke();
  }

  /* ── Una foto subida (la compu, la galería, o la cámara del teléfono) ── */

  function desdeArchivo(f, op) {
    cerrar(true);
    _op = op || {};
    _hojas = [];
    cargarArchivo(f);
  }

  function cargarArchivo(f) {
    vista(cabeza('‹ Volver', _op.titulo || 'Escanear', textoHoja()) + '<div class="esc-medio"><div class="esc-espera">Cargando la foto…</div></div>');
    _vista.querySelector('[data-izq]').onclick = function () { _hojas.length ? pantallaResultado() : (_op.sinCamara ? cerrar() : pantallaCamara()); };
    if (!/^image\//.test(f.type || 'image/')) { _vista.querySelector('.esc-espera').textContent = 'Eso no es una foto. Elegí una imagen (JPG o PNG).'; return; }
    var img = new Image(), url = URL.createObjectURL(f);
    img.onload = function () {
      URL.revokeObjectURL(url);
      /* Las fotos enormes se achican primero (lado largo 2560): alcanza y no ahoga al teléfono. */
      var e = Math.min(1, 2560 / Math.max(img.naturalWidth, img.naturalHeight));
      var cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * e); cv.height = Math.round(img.naturalHeight * e);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      pantallaEsquinas(cv, null);
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      if (_vista) _vista.querySelector('.esc-espera').textContent = 'No se pudo abrir esa foto. Probá con otra.';
    };
    img.src = url;
  }

  /* ── 2. Las esquinas ──────────────────────────────────────────────── */

  /** fijas: las esquinas que ya se habían elegido (al volver del resultado). */
  function pantallaEsquinas(foto, deVivo, fijas) {
    var w = foto.width, h = foto.height;
    /* La hoja otra vez, con la foto quieta (más precisa que la del video); si no aparece, la de vivo; si tampoco, un
       rectángulo un poco adentro del borde para mover a mano. */
    var q = fijas ? fijas.map(function (p) { return { x: p.x, y: p.y }; }) : null;
    if (!q) {
      try {
        var a = achicar(foto, w, h, 480), r = detectarHoja(a.img);
        if (r) q = r.esquinas.map(function (p) { return { x: p.x * a.escala, y: p.y * a.escala }; });
      } catch (e) { q = null; }
    }
    var encontrada = !!(q || deVivo);
    q = q || deVivo || [{ x: w * 0.08, y: h * 0.08 }, { x: w * 0.92, y: h * 0.08 }, { x: w * 0.92, y: h * 0.92 }, { x: w * 0.08, y: h * 0.92 }];
    q = q.map(function (p) { return { x: Math.max(0, Math.min(w - 1, p.x)), y: Math.max(0, Math.min(h - 1, p.y)) }; });

    var v = vista(cabeza('‹ Volver', 'Las esquinas', textoHoja()) +
      '<div class="esc-medio" data-medio><canvas class="esc-foto"></canvas><canvas class="esc-capa"></canvas>' +
      [0, 1, 2, 3].map(function (i) { return '<span class="esc-esquina" data-esq="' + i + '" role="button" aria-label="Esquina ' + (i + 1) + '"></span>'; }).join('') +
      '<div class="esc-guia">' + (encontrada ? 'Si hace falta, corré los círculos a las puntas de la hoja' : 'No encontramos la hoja: llevá los círculos a sus cuatro puntas') + '</div></div>' +
      '<div class="esc-pie"><button data-otra>' + (_op.sinCamara ? 'Elegir otra foto' : 'Sacar de nuevo') + '</button><button class="lima" data-listo>Listo</button></div>');
    var medio = v.querySelector('[data-medio]'), lienzo = v.querySelector('.esc-foto'), capa = v.querySelector('.esc-capa');
    /* Lo que se muestra es una copia achicada (la foto entera se usa al enderezar). */
    var e0 = Math.min(1, 1400 / Math.max(w, h));
    lienzo.width = Math.round(w * e0); lienzo.height = Math.round(h * e0);
    lienzo.getContext('2d').drawImage(foto, 0, 0, lienzo.width, lienzo.height);
    v.querySelector('[data-otra]').onclick = function () { _op.sinCamara ? elegirOtra() : pantallaCamara(); };
    v.querySelector('[data-izq]').onclick = function () {
      if (!_op.sinCamara) { pantallaCamara(); return; }
      if (_hojas.length) pantallaResultado(); else cerrar();
    };

    function caja() {
      var rm = medio.getBoundingClientRect(), rl = lienzo.getBoundingClientRect();
      return { x: rl.left - rm.left, y: rl.top - rm.top, e: rl.width / w };
    }
    function pintar() {
      var c = caja(), W = medio.clientWidth, H = medio.clientHeight, dpr = window.devicePixelRatio || 1;
      capa.width = Math.round(W * dpr); capa.height = Math.round(H * dpr);
      var cx = capa.getContext('2d');
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.clearRect(0, 0, W, H);
      cx.beginPath();
      q.forEach(function (p, i) { var x = c.x + p.x * c.e, y = c.y + p.y * c.e; if (i) cx.lineTo(x, y); else cx.moveTo(x, y); });
      cx.closePath();
      cx.fillStyle = 'rgba(198,244,50,.14)'; cx.fill();
      cx.lineWidth = 2.5; cx.strokeStyle = '#C6F432'; cx.stroke();
      v.querySelectorAll('[data-esq]').forEach(function (s) {
        var p = q[+s.dataset.esq];
        s.style.left = (c.x + p.x * c.e) + 'px'; s.style.top = (c.y + p.y * c.e) + 'px';
      });
    }
    v.querySelectorAll('[data-esq]').forEach(function (s) {
      s.onpointerdown = function (ev) {
        ev.preventDefault();
        s.setPointerCapture(ev.pointerId);
        var i = +s.dataset.esq;
        s.onpointermove = function (m) {
          var c = caja(), rm = medio.getBoundingClientRect();
          q[i] = { x: Math.max(0, Math.min(w - 1, (m.clientX - rm.left - c.x) / c.e)), y: Math.max(0, Math.min(h - 1, (m.clientY - rm.top - c.y) / c.e)) };
          pintar();
        };
        s.onpointerup = s.onpointercancel = function () { s.onpointermove = null; };
      };
    });
    if (window.ResizeObserver) new ResizeObserver(pintar).observe(medio);
    requestAnimationFrame(pintar);

    v.querySelector('[data-listo]').onclick = function () {
      var b = this; b.disabled = true; b.textContent = 'Enderezando…';
      /* Que se pinte el "Enderezando…" antes de la cuenta larga. */
      setTimeout(function () {
        var esq = ordenarEsquinas(q);
        var src = foto.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h);
        var cv = document.createElement('canvas'), cx = cv.getContext('2d');
        var derecha = enderezar(src, esq, LADO_HOJA, function (W, H) { cv.width = W; cv.height = H; return cx.createImageData(W, H); });
        pantallaResultado({ original: derecha, modo: 'color', giro: 0, foto: foto, q: esq });
      }, 30);
    };
  }

  /* ── 3. El resultado (y las hojas) ────────────────────────────────── */

  /** La hoja nueva como canvas: realzada en su modo y girada. */
  function pintarHoja(h) {
    var o = h.original, copia = new ImageData(new Uint8ClampedArray(o.data), o.width, o.height);
    realzar(copia, h.modo);
    var base = document.createElement('canvas');
    base.width = o.width; base.height = o.height;
    base.getContext('2d').putImageData(copia, 0, 0);
    if (!h.giro) return base;
    var g = document.createElement('canvas'), de = h.giro % 180 !== 0;
    g.width = de ? base.height : base.width; g.height = de ? base.width : base.height;
    var cx = g.getContext('2d');
    cx.translate(g.width / 2, g.height / 2);
    cx.rotate(h.giro * Math.PI / 180);
    cx.drawImage(base, -base.width / 2, -base.height / 2);
    return g;
  }

  function pantallaResultado(nueva) {
    var v = vista(cabeza(nueva ? '‹ Esquinas' : '‹ Volver', _op.titulo || 'Escanear', nueva ? textoHoja() : (_hojas.length === 1 ? '1 hoja' : _hojas.length + ' hojas')) +
      (nueva ? '<div class="esc-modos"><button data-modo="color" aria-pressed="' + (nueva.modo === 'color') + '">Color</button>' +
               '<button data-modo="byn" aria-pressed="' + (nueva.modo === 'byn') + '">Blanco y negro</button><button data-girar>Girar ↻</button></div>' : '') +
      '<div class="esc-medio" data-medio><div class="esc-espera">Preparando…</div></div>' +
      (_hojas.length ? '<div class="esc-tira">' + _hojas.map(function (h, i) {
        return '<div><img src="' + h.url + '" alt="Hoja ' + (i + 1) + '"><button data-sacar="' + i + '" aria-label="Sacar la hoja ' + (i + 1) + '">×</button></div>';
      }).join('') + '</div>' : '') +
      '<div class="esc-pie">' +
        (nueva ? '<button data-repetir>Sacar de nuevo</button>' : '') +
        ((nueva ? _hojas.length + 1 : _hojas.length) < maxHojas() && !_op.unaSola ? '<button data-otra>' + (nueva ? 'Guardar y otra hoja' : 'Otra hoja') + '</button>' : '') +
        '<button class="lima" data-usar>' + (_op.textoListo || 'Listo') + '</button></div>');
    var medio = v.querySelector('[data-medio]'), actual = null;
    function mostrar() {
      if (!nueva) {
        var u = _hojas.length ? _hojas[_hojas.length - 1].url : '';
        medio.innerHTML = u ? '<img src="' + u + '" alt="La última hoja">' : '<div class="esc-guia">Todavía no hay hojas.</div>';
        return;
      }
      medio.innerHTML = '<div class="esc-espera">Preparando…</div>';
      setTimeout(function () {
        actual = pintarHoja(nueva);
        actual.className = 'esc-foto';
        medio.innerHTML = '';
        medio.appendChild(actual);
      }, 20);
    }
    mostrar();
    v.querySelector('[data-izq]').onclick = function () {
      if (nueva) { pantallaEsquinas(nueva.foto, null, nueva.q); return; }
      if (!_op.sinCamara) { pantallaCamara(); return; }
      if (!_hojas.length) { cerrar(); return; }
      siSale('¿Salir sin guardar las hojas?');
    };
    v.querySelectorAll('[data-modo]').forEach(function (b) {
      b.onclick = function () { nueva.modo = b.dataset.modo; v.querySelectorAll('[data-modo]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); mostrar(); };
    });
    var bg = v.querySelector('[data-girar]');
    if (bg) bg.onclick = function () { nueva.giro = (nueva.giro + 90) % 360; mostrar(); };
    v.querySelectorAll('[data-sacar]').forEach(function (b) {
      b.onclick = function () {
        var i = +b.dataset.sacar, h = _hojas.splice(i, 1)[0];
        if (h && h.url) URL.revokeObjectURL(h.url);
        pantallaResultado(nueva);
      };
    });
    var rep = v.querySelector('[data-repetir]');
    if (rep) rep.onclick = function () { _op.sinCamara ? elegirOtra() : pantallaCamara(); };

    /** Guarda la hoja nueva (JPEG) y sigue con despues(). */
    function guardarNueva(despues) {
      if (!nueva) { despues(); return; }
      var cv = actual || pintarHoja(nueva);
      cv.toBlob(function (b) {
        if (!b) { despues(); return; }
        _hojas.push({ blob: b, url: URL.createObjectURL(b) });
        nueva = null;
        despues();
      }, 'image/jpeg', 0.82);
    }
    var bo = v.querySelector('[data-otra]');
    if (bo) bo.onclick = function () { bo.disabled = true; guardarNueva(function () { _op.sinCamara ? elegirOtra() : pantallaCamara(); }); };
    v.querySelector('[data-usar]').onclick = function () {
      var b = this; b.disabled = true;
      guardarNueva(function () {
        if (!_hojas.length) { b.disabled = false; return; }
        var blobs = _hojas.map(function (h) { return h.blob; }), op = _op;
        cerrar(true);
        if (op.alTerminar) op.alTerminar(blobs);
      });
    };
  }

  /** En la compu (sin cámara): otra hoja = elegir otro archivo. */
  function elegirOtra() {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () { var f = inp.files && inp.files[0]; if (f) cargarArchivo(f); };
    inp.click();
  }

  raiz.Escaner = { abrir: abrir, desdeArchivo: desdeArchivo, cerrar: function () { cerrar(true); }, abierto: function () { return !!_vista; },
                   cuentas: Cuentas };
})(typeof window !== 'undefined' ? window : this);
