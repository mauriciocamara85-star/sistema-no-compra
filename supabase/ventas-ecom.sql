-- ═══ Sistema VDH · Ventas → la planilla del E-commerce (octubre 2026) ═══
-- Va DESPUÉS de ventas.sql (usa sus ayudas). Pegalo entero en el editor SQL de Supabase. Se puede correr más de una vez.
--   · Crea las tablas ventas_ecom_* (vacías) y las funciones de la hoja E-commerce de la pantalla Ventas.
--     No toca nada de lo que ya existe: los 14 locales siguen igual.
--   · Quién la ve y la carga: Atención al cliente y Administración (pedido de Mauricio, 17/10).
--   · Lo que se llena solo: la venta y la cantidad de ventas de cada día salen de los pedidos pagados de
--     vdh.com.ar (tienda_pedidos, los trae el robot de cada hora); lo de Meta (inversión, facturación,
--     ventas, visitas y carritos) lo trae el mismo robot desde la cuenta publicitaria (ventas_ecom_meta).
--   · Lo que se carga a mano: las visitas de cada día y los carritos creados de cada semana (salen del
--     panel de Tienda Nube: su API no los da), y lo ámbar (objetivo, ticket, conversión, impuesto).
--   · Un mes pasado se completa hasta el 7 del mes siguiente; después lo corrige sólo Administración.
--   · Reversible: la lista está al final.

-- =====================================================================
-- Cómo está pensado
--
-- Es la hoja "[Mes] E-commerce" de la planilla del e-commerce, mes por mes.
-- Como en los locales, la base guarda sólo lo que se tipea (y lo que trae el
-- robot de Meta); las cuentas las hace la pantalla con las fórmulas de la
-- planilla (ventas-calc.js, ecom).
--
-- El e-commerce NO es un local de orden_locales: así no aparece en ningún
-- selector de local (Equipo VDH, Cajas, etc.). Sus cambios se anotan en
-- ventas_cambios con un id fijo (ventas_ecom_id).
-- =====================================================================

-- ---------- El mes: lo ámbar ----------
create table if not exists ventas_ecom_mes (
  mes             date primary key check (extract(day from mes) = 1),
  objetivo        numeric(14,2),                                   -- G18 Objetivo mensual
  ticket          numeric(12,2),                                   -- I18 Ticket promedio objetivo
  conversion      numeric(9,6),                                    -- K18 Conversión objetivo (0,01 = 1%)
  dias_mes        smallint,                                        -- G20 Días del mes
  impuesto        numeric(9,6) not null default 0.08,              -- D102 Impuesto sobre la pauta
  premios         numeric(12,2)[] not null default '{null,null,null,null}',  -- escalón: objetivo, +10, +20, +30
  bench           numeric(9,6)[] not null default '{0.065,0.26,0.015}',      -- E118:E120 referencias del rubro
  be_roas         numeric(9,4) not null default 2.8,               -- Informe de Temporada C45 (ROAS mínimo)
  actualizado_en  timestamptz not null default now()
);

-- ---------- Cada día: el reparto del objetivo y las visitas (a mano) ----------
create table if not exists ventas_ecom_dias (
  fecha        date primary key,
  peso         numeric(9,6) not null default 0 check (peso >= 0 and peso <= 1),   -- % del día dentro de su semana
  visitas      integer check (visitas >= 0),
  cargado_en   timestamptz,
  cargado_por  text
);

-- ---------- Cada semana: el reparto y los carritos creados (a mano) ----------
create table if not exists ventas_ecom_semanas (
  mes       date not null check (extract(day from mes) = 1),
  semana    smallint not null check (semana between 1 and 6),
  peso      numeric(9,6) not null default 0 check (peso >= 0 and peso <= 1),      -- % de la semana dentro del mes
  carritos  integer check (carritos >= 0),
  primary key (mes, semana)
);

-- ---------- Meta Ads, día por día (lo trae el robot de cada hora) ----------
create table if not exists ventas_ecom_meta (
  fecha        date primary key,
  inversion    numeric(14,2) not null default 0 check (inversion >= 0),   -- importe gastado, sin impuestos
  facturacion  numeric(14,2) not null default 0 check (facturacion >= 0), -- valor de las compras atribuidas
  ventas       integer not null default 0 check (ventas >= 0),            -- compras
  visitas      integer not null default 0 check (visitas >= 0),           -- visitas a la página de destino
  carritos     integer not null default 0 check (carritos >= 0),          -- artículos agregados al carrito
  leido_en     timestamptz not null default now()
);

-- ---------- Cómo le fue al robot con Meta la última vez ----------
create table if not exists ventas_ecom_meta_estado (
  id        smallint primary key default 1 check (id = 1),
  ultima    timestamptz,          -- la última lectura buena
  error     text,                 -- el último error (vacío si la última anduvo)
  error_en  timestamptz
);

do $rls$
declare t text;
begin
  foreach t in array array['ventas_ecom_mes', 'ventas_ecom_dias', 'ventas_ecom_semanas', 'ventas_ecom_meta',
                           'ventas_ecom_meta_estado'] loop
    if not (select relrowsecurity from pg_class where oid = t::regclass) then
      execute format('alter table %I enable row level security', t);
    end if;
  end loop;
end $rls$;
revoke all on ventas_ecom_mes, ventas_ecom_dias, ventas_ecom_semanas, ventas_ecom_meta, ventas_ecom_meta_estado
  from public, anon, authenticated;
grant all on ventas_ecom_mes, ventas_ecom_dias, ventas_ecom_semanas, ventas_ecom_meta, ventas_ecom_meta_estado
  to service_role;

-- =====================================================================
-- Ayudas
-- =====================================================================

/* El id con el que el e-commerce queda anotado en ventas_cambios (no es un local). */
create or replace function ventas_ecom_id() returns uuid
language sql immutable as $$ select '00000000-0000-0000-0000-0000000000ec'::uuid $$;

/* ¿Quién pide y qué puede? Atención al cliente y Administración cargan todo (también el reparto).
   También el vendedor o encargado con la casilla "también atiende clientes" (tambien_atencion, SQL 135),
   como en ventas_acceso. Se lee con to_jsonb para que este SQL ande corrido antes o después del 135. */
create or replace function ventas_ecom_acceso(p_caja text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_yo     uuid;
  v_nombre text;
begin
  if orden_es_servicio() then
    return jsonb_build_object('puede', 'escribir', 'quien', 'Sistema', 'supervisa', true);
  end if;
  v_yo := orden_yo_id();
  if v_yo is null then return jsonb_build_object('puede', null); end if;
  select nombre into v_nombre from orden_personas where id = v_yo;
  if orden_es_admin()
     or exists (select 1 from orden_personas p where p.id = v_yo and p.activo and p.aprobado
                  and (p.rol = 'atencion' or coalesce((to_jsonb(p) ->> 'tambien_atencion')::boolean, false))) then
    return jsonb_build_object('puede', 'escribir', 'quien', v_nombre, 'persona', v_yo, 'supervisa', true);
  end if;
  return jsonb_build_object('puede', null);
end $$;

/* El reparto de un mes que no tiene: el mismo patrón del mes anterior (el % de cada día de la
   semana, de sus semanas completas); si no hay, parejo entre los 7 días (la tienda vende todos). */
create or replace function ventas_ecom_reparto_inicial(p_mes date)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_ant    date := (p_mes - interval '1 month')::date;
  v_perfil numeric[] := array[0,0,0,0,0,0,0]::numeric[];
  v_hay    boolean;
  i        int;
begin
  if exists (select 1 from ventas_ecom_dias where fecha >= p_mes and fecha < (p_mes + interval '1 month')::date) then
    return;
  end if;
  select count(*) > 0 into v_hay from ventas_ecom_dias d where d.fecha >= v_ant and d.fecha < p_mes;
  if v_hay then
    for i in 1..7 loop
      v_perfil[i] := (
        select coalesce(avg(d.peso), 0)
          from ventas_ecom_dias d
         where d.fecha >= v_ant and d.fecha < p_mes
           and extract(isodow from d.fecha) = i
           and (select count(*) from generate_series(v_ant, (p_mes - 1), interval '1 day') g
                 where ventas_semana(g::date) = ventas_semana(d.fecha)) = 7);
    end loop;
  end if;
  if not v_hay or (select sum(x) from unnest(v_perfil) x) = 0 then
    v_perfil := array[1,1,1,1,1,1,1]::numeric[];
  end if;

  insert into ventas_ecom_dias (fecha, peso)
  select d.fecha,
         round(case when sum(v_perfil[extract(isodow from d.fecha)::int]) over (partition by ventas_semana(d.fecha)) = 0 then 0
                    else v_perfil[extract(isodow from d.fecha)::int]
                         / sum(v_perfil[extract(isodow from d.fecha)::int]) over (partition by ventas_semana(d.fecha)) end, 4)
    from (select g::date as fecha from generate_series(p_mes, (p_mes + interval '1 month - 1 day')::date, interval '1 day') g) d
  on conflict do nothing;

  insert into ventas_ecom_semanas (mes, semana, peso)
  select p_mes, s.semana,
         round(case when sum(s.bruto) over () = 0 then 0 else s.bruto / sum(s.bruto) over () end, 4)
    from (select ventas_semana(g::date) as semana, sum(v_perfil[extract(isodow from g::date)::int]) as bruto
            from generate_series(p_mes, (p_mes + interval '1 month - 1 day')::date, interval '1 day') g
           group by 1) s
  on conflict do nothing;
end $$;

/* Abre un mes que todavía no existe: copia del anterior lo que sigue igual (ticket, conversión,
   impuesto, premios, referencias y ROAS mínimo). El objetivo arranca vacío. Devuelve true si lo creó. */
create or replace function ventas_ecom_abrir(p_mes date)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  a ventas_ecom_mes%rowtype;
begin
  if exists (select 1 from ventas_ecom_mes where mes = p_mes) then return false; end if;
  select * into a from ventas_ecom_mes where mes = (p_mes - interval '1 month')::date;
  perform ventas_ecom_reparto_inicial(p_mes);
  insert into ventas_ecom_mes (mes, ticket, conversion, dias_mes, impuesto, premios, bench, be_roas)
  values (p_mes, coalesce(a.ticket, 80000), coalesce(a.conversion, 0.01),
          extract(day from (p_mes + interval '1 month - 1 day'))::smallint,
          coalesce(a.impuesto, 0.08), coalesce(a.premios, '{null,null,null,null}'),
          coalesce(a.bench, '{0.065,0.26,0.015}'), coalesce(a.be_roas, 2.8))
  on conflict do nothing;
  return found;
end $$;

-- =====================================================================
-- Lo que usa la pantalla
-- =====================================================================

/** ¿Puede abrir la hoja E-commerce quien pide? 'escribir' o null (la pantalla la suma al selector de local). */
create or replace function ventas_ecom_puede(p_caja text default null)
returns text language sql stable security definer set search_path = public as $$
  select ventas_ecom_acceso(p_caja)->>'puede'
$$;

/** Un mes del e-commerce, entero. Si no existe y quien pide puede cargar, lo abre (sólo hasta el mes que viene). */
create or replace function ventas_ecom_leer(p_mes date, p_caja text default null, p_abrir boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  a     jsonb := ventas_acceso_mes(ventas_ecom_acceso(p_caja), p_mes);
  v_mes date  := ventas_mes_de(p_mes);
begin
  if a->>'puede' is null then
    raise exception 'ventas: el e-commerce lo ven Atención al cliente y Administración' using hint = 'Entrá con tu usuario.';
  end if;
  if p_abrir and a->>'puede' = 'escribir' and v_mes <= ventas_mes_de((ventas_hoy() + interval '1 month')::date) then
    perform ventas_ecom_abrir(v_mes);
  end if;
  return ventas_ecom_datos(v_mes, a);
end $$;

/** Lo que devuelve ventas_ecom_leer, sin mirar quién pide (a = lo que dijo ventas_ecom_acceso). Interna.
    tienda: los pedidos PAGADOS de vdh.com.ar por día de creación en hora de Argentina, como ventas_dashboard:
    [día, suma de los totales, cantidad]. meta: [día, inversión, facturación, ventas, visitas, carritos]. */
create or replace function ventas_ecom_datos(p_mes date, a jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_mes  date := ventas_mes_de(p_mes);
  v_fin  date := (ventas_mes_de(p_mes) + interval '1 month')::date;
  m      ventas_ecom_mes%rowtype;
  r      jsonb;
begin
  select * into m from ventas_ecom_mes where mes = v_mes;
  select jsonb_build_object(
    'hoy', ventas_hoy(),
    'mes', v_mes,
    'ecom', true,
    'existe', m.mes is not null,
    'puede', a->>'puede',
    'supervisa', coalesce((a->>'supervisa')::boolean, false),
    'cerrado', coalesce((a->>'cerrado')::boolean, false),
    'carga_hasta', a->'carga_hasta',
    'quien', a->>'quien',
    'local', jsonb_build_object('id', 'ecommerce', 'nombre', 'E-commerce', 'codigo', 'ECOMMERCE'),
    'cfg', case when m.mes is null then null else jsonb_build_object(
             'objetivo', m.objetivo, 'ticket', m.ticket, 'conversion', m.conversion, 'dias_mes', m.dias_mes,
             'impuesto', m.impuesto, 'premios', to_jsonb(m.premios), 'bench', to_jsonb(m.bench), 'be_roas', m.be_roas) end,
    'dias', coalesce((
      select jsonb_agg(jsonb_build_array(extract(day from d.fecha)::int, d.peso, d.visitas) order by d.fecha)
        from ventas_ecom_dias d where d.fecha >= v_mes and d.fecha < v_fin), '[]'::jsonb),
    'semanas', coalesce((
      select jsonb_agg(jsonb_build_array(s.semana, s.peso, s.carritos) order by s.semana)
        from ventas_ecom_semanas s where s.mes = v_mes), '[]'::jsonb),
    'tienda', coalesce((
      select jsonb_agg(jsonb_build_array(extract(day from x.dia)::int, x.venta, x.n) order by x.dia)
        from (select (p.creado at time zone 'America/Argentina/Buenos_Aires')::date as dia,
                     sum(p.total) as venta, count(*) as n
                from tienda_pedidos p
               where p.pago = 'paid' and p.estado is distinct from 'cancelled'
                 and p.creado >= (v_mes::timestamp at time zone 'America/Argentina/Buenos_Aires')
                 and p.creado <  (v_fin::timestamp at time zone 'America/Argentina/Buenos_Aires')
               group by 1) x), '[]'::jsonb),
    'meta', coalesce((
      select jsonb_agg(jsonb_build_array(extract(day from t.fecha)::int, t.inversion, t.facturacion, t.ventas, t.visitas, t.carritos)
                       order by t.fecha)
        from ventas_ecom_meta t where t.fecha >= v_mes and t.fecha < v_fin), '[]'::jsonb),
    'meta_estado', (select jsonb_build_object('ultima', e.ultima, 'error', e.error, 'error_en', e.error_en)
                      from ventas_ecom_meta_estado e where e.id = 1),
    'tienda_ultima', (select max(p.actualizado) from tienda_pedidos p)
  ) into r;
  return r;
end $$;

/** Guarda una celda de la hoja E-commerce. p_valor es el número como texto (vacío = borrar).
    - config:      clave = objetivo | ticket | conversion | dias_mes | impuesto
    - premio:      clave = 0..3 (objetivo, +10%, +20%, +30%)
    - bench:       clave = 0..2 (Visitas → Carrito, Carrito → Compra, Conversión total)
    - be_roas:     clave = ''   (el ROAS mínimo del Informe de Temporada)
    - visitas:     clave = <día>
    - carritos:    clave = <semana>
    - peso_dia:    clave = <día>
    - peso_semana: clave = <semana> */
create or replace function ventas_ecom_guardar(p_mes date, p_que text, p_clave text, p_valor text, p_caja text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  a       jsonb := ventas_acceso_mes(ventas_ecom_acceso(p_caja), p_mes);
  v_mes   date  := ventas_mes_de(p_mes);
  v_hoy   date  := ventas_hoy();
  v_num   numeric;
  v_antes text;
  v_fecha date;
  v_sem   smallint;
begin
  perform ventas_exigir(a);
  if v_mes > ventas_mes_de((v_hoy + interval '1 month')::date) then
    raise exception 'ventas: ese mes todavía no se puede cargar';
  end if;
  perform ventas_ecom_abrir(v_mes);
  v_num := ventas_numero(p_valor);
  if v_num < 0 then raise exception 'ventas: no puede ser negativo'; end if;

  if p_que = 'config' then
    if coalesce(p_clave, '') not in ('objetivo', 'ticket', 'conversion', 'dias_mes', 'impuesto') then
      raise exception 'ventas: dato desconocido (%)', p_clave;
    end if;
    if p_clave in ('conversion', 'impuesto') and v_num > 1 then
      raise exception 'ventas: es demasiado: va como %% (1%% es 0,01)';
    end if;
    if p_clave = 'dias_mes' then
      v_num := round(v_num);
      if v_num < 1 or v_num > 31 then raise exception 'ventas: el mes tiene de 1 a 31 días'; end if;
    end if;
    if p_clave = 'impuesto' and v_num is null then v_num := 0; end if;
    execute format('select (%I)::text from ventas_ecom_mes where mes = $1', p_clave) into v_antes using v_mes;
    execute format('update ventas_ecom_mes set %I = $2, actualizado_en = now() where mes = $1', p_clave) using v_mes, v_num;

  elsif p_que in ('premio', 'bench') then
    if (p_que = 'premio' and coalesce(p_clave, '') not in ('0', '1', '2', '3'))
       or (p_que = 'bench' and coalesce(p_clave, '') not in ('0', '1', '2')) then
      raise exception 'ventas: dato desconocido (%)', p_clave;
    end if;
    if p_que = 'bench' and v_num > 1 then raise exception 'ventas: es demasiado: va como %% (6,5%% es 0,065)'; end if;
    execute format('select %I[$2]::text from ventas_ecom_mes where mes = $1', p_que || case when p_que = 'premio' then 's' else '' end)
      into v_antes using v_mes, p_clave::int + 1;
    execute format('update ventas_ecom_mes set %I[$2] = $3, actualizado_en = now() where mes = $1', p_que || case when p_que = 'premio' then 's' else '' end)
      using v_mes, p_clave::int + 1, v_num;

  elsif p_que = 'be_roas' then
    if v_num is null then raise exception 'ventas: el ROAS mínimo no puede quedar vacío'; end if;
    if v_num > 100 then raise exception 'ventas: es demasiado para un ROAS'; end if;
    select be_roas::text into v_antes from ventas_ecom_mes where mes = v_mes;
    update ventas_ecom_mes set be_roas = v_num, actualizado_en = now() where mes = v_mes;

  elsif p_que = 'visitas' then
    v_fecha := v_mes + (p_clave::int - 1);
    if ventas_mes_de(v_fecha) <> v_mes then raise exception 'ventas: ese día no es de este mes'; end if;
    if v_fecha > v_hoy then raise exception 'ventas: ese día todavía no llegó' using hint = 'Las visitas se cargan el día que pasó.'; end if;
    v_num := round(v_num);
    select visitas::text into v_antes from ventas_ecom_dias where fecha = v_fecha;
    insert into ventas_ecom_dias (fecha, peso, visitas, cargado_en, cargado_por) values (v_fecha, 0, v_num, now(), a->>'quien')
    on conflict (fecha) do update set visitas = excluded.visitas, cargado_en = now(), cargado_por = excluded.cargado_por;

  elsif p_que = 'carritos' then
    v_sem := p_clave::smallint;
    if not exists (select 1 from generate_series(v_mes, least((v_mes + interval '1 month - 1 day')::date, v_hoy), interval '1 day') g
                    where ventas_semana(g::date) = v_sem) then
      raise exception 'ventas: esa semana todavía no empezó';
    end if;
    v_num := round(v_num);
    select carritos::text into v_antes from ventas_ecom_semanas where mes = v_mes and semana = v_sem;
    insert into ventas_ecom_semanas (mes, semana, peso, carritos) values (v_mes, v_sem, 0, v_num)
    on conflict (mes, semana) do update set carritos = excluded.carritos;

  elsif p_que in ('peso_dia', 'peso_semana') then
    if not coalesce((a->>'supervisa')::boolean, false) then
      raise exception 'ventas: el reparto del objetivo lo cambian Atención al cliente o Administración';
    end if;
    if v_num is null then v_num := 0; end if;
    if v_num > 1 then raise exception 'ventas: el %% va de 0 a 100'; end if;
    if p_que = 'peso_dia' then
      v_fecha := v_mes + (p_clave::int - 1);
      if ventas_mes_de(v_fecha) <> v_mes then raise exception 'ventas: ese día no es de este mes'; end if;
      select peso::text into v_antes from ventas_ecom_dias where fecha = v_fecha;
      insert into ventas_ecom_dias (fecha, peso) values (v_fecha, v_num)
      on conflict (fecha) do update set peso = excluded.peso;
    else
      v_sem := p_clave::smallint;
      if v_sem < 1 or v_sem > ventas_semana((v_mes + interval '1 month - 1 day')::date) then
        raise exception 'ventas: esa semana no es de este mes';
      end if;
      select peso::text into v_antes from ventas_ecom_semanas where mes = v_mes and semana = v_sem;
      insert into ventas_ecom_semanas (mes, semana, peso) values (v_mes, v_sem, v_num)
      on conflict (mes, semana) do update set peso = excluded.peso;
    end if;

  else
    raise exception 'ventas: no sé guardar "%"', p_que;
  end if;

  perform ventas_anotar(ventas_ecom_id(), v_mes, a, 'ecom_' || p_que, p_clave, v_antes, v_num::text);
  return jsonb_build_object('ok', true);
exception
  when invalid_text_representation then
    raise exception 'ventas: ese lugar no existe (%)', p_clave;
  when numeric_value_out_of_range then
    raise exception 'ventas: el número es demasiado grande para ese lugar';
  when check_violation then
    raise exception 'ventas: ese número no va en ese lugar: revisá que esté bien escrito';
end $$;

-- =====================================================================
-- Lo que usa el robot de cada hora (vdh-respaldos, meta-ads.js)
-- =====================================================================

/* Carga lo que trajo de Meta: { filas: [{fecha, inversion, facturacion, ventas, visitas, carritos}] }.
   Cada día se pisa entero (Meta corrige los últimos días: el robot vuelve a pedir la última semana).
   La llama el robot con la conexión de la base (dueño): no la puede llamar nadie desde afuera. */
create or replace function ventas_ecom_meta_cargar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  f   jsonb;
  v_n int := 0;
begin
  for f in select * from jsonb_array_elements(coalesce(p->'filas', '[]'::jsonb)) loop
    insert into ventas_ecom_meta (fecha, inversion, facturacion, ventas, visitas, carritos, leido_en)
    values ((f->>'fecha')::date, coalesce((f->>'inversion')::numeric, 0), coalesce((f->>'facturacion')::numeric, 0),
            coalesce((f->>'ventas')::numeric, 0)::int, coalesce((f->>'visitas')::numeric, 0)::int,
            coalesce((f->>'carritos')::numeric, 0)::int, now())
    on conflict (fecha) do update set inversion = excluded.inversion, facturacion = excluded.facturacion,
      ventas = excluded.ventas, visitas = excluded.visitas, carritos = excluded.carritos, leido_en = now();
    v_n := v_n + 1;
  end loop;
  insert into ventas_ecom_meta_estado (id, ultima, error, error_en) values (1, now(), null, null)
  on conflict (id) do update set ultima = now(), error = null, error_en = null;
  return jsonb_build_object('dias', v_n);
end $$;

/* Anota que la lectura de Meta falló (la pantalla lo avisa arriba de la tabla de Meta). */
create or replace function ventas_ecom_meta_fallo(p_error text)
returns void language sql volatile security definer set search_path = public as $$
  insert into ventas_ecom_meta_estado (id, error, error_en) values (1, left(p_error, 300), now())
  on conflict (id) do update set error = left(p_error, 300), error_en = now()
$$;

-- =====================================================================
-- Pasar un mes de la planilla al sistema
-- =====================================================================

/* Carga un mes tal como estaba en la planilla del e-commerce (lo que se tipeaba: lo ámbar, el reparto,
   las visitas y los carritos). Si ya tenía algo, lo REEMPLAZA. Lo usa sólo el SQL de importación.
   La venta y la Q no se importan: salen de los pedidos de la tienda.
   p_datos = { cfg: {objetivo, ticket, conversion, dias_mes, impuesto, premios: [4], bench: [3]},
               dias: [[día, peso, visitas]], semanas: [[semana, peso, carritos]] } */
create or replace function ventas_ecom_importar(p_mes date, p_datos jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  c     jsonb := p_datos->'cfg';
  v_fin date  := (p_mes + interval '1 month')::date;
  v_vis int;
begin
  if extract(day from p_mes) <> 1 then raise exception 'ventas: el mes va con día 1'; end if;
  delete from ventas_ecom_dias    where fecha >= p_mes and fecha < v_fin;
  delete from ventas_ecom_semanas where mes = p_mes;
  delete from ventas_ecom_mes     where mes = p_mes;
  insert into ventas_ecom_mes (mes, objetivo, ticket, conversion, dias_mes, impuesto, premios, bench)
  values (p_mes, (c->>'objetivo')::numeric, (c->>'ticket')::numeric, (c->>'conversion')::numeric,
          round((c->>'dias_mes')::numeric), coalesce((c->>'impuesto')::numeric, 0.08),
          coalesce((select array_agg((x)::numeric order by i) from jsonb_array_elements_text(c->'premios') with ordinality t(x, i)),
                   '{null,null,null,null}'),
          coalesce((select array_agg((x)::numeric order by i) from jsonb_array_elements_text(c->'bench') with ordinality t(x, i)),
                   '{0.065,0.26,0.015}'));
  insert into ventas_ecom_dias (fecha, peso, visitas, cargado_por)
  select p_mes + ((d->>0)::int - 1), coalesce((d->>1)::numeric, 0), round((d->>2)::numeric),
         case when d->>2 is not null then 'Planilla' end
    from jsonb_array_elements(p_datos->'dias') d;
  insert into ventas_ecom_semanas (mes, semana, peso, carritos)
  select p_mes, (s->>0)::smallint, coalesce((s->>1)::numeric, 0), round((s->>2)::numeric)
    from jsonb_array_elements(p_datos->'semanas') s;
  select coalesce(sum(visitas), 0) into v_vis from ventas_ecom_dias where fecha >= p_mes and fecha < v_fin;
  insert into ventas_cambios (local_id, mes, quien, que, clave, despues)
  values (ventas_ecom_id(), p_mes, 'Planilla', 'ecom_importar', null, v_vis || ' visitas');
  return jsonb_build_object('visitas', v_vis);
end $$;

-- =====================================================================
-- Permisos de las funciones
-- =====================================================================
revoke all on function ventas_ecom_acceso(text), ventas_ecom_reparto_inicial(date), ventas_ecom_abrir(date),
                       ventas_ecom_datos(date, jsonb), ventas_ecom_meta_cargar(jsonb), ventas_ecom_meta_fallo(text),
                       ventas_ecom_importar(date, jsonb)
  from public, anon, authenticated;
revoke all on function ventas_ecom_puede(text), ventas_ecom_leer(date, text, boolean),
                       ventas_ecom_guardar(date, text, text, text, text)
  from public;
/* anon también puede preguntar (la pantalla pregunta antes de saber si hay usuario): sin usuario contesta que no. */
grant execute on function ventas_ecom_puede(text), ventas_ecom_leer(date, text, boolean),
                          ventas_ecom_guardar(date, text, text, text, text)
  to anon, authenticated, service_role;

-- Para deshacer todo:
--   drop function if exists ventas_ecom_puede(text), ventas_ecom_leer(date, text, boolean),
--     ventas_ecom_guardar(date, text, text, text, text), ventas_ecom_acceso(text), ventas_ecom_reparto_inicial(date),
--     ventas_ecom_abrir(date), ventas_ecom_datos(date, jsonb), ventas_ecom_meta_cargar(jsonb), ventas_ecom_meta_fallo(text),
--     ventas_ecom_importar(date, jsonb), ventas_ecom_id();
--   drop table if exists ventas_ecom_meta_estado, ventas_ecom_meta, ventas_ecom_semanas, ventas_ecom_dias, ventas_ecom_mes;
--   delete from ventas_cambios where local_id = '00000000-0000-0000-0000-0000000000ec';
