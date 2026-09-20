/**
 * VDH · Sistema No Compra — respaldo automático de la planilla
 *
 * La planilla ES la base de datos de este sistema. Hasta hoy el único
 * respaldo era una copia a mano del 19/09/2026: si alguien borraba una
 * columna o pegaba mal 300 filas, lo perdido dependía de que a alguien se le
 * ocurriera mirar el historial de Google antes de que se venciera.
 *
 * ── Cómo se prende ────────────────────────────────────────────────────────
 * Correr instalarRespaldo() UNA VEZ desde el editor. Crea el disparador
 * diario y hace la primera copia. Se apaga con quitarRespaldo().
 *
 * ── La regla de oro, otra vez ─────────────────────────────────────────────
 * Un respaldo que falla en silencio es peor que no tener respaldo, porque da
 * tranquilidad falsa. Cada corrida deja su resultado en las propiedades del
 * script, y el panel lo muestra igual que muestra el estado de Kommo: si hace
 * tres días que no se copia nada, hay que verlo en una pantalla, no en un log
 * que no mira nadie.
 */

/** Dónde se guardan las copias, dentro del Drive del dueño del script. */
const CARPETA_RESPALDOS = 'Respaldos · No Compra';

/**
 * Cuántas copias se conservan. Catorce es dos semanas: alcanza para notar un
 * desastre y volver atrás, y no llena el Drive de planillas de 3 MB.
 */
const RESPALDOS_A_GUARDAR = 14;

/** La carpeta de respaldos, creándola la primera vez. */
function carpetaRespaldos_() {
  const it = DriveApp.getFoldersByName(CARPETA_RESPALDOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_RESPALDOS);
}

/**
 * Saca una copia fechada y borra las más viejas.
 *
 * Las viejas van a la papelera, no se eliminan de verdad: si el criterio de
 * cuántas guardar resulta corto, hay 30 días más para recuperarlas.
 */
function respaldoDiario() {
  const props = PropertiesService.getScriptProperties();
  try {
    const id = props.getProperty('SHEET_ID');
    if (!id) throw new Error('Falta configurar SHEET_ID.');

    const carpeta = carpetaRespaldos_();
    const sello = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    const nombre = 'No Compra · ' + sello;

    // Si ya se corrió hoy, no se duplica: el disparador puede ejecutarse dos
    // veces si alguien lo reinstala sin quitar el anterior.
    const yaEsta = carpeta.getFilesByName(nombre);
    if (yaEsta.hasNext()) {
      props.setProperty('RESPALDO_ULTIMO', JSON.stringify({ ok: true, cuando: sello, nota: 'ya existía' }));
      return;
    }

    DriveApp.getFileById(id).makeCopy(nombre, carpeta);

    // Limpieza: se listan, se ordenan por fecha y se tira lo que sobra.
    const copias = [];
    const it = carpeta.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      copias.push({ f: f, cuando: f.getDateCreated().getTime() });
    }
    copias.sort(function (a, b) { return b.cuando - a.cuando; });
    copias.slice(RESPALDOS_A_GUARDAR).forEach(function (x) { x.f.setTrashed(true); });

    props.setProperty('RESPALDO_ULTIMO', JSON.stringify({
      ok: true, cuando: sello, copias: Math.min(copias.length, RESPALDOS_A_GUARDAR)
    }));
    registrarLog_('Respaldo', '', nombre, 'automático');

  } catch (err) {
    console.error('respaldoDiario: ' + err.stack);
    props.setProperty('RESPALDO_ULTIMO', JSON.stringify({
      ok: false,
      msg: String(err.message).slice(0, 300),
      cuando: Utilities.formatDate(new Date(), TZ, FORMATO_FECHA)
    }));
  }
}

/** Cómo viene el respaldo. Lo muestra el panel, igual que el estado de Kommo. */
function estadoRespaldo_() {
  const guardado = PropertiesService.getScriptProperties().getProperty('RESPALDO_ULTIMO');
  if (!guardado) return { activo: false };
  try {
    const e = JSON.parse(guardado);
    return {
      activo: true,
      ok: e.ok !== false,
      cuando: e.cuando || '',
      msg: e.msg || ''
    };
  } catch (err) {
    return { activo: true, ok: false, msg: String(guardado) };
  }
}

// ── Puesta en marcha ───────────────────────────────────────────────────────
/**
 * Correr UNA VEZ desde el editor. Deja el respaldo andando solo todas las
 * madrugadas y hace la primera copia en el momento, para no tener que esperar
 * hasta mañana para saber si funciona.
 */
function instalarRespaldo() {
  quitarRespaldo();

  ScriptApp.newTrigger('respaldoDiario')
    .timeBased()
    .atHour(4)
    .everyDays(1)
    .inTimezone(TZ)
    .create();

  respaldoDiario();

  const estado = estadoRespaldo_();
  if (estado.ok) {
    console.log('✓ Respaldo instalado. Copia diaria a las 4 de la mañana en "' +
                CARPETA_RESPALDOS + '". Primera copia: ' + estado.cuando);
  } else {
    console.log('✗ El disparador quedó creado pero la primera copia falló: ' + estado.msg);
  }
}

/** Apaga el respaldo automático. No borra las copias que ya existen. */
function quitarRespaldo() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'respaldoDiario') ScriptApp.deleteTrigger(t);
  });
}
