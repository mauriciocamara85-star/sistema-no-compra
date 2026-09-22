-- VDH · Sistema No Compra — los dos sentidos con Kommo.
--
-- Correr DESPUÉS de salud.sql.
--
-- ── Quién manda ───────────────────────────────────────────────────────────
-- **Kommo es la fuente de verdad del seguimiento.** Ahí Atención al Cliente
-- maneja los leads, las etapas y los cierres. El Panel es para MIRAR qué está
-- pasando, y sirve de respaldo si Kommo se cae.
--
-- De eso salen dos caminos, y el segundo existe sólo por el respaldo:
--
--   Kommo → base    el webhook. Cada vez que mueven un lead, se refleja acá.
--   base → Kommo    si alguien editó desde el Panel, eso vuelve al CRM.
--
-- ── El eco ────────────────────────────────────────────────────────────────
-- Los dos caminos juntos tienen un problema que no se ve hasta que pasa:
-- Kommo avisa → se escribe en la base → eso dispara un envío a Kommo → Kommo
-- vuelve a avisar → … Un lazo que no termina nunca y que llena el CRM de
-- movimientos falsos.
--
-- Se corta marcando de dónde vino cada escritura. La marca es una variable de
-- sesión y no una columna: vale sólo mientras dura la transacción que la
-- puso, así que no hay forma de que quede prendida por error y silencie los
-- envíos de mañana.


-- ════════════════════════════════════════════════════════════════════════
-- QUÉ ETAPA DE KOMMO ES QUÉ ESTADO
--
-- Las etapas del embudo están calcadas de los estados a propósito, así que
-- casi todas se traducen solas por el nombre. Las dos de cierre NO: Kommo las
-- llama "Closed - won" y "Closed - lost" y no deja renombrarlas.
--
-- El id se mira primero y sin preguntarle nada a Kommo: es el caso que mueve
-- plata y el único que no puede fallar por un tema de idioma.
-- ════════════════════════════════════════════════════════════════════════

/* Con el EMBUDO adentro, y no sólo la etapa. La cuenta tiene tres embudos
   —No Compra, Ventas, Tiendanube— y varias etapas se llaman igual entre
   ellos: sin el embudo, mandar un lead a "Descartado" podría mandarlo al
   Descartado de otro embudo. */
create table if not exists kommo_etapas (
  etapa  bigint primary key,
  embudo bigint,
  nombre text not null,
  estado estado_seguimiento,      -- NULL = esa etapa no es ningún estado nuestro
  visto  timestamptz not null default now()
);
alter table kommo_etapas add column if not exists embudo bigint;

alter table kommo_etapas enable row level security;

create or replace function kommo_refrescar_etapas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r      jsonb;
  emb    jsonb;
  et     jsonb;
  n      integer := 0;
  nombre text;
  cual   estado_seguimiento;
begin
  r := kommo('GET', '/leads/pipelines');

  for emb in select * from jsonb_array_elements(coalesce(r#>'{_embedded,pipelines}', '[]'::jsonb)) loop
    for et in select * from jsonb_array_elements(coalesce(emb#>'{_embedded,statuses}', '[]'::jsonb)) loop
      nombre := et->>'name';

      cual := case
        -- Por id, que es lo que Kommo garantiza.
        when (et->>'id')::bigint = 142 then 'Cerrado - compró'
        when (et->>'id')::bigint = 143 then 'Cerrado - no compró'
        -- Y por nombre, como red de contención: si algún día Kommo cambia
        -- esos ids, el puente sigue entendiendo las dos etapas.
        when kommo_clave(nombre) in ('closed - won', 'venta realizada') then 'Cerrado - compró'
        when kommo_clave(nombre) in ('closed - lost', 'venta perdida')  then 'Cerrado - no compró'
        -- El resto se traduce solo, porque se llaman igual.
        when kommo_clave(nombre) = kommo_clave('En seguimiento')      then 'En seguimiento'
        when kommo_clave(nombre) = kommo_clave('Esperando respuesta') then 'Esperando respuesta'
        when kommo_clave(nombre) = kommo_clave('Descartado')          then 'Descartado'
        /* "Sin contactar" y "Leads Entrantes" quedan en NULL a propósito: son
           donde el lead ENTRA, o sea que el registro sigue pendiente. Darles
           un estado lo sacaría de la lista de pendientes sin que nadie lo
           haya trabajado. */
        else null
      end;

      insert into kommo_etapas (etapa, embudo, nombre, estado)
      values ((et->>'id')::bigint, (emb->>'id')::bigint, nombre, cual)
      on conflict (etapa) do update
        set embudo = excluded.embudo, nombre = excluded.nombre,
            estado = excluded.estado, visto = now();
      n := n + 1;
    end loop;
  end loop;

  return n;
end;
$$;

revoke execute on function kommo_refrescar_etapas() from anon, authenticated, public;


-- ════════════════════════════════════════════════════════════════════════
-- LO QUE AVISÓ KOMMO
--
-- La llama la Edge Function del webhook con el lead ya desarmado. Acá no se
-- parsea nada: la función sólo aplica.
--
-- **Sólo toca el resultado.** El estado, si compró y el monto. Lo que el
-- equipo escribió a mano —el responsable, las notas del seguimiento— no se
-- toca nunca: el CRM manda sobre el desenlace, no sobre las anotaciones de
-- nadie.
-- ════════════════════════════════════════════════════════════════════════

create or replace function aplicar_kommo(p_lead text, p_etapa bigint, p_precio numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r      registros%rowtype;
  cual   estado_seguimiento;
  conoce boolean;
begin
  select * into r from registros where lead_kommo = p_lead;
  if not found then
    -- Un lead de otro embudo, o uno que no nació acá. No es un error.
    return jsonb_build_object('aplicado', false, 'porque', 'ese lead no es de este sistema');
  end if;

  select estado, true into cual, conoce from kommo_etapas where etapa = p_etapa;
  if not conoce then
    -- Etapa nueva: se vuelven a pedir y se reintenta una vez.
    perform kommo_refrescar_etapas();
    select estado, true into cual, conoce from kommo_etapas where etapa = p_etapa;
  end if;
  if cual is null then
    return jsonb_build_object('aplicado', false, 'porque', 'esa etapa no es ningún estado nuestro');
  end if;

  /* LA MARCA. Vale hasta que termine esta transacción, y es lo que hace que
     el trigger de más abajo no mande de vuelta a Kommo algo que vino de
     Kommo. Ver el comentario del eco arriba de todo. */
  perform set_config('vdh.viene_de_kommo', 'si', true);

  update registros
     set estado = cual,
         /* Kommo no deja tener dos etapas de "ganado", así que la venta en el
            local y la online no se distinguen por etapa. Se asume LOCAL, que
            es el caso de este sistema —el cliente estuvo parado en el
            mostrador—, y si fue online se corrige desde el Panel. Ante la
            duda, no inflar el online. */
         compro = (cual = 'Cerrado - compró'),
         compro_canal = case when cual = 'Cerrado - compró' then 'local'::canal_venta else null end,
         /* El monto sale del presupuesto del lead. En cero NO se escribe:
            sería pisar con un cero el importe que alguien cargó a mano.

            Y al cerrar como no comprado se limpia, porque la base prohíbe un
            monto sin venta: dejarlo puesto no guardaría "no compró", no
            guardaría nada. */
         monto = case
                   when cual <> 'Cerrado - compró' then null
                   when coalesce(p_precio, 0) > 0  then p_precio
                   else registros.monto
                 end
   where id = r.id;

  return jsonb_build_object('aplicado', true, 'registro', r.id, 'estado', cual);
end;
$$;

/* Sólo la Edge Function del webhook, que entra con la clave de servicio.
   Ni el navegador ni un usuario logueado pueden llamarla: mover el estado de
   un lead a mano desde afuera dejaría la base y Kommo diciendo cosas
   distintas, que es justo lo que esto viene a evitar.

   El revoke a PUBLIC va PRIMERO: sin eso, el grant por omisión de Postgres
   deja la función abierta a cualquiera con conexión. */
revoke execute on function aplicar_kommo(text, bigint, numeric) from public, anon, authenticated;
grant  execute on function aplicar_kommo(text, bigint, numeric) to service_role;


-- ════════════════════════════════════════════════════════════════════════
-- Y LA VUELTA: LO QUE SE EDITÓ EN EL PANEL
--
-- El Panel es para mirar. Pero si Kommo se cae y alguien tiene que trabajar
-- desde acá, ese cambio no puede quedarse acá: quedarían dos estados
-- distintos para el mismo cliente y nadie sabría cuál vale.
--
-- Por eso cada edición del Panel deja un pendiente, igual que el alta.
-- ════════════════════════════════════════════════════════════════════════

-- El destino nuevo. Se agrega al enum que ya existe.
alter type destino_salida add value if not exists 'kommo_estado';

create or replace function encolar_cambio_de_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin lead en Kommo no hay nada que actualizar allá.
  if new.lead_kommo is null then return new; end if;
  if secreto('KOMMO_TOKEN') is null then return new; end if;

  -- Si vino de Kommo, no vuelve a Kommo. Esto es el anti-eco.
  if coalesce(current_setting('vdh.viene_de_kommo', true), '') = 'si' then
    return new;
  end if;

  -- Y sólo si cambió algo que a Kommo le importa.
  if new.estado is not distinct from old.estado
     and new.compro is not distinct from old.compro
     and new.monto  is not distinct from old.monto then
    return new;
  end if;

  /* Un solo pendiente por registro: si alguien toca el estado y después el
     monto, se manda una vez con lo último. El `do update` lo vuelve a poner
     en pendiente aunque el anterior ya se hubiera mandado. */
  insert into salidas (registro, destino) values (new.id, 'kommo_estado')
  on conflict (registro, destino) do update
    set estado = 'pendiente', intentos = 0, error = null, ultimo = null;

  return new;
end;
$$;

drop trigger if exists registros_devolver_a_kommo on registros;
create trigger registros_devolver_a_kommo
  after update on registros
  for each row execute function encolar_cambio_de_estado();


-- ════════════════════════════════════════════════════════════════════════
-- MANDARLO
--
-- Mueve el lead de etapa en Kommo y, si hay monto, le pone el presupuesto.
-- ════════════════════════════════════════════════════════════════════════

create or replace function mandar_kommo_estado(p_registro bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r     registros%rowtype;
  etapa bigint;
  lead  jsonb;
begin
  select * into r from registros where id = p_registro;
  if not found then raise exception 'No existe el registro %.', p_registro; end if;
  if r.lead_kommo is null then
    return jsonb_build_object('mandado', false, 'porque', 'ese registro no tiene lead');
  end if;

  if r.estado is null then
    return jsonb_build_object('mandado', false, 'porque', 'todavía no tiene estado');
  end if;

  /* Primero la del embudo de este sistema. Las dos de cierre (142 y 143) son
     globales de Kommo y no pertenecen a ninguno, así que quedan de segundas:
     mover un lead a 142 funciona dentro del embudo en el que ya está. */
  select e.etapa into etapa from kommo_etapas e
   where e.estado = r.estado
   order by (e.embudo::text is not distinct from secreto('KOMMO_PIPELINE_ID')) desc,
            e.embudo nulls last, e.etapa
   limit 1;
  if etapa is null then
    perform kommo_refrescar_etapas();
    select e.etapa into etapa from kommo_etapas e
     where e.estado = r.estado
     order by (e.embudo::text is not distinct from secreto('KOMMO_PIPELINE_ID')) desc,
              e.embudo nulls last, e.etapa
     limit 1;
  end if;
  if etapa is null then
    raise exception 'No hay ninguna etapa de Kommo para el estado "%".', r.estado;
  end if;

  lead := jsonb_build_object('status_id', etapa);
  -- El presupuesto del lead es el monto de la venta. Sólo si hay uno.
  if r.compro and coalesce(r.monto, 0) > 0 then
    lead := lead || jsonb_build_object('price', round(r.monto)::bigint);
  end if;

  perform kommo('PATCH', '/leads/' || r.lead_kommo, lead);

  return jsonb_build_object('mandado', true, 'lead', r.lead_kommo, 'etapa', etapa);
end;
$$;

revoke execute on function mandar_kommo_estado(bigint) from anon, authenticated, public;


-- ════════════════════════════════════════════════════════════════════════
-- Y EL TRABAJADOR LO DESPACHA
--
-- Se rehace entero para sumarle el destino nuevo: `case` no se puede
-- extender de a pedazos.
-- ════════════════════════════════════════════════════════════════════════

create or replace function despachar_salidas()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s       salidas%rowtype;
  res     jsonb;
  hechos  integer := 0;
begin
  /* El tiempo de espera de `http` es POR SESIÓN y arranca en un segundo, que
     no le alcanza ni para saludar a Kommo. Cada corrida de pg_cron es una
     sesión nueva, así que hay que ponerlo acá adentro todas las veces. */
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '20000');

  for s in
    select * from salidas
     where estado = 'pendiente'
       and intentos < 6
       -- Espera creciente entre intentos: 1, 2, 4, 8, 16 minutos.
       and (ultimo is null or ultimo < now() - (power(2, intentos) * interval '1 minute'))
     order by creado
     -- De a veinte: una corrida que se lleva cinco minutos se pisa con la
     -- siguiente. Lo que no entra queda para el minuto que viene.
     limit 20
     for update skip locked
  loop
    begin
      res := case s.destino
               when 'kommo'        then mandar_kommo(s.registro)
               when 'telegram'     then mandar_telegram(s.registro)
               when 'kommo_estado' then mandar_kommo_estado(s.registro)
             end;

      update salidas
         set estado = 'hecho', intentos = intentos + 1, ultimo = now(),
             error = null, resultado = res
       where id = s.id;
      hechos := hechos + 1;

    exception when others then
      /* El fallo de UNO no puede cortar la vuelta: sin este bloque, un lead
         que Kommo rechaza por un dato raro dejaría sin mandar a todos los que
         venían atrás. */
      update salidas
         set intentos = intentos + 1,
             ultimo = now(),
             error = left(sqlerrm, 500),
             -- Al sexto se deja de intentar y pasa a ser algo que mirar.
             estado = case when intentos + 1 >= 6 then 'fallado'::estado_salida
                           else 'pendiente'::estado_salida end
       where id = s.id;
    end;
  end loop;

  return hechos;
end;
$$;

revoke execute on function despachar_salidas() from anon, authenticated, public;
