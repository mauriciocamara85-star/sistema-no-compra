-- ═══ Sistema VDH · Ventas del local (octubre 2026) ═══
-- Reemplaza las planillas de Google de cada local: Ventas, Tráfico, Informe Vendedor e Informe Temporada.
-- Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Crea las tablas ventas_* (vacías) y las funciones que usa la pantalla Ventas. No toca nada de lo que ya existe.
--   · Quién carga: cualquiera del local (con su usuario) o la compu habilitada del local (la misma llave de Cobrar).
--     El encargado, los supervisores de ese local, Administración y Atención al cliente también. Gerencia mira.
--   · Un mes pasado se completa hasta el 7 del mes siguiente; después lo corrige sólo Administración.
--     Antes de septiembre de 2026 no hay nada (el sistema empieza ahí).
--   · El dashboard sigue con las planillas: la conexión es otro archivo (ventas-dashboard.sql), para más adelante.
--   · Reversible: borrar las tablas ventas_* y las funciones ventas_* (la lista está al final).

-- =====================================================================
-- Cómo está pensado
--
-- Es la planilla del local, mes por mes, con los mismos datos que se cargan
-- a mano (lo ámbar y la carga diaria). Las cuentas (objetivos por día,
-- desvíos, proyecciones, rankings, escalón, tráfico necesario, informe por
-- vendedor y temporada) NO se guardan: las hace la pantalla con las mismas
-- fórmulas de la planilla, así hay una sola forma de calcular.
--
-- El reparto del objetivo (el % de cada día dentro de su semana y el % de
-- cada semana dentro del mes) es propio de cada local y de cada mes: en las
-- planillas es distinto en los de calle (domingo en 0), los shoppings y Mar
-- del Plata, y algunos tienen días en 0 por feriados. Por eso va por local.
--
-- Las semanas son las de la planilla: la 1 va del día 1 al primer domingo, y
-- de ahí de lunes a domingo. Un mes tiene 4, 5 o 6.
--
-- Todo se lee y se escribe con funciones (security definer): las tablas no
-- se abren a nadie. Cada cambio queda anotado en ventas_cambios (quién, qué,
-- antes y después).
-- =====================================================================

-- ---------- El mes de cada local: lo ámbar de Ventas, Tráfico e Informe Vendedor ----------
create table if not exists ventas_mes (
  local_id        uuid not null references orden_locales(id) on delete cascade,
  mes             date not null check (extract(day from mes) = 1),
  objetivo        numeric(14,2),            -- Objetivo mensual del local
  conversion      numeric(9,6),             -- Conversión objetivo (0,5 = 50%)
  ticket          numeric(12,2),            -- Ticket promedio objetivo
  dias_habiles    smallint,                 -- Días hábiles del mes
  efectivo        numeric(14,2),            -- Efectivo acumulado del mes
  descuento       numeric(14,2),            -- Descuento acumulado del mes
  q_lineas        integer,                  -- Prendas por ticket: Q líneas (tickets)
  q_prendas       integer,                  -- Prendas por ticket: Q prendas
  pxt_obj         numeric(9,6),             -- Informe Vendedor: PxT objetivo
  factor          numeric(9,6),             -- Informe Vendedor: factor perfumes y boxer
  precio_perfume  numeric(12,2),
  precio_boxer    numeric(12,2),
  premios         numeric(12,2)[] not null default '{null,null,null,null}',  -- escalón: objetivo, +10, +20, +30
  /* true: el objetivo semanal de cada vendedor se ajusta por los días que trabajó (la tabla de
     Informe Vendedor que tenía sólo Rivadavia). false: objetivo × % × peso de la semana, como
     los otros 13 locales. Cada mes nuevo hereda el del anterior. */
  con_dias        boolean not null default true,
  actualizado_en  timestamptz not null default now(),
  primary key (local_id, mes)
);

-- ---------- El reparto del objetivo ----------
create table if not exists ventas_dias (
  local_id  uuid not null references orden_locales(id) on delete cascade,
  fecha     date not null,
  peso      numeric(9,6) not null default 0 check (peso >= 0 and peso <= 1),  -- % del día dentro de su semana
  primary key (local_id, fecha)
);
create table if not exists ventas_semanas (
  local_id  uuid not null references orden_locales(id) on delete cascade,
  mes       date not null check (extract(day from mes) = 1),
  semana    smallint not null check (semana between 1 and 6),
  peso      numeric(9,6) not null default 0 check (peso >= 0 and peso <= 1),  -- % de la semana dentro del mes
  primary key (local_id, mes, semana)
);

-- ---------- Los vendedores de cada mes, con su % del objetivo ----------
-- nombre '' es la fila sin nombre de la planilla: lo que se cargó ahí suma al
-- local pero no es de nadie ("Sin vendedor", hasta que alguien lo asigne).
create table if not exists ventas_vendedores (
  id          bigint generated always as identity primary key,
  local_id    uuid not null references orden_locales(id) on delete cascade,
  mes         date not null check (extract(day from mes) = 1),
  nombre      text not null default '',
  pct         numeric(9,6) not null default 0 check (pct >= 0 and pct <= 1),
  persona_id  uuid references orden_personas(id) on delete set null,   -- el mismo de Equipo VDH (francos)
  orden       smallint not null default 0,
  creado_en   timestamptz not null default now()
);
create index if not exists ventas_vendedores_mes on ventas_vendedores (local_id, mes);

-- ---------- La venta de cada vendedor, día por día ----------
create table if not exists ventas_diarias (
  vendedor_id  bigint not null references ventas_vendedores(id) on delete cascade,
  fecha        date not null,
  monto        numeric(14,2) not null,
  cargado_en   timestamptz not null default now(),
  cargado_por  text,
  primary key (vendedor_id, fecha)
);

-- ---------- Tráfico: tráfico real, conversión real y ticket real del día ----------
create table if not exists ventas_trafico (
  local_id     uuid not null references orden_locales(id) on delete cascade,
  fecha        date not null,
  trafico      integer check (trafico >= 0),
  conversion   numeric(9,6) check (conversion >= 0 and conversion <= 5),
  ticket       numeric(12,2) check (ticket >= 0),
  cargado_en   timestamptz not null default now(),
  cargado_por  text,
  primary key (local_id, fecha)
);

-- ---------- Informe Vendedor: lo real de cada semana y los días que trabajó ----------
-- dias vacío = los días hábiles de esa semana (como viene la planilla: hasta 6).
-- Cambia el objetivo semanal de cada vendedor (ver la pantalla).
create table if not exists ventas_semanal (
  vendedor_id  bigint not null references ventas_vendedores(id) on delete cascade,
  semana       smallint not null check (semana between 1 and 6),
  dias         numeric(3,1) check (dias >= 0 and dias <= 7),
  trafico      integer check (trafico >= 0),
  conversion   numeric(9,6) check (conversion >= 0 and conversion <= 5),
  ticket       numeric(12,2) check (ticket >= 0),
  perfumes     integer check (perfumes >= 0),
  boxer        integer check (boxer >= 0),
  pxt          numeric(9,6) check (pxt >= 0),
  cargado_en   timestamptz not null default now(),
  cargado_por  text,
  primary key (vendedor_id, semana)
);

-- ---------- El reparto de una semana entre los vendedores, a mano ----------
-- Pedido de Mauricio (26/10/2026): Mel (Rivadavia) se fue de vacaciones las semanas 4 y 5 de octubre y
-- su objetivo de esas semanas lo tenía que tener Lucas. Si una semana tiene alguna fila acá, esa semana
-- se reparte así (el vendedor que no tiene fila va en 0); si no, con el % del mes (ventas-calc.js).
create table if not exists ventas_reparto (
  vendedor_id  bigint not null references ventas_vendedores(id) on delete cascade,
  semana       smallint not null check (semana between 1 and 6),
  pct          numeric(9,6) not null check (pct >= 0 and pct <= 1),
  motivo       text,
  cargado_en   timestamptz not null default now(),
  cargado_por  text,
  primary key (vendedor_id, semana)
);

-- ---------- Informe Temporada: la venta del semestre anterior, mes por mes ----------
create table if not exists ventas_temporada (
  local_id        uuid not null references orden_locales(id) on delete cascade,
  mes             date not null check (extract(day from mes) = 1),   -- el mes de ESTE semestre
  venta_anterior  numeric(14,2),
  primary key (local_id, mes)
);

-- ---------- Quién cambió qué ----------
create table if not exists ventas_cambios (
  id          bigint generated always as identity primary key,
  local_id    uuid not null,
  mes         date,
  en          timestamptz not null default now(),
  quien       text,
  persona_id  uuid,
  que         text not null,
  clave       text,
  antes       text,
  despues     text
);
create index if not exists ventas_cambios_local on ventas_cambios (local_id, en desc);

/* La seguridad de cada tabla se activa sólo si falta: "alter table" traba la tabla entera hasta que termina
   el SQL, y con los locales cargando, volver a correr este archivo dejaba la pantalla Ventas colgada. */
do $rls$
declare t text;
begin
  foreach t in array array['ventas_mes', 'ventas_dias', 'ventas_semanas', 'ventas_vendedores', 'ventas_diarias',
                           'ventas_trafico', 'ventas_semanal', 'ventas_temporada', 'ventas_cambios', 'ventas_reparto'] loop
    if not (select relrowsecurity from pg_class where oid = t::regclass) then
      execute format('alter table %I enable row level security', t);
    end if;
  end loop;
end $rls$;
revoke all on ventas_mes, ventas_dias, ventas_semanas, ventas_vendedores, ventas_diarias,
              ventas_trafico, ventas_semanal, ventas_temporada, ventas_cambios, ventas_reparto from public, anon, authenticated;
grant all on ventas_mes, ventas_dias, ventas_semanas, ventas_vendedores, ventas_diarias,
             ventas_trafico, ventas_semanal, ventas_temporada, ventas_cambios, ventas_reparto to service_role;

-- =====================================================================
-- Ayudas
-- =====================================================================

/* Hoy en Argentina (la base está en UTC: después de las 21 h, current_date ya es mañana). */
create or replace function ventas_hoy() returns date
language sql stable as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

/* El primer día del mes de una fecha. */
create or replace function ventas_mes_de(p date) returns date
language sql immutable as $$ select p - (extract(day from p)::int - 1) $$;

/* La semana de la planilla: la 1 va del día 1 al primer domingo; después, de lunes a domingo. */
create or replace function ventas_semana(p date) returns smallint
language sql immutable as $$
  select ((extract(day from p)::int - 1 + extract(isodow from ventas_mes_de(p))::int - 1) / 7 + 1)::smallint
$$;

/* Un número que llega como texto ("34500", "0.5"); vacío = nada. Lo que no es número, error claro. */
create or replace function ventas_numero(p text) returns numeric
language plpgsql immutable as $$
declare v numeric;
begin
  if p is null or btrim(p) = '' then return null; end if;
  begin
    v := btrim(p)::numeric;
  exception when others then
    raise exception 'ventas: "%" no es un número', left(p, 30);
  end;
  if abs(v) >= 10000000000 then raise exception 'ventas: el número es demasiado grande'; end if;
  return v;
end $$;

/* ¿Quién está pidiendo y qué puede hacer en ese local?
   'escribir': gente del local (vendedor o encargado), el supervisor de ese
   local, Administración, Atención al cliente o la compu habilitada del local.
   'ver': Gerencia.
   Volátil porque la llave de la compu anota su último uso. */
create or replace function ventas_acceso(p_local uuid, p_caja text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_codigo text;
  v_yo     uuid;
  v_nombre text;
  v_local  text;
begin
  select codigo into v_codigo from orden_locales where id = p_local and activo;
  if not found then return jsonb_build_object('puede', null); end if;
  if orden_es_servicio() then
    return jsonb_build_object('puede', 'escribir', 'quien', 'Sistema', 'supervisa', true);
  end if;
  v_yo := orden_yo_id();
  if v_yo is not null then
    select nombre into v_nombre from orden_personas where id = v_yo;
    if orden_es_supervisor_de(p_local) then
      return jsonb_build_object('puede', 'escribir', 'quien', v_nombre, 'persona', v_yo, 'supervisa', true);
    end if;
    if orden_es_del_local(p_local) then
      return jsonb_build_object('puede', 'escribir', 'quien', v_nombre, 'persona', v_yo, 'supervisa', false);
    end if;
    /* Atención al cliente, en todos los locales: hay quien atiende y también vende en un local
       (Lautaro, Mauricio el 15/10: "tendría que tener acceso a las planillas y todo"). */
    if exists (select 1 from orden_personas where id = v_yo and rol = 'atencion' and activo and aprobado) then
      return jsonb_build_object('puede', 'escribir', 'quien', v_nombre, 'persona', v_yo, 'supervisa', false);
    end if;
    if orden_ve_local(p_local) then
      return jsonb_build_object('puede', 'ver', 'quien', v_nombre, 'persona', v_yo, 'supervisa', false);
    end if;
  end if;
  if p_caja like 'caja\_%' then
    v_local := club_caja_local(p_caja);
    if v_local is not null and upper(btrim(v_local)) = upper(btrim(coalesce(v_codigo, ''))) then
      return jsonb_build_object('puede', 'escribir', 'quien', 'Compu del local', 'supervisa', false);
    end if;
  end if;
  return jsonb_build_object('puede', null);
end $$;

/* El mes también manda: un mes pasado se termina de cargar hasta el 7 del mes siguiente (los
   últimos días y el informe de la última semana); después queda CERRADO y sólo lo corrige
   Administración. Antes de septiembre de 2026 (el primero que pasó de la planilla) no hay nada.
   Toma lo que dijo ventas_acceso y le suma 'cerrado' y 'carga_hasta' (y baja a 'ver' si cerró). */
create or replace function ventas_acceso_mes(a jsonb, p_mes date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_mes   date := ventas_mes_de(p_mes);
  v_hasta date := (ventas_mes_de(p_mes) + interval '1 month' + interval '6 days')::date;
  v_cerr  boolean;
begin
  if v_mes < date '2026-09-01' then
    return a || jsonb_build_object('cerrado', true, 'carga_hasta', null, 'por_cierre', a->>'puede' = 'escribir',
                                   'puede', case when a->>'puede' is null then null else 'ver' end);
  end if;
  v_cerr := ventas_hoy() > v_hasta;
  a := a || jsonb_build_object('cerrado', v_cerr, 'carga_hasta', v_hasta);
  if v_cerr and a->>'puede' = 'escribir' and not orden_es_admin() then
    a := a || jsonb_build_object('puede', 'ver', 'por_cierre', true);
  end if;
  return a;
end $$;

/* Corta si quien pide no puede cargar en ese local y mes (lo que devolvió ventas_acceso_mes). */
create or replace function ventas_exigir(a jsonb)
returns void language plpgsql immutable as $$
begin
  if a->>'puede' = 'escribir' then return; end if;
  if coalesce((a->>'por_cierre')::boolean, false) then
    if a->>'carga_hasta' is null then
      raise exception 'ventas: ese mes es de antes del sistema (empezó en septiembre de 2026)';
    end if;
    raise exception 'ventas: ese mes ya cerró (se cargaba hasta el %): si hay que corregir algo, lo hace Administración',
      to_char((a->>'carga_hasta')::date, 'DD/MM');
  end if;
  raise exception 'ventas: no podés cargar en este local' using hint = 'Entrá con tu usuario del local o usá la compu habilitada.';
end $$;

/* El reparto de un mes que no tiene: el mismo patrón del mes anterior (el %
   de cada día de la semana); si no hay mes anterior, parejo entre los días
   que abre el local. Dentro de cada semana los días suman 100%, y las
   semanas suman 100% en el mes, en proporción a lo que pesan sus días. */
create or replace function ventas_reparto_inicial(p_local uuid, p_mes date)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_ant      date := (p_mes - interval '1 month')::date;
  v_abiertos smallint[];
  v_perfil   numeric[] := array[0,0,0,0,0,0,0]::numeric[];
  v_hay      boolean;
  i          int;
begin
  if exists (select 1 from ventas_dias where local_id = p_local and fecha >= p_mes and fecha < (p_mes + interval '1 month')::date) then
    return;
  end if;
  /* El perfil del mes anterior: el promedio de cada día de la semana en las semanas completas. */
  select count(*) > 0 into v_hay from ventas_dias d
   where d.local_id = p_local and d.fecha >= v_ant and d.fecha < p_mes;
  if v_hay then
    for i in 1..7 loop
      v_perfil[i] := (
        select coalesce(avg(d.peso), 0)
          from ventas_dias d
         where d.local_id = p_local and d.fecha >= v_ant and d.fecha < p_mes
           and extract(isodow from d.fecha) = i
           and (select count(*) from generate_series(v_ant, (p_mes - 1), interval '1 day') g
                 where ventas_semana(g::date) = ventas_semana(d.fecha)) = 7);
    end loop;
  end if;
  if not v_hay or (select sum(x) from unnest(v_perfil) x) = 0 then
    select dias_abiertos into v_abiertos from orden_locales where id = p_local;
    for i in 1..7 loop
      v_perfil[i] := case when i = any(coalesce(v_abiertos, '{1,2,3,4,5,6}')) then 1 else 0 end;
    end loop;
  end if;

  insert into ventas_dias (local_id, fecha, peso)
  select p_local, d.fecha,
         round(case when sum(v_perfil[extract(isodow from d.fecha)::int]) over (partition by ventas_semana(d.fecha)) = 0 then 0
                    else v_perfil[extract(isodow from d.fecha)::int]
                         / sum(v_perfil[extract(isodow from d.fecha)::int]) over (partition by ventas_semana(d.fecha)) end, 4)
    from (select g::date as fecha from generate_series(p_mes, (p_mes + interval '1 month - 1 day')::date, interval '1 day') g) d
  on conflict do nothing;

  insert into ventas_semanas (local_id, mes, semana, peso)
  select p_local, p_mes, s.semana,
         round(case when sum(s.bruto) over () = 0 then 0 else s.bruto / sum(s.bruto) over () end, 4)
    from (select ventas_semana(g::date) as semana, sum(v_perfil[extract(isodow from g::date)::int]) as bruto
            from generate_series(p_mes, (p_mes + interval '1 month - 1 day')::date, interval '1 day') g
           group by 1) s
  on conflict do nothing;
end $$;

/* Abre un mes que todavía no existe: copia del mes anterior lo que sigue
   igual (conversión y ticket objetivo, PxT, factor, precios, premios y los
   vendedores con su %). El objetivo, el efectivo, el descuento y las prendas
   arrancan vacíos: son de cada mes. Devuelve true si lo creó. */
create or replace function ventas_mes_abrir(p_local uuid, p_mes date)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  v_ant  date := (p_mes - interval '1 month')::date;
  a      ventas_mes%rowtype;
  v_dias smallint;
begin
  if exists (select 1 from ventas_mes where local_id = p_local and mes = p_mes) then return false; end if;
  select * into a from ventas_mes where local_id = p_local and mes = v_ant;
  perform ventas_reparto_inicial(p_local, p_mes);
  select count(*) into v_dias from ventas_dias
   where local_id = p_local and fecha >= p_mes and fecha < (p_mes + interval '1 month')::date and peso > 0;
  insert into ventas_mes (local_id, mes, conversion, ticket, dias_habiles, pxt_obj, factor, precio_perfume, precio_boxer, premios, con_dias)
  values (p_local, p_mes, coalesce(a.conversion, 0.5), coalesce(a.ticket, 80000), nullif(v_dias, 0),
          coalesce(a.pxt_obj, 2.5), a.factor, a.precio_perfume, a.precio_boxer,
          coalesce(a.premios, '{null,null,null,null}'), coalesce(a.con_dias, true))
  on conflict do nothing;
  if not found then return false; end if;
  insert into ventas_vendedores (local_id, mes, nombre, pct, persona_id, orden)
  select p_local, p_mes, v.nombre, v.pct, v.persona_id, v.orden
    from ventas_vendedores v
   where v.local_id = p_local and v.mes = v_ant and v.nombre <> ''
   order by v.orden, v.id;
  return true;
end $$;

/* Anota un cambio. */
create or replace function ventas_anotar(p_local uuid, p_mes date, a jsonb, p_que text, p_clave text, p_antes text, p_despues text)
returns void language sql volatile security definer set search_path = public as $$
  insert into ventas_cambios (local_id, mes, quien, persona_id, que, clave, antes, despues)
  values (p_local, p_mes, a->>'quien', nullif(a->>'persona', '')::uuid, p_que, p_clave, p_antes, p_despues)
$$;

-- =====================================================================
-- Lo que usa la pantalla
-- =====================================================================

/** Los locales que puede abrir quien pide (con su usuario o la compu habilitada). */
create or replace function ventas_locales(p_caja text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'codigo', x.codigo,
                                               'puede', x.a->>'puede', 'supervisa', (x.a->>'supervisa')::boolean)
                            order by x.nombre), '[]'::jsonb)
    into r
    from (select l.id, l.nombre, l.codigo, ventas_acceso(l.id, p_caja) as a
            from orden_locales l where l.activo) x
   where x.a->>'puede' is not null;
  return r;
end $$;

/** Un mes de un local, entero: lo cargado, el reparto y los vendedores (con sus francos de Equipo VDH).
    Si el mes no existe y quien pide puede cargar, lo abre (sólo hasta el mes que viene; nunca uno cerrado). */
create or replace function ventas_mes_leer(p_local uuid, p_mes date, p_caja text default null, p_abrir boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  a      jsonb := ventas_acceso_mes(ventas_acceso(p_local, p_caja), p_mes);
  v_mes  date  := ventas_mes_de(p_mes);
begin
  if a->>'puede' is null then
    raise exception 'ventas: sin acceso a este local' using hint = 'Entrá con tu usuario del local o usá la compu habilitada.';
  end if;
  if p_abrir and a->>'puede' = 'escribir' and v_mes <= ventas_mes_de((ventas_hoy() + interval '1 month')::date) then
    perform ventas_mes_abrir(p_local, v_mes);
  end if;
  return ventas_mes_datos(p_local, v_mes, a);
end $$;

/** Lo que devuelve ventas_mes_leer, sin mirar quién pide (a = lo que dijo ventas_acceso).
    Interna: la usan ventas_mes_leer y ventas_tablero (ventas-tablero.sql, lo que lee el dashboard)
    para armar sus tablas; nadie de afuera. */
create or replace function ventas_mes_datos(p_local uuid, p_mes date, a jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_mes  date  := ventas_mes_de(p_mes);
  v_fin  date  := (ventas_mes_de(p_mes) + interval '1 month')::date;
  m      ventas_mes%rowtype;
  r      jsonb;
begin
  select * into m from ventas_mes where local_id = p_local and mes = v_mes;

  select jsonb_build_object(
    'hoy', ventas_hoy(),
    'mes', v_mes,
    'existe', m.local_id is not null,
    'puede', a->>'puede',
    'supervisa', coalesce((a->>'supervisa')::boolean, false),
    'cerrado', coalesce((a->>'cerrado')::boolean, false),
    'carga_hasta', a->'carga_hasta',
    'quien', a->>'quien',
    'local', (select jsonb_build_object('id', l.id, 'nombre', l.nombre, 'codigo', l.codigo, 'dias_abiertos', l.dias_abiertos)
                from orden_locales l where l.id = p_local),
    'cfg', case when m.local_id is null then null else jsonb_build_object(
             'objetivo', m.objetivo, 'conversion', m.conversion, 'ticket', m.ticket, 'dias_habiles', m.dias_habiles,
             'efectivo', m.efectivo, 'descuento', m.descuento, 'q_lineas', m.q_lineas, 'q_prendas', m.q_prendas,
             'pxt_obj', m.pxt_obj, 'factor', m.factor, 'precio_perfume', m.precio_perfume, 'precio_boxer', m.precio_boxer,
             'premios', to_jsonb(m.premios), 'con_dias', m.con_dias) end,
    'vendedores', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'nombre', v.nombre, 'pct', v.pct, 'persona', v.persona_id,
                                          'francos', coalesce(to_jsonb(p.dias_libres), '[]'::jsonb),
                                          /* SQL 181: sus vacaciones de este mes (Config → Usuarios): [primer día, último día, motivo]. */
                                          'vacaciones', coalesce((
                                            select jsonb_agg(jsonb_build_array(extract(day from greatest(au.desde, v_mes))::int,
                                                                               extract(day from least(au.hasta, v_fin - 1))::int, au.motivo) order by au.desde)
                                              from orden_ausencias au
                                             where au.persona_id = v.persona_id and au.desde < v_fin and au.hasta >= v_mes), '[]'::jsonb))
                       order by (v.nombre = ''), v.orden, v.id)
        from ventas_vendedores v left join orden_personas p on p.id = v.persona_id
       where v.local_id = p_local and v.mes = v_mes), '[]'::jsonb),
    /* El reparto a mano de alguna semana: [vendedor, semana, %, motivo]. */
    'reparto', coalesce((
      select jsonb_agg(jsonb_build_array(r.vendedor_id, r.semana, r.pct, r.motivo) order by r.vendedor_id, r.semana)
        from ventas_reparto r join ventas_vendedores v on v.id = r.vendedor_id
       where v.local_id = p_local and v.mes = v_mes), '[]'::jsonb),
    'ventas', coalesce((
      select jsonb_agg(jsonb_build_array(d.vendedor_id, extract(day from d.fecha)::int, d.monto))
        from ventas_diarias d join ventas_vendedores v on v.id = d.vendedor_id
       where v.local_id = p_local and v.mes = v_mes), '[]'::jsonb),
    'trafico', coalesce((
      select jsonb_agg(jsonb_build_array(extract(day from t.fecha)::int, t.trafico, t.conversion, t.ticket) order by t.fecha)
        from ventas_trafico t where t.local_id = p_local and t.fecha >= v_mes and t.fecha < v_fin), '[]'::jsonb),
    'semanal', coalesce((
      select jsonb_agg(jsonb_build_object('v', s.vendedor_id, 's', s.semana, 'd', s.dias, 't', s.trafico, 'c', s.conversion,
                                          'tp', s.ticket, 'pf', s.perfumes, 'bx', s.boxer, 'pxt', s.pxt))
        from ventas_semanal s join ventas_vendedores v on v.id = s.vendedor_id
       where v.local_id = p_local and v.mes = v_mes), '[]'::jsonb),
    'dias', coalesce((
      select jsonb_agg(jsonb_build_array(extract(day from d.fecha)::int, d.peso) order by d.fecha)
        from ventas_dias d where d.local_id = p_local and d.fecha >= v_mes and d.fecha < v_fin), '[]'::jsonb),
    'semanas', coalesce((
      select jsonb_agg(jsonb_build_array(s.semana, s.peso) order by s.semana)
        from ventas_semanas s where s.local_id = p_local and s.mes = v_mes), '[]'::jsonb),
    'venta_anterior', (select t.venta_anterior from ventas_temporada t where t.local_id = p_local and t.mes = v_mes),
    'equipo', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'francos', to_jsonb(p.dias_libres)) order by p.nombre)
        from orden_personas p
       where p.local_id = p_local and p.activo and p.rol in ('vendedor', 'supervisor')), '[]'::jsonb)
  ) into r;
  return r;
end $$;

/** Guarda una celda. p_que y p_clave dicen cuál; p_valor es el número como texto (vacío = borrar).
    - config:     clave = objetivo | conversion | ticket | dias_habiles | efectivo | descuento | q_lineas | q_prendas | pxt_obj | factor | precio_perfume | precio_boxer
    - premio:     clave = 0..3 (objetivo, +10%, +20%, +30%)
    - venta:      clave = <vendedor>:<día>
    - trafico:    clave = <día>:<trafico|conversion|ticket>
    - semanal:    clave = <vendedor>:<semana>:<trafico|conversion|ticket|perfumes|boxer|pxt>
    - dias:       clave = <vendedor>:<semana>   (días trabajados; cualquier semana del mes, también las que vienen)
    - vendedor:   clave = <vendedor>:<nombre|pct>   (nombre va como texto)
    - temporada:  clave = '' (la venta del semestre anterior de este mes)
    - peso_dia:   clave = <día>        (sólo encargado, supervisor o Administración)
    - peso_semana: clave = <semana>    (ídem) */
create or replace function ventas_guardar(p_local uuid, p_mes date, p_que text, p_clave text, p_valor text, p_caja text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  a       jsonb := ventas_acceso_mes(ventas_acceso(p_local, p_caja), p_mes);
  v_mes   date  := ventas_mes_de(p_mes);
  v_hoy   date  := ventas_hoy();
  v_num   numeric;
  v_txt   text;
  v_antes text;
  p       text[] := string_to_array(coalesce(p_clave, ''), ':');
  v_vend  bigint;
  v_fecha date;
  v_campo text;
  v_sem   smallint;
begin
  perform ventas_exigir(a);
  /* La venta del semestre anterior se carga para los 6 meses de una vez (como en la planilla):
     no abre el mes. Todo lo demás, hasta el mes que viene. */
  if p_que = 'temporada' then
    if v_mes > ventas_mes_de((v_hoy + interval '6 months')::date) then
      raise exception 'ventas: ese mes todavía está lejos';
    end if;
  else
    if v_mes > ventas_mes_de((v_hoy + interval '1 month')::date) then
      raise exception 'ventas: ese mes todavía no se puede cargar';
    end if;
    perform ventas_mes_abrir(p_local, v_mes);
  end if;

  if p_que = 'vendedor' and p[2] = 'nombre' then
    v_txt := left(btrim(coalesce(p_valor, '')), 60);
  else
    v_num := ventas_numero(p_valor);
  end if;

  if p_que = 'config' then
    if coalesce(p_clave, '') not in ('objetivo', 'conversion', 'ticket', 'dias_habiles', 'efectivo', 'descuento',
                       'q_lineas', 'q_prendas', 'pxt_obj', 'factor', 'precio_perfume', 'precio_boxer') then
      raise exception 'ventas: dato desconocido (%)', p_clave;
    end if;
    if v_num < 0 then raise exception 'ventas: no puede ser negativo'; end if;
    if p_clave in ('conversion', 'factor') and v_num > 5 then
      raise exception 'ventas: es demasiado: va como %% (50%% es la mitad)';
    end if;
    if p_clave = 'dias_habiles' and v_num > 31 then raise exception 'ventas: el mes no tiene tantos días'; end if;
    if p_clave in ('dias_habiles', 'q_lineas', 'q_prendas') then v_num := round(v_num); end if;
    execute format('select (%I)::text from ventas_mes where local_id = $1 and mes = $2', p_clave) into v_antes using p_local, v_mes;
    execute format('update ventas_mes set %I = $3, actualizado_en = now() where local_id = $1 and mes = $2', p_clave)
      using p_local, v_mes, v_num;

  elsif p_que = 'premio' then
    if p_clave not in ('0', '1', '2', '3') then raise exception 'ventas: premio desconocido'; end if;
    if v_num < 0 then raise exception 'ventas: no puede ser negativo'; end if;
    select premios[p_clave::int + 1]::text into v_antes from ventas_mes where local_id = p_local and mes = v_mes;
    update ventas_mes set premios[p_clave::int + 1] = v_num, actualizado_en = now() where local_id = p_local and mes = v_mes;

  elsif p_que = 'venta' then
    v_vend := p[1]::bigint;
    v_fecha := v_mes + (p[2]::int - 1);
    if not exists (select 1 from ventas_vendedores where id = v_vend and local_id = p_local and mes = v_mes) then
      raise exception 'ventas: ese vendedor no es de este mes';
    end if;
    if ventas_mes_de(v_fecha) <> v_mes then raise exception 'ventas: ese día no es de este mes'; end if;
    if v_fecha > v_hoy then raise exception 'ventas: ese día todavía no llegó' using hint = 'La venta se carga el día que pasó.'; end if;
    /* SQL 181: los días de vacaciones (Config → Usuarios) no se cargan, como los que no llegaron. */
    if exists (select 1 from ventas_vendedores vv join orden_ausencias au on au.persona_id = vv.persona_id
                where vv.id = v_vend and v_fecha between au.desde and au.hasta) then
      raise exception 'ventas: ese día está de vacaciones' using hint = 'Las vacaciones se sacan en Config → Usuarios.';
    end if;
    select monto::text into v_antes from ventas_diarias where vendedor_id = v_vend and fecha = v_fecha;
    if v_num is null then
      delete from ventas_diarias where vendedor_id = v_vend and fecha = v_fecha;
    else
      insert into ventas_diarias (vendedor_id, fecha, monto, cargado_por) values (v_vend, v_fecha, v_num, a->>'quien')
      on conflict (vendedor_id, fecha) do update set monto = excluded.monto, cargado_en = now(), cargado_por = excluded.cargado_por;
    end if;

  elsif p_que = 'trafico' then
    v_fecha := v_mes + (p[1]::int - 1);
    v_campo := p[2];
    if v_campo not in ('trafico', 'conversion', 'ticket') then raise exception 'ventas: dato desconocido (%)', v_campo; end if;
    if ventas_mes_de(v_fecha) <> v_mes then raise exception 'ventas: ese día no es de este mes'; end if;
    if v_fecha > v_hoy then raise exception 'ventas: ese día todavía no llegó' using hint = 'Se carga el día que pasó.'; end if;
    if v_num < 0 then raise exception 'ventas: no puede ser negativo'; end if;
    if v_campo = 'conversion' and v_num > 5 then raise exception 'ventas: es demasiado: la conversión va como %% (50%% es la mitad)'; end if;
    if v_campo = 'trafico' then v_num := round(v_num); end if;
    execute format('select (%I)::text from ventas_trafico where local_id = $1 and fecha = $2', v_campo) into v_antes using p_local, v_fecha;
    insert into ventas_trafico (local_id, fecha, cargado_por) values (p_local, v_fecha, a->>'quien') on conflict do nothing;
    execute format('update ventas_trafico set %I = $3, cargado_en = now(), cargado_por = $4 where local_id = $1 and fecha = $2', v_campo)
      using p_local, v_fecha, v_num, a->>'quien';
    delete from ventas_trafico where local_id = p_local and fecha = v_fecha
       and trafico is null and conversion is null and ticket is null;

  elsif p_que = 'semanal' then
    v_vend := p[1]::bigint;
    v_sem := p[2]::smallint;
    v_campo := p[3];
    if v_campo not in ('trafico', 'conversion', 'ticket', 'perfumes', 'boxer', 'pxt') then
      raise exception 'ventas: dato desconocido (%)', v_campo;
    end if;
    if not exists (select 1 from ventas_vendedores where id = v_vend and local_id = p_local and mes = v_mes) then
      raise exception 'ventas: ese vendedor no es de este mes';
    end if;
    if not exists (select 1 from generate_series(v_mes, least((v_mes + interval '1 month - 1 day')::date, v_hoy), interval '1 day') g
                    where ventas_semana(g::date) = v_sem) then
      raise exception 'ventas: esa semana todavía no empezó';
    end if;
    if v_num < 0 then raise exception 'ventas: no puede ser negativo'; end if;
    if v_campo = 'conversion' and v_num > 5 then raise exception 'ventas: es demasiado: la conversión va como %% (50%% es la mitad)'; end if;
    if v_campo in ('trafico', 'perfumes', 'boxer') then v_num := round(v_num); end if;
    execute format('select (%I)::text from ventas_semanal where vendedor_id = $1 and semana = $2', v_campo) into v_antes using v_vend, v_sem;
    insert into ventas_semanal (vendedor_id, semana, cargado_por) values (v_vend, v_sem, a->>'quien') on conflict do nothing;
    execute format('update ventas_semanal set %I = $3, cargado_en = now(), cargado_por = $4 where vendedor_id = $1 and semana = $2', v_campo)
      using v_vend, v_sem, v_num, a->>'quien';
    delete from ventas_semanal where vendedor_id = v_vend and semana = v_sem and dias is null
       and trafico is null and conversion is null and ticket is null and perfumes is null and boxer is null and pxt is null;

  elsif p_que = 'dias' then
    v_vend := p[1]::bigint;
    v_sem := p[2]::smallint;
    if not exists (select 1 from ventas_vendedores where id = v_vend and local_id = p_local and mes = v_mes) then
      raise exception 'ventas: ese vendedor no es de este mes';
    end if;
    if v_sem is null or v_sem < 1 or v_sem > ventas_semana((v_mes + interval '1 month - 1 day')::date) then
      raise exception 'ventas: esa semana no es de este mes';
    end if;
    if v_num < 0 or v_num > 7 then raise exception 'ventas: una semana tiene hasta 7 días'; end if;
    v_num := round(v_num * 2) / 2;
    select dias::text into v_antes from ventas_semanal where vendedor_id = v_vend and semana = v_sem;
    insert into ventas_semanal (vendedor_id, semana, cargado_por) values (v_vend, v_sem, a->>'quien') on conflict do nothing;
    update ventas_semanal set dias = v_num, cargado_en = now(), cargado_por = a->>'quien' where vendedor_id = v_vend and semana = v_sem;
    delete from ventas_semanal where vendedor_id = v_vend and semana = v_sem and dias is null
       and trafico is null and conversion is null and ticket is null and perfumes is null and boxer is null and pxt is null;

  elsif p_que = 'vendedor' then
    v_vend := p[1]::bigint;
    if not exists (select 1 from ventas_vendedores where id = v_vend and local_id = p_local and mes = v_mes) then
      raise exception 'ventas: ese vendedor no es de este mes';
    end if;
    if p[2] = 'nombre' then
      if v_txt = '' then raise exception 'ventas: el nombre no puede quedar vacío'; end if;
      select nombre into v_antes from ventas_vendedores where id = v_vend;
      if v_antes = '' then raise exception 'ventas: la fila sin vendedor no se renombra: asigná su venta'; end if;
      update ventas_vendedores set nombre = v_txt where id = v_vend;
    elsif p[2] = 'pct' then
      if v_num is null then v_num := 0; end if;
      if v_num < 0 or v_num > 1 then raise exception 'ventas: el %% va de 0 a 100'; end if;
      select pct::text into v_antes from ventas_vendedores where id = v_vend;
      update ventas_vendedores set pct = v_num where id = v_vend;
    else
      raise exception 'ventas: dato desconocido';
    end if;

  elsif p_que = 'temporada' then
    if v_num < 0 then raise exception 'ventas: no puede ser negativo'; end if;
    select venta_anterior::text into v_antes from ventas_temporada where local_id = p_local and mes = v_mes;
    insert into ventas_temporada (local_id, mes, venta_anterior) values (p_local, v_mes, v_num)
    on conflict (local_id, mes) do update set venta_anterior = excluded.venta_anterior;

  elsif p_que in ('peso_dia', 'peso_semana') then
    if not coalesce((a->>'supervisa')::boolean, false) then
      raise exception 'ventas: el reparto del objetivo lo cambia el encargado, el supervisor o Administración';
    end if;
    if v_num is null then v_num := 0; end if;
    if v_num < 0 or v_num > 1 then raise exception 'ventas: el %% va de 0 a 100'; end if;
    if p_que = 'peso_dia' then
      v_fecha := v_mes + (p[1]::int - 1);
      if ventas_mes_de(v_fecha) <> v_mes then raise exception 'ventas: ese día no es de este mes'; end if;
      select peso::text into v_antes from ventas_dias where local_id = p_local and fecha = v_fecha;
      insert into ventas_dias (local_id, fecha, peso) values (p_local, v_fecha, v_num)
      on conflict (local_id, fecha) do update set peso = excluded.peso;
    else
      v_sem := p[1]::smallint;
      if v_sem < 1 or v_sem > ventas_semana((v_mes + interval '1 month - 1 day')::date) then
        raise exception 'ventas: esa semana no es de este mes';
      end if;
      select peso::text into v_antes from ventas_semanas where local_id = p_local and mes = v_mes and semana = v_sem;
      insert into ventas_semanas (local_id, mes, semana, peso) values (p_local, v_mes, v_sem, v_num)
      on conflict (local_id, mes, semana) do update set peso = excluded.peso;
    end if;

  else
    raise exception 'ventas: no sé guardar "%"', p_que;
  end if;

  perform ventas_anotar(p_local, v_mes, a, p_que, p_clave, v_antes, coalesce(v_txt, v_num::text));
  return jsonb_build_object('ok', true);
exception
  /* Un número que no entra en la columna (tráfico de 10 cifras, PxT de 4): dicho claro, no el error de Postgres. */
  when numeric_value_out_of_range then
    raise exception 'ventas: el número es demasiado grande para ese lugar';
  when check_violation then
    raise exception 'ventas: ese número no va en ese lugar: revisá que esté bien escrito';
end $$;

/** Suma un vendedor al mes (sin tope). Si es de Equipo VDH, se lo vincula (así se ven sus francos). */
create or replace function ventas_vendedor_agregar(p_local uuid, p_mes date, p_nombre text, p_persona uuid default null, p_caja text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  a      jsonb := ventas_acceso_mes(ventas_acceso(p_local, p_caja), p_mes);
  v_mes  date  := ventas_mes_de(p_mes);
  v_nom  text  := left(btrim(coalesce(p_nombre, '')), 60);
  v_id   bigint;
begin
  perform ventas_exigir(a);
  if v_mes > ventas_mes_de((ventas_hoy() + interval '1 month')::date) then raise exception 'ventas: ese mes todavía no se puede cargar'; end if;
  if p_persona is not null then
    select nombre into v_nom from orden_personas where id = p_persona and local_id = p_local and activo;
    if not found then raise exception 'ventas: esa persona no es de este local'; end if;
    if exists (select 1 from ventas_vendedores where local_id = p_local and mes = ventas_mes_de(p_mes) and persona_id = p_persona) then
      raise exception 'ventas: % ya está en la lista', v_nom;
    end if;
  end if;
  perform ventas_mes_abrir(p_local, v_mes);
  insert into ventas_vendedores (local_id, mes, nombre, pct, persona_id, orden)
  values (p_local, v_mes, v_nom, 0, p_persona,
          coalesce((select max(orden) + 1 from ventas_vendedores where local_id = p_local and mes = v_mes), 0))
  returning id into v_id;
  perform ventas_anotar(p_local, v_mes, a, 'vendedor_agregar', v_id::text, null, v_nom);
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

/** Saca a un vendedor del mes. Sólo si no tiene nada cargado (si tiene, primero se le pasa a otro). */
create or replace function ventas_vendedor_quitar(p_local uuid, p_mes date, p_id bigint, p_caja text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  a     jsonb := ventas_acceso_mes(ventas_acceso(p_local, p_caja), p_mes);
  v_mes date  := ventas_mes_de(p_mes);
  v_nom text;
begin
  perform ventas_exigir(a);
  select nombre into v_nom from ventas_vendedores where id = p_id and local_id = p_local and mes = v_mes;
  if not found then raise exception 'ventas: ese vendedor no es de este mes'; end if;
  if exists (select 1 from ventas_diarias where vendedor_id = p_id)
     or exists (select 1 from ventas_semanal where vendedor_id = p_id
                   and coalesce(trafico, conversion, ticket, perfumes, boxer, pxt) is not null) then
    raise exception 'ventas: % tiene ventas cargadas este mes', coalesce(nullif(v_nom, ''), 'Esa fila')
      using hint = 'Si se fue, dejalo: sus ventas siguen contando. Para sacarlo, primero hay que borrar lo cargado.';
  end if;
  delete from ventas_vendedores where id = p_id;
  perform ventas_anotar(p_local, v_mes, a, 'vendedor_quitar', p_id::text, v_nom, null);
  return jsonb_build_object('ok', true);
end $$;

/** Pasa la venta de la fila sin vendedor (o de cualquiera) a un vendedor del mismo mes. Si ese día ya tenía, se suma. */
create or replace function ventas_asignar(p_local uuid, p_mes date, p_desde bigint, p_hacia bigint, p_caja text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  a       jsonb := ventas_acceso_mes(ventas_acceso(p_local, p_caja), p_mes);
  v_mes   date  := ventas_mes_de(p_mes);
  v_total numeric;
begin
  perform ventas_exigir(a);
  if p_desde = p_hacia or (select count(*) from ventas_vendedores where id in (p_desde, p_hacia) and local_id = p_local and mes = v_mes) <> 2 then
    raise exception 'ventas: esos vendedores no son de este mes';
  end if;
  if (select nombre from ventas_vendedores where id = p_hacia) = '' then raise exception 'ventas: elegí un vendedor con nombre'; end if;
  select coalesce(sum(monto), 0) into v_total from ventas_diarias where vendedor_id = p_desde;
  insert into ventas_diarias (vendedor_id, fecha, monto, cargado_por)
  select p_hacia, fecha, monto, a->>'quien' from ventas_diarias where vendedor_id = p_desde
  on conflict (vendedor_id, fecha) do update set monto = ventas_diarias.monto + excluded.monto, cargado_en = now(), cargado_por = excluded.cargado_por;
  delete from ventas_diarias where vendedor_id = p_desde;
  /* La fila sin nombre, vacía, ya no hace falta. */
  delete from ventas_vendedores v where v.id = p_desde and v.nombre = ''
     and not exists (select 1 from ventas_semanal s where s.vendedor_id = v.id
                        and coalesce(s.trafico, s.conversion, s.ticket, s.perfumes, s.boxer, s.pxt) is not null);
  perform ventas_anotar(p_local, v_mes, a, 'asignar', p_desde || '>' || p_hacia, null, v_total::text);
  return jsonb_build_object('ok', true, 'total', v_total);
end $$;

-- =====================================================================
-- Pasar un mes de la planilla al sistema
-- =====================================================================

/* Carga un mes entero de un local tal como estaba en su planilla. Si ese mes
   ya tenía algo, lo REEMPLAZA (sirve para volver a importar octubre cuando
   cierre). Lo usa sólo el SQL de importación: no lo puede llamar la pantalla.
   p_datos = { cfg: {objetivo, conversion, ...},
               semanas: [[semana, peso]], dias: [[día, peso]],
               vendedores: [{n: nombre ('' = sin vendedor), pct, persona: nombre en Equipo VDH,
                             ventas: [[día, monto]], semanal: [[semana, días, tráfico, conv, ticket, perfumes, boxer, pxt]]}],
               trafico: [[día, tráfico, conversión, ticket]] } */
create or replace function ventas_importar(p_local uuid, p_mes date, p_datos jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_fin   date := (p_mes + interval '1 month')::date;
  c       jsonb := p_datos->'cfg';
  v       jsonb;
  v_ord   int;
  v_id    bigint;
  v_n     int := 0;
  v_suma  numeric := 0;
begin
  if not exists (select 1 from orden_locales where id = p_local) then raise exception 'ventas: no existe el local %', p_local; end if;
  if extract(day from p_mes) <> 1 then raise exception 'ventas: el mes va con día 1'; end if;

  delete from ventas_vendedores where local_id = p_local and mes = p_mes;      -- se lleva sus ventas y su semanal
  delete from ventas_dias       where local_id = p_local and fecha >= p_mes and fecha < v_fin;
  delete from ventas_semanas    where local_id = p_local and mes = p_mes;
  delete from ventas_trafico    where local_id = p_local and fecha >= p_mes and fecha < v_fin;
  delete from ventas_mes        where local_id = p_local and mes = p_mes;

  insert into ventas_mes (local_id, mes, objetivo, conversion, ticket, dias_habiles, efectivo, descuento,
                          q_lineas, q_prendas, pxt_obj, factor, precio_perfume, precio_boxer, premios, con_dias)
  values (p_local, p_mes, (c->>'objetivo')::numeric, (c->>'conversion')::numeric, (c->>'ticket')::numeric,
          (c->>'dias_habiles')::numeric, (c->>'efectivo')::numeric, (c->>'descuento')::numeric,
          round((c->>'q_lineas')::numeric), round((c->>'q_prendas')::numeric), (c->>'pxt_obj')::numeric,
          (c->>'factor')::numeric, (c->>'precio_perfume')::numeric, (c->>'precio_boxer')::numeric,
          coalesce((select array_agg((x)::numeric order by i) from jsonb_array_elements_text(c->'premios') with ordinality t(x, i)),
                   '{null,null,null,null}'),
          coalesce((c->>'con_dias')::boolean, true));

  insert into ventas_dias (local_id, fecha, peso)
  select p_local, p_mes + ((d->>0)::int - 1), coalesce((d->>1)::numeric, 0)
    from jsonb_array_elements(p_datos->'dias') d;
  insert into ventas_semanas (local_id, mes, semana, peso)
  select p_local, p_mes, (s->>0)::smallint, coalesce((s->>1)::numeric, 0)
    from jsonb_array_elements(p_datos->'semanas') s;

  for v, v_ord in select x, i from jsonb_array_elements(p_datos->'vendedores') with ordinality t(x, i) loop
    insert into ventas_vendedores (local_id, mes, nombre, pct, persona_id, orden)
    values (p_local, p_mes, coalesce(v->>'n', ''), coalesce((v->>'pct')::numeric, 0),
            (select p.id from orden_personas p where p.local_id = p_local and p.activo and p.nombre = v->>'persona' limit 1),
            v_ord - 1)
    returning id into v_id;
    insert into ventas_diarias (vendedor_id, fecha, monto, cargado_por)
    select v_id, p_mes + ((x->>0)::int - 1), (x->>1)::numeric, 'Planilla'
      from jsonb_array_elements(v->'ventas') x;
    insert into ventas_semanal (vendedor_id, semana, dias, trafico, conversion, ticket, perfumes, boxer, pxt, cargado_por)
    select v_id, (x->>0)::smallint, (x->>1)::numeric, round((x->>2)::numeric), (x->>3)::numeric, (x->>4)::numeric,
           round((x->>5)::numeric), round((x->>6)::numeric), (x->>7)::numeric, 'Planilla'
      from jsonb_array_elements(v->'semanal') x;
  end loop;

  insert into ventas_trafico (local_id, fecha, trafico, conversion, ticket, cargado_por)
  select p_local, p_mes + ((x->>0)::int - 1), round((x->>1)::numeric), (x->>2)::numeric, (x->>3)::numeric, 'Planilla'
    from jsonb_array_elements(p_datos->'trafico') x;

  select count(*), coalesce(sum(d.monto), 0) into v_n, v_suma
    from ventas_diarias d join ventas_vendedores w on w.id = d.vendedor_id
   where w.local_id = p_local and w.mes = p_mes;
  insert into ventas_cambios (local_id, mes, quien, que, clave, despues)
  values (p_local, p_mes, 'Planilla', 'importar', null, v_n || ' ventas, $' || v_suma);
  return jsonb_build_object('ventas', v_n, 'suma', v_suma);
end $$;

-- =====================================================================
-- Permisos de las funciones
-- =====================================================================
revoke all on function ventas_acceso(uuid, text), ventas_acceso_mes(jsonb, date), ventas_exigir(jsonb),
                       ventas_reparto_inicial(uuid, date), ventas_mes_abrir(uuid, date),
                       ventas_anotar(uuid, date, jsonb, text, text, text, text), ventas_importar(uuid, date, jsonb),
                       ventas_mes_datos(uuid, date, jsonb)
  from public, anon, authenticated;
revoke all on function ventas_locales(text), ventas_mes_leer(uuid, date, text, boolean),
                       ventas_guardar(uuid, date, text, text, text, text),
                       ventas_vendedor_agregar(uuid, date, text, uuid, text), ventas_vendedor_quitar(uuid, date, bigint, text),
                       ventas_asignar(uuid, date, bigint, bigint, text)
  from public;
/* anon también: la compu habilitada del local entra sin usuario, con su llave (la revisa ventas_acceso). */
grant execute on function ventas_locales(text), ventas_mes_leer(uuid, date, text, boolean),
                          ventas_guardar(uuid, date, text, text, text, text),
                          ventas_vendedor_agregar(uuid, date, text, uuid, text), ventas_vendedor_quitar(uuid, date, bigint, text),
                          ventas_asignar(uuid, date, bigint, bigint, text)
  to anon, authenticated, service_role;

-- Para deshacer todo (si se corrió ventas-dashboard.sql, primero lo de ese archivo):
--   drop function if exists ventas_locales(text), ventas_mes_leer(uuid, date, text, boolean),
--     ventas_guardar(uuid, date, text, text, text, text), ventas_vendedor_agregar(uuid, date, text, uuid, text),
--     ventas_vendedor_quitar(uuid, date, bigint, text), ventas_asignar(uuid, date, bigint, bigint, text),
--     ventas_acceso(uuid, text), ventas_acceso_mes(jsonb, date), ventas_exigir(jsonb),
--     ventas_reparto_inicial(uuid, date), ventas_mes_abrir(uuid, date),
--     ventas_anotar(uuid, date, jsonb, text, text, text, text), ventas_importar(uuid, date, jsonb), ventas_numero(text), ventas_semana(date),
--     ventas_mes_datos(uuid, date, jsonb), ventas_mes_de(date), ventas_hoy();
--   drop table if exists ventas_cambios, ventas_temporada, ventas_reparto, ventas_semanal, ventas_trafico, ventas_diarias,
--     ventas_vendedores, ventas_semanas, ventas_dias, ventas_mes;


-- ═══════════════════════════════════════════════════════════════════════════
-- SQL 288 (13/11/2026): Ventas se carga sola con el POS (corrido el 13/11). Es correr-en-supabase-288.sql
-- de App Orden, tal cual; se deshace con deshacer-288.sql.
-- ═══════════════════════════════════════════════════════════════════════════
/* ══════════════════════════════════════════════════════════════════════════
   SQL 288 (13/11/2026) — VENTAS SE CARGA SOLA CON EL POS
   ══════════════════════════════════════════════════════════════════════════
   Mauricio, 13/11: «Rivadavia ya usa el POS: que el objetivo de venta se
   autocomplete solo con los datos del POS. Después tráfico real, conversión
   real y ticket promedio real en la pestaña de Tráfico, y el informe por
   vendedor que se actualice también todos los días.» Y: «empezá a cargar los
   datos desde hoy… tienen que estar atentos a cargar todo y las ventas
   fallidas».

   Medido antes (5 al 12/11, Rivadavia): 28 de 32 cargas a mano eran
   exactamente lo del POS; las otras 4 eran un ticket cargado a otro vendedor,
   los cambios sumados como venta y dos ventas de $26.000 de la noche que no
   se cargaron.

   Qué hace:
     - ventas_pos: los locales que se cargan solos y desde qué día. Rivadavia,
       desde el 13/11/2026. Lo de antes de ese día queda como lo cargaron.
     - ventas_pos_cargar(): cada 5 minutos (cron «ventas-pos») recalcula el
       mes de esos locales (y el anterior hasta el 7, como el cierre del mes)
       y escribe en las MISMAS tablas de Ventas, así el dashboard, el Ranking
       y el Control de carga lo reciben sin tocarlos. No toca nada del POS:
       sólo lee.
         Ventas (venta real de cada vendedor y día) = sus tickets cobrados
           + lo que se cobró de diferencia en sus cambios. Los anulados (y
           las notas de crédito) no cuentan. Un vendedor del POS que no está
           en la lista de Ventas del mes va a «Sin vendedor».
         Tráfico del día: compras = tickets cobrados + cambios en los que se
           cobró algo; tráfico = compras + ventas fallidas; conversión =
           compras ÷ tráfico; ticket promedio = venta ÷ compras.
         Informe Vendedor (cada semana que tenga algún día desde el arranque,
           o sea desde la semana 3 de noviembre en Rivadavia): tráfico,
           conversión y ticket igual que arriba pero de cada vendedor;
           perfumes y boxers = las prendas vendidas de la familia «Perfumes»
           y «Boxer» del catálogo; PxT = prendas ÷ tickets (como POS →
           Ventas).
         Configuración del mes (Efectivo y Descuento acumulados, Q líneas y
           Q prendas): sólo en un mes entero con el POS (Rivadavia, desde
           diciembre).
       Las ventas fallidas de alguien que no está en la lista de Ventas (las
       pruebas de la oficina) no cuentan.
     - Lo que carga el POS ya no se escribe a mano (ventas_pos_traba): la
       base lo rechaza con «eso lo carga el POS solo» y la pantalla lo
       muestra fijo, en azul. Se corrige en el POS (el vendedor del ticket,
       el cambio, la venta fallida).
     - ventas_mes_datos devuelve además «pos» (desde qué día y la última
       vez que se cargó) para la pantalla (no-compra-v492). Sin la pantalla
       nueva, la vieja deja escribir las celdas pero la base no las guarda.
     - Corre una vez al final: la semana 3 de Rivadavia (9 al 15/11) ya
       queda cargada.

   Cada cambio queda anotado en ventas_cambios con quien = 'POS'.
   Se deshace con deshacer-288.sql (lo que ya cargó el POS queda, como si lo
   hubieran escrito a mano, y las celdas vuelven a ser editables). */

do $$ begin
  if to_regclass('public.ventas_pos') is not null then
    raise exception 'El SQL 288 ya está corrido (existe ventas_pos).';
  end if;
  if (select nombre from orden_locales where id = '7ce69820-6c1b-48a2-bdaa-4a546f448522') is distinct from 'Rivadavia' then
    raise exception 'No encuentro el local Rivadavia: no corro nada.';
  end if;
end $$;

-- ── Los locales que se cargan solos ───────────────────────────────────────
create table ventas_pos (
  local_id   uuid primary key references orden_locales(id) on delete cascade,
  desde      date not null,                 -- el primer día que se carga solo
  ultima     timestamptz,                   -- la última vez que se cargó
  error      text,                          -- si la última vez falló, por qué
  creado_en  timestamptz not null default now()
);
alter table ventas_pos enable row level security;
revoke all on ventas_pos from anon, authenticated;

insert into ventas_pos (local_id, desde) values ('7ce69820-6c1b-48a2-bdaa-4a546f448522', date '2026-11-13');

-- ── El último día de la semana N de un mes (las semanas de la planilla) ──
create function ventas_pos_semana_fin(p_mes date, p_sem int) returns date
language sql immutable as $$
  select least((p_mes + (7 * p_sem - extract(isodow from p_mes)::int))::date, (p_mes + interval '1 month - 1 day')::date)
$$;

/* ── Lo del POS de un local entre dos días (del mismo mes), una fila por hecho ──
   vid: el vendedor de Ventas de ese mes (null si no está en la lista).
   Cada venta cobrada es una compra y un ticket; cada cambio en el que se
   cobró algo es una compra; cada venta fallida, una fallida. */
create function ventas_pos_hechos(p_local uuid, p_desde date, p_hasta date)
returns table (fecha date, vid bigint, venta numeric, compra int, ticket int, prendas int, perfumes int, boxer int,
               fallida int, efectivo numeric, descuento numeric)
language sql stable security definer set search_path = public as $$
  with vend as (
    select v.id, v.nombre, p.nombre as persona, e.vendedor as apodo
      from ventas_vendedores v
      left join orden_personas p on p.id = v.persona_id
      left join equipo e on e.id = p.equipo_id
     where v.local_id = p_local and v.mes = ventas_mes_de(p_desde) and v.nombre <> ''),
  claves as (
    -- El nombre del POS es el del equipo del local (el apodo de la Carga); si no, el de su usuario o el de Ventas.
    select distinct on (k) k, id from (
      select orden_nombre_comparable(apodo) as k, id, 1 as pri from vend
      union all select orden_nombre_comparable(persona), id, 2 from vend
      union all select orden_nombre_comparable(nombre), id, 3 from vend) q
     where k <> '' order by k, pri, id),
  h as (
    select v.dia as fecha, v.vendedor, v.total as venta, 1 as compra, 1 as ticket, v.cantidad as prendas,
           coalesce((select sum(i.cantidad) from pos_venta_items i join pos_articulos a on a.codigo = i.codigo
                      where i.venta_id = v.id and lower(btrim(a.familia)) like 'perfume%'), 0)::int as perfumes,
           coalesce((select sum(i.cantidad) from pos_venta_items i join pos_articulos a on a.codigo = i.codigo
                      where i.venta_id = v.id and lower(btrim(a.familia)) like 'boxer%'), 0)::int as boxer,
           0 as fallida,
           coalesce((select sum(pg.monto) from pos_venta_pagos pg where pg.venta_id = v.id and pg.medio = 'efectivo'), 0) as efectivo,
           v.descuentos as descuento
      from pos_ventas v
     where v.local_id = p_local and v.dia between p_desde and p_hasta and not v.prueba and v.estado = 'cobrada'
    union all
    select c.dia, c.vendedor, c.diferencia, (c.diferencia > 0)::int, 0, 0, 0, 0, 0,
           coalesce((select sum(pg.monto) from pos_cambio_pagos pg where pg.cambio_id = c.id and pg.medio = 'efectivo'), 0),
           c.descuentos
      from pos_cambios c
     where c.local_id = p_local and c.dia between p_desde and p_hasta and not c.prueba and c.estado = 'hecho'
    union all
    select f.dia, f.vendedor, 0, 0, 0, 0, 0, 0, 1, 0, 0
      from pos_fallidas f
     where f.local_id = p_local and f.dia between p_desde and p_hasta and not f.prueba)
  select h.fecha, k.id, h.venta, h.compra, h.ticket, h.prendas, h.perfumes, h.boxer, h.fallida, h.efectivo, h.descuento
    from h left join claves k on k.k = orden_nombre_comparable(h.vendedor)
$$;
revoke all on function ventas_pos_hechos(uuid, date, date) from public, anon, authenticated;

/* ── Cargar Ventas con el POS ──────────────────────────────────────────────
   p_local null: todos los de ventas_pos. Devuelve cuántas celdas cambió cada uno. */
create function ventas_pos_cargar(p_local uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_hoy  date := ventas_hoy();
  v_ini  date := case when extract(day from ventas_hoy()) <= 7
                      then (ventas_mes_de(ventas_hoy()) - interval '1 month')::date else ventas_mes_de(ventas_hoy()) end;
  a      constant jsonb := jsonb_build_object('quien', 'POS');
  l      record; x record;
  m      date; v_d0 date; v_fin date; v_ini_s date; v_fin_s date; v_sin bigint; v_s int;
  n      int; v_res jsonb := '[]'::jsonb;
begin
  /* Lo que escribe esta función pasa la traba de ventas_pos_traba (sólo dentro de esta transacción). */
  perform set_config('ventas.pos', 'si', true);
  for l in select vp.local_id, vp.desde from ventas_pos vp where p_local is null or vp.local_id = p_local order by vp.local_id loop
    n := 0;
    begin
      for m in select g::date from generate_series(ventas_mes_de(greatest(l.desde, v_ini)), ventas_mes_de(v_hoy), interval '1 month') g loop
        v_d0  := greatest(l.desde, m);
        v_fin := least((m + interval '1 month - 1 day')::date, v_hoy);
        continue when v_d0 > v_fin;

        continue when not exists (select 1 from ventas_pos_hechos(l.local_id, m, v_fin))
                 and not exists (select 1 from ventas_mes where local_id = l.local_id and mes = m);
        perform ventas_mes_abrir(l.local_id, m);

        /* «Sin vendedor»: lo vendido por alguien que no está en la lista del mes. */
        v_sin := null;
        if exists (select 1 from ventas_pos_hechos(l.local_id, v_d0, v_fin) where vid is null and compra > 0) then
          select id into v_sin from ventas_vendedores where local_id = l.local_id and mes = m and nombre = '' order by id limit 1;
          if v_sin is null then
            insert into ventas_vendedores (local_id, mes, nombre, pct, orden) values (l.local_id, m, '', 0, 99) returning id into v_sin;
          end if;
        end if;

        /* 1) La venta de cada vendedor, día por día. */
        for x in
          with des as (
            select coalesce(vid, v_sin) as vid, fecha, sum(venta) as monto from ventas_pos_hechos(l.local_id, v_d0, v_fin)
             where compra > 0 and coalesce(vid, v_sin) is not null group by 1, 2),
          act as (
            select d.vendedor_id as vid, d.fecha, d.monto from ventas_diarias d join ventas_vendedores v on v.id = d.vendedor_id
             where v.local_id = l.local_id and v.mes = m and d.fecha between v_d0 and v_fin)
          select coalesce(des.vid, act.vid) as vid, coalesce(des.fecha, act.fecha) as fecha, act.monto as antes, des.monto as despues
            from des full join act on act.vid = des.vid and act.fecha = des.fecha
           where act.monto is distinct from des.monto
        loop
          if x.despues is null then
            delete from ventas_diarias where vendedor_id = x.vid and fecha = x.fecha;
          else
            insert into ventas_diarias (vendedor_id, fecha, monto, cargado_por) values (x.vid, x.fecha, x.despues, 'POS')
            on conflict (vendedor_id, fecha) do update set monto = excluded.monto, cargado_en = now(), cargado_por = 'POS';
          end if;
          perform ventas_anotar(l.local_id, m, a, 'venta', x.vid || ':' || extract(day from x.fecha)::int, x.antes::text, x.despues::text);
          n := n + 1;
        end loop;

        /* 2) Tráfico, conversión y ticket del día. */
        for x in
          with des as (
            select fecha, t, case when t > 0 then round(c::numeric / t, 6) end as cv, case when c > 0 then round(v / c) end as tk
              from (select fecha, sum(compra) + coalesce(sum(fallida) filter (where vid is not null), 0) as t, sum(compra) as c, sum(venta) as v
                      from ventas_pos_hechos(l.local_id, v_d0, v_fin) group by fecha) q
             where t > 0),
          act as (select fecha, trafico as t, conversion as cv, ticket as tk from ventas_trafico
                   where local_id = l.local_id and fecha between v_d0 and v_fin)
          select coalesce(des.fecha, act.fecha) as fecha, act.t as t0, act.cv as cv0, act.tk as tk0, des.t, des.cv, des.tk
            from des full join act on act.fecha = des.fecha
           where (act.t, act.cv, act.tk) is distinct from (des.t, des.cv, des.tk)
        loop
          if x.t is null then
            delete from ventas_trafico where local_id = l.local_id and fecha = x.fecha;
          else
            insert into ventas_trafico (local_id, fecha, trafico, conversion, ticket, cargado_por)
            values (l.local_id, x.fecha, x.t, x.cv, x.tk, 'POS')
            on conflict (local_id, fecha) do update set trafico = excluded.trafico, conversion = excluded.conversion,
              ticket = excluded.ticket, cargado_en = now(), cargado_por = 'POS';
          end if;
          if x.t0 is distinct from x.t then
            perform ventas_anotar(l.local_id, m, a, 'trafico', extract(day from x.fecha)::int || ':trafico', x.t0::text, x.t::text); end if;
          if x.cv0 is distinct from x.cv then
            perform ventas_anotar(l.local_id, m, a, 'trafico', extract(day from x.fecha)::int || ':conversion', x.cv0::text, x.cv::text); end if;
          if x.tk0 is distinct from x.tk then
            perform ventas_anotar(l.local_id, m, a, 'trafico', extract(day from x.fecha)::int || ':ticket', x.tk0::text, x.tk::text); end if;
          n := n + 1;
        end loop;

        /* 3) El Informe Vendedor de cada semana que tenga algún día desde el arranque. */
        for v_s in select s from generate_series(1, ventas_semana((m + interval '1 month - 1 day')::date)) s loop
          v_fin_s := ventas_pos_semana_fin(m, v_s);
          v_ini_s := greatest(m, v_fin_s - 6);
          continue when v_fin_s < v_d0 or v_ini_s > v_fin;
          for x in
            with des as (
              select vid, t, case when t > 0 then round(c::numeric / t, 6) end as cv, case when c > 0 then round(v / c) end as tk,
                     pf, bx, case when tks > 0 then round(pr::numeric / tks, 6) end as pxt
                from (select vid, sum(compra) + sum(fallida) as t, sum(compra) as c, sum(venta) as v, sum(ticket) as tks,
                             sum(prendas) as pr, sum(perfumes) as pf, sum(boxer) as bx
                        from ventas_pos_hechos(l.local_id, v_ini_s, least(v_fin_s, v_fin)) where vid is not null group by vid) q
               where t > 0),
            act as (
              select s.vendedor_id as vid, s.trafico as t, s.conversion as cv, s.ticket as tk, s.perfumes as pf, s.boxer as bx, s.pxt
                from ventas_semanal s join ventas_vendedores v on v.id = s.vendedor_id
               where v.local_id = l.local_id and v.mes = m and v.nombre <> '' and s.semana = v_s)
            select coalesce(des.vid, act.vid) as vid,
                   act.t as t0, act.cv as cv0, act.tk as tk0, act.pf as pf0, act.bx as bx0, act.pxt as pxt0,
                   des.t, des.cv, des.tk, des.pf, des.bx, des.pxt
              from des full join act on act.vid = des.vid
             where (act.t, act.cv, act.tk, act.pf, act.bx, act.pxt) is distinct from (des.t, des.cv, des.tk, des.pf, des.bx, des.pxt)
          loop
            insert into ventas_semanal (vendedor_id, semana, trafico, conversion, ticket, perfumes, boxer, pxt, cargado_por)
            values (x.vid, v_s, x.t, x.cv, x.tk, x.pf, x.bx, x.pxt, 'POS')
            on conflict (vendedor_id, semana) do update set trafico = excluded.trafico, conversion = excluded.conversion,
              ticket = excluded.ticket, perfumes = excluded.perfumes, boxer = excluded.boxer, pxt = excluded.pxt,
              cargado_en = now(), cargado_por = 'POS';
            delete from ventas_semanal where vendedor_id = x.vid and semana = v_s and dias is null
               and trafico is null and conversion is null and ticket is null and perfumes is null and boxer is null and pxt is null;
            perform ventas_anotar(l.local_id, m, a, 'semanal', x.vid || ':' || v_s || ':pos',
              concat_ws(' · ', x.t0, x.cv0, x.tk0, x.pf0, x.bx0, x.pxt0), concat_ws(' · ', x.t, x.cv, x.tk, x.pf, x.bx, x.pxt));
            n := n + 1;
          end loop;
        end loop;

        /* 4) La configuración del mes, sólo en un mes entero con el POS. */
        if l.desde <= m then
          for x in
            select mm.efectivo as e0, mm.descuento as d0, mm.q_lineas as l0, mm.q_prendas as p0, q.e, q.d, q.l, q.p
              from ventas_mes mm,
                   lateral (select case when count(*) > 0 then sum(efectivo) end as e, case when count(*) > 0 then sum(descuento) end as d,
                                   case when count(*) > 0 then sum(ticket)::int end as l, case when count(*) > 0 then sum(prendas)::int end as p
                              from ventas_pos_hechos(l.local_id, m, v_fin) where compra > 0) q
             where mm.local_id = l.local_id and mm.mes = m
               and (mm.efectivo, mm.descuento, mm.q_lineas, mm.q_prendas) is distinct from (q.e, q.d, q.l, q.p)
          loop
            update ventas_mes set efectivo = x.e, descuento = x.d, q_lineas = x.l, q_prendas = x.p, actualizado_en = now()
             where local_id = l.local_id and mes = m;
            perform ventas_anotar(l.local_id, m, a, 'config', 'pos', concat_ws(' · ', x.e0, x.d0, x.l0, x.p0), concat_ws(' · ', x.e, x.d, x.l, x.p));
            n := n + 1;
          end loop;
        end if;
      end loop;
      update ventas_pos set ultima = now(), error = null where local_id = l.local_id;
      v_res := v_res || jsonb_build_object('local', l.local_id, 'cambios', n);
    exception when others then
      /* Si un local falla, los demás siguen; queda anotado por qué. */
      update ventas_pos set error = left(sqlerrm, 500) where local_id = l.local_id;
      v_res := v_res || jsonb_build_object('local', l.local_id, 'error', sqlerrm);
    end;
  end loop;
  perform set_config('ventas.pos', '', true);
  return v_res;
end $$;
revoke all on function ventas_pos_cargar(uuid) from public, anon, authenticated;

/* ── La traba: lo que carga el POS no se escribe a mano ────────────────── */
create function ventas_pos_traba() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_local uuid; v_mes date; v_fecha date; v_desde date;
begin
  if current_setting('ventas.pos', true) = 'si' then return new; end if;
  if tg_table_name = 'ventas_diarias' then
    select local_id into v_local from ventas_vendedores where id = new.vendedor_id;
    v_fecha := new.fecha;
  elsif tg_table_name = 'ventas_trafico' then
    v_local := new.local_id;
    v_fecha := new.fecha;
  elsif tg_table_name = 'ventas_semanal' then
    /* Los días trabajados se siguen cargando; lo demás de la semana, no. */
    if tg_op = 'INSERT' and coalesce(new.trafico, new.conversion, new.ticket, new.perfumes, new.boxer, new.pxt) is null then return new; end if;
    if tg_op = 'UPDATE' and (new.trafico, new.conversion, new.ticket, new.perfumes, new.boxer, new.pxt)
                            is not distinct from (old.trafico, old.conversion, old.ticket, old.perfumes, old.boxer, old.pxt) then return new; end if;
    select local_id, mes into v_local, v_mes from ventas_vendedores where id = new.vendedor_id;
    v_fecha := ventas_pos_semana_fin(v_mes, new.semana);
  elsif tg_table_name = 'ventas_mes' then
    if (new.efectivo, new.descuento, new.q_lineas, new.q_prendas) is not distinct from (old.efectivo, old.descuento, old.q_lineas, old.q_prendas) then
      return new;
    end if;
    v_local := new.local_id;
  end if;
  select desde into v_desde from ventas_pos where local_id = v_local;
  if v_desde is null then return new; end if;
  if tg_table_name = 'ventas_mes' then
    if v_desde > new.mes then return new; end if;
  elsif v_fecha < v_desde then
    return new;
  end if;
  raise exception 'ventas: eso lo carga el POS solo (desde el %): se corrige en el POS', to_char(v_desde, 'DD/MM')
    using hint = 'Si está mal, corregí el ticket, el cambio o la venta fallida en el POS: en 5 minutos se actualiza solo.';
end $$;

create trigger ventas_pos_traba before insert or update on ventas_diarias for each row execute function ventas_pos_traba();
create trigger ventas_pos_traba before insert or update on ventas_trafico for each row execute function ventas_pos_traba();
create trigger ventas_pos_traba before insert or update on ventas_semanal for each row execute function ventas_pos_traba();
create trigger ventas_pos_traba before update on ventas_mes for each row execute function ventas_pos_traba();

/* ── La pantalla: desde qué día se carga solo (ventas_mes_datos + «pos») ── */
create or replace function public.ventas_mes_datos(p_local uuid, p_mes date, a jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare
  v_mes  date  := ventas_mes_de(p_mes);
  v_fin  date  := (ventas_mes_de(p_mes) + interval '1 month')::date;
  m      ventas_mes%rowtype;
  r      jsonb;
begin
  select * into m from ventas_mes where local_id = p_local and mes = v_mes;

  select jsonb_build_object(
    'hoy', ventas_hoy(),
    'mes', v_mes,
    'existe', m.local_id is not null,
    'puede', a->>'puede',
    'supervisa', coalesce((a->>'supervisa')::boolean, false),
    'cerrado', coalesce((a->>'cerrado')::boolean, false),
    'carga_hasta', a->'carga_hasta',
    'quien', a->>'quien',
    'local', (select jsonb_build_object('id', l.id, 'nombre', l.nombre, 'codigo', l.codigo, 'dias_abiertos', l.dias_abiertos)
                from orden_locales l where l.id = p_local),
    'cfg', case when m.local_id is null then null else jsonb_build_object(
             'objetivo', m.objetivo, 'conversion', m.conversion, 'ticket', m.ticket, 'dias_habiles', m.dias_habiles,
             'efectivo', m.efectivo, 'descuento', m.descuento, 'q_lineas', m.q_lineas, 'q_prendas', m.q_prendas,
             'pxt_obj', m.pxt_obj, 'factor', m.factor, 'precio_perfume', m.precio_perfume, 'precio_boxer', m.precio_boxer,
             'premios', to_jsonb(m.premios), 'con_dias', m.con_dias) end,
    'vendedores', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'nombre', v.nombre, 'pct', v.pct, 'persona', v.persona_id,
                                          'francos', coalesce(to_jsonb(p.dias_libres), '[]'::jsonb),
                                          /* SQL 181: sus vacaciones de este mes (Config → Usuarios): [primer día, último día, motivo]. */
                                          'vacaciones', coalesce((
                                            select jsonb_agg(jsonb_build_array(extract(day from greatest(au.desde, v_mes))::int,
                                                                               extract(day from least(au.hasta, v_fin - 1))::int, au.motivo) order by au.desde)
                                              from orden_ausencias au
                                             where au.persona_id = v.persona_id and au.desde < v_fin and au.hasta >= v_mes), '[]'::jsonb))
                       order by (v.nombre = ''), v.orden, v.id)
        from ventas_vendedores v left join orden_personas p on p.id = v.persona_id
       where v.local_id = p_local and v.mes = v_mes), '[]'::jsonb),
    /* El reparto a mano de alguna semana: [vendedor, semana, %, motivo]. */
    'reparto', coalesce((
      select jsonb_agg(jsonb_build_array(r.vendedor_id, r.semana, r.pct, r.motivo) order by r.vendedor_id, r.semana)
        from ventas_reparto r join ventas_vendedores v on v.id = r.vendedor_id
       where v.local_id = p_local and v.mes = v_mes), '[]'::jsonb),
    'ventas', coalesce((
      select jsonb_agg(jsonb_build_array(d.vendedor_id, extract(day from d.fecha)::int, d.monto))
        from ventas_diarias d join ventas_vendedores v on v.id = d.vendedor_id
       where v.local_id = p_local and v.mes = v_mes), '[]'::jsonb),
    'trafico', coalesce((
      select jsonb_agg(jsonb_build_array(extract(day from t.fecha)::int, t.trafico, t.conversion, t.ticket) order by t.fecha)
        from ventas_trafico t where t.local_id = p_local and t.fecha >= v_mes and t.fecha < v_fin), '[]'::jsonb),
    'semanal', coalesce((
      select jsonb_agg(jsonb_build_object('v', s.vendedor_id, 's', s.semana, 'd', s.dias, 't', s.trafico, 'c', s.conversion,
                                          'tp', s.ticket, 'pf', s.perfumes, 'bx', s.boxer, 'pxt', s.pxt))
        from ventas_semanal s join ventas_vendedores v on v.id = s.vendedor_id
       where v.local_id = p_local and v.mes = v_mes), '[]'::jsonb),
    'dias', coalesce((
      select jsonb_agg(jsonb_build_array(extract(day from d.fecha)::int, d.peso) order by d.fecha)
        from ventas_dias d where d.local_id = p_local and d.fecha >= v_mes and d.fecha < v_fin), '[]'::jsonb),
    'semanas', coalesce((
      select jsonb_agg(jsonb_build_array(s.semana, s.peso) order by s.semana)
        from ventas_semanas s where s.local_id = p_local and s.mes = v_mes), '[]'::jsonb),
    'venta_anterior', (select t.venta_anterior from ventas_temporada t where t.local_id = p_local and t.mes = v_mes),
    'equipo', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'francos', to_jsonb(p.dias_libres)) order by p.nombre)
        from orden_personas p
       where p.local_id = p_local and p.activo and p.rol in ('vendedor', 'supervisor')), '[]'::jsonb),
    /* SQL 288: el local se carga solo con el POS desde ese día (null: se carga a mano). */
    'pos', (select jsonb_build_object('desde', vp.desde, 'ultima', vp.ultima) from ventas_pos vp where vp.local_id = p_local)
  ) into r;
  return r;
end $function$;

-- ── Cada 5 minutos, y una vez ahora ───────────────────────────────────────
select cron.schedule('ventas-pos', '*/5 * * * *', 'select ventas_pos_cargar()');
select ventas_pos_cargar();


/* ══════════════════════════════════════════════════════════════════════════
   SQL 293 (13/11/2026) — VENTAS DEL POS CADA MINUTO + LIMPIEZA DEL HISTORIAL
   ══════════════════════════════════════════════════════════════════════════
   Lautaro (Rivadavia), 13/11 17:19: «no se ponen las ventas en efectivo
   automáticamente, sólo lee las de Mercado Pago y tarjeta». Sí se ponían: la
   X 8 en efectivo (17:15:43) entró en la pasada de las 17:20 y él miró a las
   17:19. Para que no vuelva a pasar, Mauricio: «son las dos» (cada minuto y
   la limpieza del historial).

   Qué hace:
     1) El cron «ventas-pos» (SQL 288) pasa de cada 5 minutos a cada minuto.
        Cada pasada tarda ~0,2 s (medido el 13/11: 203 pasadas, 0 fallas).
        Con los 14 locales en el POS cada pasada va a tardar más: medirlo ahí.
     2) La traba (ventas_pos_traba) avisa «en un minuto se actualiza solo».
     3) Limpieza diaria del historial del cron (cron.job_run_details): a las
        04:45 (07:45 UTC) borra lo de más de 7 días. Ese historial nunca se
        limpiaba: el 13/11 era la tabla más grande de la base (41 MB, 215.577
        renglones desde el 22/09). Es sólo el registro de cada pasada (hora y
        si anduvo); ninguna pantalla ni función lo lee. Corre una vez al final
        (borra ~179.000 renglones).

   Después de correrlo, APARTE (no puede ir dentro de una transacción):
        vacuum full cron.job_run_details;
     devuelve a la base el lugar que liberó el borrado (sin eso queda
     reservado para reusarse, pero el tamaño de la base no baja).

   Se deshace con deshacer-293.sql (lo borrado del historial no vuelve). */

do $$ begin
  if not exists (select 1 from cron.job where jobname = 'ventas-pos') then
    raise exception 'Falta el SQL 288 (no existe el cron ventas-pos): no corro nada.';
  end if;
  if exists (select 1 from cron.job where jobname = 'limpiar-historial-cron') then
    raise exception 'El SQL 293 ya está corrido (existe el cron limpiar-historial-cron).';
  end if;
end $$;

-- ── 1) Ventas del POS cada minuto (mismo nombre: cambia el horario del que ya está) ──
select cron.schedule('ventas-pos', '* * * * *', 'select ventas_pos_cargar()');

-- ── 2) La traba: «en un minuto se actualiza solo» ─────────────────────────
create or replace function public.ventas_pos_traba()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_local uuid; v_mes date; v_fecha date; v_desde date;
begin
  if current_setting('ventas.pos', true) = 'si' then return new; end if;
  if tg_table_name = 'ventas_diarias' then
    select local_id into v_local from ventas_vendedores where id = new.vendedor_id;
    v_fecha := new.fecha;
  elsif tg_table_name = 'ventas_trafico' then
    v_local := new.local_id;
    v_fecha := new.fecha;
  elsif tg_table_name = 'ventas_semanal' then
    /* Los días trabajados se siguen cargando; lo demás de la semana, no. */
    if tg_op = 'INSERT' and coalesce(new.trafico, new.conversion, new.ticket, new.perfumes, new.boxer, new.pxt) is null then return new; end if;
    if tg_op = 'UPDATE' and (new.trafico, new.conversion, new.ticket, new.perfumes, new.boxer, new.pxt)
                            is not distinct from (old.trafico, old.conversion, old.ticket, old.perfumes, old.boxer, old.pxt) then return new; end if;
    select local_id, mes into v_local, v_mes from ventas_vendedores where id = new.vendedor_id;
    v_fecha := ventas_pos_semana_fin(v_mes, new.semana);
  elsif tg_table_name = 'ventas_mes' then
    if (new.efectivo, new.descuento, new.q_lineas, new.q_prendas) is not distinct from (old.efectivo, old.descuento, old.q_lineas, old.q_prendas) then
      return new;
    end if;
    v_local := new.local_id;
  end if;
  select desde into v_desde from ventas_pos where local_id = v_local;
  if v_desde is null then return new; end if;
  if tg_table_name = 'ventas_mes' then
    if v_desde > new.mes then return new; end if;
  elsif v_fecha < v_desde then
    return new;
  end if;
  raise exception 'ventas: eso lo carga el POS solo (desde el %): se corrige en el POS', to_char(v_desde, 'DD/MM')
    using hint = 'Si está mal, corregí el ticket, el cambio o la venta fallida en el POS: en un minuto se actualiza solo.';
end $function$;

-- ── 3) El historial del cron: cada día, sólo los últimos 7 días ───────────
select cron.schedule('limpiar-historial-cron', '45 7 * * *',
  $cr$delete from cron.job_run_details where start_time < now() - interval '7 days'$cr$);

-- Y una vez ahora.
delete from cron.job_run_details where start_time < now() - interval '7 days';

-- Y aparte, una vez después de correrlo (13/11: el historial bajó de 41 MB a 6,4 MB y la base de 143 a 108 MB):
-- vacuum full cron.job_run_details;

-- ════════════════════════════════════════════════════════════════════
-- SQL 295 (13/11/2026): ventas_pos_hechos ya no suma lo pagado con una Gift Card (la tarjeta sumó cuando se vendió); la
-- venta pagada entera con una no es una venta. La función nueva está al final de supabase/pos.sql (junto con
-- pos_ventas_vendedor y pos_tickets, que cambian por lo mismo). App Orden: correr-en-supabase-295.sql / deshacer-295.sql.
