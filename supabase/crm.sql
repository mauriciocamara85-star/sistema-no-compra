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
