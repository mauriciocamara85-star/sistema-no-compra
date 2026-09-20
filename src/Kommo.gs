/**
 * VDH · Sistema No Compra — puente con Kommo (CRM)
 *
 * Cada cliente que se va del local sin comprar entra a Kommo como lead con su
 * contacto, para poder trabajarlo desde el CRM y meterlo en campañas.
 *
 * ── Cómo se prende ────────────────────────────────────────────────────────
 * En Apps Script → Configuración del proyecto → Propiedades de la secuencia
 * de comandos:
 *
 *   KOMMO_SUBDOMAIN    el pedacito de la dirección: en vdh.kommo.com es "vdh"
 *   KOMMO_TOKEN        el token de larga duración (ver abajo)
 *   KOMMO_PIPELINE_ID  opcional: a qué embudo entran. Vacío = el principal
 *   KOMMO_STATUS_ID    opcional: a qué etapa de ese embudo. Vacío = la primera
 *
 * Mientras KOMMO_TOKEN esté vacío no se manda NADA y el sistema funciona
 * exactamente como antes. Es el mismo criterio que NOTIFICAR_A.
 *
 * El token sale de Kommo: Ajustes → Integraciones → crear una integración
 * privada → pestaña "Claves y permisos" → "Generar token de larga duración"
 * (dura de 1 día a 5 años). Se muestra UNA sola vez.
 *
 * ── Por qué el token vive acá y no en el repo ─────────────────────────────
 * El repo es público. Un token de Kommo da acceso de escritura a todo el CRM:
 * va en las propiedades del script, igual que el ID de la planilla y el PIN.
 *
 * ── Regla de oro ──────────────────────────────────────────────────────────
 * Kommo NUNCA puede tumbar la carga de un registro. La planilla es la fuente
 * de verdad; si Kommo está caído o el token venció, el registro se guarda
 * igual y el error queda en el log. Por eso todo entra por kommoEnviar_(),
 * que se llama dentro de un try/catch en submitForm().
 */

/** Cuántos segundos se cachean los IDs de campos. Seis horas. */
const KOMMO_CACHE = 21600;

/**
 * Nombres de los campos personalizados del LEAD que busca el puente, tal como
 * tienen que llamarse en Kommo. Si alguno no existe, ese dato viaja igual
 * dentro de la nota del lead — no se pierde, pero no queda filtrable.
 * Los crea kommoCrearCampos() de una sola vez.
 */
const KOMMO_CAMPOS_LEAD = ['Sucursal', 'Vendedor', 'Producto buscado', 'Talle', 'Motivo'];

// ── Configuración ──────────────────────────────────────────────────────────
function kommoConfig_() {
  const p = PropertiesService.getScriptProperties();
  return {
    sub:      p.getProperty('KOMMO_SUBDOMAIN'),
    token:    p.getProperty('KOMMO_TOKEN'),
    pipeline: p.getProperty('KOMMO_PIPELINE_ID'),
    estado:   p.getProperty('KOMMO_STATUS_ID')
  };
}

/** Sin subdominio o sin token, el puente está apagado y nadie se entera. */
function kommoActivo_() {
  const c = kommoConfig_();
  return !!(c.sub && c.token);
}

/**
 * Una sola puerta para hablarle a Kommo.
 * muteHttpExceptions deja leer el cuerpo del error: sin eso, un 401 por token
 * vencido llega como una excepción genérica y no se sabe qué pasó.
 */
function kommoFetch_(metodo, ruta, cuerpo) {
  const c = kommoConfig_();
  if (!c.sub || !c.token) throw new Error('Falta configurar KOMMO_SUBDOMAIN o KOMMO_TOKEN.');

  const opciones = {
    method: metodo,
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + c.token },
    muteHttpExceptions: true
  };
  if (cuerpo) opciones.payload = JSON.stringify(cuerpo);

  const res = UrlFetchApp.fetch('https://' + c.sub + '.kommo.com/api/v4' + ruta, opciones);
  const codigo = res.getResponseCode();
  const texto = res.getContentText();

  if (codigo === 401) {
    throw new Error('Kommo rechazó el token (401). Venció o fue revocado: generá uno nuevo.');
  }
  if (codigo >= 300) {
    throw new Error('Kommo respondió ' + codigo + ': ' + texto.slice(0, 400));
  }
  return texto ? JSON.parse(texto) : null;   // 204 en los borrados
}

// ── Campos ─────────────────────────────────────────────────────────────────
/** Para comparar nombres de campos sin pelearse con tildes ni mayúsculas. */
function kommoClave_(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim();
}

/**
 * Mapa de campos de Kommo: nombre → id.
 *
 * Se descubren solos en vez de quedar escritos a mano, porque los ids de los
 * campos son distintos en cada cuenta de Kommo: hardcodearlos significaría que
 * este código sólo funciona en una cuenta y se rompe en silencio el día que
 * alguien recrea un campo.
 *
 * Los campos de sistema (teléfono, mail) se guardan por su código —PHONE,
 * EMAIL— que sí es estable.
 */
function kommoCampos_(refrescar) {
  const cache = CacheService.getScriptCache();
  if (!refrescar) {
    const guardado = cache.get('KOMMO_CAMPOS');
    if (guardado) return JSON.parse(guardado);
  }

  const mapa = { lead: {}, contacto: {} };

  const cargar = function (entidad, destino) {
    const r = kommoFetch_('get', '/' + entidad + '/custom_fields?limit=250');
    const campos = (r && r._embedded && r._embedded.custom_fields) || [];
    campos.forEach(function (f) {
      if (f.code) destino['#' + f.code] = f.id;
      destino[kommoClave_(f.name)] = f.id;
    });
  };

  cargar('leads', mapa.lead);
  cargar('contacts', mapa.contacto);

  cache.put('KOMMO_CAMPOS', JSON.stringify(mapa), KOMMO_CACHE);
  return mapa;
}

/** Arma un campo personalizado, o null si en esta cuenta ese campo no existe. */
function kommoCampo_(mapa, nombre, valor) {
  if (!valor) return null;
  const id = mapa[kommoClave_(nombre)];
  if (!id) return null;
  return { field_id: id, values: [{ value: String(valor) }] };
}

/** Teléfono en formato internacional: así Kommo puede unificar duplicados. */
function kommoTel_(tel) {
  let n = String(tel || '').replace(/\D/g, '').replace(/^0/, '');
  if (!n) return '';
  if (n.indexOf('54') !== 0) n = '549' + n;
  return '+' + n;
}

/**
 * Busca un contacto por teléfono y devuelve su id, o null si no está.
 *
 * Existe porque el "Control de duplicados" de Kommo NO actúa sobre
 * /leads/complex: probado el 20/09/2026 contra la cuenta real, dos cargas con
 * el mismo teléfono crearon dos contactos distintos. Sin esto, un cliente que
 * pasa tres veces por el local queda como tres personas, y se rompe
 * justamente lo que hace útil el CRM: ver todo lo que le pasó a alguien y
 * poder escribirle por un solo hilo de WhatsApp.
 *
 * La búsqueda de Kommo es difusa —matchea contra varios campos—, así que el
 * resultado se verifica comparando los dígitos del teléfono. Ante la duda
 * devuelve null y se crea el contacto: un duplicado es molesto, pero colgarle
 * el lead al cliente equivocado es bastante peor.
 */
function kommoBuscarContacto_(tel) {
  if (!tel) return null;

  // Sin resultados Kommo contesta 204 sin cuerpo, y kommoFetch_ devuelve null.
  const r = kommoFetch_('get', '/contacts?limit=10&query=' + encodeURIComponent(tel));
  const lista = (r && r._embedded && r._embedded.contacts) || [];
  const buscado = String(tel).replace(/\D/g, '');

  const coincide = function (contacto) {
    return (contacto.custom_fields_values || []).some(function (campo) {
      if (campo.field_code !== 'PHONE') return false;
      return (campo.values || []).some(function (v) {
        return String(v.value).replace(/\D/g, '') === buscado;
      });
    });
  };

  const encontrado = lista.filter(coincide)[0];
  return encontrado ? encontrado.id : null;
}

// ── Envío ──────────────────────────────────────────────────────────────────
/**
 * Manda un no-compra a Kommo como lead + contacto.
 *
 * Las etiquetas son a propósito la parte más importante para lo que sigue:
 * no necesitan ninguna configuración previa —Kommo las crea sola— y son lo
 * que después permite armar una campaña para "todos los que se fueron por
 * falta de talle en Unicenter". Los campos personalizados son más prolijos
 * pero hay que crearlos antes; las etiquetas andan desde el primer día.
 *
 * @param {Object} data el mismo objeto que recibe submitForm()
 * @return {Object|null} respuesta de Kommo, o null si el puente está apagado
 */
function kommoEnviar_(data) {
  if (!kommoActivo_()) return null;

  const campos = kommoCampos_();
  const c = kommoConfig_();
  const tel = kommoTel_(data.whatsapp);

  // Kommo pide un nombre para el contacto. Si el vendedor no lo anotó, el
  // teléfono es mejor que dejarlo vacío: en la lista se distingue igual.
  const nombreContacto = data.nombre || ('Cliente ' + (data.whatsapp || 's/d'));

  const camposContacto = [];
  if (tel) camposContacto.push({ field_id: campos.contacto['#PHONE'], values: [{ value: tel }] });
  if (data.mail) camposContacto.push({ field_id: campos.contacto['#EMAIL'], values: [{ value: data.mail }] });

  const camposLead = [
    kommoCampo_(campos.lead, 'Sucursal',         data.sucursal),
    kommoCampo_(campos.lead, 'Vendedor',         data.vendedor),
    kommoCampo_(campos.lead, 'Producto buscado', data.producto),
    kommoCampo_(campos.lead, 'Talle',            data.talle),
    kommoCampo_(campos.lead, 'Motivo',           data.motivo)
  ].filter(function (x) { return x; });

  // Si el cliente ya está en el CRM, el lead se le cuelga al contacto que ya
  // existe. No se le tocan los datos: si cambió de mail, eso se arregla en
  // Kommo a mano — pisar un contacto bueno con lo que anotó un vendedor
  // apurado sería peor que quedarse con el dato viejo.
  const existente = kommoBuscarContacto_(tel);
  const contacto = existente
    ? { id: existente }
    : {
        first_name: nombreContacto,
        custom_fields_values: camposContacto.filter(function (x) { return x.field_id; })
      };

  const etiquetas = [{ name: 'No Compra' }];
  if (data.sucursal) etiquetas.push({ name: data.sucursal });
  if (data.motivo)   etiquetas.push({ name: 'Motivo: ' + data.motivo });

  const lead = {
    name: 'No Compra · ' + (data.producto || 'sin producto especificado'),
    // request_id vuelve en la respuesta: sirve para cruzar qué fila de la
    // planilla generó qué lead cuando algo no cuadra.
    request_id: String(Date.now()),
    _embedded: {
      contacts: [contacto],
      tags: etiquetas
    }
  };

  if (camposLead.length) lead.custom_fields_values = camposLead;
  if (c.pipeline) lead.pipeline_id = Number(c.pipeline);
  // Sin etapa explícita el lead cae en la primera del embudo, que en Kommo es
  // "Leads Entrantes" (la bandeja de sin clasificar). Los no-compra no son
  // dudosos: ya sabemos qué son y quién los cargó, así que entran derecho a
  // "Sin contactar", que es la columna donde Atención al Cliente los trabaja.
  if (c.estado)   lead.status_id   = Number(c.estado);

  const res = kommoFetch_('post', '/leads/complex', [lead]);
  const creado = res && res[0];

  if (creado) {
    console.log('Kommo: lead ' + creado.id +
      (existente ? ' colgado del contacto ' + existente + ', que ya estaba en el CRM'
                 : ' con contacto nuevo'));
    kommoNota_(creado.id, data);
  }
  return creado;
}

// ── Nota del lead ──────────────────────────────────────────────────────────
/**
 * Pega el registro completo como nota del lead.
 *
 * Los campos personalizados sólo guardan lo que existe en esta cuenta de
 * Kommo, y las observaciones del vendedor no tienen campo propio: son texto
 * libre y son, justamente, lo que explica el caso ("lo quería en negro",
 * "vuelve el sábado con la mujer"). La nota entra siempre, sin configurar
 * nada, así que quien trabaja el lead ve todo sin abrir la planilla.
 *
 * Si la nota falla no se reintenta ni se propaga el error: el lead ya está
 * creado, que es lo que importa. Perder la nota es molesto; perder el lead
 * por culpa de la nota sería peor.
 */
function kommoNota_(leadId, data) {
  const lineas = ['Se fue del local sin comprar.', ''];
  const poner = function (etiqueta, valor) {
    if (valor) lineas.push(etiqueta + ': ' + valor);
  };

  poner('Local', data.sucursal);
  poner('Vendedor', data.vendedor);
  poner('Buscaba', data.producto);
  poner('Talle', data.talle);
  poner('Motivo', data.motivo);
  poner('WhatsApp', data.whatsapp);
  poner('Mail', data.mail);
  if (data.obs) lineas.push('', 'Lo que anotó el vendedor:', data.obs);

  try {
    kommoFetch_('post', '/leads/' + leadId + '/notes', [{
      note_type: 'common',
      params: { text: lineas.join('\n') }
    }]);
  } catch (err) {
    console.error('Kommo: el lead ' + leadId + ' se creó pero la nota no: ' + err.message);
  }
}

// ── Puesta en marcha y diagnóstico ─────────────────────────────────────────
/**
 * Correr UNA VEZ desde el editor, después de cargar las propiedades.
 *
 * No manda nada ni cambia nada: sólo lee la cuenta y escribe en el log los
 * ids que hacen falta para terminar de configurar (embudos, campos). Es la
 * forma de averiguar los ids sin tener que pasarle el token a nadie.
 */
function kommoDiagnostico() {
  const c = kommoConfig_();
  if (!c.sub)   { console.log('✗ Falta KOMMO_SUBDOMAIN.'); return; }
  if (!c.token) { console.log('✗ Falta KOMMO_TOKEN.'); return; }

  const cuenta = kommoFetch_('get', '/account');
  console.log('✓ Token válido. Cuenta: ' + cuenta.name + ' (id ' + cuenta.id + ')');

  console.log('\n── EMBUDOS ─────────────────────────────');
  const p = kommoFetch_('get', '/leads/pipelines');
  ((p._embedded && p._embedded.pipelines) || []).forEach(function (emb) {
    console.log('  ' + emb.id + '  ' + emb.name + (emb.is_main ? '  ← principal' : ''));
    ((emb._embedded && emb._embedded.statuses) || []).forEach(function (s) {
      console.log('        etapa ' + s.id + '  ' + s.name);
    });
  });
  console.log('  (el id del embudo va en KOMMO_PIPELINE_ID y el de la etapa en KOMMO_STATUS_ID;');
  console.log('   vacíos = embudo principal y primera etapa, que suele ser la bandeja de entrantes)');

  const listar = function (entidad, titulo) {
    console.log('\n── CAMPOS DE ' + titulo + ' ─────────────');
    const r = kommoFetch_('get', '/' + entidad + '/custom_fields?limit=250');
    const campos = (r && r._embedded && r._embedded.custom_fields) || [];
    if (!campos.length) console.log('  (ninguno)');
    campos.forEach(function (f) {
      console.log('  ' + f.id + '  ' + f.name + '  [' + f.type + ']' + (f.code ? '  code=' + f.code : ''));
    });
  };
  listar('leads', 'LEAD');
  listar('contacts', 'CONTACTO');

  console.log('\n── QUÉ FALTA ───────────────────────────');
  const mapa = kommoCampos_(true);
  const faltan = KOMMO_CAMPOS_LEAD.filter(function (n) { return !mapa.lead[kommoClave_(n)]; });
  if (!faltan.length) {
    console.log('  Nada: están los ' + KOMMO_CAMPOS_LEAD.length + ' campos. El puente ya puede mandar todo.');
  } else {
    console.log('  Faltan estos campos de lead: ' + faltan.join(', '));
    console.log('  Se crean solos corriendo kommoCrearCampos(), o a mano desde Kommo.');
  }
  if (!mapa.contacto['#PHONE']) console.log('  ✗ No encontré el campo de teléfono del contacto.');
}

/**
 * Crea en Kommo los campos de lead que falten. Escribe en el CRM, así que se
 * corre a mano y una sola vez. Los que ya existen no se tocan.
 */
function kommoCrearCampos() {
  const mapa = kommoCampos_(true);
  const faltan = KOMMO_CAMPOS_LEAD.filter(function (n) { return !mapa.lead[kommoClave_(n)]; });

  if (!faltan.length) { console.log('No falta ninguno: los ' + KOMMO_CAMPOS_LEAD.length + ' ya están.'); return; }

  const nuevos = faltan.map(function (n) { return { name: n, type: 'text' }; });
  const r = kommoFetch_('post', '/leads/custom_fields', nuevos);
  ((r && r._embedded && r._embedded.custom_fields) || []).forEach(function (f) {
    console.log('✓ Creado: ' + f.name + ' (id ' + f.id + ')');
  });

  kommoCampos_(true);   // refresca el caché para que el puente los vea ya
}

/**
 * Manda un lead de prueba, para ver que llegue de verdad antes de dejarlo
 * suelto con los locales. Queda etiquetado como prueba para poder borrarlo.
 */
function kommoProbar() {
  const res = kommoEnviar_({
    sucursal: 'RIVADAVIA',
    vendedor: 'Prueba',
    nombre:   'Cliente de prueba',
    whatsapp: '1122334455',
    mail:     '',
    producto: 'Campera de abrigo negra',
    talle:    'L',
    obs:      'Lead de prueba del Sistema No Compra. Se puede borrar.',
    motivo:   'Sin talle'
  });
  if (!res) { console.log('El puente está apagado: falta KOMMO_SUBDOMAIN o KOMMO_TOKEN.'); return; }
  console.log('✓ Lead creado en Kommo con id ' + res.id + '. Buscalo por la etiqueta "No Compra".');
}
