/**
 * VDH · Agente de IA, el de clientes (fase 2, 12/10/2026; etapa C de los
 * dos agentes, 12/10/2026 a la noche)
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
 *        con la llave de servicio cuando entra un mensaje. La base decide si
 *        le toca (agente_puede: prendido, el número de la tienda, fuera del
 *        horario del equipo, sin pausa y sin una persona que haya contestado
 *        hace poco). En prueba deja un borrador; en automático lo manda.
 *   POST {accion: 'probar', llave, conversacion} Las pruebas: no guarda nada.
 *   POST {accion: 'probar_chat', pin, conversacion} El chat de prueba del CRM
 *        (Agentes de IA → Probar): no guarda nada y no le llega a nadie.
 *   POST {accion: 'prueba', pin, id} Corre una prueba guardada y la juzga.
 *
 * El modelo y el tope de gasto del mes se eligen en el CRM (Ajustes); al
 * llegar al tope no redacta más. Lo que sabe son las fuentes "para
 * clientes" prendidas (las arma la base: lo interno no llega nunca) y van
 * como documentos con citas, así el CRM muestra de dónde sacó cada cosa.
 * Las instrucciones y las barandillas se editan en el CRM; lo de no
 * inventar y lo de los links está acá y no se puede sacar.
 *
 * La clave de Claude es el secret ANTHROPIC_API_KEY (la pegó Mauricio).
 * Se despliega con --no-verify-jwt: cada acción se autoriza adentro.
 */
import Anthropic from 'npm:@anthropic-ai/sdk';
import { costo, instrucciones, juzgar, modeloValido } from '../_shared/claude.ts';

const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
/* Lo que espera antes de contestar, por si el cliente sigue escribiendo
   (en las pruebas se acorta). */
const ESPERA = Number(Deno.env.get('AGENTE_ESPERA_MS') ?? '25000');
/* Revisión final (12/10/2026): el control de descuentos (ofreceAlgo) deja
   pasar ofertas dichas de otra forma. Hasta revisarlo, SÓLO borradores,
   diga lo que diga la base (que además no deja elegir "auto", SQL 89). */
const SOLO_BORRADOR = true;
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

async function pinValido(pin: unknown): Promise<boolean> {
  try { return !!(await rpc('pin_ok', { p_pin: String(pin ?? '') }))?.ok; } catch { return false; }
}

/* ═══ Lo que se le dice al agente ════════════════════════════════════════
   REGLAS es lo de fábrica: vale mientras la base no tenga las
   instrucciones (antes del SQL 87). Desde ahí se editan por partes en el
   CRM. NUCLEO va siempre, al final, y no se puede sacar. */
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

const NUCLEO = 'Lo que nunca cambia: nunca inventes un dato (un precio, un stock, un plazo, una promo, una tela). Los links de productos salen ' +
  'SÓLO de ver_producto. No ofrezcas descuentos, cupones ni envíos gratis que no estén en estas reglas. Si el cliente pide hablar con una persona, ' +
  'derivá en ese mismo mensaje.';
const TITULOS = { prohibidos: 'Temas en los que no entrás (si te los piden, decí que eso no lo podés dar y derivá si hace falta):',
                  derivar: 'Le pasás la charla a una persona (herramienta derivar) siempre que:' };

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
  fuentes: { n: number; id: number; titulo: string; citas: string[] }[];
  tokens: { entrada: number; salida: number; cache_leidos: number; cache_escritos: number };
  usd: number;
  ms: number;
  modelo: string;
};

/** Lo que sabe, como documentos con las citas prendidas (la caché va en el
 *  último). Son sólo las fuentes "para clientes" prendidas: las elige la
 *  base (agente_contexto). */
function documentos(fuentes: any[]): any[] {
  const docs = fuentes.map((f) => ({
    type: 'document',
    source: { type: 'text', media_type: 'text/plain',
              data: f.tipo === 'pregunta' ? 'Pregunta: ' + f.titulo + '\nRespuesta: ' + f.contenido : String(f.contenido) },
    title: String(f.titulo).slice(0, 200),
    context: 'Tema: ' + (f.tema || 'general'),
    citations: { enabled: true },
  }));
  if (docs.length) (docs[docs.length - 1] as any).cache_control = { type: 'ephemeral' };
  return docs;
}

/* El control de los topes (etapa D). El agente todavía no tiene cupones:
   llegan con la app de cupones de Tienda Nube (fase 3). Hasta entonces el
   tope de verdad es cero: si ofrece un cupón, un descuento que no es el SALE
   ni el de la transferencia, la segunda prenda con descuento o un envío de
   regalo, se le pide corregir; si insiste, no sale y se pasa la charla. Lo
   que dice que NO hace ("no te puedo hacer un 30 %") no cuenta. */
function ofreceAlgo(texto: string): string | null {
  const t = ' ' + String(texto ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ') + ' ';
  const sinNo = (re: RegExp) => {
    for (const m of t.matchAll(re)) {
      const antes = t.slice(Math.max(0, (m.index ?? 0) - 16), m.index ?? 0);
      if (!/\b(?:no|nunca|ni)\b/.test(antes)) return true;
    }
    return false;
  };
  if (sinNo(/\b(?:te|le) (?:paso|doy|dejo|mando|genero|armo|regalo) (?:un |el |este |tu )?(?:cupon|codigo)/g)) return 'un cupón';
  if (sinNo(/\b(?:usa|aplica|ingresa|pone)(?:lo|la)? (?:el )?(?:cupon|codigo) [a-z0-9]{4,}/g)) return 'un cupón';
  if (sinNo(/\b(?:te|le) (?:hago|dejo|doy|puedo hacer|puedo dar|puedo dejar|bonifico|aplico|regalo) (?:un |el |una )?(?:descuento (?:del? )?)?\d{1,2} ?%/g)) return 'un descuento';
  if (sinNo(/\d{1,2} ?% (?:de descuento )?(?:de regalo|extra|adicional|especial)/g)) return 'un descuento';
  if (sinNo(/\bsegunda(?: prenda| unidad)? (?:al|con(?: un)?|a) \d{1,2} ?%/g)) return 'un descuento en la segunda prenda';
  if (sinNo(/\b(?:te|le) (?:regalo|bonifico|cubro|pago) el envio/g) || sinNo(/\benvio (?:gratis )?de regalo/g)) return 'un envío gratis';
  return null;
}

/** Redacta la respuesta con Claude, usando las herramientas hasta 10 vueltas.
 *  Arriba, lo que no cambia (las instrucciones y el horario, y el
 *  catálogo, que cambia cada hora): se cachea. Lo que sabe va en el primer
 *  mensaje (también se cachea) y lo de esta charla (la hora, el nombre),
 *  después. */
async function redactar(ctx: any, mensajes: { de: string; tipo?: string; texto?: string | null }[]): Promise<Borrador> {
  const inicio = Date.now();
  const reglas: Record<string, string> = ctx.reglas ?? {};
  const modelo = modeloValido(reglas.modelo);
  const fuentes: any[] = Array.isArray(ctx.fuentes) ? ctx.fuentes : [];
  const conDocs = fuentes.length > 0;
  const system: any[] = [
    { type: 'text', text: instrucciones(ctx.instrucciones, REGLAS, ctx.barandillas, TITULOS, NUCLEO) +
        '\n\n## Horario de atención del equipo\n' + horarioEquipo(reglas) + '.' +
        (conDocs ? '\n\nLo que sabés (envíos, pagos, cambios, talles, telas, locales y políticas) está en los documentos del principio de la charla.'
                 : '\n\n## Lo que sabés\n\n' + (ctx.conocimiento ?? '')),
      cache_control: { type: 'ephemeral' } },
    { type: 'text', text: '## El catálogo de la tienda, ahora (id · nombre · tipo · precio que se paga · talles y colores con stock)\n' + (ctx.catalogo ?? ''),
      cache_control: { type: 'ephemeral' } },
  ];
  const messages: any[] = turnos(mensajes);
  const datos = '[Datos de esta charla, el cliente no los ve: ahora es ' + (ctx.hoy ?? '') + ' (hora de Argentina).' +
    (ctx.nombre ? ' El cliente figura como "' + ctx.nombre + '".' : '') + ']';
  messages[0] = { role: 'user', content: [...(conDocs ? documentos(fuentes) : []), { type: 'text', text: datos }, { type: 'text', text: String(messages[0].content) }] };
  const b: Borrador = { texto: '', derivar: null, productos: [], herramientas: [], fuentes: [],
                        tokens: { entrada: 0, salida: 0, cache_leidos: 0, cache_escritos: 0 }, usd: 0, ms: 0, modelo };

  let controles = 0, topes = 0;
  for (let vuelta = 0; vuelta < 10; vuelta++) {
    const pedido: any = { model: modelo, max_tokens: 4000, output_config: { effort: 'medium' }, system, tools: HERRAMIENTAS, messages };
    /* Si el modelo está saturado, que conteste otro parecido (Haiku no tiene). */
    // deno-lint-ignore no-explicit-any
    const r: any = modelo === 'claude-haiku-5-5'
      ? await claude.messages.create(pedido)
      : await claude.beta.messages.create({ ...pedido, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as any);
    b.modelo = r.model ?? b.modelo;
    b.tokens.entrada += r.usage?.input_tokens ?? 0;
    b.tokens.salida += r.usage?.output_tokens ?? 0;
    b.tokens.cache_leidos += r.usage?.cache_read_input_tokens ?? 0;
    b.tokens.cache_escritos += r.usage?.cache_creation_input_tokens ?? 0;
    b.usd += costo(String(r.model ?? modelo), r.usage);
    if (r.stop_reason === 'refusal') throw new Error('El modelo no quiso contestar esta charla.');

    const usos = (r.content ?? []).filter((x: any) => x.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || !usos.length) {
      const textos = (r.content ?? []).filter((x: any) => x.type === 'text');
      /* Con citas, el texto llega partido en pedazos: van pegados. */
      const conCitas = textos.some((x: any) => (x.citations ?? []).length);
      b.texto = textos.map((x: any) => x.text).join(conCitas ? '' : '\n').trim();
      /* De qué fuentes sacó lo que dice (para el CRM; el cliente no las ve). */
      const orden: number[] = [];
      const citas = new Map<number, string[]>();
      for (const t of textos) {
        for (const c of t.citations ?? []) {
          const di = Number(c?.document_index);
          if (!Number.isInteger(di) || !fuentes[di]) continue;
          if (!citas.has(di)) { orden.push(di); citas.set(di, []); }
          const l = citas.get(di)!, ct = String(c.cited_text ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
          if (ct && !l.includes(ct) && l.length < 3) l.push(ct);
        }
      }
      b.fuentes = orden.map((di, k) => ({ n: k + 1, id: Number(fuentes[di].id), titulo: fuentes[di].titulo, citas: citas.get(di) ?? [] }));
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
      const ofrece = ofreceAlgo(b.texto);
      if (ofrece && topes < 2) {
        topes++;
        messages.push({ role: 'assistant', content: r.content });
        messages.push({ role: 'user', content: '[Control interno de VDH, el cliente no lo ve: no podés ofrecer ' + ofrece + '. Hoy sólo existen el SALE ' +
          '(ya está en el precio), el 10 % con transferencia y las cuotas. Si el cliente pide un descuento o una excepción, decile que lo consultás ' +
          'y derivá con area "excepcion" en este mismo mensaje. Respondé con el mensaje completo corregido.]' });
        b.texto = '';
        continue;
      }
      if (ofrece) {
        b.texto = 'Eso lo tiene que ver una persona del equipo: ya le paso tu consulta y te escriben en el horario de atención.';
        b.fuentes = [];
        if (!b.derivar) {
          b.derivar = { area: 'excepcion', a: reglas[A_QUIEN.excepcion] || 'el equipo',
                        resumen: 'El cliente pidió un descuento o una excepción y el agente no la puede dar (lo frenó el control de los topes).' };
        }
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
  b.usd = Math.round(b.usd * 1e5) / 1e5;
  b.ms = Date.now() - inicio;
  return b;
}

/* El tope de gasto del mes (SQL 87): sin plata, no redacta. */
function sinPlata(ctx: any): boolean {
  const g = ctx?.gasto;
  return !!g && Number(g.usd ?? 0) >= Number(g.tope ?? 20);
}
async function sumarGasto(usd: number) {
  await rpc('agente_gasto_sumar', { p_agente: 'clientes', p_usd: usd }).catch((e) => console.error('agente: gasto:', String(e)));
}
const TOPE_MSJ = 'El agente llegó al tope de gasto del mes: se sube en Agentes de IA → Ajustes.';

async function guardarBorrador(ctx: any, b: Borrador, origen: 'pedido' | 'auto', quien?: string, estado?: 'enviado') {
  return await rpc('agente_borrador_guardar', {
    p: {
      clave: ctx.clave, numero_id: ctx.numero_id, ultimo_id: ctx.ultimo_id, texto: b.texto, derivar: b.derivar,
      productos: b.productos, herramientas: b.herramientas, origen, pedido_por: quien ?? null, modelo: b.modelo,
      tokens: b.tokens, ms: b.ms, estado: estado ?? null,
    },
  });
}

/* En automático, la respuesta sale por la función whatsapp (que tiene el
   token de Meta), con la llave de servicio. */
async function enviarWhatsApp(clave: string, texto: string): Promise<any> {
  try {
    const r = await fetch(URL_BASE + '/functions/v1/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICIO, Authorization: 'Bearer ' + SERVICIO, 'x-agente': SERVICIO },
      body: JSON.stringify({ accion: 'enviar_agente', clave, texto }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/* El CRM pide un borrador para una charla. */
async function pedir(p: { pin?: string; clave?: string; quien?: string }) {
  if (!(await pinValido(p.pin))) return { ok: false, error: 'PIN incorrecto.' };
  let ctx: any;
  try { ctx = await rpc('agente_contexto', { p_clave: String(p.clave ?? '') }); } catch (e) {
    return { ok: false, error: /agente_contexto/.test(String(e)) ? 'Falta correr el SQL 78 en Supabase.' : 'No se pudo leer la charla.' };
  }
  if (!ctx || !ctx.mensajes?.length) return { ok: false, error: 'Esta persona no escribió a nuestro WhatsApp.' };
  if (sinPlata(ctx)) return { ok: false, error: TOPE_MSJ };
  try {
    const b = await redactar(ctx, ctx.mensajes);
    await sumarGasto(b.usd);
    const g = await guardarBorrador(ctx, b, 'pedido', p.quien);
    return { ok: true, borrador: { id: g?.id, texto: b.texto, derivar: b.derivar, productos: b.productos, origen: 'pedido',
                                   pedido_por: p.quien ?? null, creado: new Date().toISOString(), viejo: false } };
  } catch (e) {
    console.error('agente: no pudo redactar:', String(e));
    return { ok: false, error: 'El agente no pudo redactar: ' + String(e).slice(0, 160) };
  }
}

/* Entró un mensaje (lo avisa la función whatsapp). La base decide si le
   toca (agente_puede, SQL 88). Espera un poco por si el cliente sigue
   escribiendo; si llegó otro, lo deja para la llamada de ese. En prueba
   deja el borrador para que una persona lo apruebe. En automático lo
   manda, mirando antes una última vez que nadie haya contestado ni el
   cliente haya escrito mientras redactaba; si le pasó la charla a una
   persona, se pausa en esa charla y avisa por Telegram. */
async function auto(p: { tel?: string; numero_id?: string }) {
  const tel = String(p.tel ?? ''), numeroId = String(p.numero_id ?? '');
  const toca = (c: any) => !!c && String(c.reglas?.numero_id ?? '') === numeroId &&
    (c.puede ? !!c.puede.puede : (c.reglas?.prendido === 'si' && !!c.ahora?.atiende));
  let ctx: any = await rpc('agente_contexto', { p_clave: tel });
  if (!toca(ctx)) return;
  const ultimo = ctx.ultimo_entra_id;
  await new Promise((ok) => setTimeout(ok, ESPERA));
  ctx = await rpc('agente_contexto', { p_clave: tel });
  if (!toca(ctx) || ctx.ultimo_entra_id !== ultimo) return;
  const ult = ctx.mensajes[ctx.mensajes.length - 1];
  if (!ult || ult.de !== 'cliente') return;
  if (sinPlata(ctx)) return;
  const b = await redactar(ctx, ctx.mensajes);
  await sumarGasto(b.usd);
  /* Sin el SQL 88 (no hay "puede") nunca manda solo: sólo borradores. */
  if (SOLO_BORRADOR || ctx.reglas?.modo !== 'auto' || !ctx.puede) {
    await guardarBorrador(ctx, b, 'auto');
    return;
  }
  const ahora: any = await rpc('agente_contexto', { p_clave: tel });
  if (!toca(ahora) || ahora.ultimo_entra_id !== ultimo || ahora.reglas?.modo !== 'auto') {
    await guardarBorrador(ctx, b, 'auto');
    return;
  }
  const env = await enviarWhatsApp(ctx.clave, b.texto);
  if (!env?.ok) {
    console.error('agente: no se pudo mandar:', String(env?.error ?? ''));
    await guardarBorrador(ctx, b, 'auto');
    return;
  }
  await guardarBorrador(ctx, b, 'auto', undefined, 'enviado');
  if (b.derivar) {
    await rpc('agente_pausar_derivada', { p_clave: ctx.clave, p_resumen: b.derivar.resumen }).catch((e) => console.error('agente: pausa:', String(e)));
    await rpc('agente_avisar_derivacion', { p_clave: ctx.clave, p_a: b.derivar.a, p_area: b.derivar.area, p_resumen: b.derivar.resumen })
      .catch((e) => console.error('agente: aviso:', String(e)));
  }
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
  await sumarGasto(b.usd);
  return { ok: true, borrador: b };
}

/* El chat de prueba del CRM: la charla la arma el CRM (lo que escribió quien
   prueba y lo que fue contestando el agente). No guarda nada. */
async function probarChat(p: any) {
  if (!(await pinValido(p.pin))) return { ok: false, error: 'PIN incorrecto.', pin: true };
  const conv = (Array.isArray(p.conversacion) ? p.conversacion : []).slice(-30)
    .map((m: any) => ({ de: m?.de === 'vdh' ? 'vdh' : 'cliente', tipo: 'text', texto: String(m?.texto ?? '').slice(0, 2000) }))
    .filter((m: any) => m.texto.trim());
  if (!conv.length || conv[conv.length - 1].de !== 'cliente') return { ok: false, error: 'Falta el mensaje del cliente.' };
  let ctx: any;
  try { ctx = await rpc('agente_contexto', { p_clave: '1100000000' }); } catch { return { ok: false, error: 'No se pudo leer la base.' }; }
  if (sinPlata(ctx)) return { ok: false, error: TOPE_MSJ };
  ctx.nombre = null;
  try {
    const b = await redactar(ctx, conv);
    await sumarGasto(b.usd);
    return { ok: true, borrador: { texto: b.texto, derivar: b.derivar, productos: b.productos, herramientas: b.herramientas,
                                   fuentes: b.fuentes, uso: { modelo: b.modelo, usd: b.usd, ms: b.ms } } };
  } catch (e) {
    console.error('agente probar_chat:', String(e));
    return { ok: false, error: 'El agente no pudo contestar: ' + String(e).slice(0, 160) };
  }
}

/* Una prueba guardada: la charla, la respuesta y el juez. Anota cómo le fue. */
async function prueba(p: any) {
  if (!(await pinValido(p.pin))) return { ok: false, error: 'PIN incorrecto.', pin: true };
  const t = await rpc('agente_prueba_leer', { p_id: Number(p.id) || 0 });
  if (!t || t.agente !== 'clientes') return { ok: false, error: 'Esa prueba ya no está.' };
  const ctx = await rpc('agente_contexto', { p_clave: '1100000000' });
  if (sinPlata(ctx)) return { ok: false, error: TOPE_MSJ };
  ctx.nombre = null;
  const conv = (t.conversacion ?? []).map((m: any) => ({ de: m.de === 'vdh' ? 'vdh' : 'cliente', tipo: 'text', texto: String(m.texto ?? '') }));
  let b: Borrador, j: { ok: boolean; porque: string; usd: number };
  try {
    b = await redactar(ctx, conv);
    j = await juzgar(claude, { criterio: t.criterio, conversacion: t.conversacion, respuesta: b.texto, derivar: b.derivar,
                               herramientas: b.herramientas, fuentes: b.fuentes });
  } catch (e) {
    console.error('agente prueba:', String(e));
    return { ok: false, error: 'No se pudo correr: ' + String(e).slice(0, 160) };
  }
  const usd = Math.round((b.usd + j.usd) * 1e5) / 1e5;
  await sumarGasto(usd);
  const ultimo = { ok: j.ok, porque: j.porque, respuesta: b.texto, derivar: b.derivar, herramientas: b.herramientas.map((h) => h.nombre),
                   productos: b.productos.map((x) => x.nombre), fuentes: b.fuentes, modelo: b.modelo, usd, ms: b.ms };
  await rpc('agente_prueba_anotar', { p_id: t.id, p_ultimo: ultimo });
  return { ok: true, resultado: ultimo };
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
      case 'probar_chat': return json(await probarChat(p));
      case 'prueba': return json(await prueba(p));
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
