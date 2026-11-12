/**
 * Sistema VDH — mandar un comprobante por mail (hoy: la factura electrónica de una venta del POS).
 * La puerta está en manejar.ts; el PDF, en factura.ts; y la entrega a la casilla, en correo.ts.
 */
import { manejar } from './manejar.ts';

Deno.serve(manejar);
