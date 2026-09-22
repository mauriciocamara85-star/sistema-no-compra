/**
 * VDH · Sistema No Compra — el aviso de vuelta de Kommo.
 *
 * Cada vez que Atención al Cliente mueve un lead de etapa, Kommo avisa acá y
 * el Panel se entera. Es lo que hace que el Panel sirva para MIRAR: sin esto
 * mostraría el estado del día que se cargó el cliente y nada más.
 *
 * ── Por qué esto es una Edge Function y el resto no ───────────────────────
 * Todo lo demás del sistema —Kommo, Telegram, el recordatorio— vive adentro
 * de la base, que sabe llamar afuera. Esto no puede: **Kommo no manda JSON,
 * manda un formulario**, y con las claves anidadas:
 *
 *     leads[status][0][id]=123&leads[status][0][status_id]=456
 *
 * PostgREST convierte cada campo de un formulario en un argumento con ese
 * nombre, así que no hay ninguna función de Postgres que pueda recibir eso.
 * Hace falta algo que desarme el formulario primero. Es lo único.
 *
 * ── Siempre contesta 200 ──────────────────────────────────────────────────
 * Un webhook que recibe un error se reintenta solo, y reintentar algo que ya
 * se aplicó no arregla nada: lo repite. Así que los problemas se cuentan en
 * el cuerpo de la respuesta y en el log, nunca con el código HTTP.
 */

// El token va en la dirección, no en una cabecera: Kommo sólo deja configurar
// una URL. Sin él, cualquiera que la adivine podría mover estados.
const TOKEN = Deno.env.get('WEBHOOK_TOKEN') ?? '';
const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Un lead del aviso, ya desarmado. */
interface Lead {
  id?: string;
  status_id?: string;
  price?: string;
}

/**
 * Desarma el formulario de Kommo en leads.
 *
 * Llega aplanado y puede traer varios leads y varios tipos de evento en el
 * mismo aviso. Se agrupan por TIPO e ÍNDICE para no mezclar el id de uno con
 * el precio de otro, que es el error silencioso que tendría este código si se
 * limitara a juntar todo lo que empiece con "leads[".
 */
function leadsDelAviso(form: URLSearchParams): Lead[] {
  const juntados: Record<string, Lead> = {};

  for (const [clave, valor] of form.entries()) {
    const m = clave.match(/^leads\[([a-z_]+)\]\[(\d+)\]\[([a-z_]+)\]$/i);
    if (!m) continue;
    const donde = m[1] + '#' + m[2];
    juntados[donde] = juntados[donde] ?? {};
    (juntados[donde] as Record<string, string>)[m[3]] = valor;
  }

  return Object.values(juntados).filter((l) => l.id);
}

/** Le pasa el lead ya desarmado a la base, que es la que decide qué hacer. */
async function aplicar(lead: Lead): Promise<unknown> {
  const precio = Number(String(lead.price ?? '0').replace(/[^\d.-]/g, ''));

  const r = await fetch(URL_BASE + '/rest/v1/rpc/aplicar_kommo', {
    method: 'POST',
    headers: {
      apikey: SERVICIO,
      Authorization: 'Bearer ' + SERVICIO,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_lead: String(lead.id),
      p_etapa: Number(lead.status_id),
      p_precio: Number.isFinite(precio) && precio > 0 ? precio : null,
    }),
  });

  const texto = await r.text();
  if (!r.ok) throw new Error(r.status + ': ' + texto.slice(0, 300));
  try { return JSON.parse(texto); } catch { return texto; }
}

Deno.serve(async (req) => {
  const responder = (o: unknown) =>
    new Response(JSON.stringify(o), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') {
    return responder({ status: 'error', msg: 'Sólo POST.' });
  }

  if (!TOKEN) {
    console.error('Llegó un aviso pero no hay WEBHOOK_TOKEN configurado.');
    return responder({ status: 'error', msg: 'Webhook sin configurar.' });
  }

  const url = new URL(req.url);
  if (url.searchParams.get('t') !== TOKEN) {
    console.error('Token incorrecto. Aviso ignorado.');
    return responder({ status: 'error', msg: 'No autorizado.' });
  }

  let leads: Lead[];
  try {
    /* Kommo manda x-www-form-urlencoded. Se lee como texto y se parsea a
       mano en vez de con req.formData(): formData() también acepta multipart,
       y ante un cuerpo raro tira una excepción en vez de devolver vacío. */
    leads = leadsDelAviso(new URLSearchParams(await req.text()));
  } catch (err) {
    console.error('No se pudo leer el aviso: ' + (err as Error).message);
    return responder({ status: 'error', msg: 'Aviso ilegible.' });
  }

  if (!leads.length) {
    // Kommo manda avisos de otras cosas (notas, tareas) al mismo lugar.
    return responder({ status: 'ok', aplicados: 0, msg: 'Sin leads en el aviso.' });
  }

  let aplicados = 0;
  const detalle: unknown[] = [];

  for (const lead of leads) {
    try {
      const res = await aplicar(lead);
      detalle.push(res);
      /* La base contesta si aplicó o no y por qué. Un lead de otro embudo
         contesta que no, y eso no es un error: es la mitad de los avisos. */
      if (res && typeof res === 'object' && (res as { aplicado?: boolean }).aplicado) {
        aplicados++;
      }
    } catch (err) {
      // Uno que falla no puede cortar a los que vienen atrás.
      console.error('Lead ' + lead.id + ': ' + (err as Error).message);
      detalle.push({ lead: lead.id, error: (err as Error).message });
    }
  }

  console.log(leads.length + ' aviso(s), ' + aplicados + ' aplicado(s).');
  return responder({ status: 'ok', avisos: leads.length, aplicados, detalle });
});
