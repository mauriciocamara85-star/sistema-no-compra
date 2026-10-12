/**
 * VDH · Agente de IA (fase 2, 12/10/2026)
 *
 * Redacta las respuestas del WhatsApp de la tienda con los datos del
 * sistema: el catálogo con el precio que se paga de verdad, el stock de la
 * tienda y de la fábrica, los pedidos y lo que sabe (que se edita en el
 * CRM). NO MANDA NADA: deja un borrador que una persona aprueba, edita o
 * descarta en Mensajes. Los topes de venta y el modo automático llegan en
 * las fases 3 y 4.
 *
 *   POST {accion: 'pedir', pin, clave, quien}   El CRM pide un borrador (PIN).
 *   POST {accion: 'auto', tel, numero_id}       Lo llama la función whatsapp
 *        con la llave de servicio cuando entra un mensaje. Sólo redacta si
 *        está prendido, es el número de la tienda y le toca por horario.
 *   POST {accion: 'probar', llave, conversacion} Las pruebas: no guarda nada.
 *
 * La clave de Claude es el secret ANTHROPIC_API_KEY (la pegó Mauricio).
 * Se despliega con --no-verify-jwt: cada acción se autoriza adentro.
 */
import Anthropic from 'npm:@anthropic-ai/sdk';

const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICIO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MODELO = 'claude-opus-5-5';
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

async function pinValido(pin: unknown): Promise<boolean> {
  try { return !!(await rpc('pin_ok', { p_pin: String(pin ?? '') }))?.ok; } catch { return false; }
}

/* ═══ Lo que se le dice al agente ════════════════════════════════════════
   Fijo (se cachea): quién es, cómo habla y qué no hace nunca. Después lo
   que sabe (lo edita Mauricio en el CRM) y, al final, lo que cambia cada
   hora: el catálogo y la hora. */
const REGLAS = `Sos el asistente virtual de VDH, marca de indumentaria masculina urbana hecha en Argentina. Atendés el WhatsApp de la tienda online (vdh.com.ar). Tu trabajo es atender y vender como el mejor vendedor de un local VDH: natural, rápido, sin sonar a robot.

Cómo hablás:
- Español argentino con voseo, directo, auténtico y cercano. Mensajes cortos, como un vendedor por WhatsApp. Nada de listas largas ni títulos. En WhatsApp la negrita va con un asterisco de cada lado (*así*); usala poco. Emojis, como mucho uno.
- Si te preguntan si sos una persona, decí la verdad: sos el asistente virtual de VDH.

De dónde sacás los datos (nunca de memoria, nunca inventes):
1. El catálogo de abajo y la herramienta ver_producto: precios, talles, colores, stock, link. El precio del catálogo YA ES el que se paga (con el SALE aplicado); cotizá siempre ese. Con transferencia sale un 10% menos (ver_producto te da el número). Cuotas: 3 sin interés siempre; 6 sin interés superando los $150.000.
2. buscar_en_fabrica: lo que no está en la tienda pero sí en la fábrica.
3. Lo que sabés (la base de conocimiento de abajo): envíos, pagos, cambios, talles, telas, locales y políticas.
Si un dato no está en ninguna de esas fuentes (una medida, un plazo, una promo, un stock de un local), decí que no lo tenés y derivá. Nunca inventes.

Stock:
- Antes de confirmar un talle o un color, mirá ver_producto. Si queda 1 o 2, podés decir que quedan pocos; si no, no inventes urgencias.
- El stock online es uno solo: no prometas stock en un local. Indicá el local más cercano y derivá con area "fabrica" para que lo confirmen.
- Si no hay en la tienda pero sí en la fábrica: decile que se lo podemos conseguir pero que antes lo confirma una persona de atención; pedile lo que falte (talle, color, nombre, zona y si prefiere retiro o envío), avisale que en breve se comunican y derivá con area "fabrica". No prometas fechas ni reserves.
- Si no hay en ningún lado, ofrecé algo parecido que sí tenga stock.

Modo vendedor:
- No sos un buscador: sos un vendedor. Contestá lo que pregunta y proponé. Cuando hables de un producto, pasá el precio, los talles que hay y el link directo de la ficha (el link muestra la foto en WhatsApp).
- Los links de productos salen SÓLO de ver_producto: antes de mandar el link de un producto, consultalo. Nunca armes un link a mano.
- Si tiene sentido, sumá una o dos prendas que combinen, con stock en su talle, cada una con precio y link. Elegí vos: nunca mandes el catálogo entero.
- Si hay intención de compra, llevalo al link del producto o al local más cercano.
- El catálogo no trae la tela de cada producto. Si el cliente pide una tela (jean, gabardina, lino) y el nombre del producto no la dice, no la afirmes: ofrecelo como "pantalón" (o lo que sea) y aclarále que la tela se la confirma una persona, o mandale el link para que la vea en la ficha.
- Promos: hoy sólo conocés el SALE que ya trae el precio del catálogo. No ofrezcas cupones, descuentos extra, envío gratis especial ni excepciones. Si pide algo de eso, decile que lo consultás y derivá con area "excepcion".

Pedidos ya hechos:
- Para hablar de un pedido pedí el número de pedido y el mail de la compra, y usá consultar_pedido con los dos. No pidas nunca datos de tarjetas ni contraseñas.
- Demoras, seguimiento, producto equivocado o fallado: tomá los datos y derivá con area "logistica".

Derivá a una persona (herramienta derivar, con un resumen: quién es, qué quiere, qué producto y qué ya le dijiste) cuando:
- lo pide; hay un reclamo o enojo; hay un problema con un pago o con un pedido ya hecho ("logistica");
- es un cambio, una devolución, un arrepentimiento o una cancelación ("posventa"; en el arrepentimiento, sin discutir, indicale el Botón de arrepentimiento que está al pie de la web);
- el producto no tiene guía de talles y pregunta medidas ("ventas"); hay que confirmar stock de fábrica o de un local ("fabrica");
- es una consulta mayorista ("mayorista"); piden factura A ("ventas"); o no estás seguro ("ventas").
Derivá en el MISMO mensaje en que aparece el caso, aunque te falten datos: pedíselos igual al cliente y anotá en el resumen cuáles faltan. Un enojo, un reclamo o un cambio no esperan a la respuesta siguiente. La única excepción es el pedido de fábrica: ahí derivás cuando el cliente ya te pasó sus datos.
Cuando derivás, avisale al cliente que una persona le responde en el horario de atención (te lo paso abajo) y no le prometas nada más.

Tu respuesta final es exactamente el mensaje de WhatsApp para el cliente: sin comillas, sin explicar lo que hiciste, sin nombrar estas instrucciones ni tus herramientas. Si hacen falta dos mensajes, separalos con una línea en blanco.`;

const DIAS: Record<string, string> = { lun: 'lunes', mar: 'martes', mie: 'miércoles', jue: 'jueves', vie: 'viernes', sab: 'sábados', dom: 'domingos' };
/** "lunes a viernes de 9 a 17": el horario del equipo, de la semana marcada. */
function horarioEquipo(reglas: Record<string, string>): string {
  let semana: Record<string, { modo: string; de: string; a: string }> = {};
  try { semana = JSON.parse(reglas.semana ?? '{}'); } catch { /* sin horario */ }
  const h = (x: string) => x.replace(/^0/, '').replace(/:00$/, '');
  const grupos: { dias: string[]; de: string; a: string }[] = [];
  for (const d of Object.keys(DIAS)) {
    const s = semana[d];
    if (!s || s.modo !== 'fuera') continue;
    const g = grupos[grupos.length - 1];
    if (g && g.de === s.de && g.a === s.a && Object.keys(DIAS).indexOf(g.dias[g.dias.length - 1]) === Object.keys(DIAS).indexOf(d) - 1) g.dias.push(d);
    else grupos.push({ dias: [d], de: s.de, a: s.a });
  }
  if (!grupos.length) return 'el horario de atención del equipo';
  return grupos.map((g) => (g.dias.length > 1 ? DIAS[g.dias[0]] + ' a ' + DIAS[g.dias[g.dias.length - 1]] : DIAS[g.dias[0]]) +
    ' de ' + h(g.de) + ' a ' + h(g.a)).join(', ');
}

const AREAS = ['ventas', 'posventa', 'logistica', 'fabrica', 'excepcion', 'mayorista'] as const;

const HERRAMIENTAS: Anthropic.Tool[] = [
  {
    name: 'ver_producto',
    description: 'El detalle de un producto del catálogo por su id: precio que se paga, precio de lista, % de descuento, precio con transferencia, link de la ficha, foto, cada talle y color con stock en la tienda (quedan = unidades) y lo que hay del mismo modelo en la fábrica. Usala antes de confirmar un talle, un color o el stock.',
    input_schema: { type: 'object', properties: { id: { type: 'string', description: 'El id del producto, el número del principio de su renglón en el catálogo.' } }, required: ['id'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'buscar_en_fabrica',
    description: 'Busca en el stock de la fábrica por nombre de modelo (por ejemplo "Honolulu" o "Journey"), para prendas que no están en la tienda o talles que se agotaron. Lo de la fábrica lo tiene que confirmar una persona antes de venderse.',
    input_schema: { type: 'object', properties: { texto: { type: 'string', description: 'El nombre del modelo o la prenda.' } }, required: ['texto'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'consultar_pedido',
    description: 'El estado de un pedido de la tienda online. Pide el número de pedido Y el mail con el que se compró; si no coinciden los dos, no devuelve nada.',
    input_schema: { type: 'object', properties: { numero: { type: 'string' }, mail: { type: 'string' } }, required: ['numero', 'mail'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'derivar',
    description: 'Le pasa la charla a una persona del equipo, con un resumen para que no tenga que volver a preguntar. Areas: ventas (dudas de venta, medidas sin guía, factura A, no estás seguro), posventa (cambios, devoluciones, arrepentimiento, cancelación), logistica (pedidos hechos: demoras, seguimiento, errores), fabrica (confirmar stock de fábrica o de un local, tomar un pedido de fábrica), excepcion (descuentos o pedidos fuera de las reglas), mayorista.',
    input_schema: {
      type: 'object',
      properties: {
        area: { type: 'string', enum: [...AREAS] },
        resumen: { type: 'string', description: 'Quién es, qué quiere, qué producto (talle, color) y qué ya se le dijo.' },
      },
      required: ['area', 'resumen'],
      additionalProperties: false,
    },
    strict: true,
  },
];

const A_QUIEN: Record<string, string> = {
  ventas: 'derivar_ventas', posventa: 'derivar_posventa', logistica: 'derivar_logistica',
  fabrica: 'derivar_ventas', excepcion: 'derivar_ventas', mayorista: 'derivar_ventas',
};

/* Un mensaje de WhatsApp como lo ve el agente. */
function comoTexto(m: { tipo?: string; texto?: string | null }): string {
  const t = (m.texto ?? '').trim();
  switch (m.tipo) {
    case 'image': return '[mandó una foto]' + (t ? ' ' + t : '');
    case 'audio': return '[mandó un audio: no lo podés escuchar; pedile que lo escriba]';
    case 'video': return '[mandó un video]' + (t ? ' ' + t : '');
    case 'sticker': return '[mandó un sticker]';
    case 'document': return '[mandó un archivo]' + (t ? ' ' + t : '');
    case 'location': return '[mandó una ubicación]';
    default: return t || '[mensaje sin texto]';
  }
}

/* La charla de WhatsApp, como turnos alternados: el cliente es "user" y
   VDH (el equipo o el agente) es "assistant". */
function turnos(mensajes: { de: string; tipo?: string; texto?: string | null }[]): Anthropic.MessageParam[] {
  const salida: { role: 'user' | 'assistant'; partes: string[] }[] = [];
  for (const m of mensajes) {
    const role = m.de === 'cliente' ? 'user' : 'assistant';
    const ultimo = salida[salida.length - 1];
    if (ultimo && ultimo.role === role) ultimo.partes.push(comoTexto(m));
    else salida.push({ role, partes: [comoTexto(m)] });
  }
  if (salida.length && salida[0].role === 'assistant') {
    salida.unshift({ role: 'user', partes: ['[La charla la empezamos nosotros con el mensaje que sigue.]'] });
  }
  if (!salida.length || salida[salida.length - 1].role === 'assistant') {
    salida.push({ role: 'user', partes: ['[Indicación del equipo de VDH: el cliente no escribió nada nuevo. Redactá un seguimiento breve y amable si corresponde.]'] });
  }
  return salida.map((s) => ({ role: s.role, content: s.partes.join('\n') }));
}

type Borrador = {
  texto: string;
  derivar: { area: string; a: string; resumen: string } | null;
  productos: { id: string; nombre: string; precio: number; link: string; foto?: string }[];
  herramientas: { nombre: string; entrada: unknown }[];
  tokens: { entrada: number; salida: number; cache_leidos: number; cache_escritos: number };
  ms: number;
  modelo: string;
};

/** Redacta la respuesta con Claude, usando las herramientas hasta 8 vueltas. */
async function redactar(ctx: any, mensajes: { de: string; tipo?: string; texto?: string | null }[]): Promise<Borrador> {
  const inicio = Date.now();
  const reglas: Record<string, string> = ctx.reglas ?? {};
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: REGLAS, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: '## Lo que sabés\n\n' + (ctx.conocimiento ?? '') +
        '\n\n## Horario de atención del equipo\n' + horarioEquipo(reglas) + '.', cache_control: { type: 'ephemeral' } },
    { type: 'text', text: '## El catálogo de la tienda, ahora (id · nombre · tipo · precio que se paga · talles y colores con stock)\n' +
        (ctx.catalogo ?? '') + '\n\nAhora es ' + (ctx.hoy ?? '') + ' (hora de Argentina).' +
        (ctx.nombre ? ' El cliente figura como "' + ctx.nombre + '".' : '') },
  ];
  const messages: Anthropic.MessageParam[] = turnos(mensajes);
  const b: Borrador = { texto: '', derivar: null, productos: [], herramientas: [],
                        tokens: { entrada: 0, salida: 0, cache_leidos: 0, cache_escritos: 0 }, ms: 0, modelo: MODELO };

  let controles = 0;
  for (let vuelta = 0; vuelta < 10; vuelta++) {
    // deno-lint-ignore no-explicit-any
    const r: any = await claude.beta.messages.create({
      model: MODELO,
      max_tokens: 4000,
      output_config: { effort: 'medium' },
      system,
      tools: HERRAMIENTAS,
      messages,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    } as any);
    b.modelo = r.model ?? b.modelo;
    b.tokens.entrada += r.usage?.input_tokens ?? 0;
    b.tokens.salida += r.usage?.output_tokens ?? 0;
    b.tokens.cache_leidos += r.usage?.cache_read_input_tokens ?? 0;
    b.tokens.cache_escritos += r.usage?.cache_creation_input_tokens ?? 0;
    if (r.stop_reason === 'refusal') throw new Error('El modelo no quiso contestar esta charla.');

    const usos = (r.content ?? []).filter((x: any) => x.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || !usos.length) {
      b.texto = (r.content ?? []).filter((x: any) => x.type === 'text').map((x: any) => x.text).join('\n').trim();
      /* El control de los links: cada link de producto tiene que haber salido
         de ver_producto en esta misma charla. Si no, se le pide que lo
         corrija (hasta dos veces); un link inventado no llega al cliente. */
      const conocidos = new Set(b.productos.map((p) => String(p.link ?? '').replace(/\/$/, '')));
      const inventados = (b.texto.match(/https?:\/\/(?:www\.)?vdh\.com\.ar\/productos\/[^\s)*_]*/g) ?? [])
        .filter((u) => !conocidos.has(u.replace(/\/$/, '')));
      if (inventados.length && controles < 2) {
        controles++;
        messages.push({ role: 'assistant', content: r.content });
        messages.push({ role: 'user', content: '[Control interno de VDH, el cliente no lo ve: estos links no salieron de ver_producto y pueden no existir: ' +
          inventados.join(' ') + '. Consultá esos productos con ver_producto y corregí el mensaje con sus links, o sacalos. Respondé con el mensaje completo corregido.]' });
        b.texto = '';
        continue;
      }
      if (inventados.length) {
        for (const u of inventados) b.texto = b.texto.split(u).join('vdh.com.ar');
      }
      break;
    }
    messages.push({ role: 'assistant', content: r.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const u of usos) {
      const entrada = u.input ?? {};
      b.herramientas.push({ nombre: u.name, entrada });
      let salida: unknown;
      let error = false;
      try {
        if (u.name === 'ver_producto') {
          salida = await rpc('agente_producto', { p_id: String(entrada.id ?? '') });
          if (salida) {
            const p = salida as any;
            if (!b.productos.some((x) => x.id === String(p.id))) {
              b.productos.push({ id: String(p.id), nombre: p.nombre, precio: Number(p.precio), link: p.link, foto: p.foto });
            }
          } else {
            salida = { error: 'No hay ningún producto con ese id en el catálogo.' };
          }
        } else if (u.name === 'buscar_en_fabrica') {
          salida = await rpc('agente_fabrica', { p_texto: String(entrada.texto ?? '') });
        } else if (u.name === 'consultar_pedido') {
          salida = await rpc('agente_pedido', { p_numero: String(entrada.numero ?? ''), p_mail: String(entrada.mail ?? '') });
        } else if (u.name === 'derivar') {
          const area = AREAS.includes(entrada.area) ? entrada.area : 'ventas';
          const a = reglas[A_QUIEN[area]] || 'el equipo';
          b.derivar = { area, a, resumen: String(entrada.resumen ?? '').slice(0, 1000) };
          salida = { ok: true, queda_para: a, cuando: horarioEquipo(reglas) };
        } else {
          salida = { error: 'Herramienta desconocida.' };
          error = true;
        }
      } catch (e) {
        salida = { error: 'No se pudo consultar: ' + String(e).slice(0, 200) };
        error = true;
      }
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(salida), is_error: error || undefined });
    }
    messages.push({ role: 'user', content: resultados });
  }
  if (!b.texto) throw new Error('El agente no llegó a una respuesta.');
  b.ms = Date.now() - inicio;
  return b;
}

async function guardarBorrador(ctx: any, b: Borrador, origen: 'pedido' | 'auto', quien?: string) {
  return await rpc('agente_borrador_guardar', {
    p: {
      clave: ctx.clave, numero_id: ctx.numero_id, ultimo_id: ctx.ultimo_id, texto: b.texto, derivar: b.derivar,
      productos: b.productos, herramientas: b.herramientas, origen, pedido_por: quien ?? null, modelo: b.modelo,
      tokens: b.tokens, ms: b.ms,
    },
  });
}

/* El CRM pide un borrador para una charla. */
async function pedir(p: { pin?: string; clave?: string; quien?: string }) {
  if (!(await pinValido(p.pin))) return { ok: false, error: 'PIN incorrecto.' };
  let ctx: any;
  try { ctx = await rpc('agente_contexto', { p_clave: String(p.clave ?? '') }); } catch (e) {
    return { ok: false, error: /agente_contexto/.test(String(e)) ? 'Falta correr el SQL 78 en Supabase.' : 'No se pudo leer la charla.' };
  }
  if (!ctx || !ctx.mensajes?.length) return { ok: false, error: 'Esta persona no escribió a nuestro WhatsApp.' };
  try {
    const b = await redactar(ctx, ctx.mensajes);
    const g = await guardarBorrador(ctx, b, 'pedido', p.quien);
    return { ok: true, borrador: { id: g?.id, texto: b.texto, derivar: b.derivar, productos: b.productos, origen: 'pedido',
                                   pedido_por: p.quien ?? null, creado: new Date().toISOString(), viejo: false } };
  } catch (e) {
    console.error('agente: no pudo redactar:', String(e));
    return { ok: false, error: 'El agente no pudo redactar: ' + String(e).slice(0, 160) };
  }
}

/* Entró un mensaje: si le toca, redacta. Espera un poco por si el cliente
   sigue escribiendo; si llegó otro, lo deja para la llamada de ese. */
async function auto(p: { tel?: string; numero_id?: string }) {
  let ctx: any = await rpc('agente_contexto', { p_clave: String(p.tel ?? '') });
  if (!ctx) return;
  const r = ctx.reglas ?? {};
  if (r.prendido !== 'si' || !ctx.ahora?.atiende) return;
  if (String(p.numero_id ?? '') !== String(r.numero_id ?? '')) return;
  const ultimo = ctx.ultimo_entra_id;
  await new Promise((ok) => setTimeout(ok, 25000));
  ctx = await rpc('agente_contexto', { p_clave: String(p.tel ?? '') });
  if (!ctx || ctx.ultimo_entra_id !== ultimo) return;
  const ult = ctx.mensajes[ctx.mensajes.length - 1];
  if (!ult || ult.de !== 'cliente') return;
  const b = await redactar(ctx, ctx.mensajes);
  await guardarBorrador(ctx, b, 'auto');
}

/* Las pruebas: una charla inventada, con todo lo de verdad (catálogo,
   stock, lo que sabe). No guarda nada. */
async function probar(p: { llave?: string; conversacion?: { de: string; texto: string }[] }) {
  if (!(await rpc('agente_llave_ok', { p_llave: String(p.llave ?? '') }))) return { ok: false, error: 'Llave incorrecta.' };
  const ctx = await rpc('agente_contexto', { p_clave: '1100000000' });
  const conv = (p.conversacion ?? []).slice(-30).map((m) => ({ de: m.de === 'vdh' ? 'vdh' : 'cliente', tipo: 'text', texto: String(m.texto ?? '') }));
  if (!conv.length) return { ok: false, error: 'Falta la charla.' };
  ctx.nombre = null;
  const b = await redactar(ctx, conv);
  return { ok: true, borrador: b };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Sólo POST.' }, 405);
  let p: any = {};
  try { p = await req.json(); } catch { /* vacío */ }
  try {
    switch (p.accion) {
      case 'pedir': return json(await pedir(p));
      case 'probar': return json(await probar(p));
      case 'auto': {
        if (!SERVICIO || req.headers.get('x-agente') !== SERVICIO) return json({ ok: false }, 401);
        const tarea = auto(p).catch((e) => console.error('agente auto:', String(e)));
        // deno-lint-ignore no-explicit-any
        (globalThis as any).EdgeRuntime?.waitUntil?.(tarea);
        return json({ ok: true });
      }
    }
  } catch (e) {
    console.error('agente:', String(e));
    return json({ ok: false, error: 'Algo falló: ' + String(e).slice(0, 160) });
  }
  return json({ ok: false, error: 'accion desconocida' }, 400);
});
