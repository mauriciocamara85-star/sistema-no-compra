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
