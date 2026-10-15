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

alter table ventas_mes        enable row level security;
alter table ventas_dias       enable row level security;
alter table ventas_semanas    enable row level security;
alter table ventas_vendedores enable row level security;
alter table ventas_diarias    enable row level security;
alter table ventas_trafico    enable row level security;
alter table ventas_semanal    enable row level security;
alter table ventas_temporada  enable row level security;
alter table ventas_cambios    enable row level security;
revoke all on ventas_mes, ventas_dias, ventas_semanas, ventas_vendedores, ventas_diarias,
              ventas_trafico, ventas_semanal, ventas_temporada, ventas_cambios from public, anon, authenticated;
grant all on ventas_mes, ventas_dias, ventas_semanas, ventas_vendedores, ventas_diarias,
             ventas_trafico, ventas_semanal, ventas_temporada, ventas_cambios to service_role;

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
    Interna: la usan ventas_mes_leer y, cuando se conecte el dashboard, ventas_dashboard
    (ventas-dashboard.sql); nadie de afuera. */
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
                                          'francos', coalesce(to_jsonb(p.dias_libres), '[]'::jsonb))
                       order by (v.nombre = ''), v.orden, v.id)
        from ventas_vendedores v left join orden_personas p on p.id = v.persona_id
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
--   drop table if exists ventas_cambios, ventas_temporada, ventas_semanal, ventas_trafico, ventas_diarias,
--     ventas_vendedores, ventas_semanas, ventas_dias, ventas_mes;
