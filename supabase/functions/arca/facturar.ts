/**
 * Sistema VDH · La factura electrónica de una venta y la nota de crédito que la anula (ARCA, 11 y 12/11/2026).
 *
 * El POS guarda la venta como siempre (pos_venta_guardar) y después le pide acá la factura. Lo mismo con la nota de
 * crédito (pos_nc_hacer anula el ticket y después se pide acá su CAE). El camino es uno solo para las dos:
 *   1. le pregunta a la base, CON LA SESIÓN DE LA PERSONA, qué comprobante le corresponde
 *      (arca_factura_preparar / arca_nc_preparar: si puede verlo, el tipo, los importes, el documento, la condición de
 *      IVA y, en la nota, la factura que anula);
 *   2. toma el turno del punto de venta (un pedido a ARCA por vez: dos cajas juntas no se pisan el número);
 *   3. si un pedido anterior quedó sin respuesta, le pregunta a ARCA si lo aprobó (y lo recupera);
 *   4. pide el último número a ARCA, anota el siguiente y pide el CAE;
 *   5. guarda lo que contestó ARCA. Aprobada, queda en la venta (pos_ventas.factura) o en la nota
 *      (pos_notas_credito.factura).
 * Pase lo que pase, el turno se suelta al terminar.
 *
 * Contra qué ARCA va (el de prueba o el de verdad) lo decide la base: la factura, según la sucursal (SQL 276); la nota
 * de crédito, el mismo ARCA que aprobó la factura que anula (SQL 279).
 */
// deno-lint-ignore-file no-explicit-any
import { Ambiente, ArcaError, base, comoPersona, consultar, credencial, dormir, hoyArca, pedirCae, ultimoNumero } from './arca.ts';

export type Respuesta =
  | { ok: true; factura: Record<string, unknown>; ya?: boolean }
  | { ok: true; no_va: string }
  | { ok: false; error: string; codigo?: string };

/** Las dos clases de comprobante: cambian las funciones de la base, con qué se las llama y los tipos de ARCA que valen. */
type Clase = {
  preparar: string; turno: string; numero: string; resultado: string;
  clave: 'p_venta' | 'p_nota';
  /** Los tipos de comprobante de ARCA que puede pedir, con su letra. */
  tipos: Record<number, string>;
  /** La nota de crédito SIEMPRE lleva la factura que anula. */
  conAsociado: boolean;
};
const FACTURA: Clase = {
  preparar: 'arca_factura_preparar', turno: 'arca_factura_turno', numero: 'arca_factura_numero', resultado: 'arca_factura_resultado',
  clave: 'p_venta', tipos: { 1: 'A', 6: 'B' }, conAsociado: false,
};
const NOTA: Clase = {
  preparar: 'arca_nc_preparar', turno: 'arca_nc_turno', numero: 'arca_nc_numero', resultado: 'arca_nc_resultado',
  clave: 'p_nota', tipos: { 3: 'A', 8: 'B' }, conAsociado: true,
};

/** La factura de una venta. */
export function facturar(token: string, ventaId: string): Promise<Respuesta> {
  return pedirComprobante(FACTURA, token, ventaId);
}
/** La nota de crédito de una venta facturada (notaId: el de pos_notas_credito). */
export function notaCredito(token: string, notaId: string): Promise<Respuesta> {
  return pedirComprobante(NOTA, token, notaId);
}

/** ¿El comprobante que tiene ARCA es el de este pedido? El mismo total y el mismo documento. */
function esElMismo(x: { total: number; doc_tipo: number; doc_nro: string }, pedido: any): boolean {
  return Math.abs(Number(x.total) - Number(pedido.total)) < 0.005 && Number(x.doc_tipo) === Number(pedido.doc_tipo) &&
    String(Number(x.doc_nro)) === String(Number(pedido.doc_nro));
}

/** Los motivos de ARCA en una línea: primero los errores, después las observaciones. */
function motivos(errores: { codigo: string; mensaje: string }[], observaciones: { codigo: string; mensaje: string }[]): string {
  return [...errores, ...observaciones].map((e) => e.mensaje.trim().replace(/\.$/, '') + (e.codigo ? ' (' + e.codigo + ')' : '')).join(' · ');
}

/** La factura que anula la nota, como la pide pedirCae. */
function asociadosDe(pedido: any): { tipo: number; punto_venta: number; numero: number; cuit?: string; fecha?: string }[] {
  return (Array.isArray(pedido?.asociados) ? pedido.asociados : []).map((a: any) => ({
    tipo: Number(a.tipo), punto_venta: Number(a.punto_venta), numero: Number(a.numero),
    cuit: a.cuit ? String(a.cuit) : undefined, fecha: a.fecha ? String(a.fecha) : undefined,
  })).filter((a: { tipo: number; punto_venta: number; numero: number }) => a.tipo > 0 && a.punto_venta > 0 && a.numero > 0);
}

async function pedirComprobante(k: Clase, token: string, id: string): Promise<Respuesta> {
  /* 1. Qué le corresponde (y si la persona puede verlo). */
  const prep = await comoPersona(token, k.preparar, { [k.clave]: id });
  if (prep?.ya) return { ok: true, factura: prep.factura, ya: true };
  if (prep?.no_va) return { ok: true, no_va: String(prep.no_va) };
  if (prep?.error) return { ok: false, error: String(prep.error), codigo: 'datos' };
  const amb = prep?.ambiente as Ambiente, pv = Number(prep?.punto_venta), tipo = Number(prep?.tipo), pedido = prep?.pedido;
  if ((amb !== 'homologacion' && amb !== 'produccion') || !pv || !k.tipos[tipo] || !pedido) {
    throw new ArcaError('base', 'La base contestó algo que no se entiende al preparar el comprobante.');
  }
  const asociados = asociadosDe(pedido);
  if (k.conAsociado ? asociados.length !== 1 : asociados.length !== 0) {
    throw new ArcaError('base', 'La base no dijo bien qué factura anula la nota de crédito.');
  }

  /* 2. El turno del punto de venta: si otro está pidiendo, se espera (hasta medio minuto).
        Con el pedido va el CUIT que factura (el del certificado): la base lo guarda en el comprobante para su PDF y el QR (SQL 276). */
  const pedidoTurno = { ...pedido, cuit: credencial(amb).cuit };
  let turno: any;
  const hasta = Date.now() + 30_000;
  for (;;) {
    turno = await base(k.turno, {
      [k.clave]: id, p_ambiente: amb, p_punto_venta: pv, p_tipo: tipo, p_pedido: pedidoTurno, p_persona: prep.persona ?? null,
    });
    if (turno?.ya) return { ok: true, factura: turno.factura, ya: true };
    if (!turno?.esperar) break;
    if (Date.now() > hasta) {
      return { ok: false, error: 'Se está pidiendo otro comprobante de este punto de venta y tarda. Probá de nuevo en un minuto.', codigo: 'ocupado' };
    }
    await dormir(1500);
  }

  /* Desde acá el turno es nuestro: se suelta siempre, con lo que haya pasado. */
  let numero: number | null = turno?.pendiente ? Number(turno.pendiente) : null;
  let cerrado = false;
  const guardar = async (estado: 'aprobado' | 'rechazado' | 'sin_respuesta', d: Record<string, unknown>) => {
    const r = await base(k.resultado, {
      [k.clave]: id, p_estado: estado, p_numero: d.numero ?? null, p_fecha: d.fecha ?? null, p_cae: d.cae ?? null,
      p_cae_vence: d.cae_vence ?? null, p_observaciones: d.observaciones ?? null, p_errores: d.errores ?? null, p_error: d.error ?? null,
    });
    cerrado = true;
    return r;
  };
  try {
    /* 3. Un pedido anterior quedó sin respuesta: ¿ARCA lo aprobó? Si es el de este comprobante, se recupera. */
    if (numero) {
      const x = await consultar(amb, pv, tipo, numero);
      if (x && x.resultado === 'A' && /^\d{14}$/.test(x.cae) && esElMismo(x, pedido)) {
        try {
          const r = await guardar('aprobado', { numero, fecha: x.fecha, cae: x.cae, cae_vence: x.cae_vence });
          return { ok: true, factura: r.factura };
        } catch (e) {
          /* Ese número ya es de otro comprobante (otro igual, del mismo importe): no es el nuestro. Se pide uno nuevo. */
          if (!(e instanceof ArcaError) || !/ya es de otra (factura|nota)|duplicate|unique/i.test(e.message)) throw e;
          cerrado = false;
        }
      }
      numero = null;
    }

    /* 4. El número y el CAE. Si el número ya no es el que sigue (otro facturó en el medio, o ARCA todavía no cuenta la
          última), se vuelve a preguntar: hasta tres vueltas. */
    const fecha = hoyArca();
    const VUELTAS = 3;
    for (let vuelta = 0; vuelta < VUELTAS; vuelta++) {
      numero = (await ultimoNumero(amb, pv, tipo)) + 1;
      try {
        await base(k.numero, { [k.clave]: id, p_numero: numero });
      } catch (e) {
        numero = null;
        if (vuelta < VUELTAS - 1 && e instanceof ArcaError && /ya es de otra (factura|nota)/.test(e.message)) { await dormir(1000); continue; }
        throw e;
      }
      let r;
      try {
        r = await pedirCae(amb, {
          punto_venta: pv, tipo, numero, fecha,
          doc_tipo: Number(pedido.doc_tipo), doc_nro: String(pedido.doc_nro), condicion_iva: Number(pedido.condicion_iva),
          total: Number(pedido.total), neto: Number(pedido.neto), iva: Number(pedido.iva),
          alicuotas: (pedido.alicuotas ?? []).map((a: any) => ({ id: Number(a.id), base: Number(a.base), importe: Number(a.importe) })),
          ...(asociados.length ? { asociados } : {}),
        });
      } catch (e) {
        /* No contestó: no sabemos si la aprobó. Queda anotado el número, y el próximo intento se lo pregunta a ARCA. */
        const porque = e instanceof ArcaError ? e.message : 'No se pudo hablar con ARCA.';
        await guardar('sin_respuesta', { numero, error: porque });
        /* El POS ya agrega «se pide de nuevo desde el ticket» (facturaOtraVez): acá va sólo el motivo. */
        return { ok: false, error: porque, codigo: 'sin_respuesta' };
      }
      if (r.aprobada) {
        const g = await guardar('aprobado', { numero, fecha, cae: r.cae, cae_vence: r.cae_vence, observaciones: r.observaciones, errores: r.errores });
        return { ok: true, factura: g.factura };
      }
      if (vuelta < VUELTAS - 1 && r.errores.concat(r.observaciones).some((e) => e.codigo === '10016')) continue;
      const porque = motivos(r.errores, r.observaciones) || 'ARCA no dijo por qué.';
      await guardar('rechazado', { error: 'ARCA la rechazó: ' + porque, observaciones: r.observaciones, errores: r.errores });
      return { ok: false, error: 'ARCA la rechazó: ' + porque, codigo: 'rechazada' };
    }
    throw new ArcaError('wsfe', 'ARCA no aceptó el número que sigue. Probá de nuevo en un minuto.');
  } catch (e) {
    if (!cerrado) {
      const porque = e instanceof ArcaError ? e.message : 'Algo falló al pedir el comprobante.';
      await guardar('sin_respuesta', { numero, error: porque }).catch(() => {});
    }
    throw e;
  }
}
