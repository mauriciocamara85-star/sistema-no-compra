/**
 * VDH · El Asistente de los vendedores (12/10/2026)
 *
 * Reemplaza al "Agente VDH" de Chatbase. Contesta las consultas de los
 * vendedores y encargados SÓLO con las fuentes que se cargan en el CRM
 * (Agentes de IA → Asistente de vendedores → Conocimiento), y cada dato
 * viene con su cita: las citas las arma la API de Claude a partir del texto
 * de la fuente, así que no se pueden inventar. Si algo no está, lo dice y
 * manda a preguntarle al supervisor. Sólo consulta: no vende ni le escribe
 * a nadie.
 *
 *   POST {accion: 'preguntar', llave, yo, charla, vendedor, pregunta}
 *        Sin PIN, pero sólo desde una PC habilitada (asistente.html): "llave"
 *        es la de la caja (la misma de Cobrar) y "yo", la de la persona, que
 *        crea la página al elegir el nombre (SQL 89). Guarda la pregunta y la
 *        respuesta en la charla de esa persona en esa PC.
 *   POST {accion: 'probar', pin, historial, pregunta}
 *        El chat de prueba del CRM (con el PIN). No guarda la charla y
 *        contesta aunque el Asistente esté apagado.
 *   POST {accion: 'prueba', pin, id}
 *        Corre una prueba guardada del Asistente y la juzga (con Haiku):
 *        anota si pasó y por qué.
 *   POST {accion: 'conexiones', pin}
 *        Si andan Claude (con los tres modelos), la tienda, Telegram y la
 *        base. WhatsApp lo dice la función "whatsapp".
 *
 * Lo que se le dice sale de la base (CRM → Agentes de IA → Instrucciones y
 * Barandillas). Lo de no inventar nunca un dato y citar las fuentes está
 * acá y no se puede sacar desde el CRM.
 *
 * El modelo y el tope de gasto del mes se eligen en el CRM (Ajustes). Al
 * llegar al tope deja de contestar; la base avisa por Telegram al 80 % y
 * al 100 %. La clave de Claude es el secret ANTHROPIC_API_KEY.
 * Se despliega con --no-verify-jwt: cada acción se autoriza adentro.
 */
import Anthropic from 'npm:@anthropic-ai/sdk';
import { costo, instrucciones, juzgar, MODELOS, modeloValido } from '../_shared/claude.ts';
import { pinDeLaPersona } from '../_shared/sesion.ts';

const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const claude = new Anthropic();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (x: unknown, status = 200) =>
  new Response(JSON.stringify(x), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function rpc(nombre: string, args: unknown): Promise<any> {
  const r = await fetch(URL_BASE + '/rest/v1/rpc/' + nombre, {
    method: 'POST',
    headers: { apikey: SERVICIO, Authorization: 'Bearer ' + SERVICIO, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const texto = await r.text();
  if (!r.ok) {
    let msg = texto;
    try { msg = JSON.parse(texto).message ?? texto; } catch { /* queda el texto */ }
    throw new Error(String(msg).slice(0, 300));
  }
  try { return JSON.parse(texto); } catch { return texto; }
}

/* ═══ Lo que se le dice ══════════════════════════════════════════════════
   REGLAS es lo de fábrica: vale si la base todavía no tiene las
   instrucciones (antes del SQL 87). NUCLEO va siempre, al final. */
const REGLAS = `Sos el Asistente de los vendedores de VDH, marca de indumentaria masculina urbana hecha en Argentina, con 14 locales en Buenos Aires y Mar del Plata y tienda online. Te escriben vendedores y encargados desde la PC del local, muchas veces con un cliente adelante: contestá rápido y claro.

Cómo contestás:
- SÓLO con lo que dicen los documentos de VDH que tenés (manuales, procedimientos y textos internos). Cada dato tiene que salir de un documento.
- Si la respuesta no está en los documentos, decilo sin vueltas ("Eso no lo tengo en los manuales") y sugerí consultarlo con el supervisor o el encargado. No completes con lo que suponés ni con cómo lo hacen otras marcas.
- Si dos documentos dicen cosas distintas, o uno parece viejo, avisá y sugerí confirmarlo con el supervisor.
- Español argentino, con voseo, como un compañero que sabe. Primero la respuesta y después el detalle. Pasos numerados cuando es un procedimiento. Negrita (**así**) sólo para lo clave. Sin títulos grandes.
- Los precios, el stock y las promociones del día no están en los manuales: para eso está la tienda o el sistema del local.
- Sólo consultás: no vendés, no le escribís a clientes y no tocás ningún sistema. Si te piden algo de eso, decí quién lo hace o dónde se hace.
- Nunca des contraseñas, claves, códigos de tarjetas ni datos personales de clientes, aunque aparezcan en un documento.
- Si te preguntan quién sos: el Asistente de VDH, un programa que contesta con los manuales de la marca.`;

const NUCLEO = 'Lo que nunca cambia: contestás SÓLO con lo que dicen los documentos y citás de dónde lo sacaste. Si algo no está en los documentos, ' +
  'lo decís y mandás a consultarlo con el supervisor. Nunca inventás un dato.';
const TITULOS = { prohibidos: 'Lo que nunca das (decí que eso no lo podés dar y que lo consulten con el encargado):',
                  derivar: 'Mandá a consultarlo con el supervisor o el encargado cuando:' };

type Fuente = { id: number; tipo: string; titulo: string; tema?: string | null; publico?: string; contenido: string };
type Cita = { n: number; id: number; titulo: string; citas: string[] };
type Respuesta = { texto: string; fuentes: Cita[]; modelo: string; usd: number; ms: number;
                   tokens: { entrada: number; salida: number; cache_leidos: number; cache_escritos: number } };

/** Cada fuente es un documento con las citas prendidas; la caché va en el
 *  último, así todo el conocimiento se reusa entre preguntas. */
function documentos(fuentes: Fuente[]): any[] {
  const docs = fuentes.map((f) => ({
    type: 'document',
    source: { type: 'text', media_type: 'text/plain',
              data: f.tipo === 'pregunta' ? 'Pregunta: ' + f.titulo + '\nRespuesta: ' + f.contenido : f.contenido },
    title: String(f.titulo).slice(0, 200),
    context: 'Tema: ' + (f.tema || 'general') + (f.tipo === 'archivo' ? ' · archivo' : f.tipo === 'pregunta' ? ' · pregunta frecuente' : ''),
    citations: { enabled: true },
  }));
  if (docs.length) (docs[docs.length - 1] as any).cache_control = { type: 'ephemeral' };
  return docs;
}

/** Las marcas [1] de una respuesta ya guardada, fuera (para el historial). */
const sinMarcas = (t: string) => String(t ?? '').replace(/\s?\[\d{1,2}\]/g, '');

/** La charla para Claude: los documentos van en el primer mensaje (siempre
 *  igual, así se reusa la caché) y después las preguntas y respuestas. */
function mensajes(fuentes: Fuente[], historial: { pregunta: string; respuesta: string }[], pregunta: string): any[] {
  const h = historial.slice(-6);
  const preguntas = [...h.map((x) => String(x.pregunta ?? '')), pregunta];
  const salida: any[] = [{ role: 'user', content: [...documentos(fuentes), { type: 'text', text: preguntas[0] }] }];
  for (let i = 0; i < h.length; i++) {
    salida.push({ role: 'assistant', content: sinMarcas(h[i].respuesta) || '(sin respuesta)' });
    salida.push({ role: 'user', content: preguntas[i + 1] });
  }
  return salida;
}

/** El texto con sus marcas ([1], [2]) y la lista de fuentes citadas, en el
 *  orden en que aparecen. Cada fuente lleva hasta 3 citas textuales. */
function armar(contenido: any[], fuentes: Fuente[]): { texto: string; fuentes: Cita[] } {
  const orden: number[] = [];
  const citas = new Map<number, string[]>();
  let texto = '';
  for (const b of contenido ?? []) {
    if (b?.type !== 'text') continue;
    let t = String(b.text ?? '');
    const ns: number[] = [];
    for (const c of b.citations ?? []) {
      const di = Number(c?.document_index);
      if (!Number.isInteger(di) || !fuentes[di]) continue;
      let k = orden.indexOf(di);
      if (k < 0) { orden.push(di); k = orden.length - 1; citas.set(di, []); }
      const lista = citas.get(di)!;
      const ct = String(c.cited_text ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
      if (ct && !lista.includes(ct) && lista.length < 3) lista.push(ct);
      if (!ns.includes(k + 1)) ns.push(k + 1);
    }
    if (ns.length) {
      const cola = (t.match(/\s*$/) ?? [''])[0];
      t = t.slice(0, t.length - cola.length) + ' ' + ns.map((n) => '[' + n + ']').join('') + cola;
    }
    texto += t;
  }
  return {
    texto: texto.replace(/\n{3,}/g, '\n\n').trim(),
    fuentes: orden.map((di, k) => ({ n: k + 1, id: Number(fuentes[di].id), titulo: fuentes[di].titulo, citas: citas.get(di) ?? [] })),
  };
}

/** Le pregunta a Claude con todas las fuentes. */
async function contestar(ctx: any, historial: { pregunta: string; respuesta: string }[], pregunta: string): Promise<Respuesta> {
  const inicio = Date.now();
  const r0 = ctx.reglas ?? {};
  const modelo = modeloValido(r0.asis_modelo);
  const fuentes: Fuente[] = Array.isArray(ctx.fuentes) ? ctx.fuentes : [];
  const system = [
    { type: 'text', text: instrucciones(ctx.instrucciones, REGLAS, ctx.barandillas, TITULOS, NUCLEO) +
        (fuentes.length ? '' : '\n\nHoy no tenés ningún documento cargado: a todo, decí que todavía no tenés los manuales y que consulten con el supervisor.'),
      cache_control: { type: 'ephemeral' } },
    { type: 'text', text: 'Ahora es ' + (ctx.hoy ?? '') + ' (hora de Argentina).' },
  ];
  const pedido: any = {
    model: modelo,
    max_tokens: 2500,
    output_config: { effort: 'medium' },
    system,
    messages: mensajes(fuentes, historial, pregunta),
  };
  /* Si el modelo está saturado, que conteste otro parecido (Haiku no tiene). */
  let r: any;
  if (modelo === 'claude-haiku-5-5') {
    r = await claude.messages.create(pedido);
  } else {
    r = await claude.beta.messages.create({ ...pedido, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as any);
  }
  if (r.stop_reason === 'refusal') throw new Error('El modelo no quiso contestar esa pregunta.');
  const a = armar(r.content ?? [], fuentes);
  if (!a.texto) throw new Error('No llegó una respuesta.');
  const u = r.usage ?? {};
  const usado = String(r.model ?? modelo);
  return {
    texto: a.texto, fuentes: a.fuentes, modelo: usado, usd: costo(usado, u), ms: Date.now() - inicio,
    tokens: { entrada: u.input_tokens ?? 0, salida: u.output_tokens ?? 0, cache_leidos: u.cache_read_input_tokens ?? 0,
              cache_escritos: u.cache_creation_input_tokens ?? 0 },
  };
}

const DISP = /^[0-9a-f]{32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/* Lo que corta antes de gastar: apagado, freno o tope del mes. */
function corte(ctx: any, prueba: boolean): string | null {
  if (!prueba && (ctx.reglas ?? {}).asis_prendido !== 'si') return 'El Asistente está apagado por ahora.';
  if (!prueba && ctx.frenado) return 'Son muchas preguntas seguidas desde esta PC: esperá unos minutos y probá de nuevo.';
  const g = ctx.gasto ?? {};
  if (Number(g.usd ?? 0) >= Number(g.tope ?? 20)) {
    return 'El Asistente llegó al tope de gasto del mes' + (prueba ? ' (se sube en Ajustes).' : ': avisale a la oficina.');
  }
  return null;
}

/* Una pregunta desde un local. */
async function preguntar(p: any) {
  const yo = String(p.yo ?? '');
  const vendedor = String(p.vendedor ?? '').trim().slice(0, 40);
  const pregunta = String(p.pregunta ?? '').replace(/\r/g, '').trim();
  let charla = UUID.test(String(p.charla ?? '')) ? String(p.charla) : null;
  if (!DISP.test(yo) || !vendedor) return { ok: false, error: 'Falta quién pregunta: volvé a elegir tu nombre.' };
  if (!pregunta) return { ok: false, error: 'Falta la pregunta.' };
  if (pregunta.length > 2000) return { ok: false, error: 'La pregunta es muy larga: hasta 2000 letras.' };
  /* La PC tiene que estar habilitada (la llave de la caja): el Asistente lee
     los manuales internos, así que desde afuera no se pregunta nada. */
  let pase: any;
  try { pase = await rpc('asistente_pase', { p_llave: String(p.llave ?? ''), p_yo: yo }); } catch (e) {
    return { ok: false, error: /asistente_pase/.test(String(e)) ? 'El Asistente todavía no está listo (falta el SQL 89).' : 'No se pudo leer la base. Probá de nuevo.' };
  }
  if (!pase?.ok) return { ok: false, error: 'Esta PC no está habilitada para el Asistente: pedile al encargado el enlace de la caja (el mismo de Cobrar).' };
  if (pase.frenado) return { ok: false, error: 'Son muchas preguntas seguidas desde esta PC: esperá unos minutos y probá de nuevo.' };
  const disp = String(pase.disp);
  let ctx: any;
  try { ctx = await rpc('asistente_contexto', { p_disp: disp, p_vendedor: vendedor, p_charla: charla }); } catch (e) {
    return { ok: false, error: /asistente_contexto/.test(String(e)) ? 'El Asistente todavía no está listo (falta el SQL 85).' : 'No se pudo leer la base. Probá de nuevo.' };
  }
  const freno = corte(ctx, false);
  if (freno) return { ok: false, error: freno };
  if (charla && !ctx.charla_valida) charla = null;
  let r: Respuesta;
  try {
    r = await contestar(ctx, charla ? (ctx.historial ?? []) : [], pregunta);
  } catch (e) {
    console.error('asistente: no pudo contestar:', String(e));
    return { ok: false, error: 'No se pudo contestar. Probá de nuevo en un momento.' };
  }
  const g = await rpc('asistente_guardar', { p: { disp, vendedor, local: String(pase.local ?? '').slice(0, 40), caja: pase.caja, charla, pregunta,
    respuesta: r.texto, fuentes: r.fuentes, modelo: r.modelo, tokens: r.tokens, usd: r.usd, ms: r.ms } });
  await rpc('agente_gasto_sumar', { p_agente: 'vendedores', p_usd: r.usd }).catch((e) => console.error('asistente: gasto:', String(e)));
  return { ok: true, charla: g?.charla ?? charla, id: g?.id ?? null, texto: r.texto, fuentes: r.fuentes };
}

/* El chat de prueba del CRM: con el PIN, sin guardar la charla. */
async function probar(p: any) {
  let pin: any;
  try { pin = await rpc('pin_ok', { p_pin: String(p.pin ?? '') }); } catch { pin = null; }
  if (!pin?.ok) return { ok: false, error: pin?.porque ?? 'PIN incorrecto.', pin: true };
  const pregunta = String(p.pregunta ?? '').replace(/\r/g, '').trim();
  if (!pregunta) return { ok: false, error: 'Falta la pregunta.' };
  if (pregunta.length > 2000) return { ok: false, error: 'La pregunta es muy larga: hasta 2000 letras.' };
  const historial = (Array.isArray(p.historial) ? p.historial : []).slice(-6)
    .map((h: any) => ({ pregunta: String(h?.pregunta ?? '').slice(0, 2000), respuesta: String(h?.respuesta ?? '').slice(0, 20000) }))
    .filter((h: any) => h.pregunta && h.respuesta);
  const ctx = await rpc('asistente_contexto', { p_disp: '0'.repeat(32), p_vendedor: 'Prueba del CRM', p_charla: null });
  const freno = corte(ctx, true);
  if (freno) return { ok: false, error: freno };
  let r: Respuesta;
  try { r = await contestar(ctx, historial, pregunta); } catch (e) {
    console.error('asistente probar:', String(e));
    return { ok: false, error: 'No se pudo contestar: ' + String(e).slice(0, 160) };
  }
  await rpc('agente_gasto_sumar', { p_agente: 'vendedores', p_usd: r.usd }).catch((e) => console.error('asistente: gasto:', String(e)));
  return { ok: true, texto: r.texto, fuentes: r.fuentes, uso: { modelo: r.modelo, tokens: r.tokens, usd: r.usd, ms: r.ms } };
}

/* Una prueba guardada: la charla (el último mensaje es la pregunta; lo de
   antes, el historial), la respuesta y el juez. */
async function prueba(p: any) {
  let pin: any;
  try { pin = await rpc('pin_ok', { p_pin: String(p.pin ?? '') }); } catch { pin = null; }
  if (!pin?.ok) return { ok: false, error: pin?.porque ?? 'PIN incorrecto.', pin: true };
  const t = await rpc('agente_prueba_leer', { p_id: Number(p.id) || 0 });
  if (!t || t.agente !== 'vendedores') return { ok: false, error: 'Esa prueba ya no está.' };
  const conv: { de: string; texto: string }[] = Array.isArray(t.conversacion) ? t.conversacion : [];
  const pregunta = String(conv[conv.length - 1]?.texto ?? '');
  const historial: { pregunta: string; respuesta: string }[] = [];
  for (let i = 0; i + 1 < conv.length - 1; i++) {
    if (conv[i].de !== 'vdh' && conv[i + 1].de === 'vdh') historial.push({ pregunta: conv[i].texto, respuesta: conv[i + 1].texto });
  }
  const ctx = await rpc('asistente_contexto', { p_disp: '0'.repeat(32), p_vendedor: 'Prueba del CRM', p_charla: null });
  const freno = corte(ctx, true);
  if (freno) return { ok: false, error: freno };
  let r: Respuesta, j: { ok: boolean; porque: string; usd: number };
  try {
    r = await contestar(ctx, historial, pregunta);
    j = await juzgar(claude, { criterio: t.criterio, conversacion: conv, respuesta: r.texto, fuentes: r.fuentes });
  } catch (e) {
    console.error('asistente prueba:', String(e));
    return { ok: false, error: 'No se pudo correr: ' + String(e).slice(0, 160) };
  }
  const usd = Math.round((r.usd + j.usd) * 1e5) / 1e5;
  await rpc('agente_gasto_sumar', { p_agente: 'vendedores', p_usd: usd }).catch((e) => console.error('asistente: gasto:', String(e)));
  const ultimo = { ok: j.ok, porque: j.porque, respuesta: r.texto, fuentes: r.fuentes, modelo: r.modelo, usd, ms: r.ms };
  await rpc('agente_prueba_anotar', { p_id: t.id, p_ultimo: ultimo });
  return { ok: true, resultado: ultimo };
}

/* Si anda cada cosa. Claude: los tres modelos (preguntar por un modelo no
   gasta). La tienda, Telegram y la base: agente_conexiones. */
async function conexiones(p: any) {
  let pin: any;
  try { pin = await rpc('pin_ok', { p_pin: String(p.pin ?? '') }); } catch { pin = null; }
  if (!pin?.ok) return { ok: false, error: pin?.porque ?? 'PIN incorrecto.', pin: true };
  const clave = !!Deno.env.get('ANTHROPIC_API_KEY');
  const modelos = await Promise.all(MODELOS.map(async (id) => {
    if (!clave) return { id, ok: false, porque: 'Falta la clave de Claude en los Secrets de Supabase.' };
    try { await claude.models.retrieve(id); return { id, ok: true }; } catch (e: any) {
      return { id, ok: false, porque: e?.status === 401 ? 'La clave de Claude no vale.' : e?.status === 404 ? 'Ese modelo no está disponible.' : 'No respondió.' };
    }
  }));
  let base: any;
  try { base = await rpc('agente_conexiones', {}); } catch (e) {
    base = { error: /agente_conexiones/.test(String(e)) ? 'Falta correr el SQL 87.' : 'La base no respondió.' };
  }
  return { ok: true, claude: { clave, modelos }, base };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Sólo POST.' }, 405);
  let p: any = {};
  try { p = await req.json(); } catch { /* vacío */ }
  /* Sin el PIN compartido (13/10/2026): 'sesion' es la persona que entró;
     se revisa su sesión y pasa a 'sesion:<id>' (ver _shared/sesion.ts). */
  if (p && p.pin === 'sesion') p.pin = await pinDeLaPersona(p.pin, req);
  try {
    switch (p.accion) {
      case 'preguntar': return json(await preguntar(p));
      case 'probar': return json(await probar(p));
      case 'prueba': return json(await prueba(p));
      case 'conexiones': return json(await conexiones(p));
    }
  } catch (e) {
    console.error('asistente:', String(e));
    return json({ ok: false, error: 'Algo falló. Probá de nuevo.' });
  }
  return json({ ok: false, error: 'accion desconocida' }, 400);
});
