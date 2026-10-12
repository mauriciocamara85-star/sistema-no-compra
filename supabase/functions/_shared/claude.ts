/**
 * VDH · Lo que comparten los dos agentes (12/10/2026): los modelos que se
 * pueden elegir con lo que cuestan, la cuenta de lo que costó una
 * respuesta, las instrucciones armadas (las editables + las barandillas +
 * lo que no se puede sacar) y el juez de las pruebas.
 */
import Anthropic from 'npm:@anthropic-ai/sdk';

export const MODELOS = ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'];
export const MODELO_JUEZ = 'claude-haiku-5-5';

/* Dólares por millón de tokens: entrada, salida, caché leída y caché
   escrita (1,25 × la entrada). Haiku 5.5 cuesta 5 veces más por encima de
   100.000 tokens de entrada. */
export const PRECIOS: Record<string, { e: number; s: number; cl: number; ce: number }> = {
  'claude-sonnet-5-5': { e: 2, s: 10, cl: 0.2, ce: 2.5 },
  'claude-opus-5-5': { e: 4, s: 20, cl: 0.2, ce: 5 },
  'claude-haiku-5-5': { e: 0.1, s: 0.5, cl: 0.01, ce: 0.125 },
};

export function modeloValido(m: unknown): string {
  return MODELOS.includes(String(m)) ? String(m) : 'claude-sonnet-5-5';
}

/** Lo que costó una llamada, con el modelo que contestó de verdad. */
export function costo(modelo: string, u: any): number {
  const p = PRECIOS[modelo] ?? PRECIOS[MODELOS.find((m) => String(modelo).startsWith(m)) ?? 'claude-sonnet-5-5'];
  const e = u?.input_tokens ?? 0, s = u?.output_tokens ?? 0, cl = u?.cache_read_input_tokens ?? 0, ce = u?.cache_creation_input_tokens ?? 0;
  const x = String(modelo).startsWith('claude-haiku') && e + cl + ce > 100000 ? 5 : 1;
  return Math.round(((e * p.e + s * p.s + cl * p.cl + ce * p.ce) * x) / 1e6 * 1e5) / 1e5;
}

/** Las instrucciones: las partes editables (o las de fábrica si la base
 *  todavía no las tiene), las barandillas y, al final, lo que no se puede
 *  sacar desde el CRM. */
export function instrucciones(
  partes: { seccion: string; texto: string }[] | null | undefined,
  deFabrica: string,
  barandillas: { prohibidos?: string[]; derivar?: string[] } | null | undefined,
  titulos: { prohibidos: string; derivar: string },
  nucleo: string,
): string {
  const base = Array.isArray(partes) && partes.length ? partes.map((p) => String(p.texto ?? '').trim()).filter(Boolean).join('\n\n') : deFabrica;
  const lista = (t: string, l?: string[]) => (Array.isArray(l) && l.length ? '\n\n' + t + '\n' + l.map((x) => '- ' + String(x).trim()).join('\n') : '');
  return base + lista(titulos.prohibidos, barandillas?.prohibidos) + lista(titulos.derivar, barandillas?.derivar) + '\n\n' + nucleo;
}

/** El juez de una prueba: ¿la respuesta cumple con lo que tiene que pasar?
 *  Barato (Haiku) y con la respuesta en JSON. */
export async function juzgar(claude: Anthropic, x: {
  criterio: string; conversacion: { de: string; texto: string }[]; respuesta: string;
  derivar?: { area?: string; a?: string; resumen?: string } | null; herramientas?: { nombre: string }[]; fuentes?: { titulo: string }[];
}): Promise<{ ok: boolean; porque: string; usd: number }> {
  const charla = x.conversacion.map((m) => (m.de === 'vdh' ? 'VDH' : m.de === 'vendedor' ? 'Vendedor' : 'Cliente') + ': ' + m.texto).join('\n');
  const r: any = await claude.messages.create({
    model: MODELO_JUEZ,
    max_tokens: 700,
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: { type: 'object', properties: { ok: { type: 'boolean' }, porque: { type: 'string' } },
                                               required: ['ok', 'porque'], additionalProperties: false } },
    },
    system: 'Sos el evaluador de un agente de atención de VDH (una marca de ropa). Te dan una charla, lo que contestó el agente y un criterio. ' +
      'Decí si la respuesta CUMPLE el criterio. Sé estricto con lo que el criterio pide y no le pidas cosas que el criterio no dice. ' +
      '"porque": una oración en castellano rioplatense, concreta (qué hizo bien o qué le faltó).',
    messages: [{ role: 'user', content:
      'La charla:\n' + charla + '\n\nLo que contestó el agente:\n' + x.respuesta +
      '\n\nLe pasó la charla a una persona: ' + (x.derivar ? 'sí (' + (x.derivar.area ?? '') + ', a ' + (x.derivar.a ?? '') + ')' : 'no') +
      (x.herramientas?.length ? '\nConsultó: ' + x.herramientas.map((h) => h.nombre).join(', ') : '') +
      (x.fuentes?.length ? '\nCitó: ' + x.fuentes.map((f) => f.titulo).join(', ') : '') +
      '\n\nEl criterio: ' + x.criterio }],
  } as any);
  const t = (r.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  let j: any = null;
  try { j = JSON.parse(t); } catch { /* abajo */ }
  if (!j || typeof j.ok !== 'boolean') throw new Error('El juez no contestó bien.');
  return { ok: j.ok, porque: String(j.porque ?? '').slice(0, 500), usd: costo(String(r.model ?? MODELO_JUEZ), r.usage) };
}
