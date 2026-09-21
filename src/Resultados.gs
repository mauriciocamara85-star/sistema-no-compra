/**
 * VDH · Sistema No Compra — ¿esto está sirviendo?
 *
 * Es la única pantalla que mide AL SISTEMA y no a los clientes. Las otras
 * cuentan lo que pasa con la gente que entra al local; esta cuenta si la
 * cadena entera —cargar, contactar, cerrar— se está completando o se corta
 * en el medio.
 *
 * ── El número que la hizo existir ──────────────────────────────────────────
 * La primera vez que se usó el sistema quedaron **139 registros cargados y 8
 * con seguimiento hecho**. Nadie lo supo hasta que alguien contó a mano, meses
 * después, y para entonces el sistema ya estaba muerto. El agujero no estaba
 * en que los vendedores no cargaran: estaba en que lo cargado no se trabajaba
 * y no había ninguna pantalla que lo dijera.
 *
 * Por eso el embudo tiene CUATRO escalones y no uno:
 *
 *     Cargados      lo que hicieron los vendedores
 *     Contactados   lo que hizo Atención al Cliente  ← acá se cortó
 *     Compraron     lo que volvió
 *     Recuperado    cuánto
 *
 * Un solo número —"24 registros"— habría dejado ver un sistema sano.
 *
 * ── Por qué está abierta ───────────────────────────────────────────────────
 * Sin PIN y sin modo supervisor, por decisión de Mauricio: quiere que las vea
 * todo el mundo, incluidos los vendedores. Y se puede, porque acá no hay un
 * dato de ningún cliente: son conteos, porcentajes y totales en pesos. El PIN
 * sigue cuidando lo único que hay que cuidar, que es la lista con los
 * teléfonos.
 *
 * Lo que se cuenta empieza en la LÍNEA DE ARRANQUE (ver Codigo.gs).
 */

/** Nombre base de la clave de caché. */
const CACHE_RESULTADOS = 'resultados_';

/** Un pendiente se pone viejo a los 3 días, igual que en el panel. */
const DIAS_VIEJO = 3;

/**
 * El embudo entero, general y por local.
 *
 * @param {string} local  vacío = toda la cadena
 */
function getResultados(local) {
  const kLocal = clave_(local || '');

  const cache = CacheService.getScriptCache();
  const clave = CACHE_RESULTADOS + kLocal;
  const enCache = cache.get(clave);
  if (enCache) return JSON.parse(enCache);

  const hoja = getHoja_();
  const inicio = getFilaEncabezado_(hoja) + 1;
  const ultima = hoja.getLastRow();

  const total = { cargados: 0, contactados: 0, compraron: 0 };
  const recuperado = { local: 0, online: 0, total: 0 };
  const pendientes = { total: 0, viejos: 0, dias: 0 };
  const porLocal = {};
  const vistos = {};

  if (ultima >= inicio) {
    const ancho = Math.min(ANCHO, hoja.getMaxColumns());
    hoja.getRange(inicio, 1, ultima - inicio + 1, ancho).getValues().forEach(function (f) {
      if (!f[COL.FECHA] && !f[COL.WHATSAPP]) return;
      if (antesDelArranque_(f[COL.FECHA])) return;

      const suc = String(f[COL.SUCURSAL] || '').trim();
      if (suc && !vistos[clave_(suc)]) vistos[clave_(suc)] = suc;
      if (kLocal && clave_(suc) !== kLocal) return;

      const L = suc
        ? (porLocal[clave_(suc)] || (porLocal[clave_(suc)] = {
            local: suc, cargados: 0, contactados: 0, compraron: 0, recuperado: 0
          }))
        : null;

      total.cargados++;
      if (L) L.cargados++;

      /* "Contactado" es lo mismo que NO estar pendiente, con el criterio del
         panel: alguien le puso un estado o marcó que se contactó. Da igual
         cómo haya terminado; lo que se mide acá es si alguien lo trabajó. */
      const estado = String(f[COL.ESTADO] || '').trim();
      const contactado = String(f[COL.CONTACTAMOS] || '').trim().toLowerCase() === 'si';

      if (estado || contactado) {
        total.contactados++;
        if (L) L.contactados++;
      } else {
        pendientes.total++;
        const cuando = parseFecha_(f[COL.FECHA]);
        const dias = cuando ? Math.floor((Date.now() - cuando.getTime()) / 86400000) : 0;
        if (dias >= DIAS_VIEJO) pendientes.viejos++;
        // Cuántos días lleva esperando el más viejo de todos: es el número que
        // dice qué tan atrás viene el seguimiento.
        if (dias > pendientes.dias) pendientes.dias = dias;
      }

      // "Compró" son los Sí del vocabulario, no el texto libre.
      const compro = String(f[COL.COMPRO] || '').trim();
      if (compro.indexOf('Sí') !== 0) return;

      const monto = parseMonto_(f[COL.MONTO]);
      total.compraron++;
      recuperado.total += monto;
      // Lo que no diga "online" cuenta como local, igual que en el panel.
      const via = compro.toLowerCase().indexOf('online') > -1 ? 'online' : 'local';
      recuperado[via] += monto;

      if (L) { L.compraron++; L.recuperado += monto; }
    });
  }

  /* Ordenados por lo que volvió y después por cuántos cargaron: el local que
     más recuperó primero, que es el que está haciendo funcionar esto. */
  const locales = Object.keys(porLocal).map(function (k) { return porLocal[k]; })
    .sort(function (a, b) {
      return (b.recuperado - a.recuperado) || (b.cargados - a.cargados) ||
             a.local.localeCompare(b.local, 'es');
    });

  LOCALES_BASE.forEach(function (l) { if (!vistos[clave_(l)]) vistos[clave_(l)] = l; });

  const salida = {
    status: 'ok',
    local: local || '',
    arranque: arranqueISO_(),
    total: total,
    recuperado: recuperado,
    pendientes: pendientes,
    porLocal: locales,
    locales: Object.keys(vistos).sort().map(function (k) { return vistos[k]; })
  };

  cache.put(clave, JSON.stringify(salida), 60);
  return salida;
}
