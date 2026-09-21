/**
 * VDH · Sistema No Compra — por qué la gente se va sin comprar.
 *
 * Es la única pantalla del sistema que no le sirve al local: le sirve a
 * COMPRAS. El local ya sabe lo que le faltó hoy; lo que nadie sabía hasta
 * ahora es qué le falta a la cadena entera, y eso es lo que decide qué se
 * compra el mes que viene.
 *
 * ── Por qué general Y por local ────────────────────────────────────────────
 * Compras toma dos decisiones distintas y necesita las dos vistas:
 *
 *   qué compro        se contesta con el total de la cadena
 *   a dónde lo mando  se contesta por local
 *
 * Arranca en general porque es la decisión más cara de las dos.
 *
 * ── Por qué no pide PIN ────────────────────────────────────────────────────
 * Acá no hay un dato de ningún cliente: hay motivos, productos y talles
 * contados. Es el mismo criterio del tablero del local. El PIN sigue
 * cuidando lo único que hay que cuidar, que es la lista con los teléfonos.
 *
 * Lo que se cuenta empieza en la LÍNEA DE ARRANQUE (ver Codigo.gs): los 139
 * registros de la etapa vieja casi no tienen motivo cargado —la columna es
 * posterior— y contarlos taparía los porcentajes con filas vacías.
 */

/** Nombre base de la clave de caché. Una por combinación local + motivo. */
const CACHE_MOTIVOS = 'motivos_';

/**
 * "S / M" y "s, m" son DOS talles; "95/100" es UNO.
 *
 * El formulario junta los que se tocan con " / " —barra con espacios a los
 * lados— y en la planilla vieja se cargaban separados por coma. Una barra
 * pegada, en cambio, es parte del talle: los cinturones y los pantalones se
 * venden así, y partirlos inventaría dos talles que nadie pidió.
 */
function partirTalles_(valor) {
  return String(valor || '')
    .split(/\s*,\s*|\s+\/\s+/)
    .map(function (t) { return t.trim(); })
    .filter(function (t) { return t && t.length <= 12; });
}

/** De más a menos, y al empatar por orden alfabético para que no se mueva. */
function masRepetidos_(mapa, cuantos) {
  return Object.keys(mapa)
    .map(function (k) { return mapa[k]; })
    .sort(function (a, b) { return (b.n - a.n) || a.v.localeCompare(b.v, 'es'); })
    .slice(0, cuantos || 12);
}

/**
 * Los motivos contados, con lo que faltó adentro de cada uno.
 *
 * @param {string} local   vacío = toda la cadena
 * @param {string} motivo  vacío = todos; si viene, filtra productos y talles
 *
 * El ranking de motivos se calcula SIEMPRE sobre el local entero, aunque
 * venga un motivo filtrado: es la lista desde la que se elige, y si se
 * filtrara a sí misma quedaría una sola fila y no habría cómo volver.
 */
function getMotivos(local, motivo) {
  const kLocal = clave_(local || '');
  const kMotivo = clave_(motivo || '');

  const cache = CacheService.getScriptCache();
  const clave = CACHE_MOTIVOS + kLocal + '|' + kMotivo;
  const enCache = cache.get(clave);
  if (enCache) return JSON.parse(enCache);

  const hoja = getHoja_();
  const inicio = getFilaEncabezado_(hoja) + 1;
  const ultima = hoja.getLastRow();

  const motivos = {};     // motivo -> n, sobre la porción del local
  const productos = {};   // clave  -> {v, n}, sobre local + motivo
  const talles = {};
  const porLocal = {};    // clave  -> {local, n, motivos:{}}
  const vistos = {};      // todos los locales que aparecen, para el selector
  let total = 0;          // registros CON motivo en la porción
  let sinMotivo = 0;      // los que no lo tienen cargado

  if (ultima >= inicio) {
    const ancho = Math.min(ANCHO, hoja.getMaxColumns());
    hoja.getRange(inicio, 1, ultima - inicio + 1, ancho).getValues().forEach(function (f) {
      if (!f[COL.FECHA] && !f[COL.WHATSAPP]) return;
      if (antesDelArranque_(f[COL.FECHA])) return;

      const suc = String(f[COL.SUCURSAL] || '').trim();
      // El selector se arma ANTES de filtrar: si no, mirando un local sólo se
      // podría volver a ese mismo local.
      if (suc && !vistos[clave_(suc)]) vistos[clave_(suc)] = suc;

      if (kLocal && clave_(suc) !== kLocal) return;

      const m = String(f[COL.MOTIVO] || '').trim();
      /* Sin motivo no se descarta en silencio: se cuenta aparte y la pantalla
         lo dice. Un porcentaje calculado sobre la mitad de los registros, sin
         avisar de qué mitad, es peor que no tener el número. */
      if (!m) { sinMotivo++; return; }

      total++;
      motivos[m] = (motivos[m] || 0) + 1;

      if (suc) {
        const kl = clave_(suc);
        const L = porLocal[kl] || (porLocal[kl] = { local: suc, n: 0, motivos: {} });
        L.n++;
        L.motivos[m] = (L.motivos[m] || 0) + 1;
      }

      // De acá para abajo, sólo lo del motivo que se está mirando.
      if (kMotivo && clave_(m) !== kMotivo) return;

      const prod = String(f[COL.PRODUCTO] || '').trim();
      if (prod) {
        const kp = clave_(prod);
        const P = productos[kp] || (productos[kp] = { v: prod, n: 0 });
        P.n++;
      }

      partirTalles_(f[COL.TALLE]).forEach(function (t) {
        const kt = clave_(t);
        const T = talles[kt] || (talles[kt] = { v: t, n: 0 });
        T.n++;
      });
    });
  }

  const ranking = Object.keys(motivos).map(function (m) {
    return { v: m, n: motivos[m], pct: total ? Math.round(motivos[m] * 100 / total) : 0 };
  }).sort(function (a, b) { return (b.n - a.n) || a.v.localeCompare(b.v, 'es'); });

  const lista = Object.keys(porLocal).map(function (k) {
    const L = porLocal[k];
    let top = '', topN = 0;
    Object.keys(L.motivos).forEach(function (m) {
      if (L.motivos[m] > topN) { topN = L.motivos[m]; top = m; }
    });
    return { local: L.local, n: L.n, top: top };
  }).sort(function (a, b) { return (b.n - a.n) || a.local.localeCompare(b.local, 'es'); });

  /* El selector ofrece los 14 aunque todavía no hayan cargado nada: con la
     línea de arranque recién puesta no hay un solo registro, y un selector
     vacío parecería roto. LOCALES_BASE vive en Config.gs. */
  LOCALES_BASE.forEach(function (l) { if (!vistos[clave_(l)]) vistos[clave_(l)] = l; });
  const locales = Object.keys(vistos).sort().map(function (k) { return vistos[k]; });

  const salida = {
    status: 'ok',
    local: local || '',
    motivo: motivo || '',
    arranque: arranqueISO_(),
    total: total,
    sinMotivo: sinMotivo,
    motivos: ranking,
    productos: masRepetidos_(productos, 12),
    talles: masRepetidos_(talles, 12),
    porLocal: lista,
    locales: locales
  };

  /* Un minuto. Esto lo mira Compras cada tanto, no catorce locales todo el
     día, así que no hace falta invalidarlo al cargar un registro como sí lo
     hace el tablero (olvidarMetricas_): en el peor caso el número aparece un
     minuto después. */
  cache.put(clave, JSON.stringify(salida), 60);
  return salida;
}
