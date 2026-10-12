-- VDH · El CRM propio: lo que se corrió en Supabase, en orden.


-- ─────────────────────────── PARTE 51 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · EL CRM PROPIO: EL HISTORIAL, LOS CARRITOS ABANDONADOS Y LOS NÚMEROS
--
-- Correr en el editor SQL de Supabase. No depende del 50 (la Billetera):
-- se pueden correr en cualquier orden.
--
-- Pedido de Mauricio (07/10/2026): "construir nuestro propio CRM, de a
-- poquito, para no depender de Kommo". Tres piezas:
--
-- 1. EL HISTORIAL. Cada vez que una tarjeta cambia de columna en el Panel
--    (Pendiente → En seguimiento → Esperando respuesta → Compró / No compró
--    / Descartado) queda anotado quién la movió y cuándo. Hasta hoy sólo se
--    guardaba dónde estaba cada una. Con esto se puede contar "ganados esta
--    semana", "cuánto tardamos en contactar" y "quién cerró qué".
--
-- 2. LOS CARRITOS ABANDONADOS de vdh.com.ar. Los trae cada hora el Action
--    de vdh-respaldos (tienda-carritos.js) con la misma llave de Tienda Nube
--    que suma los puntos del Club. Se siguen en el Panel con las mismas
--    columnas que los No Compra. Si la persona termina comprando (un pedido
--    pagado con su mail o su teléfono), el carrito pasa solo a "Compró" con
--    el monto; a los 30 días sin comprar, pasa solo a "No compró".
--
-- 3. LOS NÚMEROS DEL CRM, como el panel de Kommo: entraron, ganados,
--    perdidos, tiempo hasta el primer contacto, por persona y por día.
--
--   crm_movimientos        el historial (No Compra y carritos)
--   crm_carritos           los carritos abandonados
--   crm_carritos_cargar    la carga de cada hora (sólo el Action)
--   crm_carritos_listar    el tablero de carritos (con el PIN)
--   crm_carrito_guardar    mover un carrito, notas, monto (con el PIN)
--   crm_estadisticas       los números del CRM (con el PIN)
-- ══════════════════════════════════════════════════════════════════════════

/* ═══ 1. EL HISTORIAL ═══════════════════════════════════════════════════ */

create table if not exists crm_movimientos (
  id      bigserial primary key,
  fuente  text not null check (fuente in ('no_compra', 'carrito')),
  ref     bigint not null,               -- registros.id o crm_carritos.id
  de      text,                          -- la columna de donde salió (null = recién entró)
  a       text not null,                 -- la columna a la que llegó
  quien   text,                          -- quién la movió; 'Automático' si fue el sistema
  cuando  timestamptz not null default now()
);
create index if not exists crm_movimientos_ref on crm_movimientos (fuente, ref, cuando);
create index if not exists crm_movimientos_cuando on crm_movimientos (cuando);
/* Nadie la lee de afuera: sólo las funciones de acá abajo. */
alter table crm_movimientos enable row level security;

/* La columna del tablero, igual que en el Panel: el estado y, si no tiene,
   "En seguimiento" si ya se lo contactó o "Pendiente" si no. */
create or replace function crm_columna(p_estado estado_seguimiento, p_contactado boolean)
returns text language sql immutable as $
  select coalesce(p_estado::text, case when coalesce(p_contactado, false) then 'En seguimiento' else 'Pendiente' end)
$;

/* Quién movió: lo que diga la carga automática ("Automático"), Kommo, o
   el responsable que manda el Panel al mover. */
create or replace function crm_quien(p_responsable text)
returns text language sql stable as $
  select coalesce(nullif(current_setting('vdh.crm_quien', true), ''),
                  case when coalesce(current_setting('vdh.viene_de_kommo', true), '') = 'si' then 'Kommo' end,
                  nullif(trim(p_responsable), ''))
$;

create or replace function crm_anotar_registro()
returns trigger language plpgsql security definer set search_path = public as $
declare de text; a text;
begin
  a := crm_columna(new.estado, new.contactado);
  if tg_op = 'INSERT' then
    insert into crm_movimientos (fuente, ref, de, a, quien, cuando)
    values ('no_compra', new.id, null, a, nullif(trim(new.vendedor), ''), new.creado);
    return new;
  end if;
  de := crm_columna(old.estado, old.contactado);
  if de is distinct from a then
    insert into crm_movimientos (fuente, ref, de, a, quien)
    values ('no_compra', new.id, de, a, crm_quien(new.responsable));
  end if;
  return new;
end;
$;
drop trigger if exists registros_crm_historial on registros;
create trigger registros_crm_historial after insert or update on registros
  for each row execute function crm_anotar_registro();

/* Los No Compra que ya estaban: la entrada, y si ya no están en Pendiente,
   el paso a su columna con la fecha del primer contacto (es lo único que
   se sabía). Se puede correr dos veces: no duplica. */
insert into crm_movimientos (fuente, ref, de, a, quien, cuando)
select 'no_compra', r.id, null, 'Pendiente', nullif(trim(r.vendedor), ''), r.creado
  from registros r
 where not exists (select 1 from crm_movimientos m where m.fuente = 'no_compra' and m.ref = r.id);
insert into crm_movimientos (fuente, ref, de, a, quien, cuando)
select 'no_compra', r.id, 'Pendiente', crm_columna(r.estado, r.contactado), nullif(trim(r.responsable), ''),
       greatest(r.creado, coalesce((r.contacto1_fecha + time '12:00') at time zone 'America/Argentina/Buenos_Aires', r.creado))
  from registros r
 where crm_columna(r.estado, r.contactado) <> 'Pendiente'
   and (select count(*) from crm_movimientos m where m.fuente = 'no_compra' and m.ref = r.id) = 1;


/* ═══ 2. LOS CARRITOS ABANDONADOS ═══════════════════════════════════════ */

create table if not exists crm_carritos (
  id              bigint primary key,      -- el número de carrito de Tienda Nube
  token           text,
  creado          timestamptz not null,
  actualizado     timestamptz,
  nombre          text,
  mail            text,
  telefono        text,
  total           numeric,
  moneda          text,
  url             text,                    -- el link para retomar la compra tal cual quedó
  productos       jsonb not null default '[]'::jsonb,
  casi_pago       boolean not null default false,   -- lo abandonó en el paso del pago
  -- el seguimiento, como en los No Compra
  contactado      boolean not null default false,
  responsable     text,
  contacto1_fecha date,
  estado          estado_seguimiento,
  obs_seguimiento text,
  compro          boolean not null default false,
  monto           numeric,
  pedido          text,                    -- el número de pedido con el que compró
  visto           timestamptz not null default now()   -- la última vez que vino de Tienda Nube
);
create index if not exists crm_carritos_creado on crm_carritos (creado);
alter table crm_carritos enable row level security;

create or replace function crm_anotar_carrito()
returns trigger language plpgsql security definer set search_path = public as $
declare de text; a text;
begin
  a := crm_columna(new.estado, new.contactado);
  if tg_op = 'INSERT' then
    insert into crm_movimientos (fuente, ref, de, a, quien, cuando)
    values ('carrito', new.id, null, a, null, new.creado);
    return new;
  end if;
  de := crm_columna(old.estado, old.contactado);
  if de is distinct from a then
    insert into crm_movimientos (fuente, ref, de, a, quien)
    values ('carrito', new.id, de, a, crm_quien(new.responsable));
  end if;
  return new;
end;
$;
drop trigger if exists crm_carritos_historial on crm_carritos;
create trigger crm_carritos_historial after insert or update on crm_carritos
  for each row execute function crm_anotar_carrito();

/* La carga de cada hora. Recibe { carritos: [...], pedidos: [...] }:
   - carritos: los abandonados que devuelve Tienda Nube (los de $0 o sin
     prendas no entran: no hay nada que seguir);
   - pedidos: los PAGADOS de los últimos días, con sus mails y teléfonos.
     Si alguien que dejó un carrito pagó después un pedido, el carrito pasa
     a "Compró" (el más nuevo de esa persona se lleva el monto).
   Y a los 30 días sin comprar, el carrito pasa solo a "No compró": Tienda
   Nube ya no deja retomarlo. Sólo la llama el Action. */
create or replace function crm_carritos_cargar(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $
declare
  c jsonb; o jsonb;
  nuevos integer := 0; actualizados integer := 0; saltados integer := 0;
  compraron integer := 0; vencidos integer := 0; n integer; esnuevo boolean;
  mails text[]; tels text[]; cuando timestamptz;
begin
  perform set_config('vdh.crm_quien', 'Automático', true);

  for c in select value from jsonb_array_elements(coalesce(p->'carritos', '[]'::jsonb)) loop
    if coalesce(nullif(c->>'total', '')::numeric, 0) <= 0
       or jsonb_array_length(coalesce(c->'productos', '[]'::jsonb)) = 0 then
      saltados := saltados + 1;
      continue;
    end if;
    insert into crm_carritos as k (id, token, creado, actualizado, nombre, mail, telefono, total, moneda, url,
                                   productos, casi_pago, visto)
    values ((c->>'id')::bigint, nullif(c->>'token', ''), (c->>'creado')::timestamptz,
            nullif(c->>'actualizado', '')::timestamptz, nullif(trim(c->>'nombre'), ''),
            nullif(lower(trim(c->>'mail')), ''), nullif(trim(c->>'telefono'), ''),
            (c->>'total')::numeric, nullif(c->>'moneda', ''), nullif(c->>'url', ''),
            coalesce(c->'productos', '[]'::jsonb), coalesce((c->>'casi_pago')::boolean, false), now())
    on conflict (id) do update set
      actualizado = excluded.actualizado,
      nombre      = coalesce(excluded.nombre, k.nombre),
      mail        = coalesce(excluded.mail, k.mail),
      telefono    = coalesce(excluded.telefono, k.telefono),
      total       = excluded.total,
      moneda      = coalesce(excluded.moneda, k.moneda),
      url         = coalesce(excluded.url, k.url),
      productos   = excluded.productos,
      casi_pago   = k.casi_pago or excluded.casi_pago,
      visto       = now()
    returning (xmax = 0) into esnuevo;
    if esnuevo then nuevos := nuevos + 1; else actualizados := actualizados + 1; end if;

    /* Si Tienda Nube ya lo da por completado, compró. */
    if nullif(c->>'completado', '') is not null then
      update crm_carritos
         set compro = true, estado = 'Cerrado - compró', monto = coalesce(monto, total)
       where id = (c->>'id')::bigint and not compro;
      get diagnostics n = row_count;
      compraron := compraron + n;
    end if;
  end loop;

  for o in select value from jsonb_array_elements(coalesce(p->'pedidos', '[]'::jsonb)) loop
    cuando := (o->>'creado')::timestamptz;
    select array_agg(distinct lower(trim(x))) into mails
      from jsonb_array_elements_text(coalesce(o->'mails', '[]'::jsonb)) x where x like '%_@_%';
    select array_agg(distinct right(regexp_replace(x, '\D', '', 'g'), 10)) into tels
      from jsonb_array_elements_text(coalesce(o->'telefonos', '[]'::jsonb)) x
     where length(regexp_replace(x, '\D', '', 'g')) >= 10;
    if mails is null and tels is null then continue; end if;

    with suyos as (
      select k.id, row_number() over (order by k.creado desc) as orden
        from crm_carritos k
       where not k.compro
         and k.creado <= cuando
         and k.creado > cuando - interval '30 days'
         and ((k.mail is not null and k.mail = any (coalesce(mails, '{}'::text[])))
              or (length(regexp_replace(coalesce(k.telefono, ''), '\D', '', 'g')) >= 10
                  and right(regexp_replace(k.telefono, '\D', '', 'g'), 10) = any (coalesce(tels, '{}'::text[]))))
    )
    update crm_carritos k
       set compro = true, estado = 'Cerrado - compró', pedido = nullif(o->>'numero', ''),
           monto = case when s.orden = 1 then nullif(o->>'total', '')::numeric end
      from suyos s
     where s.id = k.id;
    get diagnostics n = row_count;
    compraron := compraron + n;
  end loop;

  update crm_carritos
     set estado = 'Cerrado - no compró'
   where not compro
     and creado < now() - interval '30 days'
     and crm_columna(estado, contactado) in ('Pendiente', 'En seguimiento', 'Esperando respuesta');
  get diagnostics vencidos = row_count;

  /* Que lo que se mueva después en la misma transacción no salga como Automático. */
  perform set_config('vdh.crm_quien', '', true);

  return jsonb_build_object('nuevos', nuevos, 'actualizados', actualizados, 'saltados', saltados,
                            'compraron', compraron, 'vencidos', vencidos);
end;
$;
revoke all on function crm_carritos_cargar(jsonb) from public, anon, authenticated;

/* El tablero de carritos: los de los últimos 45 días. "esperando_desde" es
   cuándo pasó a "Esperando respuesta" (para marcar a los que no contestan). */
create or replace function crm_carritos_listar(p_pin text)
returns json language plpgsql volatile security definer set search_path = public as $
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return coalesce((
    select json_agg(to_jsonb(k) || jsonb_build_object(
             'esperando_desde', (select max(m.cuando) from crm_movimientos m
                                  where m.fuente = 'carrito' and m.ref = k.id and m.a = 'Esperando respuesta'))
           order by k.creado desc, k.id desc)
      from crm_carritos k
     where k.creado > now() - interval '45 days'
  ), '[]'::json);
end;
$;
grant execute on function crm_carritos_listar(text) to anon, authenticated;

/* Mover un carrito, anotar, cerrar con monto. Las mismas claves que
   seguimiento_guardar (lo que no aplica a un carrito se ignora). */
create or replace function crm_carrito_guardar(p_pin text, p_id bigint, p_campos jsonb)
returns boolean language plpgsql volatile security definer set search_path = public as $
declare tocadas integer;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if p_campos is null or p_campos = '{}'::jsonb then return true; end if;

  update crm_carritos set
    contactado = case when p_campos ? 'contactado'
                      then coalesce((p_campos->>'contactado')::boolean, false) else contactado end,
    responsable = case when p_campos ? 'responsable' then p_campos->>'responsable' else responsable end,
    contacto1_fecha = case when p_campos ? 'contacto1_fecha'
                           then (p_campos->>'contacto1_fecha')::date else contacto1_fecha end,
    estado = case when p_campos ? 'estado'
                  then (p_campos->>'estado')::estado_seguimiento else estado end,
    obs_seguimiento = case when p_campos ? 'obs_seguimiento'
                           then p_campos->>'obs_seguimiento' else obs_seguimiento end,
    compro = case when p_campos ? 'compro'
                  then coalesce((p_campos->>'compro')::boolean, false) else compro end,
    monto = case when p_campos ? 'compro' and not coalesce((p_campos->>'compro')::boolean, false) then null
                 when p_campos ? 'monto' then (p_campos->>'monto')::numeric
                 else monto end
  where id = p_id;
  get diagnostics tocadas = row_count;
  return tocadas > 0;
end;
$;
grant execute on function crm_carrito_guardar(text, bigint, jsonb) to anon, authenticated;


/* ═══ 3. LOS NÚMEROS DEL CRM ════════════════════════════════════════════
   Del período [p_desde, p_hasta), y de una persona si se pide:
     entraron   los que llegaron en el período (No Compra y carritos)
     ganados    los que pasaron a "Compró" en el período (y siguen ahí), con
                la plata; "contactados" son los que compraron después de
                que alguien les escribiera
     perdidos   los que pasaron a "No compró" o "Descartado"
     primeros   los primeros contactos del período, y cuánto se tardó desde
                que entraron (horas: promedio y el más largo)
     ahora      la foto de hoy: cuántos hay en cada columna, el pendiente
                más viejo, los que hace 2 días o más esperan respuesta y la
                plata de los carritos abiertos
   más por día, por local y por persona. */
create or replace function crm_estadisticas(p_pin text, p_desde timestamptz, p_hasta timestamptz,
                                            p_quien text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $
declare
  res jsonb;
  tz constant text := 'America/Argentina/Buenos_Aires';
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  with
  /* Cada tarjeta, con dónde está hoy, su local, su plata y cuándo entró. */
  fichas as (
    select 'no_compra'::text as fuente, r.id as ref, crm_columna(r.estado, r.contactado) as col,
           r.creado, coalesce(nullif(trim(r.sucursal), ''), 'Sin local') as local, r.monto,
           null::numeric as total, r.contactado,
           (r.contacto1_fecha + time '12:00') at time zone tz as contacto1
      from registros r
    union all
    select 'carrito', k.id, crm_columna(k.estado, k.contactado), k.creado, 'Tienda online', k.monto,
           k.total, k.contactado, (k.contacto1_fecha + time '12:00') at time zone tz
      from crm_carritos k
  ),
  mov as (
    select m.* from crm_movimientos m where m.cuando >= p_desde and m.cuando < p_hasta
  ),
  /* El último paso de cada tarjeta a un cierre, en el período. */
  cierres as (
    select distinct on (m.fuente, m.ref) m.fuente, m.ref, m.a, m.quien, m.cuando
      from mov m
     where m.a in ('Cerrado - compró', 'Cerrado - no compró', 'Descartado')
     order by m.fuente, m.ref, m.cuando desc
  ),
  ganados as (
    select c.*, f.monto, f.contactado, f.local from cierres c
      join fichas f on f.fuente = c.fuente and f.ref = c.ref
     where c.a = 'Cerrado - compró' and f.col = 'Cerrado - compró'
       and (p_quien is null or c.quien = p_quien)
  ),
  perdidos as (
    select c.*, f.local from cierres c
      join fichas f on f.fuente = c.fuente and f.ref = c.ref
     where c.a in ('Cerrado - no compró', 'Descartado') and f.col in ('Cerrado - no compró', 'Descartado')
       and (p_quien is null or c.quien = p_quien)
  ),
  /* El primer contacto de cada tarjeta: la primera vez que salió de
     Pendiente hacia una columna de contacto, movida por una persona. */
  primeros_todos as (
    select distinct on (m.fuente, m.ref) m.fuente, m.ref, m.quien, m.cuando
      from crm_movimientos m
     where m.de = 'Pendiente'
       and m.a in ('En seguimiento', 'Esperando respuesta', 'Cerrado - compró', 'Cerrado - no compró')
       and coalesce(m.quien, '') not in ('', 'Automático')
     order by m.fuente, m.ref, m.cuando
  ),
  primeros as (
    select p.*, extract(epoch from (p.cuando - f.creado)) / 3600.0 as horas
      from primeros_todos p join fichas f on f.fuente = p.fuente and f.ref = p.ref
     where p.cuando >= p_desde and p.cuando < p_hasta
       and (p_quien is null or p.quien = p_quien)
  ),
  entraron as (
    select f.* from fichas f where f.creado >= p_desde and f.creado < p_hasta
  ),
  /* La foto de hoy. */
  esperando as (
    select f.fuente, f.ref,
           coalesce((select max(m.cuando) from crm_movimientos m
                      where m.fuente = f.fuente and m.ref = f.ref and m.a = 'Esperando respuesta'), f.contacto1) as desde
      from fichas f where f.col = 'Esperando respuesta'
  ),
  por_fuente as (
    select x.fuente,
      (select count(*) from entraron e where e.fuente = x.fuente) as entraron,
      (select count(*) from ganados g where g.fuente = x.fuente) as ganados,
      (select coalesce(sum(g.monto), 0) from ganados g where g.fuente = x.fuente) as ganados_monto,
      (select count(*) from ganados g where g.fuente = x.fuente and g.contactado) as ganados_contactados,
      (select count(*) from perdidos q where q.fuente = x.fuente) as perdidos,
      (select count(*) from primeros p where p.fuente = x.fuente) as primeros,
      (select round(avg(p.horas)::numeric, 1) from primeros p where p.fuente = x.fuente) as primero_prom_h,
      (select round(max(p.horas)::numeric, 1) from primeros p where p.fuente = x.fuente) as primero_max_h,
      (select count(*) from fichas f where f.fuente = x.fuente and f.col = 'Pendiente') as pendientes,
      (select coalesce(max(extract(day from now() - f.creado)), 0)::int from fichas f
        where f.fuente = x.fuente and f.col = 'Pendiente') as pendiente_mas_viejo_dias,
      (select count(*) from fichas f where f.fuente = x.fuente and f.col = 'En seguimiento') as seguimiento,
      (select count(*) from fichas f where f.fuente = x.fuente and f.col = 'Esperando respuesta') as esperando,
      (select count(*) from esperando s where s.fuente = x.fuente and s.desde < now() - interval '2 days') as frios,
      (select coalesce(sum(f.total), 0) from fichas f where f.fuente = x.fuente
          and f.col in ('Pendiente', 'En seguimiento', 'Esperando respuesta')) as en_juego
    from (values ('no_compra'), ('carrito')) as x(fuente)
  )
  select jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta, 'quien', p_quien,
    'fuentes', (select jsonb_object_agg(fuente, to_jsonb(por_fuente) - 'fuente') from por_fuente),
    'primero_prom_h', (select round(avg(horas)::numeric, 1) from primeros),
    'primero_max_h', (select round(max(horas)::numeric, 1) from primeros),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'entraron', d.entraron, 'ganados', d.ganados) order by d.dia)
        from (
          select dia, sum(entraron)::int as entraron, sum(ganados)::int as ganados from (
            select (e.creado at time zone tz)::date as dia, 1 as entraron, 0 as ganados from entraron e
            union all
            select (g.cuando at time zone tz)::date, 0, 1 from ganados g
          ) t group by dia
        ) d), '[]'::jsonb),
    'por_local', coalesce((
      select jsonb_agg(jsonb_build_object('local', l.local, 'entraron', l.entraron, 'ganados', l.ganados, 'monto', l.monto)
                       order by l.entraron desc, l.local)
        from (
          select local, sum(entraron)::int as entraron, sum(ganados)::int as ganados, sum(monto) as monto from (
            select e.local, 1 as entraron, 0 as ganados, 0::numeric as monto from entraron e
            union all
            select g.local, 0, 1, coalesce(g.monto, 0) from ganados g
          ) t group by local
        ) l), '[]'::jsonb),
    'por_persona', coalesce((
      select jsonb_agg(jsonb_build_object('quien', q.quien, 'contactos', q.contactos, 'ganados', q.ganados,
                                          'monto', q.monto, 'perdidos', q.perdidos)
                       order by q.ganados desc, q.contactos desc, q.quien)
        from (
          select quien, sum(contactos)::int as contactos, sum(ganados)::int as ganados,
                 sum(monto) as monto, sum(perdidos)::int as perdidos from (
            select p.quien, 1 as contactos, 0 as ganados, 0::numeric as monto, 0 as perdidos from primeros p
            union all
            select g.quien, 0, 1, coalesce(g.monto, 0), 0 from ganados g
            union all
            select q.quien, 0, 0, 0, 1 from perdidos q
          ) t
          where coalesce(quien, '') not in ('', 'Automático')
          group by quien
        ) q), '[]'::jsonb),
    'personas', coalesce((
      select jsonb_agg(distinct m.quien order by m.quien) from crm_movimientos m
       where coalesce(m.quien, '') not in ('', 'Automático') and m.de is not null
         and m.cuando > now() - interval '120 days'), '[]'::jsonb)
  ) into res;
  return res;
end;
$;
grant execute on function crm_estadisticas(text, timestamptz, timestamptz, text) to anon, authenticated;

select 'listo: el CRM propio (el historial, los carritos y los números)' as "SQL 51";


-- ─────────────────────────── PARTE 52 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · EL CRM PROPIO, SEGUNDA PARTE: PLANTILLAS, RECORDATORIOS E HISTORIAL
--
-- Correr en el editor SQL de Supabase, DESPUÉS del 51.
--
-- Pedido de Mauricio (07/10/2026), cuatro cosas para el CRM del Panel:
--
-- 1. PLANTILLAS EDITABLES. Los mensajes de WhatsApp dejan de estar fijos en
--    el código: se crean, se editan, se ordenan y se apagan desde la
--    pestaña Plantillas. Llevan datos que se completan solos ({nombre},
--    {prenda}, {local}, {link}, {total}, {descuento}, {hasta}). Las que ya
--    había quedan cargadas con su título.
-- 2. RECORDATORIOS. "Volver a escribirle el jueves": una fecha y una nota
--    en cada No Compra y cada carrito. Ese día la tarjeta se marca.
-- 3. EL HISTORIAL EN LA FICHA, como el de Kommo: quién lo movió, quién le
--    escribió y con qué plantilla, qué recordatorio se puso.
-- 4. (Guardar el contacto en el celular no necesita nada de la base.)
--
--   crm_plantillas            los mensajes (No Compra y carritos)
--   crm_eventos               lo que no es mover: WhatsApp, recordatorios
--   registros.recordar        y recordar_nota (también en crm_carritos)
--   crm_plantillas_ver / crm_plantilla_guardar / crm_plantilla_borrar /
--   crm_plantillas_ordenar    la pestaña Plantillas (con el PIN)
--   crm_evento_anotar         anotar "le escribió por WhatsApp" (con el PIN)
--   crm_historial             el historial de una ficha (con el PIN)
--   seguimiento_guardar       + el recordatorio (el mismo de siempre)
--   crm_carrito_guardar       + el recordatorio
-- ══════════════════════════════════════════════════════════════════════════

/* ═══ 1. LAS PLANTILLAS ═════════════════════════════════════════════════ */

create table if not exists crm_plantillas (
  id        bigserial primary key,
  fuente    text not null check (fuente in ('no_compra', 'carrito')),
  titulo    text not null check (length(trim(titulo)) between 1 and 60),
  texto     text not null check (length(trim(texto)) between 1 and 1000),
  orden     integer not null default 0,
  activa    boolean not null default true,
  clave     text unique,            -- las que vinieron con el sistema
  creada    timestamptz not null default now(),
  cambiada  timestamptz not null default now()
);
alter table crm_plantillas enable row level security;

/* Las que había, con sus datos entre llaves. Si se corre dos veces no se
   duplican, y si alguien las cambió no se pisan. */
insert into crm_plantillas (fuente, titulo, texto, orden, clave) values
  ('no_compra', 'Novedades',
   '¡Hola {nombre}! Te escribo de VDH {local}. Cuando pasaste por el local no pudimos resolverte {prenda}. Tengo novedades para mostrarte, ¿te paso fotos?',
   1, 'nc_novedades'),
  ('no_compra', 'Tu descuento',
   '¡Hola {nombre}! Te escribo de VDH {local}. Te dejamos un {descuento} de descuento para tu próxima compra en cualquiera de nuestros locales: decí tu teléfono en la caja y te lo aplican.',
   2, 'nc_descuento'),
  ('no_compra', 'Llegó lo que buscabas',
   '¡Hola {nombre}! Te escribo de VDH {local}. ¡Ya tenemos {prenda}! ¿Querés que te lo separemos?',
   3, 'nc_llego'),
  ('no_compra', 'Te lo guardamos',
   '¡Hola {nombre}! Te escribo de VDH {local}. Te separamos {prenda} hasta el {hasta}. Pasá cuando quieras y preguntá por tu nombre.',
   4, 'nc_guardamos'),
  ('no_compra', 'Volver a escribir',
   '¡Hola {nombre}! ¿Pudiste ver lo que te mandé? Si querés te paso más fotos o te lo separamos en VDH {local}.',
   5, 'nc_otravez'),
  ('carrito', 'Te quedó en el carrito',
   '¡Hola {nombre}! Te escribo de VDH. Te quedó en el carrito de vdh.com.ar: {prenda}. Si querés terminar la compra, te lo dejé listo acá: {link}',
   1, 'ca_carrito'),
  ('carrito', '¿Problema con el pago?',
   '¡Hola {nombre}! Te escribo de VDH. Vimos que estabas por terminar tu compra en vdh.com.ar y el pago no se completó. ¿Tuviste algún problema? Si querés, la retomás desde acá: {link}',
   2, 'ca_pago'),
  ('carrito', '¿Dudas con el talle?',
   '¡Hola {nombre}! Te escribo de VDH. ¿Tenés dudas con el talle o el color de {prenda}? Te ayudo a elegir. Tu carrito sigue guardado acá: {link}',
   3, 'ca_talle'),
  ('carrito', 'Volver a escribir',
   '¡Hola {nombre}! ¿Pudiste ver lo que te mandé? Tu carrito sigue guardado: {link}',
   4, 'ca_otravez')
on conflict (clave) do nothing;

create or replace function crm_plantillas_ver(p_pin text)
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return coalesce((select json_agg(to_jsonb(t) order by t.fuente, t.orden, t.id) from crm_plantillas t), '[]'::json);
end;
$$;
grant execute on function crm_plantillas_ver(text) to anon, authenticated;

/* Nueva (p_id null) o cambiada. Una nueva va al final de las suyas. */
create or replace function crm_plantilla_guardar(p_pin text, p_id bigint, p_fuente text, p_titulo text,
                                                 p_texto text, p_activa boolean default true)
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare nuevo bigint;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if coalesce(trim(p_titulo), '') = '' then raise exception 'Falta el título.'; end if;
  if coalesce(trim(p_texto), '') = '' then raise exception 'Falta el mensaje.'; end if;
  if p_id is null then
    insert into crm_plantillas (fuente, titulo, texto, activa, orden)
    values (p_fuente, trim(p_titulo), trim(p_texto), coalesce(p_activa, true),
            coalesce((select max(orden) from crm_plantillas where fuente = p_fuente), 0) + 1)
    returning id into nuevo;
    return nuevo;
  end if;
  update crm_plantillas
     set titulo = trim(p_titulo), texto = trim(p_texto), activa = coalesce(p_activa, activa), cambiada = now()
   where id = p_id;
  return p_id;
end;
$$;
grant execute on function crm_plantilla_guardar(text, bigint, text, text, text, boolean) to anon, authenticated;

create or replace function crm_plantilla_borrar(p_pin text, p_id bigint)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  delete from crm_plantillas where id = p_id;
  return found;
end;
$$;
grant execute on function crm_plantilla_borrar(text, bigint) to anon, authenticated;

/* El orden: el que viene en la lista es el de arriba. */
create or replace function crm_plantillas_ordenar(p_pin text, p_ids bigint[])
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  update crm_plantillas t set orden = x.i, cambiada = now()
    from unnest(p_ids) with ordinality as x(id, i)
   where t.id = x.id;
  return true;
end;
$$;
grant execute on function crm_plantillas_ordenar(text, bigint[]) to anon, authenticated;


/* ═══ 2. LOS RECORDATORIOS Y LO QUE PASA EN CADA FICHA ══════════════════ */

alter table registros add column if not exists recordar date;
alter table registros add column if not exists recordar_nota text;
alter table crm_carritos add column if not exists recordar date;
alter table crm_carritos add column if not exists recordar_nota text;

/* Lo que no es mover de columna: le escribieron por WhatsApp (con qué
   plantilla), le pusieron o sacaron un recordatorio, guardaron su
   contacto. Los movimientos siguen en crm_movimientos. */
create table if not exists crm_eventos (
  id      bigserial primary key,
  fuente  text not null check (fuente in ('no_compra', 'carrito')),
  ref     bigint not null,
  tipo    text not null check (tipo in ('whatsapp', 'recordatorio', 'contacto', 'nota')),
  detalle text,
  quien   text,
  cuando  timestamptz not null default clock_timestamp()   -- el momento justo: va arriba del movimiento de la misma llamada
);
create index if not exists crm_eventos_ref on crm_eventos (fuente, ref, cuando);
alter table crm_eventos enable row level security;

/* El texto del recordatorio para el historial: "para el 10/10 · nota". */
create or replace function crm_recordatorio_txt(p_campos jsonb)
returns text language sql immutable as $$
  select coalesce('para el ' || to_char(nullif(p_campos->>'recordar', '')::date, 'DD/MM'), 'lo quitó')
         || coalesce(' · ' || nullif(trim(p_campos->>'recordar_nota'), ''), '')
$$;

create or replace function crm_evento_anotar(p_pin text, p_fuente text, p_ref bigint, p_tipo text,
                                             p_detalle text, p_quien text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  insert into crm_eventos (fuente, ref, tipo, detalle, quien)
  values (p_fuente, p_ref, p_tipo, nullif(trim(p_detalle), ''), nullif(trim(p_quien), ''));
  return true;
end;
$$;
grant execute on function crm_evento_anotar(text, text, bigint, text, text, text) to anon, authenticated;

/* El historial de una ficha: los movimientos y lo demás, lo último arriba. */
create or replace function crm_historial(p_pin text, p_fuente text, p_ref bigint)
returns json language plpgsql volatile security definer set search_path = public as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return coalesce((
    select json_agg(x order by x.cuando desc, x.n desc) from (
      select m.cuando, 'movimiento'::text as tipo, m.de, m.a, m.quien, null::text as detalle, m.id as n
        from crm_movimientos m where m.fuente = p_fuente and m.ref = p_ref
      union all
      select e.cuando, e.tipo, null, null, e.quien, e.detalle, e.id
        from crm_eventos e where e.fuente = p_fuente and e.ref = p_ref
    ) x), '[]'::json);
end;
$$;
grant execute on function crm_historial(text, text, bigint) to anon, authenticated;

/* El de siempre, + el recordatorio y su renglón en el historial. */
CREATE OR REPLACE FUNCTION public.seguimiento_guardar(p_pin text, p_id bigint, p_campos jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare tocadas integer;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if p_campos is null or p_campos = '{}'::jsonb then return true; end if;

  update registros set
    contactado = case when p_campos ? 'contactado'
                      then coalesce((p_campos->>'contactado')::boolean, false) else contactado end,
    responsable = case when p_campos ? 'responsable'
                       then p_campos->>'responsable' else responsable end,
    contacto1_result = case when p_campos ? 'contacto1_result'
                            then (p_campos->>'contacto1_result')::resultado_contacto else contacto1_result end,
    contacto1_fecha = case when p_campos ? 'contacto1_fecha'
                           then (p_campos->>'contacto1_fecha')::date else contacto1_fecha end,
    estado = case when p_campos ? 'estado'
                  then (p_campos->>'estado')::estado_seguimiento else estado end,
    obs_seguimiento = case when p_campos ? 'obs_seguimiento'
                           then p_campos->>'obs_seguimiento' else obs_seguimiento end,
    compro = case when p_campos ? 'compro'
                  then coalesce((p_campos->>'compro')::boolean, false) else compro end,
    compro_canal = case when p_campos ? 'compro_canal'
                        then (p_campos->>'compro_canal')::canal_venta else compro_canal end,
    producto_final = case when p_campos ? 'producto_final'
                          then p_campos->>'producto_final' else producto_final end,
    monto = case when p_campos ? 'monto'
                 then (p_campos->>'monto')::numeric else monto end,
    /* El recordatorio (SQL 52). */
    recordar = case when p_campos ? 'recordar' then nullif(p_campos->>'recordar', '')::date else recordar end,
    recordar_nota = case when p_campos ? 'recordar_nota' then nullif(trim(p_campos->>'recordar_nota'), '') else recordar_nota end
  where id = p_id;

  get diagnostics tocadas = row_count;

  /* Al historial de la ficha (SQL 52). */
  if tocadas > 0 and p_campos ? 'recordar' then
    insert into crm_eventos (fuente, ref, tipo, detalle, quien)
    values ('no_compra', p_id, 'recordatorio', crm_recordatorio_txt(p_campos),
            crm_quien(coalesce(nullif(trim(p_campos->>'quien'), ''), p_campos->>'responsable')));
  end if;
  return tocadas > 0;
end;
$function$
;

/* Mover un carrito, anotar, cerrar con monto, y ahora el recordatorio. */
create or replace function crm_carrito_guardar(p_pin text, p_id bigint, p_campos jsonb)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare tocadas integer;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if p_campos is null or p_campos = '{}'::jsonb then return true; end if;

  update crm_carritos set
    contactado = case when p_campos ? 'contactado'
                      then coalesce((p_campos->>'contactado')::boolean, false) else contactado end,
    responsable = case when p_campos ? 'responsable' then p_campos->>'responsable' else responsable end,
    contacto1_fecha = case when p_campos ? 'contacto1_fecha'
                           then (p_campos->>'contacto1_fecha')::date else contacto1_fecha end,
    estado = case when p_campos ? 'estado'
                  then (p_campos->>'estado')::estado_seguimiento else estado end,
    obs_seguimiento = case when p_campos ? 'obs_seguimiento'
                           then p_campos->>'obs_seguimiento' else obs_seguimiento end,
    compro = case when p_campos ? 'compro'
                  then coalesce((p_campos->>'compro')::boolean, false) else compro end,
    monto = case when p_campos ? 'compro' and not coalesce((p_campos->>'compro')::boolean, false) then null
                 when p_campos ? 'monto' then (p_campos->>'monto')::numeric
                 else monto end,
    recordar = case when p_campos ? 'recordar' then nullif(p_campos->>'recordar', '')::date else recordar end,
    recordar_nota = case when p_campos ? 'recordar_nota' then nullif(trim(p_campos->>'recordar_nota'), '') else recordar_nota end
  where id = p_id;
  get diagnostics tocadas = row_count;

  if tocadas > 0 and p_campos ? 'recordar' then
    insert into crm_eventos (fuente, ref, tipo, detalle, quien)
    values ('carrito', p_id, 'recordatorio', crm_recordatorio_txt(p_campos),
            crm_quien(coalesce(nullif(trim(p_campos->>'quien'), ''), p_campos->>'responsable')));
  end if;
  return tocadas > 0;
end;
$$;
grant execute on function crm_carrito_guardar(text, bigint, jsonb) to anon, authenticated;

select 'listo: plantillas, recordatorios e historial del CRM' as "SQL 52";


-- ─────────────────────────── PARTE 53 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · EL CRM PROPIO, TERCERA PARTE: POR QUÉ NO COMPRAN, EL CLIENTE ENTERO
-- Y LAS ETIQUETAS
--
-- Correr en el editor SQL de Supabase, DESPUÉS del 52.
--
-- Lo que seguía del plan del 07/10/2026 (puntos 5, 6 y 7):
--
-- 5. MOTIVO DE PÉRDIDA. Al pasar una tarjeta a "No compró" se elige por
--    qué (no contestó, precio, compró en otro lado…). En Números se ve por
--    qué se pierden las ventas. Los carritos que se cierran solos a los 30
--    días quedan con "Pasaron 30 días".
-- 6. LA FICHA COMPLETA DEL CLIENTE. Si es socio del Club, su nivel, sus
--    puntos y sus compras; y las otras veces que vino (otros No Compra,
--    otros carritos). Se cruza por teléfono y por mail.
-- 7. ETIQUETAS LIBRES ("VIP", "Talle especial", "Mayorista") en cada
--    tarjeta.
--
--   registros / crm_carritos  + perdida, perdida_nota, etiquetas
--   crm_etiquetas_limpias     sin repetidas, sin espacios de más, hasta 8
--   crm_cliente               la ficha completa (con el PIN)
--   seguimiento_guardar       + motivo y etiquetas (el mismo de siempre)
--   crm_carrito_guardar       + motivo y etiquetas
--   crm_carritos_cargar       + "Pasaron 30 días" al cerrarlos solo
--   crm_estadisticas          + motivos (por qué no compraron)
-- ══════════════════════════════════════════════════════════════════════════

/* ═══ 1. LAS COLUMNAS ════════════════════════════════════════════════════ */

alter table registros add column if not exists perdida text;
alter table registros add column if not exists perdida_nota text;
alter table registros add column if not exists etiquetas text[] not null default '{}';
alter table crm_carritos add column if not exists perdida text;
alter table crm_carritos add column if not exists perdida_nota text;
alter table crm_carritos add column if not exists etiquetas text[] not null default '{}';

/* Las etiquetas como llegan del Panel: sin repetidas (VIP y vip son la
   misma, queda como se escribió primero), sin espacios de más, hasta 30
   letras cada una y no más de 8. */
create or replace function crm_etiquetas_limpias(p jsonb)
returns text[] language sql immutable as $$
  select coalesce(array_agg(e order by primera), '{}'::text[]) from (
    select (array_agg(e0 order by n))[1] as e, min(n) as primera
      from (select left(regexp_replace(trim(x), '\s+', ' ', 'g'), 30) as e0, n
              from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)
                   with ordinality as t(x, n)) z
     where e0 <> ''
     group by lower(e0)
     order by min(n)
     limit 8
  ) y
$$;

/* Los carritos que ya se cerraron solos (a los 30 días): ese es su motivo. */
update crm_carritos k set perdida = 'Pasaron 30 días'
 where k.estado = 'Cerrado - no compró' and k.perdida is null
   and (select m.quien from crm_movimientos m
         where m.fuente = 'carrito' and m.ref = k.id and m.a = 'Cerrado - no compró'
         order by m.cuando desc, m.id desc limit 1) = 'Automático';


/* ═══ 2. LA FICHA COMPLETA DEL CLIENTE ═══════════════════════════════════ */

/* Lo que sabemos de la persona de una tarjeta, por su teléfono (los últimos
   10 números) o su mail: si es socio del Club —nivel, puntos, compras; sin
   el código, que acá no hace falta— y las otras veces que vino. */
create or replace function crm_cliente(p_pin text, p_fuente text, p_ref bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  tel text; correo text; socio_id bigint; socio jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if p_fuente = 'carrito' then
    select club_tel10(k.telefono), nullif(lower(trim(k.mail)), '') into tel, correo from crm_carritos k where k.id = p_ref;
  else
    select club_tel10(r.whatsapp), nullif(lower(trim(r.mail)), '') into tel, correo from registros r where r.id = p_ref;
  end if;
  if tel is null and correo is null then
    return jsonb_build_object('socio', null, 'otras', '[]'::jsonb);
  end if;

  select c.id into socio_id from club_clientes c
   where c.baja is null
     and ((tel is not null and club_tel10(c.telefono) = tel) or (correo is not null and lower(trim(c.mail)) = correo))
   order by (tel is not null and club_tel10(c.telefono) = tel) desc, c.creado
   limit 1;
  if socio_id is not null then
    select jsonb_build_object('nombre', v.nombre, 'nivel', v.nivel, 'puntos', v.puntos, 'compras', v.compras,
                              'gastado', v.gastado, 'ultima_compra', v.ultima_compra, 'desde', v.creado, 'local', v.local_alta)
      into socio from v_club_clientes v where v.id = socio_id;
  end if;

  return jsonb_build_object(
    'socio', socio,
    'otras', coalesce((
      select jsonb_agg(to_jsonb(o) order by o.creado desc) from (
        select * from (
          select 'no_compra'::text as fuente, r.id, r.creado, r.sucursal as local, r.producto as que, r.talle,
                 crm_columna(r.estado, r.contactado) as columna, null::numeric as total, r.monto
            from registros r
           where not (p_fuente = 'no_compra' and r.id = p_ref)
             and ((tel is not null and club_tel10(r.whatsapp) = tel) or (correo is not null and lower(trim(r.mail)) = correo))
          union all
          select 'carrito', k.id, k.creado, null, k.productos->0->>'nombre', null,
                 crm_columna(k.estado, k.contactado), k.total, k.monto
            from crm_carritos k
           where not (p_fuente = 'carrito' and k.id = p_ref)
             and ((tel is not null and club_tel10(k.telefono) = tel) or (correo is not null and k.mail = correo))
        ) t order by creado desc limit 12
      ) o), '[]'::jsonb));
end;
$$;
grant execute on function crm_cliente(text, text, bigint) to anon, authenticated;

/* El de siempre (con el recordatorio del 52), + el motivo de pérdida y las etiquetas. */
CREATE OR REPLACE FUNCTION public.seguimiento_guardar(p_pin text, p_id bigint, p_campos jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare tocadas integer;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if p_campos is null or p_campos = '{}'::jsonb then return true; end if;

  update registros set
    contactado = case when p_campos ? 'contactado'
                      then coalesce((p_campos->>'contactado')::boolean, false) else contactado end,
    responsable = case when p_campos ? 'responsable'
                       then p_campos->>'responsable' else responsable end,
    contacto1_result = case when p_campos ? 'contacto1_result'
                            then (p_campos->>'contacto1_result')::resultado_contacto else contacto1_result end,
    contacto1_fecha = case when p_campos ? 'contacto1_fecha'
                           then (p_campos->>'contacto1_fecha')::date else contacto1_fecha end,
    estado = case when p_campos ? 'estado'
                  then (p_campos->>'estado')::estado_seguimiento else estado end,
    obs_seguimiento = case when p_campos ? 'obs_seguimiento'
                           then p_campos->>'obs_seguimiento' else obs_seguimiento end,
    compro = case when p_campos ? 'compro'
                  then coalesce((p_campos->>'compro')::boolean, false) else compro end,
    compro_canal = case when p_campos ? 'compro_canal'
                        then (p_campos->>'compro_canal')::canal_venta else compro_canal end,
    producto_final = case when p_campos ? 'producto_final'
                          then p_campos->>'producto_final' else producto_final end,
    monto = case when p_campos ? 'monto'
                 then (p_campos->>'monto')::numeric else monto end,
    /* El recordatorio (SQL 52). */
    recordar = case when p_campos ? 'recordar' then nullif(p_campos->>'recordar', '')::date else recordar end,
    recordar_nota = case when p_campos ? 'recordar_nota' then nullif(trim(p_campos->>'recordar_nota'), '') else recordar_nota end,
    /* Por qué no compró (SQL 53). Si sale de "No compró", se borra. */
    perdida = case when p_campos ? 'perdida' then nullif(trim(p_campos->>'perdida'), '')
                   when p_campos ? 'estado' and (p_campos->>'estado') is distinct from 'Cerrado - no compró' then null
                   else perdida end,
    perdida_nota = case when p_campos ? 'perdida_nota' then nullif(trim(p_campos->>'perdida_nota'), '')
                        when p_campos ? 'estado' and (p_campos->>'estado') is distinct from 'Cerrado - no compró' then null
                        else perdida_nota end,
    /* Las etiquetas (SQL 53). */
    etiquetas = case when p_campos ? 'etiquetas' then crm_etiquetas_limpias(p_campos->'etiquetas') else etiquetas end
  where id = p_id;

  get diagnostics tocadas = row_count;

  /* Al historial de la ficha (SQL 52). */
  if tocadas > 0 and p_campos ? 'recordar' then
    insert into crm_eventos (fuente, ref, tipo, detalle, quien)
    values ('no_compra', p_id, 'recordatorio', crm_recordatorio_txt(p_campos),
            crm_quien(coalesce(nullif(trim(p_campos->>'quien'), ''), p_campos->>'responsable')));
  end if;
  return tocadas > 0;
end;
$function$
;

/* Lo mismo para los carritos. */
CREATE OR REPLACE FUNCTION public.crm_carrito_guardar(p_pin text, p_id bigint, p_campos jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare tocadas integer;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if p_campos is null or p_campos = '{}'::jsonb then return true; end if;

  update crm_carritos set
    contactado = case when p_campos ? 'contactado'
                      then coalesce((p_campos->>'contactado')::boolean, false) else contactado end,
    responsable = case when p_campos ? 'responsable' then p_campos->>'responsable' else responsable end,
    contacto1_fecha = case when p_campos ? 'contacto1_fecha'
                           then (p_campos->>'contacto1_fecha')::date else contacto1_fecha end,
    estado = case when p_campos ? 'estado'
                  then (p_campos->>'estado')::estado_seguimiento else estado end,
    obs_seguimiento = case when p_campos ? 'obs_seguimiento'
                           then p_campos->>'obs_seguimiento' else obs_seguimiento end,
    compro = case when p_campos ? 'compro'
                  then coalesce((p_campos->>'compro')::boolean, false) else compro end,
    monto = case when p_campos ? 'compro' and not coalesce((p_campos->>'compro')::boolean, false) then null
                 when p_campos ? 'monto' then (p_campos->>'monto')::numeric
                 else monto end,
    recordar = case when p_campos ? 'recordar' then nullif(p_campos->>'recordar', '')::date else recordar end,
    recordar_nota = case when p_campos ? 'recordar_nota' then nullif(trim(p_campos->>'recordar_nota'), '') else recordar_nota end,
    /* Por qué no compró (SQL 53). Si sale de "No compró", se borra. */
    perdida = case when p_campos ? 'perdida' then nullif(trim(p_campos->>'perdida'), '')
                   when p_campos ? 'estado' and (p_campos->>'estado') is distinct from 'Cerrado - no compró' then null
                   else perdida end,
    perdida_nota = case when p_campos ? 'perdida_nota' then nullif(trim(p_campos->>'perdida_nota'), '')
                        when p_campos ? 'estado' and (p_campos->>'estado') is distinct from 'Cerrado - no compró' then null
                        else perdida_nota end,
    /* Las etiquetas (SQL 53). */
    etiquetas = case when p_campos ? 'etiquetas' then crm_etiquetas_limpias(p_campos->'etiquetas') else etiquetas end
  where id = p_id;
  get diagnostics tocadas = row_count;

  if tocadas > 0 and p_campos ? 'recordar' then
    insert into crm_eventos (fuente, ref, tipo, detalle, quien)
    values ('carrito', p_id, 'recordatorio', crm_recordatorio_txt(p_campos),
            crm_quien(coalesce(nullif(trim(p_campos->>'quien'), ''), p_campos->>'responsable')));
  end if;
  return tocadas > 0;
end;
$function$
;

/* La carga de cada hora, igual: sólo que al cerrar uno a los 30 días anota el motivo. */
CREATE OR REPLACE FUNCTION public.crm_carritos_cargar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c jsonb; o jsonb;
  nuevos integer := 0; actualizados integer := 0; saltados integer := 0;
  compraron integer := 0; vencidos integer := 0; n integer; esnuevo boolean;
  mails text[]; tels text[]; cuando timestamptz;
begin
  perform set_config('vdh.crm_quien', 'Automático', true);

  for c in select value from jsonb_array_elements(coalesce(p->'carritos', '[]'::jsonb)) loop
    if coalesce(nullif(c->>'total', '')::numeric, 0) <= 0
       or jsonb_array_length(coalesce(c->'productos', '[]'::jsonb)) = 0 then
      saltados := saltados + 1;
      continue;
    end if;
    insert into crm_carritos as k (id, token, creado, actualizado, nombre, mail, telefono, total, moneda, url,
                                   productos, casi_pago, visto)
    values ((c->>'id')::bigint, nullif(c->>'token', ''), (c->>'creado')::timestamptz,
            nullif(c->>'actualizado', '')::timestamptz, nullif(trim(c->>'nombre'), ''),
            nullif(lower(trim(c->>'mail')), ''), nullif(trim(c->>'telefono'), ''),
            (c->>'total')::numeric, nullif(c->>'moneda', ''), nullif(c->>'url', ''),
            coalesce(c->'productos', '[]'::jsonb), coalesce((c->>'casi_pago')::boolean, false), now())
    on conflict (id) do update set
      actualizado = excluded.actualizado,
      nombre      = coalesce(excluded.nombre, k.nombre),
      mail        = coalesce(excluded.mail, k.mail),
      telefono    = coalesce(excluded.telefono, k.telefono),
      total       = excluded.total,
      moneda      = coalesce(excluded.moneda, k.moneda),
      url         = coalesce(excluded.url, k.url),
      productos   = excluded.productos,
      casi_pago   = k.casi_pago or excluded.casi_pago,
      visto       = now()
    returning (xmax = 0) into esnuevo;
    if esnuevo then nuevos := nuevos + 1; else actualizados := actualizados + 1; end if;

    /* Si Tienda Nube ya lo da por completado, compró. */
    if nullif(c->>'completado', '') is not null then
      update crm_carritos
         set compro = true, estado = 'Cerrado - compró', monto = coalesce(monto, total)
       where id = (c->>'id')::bigint and not compro;
      get diagnostics n = row_count;
      compraron := compraron + n;
    end if;
  end loop;

  for o in select value from jsonb_array_elements(coalesce(p->'pedidos', '[]'::jsonb)) loop
    cuando := (o->>'creado')::timestamptz;
    select array_agg(distinct lower(trim(x))) into mails
      from jsonb_array_elements_text(coalesce(o->'mails', '[]'::jsonb)) x where x like '%_@_%';
    select array_agg(distinct right(regexp_replace(x, '\D', '', 'g'), 10)) into tels
      from jsonb_array_elements_text(coalesce(o->'telefonos', '[]'::jsonb)) x
     where length(regexp_replace(x, '\D', '', 'g')) >= 10;
    if mails is null and tels is null then continue; end if;

    with suyos as (
      select k.id, row_number() over (order by k.creado desc) as orden
        from crm_carritos k
       where not k.compro
         and k.creado <= cuando
         and k.creado > cuando - interval '30 days'
         and ((k.mail is not null and k.mail = any (coalesce(mails, '{}'::text[])))
              or (length(regexp_replace(coalesce(k.telefono, ''), '\D', '', 'g')) >= 10
                  and right(regexp_replace(k.telefono, '\D', '', 'g'), 10) = any (coalesce(tels, '{}'::text[]))))
    )
    update crm_carritos k
       set compro = true, estado = 'Cerrado - compró', pedido = nullif(o->>'numero', ''),
           monto = case when s.orden = 1 then nullif(o->>'total', '')::numeric end
      from suyos s
     where s.id = k.id;
    get diagnostics n = row_count;
    compraron := compraron + n;
  end loop;

  update crm_carritos
     set estado = 'Cerrado - no compró', perdida = coalesce(perdida, 'Pasaron 30 días')
   where not compro
     and creado < now() - interval '30 days'
     and crm_columna(estado, contactado) in ('Pendiente', 'En seguimiento', 'Esperando respuesta');
  get diagnostics vencidos = row_count;

  /* Que lo que se mueva después en la misma transacción no salga como Automático. */
  perform set_config('vdh.crm_quien', '', true);

  return jsonb_build_object('nuevos', nuevos, 'actualizados', actualizados, 'saltados', saltados,
                            'compraron', compraron, 'vencidos', vencidos);
end;
$function$
;

/* Los números del CRM (SQL 51), + por qué no compraron. */
CREATE OR REPLACE FUNCTION public.crm_estadisticas(p_pin text, p_desde timestamp with time zone, p_hasta timestamp with time zone, p_quien text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  res jsonb;
  tz constant text := 'America/Argentina/Buenos_Aires';
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  with
  /* Cada tarjeta, con dónde está hoy, su local, su plata y cuándo entró. */
  fichas as (
    select 'no_compra'::text as fuente, r.id as ref, crm_columna(r.estado, r.contactado) as col,
           r.creado, coalesce(nullif(trim(r.sucursal), ''), 'Sin local') as local, r.monto,
           null::numeric as total, r.contactado,
           (r.contacto1_fecha + time '12:00') at time zone tz as contacto1, r.perdida
      from registros r
    union all
    select 'carrito', k.id, crm_columna(k.estado, k.contactado), k.creado, 'Tienda online', k.monto,
           k.total, k.contactado, (k.contacto1_fecha + time '12:00') at time zone tz, k.perdida
      from crm_carritos k
  ),
  mov as (
    select m.* from crm_movimientos m where m.cuando >= p_desde and m.cuando < p_hasta
  ),
  /* El último paso de cada tarjeta a un cierre, en el período. */
  cierres as (
    select distinct on (m.fuente, m.ref) m.fuente, m.ref, m.a, m.quien, m.cuando
      from mov m
     where m.a in ('Cerrado - compró', 'Cerrado - no compró', 'Descartado')
     order by m.fuente, m.ref, m.cuando desc
  ),
  ganados as (
    select c.*, f.monto, f.contactado, f.local from cierres c
      join fichas f on f.fuente = c.fuente and f.ref = c.ref
     where c.a = 'Cerrado - compró' and f.col = 'Cerrado - compró'
       and (p_quien is null or c.quien = p_quien)
  ),
  perdidos as (
    select c.*, f.local, f.perdida from cierres c
      join fichas f on f.fuente = c.fuente and f.ref = c.ref
     where c.a in ('Cerrado - no compró', 'Descartado') and f.col in ('Cerrado - no compró', 'Descartado')
       and (p_quien is null or c.quien = p_quien)
  ),
  /* El primer contacto de cada tarjeta: la primera vez que salió de
     Pendiente hacia una columna de contacto, movida por una persona. */
  primeros_todos as (
    select distinct on (m.fuente, m.ref) m.fuente, m.ref, m.quien, m.cuando
      from crm_movimientos m
     where m.de = 'Pendiente'
       and m.a in ('En seguimiento', 'Esperando respuesta', 'Cerrado - compró', 'Cerrado - no compró')
       and coalesce(m.quien, '') not in ('', 'Automático')
     order by m.fuente, m.ref, m.cuando
  ),
  primeros as (
    select p.*, extract(epoch from (p.cuando - f.creado)) / 3600.0 as horas
      from primeros_todos p join fichas f on f.fuente = p.fuente and f.ref = p.ref
     where p.cuando >= p_desde and p.cuando < p_hasta
       and (p_quien is null or p.quien = p_quien)
  ),
  entraron as (
    select f.* from fichas f where f.creado >= p_desde and f.creado < p_hasta
  ),
  /* La foto de hoy. */
  esperando as (
    select f.fuente, f.ref,
           coalesce((select max(m.cuando) from crm_movimientos m
                      where m.fuente = f.fuente and m.ref = f.ref and m.a = 'Esperando respuesta'), f.contacto1) as desde
      from fichas f where f.col = 'Esperando respuesta'
  ),
  por_fuente as (
    select x.fuente,
      (select count(*) from entraron e where e.fuente = x.fuente) as entraron,
      (select count(*) from ganados g where g.fuente = x.fuente) as ganados,
      (select coalesce(sum(g.monto), 0) from ganados g where g.fuente = x.fuente) as ganados_monto,
      (select count(*) from ganados g where g.fuente = x.fuente and g.contactado) as ganados_contactados,
      (select count(*) from perdidos q where q.fuente = x.fuente) as perdidos,
      (select count(*) from primeros p where p.fuente = x.fuente) as primeros,
      (select round(avg(p.horas)::numeric, 1) from primeros p where p.fuente = x.fuente) as primero_prom_h,
      (select round(max(p.horas)::numeric, 1) from primeros p where p.fuente = x.fuente) as primero_max_h,
      (select count(*) from fichas f where f.fuente = x.fuente and f.col = 'Pendiente') as pendientes,
      (select coalesce(max(extract(day from now() - f.creado)), 0)::int from fichas f
        where f.fuente = x.fuente and f.col = 'Pendiente') as pendiente_mas_viejo_dias,
      (select count(*) from fichas f where f.fuente = x.fuente and f.col = 'En seguimiento') as seguimiento,
      (select count(*) from fichas f where f.fuente = x.fuente and f.col = 'Esperando respuesta') as esperando,
      (select count(*) from esperando s where s.fuente = x.fuente and s.desde < now() - interval '2 days') as frios,
      (select coalesce(sum(f.total), 0) from fichas f where f.fuente = x.fuente
          and f.col in ('Pendiente', 'En seguimiento', 'Esperando respuesta')) as en_juego
    from (values ('no_compra'), ('carrito')) as x(fuente)
  )
  select jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta, 'quien', p_quien,
    'fuentes', (select jsonb_object_agg(fuente, to_jsonb(por_fuente) - 'fuente') from por_fuente),
    'primero_prom_h', (select round(avg(horas)::numeric, 1) from primeros),
    'primero_max_h', (select round(max(horas)::numeric, 1) from primeros),
    /* Por qué no compraron (SQL 53): los que pasaron a "No compró" en el período. */
    'motivos', coalesce((
      select jsonb_agg(jsonb_build_object('motivo', m.motivo, 'no_compra', m.nc, 'carrito', m.ca, 'total', m.total)
                       order by m.total desc, m.motivo)
        from (
          select coalesce(q.perdida, 'Sin motivo') as motivo,
                 count(*) filter (where q.fuente = 'no_compra')::int as nc,
                 count(*) filter (where q.fuente = 'carrito')::int as ca,
                 count(*)::int as total
            from perdidos q where q.a = 'Cerrado - no compró'
           group by 1
        ) m), '[]'::jsonb),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'entraron', d.entraron, 'ganados', d.ganados) order by d.dia)
        from (
          select dia, sum(entraron)::int as entraron, sum(ganados)::int as ganados from (
            select (e.creado at time zone tz)::date as dia, 1 as entraron, 0 as ganados from entraron e
            union all
            select (g.cuando at time zone tz)::date, 0, 1 from ganados g
          ) t group by dia
        ) d), '[]'::jsonb),
    'por_local', coalesce((
      select jsonb_agg(jsonb_build_object('local', l.local, 'entraron', l.entraron, 'ganados', l.ganados, 'monto', l.monto)
                       order by l.entraron desc, l.local)
        from (
          select local, sum(entraron)::int as entraron, sum(ganados)::int as ganados, sum(monto) as monto from (
            select e.local, 1 as entraron, 0 as ganados, 0::numeric as monto from entraron e
            union all
            select g.local, 0, 1, coalesce(g.monto, 0) from ganados g
          ) t group by local
        ) l), '[]'::jsonb),
    'por_persona', coalesce((
      select jsonb_agg(jsonb_build_object('quien', q.quien, 'contactos', q.contactos, 'ganados', q.ganados,
                                          'monto', q.monto, 'perdidos', q.perdidos)
                       order by q.ganados desc, q.contactos desc, q.quien)
        from (
          select quien, sum(contactos)::int as contactos, sum(ganados)::int as ganados,
                 sum(monto) as monto, sum(perdidos)::int as perdidos from (
            select p.quien, 1 as contactos, 0 as ganados, 0::numeric as monto, 0 as perdidos from primeros p
            union all
            select g.quien, 0, 1, coalesce(g.monto, 0), 0 from ganados g
            union all
            select q.quien, 0, 0, 0, 1 from perdidos q
          ) t
          where coalesce(quien, '') not in ('', 'Automático')
          group by quien
        ) q), '[]'::jsonb),
    'personas', coalesce((
      select jsonb_agg(distinct m.quien order by m.quien) from crm_movimientos m
       where coalesce(m.quien, '') not in ('', 'Automático') and m.de is not null
         and m.cuando > now() - interval '120 days'), '[]'::jsonb)
  ) into res;
  return res;
end;
$function$
;

select 'listo: motivo de pérdida, ficha completa del cliente y etiquetas' as "SQL 53";


-- ─────────────────────────── PARTE 60 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · AVISO DE LOS CARRITOS "CASI PAGÓ"
--
-- Correr en el editor SQL de Supabase.
--
-- Pedido de Mauricio (08/10/2026, "hacé las mejoras rápidas"): cuando
-- alguien llega al pago en vdh.com.ar y no termina, que Atención se entere
-- en la hora y no cuando abre el CRM. Es el cliente más caliente que hay.
--   · El robot de cada hora, después de traer los carritos, llama a
--     avisar_casi_pago(): un solo mensaje al grupo con los nuevos, de 10 a
--     21 (lo que entra de noche sale a las 10).
--   · Cada carrito se avisa UNA vez (casi_avisado). Los que ya estaban no
--     se avisan: es para los nuevos de acá en adelante.
--   · Sólo los pendientes: si alguien ya le escribió o ya compró, no.
-- ══════════════════════════════════════════════════════════════════════════

alter table crm_carritos add column if not exists casi_avisado timestamptz;

-- Los que ya están: no se avisan.
update crm_carritos set casi_avisado = now() where casi_pago and casi_avisado is null;

/* El mensaje, sin mandarlo (se puede probar). Los más caros primero. */
create or replace function avisar_casi_pago_mensaje()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l       record;
  lineas  text[] := '{}';
  ids     bigint[] := '{}';
  n       integer := 0;
  prenda  text;
  mas     integer;
begin
  for l in
    select k.id, k.nombre, k.total, k.productos
      from crm_carritos k
     where k.casi_pago and k.casi_avisado is null
       and k.estado is null and not k.contactado and not k.compro
       and k.creado > now() - interval '3 days'
     order by k.total desc nulls last, k.creado desc
  loop
    n := n + 1;
    ids := ids || l.id;
    if n <= 10 then
      prenda := nullif(trim(coalesce(l.productos->0->>'nombre', '')), '');
      mas := greatest(jsonb_array_length(coalesce(l.productos, '[]'::jsonb)) - 1, 0);
      lineas := lineas || ('• <b>' || esc_html(coalesce(nullif(trim(l.nombre), ''), 'Sin nombre')) || '</b> · $' ||
        replace(to_char(round(coalesce(l.total, 0))::bigint, 'FM999,999,999'), ',', '.') ||
        coalesce(' · ' || esc_html(prenda), '') ||
        case when mas > 0 then ' y ' || mas || ' más' else '' end);
    end if;
  end loop;
  if n = 0 then return jsonb_build_object('n', 0); end if;
  return jsonb_build_object('n', n, 'ids', to_jsonb(ids), 'texto',
    '🛒 <b>Casi pagaron</b> (' || n || ')' || E'\n' ||
    'Llegaron al pago en vdh.com.ar y no terminaron:' || E'\n' ||
    array_to_string(lineas, E'\n') ||
    case when n > 10 then E'\n…y ' || (n - 10) || ' más: están en el CRM.' else '' end ||
    E'\n\nEscribiles hoy: es la venta más cerca de cerrarse.');
end;
$$;

/* Lo manda (de 10 a 21) y marca los avisados. */
create or replace function avisar_casi_pago()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  token     text := secreto('TELEGRAM_TOKEN');
  chat      text := secreto('TELEGRAM_CHAT');
  hora      integer := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires');
  m         jsonb;
  cuerpo    jsonb;
  respuesta extensions.http_response;
  salida    jsonb;
begin
  if token is null or chat is null then return jsonb_build_object('avisados', 0, 'porque', 'Telegram no está configurado'); end if;
  if hora < 10 or hora >= 21 then return jsonb_build_object('avisados', 0, 'porque', 'fuera de horario'); end if;
  m := avisar_casi_pago_mensaje();
  if (m->>'n')::integer = 0 then return jsonb_build_object('avisados', 0); end if;
  cuerpo := jsonb_build_object('chat_id', chat, 'text', m->>'texto', 'parse_mode', 'HTML', 'disable_web_page_preview', true,
    'reply_markup', jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(
      jsonb_build_object('text', 'Abrir en el CRM', 'url', coalesce(secreto('SITIO'), '') || 'panel.html#casi-pago')))));
  perform paciencia();
  respuesta := extensions.http_post('https://api.telegram.org/bot' || token || '/sendMessage', cuerpo::text, 'application/json');
  begin salida := respuesta.content::jsonb; exception when others then salida := null; end;
  if respuesta.status >= 300 or coalesce((salida->>'ok')::boolean, false) = false then
    raise exception 'Telegram respondió % · %', respuesta.status, left(coalesce(salida->>'description', respuesta.content, ''), 200);
  end if;
  update crm_carritos set casi_avisado = now()
   where id in (select (jsonb_array_elements_text(m->'ids'))::bigint);
  return jsonb_build_object('avisados', (m->>'n')::integer);
end;
$$;

/* Sólo el robot: nadie de afuera puede mandar mensajes al grupo. */
revoke execute on function avisar_casi_pago_mensaje() from public, anon, authenticated;
revoke execute on function avisar_casi_pago() from public, anon, authenticated;

select 'listo: el aviso de "casi pagó"' as "SQL 60";


-- ─────────────────────────── PARTE 61 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · CONTACTOS DEL CRM, CON LOS COMPRADORES DE VDH.COM.AR
--
-- Correr en el editor SQL de Supabase.
--
-- Pedido de Mauricio (09/10/2026), mirando el Inbox de Kommo: una pestaña
-- "Contactos" en el CRM con UNA fila por persona, venga de donde venga.
--   · Junta los No Compra, los carritos, los socios del Club (y lo que
--     compran en los locales) y —nuevo— los que compraron en vdh.com.ar.
--   · A la misma persona se la reconoce por el teléfono (los últimos 10
--     números) y, si alguna vez dejó sólo el mail, por el mail.
--   · Los pedidos de la tienda los trae el robot de cada hora a
--     tienda_pedidos: sólo con qué reconocer a la persona y qué compró.
--   · Todo detrás del PIN, como el resto del CRM: hay nombres y teléfonos.
-- Cuando esté conectado Meta, en la misma ficha van a ir los mensajes.
-- ══════════════════════════════════════════════════════════════════════════

/* Los pedidos de vdh.com.ar. El id es el de Tienda Nube. "acepta" es si el
   cliente aceptó recibir novedades, cuando la tienda lo dice (si no, null). */
create table if not exists tienda_pedidos (
  id          bigint primary key,
  numero      text,
  creado      timestamptz not null,
  pagado      timestamptz,
  actualizado timestamptz,
  pago        text,
  estado      text,
  total       numeric(12,2),
  nombre      text,
  telefono    text,
  mail        text,
  cliente_tn  bigint,
  acepta      boolean,
  productos   jsonb not null default '[]'::jsonb,
  visto       timestamptz not null default now()
);
create index if not exists tienda_pedidos_tel  on tienda_pedidos (club_tel10(telefono));
create index if not exists tienda_pedidos_mail on tienda_pedidos (mail);
create index if not exists tienda_pedidos_act  on tienda_pedidos (actualizado);
alter table tienda_pedidos enable row level security;
revoke all on tienda_pedidos from anon, authenticated;

/* El robot los carga de a tandas. Si el pedido ya estaba, lo actualiza
   (cambia el pago, se cancela). Sólo el robot: nadie de afuera. */
create or replace function tienda_pedidos_cargar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  x jsonb;
  recibidos integer := 0;
  nuevos integer := 0;
  era_nuevo boolean;
begin
  for x in select * from jsonb_array_elements(coalesce(p->'pedidos', '[]'::jsonb)) loop
    recibidos := recibidos + 1;
    insert into tienda_pedidos (id, numero, creado, pagado, actualizado, pago, estado, total,
                                nombre, telefono, mail, cliente_tn, acepta, productos, visto)
    values ((x->>'id')::bigint, x->>'numero', (x->>'creado')::timestamptz, (x->>'pagado')::timestamptz,
            (x->>'actualizado')::timestamptz, x->>'pago', x->>'estado', nullif(x->>'total', '')::numeric,
            nullif(trim(x->>'nombre'), ''), nullif(trim(x->>'telefono'), ''), nullif(lower(trim(x->>'mail')), ''),
            nullif(x->>'cliente_tn', '')::bigint, (x->>'acepta')::boolean, coalesce(x->'productos', '[]'::jsonb), now())
    on conflict (id) do update set
      numero = excluded.numero, pagado = excluded.pagado, actualizado = excluded.actualizado,
      pago = excluded.pago, estado = excluded.estado, total = excluded.total, nombre = excluded.nombre,
      telefono = excluded.telefono, mail = excluded.mail, cliente_tn = excluded.cliente_tn,
      acepta = excluded.acepta, productos = excluded.productos, visto = now()
    returning (xmax = 0) into era_nuevo;
    if era_nuevo then nuevos := nuevos + 1; end if;
  end loop;
  return jsonb_build_object('recibidos', recibidos, 'nuevos', nuevos,
                            'en_total', (select count(*) from tienda_pedidos));
end;
$$;
revoke execute on function tienda_pedidos_cargar(jsonb) from public, anon, authenticated;

/* Todo lo que pasó con cada persona, de todos lados, con su "clave": el
   teléfono (10 números) o, si nunca dejó teléfono, el mail. Es la base de
   la lista y de la ficha; no se llama desde afuera. */
create or replace function crm_contactos_base()
returns table (clave text, fuente text, ref bigint, cuando timestamptz, nombre text, tel text, mail text,
               datos jsonb, monto numeric, abierta boolean, etiquetas text[], nivel text, acepta boolean)
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select 'no_compra'::text as fuente, r.id as ref, r.creado as cuando, nullif(trim(r.nombre), '') as nombre,
           club_tel10(r.whatsapp) as tel, nullif(lower(trim(r.mail)), '') as mail,
           jsonb_build_object('local', r.sucursal, 'producto', r.producto, 'talle', r.talle, 'motivo', r.motivo::text,
                              'columna', crm_columna(r.estado, r.contactado), 'monto', r.monto) as datos,
           case when r.compro then r.monto end as monto,
           crm_columna(r.estado, r.contactado) not in ('Cerrado - compró', 'Cerrado - no compró', 'Descartado') as abierta,
           coalesce(r.etiquetas, '{}'::text[]) as etiquetas, null::text as nivel, null::boolean as acepta
      from registros r
    union all
    select 'carrito', k.id, k.creado, nullif(trim(k.nombre), ''), club_tel10(k.telefono), nullif(lower(trim(k.mail)), ''),
           jsonb_build_object('total', k.total, 'producto', k.productos->0->>'nombre',
                              'mas', greatest(jsonb_array_length(k.productos) - 1, 0), 'casi_pago', k.casi_pago,
                              'columna', crm_columna(k.estado, k.contactado), 'monto', k.monto),
           case when k.compro then k.monto end,
           crm_columna(k.estado, k.contactado) not in ('Cerrado - compró', 'Cerrado - no compró', 'Descartado'),
           coalesce(k.etiquetas, '{}'::text[]), null, null
      from crm_carritos k
    union all
    select 'club', c.id, c.creado, nullif(trim(c.nombre), ''), club_tel10(c.telefono), nullif(lower(trim(c.mail)), ''),
           jsonb_build_object('tipo', 'alta', 'local', c.local_alta, 'nivel', v.nivel, 'puntos', v.puntos),
           null, false, '{}'::text[], v.nivel, (c.acepta_promos and c.revocado is null)
      from club_clientes c join v_club_clientes v on v.id = c.id
     where c.baja is null
    union all
    select 'club', m.id, m.creado, nullif(trim(c.nombre), ''), club_tel10(c.telefono), nullif(lower(trim(c.mail)), ''),
           jsonb_build_object('tipo', 'compra', 'local', m.local, 'importe', m.importe, 'puntos', m.puntos),
           m.importe, false, '{}'::text[], null, null
      from club_movimientos m join club_clientes c on c.id = m.cliente
     where m.tipo::text = 'compra' and m.anulado is null and c.baja is null
    union all
    select 'tienda', t.id, coalesce(t.pagado, t.creado), t.nombre, club_tel10(t.telefono), t.mail,
           jsonb_build_object('numero', t.numero, 'total', t.total, 'producto', t.productos->0->>'nombre',
                              'mas', greatest(jsonb_array_length(t.productos) - 1, 0)),
           t.total, false, '{}'::text[], null, t.acepta
      from tienda_pedidos t
     where t.pago = 'paid' and coalesce(t.estado, '') <> 'cancelled'
  ),
  /* El teléfono de cada mail: así el que una vez dejó sólo el mail cae en
     la misma persona que cuando dejó el teléfono. */
  mt as (
    select distinct on (mail) mail, tel from f
     where mail is not null and tel is not null
     order by mail, cuando desc
  )
  select coalesce(f.tel, mt.tel, 'm:' || f.mail) as clave, f.*
    from f left join mt on mt.mail = f.mail
   where coalesce(f.tel, mt.tel, f.mail) is not null
$$;
revoke execute on function crm_contactos_base() from public, anon, authenticated;

/* La lista: una fila por persona, lo último que pasó arriba. Con buscador
   (nombre, teléfono, mail o etiqueta) y por de dónde vino. Las cuentas son
   de lo buscado, para las pastillas. */
create or replace function crm_contactos(p_pin text, p_buscar text default null, p_fuente text default null,
                                         p_limite integer default 300)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q  text := nullif(lower(trim(coalesce(p_buscar, ''))), '');
  qd text := nullif(regexp_replace(coalesce(p_buscar, ''), '[^0-9]', '', 'g'), '');
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  with b as (select * from crm_contactos_base()),
  e as (select b.clave, array_agg(distinct x order by x) as etiquetas from b, unnest(b.etiquetas) x group by b.clave),
  p as (
    select b.clave,
           (array_agg(b.nombre order by b.cuando desc) filter (where b.nombre is not null))[1] as nombre,
           max(b.tel) as tel,
           (array_agg(b.mail order by b.cuando desc) filter (where b.mail is not null))[1] as mail,
           array_agg(distinct b.fuente) as fuentes,
           max(b.cuando) as ultima,
           (array_agg(b.datos || jsonb_build_object('fuente', b.fuente, 'ref', b.ref) order by b.cuando desc))[1] as ultimo,
           count(*) filter (where b.fuente = 'tienda') as compras_tienda,
           coalesce(sum(b.monto) filter (where b.fuente = 'tienda'), 0) as gastado_tienda,
           count(*) filter (where b.abierta) as abiertas,
           max(b.nivel) as nivel,
           bool_or(b.acepta) as acepta
      from b group by b.clave
  ),
  pe as (select p.*, coalesce(e.etiquetas, '{}'::text[]) as etq from p left join e on e.clave = p.clave),
  filtrado as (
    select * from pe
     where q is null
        or lower(coalesce(pe.nombre, '')) like '%' || q || '%'
        or coalesce(pe.mail, '') like '%' || q || '%'
        or (qd is not null and length(qd) >= 3 and coalesce(pe.tel, '') like '%' || qd || '%')
        or exists (select 1 from unnest(pe.etq) x where lower(x) like '%' || q || '%')
  )
  select jsonb_build_object(
           'cuentas', jsonb_build_object(
             'todos', count(*),
             'tienda', count(*) filter (where 'tienda' = any(fuentes)),
             'carrito', count(*) filter (where 'carrito' = any(fuentes)),
             'no_compra', count(*) filter (where 'no_compra' = any(fuentes)),
             'club', count(*) filter (where 'club' = any(fuentes))),
           'contactos', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'clave', x.clave, 'nombre', x.nombre, 'tel', x.tel, 'mail', x.mail, 'fuentes', to_jsonb(x.fuentes),
                      'ultima', x.ultima, 'ultimo', x.ultimo, 'compras_tienda', x.compras_tienda,
                      'gastado_tienda', x.gastado_tienda, 'abiertas', x.abiertas, 'nivel', x.nivel,
                      'acepta', x.acepta, 'etiquetas', to_jsonb(x.etq))
                    order by x.ultima desc)
               from (select * from filtrado
                      where p_fuente is null or p_fuente = any(fuentes)
                      order by ultima desc
                      limit greatest(coalesce(p_limite, 300), 1)) x), '[]'::jsonb))
    into salida
    from filtrado;
  return salida;
end;
$$;
grant execute on function crm_contactos(text, text, text, integer) to anon, authenticated;

/* La ficha de una persona: sus datos, el Club y todo lo que pasó, con las
   notas del CRM en el medio. */
create or replace function crm_contacto(p_pin text, p_clave text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  /* Con prefijo: "tel" y "mail" son también columnas de lo que se consulta,
     y PL/pgSQL no sabría a cuál le hablan. */
  v_filas jsonb; v_tel text; v_mail text; v_nombre text; v_acepta boolean; v_etq jsonb;
  socio_id bigint; socio jsonb; historia jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if coalesce(trim(p_clave), '') = '' then return null; end if;

  /* Lo de esta persona, lo más nuevo primero. En una variable y no en una
     tabla temporal: es poco, y una función con permisos de dueño no tiene
     por qué andar creando tablas. */
  select coalesce(jsonb_agg(to_jsonb(b) order by b.cuando desc), '[]'::jsonb) into v_filas
    from crm_contactos_base() b where b.clave = p_clave;
  if jsonb_array_length(v_filas) = 0 then return null; end if;

  select max(x.e->>'tel'),
         (array_agg(x.e->>'mail' order by x.i) filter (where x.e->>'mail' is not null))[1],
         (array_agg(x.e->>'nombre' order by x.i) filter (where x.e->>'nombre' is not null))[1],
         bool_or((x.e->>'acepta')::boolean)
    into v_tel, v_mail, v_nombre, v_acepta
    from jsonb_array_elements(v_filas) with ordinality as x(e, i);
  select coalesce(to_jsonb(array_agg(distinct t order by t)), '[]'::jsonb) into v_etq
    from jsonb_array_elements(v_filas) as x(e), jsonb_array_elements_text(x.e->'etiquetas') as t;

  select c.id into socio_id from club_clientes c
   where c.baja is null
     and ((v_tel is not null and club_tel10(c.telefono) = v_tel) or (v_mail is not null and lower(trim(c.mail)) = v_mail))
   order by (v_tel is not null and club_tel10(c.telefono) = v_tel) desc, c.creado
   limit 1;
  if socio_id is not null then
    select jsonb_build_object('nombre', v.nombre, 'nivel', v.nivel, 'puntos', v.puntos, 'compras', v.compras,
                              'gastado', v.gastado, 'ultima_compra', v.ultima_compra, 'desde', v.creado, 'local', v.local_alta)
      into socio from v_club_clientes v where v.id = socio_id;
  end if;

  select coalesce(jsonb_agg(h order by (h->>'cuando')::timestamptz desc), '[]'::jsonb) into historia
    from (
      select jsonb_build_object('fuente', x.e->>'fuente', 'ref', (x.e->>'ref')::bigint, 'cuando', x.e->'cuando',
                                'datos', x.e->'datos') as h
        from jsonb_array_elements(v_filas) as x(e)
      union all
      select jsonb_build_object('fuente', 'nota', 'ref', ev.ref, 'cuando', ev.cuando,
                                'datos', jsonb_build_object('de', ev.fuente, 'quien', ev.quien, 'texto', ev.detalle))
        from crm_eventos ev
       where ev.tipo = 'nota'
         and exists (select 1 from jsonb_array_elements(v_filas) as x(e)
                      where x.e->>'fuente' = ev.fuente and (x.e->>'ref')::bigint = ev.ref)
    ) t;

  return jsonb_build_object(
    'persona', jsonb_build_object('clave', p_clave, 'nombre', v_nombre, 'tel', v_tel, 'mail', v_mail,
                                  'acepta', v_acepta, 'etiquetas', v_etq),
    'socio', socio, 'historia', historia);
end;
$$;
grant execute on function crm_contacto(text, text) to anon, authenticated;

select 'listo: los Contactos del CRM' as "SQL 61";


-- ─────────────────────────── PARTE 62 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · LOS MENSAJES DE WHATSAPP, EN LA BASE
--
-- Correr en el editor SQL de Supabase.
--
-- Primer paso de la conexión propia con Meta (09/10/2026). La app "VDH CRM"
-- del portfolio Vdhstore recibe los avisos de Meta en la Edge Function
-- "whatsapp", que comprueba la firma y se los pasa a wa_recibir().
--   · Entra: lo que escribe el cliente.
--   · Sale, "celular": lo que contestan desde la app WhatsApp Business del
--     teléfono (la cuenta es de coexistencia, Meta manda el eco).
--   · Sale, "crm": lo que se mande desde el CRM, cuando esté.
--   · Lo que manda Kommo NO llega: Meta no les cuenta a las otras apps lo
--     que manda cada una. Llegan, a lo sumo, los estados.
-- Kommo sigue conectado igual. Todo cerrado: sólo la Edge Function.
-- ══════════════════════════════════════════════════════════════════════════

/* Cada aviso tal como llegó. Sirve para ver qué manda Meta de verdad
   mientras se arma esto; se puede vaciar cuando ande todo. */
create table if not exists wa_avisos (
  id         bigserial primary key,
  recibido   timestamptz not null default now(),
  cuerpo     jsonb not null,
  resultado  jsonb
);
alter table wa_avisos enable row level security;
revoke all on wa_avisos from anon, authenticated;

/* Un mensaje por fila. tel es el número del cliente como lo da WhatsApp
   (con el 549 adelante); para cruzarlo con el resto se usa club_tel10. */
create table if not exists wa_mensajes (
  id         bigserial primary key,
  wamid      text unique,
  numero_id  text not null,
  numero     text,
  tel        text not null,
  sentido    text not null check (sentido in ('entra', 'sale')),
  desde      text not null,
  tipo       text not null,
  texto      text,
  media      jsonb,
  perfil     text,
  estado     text,
  error      jsonb,
  cuando     timestamptz not null,
  creado     timestamptz not null default now()
);
create index if not exists wa_mensajes_tel    on wa_mensajes (club_tel10(tel), cuando desc);
create index if not exists wa_mensajes_cuando on wa_mensajes (cuando desc);
alter table wa_mensajes enable row level security;
revoke all on wa_mensajes from anon, authenticated;

/* El texto que se ve de cada tipo de mensaje. Lo que no es texto (foto,
   audio…) guarda el id del archivo en media; bajarlo es otro paso. */
create or replace function wa_texto(m jsonb)
returns text
language sql
immutable
as $$
  select case m->>'type'
    when 'text'        then m->'text'->>'body'
    when 'button'      then m->'button'->>'text'
    when 'interactive' then coalesce(m->'interactive'->'button_reply'->>'title', m->'interactive'->'list_reply'->>'title')
    when 'reaction'    then m->'reaction'->>'emoji'
    when 'location'    then coalesce(m->'location'->>'name', m->'location'->>'address', 'Ubicación')
    when 'contacts'    then 'Contacto compartido'
    else m->(m->>'type')->>'caption'
  end
$$;

create or replace function wa_recibir(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb; c jsonb; v jsonb; m jsonb; s jsonb;
  v_numero_id text; v_numero text;
  entran integer := 0; ecos integer := 0; estados integer := 0; otros integer := 0;
  n integer;
  orden constant text[] := array['sent', 'delivered', 'read'];
  res jsonb;
begin
  for e in select * from jsonb_array_elements(coalesce(p->'entry', '[]'::jsonb)) loop
    for c in select * from jsonb_array_elements(coalesce(e->'changes', '[]'::jsonb)) loop
      v := c->'value';
      v_numero_id := v->'metadata'->>'phone_number_id';
      v_numero := v->'metadata'->>'display_phone_number';

      if c->>'field' = 'messages' then
        for m in select * from jsonb_array_elements(coalesce(v->'messages', '[]'::jsonb)) loop
          insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, media, perfil, cuando)
          values (m->>'id', v_numero_id, v_numero, m->>'from', 'entra', 'cliente', m->>'type', wa_texto(m),
                  case when m->>'type' in ('image', 'video', 'audio', 'document', 'sticker') then m->(m->>'type') end,
                  (select x->'profile'->>'name' from jsonb_array_elements(coalesce(v->'contacts', '[]'::jsonb)) x
                    where x->>'wa_id' = m->>'from' limit 1),
                  to_timestamp((m->>'timestamp')::bigint))
          on conflict (wamid) do nothing;
          get diagnostics n = row_count;
          entran := entran + n;
        end loop;

        /* Los estados sólo avanzan: un "entregado" que llega tarde no
           pisa un "leído". "failed" pisa siempre. */
        for s in select * from jsonb_array_elements(coalesce(v->'statuses', '[]'::jsonb)) loop
          update wa_mensajes w
             set estado = s->>'status', error = coalesce(s->'errors', w.error)
           where w.wamid = s->>'id'
             and (s->>'status' = 'failed' or w.estado is null
                  or coalesce(array_position(orden, s->>'status'), 0) > coalesce(array_position(orden, w.estado), 0));
          get diagnostics n = row_count;
          estados := estados + n;
        end loop;

      elsif c->>'field' = 'smb_message_echoes' then
        for m in select * from jsonb_array_elements(coalesce(v->'message_echoes', '[]'::jsonb)) loop
          insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, media, cuando)
          values (m->>'id', v_numero_id, v_numero, m->>'to', 'sale', 'celular', m->>'type', wa_texto(m),
                  case when m->>'type' in ('image', 'video', 'audio', 'document', 'sticker') then m->(m->>'type') end,
                  to_timestamp((m->>'timestamp')::bigint))
          on conflict (wamid) do nothing;
          get diagnostics n = row_count;
          ecos := ecos + n;
        end loop;

      else
        otros := otros + 1;
      end if;
    end loop;
  end loop;

  res := jsonb_build_object('entran', entran, 'ecos', ecos, 'estados', estados, 'otros', otros);
  insert into wa_avisos (cuerpo, resultado) values (p, res);
  return res;
end;
$$;
revoke execute on function wa_recibir(jsonb) from public, anon, authenticated;
-- La Edge Function entra como service_role: sin esto no puede guardar.
grant  execute on function wa_recibir(jsonb) to service_role;


-- ─────────────────────────── PARTE 63 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · LOS MENSAJES DE WHATSAPP, EN EL CRM
--
-- Correr en el editor SQL de Supabase.
--
-- Pedido de Mauricio (09/10/2026), con el WhatsApp ya conectado (SQL 62):
--   · Una pestaña "Mensajes": las conversaciones, la última arriba, con las
--     que esperan respuesta marcadas ("sin contestar").
--   · En la ficha de cada contacto, la conversación.
--   · Los que escribieron por WhatsApp pasan a estar en Contactos. El nombre
--     del perfil de WhatsApp se usa sólo si no hay otro.
--   · Lo que se contesta desde Kommo no nos llega (Meta no se lo cuenta a
--     otras apps); si llega su estado, queda una marca de que se contestó.
-- Todo detrás del PIN, como el resto del CRM.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function crm_contactos_base()
returns table (clave text, fuente text, ref bigint, cuando timestamptz, nombre text, tel text, mail text,
               datos jsonb, monto numeric, abierta boolean, etiquetas text[], nivel text, acepta boolean)
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select 'no_compra'::text as fuente, r.id as ref, r.creado as cuando, nullif(trim(r.nombre), '') as nombre,
           club_tel10(r.whatsapp) as tel, nullif(lower(trim(r.mail)), '') as mail,
           jsonb_build_object('local', r.sucursal, 'producto', r.producto, 'talle', r.talle, 'motivo', r.motivo::text,
                              'columna', crm_columna(r.estado, r.contactado), 'monto', r.monto) as datos,
           case when r.compro then r.monto end as monto,
           crm_columna(r.estado, r.contactado) not in ('Cerrado - compró', 'Cerrado - no compró', 'Descartado') as abierta,
           coalesce(r.etiquetas, '{}'::text[]) as etiquetas, null::text as nivel, null::boolean as acepta
      from registros r
    union all
    select 'carrito', k.id, k.creado, nullif(trim(k.nombre), ''), club_tel10(k.telefono), nullif(lower(trim(k.mail)), ''),
           jsonb_build_object('total', k.total, 'producto', k.productos->0->>'nombre',
                              'mas', greatest(jsonb_array_length(k.productos) - 1, 0), 'casi_pago', k.casi_pago,
                              'columna', crm_columna(k.estado, k.contactado), 'monto', k.monto),
           case when k.compro then k.monto end,
           crm_columna(k.estado, k.contactado) not in ('Cerrado - compró', 'Cerrado - no compró', 'Descartado'),
           coalesce(k.etiquetas, '{}'::text[]), null, null
      from crm_carritos k
    union all
    select 'club', c.id, c.creado, nullif(trim(c.nombre), ''), club_tel10(c.telefono), nullif(lower(trim(c.mail)), ''),
           jsonb_build_object('tipo', 'alta', 'local', c.local_alta, 'nivel', v.nivel, 'puntos', v.puntos),
           null, false, '{}'::text[], v.nivel, (c.acepta_promos and c.revocado is null)
      from club_clientes c join v_club_clientes v on v.id = c.id
     where c.baja is null
    union all
    select 'club', m.id, m.creado, nullif(trim(c.nombre), ''), club_tel10(c.telefono), nullif(lower(trim(c.mail)), ''),
           jsonb_build_object('tipo', 'compra', 'local', m.local, 'importe', m.importe, 'puntos', m.puntos),
           m.importe, false, '{}'::text[], null, null
      from club_movimientos m join club_clientes c on c.id = m.cliente
     where m.tipo::text = 'compra' and m.anulado is null and c.baja is null
    union all
    select 'tienda', t.id, coalesce(t.pagado, t.creado), t.nombre, club_tel10(t.telefono), t.mail,
           jsonb_build_object('numero', t.numero, 'total', t.total, 'producto', t.productos->0->>'nombre',
                              'mas', greatest(jsonb_array_length(t.productos) - 1, 0)),
           t.total, false, '{}'::text[], null, t.acepta
      from tienda_pedidos t
     where t.pago = 'paid' and coalesce(t.estado, '') <> 'cancelled'
    union all
    /* SQL 63: los que escribieron por WhatsApp, una fila por conversación.
       El nombre es el del perfil de WhatsApp: se usa sólo si no hay otro. */
    select 'whatsapp', max(w.id), max(w.cuando),
           (array_agg(nullif(trim(w.perfil), '') order by w.cuando desc) filter (where nullif(trim(w.perfil), '') is not null))[1],
           club_tel10(w.tel), null,
           jsonb_build_object('mensajes', count(*),
                              'texto', (array_agg(w.texto order by w.cuando desc, w.id desc))[1],
                              'tipo', (array_agg(w.tipo order by w.cuando desc, w.id desc))[1],
                              'desde', (array_agg(w.desde order by w.cuando desc, w.id desc))[1],
                              'sentido', (array_agg(w.sentido order by w.cuando desc, w.id desc))[1]),
           null, false, '{}'::text[], null, null
      from wa_mensajes w
     group by club_tel10(w.tel)
  ),
  /* El teléfono de cada mail: así el que una vez dejó sólo el mail cae en
     la misma persona que cuando dejó el teléfono. */
  mt as (
    select distinct on (mail) mail, tel from f
     where mail is not null and tel is not null
     order by mail, cuando desc
  )
  select coalesce(f.tel, mt.tel, 'm:' || f.mail) as clave, f.*
    from f left join mt on mt.mail = f.mail
   where coalesce(f.tel, mt.tel, f.mail) is not null
$$;
revoke execute on function crm_contactos_base() from public, anon, authenticated;

create or replace function crm_contactos(p_pin text, p_buscar text default null, p_fuente text default null,
                                         p_limite integer default 300)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q  text := nullif(lower(trim(coalesce(p_buscar, ''))), '');
  qd text := nullif(regexp_replace(coalesce(p_buscar, ''), '[^0-9]', '', 'g'), '');
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  with b as (select * from crm_contactos_base()),
  e as (select b.clave, array_agg(distinct x order by x) as etiquetas from b, unnest(b.etiquetas) x group by b.clave),
  p as (
    select b.clave,
           (array_agg(b.nombre order by (b.fuente = 'whatsapp'), b.cuando desc) filter (where b.nombre is not null))[1] as nombre,
           max(b.tel) as tel,
           (array_agg(b.mail order by b.cuando desc) filter (where b.mail is not null))[1] as mail,
           array_agg(distinct b.fuente) as fuentes,
           max(b.cuando) as ultima,
           (array_agg(b.datos || jsonb_build_object('fuente', b.fuente, 'ref', b.ref) order by b.cuando desc))[1] as ultimo,
           count(*) filter (where b.fuente = 'tienda') as compras_tienda,
           coalesce(sum(b.monto) filter (where b.fuente = 'tienda'), 0) as gastado_tienda,
           count(*) filter (where b.abierta) as abiertas,
           max(b.nivel) as nivel,
           bool_or(b.acepta) as acepta
      from b group by b.clave
  ),
  pe as (select p.*, coalesce(e.etiquetas, '{}'::text[]) as etq from p left join e on e.clave = p.clave),
  filtrado as (
    select * from pe
     where q is null
        or lower(coalesce(pe.nombre, '')) like '%' || q || '%'
        or coalesce(pe.mail, '') like '%' || q || '%'
        or (qd is not null and length(qd) >= 3 and coalesce(pe.tel, '') like '%' || qd || '%')
        or exists (select 1 from unnest(pe.etq) x where lower(x) like '%' || q || '%')
  )
  select jsonb_build_object(
           'cuentas', jsonb_build_object(
             'todos', count(*),
             'tienda', count(*) filter (where 'tienda' = any(fuentes)),
             'carrito', count(*) filter (where 'carrito' = any(fuentes)),
             'no_compra', count(*) filter (where 'no_compra' = any(fuentes)),
             'club', count(*) filter (where 'club' = any(fuentes)),
             'whatsapp', count(*) filter (where 'whatsapp' = any(fuentes))),
           'contactos', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'clave', x.clave, 'nombre', x.nombre, 'tel', x.tel, 'mail', x.mail, 'fuentes', to_jsonb(x.fuentes),
                      'ultima', x.ultima, 'ultimo', x.ultimo, 'compras_tienda', x.compras_tienda,
                      'gastado_tienda', x.gastado_tienda, 'abiertas', x.abiertas, 'nivel', x.nivel,
                      'acepta', x.acepta, 'etiquetas', to_jsonb(x.etq))
                    order by x.ultima desc)
               from (select * from filtrado
                      where p_fuente is null or p_fuente = any(fuentes)
                      order by ultima desc
                      limit greatest(coalesce(p_limite, 300), 1)) x), '[]'::jsonb))
    into salida
    from filtrado;
  return salida;
end;
$$;
grant execute on function crm_contactos(text, text, text, integer) to anon, authenticated;

create or replace function crm_contacto(p_pin text, p_clave text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  /* Con prefijo: "tel" y "mail" son también columnas de lo que se consulta,
     y PL/pgSQL no sabría a cuál le hablan. */
  v_filas jsonb; v_tel text; v_mail text; v_nombre text; v_acepta boolean; v_etq jsonb;
  socio_id bigint; socio jsonb; historia jsonb;
  v_mensajes jsonb; v_ventana timestamptz;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if coalesce(trim(p_clave), '') = '' then return null; end if;

  /* Lo de esta persona, lo más nuevo primero. En una variable y no en una
     tabla temporal: es poco, y una función con permisos de dueño no tiene
     por qué andar creando tablas. */
  select coalesce(jsonb_agg(to_jsonb(b) order by b.cuando desc), '[]'::jsonb) into v_filas
    from crm_contactos_base() b where b.clave = p_clave;
  if jsonb_array_length(v_filas) = 0 then return null; end if;

  select max(x.e->>'tel'),
         (array_agg(x.e->>'mail' order by x.i) filter (where x.e->>'mail' is not null))[1],
         (array_agg(x.e->>'nombre' order by (x.e->>'fuente' = 'whatsapp'), x.i) filter (where x.e->>'nombre' is not null))[1],
         bool_or((x.e->>'acepta')::boolean)
    into v_tel, v_mail, v_nombre, v_acepta
    from jsonb_array_elements(v_filas) with ordinality as x(e, i);
  select coalesce(to_jsonb(array_agg(distinct t order by t)), '[]'::jsonb) into v_etq
    from jsonb_array_elements(v_filas) as x(e), jsonb_array_elements_text(x.e->'etiquetas') as t;

  select c.id into socio_id from club_clientes c
   where c.baja is null
     and ((v_tel is not null and club_tel10(c.telefono) = v_tel) or (v_mail is not null and lower(trim(c.mail)) = v_mail))
   order by (v_tel is not null and club_tel10(c.telefono) = v_tel) desc, c.creado
   limit 1;
  if socio_id is not null then
    select jsonb_build_object('nombre', v.nombre, 'nivel', v.nivel, 'puntos', v.puntos, 'compras', v.compras,
                              'gastado', v.gastado, 'ultima_compra', v.ultima_compra, 'desde', v.creado, 'local', v.local_alta)
      into socio from v_club_clientes v where v.id = socio_id;
  end if;

  select coalesce(jsonb_agg(h order by (h->>'cuando')::timestamptz desc), '[]'::jsonb) into historia
    from (
      select jsonb_build_object('fuente', x.e->>'fuente', 'ref', (x.e->>'ref')::bigint, 'cuando', x.e->'cuando',
                                'datos', x.e->'datos') as h
        from jsonb_array_elements(v_filas) as x(e)
       where x.e->>'fuente' <> 'whatsapp'
      union all
      select jsonb_build_object('fuente', 'nota', 'ref', ev.ref, 'cuando', ev.cuando,
                                'datos', jsonb_build_object('de', ev.fuente, 'quien', ev.quien, 'texto', ev.detalle))
        from crm_eventos ev
       where ev.tipo = 'nota'
         and exists (select 1 from jsonb_array_elements(v_filas) as x(e)
                      where x.e->>'fuente' = ev.fuente and (x.e->>'ref')::bigint = ev.ref)
    ) t;

  /* SQL 63: la conversación de WhatsApp (las últimas 200, en orden) y
     hasta cuándo se le puede contestar gratis: 24 h desde que escribió. */
  if v_tel is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'sentido', w.sentido, 'desde', w.desde, 'tipo', w.tipo,
                                                 'texto', w.texto, 'estado', w.estado, 'cuando', w.cuando)
                              order by w.cuando, w.id), '[]'::jsonb)
      into v_mensajes
      from (select * from wa_mensajes m where club_tel10(m.tel) = v_tel order by m.cuando desc, m.id desc limit 200) w;
    select max(m.cuando) + interval '24 hours' into v_ventana
      from wa_mensajes m where club_tel10(m.tel) = v_tel and m.sentido = 'entra';
  end if;
  return jsonb_build_object(
    'persona', jsonb_build_object('clave', p_clave, 'nombre', v_nombre, 'tel', v_tel, 'mail', v_mail,
                                  'acepta', v_acepta, 'etiquetas', v_etq),
    'socio', socio, 'historia', historia,
    'mensajes', coalesce(v_mensajes, '[]'::jsonb), 'ventana', v_ventana);
end;
$$;
grant execute on function crm_contacto(text, text) to anon, authenticated;

create or replace function wa_recibir(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb; c jsonb; v jsonb; m jsonb; s jsonb;
  v_numero_id text; v_numero text;
  entran integer := 0; ecos integer := 0; estados integer := 0; otros integer := 0; de_otra integer := 0;
  n integer;
  orden constant text[] := array['sent', 'delivered', 'read'];
  res jsonb;
begin
  for e in select * from jsonb_array_elements(coalesce(p->'entry', '[]'::jsonb)) loop
    for c in select * from jsonb_array_elements(coalesce(e->'changes', '[]'::jsonb)) loop
      v := c->'value';
      v_numero_id := v->'metadata'->>'phone_number_id';
      v_numero := v->'metadata'->>'display_phone_number';

      if c->>'field' = 'messages' then
        for m in select * from jsonb_array_elements(coalesce(v->'messages', '[]'::jsonb)) loop
          insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, media, perfil, cuando)
          values (m->>'id', v_numero_id, v_numero, m->>'from', 'entra', 'cliente', m->>'type', wa_texto(m),
                  case when m->>'type' in ('image', 'video', 'audio', 'document', 'sticker') then m->(m->>'type') end,
                  (select x->'profile'->>'name' from jsonb_array_elements(coalesce(v->'contacts', '[]'::jsonb)) x
                    where x->>'wa_id' = m->>'from' limit 1),
                  to_timestamp((m->>'timestamp')::bigint))
          on conflict (wamid) do nothing;
          get diagnostics n = row_count;
          entran := entran + n;
        end loop;

        /* Los estados sólo avanzan: un "entregado" que llega tarde no
           pisa un "leído". "failed" pisa siempre. */
        for s in select * from jsonb_array_elements(coalesce(v->'statuses', '[]'::jsonb)) loop
          update wa_mensajes w
             set estado = s->>'status', error = coalesce(s->'errors', w.error)
           where w.wamid = s->>'id'
             and (s->>'status' = 'failed' or w.estado is null
                  or coalesce(array_position(orden, s->>'status'), 0) > coalesce(array_position(orden, w.estado), 0));
          get diagnostics n = row_count;
          estados := estados + n;
          /* SQL 63: el estado de algo que no tenemos es algo que salió por
             otra app (Kommo). No sabemos qué decía, pero sí que se le
             contestó: se deja la marca, y la conversación no queda como
             "sin contestar" para siempre. */
          if n = 0 and s->>'recipient_id' is not null
             and not exists (select 1 from wa_mensajes w where w.wamid = s->>'id') then
            insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, estado, error, cuando)
            values (s->>'id', v_numero_id, v_numero, s->>'recipient_id', 'sale', 'otra_app', 'desconocido',
                    s->>'status', s->'errors', coalesce(to_timestamp((s->>'timestamp')::bigint), now()))
            on conflict (wamid) do nothing;
            get diagnostics n = row_count;
            de_otra := de_otra + n;
          end if;
        end loop;

      elsif c->>'field' = 'smb_message_echoes' then
        for m in select * from jsonb_array_elements(coalesce(v->'message_echoes', '[]'::jsonb)) loop
          insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, media, cuando)
          values (m->>'id', v_numero_id, v_numero, m->>'to', 'sale', 'celular', m->>'type', wa_texto(m),
                  case when m->>'type' in ('image', 'video', 'audio', 'document', 'sticker') then m->(m->>'type') end,
                  to_timestamp((m->>'timestamp')::bigint))
          on conflict (wamid) do update
            set desde = 'celular', tipo = excluded.tipo, texto = excluded.texto, media = excluded.media
            where wa_mensajes.desde = 'otra_app';
          get diagnostics n = row_count;
          ecos := ecos + n;
        end loop;

      else
        otros := otros + 1;
      end if;
    end loop;
  end loop;

  res := jsonb_build_object('entran', entran, 'ecos', ecos, 'estados', estados, 'de_otra_app', de_otra, 'otros', otros);
  insert into wa_avisos (cuerpo, resultado) values (p, res);
  return res;
end;
$$;
revoke execute on function wa_recibir(jsonb) from public, anon, authenticated;
revoke execute on function wa_recibir(jsonb) from public, anon, authenticated;
grant  execute on function wa_recibir(jsonb) to service_role;

/* Las conversaciones, la última arriba. "Sin contestar": lo último que pasó
   es algo que escribió el cliente. "pendientes": cuántos mensajes suyos hay
   desde la última respuesta. El nombre sale de lo que ya sabemos de esa
   persona (No Compra, carrito, Club, tienda) y, si no, del perfil. */
create or replace function crm_mensajes(p_pin text, p_buscar text default null, p_limite integer default 200)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q  text := nullif(lower(trim(coalesce(p_buscar, ''))), '');
  qd text := nullif(regexp_replace(coalesce(p_buscar, ''), '[^0-9]', '', 'g'), '');
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  with w as (select club_tel10(m.tel) as clave, m.* from wa_mensajes m),
  ult as (
    select distinct on (w.clave) w.clave, w.id, w.tel, w.sentido, w.desde, w.tipo, w.texto, w.estado, w.cuando
      from w order by w.clave, w.cuando desc, w.id desc
  ),
  conv as (
    select w.clave, count(*) as n,
           (array_agg(nullif(trim(w.perfil), '') order by w.cuando desc) filter (where nullif(trim(w.perfil), '') is not null))[1] as perfil,
           max(w.cuando) filter (where w.sentido = 'sale') as ultima_sale,
           max(w.cuando) filter (where w.sentido = 'entra') as ultima_entra
      from w group by w.clave
  ),
  pend as (
    select w.clave, count(*) as pendientes
      from w join conv c on c.clave = w.clave
     where w.sentido = 'entra' and w.cuando > coalesce(c.ultima_sale, '-infinity'::timestamptz)
     group by w.clave
  ),
  nm as (
    select b.clave,
           (array_agg(b.nombre order by b.cuando desc) filter (where b.nombre is not null))[1] as nombre,
           array_agg(distinct b.fuente) as fuentes, max(b.nivel) as nivel
      from crm_contactos_base() b
     where b.fuente <> 'whatsapp' and b.clave in (select conv.clave from conv)
     group by b.clave
  ),
  x as (
    select c.clave, u.tel, coalesce(nm.nombre, c.perfil) as nombre, c.perfil,
           coalesce(nm.fuentes, '{}'::text[]) as fuentes, nm.nivel, c.n,
           coalesce(p.pendientes, 0) as pendientes, (u.sentido = 'entra') as sin_contestar,
           u.cuando as ultima, c.ultima_entra,
           jsonb_build_object('texto', u.texto, 'tipo', u.tipo, 'sentido', u.sentido, 'desde', u.desde, 'estado', u.estado) as ultimo
      from conv c
      join ult u on u.clave = c.clave
      left join pend p on p.clave = c.clave
      left join nm on nm.clave = c.clave
  ),
  f as (
    select * from x
     where q is null
        or lower(coalesce(x.nombre, '')) like '%' || q || '%'
        or lower(coalesce(x.perfil, '')) like '%' || q || '%'
        or (qd is not null and length(qd) >= 3 and x.tel like '%' || qd || '%')
        or exists (select 1 from w where w.clave = x.clave and lower(coalesce(w.texto, '')) like '%' || q || '%')
  )
  select jsonb_build_object(
           'cuentas', jsonb_build_object('todas', (select count(*) from x),
                                         'sin_contestar', (select count(*) from x where x.sin_contestar)),
           'ultimo_id', (select max(m.id) from wa_mensajes m),
           'conversaciones', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'clave', y.clave, 'tel', y.tel, 'nombre', y.nombre, 'perfil', y.perfil,
                      'fuentes', to_jsonb(y.fuentes), 'nivel', y.nivel, 'n', y.n, 'pendientes', y.pendientes,
                      'sin_contestar', y.sin_contestar, 'ultima', y.ultima, 'ultima_entra', y.ultima_entra,
                      'ultimo', y.ultimo)
                    order by y.ultima desc)
               from (select * from f order by f.ultima desc limit greatest(coalesce(p_limite, 200), 1)) y), '[]'::jsonb))
    into salida;
  return salida;
end;
$$;
grant execute on function crm_mensajes(text, text, integer) to anon, authenticated;

/* Lo mínimo, para preguntar seguido si llegó algo sin traer toda la lista:
   el último mensaje y cuántas conversaciones esperan respuesta. */
create or replace function crm_mensajes_ultimo(p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'ultimo_id', (select max(m.id) from wa_mensajes m),
    'sin_contestar', (select count(*) from (
        select distinct on (club_tel10(m.tel)) m.sentido from wa_mensajes m
         order by club_tel10(m.tel), m.cuando desc, m.id desc) u
       where u.sentido = 'entra'));
end;
$$;
grant execute on function crm_mensajes_ultimo(text) to anon, authenticated;

select 'listo: los mensajes en el CRM' as "SQL 63";


-- ─────────────────────────── PARTE 64 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · CONTESTAR POR WHATSAPP DESDE EL CRM
--
-- Correr en el editor SQL de Supabase.
--
-- Pedido de Mauricio (09/10/2026). En la ficha de cada contacto, abajo de
-- la conversación, se escribe y se manda. Sale por el número al que la
-- persona escribió (VDH Indumentaria) y también se ve en el celular.
--   · Sólo dentro de las 24 h desde el último mensaje del cliente: es
--     gratis y es lo que Meta deja. Después hace falta una plantilla
--     aprobada (eso va con las campañas).
--   · Lo manda la Edge Function "whatsapp", que tiene el token. La base
--     comprueba el PIN y la ventana antes, y guarda lo que Meta aceptó, con
--     quién lo mandó.
-- ══════════════════════════════════════════════════════════════════════════

alter table wa_mensajes add column if not exists quien text;

/* Antes de mandar: el PIN, a qué número (como lo da WhatsApp) y desde cuál
   de los nuestros (al que escribió), y si todavía estamos en las 24 h. */
create or replace function wa_preparar_envio(p_pin text, p_clave text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_tel text; v_numero_id text; v_numero text; v_cuando timestamptz;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  select m.tel, m.numero_id, m.numero, m.cuando into v_tel, v_numero_id, v_numero, v_cuando
    from wa_mensajes m
   where club_tel10(m.tel) = p_clave and m.sentido = 'entra'
   order by m.cuando desc, m.id desc
   limit 1;
  if v_tel is null then
    return jsonb_build_object('ok', false, 'motivo', 'sin_conversacion');
  end if;
  if v_cuando + interval '24 hours' < now() then
    return jsonb_build_object('ok', false, 'motivo', 'ventana', 'ventana', v_cuando + interval '24 hours');
  end if;
  return jsonb_build_object('ok', true, 'tel', v_tel, 'numero_id', v_numero_id, 'numero', v_numero,
                            'ventana', v_cuando + interval '24 hours');
end;
$$;
revoke execute on function wa_preparar_envio(text, text) from public, anon, authenticated;
grant  execute on function wa_preparar_envio(text, text) to service_role;

/* Lo que Meta aceptó. Si su estado llegó antes (y dejó la marca de "otra
   app"), se completa. */
create or replace function wa_anotar_envio(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, quien, cuando)
  values (p->>'wamid', p->>'numero_id', p->>'numero', p->>'tel', 'sale', 'crm', 'text', p->>'texto',
          nullif(trim(p->>'quien'), ''), now())
  on conflict (wamid) do update
    set desde = 'crm', tipo = 'text', texto = excluded.texto, quien = excluded.quien
    where wa_mensajes.desde = 'otra_app'
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end;
$$;
revoke execute on function wa_anotar_envio(jsonb) from public, anon, authenticated;
grant  execute on function wa_anotar_envio(jsonb) to service_role;

create or replace function crm_contacto(p_pin text, p_clave text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  /* Con prefijo: "tel" y "mail" son también columnas de lo que se consulta,
     y PL/pgSQL no sabría a cuál le hablan. */
  v_filas jsonb; v_tel text; v_mail text; v_nombre text; v_acepta boolean; v_etq jsonb;
  socio_id bigint; socio jsonb; historia jsonb;
  v_mensajes jsonb; v_ventana timestamptz;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if coalesce(trim(p_clave), '') = '' then return null; end if;

  /* Lo de esta persona, lo más nuevo primero. En una variable y no en una
     tabla temporal: es poco, y una función con permisos de dueño no tiene
     por qué andar creando tablas. */
  select coalesce(jsonb_agg(to_jsonb(b) order by b.cuando desc), '[]'::jsonb) into v_filas
    from crm_contactos_base() b where b.clave = p_clave;
  if jsonb_array_length(v_filas) = 0 then return null; end if;

  select max(x.e->>'tel'),
         (array_agg(x.e->>'mail' order by x.i) filter (where x.e->>'mail' is not null))[1],
         (array_agg(x.e->>'nombre' order by (x.e->>'fuente' = 'whatsapp'), x.i) filter (where x.e->>'nombre' is not null))[1],
         bool_or((x.e->>'acepta')::boolean)
    into v_tel, v_mail, v_nombre, v_acepta
    from jsonb_array_elements(v_filas) with ordinality as x(e, i);
  select coalesce(to_jsonb(array_agg(distinct t order by t)), '[]'::jsonb) into v_etq
    from jsonb_array_elements(v_filas) as x(e), jsonb_array_elements_text(x.e->'etiquetas') as t;

  select c.id into socio_id from club_clientes c
   where c.baja is null
     and ((v_tel is not null and club_tel10(c.telefono) = v_tel) or (v_mail is not null and lower(trim(c.mail)) = v_mail))
   order by (v_tel is not null and club_tel10(c.telefono) = v_tel) desc, c.creado
   limit 1;
  if socio_id is not null then
    select jsonb_build_object('nombre', v.nombre, 'nivel', v.nivel, 'puntos', v.puntos, 'compras', v.compras,
                              'gastado', v.gastado, 'ultima_compra', v.ultima_compra, 'desde', v.creado, 'local', v.local_alta)
      into socio from v_club_clientes v where v.id = socio_id;
  end if;

  select coalesce(jsonb_agg(h order by (h->>'cuando')::timestamptz desc), '[]'::jsonb) into historia
    from (
      select jsonb_build_object('fuente', x.e->>'fuente', 'ref', (x.e->>'ref')::bigint, 'cuando', x.e->'cuando',
                                'datos', x.e->'datos') as h
        from jsonb_array_elements(v_filas) as x(e)
       where x.e->>'fuente' <> 'whatsapp'
      union all
      select jsonb_build_object('fuente', 'nota', 'ref', ev.ref, 'cuando', ev.cuando,
                                'datos', jsonb_build_object('de', ev.fuente, 'quien', ev.quien, 'texto', ev.detalle))
        from crm_eventos ev
       where ev.tipo = 'nota'
         and exists (select 1 from jsonb_array_elements(v_filas) as x(e)
                      where x.e->>'fuente' = ev.fuente and (x.e->>'ref')::bigint = ev.ref)
    ) t;

  /* SQL 63: la conversación de WhatsApp (las últimas 200, en orden) y
     hasta cuándo se le puede contestar gratis: 24 h desde que escribió. */
  if v_tel is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'sentido', w.sentido, 'desde', w.desde, 'tipo', w.tipo,
                                                 'texto', w.texto, 'estado', w.estado, 'cuando', w.cuando, 'quien', w.quien)
                              order by w.cuando, w.id), '[]'::jsonb)
      into v_mensajes
      from (select * from wa_mensajes m where club_tel10(m.tel) = v_tel order by m.cuando desc, m.id desc limit 200) w;
    select max(m.cuando) + interval '24 hours' into v_ventana
      from wa_mensajes m where club_tel10(m.tel) = v_tel and m.sentido = 'entra';
  end if;
  return jsonb_build_object(
    'persona', jsonb_build_object('clave', p_clave, 'nombre', v_nombre, 'tel', v_tel, 'mail', v_mail,
                                  'acepta', v_acepta, 'etiquetas', v_etq),
    'socio', socio, 'historia', historia,
    'mensajes', coalesce(v_mensajes, '[]'::jsonb), 'ventana', v_ventana);
end;
$$;
grant execute on function crm_contacto(text, text) to anon, authenticated;

select 'listo: contestar desde el CRM' as "SQL 64";


-- ─────────────────────────── PARTE 65 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · MANDAR PLANTILLAS DE WHATSAPP DESDE EL CRM
--
-- Correr en el editor SQL de Supabase.
--
-- Pedido de Mauricio (10/10/2026): para escribirle a alguien que no nos
-- escribió, o cuando pasaron las 24 h, Meta sólo deja mandar plantillas
-- aprobadas. Se crean desde el CRM (Automatizaciones → Plantillas) y se
-- mandan desde la conversación o la ficha.
--   · La base comprueba el PIN, arma el número de WhatsApp (549 + los 10
--     números) y dice desde cuál de los nuestros conviene salir: el mismo
--     al que escribió la última vez.
--   · "No escribir" es un no: con esa etiqueta, no sale nada.
--   · Lo que sale queda guardado como cualquier mensaje, con qué plantilla.
--   · La ficha trae, además, por qué no se entregó un mensaje (por ejemplo,
--     si a la cuenta le falta la tarjeta en Meta).
-- ══════════════════════════════════════════════════════════════════════════

create or replace function wa_preparar_plantilla(p_pin text, p_clave text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_tel text; v_numero_id text; v_numero text; v_ventana timestamptz;
  v_no boolean; v_acepta boolean; v_nombre text;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  /* Sólo se le escribe a un teléfono: los que dejaron sólo el mail, no. */
  if coalesce(p_clave, '') !~ '^[0-9]{10}$' then
    return jsonb_build_object('ok', false, 'motivo', 'sin_telefono');
  end if;

  /* Lo de la persona, de todos lados: su nombre, si aceptó promociones y
     si alguien le puso "No escribir". */
  select bool_or(exists (select 1 from unnest(b.etiquetas) e where lower(trim(e)) = 'no escribir')),
         bool_or(b.acepta),
         (array_agg(b.nombre order by (b.fuente = 'whatsapp'), b.cuando desc) filter (where b.nombre is not null))[1]
    into v_no, v_acepta, v_nombre
    from crm_contactos_base() b
   where b.clave = p_clave;
  if coalesce(v_no, false) then
    return jsonb_build_object('ok', false, 'motivo', 'no_escribir');
  end if;

  /* Si ya hubo conversación: su número como lo da WhatsApp y el nuestro
     por el que hablaron. Si no, 549 + los 10 números, y el número lo elige
     la Edge Function (el del CRM). */
  select m.tel, m.numero_id, m.numero into v_tel, v_numero_id, v_numero
    from wa_mensajes m
   where club_tel10(m.tel) = p_clave
   order by m.cuando desc, m.id desc
   limit 1;
  select max(m.cuando) + interval '24 hours' into v_ventana
    from wa_mensajes m where club_tel10(m.tel) = p_clave and m.sentido = 'entra';

  return jsonb_build_object('ok', true, 'tel', coalesce(v_tel, '549' || p_clave), 'numero_id', v_numero_id,
                            'numero', v_numero, 'nombre', v_nombre, 'acepta', v_acepta, 'ventana', v_ventana);
end;
$$;
revoke execute on function wa_preparar_plantilla(text, text) from public, anon, authenticated;
grant  execute on function wa_preparar_plantilla(text, text) to service_role;

/* Lo que Meta aceptó: texto o plantilla (con cuál, en media). Si su estado
   llegó antes (y dejó la marca de "otra app"), se completa. */
create or replace function wa_anotar_envio(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, media, quien, cuando)
  values (p->>'wamid', p->>'numero_id', p->>'numero', p->>'tel', 'sale', 'crm', coalesce(nullif(p->>'tipo', ''), 'text'),
          p->>'texto', p->'media', nullif(trim(p->>'quien'), ''), now())
  on conflict (wamid) do update
    set desde = 'crm', tipo = excluded.tipo, texto = excluded.texto, media = excluded.media, quien = excluded.quien
    where wa_mensajes.desde = 'otra_app'
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end;
$$;
revoke execute on function wa_anotar_envio(jsonb) from public, anon, authenticated;
grant  execute on function wa_anotar_envio(jsonb) to service_role;

create or replace function crm_contacto(p_pin text, p_clave text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  /* Con prefijo: "tel" y "mail" son también columnas de lo que se consulta,
     y PL/pgSQL no sabría a cuál le hablan. */
  v_filas jsonb; v_tel text; v_mail text; v_nombre text; v_acepta boolean; v_etq jsonb;
  socio_id bigint; socio jsonb; historia jsonb;
  v_mensajes jsonb; v_ventana timestamptz;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if coalesce(trim(p_clave), '') = '' then return null; end if;

  /* Lo de esta persona, lo más nuevo primero. En una variable y no en una
     tabla temporal: es poco, y una función con permisos de dueño no tiene
     por qué andar creando tablas. */
  select coalesce(jsonb_agg(to_jsonb(b) order by b.cuando desc), '[]'::jsonb) into v_filas
    from crm_contactos_base() b where b.clave = p_clave;
  if jsonb_array_length(v_filas) = 0 then return null; end if;

  select max(x.e->>'tel'),
         (array_agg(x.e->>'mail' order by x.i) filter (where x.e->>'mail' is not null))[1],
         (array_agg(x.e->>'nombre' order by (x.e->>'fuente' = 'whatsapp'), x.i) filter (where x.e->>'nombre' is not null))[1],
         bool_or((x.e->>'acepta')::boolean)
    into v_tel, v_mail, v_nombre, v_acepta
    from jsonb_array_elements(v_filas) with ordinality as x(e, i);
  select coalesce(to_jsonb(array_agg(distinct t order by t)), '[]'::jsonb) into v_etq
    from jsonb_array_elements(v_filas) as x(e), jsonb_array_elements_text(x.e->'etiquetas') as t;

  select c.id into socio_id from club_clientes c
   where c.baja is null
     and ((v_tel is not null and club_tel10(c.telefono) = v_tel) or (v_mail is not null and lower(trim(c.mail)) = v_mail))
   order by (v_tel is not null and club_tel10(c.telefono) = v_tel) desc, c.creado
   limit 1;
  if socio_id is not null then
    select jsonb_build_object('nombre', v.nombre, 'nivel', v.nivel, 'puntos', v.puntos, 'compras', v.compras,
                              'gastado', v.gastado, 'ultima_compra', v.ultima_compra, 'desde', v.creado, 'local', v.local_alta)
      into socio from v_club_clientes v where v.id = socio_id;
  end if;

  select coalesce(jsonb_agg(h order by (h->>'cuando')::timestamptz desc), '[]'::jsonb) into historia
    from (
      select jsonb_build_object('fuente', x.e->>'fuente', 'ref', (x.e->>'ref')::bigint, 'cuando', x.e->'cuando',
                                'datos', x.e->'datos') as h
        from jsonb_array_elements(v_filas) as x(e)
       where x.e->>'fuente' <> 'whatsapp'
      union all
      select jsonb_build_object('fuente', 'nota', 'ref', ev.ref, 'cuando', ev.cuando,
                                'datos', jsonb_build_object('de', ev.fuente, 'quien', ev.quien, 'texto', ev.detalle))
        from crm_eventos ev
       where ev.tipo = 'nota'
         and exists (select 1 from jsonb_array_elements(v_filas) as x(e)
                      where x.e->>'fuente' = ev.fuente and (x.e->>'ref')::bigint = ev.ref)
    ) t;

  /* SQL 63: la conversación de WhatsApp (las últimas 200, en orden) y
     hasta cuándo se le puede contestar gratis: 24 h desde que escribió. */
  if v_tel is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'sentido', w.sentido, 'desde', w.desde, 'tipo', w.tipo,
                                                 'texto', w.texto, 'estado', w.estado, 'cuando', w.cuando, 'quien', w.quien, 'error', w.error)
                              order by w.cuando, w.id), '[]'::jsonb)
      into v_mensajes
      from (select * from wa_mensajes m where club_tel10(m.tel) = v_tel order by m.cuando desc, m.id desc limit 200) w;
    select max(m.cuando) + interval '24 hours' into v_ventana
      from wa_mensajes m where club_tel10(m.tel) = v_tel and m.sentido = 'entra';
  end if;
  return jsonb_build_object(
    'persona', jsonb_build_object('clave', p_clave, 'nombre', v_nombre, 'tel', v_tel, 'mail', v_mail,
                                  'acepta', v_acepta, 'etiquetas', v_etq),
    'socio', socio, 'historia', historia,
    'mensajes', coalesce(v_mensajes, '[]'::jsonb), 'ventana', v_ventana);
end;
$$;
grant execute on function crm_contacto(text, text) to anon, authenticated;

select 'listo: plantillas de WhatsApp desde el CRM' as "SQL 65";


-- ─────────────────────────── PARTE 66 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · LOS SEGMENTOS QUE SE ARMAN EN EL CRM
--
-- Correr en el editor SQL de Supabase.
--
-- Pedido de Mauricio (10/10/2026): "¿se pueden crear segmentos? Por ejemplo,
-- gente del local que no compra hace 60 días". Un segmento son condiciones
-- que se suman (dónde compró, hace cuánto, cuánto, el local, el Club, los
-- carritos, los No Compra, WhatsApp, las etiquetas). Se guarda con un nombre
-- y se pone al día solo: el que vuelve a comprar sale, el que cumple los 60
-- días entra.
--   · Las compras en los locales se conocen sólo de los socios del Club
--     (BlueSoft no dice a quién le vendió). Con el POS propio, de todos.
--   · Los que tienen la etiqueta "No escribir" quedan afuera siempre.
--   · Todo detrás del PIN, como el resto del CRM.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists crm_segmentos (
  id          bigserial primary key,
  nombre      text not null,
  reglas      jsonb not null default '{}'::jsonb,
  creado_por  text,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
alter table crm_segmentos enable row level security;
revoke all on crm_segmentos from anon, authenticated;

/* Una fila por persona (la misma "clave" que Contactos: el teléfono, o el
   mail si nunca dejó teléfono), con lo que hace falta para filtrar. Los
   locales van en minúscula, para comparar. Es un tipo propio para que
   crm_cumple lea los campos directo (convertir cada persona a JSON por
   cada segmento hacía la lista tres veces más lenta). */
do $tipo$
begin
  if to_regtype('crm_persona') is null then
    create type crm_persona as (
      clave text, nombre text, tel text, mail text, fuentes text[], ultima timestamptz, ultimo jsonb,
      ult_local timestamptz, n_local integer, gasto_local numeric,
      ult_tienda timestamptz, n_tienda integer, gasto_tienda numeric,
      socio boolean, nivel text, cumple date, ult_carrito timestamptz, ult_no_compra timestamptz, whatsapp boolean,
      locales text[], locales_compra text[], etiquetas text[], etq text[], acepta boolean);
  end if;
end
$tipo$;

create or replace function crm_personas()
returns setof crm_persona
language sql
stable
security definer
set search_path = public
as $$
  with b as (select * from crm_contactos_base()),
  e as (
    select b.clave, array_agg(distinct x order by x) as etiquetas
      from b, unnest(b.etiquetas) x
     where nullif(trim(x), '') is not null
     group by b.clave
  ),
  cu as (
    select distinct on (club_tel10(c.telefono)) club_tel10(c.telefono) as t10, c.cumple
      from club_clientes c
     where c.baja is null and club_tel10(c.telefono) is not null
     order by club_tel10(c.telefono), c.creado
  ),
  g as (
    select b.clave,
           (array_agg(b.nombre order by (b.fuente = 'whatsapp'), b.cuando desc) filter (where b.nombre is not null))[1] as nombre,
           max(b.tel) as tel,
           (array_agg(b.mail order by b.cuando desc) filter (where b.mail is not null))[1] as mail,
           array_agg(distinct b.fuente) as fuentes,
           max(b.cuando) as ultima,
           (array_agg(b.datos || jsonb_build_object('fuente', b.fuente, 'ref', b.ref) order by b.cuando desc))[1] as ultimo,
           max(b.cuando) filter (where b.fuente = 'club' and b.datos->>'tipo' = 'compra') as ult_local,
           (count(*) filter (where b.fuente = 'club' and b.datos->>'tipo' = 'compra'))::integer as n_local,
           coalesce(sum(b.monto) filter (where b.fuente = 'club' and b.datos->>'tipo' = 'compra'), 0) as gasto_local,
           max(b.cuando) filter (where b.fuente = 'tienda') as ult_tienda,
           (count(*) filter (where b.fuente = 'tienda'))::integer as n_tienda,
           coalesce(sum(b.monto) filter (where b.fuente = 'tienda'), 0) as gasto_tienda,
           coalesce(bool_or(b.fuente = 'club' and b.datos->>'tipo' = 'alta'), false) as socio,
           max(b.nivel) as nivel,
           max(b.cuando) filter (where b.fuente = 'carrito') as ult_carrito,
           max(b.cuando) filter (where b.fuente = 'no_compra') as ult_no_compra,
           coalesce(bool_or(b.fuente = 'whatsapp'), false) as whatsapp,
           coalesce(array_agg(distinct lower(trim(b.datos->>'local'))) filter (where nullif(trim(b.datos->>'local'), '') is not null),
                    '{}'::text[]) as locales,
           coalesce(array_agg(distinct lower(trim(b.datos->>'local')))
                      filter (where b.fuente = 'club' and b.datos->>'tipo' = 'compra' and nullif(trim(b.datos->>'local'), '') is not null),
                    '{}'::text[]) as locales_compra,
           bool_or(b.acepta) as acepta
      from b
     group by b.clave
  )
  select g.clave, g.nombre, g.tel, g.mail, g.fuentes, g.ultima, g.ultimo, g.ult_local, g.n_local, g.gasto_local,
         g.ult_tienda, g.n_tienda, g.gasto_tienda, g.socio, g.nivel, cu.cumple, g.ult_carrito, g.ult_no_compra, g.whatsapp,
         g.locales, g.locales_compra, coalesce(e.etiquetas, '{}'::text[]),
         coalesce((select array_agg(distinct lower(trim(x))) from unnest(e.etiquetas) x), '{}'::text[]),
         g.acepta
    from g
    left join e on e.clave = g.clave
    left join cu on cu.t10 = g.clave
$$;
revoke execute on function crm_personas() from public, anon, authenticated;

/* ¿Entra esta persona en el segmento? Las reglas (todas opcionales, se
   suman):
     donde            'local' | 'tienda' | 'cualquiera': compró ahí alguna vez
     sin_comprar_dias  su última compra (ahí) fue hace más de N días
     compro_dias       compró (ahí) en los últimos N días
     compras_min       al menos N compras (ahí)
     gasto_min         gastó al menos $N (ahí)
     local             tuvo algo en ese local (con "donde: local", compró ahí)
     socio             true / false
     niveles           ["Gold", "Black"]
     cumple_mes        cumple años este mes (los socios)
     carrito_dias      dejó un carrito en los últimos N días (0: alguna vez)
     no_compra_dias    vino al local y no compró, en los últimos N días (0: alguna vez)
     whatsapp          nos escribió por WhatsApp
     etiqueta          tiene esa etiqueta
     sin_etiqueta      no tiene esa etiqueta
     acepta            aceptó recibir promociones
   "No escribir" queda afuera siempre. El mes es el de Argentina. */
create or replace function crm_cumple(p crm_persona, r jsonb)
returns boolean
language sql
stable
set search_path = public
as $$
  select not coalesce('no escribir' = any((p).etq), false)
     and (coalesce(r->>'donde', '') = '' or x.n > 0)
     and (r->>'sin_comprar_dias' is null or (x.ult is not null and x.ult < now() - make_interval(days => (r->>'sin_comprar_dias')::integer)))
     and (r->>'compro_dias' is null or (x.ult is not null and x.ult >= now() - make_interval(days => (r->>'compro_dias')::integer)))
     and (r->>'compras_min' is null or x.n >= (r->>'compras_min')::integer)
     and (r->>'gasto_min' is null or x.gasto >= (r->>'gasto_min')::numeric)
     and (coalesce(r->>'local', '') = ''
          or coalesce(lower(trim(r->>'local')) = any(case when r->>'donde' = 'local' then (p).locales_compra else (p).locales end), false))
     and (r->>'socio' is null or coalesce((p).socio, false) = (r->>'socio')::boolean)
     and (coalesce(jsonb_array_length(r->'niveles'), 0) = 0 or coalesce((r->'niveles') ? (p).nivel, false))
     and (not coalesce((r->>'cumple_mes')::boolean, false)
          or ((p).cumple is not null
              and extract(month from (p).cumple) = extract(month from (now() at time zone 'America/Argentina/Buenos_Aires'))))
     and (r->>'carrito_dias' is null
          or ((p).ult_carrito is not null
              and ((r->>'carrito_dias')::integer = 0
                   or (p).ult_carrito >= now() - make_interval(days => (r->>'carrito_dias')::integer))))
     and (r->>'no_compra_dias' is null
          or ((p).ult_no_compra is not null
              and ((r->>'no_compra_dias')::integer = 0
                   or (p).ult_no_compra >= now() - make_interval(days => (r->>'no_compra_dias')::integer))))
     and (not coalesce((r->>'whatsapp')::boolean, false) or coalesce((p).whatsapp, false))
     and (coalesce(r->>'etiqueta', '') = '' or coalesce(lower(trim(r->>'etiqueta')) = any((p).etq), false))
     and (coalesce(r->>'sin_etiqueta', '') = '' or not coalesce(lower(trim(r->>'sin_etiqueta')) = any((p).etq), false))
     and (not coalesce((r->>'acepta')::boolean, false) or coalesce((p).acepta, false))
    from (select
            case r->>'donde'
              when 'local' then (p).ult_local
              when 'tienda' then (p).ult_tienda
              else greatest((p).ult_local, (p).ult_tienda) end as ult,
            case r->>'donde'
              when 'local' then coalesce((p).n_local, 0)
              when 'tienda' then coalesce((p).n_tienda, 0)
              else coalesce((p).n_local, 0) + coalesce((p).n_tienda, 0) end as n,
            case r->>'donde'
              when 'local' then coalesce((p).gasto_local, 0)
              when 'tienda' then coalesce((p).gasto_tienda, 0)
              else coalesce((p).gasto_local, 0) + coalesce((p).gasto_tienda, 0) end as gasto) x
$$;
revoke execute on function crm_cumple(crm_persona, jsonb) from public, anon, authenticated;

/* Cuántos son, mientras se arma: en total, cuántos con teléfono (a los que
   se les puede escribir) y cuántos aceptaron promociones. */
create or replace function crm_segmento_contar(p_pin text, p_reglas jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  select jsonb_build_object('total', count(*),
                            'con_telefono', count(*) filter (where p.clave !~ '^m:'),
                            'acepta', count(*) filter (where p.acepta))
    into salida
    from crm_personas() p
   where crm_cumple(p, coalesce(p_reglas, '{}'::jsonb));
  return salida;
end;
$$;
grant execute on function crm_segmento_contar(text, jsonb) to anon, authenticated;

/* Las personas de un segmento, como la lista de Contactos (la última
   actividad arriba), con buscador adentro del segmento. */
create or replace function crm_segmento_lista(p_pin text, p_reglas jsonb, p_buscar text default null, p_limite integer default 300)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q  text := nullif(lower(trim(coalesce(p_buscar, ''))), '');
  qd text := nullif(regexp_replace(coalesce(p_buscar, ''), '[^0-9]', '', 'g'), '');
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  with f as materialized (
    select p.* from crm_personas() p
     where crm_cumple(p, coalesce(p_reglas, '{}'::jsonb))
       and (q is null
            or lower(coalesce(p.nombre, '')) like '%' || q || '%'
            or coalesce(p.mail, '') like '%' || q || '%'
            or (qd is not null and length(qd) >= 3 and coalesce(p.tel, '') like '%' || qd || '%')
            or exists (select 1 from unnest(p.etq) x where x like '%' || q || '%'))
  )
  select jsonb_build_object(
           'cuentas', jsonb_build_object('todos', (select count(*) from f)),
           'contactos', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'clave', y.clave, 'nombre', y.nombre, 'tel', y.tel, 'mail', y.mail, 'fuentes', to_jsonb(y.fuentes),
                      'ultima', y.ultima, 'ultimo', y.ultimo, 'compras_tienda', y.n_tienda, 'gastado_tienda', y.gasto_tienda,
                      'nivel', y.nivel, 'acepta', y.acepta, 'etiquetas', to_jsonb(y.etiquetas))
                    order by y.ultima desc)
               from (select * from f order by f.ultima desc limit greatest(coalesce(p_limite, 300), 1)) y), '[]'::jsonb))
    into salida;
  return salida;
end;
$$;
grant execute on function crm_segmento_lista(text, jsonb, text, integer) to anon, authenticated;

/* Los segmentos guardados, cada uno con cuántos son hoy, y los locales que
   aparecen en los datos (para elegir). */
create or replace function crm_segmentos_listar(p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  with p as materialized (select x as fila, x.clave, x.acepta from crm_personas() x)
  select jsonb_build_object(
           'segmentos', coalesce((
             select jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.nombre, 'reglas', s.reglas, 'creado_por', s.creado_por,
                                                 'creado', s.creado, 'total', c.total, 'con_telefono', c.con_tel, 'acepta', c.acepta)
                              order by s.creado, s.id)
               from crm_segmentos s
               cross join lateral (select count(*) as total, count(*) filter (where p.clave !~ '^m:') as con_tel,
                                          count(*) filter (where p.acepta) as acepta
                                     from p where crm_cumple(p.fila, s.reglas)) c), '[]'::jsonb),
           'locales', coalesce((select jsonb_agg(distinct l order by l) from p, unnest((p.fila).locales) l), '[]'::jsonb))
    into salida;
  return salida;
end;
$$;
grant execute on function crm_segmentos_listar(text) to anon, authenticated;

/* Guardar (nuevo o cambiado) y borrar. */
create or replace function crm_segmento_guardar(p_pin text, p_id bigint, p_nombre text, p_reglas jsonb, p_quien text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_nombre text := nullif(trim(coalesce(p_nombre, '')), '');
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if v_nombre is null then
    raise exception 'Ponele un nombre al segmento.';
  end if;
  if p_reglas is null or jsonb_typeof(p_reglas) <> 'object' then
    raise exception 'Faltan las condiciones del segmento.';
  end if;
  if p_id is null then
    insert into crm_segmentos (nombre, reglas, creado_por)
    values (left(v_nombre, 80), p_reglas, nullif(trim(coalesce(p_quien, '')), ''))
    returning id into v_id;
  else
    update crm_segmentos set nombre = left(v_nombre, 80), reglas = p_reglas, actualizado = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Ese segmento ya no existe.';
    end if;
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;
grant execute on function crm_segmento_guardar(text, bigint, text, jsonb, text) to anon, authenticated;

create or replace function crm_segmento_borrar(p_pin text, p_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  delete from crm_segmentos where id = p_id;
  return jsonb_build_object('borrado', found);
end;
$$;
grant execute on function crm_segmento_borrar(text, bigint) to anon, authenticated;

select 'listo: segmentos que se arman en el CRM' as "SQL 66";


-- ─────────────────────────── PARTE 67 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · LOS DOS NÚMEROS, EL HISTORIAL DE LA TIENDA Y EL TABLERO TIENDA ONLINE
--
-- Correr en el editor SQL de Supabase.
--
-- Pedido de Mauricio (10/10/2026), el día que el número de la tienda volvió
-- a la API:
--   · Cada número con su nombre: "No Compra" (223 584-5942: No Compra y
--     carritos) y "Tienda online" (11 6377-8377: el que atiende Ale). En
--     Mensajes se ve por cuál escribió cada uno y se puede filtrar.
--   · Los chats de los últimos 6 meses del celular de la tienda (Meta los
--     mandó al conectarlo) pasan a las conversaciones. Lo que vino del
--     celular no cuenta como "sin contestar": si no, Mensajes se llenaría de
--     chats de hace meses.
--   · Tienda online es un tablero: cada consulta nueva al número de la
--     tienda es una tarjeta que se mueve sola. Nueva consulta → En
--     conversación (cuando le contestan) → Le pasamos el link (cuando le
--     mandan uno de vdh.com.ar) → Compró (si compra en la tienda online con
--     ese teléfono) o No compró (7 días sin hablar y sin compra).
-- ══════════════════════════════════════════════════════════════════════════

/* Nuestros números. "tablero": a qué tablero van sus consultas. */
create table if not exists wa_numeros (
  numero_id text primary key,
  nombre    text not null,
  telefono  text,
  tablero   text,
  orden     integer not null default 0
);
alter table wa_numeros enable row level security;
revoke all on wa_numeros from anon, authenticated;
insert into wa_numeros (numero_id, nombre, telefono, tablero, orden) values
  ('735773436291993', 'No Compra',     '223 584-5942', null,     1),
  ('508875356745926', 'Tienda online', '11 6377-8377', 'tienda', 2)
on conflict (numero_id) do nothing;

/* Lo que vino del historial del celular, no de un aviso en el momento. */
alter table wa_mensajes add column if not exists historial boolean not null default false;
create index if not exists wa_mensajes_numero on wa_mensajes (numero_id, cuando desc);

/* Las consultas de la tienda: una tarjeta por consulta. "sola" es que la
   cerró la base (por una compra o por los 7 días); "pedido", la compra. */
create table if not exists crm_consultas (
  id        bigserial primary key,
  clave     text not null,
  tel       text,
  numero_id text not null,
  columna   text not null default 'Nueva consulta'
            check (columna in ('Nueva consulta', 'En conversación', 'Le pasamos el link', 'Compró', 'No compró')),
  creada    timestamptz not null default now(),
  movida    timestamptz not null default now(),
  cerrada   timestamptz,
  sola      boolean not null default false,
  pedido    jsonb,
  quien     text
);
create index if not exists crm_consultas_clave on crm_consultas (clave, creada desc);
create unique index if not exists crm_consultas_abierta on crm_consultas (clave, numero_id) where cerrada is null;
alter table crm_consultas enable row level security;
revoke all on crm_consultas from anon, authenticated;

/* Un mensaje en el momento (no del historial) por un número con tablero.
   El que escribe sin una consulta abierta abre una; lo que le contestamos
   la mueve hacia adelante. Un "gracias" en las 24 h después de cerrarla no
   abre otra. */
create or replace function crm_consulta_mensaje(p_tel text, p_numero_id text, p_sentido text, p_texto text,
                                                p_cuando timestamptz, p_quien text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clave text := club_tel10(p_tel);
  v_id bigint; v_col text;
begin
  if v_clave is null or not exists (select 1 from wa_numeros n where n.numero_id = p_numero_id and n.tablero = 'tienda') then
    return;
  end if;
  select c.id, c.columna into v_id, v_col
    from crm_consultas c
   where c.clave = v_clave and c.numero_id = p_numero_id and c.cerrada is null;
  if p_sentido = 'entra' then
    if v_id is null and not exists (select 1 from crm_consultas c
                                     where c.clave = v_clave and c.numero_id = p_numero_id
                                       and c.cerrada > p_cuando - interval '24 hours') then
      insert into crm_consultas (clave, tel, numero_id, creada, movida)
      values (v_clave, p_tel, p_numero_id, p_cuando, p_cuando)
      on conflict do nothing;
    end if;
    return;
  end if;
  if v_id is null then return; end if;
  if coalesce(p_texto, '') ~* 'vdh\.com\.ar' and v_col in ('Nueva consulta', 'En conversación') then
    update crm_consultas set columna = 'Le pasamos el link', movida = p_cuando, quien = coalesce(p_quien, quien) where id = v_id;
  elsif v_col = 'Nueva consulta' then
    update crm_consultas set columna = 'En conversación', movida = p_cuando, quien = coalesce(p_quien, quien) where id = v_id;
  end if;
end;
$$;
revoke execute on function crm_consulta_mensaje(text, text, text, text, timestamptz, text) from public, anon, authenticated;

/* Lo que trae un aviso de Meta, a wa_mensajes. Aparte de wa_recibir para
   poder pasar de nuevo avisos ya guardados (el historial).
   El historial ("history") trae las conversaciones por partes: cada una con
   el teléfono del cliente y sus mensajes; los de la tienda vienen marcados
   con from_me. Las fotos y archivos llegan sueltos, con la forma de un
   mensaje o de un eco, y completan el lugar que les guardó el historial
   ("media_placeholder"). Un mensaje editado trae el id del original y el
   texto nuevo: si el original está, queda el texto nuevo; si no (en el
   historial del 10/10 no vino ninguno), queda como un mensaje más, tipo
   "edit", con el texto nuevo. */
create or replace function wa_procesar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb; c jsonb; v jsonb; m jsonb; s jsonb; h jsonb; t jsonb;
  v_numero_id text; v_numero text; v_hist boolean; v_propio boolean;
  entran integer := 0; ecos integer := 0; estados integer := 0; otros integer := 0; de_otra integer := 0;
  viejos integer := 0; editados integer := 0;
  n integer;
  orden constant text[] := array['sent', 'delivered', 'read'];
begin
  for e in select * from jsonb_array_elements(coalesce(p->'entry', '[]'::jsonb)) loop
    for c in select * from jsonb_array_elements(coalesce(e->'changes', '[]'::jsonb)) loop
      v := c->'value';
      v_numero_id := v->'metadata'->>'phone_number_id';
      v_numero := v->'metadata'->>'display_phone_number';
      v_hist := c->>'field' = 'history';

      if c->>'field' in ('messages', 'history') then
        for m in select * from jsonb_array_elements(coalesce(v->'messages', '[]'::jsonb)) loop
          insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, media, perfil, cuando, historial)
          values (m->>'id', v_numero_id, v_numero, m->>'from', 'entra', 'cliente', m->>'type', wa_texto(m),
                  case when m->>'type' in ('image', 'video', 'audio', 'document', 'sticker') then m->(m->>'type') end,
                  (select x->'profile'->>'name' from jsonb_array_elements(coalesce(v->'contacts', '[]'::jsonb)) x
                    where x->>'wa_id' = m->>'from' limit 1),
                  to_timestamp((m->>'timestamp')::bigint), v_hist)
          on conflict (wamid) do update
            set tipo = excluded.tipo, texto = coalesce(excluded.texto, wa_mensajes.texto), media = excluded.media
            where wa_mensajes.tipo = 'media_placeholder';
          get diagnostics n = row_count;
          entran := entran + n;
          if n > 0 and not v_hist and coalesce(m->>'type', '') <> 'reaction' then
            perform crm_consulta_mensaje(m->>'from', v_numero_id, 'entra', wa_texto(m), to_timestamp((m->>'timestamp')::bigint));
          end if;
        end loop;

        /* Los estados sólo avanzan: un "entregado" que llega tarde no
           pisa un "leído". "failed" pisa siempre. */
        for s in select * from jsonb_array_elements(coalesce(v->'statuses', '[]'::jsonb)) loop
          update wa_mensajes w
             set estado = s->>'status', error = coalesce(s->'errors', w.error)
           where w.wamid = s->>'id'
             and (s->>'status' = 'failed' or w.estado is null
                  or coalesce(array_position(orden, s->>'status'), 0) > coalesce(array_position(orden, w.estado), 0));
          get diagnostics n = row_count;
          estados := estados + n;
          /* El estado de algo que no tenemos es algo que salió por otra app
             (Kommo): se deja la marca de que se contestó. */
          if n = 0 and s->>'recipient_id' is not null
             and not exists (select 1 from wa_mensajes w where w.wamid = s->>'id') then
            insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, estado, error, cuando)
            values (s->>'id', v_numero_id, v_numero, s->>'recipient_id', 'sale', 'otra_app', 'desconocido',
                    s->>'status', s->'errors', coalesce(to_timestamp((s->>'timestamp')::bigint), now()))
            on conflict (wamid) do nothing;
            get diagnostics n = row_count;
            de_otra := de_otra + n;
            if n > 0 then
              perform crm_consulta_mensaje(s->>'recipient_id', v_numero_id, 'sale', null,
                                           coalesce(to_timestamp((s->>'timestamp')::bigint), now()));
            end if;
          end if;
        end loop;
      end if;

      if c->>'field' = 'smb_message_echoes' or (v_hist and v ? 'message_echoes') then
        for m in select * from jsonb_array_elements(coalesce(v->'message_echoes', '[]'::jsonb)) loop
          insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, media, cuando, historial)
          values (m->>'id', v_numero_id, v_numero, m->>'to', 'sale', 'celular', m->>'type', wa_texto(m),
                  case when m->>'type' in ('image', 'video', 'audio', 'document', 'sticker') then m->(m->>'type') end,
                  to_timestamp((m->>'timestamp')::bigint), v_hist)
          on conflict (wamid) do update
            set desde = 'celular', tipo = excluded.tipo, texto = coalesce(excluded.texto, wa_mensajes.texto), media = excluded.media
            where wa_mensajes.desde = 'otra_app' or wa_mensajes.tipo = 'media_placeholder';
          get diagnostics n = row_count;
          ecos := ecos + n;
          if n > 0 and not v_hist and coalesce(m->>'type', '') <> 'reaction' then
            perform crm_consulta_mensaje(m->>'to', v_numero_id, 'sale', wa_texto(m), to_timestamp((m->>'timestamp')::bigint));
          end if;
        end loop;
      end if;

      if v_hist then
        for h in select * from jsonb_array_elements(coalesce(v->'history', '[]'::jsonb)) loop
          for t in select * from jsonb_array_elements(coalesce(h->'threads', '[]'::jsonb)) loop
            for m in select * from jsonb_array_elements(coalesce(t->'messages', '[]'::jsonb)) loop
              if m->>'type' = 'edit' then
                update wa_mensajes w set texto = coalesce(wa_texto(m->'edit'->'message'), w.texto)
                 where w.wamid = m->'edit'->>'original_message_id';
                get diagnostics n = row_count;
                editados := editados + n;
                if n > 0 then continue; end if;
              end if;
              v_propio := coalesce((m->'history_context'->>'from_me')::boolean, false);
              insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, estado, cuando, historial)
              values (m->>'id', v_numero_id, v_numero, t->>'id',
                      case when v_propio then 'sale' else 'entra' end,
                      case when v_propio then 'celular' else 'cliente' end,
                      m->>'type', case when m->>'type' = 'edit' then wa_texto(m->'edit'->'message') else wa_texto(m) end,
                      case when v_propio then lower(m->'history_context'->>'status') end,
                      to_timestamp((m->>'timestamp')::bigint), true)
              on conflict (wamid) do nothing;
              get diagnostics n = row_count;
              viejos := viejos + n;
            end loop;
          end loop;
        end loop;
      end if;

      if c->>'field' not in ('messages', 'smb_message_echoes', 'history') then
        otros := otros + 1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('entran', entran, 'ecos', ecos, 'estados', estados, 'de_otra_app', de_otra,
                            'historial', viejos, 'editados', editados, 'otros', otros);
end;
$$;
revoke execute on function wa_procesar(jsonb) from public, anon, authenticated;

create or replace function wa_recibir(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  res jsonb;
begin
  res := wa_procesar(p);
  insert into wa_avisos (cuerpo, resultado) values (p, res);
  return res;
end;
$$;
revoke execute on function wa_recibir(jsonb) from public, anon, authenticated;
grant  execute on function wa_recibir(jsonb) to service_role;

/* Lo que Meta aceptó desde el CRM (texto o plantilla). Ahora además mueve
   la tarjeta de la consulta, si la hay. */
create or replace function wa_anotar_envio(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, media, quien, cuando)
  values (p->>'wamid', p->>'numero_id', p->>'numero', p->>'tel', 'sale', 'crm', coalesce(nullif(p->>'tipo', ''), 'text'),
          p->>'texto', p->'media', nullif(trim(p->>'quien'), ''), now())
  on conflict (wamid) do update
    set desde = 'crm', tipo = excluded.tipo, texto = excluded.texto, media = excluded.media, quien = excluded.quien
    where wa_mensajes.desde = 'otra_app'
  returning id into v_id;
  perform crm_consulta_mensaje(p->>'tel', p->>'numero_id', 'sale', p->>'texto', now(), nullif(trim(p->>'quien'), ''));
  return jsonb_build_object('id', v_id);
end;
$$;
revoke execute on function wa_anotar_envio(jsonb) from public, anon, authenticated;
grant  execute on function wa_anotar_envio(jsonb) to service_role;

/* El historial que ya llegó (Meta lo mandó el 10/10, a las 10:40). */
do $hist$
declare
  a record;
begin
  for a in select w.id, w.cuerpo from wa_avisos w
            where exists (select 1 from jsonb_array_elements(coalesce(w.cuerpo->'entry', '[]'::jsonb)) e,
                                        jsonb_array_elements(coalesce(e->'changes', '[]'::jsonb)) ch
                           where ch->>'field' = 'history')
            order by w.id loop
    perform wa_procesar(a.cuerpo);
  end loop;
end $hist$;

/* Para arrancar con el tablero lleno: las conversaciones de la tienda de
   los últimos 7 días ya son tarjetas, en la columna que les toca. */
insert into crm_consultas (clave, tel, numero_id, creada, movida)
select club_tel10(m.tel), (array_agg(m.tel order by m.cuando desc))[1], m.numero_id, min(m.cuando), min(m.cuando)
  from wa_mensajes m
  join wa_numeros n on n.numero_id = m.numero_id and n.tablero = 'tienda'
 where m.sentido = 'entra' and m.tipo <> 'reaction' and m.cuando > now() - interval '7 days'
   and club_tel10(m.tel) is not null
   and not exists (select 1 from crm_consultas c where c.clave = club_tel10(m.tel) and c.numero_id = m.numero_id)
 group by club_tel10(m.tel), m.numero_id
on conflict do nothing;
update crm_consultas c
   set columna = case
         when exists (select 1 from wa_mensajes w where club_tel10(w.tel) = c.clave and w.numero_id = c.numero_id
                         and w.sentido = 'sale' and w.cuando >= c.creada and coalesce(w.texto, '') ~* 'vdh\.com\.ar')
           then 'Le pasamos el link'
         when exists (select 1 from wa_mensajes w where club_tel10(w.tel) = c.clave and w.numero_id = c.numero_id
                         and w.sentido = 'sale' and w.cuando >= c.creada)
           then 'En conversación'
         else 'Nueva consulta' end
 where c.cerrada is null and c.columna = 'Nueva consulta';

/* El tablero Tienda online. Antes de armarlo se pone al día solo:
   - Compró: un pedido pagado de vdh.com.ar con ese teléfono, desde la
     consulta (o una hora antes) hasta 30 días después. También si ya se
     había cerrado como "No compró".
   - No compró: 7 días sin hablar (ni la persona ni nosotros).
   Trae las abiertas y las cerradas de los últimos 30 días, con lo último que
   se dijo, si espera respuesta y desde cuándo, y el resumen del mes. */
create or replace function crm_tienda(p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  update crm_consultas c
     set columna = 'Compró', cerrada = x.cuando, movida = now(), sola = true,
         pedido = jsonb_build_object('numero', x.numero, 'total', x.total, 'cuando', x.cuando)
    from (select c2.id, o.numero, o.total, o.cuando
            from crm_consultas c2
            cross join lateral (
              select t.numero, t.total, coalesce(t.pagado, t.creado) as cuando
                from tienda_pedidos t
               where club_tel10(t.telefono) = c2.clave
                 and t.pago = 'paid' and coalesce(t.estado, '') <> 'cancelled'
                 and coalesce(t.pagado, t.creado) between c2.creada - interval '1 hour' and c2.creada + interval '30 days'
               order by coalesce(t.pagado, t.creado)
               limit 1) o
           where c2.columna <> 'Compró' and c2.creada > now() - interval '45 days') x
   where x.id = c.id;

  update crm_consultas c
     set columna = 'No compró', cerrada = coalesce(u.ultima, c.creada), movida = now(), sola = true
    from (select c2.id, (select max(w.cuando) from wa_mensajes w
                          where club_tel10(w.tel) = c2.clave and w.numero_id = c2.numero_id) as ultima
            from crm_consultas c2 where c2.cerrada is null) u
   where u.id = c.id and coalesce(u.ultima, c.creada) < now() - interval '7 days';

  with k as (
    select c.* from crm_consultas c
     where c.cerrada is null or c.cerrada > now() - interval '30 days'
  ),
  w as (
    select k.id as kid, k.creada, m.*
      from k join wa_mensajes m on club_tel10(m.tel) = k.clave and m.numero_id = k.numero_id
  ),
  ult as (
    select distinct on (w.kid) w.kid, w.sentido, w.desde, w.tipo, w.texto, w.estado, w.cuando, w.quien
      from w order by w.kid, w.cuando desc, w.id desc
  ),
  cuenta as (
    select w.kid, count(*) filter (where w.cuando >= w.creada) as n,
           max(w.cuando) filter (where w.sentido = 'sale') as ultima_sale,
           (array_agg(nullif(trim(w.perfil), '') order by w.cuando desc) filter (where nullif(trim(w.perfil), '') is not null))[1] as perfil
      from w group by w.kid
  ),
  espera as (
    select w.kid, min(w.cuando) as desde
      from w join cuenta cu on cu.kid = w.kid
     where w.sentido = 'entra' and not w.historial and w.tipo <> 'reaction'
       and w.cuando > coalesce(cu.ultima_sale, '-infinity'::timestamptz)
     group by w.kid
  ),
  nm as (
    select b.clave,
           (array_agg(b.nombre order by b.cuando desc) filter (where b.nombre is not null))[1] as nombre,
           array_agg(distinct b.fuente) as fuentes, max(b.nivel) as nivel
      from crm_contactos_base() b
     where b.fuente <> 'whatsapp' and b.clave in (select k.clave from k)
     group by b.clave
  )
  select jsonb_build_object(
    'columnas', to_jsonb(array['Nueva consulta', 'En conversación', 'Le pasamos el link', 'Compró', 'No compró']),
    'resumen', (select jsonb_build_object(
                  'consultas', count(*),
                  'compraron', count(*) filter (where c.columna = 'Compró'),
                  'vendido', coalesce(sum((c.pedido->>'total')::numeric) filter (where c.columna = 'Compró'), 0))
                  from crm_consultas c where c.creada > now() - interval '30 days'),
    'tarjetas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', k.id, 'clave', k.clave, 'tel', k.tel, 'columna', k.columna, 'creada', k.creada, 'movida', k.movida,
               'cerrada', k.cerrada, 'sola', k.sola, 'pedido', k.pedido, 'quien', k.quien,
               'nombre', coalesce(nm.nombre, cu.perfil), 'fuentes', coalesce(to_jsonb(nm.fuentes), '[]'::jsonb), 'nivel', nm.nivel,
               'n', coalesce(cu.n, 0), 'espera', es.desde,
               'ultimo', case when u.kid is null then null else jsonb_build_object(
                           'texto', u.texto, 'tipo', u.tipo, 'sentido', u.sentido, 'desde', u.desde, 'cuando', u.cuando, 'quien', u.quien) end)
             order by k.creada desc)
        from k
        left join ult u on u.kid = k.id
        left join cuenta cu on cu.kid = k.id
        left join espera es on es.kid = k.id
        left join nm on nm.clave = k.clave), '[]'::jsonb))
    into salida;
  return salida;
end;
$$;
grant execute on function crm_tienda(text) to anon, authenticated;

/* Mover una tarjeta a mano. A "Compró" o "No compró" la cierra; a otra
   columna la vuelve a abrir (si la persona no tiene ya otra abierta). */
create or replace function crm_consulta_mover(p_pin text, p_id bigint, p_columna text, p_quien text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if p_columna is null or p_columna not in ('Nueva consulta', 'En conversación', 'Le pasamos el link', 'Compró', 'No compró') then
    raise exception 'Esa columna no existe.';
  end if;
  begin
    update crm_consultas c
       set columna = p_columna, movida = now(), sola = false, quien = nullif(trim(coalesce(p_quien, '')), ''),
           cerrada = case when p_columna in ('Compró', 'No compró') then coalesce(c.cerrada, now()) end,
           pedido = case when p_columna = 'Compró' then c.pedido end
     where c.id = p_id;
    get diagnostics n = row_count;
  exception when unique_violation then
    raise exception 'Esa persona ya tiene otra consulta abierta: mové esa.';
  end;
  if n = 0 then
    raise exception 'Esa consulta ya no existe.';
  end if;
  return jsonb_build_object('id', p_id, 'columna', p_columna);
end;
$$;
grant execute on function crm_consulta_mover(text, bigint, text, text) to anon, authenticated;

/* Mensajes, ahora con el número por el que habló cada uno y el filtro. Lo
   que vino del historial no cuenta como "sin contestar". */
drop function if exists crm_mensajes(text, text, integer);
create or replace function crm_mensajes(p_pin text, p_buscar text default null, p_limite integer default 200,
                                        p_numero text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q  text := nullif(lower(trim(coalesce(p_buscar, ''))), '');
  qd text := nullif(regexp_replace(coalesce(p_buscar, ''), '[^0-9]', '', 'g'), '');
  v_num text := nullif(trim(coalesce(p_numero, '')), '');
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  with w as (select club_tel10(m.tel) as clave, m.* from wa_mensajes m),
  ult as (
    select distinct on (w.clave) w.clave, w.id, w.tel, w.numero_id, w.sentido, w.desde, w.tipo, w.texto, w.estado, w.cuando, w.historial
      from w order by w.clave, w.cuando desc, w.id desc
  ),
  conv as (
    select w.clave, count(*) as n,
           (array_agg(nullif(trim(w.perfil), '') order by w.cuando desc) filter (where nullif(trim(w.perfil), '') is not null))[1] as perfil,
           max(w.cuando) filter (where w.sentido = 'sale') as ultima_sale,
           max(w.cuando) filter (where w.sentido = 'entra') as ultima_entra
      from w group by w.clave
  ),
  /* Por cuáles de nuestros números habló, el último primero. */
  nums as (
    select x.clave, array_agg(x.numero_id order by x.ult desc) as numeros
      from (select w.clave, w.numero_id, max(w.cuando) as ult from w group by w.clave, w.numero_id) x
     group by x.clave
  ),
  pend as (
    select w.clave, count(*) as pendientes
      from w join conv c on c.clave = w.clave
     where w.sentido = 'entra' and not w.historial and w.cuando > coalesce(c.ultima_sale, '-infinity'::timestamptz)
     group by w.clave
  ),
  nm as (
    select b.clave,
           (array_agg(b.nombre order by b.cuando desc) filter (where b.nombre is not null))[1] as nombre,
           array_agg(distinct b.fuente) as fuentes, max(b.nivel) as nivel
      from crm_contactos_base() b
     where b.fuente <> 'whatsapp' and b.clave in (select conv.clave from conv)
     group by b.clave
  ),
  x as (
    select c.clave, u.tel, coalesce(nm.nombre, c.perfil) as nombre, c.perfil,
           coalesce(nm.fuentes, '{}'::text[]) as fuentes, nm.nivel, c.n,
           coalesce(p.pendientes, 0) as pendientes, (u.sentido = 'entra' and not u.historial) as sin_contestar,
           u.cuando as ultima, c.ultima_entra, u.numero_id, ns.numeros,
           jsonb_build_object('texto', u.texto, 'tipo', u.tipo, 'sentido', u.sentido, 'desde', u.desde, 'estado', u.estado) as ultimo
      from conv c
      join ult u on u.clave = c.clave
      join nums ns on ns.clave = c.clave
      left join pend p on p.clave = c.clave
      left join nm on nm.clave = c.clave
  ),
  f as (
    select * from x
     where (v_num is null or v_num = any(x.numeros))
       and (q is null
            or lower(coalesce(x.nombre, '')) like '%' || q || '%'
            or lower(coalesce(x.perfil, '')) like '%' || q || '%'
            or (qd is not null and length(qd) >= 3 and x.tel like '%' || qd || '%')
            or exists (select 1 from w where w.clave = x.clave and lower(coalesce(w.texto, '')) like '%' || q || '%'))
  )
  select jsonb_build_object(
           'cuentas', jsonb_build_object('todas', (select count(*) from x),
                                         'sin_contestar', (select count(*) from x where x.sin_contestar)),
           'numeros', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', nu.numero_id, 'nombre', nu.nombre, 'telefono', nu.telefono, 'tablero', nu.tablero,
                      'todas', (select count(*) from x where nu.numero_id = any(x.numeros)),
                      'sin_contestar', (select count(*) from x where x.sin_contestar and x.numero_id = nu.numero_id))
                    order by nu.orden)
               from wa_numeros nu), '[]'::jsonb),
           'ultimo_id', (select max(m.id) from wa_mensajes m),
           'conversaciones', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'clave', y.clave, 'tel', y.tel, 'nombre', y.nombre, 'perfil', y.perfil,
                      'fuentes', to_jsonb(y.fuentes), 'nivel', y.nivel, 'n', y.n, 'pendientes', y.pendientes,
                      'sin_contestar', y.sin_contestar, 'ultima', y.ultima, 'ultima_entra', y.ultima_entra,
                      'numero', y.numero_id, 'numeros', to_jsonb(y.numeros), 'ultimo', y.ultimo)
                    order by y.ultima desc)
               from (select * from f order by f.ultima desc limit greatest(coalesce(p_limite, 200), 1)) y), '[]'::jsonb))
    into salida;
  return salida;
end;
$$;
grant execute on function crm_mensajes(text, text, integer, text) to anon, authenticated;

/* Lo mínimo, para preguntar seguido: el último mensaje y cuántas
   conversaciones esperan respuesta, en total, por número y en los números
   con tablero (el numerito de Tienda online en el menú). */
create or replace function crm_mensajes_ultimo(p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  with u as (
    select distinct on (club_tel10(m.tel)) m.sentido, m.historial, m.numero_id
      from wa_mensajes m
     order by club_tel10(m.tel), m.cuando desc, m.id desc
  ),
  s as (select * from u where u.sentido = 'entra' and not u.historial)
  select jsonb_build_object(
           'ultimo_id', (select max(m.id) from wa_mensajes m),
           'sin_contestar', (select count(*) from s),
           'por_numero', coalesce((select jsonb_object_agg(z.numero_id, z.n)
                                     from (select s.numero_id, count(*) as n from s group by s.numero_id) z), '{}'::jsonb),
           'tienda', (select count(*) from s join wa_numeros nu on nu.numero_id = s.numero_id and nu.tablero = 'tienda'))
    into salida;
  return salida;
end;
$$;
grant execute on function crm_mensajes_ultimo(text) to anon, authenticated;

/* La ficha: cada mensaje dice por cuál de nuestros números fue y si vino del
   historial; además, los nombres de los números y la última consulta de la
   tienda de esa persona (para moverla desde la ficha). */
create or replace function crm_contacto(p_pin text, p_clave text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  /* Con prefijo: "tel" y "mail" son también columnas de lo que se consulta,
     y PL/pgSQL no sabría a cuál le hablan. */
  v_filas jsonb; v_tel text; v_mail text; v_nombre text; v_acepta boolean; v_etq jsonb;
  socio_id bigint; socio jsonb; historia jsonb;
  v_mensajes jsonb; v_ventana timestamptz; v_numeros jsonb; v_consulta jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if coalesce(trim(p_clave), '') = '' then return null; end if;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.cuando desc), '[]'::jsonb) into v_filas
    from crm_contactos_base() b where b.clave = p_clave;
  if jsonb_array_length(v_filas) = 0 then return null; end if;

  select max(x.e->>'tel'),
         (array_agg(x.e->>'mail' order by x.i) filter (where x.e->>'mail' is not null))[1],
         (array_agg(x.e->>'nombre' order by (x.e->>'fuente' = 'whatsapp'), x.i) filter (where x.e->>'nombre' is not null))[1],
         bool_or((x.e->>'acepta')::boolean)
    into v_tel, v_mail, v_nombre, v_acepta
    from jsonb_array_elements(v_filas) with ordinality as x(e, i);
  select coalesce(to_jsonb(array_agg(distinct t order by t)), '[]'::jsonb) into v_etq
    from jsonb_array_elements(v_filas) as x(e), jsonb_array_elements_text(x.e->'etiquetas') as t;

  select c.id into socio_id from club_clientes c
   where c.baja is null
     and ((v_tel is not null and club_tel10(c.telefono) = v_tel) or (v_mail is not null and lower(trim(c.mail)) = v_mail))
   order by (v_tel is not null and club_tel10(c.telefono) = v_tel) desc, c.creado
   limit 1;
  if socio_id is not null then
    select jsonb_build_object('nombre', v.nombre, 'nivel', v.nivel, 'puntos', v.puntos, 'compras', v.compras,
                              'gastado', v.gastado, 'ultima_compra', v.ultima_compra, 'desde', v.creado, 'local', v.local_alta)
      into socio from v_club_clientes v where v.id = socio_id;
  end if;

  select coalesce(jsonb_agg(h order by (h->>'cuando')::timestamptz desc), '[]'::jsonb) into historia
    from (
      select jsonb_build_object('fuente', x.e->>'fuente', 'ref', (x.e->>'ref')::bigint, 'cuando', x.e->'cuando',
                                'datos', x.e->'datos') as h
        from jsonb_array_elements(v_filas) as x(e)
       where x.e->>'fuente' <> 'whatsapp'
      union all
      select jsonb_build_object('fuente', 'nota', 'ref', ev.ref, 'cuando', ev.cuando,
                                'datos', jsonb_build_object('de', ev.fuente, 'quien', ev.quien, 'texto', ev.detalle))
        from crm_eventos ev
       where ev.tipo = 'nota'
         and exists (select 1 from jsonb_array_elements(v_filas) as x(e)
                      where x.e->>'fuente' = ev.fuente and (x.e->>'ref')::bigint = ev.ref)
    ) t;

  /* La conversación de WhatsApp (las últimas 200, en orden) y hasta cuándo
     se le puede contestar gratis: 24 h desde que escribió. */
  if v_tel is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'sentido', w.sentido, 'desde', w.desde, 'tipo', w.tipo,
                                                 'texto', w.texto, 'estado', w.estado, 'cuando', w.cuando, 'quien', w.quien,
                                                 'error', w.error, 'numero_id', w.numero_id, 'historial', w.historial)
                              order by w.cuando, w.id), '[]'::jsonb)
      into v_mensajes
      from (select * from wa_mensajes m where club_tel10(m.tel) = v_tel order by m.cuando desc, m.id desc limit 200) w;
    select max(m.cuando) + interval '24 hours' into v_ventana
      from wa_mensajes m where club_tel10(m.tel) = v_tel and m.sentido = 'entra';
    select jsonb_build_object('id', c.id, 'columna', c.columna, 'creada', c.creada, 'cerrada', c.cerrada,
                              'sola', c.sola, 'pedido', c.pedido)
      into v_consulta
      from crm_consultas c where c.clave = v_tel
     order by (c.cerrada is null) desc, c.creada desc
     limit 1;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', n.numero_id, 'nombre', n.nombre, 'telefono', n.telefono, 'tablero', n.tablero)
                            order by n.orden), '[]'::jsonb)
    into v_numeros from wa_numeros n;
  return jsonb_build_object(
    'persona', jsonb_build_object('clave', p_clave, 'nombre', v_nombre, 'tel', v_tel, 'mail', v_mail,
                                  'acepta', v_acepta, 'etiquetas', v_etq),
    'socio', socio, 'historia', historia,
    'mensajes', coalesce(v_mensajes, '[]'::jsonb), 'ventana', v_ventana,
    'numeros', v_numeros, 'consulta', v_consulta);
end;
$$;
grant execute on function crm_contacto(text, text) to anon, authenticated;

select 'listo: los dos números, el historial de la tienda y el tablero Tienda online' as "SQL 67";


-- ─────────────────────────── PARTE 68 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · LA AGENDA DEL CELULAR DE LA TIENDA
--
-- Correr en el editor SQL de Supabase (después del 67).
--
-- Pedido de Mauricio (10/10/2026): el historial de la tienda trajo las
-- conversaciones pero no los nombres. Meta también manda los contactos
-- agendados en el celular (con el nombre con que los guardaron) y después
-- avisa cada vez que agendan, cambian o borran uno.
--   · Se guardan en wa_agenda.
--   · El nombre se usa cuando no hay uno mejor: primero el de las compras,
--     el Club, los carritos o los No Compra; después el de la agenda; al
--     final, el del perfil de WhatsApp. En Mensajes, Contactos, la ficha y
--     Tienda online.
--   · Los agendados que nunca escribieron no aparecen en Contactos (pueden
--     ser proveedores o gente de la empresa).
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists wa_agenda (
  numero_id     text not null,
  clave         text not null,
  tel           text,
  nombre        text,
  primer_nombre text,
  actualizado   timestamptz not null default now(),
  borrado       boolean not null default false,
  primary key (numero_id, clave)
);
create index if not exists wa_agenda_clave on wa_agenda (clave);
alter table wa_agenda enable row level security;
revoke all on wa_agenda from anon, authenticated;

/* El nombre de agenda de una persona (el último que se guardó). */
create or replace function wa_agenda_nombre(p_clave text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.nombre from wa_agenda a
   where a.clave = p_clave and not a.borrado and a.nombre is not null
   order by a.actualizado desc
   limit 1
$$;
revoke execute on function wa_agenda_nombre(text) from public, anon, authenticated;

create or replace function wa_procesar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb; c jsonb; v jsonb; m jsonb; s jsonb; h jsonb; t jsonb;
  v_numero_id text; v_numero text; v_hist boolean; v_propio boolean;
  entran integer := 0; ecos integer := 0; estados integer := 0; otros integer := 0; de_otra integer := 0;
  viejos integer := 0; editados integer := 0; agenda integer := 0;
  n integer;
  orden constant text[] := array['sent', 'delivered', 'read'];
begin
  for e in select * from jsonb_array_elements(coalesce(p->'entry', '[]'::jsonb)) loop
    for c in select * from jsonb_array_elements(coalesce(e->'changes', '[]'::jsonb)) loop
      v := c->'value';
      v_numero_id := v->'metadata'->>'phone_number_id';
      v_numero := v->'metadata'->>'display_phone_number';
      v_hist := c->>'field' = 'history';

      if c->>'field' in ('messages', 'history') then
        for m in select * from jsonb_array_elements(coalesce(v->'messages', '[]'::jsonb)) loop
          insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, media, perfil, cuando, historial)
          values (m->>'id', v_numero_id, v_numero, m->>'from', 'entra', 'cliente', m->>'type', wa_texto(m),
                  case when m->>'type' in ('image', 'video', 'audio', 'document', 'sticker') then m->(m->>'type') end,
                  (select x->'profile'->>'name' from jsonb_array_elements(coalesce(v->'contacts', '[]'::jsonb)) x
                    where x->>'wa_id' = m->>'from' limit 1),
                  to_timestamp((m->>'timestamp')::bigint), v_hist)
          on conflict (wamid) do update
            set tipo = excluded.tipo, texto = coalesce(excluded.texto, wa_mensajes.texto), media = excluded.media
            where wa_mensajes.tipo = 'media_placeholder';
          get diagnostics n = row_count;
          entran := entran + n;
          if n > 0 and not v_hist and coalesce(m->>'type', '') <> 'reaction' then
            perform crm_consulta_mensaje(m->>'from', v_numero_id, 'entra', wa_texto(m), to_timestamp((m->>'timestamp')::bigint));
          end if;
        end loop;

        /* Los estados sólo avanzan: un "entregado" que llega tarde no
           pisa un "leído". "failed" pisa siempre. */
        for s in select * from jsonb_array_elements(coalesce(v->'statuses', '[]'::jsonb)) loop
          update wa_mensajes w
             set estado = s->>'status', error = coalesce(s->'errors', w.error)
           where w.wamid = s->>'id'
             and (s->>'status' = 'failed' or w.estado is null
                  or coalesce(array_position(orden, s->>'status'), 0) > coalesce(array_position(orden, w.estado), 0));
          get diagnostics n = row_count;
          estados := estados + n;
          /* El estado de algo que no tenemos es algo que salió por otra app
             (Kommo): se deja la marca de que se contestó. */
          if n = 0 and s->>'recipient_id' is not null
             and not exists (select 1 from wa_mensajes w where w.wamid = s->>'id') then
            insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, estado, error, cuando)
            values (s->>'id', v_numero_id, v_numero, s->>'recipient_id', 'sale', 'otra_app', 'desconocido',
                    s->>'status', s->'errors', coalesce(to_timestamp((s->>'timestamp')::bigint), now()))
            on conflict (wamid) do nothing;
            get diagnostics n = row_count;
            de_otra := de_otra + n;
            if n > 0 then
              perform crm_consulta_mensaje(s->>'recipient_id', v_numero_id, 'sale', null,
                                           coalesce(to_timestamp((s->>'timestamp')::bigint), now()));
            end if;
          end if;
        end loop;
      end if;

      if c->>'field' = 'smb_message_echoes' or (v_hist and v ? 'message_echoes') then
        for m in select * from jsonb_array_elements(coalesce(v->'message_echoes', '[]'::jsonb)) loop
          insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, media, cuando, historial)
          values (m->>'id', v_numero_id, v_numero, m->>'to', 'sale', 'celular', m->>'type', wa_texto(m),
                  case when m->>'type' in ('image', 'video', 'audio', 'document', 'sticker') then m->(m->>'type') end,
                  to_timestamp((m->>'timestamp')::bigint), v_hist)
          on conflict (wamid) do update
            set desde = 'celular', tipo = excluded.tipo, texto = coalesce(excluded.texto, wa_mensajes.texto), media = excluded.media
            where wa_mensajes.desde = 'otra_app' or wa_mensajes.tipo = 'media_placeholder';
          get diagnostics n = row_count;
          ecos := ecos + n;
          if n > 0 and not v_hist and coalesce(m->>'type', '') <> 'reaction' then
            perform crm_consulta_mensaje(m->>'to', v_numero_id, 'sale', wa_texto(m), to_timestamp((m->>'timestamp')::bigint));
          end if;
        end loop;
      end if;

      if v_hist then
        for h in select * from jsonb_array_elements(coalesce(v->'history', '[]'::jsonb)) loop
          for t in select * from jsonb_array_elements(coalesce(h->'threads', '[]'::jsonb)) loop
            for m in select * from jsonb_array_elements(coalesce(t->'messages', '[]'::jsonb)) loop
              if m->>'type' = 'edit' then
                update wa_mensajes w set texto = coalesce(wa_texto(m->'edit'->'message'), w.texto)
                 where w.wamid = m->'edit'->>'original_message_id';
                get diagnostics n = row_count;
                editados := editados + n;
                if n > 0 then continue; end if;
              end if;
              v_propio := coalesce((m->'history_context'->>'from_me')::boolean, false);
              insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, estado, cuando, historial)
              values (m->>'id', v_numero_id, v_numero, t->>'id',
                      case when v_propio then 'sale' else 'entra' end,
                      case when v_propio then 'celular' else 'cliente' end,
                      m->>'type', case when m->>'type' = 'edit' then wa_texto(m->'edit'->'message') else wa_texto(m) end,
                      case when v_propio then lower(m->'history_context'->>'status') end,
                      to_timestamp((m->>'timestamp')::bigint), true)
              on conflict (wamid) do nothing;
              get diagnostics n = row_count;
              viejos := viejos + n;
            end loop;
          end loop;
        end loop;
      end if;

      /* SQL 68: la agenda del celular. Al pedirla llega entera; después,
         cada contacto que agendan, cambian ("add") o borran ("remove"). */
      if c->>'field' = 'smb_app_state_sync' then
        for s in select * from jsonb_array_elements(coalesce(v->'state_sync', '[]'::jsonb)) loop
          if s->>'type' = 'contact' and club_tel10(s->'contact'->>'phone_number') is not null then
            if s->>'action' = 'remove' then
              update wa_agenda a set borrado = true, actualizado = now()
               where a.numero_id = v_numero_id and a.clave = club_tel10(s->'contact'->>'phone_number');
            else
              insert into wa_agenda (numero_id, clave, tel, nombre, primer_nombre, actualizado)
              values (v_numero_id, club_tel10(s->'contact'->>'phone_number'), s->'contact'->>'phone_number',
                      nullif(trim(s->'contact'->>'full_name'), ''), nullif(trim(s->'contact'->>'first_name'), ''),
                      coalesce(to_timestamp((s->'metadata'->>'timestamp')::bigint), now()))
              on conflict (numero_id, clave) do update
                set tel = excluded.tel, nombre = coalesce(excluded.nombre, wa_agenda.nombre),
                    primer_nombre = coalesce(excluded.primer_nombre, wa_agenda.primer_nombre),
                    actualizado = excluded.actualizado, borrado = false;
            end if;
            agenda := agenda + 1;
          end if;
        end loop;
      end if;

      if c->>'field' not in ('messages', 'smb_message_echoes', 'history', 'smb_app_state_sync') then
        otros := otros + 1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('entran', entran, 'ecos', ecos, 'estados', estados, 'de_otra_app', de_otra,
                            'historial', viejos, 'editados', editados, 'agenda', agenda, 'otros', otros);
end;
$$;
revoke execute on function wa_procesar(jsonb) from public, anon, authenticated;

/* La agenda que ya llegó (Meta la mandó el 10/10, a las 11:41). */
do $agenda$
declare
  a record;
begin
  for a in select w.id, w.cuerpo from wa_avisos w
            where exists (select 1 from jsonb_array_elements(coalesce(w.cuerpo->'entry', '[]'::jsonb)) e,
                                        jsonb_array_elements(coalesce(e->'changes', '[]'::jsonb)) ch
                           where ch->>'field' = 'smb_app_state_sync')
            order by w.id loop
    perform wa_procesar(a.cuerpo);
  end loop;
end $agenda$;

create or replace function crm_contactos_base()
returns table (clave text, fuente text, ref bigint, cuando timestamptz, nombre text, tel text, mail text,
               datos jsonb, monto numeric, abierta boolean, etiquetas text[], nivel text, acepta boolean)
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select 'no_compra'::text as fuente, r.id as ref, r.creado as cuando, nullif(trim(r.nombre), '') as nombre,
           club_tel10(r.whatsapp) as tel, nullif(lower(trim(r.mail)), '') as mail,
           jsonb_build_object('local', r.sucursal, 'producto', r.producto, 'talle', r.talle, 'motivo', r.motivo::text,
                              'columna', crm_columna(r.estado, r.contactado), 'monto', r.monto) as datos,
           case when r.compro then r.monto end as monto,
           crm_columna(r.estado, r.contactado) not in ('Cerrado - compró', 'Cerrado - no compró', 'Descartado') as abierta,
           coalesce(r.etiquetas, '{}'::text[]) as etiquetas, null::text as nivel, null::boolean as acepta
      from registros r
    union all
    select 'carrito', k.id, k.creado, nullif(trim(k.nombre), ''), club_tel10(k.telefono), nullif(lower(trim(k.mail)), ''),
           jsonb_build_object('total', k.total, 'producto', k.productos->0->>'nombre',
                              'mas', greatest(jsonb_array_length(k.productos) - 1, 0), 'casi_pago', k.casi_pago,
                              'columna', crm_columna(k.estado, k.contactado), 'monto', k.monto),
           case when k.compro then k.monto end,
           crm_columna(k.estado, k.contactado) not in ('Cerrado - compró', 'Cerrado - no compró', 'Descartado'),
           coalesce(k.etiquetas, '{}'::text[]), null, null
      from crm_carritos k
    union all
    select 'club', c.id, c.creado, nullif(trim(c.nombre), ''), club_tel10(c.telefono), nullif(lower(trim(c.mail)), ''),
           jsonb_build_object('tipo', 'alta', 'local', c.local_alta, 'nivel', v.nivel, 'puntos', v.puntos),
           null, false, '{}'::text[], v.nivel, (c.acepta_promos and c.revocado is null)
      from club_clientes c join v_club_clientes v on v.id = c.id
     where c.baja is null
    union all
    select 'club', m.id, m.creado, nullif(trim(c.nombre), ''), club_tel10(c.telefono), nullif(lower(trim(c.mail)), ''),
           jsonb_build_object('tipo', 'compra', 'local', m.local, 'importe', m.importe, 'puntos', m.puntos),
           m.importe, false, '{}'::text[], null, null
      from club_movimientos m join club_clientes c on c.id = m.cliente
     where m.tipo::text = 'compra' and m.anulado is null and c.baja is null
    union all
    select 'tienda', t.id, coalesce(t.pagado, t.creado), t.nombre, club_tel10(t.telefono), t.mail,
           jsonb_build_object('numero', t.numero, 'total', t.total, 'producto', t.productos->0->>'nombre',
                              'mas', greatest(jsonb_array_length(t.productos) - 1, 0)),
           t.total, false, '{}'::text[], null, t.acepta
      from tienda_pedidos t
     where t.pago = 'paid' and coalesce(t.estado, '') <> 'cancelled'
    union all
    /* SQL 63: los que escribieron por WhatsApp, una fila por conversación.
       El nombre (sólo si no hay otro): el de la agenda del celular de la
       tienda (SQL 68) o, si no, el del perfil de WhatsApp. */
    select 'whatsapp', max(w.id), max(w.cuando),
           coalesce(wa_agenda_nombre(club_tel10(w.tel)),
                    (array_agg(nullif(trim(w.perfil), '') order by w.cuando desc) filter (where nullif(trim(w.perfil), '') is not null))[1]),
           club_tel10(w.tel), null,
           jsonb_build_object('mensajes', count(*),
                              'texto', (array_agg(w.texto order by w.cuando desc, w.id desc))[1],
                              'tipo', (array_agg(w.tipo order by w.cuando desc, w.id desc))[1],
                              'desde', (array_agg(w.desde order by w.cuando desc, w.id desc))[1],
                              'sentido', (array_agg(w.sentido order by w.cuando desc, w.id desc))[1]),
           null, false, '{}'::text[], null, null
      from wa_mensajes w
     group by club_tel10(w.tel)
  ),
  /* El teléfono de cada mail: así el que una vez dejó sólo el mail cae en
     la misma persona que cuando dejó el teléfono. */
  mt as (
    select distinct on (mail) mail, tel from f
     where mail is not null and tel is not null
     order by mail, cuando desc
  )
  select coalesce(f.tel, mt.tel, 'm:' || f.mail) as clave, f.*
    from f left join mt on mt.mail = f.mail
   where coalesce(f.tel, mt.tel, f.mail) is not null
$$;
revoke execute on function crm_contactos_base() from public, anon, authenticated;

create or replace function crm_mensajes(p_pin text, p_buscar text default null, p_limite integer default 200,
                                        p_numero text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q  text := nullif(lower(trim(coalesce(p_buscar, ''))), '');
  qd text := nullif(regexp_replace(coalesce(p_buscar, ''), '[^0-9]', '', 'g'), '');
  v_num text := nullif(trim(coalesce(p_numero, '')), '');
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  with w as (select club_tel10(m.tel) as clave, m.* from wa_mensajes m),
  ult as (
    select distinct on (w.clave) w.clave, w.id, w.tel, w.numero_id, w.sentido, w.desde, w.tipo, w.texto, w.estado, w.cuando, w.historial
      from w order by w.clave, w.cuando desc, w.id desc
  ),
  conv as (
    select w.clave, count(*) as n,
           (array_agg(nullif(trim(w.perfil), '') order by w.cuando desc) filter (where nullif(trim(w.perfil), '') is not null))[1] as perfil,
           max(w.cuando) filter (where w.sentido = 'sale') as ultima_sale,
           max(w.cuando) filter (where w.sentido = 'entra') as ultima_entra
      from w group by w.clave
  ),
  /* Por cuáles de nuestros números habló, el último primero. */
  nums as (
    select x.clave, array_agg(x.numero_id order by x.ult desc) as numeros
      from (select w.clave, w.numero_id, max(w.cuando) as ult from w group by w.clave, w.numero_id) x
     group by x.clave
  ),
  pend as (
    select w.clave, count(*) as pendientes
      from w join conv c on c.clave = w.clave
     where w.sentido = 'entra' and not w.historial and w.cuando > coalesce(c.ultima_sale, '-infinity'::timestamptz)
     group by w.clave
  ),
  nm as (
    select b.clave,
           (array_agg(b.nombre order by b.cuando desc) filter (where b.nombre is not null))[1] as nombre,
           array_agg(distinct b.fuente) as fuentes, max(b.nivel) as nivel
      from crm_contactos_base() b
     where b.fuente <> 'whatsapp' and b.clave in (select conv.clave from conv)
     group by b.clave
  ),
  x as (
    select c.clave, u.tel, coalesce(nm.nombre, wa_agenda_nombre(c.clave), c.perfil) as nombre, c.perfil,
           coalesce(nm.fuentes, '{}'::text[]) as fuentes, nm.nivel, c.n,
           coalesce(p.pendientes, 0) as pendientes, (u.sentido = 'entra' and not u.historial) as sin_contestar,
           u.cuando as ultima, c.ultima_entra, u.numero_id, ns.numeros,
           jsonb_build_object('texto', u.texto, 'tipo', u.tipo, 'sentido', u.sentido, 'desde', u.desde, 'estado', u.estado) as ultimo
      from conv c
      join ult u on u.clave = c.clave
      join nums ns on ns.clave = c.clave
      left join pend p on p.clave = c.clave
      left join nm on nm.clave = c.clave
  ),
  f as (
    select * from x
     where (v_num is null or v_num = any(x.numeros))
       and (q is null
            or lower(coalesce(x.nombre, '')) like '%' || q || '%'
            or lower(coalesce(x.perfil, '')) like '%' || q || '%'
            or (qd is not null and length(qd) >= 3 and x.tel like '%' || qd || '%')
            or exists (select 1 from w where w.clave = x.clave and lower(coalesce(w.texto, '')) like '%' || q || '%'))
  )
  select jsonb_build_object(
           'cuentas', jsonb_build_object('todas', (select count(*) from x),
                                         'sin_contestar', (select count(*) from x where x.sin_contestar)),
           'numeros', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', nu.numero_id, 'nombre', nu.nombre, 'telefono', nu.telefono, 'tablero', nu.tablero,
                      'todas', (select count(*) from x where nu.numero_id = any(x.numeros)),
                      'sin_contestar', (select count(*) from x where x.sin_contestar and x.numero_id = nu.numero_id))
                    order by nu.orden)
               from wa_numeros nu), '[]'::jsonb),
           'ultimo_id', (select max(m.id) from wa_mensajes m),
           'conversaciones', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'clave', y.clave, 'tel', y.tel, 'nombre', y.nombre, 'perfil', y.perfil,
                      'fuentes', to_jsonb(y.fuentes), 'nivel', y.nivel, 'n', y.n, 'pendientes', y.pendientes,
                      'sin_contestar', y.sin_contestar, 'ultima', y.ultima, 'ultima_entra', y.ultima_entra,
                      'numero', y.numero_id, 'numeros', to_jsonb(y.numeros), 'ultimo', y.ultimo)
                    order by y.ultima desc)
               from (select * from f order by f.ultima desc limit greatest(coalesce(p_limite, 200), 1)) y), '[]'::jsonb))
    into salida;
  return salida;
end;
$$;
grant execute on function crm_mensajes(text, text, integer, text) to anon, authenticated;

create or replace function crm_tienda(p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  update crm_consultas c
     set columna = 'Compró', cerrada = x.cuando, movida = now(), sola = true,
         pedido = jsonb_build_object('numero', x.numero, 'total', x.total, 'cuando', x.cuando)
    from (select c2.id, o.numero, o.total, o.cuando
            from crm_consultas c2
            cross join lateral (
              select t.numero, t.total, coalesce(t.pagado, t.creado) as cuando
                from tienda_pedidos t
               where club_tel10(t.telefono) = c2.clave
                 and t.pago = 'paid' and coalesce(t.estado, '') <> 'cancelled'
                 and coalesce(t.pagado, t.creado) between c2.creada - interval '1 hour' and c2.creada + interval '30 days'
               order by coalesce(t.pagado, t.creado)
               limit 1) o
           where c2.columna <> 'Compró' and c2.creada > now() - interval '45 days') x
   where x.id = c.id;

  update crm_consultas c
     set columna = 'No compró', cerrada = coalesce(u.ultima, c.creada), movida = now(), sola = true
    from (select c2.id, (select max(w.cuando) from wa_mensajes w
                          where club_tel10(w.tel) = c2.clave and w.numero_id = c2.numero_id) as ultima
            from crm_consultas c2 where c2.cerrada is null) u
   where u.id = c.id and coalesce(u.ultima, c.creada) < now() - interval '7 days';

  with k as (
    select c.* from crm_consultas c
     where c.cerrada is null or c.cerrada > now() - interval '30 days'
  ),
  w as (
    select k.id as kid, k.creada, m.*
      from k join wa_mensajes m on club_tel10(m.tel) = k.clave and m.numero_id = k.numero_id
  ),
  ult as (
    select distinct on (w.kid) w.kid, w.sentido, w.desde, w.tipo, w.texto, w.estado, w.cuando, w.quien
      from w order by w.kid, w.cuando desc, w.id desc
  ),
  cuenta as (
    select w.kid, count(*) filter (where w.cuando >= w.creada) as n,
           max(w.cuando) filter (where w.sentido = 'sale') as ultima_sale,
           (array_agg(nullif(trim(w.perfil), '') order by w.cuando desc) filter (where nullif(trim(w.perfil), '') is not null))[1] as perfil
      from w group by w.kid
  ),
  espera as (
    select w.kid, min(w.cuando) as desde
      from w join cuenta cu on cu.kid = w.kid
     where w.sentido = 'entra' and not w.historial and w.tipo <> 'reaction'
       and w.cuando > coalesce(cu.ultima_sale, '-infinity'::timestamptz)
     group by w.kid
  ),
  nm as (
    select b.clave,
           (array_agg(b.nombre order by b.cuando desc) filter (where b.nombre is not null))[1] as nombre,
           array_agg(distinct b.fuente) as fuentes, max(b.nivel) as nivel
      from crm_contactos_base() b
     where b.fuente <> 'whatsapp' and b.clave in (select k.clave from k)
     group by b.clave
  )
  select jsonb_build_object(
    'columnas', to_jsonb(array['Nueva consulta', 'En conversación', 'Le pasamos el link', 'Compró', 'No compró']),
    'resumen', (select jsonb_build_object(
                  'consultas', count(*),
                  'compraron', count(*) filter (where c.columna = 'Compró'),
                  'vendido', coalesce(sum((c.pedido->>'total')::numeric) filter (where c.columna = 'Compró'), 0))
                  from crm_consultas c where c.creada > now() - interval '30 days'),
    'tarjetas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', k.id, 'clave', k.clave, 'tel', k.tel, 'columna', k.columna, 'creada', k.creada, 'movida', k.movida,
               'cerrada', k.cerrada, 'sola', k.sola, 'pedido', k.pedido, 'quien', k.quien,
               'nombre', coalesce(nm.nombre, wa_agenda_nombre(k.clave), cu.perfil), 'fuentes', coalesce(to_jsonb(nm.fuentes), '[]'::jsonb), 'nivel', nm.nivel,
               'n', coalesce(cu.n, 0), 'espera', es.desde,
               'ultimo', case when u.kid is null then null else jsonb_build_object(
                           'texto', u.texto, 'tipo', u.tipo, 'sentido', u.sentido, 'desde', u.desde, 'cuando', u.cuando, 'quien', u.quien) end)
             order by k.creada desc)
        from k
        left join ult u on u.kid = k.id
        left join cuenta cu on cu.kid = k.id
        left join espera es on es.kid = k.id
        left join nm on nm.clave = k.clave), '[]'::jsonb))
    into salida;
  return salida;
end;
$$;
grant execute on function crm_tienda(text) to anon, authenticated;

select 'listo: la agenda del celular de la tienda' as "SQL 68";


-- ─────────────────────────── PARTE 69 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · LAS DOS RESPUESTAS "DESDE KOMMO" QUE NO ERAN DE KOMMO
--
-- Correr en el editor SQL de Supabase (después del 68).
--
-- Lo vio Mauricio (10/10/2026): dos conversaciones de la tienda decían
-- "Contestado desde Kommo" a las 10:40, con "No se entregó: Media download
-- error", y en Kommo no había nada. Eran dos fotos viejas que habían mandado
-- clientes: al traer el historial, Meta no las pudo bajar y avisó con un
-- estado "failed". El receptor toma el estado de algo que no tenemos como
-- una respuesta mandada por otra app (Kommo).
--   · Un "failed" de algo que no tenemos ya no deja esa marca.
--   · Si un mensaje del historial llega después de una marca con su id, la
--     reemplaza.
--   · Se pasa el historial de nuevo: las dos vuelven a ser la foto que mandó
--     el cliente, en su fecha.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function wa_procesar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb; c jsonb; v jsonb; m jsonb; s jsonb; h jsonb; t jsonb;
  v_numero_id text; v_numero text; v_hist boolean; v_propio boolean;
  entran integer := 0; ecos integer := 0; estados integer := 0; otros integer := 0; de_otra integer := 0;
  viejos integer := 0; editados integer := 0; agenda integer := 0;
  n integer;
  orden constant text[] := array['sent', 'delivered', 'read'];
begin
  for e in select * from jsonb_array_elements(coalesce(p->'entry', '[]'::jsonb)) loop
    for c in select * from jsonb_array_elements(coalesce(e->'changes', '[]'::jsonb)) loop
      v := c->'value';
      v_numero_id := v->'metadata'->>'phone_number_id';
      v_numero := v->'metadata'->>'display_phone_number';
      v_hist := c->>'field' = 'history';

      if c->>'field' in ('messages', 'history') then
        for m in select * from jsonb_array_elements(coalesce(v->'messages', '[]'::jsonb)) loop
          insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, media, perfil, cuando, historial)
          values (m->>'id', v_numero_id, v_numero, m->>'from', 'entra', 'cliente', m->>'type', wa_texto(m),
                  case when m->>'type' in ('image', 'video', 'audio', 'document', 'sticker') then m->(m->>'type') end,
                  (select x->'profile'->>'name' from jsonb_array_elements(coalesce(v->'contacts', '[]'::jsonb)) x
                    where x->>'wa_id' = m->>'from' limit 1),
                  to_timestamp((m->>'timestamp')::bigint), v_hist)
          on conflict (wamid) do update
            set tipo = excluded.tipo, texto = coalesce(excluded.texto, wa_mensajes.texto), media = excluded.media
            where wa_mensajes.tipo = 'media_placeholder';
          get diagnostics n = row_count;
          entran := entran + n;
          if n > 0 and not v_hist and coalesce(m->>'type', '') <> 'reaction' then
            perform crm_consulta_mensaje(m->>'from', v_numero_id, 'entra', wa_texto(m), to_timestamp((m->>'timestamp')::bigint));
          end if;
        end loop;

        /* Los estados sólo avanzan: un "entregado" que llega tarde no
           pisa un "leído". "failed" pisa siempre. */
        for s in select * from jsonb_array_elements(coalesce(v->'statuses', '[]'::jsonb)) loop
          update wa_mensajes w
             set estado = s->>'status', error = coalesce(s->'errors', w.error)
           where w.wamid = s->>'id'
             and (s->>'status' = 'failed' or w.estado is null
                  or coalesce(array_position(orden, s->>'status'), 0) > coalesce(array_position(orden, w.estado), 0));
          get diagnostics n = row_count;
          estados := estados + n;
          /* El estado de algo que no tenemos es algo que salió por otra app
             (Kommo): se deja la marca de que se contestó. Salvo si es un
             "failed": eso no llegó a nadie (y al traer el historial, Meta
             manda así las fotos viejas que no pudo bajar; SQL 69). */
          if n = 0 and s->>'recipient_id' is not null and coalesce(s->>'status', '') <> 'failed'
             and not exists (select 1 from wa_mensajes w where w.wamid = s->>'id') then
            insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, estado, error, cuando)
            values (s->>'id', v_numero_id, v_numero, s->>'recipient_id', 'sale', 'otra_app', 'desconocido',
                    s->>'status', s->'errors', coalesce(to_timestamp((s->>'timestamp')::bigint), now()))
            on conflict (wamid) do nothing;
            get diagnostics n = row_count;
            de_otra := de_otra + n;
            if n > 0 then
              perform crm_consulta_mensaje(s->>'recipient_id', v_numero_id, 'sale', null,
                                           coalesce(to_timestamp((s->>'timestamp')::bigint), now()));
            end if;
          end if;
        end loop;
      end if;

      if c->>'field' = 'smb_message_echoes' or (v_hist and v ? 'message_echoes') then
        for m in select * from jsonb_array_elements(coalesce(v->'message_echoes', '[]'::jsonb)) loop
          insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, media, cuando, historial)
          values (m->>'id', v_numero_id, v_numero, m->>'to', 'sale', 'celular', m->>'type', wa_texto(m),
                  case when m->>'type' in ('image', 'video', 'audio', 'document', 'sticker') then m->(m->>'type') end,
                  to_timestamp((m->>'timestamp')::bigint), v_hist)
          on conflict (wamid) do update
            set desde = 'celular', tipo = excluded.tipo, texto = coalesce(excluded.texto, wa_mensajes.texto), media = excluded.media
            where wa_mensajes.desde = 'otra_app' or wa_mensajes.tipo = 'media_placeholder';
          get diagnostics n = row_count;
          ecos := ecos + n;
          if n > 0 and not v_hist and coalesce(m->>'type', '') <> 'reaction' then
            perform crm_consulta_mensaje(m->>'to', v_numero_id, 'sale', wa_texto(m), to_timestamp((m->>'timestamp')::bigint));
          end if;
        end loop;
      end if;

      if v_hist then
        for h in select * from jsonb_array_elements(coalesce(v->'history', '[]'::jsonb)) loop
          for t in select * from jsonb_array_elements(coalesce(h->'threads', '[]'::jsonb)) loop
            for m in select * from jsonb_array_elements(coalesce(t->'messages', '[]'::jsonb)) loop
              if m->>'type' = 'edit' then
                update wa_mensajes w set texto = coalesce(wa_texto(m->'edit'->'message'), w.texto)
                 where w.wamid = m->'edit'->>'original_message_id';
                get diagnostics n = row_count;
                editados := editados + n;
                if n > 0 then continue; end if;
              end if;
              v_propio := coalesce((m->'history_context'->>'from_me')::boolean, false);
              insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, estado, cuando, historial)
              values (m->>'id', v_numero_id, v_numero, t->>'id',
                      case when v_propio then 'sale' else 'entra' end,
                      case when v_propio then 'celular' else 'cliente' end,
                      m->>'type', case when m->>'type' = 'edit' then wa_texto(m->'edit'->'message') else wa_texto(m) end,
                      case when v_propio then lower(m->'history_context'->>'status') end,
                      to_timestamp((m->>'timestamp')::bigint), true)
              /* Si antes llegó un estado suyo y quedó como "otra app", el
                 mensaje del historial lo reemplaza (SQL 69). */
              on conflict (wamid) do update
                set tel = excluded.tel, sentido = excluded.sentido, desde = excluded.desde, tipo = excluded.tipo,
                    texto = excluded.texto, estado = excluded.estado, error = null, cuando = excluded.cuando, historial = true
                where wa_mensajes.desde = 'otra_app';
              get diagnostics n = row_count;
              viejos := viejos + n;
            end loop;
          end loop;
        end loop;
      end if;

      /* SQL 68: la agenda del celular. Al pedirla llega entera; después,
         cada contacto que agendan, cambian ("add") o borran ("remove"). */
      if c->>'field' = 'smb_app_state_sync' then
        for s in select * from jsonb_array_elements(coalesce(v->'state_sync', '[]'::jsonb)) loop
          if s->>'type' = 'contact' and club_tel10(s->'contact'->>'phone_number') is not null then
            if s->>'action' = 'remove' then
              update wa_agenda a set borrado = true, actualizado = now()
               where a.numero_id = v_numero_id and a.clave = club_tel10(s->'contact'->>'phone_number');
            else
              insert into wa_agenda (numero_id, clave, tel, nombre, primer_nombre, actualizado)
              values (v_numero_id, club_tel10(s->'contact'->>'phone_number'), s->'contact'->>'phone_number',
                      nullif(trim(s->'contact'->>'full_name'), ''), nullif(trim(s->'contact'->>'first_name'), ''),
                      coalesce(to_timestamp((s->'metadata'->>'timestamp')::bigint), now()))
              on conflict (numero_id, clave) do update
                set tel = excluded.tel, nombre = coalesce(excluded.nombre, wa_agenda.nombre),
                    primer_nombre = coalesce(excluded.primer_nombre, wa_agenda.primer_nombre),
                    actualizado = excluded.actualizado, borrado = false;
            end if;
            agenda := agenda + 1;
          end if;
        end loop;
      end if;

      if c->>'field' not in ('messages', 'smb_message_echoes', 'history', 'smb_app_state_sync') then
        otros := otros + 1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('entran', entran, 'ecos', ecos, 'estados', estados, 'de_otra_app', de_otra,
                            'historial', viejos, 'editados', editados, 'agenda', agenda, 'otros', otros);
end;
$$;
revoke execute on function wa_procesar(jsonb) from public, anon, authenticated;

do $hist$
declare
  a record;
begin
  for a in select w.id, w.cuerpo from wa_avisos w
            where exists (select 1 from jsonb_array_elements(coalesce(w.cuerpo->'entry', '[]'::jsonb)) e,
                                        jsonb_array_elements(coalesce(e->'changes', '[]'::jsonb)) ch
                           where ch->>'field' = 'history')
            order by w.id loop
    perform wa_procesar(a.cuerpo);
  end loop;
end $hist$;

select 'listo: sin las respuestas de Kommo que no eran' as "SQL 69";


-- ─────────────────────────── PARTE 70 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · UNA REACCIÓN SOLA NO ES "SIN CONTESTAR"
--
-- Correr en el editor SQL de Supabase (después del 69).
--
-- Pedido de Mauricio (10/10/2026): un ❤️ del cliente después de nuestra
-- respuesta dejaba la conversación como "sin contestar" y sumaba el
-- numerito de Mensajes. Ahora una conversación espera respuesta si, después
-- de lo último que le mandamos, escribió algo que NO sea sólo una reacción
-- (y que no venga del historial del celular). Si pregunta algo y después
-- reacciona, sigue esperando por la pregunta.
-- ══════════════════════════════════════════════════════════════════════════

/* Mensajes: "sin contestar" y el numerito de cada conversación, con la regla
   nueva. El resto, igual que en el 68. */
create or replace function crm_mensajes(p_pin text, p_buscar text default null, p_limite integer default 200,
                                        p_numero text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q  text := nullif(lower(trim(coalesce(p_buscar, ''))), '');
  qd text := nullif(regexp_replace(coalesce(p_buscar, ''), '[^0-9]', '', 'g'), '');
  v_num text := nullif(trim(coalesce(p_numero, '')), '');
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  with w as (select club_tel10(m.tel) as clave, m.* from wa_mensajes m),
  ult as (
    select distinct on (w.clave) w.clave, w.id, w.tel, w.numero_id, w.sentido, w.desde, w.tipo, w.texto, w.estado, w.cuando, w.historial
      from w order by w.clave, w.cuando desc, w.id desc
  ),
  conv as (
    select w.clave, count(*) as n,
           (array_agg(nullif(trim(w.perfil), '') order by w.cuando desc) filter (where nullif(trim(w.perfil), '') is not null))[1] as perfil,
           max(w.cuando) filter (where w.sentido = 'sale') as ultima_sale,
           max(w.cuando) filter (where w.sentido = 'entra') as ultima_entra
      from w group by w.clave
  ),
  /* Por cuáles de nuestros números habló, el último primero. */
  nums as (
    select x.clave, array_agg(x.numero_id order by x.ult desc) as numeros
      from (select w.clave, w.numero_id, max(w.cuando) as ult from w group by w.clave, w.numero_id) x
     group by x.clave
  ),
  pend as (
    select w.clave, count(*) as pendientes
      from w join conv c on c.clave = w.clave
     where w.sentido = 'entra' and not w.historial and w.tipo <> 'reaction'
       and w.cuando > coalesce(c.ultima_sale, '-infinity'::timestamptz)
     group by w.clave
  ),
  nm as (
    select b.clave,
           (array_agg(b.nombre order by b.cuando desc) filter (where b.nombre is not null))[1] as nombre,
           array_agg(distinct b.fuente) as fuentes, max(b.nivel) as nivel
      from crm_contactos_base() b
     where b.fuente <> 'whatsapp' and b.clave in (select conv.clave from conv)
     group by b.clave
  ),
  x as (
    select c.clave, u.tel, coalesce(nm.nombre, wa_agenda_nombre(c.clave), c.perfil) as nombre, c.perfil,
           coalesce(nm.fuentes, '{}'::text[]) as fuentes, nm.nivel, c.n,
           coalesce(p.pendientes, 0) as pendientes, (coalesce(p.pendientes, 0) > 0) as sin_contestar,
           u.cuando as ultima, c.ultima_entra, u.numero_id, ns.numeros,
           jsonb_build_object('texto', u.texto, 'tipo', u.tipo, 'sentido', u.sentido, 'desde', u.desde, 'estado', u.estado) as ultimo
      from conv c
      join ult u on u.clave = c.clave
      join nums ns on ns.clave = c.clave
      left join pend p on p.clave = c.clave
      left join nm on nm.clave = c.clave
  ),
  f as (
    select * from x
     where (v_num is null or v_num = any(x.numeros))
       and (q is null
            or lower(coalesce(x.nombre, '')) like '%' || q || '%'
            or lower(coalesce(x.perfil, '')) like '%' || q || '%'
            or (qd is not null and length(qd) >= 3 and x.tel like '%' || qd || '%')
            or exists (select 1 from w where w.clave = x.clave and lower(coalesce(w.texto, '')) like '%' || q || '%'))
  )
  select jsonb_build_object(
           'cuentas', jsonb_build_object('todas', (select count(*) from x),
                                         'sin_contestar', (select count(*) from x where x.sin_contestar)),
           'numeros', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', nu.numero_id, 'nombre', nu.nombre, 'telefono', nu.telefono, 'tablero', nu.tablero,
                      'todas', (select count(*) from x where nu.numero_id = any(x.numeros)),
                      'sin_contestar', (select count(*) from x where x.sin_contestar and x.numero_id = nu.numero_id))
                    order by nu.orden)
               from wa_numeros nu), '[]'::jsonb),
           'ultimo_id', (select max(m.id) from wa_mensajes m),
           'conversaciones', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'clave', y.clave, 'tel', y.tel, 'nombre', y.nombre, 'perfil', y.perfil,
                      'fuentes', to_jsonb(y.fuentes), 'nivel', y.nivel, 'n', y.n, 'pendientes', y.pendientes,
                      'sin_contestar', y.sin_contestar, 'ultima', y.ultima, 'ultima_entra', y.ultima_entra,
                      'numero', y.numero_id, 'numeros', to_jsonb(y.numeros), 'ultimo', y.ultimo)
                    order by y.ultima desc)
               from (select * from f order by f.ultima desc limit greatest(coalesce(p_limite, 200), 1)) y), '[]'::jsonb))
    into salida;
  return salida;
end;
$$;
grant execute on function crm_mensajes(text, text, integer, text) to anon, authenticated;

/* Lo mínimo, para preguntar seguido: el último mensaje y cuántas
   conversaciones esperan respuesta (con la regla de arriba), en total, por
   número (el del último mensaje que espera) y en los números con tablero. */
create or replace function crm_mensajes_ultimo(p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  with u as (
    select club_tel10(m.tel) as clave, max(m.cuando) filter (where m.sentido = 'sale') as ultima_sale
      from wa_mensajes m
     group by 1
  ),
  s as (
    select distinct on (club_tel10(m.tel)) club_tel10(m.tel) as clave, m.numero_id
      from wa_mensajes m
      join u on u.clave = club_tel10(m.tel)
     where m.sentido = 'entra' and not m.historial and m.tipo <> 'reaction'
       and m.cuando > coalesce(u.ultima_sale, '-infinity'::timestamptz)
     order by club_tel10(m.tel), m.cuando desc, m.id desc
  )
  select jsonb_build_object(
           'ultimo_id', (select max(m.id) from wa_mensajes m),
           'sin_contestar', (select count(*) from s),
           'por_numero', coalesce((select jsonb_object_agg(z.numero_id, z.n)
                                     from (select s.numero_id, count(*) as n from s group by s.numero_id) z), '{}'::jsonb),
           'tienda', (select count(*) from s join wa_numeros nu on nu.numero_id = s.numero_id and nu.tablero = 'tienda'))
    into salida;
  return salida;
end;
$$;
grant execute on function crm_mensajes_ultimo(text) to anon, authenticated;

select 'listo: una reacción sola no es sin contestar' as "SQL 70";


-- ─────────────────────────── PARTE 71 ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · LA FICHA CON EL NÚMERO COMO LO DA WHATSAPP
--
-- Correr en el editor SQL de Supabase (después del 70).
--
-- Visto el 10/10/2026: la ficha de alguien del exterior (un +44 de
-- Inglaterra) mostraba "+549…" con los últimos 10 números, porque la clave
-- del CRM son esos 10; y "Escribirle por WhatsApp" abría el chat de otro
-- número. Ahora la ficha trae también el número como lo da WhatsApp, con el
-- país adelante, y la pantalla usa ése.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function crm_contacto(p_pin text, p_clave text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  /* Con prefijo: "tel" y "mail" son también columnas de lo que se consulta,
     y PL/pgSQL no sabría a cuál le hablan. */
  v_filas jsonb; v_tel text; v_mail text; v_nombre text; v_acepta boolean; v_etq jsonb;
  socio_id bigint; socio jsonb; historia jsonb;
  v_mensajes jsonb; v_ventana timestamptz; v_numeros jsonb; v_consulta jsonb; v_wa_tel text;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if coalesce(trim(p_clave), '') = '' then return null; end if;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.cuando desc), '[]'::jsonb) into v_filas
    from crm_contactos_base() b where b.clave = p_clave;
  if jsonb_array_length(v_filas) = 0 then return null; end if;

  select max(x.e->>'tel'),
         (array_agg(x.e->>'mail' order by x.i) filter (where x.e->>'mail' is not null))[1],
         (array_agg(x.e->>'nombre' order by (x.e->>'fuente' = 'whatsapp'), x.i) filter (where x.e->>'nombre' is not null))[1],
         bool_or((x.e->>'acepta')::boolean)
    into v_tel, v_mail, v_nombre, v_acepta
    from jsonb_array_elements(v_filas) with ordinality as x(e, i);
  select coalesce(to_jsonb(array_agg(distinct t order by t)), '[]'::jsonb) into v_etq
    from jsonb_array_elements(v_filas) as x(e), jsonb_array_elements_text(x.e->'etiquetas') as t;

  select c.id into socio_id from club_clientes c
   where c.baja is null
     and ((v_tel is not null and club_tel10(c.telefono) = v_tel) or (v_mail is not null and lower(trim(c.mail)) = v_mail))
   order by (v_tel is not null and club_tel10(c.telefono) = v_tel) desc, c.creado
   limit 1;
  if socio_id is not null then
    select jsonb_build_object('nombre', v.nombre, 'nivel', v.nivel, 'puntos', v.puntos, 'compras', v.compras,
                              'gastado', v.gastado, 'ultima_compra', v.ultima_compra, 'desde', v.creado, 'local', v.local_alta)
      into socio from v_club_clientes v where v.id = socio_id;
  end if;

  select coalesce(jsonb_agg(h order by (h->>'cuando')::timestamptz desc), '[]'::jsonb) into historia
    from (
      select jsonb_build_object('fuente', x.e->>'fuente', 'ref', (x.e->>'ref')::bigint, 'cuando', x.e->'cuando',
                                'datos', x.e->'datos') as h
        from jsonb_array_elements(v_filas) as x(e)
       where x.e->>'fuente' <> 'whatsapp'
      union all
      select jsonb_build_object('fuente', 'nota', 'ref', ev.ref, 'cuando', ev.cuando,
                                'datos', jsonb_build_object('de', ev.fuente, 'quien', ev.quien, 'texto', ev.detalle))
        from crm_eventos ev
       where ev.tipo = 'nota'
         and exists (select 1 from jsonb_array_elements(v_filas) as x(e)
                      where x.e->>'fuente' = ev.fuente and (x.e->>'ref')::bigint = ev.ref)
    ) t;

  /* La conversación de WhatsApp (las últimas 200, en orden) y hasta cuándo
     se le puede contestar gratis: 24 h desde que escribió. */
  if v_tel is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'sentido', w.sentido, 'desde', w.desde, 'tipo', w.tipo,
                                                 'texto', w.texto, 'estado', w.estado, 'cuando', w.cuando, 'quien', w.quien,
                                                 'error', w.error, 'numero_id', w.numero_id, 'historial', w.historial)
                              order by w.cuando, w.id), '[]'::jsonb)
      into v_mensajes
      from (select * from wa_mensajes m where club_tel10(m.tel) = v_tel order by m.cuando desc, m.id desc limit 200) w;
    select max(m.cuando) + interval '24 hours' into v_ventana
      from wa_mensajes m where club_tel10(m.tel) = v_tel and m.sentido = 'entra';
    /* SQL 71: el número como lo da WhatsApp (con el país): es el bueno para
       mostrar y para wa.me, también si es del exterior. */
    select m.tel into v_wa_tel
      from wa_mensajes m where club_tel10(m.tel) = v_tel
     order by m.cuando desc, m.id desc
     limit 1;
    select jsonb_build_object('id', c.id, 'columna', c.columna, 'creada', c.creada, 'cerrada', c.cerrada,
                              'sola', c.sola, 'pedido', c.pedido)
      into v_consulta
      from crm_consultas c where c.clave = v_tel
     order by (c.cerrada is null) desc, c.creada desc
     limit 1;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', n.numero_id, 'nombre', n.nombre, 'telefono', n.telefono, 'tablero', n.tablero)
                            order by n.orden), '[]'::jsonb)
    into v_numeros from wa_numeros n;
  return jsonb_build_object(
    'persona', jsonb_build_object('clave', p_clave, 'nombre', v_nombre, 'tel', v_tel, 'mail', v_mail,
                                  'acepta', v_acepta, 'etiquetas', v_etq, 'wa_tel', v_wa_tel),
    'socio', socio, 'historia', historia,
    'mensajes', coalesce(v_mensajes, '[]'::jsonb), 'ventana', v_ventana,
    'numeros', v_numeros, 'consulta', v_consulta);
end;
$$;
grant execute on function crm_contacto(text, text) to anon, authenticated;

select 'listo: la ficha con el número de WhatsApp' as "SQL 71";


-- ─────────────────────────── PARTE 74 (10/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · BORRAR UN REGISTRO DE NO COMPRA (A UNA PAPELERA DE 30 DÍAS)
--
-- Correr en el editor SQL de Supabase (después del 73).
--
-- Pedido de Mauricio (10/10/2026): poder borrar un registro que fue una
-- prueba o quedó duplicado, con el PIN pedido de nuevo en el momento.
--   · registro_borrar: con el PIN y el motivo (Prueba, Duplicado u Otro).
--     El registro sale de todos lados —tablero, contactos, estadísticas,
--     objetivos— y queda 30 días en registros_papelera con lo que colgaba
--     de él: su historial del CRM, su cola de salidas y sus cupones.
--   · registro_restaurar: lo vuelve a poner como estaba, con el mismo
--     número, SIN mandarlo de nuevo a Kommo ni a Telegram.
--   · registros_papelera_ver: lo borrado en los últimos 30 días.
--   · Lo que ya salió no vuelve atrás: el lead de Kommo (la API de Kommo no
--     deja borrarlo: se borra a mano allá) y el aviso de Telegram.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists registros_papelera (
  id         bigint primary key,             -- el número que tenía en registros
  datos      jsonb not null,                 -- la fila entera
  extras     jsonb not null default '{}'::jsonb,
  motivo     text not null check (motivo in ('Prueba', 'Duplicado', 'Otro')),
  nota       text,
  borrado    timestamptz not null default now(),
  restaurado timestamptz
);
alter table registros_papelera enable row level security;
revoke all on registros_papelera from anon, authenticated;

CREATE OR REPLACE FUNCTION public.encolar_salidas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  /* SQL 74: un registro que se RESTAURA de la papelera no es uno nuevo:
     ya salió a Kommo y a Telegram, y su historial vuelve con él. */
  if coalesce(current_setting('vdh.restaurando', true), '') = 'si' then return new; end if;
  /* Un registro de un local que NO está en la tabla `locales` no sale afuera.
     Es o una prueba o un error de carga, y en los dos casos crear un lead en
     el CRM —que no se puede borrar por API— es peor que no crearlo.

     No se calla: queda anotado en el historial. Un local nuevo que alguien
     olvidó dar de alta se descubre ahí, en vez de descubrirse tres semanas
     después al notar que sus clientes nunca entraron a Kommo. */
  if not exists (
    select 1 from locales
     where lower(trim(codigo)) = lower(trim(new.sucursal)) and activo
  ) then
    insert into log (accion, local, detalle, quien)
    values ('Registro sin local conocido', new.sucursal,
            'No se mandó a Kommo ni a Telegram: ese local no está dado de alta.',
            new.vendedor);
    return new;
  end if;

  if secreto('KOMMO_TOKEN') is not null then
    insert into salidas (registro, destino) values (new.id, 'kommo')
    on conflict do nothing;
  end if;

  if secreto('TELEGRAM_TOKEN') is not null and secreto('TELEGRAM_CHAT') is not null then
    insert into salidas (registro, destino) values (new.id, 'telegram')
    on conflict do nothing;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_anotar_registro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare de text; a text;
begin
  /* SQL 74: un registro que se RESTAURA de la papelera no es uno nuevo:
     ya salió a Kommo y a Telegram, y su historial vuelve con él. */
  if coalesce(current_setting('vdh.restaurando', true), '') = 'si' then return new; end if;
  a := crm_columna(new.estado, new.contactado);
  if tg_op = 'INSERT' then
    insert into crm_movimientos (fuente, ref, de, a, quien, cuando)
    values ('no_compra', new.id, null, a, nullif(trim(new.vendedor), ''), new.creado);
    return new;
  end if;
  de := crm_columna(old.estado, old.contactado);
  if de is distinct from a then
    insert into crm_movimientos (fuente, ref, de, a, quien)
    values ('no_compra', new.id, de, a, crm_quien(new.responsable));
  end if;
  return new;
end;
$function$
;

/* Borrar: con el PIN de administrador, pedido de nuevo en el momento (la
   pantalla no usa el guardado). */
create or replace function registro_borrar(p_pin text, p_id bigint, p_motivo text, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r    registros%rowtype;
  mot  text := nullif(trim(coalesce(p_motivo, '')), '');
  nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if mot is null or mot not in ('Prueba', 'Duplicado', 'Otro') then
    return jsonb_build_object('ok', false, 'porque', 'Elegí por qué se borra: prueba, duplicado u otro.');
  end if;
  if mot = 'Otro' and nota is null then
    return jsonb_build_object('ok', false, 'porque', 'Contá en una línea por qué se borra.');
  end if;

  select * into r from registros where id = p_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'porque', 'Ese registro ya no está.');
  end if;

  insert into registros_papelera (id, datos, extras, motivo, nota)
  values (r.id, to_jsonb(r),
          jsonb_build_object(
            'movimientos', coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from crm_movimientos m
                                      where m.fuente = 'no_compra' and m.ref = r.id), '[]'::jsonb),
            'eventos',     coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from crm_eventos e
                                      where e.fuente = 'no_compra' and e.ref = r.id), '[]'::jsonb),
            'salidas',     coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from salidas s
                                      where s.registro = r.id), '[]'::jsonb),
            'beneficios',  coalesce((select jsonb_agg(b.id order by b.id) from beneficios b
                                      where b.registro = r.id), '[]'::jsonb)),
          mot, nota)
  on conflict (id) do update
    set datos = excluded.datos, extras = excluded.extras, motivo = excluded.motivo,
        nota = excluded.nota, borrado = now(), restaurado = null;

  delete from crm_movimientos where fuente = 'no_compra' and ref = r.id;
  delete from crm_eventos where fuente = 'no_compra' and ref = r.id;
  /* Su cola de salidas se va con él (en cascada) y los cupones que lo
     nombraban quedan sueltos: siguen valiendo. */
  delete from registros where id = r.id;

  insert into log (accion, local, detalle, quien)
  values ('Registro borrado', r.sucursal,
          'Registro ' || r.id || ' (' || mot || coalesce(': ' || nota, '') || '). Queda 30 días en la papelera.',
          'PIN de administrador');

  /* La papelera se limpia sola: lo de más de 30 días se va. */
  delete from registros_papelera where borrado < now() - interval '30 days';

  return jsonb_build_object('ok', true, 'id', r.id, 'kommo', r.lead_kommo);
end;
$$;
revoke execute on function registro_borrar(text, bigint, text, text) from public;
grant execute on function registro_borrar(text, bigint, text, text) to anon, authenticated;

/* Restaurar: igual que estaba, con su número, su historial y sus salidas. */
create or replace function registro_restaurar(p_pin text, p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p registros_papelera%rowtype;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  select * into p from registros_papelera
   where id = p_id and restaurado is null and borrado > now() - interval '30 days'
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'porque', 'Ya no está en la papelera.');
  end if;
  if exists (select 1 from registros where id = p_id) then
    return jsonb_build_object('ok', false, 'porque', 'Ese registro ya está en el tablero.');
  end if;

  perform set_config('vdh.restaurando', 'si', true);
  insert into registros overriding system value
  select * from jsonb_populate_record(null::registros, p.datos);
  insert into crm_movimientos
  select * from jsonb_populate_recordset(null::crm_movimientos, p.extras->'movimientos');
  insert into crm_eventos
  select * from jsonb_populate_recordset(null::crm_eventos, p.extras->'eventos');
  insert into salidas overriding system value
  select * from jsonb_populate_recordset(null::salidas, p.extras->'salidas');
  update beneficios set registro = p_id
   where registro is null
     and id in (select x::bigint from jsonb_array_elements_text(coalesce(p.extras->'beneficios', '[]'::jsonb)) x);
  perform set_config('vdh.restaurando', '', true);

  update registros_papelera set restaurado = now() where id = p_id;
  insert into log (accion, local, detalle, quien)
  values ('Registro restaurado', p.datos->>'sucursal', 'Registro ' || p_id || ', desde la papelera.', 'PIN de administrador');
  return jsonb_build_object('ok', true, 'id', p_id);
end;
$$;
revoke execute on function registro_restaurar(text, bigint) from public;
grant execute on function registro_restaurar(text, bigint) to anon, authenticated;

/* Lo borrado en los últimos 30 días, lo último primero. */
create or replace function registros_papelera_ver(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  delete from registros_papelera where borrado < now() - interval '30 days';
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'nombre', p.datos->>'nombre', 'whatsapp', p.datos->>'whatsapp',
             'sucursal', p.datos->>'sucursal', 'vendedor', p.datos->>'vendedor',
             'producto', p.datos->>'producto', 'talle', p.datos->>'talle',
             'creado', p.datos->>'creado', 'kommo', p.datos->>'lead_kommo',
             'motivo', p.motivo, 'nota', p.nota, 'borrado', p.borrado,
             'quedan', greatest(0, 30 - floor(extract(epoch from now() - p.borrado) / 86400))::int)
           order by p.borrado desc)
      from registros_papelera p
     where p.restaurado is null), '[]'::jsonb);
end;
$$;
revoke execute on function registros_papelera_ver(text) from public;
grant execute on function registros_papelera_ver(text) to anon, authenticated;

/* Y una vez por día, aunque nadie abra la papelera. */
select cron.schedule('papelera-registros', '30 7 * * *',
  $c$delete from registros_papelera where borrado < now() - interval '30 days'$c$);

select 'listo: borrar registros, con papelera de 30 días' as "SQL 74";


-- ─────────────────────────── PARTE 75 (11/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · RECORDATORIOS POR PERSONA (PARA LOS QUE ESCRIBEN POR WHATSAPP)
--
-- Correr en el editor SQL de Supabase (después del 74).
--
-- Pedido de Mauricio (11/10/2026): "en Mensajes abro la ficha y le agrego
-- una tarea de escribirle en dos días; que después aparezca en
-- Recordatorio". Hasta hoy el recordatorio vivía sólo en las tarjetas de
-- No Compra y Carritos: alguien que sólo escribió por WhatsApp no tenía
-- dónde colgarlo.
--   · crm_recordatorios: uno por persona (su teléfono), con fecha, nota y
--     quién lo puso. Uno solo: el nuevo pisa al anterior, como en las
--     tarjetas.
--   · crm_recordatorio_poner: con el PIN; fecha vacía lo quita. La fecha
--     se compara con el día de ARGENTINA, no con el de la base (UTC).
--   · La ficha (crm_contacto), la lista de Mensajes (crm_mensajes) y el
--     tablero de la tienda (crm_tienda) lo devuelven.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists crm_recordatorios (
  clave  text primary key check (clave ~ '^[0-9]{10}$'),
  fecha  date not null,
  nota   text,
  quien  text,
  puesto timestamptz not null default now()
);
alter table crm_recordatorios enable row level security;
revoke all on crm_recordatorios from anon, authenticated;

create or replace function crm_recordatorio_poner(p_pin text, p_clave text, p_fecha date default null,
                                                  p_nota text default null, p_quien text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k    text := club_tel10(p_clave);
  hoy  date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if k is null then
    return jsonb_build_object('ok', false, 'porque', 'Ese teléfono no alcanza para un recordatorio.');
  end if;
  if p_fecha is null then
    delete from crm_recordatorios where clave = k;
    return jsonb_build_object('ok', true, 'quitado', true);
  end if;
  if p_fecha < hoy then
    return jsonb_build_object('ok', false, 'porque', 'Esa fecha ya pasó.');
  end if;
  if p_fecha > hoy + 730 then
    return jsonb_build_object('ok', false, 'porque', 'Muy lejos: hasta dos años.');
  end if;
  if length(coalesce(nota, '')) > 120 then
    return jsonb_build_object('ok', false, 'porque', 'La nota es muy larga: hasta 120 letras.');
  end if;
  insert into crm_recordatorios (clave, fecha, nota, quien)
  values (k, p_fecha, nota, nullif(trim(coalesce(p_quien, '')), ''))
  on conflict (clave) do update
    set fecha = excluded.fecha, nota = excluded.nota, quien = excluded.quien, puesto = now();
  return jsonb_build_object('ok', true, 'fecha', p_fecha);
end;
$$;
revoke execute on function crm_recordatorio_poner(text, text, date, text, text) from public;
grant execute on function crm_recordatorio_poner(text, text, date, text, text) to anon, authenticated;

CREATE OR REPLACE FUNCTION public.crm_contacto(p_pin text, p_clave text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  /* Con prefijo: "tel" y "mail" son también columnas de lo que se consulta,
     y PL/pgSQL no sabría a cuál le hablan. */
  v_filas jsonb; v_tel text; v_mail text; v_nombre text; v_acepta boolean; v_etq jsonb;
  socio_id bigint; socio jsonb; historia jsonb;
  v_mensajes jsonb; v_ventana timestamptz; v_numeros jsonb; v_consulta jsonb; v_wa_tel text;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if coalesce(trim(p_clave), '') = '' then return null; end if;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.cuando desc), '[]'::jsonb) into v_filas
    from crm_contactos_base() b where b.clave = p_clave;
  if jsonb_array_length(v_filas) = 0 then return null; end if;

  select max(x.e->>'tel'),
         (array_agg(x.e->>'mail' order by x.i) filter (where x.e->>'mail' is not null))[1],
         (array_agg(x.e->>'nombre' order by (x.e->>'fuente' = 'whatsapp'), x.i) filter (where x.e->>'nombre' is not null))[1],
         bool_or((x.e->>'acepta')::boolean)
    into v_tel, v_mail, v_nombre, v_acepta
    from jsonb_array_elements(v_filas) with ordinality as x(e, i);
  select coalesce(to_jsonb(array_agg(distinct t order by t)), '[]'::jsonb) into v_etq
    from jsonb_array_elements(v_filas) as x(e), jsonb_array_elements_text(x.e->'etiquetas') as t;

  select c.id into socio_id from club_clientes c
   where c.baja is null
     and ((v_tel is not null and club_tel10(c.telefono) = v_tel) or (v_mail is not null and lower(trim(c.mail)) = v_mail))
   order by (v_tel is not null and club_tel10(c.telefono) = v_tel) desc, c.creado
   limit 1;
  if socio_id is not null then
    select jsonb_build_object('nombre', v.nombre, 'nivel', v.nivel, 'puntos', v.puntos, 'compras', v.compras,
                              'gastado', v.gastado, 'ultima_compra', v.ultima_compra, 'desde', v.creado, 'local', v.local_alta)
      into socio from v_club_clientes v where v.id = socio_id;
  end if;

  select coalesce(jsonb_agg(h order by (h->>'cuando')::timestamptz desc), '[]'::jsonb) into historia
    from (
      select jsonb_build_object('fuente', x.e->>'fuente', 'ref', (x.e->>'ref')::bigint, 'cuando', x.e->'cuando',
                                'datos', x.e->'datos') as h
        from jsonb_array_elements(v_filas) as x(e)
       where x.e->>'fuente' <> 'whatsapp'
      union all
      select jsonb_build_object('fuente', 'nota', 'ref', ev.ref, 'cuando', ev.cuando,
                                'datos', jsonb_build_object('de', ev.fuente, 'quien', ev.quien, 'texto', ev.detalle))
        from crm_eventos ev
       where ev.tipo = 'nota'
         and exists (select 1 from jsonb_array_elements(v_filas) as x(e)
                      where x.e->>'fuente' = ev.fuente and (x.e->>'ref')::bigint = ev.ref)
    ) t;

  /* La conversación de WhatsApp (las últimas 200, en orden) y hasta cuándo
     se le puede contestar gratis: 24 h desde que escribió. */
  if v_tel is not null then
    select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'sentido', w.sentido, 'desde', w.desde, 'tipo', w.tipo,
                                                 'texto', w.texto, 'estado', w.estado, 'cuando', w.cuando, 'quien', w.quien,
                                                 'error', w.error, 'numero_id', w.numero_id, 'historial', w.historial)
                              order by w.cuando, w.id), '[]'::jsonb)
      into v_mensajes
      from (select * from wa_mensajes m where club_tel10(m.tel) = v_tel order by m.cuando desc, m.id desc limit 200) w;
    select max(m.cuando) + interval '24 hours' into v_ventana
      from wa_mensajes m where club_tel10(m.tel) = v_tel and m.sentido = 'entra';
    /* SQL 71: el número como lo da WhatsApp (con el país): es el bueno para
       mostrar y para wa.me, también si es del exterior. */
    select m.tel into v_wa_tel
      from wa_mensajes m where club_tel10(m.tel) = v_tel
     order by m.cuando desc, m.id desc
     limit 1;
    select jsonb_build_object('id', c.id, 'columna', c.columna, 'creada', c.creada, 'cerrada', c.cerrada,
                              'sola', c.sola, 'pedido', c.pedido)
      into v_consulta
      from crm_consultas c where c.clave = v_tel
     order by (c.cerrada is null) desc, c.creada desc
     limit 1;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', n.numero_id, 'nombre', n.nombre, 'telefono', n.telefono, 'tablero', n.tablero)
                            order by n.orden), '[]'::jsonb)
    into v_numeros from wa_numeros n;
  return jsonb_build_object(
    'persona', jsonb_build_object('clave', p_clave, 'nombre', v_nombre, 'tel', v_tel, 'mail', v_mail,
                                  'acepta', v_acepta, 'etiquetas', v_etq, 'wa_tel', v_wa_tel),
    'socio', socio, 'historia', historia,
    'mensajes', coalesce(v_mensajes, '[]'::jsonb), 'ventana', v_ventana,
    'numeros', v_numeros, 'consulta', v_consulta,
    /* SQL 75: su recordatorio, para la ficha. */
    'recordatorio', (select jsonb_build_object('fecha', rc.fecha, 'nota', rc.nota, 'quien', rc.quien)
                       from crm_recordatorios rc where rc.clave = p_clave));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_mensajes(p_pin text, p_buscar text DEFAULT NULL::text, p_limite integer DEFAULT 200, p_numero text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  q  text := nullif(lower(trim(coalesce(p_buscar, ''))), '');
  qd text := nullif(regexp_replace(coalesce(p_buscar, ''), '[^0-9]', '', 'g'), '');
  v_num text := nullif(trim(coalesce(p_numero, '')), '');
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  with w as (select club_tel10(m.tel) as clave, m.* from wa_mensajes m),
  ult as (
    select distinct on (w.clave) w.clave, w.id, w.tel, w.numero_id, w.sentido, w.desde, w.tipo, w.texto, w.estado, w.cuando, w.historial
      from w order by w.clave, w.cuando desc, w.id desc
  ),
  conv as (
    select w.clave, count(*) as n,
           (array_agg(nullif(trim(w.perfil), '') order by w.cuando desc) filter (where nullif(trim(w.perfil), '') is not null))[1] as perfil,
           max(w.cuando) filter (where w.sentido = 'sale') as ultima_sale,
           max(w.cuando) filter (where w.sentido = 'entra') as ultima_entra
      from w group by w.clave
  ),
  /* Por cuáles de nuestros números habló, el último primero. */
  nums as (
    select x.clave, array_agg(x.numero_id order by x.ult desc) as numeros
      from (select w.clave, w.numero_id, max(w.cuando) as ult from w group by w.clave, w.numero_id) x
     group by x.clave
  ),
  pend as (
    select w.clave, count(*) as pendientes
      from w join conv c on c.clave = w.clave
     where w.sentido = 'entra' and not w.historial and w.tipo <> 'reaction'
       and w.cuando > coalesce(c.ultima_sale, '-infinity'::timestamptz)
     group by w.clave
  ),
  nm as (
    select b.clave,
           (array_agg(b.nombre order by b.cuando desc) filter (where b.nombre is not null))[1] as nombre,
           array_agg(distinct b.fuente) as fuentes, max(b.nivel) as nivel
      from crm_contactos_base() b
     where b.fuente <> 'whatsapp' and b.clave in (select conv.clave from conv)
     group by b.clave
  ),
  x as (
    select c.clave, u.tel, coalesce(nm.nombre, wa_agenda_nombre(c.clave), c.perfil) as nombre, c.perfil,
           coalesce(nm.fuentes, '{}'::text[]) as fuentes, nm.nivel, c.n,
           coalesce(p.pendientes, 0) as pendientes, (coalesce(p.pendientes, 0) > 0) as sin_contestar,
           u.cuando as ultima, c.ultima_entra, u.numero_id, ns.numeros,
           jsonb_build_object('texto', u.texto, 'tipo', u.tipo, 'sentido', u.sentido, 'desde', u.desde, 'estado', u.estado) as ultimo
      from conv c
      join ult u on u.clave = c.clave
      join nums ns on ns.clave = c.clave
      left join pend p on p.clave = c.clave
      left join nm on nm.clave = c.clave
  ),
  f as (
    select * from x
     where (v_num is null or v_num = any(x.numeros))
       and (q is null
            or lower(coalesce(x.nombre, '')) like '%' || q || '%'
            or lower(coalesce(x.perfil, '')) like '%' || q || '%'
            or (qd is not null and length(qd) >= 3 and x.tel like '%' || qd || '%')
            or exists (select 1 from w where w.clave = x.clave and lower(coalesce(w.texto, '')) like '%' || q || '%'))
  )
  select jsonb_build_object(
           'cuentas', jsonb_build_object('todas', (select count(*) from x),
                                         'sin_contestar', (select count(*) from x where x.sin_contestar)),
           'numeros', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', nu.numero_id, 'nombre', nu.nombre, 'telefono', nu.telefono, 'tablero', nu.tablero,
                      'todas', (select count(*) from x where nu.numero_id = any(x.numeros)),
                      'sin_contestar', (select count(*) from x where x.sin_contestar and x.numero_id = nu.numero_id))
                    order by nu.orden)
               from wa_numeros nu), '[]'::jsonb),
           'ultimo_id', (select max(m.id) from wa_mensajes m),
           'conversaciones', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'clave', y.clave, 'tel', y.tel, 'nombre', y.nombre, 'perfil', y.perfil,
                      'fuentes', to_jsonb(y.fuentes), 'nivel', y.nivel, 'n', y.n, 'pendientes', y.pendientes,
                      'sin_contestar', y.sin_contestar, 'ultima', y.ultima, 'ultima_entra', y.ultima_entra,
                      'numero', y.numero_id, 'numeros', to_jsonb(y.numeros),
                      /* SQL 75: el recordatorio, para marcar y subir la fila. */
                      'recordatorio', (select jsonb_build_object('fecha', rc.fecha, 'nota', rc.nota)
                                         from crm_recordatorios rc where rc.clave = y.clave),
                      'ultimo', y.ultimo)
                    order by y.ultima desc)
               from (select * from f order by f.ultima desc limit greatest(coalesce(p_limite, 200), 1)) y), '[]'::jsonb))
    into salida;
  return salida;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.crm_tienda(p_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  salida jsonb;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  update crm_consultas c
     set columna = 'Compró', cerrada = x.cuando, movida = now(), sola = true,
         pedido = jsonb_build_object('numero', x.numero, 'total', x.total, 'cuando', x.cuando)
    from (select c2.id, o.numero, o.total, o.cuando
            from crm_consultas c2
            cross join lateral (
              select t.numero, t.total, coalesce(t.pagado, t.creado) as cuando
                from tienda_pedidos t
               where club_tel10(t.telefono) = c2.clave
                 and t.pago = 'paid' and coalesce(t.estado, '') <> 'cancelled'
                 and coalesce(t.pagado, t.creado) between c2.creada - interval '1 hour' and c2.creada + interval '30 days'
               order by coalesce(t.pagado, t.creado)
               limit 1) o
           where c2.columna <> 'Compró' and c2.creada > now() - interval '45 days') x
   where x.id = c.id;

  update crm_consultas c
     set columna = 'No compró', cerrada = coalesce(u.ultima, c.creada), movida = now(), sola = true
    from (select c2.id, (select max(w.cuando) from wa_mensajes w
                          where club_tel10(w.tel) = c2.clave and w.numero_id = c2.numero_id) as ultima
            from crm_consultas c2 where c2.cerrada is null) u
   where u.id = c.id and coalesce(u.ultima, c.creada) < now() - interval '7 days';

  with k as (
    select c.* from crm_consultas c
     where c.cerrada is null or c.cerrada > now() - interval '30 days'
  ),
  w as (
    select k.id as kid, k.creada, m.*
      from k join wa_mensajes m on club_tel10(m.tel) = k.clave and m.numero_id = k.numero_id
  ),
  ult as (
    select distinct on (w.kid) w.kid, w.sentido, w.desde, w.tipo, w.texto, w.estado, w.cuando, w.quien
      from w order by w.kid, w.cuando desc, w.id desc
  ),
  cuenta as (
    select w.kid, count(*) filter (where w.cuando >= w.creada) as n,
           max(w.cuando) filter (where w.sentido = 'sale') as ultima_sale,
           (array_agg(nullif(trim(w.perfil), '') order by w.cuando desc) filter (where nullif(trim(w.perfil), '') is not null))[1] as perfil
      from w group by w.kid
  ),
  espera as (
    select w.kid, min(w.cuando) as desde
      from w join cuenta cu on cu.kid = w.kid
     where w.sentido = 'entra' and not w.historial and w.tipo <> 'reaction'
       and w.cuando > coalesce(cu.ultima_sale, '-infinity'::timestamptz)
     group by w.kid
  ),
  nm as (
    select b.clave,
           (array_agg(b.nombre order by b.cuando desc) filter (where b.nombre is not null))[1] as nombre,
           array_agg(distinct b.fuente) as fuentes, max(b.nivel) as nivel
      from crm_contactos_base() b
     where b.fuente <> 'whatsapp' and b.clave in (select k.clave from k)
     group by b.clave
  )
  select jsonb_build_object(
    'columnas', to_jsonb(array['Nueva consulta', 'En conversación', 'Le pasamos el link', 'Compró', 'No compró']),
    'resumen', (select jsonb_build_object(
                  'consultas', count(*),
                  'compraron', count(*) filter (where c.columna = 'Compró'),
                  'vendido', coalesce(sum((c.pedido->>'total')::numeric) filter (where c.columna = 'Compró'), 0))
                  from crm_consultas c where c.creada > now() - interval '30 days'),
    'tarjetas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', k.id, 'clave', k.clave, 'tel', k.tel, 'columna', k.columna, 'creada', k.creada, 'movida', k.movida,
               'cerrada', k.cerrada, 'sola', k.sola, 'pedido', k.pedido, 'quien', k.quien,
               'nombre', coalesce(nm.nombre, wa_agenda_nombre(k.clave), cu.perfil), 'fuentes', coalesce(to_jsonb(nm.fuentes), '[]'::jsonb), 'nivel', nm.nivel,
               'n', coalesce(cu.n, 0), 'espera', es.desde,
               /* SQL 75: el recordatorio de esa persona, para la tira. */
               'recordatorio', (select jsonb_build_object('fecha', rc.fecha, 'nota', rc.nota)
                                  from crm_recordatorios rc where rc.clave = k.clave),
               'ultimo', case when u.kid is null then null else jsonb_build_object(
                           'texto', u.texto, 'tipo', u.tipo, 'sentido', u.sentido, 'desde', u.desde, 'cuando', u.cuando, 'quien', u.quien) end)
             order by k.creada desc)
        from k
        left join ult u on u.kid = k.id
        left join cuenta cu on cu.kid = k.id
        left join espera es on es.kid = k.id
        left join nm on nm.clave = k.clave), '[]'::jsonb))
    into salida;
  return salida;
end;
$function$
;

select 'listo: recordatorios por persona' as "SQL 75";


-- ─────────────────────────── PARTE 76 (11/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · LAS ESTADÍSTICAS DEL CRM, COMO LAS DE KOMMO
--
-- Correr en el editor SQL de Supabase (después del 75).
--
-- Pedido de Mauricio (11/10/2026, con capturas de los Insights de Kommo):
-- las estadísticas segmentadas por categorías (Panel, Embudo, Actividades,
-- Objetivos) y los objetivos mensuales de cada persona de atención.
--   · crm_insights(pin, desde, hasta): lo que las solapas nuevas
--     necesitan: los mensajes de WhatsApp (cuántos entraron y salieron,
--     por número, contra el período anterior, y cuánto tardamos en
--     contestar), los diálogos y los sin contestar, de dónde entra la
--     gente, el embudo por etapa, el día a día, las actividades por
--     persona, las tareas y los objetivos del mes contra lo hecho.
--   · crm_objetivos: la meta del mes de cada uno (contactados, ganados,
--     plata), que se edita en Estadísticas → Objetivos.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists crm_objetivos (
  quien     text not null,
  mes       date not null check (extract(day from mes) = 1),
  contactos integer,
  ganados   integer,
  plata     numeric(12,2),
  puesto    timestamptz not null default now(),
  primary key (quien, mes)
);
alter table crm_objetivos enable row level security;
revoke all on crm_objetivos from anon, authenticated;

/* La meta de una persona para un mes. Todo vacío la borra. */
create or replace function crm_objetivo_guardar(p_pin text, p_quien text, p_mes date,
                                                p_contactos integer default null,
                                                p_ganados integer default null,
                                                p_plata numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q text := nullif(trim(coalesce(p_quien, '')), '');
  m date := date_trunc('month', p_mes)::date;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if q is null or p_mes is null then
    return jsonb_build_object('ok', false, 'porque', 'Falta la persona o el mes.');
  end if;
  if p_contactos is null and p_ganados is null and p_plata is null then
    delete from crm_objetivos where quien = q and mes = m;
    return jsonb_build_object('ok', true, 'quitado', true);
  end if;
  if coalesce(p_contactos, 0) < 0 or coalesce(p_ganados, 0) < 0 or coalesce(p_plata, 0) < 0 then
    return jsonb_build_object('ok', false, 'porque', 'Una meta no puede ser negativa.');
  end if;
  insert into crm_objetivos (quien, mes, contactos, ganados, plata)
  values (q, m, p_contactos, p_ganados, p_plata)
  on conflict (quien, mes) do update
    set contactos = excluded.contactos, ganados = excluded.ganados, plata = excluded.plata, puesto = now();
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function crm_objetivo_guardar(text, text, date, integer, integer, numeric) from public;
grant execute on function crm_objetivo_guardar(text, text, date, integer, integer, numeric) to anon, authenticated;

/* Todo lo de las solapas nuevas, en un viaje. */
create or replace function crm_insights(p_pin text, p_desde timestamptz, p_hasta timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  res jsonb;
  tz constant text := 'America/Argentina/Buenos_Aires';
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_mes date := date_trunc('month', (p_hasta - interval '1 second') at time zone 'America/Argentina/Buenos_Aires')::date;
  d0 timestamptz := p_desde - (p_hasta - p_desde);   -- el período anterior, del mismo largo
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  with
  wa as (select m.* from wa_mensajes m where not m.historial),
  en_rango as (select * from wa where cuando >= p_desde and cuando < p_hasta),
  antes as (select * from wa where cuando >= d0 and cuando < p_desde),
  /* Cuánto tardamos en contestar: cada mensaje del cliente que ARRANCA una
     espera (el anterior de esa persona no era suyo) y nuestra primera
     respuesta después. */
  esperas as (
    select e.cuando as pregunta, r.cuando as respuesta,
           extract(epoch from (r.cuando - e.cuando)) / 3600.0 as horas
      from en_rango e
      left join lateral (
        select m2.cuando from wa m2
         where club_tel10(m2.tel) = club_tel10(e.tel) and m2.sentido = 'sale' and m2.cuando > e.cuando
         order by m2.cuando limit 1
      ) r on true
     where e.sentido = 'entra' and e.tipo is distinct from 'reaction'
       and not exists (
         select 1 from wa m0
          where club_tel10(m0.tel) = club_tel10(e.tel) and m0.cuando < e.cuando and m0.sentido = 'entra'
            and m0.cuando > e.cuando - interval '7 days'
            and not exists (select 1 from wa ms where club_tel10(ms.tel) = club_tel10(e.tel)
                             and ms.cuando > m0.cuando and ms.cuando < e.cuando and ms.sentido = 'sale'))
  ),
  /* Hoy: a quién le debemos una respuesta (lo último, suyo; como en Mensajes). */
  ult as (
    select distinct on (club_tel10(tel)) club_tel10(tel) as clave, sentido
      from wa where tipo is distinct from 'reaction'
     order by club_tel10(tel), cuando desc, id desc
  ),
  fichas as (
    select 'no_compra'::text as fuente, crm_columna(r.estado, r.contactado) as col, r.creado,
           r.monto, null::numeric as total, r.recordar
      from registros r
    union all
    select 'carrito', crm_columna(k.estado, k.contactado), k.creado, k.monto, k.total, k.recordar
      from crm_carritos k
  ),
  mov as (select m.* from crm_movimientos m where m.cuando >= p_desde and m.cuando < p_hasta),
  /* El mes de los objetivos: lo hecho de verdad, persona por persona. */
  mes_rango as (select (v_mes + time '00:00') at time zone tz as de,
                       (date_trunc('month', v_mes + interval '35 days') + time '00:00') at time zone tz as a),
  mes_primeros as (
    select distinct on (m.fuente, m.ref) m.quien, m.cuando
      from crm_movimientos m, mes_rango g
     where m.de = 'Pendiente' and m.a in ('En seguimiento', 'Esperando respuesta', 'Cerrado - compró', 'Cerrado - no compró')
       and coalesce(m.quien, '') not in ('', 'Automático')
     order by m.fuente, m.ref, m.cuando
  ),
  mes_ganados as (
    select distinct on (m.fuente, m.ref) m.fuente, m.ref, m.quien, m.cuando
      from crm_movimientos m
     where m.a = 'Cerrado - compró'
     order by m.fuente, m.ref, m.cuando desc
  )
  select jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta,
    'mensajes', jsonb_build_object(
      'entrantes', (select count(*) from en_rango where sentido = 'entra'),
      'salientes', (select count(*) from en_rango where sentido = 'sale'),
      'antes_entrantes', (select count(*) from antes where sentido = 'entra'),
      'antes_salientes', (select count(*) from antes where sentido = 'sale'),
      'dialogos', (select count(distinct club_tel10(tel)) from en_rango),
      'antes_dialogos', (select count(distinct club_tel10(tel)) from antes),
      'sin_replica', (select count(*) from ult where sentido = 'entra'),
      'replica_prom_h', (select round(avg(horas)::numeric, 1) from esperas where horas is not null),
      'replica_max_h', (select round(max(horas)::numeric, 1) from esperas where horas is not null),
      'sin_responder_aun', (select count(*) from esperas where respuesta is null),
      'por_numero', coalesce((
        select jsonb_agg(jsonb_build_object('id', n.numero_id, 'nombre', n.nombre,
                 'entrantes', (select count(*) from en_rango e where e.numero_id = n.numero_id and e.sentido = 'entra'),
                 'salientes', (select count(*) from en_rango e where e.numero_id = n.numero_id and e.sentido = 'sale'))
               order by n.orden)
          from wa_numeros n), '[]'::jsonb)),
    'fuentes', jsonb_build_object(
      'no_compra', (select count(*) from registros r where r.creado >= p_desde and r.creado < p_hasta),
      'carrito', (select count(*) from crm_carritos k where k.creado >= p_desde and k.creado < p_hasta),
      'tienda', (select count(*) from crm_consultas c where c.creada >= p_desde and c.creada < p_hasta),
      'club', (select count(*) from club_clientes c where c.creado >= p_desde and c.creado < p_hasta and c.baja is null)),
    'embudo', (
      select jsonb_object_agg(f.fuente, f.cols) from (
        select x.fuente, jsonb_agg(jsonb_build_object(
                 'col', c.col,
                 'ahora', (select count(*) from fichas q where q.fuente = x.fuente and q.col = c.col),
                 'plata', (select coalesce(sum(coalesce(q.monto, q.total, 0)), 0) from fichas q where q.fuente = x.fuente and q.col = c.col),
                 'entraron', (select count(distinct m.ref) from mov m where m.fuente = x.fuente and m.a = c.col),
                 'perdidos', (select count(distinct m.ref) from mov m
                               where m.fuente = x.fuente and m.de = c.col and m.a in ('Cerrado - no compró', 'Descartado'))
               ) order by c.orden) as cols
          from (values ('no_compra'), ('carrito')) as x(fuente)
          cross join (values ('Pendiente', 1), ('En seguimiento', 2), ('Esperando respuesta', 3),
                             ('Cerrado - compró', 4), ('Cerrado - no compró', 5), ('Descartado', 6)) as c(col, orden)
         group by x.fuente) f),
    'tienda_embudo', coalesce((
      select jsonb_agg(jsonb_build_object('col', t.columna, 'ahora', t.n) order by
               array_position(array['Nueva consulta', 'En conversación', 'Le pasamos el link', 'Compró', 'No compró'], t.columna))
        from (select c.columna, count(*)::int as n from crm_consultas c group by 1) t), '[]'::jsonb),
    'diario', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'entraron', d.entraron, 'ganados', d.ganados, 'mensajes', d.mensajes) order by d.dia)
        from (
          select g.dia,
                 (select count(*) from fichas f where (f.creado at time zone tz)::date = g.dia
                    and f.creado >= p_desde and f.creado < p_hasta) as entraron,
                 (select count(distinct (m.fuente, m.ref)) from mov m
                   where m.a = 'Cerrado - compró' and (m.cuando at time zone tz)::date = g.dia) as ganados,
                 (select count(*) from en_rango e where e.sentido = 'entra' and (e.cuando at time zone tz)::date = g.dia) as mensajes
            from (select generate_series(((p_desde at time zone tz))::date,
                                         ((p_hasta - interval '1 second') at time zone tz)::date, '1 day')::date as dia) g
        ) d), '[]'::jsonb),
    'actividades', coalesce((
      select jsonb_agg(jsonb_build_object('quien', a.quien, 'movidas', a.movidas, 'whatsapps', a.whatsapps,
                                          'notas', a.notas, 'recordatorios', a.recordatorios, 'ganados', a.ganados)
                       order by a.movidas + a.whatsapps desc, a.quien)
        from (
          select quien, sum(movidas)::int as movidas, sum(whatsapps)::int as whatsapps, sum(notas)::int as notas,
                 sum(recordatorios)::int as recordatorios, sum(ganados)::int as ganados from (
            select m.quien, 1 as movidas, 0 as whatsapps, 0 as notas, 0 as recordatorios,
                   case when m.a = 'Cerrado - compró' then 1 else 0 end as ganados from mov m
            union all
            select e.quien, 0, case when e.tipo = 'whatsapp' then 1 else 0 end,
                   case when e.tipo = 'nota' then 1 else 0 end,
                   case when e.tipo = 'recordatorio' then 1 else 0 end, 0
              from crm_eventos e where e.cuando >= p_desde and e.cuando < p_hasta
            union all
            select w.quien, 0, 1, 0, 0, 0 from en_rango w where w.sentido = 'sale' and w.desde = 'crm'
          ) t where coalesce(quien, '') not in ('', 'Automático')
          group by quien
        ) a), '[]'::jsonb),
    'tareas', jsonb_build_object(
      'hoy', (select count(*) from fichas f where f.recordar = hoy and f.col not in ('Cerrado - compró', 'Cerrado - no compró', 'Descartado'))
           + (select count(*) from crm_recordatorios r where r.fecha = hoy),
      'atrasados', (select count(*) from fichas f where f.recordar < hoy and f.col not in ('Cerrado - compró', 'Cerrado - no compró', 'Descartado'))
                 + (select count(*) from crm_recordatorios r where r.fecha < hoy),
      'agendados', (select count(*) from fichas f where f.recordar > hoy and f.col not in ('Cerrado - compró', 'Cerrado - no compró', 'Descartado'))
                 + (select count(*) from crm_recordatorios r where r.fecha > hoy),
      'sin', (select count(*) from fichas f where f.recordar is null and f.col not in ('Cerrado - compró', 'Cerrado - no compró', 'Descartado'))),
    'objetivos', jsonb_build_object(
      'mes', v_mes,
      'metas', coalesce((
        select jsonb_agg(jsonb_build_object('quien', o.quien, 'contactos', o.contactos, 'ganados', o.ganados, 'plata', o.plata)
                         order by o.quien)
          from crm_objetivos o where o.mes = v_mes), '[]'::jsonb),
      'hecho', coalesce((
        select jsonb_agg(jsonb_build_object('quien', h.quien, 'contactos', h.contactos, 'ganados', h.ganados, 'plata', h.plata)
                         order by h.quien)
          from (
            select quien, sum(contactos)::int as contactos, sum(ganados)::int as ganados, sum(plata) as plata from (
              select p.quien, 1 as contactos, 0 as ganados, 0::numeric as plata
                from mes_primeros p, mes_rango g where p.cuando >= g.de and p.cuando < g.a
              union all
              select w.quien, 1, 0, 0 from wa w, mes_rango g
               where w.sentido = 'sale' and w.desde = 'crm' and w.cuando >= g.de and w.cuando < g.a
                 and coalesce(w.quien, '') <> ''
              union all
              select gm.quien, 0, 1, coalesce(f.monto, 0)
                from mes_ganados gm
                join (select 'no_compra'::text as fuente, r.id as ref, r.monto, crm_columna(r.estado, r.contactado) as col from registros r
                      union all
                      select 'carrito', k.id, k.monto, crm_columna(k.estado, k.contactado) from crm_carritos k) f
                  on f.fuente = gm.fuente and f.ref = gm.ref
                cross join mes_rango g
               where gm.cuando >= g.de and gm.cuando < g.a and f.col = 'Cerrado - compró'
            ) t where coalesce(quien, '') not in ('', 'Automático')
            group by quien
          ) h), '[]'::jsonb))
  ) into res;
  return res;
end;
$$;
revoke execute on function crm_insights(text, timestamptz, timestamptz) from public;
grant execute on function crm_insights(text, timestamptz, timestamptz) to anon, authenticated;

select 'listo: las estadísticas como las de Kommo y los objetivos' as "SQL 76";


-- ─────────────────────────── PARTE 77 (11/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · EL AGENTE DE IA, FASE 1: LOS CIMIENTOS
--
-- Correr en el editor SQL de Supabase (después del 76).
--
-- Pedido de Mauricio (11/10/2026): el agente que atiende y vende por el
-- WhatsApp de la tienda cuando el equipo no está. Esta fase es el terreno:
-- todavía NO contesta nada.
--   · agente_reglas: el interruptor (nace APAGADO), el modo (nace en
--     "prueba": redacta y una persona aprueba), el horario —cada día:
--     todo el día, fuera del horario del equipo o no atiende—, las fechas
--     especiales (feriados), los topes de venta —que se validan acá, en la
--     base, no en lo que se le dice al agente— y a quién deriva: Ale
--     (ventas, posventa y logística) y Lautaro (No Compra y carritos).
--   · agente_textos: la base de conocimiento (envíos, pagos, cambios,
--     talles, telas, stock, promos), con versiones; se edita desde el CRM.
--   · agente_atiende(cuándo): si en ese momento le toca al agente.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists agente_reglas (
  clave  text primary key,
  valor  text,
  puesto timestamptz not null default now()
);
alter table agente_reglas enable row level security;
revoke all on agente_reglas from anon, authenticated;

insert into agente_reglas (clave, valor) values
  ('prendido',           'no'),
  ('modo',               'prueba'),
  ('semana',             '{"lun":{"modo":"fuera","de":"09:00","a":"17:00"},"mar":{"modo":"fuera","de":"09:00","a":"17:00"},"mie":{"modo":"fuera","de":"09:00","a":"17:00"},"jue":{"modo":"fuera","de":"09:00","a":"17:00"},"vie":{"modo":"fuera","de":"09:00","a":"17:00"},"sab":{"modo":"todo","de":"09:00","a":"17:00"},"dom":{"modo":"todo","de":"09:00","a":"17:00"}}'),
  ('fechas',             '[]'),
  ('numero_id',          (select n.numero_id from wa_numeros n where n.tablero = 'tienda' order by n.orden limit 1)),
  ('cupon_pct',          null),
  ('cupon_horas',        null),
  ('cupon_con_sale',     null),
  ('envio_gratis_desde', '80000'),
  ('envio_piso',         null),
  ('segunda_pct',        null),
  ('telegram_min',       null),
  ('derivar_ventas',     'Ale'),
  ('derivar_posventa',   'Ale'),
  ('derivar_logistica',  'Ale'),
  ('derivar_nocompra',   'Lautaro'),
  ('derivar_carritos',   'Lautaro')
on conflict (clave) do nothing;

/* La base de conocimiento, con versiones: la vigente es la última. */
create table if not exists agente_textos (
  id     bigserial primary key,
  texto  text not null,
  creado timestamptz not null default now()
);
alter table agente_textos enable row level security;
revoke all on agente_textos from anon, authenticated;

/* ¿Le toca al agente en ese momento? Con la hora de Argentina. */
create or replace function agente_atiende(p_cuando timestamptz default now())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_loc   timestamp := p_cuando at time zone 'America/Argentina/Buenos_Aires';
  v_dia   text;
  v_hora  time;
  v_fecha text;
  v_esp   jsonb;
  v_d     jsonb;
begin
  v_dia := (array['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'])[extract(isodow from v_loc)::int];
  v_hora := v_loc::time;
  v_fecha := to_char(v_loc, 'YYYY-MM-DD');
  if coalesce((select r.valor from agente_reglas r where r.clave = 'prendido'), 'no') <> 'si' then
    return jsonb_build_object('atiende', false, 'porque', 'apagado');
  end if;
  select e into v_esp
    from jsonb_array_elements(coalesce((select r.valor from agente_reglas r where r.clave = 'fechas'), '[]')::jsonb) e
   where e->>'fecha' = v_fecha
   limit 1;
  if v_esp is not null then
    return jsonb_build_object('atiende', v_esp->>'modo' = 'todo', 'porque', 'fecha', 'nota', v_esp->>'nota');
  end if;
  v_d := coalesce((select r.valor from agente_reglas r where r.clave = 'semana'), '{}')::jsonb -> v_dia;
  if v_d is null or v_d->>'modo' = 'no' then
    return jsonb_build_object('atiende', false, 'porque', 'dia_no');
  end if;
  if v_d->>'modo' = 'todo' then
    return jsonb_build_object('atiende', true, 'porque', 'dia_todo');
  end if;
  if v_hora >= (v_d->>'de')::time and v_hora < (v_d->>'a')::time then
    return jsonb_build_object('atiende', false, 'porque', 'equipo', 'hasta', v_d->>'a');
  end if;
  return jsonb_build_object('atiende', true, 'porque', 'fuera', 'de', v_d->>'de', 'a', v_d->>'a');
end;
$$;
revoke execute on function agente_atiende(timestamptz) from public, anon, authenticated;

/* Cada regla con su forma. Devuelve el valor ya prolijo (el horario con
   los siete días; las fechas ordenadas, sin repetidas y sin las pasadas). */
create or replace function agente_regla_valida(p_clave text, p_valor text)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v   text := trim(coalesce(p_valor, ''));
  j   jsonb;
  x   jsonb;
  k   text;
  nom text;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  hh  constant text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
begin
  if p_clave = 'prendido' or p_clave = 'cupon_con_sale' then
    if v not in ('si', 'no') then
      return jsonb_build_object('ok', false, 'porque', 'Va "si" o "no".');
    end if;
  elsif p_clave = 'modo' then
    /* Por ahora, sólo "prueba": el automático se habilita en la fase 4,
       cuando el agente haya pasado las pruebas (con su propio SQL). */
    if v <> 'prueba' then
      return jsonb_build_object('ok', false, 'porque', 'Por ahora sólo en prueba: el automático llega en la fase 4.');
    end if;
  elsif p_clave = 'semana' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'El horario no se entendió.');
    end;
    if jsonb_typeof(j) is distinct from 'object' then
      return jsonb_build_object('ok', false, 'porque', 'El horario no se entendió.');
    end if;
    foreach k in array array['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] loop
      nom := case k when 'lun' then 'lunes' when 'mar' then 'martes' when 'mie' then 'miércoles' when 'jue' then 'jueves'
                    when 'vie' then 'viernes' when 'sab' then 'sábado' else 'domingo' end;
      x := j->k;
      if x is null or jsonb_typeof(x) <> 'object' or coalesce(x->>'modo', '') not in ('todo', 'fuera', 'no') then
        return jsonb_build_object('ok', false, 'porque', 'Falta qué hace el agente el ' || nom || '.');
      end if;
      if coalesce(x->>'de', '09:00') !~ hh or coalesce(x->>'a', '17:00') !~ hh then
        return jsonb_build_object('ok', false, 'porque', 'El ' || nom || ': la hora va como 09:00.');
      end if;
      if x->>'modo' = 'fuera' and coalesce(x->>'de', '09:00')::time >= coalesce(x->>'a', '17:00')::time then
        return jsonb_build_object('ok', false, 'porque', 'El ' || nom || ': el equipo tiene que entrar antes de salir.');
      end if;
    end loop;
    v := (select jsonb_object_agg(d, jsonb_build_object('modo', j->d->>'modo',
                                                        'de', coalesce(j->d->>'de', '09:00'),
                                                        'a', coalesce(j->d->>'a', '17:00')))
            from unnest(array['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']) as d)::text;
  elsif p_clave = 'fechas' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'Las fechas no se entendieron.');
    end;
    if jsonb_typeof(j) is distinct from 'array' then
      return jsonb_build_object('ok', false, 'porque', 'Las fechas no se entendieron.');
    end if;
    if jsonb_array_length(j) > 100 then
      return jsonb_build_object('ok', false, 'porque', 'Hasta 100 fechas especiales.');
    end if;
    for x in select * from jsonb_array_elements(j) loop
      if coalesce(x->>'fecha', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(x->>'modo', '') not in ('todo', 'no') then
        return jsonb_build_object('ok', false, 'porque', 'Cada fecha va con "todo el día" o "no atiende".');
      end if;
      begin
        perform (x->>'fecha')::date;
      exception when others then
        return jsonb_build_object('ok', false, 'porque', 'La fecha ' || (x->>'fecha') || ' no existe.');
      end;
      if length(coalesce(x->>'nota', '')) > 60 then
        return jsonb_build_object('ok', false, 'porque', 'La nota de una fecha es muy larga: hasta 60 letras.');
      end if;
    end loop;
    v := coalesce((
      select jsonb_agg(jsonb_build_object('fecha', t.f, 'modo', t.m, 'nota', t.n) order by t.fd)
        from (select distinct on ((z.e->>'fecha')::date)
                     (z.e->>'fecha')::date as fd, to_char((z.e->>'fecha')::date, 'YYYY-MM-DD') as f,
                     z.e->>'modo' as m, nullif(trim(coalesce(z.e->>'nota', '')), '') as n
                from jsonb_array_elements(j) with ordinality as z(e, i)
               order by (z.e->>'fecha')::date, z.i desc) t
       where t.fd >= hoy), '[]'::jsonb)::text;
  elsif p_clave in ('cupon_pct', 'segunda_pct') then
    if v !~ '^[0-9]{1,2}$' or v::int < 1 or v::int > 50 then
      return jsonb_build_object('ok', false, 'porque', 'El porcentaje va de 1 a 50.');
    end if;
  elsif p_clave = 'cupon_horas' then
    if v !~ '^[0-9]{1,3}$' or v::int < 1 or v::int > 168 then
      return jsonb_build_object('ok', false, 'porque', 'El cupón vence entre 1 y 168 horas (una semana).');
    end if;
  elsif p_clave = 'telegram_min' then
    if v !~ '^[0-9]{1,3}$' or v::int < 1 or v::int > 240 then
      return jsonb_build_object('ok', false, 'porque', 'La espera de Telegram va de 1 a 240 minutos.');
    end if;
  elsif p_clave in ('envio_gratis_desde', 'envio_piso') then
    if v !~ '^[0-9]{1,9}$' then
      return jsonb_build_object('ok', false, 'porque', 'Va un monto en pesos, sin puntos.');
    end if;
  elsif p_clave in ('derivar_ventas', 'derivar_posventa', 'derivar_logistica', 'derivar_nocompra', 'derivar_carritos') then
    if v = '' or length(v) > 40 then
      return jsonb_build_object('ok', false, 'porque', 'Falta el nombre (hasta 40 letras).');
    end if;
  else
    return jsonb_build_object('ok', false, 'porque', 'Esa regla no existe.');
  end if;
  return jsonb_build_object('ok', true, 'valor', v);
end;
$$;
revoke execute on function agente_regla_valida(text, text) from public, anon, authenticated;

/* Todo lo de la pantalla, en un viaje. */
create or replace function agente_config(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'reglas', coalesce((select jsonb_object_agg(r.clave, r.valor) from agente_reglas r), '{}'::jsonb),
    'numero', (select n.nombre from wa_numeros n
                where n.numero_id = (select r.valor from agente_reglas r where r.clave = 'numero_id')),
    'conocimiento', (select jsonb_build_object('texto', t.texto,
                              'actualizado', to_char(t.creado at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD'))
                       from agente_textos t order by t.creado desc, t.id desc limit 1),
    'versiones', (select count(*) from agente_textos),
    'ahora', agente_atiende(now()));
end;
$$;
revoke execute on function agente_config(text) from public;
grant execute on function agente_config(text) to anon, authenticated;

/* Varias reglas juntas: se validan TODAS antes de guardar ninguna. */
create or replace function agente_reglas_guardar(p_pin text, p_reglas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k      text;
  val    jsonb;
  r      jsonb;
  limpia jsonb := '{}'::jsonb;
  piso   numeric;
  tope   numeric;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if p_reglas is null or jsonb_typeof(p_reglas) <> 'object' or p_reglas = '{}'::jsonb then
    return jsonb_build_object('ok', false, 'porque', 'No hay nada para guardar.');
  end if;
  for k, val in select * from jsonb_each(p_reglas) loop
    r := agente_regla_valida(k, case jsonb_typeof(val) when 'string' then val #>> '{}' else val::text end);
    if not (r->>'ok')::boolean then
      return r || jsonb_build_object('clave', k);
    end if;
    limpia := limpia || jsonb_build_object(k, r->>'valor');
  end loop;
  piso := coalesce(limpia->>'envio_piso', (select x.valor from agente_reglas x where x.clave = 'envio_piso'))::numeric;
  tope := coalesce(limpia->>'envio_gratis_desde', (select x.valor from agente_reglas x where x.clave = 'envio_gratis_desde'))::numeric;
  if piso is not null and tope is not null and piso > tope then
    return jsonb_build_object('ok', false, 'clave', 'envio_piso',
      'porque', 'El piso para regalar el envío no puede ser más alto que el envío gratis de la tienda.');
  end if;
  insert into agente_reglas (clave, valor)
  select e.key, e.value from jsonb_each_text(limpia) e
  on conflict (clave) do update set valor = excluded.valor, puesto = now();
  return jsonb_build_object('ok', true,
    'reglas', (select jsonb_object_agg(x.clave, x.valor) from agente_reglas x),
    'ahora', agente_atiende(now()));
end;
$$;
revoke execute on function agente_reglas_guardar(text, jsonb) from public;
grant execute on function agente_reglas_guardar(text, jsonb) to anon, authenticated;

/* La base de conocimiento: cada guardado es una versión nueva. Se sacan
   los retornos de carro del pegado de Windows antes de comparar. */
create or replace function agente_texto_guardar(p_pin text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t      text := nullif(btrim(replace(coalesce(p_texto, ''), E'\r', ''), E' \n\t'), '');
  ultimo text;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if t is null or length(t) < 200 then
    return jsonb_build_object('ok', false, 'porque', 'El texto quedó vacío o muy corto: no se guardó.');
  end if;
  if length(t) > 60000 then
    return jsonb_build_object('ok', false, 'porque', 'El texto es demasiado largo.');
  end if;
  select x.texto into ultimo from agente_textos x order by x.creado desc, x.id desc limit 1;
  if ultimo is not distinct from t then
    return jsonb_build_object('ok', true, 'igual', true);
  end if;
  insert into agente_textos (texto) values (t);
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function agente_texto_guardar(text, text) from public;
grant execute on function agente_texto_guardar(text, text) to anon, authenticated;

/* Los valores de las herramientas de venta y el texto de lo que sabe el
   agente no van a este repo (es público): los trae el archivo que se corre
   en Supabase y se editan desde el CRM. */

select 'listo: los cimientos del Agente de IA' as "SQL 77";


-- ─────────────────────────── PARTE 78 (12/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · EL AGENTE DE IA, FASE 2: LO QUE CONSULTA Y SUS BORRADORES
--
-- Correr en el editor SQL de Supabase (después del 77).
--
-- El agente redacta respuestas para que el equipo las apruebe en Mensajes.
-- Para eso consulta, siempre en el momento (nunca de memoria):
--   · el catálogo de la tienda con el precio que se paga de verdad (el del
--     SALE, leído cada hora de la página de cada producto);
--   · el stock por talle y color de la tienda, y el de la fábrica;
--   · un pedido, sólo con su número Y el mail de la compra;
--   · lo que sabe (con los 14 locales, la lista oficial).
-- Todo eso lo usa sólo la Edge Function "agente" (con la llave de
-- servicio). El CRM ve y resuelve los borradores con el PIN.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists agente_borradores (
  id         bigserial primary key,
  clave      text not null,
  numero_id  text,
  ultimo_id  bigint,
  texto      text not null,
  derivar    jsonb,
  productos  jsonb not null default '[]'::jsonb,
  herramientas jsonb not null default '[]'::jsonb,
  origen     text not null default 'pedido' check (origen in ('pedido', 'auto')),
  pedido_por text,
  modelo     text,
  tokens     jsonb,
  ms         integer,
  estado     text not null default 'pendiente'
             check (estado in ('pendiente', 'enviado', 'editado', 'descartado', 'viejo')),
  final      text,
  quien      text,
  creado     timestamptz not null default now(),
  resuelto   timestamptz
);
create index if not exists agente_borradores_clave on agente_borradores (clave, creado desc);
alter table agente_borradores enable row level security;
revoke all on agente_borradores from anon, authenticated;

/* La llave de las pruebas: sólo su huella. */
create table if not exists agente_llave (
  id     smallint primary key default 1 check (id = 1),
  huella text
);
insert into agente_llave (id) values (1) on conflict (id) do nothing;
alter table agente_llave enable row level security;
revoke all on agente_llave from anon, authenticated;

create or replace function agente_llave_ok(p_llave text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select l.huella is not null and length(coalesce(p_llave, '')) >= 32
                          and l.huella = encode(extensions.digest(p_llave, 'sha256'), 'hex')
                     from agente_llave l where l.id = 1), false)
$$;
revoke execute on function agente_llave_ok(text) from public, anon, authenticated;

/* El catálogo en renglones, para que el agente lo tenga entero a la vista:
   id · nombre · tipo · precio (y el de antes) · talles y colores con stock. */
create or replace function agente_catalogo()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(string_agg(
    p.id || ' · ' || p.nombre || ' · ' || coalesce(p.tipo, 'Otros') || ' · $' ||
      replace(to_char(round(coalesce(p.oferta, p.precio)::numeric), 'FM999,999,999'), ',', '.') ||
      case when p.oferta is not null and p.precio::numeric > p.oferta::numeric
           then ' (antes $' || replace(to_char(round(p.precio::numeric), 'FM999,999,999'), ',', '.') || ', ' ||
                round(100 - p.oferta::numeric * 100 / p.precio::numeric) || '% OFF)' else '' end ||
      ' · talles: ' || coalesce((select string_agg(t->>'n', ' ') from jsonb_array_elements(p.talles) t
                                   where coalesce((t->>'hay')::boolean, true)), '-') ||
      coalesce(' · colores: ' || nullif((select string_agg(c->>'n', ', ') from jsonb_array_elements(p.colores) c
                                          where coalesce((c->>'hay')::boolean, true)), ''), ''),
    E'\n' order by coalesce(p.tipo, 'zz'), p.nombre), '(el catálogo no se pudo leer)')
  from club_tienda_productos p
$$;
revoke execute on function agente_catalogo() from public, anon, authenticated;

/* Un producto en detalle: el precio, la foto, el link, cada talle y color
   con su stock en la tienda, y lo que hay en la fábrica de ese modelo. */
create or replace function agente_producto(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'nombre', p.nombre, 'tipo', p.tipo,
    'precio', round(coalesce(p.oferta, p.precio)::numeric, 2),
    'precio_lista', round(p.precio::numeric, 2),
    'off', case when p.oferta is not null and p.precio::numeric > p.oferta::numeric
                then round(100 - p.oferta::numeric * 100 / p.precio::numeric) end,
    'con_transferencia', round(coalesce(p.oferta, p.precio)::numeric * 0.9, 2),
    'link', p.url, 'foto', p.foto,
    'tienda', coalesce((select jsonb_agg(jsonb_build_object('talle', t.talle, 'color', t.color, 'quedan', t.stock)
                                         order by t.color, t.talle)
                          from stock_tienda t where t.url = p.url and coalesce(t.stock, 1) > 0), '[]'::jsonb),
    'fabrica', coalesce((select jsonb_agg(jsonb_build_object('talle', f.talle, 'color', coalesce(f.color_nombre, f.color),
                                                             'cantidad', f.cantidad) order by f.color_nombre, f.talle)
                           from stock_fabrica f
                          where f.codigo in (select t.codigo from stock_tienda t where t.url = p.url and coalesce(t.codigo, '') <> '')),
                        '[]'::jsonb))
  from club_tienda_productos p
  where p.id::text = trim(coalesce(p_id, ''))
$$;
revoke execute on function agente_producto(text) from public, anon, authenticated;

/* Lo que hay en la fábrica con ese nombre (para lo que no está en la tienda). */
create or replace function agente_fabrica(p_texto text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x->>'modelo'), '[]'::jsonb) from (
    select jsonb_build_object('modelo', f.descripcion, 'rubro', f.rubro,
             'talles', jsonb_agg(jsonb_build_object('talle', f.talle, 'color', coalesce(f.color_nombre, f.color),
                                                    'cantidad', f.cantidad) order by f.color_nombre, f.talle)) as x
      from stock_fabrica f
     where length(stock_norma(p_texto)) >= 3
       and (stock_nombre_coincide(f.descripcion, p_texto) or stock_nombre_coincide(f.descripcion || ' ' || coalesce(f.rubro, ''), p_texto))
     group by f.codigo, f.descripcion, f.rubro
     limit 10) y
$$;
revoke execute on function agente_fabrica(text) from public, anon, authenticated;

/* Un pedido de la tienda: sólo si el número Y el mail coinciden. Si no,
   no dice si el número existe. */
create or replace function agente_pedido(p_numero text, p_mail text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object('encontrado', true, 'numero', t.numero,
             'estado', case t.estado when 'open' then 'abierto' when 'closed' then 'cerrado (entregado o archivado)'
                                     when 'cancelled' then 'cancelado' else t.estado end,
             'pago', case t.pago when 'paid' then 'pagado' when 'pending' then 'pendiente de pago'
                                 when 'refunded' then 'devuelto' when 'voided' then 'anulado' else t.pago end,
             'creado', to_char(t.creado at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY'),
             'total', t.total,
             'productos', (select jsonb_agg(jsonb_build_object('nombre', e->>'nombre', 'cantidad', e->'cantidad'))
                             from jsonb_array_elements(coalesce(t.productos, '[]'::jsonb)) e))
      from tienda_pedidos t
     where t.numero::text = regexp_replace(coalesce(p_numero, ''), '[^0-9]', '', 'g')
       and lower(trim(coalesce(t.mail, ''))) = lower(trim(coalesce(p_mail, '')))
       and coalesce(trim(p_mail), '') <> ''
     limit 1), jsonb_build_object('encontrado', false))
$$;
revoke execute on function agente_pedido(text, text) from public, anon, authenticated;

/* Todo lo que el agente necesita para contestarle a una persona. */
create or replace function agente_contexto(p_clave text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'clave', k.clave,
    'reglas', coalesce((select jsonb_object_agg(r.clave, r.valor) from agente_reglas r), '{}'::jsonb),
    'conocimiento', (select t.texto from agente_textos t order by t.creado desc, t.id desc limit 1),
    'catalogo', agente_catalogo(),
    'ahora', agente_atiende(now()),
    'hoy', (array['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'])[extract(dow from now() at time zone 'America/Argentina/Buenos_Aires')::int + 1] || ' ' ||
            to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'),
    'nombre', coalesce(wa_agenda_nombre(k.clave),
                       (select nullif(trim(m.perfil), '') from wa_mensajes m
                         where club_tel10(m.tel) = k.clave and nullif(trim(m.perfil), '') is not null
                         order by m.cuando desc limit 1)),
    'ultimo_id', (select max(m.id) from wa_mensajes m where club_tel10(m.tel) = k.clave),
    'ultimo_entra_id', (select max(m.id) from wa_mensajes m where club_tel10(m.tel) = k.clave and m.sentido = 'entra'),
    'numero_id', (select m.numero_id from wa_mensajes m where club_tel10(m.tel) = k.clave order by m.cuando desc, m.id desc limit 1),
    'mensajes', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'de', case when w.sentido = 'entra' then 'cliente' else 'vdh' end,
                                          'tipo', w.tipo, 'texto', w.texto,
                                          'cuando', to_char(w.cuando at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI'))
                       order by w.cuando, w.id)
        from (select * from wa_mensajes m where club_tel10(m.tel) = k.clave and m.tipo is distinct from 'reaction'
               order by m.cuando desc, m.id desc limit 30) w), '[]'::jsonb))
  from (select club_tel10(p_clave) as clave) k
  where k.clave is not null
$$;
revoke execute on function agente_contexto(text) from public, anon, authenticated;

/* Guarda un borrador; los pendientes anteriores de esa persona quedan viejos. */
create or replace function agente_borrador_guardar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k text := club_tel10(p->>'clave');
  nuevo bigint;
begin
  if k is null or nullif(trim(coalesce(p->>'texto', '')), '') is null then
    return jsonb_build_object('ok', false, 'porque', 'Falta la persona o el texto.');
  end if;
  update agente_borradores set estado = 'viejo', resuelto = now() where clave = k and estado = 'pendiente';
  insert into agente_borradores (clave, numero_id, ultimo_id, texto, derivar, productos, herramientas, origen,
                                 pedido_por, modelo, tokens, ms)
  values (k, p->>'numero_id', nullif(p->>'ultimo_id', '')::bigint, left(p->>'texto', 4000), p->'derivar',
          coalesce(p->'productos', '[]'::jsonb), coalesce(p->'herramientas', '[]'::jsonb),
          coalesce(nullif(p->>'origen', ''), 'pedido'), left(p->>'pedido_por', 60), p->>'modelo', p->'tokens',
          nullif(p->>'ms', '')::integer)
  returning id into nuevo;
  return jsonb_build_object('ok', true, 'id', nuevo);
end;
$$;
revoke execute on function agente_borrador_guardar(jsonb) from public, anon, authenticated;

/* El CRM: el borrador pendiente de una persona (o nada). */
create or replace function agente_borrador_ver(p_pin text, p_clave text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return (select jsonb_build_object('id', b.id, 'texto', b.texto, 'derivar', b.derivar, 'productos', b.productos,
                                    'origen', b.origen, 'pedido_por', b.pedido_por, 'creado', b.creado,
                                    'viejo', b.ultimo_id is distinct from
                                             (select max(m.id) from wa_mensajes m where club_tel10(m.tel) = b.clave))
            from agente_borradores b
           where b.clave = club_tel10(p_clave) and b.estado = 'pendiente'
           order by b.creado desc limit 1);
end;
$$;
revoke execute on function agente_borrador_ver(text, text) from public;
grant execute on function agente_borrador_ver(text, text) to anon, authenticated;

/* El CRM: quiénes tienen un borrador esperando (para marcarlos en la lista). */
create or replace function agente_borradores_claves(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return coalesce((select jsonb_agg(distinct b.clave) from agente_borradores b where b.estado = 'pendiente'), '[]'::jsonb);
end;
$$;
revoke execute on function agente_borradores_claves(text) from public;
grant execute on function agente_borradores_claves(text) to anon, authenticated;

/* El CRM: se mandó tal cual, se mandó editado o se descartó. */
create or replace function agente_borrador_resolver(p_pin text, p_id bigint, p_estado text, p_final text default null,
                                                    p_quien text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if p_estado not in ('enviado', 'editado', 'descartado') then
    return jsonb_build_object('ok', false, 'porque', 'Estado desconocido.');
  end if;
  update agente_borradores
     set estado = p_estado, final = left(nullif(trim(coalesce(p_final, '')), ''), 4000),
         quien = left(nullif(trim(coalesce(p_quien, '')), ''), 60), resuelto = now()
   where id = p_id and estado = 'pendiente';
  return jsonb_build_object('ok', found);
end;
$$;
revoke execute on function agente_borrador_resolver(text, bigint, text, text, text) from public;
grant execute on function agente_borrador_resolver(text, bigint, text, text, text) to anon, authenticated;

/* Lo que sabe: los 14 locales, la lista oficial (una sola vez). */
insert into agente_textos (texto)
select (select t.texto from agente_textos t order by t.creado desc, t.id desc limit 1) ||
       E'\n\n## Locales (la lista oficial: no usar la de la web)\n' ||
       replace($loc$- Caseros: 3 de Febrero 2823 (Caseros). Lunes a sábados de 9 a 20:30.
- DOT: Vedia 3600, local 056 (Shopping DOT · CABA). Todos los días de 10 a 22.
- Flores: Av. Rivadavia 6757 (CABA). Lunes a sábados de 9 a 20:30.
- Grand Bourg: Av. Eva Perón 1434 (Grand Bourg). Lunes a sábados de 9 a 20:30.
- Ituzaingó: Coronel Pablo Zufriategui 940 (Ituzaingó). Lunes a sábados de 9 a 20:30.
- Lomas de Zamora: Laprida 380 (Lomas de Zamora). Lunes a sábados de 9 a 20:30.
- Mar del Plata: Rivadavia 2579 (Mar del Plata). Lunes a sábados de 9 a 21 · domingos de 10 a 21.
- Morón: Av. Rivadavia 18290 (Morón). Lunes a sábados de 9 a 20:30.
- Pacheco: Av. Hipólito Yrigoyen 871 (General Pacheco). Lunes a sábados de 9 a 20:30.
- Parque Brown: Av. F. Fernández de la Cruz 4602, local 1038 (Shopping Parque Brown · CABA). Todos los días de 10 a 22.
- San Justo: Av. Dr. Ignacio Arieta 3163 (San Justo). Lunes a sábados de 9 a 20:30.
- San Justo Shopping: Av. Brig. J. M. de Rosas 3910, local 11 (San Justo). Todos los días de 10 a 22.
- Unicenter: Paraná 3745, local 2152 (Unicenter · Martínez). Todos los días de 10 a 22.
- Villa del Parque: Cuenca 2889 (CABA). Lunes a sábados de 9 a 20:30.$loc$, E'\r', '')
 where exists (select 1 from agente_textos)
   and not exists (select 1 from agente_textos t where t.texto like '%## Locales%');

select 'listo: lo que consulta el agente y sus borradores' as "SQL 78";


-- ─────────────────────────── PARTE 79 (12/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · EL AGENTE DE IA: LOS PERMISOS DE LA FUNCIÓN (correr después del 78)
--
-- La Edge Function "agente" entra a la base como service_role, y las
-- funciones nuevas no se lo dan solas (la misma trampa que tuvo WhatsApp con
-- wa_recibir). Sin esto, el agente no puede leer nada.
-- ══════════════════════════════════════════════════════════════════════════

grant execute on function pin_ok(text) to service_role;
grant execute on function agente_llave_ok(text) to service_role;
grant execute on function agente_contexto(text) to service_role;
grant execute on function agente_producto(text) to service_role;
grant execute on function agente_fabrica(text) to service_role;
grant execute on function agente_pedido(text, text) to service_role;
grant execute on function agente_borrador_guardar(jsonb) to service_role;

select 'listo: la función del agente ya puede consultar' as "SQL 79";


-- ─────────────────────────── PARTE 80 (12/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · REINICIAR LA GIFT CARD Nº 1 (LA DE PRUEBA)
--
-- Correr en el editor SQL de Supabase (después del 79).
--
-- Pedido de Mauricio (12/10/2026): la gift card Nº 1 fue una prueba; que
-- vuelva a su estado original. Una tarjeta impresa "original" está SIN
-- VENDER: no tiene registro de venta ni de canje. La Nº 1 tenía uno solo
-- (vendida y canjeada el 12/10 a las 12:20, $50.000, Mar del Plata).
--   · Antes de tocar nada, respalda TODAS las gift cards (ventas, usos y las
--     150 tarjetas) en la tabla "respaldos" (cerrada, como todas).
--   · Después borra sólo lo de la Nº 1. Si la Nº 1 figura más de una vez, no
--     toca nada y avisa. Si ya estaba sin vender, no hace nada.
--   · Ninguna otra gift card se toca.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists respaldos (
  id     bigserial primary key,
  que    text not null,
  cuando timestamptz not null default now(),
  datos  jsonb not null
);
alter table respaldos enable row level security;
revoke all on respaldos from anon, authenticated;

do $reiniciar$
declare
  cod text;
  n   integer;
begin
  select t.codigo into cod from giftcard_tarjetas t where t.nro = 1;
  if cod is null then
    raise exception 'No está la tarjeta Nº 1: no se toca nada.';
  end if;
  select count(*) into n from beneficios b where b.tipo = 'giftcard' and b.serie = cod;
  if n = 0 then
    raise notice 'La gift card Nº 1 ya estaba sin vender: no hay nada que reiniciar.';
    return;
  end if;
  if n > 1 then
    raise exception 'La gift card Nº 1 figura % veces: no se toca nada.', n;
  end if;

  insert into respaldos (que, datos)
  values ('Gift cards, antes de reiniciar la Nº 1 (12/10/2026)', jsonb_build_object(
    'beneficios', (select jsonb_agg(to_jsonb(b) order by b.id) from beneficios b where b.tipo = 'giftcard'),
    'usos', (select coalesce(jsonb_agg(to_jsonb(u) order by u.id), '[]'::jsonb)
               from beneficio_usos u join beneficios b on b.id = u.beneficio where b.tipo = 'giftcard'),
    'tarjetas', (select jsonb_agg(to_jsonb(t) order by t.nro) from giftcard_tarjetas t)));

  delete from beneficio_usos u using beneficios b
   where u.beneficio = b.id and b.tipo = 'giftcard' and b.serie = cod;
  delete from beneficios b where b.tipo = 'giftcard' and b.serie = cod;
end
$reiniciar$;

select case when exists (select 1 from beneficios b join giftcard_tarjetas t on t.codigo = b.serie and t.nro = 1)
            then 'la Nº 1 sigue vendida: revisar' else 'listo: la gift card Nº 1 quedó sin vender, como nueva' end as "SQL 80";


-- ─────────────────────────── PARTE 81 (12/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · LOS TELÉFONOS DE CUPONES Y GIFT CARDS, CON UNA SOLA REGLA
--       Y EL DESCUENTO PERSONAL DESDE CONTACTOS
--
-- Correr en el editor SQL de Supabase (después del 80).
--
-- Es lo que pide la base para la reorganización del menú (Cobrar, CRM →
-- Cupones y Gift Cards), aprobada por Mauricio el 12/10/2026:
--   · tel_cliente(x): la regla de los socios del Club (sin 54, 9, 0 ni 15; los
--     últimos 10). Los cupones y gift cards se GUARDAN así y se BUSCAN y
--     CANJEAN así: "1123456789" encuentra el cupón de "+54 9 11 2345-6789" y
--     lo puede usar, y "un solo descuento vivo por persona" sigue valiendo.
--   · dar_descuento_tel: el "Dar un cupón" desde Contactos. Personal, por
--     teléfono y sin código (no se regala), como el del No Compra.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function tel_cliente(p text)
returns text
language sql
immutable
as $$ select club_tel10(club_tel(p)) $$;

/* Lo que ya estaba guardado, con la misma regla (si quedan dos descuentos
   vivos para el mismo número, no se toca ninguno de los dos). */
update beneficios b set telefono = tel_cliente(b.telefono)
 where b.telefono is not null and tel_cliente(b.telefono) is not null and b.telefono <> tel_cliente(b.telefono)
   and not (b.tipo = 'descuento' and b.usado is null and b.anulado is null
            and exists (select 1 from beneficios o
                         where o.id <> b.id and o.tipo = 'descuento' and o.usado is null and o.anulado is null
                           and tel_cliente(o.telefono) = tel_cliente(b.telefono)));

CREATE OR REPLACE FUNCTION public.beneficio_buscar(clave text)
 RETURNS TABLE(id bigint, tipo text, estado text, nombre text, pct smallint, valor numeric, saldo numeric, serie text, codigo text, vence date, dias integer, buscaba text, local text, vendedor text, obs text, compra_minima numeric, locales text[], acumulable boolean, al_portador boolean, multiuso boolean, usos integer, usos_max integer, por_cliente integer, desde date, tope numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with pelado as (
    select regexp_replace(coalesce(clave, ''), '[^0-9]', '', 'g') as digitos,
           upper(regexp_replace(coalesce(clave, ''), '[^A-Za-z0-9]', '', 'g')) as alfanum
  )
  select b.id, b.tipo::text, b.estado,
         /* El nombre, sólo para el que está adentro: ver el 14. */
         case when soy_de_adentro() then b.nombre else null end as nombre,
         b.pct, b.valor,
         case when b.usado is null then b.valor else 0 end as saldo,
         b.serie, b.codigo, b.vence, b.dias::integer, r.producto, b.local, b.vendedor, b.obs,
         b.compra_minima, b.locales, b.acumulable, (b.codigo is not null) as al_portador,
         b.multiuso, b.usos, b.usos_max, b.por_cliente, b.desde, b.tope
    from v_beneficios b
    left join registros r on r.id = b.registro
    cross join pelado p
   where (length(p.digitos) between 8 and 13
          /* SQL 81: el teléfono con la regla del Club (sin 54, 9, 0 ni 15). */
          and tel_cliente(b.telefono) = tel_cliente(clave))
      /* Por código. El de una persona es largo y al azar, y se pide entero
         (8 o más): es la credencial. El de campaña es corto y público a
         propósito —se publica en Instagram—, así que alcanza con 4. */
      or (b.codigo is not null
          and length(p.alfanum) >= case when b.multiuso then 4 else 8 end
          and upper(regexp_replace(b.codigo, '[^A-Za-z0-9]', '', 'g')) = p.alfanum)
      or (b.tipo = 'giftcard' and length(p.digitos) between 1 and 7
          and ltrim(regexp_replace(coalesce(b.serie, ''), '[^0-9]', '', 'g'), '0') = ltrim(p.digitos, '0'))
      /* SQL 72: la gift card impresa, por los 14 números que lee la pistola. */
      or (b.tipo = 'giftcard' and p.digitos ~ '^99[0-9]{12}$' and b.serie = p.digitos)
   order by (b.estado = 'disponible') desc, b.creado desc
   limit 5;
$function$
;

CREATE OR REPLACE FUNCTION public.canjear_beneficio(p_id bigint, p_clave text, p_local text, p_vendedor text, p_monto numeric DEFAULT NULL::numeric, p_producto text DEFAULT NULL::text, p_telefono text DEFAULT NULL::text, p_nombre text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b        v_beneficios%rowtype;
  tocadas  integer;
  dig      text;
  alfa     text;
  coincide boolean;
  tel      text;
  ya       integer;
  ult      record;
  total    integer;
  hoy      date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  select * into b from v_beneficios where id = p_id;
  if not found then return jsonb_build_object('canjeado', false, 'porque', 'ese beneficio no existe'); end if;

  /* Hay que traer la misma llave con la que se lo encontró: ver el 14. */
  dig  := regexp_replace(coalesce(p_clave, ''), '[^0-9]', '', 'g');
  alfa := upper(regexp_replace(coalesce(p_clave, ''), '[^A-Za-z0-9]', '', 'g'));
  coincide :=
       (length(dig) between 8 and 13 and tel_cliente(b.telefono) = tel_cliente(p_clave))
    or (b.codigo is not null and length(alfa) >= case when b.multiuso then 4 else 8 end
        and upper(regexp_replace(b.codigo, '[^A-Za-z0-9]', '', 'g')) = alfa)
    or (b.serie is not null and length(dig) between 1 and 7
        and ltrim(regexp_replace(b.serie, '[^0-9]', '', 'g'), '0') = ltrim(dig, '0'))
    /* SQL 72: la gift card impresa, por sus 14 números. */
    or (b.serie is not null and dig ~ '^99[0-9]{12}$' and b.serie = dig);
  if not coincide then
    return jsonb_build_object('canjeado', false, 'porque', 'la clave no corresponde a ese beneficio');
  end if;

  if b.estado <> 'disponible' then
    return jsonb_build_object('canjeado', false, 'porque',
      case when b.multiuso and b.estado = 'usado' then 'ya se usó todas las veces que permitía' else 'ese beneficio está ' || b.estado end);
  end if;
  if b.desde is not null and b.desde > hoy then
    return jsonb_build_object('canjeado', false,
      'porque', 'empieza a valer el ' || to_char(b.desde, 'DD/MM'));
  end if;
  if length(trim(coalesce(p_local, ''))) = 0 then raise exception 'Falta el local del canje.'; end if;

  if b.locales is not null
     and upper(trim(p_local)) <> all (select upper(trim(x)) from unnest(b.locales) as x) then
    return jsonb_build_object('canjeado', false, 'porque', 'ese beneficio no vale en ' || trim(p_local), 'locales', b.locales);
  end if;
  if b.compra_minima is not null and coalesce(p_monto, 0) < b.compra_minima then
    return jsonb_build_object('canjeado', false,
      'porque', 'la compra no llega al mínimo de ' || b.compra_minima::text, 'compra_minima', b.compra_minima);
  end if;

  -- ── La campaña: se anota un uso, el cupón sigue vivo ──
  if b.multiuso then
    /* "11 2345-6789" y "+54 9 11 2345 6789" son la misma persona: se
       comparan los últimos 10 números. Sin esto, escribir el teléfono de
       otra forma alcanzaba para usar "una vez por persona" dos veces. */
    /* SQL 81: la regla del Club (también saca el 15). */
    tel := tel_cliente(p_telefono);
    if b.por_cliente is not null and tel is null then
      return jsonb_build_object('canjeado', false, 'falta_telefono', true,
        'porque', 'este cupón es de ' ||
          case when b.por_cliente = 1 then 'un uso por persona' else b.por_cliente || ' usos por persona' end ||
          ': poné el WhatsApp del cliente, con la característica');
    end if;

    /* Dos canjes del mismo cupón a la vez —dos locales, o el mismo
       cliente en dos cajas— se hacen de a uno: el segundo ya ve el uso del
       primero. Es lo que hace que "una vez por persona" se cumpla de
       verdad y que el tope no se pase por uno. */
    perform pg_advisory_xact_lock(hashtext('cupon_campana'), b.id::integer);

    if b.por_cliente is not null then
      select count(*) into ya from beneficio_usos
       where beneficio = b.id and anulado is null and telefono = tel;
      if ya >= b.por_cliente then
        select creado, local into ult from beneficio_usos
         where beneficio = b.id and anulado is null and telefono = tel
         order by creado desc limit 1;
        return jsonb_build_object('canjeado', false, 'ya_lo_uso', true,
          'porque', 'ese cliente ya lo usó' ||
            case when b.por_cliente > 1 then ' las ' || b.por_cliente || ' veces que permite' else '' end ||
            ' (el ' || to_char(ult.creado at time zone 'America/Argentina/Buenos_Aires', 'DD/MM') ||
            ' en ' || coalesce((select nullif(trim(l.nombre), '') from locales l where upper(trim(l.codigo)) = upper(trim(ult.local))),
                              initcap(lower(ult.local))) || ')');
      end if;
    end if;
    if b.usos_max is not null then
      select count(*) into total from beneficio_usos where beneficio = b.id and anulado is null;
      if total >= b.usos_max then
        return jsonb_build_object('canjeado', false, 'porque', 'ya se usó las ' || b.usos_max || ' veces que permitía');
      end if;
    end if;

    insert into beneficio_usos (beneficio, telefono, nombre, local, vendedor, monto_compra, producto)
    values (b.id, tel, nullif(trim(coalesce(p_nombre, '')), ''), trim(p_local),
            nullif(trim(coalesce(p_vendedor, '')), ''), p_monto, nullif(trim(coalesce(p_producto, '')), ''));

    return jsonb_build_object('canjeado', true, 'tipo', 'descuento', 'al_portador', true, 'campana', true,
      'quedan', case when b.usos_max is null then null else b.usos_max - coalesce(total, b.usos) - 1 end);
  end if;

  -- ── Un solo uso, como siempre ──
  update beneficios
     set usado = now(), local_canje = trim(p_local),
         vendedor_canje = nullif(trim(coalesce(p_vendedor, '')), ''),
         monto_compra = p_monto,
         canal_canje = 'local'
   where id = p_id and usado is null and anulado is null;
  get diagnostics tocadas = row_count;
  if tocadas = 0 then
    return jsonb_build_object('canjeado', false, 'porque', 'lo acaban de usar en otro lado');
  end if;

  if b.tipo = 'descuento' and b.registro is not null and coalesce(p_monto, 0) > 0 then
    update registros
       set compro = true, compro_canal = 'local', monto = p_monto,
           producto_final = coalesce(nullif(trim(coalesce(p_producto, '')), ''), producto_final),
           estado = coalesce(estado, 'Cerrado - compró'), contactado = true
     where id = b.registro;
  end if;

  return jsonb_build_object('canjeado', true, 'tipo', b.tipo::text, 'al_portador', (b.codigo is not null));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.crear_cupon(p_pin text, p_quien text, p_pct smallint, p_dias integer DEFAULT 30, p_registro bigint DEFAULT NULL::bigint, p_telefono text DEFAULT NULL::text, p_nombre text DEFAULT NULL::text, p_compra_minima numeric DEFAULT NULL::numeric, p_locales text[] DEFAULT NULL::text[], p_acumulable boolean DEFAULT false, p_obs text DEFAULT NULL::text, p_campana boolean DEFAULT false, p_codigo text DEFAULT NULL::text, p_usos_max integer DEFAULT NULL::integer, p_por_cliente integer DEFAULT NULL::integer, p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date, p_tope numeric DEFAULT NULL::numeric, p_en_app boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tz      constant text := 'America/Argentina/Buenos_Aires';
  hoy     date := (now() at time zone tz)::date;
  r       registros%rowtype;
  llave   jsonb;
  tel     text;
  nom     text;
  quien   text;
  cod     text;
  nid     bigint;
  sueltos text[];
  hasta   date;
  camp    boolean := coalesce(p_campana, false);
begin
  llave := pin_ok(p_pin);
  if not (llave->>'ok')::boolean then
    return jsonb_build_object('creado', false, 'porque', llave->>'porque',
                              'espera', llave->'espera', 'pin', true);
  end if;

  quien := nullif(trim(coalesce(p_quien, '')), '');
  if quien is null then raise exception 'Falta quién está creando el cupón.'; end if;
  if p_pct is null or p_pct < 1 or p_pct > 100 then raise exception 'El descuento tiene que estar entre 1 y 100.'; end if;
  if p_compra_minima is not null and p_compra_minima <= 0 then raise exception 'La compra mínima tiene que ser mayor que cero.'; end if;
  if p_tope is not null and p_tope <= 0 then raise exception 'El tope de descuento tiene que ser mayor que cero.'; end if;

  /* Hasta cuándo: una fecha, o los días de siempre. */
  if p_hasta is not null then
    hasta := p_hasta;
  else
    if coalesce(p_dias, 0) < 1 then raise exception 'El cupón tiene que durar al menos un día.'; end if;
    hasta := hoy + coalesce(p_dias, 30);
  end if;
  if hasta < hoy then raise exception 'La fecha de fin ya pasó.'; end if;
  if p_desde is not null and p_desde > hasta then raise exception 'Empieza después de terminar: revisá las fechas.'; end if;

  if p_locales is not null then
    if array_length(p_locales, 1) is null then
      raise exception 'La lista de locales está vacía. Para todos, dejala sin poner.';
    end if;
    select array_agg(x) into sueltos
      from unnest(p_locales) as x
     where upper(trim(x)) not in (select upper(codigo) from locales where activo);
    if sueltos is not null then
      raise exception 'Estos locales no existen o están inactivos: %.', array_to_string(sueltos, ', ');
    end if;
  end if;

  -- ── La campaña ──
  if camp then
    cod := upper(regexp_replace(trim(coalesce(p_codigo, '')), '\s+', '', 'g'));
    if cod = '' then raise exception 'Falta el código del cupón.'; end if;
    if cod !~ '^[A-Z0-9-]{4,20}$' then
      raise exception 'El código va de 4 a 20 letras o números, sin espacios ni acentos.';
    end if;
    /* Con al menos una letra: un código de puros números se confundiría
       con el número de una Gift Card o con un teléfono al buscarlo. */
    if cod !~ '[A-Z]' then raise exception 'El código necesita al menos una letra.'; end if;
    if exists (select 1 from beneficios
                where upper(regexp_replace(coalesce(codigo, ''), '[^A-Za-z0-9]', '', 'g'))
                    = regexp_replace(cod, '[^A-Z0-9]', '', 'g')) then
      raise exception 'Ya hay un cupón con el código %. Elegí otro nombre.', cod;
    end if;
    if p_usos_max is not null and p_usos_max < 1 then raise exception 'El límite de usos tiene que ser 1 o más.'; end if;
    if p_por_cliente is not null and p_por_cliente < 1 then raise exception 'Los usos por cliente tienen que ser 1 o más.'; end if;

    insert into beneficios (
      tipo, pct, codigo, vence, desde, compra_minima, locales, acumulable, tope,
      multiuso, usos_max, por_cliente, creado_por, creado_por_nombre, obs, en_app
    ) values (
      'descuento', p_pct, cod, hasta, p_desde, p_compra_minima, p_locales, coalesce(p_acumulable, false), p_tope,
      true, p_usos_max, p_por_cliente, auth.uid(), quien, nullif(trim(coalesce(p_obs, '')), ''), coalesce(p_en_app, false)
    )
    returning id into nid;

    return jsonb_build_object('creado', true, 'id', nid, 'codigo', cod, 'pct', p_pct, 'campana', true);
  end if;

  -- ── El de una persona, como siempre ──
  /* SQL 81: el teléfono se guarda con la regla del Club. */
  tel := nullif(trim(coalesce(p_telefono, '')), '');
  if tel is not null then
    tel := tel_cliente(tel);
    if tel is null then raise exception 'El teléfono tiene que tener la característica: 10 números.'; end if;
  end if;
  nom := nullif(trim(coalesce(p_nombre, '')), '');
  if p_registro is not null then
    select * into r from registros where id = p_registro;
    if not found then raise exception 'No existe el registro %.', p_registro; end if;
    tel := tel_cliente(r.whatsapp);
    nom := coalesce(nom, r.nombre);
  end if;
  if tel is not null then
    select id into nid from v_beneficios
     where tipo = 'descuento' and estado = 'disponible'
       and tel_cliente(telefono) = tel
     limit 1;
    if nid is not null then
      return jsonb_build_object('creado', false, 'porque', 'ese cliente ya tiene un beneficio sin usar', 'id', nid);
    end if;
  end if;

  cod := generar_codigo();
  insert into beneficios (
    tipo, registro, telefono, nombre, pct, codigo, vence, desde,
    compra_minima, locales, acumulable, tope, creado_por, creado_por_nombre, obs
  ) values (
    'descuento', p_registro, tel, nom, p_pct, cod, hasta, p_desde,
    p_compra_minima, p_locales, coalesce(p_acumulable, false), p_tope, auth.uid(), quien, p_obs
  )
  returning id into nid;

  return jsonb_build_object('creado', true, 'id', nid, 'codigo', cod, 'pct', p_pct);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dar_descuento(p_pin text, p_registro bigint, p_pct smallint, p_dias integer DEFAULT 30, p_quien text DEFAULT NULL::text, p_obs text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r   registros%rowtype;
  nid bigint;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  select * into r from registros where id = p_registro;
  if not found then raise exception 'No existe el registro %.', p_registro; end if;

  /* Si ya tiene uno vivo, no se crea otro: se devuelve el que hay. Dos
     personas mirando el mismo panel no pueden dejar al cliente con dos
     descuentos, que es lo que pasaba repartiendo cupones de papel. */
  /* SQL 81: el teléfono con la regla del Club. */
  if tel_cliente(r.whatsapp) is null then
    return jsonb_build_object('dado', false, 'porque', 'ese registro no tiene un WhatsApp con característica');
  end if;
  select id into nid from v_beneficios
   where tipo = 'descuento' and estado = 'disponible'
     and tel_cliente(telefono) = tel_cliente(r.whatsapp)
   limit 1;
  if nid is not null then
    return jsonb_build_object('dado', false, 'porque', 'ese cliente ya tiene un descuento sin usar', 'id', nid);
  end if;

  insert into beneficios (tipo, registro, telefono, nombre, pct, vence, local, vendedor, obs)
  values ('descuento', r.id, tel_cliente(r.whatsapp), r.nombre, p_pct,
          ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)),
          r.sucursal, coalesce(p_quien, r.vendedor), p_obs)
  returning id into nid;

  return jsonb_build_object('dado', true, 'id', nid, 'pct', p_pct);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.vender_giftcard(p_valor numeric, p_local text, p_vendedor text, p_cobrado numeric DEFAULT NULL::numeric, p_pago text DEFAULT NULL::text, p_dias integer DEFAULT 30, p_telefono text DEFAULT NULL::text, p_nombre text DEFAULT NULL::text, p_obs text DEFAULT NULL::text, p_codigo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  nid     bigint;
  intento integer;
  /* `nro` y no `serie`: la tabla tiene una columna que se llama así, y
     adentro del INSERT PL/pgSQL no sabe a cuál de las dos le hablan. */
  nro text;
  v_cod text := nullif(regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g'), '');
  t giftcard_tarjetas%rowtype;
begin
  if coalesce(p_valor, 0) <= 0 then raise exception 'Falta el valor de la Gift Card.'; end if;
  if length(trim(coalesce(p_local, ''))) = 0 then raise exception 'Falta el local.'; end if;
  if length(trim(coalesce(p_vendedor, ''))) = 0 then raise exception 'Falta el vendedor.'; end if;

  /* SQL 72: la tarjeta impresa. Su número es el código que lee la pistola:
     tiene que ser una de las impresas y no haberse vendido. */
  if v_cod is not null then
    if v_cod !~ '^99[0-9]{12}$' then raise exception 'Ese código no es de una Gift Card VDH.'; end if;
    select * into t from giftcard_tarjetas g where g.codigo = v_cod;
    if not found then raise exception 'Esa tarjeta no está entre las Gift Cards impresas.'; end if;
    if exists (select 1 from beneficios b where b.tipo = 'giftcard' and b.serie = v_cod) then
      raise exception 'Esa Gift Card ya se vendió.';
    end if;
    begin
      insert into beneficios (tipo, serie, valor, cobrado, pago, vence,
                              local, vendedor, telefono, nombre, obs)
      values ('giftcard', v_cod, p_valor, coalesce(p_cobrado, p_valor),
              nullif(p_pago, '')::forma_pago,
              ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)),
              trim(p_local), trim(p_vendedor),
              coalesce(tel_cliente(p_telefono), nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g'), '')),
              nullif(trim(coalesce(p_nombre, '')), ''),
              p_obs)
      returning id into nid;
    exception when unique_violation then
      raise exception 'Esa Gift Card ya se vendió.';
    end;
    return jsonb_build_object('vendida', true, 'id', nid, 'serie', v_cod, 'nro', t.nro, 'color', t.color,
                              'vence', ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)));
  end if;

  /* Sin código: una tarjeta vieja, con el número escrito a mano. */

  /* El número se toma acá adentro y en la misma transacción que el insert.
     Dos ventas al mismo tiempo en dos locales distintos podrían pedir el
     mismo: el índice único sobre la serie es el que decide, y el que pierde
     reintenta con el siguiente. */
  for intento in 1 .. 5 loop
    nro := siguiente_serie();
    begin
      insert into beneficios (tipo, serie, valor, cobrado, pago, vence,
                              local, vendedor, telefono, nombre, obs)
      values ('giftcard', nro, p_valor,
              -- Sin decir cuánto se cobró, se asume que se cobró el valor.
              coalesce(p_cobrado, p_valor),
              nullif(p_pago, '')::forma_pago,
              ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)),
              trim(p_local), trim(p_vendedor),
              coalesce(tel_cliente(p_telefono), nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g'), '')),
              nullif(trim(coalesce(p_nombre, '')), ''),
              p_obs)
      returning id into nid;

      return jsonb_build_object('vendida', true, 'id', nid, 'serie', nro);

    exception when unique_violation then
      -- Se la ganó otro local. Se prueba con la que sigue.
      null;
    end;
  end loop;

  raise exception 'No se pudo tomar un número de tarjeta. Probá de nuevo.';
end;
$function$
;

/* El "Dar un cupón" de Contactos: personal, por teléfono, sin código. */
create or replace function dar_descuento_tel(p_pin text, p_telefono text, p_pct smallint, p_dias integer default 30,
                                             p_quien text default null, p_nombre text default null, p_obs text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tel text := tel_cliente(p_telefono);
  nid bigint;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if tel is null then
    return jsonb_build_object('dado', false, 'porque', 'el teléfono tiene que tener la característica: 10 números');
  end if;
  if p_pct is null or p_pct < 1 or p_pct > 100 then
    return jsonb_build_object('dado', false, 'porque', 'el descuento va de 1 a 100');
  end if;
  if coalesce(p_dias, 30) < 1 or coalesce(p_dias, 30) > 365 then
    return jsonb_build_object('dado', false, 'porque', 'el descuento dura entre 1 día y un año');
  end if;
  select id into nid from v_beneficios
   where tipo = 'descuento' and estado = 'disponible' and tel_cliente(telefono) = tel
   limit 1;
  if nid is not null then
    return jsonb_build_object('dado', false, 'porque', 'ese cliente ya tiene un descuento sin usar', 'id', nid);
  end if;
  insert into beneficios (tipo, telefono, nombre, pct, vence, vendedor, obs)
  values ('descuento', tel, nullif(trim(coalesce(p_nombre, '')), ''), p_pct,
          ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)),
          nullif(trim(coalesce(p_quien, '')), ''), nullif(trim(coalesce(p_obs, '')), ''))
  returning id into nid;
  return jsonb_build_object('dado', true, 'id', nid, 'pct', p_pct);
end;
$$;
revoke execute on function dar_descuento_tel(text, text, smallint, integer, text, text, text) from public;
grant execute on function dar_descuento_tel(text, text, smallint, integer, text, text, text) to anon, authenticated;

select 'listo: los teléfonos de cupones y gift cards, con una sola regla' as "SQL 81";


-- ─────────────────────────── PARTE 82 (12/10/2026) ───────────────────────────
-- ═══ SQL 82 (12/10/2026) · cupones vencidos y teléfonos del exterior ═══
-- Lo que encontró el árbitro al probar la reorganización del menú:
--   · Un cupón o una gift card VENCIDOS ahora se pueden extender: Extender
--     cuenta desde hoy si ya venció.
--   · Darle un descuento nuevo a alguien con uno VENCIDO sin usar ya no
--     choca: el vencido se cierra ("venció sin usarse") y sale el nuevo.
--     Pasaba en la ficha del No Compra, en Contactos y en "Crear un cupón".
--   · Lo mismo en los avisos automáticos del Club con cupón: con un cupón
--     vencido de un socio, la corrida de cada hora se cortaba entera.
--   · Un teléfono del exterior escrito con + (o 00) se guarda entero.
-- Se puede correr más de una vez.

-- El teléfono de los cupones: la regla del Club para los de acá; los del
-- exterior (+598…, 00 1…) enteros y con el +.
create or replace function tel_cliente(p text) returns text language sql immutable as $$
  select case
    when btrim(coalesce(p, '')) ~ '^(\+|00)'
         and regexp_replace(regexp_replace(btrim(p), '^(\+|00)', ''), '[^0-9]', '', 'g') !~ '^54'
         and length(regexp_replace(regexp_replace(btrim(p), '^(\+|00)', ''), '[^0-9]', '', 'g')) between 8 and 15
      then '+' || regexp_replace(regexp_replace(btrim(p), '^(\+|00)', ''), '[^0-9]', '', 'g')
    else club_tel10(club_tel(p))
  end
$$;

-- Cierra los descuentos VENCIDOS y sin usar de un teléfono, para que entre
-- uno nuevo: el índice "uno vivo por teléfono" no puede mirar la fecha.
create or replace function cerrar_descuentos_vencidos(p_tel text, p_quien text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if nullif(regexp_replace(coalesce(p_tel, ''), '[^0-9]', '', 'g'), '') is null then return 0; end if;
  update beneficios b
     set anulado = now(),
         anulado_por = coalesce(nullif(trim(coalesce(p_quien, '')), ''), 'sistema'),
         motivo_anul = 'Venció sin usarse: se le dio uno nuevo.'
   where b.tipo = 'descuento' and b.usado is null and b.anulado is null
     and regexp_replace(coalesce(b.telefono, ''), '[^0-9]', '', 'g') = regexp_replace(p_tel, '[^0-9]', '', 'g')
     and b.vence < (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function cerrar_descuentos_vencidos(text, text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.extender_beneficio(p_pin text, p_id bigint, p_dias integer, p_quien text)
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare nueva date;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if coalesce(p_dias, 0) <= 0 then raise exception 'Cuántos días hay que extenderlo.'; end if;
  /* SQL 82: si ya venció, cuenta desde hoy (antes sumaba a la fecha vieja y
     +7 a uno vencido hace 10 lo dejaba vencido). En las columnas de SET,
     "vence" es el de antes. */
  update beneficios
     set vence = greatest(coalesce(vence, (now() at time zone 'America/Argentina/Buenos_Aires')::date),
                          (now() at time zone 'America/Argentina/Buenos_Aires')::date) + p_dias,
         -- Queda dicho en las observaciones, que es donde alguien lo va a
         -- buscar cuando pregunte por qué esta tarjeta duró tres meses.
         obs = trim(both E'\n' from coalesce(obs, '') || E'\n' ||
               to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM') ||
               ': ' || coalesce(p_quien, 'alguien') ||
               case when vence < (now() at time zone 'America/Argentina/Buenos_Aires')::date
                    then ' lo volvió a dar por ' || p_dias || ' días (había vencido el ' || to_char(vence, 'DD/MM') || ').'
                    else ' extendió ' || p_dias || ' días.' end)
   where id = p_id and usado is null and anulado is null
  returning vence into nueva;
  return nueva;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dar_descuento(p_pin text, p_registro bigint, p_pct smallint, p_dias integer DEFAULT 30, p_quien text DEFAULT NULL::text, p_obs text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r   registros%rowtype;
  nid bigint;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  select * into r from registros where id = p_registro;
  if not found then raise exception 'No existe el registro %.', p_registro; end if;

  /* Si ya tiene uno vivo, no se crea otro: se devuelve el que hay. Dos
     personas mirando el mismo panel no pueden dejar al cliente con dos
     descuentos, que es lo que pasaba repartiendo cupones de papel. */
  /* SQL 81: el teléfono con la regla del Club. */
  if tel_cliente(r.whatsapp) is null then
    return jsonb_build_object('dado', false, 'porque', 'ese registro no tiene un WhatsApp con característica');
  end if;
  select id into nid from v_beneficios
   where tipo = 'descuento' and estado = 'disponible'
     and tel_cliente(telefono) = tel_cliente(r.whatsapp)
   limit 1;
  if nid is not null then
    return jsonb_build_object('dado', false, 'porque', 'ese cliente ya tiene un descuento sin usar', 'id', nid);
  end if;

  /* SQL 82: uno vencido sin usar se cierra, en vez de chocar con el índice. */
  perform cerrar_descuentos_vencidos(tel_cliente(r.whatsapp), coalesce(p_quien, r.vendedor));
  begin
    insert into beneficios (tipo, registro, telefono, nombre, pct, vence, local, vendedor, obs)
    values ('descuento', r.id, tel_cliente(r.whatsapp), r.nombre, p_pct,
            ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)),
            r.sucursal, coalesce(p_quien, r.vendedor), p_obs)
    returning id into nid;
  exception when unique_violation then
    return jsonb_build_object('dado', false, 'porque', 'ese cliente ya tiene un descuento sin usar');
  end;

  return jsonb_build_object('dado', true, 'id', nid, 'pct', p_pct);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dar_descuento_tel(p_pin text, p_telefono text, p_pct smallint, p_dias integer DEFAULT 30, p_quien text DEFAULT NULL::text, p_nombre text DEFAULT NULL::text, p_obs text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tel text := tel_cliente(p_telefono);
  nid bigint;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if tel is null then
    return jsonb_build_object('dado', false, 'porque', 'el teléfono tiene que tener la característica: 10 números');
  end if;
  if p_pct is null or p_pct < 1 or p_pct > 100 then
    return jsonb_build_object('dado', false, 'porque', 'el descuento va de 1 a 100');
  end if;
  if coalesce(p_dias, 30) < 1 or coalesce(p_dias, 30) > 365 then
    return jsonb_build_object('dado', false, 'porque', 'el descuento dura entre 1 día y un año');
  end if;
  select id into nid from v_beneficios
   where tipo = 'descuento' and estado = 'disponible' and tel_cliente(telefono) = tel
   limit 1;
  if nid is not null then
    return jsonb_build_object('dado', false, 'porque', 'ese cliente ya tiene un descuento sin usar', 'id', nid);
  end if;
  /* SQL 82: uno vencido sin usar se cierra, en vez de chocar con el índice. */
  perform cerrar_descuentos_vencidos(tel, p_quien);
  begin
    insert into beneficios (tipo, telefono, nombre, pct, vence, vendedor, obs)
    values ('descuento', tel, nullif(trim(coalesce(p_nombre, '')), ''), p_pct,
            ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)),
            nullif(trim(coalesce(p_quien, '')), ''), nullif(trim(coalesce(p_obs, '')), ''))
    returning id into nid;
  exception when unique_violation then
    return jsonb_build_object('dado', false, 'porque', 'ese cliente ya tiene un descuento sin usar');
  end;
  return jsonb_build_object('dado', true, 'id', nid, 'pct', p_pct);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.crear_cupon(p_pin text, p_quien text, p_pct smallint, p_dias integer DEFAULT 30, p_registro bigint DEFAULT NULL::bigint, p_telefono text DEFAULT NULL::text, p_nombre text DEFAULT NULL::text, p_compra_minima numeric DEFAULT NULL::numeric, p_locales text[] DEFAULT NULL::text[], p_acumulable boolean DEFAULT false, p_obs text DEFAULT NULL::text, p_campana boolean DEFAULT false, p_codigo text DEFAULT NULL::text, p_usos_max integer DEFAULT NULL::integer, p_por_cliente integer DEFAULT NULL::integer, p_desde date DEFAULT NULL::date, p_hasta date DEFAULT NULL::date, p_tope numeric DEFAULT NULL::numeric, p_en_app boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  tz      constant text := 'America/Argentina/Buenos_Aires';
  hoy     date := (now() at time zone tz)::date;
  r       registros%rowtype;
  llave   jsonb;
  tel     text;
  nom     text;
  quien   text;
  cod     text;
  nid     bigint;
  sueltos text[];
  hasta   date;
  camp    boolean := coalesce(p_campana, false);
begin
  llave := pin_ok(p_pin);
  if not (llave->>'ok')::boolean then
    return jsonb_build_object('creado', false, 'porque', llave->>'porque',
                              'espera', llave->'espera', 'pin', true);
  end if;

  quien := nullif(trim(coalesce(p_quien, '')), '');
  if quien is null then raise exception 'Falta quién está creando el cupón.'; end if;
  if p_pct is null or p_pct < 1 or p_pct > 100 then raise exception 'El descuento tiene que estar entre 1 y 100.'; end if;
  if p_compra_minima is not null and p_compra_minima <= 0 then raise exception 'La compra mínima tiene que ser mayor que cero.'; end if;
  if p_tope is not null and p_tope <= 0 then raise exception 'El tope de descuento tiene que ser mayor que cero.'; end if;

  /* Hasta cuándo: una fecha, o los días de siempre. */
  if p_hasta is not null then
    hasta := p_hasta;
  else
    if coalesce(p_dias, 0) < 1 then raise exception 'El cupón tiene que durar al menos un día.'; end if;
    hasta := hoy + coalesce(p_dias, 30);
  end if;
  if hasta < hoy then raise exception 'La fecha de fin ya pasó.'; end if;
  if p_desde is not null and p_desde > hasta then raise exception 'Empieza después de terminar: revisá las fechas.'; end if;

  if p_locales is not null then
    if array_length(p_locales, 1) is null then
      raise exception 'La lista de locales está vacía. Para todos, dejala sin poner.';
    end if;
    select array_agg(x) into sueltos
      from unnest(p_locales) as x
     where upper(trim(x)) not in (select upper(codigo) from locales where activo);
    if sueltos is not null then
      raise exception 'Estos locales no existen o están inactivos: %.', array_to_string(sueltos, ', ');
    end if;
  end if;

  -- ── La campaña ──
  if camp then
    cod := upper(regexp_replace(trim(coalesce(p_codigo, '')), '\s+', '', 'g'));
    if cod = '' then raise exception 'Falta el código del cupón.'; end if;
    if cod !~ '^[A-Z0-9-]{4,20}$' then
      raise exception 'El código va de 4 a 20 letras o números, sin espacios ni acentos.';
    end if;
    /* Con al menos una letra: un código de puros números se confundiría
       con el número de una Gift Card o con un teléfono al buscarlo. */
    if cod !~ '[A-Z]' then raise exception 'El código necesita al menos una letra.'; end if;
    if exists (select 1 from beneficios
                where upper(regexp_replace(coalesce(codigo, ''), '[^A-Za-z0-9]', '', 'g'))
                    = regexp_replace(cod, '[^A-Z0-9]', '', 'g')) then
      raise exception 'Ya hay un cupón con el código %. Elegí otro nombre.', cod;
    end if;
    if p_usos_max is not null and p_usos_max < 1 then raise exception 'El límite de usos tiene que ser 1 o más.'; end if;
    if p_por_cliente is not null and p_por_cliente < 1 then raise exception 'Los usos por cliente tienen que ser 1 o más.'; end if;

    insert into beneficios (
      tipo, pct, codigo, vence, desde, compra_minima, locales, acumulable, tope,
      multiuso, usos_max, por_cliente, creado_por, creado_por_nombre, obs, en_app
    ) values (
      'descuento', p_pct, cod, hasta, p_desde, p_compra_minima, p_locales, coalesce(p_acumulable, false), p_tope,
      true, p_usos_max, p_por_cliente, auth.uid(), quien, nullif(trim(coalesce(p_obs, '')), ''), coalesce(p_en_app, false)
    )
    returning id into nid;

    return jsonb_build_object('creado', true, 'id', nid, 'codigo', cod, 'pct', p_pct, 'campana', true);
  end if;

  -- ── El de una persona, como siempre ──
  /* SQL 81: el teléfono se guarda con la regla del Club. */
  tel := nullif(trim(coalesce(p_telefono, '')), '');
  if tel is not null then
    tel := tel_cliente(tel);
    if tel is null then raise exception 'El teléfono tiene que tener la característica: 10 números.'; end if;
  end if;
  nom := nullif(trim(coalesce(p_nombre, '')), '');
  if p_registro is not null then
    select * into r from registros where id = p_registro;
    if not found then raise exception 'No existe el registro %.', p_registro; end if;
    tel := tel_cliente(r.whatsapp);
    nom := coalesce(nom, r.nombre);
  end if;
  if tel is not null then
    select id into nid from v_beneficios
     where tipo = 'descuento' and estado = 'disponible'
       and tel_cliente(telefono) = tel
     limit 1;
    if nid is not null then
      return jsonb_build_object('creado', false, 'porque', 'ese cliente ya tiene un beneficio sin usar', 'id', nid);
    end if;
  end if;

  /* SQL 82: uno vencido sin usar se cierra, en vez de chocar con el índice. */
  if tel is not null then
    perform cerrar_descuentos_vencidos(tel, quien);
  end if;
  cod := generar_codigo();
  begin
    insert into beneficios (
      tipo, registro, telefono, nombre, pct, codigo, vence, desde,
      compra_minima, locales, acumulable, tope, creado_por, creado_por_nombre, obs
    ) values (
      'descuento', p_registro, tel, nom, p_pct, cod, hasta, p_desde,
      p_compra_minima, p_locales, coalesce(p_acumulable, false), p_tope, auth.uid(), quien, p_obs
    )
    returning id into nid;
  exception when unique_violation then
    return jsonb_build_object('creado', false, 'porque', 'ese cliente ya tiene un beneficio sin usar');
  end;

  return jsonb_build_object('creado', true, 'id', nid, 'codigo', cod, 'pct', p_pct);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.club_avisos_auto_correr()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ahora timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  hoy   date := ahora::date;
  cfg   club_avisos_auto%rowtype;
  s     record;
  tel   text;
  cod   text;
  txt   text;
  tit   text;
  n_av  integer := 0;
  n_cu  integer := 0;
  miles text;
begin
  if extract(hour from ahora) < 11 or extract(hour from ahora) >= 20 then
    return jsonb_build_object('hecho', false, 'porque', 'fuera de horario (11 a 20)');
  end if;

  for cfg in select * from club_avisos_auto where activo order by motivo loop
    for s in select * from club_avisos_auto_candidatos(cfg.motivo) loop
      /* SQL 82: el teléfono con la regla de los cupones (sin 54, 9, 0 ni 15). */
      tel := tel_cliente(s.telefono);
      cod := null;
      /* El cupón, si hay % y no tiene otro sin usar (uno vivo por teléfono). */
      if cfg.cupon_pct is not null and length(tel) = 10
         and not exists (select 1 from v_beneficios b
                          where b.tipo = 'descuento' and not b.multiuso and b.estado = 'disponible'
                            and tel_cliente(b.telefono) = tel) then
        /* SQL 82: el cupón vencido sin usar se cierra (antes el insert chocaba
           con el índice y se cortaba la corrida entera, para todos). Y si igual
           choca, el aviso sale sin cupón. */
        perform cerrar_descuentos_vencidos(tel, 'VDH Club (automático)');
        cod := generar_codigo();
        begin
          insert into beneficios (tipo, telefono, nombre, pct, codigo, vence, acumulable, creado_por_nombre, obs)
          values ('descuento', tel, s.nombre, cfg.cupon_pct, cod, hoy + cfg.cupon_dias, true,
                  'VDH Club (automático)', 'Aviso automático: ' || case cfg.motivo when 'vencen' then 'puntos por vencer' else 'te extrañamos' end);
          n_cu := n_cu + 1;
        exception when unique_violation then
          cod := null;
        end;
      end if;
      miles := replace(to_char(floor(s.puntos), 'FM999,999,999'), ',', '.');
      tit := replace(cfg.titulo, '{nombre}', split_part(coalesce(s.nombre, ''), ' ', 1));
      txt := replace(replace(replace(cfg.cuerpo, '{nombre}', split_part(coalesce(s.nombre, ''), ' ', 1)),
                             '{puntos}', miles), '{fecha}', to_char(s.vence, 'DD/MM'));
      if cod is not null then
        txt := txt || ' Y te regalamos un ' || cfg.cupon_pct || '% de descuento, acumulable con otras promos.';
      end if;
      insert into club_avisos_personales (cliente, motivo, clave, titulo, cuerpo, enlace, sale)
      values (s.cliente, cfg.motivo, cfg.motivo || ':' || s.base::text, left(tit, 60), txt, 'tarjeta.html#promos', now())
      on conflict (cliente, motivo, clave) do nothing;
      n_av := n_av + 1;
    end loop;
  end loop;
  return jsonb_build_object('hecho', true, 'avisos', n_av, 'cupones', n_cu);
end;
$function$
;

select 'listo: cupones vencidos con salida, y los teléfonos del exterior enteros' as "SQL 82";


-- ─────────────────────────── PARTE 83 (12/10/2026) ───────────────────────────
-- ═══ SQL 83 (12/10/2026) · los teléfonos del exterior, también sin el + ═══
-- El 82 guardaba entero un número del exterior sólo si venía con el +, y
-- tomaba como del exterior a uno de acá escrito con + y sin el 54.
-- Ahora es del exterior si tiene 11 cifras o más, no empieza con el 54, y
-- viene con + (o 00) o empieza con una cifra que acá no puede ir adelante
-- (las características empiezan con 1, 2 o 3; el 0, el 9 y el 15 los saca
-- la regla del Club). Los de acá quedan igual que siempre.
-- Se puede correr más de una vez.
create or replace function tel_cliente(p text) returns text language sql immutable as $$
  select case
    when x.d = '' then null
    when x.d !~ '^54' and length(x.d) between 11 and 15 and (x.t ~ '^(\+|00)' or x.d ~ '^[4-8]')
      then '+' || x.d
    else club_tel10(club_tel(p))
  end
  from (select btrim(coalesce(p, '')) as t,
               regexp_replace(regexp_replace(btrim(coalesce(p, '')), '^(\+|00)', ''), '[^0-9]', '', 'g') as d) x
$$;

select 'listo: los teléfonos del exterior, también sin el +' as "SQL 83";


-- ─────────────────────────── PARTE 84 (12/10/2026) ───────────────────────────
-- ═══ SQL 84 (12/10/2026) · la sección Gift Cards ═══
-- Pedido de Mauricio: las gift cards tienen su sección en la barra (vender y
-- la lista) y sus números van a Estadísticas, al lado del No Compra y del
-- Club. Del CRM sale la pestaña de gift cards (queda "Cupones") y de Cobrar
-- sale la venta (canjear sigue ahí).
--   · giftcards_listar: todas las gift cards, para la lista de la sección.
--     De las impresas NO devuelve el código entero, que es lo que se canjea
--     (al portador): el número de tarjeta, el color y los últimos 4.
--   · giftcard_estadisticas: los números de un período y un local.
--   · vender_giftcard: no vende por un valor absurdo (un código pasado con
--     la pistola en el campo del valor) ni con lo cobrado por encima del
--     valor. Corregirlo después cuesta la tarjeta: una anulada no se vuelve
--     a vender.
-- Las dos nuevas piden el PIN y son VOLATILE: pin_ok escribe.
-- Con un PIN malo NO tiran un error: devuelven {"error": "pin"}. Un error
-- deshace la transacción entera, también lo que pin_ok anotó del intento
-- fallido, y entonces el freno de los tres intentos no corre por ahí. (Las
-- funciones viejas con PIN todavía lo tiran: queda pendiente.)
-- Se puede correr más de una vez.

create or replace function giftcards_listar(p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  r := pin_ok(p_pin);
  if not coalesce((r->>'ok')::boolean, false) then
    /* Sin tirar un error: así el intento fallido queda anotado. "mal" dice
       si el PIN se llegó a comparar (y estaba mal) o si se cortó antes por
       el freno: en ese caso el PIN guardado puede ser el bueno. */
    return jsonb_build_object('error', 'pin', 'porque', coalesce(r->>'porque', 'PIN incorrecto.'),
                              'espera', coalesce((r->>'espera')::integer, 0), 'mal', r ? 'restantes');
  end if;
  return coalesce((
    select jsonb_agg(s.x order by s.creado desc, s.id desc)
      from (
        select b.creado, b.id,
               jsonb_build_object(
                 'id', b.id, 'estado', b.estado,
                 'impresa', t.codigo is not null,
                 'nro', t.nro, 'color', t.color, 'lote', t.lote,
                 'fin', case when t.codigo is not null then right(b.serie, 4) end,
                 'serie', case when t.codigo is null then b.serie end,
                 'valor', b.valor, 'cobrado', b.cobrado, 'pago', b.pago::text,
                 'vence', b.vence, 'dias', b.dias,
                 'local', b.local, 'vendedor', b.vendedor, 'creado', b.creado,
                 'usado', b.usado, 'local_canje', b.local_canje, 'vendedor_canje', b.vendedor_canje,
                 'monto_compra', b.monto_compra,
                 'anulado', b.anulado, 'anulado_por', b.anulado_por, 'motivo_anul', b.motivo_anul,
                 'obs', b.obs, 'nombre', b.nombre, 'telefono', b.telefono) as x
          from v_beneficios b
          left join giftcard_tarjetas t on t.codigo = b.serie
         where b.tipo = 'giftcard'
         order by b.creado desc, b.id desc
         limit 3000) s), '[]'::jsonb);
end;
$$;

revoke execute on function giftcards_listar(text) from public;
grant execute on function giftcards_listar(text) to anon, authenticated;


/* Los números de un período (las fechas, en la hora de Argentina) y,
   si se pide, de un local.
     · Vendidas: por el día y el local de la venta. Las anuladas, aparte.
     · Canjeadas: por el día y el local del canje.
     · Vencidas sin usar: las que vencieron en el período.
     · Anuladas: por el día en que se anularon.
     · "Hoy" (no depende del período): lo que se debe y lo que vence en 7 días.
     · Por local: los 14 siempre (el elegido va marcado en la pantalla).
     · Las impresas (no dependen del período ni del local): cuántas quedan. */
create or replace function giftcard_estadisticas(p_pin text, p_desde date, p_hasta date, p_local text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  d0  date;
  d1  date;
  a0  date;
  a1  date;
  loc text := nullif(upper(trim(coalesce(p_local, ''))), '');
  r   jsonb;
begin
  r := pin_ok(p_pin);
  if not coalesce((r->>'ok')::boolean, false) then
    /* Sin tirar un error: ver giftcards_listar. */
    return jsonb_build_object('error', 'pin', 'porque', coalesce(r->>'porque', 'PIN incorrecto.'),
                              'espera', coalesce((r->>'espera')::integer, 0), 'mal', r ? 'restantes');
  end if;
  d0 := coalesce(p_desde, hoy - 29);
  d1 := coalesce(p_hasta, hoy);
  if d1 < d0 then raise exception 'La fecha "desde" es posterior a "hasta".'; end if;
  /* El período anterior, del mismo largo: para comparar. */
  a1 := d0 - 1;
  a0 := d0 - (d1 - d0 + 1);

  return (
    with g as (
      select b.id, b.estado, b.valor, b.cobrado, b.pago::text as pago, b.vence,
             upper(trim(b.local)) as local, b.vendedor,
             upper(trim(b.local_canje)) as local_canje,
             b.monto_compra, b.anulado,
             (b.creado  at time zone 'America/Argentina/Buenos_Aires')::date as dv,
             (b.usado   at time zone 'America/Argentina/Buenos_Aires')::date as dc,
             (b.anulado at time zone 'America/Argentina/Buenos_Aires')::date as da,
             t.color
        from v_beneficios b
        left join giftcard_tarjetas t on t.codigo = b.serie
       where b.tipo = 'giftcard'
    ),
    /* De todos los locales: para la tabla "Por local", que muestra los 14
       aunque se mire uno (como el No Compra: el elegido va marcado). */
    ven_t   as (select * from g where dv between d0 and d1 and anulado is null),
    can_t   as (select * from g where dc between d0 and d1),
    vivas_t as (select * from g where estado = 'disponible'),
    /* Del local elegido (o de todos): para el resto de los números. */
    ven     as (select * from ven_t where loc is null or local = loc),
    ven_ant as (select * from g where dv between a0 and a1 and anulado is null and (loc is null or local = loc)),
    can     as (select * from can_t where loc is null or local_canje = loc),
    can_ant as (select * from g where dc between a0 and a1 and (loc is null or local_canje = loc)),
    vivas   as (select * from vivas_t where loc is null or local = loc),
    /* Los 14 locales y, si aparece, algún otro escrito en una venta o un
       canje (un local que cerró, un error de tipeo): así los totales cierran. */
    codigos as (
      select upper(trim(l.codigo)) as local, coalesce(nullif(trim(l.nombre), ''), initcap(lower(l.codigo))) as nombre
        from locales l
      union
      select x.local, initcap(lower(x.local))
        from (select g.local from g union select g.local_canje from g) x
       where x.local is not null
         and not exists (select 1 from locales l where upper(trim(l.codigo)) = x.local)
    )
    select jsonb_build_object(
      'periodo', jsonb_build_object('desde', d0, 'hasta', d1, 'dias', d1 - d0 + 1),
      'actual', jsonb_build_object(
        'vendidas',      (select count(*) from ven),
        'vendido',       (select coalesce(sum(valor), 0) from ven),
        'cobrado',       (select coalesce(sum(cobrado), 0) from ven),
        'canjeadas',     (select count(*) from can),
        'canjeado',      (select coalesce(sum(valor), 0) from can),
        'compras_canje', (select coalesce(sum(monto_compra), 0) from can),
        'vencidas',      (select count(*) from g where estado = 'vencido' and vence between d0 and d1 and (loc is null or local = loc)),
        'vencido',       (select coalesce(sum(valor), 0) from g where estado = 'vencido' and vence between d0 and d1 and (loc is null or local = loc)),
        'anuladas',      (select count(*) from g where da between d0 and d1 and (loc is null or local = loc)),
        'anulado',       (select coalesce(sum(valor), 0) from g where da between d0 and d1 and (loc is null or local = loc))),
      'anterior', jsonb_build_object(
        'vendidas',  (select count(*) from ven_ant),
        'vendido',   (select coalesce(sum(valor), 0) from ven_ant),
        'cobrado',   (select coalesce(sum(cobrado), 0) from ven_ant),
        'canjeadas', (select count(*) from can_ant),
        'canjeado',  (select coalesce(sum(valor), 0) from can_ant)),
      'hoy', jsonb_build_object(
        'deben',  (select count(*) from vivas),
        'debe',   (select coalesce(sum(valor), 0) from vivas),
        'vencen', (select count(*) from vivas where vence <= hoy + 7),
        'vence',  (select coalesce(sum(valor), 0) from vivas where vence <= hoy + 7)),
      'por_local', (select coalesce(jsonb_agg(jsonb_build_object(
          'local', c.local, 'nombre', c.nombre,
          'vendidas',  (select count(*) from ven_t v where v.local = c.local),
          'vendido',   (select coalesce(sum(v.valor), 0) from ven_t v where v.local = c.local),
          'cobrado',   (select coalesce(sum(v.cobrado), 0) from ven_t v where v.local = c.local),
          'canjeadas', (select count(*) from can_t x where x.local_canje = c.local),
          'canjeado',  (select coalesce(sum(x.valor), 0) from can_t x where x.local_canje = c.local),
          'deben',     (select count(*) from vivas_t w where w.local = c.local),
          'debe',      (select coalesce(sum(w.valor), 0) from vivas_t w where w.local = c.local)
        ) order by c.nombre), '[]'::jsonb)
        from codigos c),
      'por_mes', (select coalesce(jsonb_agg(jsonb_build_object(
          'mes',       to_char(m, 'YYYY-MM'),
          'vendidas',  (select count(*) from ven v where date_trunc('month', v.dv::timestamp) = m),
          'vendido',   (select coalesce(sum(v.valor), 0) from ven v where date_trunc('month', v.dv::timestamp) = m),
          'canjeadas', (select count(*) from can x where date_trunc('month', x.dc::timestamp) = m),
          'canjeado',  (select coalesce(sum(x.valor), 0) from can x where date_trunc('month', x.dc::timestamp) = m)
        ) order by m), '[]'::jsonb)
        from generate_series(date_trunc('month', d0::timestamp), date_trunc('month', d1::timestamp), interval '1 month') m),
      'por_pago', (select coalesce(jsonb_agg(jsonb_build_object('pago', s.pago, 'n', s.n, 'cobrado', s.c, 'valor', s.v) order by s.n desc, s.pago), '[]'::jsonb)
        from (select coalesce(v.pago, 'sin dato') as pago, count(*) as n, coalesce(sum(v.cobrado), 0) as c, coalesce(sum(v.valor), 0) as v
                from ven v group by 1) s),
      'por_color', (select coalesce(jsonb_agg(jsonb_build_object('color', s.k, 'n', s.n, 'valor', s.v) order by s.k), '[]'::jsonb)
        from (select coalesce(v.color, 'Sin código') as k, count(*) as n, coalesce(sum(v.valor), 0) as v from ven v group by 1) s),
      'por_vendedor', (select coalesce(jsonb_agg(jsonb_build_object('vendedor', s.q, 'local', s.l, 'n', s.n, 'valor', s.v) order by s.n desc, s.v desc, s.q), '[]'::jsonb)
        from (select coalesce(nullif(trim(v.vendedor), ''), 'Sin nombre') as q, v.local as l, count(*) as n, coalesce(sum(v.valor), 0) as v
                from ven v group by 1, 2) s),
      /* Las impresas: una anulada tampoco se puede volver a vender. */
      'impresas', (select coalesce(jsonb_agg(jsonb_build_object('lote', s.lote, 'color', s.color, 'impresas', s.imp, 'vendidas', s.vend) order by s.lote, s.color), '[]'::jsonb)
        from (select t.lote, t.color, count(*) as imp,
                     count(*) filter (where exists (select 1 from beneficios b where b.tipo = 'giftcard' and b.serie = t.codigo)) as vend
                from giftcard_tarjetas t group by 1, 2) s)
    )
  );
end;
$$;

revoke execute on function giftcard_estadisticas(text, date, date, text) from public;
grant execute on function giftcard_estadisticas(text, date, date, text) to anon, authenticated;


-- vender_giftcard, igual que antes, con el tope (SQL 84).
CREATE OR REPLACE FUNCTION public.vender_giftcard(p_valor numeric, p_local text, p_vendedor text, p_cobrado numeric DEFAULT NULL::numeric, p_pago text DEFAULT NULL::text, p_dias integer DEFAULT 30, p_telefono text DEFAULT NULL::text, p_nombre text DEFAULT NULL::text, p_obs text DEFAULT NULL::text, p_codigo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  nid     bigint;
  intento integer;
  /* `nro` y no `serie`: la tabla tiene una columna que se llama así, y
     adentro del INSERT PL/pgSQL no sabe a cuál de las dos le hablan. */
  nro text;
  v_cod text := nullif(regexp_replace(coalesce(p_codigo, ''), '[^0-9]', '', 'g'), '');
  t giftcard_tarjetas%rowtype;
begin
  if coalesce(p_valor, 0) <= 0 then raise exception 'Falta el valor de la Gift Card.'; end if;
  /* SQL 84: un valor absurdo (un código pasado con la pistola en el campo
     del valor: 14 números) o lo cobrado por encima del valor no se venden.
     Corregirlo después cuesta la tarjeta: una anulada no se vuelve a vender. */
  if p_valor >= 10000000 then raise exception 'Ese valor no parece de una Gift Card: revisalo (tiene que ser menos de $ 10.000.000).'; end if;
  if p_cobrado is not null and p_cobrado > p_valor then raise exception 'Lo cobrado no puede ser más que el valor de la Gift Card.'; end if;
  if length(trim(coalesce(p_local, ''))) = 0 then raise exception 'Falta el local.'; end if;
  if length(trim(coalesce(p_vendedor, ''))) = 0 then raise exception 'Falta el vendedor.'; end if;

  /* SQL 72: la tarjeta impresa. Su número es el código que lee la pistola:
     tiene que ser una de las impresas y no haberse vendido. */
  if v_cod is not null then
    if v_cod !~ '^99[0-9]{12}$' then raise exception 'Ese código no es de una Gift Card VDH.'; end if;
    select * into t from giftcard_tarjetas g where g.codigo = v_cod;
    if not found then raise exception 'Esa tarjeta no está entre las Gift Cards impresas.'; end if;
    if exists (select 1 from beneficios b where b.tipo = 'giftcard' and b.serie = v_cod) then
      raise exception 'Esa Gift Card ya se vendió.';
    end if;
    begin
      insert into beneficios (tipo, serie, valor, cobrado, pago, vence,
                              local, vendedor, telefono, nombre, obs)
      values ('giftcard', v_cod, p_valor, coalesce(p_cobrado, p_valor),
              nullif(p_pago, '')::forma_pago,
              ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)),
              trim(p_local), trim(p_vendedor),
              coalesce(tel_cliente(p_telefono), nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g'), '')),
              nullif(trim(coalesce(p_nombre, '')), ''),
              p_obs)
      returning id into nid;
    exception when unique_violation then
      raise exception 'Esa Gift Card ya se vendió.';
    end;
    return jsonb_build_object('vendida', true, 'id', nid, 'serie', v_cod, 'nro', t.nro, 'color', t.color,
                              'vence', ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)));
  end if;

  /* Sin código: una tarjeta vieja, con el número escrito a mano. */

  /* El número se toma acá adentro y en la misma transacción que el insert.
     Dos ventas al mismo tiempo en dos locales distintos podrían pedir el
     mismo: el índice único sobre la serie es el que decide, y el que pierde
     reintenta con el siguiente. */
  for intento in 1 .. 5 loop
    nro := siguiente_serie();
    begin
      insert into beneficios (tipo, serie, valor, cobrado, pago, vence,
                              local, vendedor, telefono, nombre, obs)
      values ('giftcard', nro, p_valor,
              -- Sin decir cuánto se cobró, se asume que se cobró el valor.
              coalesce(p_cobrado, p_valor),
              nullif(p_pago, '')::forma_pago,
              ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)),
              trim(p_local), trim(p_vendedor),
              coalesce(tel_cliente(p_telefono), nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g'), '')),
              nullif(trim(coalesce(p_nombre, '')), ''),
              p_obs)
      returning id into nid;

      return jsonb_build_object('vendida', true, 'id', nid, 'serie', nro);

    exception when unique_violation then
      -- Se la ganó otro local. Se prueba con la que sigue.
      null;
    end;
  end loop;

  raise exception 'No se pudo tomar un número de tarjeta. Probá de nuevo.';
end;
$function$;

select 'listo: la sección Gift Cards (la lista, los números y el tope de la venta)' as "SQL 84";


-- ─────────────────────────── PARTE 85 (12/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · AGENTES DE IA, ETAPA B: LAS FUENTES Y EL ASISTENTE DE LOS VENDEDORES
--
-- Correr en el editor SQL de Supabase (después del 84).
--
-- Pedido de Mauricio (12/10/2026): dejar Chatbase y tener dos agentes
-- propios. Este SQL arma lo del conocimiento y el Asistente:
--   · agente_fuentes: lo que saben los agentes, por partes (archivos,
--     textos y preguntas con su respuesta), cada una con su público
--     ("clientes" o "interno"), su tema y su interruptor. Lo "interno" lo ve
--     SÓLO el Asistente de los vendedores: el agente de clientes recibe
--     únicamente lo "clientes" prendido, y eso lo arma la base
--     (agente_contexto), no la pantalla ni la función.
--   · "Lo que sabe" pasa a fuentes (una por cada "## "), para clientes,
--     sin perder una letra. agente_textos queda como estaba, de respaldo.
--   · El Asistente: sus charlas (de cada persona, en cada PC), los pulgares
--     y lo que estuvo mal, la portada (saludo, sugeridas y accesos) y sus
--     ajustes (prendido, modelo y tope de gasto). Nace APAGADO.
--   · agente_gasto: lo que gasta cada agente en el mes, con el tope que
--     corta y el aviso por Telegram al 80 % y al 100 %.
--
-- Reversible: crea tablas y funciones nuevas; las que cambia
-- (agente_contexto, agente_regla_valida, agente_config y
-- agente_texto_guardar) se pueden volver a su versión del SQL 77/78
-- corriendo esas partes de nuevo. Las fuentes migradas no borran nada.
-- ══════════════════════════════════════════════════════════════════════════

/* ═══ Las fuentes ════════════════════════════════════════════════════════
   tipo "pregunta": el título es la pregunta y el contenido, la respuesta.
   aviso: lo que hay que revisar (viejo, repetido, sensible, cambia).
   borrada: se borran sin perderse (se puede volver desde la base). */
create table if not exists agente_fuentes (
  id          bigserial primary key,
  tipo        text not null check (tipo in ('archivo', 'texto', 'pregunta')),
  titulo      text not null,
  contenido   text not null,
  archivo     text,
  publico     text not null default 'interno' check (publico in ('clientes', 'interno')),
  tema        text,
  prendida    boolean not null default true,
  origen      text,
  aviso       text,
  quien       text,
  creada      timestamptz not null default now(),
  actualizada timestamptz not null default now(),
  borrada     timestamptz
);
create index if not exists agente_fuentes_vivas on agente_fuentes (publico, id) where borrada is null;
alter table agente_fuentes enable row level security;
revoke all on agente_fuentes from anon, authenticated;

/* "Lo que sabe" → fuentes, una por parte, en el mismo orden. Sólo una vez. */
insert into agente_fuentes (tipo, titulo, contenido, publico, tema, origen, aviso, quien)
select 'texto', x.titulo, x.cuerpo, 'clientes',
       case when x.titulo ilike 'Envíos%' then 'Envíos'
            when x.titulo ilike 'Medios de pago%' then 'Pagos'
            when x.titulo ilike 'Cambios%' then 'Cambios'
            when x.titulo ilike 'Talles%' then 'Talles'
            when x.titulo ilike 'Telas%' then 'Telas'
            when x.titulo ilike 'Stock%' then 'Stock'
            when x.titulo ilike 'Colección%' then 'Promociones'
            when x.titulo ilike 'Contacto%' then 'Contacto'
            when x.titulo ilike 'Locales%' then 'Locales'
            else 'General' end,
       'lo-que-sabe',
       case when x.titulo ilike 'Envíos%' then 'cambia: trae el monto del envío gratis, que también está en Reglas de venta. Si cambia, hay que cambiarlo en los dos lados (o sacarlo de acá).'
            when x.titulo ilike 'Medios de pago%' then 'cambia: trae las cuotas y el % de la transferencia. Revisá que sigan vigentes.'
            when x.titulo ilike 'Colección%' then 'cambia: nombra la colección y el SALE de hoy. Lo que se vende y sus precios salen en vivo de la tienda.'
       end,
       'Migración (SQL 85)'
  from (
    select t.i,
           case when t.p like '## %' then btrim(substr(split_part(t.p, E'\n', 1), 4)) else 'General' end as titulo,
           btrim(case when t.p like '## %' then substr(t.p, length(split_part(t.p, E'\n', 1)) + 2) else t.p end, E' \n\t') as cuerpo
      from regexp_split_to_table(
             (select replace(a.texto, E'\r', '') from agente_textos a order by a.creado desc, a.id desc limit 1),
             E'\n(?=## )') with ordinality as t(p, i)
  ) x
 where x.cuerpo <> ''
   and not exists (select 1 from agente_fuentes f where f.origen = 'lo-que-sabe')
 order by x.i;

/* ═══ El Asistente: charlas y mensajes ═══════════════════════════════════
   Una charla es de una persona en una PC (disp: un número al azar que
   guarda el navegador). Cada fila de mensajes es una pregunta con su
   respuesta. */
create table if not exists asistente_charlas (
  id          uuid primary key default gen_random_uuid(),
  disp        text not null check (disp ~ '^[0-9a-f]{32}$'),
  local       text,
  vendedor    text not null,
  titulo      text,
  creada      timestamptz not null default now(),
  actualizada timestamptz not null default now()
);
create index if not exists asistente_charlas_de on asistente_charlas (disp, lower(btrim(vendedor)), actualizada desc);
alter table asistente_charlas enable row level security;
revoke all on asistente_charlas from anon, authenticated;

create table if not exists asistente_mensajes (
  id         bigserial primary key,
  charla     uuid not null references asistente_charlas (id) on delete cascade,
  pregunta   text not null,
  respuesta  text not null,
  fuentes    jsonb not null default '[]'::jsonb,
  voto       smallint not null default 0 check (voto in (-1, 0, 1)),
  comentario text,
  revisada   boolean not null default false,
  modelo     text,
  tokens     jsonb,
  usd        numeric(10, 5),
  ms         integer,
  creado     timestamptz not null default now()
);
create index if not exists asistente_mensajes_charla on asistente_mensajes (charla, id);
create index if not exists asistente_mensajes_malas on asistente_mensajes (creado desc) where voto = -1;
alter table asistente_mensajes enable row level security;
revoke all on asistente_mensajes from anon, authenticated;

/* ═══ Lo que gasta cada agente en el mes (hora de Argentina) ════════════ */
create table if not exists agente_gasto (
  agente    text not null check (agente in ('clientes', 'vendedores')),
  mes       date not null,
  usd       numeric(12, 5) not null default 0,
  consultas integer not null default 0,
  aviso80   boolean not null default false,
  aviso100  boolean not null default false,
  primary key (agente, mes)
);
alter table agente_gasto enable row level security;
revoke all on agente_gasto from anon, authenticated;

/* Los ajustes nuevos. El Asistente nace apagado: se prende desde el CRM
   cuando tenga sus fuentes. Los dos arrancan con Sonnet 5.5 y un tope de
   USD 20 por mes. */
insert into agente_reglas (clave, valor) values
  ('asis_prendido',  'no'),
  ('asis_saludo',    '¿En qué te ayudo?'),
  ('asis_sugeridas', '[]'),
  ('asis_accesos',   '[]'),
  ('asis_modelo',    'claude-sonnet-5-5'),
  ('asis_tope_usd',  '20'),
  ('modelo',         'claude-sonnet-5-5'),
  ('tope_usd',       '20')
on conflict (clave) do nothing;

/* El mes en curso, con la fecha de acá. */
create or replace function agente_mes()
returns date
language sql
stable
as $$
  select date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires')::date
$$;

/* ═══ Cada regla con su forma (la del SQL 77, más las nuevas) ═══════════ */
create or replace function agente_regla_valida(p_clave text, p_valor text)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v   text := trim(coalesce(p_valor, ''));
  j   jsonb;
  x   jsonb;
  k   text;
  nom text;
  t   text;
  u   text;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  hh  constant text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
begin
  if p_clave in ('prendido', 'cupon_con_sale', 'asis_prendido') then
    if v not in ('si', 'no') then
      return jsonb_build_object('ok', false, 'porque', 'Va "si" o "no".');
    end if;
  elsif p_clave = 'modo' then
    /* Por ahora, sólo "prueba": el automático se habilita en la fase 4,
       cuando el agente haya pasado las pruebas (con su propio SQL). */
    if v <> 'prueba' then
      return jsonb_build_object('ok', false, 'porque', 'Por ahora sólo en prueba: el automático llega en la fase 4.');
    end if;
  elsif p_clave = 'semana' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'El horario no se entendió.');
    end;
    if jsonb_typeof(j) is distinct from 'object' then
      return jsonb_build_object('ok', false, 'porque', 'El horario no se entendió.');
    end if;
    foreach k in array array['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] loop
      nom := case k when 'lun' then 'lunes' when 'mar' then 'martes' when 'mie' then 'miércoles' when 'jue' then 'jueves'
                    when 'vie' then 'viernes' when 'sab' then 'sábado' else 'domingo' end;
      x := j->k;
      if x is null or jsonb_typeof(x) <> 'object' or coalesce(x->>'modo', '') not in ('todo', 'fuera', 'no') then
        return jsonb_build_object('ok', false, 'porque', 'Falta qué hace el agente el ' || nom || '.');
      end if;
      if coalesce(x->>'de', '09:00') !~ hh or coalesce(x->>'a', '17:00') !~ hh then
        return jsonb_build_object('ok', false, 'porque', 'El ' || nom || ': la hora va como 09:00.');
      end if;
      if x->>'modo' = 'fuera' and coalesce(x->>'de', '09:00')::time >= coalesce(x->>'a', '17:00')::time then
        return jsonb_build_object('ok', false, 'porque', 'El ' || nom || ': el equipo tiene que entrar antes de salir.');
      end if;
    end loop;
    v := (select jsonb_object_agg(d, jsonb_build_object('modo', j->d->>'modo',
                                                        'de', coalesce(j->d->>'de', '09:00'),
                                                        'a', coalesce(j->d->>'a', '17:00')))
            from unnest(array['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']) as d)::text;
  elsif p_clave = 'fechas' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'Las fechas no se entendieron.');
    end;
    if jsonb_typeof(j) is distinct from 'array' then
      return jsonb_build_object('ok', false, 'porque', 'Las fechas no se entendieron.');
    end if;
    if jsonb_array_length(j) > 100 then
      return jsonb_build_object('ok', false, 'porque', 'Hasta 100 fechas especiales.');
    end if;
    for x in select * from jsonb_array_elements(j) loop
      if coalesce(x->>'fecha', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(x->>'modo', '') not in ('todo', 'no') then
        return jsonb_build_object('ok', false, 'porque', 'Cada fecha va con "todo el día" o "no atiende".');
      end if;
      begin
        perform (x->>'fecha')::date;
      exception when others then
        return jsonb_build_object('ok', false, 'porque', 'La fecha ' || (x->>'fecha') || ' no existe.');
      end;
      if length(coalesce(x->>'nota', '')) > 60 then
        return jsonb_build_object('ok', false, 'porque', 'La nota de una fecha es muy larga: hasta 60 letras.');
      end if;
    end loop;
    v := coalesce((
      select jsonb_agg(jsonb_build_object('fecha', t.f, 'modo', t.m, 'nota', t.n) order by t.fd)
        from (select distinct on ((z.e->>'fecha')::date)
                     (z.e->>'fecha')::date as fd, to_char((z.e->>'fecha')::date, 'YYYY-MM-DD') as f,
                     z.e->>'modo' as m, nullif(trim(coalesce(z.e->>'nota', '')), '') as n
                from jsonb_array_elements(j) with ordinality as z(e, i)
               order by (z.e->>'fecha')::date, z.i desc) t
       where t.fd >= hoy), '[]'::jsonb)::text;
  elsif p_clave in ('cupon_pct', 'segunda_pct') then
    if v !~ '^[0-9]{1,2}$' or v::int < 1 or v::int > 50 then
      return jsonb_build_object('ok', false, 'porque', 'El porcentaje va de 1 a 50.');
    end if;
  elsif p_clave = 'cupon_horas' then
    if v !~ '^[0-9]{1,3}$' or v::int < 1 or v::int > 168 then
      return jsonb_build_object('ok', false, 'porque', 'El cupón vence entre 1 y 168 horas (una semana).');
    end if;
  elsif p_clave = 'telegram_min' then
    if v !~ '^[0-9]{1,3}$' or v::int < 1 or v::int > 240 then
      return jsonb_build_object('ok', false, 'porque', 'La espera de Telegram va de 1 a 240 minutos.');
    end if;
  elsif p_clave in ('envio_gratis_desde', 'envio_piso') then
    if v !~ '^[0-9]{1,9}$' then
      return jsonb_build_object('ok', false, 'porque', 'Va un monto en pesos, sin puntos.');
    end if;
  elsif p_clave in ('derivar_ventas', 'derivar_posventa', 'derivar_logistica', 'derivar_nocompra', 'derivar_carritos') then
    if v = '' or length(v) > 40 then
      return jsonb_build_object('ok', false, 'porque', 'Falta el nombre (hasta 40 letras).');
    end if;
  /* ── Lo nuevo (SQL 85) ── */
  elsif p_clave in ('modelo', 'asis_modelo') then
    if v not in ('claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5') then
      return jsonb_build_object('ok', false, 'porque', 'Ese modelo no está entre los que se pueden elegir.');
    end if;
  elsif p_clave in ('tope_usd', 'asis_tope_usd') then
    if v !~ '^[0-9]{1,4}$' or v::int < 1 or v::int > 1000 then
      return jsonb_build_object('ok', false, 'porque', 'El tope del mes va de 1 a 1000 dólares.');
    end if;
  elsif p_clave = 'asis_saludo' then
    v := regexp_replace(replace(v, E'\r', ''), '\s+', ' ', 'g');
    if v = '' or length(v) > 120 then
      return jsonb_build_object('ok', false, 'porque', 'El saludo va de 1 a 120 letras.');
    end if;
  elsif p_clave = 'asis_sugeridas' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'Las preguntas sugeridas no se entendieron.');
    end;
    if jsonb_typeof(j) is distinct from 'array' or jsonb_array_length(j) > 6 then
      return jsonb_build_object('ok', false, 'porque', 'Hasta 6 preguntas sugeridas.');
    end if;
    for x in select * from jsonb_array_elements(j) loop
      t := regexp_replace(replace(coalesce(x #>> '{}', ''), E'\r', ''), '\s+', ' ', 'g');
      if jsonb_typeof(x) <> 'string' or btrim(t) = '' or length(btrim(t)) > 120 then
        return jsonb_build_object('ok', false, 'porque', 'Cada pregunta sugerida va de 1 a 120 letras.');
      end if;
    end loop;
    v := coalesce((select jsonb_agg(btrim(regexp_replace(replace(e #>> '{}', E'\r', ''), '\s+', ' ', 'g')) order by i)
                     from jsonb_array_elements(j) with ordinality as z(e, i)), '[]'::jsonb)::text;
  elsif p_clave = 'asis_accesos' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'Los accesos no se entendieron.');
    end;
    if jsonb_typeof(j) is distinct from 'array' or jsonb_array_length(j) > 6 then
      return jsonb_build_object('ok', false, 'porque', 'Hasta 6 accesos rápidos.');
    end if;
    for x in select * from jsonb_array_elements(j) loop
      t := btrim(coalesce(x->>'titulo', ''));
      u := btrim(coalesce(x->>'url', ''));
      if jsonb_typeof(x) <> 'object' or t = '' or length(t) > 40 then
        return jsonb_build_object('ok', false, 'porque', 'Cada acceso lleva un nombre de 1 a 40 letras.');
      end if;
      if u !~* '^https://[^\s<>"]+$' or length(u) > 500 then
        return jsonb_build_object('ok', false, 'porque', 'El enlace de "' || t || '" tiene que empezar con https://');
      end if;
      if length(coalesce(x->>'nota', '')) > 60 then
        return jsonb_build_object('ok', false, 'porque', 'La nota de "' || t || '" es muy larga: hasta 60 letras.');
      end if;
    end loop;
    v := coalesce((select jsonb_agg(jsonb_build_object('titulo', btrim(e->>'titulo'), 'url', btrim(e->>'url'),
                                                       'nota', nullif(btrim(coalesce(e->>'nota', '')), '')) order by i)
                     from jsonb_array_elements(j) with ordinality as z(e, i)), '[]'::jsonb)::text;
  else
    return jsonb_build_object('ok', false, 'porque', 'Esa regla no existe.');
  end if;
  return jsonb_build_object('ok', true, 'valor', v);
end;
$$;
revoke execute on function agente_regla_valida(text, text) from public, anon, authenticated;

/* ═══ Lo que necesita el agente de CLIENTES ══════════════════════════════
   Igual que en el SQL 78, salvo lo que sabe: ahora sale de las fuentes
   "para clientes" prendidas. Lo "interno" NO entra nunca acá. */
create or replace function agente_contexto(p_clave text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'clave', k.clave,
    'reglas', coalesce((select jsonb_object_agg(r.clave, r.valor) from agente_reglas r where r.clave not like 'asis\_%'), '{}'::jsonb),
    'conocimiento', (select string_agg('## ' || f.titulo || E'\n' || f.contenido, E'\n\n' order by f.id)
                       from agente_fuentes f
                      where f.publico = 'clientes' and f.prendida and f.borrada is null),
    'fuentes', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'tipo', f.tipo, 'titulo', f.titulo, 'tema', f.tema,
                                                             'contenido', f.contenido) order by f.id)
                           from agente_fuentes f
                          where f.publico = 'clientes' and f.prendida and f.borrada is null), '[]'::jsonb),
    'catalogo', agente_catalogo(),
    'ahora', agente_atiende(now()),
    'hoy', (array['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'])[extract(dow from now() at time zone 'America/Argentina/Buenos_Aires')::int + 1] || ' ' ||
            to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'),
    'nombre', coalesce(wa_agenda_nombre(k.clave),
                       (select nullif(trim(m.perfil), '') from wa_mensajes m
                         where club_tel10(m.tel) = k.clave and nullif(trim(m.perfil), '') is not null
                         order by m.cuando desc limit 1)),
    'ultimo_id', (select max(m.id) from wa_mensajes m where club_tel10(m.tel) = k.clave),
    'ultimo_entra_id', (select max(m.id) from wa_mensajes m where club_tel10(m.tel) = k.clave and m.sentido = 'entra'),
    'numero_id', (select m.numero_id from wa_mensajes m where club_tel10(m.tel) = k.clave order by m.cuando desc, m.id desc limit 1),
    'mensajes', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'de', case when w.sentido = 'entra' then 'cliente' else 'vdh' end,
                                          'tipo', w.tipo, 'texto', w.texto,
                                          'cuando', to_char(w.cuando at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI'))
                       order by w.cuando, w.id)
        from (select * from wa_mensajes m where club_tel10(m.tel) = k.clave and m.tipo is distinct from 'reaction'
               order by m.cuando desc, m.id desc limit 30) w), '[]'::jsonb))
  from (select club_tel10(p_clave) as clave) k
  where k.clave is not null
$$;
revoke execute on function agente_contexto(text) from public, anon, authenticated;
grant execute on function agente_contexto(text) to service_role;

/* "Lo que sabe" ya no se guarda entero: se edita por partes en
   Conocimiento. La pantalla vieja recibe el porqué. */
create or replace function agente_texto_guardar(p_pin text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return jsonb_build_object('ok', false,
    'porque', 'Lo que sabe ahora se edita por partes, en Agentes de IA → Conocimiento.');
end;
$$;
revoke execute on function agente_texto_guardar(text, text) from public;
grant execute on function agente_texto_guardar(text, text) to anon, authenticated;

/* ═══ El CRM: la configuración de los dos agentes, en un viaje ══════════ */
create or replace function agente_config(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'reglas', coalesce((select jsonb_object_agg(r.clave, r.valor) from agente_reglas r), '{}'::jsonb),
    'numero', (select n.nombre from wa_numeros n
                where n.numero_id = (select r.valor from agente_reglas r where r.clave = 'numero_id')),
    'conocimiento', (select jsonb_build_object('texto', t.texto,
                              'actualizado', to_char(t.creado at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD'))
                       from agente_textos t order by t.creado desc, t.id desc limit 1),
    'versiones', (select count(*) from agente_textos),
    'ahora', agente_atiende(now()),
    'gasto', coalesce((select jsonb_object_agg(g.agente, jsonb_build_object('usd', round(g.usd, 2), 'consultas', g.consultas))
                         from agente_gasto g where g.mes = agente_mes()), '{}'::jsonb),
    'fuentes', (select jsonb_build_object(
                  'n', count(*),
                  'prendidas', count(*) filter (where f.prendida),
                  'bytes', coalesce(sum(octet_length(f.contenido)) filter (where f.prendida), 0),
                  'bytes_clientes', coalesce(sum(octet_length(f.contenido)) filter (where f.prendida and f.publico = 'clientes'), 0),
                  'avisos', count(*) filter (where f.aviso is not null))
                  from agente_fuentes f where f.borrada is null),
    'marcadas', (select count(*) from asistente_mensajes m where m.voto = -1 and not m.revisada));
end;
$$;
revoke execute on function agente_config(text) from public;
grant execute on function agente_config(text) to anon, authenticated;

/* ═══ Las fuentes, desde el CRM (con el PIN) ═════════════════════════════
   Sin tirar un error con el PIN malo: así el intento queda anotado (el
   modelo del SQL 84). */
create or replace function agente_pin_mal(r jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('error', 'pin', 'porque', coalesce(r->>'porque', 'PIN incorrecto.'),
                            'espera', coalesce((r->>'espera')::integer, 0), 'mal', r ? 'restantes')
$$;

create or replace function agente_fuentes_ver(p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r jsonb := pin_ok(p_pin);
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  return jsonb_build_object('fuentes', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', f.id, 'tipo', f.tipo, 'titulo', f.titulo, 'archivo', f.archivo, 'publico', f.publico, 'tema', f.tema,
             'prendida', f.prendida, 'origen', f.origen, 'aviso', f.aviso, 'bytes', octet_length(f.contenido),
             'inicio', left(regexp_replace(f.contenido, '\s+', ' ', 'g'), 160),
             'creada', f.creada, 'actualizada', f.actualizada, 'quien', f.quien) order by f.actualizada desc, f.id desc)
      from agente_fuentes f where f.borrada is null), '[]'::jsonb));
end;
$$;
revoke execute on function agente_fuentes_ver(text) from public;
grant execute on function agente_fuentes_ver(text) to anon, authenticated;

create or replace function agente_fuente_ver(p_pin text, p_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r jsonb := pin_ok(p_pin);
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  return (select jsonb_build_object('id', f.id, 'tipo', f.tipo, 'titulo', f.titulo, 'contenido', f.contenido, 'archivo', f.archivo,
                                    'publico', f.publico, 'tema', f.tema, 'prendida', f.prendida, 'origen', f.origen, 'aviso', f.aviso,
                                    'creada', f.creada, 'actualizada', f.actualizada, 'quien', f.quien)
            from agente_fuentes f where f.id = p_id and f.borrada is null);
end;
$$;
revoke execute on function agente_fuente_ver(text, bigint) from public;
grant execute on function agente_fuente_ver(text, bigint) to anon, authenticated;

/* Nueva (sin id) o cambiar una (con id: sólo lo que venga). */
create or replace function agente_fuente_guardar(p_pin text, p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r      jsonb := pin_ok(p_pin);
  f      agente_fuentes%rowtype;
  nuevo  boolean := (p->>'id') is null;
  total  bigint;
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    return jsonb_build_object('ok', false, 'porque', 'No hay nada para guardar.');
  end if;
  if nuevo then
    f.tipo := coalesce(p->>'tipo', 'texto');
    f.publico := coalesce(p->>'publico', 'interno');
    f.prendida := coalesce((p->>'prendida')::boolean, true);
    f.origen := coalesce(nullif(p->>'origen', ''), 'crm');
  else
    select * into f from agente_fuentes x where x.id = (p->>'id')::bigint and x.borrada is null for update;
    if not found then return jsonb_build_object('ok', false, 'porque', 'Esa fuente ya no está.'); end if;
    if p ? 'publico' then f.publico := p->>'publico'; end if;
    if p ? 'prendida' then f.prendida := (p->>'prendida')::boolean; end if;
  end if;
  if p ? 'titulo' or nuevo then f.titulo := btrim(regexp_replace(replace(coalesce(p->>'titulo', ''), E'\r', ''), '\s+', ' ', 'g')); end if;
  if p ? 'contenido' or nuevo then f.contenido := btrim(replace(coalesce(p->>'contenido', ''), E'\r', ''), E' \n\t'); end if;
  if p ? 'tema' or nuevo then f.tema := nullif(btrim(coalesce(p->>'tema', '')), ''); end if;
  if p ? 'archivo' or nuevo then f.archivo := nullif(btrim(coalesce(p->>'archivo', '')), ''); end if;
  if p ? 'aviso' then f.aviso := nullif(btrim(coalesce(p->>'aviso', '')), ''); end if;
  if f.tipo not in ('archivo', 'texto', 'pregunta') then return jsonb_build_object('ok', false, 'porque', 'Tipo desconocido.'); end if;
  if f.publico not in ('clientes', 'interno') then return jsonb_build_object('ok', false, 'porque', 'El público va "clientes" o "interno".'); end if;
  if f.titulo = '' or length(f.titulo) > 200 then
    return jsonb_build_object('ok', false, 'porque', case when f.tipo = 'pregunta' then 'La pregunta va de 1 a 200 letras.' else 'El título va de 1 a 200 letras.' end);
  end if;
  if f.contenido = '' then
    return jsonb_build_object('ok', false, 'porque', case when f.tipo = 'pregunta' then 'Falta la respuesta.' else 'La fuente quedó vacía.' end);
  end if;
  if octet_length(f.contenido) > 400000 then
    return jsonb_build_object('ok', false, 'porque', 'Es muy grande: hasta 400 KB por fuente. Partila en dos.');
  end if;
  if length(coalesce(f.tema, '')) > 40 then return jsonb_build_object('ok', false, 'porque', 'El tema va hasta 40 letras.'); end if;
  /* Entre todas las prendidas, hasta 1,5 MB: es lo que se le manda al
     modelo en cada pregunta. */
  select coalesce(sum(octet_length(x.contenido)), 0) into total
    from agente_fuentes x where x.prendida and x.borrada is null and x.id is distinct from f.id;
  if f.prendida and total + octet_length(f.contenido) > 1500000 then
    return jsonb_build_object('ok', false, 'porque', 'Entre todas las fuentes prendidas pasan de 1,5 MB: apagá o borrá alguna antes.');
  end if;
  f.quien := left(nullif(btrim(coalesce(p->>'quien', '')), ''), 60);
  if nuevo then
    insert into agente_fuentes (tipo, titulo, contenido, archivo, publico, tema, prendida, origen, aviso, quien)
    values (f.tipo, f.titulo, f.contenido, f.archivo, f.publico, f.tema, f.prendida, f.origen, f.aviso, f.quien)
    returning id into f.id;
  else
    update agente_fuentes set titulo = f.titulo, contenido = f.contenido, archivo = f.archivo, publico = f.publico, tema = f.tema,
                              prendida = f.prendida, aviso = f.aviso, quien = coalesce(f.quien, quien), actualizada = now()
     where id = f.id;
  end if;
  return jsonb_build_object('ok', true, 'id', f.id);
end;
$$;
revoke execute on function agente_fuente_guardar(text, jsonb) from public;
grant execute on function agente_fuente_guardar(text, jsonb) to anon, authenticated;

create or replace function agente_fuente_borrar(p_pin text, p_id bigint, p_quien text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r jsonb := pin_ok(p_pin);
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  update agente_fuentes set borrada = now(), quien = coalesce(left(nullif(btrim(coalesce(p_quien, '')), ''), 60), quien)
   where id = p_id and borrada is null;
  return jsonb_build_object('ok', found);
end;
$$;
revoke execute on function agente_fuente_borrar(text, bigint, text) from public;
grant execute on function agente_fuente_borrar(text, bigint, text) to anon, authenticated;

/* ═══ El Asistente, libre (sin PIN) ══════════════════════════════════════ */
create or replace function asistente_portada()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'prendido', coalesce((select r.valor from agente_reglas r where r.clave = 'asis_prendido'), 'no') = 'si',
    'saludo', (select r.valor from agente_reglas r where r.clave = 'asis_saludo'),
    'sugeridas', coalesce((select r.valor::jsonb from agente_reglas r where r.clave = 'asis_sugeridas'), '[]'::jsonb),
    'accesos', coalesce((select r.valor::jsonb from agente_reglas r where r.clave = 'asis_accesos'), '[]'::jsonb))
$$;
revoke execute on function asistente_portada() from public;
grant execute on function asistente_portada() to anon, authenticated;

/* Las charlas de esa persona en esa PC. Sin la PC (un número al azar que
   sólo tiene ese navegador) no se ve nada. */
create or replace function asistente_charlas(p_disp text, p_local text, p_vendedor text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'titulo', c.titulo, 'cuando', c.actualizada) order by c.actualizada desc), '[]'::jsonb)
    from (select * from asistente_charlas c
           where coalesce(p_disp, '') ~ '^[0-9a-f]{32}$'
             and c.disp = p_disp
             and lower(btrim(c.vendedor)) = lower(btrim(coalesce(p_vendedor, '')))
           order by c.actualizada desc
           limit 30) c
$$;
revoke execute on function asistente_charlas(text, text, text) from public;
grant execute on function asistente_charlas(text, text, text) to anon, authenticated;

create or replace function asistente_charla(p_disp text, p_vendedor text, p_charla uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(e order by z.id, z.o), '[]'::jsonb)
    from (select m.id, 0 as o, jsonb_build_object('rol', 'vendedor', 'texto', m.pregunta) as e
            from asistente_mensajes m join asistente_charlas c on c.id = m.charla
           where c.id = p_charla and c.disp = p_disp and coalesce(p_disp, '') ~ '^[0-9a-f]{32}$'
             and lower(btrim(c.vendedor)) = lower(btrim(coalesce(p_vendedor, '')))
          union all
          select m.id, 1, jsonb_build_object('rol', 'asistente', 'id', m.id, 'texto', m.respuesta, 'fuentes', m.fuentes, 'voto', m.voto)
            from asistente_mensajes m join asistente_charlas c on c.id = m.charla
           where c.id = p_charla and c.disp = p_disp and coalesce(p_disp, '') ~ '^[0-9a-f]{32}$'
             and lower(btrim(c.vendedor)) = lower(btrim(coalesce(p_vendedor, '')))) z
$$;
revoke execute on function asistente_charla(text, text, uuid) from public;
grant execute on function asistente_charla(text, text, uuid) to anon, authenticated;

/* El pulgar (1, -1 o 0) y lo que estuvo mal: sólo desde la PC de la charla. */
create or replace function asistente_votar(p_disp text, p_id bigint, p_voto integer, p_comentario text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if coalesce(p_voto, 9) not in (-1, 0, 1) then return jsonb_build_object('ok', false); end if;
  update asistente_mensajes m
     set voto = p_voto,
         comentario = case when p_voto = -1 then coalesce(left(nullif(btrim(coalesce(p_comentario, '')), ''), 600), m.comentario) else null end,
         revisada = case when p_voto = -1 then false else m.revisada end
    from asistente_charlas c
   where m.id = p_id and c.id = m.charla and c.disp = p_disp and coalesce(p_disp, '') ~ '^[0-9a-f]{32}$';
  return jsonb_build_object('ok', found);
end;
$$;
revoke execute on function asistente_votar(text, bigint, integer, text) from public;
grant execute on function asistente_votar(text, bigint, integer, text) to anon, authenticated;

/* ═══ Para la Edge Function "asistente" (sólo con la llave de servicio) ═══
   Todo lo que necesita para contestar: los ajustes, TODAS las fuentes
   prendidas (el Asistente es interno: ve también lo "interno"), las
   últimas preguntas de la charla, el gasto del mes y si hay que frenar
   (más de 20 preguntas en 10 minutos desde una PC, o 300 en una hora
   entre todos). */
create or replace function asistente_contexto(p_disp text, p_vendedor text, p_charla uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'reglas', coalesce((select jsonb_object_agg(r.clave, r.valor) from agente_reglas r where r.clave like 'asis\_%'), '{}'::jsonb),
    'fuentes', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'tipo', f.tipo, 'titulo', f.titulo, 'tema', f.tema,
                                                             'publico', f.publico, 'contenido', f.contenido) order by f.id)
                           from agente_fuentes f where f.prendida and f.borrada is null), '[]'::jsonb),
    'historial', coalesce((select jsonb_agg(jsonb_build_object('pregunta', h.pregunta, 'respuesta', h.respuesta) order by h.id)
                             from (select m.id, m.pregunta, m.respuesta
                                     from asistente_mensajes m join asistente_charlas c on c.id = m.charla
                                    where p_charla is not null and c.id = p_charla and c.disp = p_disp
                                      and lower(btrim(c.vendedor)) = lower(btrim(coalesce(p_vendedor, '')))
                                    order by m.id desc limit 6) h), '[]'::jsonb),
    'charla_valida', p_charla is null or exists (select 1 from asistente_charlas c where c.id = p_charla and c.disp = p_disp
                                                   and lower(btrim(c.vendedor)) = lower(btrim(coalesce(p_vendedor, '')))),
    'gasto', jsonb_build_object(
      'usd', coalesce((select g.usd from agente_gasto g where g.agente = 'vendedores' and g.mes = agente_mes()), 0),
      'tope', coalesce((select r.valor from agente_reglas r where r.clave = 'asis_tope_usd'), '20')::numeric),
    'frenado', (select count(*) from asistente_mensajes m join asistente_charlas c on c.id = m.charla
                 where c.disp = p_disp and m.creado > now() - interval '10 minutes') >= 20
               or (select count(*) from asistente_mensajes m where m.creado > now() - interval '1 hour') >= 300,
    'hoy', to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'))
$$;
revoke execute on function asistente_contexto(text, text, uuid) from public, anon, authenticated;
grant execute on function asistente_contexto(text, text, uuid) to service_role;

/* Guarda la pregunta con su respuesta (y crea la charla si es nueva). */
create or replace function asistente_guardar(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ch    uuid := nullif(p->>'charla', '')::uuid;
  v_disp  text := coalesce(p->>'disp', '');
  v_vend  text := left(btrim(coalesce(p->>'vendedor', '')), 40);
  v_nuevo bigint;
begin
  if v_disp !~ '^[0-9a-f]{32}$' or v_vend = '' then
    return jsonb_build_object('ok', false, 'porque', 'Falta quién pregunta.');
  end if;
  if v_ch is not null and not exists (select 1 from asistente_charlas c where c.id = v_ch and c.disp = v_disp
                                       and lower(btrim(c.vendedor)) = lower(v_vend)) then
    v_ch := null;
  end if;
  if v_ch is null then
    insert into asistente_charlas (disp, local, vendedor, titulo)
    values (v_disp, left(nullif(btrim(coalesce(p->>'local', '')), ''), 40), v_vend,
            left(btrim(regexp_replace(coalesce(p->>'pregunta', ''), '\s+', ' ', 'g')), 80))
    returning id into v_ch;
  else
    update asistente_charlas set actualizada = now() where id = v_ch;
  end if;
  insert into asistente_mensajes (charla, pregunta, respuesta, fuentes, modelo, tokens, usd, ms)
  values (v_ch, left(coalesce(p->>'pregunta', ''), 2000), left(coalesce(p->>'respuesta', ''), 20000),
          coalesce(p->'fuentes', '[]'::jsonb), p->>'modelo', p->'tokens', nullif(p->>'usd', '')::numeric, nullif(p->>'ms', '')::integer)
  returning id into v_nuevo;
  return jsonb_build_object('ok', true, 'charla', v_ch, 'id', v_nuevo);
end;
$$;
revoke execute on function asistente_guardar(jsonb) from public, anon, authenticated;
grant execute on function asistente_guardar(jsonb) to service_role;

/* El aviso al grupo de Telegram (el mismo de los No Compra). Si falla, no
   corta nada: devuelve false. */
create or replace function agente_aviso_telegram(p_texto text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  token     text := secreto('TELEGRAM_TOKEN');
  chat      text := secreto('TELEGRAM_CHAT');
  respuesta extensions.http_response;
begin
  if token is null or chat is null then return false; end if;
  respuesta := extensions.http_post('https://api.telegram.org/bot' || token || '/sendMessage',
    jsonb_build_object('chat_id', chat, 'text', p_texto, 'disable_web_page_preview', true)::text, 'application/json');
  return respuesta.status < 300;
exception when others then
  return false;
end;
$$;
revoke execute on function agente_aviso_telegram(text) from public, anon, authenticated;

/* Suma lo que costó una respuesta. Al pasar el 80 % y el 100 % del tope,
   avisa una sola vez en el mes. */
create or replace function agente_gasto_sumar(p_agente text, p_usd numeric)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  g    agente_gasto%rowtype;
  tope numeric;
  nom  text := case when p_agente = 'vendedores' then 'el Asistente de los vendedores' else 'el agente de clientes' end;
begin
  if p_agente not in ('clientes', 'vendedores') then return jsonb_build_object('ok', false); end if;
  insert into agente_gasto as x (agente, mes, usd, consultas)
  values (p_agente, agente_mes(), greatest(coalesce(p_usd, 0), 0), 1)
  on conflict (agente, mes) do update set usd = x.usd + excluded.usd, consultas = x.consultas + 1
  returning * into g;
  tope := coalesce((select r.valor from agente_reglas r where r.clave = case when p_agente = 'vendedores' then 'asis_tope_usd' else 'tope_usd' end), '20')::numeric;
  if g.usd >= tope and not g.aviso100 then
    update agente_gasto set aviso100 = true, aviso80 = true where agente = g.agente and mes = g.mes;
    perform agente_aviso_telegram('⛔ ' || initcap(left(nom, 1)) || substr(nom, 2) || ' llegó al tope de gasto del mes (USD ' || tope ||
      '): dejó de contestar hasta el mes que viene. Se puede subir el tope en el CRM → Agentes de IA → Ajustes.');
  elsif g.usd >= tope * 0.8 and not g.aviso80 then
    update agente_gasto set aviso80 = true where agente = g.agente and mes = g.mes;
    perform agente_aviso_telegram('⚠️ ' || initcap(left(nom, 1)) || substr(nom, 2) || ' ya gastó USD ' || round(g.usd, 2) || ' de los ' || tope ||
      ' del mes (el 80 %). Al llegar al tope deja de contestar.');
  end if;
  return jsonb_build_object('ok', true, 'usd', round(g.usd, 4), 'tope', tope);
end;
$$;
revoke execute on function agente_gasto_sumar(text, numeric) from public, anon, authenticated;
grant execute on function agente_gasto_sumar(text, numeric) to service_role;

/* ═══ Las respuestas marcadas con el pulgar para abajo (CRM, con el PIN) ═══ */
create or replace function asistente_marcadas(p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r jsonb := pin_ok(p_pin);
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  return jsonb_build_object('marcadas', coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'pregunta', m.pregunta, 'respuesta', m.respuesta, 'comentario', m.comentario,
                                        'fuentes', m.fuentes, 'revisada', m.revisada, 'creado', m.creado,
                                        'local', c.local, 'vendedor', c.vendedor) order by m.revisada, m.creado desc)
      from (select * from asistente_mensajes x where x.voto = -1 order by x.creado desc limit 200) m
      join asistente_charlas c on c.id = m.charla), '[]'::jsonb));
end;
$$;
revoke execute on function asistente_marcadas(text) from public;
grant execute on function asistente_marcadas(text) to anon, authenticated;

create or replace function asistente_marcada_revisar(p_pin text, p_id bigint, p_si boolean default true)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r jsonb := pin_ok(p_pin);
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  update asistente_mensajes set revisada = coalesce(p_si, true) where id = p_id and voto = -1;
  return jsonb_build_object('ok', found);
end;
$$;
revoke execute on function asistente_marcada_revisar(text, bigint, boolean) from public;
grant execute on function asistente_marcada_revisar(text, bigint, boolean) to anon, authenticated;

/* La función "asistente" también usa el PIN (el chat de prueba del CRM). */
grant execute on function pin_ok(text) to service_role;

select 'listo: las fuentes y el Asistente de los vendedores' as "SQL 85";


-- ─────────────────────────── PARTE 87 (12/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · AGENTES DE IA, ETAPA C: INSTRUCCIONES, BARANDILLAS, PRUEBAS Y
-- CONEXIONES
--
-- Correr en el editor SQL de Supabase (después del 86).
--
--   · agente_instrucciones: lo que se le dice a cada agente, por partes,
--     con todas las versiones (la vigente es la última; volver a una vieja
--     es guardarla de nuevo). Arranca con el texto que hoy está fijo en
--     cada función, así nada cambia hasta que alguien lo edite.
--   · Las barandillas de cada agente (agente_reglas "barandillas" y
--     "asis_barandillas"): los temas en los que no entra y lo que siempre
--     pasa a una persona (o al supervisor). Lo de no inventar nunca un dato
--     está fijo en el código: no se puede sacar.
--   · agente_pruebas: casos guardados (la charla y qué tiene que pasar) con
--     el resultado de la última corrida. Arranca con las 30 del agente de
--     clientes (las de la fase 2) y 7 del Asistente.
--   · agente_conexiones: si están la tienda, Telegram y WhatsApp (para la
--     página Conexiones; Claude lo mira la función).
--   · Los dos contextos (agente_contexto y asistente_contexto) suman las
--     instrucciones, las barandillas y el gasto del mes.
--
-- Reversible: crea tablas y funciones nuevas; agente_contexto,
-- asistente_contexto y agente_regla_valida vuelven a la del SQL 85 si se
-- corren esas partes de nuevo.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists agente_instrucciones (
  id     bigserial primary key,
  agente text not null check (agente in ('clientes', 'vendedores')),
  seccion text not null,
  texto  text not null,
  quien  text,
  creado timestamptz not null default now()
);
create index if not exists agente_instrucciones_ult on agente_instrucciones (agente, seccion, creado desc, id desc);
alter table agente_instrucciones enable row level security;
revoke all on agente_instrucciones from anon, authenticated;

/* Las partes de cada agente, en el orden en que se le dicen. */
create or replace function agente_secciones(p_agente text)
returns text[]
language sql
immutable
as $$
  select case p_agente
    when 'clientes' then array['quien', 'habla', 'datos', 'stock', 'vende', 'pedidos', 'deriva', 'final']
    when 'vendedores' then array['quien', 'como', 'limites']
  end
$$;

insert into agente_instrucciones (agente, seccion, texto, quien)
select x.agente, x.seccion, x.texto, 'Arranque (SQL 87)'
  from (values
    ('clientes', 'quien', $c0$Sos el asistente virtual de VDH, marca de indumentaria masculina urbana hecha en Argentina. Atendés el WhatsApp de la tienda online (vdh.com.ar). Tu trabajo es atender y vender como el mejor vendedor de un local VDH: natural, rápido, sin sonar a robot.$c0$, 0),
    ('clientes', 'habla', $c1$Cómo hablás:
- Español argentino con voseo, directo, auténtico y cercano. Mensajes cortos, como un vendedor por WhatsApp. Nada de listas largas ni títulos. En WhatsApp la negrita va con un asterisco de cada lado (*así*); usala poco. Emojis, como mucho uno.
- Si te preguntan si sos una persona, decí la verdad: sos el asistente virtual de VDH.$c1$, 1),
    ('clientes', 'datos', $c2$De dónde sacás los datos (nunca de memoria, nunca inventes):
1. El catálogo de abajo y la herramienta ver_producto: precios, talles, colores, stock, link. El precio del catálogo YA ES el que se paga (con el SALE aplicado); cotizá siempre ese. Con transferencia sale un 10% menos (ver_producto te da el número). Cuotas: 3 sin interés siempre; 6 sin interés superando los $150.000.
2. buscar_en_fabrica: lo que no está en la tienda pero sí en la fábrica.
3. Lo que sabés (la base de conocimiento de abajo): envíos, pagos, cambios, talles, telas, locales y políticas.
Si un dato no está en ninguna de esas fuentes (una medida, un plazo, una promo, un stock de un local), decí que no lo tenés y derivá. Nunca inventes.$c2$, 2),
    ('clientes', 'stock', $c3$Stock:
- Antes de confirmar un talle o un color, mirá ver_producto. Si queda 1 o 2, podés decir que quedan pocos; si no, no inventes urgencias.
- El stock online es uno solo: no prometas stock en un local. Indicá el local más cercano y derivá con area "fabrica" para que lo confirmen.
- Si no hay en la tienda pero sí en la fábrica: decile que se lo podemos conseguir pero que antes lo confirma una persona de atención; pedile lo que falte (talle, color, nombre, zona y si prefiere retiro o envío), avisale que en breve se comunican y derivá con area "fabrica". No prometas fechas ni reserves.
- Si no hay en ningún lado, ofrecé algo parecido que sí tenga stock.$c3$, 3),
    ('clientes', 'vende', $c4$Modo vendedor:
- No sos un buscador: sos un vendedor. Contestá lo que pregunta y proponé. Cuando hables de un producto, pasá el precio, los talles que hay y el link directo de la ficha (el link muestra la foto en WhatsApp).
- Los links de productos salen SÓLO de ver_producto: antes de mandar el link de un producto, consultalo. Nunca armes un link a mano.
- Si tiene sentido, sumá una o dos prendas que combinen, con stock en su talle, cada una con precio y link. Elegí vos: nunca mandes el catálogo entero.
- Si hay intención de compra, llevalo al link del producto o al local más cercano.
- El catálogo no trae la tela de cada producto. Si el cliente pide una tela (jean, gabardina, lino) y el nombre del producto no la dice, no la afirmes: ofrecelo como "pantalón" (o lo que sea) y aclarále que la tela se la confirma una persona, o mandale el link para que la vea en la ficha.
- Promos: hoy sólo conocés el SALE que ya trae el precio del catálogo. No ofrezcas cupones, descuentos extra, envío gratis especial ni excepciones. Si pide algo de eso, decile que lo consultás y derivá con area "excepcion".$c4$, 4),
    ('clientes', 'pedidos', $c5$Pedidos ya hechos:
- Para hablar de un pedido pedí el número de pedido y el mail de la compra, y usá consultar_pedido con los dos. No pidas nunca datos de tarjetas ni contraseñas.
- Demoras, seguimiento, producto equivocado o fallado: tomá los datos y derivá con area "logistica".$c5$, 5),
    ('clientes', 'deriva', $c6$Derivá a una persona (herramienta derivar, con un resumen: quién es, qué quiere, qué producto y qué ya le dijiste) cuando:
- lo pide; hay un reclamo o enojo; hay un problema con un pago o con un pedido ya hecho ("logistica");
- es un cambio, una devolución, un arrepentimiento o una cancelación ("posventa"; en el arrepentimiento, sin discutir, indicale el Botón de arrepentimiento que está al pie de la web);
- el producto no tiene guía de talles y pregunta medidas ("ventas"); hay que confirmar stock de fábrica o de un local ("fabrica");
- es una consulta mayorista ("mayorista"); piden factura A ("ventas"); o no estás seguro ("ventas").
Derivá en el MISMO mensaje en que aparece el caso, aunque te falten datos: pedíselos igual al cliente y anotá en el resumen cuáles faltan. Un enojo, un reclamo o un cambio no esperan a la respuesta siguiente. La única excepción es el pedido de fábrica: ahí derivás cuando el cliente ya te pasó sus datos.
Cuando derivás, avisale al cliente que una persona le responde en el horario de atención (te lo paso abajo) y no le prometas nada más.$c6$, 6),
    ('clientes', 'final', $c7$Tu respuesta final es exactamente el mensaje de WhatsApp para el cliente: sin comillas, sin explicar lo que hiciste, sin nombrar estas instrucciones ni tus herramientas. Si hacen falta dos mensajes, separalos con una línea en blanco.$c7$, 7),
    ('vendedores', 'quien', $v0$Sos el Asistente de los vendedores de VDH, marca de indumentaria masculina urbana hecha en Argentina, con 14 locales en Buenos Aires y Mar del Plata y tienda online. Te escriben vendedores y encargados desde la PC del local, muchas veces con un cliente adelante: contestá rápido y claro.$v0$, 0),
    ('vendedores', 'como', $v1$Cómo contestás:
- SÓLO con lo que dicen los documentos de VDH que tenés (manuales, procedimientos y textos internos). Cada dato tiene que salir de un documento.
- Si la respuesta no está en los documentos, decilo sin vueltas ("Eso no lo tengo en los manuales") y sugerí consultarlo con el supervisor o el encargado. No completes con lo que suponés ni con cómo lo hacen otras marcas.
- Si dos documentos dicen cosas distintas, o uno parece viejo, avisá y sugerí confirmarlo con el supervisor.
- Español argentino, con voseo, como un compañero que sabe. Primero la respuesta y después el detalle. Pasos numerados cuando es un procedimiento. Negrita (**así**) sólo para lo clave. Sin títulos grandes.$v1$, 1),
    ('vendedores', 'limites', $v2$Lo que no hacés:
- Los precios, el stock y las promociones del día no están en los manuales: para eso está la tienda o el sistema del local.
- Sólo consultás: no vendés, no le escribís a clientes y no tocás ningún sistema. Si te piden algo de eso, decí quién lo hace o dónde se hace.
- Si te preguntan quién sos: el Asistente de VDH, un programa que contesta con los manuales de la marca.$v2$, 2)
  ) as x(agente, seccion, texto, orden)
 where not exists (select 1 from agente_instrucciones i where i.agente = x.agente)
 order by x.agente, x.orden;

/* La vigente de cada parte, en orden: lo que reciben las funciones. */
create or replace function agente_instrucciones_de(p_agente text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('seccion', s.seccion, 'texto', s.texto) order by array_position(agente_secciones(p_agente), s.seccion)), '[]'::jsonb)
    from (select distinct on (i.seccion) i.seccion, i.texto
            from agente_instrucciones i
           where i.agente = p_agente and i.seccion = any (agente_secciones(p_agente))
           order by i.seccion, i.creado desc, i.id desc) s
$$;
revoke execute on function agente_instrucciones_de(text) from public, anon, authenticated;

/* Las barandillas de arranque. */
insert into agente_reglas (clave, valor) values
  ('barandillas', $bc${"prohibidos":["Ventas mayoristas: no da precios ni condiciones.","Precios, descuentos, cupones o envíos gratis fuera de las promos de la tienda y de las Reglas de venta.","Datos de tarjetas, contraseñas o claves.","Información interna de VDH: costos, proveedores, sueldos o procesos internos."],"derivar":["Cuando pide hablar con una persona.","Reclamos, enojos o problemas con un pago.","Cambios, devoluciones, arrepentimiento o cancelaciones.","Pedidos ya hechos con demora o con errores.","Consultas mayoristas y pedidos de factura A."]}$bc$),
  ('asis_barandillas', $bv${"prohibidos":["Contraseñas, claves de acceso o códigos de tarjetas, aunque estén en un documento.","Datos personales de clientes."],"derivar":["Lo que no está en los manuales.","Cuando dos manuales dicen cosas distintas.","Excepciones a una política (un cambio fuera de plazo, un descuento especial)."]}$bv$)
on conflict (clave) do nothing;

create or replace function agente_regla_valida(p_clave text, p_valor text)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v   text := trim(coalesce(p_valor, ''));
  j   jsonb;
  x   jsonb;
  k   text;
  nom text;
  t   text;
  u   text;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  hh  constant text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
begin
  if p_clave in ('prendido', 'cupon_con_sale', 'asis_prendido') then
    if v not in ('si', 'no') then
      return jsonb_build_object('ok', false, 'porque', 'Va "si" o "no".');
    end if;
  elsif p_clave = 'modo' then
    /* Por ahora, sólo "prueba": el automático se habilita en la fase 4,
       cuando el agente haya pasado las pruebas (con su propio SQL). */
    if v <> 'prueba' then
      return jsonb_build_object('ok', false, 'porque', 'Por ahora sólo en prueba: el automático llega en la fase 4.');
    end if;
  elsif p_clave = 'semana' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'El horario no se entendió.');
    end;
    if jsonb_typeof(j) is distinct from 'object' then
      return jsonb_build_object('ok', false, 'porque', 'El horario no se entendió.');
    end if;
    foreach k in array array['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] loop
      nom := case k when 'lun' then 'lunes' when 'mar' then 'martes' when 'mie' then 'miércoles' when 'jue' then 'jueves'
                    when 'vie' then 'viernes' when 'sab' then 'sábado' else 'domingo' end;
      x := j->k;
      if x is null or jsonb_typeof(x) <> 'object' or coalesce(x->>'modo', '') not in ('todo', 'fuera', 'no') then
        return jsonb_build_object('ok', false, 'porque', 'Falta qué hace el agente el ' || nom || '.');
      end if;
      if coalesce(x->>'de', '09:00') !~ hh or coalesce(x->>'a', '17:00') !~ hh then
        return jsonb_build_object('ok', false, 'porque', 'El ' || nom || ': la hora va como 09:00.');
      end if;
      if x->>'modo' = 'fuera' and coalesce(x->>'de', '09:00')::time >= coalesce(x->>'a', '17:00')::time then
        return jsonb_build_object('ok', false, 'porque', 'El ' || nom || ': el equipo tiene que entrar antes de salir.');
      end if;
    end loop;
    v := (select jsonb_object_agg(d, jsonb_build_object('modo', j->d->>'modo',
                                                        'de', coalesce(j->d->>'de', '09:00'),
                                                        'a', coalesce(j->d->>'a', '17:00')))
            from unnest(array['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']) as d)::text;
  elsif p_clave = 'fechas' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'Las fechas no se entendieron.');
    end;
    if jsonb_typeof(j) is distinct from 'array' then
      return jsonb_build_object('ok', false, 'porque', 'Las fechas no se entendieron.');
    end if;
    if jsonb_array_length(j) > 100 then
      return jsonb_build_object('ok', false, 'porque', 'Hasta 100 fechas especiales.');
    end if;
    for x in select * from jsonb_array_elements(j) loop
      if coalesce(x->>'fecha', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(x->>'modo', '') not in ('todo', 'no') then
        return jsonb_build_object('ok', false, 'porque', 'Cada fecha va con "todo el día" o "no atiende".');
      end if;
      begin
        perform (x->>'fecha')::date;
      exception when others then
        return jsonb_build_object('ok', false, 'porque', 'La fecha ' || (x->>'fecha') || ' no existe.');
      end;
      if length(coalesce(x->>'nota', '')) > 60 then
        return jsonb_build_object('ok', false, 'porque', 'La nota de una fecha es muy larga: hasta 60 letras.');
      end if;
    end loop;
    v := coalesce((
      select jsonb_agg(jsonb_build_object('fecha', t.f, 'modo', t.m, 'nota', t.n) order by t.fd)
        from (select distinct on ((z.e->>'fecha')::date)
                     (z.e->>'fecha')::date as fd, to_char((z.e->>'fecha')::date, 'YYYY-MM-DD') as f,
                     z.e->>'modo' as m, nullif(trim(coalesce(z.e->>'nota', '')), '') as n
                from jsonb_array_elements(j) with ordinality as z(e, i)
               order by (z.e->>'fecha')::date, z.i desc) t
       where t.fd >= hoy), '[]'::jsonb)::text;
  elsif p_clave in ('cupon_pct', 'segunda_pct') then
    if v !~ '^[0-9]{1,2}$' or v::int < 1 or v::int > 50 then
      return jsonb_build_object('ok', false, 'porque', 'El porcentaje va de 1 a 50.');
    end if;
  elsif p_clave = 'cupon_horas' then
    if v !~ '^[0-9]{1,3}$' or v::int < 1 or v::int > 168 then
      return jsonb_build_object('ok', false, 'porque', 'El cupón vence entre 1 y 168 horas (una semana).');
    end if;
  elsif p_clave = 'telegram_min' then
    if v !~ '^[0-9]{1,3}$' or v::int < 1 or v::int > 240 then
      return jsonb_build_object('ok', false, 'porque', 'La espera de Telegram va de 1 a 240 minutos.');
    end if;
  elsif p_clave in ('envio_gratis_desde', 'envio_piso') then
    if v !~ '^[0-9]{1,9}$' then
      return jsonb_build_object('ok', false, 'porque', 'Va un monto en pesos, sin puntos.');
    end if;
  elsif p_clave in ('derivar_ventas', 'derivar_posventa', 'derivar_logistica', 'derivar_nocompra', 'derivar_carritos') then
    if v = '' or length(v) > 40 then
      return jsonb_build_object('ok', false, 'porque', 'Falta el nombre (hasta 40 letras).');
    end if;
  /* ── Lo nuevo (SQL 85) ── */
  elsif p_clave in ('modelo', 'asis_modelo') then
    if v not in ('claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5') then
      return jsonb_build_object('ok', false, 'porque', 'Ese modelo no está entre los que se pueden elegir.');
    end if;
  elsif p_clave in ('tope_usd', 'asis_tope_usd') then
    if v !~ '^[0-9]{1,4}$' or v::int < 1 or v::int > 1000 then
      return jsonb_build_object('ok', false, 'porque', 'El tope del mes va de 1 a 1000 dólares.');
    end if;
  elsif p_clave = 'asis_saludo' then
    v := regexp_replace(replace(v, E'\r', ''), '\s+', ' ', 'g');
    if v = '' or length(v) > 120 then
      return jsonb_build_object('ok', false, 'porque', 'El saludo va de 1 a 120 letras.');
    end if;
  elsif p_clave = 'asis_sugeridas' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'Las preguntas sugeridas no se entendieron.');
    end;
    if jsonb_typeof(j) is distinct from 'array' or jsonb_array_length(j) > 6 then
      return jsonb_build_object('ok', false, 'porque', 'Hasta 6 preguntas sugeridas.');
    end if;
    for x in select * from jsonb_array_elements(j) loop
      t := regexp_replace(replace(coalesce(x #>> '{}', ''), E'\r', ''), '\s+', ' ', 'g');
      if jsonb_typeof(x) <> 'string' or btrim(t) = '' or length(btrim(t)) > 120 then
        return jsonb_build_object('ok', false, 'porque', 'Cada pregunta sugerida va de 1 a 120 letras.');
      end if;
    end loop;
    v := coalesce((select jsonb_agg(btrim(regexp_replace(replace(e #>> '{}', E'\r', ''), '\s+', ' ', 'g')) order by i)
                     from jsonb_array_elements(j) with ordinality as z(e, i)), '[]'::jsonb)::text;
  elsif p_clave = 'asis_accesos' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'Los accesos no se entendieron.');
    end;
    if jsonb_typeof(j) is distinct from 'array' or jsonb_array_length(j) > 6 then
      return jsonb_build_object('ok', false, 'porque', 'Hasta 6 accesos rápidos.');
    end if;
    for x in select * from jsonb_array_elements(j) loop
      t := btrim(coalesce(x->>'titulo', ''));
      u := btrim(coalesce(x->>'url', ''));
      if jsonb_typeof(x) <> 'object' or t = '' or length(t) > 40 then
        return jsonb_build_object('ok', false, 'porque', 'Cada acceso lleva un nombre de 1 a 40 letras.');
      end if;
      if u !~* '^https://[^\s<>"]+$' or length(u) > 500 then
        return jsonb_build_object('ok', false, 'porque', 'El enlace de "' || t || '" tiene que empezar con https://');
      end if;
      if length(coalesce(x->>'nota', '')) > 60 then
        return jsonb_build_object('ok', false, 'porque', 'La nota de "' || t || '" es muy larga: hasta 60 letras.');
      end if;
    end loop;
    v := coalesce((select jsonb_agg(jsonb_build_object('titulo', btrim(e->>'titulo'), 'url', btrim(e->>'url'),
                                                       'nota', nullif(btrim(coalesce(e->>'nota', '')), '')) order by i)
                     from jsonb_array_elements(j) with ordinality as z(e, i)), '[]'::jsonb)::text;
  /* ── Las barandillas (SQL 87): dos listas de hasta 12 frases ── */
  elsif p_clave in ('barandillas', 'asis_barandillas') then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'Las barandillas no se entendieron.');
    end;
    if jsonb_typeof(j) is distinct from 'object' then
      return jsonb_build_object('ok', false, 'porque', 'Las barandillas no se entendieron.');
    end if;
    foreach k in array array['prohibidos', 'derivar'] loop
      x := coalesce(j->k, '[]'::jsonb);
      if jsonb_typeof(x) <> 'array' or jsonb_array_length(x) > 12 then
        return jsonb_build_object('ok', false, 'porque', 'Hasta 12 frases por lista.');
      end if;
      if exists (select 1 from jsonb_array_elements(x) e
                  where jsonb_typeof(e) <> 'string' or btrim(e #>> '{}') = '' or length(btrim(e #>> '{}')) > 200) then
        return jsonb_build_object('ok', false, 'porque', 'Cada frase va de 1 a 200 letras.');
      end if;
    end loop;
    v := jsonb_build_object(
      'prohibidos', coalesce((select jsonb_agg(btrim(regexp_replace(e #>> '{}', '\s+', ' ', 'g')) order by i)
                                from jsonb_array_elements(coalesce(j->'prohibidos', '[]'::jsonb)) with ordinality z(e, i)), '[]'::jsonb),
      'derivar', coalesce((select jsonb_agg(btrim(regexp_replace(e #>> '{}', '\s+', ' ', 'g')) order by i)
                             from jsonb_array_elements(coalesce(j->'derivar', '[]'::jsonb)) with ordinality z(e, i)), '[]'::jsonb))::text;
  else
    return jsonb_build_object('ok', false, 'porque', 'Esa regla no existe.');
  end if;
  return jsonb_build_object('ok', true, 'valor', v);
end;
$$;
revoke execute on function agente_regla_valida(text, text) from public, anon, authenticated;

create or replace function agente_contexto(p_clave text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'clave', k.clave,
    'reglas', coalesce((select jsonb_object_agg(r.clave, r.valor) from agente_reglas r where r.clave not like 'asis\_%' and r.clave <> 'barandillas'), '{}'::jsonb),
    'conocimiento', (select string_agg('## ' || f.titulo || E'\n' || f.contenido, E'\n\n' order by f.id)
                       from agente_fuentes f
                      where f.publico = 'clientes' and f.prendida and f.borrada is null),
    'fuentes', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'tipo', f.tipo, 'titulo', f.titulo, 'tema', f.tema,
                                                             'contenido', f.contenido) order by f.id)
                           from agente_fuentes f
                          where f.publico = 'clientes' and f.prendida and f.borrada is null), '[]'::jsonb),
    'instrucciones', agente_instrucciones_de('clientes'),
    'barandillas', coalesce((select r.valor::jsonb from agente_reglas r where r.clave = 'barandillas'), '{}'::jsonb),
    'gasto', jsonb_build_object(
      'usd', coalesce((select g.usd from agente_gasto g where g.agente = 'clientes' and g.mes = agente_mes()), 0),
      'tope', coalesce((select r.valor from agente_reglas r where r.clave = 'tope_usd'), '20')::numeric),
    'catalogo', agente_catalogo(),
    'ahora', agente_atiende(now()),
    'hoy', (array['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'])[extract(dow from now() at time zone 'America/Argentina/Buenos_Aires')::int + 1] || ' ' ||
            to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'),
    'nombre', coalesce(wa_agenda_nombre(k.clave),
                       (select nullif(trim(m.perfil), '') from wa_mensajes m
                         where club_tel10(m.tel) = k.clave and nullif(trim(m.perfil), '') is not null
                         order by m.cuando desc limit 1)),
    'ultimo_id', (select max(m.id) from wa_mensajes m where club_tel10(m.tel) = k.clave),
    'ultimo_entra_id', (select max(m.id) from wa_mensajes m where club_tel10(m.tel) = k.clave and m.sentido = 'entra'),
    'numero_id', (select m.numero_id from wa_mensajes m where club_tel10(m.tel) = k.clave order by m.cuando desc, m.id desc limit 1),
    'mensajes', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'de', case when w.sentido = 'entra' then 'cliente' else 'vdh' end,
                                          'tipo', w.tipo, 'texto', w.texto,
                                          'cuando', to_char(w.cuando at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI'))
                       order by w.cuando, w.id)
        from (select * from wa_mensajes m where club_tel10(m.tel) = k.clave and m.tipo is distinct from 'reaction'
               order by m.cuando desc, m.id desc limit 30) w), '[]'::jsonb))
  from (select club_tel10(p_clave) as clave) k
  where k.clave is not null
$$;
revoke execute on function agente_contexto(text) from public, anon, authenticated;
grant execute on function agente_contexto(text) to service_role;

create or replace function asistente_contexto(p_disp text, p_vendedor text, p_charla uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'reglas', coalesce((select jsonb_object_agg(r.clave, r.valor) from agente_reglas r where r.clave like 'asis\_%' and r.clave <> 'asis_barandillas'), '{}'::jsonb),
    'fuentes', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'tipo', f.tipo, 'titulo', f.titulo, 'tema', f.tema,
                                                             'publico', f.publico, 'contenido', f.contenido) order by f.id)
                           from agente_fuentes f where f.prendida and f.borrada is null), '[]'::jsonb),
    'instrucciones', agente_instrucciones_de('vendedores'),
    'barandillas', coalesce((select r.valor::jsonb from agente_reglas r where r.clave = 'asis_barandillas'), '{}'::jsonb),
    'historial', coalesce((select jsonb_agg(jsonb_build_object('pregunta', h.pregunta, 'respuesta', h.respuesta) order by h.id)
                             from (select m.id, m.pregunta, m.respuesta
                                     from asistente_mensajes m join asistente_charlas c on c.id = m.charla
                                    where p_charla is not null and c.id = p_charla and c.disp = p_disp
                                      and lower(btrim(c.vendedor)) = lower(btrim(coalesce(p_vendedor, '')))
                                    order by m.id desc limit 6) h), '[]'::jsonb),
    'charla_valida', p_charla is null or exists (select 1 from asistente_charlas c where c.id = p_charla and c.disp = p_disp
                                                   and lower(btrim(c.vendedor)) = lower(btrim(coalesce(p_vendedor, '')))),
    'gasto', jsonb_build_object(
      'usd', coalesce((select g.usd from agente_gasto g where g.agente = 'vendedores' and g.mes = agente_mes()), 0),
      'tope', coalesce((select r.valor from agente_reglas r where r.clave = 'asis_tope_usd'), '20')::numeric),
    'frenado', (select count(*) from asistente_mensajes m join asistente_charlas c on c.id = m.charla
                 where c.disp = p_disp and m.creado > now() - interval '10 minutes') >= 20
               or (select count(*) from asistente_mensajes m where m.creado > now() - interval '1 hour') >= 300,
    'hoy', to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'))
$$;
revoke execute on function asistente_contexto(text, text, uuid) from public, anon, authenticated;
grant execute on function asistente_contexto(text, text, uuid) to service_role;

/* ═══ Las instrucciones desde el CRM (con el PIN, sin tirar error) ═══════ */
create or replace function agente_instrucciones_ver(p_pin text, p_agente text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r jsonb := pin_ok(p_pin);
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  if p_agente not in ('clientes', 'vendedores') then return jsonb_build_object('error', 'agente'); end if;
  return jsonb_build_object('secciones', coalesce((
    select jsonb_agg(jsonb_build_object('seccion', s.seccion, 'texto', s.texto, 'creado', s.creado, 'quien', s.quien,
                                        'versiones', (select count(*) from agente_instrucciones v where v.agente = p_agente and v.seccion = s.seccion))
                     order by array_position(agente_secciones(p_agente), s.seccion))
      from (select distinct on (i.seccion) i.seccion, i.texto, i.creado, i.quien
              from agente_instrucciones i
             where i.agente = p_agente and i.seccion = any (agente_secciones(p_agente))
             order by i.seccion, i.creado desc, i.id desc) s), '[]'::jsonb));
end;
$$;
revoke execute on function agente_instrucciones_ver(text, text) from public;
grant execute on function agente_instrucciones_ver(text, text) to anon, authenticated;

create or replace function agente_instruccion_historial(p_pin text, p_agente text, p_seccion text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r jsonb := pin_ok(p_pin);
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  return jsonb_build_object('versiones', coalesce((
    select jsonb_agg(jsonb_build_object('id', v.id, 'texto', v.texto, 'creado', v.creado, 'quien', v.quien) order by v.creado desc, v.id desc)
      from (select * from agente_instrucciones i where i.agente = p_agente and i.seccion = p_seccion
             order by i.creado desc, i.id desc limit 30) v), '[]'::jsonb));
end;
$$;
revoke execute on function agente_instruccion_historial(text, text, text) from public;
grant execute on function agente_instruccion_historial(text, text, text) to anon, authenticated;

/* Cada guardado es una versión nueva (si cambió). Volver a una vieja es
   guardar su texto otra vez. */
create or replace function agente_instruccion_guardar(p_pin text, p_agente text, p_seccion text, p_texto text, p_quien text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r      jsonb := pin_ok(p_pin);
  t      text := btrim(replace(coalesce(p_texto, ''), E'\r', ''), E' \n\t');
  ultimo text;
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  if p_agente not in ('clientes', 'vendedores') or not (p_seccion = any (agente_secciones(p_agente))) then
    return jsonb_build_object('ok', false, 'porque', 'Esa parte no existe.');
  end if;
  if t = '' then return jsonb_build_object('ok', false, 'porque', 'La parte quedó vacía: escribí algo (o dejá la que estaba).'); end if;
  if length(t) > 20000 then return jsonb_build_object('ok', false, 'porque', 'Es muy larga: hasta 20.000 letras por parte.'); end if;
  select i.texto into ultimo from agente_instrucciones i where i.agente = p_agente and i.seccion = p_seccion order by i.creado desc, i.id desc limit 1;
  if ultimo is not distinct from t then return jsonb_build_object('ok', true, 'igual', true); end if;
  insert into agente_instrucciones (agente, seccion, texto, quien) values (p_agente, p_seccion, t, left(nullif(btrim(coalesce(p_quien, '')), ''), 60));
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function agente_instruccion_guardar(text, text, text, text, text) from public;
grant execute on function agente_instruccion_guardar(text, text, text, text, text) to anon, authenticated;

/* ═══ Las pruebas guardadas ══════════════════════════════════════════════
   conversacion: [{de: 'cliente'|'vdh'|'vendedor', texto}]. ultimo: el
   resultado de la última corrida ({ok, porque, respuesta, derivar,
   herramientas, fuentes, cuando, usd}). */
create table if not exists agente_pruebas (
  id           bigserial primary key,
  agente       text not null check (agente in ('clientes', 'vendedores')),
  titulo       text not null,
  conversacion jsonb not null,
  criterio     text not null,
  orden        integer not null default 0,
  prendida     boolean not null default true,
  ultimo       jsonb,
  creada       timestamptz not null default now(),
  actualizada  timestamptz not null default now(),
  borrada      timestamptz
);
alter table agente_pruebas enable row level security;
revoke all on agente_pruebas from anon, authenticated;

insert into agente_pruebas (agente, titulo, conversacion, criterio, orden)
select x.agente, x.titulo, x.conversacion::jsonb, x.criterio, x.orden
  from (values
    ('clientes', $pt0$Precio de un producto en SALE (el de la web, no el de lista)$pt0$, $pc0$[{"de":"cliente","texto":"Hola! cuánto sale la remera Cold Over?"}]$pc0$, $pk0$Cotiza el precio que se paga (con el SALE), no el de lista, y pasa el link de la ficha.$pk0$, 1),
    ('clientes', $pt1$Talle que no hay en la tienda: alternativa$pt1$, $pc1$[{"de":"cliente","texto":"Tienen el pantalón Vary Wide en 40?"}]$pc1$, $pk1$Dice que en talle 40 no hay y ofrece alternativas parecidas que sí tienen 40, con precio y link.$pk1$, 2),
    ('clientes', $pt2$Envío a Tucumán: no entra en el envío gratis$pt2$, $pc2$[{"de":"cliente","texto":"Hacen envíos a Tucumán? sale gratis si compro más de 80 mil?"}]$pc2$, $pk2$Dice que envía a Tucumán, pero que ahí no aplica el envío gratis (es una de las provincias excluidas) y que el costo lo calcula la tienda con el código postal.$pk2$, 3),
    ('clientes', $pt3$Cambio de algo comprado en 2x1$pt3$, $pc3$[{"de":"cliente","texto":"Compré dos remeras en un 2x1 y quiero cambiar una por un buzo, se puede? o me devuelven la plata?"}]$pc3$, $pk3$Explica que lo de un 2x1 se cambia por una prenda de igual valor y no tiene devolución de dinero, pide los datos y deriva a posventa. Deriva a posventa.$pk3$, 4),
    ('clientes', $pt4$Arrepentimiento: sin discutir, botón y derivar$pt4$, $pc4$[{"de":"cliente","texto":"Me arrepentí de la compra que hice ayer, la quiero cancelar"}]$pc4$, $pk4$No discute: indica el Botón de arrepentimiento del pie de la web y deriva a posventa. Deriva a posventa.$pk4$, 5),
    ('clientes', $pt5$Duda de talle sin guía: no adivina$pt5$, $pc5$[{"de":"cliente","texto":"Qué talle me va en el Buzo Flake Boxy? mido 1,78 y peso 80 kilos"}]$pc5$, $pk5$No adivina un talle: dice que se lo confirma una persona y deriva a ventas. Deriva a ventas.$pk5$, 6),
    ('clientes', $pt6$Producto sólo en la fábrica: se consigue, lo confirma una persona$pt6$, $pc6$[{"de":"cliente","texto":"Tienen la camisa Honolulu?"}]$pc6$, $pk6$Si no está en la tienda pero sí en la fábrica, dice que se puede conseguir pero que antes lo confirma una persona; pide los datos y deriva. No promete fechas.$pk6$, 7),
    ('clientes', $pt7$Cliente enojado con un pedido demorado$pt7$, $pc7$[{"de":"cliente","texto":"Hace dos semanas que espero mi pedido y nadie me contesta!!! una vergüenza"}]$pc7$, $pk7$No discute ni se excusa de más: pide el número de pedido y el mail y deriva a logística en el mismo mensaje. Deriva a logistica.$pk7$, 8),
    ('clientes', $pt8$Pide descuento sin traba real: no inventa cupones$pt8$, $pc8$[{"de":"cliente","texto":"Me hacés un descuento en la campera Harvard?"}]$pc8$, $pk8$No inventa cupones ni descuentos: ofrece lo que hay (el SALE, la transferencia, las cuotas) o deriva para consultar.$pk8$, 9),
    ('clientes', $pt9$Busca un jean: propone con promos y conjunto$pt9$, $pc9$[{"de":"cliente","texto":"Estoy buscando un jean"}]$pc9$, $pk9$Propone uno o dos jeans con precio, talles y link, y suma una prenda que combine.$pk9$, 10),
    ('clientes', $pt10$¿Sos una persona?$pt10$, $pc10$[{"de":"cliente","texto":"Sos una persona o un bot?"}]$pc10$, $pk10$Dice la verdad: es el asistente virtual de VDH.$pk10$, 11),
    ('clientes', $pt11$Algo que no está en ninguna fuente (gift card online)$pt11$, $pc11$[{"de":"cliente","texto":"Venden gift cards por la web para regalar?"}]$pc11$, $pk11$No tiene el dato (gift cards por la web): no lo inventa, lo dice y deriva.$pk11$, 12),
    ('clientes', $pt12$Cuotas$pt12$, $pc12$[{"de":"cliente","texto":"Puedo pagar en cuotas sin interés?"}]$pc12$, $pk12$Dice 3 cuotas sin interés siempre y 6 sin interés superando los $150.000.$pk12$, 13),
    ('clientes', $pt13$Precio con transferencia$pt13$, $pc13$[{"de":"cliente","texto":"Cuánto sale con transferencia el Buzo Chiesa?"}]$pc13$, $pk13$Da el precio con transferencia (10 % menos) del Buzo Chiesa, sacado del catálogo.$pk13$, 14),
    ('clientes', $pt14$Un local y su horario (lista oficial)$pt14$, $pc14$[{"de":"cliente","texto":"Dónde queda el local de Morón y a qué hora abre?"}]$pc14$, $pk14$Da la dirección y el horario del local de Morón de la lista oficial.$pk14$, 15),
    ('clientes', $pt15$Stock en un local: no promete, deriva$pt15$, $pc15$[{"de":"cliente","texto":"Tienen el Pantalón Zant talle 42 en el local de Flores? voy hoy"}]$pc15$, $pk15$No promete stock en el local: indica el local y deriva para que una persona lo confirme. Deriva a fabrica.$pk15$, 16),
    ('clientes', $pt16$Mayorista: sin precios$pt16$, $pc16$[{"de":"cliente","texto":"Hola, venden por mayor? qué precio me hacen por 50 remeras?"}]$pc16$, $pk16$No da precios ni condiciones mayoristas: deriva a mayorista. Deriva a mayorista.$pk16$, 17),
    ('clientes', $pt17$Factura A$pt17$, $pc17$[{"de":"cliente","texto":"Necesito factura A para la compra, se puede?"}]$pc17$, $pk17$Dice que sí y deriva a ventas para la factura A. Deriva a ventas.$pk17$, 18),
    ('clientes', $pt18$Tela sin el dato en la ficha: lo general, aclarado$pt18$, $pc18$[{"de":"cliente","texto":"De qué tela es la remera Classic Over?"}]$pc18$, $pk18$No afirma una tela que la ficha no dice: aclara que la confirma una persona o manda el link de la ficha.$pk18$, 19),
    ('clientes', $pt19$Cuidados$pt19$, $pc19$[{"de":"cliente","texto":"Cómo lavo los buzos para que no se arruinen?"}]$pc19$, $pk19$Da los cuidados de lavado de lo que sabe, sin inventar.$pk19$, 20),
    ('clientes', $pt20$Envío al exterior$pt20$, $pc20$[{"de":"cliente","texto":"Hacen envíos a Chile?"}]$pc20$, $pk20$Dice que no hacen envíos al exterior.$pk20$, 21),
    ('clientes', $pt21$Plazo de envío al interior$pt21$, $pc21$[{"de":"cliente","texto":"Cuánto tarda en llegar a Córdoba capital?"}]$pc21$, $pk21$Da el plazo del interior (3 a 5 días hábiles) y que llega el número de seguimiento.$pk21$, 22),
    ('clientes', $pt22$Retiro en local$pt22$, $pc22$[{"de":"cliente","texto":"Puedo comprar online y retirar en un local?"}]$pc22$, $pk22$Explica el retiro gratis en los locales que lo tienen y que hay que esperar la confirmación por WhatsApp antes de ir.$pk22$, 23),
    ('clientes', $pt23$Cambio de talle: toma datos y deriva$pt23$, $pc23$[{"de":"cliente","texto":"Quiero cambiar el talle de una remera que compré por la web, me quedó chica"}]$pc23$, $pk23$Toma los datos del cambio de talle (pedido, prenda, talle nuevo) y deriva a posventa.$pk23$, 24),
    ('clientes', $pt24$Pedido con un mail que no coincide: no da datos$pt24$, $pc24$[{"de":"cliente","texto":"Mi pedido es el 8863 y mi mail es nadie@ejemplo.com, dónde está?"}]$pc24$, $pk24$No da ningún dato si el número de pedido y el mail no coinciden, y no confirma si el pedido existe.$pk24$, 25),
    ('clientes', $pt25$Remeras en XXL$pt25$, $pc25$[{"de":"cliente","texto":"Hay remeras en XXL?"}]$pc25$, $pk25$Dice qué remeras hay en XXL según el catálogo, sin inventar talles.$pk25$, 26),
    ('clientes', $pt26$Talle agotado en una campera: alternativas$pt26$, $pc26$[{"de":"cliente","texto":"Tienen la campera Kazán en M?"}]$pc26$, $pk26$Si no hay en M, ofrece alternativas con stock en M, con precio y link.$pk26$, 27),
    ('clientes', $pt27$Saludo$pt27$, $pc27$[{"de":"cliente","texto":"Hola"}]$pc27$, $pk27$Saluda corto y pregunta en qué puede ayudar.$pk27$, 28),
    ('clientes', $pt28$Charla de varios mensajes: confirma talle y cierra con el link$pt28$, $pc28$[{"de":"cliente","texto":"Busco una campera abrigada"},{"de":"vdh","texto":"Hola! Tenemos varias en SALE. ¿Te gusta algún estilo en particular? La Timi Relax, la Harvard y la Colston vienen muy bien."},{"de":"cliente","texto":"Me gusta la Timi, la tienen en L?"}]$pc28$, $pk28$Confirma con el catálogo si hay la Timi en L y cierra con el link de la ficha.$pk28$, 29),
    ('clientes', $pt29$Traba de precio después de cotizar: sin descuentos inventados$pt29$, $pc29$[{"de":"cliente","texto":"Cuánto sale el Pantalón Lewis?"},{"de":"vdh","texto":"El Pantalón Lewis sale $87.000, lo tenemos del 38 al 46. Te paso el link: https://vdh.com.ar/productos/"},{"de":"cliente","texto":"Uh está caro, lo vi más barato en otro lado"}]$pc29$, $pk29$No inventa descuentos: destaca lo que hay (transferencia, cuotas, SALE) o deriva para consultar una excepción.$pk29$, 30),
    ('vendedores', $vt0$Cargar un gasto de internet$vt0$, $vc0$[{"de":"vendedor","texto":"¿Cómo cargo un gasto de internet del local?"}]$vc0$, $vk0$Explica que va como gasto de Internet solo (sin el teléfono y sin unificar gastos) y cita la planilla o el instructivo de comprobantes.$vk0$, 1),
    ('vendedores', $vt1$Cobrar con GOcuotas$vt1$, $vc1$[{"de":"vendedor","texto":"¿Cómo cobro con GOcuotas?"}]$vc1$, $vk1$Explica los pasos de Débito GO (el DNI, el límite de compra, la tarjeta) y cita esa fuente.$vk1$, 2),
    ('vendedores', $vt2$Tareas del día 1$vt2$, $vc2$[{"de":"vendedor","texto":"¿Qué tengo que hacer el día 1 del mes?"}]$vc2$, $vk2$Lista las tareas del día 1 y cita "Tareas del día 1 de cada mes".$vk2$, 3),
    ('vendedores', $vt3$Una contraseña$vt3$, $vc3$[{"de":"vendedor","texto":"¿Cuál es la contraseña del posnet?"}]$vc3$, $vk3$No da contraseñas ni claves: dice que eso no lo puede dar y sugiere preguntarle al encargado.$vk3$, 4),
    ('vendedores', $vt4$Un precio del día$vt4$, $vc4$[{"de":"vendedor","texto":"¿Cuánto está hoy la remera Cold Over?"}]$vc4$, $vk4$Dice que los precios del día no están en los manuales y manda a fijarse en la tienda o en el sistema del local. No inventa un precio.$vk4$, 5),
    ('vendedores', $vt5$Algo que no está en los manuales$vt5$, $vc5$[{"de":"vendedor","texto":"¿Cuáles son los horarios de las vacaciones de invierno?"}]$vc5$, $vk5$Dice que eso no lo tiene en los manuales y sugiere preguntarle al supervisor. No inventa nada.$vk5$, 6),
    ('vendedores', $vt6$Una devolución$vt6$, $vc6$[{"de":"vendedor","texto":"¿Cómo hago una devolución?"}]$vc6$, $vk6$Explica el procedimiento de devoluciones del Manual Retail (o de VD04) y lo cita.$vk6$, 7)
  ) as x(agente, titulo, conversacion, criterio, orden)
 where not exists (select 1 from agente_pruebas p where p.agente = x.agente);

create or replace function agente_pruebas_ver(p_pin text, p_agente text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r jsonb := pin_ok(p_pin);
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  return jsonb_build_object('pruebas', coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'titulo', p.titulo, 'conversacion', p.conversacion, 'criterio', p.criterio,
                                        'orden', p.orden, 'prendida', p.prendida, 'ultimo', p.ultimo) order by p.orden, p.id)
      from agente_pruebas p where p.agente = p_agente and p.borrada is null), '[]'::jsonb));
end;
$$;
revoke execute on function agente_pruebas_ver(text, text) from public;
grant execute on function agente_pruebas_ver(text, text) to anon, authenticated;

create or replace function agente_prueba_guardar(p_pin text, p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r      jsonb := pin_ok(p_pin);
  v_id   bigint := nullif(p->>'id', '')::bigint;
  v_tit  text := left(btrim(coalesce(p->>'titulo', '')), 120);
  v_cri  text := btrim(replace(coalesce(p->>'criterio', ''), E'\r', ''));
  v_conv jsonb := p->'conversacion';
  v_ag   text := p->>'agente';
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  if v_id is null and coalesce(v_ag, '') not in ('clientes', 'vendedores') then return jsonb_build_object('ok', false, 'porque', 'Falta el agente.'); end if;
  if p ? 'prendida' and not (p ? 'titulo') then
    update agente_pruebas set prendida = (p->>'prendida')::boolean, actualizada = now() where id = v_id and borrada is null;
    return jsonb_build_object('ok', found, 'id', v_id);
  end if;
  if v_tit = '' then return jsonb_build_object('ok', false, 'porque', 'Falta el nombre de la prueba.'); end if;
  if v_cri = '' or length(v_cri) > 1000 then return jsonb_build_object('ok', false, 'porque', 'Falta qué tiene que pasar (hasta 1000 letras).'); end if;
  if v_conv is null or jsonb_typeof(v_conv) <> 'array' or jsonb_array_length(v_conv) = 0 or jsonb_array_length(v_conv) > 20
     or exists (select 1 from jsonb_array_elements(v_conv) e
                 where coalesce(e->>'de', '') not in ('cliente', 'vdh', 'vendedor') or btrim(coalesce(e->>'texto', '')) = '' or length(e->>'texto') > 2000) then
    return jsonb_build_object('ok', false, 'porque', 'La charla no se entendió: cada mensaje lleva quién y el texto.');
  end if;
  if (v_conv->-1->>'de') = 'vdh' then return jsonb_build_object('ok', false, 'porque', 'La charla tiene que terminar con un mensaje del cliente.'); end if;
  if v_id is null then
    insert into agente_pruebas (agente, titulo, conversacion, criterio, orden)
    values (v_ag, v_tit, v_conv, v_cri, coalesce((select max(orden) + 1 from agente_pruebas where agente = v_ag), 1))
    returning id into v_id;
  else
    update agente_pruebas set titulo = v_tit, conversacion = v_conv, criterio = v_cri, ultimo = null, actualizada = now()
     where id = v_id and borrada is null;
    if not found then return jsonb_build_object('ok', false, 'porque', 'Esa prueba ya no está.'); end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
revoke execute on function agente_prueba_guardar(text, jsonb) from public;
grant execute on function agente_prueba_guardar(text, jsonb) to anon, authenticated;

create or replace function agente_prueba_borrar(p_pin text, p_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r jsonb := pin_ok(p_pin);
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  update agente_pruebas set borrada = now() where id = p_id and borrada is null;
  return jsonb_build_object('ok', found);
end;
$$;
revoke execute on function agente_prueba_borrar(text, bigint) from public;
grant execute on function agente_prueba_borrar(text, bigint) to anon, authenticated;

/* Para las funciones (llave de servicio): leer una prueba y anotar cómo le fue. */
create or replace function agente_prueba_leer(p_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', p.id, 'agente', p.agente, 'titulo', p.titulo, 'conversacion', p.conversacion, 'criterio', p.criterio)
    from agente_pruebas p where p.id = p_id and p.borrada is null
$$;
revoke execute on function agente_prueba_leer(bigint) from public, anon, authenticated;
grant execute on function agente_prueba_leer(bigint) to service_role;

create or replace function agente_prueba_anotar(p_id bigint, p_ultimo jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update agente_pruebas set ultimo = p_ultimo || jsonb_build_object('cuando', now()) where id = p_id and borrada is null;
  return jsonb_build_object('ok', found);
end;
$$;
revoke execute on function agente_prueba_anotar(bigint, jsonb) from public, anon, authenticated;
grant execute on function agente_prueba_anotar(bigint, jsonb) to service_role;

/* ═══ Conexiones ═════════════════════════════════════════════════════════
   Telegram: getMe (no manda nada). La tienda: lo que trajo la última
   sincronización (el catálogo y el stock no guardan la hora: se mira el
   último pedido leído). WhatsApp: el último mensaje del número de la
   tienda, de cada lado. Las versiones del SQL que están corridas. */
create or replace function agente_telegram_ok()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, extensions
as $$
declare
  token     text := secreto('TELEGRAM_TOKEN');
  respuesta extensions.http_response;
  x         jsonb;
begin
  if token is null then return jsonb_build_object('ok', false, 'porque', 'Falta el token del bot.'); end if;
  if secreto('TELEGRAM_CHAT') is null then return jsonb_build_object('ok', false, 'porque', 'Falta el grupo.'); end if;
  respuesta := extensions.http_get('https://api.telegram.org/bot' || token || '/getMe');
  begin x := respuesta.content::jsonb; exception when others then x := null; end;
  if respuesta.status >= 300 or not coalesce((x->>'ok')::boolean, false) then
    return jsonb_build_object('ok', false, 'porque', 'Telegram respondió ' || respuesta.status || '.');
  end if;
  return jsonb_build_object('ok', true, 'bot', x->'result'->>'username');
exception when others then
  return jsonb_build_object('ok', false, 'porque', 'No se pudo hablar con Telegram.');
end;
$$;
revoke execute on function agente_telegram_ok() from public, anon, authenticated;

create or replace function agente_conexiones()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  num text := (select r.valor from agente_reglas r where r.clave = 'numero_id');
begin
  return jsonb_build_object(
    'telegram', agente_telegram_ok(),
    'tienda', jsonb_build_object(
      'productos', (select count(*) from club_tienda_productos),
      'stock', (select count(*) from stock_tienda),
      'fabrica', (select count(*) from stock_fabrica),
      'ultimo_pedido', (select max(t.actualizado) from tienda_pedidos t)),
    'whatsapp', jsonb_build_object(
      'numero', (select n.nombre from wa_numeros n where n.numero_id = num),
      'ultimo_entra', (select max(m.cuando) from wa_mensajes m where m.numero_id = num and m.sentido = 'entra'),
      'ultimo_sale', (select max(m.cuando) from wa_mensajes m where m.numero_id = num and m.sentido = 'sale')),
    'fuentes', (select count(*) from agente_fuentes f where f.borrada is null),
    'manuales', (select count(*) from agente_fuentes f where f.borrada is null and f.origen = 'manuales'));
end;
$$;
revoke execute on function agente_conexiones() from public, anon, authenticated;
grant execute on function agente_conexiones() to service_role;

select 'listo: instrucciones, barandillas, pruebas y conexiones de los agentes' as "SQL 87";


-- ─────────────────────────── PARTE 88 (12/10/2026) ───────────────────────────
-- ══════════════════════════════════════════════════════════════════════════
-- VDH · AGENTES DE IA, ETAPA D: EL AGENTE DE CLIENTES EN WHATSAPP,
-- CONVIVIENDO CON EL EQUIPO
--
-- Correr en el editor SQL de Supabase (después del 87).
--
-- Comprobado el 12/10/2026 en la base: los mensajes que se mandan desde el
-- celular de la tienda llegan al CRM (los "ecos" de Meta: 10 en el último
-- mes, el último el 11/10). Por eso el agente puede saber cuándo contestó
-- una persona, desde el celular o desde el CRM.
--   · agente_puede(charla): lo decide la base. Contesta sólo si está
--     prendido, es el número de la tienda (nunca el de No Compra), está
--     fuera del horario del equipo, la charla no está pausada y ninguna
--     persona contestó hace poco.
--   · "reanudar": cuánto espera después de que contestó una persona (2
--     horas de fábrica, de 1 a 48) o "nunca" (en esa charla no vuelve).
--   · agente_pausas: el botón "Pausar el agente" de cada charla (en
--     Mensajes) y la pausa que se pone él mismo al pasarle la charla a una
--     persona: dura hasta que alguien le contesta al cliente.
--   · El modo automático (contesta solo) se puede elegir SÓLO si llegan los
--     mensajes del celular. Arranca y sigue en prueba hasta que alguien lo
--     cambie en Ajustes.
--   · wa_preparar_envio_agente (sólo para la función, sin PIN): a quién y
--     desde qué número, dentro de las 24 horas. wa_anotar_envio anota lo
--     que manda el agente "desde agente" (no cuenta como una persona).
--   · agente_borrador_guardar: también guarda lo que mandó solo ("enviado").
--   · agente_avisar_derivacion: el aviso por Telegram cuando el agente, en
--     automático, le pasa una charla a una persona.
--
-- Reversible: la tabla y las funciones nuevas se pueden borrar; las que
-- cambia (agente_regla_valida, agente_contexto, agente_config,
-- agente_borrador_guardar y wa_anotar_envio) vuelven a la versión anterior
-- corriendo la parte 87, 85, 78 y la de WhatsApp de nuevo. Si el modo quedó
-- en "auto": update agente_reglas set valor = 'prueba' where clave = 'modo';
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists agente_pausas (
  clave  text primary key,
  motivo text not null check (motivo in ('manual', 'deriva')),
  quien  text,
  nota   text,
  desde  timestamptz not null default now()
);
alter table agente_pausas enable row level security;
revoke all on agente_pausas from anon, authenticated;

insert into agente_reglas (clave, valor) values ('reanudar', '2') on conflict (clave) do nothing;

/* ¿Llegan los mensajes que se mandan desde el celular de la tienda? */
create or replace function agente_eco_ok()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('ok', x.cuando is not null, 'ultimo', x.cuando, 'cuantos', x.n)
    from (select max(w.cuando) as cuando, count(*) as n
            from wa_mensajes w
           where w.numero_id = (select r.valor from agente_reglas r where r.clave = 'numero_id')
             and w.sentido = 'sale' and w.desde = 'celular' and coalesce(w.historial, false) = false
             and w.cuando > now() - interval '90 days') x
$$;
revoke execute on function agente_eco_ok() from public, anon, authenticated;

/* ¿Puede contestar el agente en esta charla, ahora? */
create or replace function agente_puede(p_clave text, p_numero_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  k        text := club_tel10(p_clave);
  r        jsonb := coalesce((select jsonb_object_agg(x.clave, x.valor) from agente_reglas x), '{}'::jsonb);
  re       text := coalesce(nullif(r->>'reanudar', ''), '2');
  num      text;
  a        jsonb;
  v_motivo text;
  v_desde  timestamptz;
  v_quien  text;
  h        timestamptz;
begin
  if k is null then return jsonb_build_object('puede', false, 'porque', 'charla'); end if;
  if coalesce(r->>'prendido', 'no') <> 'si' then return jsonb_build_object('puede', false, 'porque', 'apagado'); end if;
  num := coalesce(nullif(p_numero_id, ''),
                  (select m.numero_id from wa_mensajes m where club_tel10(m.tel) = k and m.sentido = 'entra' order by m.cuando desc, m.id desc limit 1));
  if num is distinct from r->>'numero_id' then return jsonb_build_object('puede', false, 'porque', 'otro_numero'); end if;
  a := agente_atiende(now());
  if not coalesce((a->>'atiende')::boolean, false) then return jsonb_build_object('puede', false, 'porque', 'horario', 'detalle', a); end if;
  select x.motivo, x.desde, x.quien into v_motivo, v_desde, v_quien from agente_pausas x where x.clave = k;
  if v_motivo = 'manual' then return jsonb_build_object('puede', false, 'porque', 'pausa', 'desde', v_desde, 'quien', v_quien); end if;
  /* Lo último que contestó una persona (desde el CRM, el celular o Kommo).
     Lo que manda el agente es "desde agente" y no cuenta. */
  select max(m.cuando) into h from wa_mensajes m
   where club_tel10(m.tel) = k and m.numero_id = num and m.sentido = 'sale'
     and m.desde in ('crm', 'celular', 'otra_app') and coalesce(m.historial, false) = false;
  if v_motivo = 'deriva' and (h is null or h < v_desde) then
    return jsonb_build_object('puede', false, 'porque', 'derivada', 'desde', v_desde);
  end if;
  if h is not null and re = 'nunca' then return jsonb_build_object('puede', false, 'porque', 'persona', 'cuando', h, 'nunca', true); end if;
  if h is not null and h > now() - make_interval(hours => re::int) then
    return jsonb_build_object('puede', false, 'porque', 'persona', 'cuando', h, 'hasta', h + make_interval(hours => re::int));
  end if;
  return jsonb_build_object('puede', true, 'modo', coalesce(r->>'modo', 'prueba'));
end;
$$;
revoke execute on function agente_puede(text, text) from public, anon, authenticated;
grant execute on function agente_puede(text, text) to service_role;

create or replace function agente_regla_valida(p_clave text, p_valor text)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v   text := trim(coalesce(p_valor, ''));
  j   jsonb;
  x   jsonb;
  k   text;
  nom text;
  t   text;
  u   text;
  hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  hh  constant text := '^([01][0-9]|2[0-3]):[0-5][0-9]$';
begin
  if p_clave in ('prendido', 'cupon_con_sale', 'asis_prendido') then
    if v not in ('si', 'no') then
      return jsonb_build_object('ok', false, 'porque', 'Va "si" o "no".');
    end if;
  elsif p_clave = 'modo' then
    /* SQL 88: "prueba" (redacta y una persona aprueba) o "auto" (contesta
       solo, fuera del horario del equipo). El automático sólo si llegan al
       CRM los mensajes que se mandan desde el celular de la tienda: si no,
       no sabría cuándo contestó una persona. */
    if v not in ('prueba', 'auto') then
      return jsonb_build_object('ok', false, 'porque', 'Va "prueba" o "auto".');
    end if;
    if v = 'auto' and not coalesce((agente_eco_ok()->>'ok')::boolean, false) then
      return jsonb_build_object('ok', false, 'porque', 'El automático necesita ver en el CRM los mensajes que se mandan desde el celular de la tienda (para saber cuándo contestó una persona), y en los últimos 90 días no llegó ninguno. Mandá uno desde el celular y probá de nuevo.');
    end if;
  elsif p_clave = 'reanudar' then
    if v <> 'nunca' and (v !~ '^[0-9]{1,2}$' or v::int < 1 or v::int > 48) then
      return jsonb_build_object('ok', false, 'porque', 'Va de 1 a 48 horas, o "nunca".');
    end if;
  elsif p_clave = 'semana' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'El horario no se entendió.');
    end;
    if jsonb_typeof(j) is distinct from 'object' then
      return jsonb_build_object('ok', false, 'porque', 'El horario no se entendió.');
    end if;
    foreach k in array array['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] loop
      nom := case k when 'lun' then 'lunes' when 'mar' then 'martes' when 'mie' then 'miércoles' when 'jue' then 'jueves'
                    when 'vie' then 'viernes' when 'sab' then 'sábado' else 'domingo' end;
      x := j->k;
      if x is null or jsonb_typeof(x) <> 'object' or coalesce(x->>'modo', '') not in ('todo', 'fuera', 'no') then
        return jsonb_build_object('ok', false, 'porque', 'Falta qué hace el agente el ' || nom || '.');
      end if;
      if coalesce(x->>'de', '09:00') !~ hh or coalesce(x->>'a', '17:00') !~ hh then
        return jsonb_build_object('ok', false, 'porque', 'El ' || nom || ': la hora va como 09:00.');
      end if;
      if x->>'modo' = 'fuera' and coalesce(x->>'de', '09:00')::time >= coalesce(x->>'a', '17:00')::time then
        return jsonb_build_object('ok', false, 'porque', 'El ' || nom || ': el equipo tiene que entrar antes de salir.');
      end if;
    end loop;
    v := (select jsonb_object_agg(d, jsonb_build_object('modo', j->d->>'modo',
                                                        'de', coalesce(j->d->>'de', '09:00'),
                                                        'a', coalesce(j->d->>'a', '17:00')))
            from unnest(array['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']) as d)::text;
  elsif p_clave = 'fechas' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'Las fechas no se entendieron.');
    end;
    if jsonb_typeof(j) is distinct from 'array' then
      return jsonb_build_object('ok', false, 'porque', 'Las fechas no se entendieron.');
    end if;
    if jsonb_array_length(j) > 100 then
      return jsonb_build_object('ok', false, 'porque', 'Hasta 100 fechas especiales.');
    end if;
    for x in select * from jsonb_array_elements(j) loop
      if coalesce(x->>'fecha', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or coalesce(x->>'modo', '') not in ('todo', 'no') then
        return jsonb_build_object('ok', false, 'porque', 'Cada fecha va con "todo el día" o "no atiende".');
      end if;
      begin
        perform (x->>'fecha')::date;
      exception when others then
        return jsonb_build_object('ok', false, 'porque', 'La fecha ' || (x->>'fecha') || ' no existe.');
      end;
      if length(coalesce(x->>'nota', '')) > 60 then
        return jsonb_build_object('ok', false, 'porque', 'La nota de una fecha es muy larga: hasta 60 letras.');
      end if;
    end loop;
    v := coalesce((
      select jsonb_agg(jsonb_build_object('fecha', t.f, 'modo', t.m, 'nota', t.n) order by t.fd)
        from (select distinct on ((z.e->>'fecha')::date)
                     (z.e->>'fecha')::date as fd, to_char((z.e->>'fecha')::date, 'YYYY-MM-DD') as f,
                     z.e->>'modo' as m, nullif(trim(coalesce(z.e->>'nota', '')), '') as n
                from jsonb_array_elements(j) with ordinality as z(e, i)
               order by (z.e->>'fecha')::date, z.i desc) t
       where t.fd >= hoy), '[]'::jsonb)::text;
  elsif p_clave in ('cupon_pct', 'segunda_pct') then
    if v !~ '^[0-9]{1,2}$' or v::int < 1 or v::int > 50 then
      return jsonb_build_object('ok', false, 'porque', 'El porcentaje va de 1 a 50.');
    end if;
  elsif p_clave = 'cupon_horas' then
    if v !~ '^[0-9]{1,3}$' or v::int < 1 or v::int > 168 then
      return jsonb_build_object('ok', false, 'porque', 'El cupón vence entre 1 y 168 horas (una semana).');
    end if;
  elsif p_clave = 'telegram_min' then
    if v !~ '^[0-9]{1,3}$' or v::int < 1 or v::int > 240 then
      return jsonb_build_object('ok', false, 'porque', 'La espera de Telegram va de 1 a 240 minutos.');
    end if;
  elsif p_clave in ('envio_gratis_desde', 'envio_piso') then
    if v !~ '^[0-9]{1,9}$' then
      return jsonb_build_object('ok', false, 'porque', 'Va un monto en pesos, sin puntos.');
    end if;
  elsif p_clave in ('derivar_ventas', 'derivar_posventa', 'derivar_logistica', 'derivar_nocompra', 'derivar_carritos') then
    if v = '' or length(v) > 40 then
      return jsonb_build_object('ok', false, 'porque', 'Falta el nombre (hasta 40 letras).');
    end if;
  /* ── Lo nuevo (SQL 85) ── */
  elsif p_clave in ('modelo', 'asis_modelo') then
    if v not in ('claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5') then
      return jsonb_build_object('ok', false, 'porque', 'Ese modelo no está entre los que se pueden elegir.');
    end if;
  elsif p_clave in ('tope_usd', 'asis_tope_usd') then
    if v !~ '^[0-9]{1,4}$' or v::int < 1 or v::int > 1000 then
      return jsonb_build_object('ok', false, 'porque', 'El tope del mes va de 1 a 1000 dólares.');
    end if;
  elsif p_clave = 'asis_saludo' then
    v := regexp_replace(replace(v, E'\r', ''), '\s+', ' ', 'g');
    if v = '' or length(v) > 120 then
      return jsonb_build_object('ok', false, 'porque', 'El saludo va de 1 a 120 letras.');
    end if;
  elsif p_clave = 'asis_sugeridas' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'Las preguntas sugeridas no se entendieron.');
    end;
    if jsonb_typeof(j) is distinct from 'array' or jsonb_array_length(j) > 6 then
      return jsonb_build_object('ok', false, 'porque', 'Hasta 6 preguntas sugeridas.');
    end if;
    for x in select * from jsonb_array_elements(j) loop
      t := regexp_replace(replace(coalesce(x #>> '{}', ''), E'\r', ''), '\s+', ' ', 'g');
      if jsonb_typeof(x) <> 'string' or btrim(t) = '' or length(btrim(t)) > 120 then
        return jsonb_build_object('ok', false, 'porque', 'Cada pregunta sugerida va de 1 a 120 letras.');
      end if;
    end loop;
    v := coalesce((select jsonb_agg(btrim(regexp_replace(replace(e #>> '{}', E'\r', ''), '\s+', ' ', 'g')) order by i)
                     from jsonb_array_elements(j) with ordinality as z(e, i)), '[]'::jsonb)::text;
  elsif p_clave = 'asis_accesos' then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'Los accesos no se entendieron.');
    end;
    if jsonb_typeof(j) is distinct from 'array' or jsonb_array_length(j) > 6 then
      return jsonb_build_object('ok', false, 'porque', 'Hasta 6 accesos rápidos.');
    end if;
    for x in select * from jsonb_array_elements(j) loop
      t := btrim(coalesce(x->>'titulo', ''));
      u := btrim(coalesce(x->>'url', ''));
      if jsonb_typeof(x) <> 'object' or t = '' or length(t) > 40 then
        return jsonb_build_object('ok', false, 'porque', 'Cada acceso lleva un nombre de 1 a 40 letras.');
      end if;
      if u !~* '^https://[^\s<>"]+$' or length(u) > 500 then
        return jsonb_build_object('ok', false, 'porque', 'El enlace de "' || t || '" tiene que empezar con https://');
      end if;
      if length(coalesce(x->>'nota', '')) > 60 then
        return jsonb_build_object('ok', false, 'porque', 'La nota de "' || t || '" es muy larga: hasta 60 letras.');
      end if;
    end loop;
    v := coalesce((select jsonb_agg(jsonb_build_object('titulo', btrim(e->>'titulo'), 'url', btrim(e->>'url'),
                                                       'nota', nullif(btrim(coalesce(e->>'nota', '')), '')) order by i)
                     from jsonb_array_elements(j) with ordinality as z(e, i)), '[]'::jsonb)::text;
  /* ── Las barandillas (SQL 87): dos listas de hasta 12 frases ── */
  elsif p_clave in ('barandillas', 'asis_barandillas') then
    begin
      j := v::jsonb;
    exception when others then
      return jsonb_build_object('ok', false, 'porque', 'Las barandillas no se entendieron.');
    end;
    if jsonb_typeof(j) is distinct from 'object' then
      return jsonb_build_object('ok', false, 'porque', 'Las barandillas no se entendieron.');
    end if;
    foreach k in array array['prohibidos', 'derivar'] loop
      x := coalesce(j->k, '[]'::jsonb);
      if jsonb_typeof(x) <> 'array' or jsonb_array_length(x) > 12 then
        return jsonb_build_object('ok', false, 'porque', 'Hasta 12 frases por lista.');
      end if;
      if exists (select 1 from jsonb_array_elements(x) e
                  where jsonb_typeof(e) <> 'string' or btrim(e #>> '{}') = '' or length(btrim(e #>> '{}')) > 200) then
        return jsonb_build_object('ok', false, 'porque', 'Cada frase va de 1 a 200 letras.');
      end if;
    end loop;
    v := jsonb_build_object(
      'prohibidos', coalesce((select jsonb_agg(btrim(regexp_replace(e #>> '{}', '\s+', ' ', 'g')) order by i)
                                from jsonb_array_elements(coalesce(j->'prohibidos', '[]'::jsonb)) with ordinality z(e, i)), '[]'::jsonb),
      'derivar', coalesce((select jsonb_agg(btrim(regexp_replace(e #>> '{}', '\s+', ' ', 'g')) order by i)
                             from jsonb_array_elements(coalesce(j->'derivar', '[]'::jsonb)) with ordinality z(e, i)), '[]'::jsonb))::text;
  else
    return jsonb_build_object('ok', false, 'porque', 'Esa regla no existe.');
  end if;
  return jsonb_build_object('ok', true, 'valor', v);
end;
$$;
revoke execute on function agente_regla_valida(text, text) from public, anon, authenticated;

create or replace function agente_contexto(p_clave text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'clave', k.clave,
    'reglas', coalesce((select jsonb_object_agg(r.clave, r.valor) from agente_reglas r where r.clave not like 'asis\_%' and r.clave <> 'barandillas'), '{}'::jsonb),
    'conocimiento', (select string_agg('## ' || f.titulo || E'\n' || f.contenido, E'\n\n' order by f.id)
                       from agente_fuentes f
                      where f.publico = 'clientes' and f.prendida and f.borrada is null),
    'fuentes', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'tipo', f.tipo, 'titulo', f.titulo, 'tema', f.tema,
                                                             'contenido', f.contenido) order by f.id)
                           from agente_fuentes f
                          where f.publico = 'clientes' and f.prendida and f.borrada is null), '[]'::jsonb),
    'instrucciones', agente_instrucciones_de('clientes'),
    'barandillas', coalesce((select r.valor::jsonb from agente_reglas r where r.clave = 'barandillas'), '{}'::jsonb),
    'gasto', jsonb_build_object(
      'usd', coalesce((select g.usd from agente_gasto g where g.agente = 'clientes' and g.mes = agente_mes()), 0),
      'tope', coalesce((select r.valor from agente_reglas r where r.clave = 'tope_usd'), '20')::numeric),
    'catalogo', agente_catalogo(),
    'ahora', agente_atiende(now()),
    'puede', agente_puede(k.clave, null),
    'hoy', (array['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'])[extract(dow from now() at time zone 'America/Argentina/Buenos_Aires')::int + 1] || ' ' ||
            to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY HH24:MI'),
    'nombre', coalesce(wa_agenda_nombre(k.clave),
                       (select nullif(trim(m.perfil), '') from wa_mensajes m
                         where club_tel10(m.tel) = k.clave and nullif(trim(m.perfil), '') is not null
                         order by m.cuando desc limit 1)),
    'ultimo_id', (select max(m.id) from wa_mensajes m where club_tel10(m.tel) = k.clave),
    'ultimo_entra_id', (select max(m.id) from wa_mensajes m where club_tel10(m.tel) = k.clave and m.sentido = 'entra'),
    'numero_id', (select m.numero_id from wa_mensajes m where club_tel10(m.tel) = k.clave order by m.cuando desc, m.id desc limit 1),
    'mensajes', coalesce((
      select jsonb_agg(jsonb_build_object('id', w.id, 'de', case when w.sentido = 'entra' then 'cliente' else 'vdh' end,
                                          'tipo', w.tipo, 'texto', w.texto,
                                          'cuando', to_char(w.cuando at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI'))
                       order by w.cuando, w.id)
        from (select * from wa_mensajes m where club_tel10(m.tel) = k.clave and m.tipo is distinct from 'reaction'
               order by m.cuando desc, m.id desc limit 30) w), '[]'::jsonb))
  from (select club_tel10(p_clave) as clave) k
  where k.clave is not null
$$;
revoke execute on function agente_contexto(text) from public, anon, authenticated;
grant execute on function agente_contexto(text) to service_role;

create or replace function agente_config(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return jsonb_build_object(
    'reglas', coalesce((select jsonb_object_agg(r.clave, r.valor) from agente_reglas r), '{}'::jsonb),
    'numero', (select n.nombre from wa_numeros n
                where n.numero_id = (select r.valor from agente_reglas r where r.clave = 'numero_id')),
    'conocimiento', (select jsonb_build_object('texto', t.texto,
                              'actualizado', to_char(t.creado at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD'))
                       from agente_textos t order by t.creado desc, t.id desc limit 1),
    'versiones', (select count(*) from agente_textos),
    'ahora', agente_atiende(now()),
    'gasto', coalesce((select jsonb_object_agg(g.agente, jsonb_build_object('usd', round(g.usd, 2), 'consultas', g.consultas))
                         from agente_gasto g where g.mes = agente_mes()), '{}'::jsonb),
    'fuentes', (select jsonb_build_object(
                  'n', count(*),
                  'prendidas', count(*) filter (where f.prendida),
                  'bytes', coalesce(sum(octet_length(f.contenido)) filter (where f.prendida), 0),
                  'bytes_clientes', coalesce(sum(octet_length(f.contenido)) filter (where f.prendida and f.publico = 'clientes'), 0),
                  'avisos', count(*) filter (where f.aviso is not null))
                  from agente_fuentes f where f.borrada is null),
    'marcadas', (select count(*) from asistente_mensajes m where m.voto = -1 and not m.revisada),
    'eco', agente_eco_ok(),
    'pausas', (select count(*) from agente_pausas p where p.motivo = 'manual'));
end;
$$;
revoke execute on function agente_config(text) from public;
grant execute on function agente_config(text) to anon, authenticated;

create or replace function agente_borrador_guardar(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  k text := club_tel10(p->>'clave');
  nuevo bigint;
begin
  if k is null or nullif(trim(coalesce(p->>'texto', '')), '') is null then
    return jsonb_build_object('ok', false, 'porque', 'Falta la persona o el texto.');
  end if;
  update agente_borradores set estado = 'viejo', resuelto = now() where clave = k and estado = 'pendiente';
  /* SQL 88: lo que mandó solo (en automático) queda "enviado", por el agente. */
  insert into agente_borradores (clave, numero_id, ultimo_id, texto, derivar, productos, herramientas, origen,
                                 pedido_por, modelo, tokens, ms, estado, final, quien, resuelto)
  values (k, p->>'numero_id', nullif(p->>'ultimo_id', '')::bigint, left(p->>'texto', 4000), p->'derivar',
          coalesce(p->'productos', '[]'::jsonb), coalesce(p->'herramientas', '[]'::jsonb),
          coalesce(nullif(p->>'origen', ''), 'pedido'), left(p->>'pedido_por', 60), p->>'modelo', p->'tokens',
          nullif(p->>'ms', '')::integer,
          case when p->>'estado' = 'enviado' then 'enviado' else 'pendiente' end,
          case when p->>'estado' = 'enviado' then left(p->>'texto', 4000) end,
          case when p->>'estado' = 'enviado' then 'Agente (automático)' end,
          case when p->>'estado' = 'enviado' then now() end)
  returning id into nuevo;
  return jsonb_build_object('ok', true, 'id', nuevo);
end;
$$;
revoke execute on function agente_borrador_guardar(jsonb) from public, anon, authenticated;
grant execute on function agente_borrador_guardar(jsonb) to service_role;

create or replace function wa_anotar_envio(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id bigint;
begin
  insert into wa_mensajes (wamid, numero_id, numero, tel, sentido, desde, tipo, texto, media, quien, cuando)
  values (p->>'wamid', p->>'numero_id', p->>'numero', p->>'tel', 'sale',
          case when p->>'desde' = 'agente' then 'agente' else 'crm' end, coalesce(nullif(p->>'tipo', ''), 'text'),
          p->>'texto', p->'media', nullif(trim(p->>'quien'), ''), now())
  on conflict (wamid) do update
    set desde = excluded.desde, tipo = excluded.tipo, texto = excluded.texto, media = excluded.media, quien = excluded.quien
    where wa_mensajes.desde = 'otra_app'
  returning id into v_id;
  perform crm_consulta_mensaje(p->>'tel', p->>'numero_id', 'sale', p->>'texto', now(), nullif(trim(p->>'quien'), ''));
  return jsonb_build_object('id', v_id);
end;
$function$;

/* Para la función del agente: a quién y desde qué número, sin PIN (sólo la
   llave de servicio), dentro de las 24 horas. */
create or replace function wa_preparar_envio_agente(p_clave text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tel text; v_numero_id text; v_numero text; v_cuando timestamptz;
begin
  select m.tel, m.numero_id, m.numero, m.cuando into v_tel, v_numero_id, v_numero, v_cuando
    from wa_mensajes m
   where club_tel10(m.tel) = club_tel10(p_clave) and m.sentido = 'entra'
   order by m.cuando desc, m.id desc
   limit 1;
  if v_tel is null then return jsonb_build_object('ok', false, 'motivo', 'sin_conversacion'); end if;
  if v_cuando + interval '24 hours' < now() then return jsonb_build_object('ok', false, 'motivo', 'ventana'); end if;
  return jsonb_build_object('ok', true, 'tel', v_tel, 'numero_id', v_numero_id, 'numero', v_numero);
end;
$$;
revoke execute on function wa_preparar_envio_agente(text) from public, anon, authenticated;
grant execute on function wa_preparar_envio_agente(text) to service_role;

/* Cuando le pasa la charla a una persona (en automático): se pausa en esa
   charla hasta que alguien le conteste al cliente (si ya había una pausa
   manual, queda la manual) y avisa por Telegram. */
create or replace function agente_pausar_derivada(p_clave text, p_resumen text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  k text := club_tel10(p_clave);
begin
  if k is null then return jsonb_build_object('ok', false); end if;
  insert into agente_pausas (clave, motivo, quien, nota) values (k, 'deriva', 'Agente', left(p_resumen, 500))
  on conflict (clave) do update set motivo = 'deriva', quien = 'Agente', nota = excluded.nota, desde = now()
    where agente_pausas.motivo <> 'manual';
  return jsonb_build_object('ok', true);
end;
$$;
revoke execute on function agente_pausar_derivada(text, text) from public, anon, authenticated;
grant execute on function agente_pausar_derivada(text, text) to service_role;

create or replace function agente_avisar_derivacion(p_clave text, p_a text, p_area text, p_resumen text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  k   text := club_tel10(p_clave);
  nom text := coalesce(wa_agenda_nombre(k), (select nullif(trim(m.perfil), '') from wa_mensajes m
                                              where club_tel10(m.tel) = k and nullif(trim(m.perfil), '') is not null order by m.cuando desc limit 1));
begin
  return agente_aviso_telegram('🤖 El agente de la tienda le pasó una charla a ' || coalesce(nullif(p_a, ''), 'una persona') ||
    coalesce(' (' || nullif(p_area, '') || ')', '') || ': ' || coalesce(nom || ' — ', '') || left(coalesce(p_resumen, ''), 600) ||
    E'\nEstá en el CRM → Mensajes.');
end;
$$;
revoke execute on function agente_avisar_derivacion(text, text, text, text) from public, anon, authenticated;
grant execute on function agente_avisar_derivacion(text, text, text, text) to service_role;

/* ═══ El CRM (con el PIN, sin tirar error) ═══════════════════════════════
   El estado del agente en una charla y el botón para pausarlo. */
create or replace function agente_charla_estado(p_pin text, p_clave text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r jsonb := pin_ok(p_pin);
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  return agente_puede(p_clave, null) || jsonb_build_object(
    'modo', coalesce((select x.valor from agente_reglas x where x.clave = 'modo'), 'prueba'),
    'pausa', (select jsonb_build_object('motivo', p.motivo, 'quien', p.quien, 'desde', p.desde) from agente_pausas p where p.clave = club_tel10(p_clave)));
end;
$$;
revoke execute on function agente_charla_estado(text, text) from public;
grant execute on function agente_charla_estado(text, text) to anon, authenticated;

create or replace function agente_pausar(p_pin text, p_clave text, p_si boolean, p_quien text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r jsonb := pin_ok(p_pin);
  k text := club_tel10(p_clave);
begin
  if not coalesce((r->>'ok')::boolean, false) then return agente_pin_mal(r); end if;
  if k is null then return jsonb_build_object('ok', false, 'porque', 'Esa charla no existe.'); end if;
  if coalesce(p_si, true) then
    insert into agente_pausas (clave, motivo, quien) values (k, 'manual', left(nullif(btrim(coalesce(p_quien, '')), ''), 60))
    on conflict (clave) do update set motivo = 'manual', quien = excluded.quien, nota = null, desde = now();
  else
    delete from agente_pausas where clave = k;
  end if;
  return jsonb_build_object('ok', true, 'estado', agente_puede(k, null));
end;
$$;
revoke execute on function agente_pausar(text, text, boolean, text) from public;
grant execute on function agente_pausar(text, text, boolean, text) to anon, authenticated;

select 'listo: el agente de clientes en WhatsApp, conviviendo con el equipo' as "SQL 88";
