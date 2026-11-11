/**
 * Sistema VDH — el puente con ARCA (factura electrónica).
 * La puerta está en manejar.ts y lo que habla con ARCA, en arca.ts.
 */
import { manejar } from './manejar.ts';

Deno.serve(manejar);
