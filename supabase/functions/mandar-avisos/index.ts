/**
 * VDH Club — manda los avisos al celular de los socios.
 *
 * ── Por qué esto es una Edge Function ─────────────────────────────────────
 * Mandar una notificación web no es hacer un POST: hay que FIRMAR el envío
 * con una llave privada (VAPID) y CIFRAR el mensaje con una clave que se
 * negocia contra la del navegador de cada cliente. Son curvas elípticas,
 * HKDF y AES-GCM.
 *
 * Eso no se puede hacer en dos lugares donde uno esperaría:
 *
 *   - **En la página del cliente**, porque la llave privada quedaría en un
 *     archivo público. Una llave privada publicada no es privada.
 *   - **Adentro de Postgres**, que es donde vive el resto de la
 *     automatización de este sistema. Postgres tiene pgcrypto, pero no las
 *     primitivas de curva P-256 que esto necesita.
 *
 * ── Qué reemplaza ─────────────────────────────────────────────────────────
 * Hasta el 26/09/2026 esto lo hacía un GitHub Action cada diez minutos. El
 * código funcionaba; el problema era el reloj: GitHub estrangula los
 * horarios de los repositorios privados con poco movimiento y los diez
 * minutos se volvían CINCO HORAS. Un aviso de "llegó la colección" que sale
 * cinco horas después no sirve.
 *
 * Acá sale cuando se lo llama, que es al guardar la promoción.
 *
 * El Action queda igual, corriendo una vez por hora, y NO es redundante:
 * una promoción cargada el lunes para el viernes deja su aviso esperando con
 * fecha, y alguien tiene que levantarlo el viernes. Esto atiende lo de
 * ahora; aquello, lo programado.
 */

import webpush from 'npm:web-push@3.6.7';

/* La llave privada se carga como secreto de la función. Nunca está en el
   código: este archivo vive en un repositorio público. */
const PRIVADA = Deno.env.get('VAPID_PRIVADA') ?? '';
const PUBLICA = 'BCG_mGNkME20VL9WrdVAUqSnPOPdNqQOIdyDGnY3UG8WbC-CbxV87N83mGVW71SZW_wrRYXMv2ZGkEWzRGLBxoo';

/* Éstos los pone Supabase sola en toda Edge Function: no hay que cargarlos. */
const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

interface Aviso {
  id: number;
  titulo: string;
  cuerpo: string;
  enlace: string | null;
}

interface Destino {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Una consulta a la base, con la llave de servicio. */
async function base(ruta: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(URL_BASE + '/rest/v1/' + ruta, {
    ...init,
    headers: {
      apikey: SERVICIO,
      Authorization: 'Bearer ' + SERVICIO,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });
}

Deno.serve(async (req) => {
  /* Contesta 200 siempre que haya podido correr, con el detalle en el
     cuerpo. Quien la llama es la pantalla de Configuración, y ahí lo útil es
     saber a cuántos llegó — no recibir un error que no se puede accionar. */
  const responder = (cuerpo: unknown, codigo = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status: codigo,
      headers: {
        'Content-Type': 'application/json',
        /* La llama el navegador desde la app, que está en otro dominio. */
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      }
    });

  if (req.method === 'OPTIONS') { return responder({ ok: true }); }

  if (!PRIVADA) {
    return responder({ ok: false, porque: 'Falta el secreto VAPID_PRIVADA.' }, 500);
  }

  webpush.setVapidDetails('mailto:mauriciocamara85@gmail.com', PUBLICA, PRIVADA);

  /* Los que ya pueden salir. `sale` es la fecha desde la cual corresponde:
     una promoción futura deja su aviso esperando. */
  const ahora = new Date().toISOString();
  const rAvisos = await base(
    'club_avisos?select=id,titulo,cuerpo,enlace&enviado=is.null&sale=lte.' + ahora + '&order=sale.asc'
  );
  if (!rAvisos.ok) {
    return responder({ ok: false, porque: 'No se pudo leer la cola.' }, 500);
  }
  const avisos: Aviso[] = await rAvisos.json();

  if (!avisos.length) { return responder({ ok: true, avisos: 0 }); }

  const rDest = await base('club_suscripciones?select=id,endpoint,p256dh,auth&muerto=is.null');
  const destinos: Destino[] = rDest.ok ? await rDest.json() : [];

  const hecho: Array<Record<string, unknown>> = [];

  for (const aviso of avisos) {
    let llegaron = 0, fallaron = 0;
    const muertos: number[] = [];

    /* De a tandas: con muchos suscriptores, abrir todas las conexiones a la
       vez hace que el servidor de notificaciones empiece a rechazar por
       exceso, y ahí se pierden avisos que estaban bien. */
    const TANDA = 50;
    for (let i = 0; i < destinos.length; i += TANDA) {
      await Promise.all(destinos.slice(i, i + TANDA).map(async (d) => {
        try {
          await webpush.sendNotification(
            { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
            JSON.stringify({ titulo: aviso.titulo, cuerpo: aviso.cuerpo, enlace: aviso.enlace })
          );
          llegaron++;
        } catch (e) {
          fallaron++;
          /* 404 y 410: ese destino ya no existe —desinstaló la app, borró
             los datos del navegador—. No es un error nuestro y no tiene
             sentido reintentarlo nunca más. */
          const codigo = (e as { statusCode?: number }).statusCode;
          /* Y 403: la suscripcion se hizo con OTRA llave VAPID. Tampoco se
             arregla reintentando — hay que volver a suscribirse desde el
             telefono. */
          if (codigo === 404 || codigo === 410 || codigo === 403) { muertos.push(d.id); }
        }
      }));
    }

    if (muertos.length) {
      /* Se marcan, no se borran: así se puede mirar cuánta gente se va, que
         es un dato y no basura. */
      await base('club_suscripciones?id=in.(' + muertos.join(',') + ')', {
        method: 'PATCH',
        body: JSON.stringify({ muerto: new Date().toISOString() })
      });
    }

    await base('club_avisos?id=eq.' + aviso.id, {
      method: 'PATCH',
      body: JSON.stringify({ enviado: new Date().toISOString(), llegaron, fallaron })
    });

    hecho.push({ id: aviso.id, titulo: aviso.titulo, llegaron, fallaron });
  }

  return responder({ ok: true, avisos: hecho.length, detalle: hecho });
});
