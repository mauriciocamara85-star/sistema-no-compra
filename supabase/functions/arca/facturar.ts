/**
 * Sistema VDH · La factura electrónica de una venta (ARCA, paso 2, 11/11/2026).
 *
 * El POS guarda la venta como siempre (pos_venta_guardar) y después le pide acá la factura. Este archivo:
 *   1. le pregunta a la base, CON LA SESIÓN DE LA PERSONA, qué factura le corresponde a la venta
 *      (arca_factura_preparar: si puede ver esa venta, el tipo, los importes, el documento, la condición de IVA);
 *   2. toma el turno del punto de venta (un pedido a ARCA por vez: dos cajas juntas no se pisan el número);
 *   3. si un pedido anterior de esta venta quedó sin respuesta, le pregunta a ARCA si lo aprobó (y lo recupera);
 *   4. pide el último número a ARCA, anota el siguiente y pide el CAE;
 *   5. guarda lo que contestó ARCA. Aprobada, queda en la venta (pos_ventas.factura).
 * Pase lo que pase, el turno se suelta al terminar.
 *
 * Por ahora (SQL 274) sólo las ventas de PRUEBA, contra el ARCA de prueba. La base es la que decide.
 */
// deno-lint-ignore-file no-explicit-any
import { Ambiente, ArcaError, base, comoPersona, consultar, credencial, dormir, hoyArca, pedirCae, ultimoNumero } from './arca.ts';

export type Respuesta =
  | { ok: true; factura: Record<string, unknown>; ya?: boolean }
  | { ok: true; no_va: string }
  | { ok: false; error: string; codigo?: string };

const TIPO_LETRA: Record<number, string> = { 1: 'A', 6: 'B' };

/** ¿El comprobante que tiene ARCA es el de esta venta? El mismo total y el mismo documento. */
function esElMismo(x: { total: number; doc_tipo: number; doc_nro: string }, pedido: any): boolean {
  return Math.abs(Number(x.total) - Number(pedido.total)) < 0.005 && Number(x.doc_tipo) === Number(pedido.doc_tipo) &&
    String(Number(x.doc_nro)) === String(Number(pedido.doc_nro));
}

/** Los motivos de ARCA en una línea: primero los errores, después las observaciones. */
function motivos(errores: { codigo: string; mensaje: string }[], observaciones: { codigo: string; mensaje: string }[]): string {
  return [...errores, ...observaciones].map((e) => e.mensaje.trim().replace(/\.$/, '') + (e.codigo ? ' (' + e.codigo + ')' : '')).join(' · ');
}

export async function facturar(token: string, ventaId: string): Promise<Respuesta> {
  /* 1. Qué le corresponde (y si la persona puede ver esa venta). */
  const prep = await comoPersona(token, 'arca_factura_preparar', { p_venta: ventaId });
  if (prep?.ya) return { ok: true, factura: prep.factura, ya: true };
  if (prep?.no_va) return { ok: true, no_va: String(prep.no_va) };
  if (prep?.error) return { ok: false, error: String(prep.error), codigo: 'datos' };
  const amb = prep?.ambiente as Ambiente, pv = Number(prep?.punto_venta), tipo = Number(prep?.tipo), pedido = prep?.pedido;
  if ((amb !== 'homologacion' && amb !== 'produccion') || !pv || !TIPO_LETRA[tipo] || !pedido) {
    throw new ArcaError('base', 'La base contestó algo que no se entiende al preparar la factura.');
  }

  /* 2. El turno del punto de venta: si otro está pidiendo, se espera (hasta medio minuto).
        Con el pedido va el CUIT que factura (el del certificado): la base lo guarda en la factura para su PDF y el QR (SQL 276). */
  const pedidoTurno = { ...pedido, cuit: credencial(amb).cuit };
  let turno: any;
  const hasta = Date.now() + 30_000;
  for (;;) {
    turno = await base('arca_factura_turno', {
      p_venta: ventaId, p_ambiente: amb, p_punto_venta: pv, p_tipo: tipo, p_pedido: pedidoTurno, p_persona: prep.persona ?? null,
    });
    if (turno?.ya) return { ok: true, factura: turno.factura, ya: true };
    if (!turno?.esperar) break;
    if (Date.now() > hasta) {
      return { ok: false, error: 'Se está pidiendo otra factura de este punto de venta y tarda. Probá de nuevo en un minuto.', codigo: 'ocupado' };
    }
    await dormir(1500);
  }

  /* Desde acá el turno es nuestro: se suelta siempre, con lo que haya pasado. */
  let numero: number | null = turno?.pendiente ? Number(turno.pendiente) : null;
  let cerrado = false;
  const guardar = async (estado: 'aprobado' | 'rechazado' | 'sin_respuesta', d: Record<string, unknown>) => {
    const r = await base('arca_factura_resultado', {
      p_venta: ventaId, p_estado: estado, p_numero: d.numero ?? null, p_fecha: d.fecha ?? null, p_cae: d.cae ?? null,
      p_cae_vence: d.cae_vence ?? null, p_observaciones: d.observaciones ?? null, p_errores: d.errores ?? null, p_error: d.error ?? null,
    });
    cerrado = true;
    return r;
  };
  try {
    /* 3. Un pedido anterior quedó sin respuesta: ¿ARCA lo aprobó? Si es el de esta venta, se recupera. */
    if (numero) {
      const x = await consultar(amb, pv, tipo, numero);
      if (x && x.resultado === 'A' && /^\d{14}$/.test(x.cae) && esElMismo(x, pedido)) {
        try {
          const r = await guardar('aprobado', { numero, fecha: x.fecha, cae: x.cae, cae_vence: x.cae_vence });
          return { ok: true, factura: r.factura };
        } catch (e) {
          /* Ese número ya es de otra venta (otra igual, del mismo importe): no es el nuestro. Se pide uno nuevo. */
          if (!(e instanceof ArcaError) || !/ya es de otra factura|duplicate|unique/i.test(e.message)) throw e;
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
        await base('arca_factura_numero', { p_venta: ventaId, p_numero: numero });
      } catch (e) {
        numero = null;
        if (vuelta < VUELTAS - 1 && e instanceof ArcaError && /ya es de otra factura/.test(e.message)) { await dormir(1000); continue; }
        throw e;
      }
      let r;
      try {
        r = await pedirCae(amb, {
          punto_venta: pv, tipo, numero, fecha,
          doc_tipo: Number(pedido.doc_tipo), doc_nro: String(pedido.doc_nro), condicion_iva: Number(pedido.condicion_iva),
          total: Number(pedido.total), neto: Number(pedido.neto), iva: Number(pedido.iva),
          alicuotas: (pedido.alicuotas ?? []).map((a: any) => ({ id: Number(a.id), base: Number(a.base), importe: Number(a.importe) })),
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
      const porque = e instanceof ArcaError ? e.message : 'Algo falló al pedir la factura.';
      await guardar('sin_respuesta', { numero, error: porque }).catch(() => {});
    }
    throw e;
  }
}
