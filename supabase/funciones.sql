-- VDH · Sistema No Compra — lo que el vendedor puede hacer sin leer nada.
--
-- Correr DESPUÉS de politicas.sql.
--
-- ── Por qué estas dos cosas son funciones y no tablas ─────────────────────
-- El vendedor no puede leer `registros`. Ni una fila, ni un conteo. Eso está
-- probado y es el corazón del modelo.
--
-- Pero trae una consecuencia que sólo aparece probando desde afuera: al
-- insertar por la API, pedir que devuelva la fila creada **requiere permiso
-- de lectura**, así que el alta falla. Y el celular necesita el id de lo que
-- acaba de cargar, porque es lo que le permite ofrecer "corregir" después.
--
-- La salida no es aflojar el permiso: es que el alta pase por una función
-- que devuelve ÚNICAMENTE el id y la fecha. Dos datos que ya son suyos —
-- acaba de escribirlos— y que no sirven para leer los de nadie más.

-- ════════════════════════════════════════════════════════════════════════
-- CARGAR
--
-- Hace de una las dos cosas que hoy hace submitForm: escribe el registro y
-- suma al vendedor a la lista del local si todavía no estaba.
--
-- Eso último es lo que hace que el sistema se arregle solo: el que entra un
-- sábado escribe su nombre UNA vez y del registro siguiente en adelante
-- aparece en el desplegable de todos los celulares del local, escrito
-- siempre igual.
-- ════════════════════════════════════════════════════════════════════════

create or replace function cargar_registro(
  p_sucursal text,
  p_vendedor text,
  p_whatsapp text,
  p_nombre   text default null,
  p_mail     text default null,
  p_producto text default null,
  p_talle    text default null,
  p_obs      text default null,
  p_motivo   text default null
)
returns table (id bigint, creado timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo_id bigint;
  cuando   timestamptz;
begin
  /* La validación vive acá y no en la política de la tabla porque una
     función SECURITY DEFINER se saltea las políticas por definición. La
     política sigue puesta igual, para el caso de que algún día algo inserte
     directo. */
  if length(trim(coalesce(p_sucursal, ''))) = 0 then
    raise exception 'Falta la sucursal.';
  end if;
  if length(trim(coalesce(p_vendedor, ''))) = 0 then
    raise exception 'Falta el vendedor.';
  end if;
  if length(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g')) < 8 then
    raise exception 'Falta el WhatsApp del cliente.';
  end if;

  insert into registros (sucursal, vendedor, whatsapp, nombre, mail, producto, talle, obs, motivo)
  values (trim(p_sucursal), trim(p_vendedor), p_whatsapp, p_nombre, p_mail,
          p_producto, p_talle, p_obs,
          nullif(p_motivo, '')::motivo_no_compra)
  returning registros.id, registros.creado into nuevo_id, cuando;

  /* El nombre entra en la lista del local. Si ya estaba —activo o no— no se
     toca: reactivar en silencio a alguien que el encargado desactivó a
     propósito sería deshacerle la decisión sin avisarle. */
  insert into equipo (local, vendedor, por)
  values (trim(p_sucursal), trim(p_vendedor), trim(p_vendedor) || ' (desde la carga)')
  on conflict do nothing;

  return query select nuevo_id, cuando;
end;
$$;


-- ════════════════════════════════════════════════════════════════════════
-- CORREGIR
--
-- El vendedor arregla lo que acaba de cargar mal. Sigue sin poder leer nada:
-- el celular se acuerda del id y de la fecha, y los manda de vuelta como
-- prueba de que ese registro es el suyo.
--
-- Cuatro cosas tienen que coincidir —id, fecha exacta, local y vendedor— y
-- tiene que ser de las últimas 24 horas. No es un candado: quien quiera
-- ensuciar la base ya puede cargar basura. Es lo que convierte el destrozo a
-- ciegas en algo que hay que acertar.
--
-- Sólo se reescribe lo que cargó el vendedor. La fecha, el local, el nombre
-- de quien cargó y todo el seguimiento de Atención al Cliente quedan como
-- estaban.
-- ════════════════════════════════════════════════════════════════════════

create or replace function corregir_registro(
  p_id       bigint,
  p_creado   timestamptz,
  p_sucursal text,
  p_vendedor text,
  p_whatsapp text,
  p_nombre   text default null,
  p_mail     text default null,
  p_producto text default null,
  p_talle    text default null,
  p_obs      text default null,
  p_motivo   text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  tocadas integer;
begin
  if length(regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g')) < 8 then
    raise exception 'Falta el WhatsApp del cliente.';
  end if;

  update registros
     set nombre   = p_nombre,
         whatsapp = p_whatsapp,
         mail     = p_mail,
         producto = p_producto,
         talle    = p_talle,
         obs      = p_obs,
         motivo   = nullif(p_motivo, '')::motivo_no_compra
   where id = p_id
     -- La fecha al milisegundo: es lo que prueba que este celular fue el que
     -- lo cargó, porque se la devolvimos al dar de alta.
     and creado = p_creado
     and lower(trim(sucursal)) = lower(trim(p_sucursal))
     and lower(trim(vendedor)) = lower(trim(p_vendedor))
     and creado > now() - interval '24 hours';

  get diagnostics tocadas = row_count;
  return tocadas > 0;
end;
$$;


grant execute on function cargar_registro(text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function corregir_registro(bigint, timestamptz, text, text, text, text, text, text, text, text, text) to anon, authenticated;
