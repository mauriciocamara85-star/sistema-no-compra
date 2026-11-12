/**
 * Sistema VDH · Armar un mail y entregárselo a la casilla (12/11/2026).
 *
 * El mail sale por la casilla del sistema (hoy, la de Gmail de VDH) hablándole a su servidor de salida (SMTP) por el
 * puerto 465, que va cifrado desde el primer byte. Supabase no deja salir por el 25 ni por el 587.
 *
 * Los secretos de la función (se cargan una vez, con `supabase secrets set`):
 *   MAIL_USUARIO   la casilla que entra al servidor                   (marketingvdh@gmail.com)
 *   MAIL_CLAVE     su «contraseña de aplicación» (NO la de la cuenta)
 *   MAIL_DESDE     de parte de quién llega; si falta, «VDH <MAIL_USUARIO>»
 *   MAIL_SERVIDOR  el servidor de salida; si falta, smtp.gmail.com
 *   MAIL_PUERTO    si falta, 465
 * Para pasar a otra casilla (una propia, tipo facturas@vdh.com.ar con un servicio de mails) se cambian estos secretos:
 * el código queda igual.
 *
 * Es un cliente mínimo, a propósito: un solo destinatario, con usuario y clave, y nada más.
 */

export class MailError extends Error {
  codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
  }
}

export type Casilla = { servidor: string; puerto: number; usuario: string; clave: string; desde: string; direccion: string };

/** «VDH <ventas@x.com>» → ventas@x.com */
function direccionDe(s: string): string {
  const m = /<([^<>\s]+@[^<>\s]+)>/.exec(s);
  return (m ? m[1] : s).trim().toLowerCase();
}

/** La casilla, de los secretos. Sin usuario o sin clave, no hay casilla. */
export function casilla(): Casilla {
  const usuario = (Deno.env.get('MAIL_USUARIO') ?? '').trim();
  /* Google muestra la contraseña de aplicación de a cuatro letras con espacios: van sin los espacios. */
  const clave = (Deno.env.get('MAIL_CLAVE') ?? '').replace(/\s+/g, '');
  if (!usuario || !clave) throw new MailError('sin_casilla', 'Todavía no está conectada la casilla de mails del sistema.');
  const desde = (Deno.env.get('MAIL_DESDE') ?? '').trim() || 'VDH <' + usuario + '>';
  const puerto = Number((Deno.env.get('MAIL_PUERTO') ?? '').trim() || 465);
  return {
    servidor: (Deno.env.get('MAIL_SERVIDOR') ?? '').trim() || 'smtp.gmail.com',
    puerto: Number.isInteger(puerto) && puerto > 0 ? puerto : 465,
    usuario, clave, desde, direccion: direccionDe(desde),
  };
}

/* ── El mensaje ─────────────────────────────────────────────────────────── */

const codificar = new TextEncoder();

/** Los bytes en base64, en renglones de 76 (lo que pide el formato de los mails). */
export function base64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return (btoa(bin).match(/.{1,76}/g) ?? []).join('\r\n');
}

/** Un texto de cabecera (el asunto, el nombre): si tiene acentos, va en UTF-8 y en tramos cortos. */
export function cabecera(s: string): string {
  const v = s.replace(/[\r\n]+/g, ' ').trim();
  // deno-lint-ignore no-control-regex
  if (/^[\x20-\x7e]*$/.test(v)) return v;
  const tramos: string[] = [];
  let actual = '';
  for (const ch of v) {   // de a letras enteras: un acento no se parte al medio
    if (codificar.encode(actual + ch).length > 45) { tramos.push(actual); actual = ''; }
    actual += ch;
  }
  if (actual) tramos.push(actual);
  return tramos.map((t) => '=?UTF-8?B?' + btoa(String.fromCharCode(...codificar.encode(t))) + '?=').join('\r\n ');
}

/** «VDH <x@y.com>» con el nombre listo para la cabecera. */
function conNombre(s: string): string {
  const m = /^\s*(.*?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/.exec(s);
  if (!m || !m[1]) return direccionDe(s);
  const nombre = m[1].replace(/^"|"$/g, '');
  // deno-lint-ignore no-control-regex
  return (/^[\x20-\x7e]*$/.test(nombre) ? '"' + nombre.replace(/["\\]/g, '') + '"' : cabecera(nombre)) + ' <' + m[2].toLowerCase() + '>';
}

export type Adjunto = { nombre: string; tipo: string; bytes: Uint8Array };
export type Mensaje = { desde: string; para: string; asunto: string; texto: string; html: string; adjuntos?: Adjunto[]; responderA?: string };

/** El mail entero, como viaja: las cabeceras, el texto (liso y con formato) y los adjuntos. */
export function armarMensaje(m: Mensaje): Uint8Array {
  const marca = () => 'vdh-' + crypto.randomUUID().replace(/-/g, '');
  const mixto = marca(), alterno = marca();
  const parte = (tipo: string, cuerpo: string) =>
    'Content-Type: ' + tipo + '; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + base64(codificar.encode(cuerpo)) + '\r\n';
  const r: string[] = [
    'From: ' + conNombre(m.desde),
    'To: ' + direccionDe(m.para),
    ...(m.responderA ? ['Reply-To: ' + conNombre(m.responderA)] : []),
    'Subject: ' + cabecera(m.asunto),
    'Date: ' + new Date().toUTCString().replace('GMT', '+0000'),
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' + mixto + '"',
    '',
    '--' + mixto,
    'Content-Type: multipart/alternative; boundary="' + alterno + '"',
    '',
    '--' + alterno,
    parte('text/plain', m.texto),
    '--' + alterno,
    parte('text/html', m.html),
    '--' + alterno + '--',
    '',
  ];
  for (const a of (m.adjuntos ?? [])) {
    const nombre = a.nombre.replace(/["\\\r\n]/g, '');
    // deno-lint-ignore no-control-regex
    const liso = /^[\x20-\x7e]*$/.test(nombre);
    const enUtf8 = "UTF-8''" + encodeURIComponent(nombre);
    r.push(
      '--' + mixto,
      'Content-Type: ' + a.tipo + '; ' + (liso ? 'name="' + nombre + '"' : 'name*=' + enUtf8),
      'Content-Disposition: attachment; ' + (liso ? 'filename="' + nombre + '"' : 'filename*=' + enUtf8),
      'Content-Transfer-Encoding: base64',
      '',
      base64(a.bytes),
      '',
    );
  }
  r.push('--' + mixto + '--', '');
  return codificar.encode(r.join('\r\n'));
}

/* ── La entrega ─────────────────────────────────────────────────────────── */

/** Lo que contesta el servidor: el código y el texto (puede venir en varios renglones: «250-…», «250 …»). */
type Respuesta = { codigo: number; texto: string };

class Conversacion {
  private resto = '';
  private leer = new Uint8Array(4096);
  private deco = new TextDecoder();
  constructor(private con: Deno.Conn) {}

  async respuesta(): Promise<Respuesta> {
    const renglones: string[] = [];
    for (;;) {
      let fin = this.resto.indexOf('\n');
      while (fin < 0) {
        const n = await this.con.read(this.leer);
        if (n === null) throw new MailError('servidor', 'El servidor de mails cortó la comunicación.');
        this.resto += this.deco.decode(this.leer.subarray(0, n), { stream: true });
        fin = this.resto.indexOf('\n');
      }
      const renglon = this.resto.slice(0, fin).replace(/\r$/, '');
      this.resto = this.resto.slice(fin + 1);
      renglones.push(renglon.slice(4));
      if (!/^\d{3}-/.test(renglon)) {
        const codigo = Number(renglon.slice(0, 3));
        if (!Number.isInteger(codigo)) throw new MailError('servidor', 'El servidor de mails contestó algo que no se entiende.');
        return { codigo, texto: renglones.join(' ').trim() };
      }
    }
  }

  async escribir(bytes: Uint8Array): Promise<void> {
    let i = 0;
    while (i < bytes.length) i += await this.con.write(bytes.subarray(i));
  }

  /** Manda una orden y espera que conteste con uno de los códigos buenos. */
  async orden(texto: string, buenos: number[], que: (r: Respuesta) => MailError): Promise<Respuesta> {
    await this.escribir(codificar.encode(texto + '\r\n'));
    const r = await this.respuesta();
    if (!buenos.includes(r.codigo)) throw que(r);
    return r;
  }
}

/** Lo que dijo el servidor, en criollo. */
function porque(r: Respuesta, paso: 'entrar' | 'destino' | 'mandar'): MailError {
  const t = r.texto;
  if (paso === 'entrar') {
    return new MailError('clave', 'La casilla de mails no aceptó la clave del sistema: hay que cargarla de nuevo.');
  }
  if (/5\.4\.5|sending limit|limit exceeded|too many/i.test(t)) {
    return new MailError('tope', 'La casilla llegó al tope de mails de hoy. Mañana se puede de nuevo.');
  }
  if (paso === 'destino') {
    return new MailError('direccion', 'El servidor de mails no aceptó esa dirección: fijate si está bien escrita.');
  }
  return new MailError('servidor', 'El servidor de mails no aceptó el mensaje (' + r.codigo + ').');
}

/**
 * Le entrega el mensaje a la casilla, para un solo destinatario. Si vuelve sin error, la casilla lo aceptó (si la
 * dirección no existe, el aviso de rebote llega después a la bandeja de la casilla).
 */
export async function entregar(c: Casilla, para: string, mensaje: Uint8Array, esperaMs = 30_000): Promise<void> {
  let con: Deno.Conn | null = null;
  let vencio = false;
  const reloj = setTimeout(() => {
    vencio = true;
    try { con?.close(); } catch { /* ya estaba cerrada */ }
  }, esperaMs);
  try {
    try {
      con = await Deno.connectTls({ hostname: c.servidor, port: c.puerto });
    } catch {
      throw new MailError('servidor', 'No se pudo hablar con el servidor de mails.');
    }
    if (vencio) throw new MailError('servidor', 'El servidor de mails tardó demasiado.');
    const s = new Conversacion(con);
    const saludo = await s.respuesta();
    if (saludo.codigo !== 220) throw new MailError('servidor', 'El servidor de mails no está atendiendo (' + saludo.codigo + ').');
    await s.orden('EHLO vdh.com.ar', [250], (r) => new MailError('servidor', 'El servidor de mails no está atendiendo (' + r.codigo + ').'));
    const entrada = btoa(String.fromCharCode(...codificar.encode('\u0000' + c.usuario + '\u0000' + c.clave)));
    await s.orden('AUTH PLAIN ' + entrada, [235], (r) => porque(r, 'entrar'));
    await s.orden('MAIL FROM:<' + c.direccion + '>', [250], (r) => porque(r, 'mandar'));
    await s.orden('RCPT TO:<' + para + '>', [250, 251], (r) => porque(r, 'destino'));
    await s.orden('DATA', [354], (r) => porque(r, 'mandar'));
    /* Un renglón que empieza con punto lleva otro adelante (si no, el servidor cree que ahí termina el mail). Los
       cuerpos van en base64, así que no pasa; se cuida igual. */
    const cuerpo = new TextDecoder().decode(mensaje).replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
    await s.escribir(codificar.encode(cuerpo + (cuerpo.endsWith('\r\n') ? '' : '\r\n') + '.\r\n'));
    const fin = await s.respuesta();
    if (fin.codigo !== 250) throw porque(fin, 'mandar');
    await s.escribir(codificar.encode('QUIT\r\n')).catch(() => {});
  } catch (e) {
    if (vencio) throw new MailError('servidor', 'El servidor de mails tardó demasiado.');
    if (e instanceof MailError) throw e;
    throw new MailError('servidor', 'Se cortó la comunicación con el servidor de mails.');
  } finally {
    clearTimeout(reloj);
    try { con?.close(); } catch { /* ya estaba cerrada */ }
  }
}
