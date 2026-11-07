/* ─── SQL 258 (7/11/2026) · EL DEPÓSITO DE LA FÁBRICA, CON STOCK ───
   Lucas (reunión del 6/11): "tenés que tener dos funcionalidades: el depósito donde pongo mercadería y una que sea
   remito para moverla". Éste es el depósito; el remito (que salga de acá y entre al local) viene en el paso que sigue.
   1. La Fábrica tiene depósitos propios, como cada sucursal: son los de pos_depositos SIN sucursal (local_id vacío), con
      su stock en pos_stock y sus movimientos en pos_stock_movs (también sin sucursal). Arranca con uno, predeterminado
      y vacío: «Depósito de Primera» (en BlueSoft, «39 Deposito de Primera Jul25»).
   2. Fábrica → Depósito: Stock (por talle y color, como «Stock talles en columnas» de BlueSoft), Depósitos e
      Inventario (la carga inicial con el Excel de BlueSoft y los de después) y el ajuste de una variante.
      Lo hace quien entra a Fábrica (SQL 256): pos_fabrica_ok().
   3. Lo de las sucursales sigue igual. «Todas» las sucursales de la consulta de stock no suma la Fábrica.
   Cambia 8 funciones (create or replace: los permisos de cada una quedan como estaban), suma 4 y le saca el «not null»
   a local_id de pos_depositos, pos_stock, pos_stock_movs y pos_inventarios. No toca el stock de nadie.
   Para deshacer: deshacer-258.sql (mientras la Fábrica no tenga stock cargado). */

alter table pos_depositos alter column local_id drop not null;
alter table pos_stock alter column local_id drop not null;
alter table pos_stock_movs alter column local_id drop not null;
alter table pos_inventarios alter column local_id drop not null;
/* La clave (depósito, sucursal) no mira nada si la sucursal está vacía: el depósito, aparte. */
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pos_stock_deposito_id_fkey') then
    alter table pos_stock add constraint pos_stock_deposito_id_fkey foreign key (deposito_id) references pos_depositos(id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pos_stock_movs_deposito_id_fkey') then
    alter table pos_stock_movs add constraint pos_stock_movs_deposito_id_fkey foreign key (deposito_id) references pos_depositos(id);
  end if;
end $$;
/* En la Fábrica, como en cada sucursal: un nombre no se repite y hay un solo predeterminado. */
create unique index if not exists pos_depositos_nombre_fabrica on pos_depositos (lower(nombre)) where local_id is null;
create unique index if not exists pos_depositos_uno_fabrica on pos_depositos ((local_id is null)) where local_id is null and predeterminado;

create or replace function pos_es_fabrica(p_deposito uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pos_depositos where id = p_deposito and local_id is null)
$$;
revoke all on function pos_es_fabrica(uuid) from public, anon, authenticated;

create or replace function pos_fabrica_ok() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not pos_puede('fabrica') then
    raise exception 'Esto es de la Fábrica: lo da la oficina con «Entra a Fábrica» en Config → Usuarios.' using errcode = '42501';
  end if;
end $$;
revoke all on function pos_fabrica_ok() from public, anon, authenticated;

/* Los depósitos de la Fábrica, como pos_depositos los de una sucursal. */
create or replace function pos_fabrica_depositos() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_fabrica_ok();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', d.id, 'numero', d.numero, 'local_id', null, 'local', 'Fábrica', 'nombre', d.nombre,
             'temporada', d.temporada, 'anio', d.anio, 'consulta', d.consulta, 'activo', d.activo,
             'predeterminado', d.predeterminado, 'predeterminado_en', d.predeterminado_en,
             'creado_en', d.creado_en, 'creado_nombre', d.creado_nombre,
             'unidades', coalesce(t.unidades, 0), 'renglones', coalesce(t.renglones, 0), 'negativos', coalesce(t.negativos, 0),
             'usado', exists (select 1 from pos_stock_movs m where m.deposito_id = d.id)
                      or exists (select 1 from pos_remitos r where r.origen_deposito_id = d.id or r.destino_deposito_id = d.id)
                      or exists (select 1 from pos_inventarios i where i.deposito_id = d.id))
           order by d.predeterminado desc, d.activo desc, d.numero)
      from pos_depositos d
      left join lateral (select sum(s.cantidad)::int unidades, (count(*) filter (where s.cantidad <> 0))::int renglones,
                                (count(*) filter (where s.cantidad < 0))::int negativos
                           from pos_stock s where s.deposito_id = d.id) t on true
     where d.local_id is null), '[]'::jsonb);
end $$;
revoke all on function pos_fabrica_depositos() from public, anon;
grant execute on function pos_fabrica_depositos() to authenticated;

/* Los inventarios cargados en la Fábrica, como pos_inventarios los de las sucursales. */
create or replace function pos_fabrica_inventarios() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform pos_fabrica_ok();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', i.id, 'fecha', i.fecha, 'local', 'Fábrica', 'local_id', null, 'persona', i.persona_nombre,
                                        'origen', i.origen, 'lineas', i.lineas, 'unidades', i.unidades, 'cambiaron', i.cambiaron,
                                        'resto_a_cero', i.resto_a_cero, 'observaciones', i.observaciones,
                                        'deposito', (select d.nombre from pos_depositos d where d.id = i.deposito_id)) order by i.fecha desc)
      from (select * from pos_inventarios x where x.local_id is null order by x.fecha desc limit 50) i), '[]'::jsonb);
end $$;
revoke all on function pos_fabrica_inventarios() from public, anon;
grant execute on function pos_fabrica_inventarios() to authenticated;

CREATE OR REPLACE FUNCTION public.pos_stock_mover(p_local uuid, p_codigo text, p_talle text, p_color text, p_cantidad integer, p_tipo text, p_ref_id uuid, p_ref text, p_descripcion text DEFAULT NULL::text, p_detalle text DEFAULT NULL::text, p_clave text DEFAULT NULL::text, p_deposito uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_c   text := upper(trim(coalesce(p_codigo, '')));
  v_t   text := upper(trim(coalesce(p_talle, '')));
  v_co  text := upper(trim(coalesce(p_color, '')));
  v_an  boolean := p_tipo like '%anulad%';
  v_dep uuid := p_deposito;
  v_e   int;
  v_s   int;
begin
  if v_c = '' or length(v_c) > 30 or coalesce(p_cantidad, 0) = 0 then return; end if;
  if v_dep is null then
    if p_local is null then raise exception 'Falta el depósito de la fábrica.'; end if;   -- SQL 258
    v_dep := pos_deposito_de(p_local);   -- SQL 193
  elsif not exists (select 1 from pos_depositos where id = v_dep and local_id is not distinct from p_local) then   -- SQL 258: o de la Fábrica
    raise exception 'Ese depósito no es de la sucursal.';
  end if;
  v_e := case when not v_an and p_cantidad > 0 then p_cantidad when v_an and p_cantidad < 0 then p_cantidad else 0 end;
  v_s := case when not v_an and p_cantidad < 0 then -p_cantidad when v_an and p_cantidad > 0 then -p_cantidad else 0 end;
  insert into pos_stock_movs (local_id, deposito_id, codigo, talle, color, cantidad, tipo, ref_id, ref, detalle, persona, clave)
  values (p_local, v_dep, v_c, v_t, v_co, p_cantidad, p_tipo, p_ref_id, p_ref, nullif(trim(coalesce(p_detalle, '')), ''), orden_yo_id(), p_clave);
  insert into pos_stock as st (local_id, deposito_id, codigo, talle, color, cantidad, entradas, salidas, descripcion)
  values (p_local, v_dep, v_c, v_t, v_co, p_cantidad, v_e, v_s, nullif(trim(coalesce(p_descripcion, '')), ''))
  on conflict (deposito_id, codigo, talle, color) do update
     set cantidad = st.cantidad + excluded.cantidad, entradas = st.entradas + excluded.entradas, salidas = st.salidas + excluded.salidas,
         descripcion = coalesce(excluded.descripcion, st.descripcion), actualizado_en = now();
end $function$;

CREATE OR REPLACE FUNCTION public.pos_stock_consulta(p_local uuid DEFAULT NULL::uuid, p_codigos text[] DEFAULT NULL::text[], p_buscar text DEFAULT NULL::text, p_ocultar_sin boolean DEFAULT true, p_negativos boolean DEFAULT false, p_desde integer DEFAULT 0, p_productos integer DEFAULT NULL::integer, p_resumen boolean DEFAULT false, p_deposito uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_q     text := nullif(lower(trim(coalesce(p_buscar, ''))), '');
  v_desde int := greatest(coalesce(p_desde, 0), 0);
  v_fab   boolean := p_local is null and p_deposito is not null and pos_es_fabrica(p_deposito);   -- SQL 258
begin
  /* SQL 258: el depósito de la Fábrica (sin sucursal) lo mira quien entra a Fábrica. */
  if v_fab then
    perform pos_fabrica_ok();
  else
    perform pos_permiso();
    perform pos_local_ok(p_local);   -- SQL 190
  end if;
  if p_productos is not null and (p_productos < 0 or p_productos > 2000) then
    raise exception 'Se piden de 0 a 2000 productos por vez.';
  end if;
  if p_deposito is not null and not v_fab and not exists (select 1 from pos_depositos where id = p_deposito and local_id = p_local) then
    raise exception 'Ese depósito no es de la sucursal.';
  end if;
  return (
    /* SQL 193: un renglón por local, producto, talle y color (lo de sus depósitos, sumado). */
    with b as (
      select x.local_id, x.codigo, x.talle, x.color, sum(x.cantidad)::int cantidad, sum(x.entradas)::int entradas, sum(x.salidas)::int salidas,
             max(x.descripcion) descripcion
        from pos_stock x join pos_depositos d on d.id = x.deposito_id
       where case when v_fab then x.local_id is null else (p_local is null and x.local_id is not null) or x.local_id = p_local end   -- SQL 258
         and case when p_deposito is null then d.consulta and d.activo else d.id = p_deposito end
       group by x.local_id, x.codigo, x.talle, x.color
    ),
    s as (
      select x.* from b x
       where ((p_codigos is null and v_q is null)
              or x.codigo = any(coalesce(p_codigos, '{}'::text[]))
              or (v_q is not null and (lower(x.codigo) like v_q || '%' or lower(coalesce(x.descripcion, '')) like '%' || v_q || '%')))
         and (not coalesce(p_ocultar_sin, true) or x.cantidad <> 0)
         and (not coalesce(p_negativos, false) or x.cantidad < 0)
    ),
    /* SQL 172: los productos en orden de código, numerados desde 0, para pedirlos de a tandas. */
    p as (select d.codigo, (row_number() over (order by d.codigo) - 1)::int n from (select distinct codigo from s) d),
    f as (select s.* from s join p on p.codigo = s.codigo
           where p_productos is null or (p.n >= v_desde and p.n < v_desde + p_productos))
    select jsonb_build_object(
      'filas', coalesce((select jsonb_agg(jsonb_build_array(z.local_id, z.codigo, z.talle, z.color, z.cantidad, z.entradas, z.salidas, z.descripcion)
                                          order by z.codigo, z.color, z.talle, z.local_id)
                           from (select * from f order by codigo, color, talle, local_id limit 60000) z), '[]'::jsonb),
      'totales', (select jsonb_build_object('cantidad', coalesce(sum(cantidad), 0), 'entradas', coalesce(sum(entradas), 0),
                                            'salidas', coalesce(sum(salidas), 0), 'lineas', count(*),
                                            'negativos', count(*) filter (where cantidad < 0),
                                            'productos', count(distinct codigo)) from s),
      /* SQL 172: un renglón por producto [código, descripción, cantidad, entradas, salidas, renglones, en negativo]. */
      'resumen', case when coalesce(p_resumen, false) then coalesce((
                   select jsonb_agg(jsonb_build_array(g.codigo, g.descripcion, g.cantidad, g.entradas, g.salidas, g.lineas, g.negativos) order by g.codigo)
                     from (select codigo, max(descripcion) descripcion, sum(cantidad) cantidad, sum(entradas) entradas, sum(salidas) salidas,
                                  count(*) lineas, count(*) filter (where cantidad < 0) negativos
                             from s group by codigo) g), '[]'::jsonb) end,
      /* SQL 193: con un depósito, si ése ya tuvo algo. */
      'cargado', exists (select 1 from pos_stock y where case when v_fab then y.local_id is null else (p_local is null and y.local_id is not null) or y.local_id = p_local end and (p_deposito is null or y.deposito_id = p_deposito)),
      /* Con tandas: si quedan productos después de ésta. Sin tandas: si pasó de 60.000 renglones. */
      'mas', case when p_productos is null then (select count(*) > 60000 from f)
                  else (select count(*) > v_desde + p_productos from p) end
    )
  );
end $function$;

CREATE OR REPLACE FUNCTION public.pos_stock_variante(p_local uuid, p_codigo text, p_talle text, p_color text, p_deposito uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_c   text := upper(trim(coalesce(p_codigo, '')));
  v_t   text := upper(trim(coalesce(p_talle, '')));
  v_co  text := upper(trim(coalesce(p_color, '')));
  v_fab boolean := p_local is null and p_deposito is not null and pos_es_fabrica(p_deposito);   -- SQL 258
begin
  /* SQL 258: el depósito de la Fábrica (sin sucursal) lo mira quien entra a Fábrica. */
  if v_fab then
    perform pos_fabrica_ok();
  else
    perform pos_permiso();
    perform pos_local_ok(p_local);   -- SQL 190
  end if;
  if p_deposito is not null and not v_fab and not exists (select 1 from pos_depositos where id = p_deposito and local_id = p_local) then
    raise exception 'Ese depósito no es de la sucursal.';
  end if;
  return jsonb_build_object(
    'local', case when v_fab then 'Fábrica' else (select l.nombre from orden_locales l where l.id = p_local) end,   -- SQL 258
    'deposito', (select d.nombre from pos_depositos d where d.id = p_deposito),
    'stock', (select jsonb_build_object('cantidad', sum(s.cantidad), 'entradas', sum(s.entradas), 'salidas', sum(s.salidas), 'descripcion', max(s.descripcion))
                from pos_stock s join pos_depositos d on d.id = s.deposito_id
               where (case when v_fab then s.local_id is null else s.local_id = p_local end) and s.codigo = v_c and s.talle = v_t and s.color = v_co
                 and case when p_deposito is null then d.consulta and d.activo else d.id = p_deposito end
              having count(*) > 0),
    'depositos', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'nombre', d.nombre, 'cantidad', s.cantidad, 'predeterminado', d.predeterminado,
                                          'consulta', d.consulta and d.activo) order by d.predeterminado desc, d.numero)
        from pos_stock s join pos_depositos d on d.id = s.deposito_id
       where (case when v_fab then s.local_id is null else s.local_id = p_local end) and s.codigo = v_c and s.talle = v_t and s.color = v_co), '[]'::jsonb),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object('fecha', m.fecha, 'tipo', m.tipo, 'cantidad', m.cantidad, 'ref', m.ref, 'ref_id', m.ref_id,
                                          'detalle', m.detalle, 'persona', pe.nombre, 'deposito', dm.nombre,
                                          /* SQL 172: quién vendió o atendió (en las ventas y los cambios), para el Detalle. */
                                          'vendedor', case when m.tipo in ('venta', 'venta_anulada') then (select v.vendedor from pos_ventas v where v.id = m.ref_id)
                                                           when m.tipo in ('cambio', 'cambio_anulado') then (select k.vendedor from pos_cambios k where k.id = m.ref_id) end)
               order by m.fecha desc, m.id desc)
        from (select * from pos_stock_movs x
               where (case when v_fab then x.local_id is null else x.local_id = p_local end) and x.codigo = v_c and x.talle = v_t and x.color = v_co
                 and (p_deposito is null or x.deposito_id = p_deposito)
               order by x.fecha desc, x.id desc limit 200) m
        left join orden_personas pe on pe.id = m.persona
        left join pos_depositos dm on dm.id = m.deposito_id), '[]'::jsonb));
end $function$;

CREATE OR REPLACE FUNCTION public.pos_stock_ajustar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_local    uuid := nullif(p->>'local_id', '')::uuid;
  v_dep      uuid := nullif(p->>'deposito_id', '')::uuid;
  v_c        text := upper(trim(coalesce(p->>'codigo', '')));
  v_t        text := upper(trim(coalesce(p->>'talle', '')));
  v_co       text := upper(trim(coalesce(p->>'color', '')));
  v_motivo   text := trim(coalesce(p->>'motivo', ''));
  v_detalle  text := nullif(trim(coalesce(p->>'detalle', '')), '');
  v_clave    text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_nueva    int;
  v_actual   int;
  v_fab      boolean;   -- SQL 258
begin
  /* SQL 258: en un depósito de la Fábrica (sin sucursal), quien entra a Fábrica; en una sucursal, la oficina (SQL 190). */
  v_fab := v_local is null and v_dep is not null and pos_es_fabrica(v_dep);
  if v_fab then perform pos_fabrica_ok(); else perform pos_permiso('gestion'); end if;
  if v_clave is not null and exists (select 1 from pos_stock_movs where clave = v_clave) then
    return jsonb_build_object('ya', true);
  end if;
  if not v_fab and (v_local is null or not exists (select 1 from orden_locales where id = v_local and activo)) then raise exception 'Elegí la sucursal.'; end if;
  if v_c = '' or length(v_c) > 30 then raise exception 'Falta el código del producto.'; end if;
  if coalesce(p->>'cantidad', '') !~ '^[0-9]{1,5}$' then raise exception 'Escribí cuántas hay de verdad (de 0 a 99999).'; end if;
  v_nueva := (p->>'cantidad')::int;
  if v_motivo not in ('Falla', 'Robo o faltante', 'Error de carga', 'Apareció', 'Otro') then raise exception 'Elegí el motivo del ajuste.'; end if;
  if v_motivo = 'Otro' and v_detalle is null then raise exception 'Escribí el motivo.'; end if;
  if length(v_detalle) > 200 then raise exception 'El detalle es demasiado largo.'; end if;
  /* SQL 193: el depósito (sin él, el predeterminado). */
  if v_dep is null then v_dep := pos_deposito_de(v_local);
  elsif not v_fab and not exists (select 1 from pos_depositos where id = v_dep and local_id = v_local) then raise exception 'Ese depósito no es de la sucursal.';
  end if;
  /* Un ajuste por vez en cada local, y el renglón bloqueado (si justo entra
     una venta, espera): así "hay N" es contra lo que hay de verdad. */
  perform pg_advisory_xact_lock(hashtext('pos_stock:' || coalesce(v_local::text, 'fabrica')));   -- SQL 258: la Fábrica no tiene sucursal
  select s.cantidad into v_actual from pos_stock s
   where s.deposito_id = v_dep and s.codigo = v_c and s.talle = v_t and s.color = v_co for update;
  v_actual := coalesce(v_actual, 0);
  if v_nueva = v_actual then raise exception 'El sistema ya dice %: no hay nada que ajustar.', v_actual; end if;
  perform pos_stock_mover(v_local, v_c, v_t, v_co, v_nueva - v_actual, 'ajuste', null, 'Ajuste',
                          nullif(trim(coalesce(p->>'descripcion', '')), ''), v_motivo || coalesce(': ' || v_detalle, ''), v_clave, v_dep);
  return jsonb_build_object('antes', v_actual, 'ahora', v_nueva, 'ya', false, 'deposito', (select nombre from pos_depositos where id = v_dep));
end $function$;

CREATE OR REPLACE FUNCTION public.pos_inventario_cargar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_local   uuid := nullif(p->>'local_id', '')::uuid;
  v_dep     uuid := nullif(p->>'deposito_id', '')::uuid;
  v_items   jsonb := coalesce(p->'items', '[]'::jsonb);
  v_cero    boolean := coalesce(nullif(p->>'resto_a_cero', '')::boolean, false);
  v_obs     text := nullif(trim(coalesce(p->>'observaciones', '')), '');
  v_origen  text := nullif(trim(coalesce(p->>'origen', '')), '');
  v_clave   text := nullif(trim(coalesce(p->>'clave', '')), '');
  v_ya      pos_inventarios;
  v_id      uuid;
  v_l       int := 0;
  v_u       int := 0;
  v_c       int := 0;
  x         record;
  e         jsonb;
  v_fab     boolean;   -- SQL 258
begin
  /* SQL 258: en un depósito de la Fábrica (sin sucursal), quien entra a Fábrica; en una sucursal, la oficina (SQL 190). */
  v_fab := v_local is null and v_dep is not null and pos_es_fabrica(v_dep);
  if v_fab then perform pos_fabrica_ok(); else perform pos_permiso('gestion'); end if;
  if v_clave is not null then
    select * into v_ya from pos_inventarios where clave = v_clave;
    if found then
      return jsonb_build_object('id', v_ya.id, 'lineas', v_ya.lineas, 'unidades', v_ya.unidades, 'cambiaron', v_ya.cambiaron, 'ya', true);
    end if;
  end if;
  if not v_fab and (v_local is null or not exists (select 1 from orden_locales where id = v_local and activo)) then raise exception 'Elegí la sucursal.'; end if;
  if length(v_obs) > 300 or length(v_origen) > 120 then raise exception 'El texto es demasiado largo.'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then raise exception 'La lista está vacía.'; end if;
  if jsonb_array_length(v_items) > 30000 then raise exception 'Son demasiados renglones (máximo, 30.000).'; end if;
  for e in select * from jsonb_array_elements(v_items) loop
    if nullif(trim(coalesce(e->>'codigo', '')), '') is null then raise exception 'Hay un renglón sin código.'; end if;
    if length(trim(e->>'codigo')) > 30 then raise exception 'El código % es demasiado largo.', left(trim(e->>'codigo'), 40); end if;
    if coalesce(e->>'cantidad', '') !~ '^-?[0-9]{1,5}$' then
      raise exception 'La cantidad de % no es un número entero.', trim(e->>'codigo');
    end if;
  end loop;
  /* SQL 193: el depósito (sin él, el predeterminado). */
  if v_dep is null then v_dep := pos_deposito_de(v_local);
  elsif not v_fab and not exists (select 1 from pos_depositos where id = v_dep and local_id = v_local) then raise exception 'Ese depósito no es de la sucursal.';
  end if;

  /* Uno por vez en cada local: los ajustes y las otras cargas esperan, y el
     stock del depósito queda bloqueado (las ventas de ese momento esperan). */
  perform pg_advisory_xact_lock(hashtext('pos_stock:' || coalesce(v_local::text, 'fabrica')));   -- SQL 258: la Fábrica no tiene sucursal
  perform 1 from pos_stock where deposito_id = v_dep for update;
  insert into pos_inventarios (local_id, deposito_id, persona, persona_nombre, origen, resto_a_cero, observaciones, clave)
  values (v_local, v_dep, orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()), v_origen, v_cero, v_obs, v_clave)
  returning id into v_id;

  /* Lo de la lista (los repetidos se suman), contra lo que dice el sistema. */
  for x in
    select z.c, z.t, z.co, z.n, z.d, coalesce(s.cantidad, 0) actual
      from (select upper(trim(e2->>'codigo')) c, upper(trim(coalesce(e2->>'talle', ''))) t, upper(trim(coalesce(e2->>'color', ''))) co,
                   sum((e2->>'cantidad')::int)::int n, max(nullif(trim(coalesce(e2->>'descripcion', '')), '')) d
              from jsonb_array_elements(v_items) e2 group by 1, 2, 3) z
      left join pos_stock s on s.deposito_id = v_dep and s.codigo = z.c and s.talle = z.t and s.color = z.co
  loop
    v_l := v_l + 1;
    v_u := v_u + greatest(x.n, 0);
    if x.n <> x.actual then
      perform pos_stock_mover(v_local, x.c, x.t, x.co, x.n - x.actual, 'inventario', v_id, 'Inventario', x.d, null, null, v_dep);
      v_c := v_c + 1;
    elsif x.d is not null then
      update pos_stock set descripcion = x.d where deposito_id = v_dep and codigo = x.c and talle = x.t and color = x.co and descripcion is null;
    end if;
  end loop;

  /* Lo que no está en la lista, en 0 (es el inventario completo del depósito). */
  if v_cero then
    for x in
      select s.codigo, s.talle, s.color, s.cantidad
        from pos_stock s
        left join (select distinct upper(trim(e3->>'codigo')) c, upper(trim(coalesce(e3->>'talle', ''))) t, upper(trim(coalesce(e3->>'color', ''))) co
                     from jsonb_array_elements(v_items) e3) z on z.c = s.codigo and z.t = s.talle and z.co = s.color
       where s.deposito_id = v_dep and s.cantidad <> 0 and z.c is null
    loop
      perform pos_stock_mover(v_local, x.codigo, x.talle, x.color, -x.cantidad, 'inventario', v_id, 'Inventario', null, 'No estaba en la lista', null, v_dep);
      v_c := v_c + 1;
    end loop;
  end if;

  update pos_inventarios set lineas = v_l, unidades = v_u, cambiaron = v_c where id = v_id;
  return jsonb_build_object('id', v_id, 'lineas', v_l, 'unidades', v_u, 'cambiaron', v_c, 'ya', false,
                            'deposito', (select nombre from pos_depositos where id = v_dep));
end $function$;

CREATE OR REPLACE FUNCTION public.pos_deposito_guardar(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id      uuid := nullif(p->>'id', '')::uuid;
  v_local   uuid := nullif(p->>'local_id', '')::uuid;
  v_temp    text := nullif(trim(coalesce(p->>'temporada', '')), '');
  v_anio    int;
  v_nombre  text := nullif(regexp_replace(trim(coalesce(p->>'nombre', '')), '\s+', ' ', 'g'), '');
  v_cons    boolean := coalesce(nullif(p->>'consulta', '')::boolean, true);
  v_activo  boolean := coalesce(nullif(p->>'activo', '')::boolean, true);
  d         pos_depositos;
  v_fab     boolean := coalesce(nullif(p->>'fabrica', '')::boolean, false);   -- SQL 258
begin
  if v_id is not null then
    select * into d from pos_depositos where id = v_id for update;
    if not found then raise exception 'No existe ese depósito.'; end if;
    v_local := d.local_id;
    v_fab := d.local_id is null;   -- SQL 258
  end if;
  /* SQL 258: los depósitos de la Fábrica (sin sucursal) los maneja quien entra a Fábrica; los de una sucursal, como antes. */
  if v_fab then
    perform pos_fabrica_ok();
    v_local := null;
  else
    perform pos_permiso('envios');
    if v_local is null or not exists (select 1 from orden_locales where id = v_local and activo) then raise exception 'Elegí la sucursal.'; end if;
    perform pos_local_ok(v_local);
  end if;
  if v_temp is not null then
    if v_temp not in ('Verano', 'Invierno') then raise exception 'La temporada es Verano o Invierno.'; end if;
    if coalesce(p->>'anio', '') !~ '^[0-9]{4}$' or (p->>'anio')::int not between 2000 and 2100 then
      raise exception 'Escribí el año (por ejemplo, 2027).';
    end if;
    v_anio := (p->>'anio')::int;
    v_nombre := v_temp || ' ' || v_anio;
  end if;
  if v_nombre is null then raise exception 'Escribí el nombre del depósito.'; end if;
  if length(v_nombre) > 40 then raise exception 'El nombre es demasiado largo (hasta 40 letras).'; end if;
  if exists (select 1 from pos_depositos x where x.local_id is not distinct from v_local and lower(x.nombre) = lower(v_nombre) and x.id is distinct from v_id) then
    raise exception '% ya tiene el depósito «%».', coalesce((select l.nombre from orden_locales l where l.id = v_local), 'La Fábrica'), v_nombre;   -- SQL 258
  end if;
  if v_id is not null and d.predeterminado and not v_activo then
    raise exception 'Es el depósito predeterminado: para desactivarlo, primero predeterminá otro.';
  end if;
  if v_id is null then
    perform pg_advisory_xact_lock(hashtext('pos_deposito'));
    insert into pos_depositos (numero, local_id, nombre, temporada, anio, consulta, activo, creado_por, creado_nombre)
    values ((select coalesce(max(numero), 0) + 1 from pos_depositos), v_local, v_nombre, v_temp, v_anio, v_cons, v_activo,
            orden_yo_id(), (select pe.nombre from orden_personas pe where pe.id = orden_yo_id()))
    returning * into d;
  else
    update pos_depositos set nombre = v_nombre, temporada = v_temp, anio = v_anio, consulta = v_cons or predeterminado, activo = v_activo
     where id = v_id returning * into d;
  end if;
  return jsonb_build_object('id', d.id, 'numero', d.numero, 'nombre', d.nombre, 'nuevo', v_id is null);
end $function$;

CREATE OR REPLACE FUNCTION public.pos_deposito_predeterminar(p_id uuid, p_sacar_viejo boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d pos_depositos; v pos_depositos;
begin
  select * into d from pos_depositos where id = p_id for update;
  if not found then raise exception 'No existe ese depósito.'; end if;
  /* SQL 258: los de la Fábrica (sin sucursal), quien entra a Fábrica; los de una sucursal, como antes. */
  if d.local_id is null then
    perform pos_fabrica_ok();
  else
    perform pos_permiso('envios');
    perform pos_local_ok(d.local_id);
  end if;
  if not d.activo then raise exception 'El depósito está inactivo: activalo primero.'; end if;
  if d.predeterminado then raise exception 'Ya es el predeterminado.'; end if;
  select * into v from pos_depositos where local_id is not distinct from d.local_id and predeterminado for update;   -- SQL 258
  update pos_depositos set predeterminado = false, consulta = consulta and not coalesce(p_sacar_viejo, false) where id = v.id;
  update pos_depositos set predeterminado = true, predeterminado_en = now(), consulta = true where id = d.id;
  return jsonb_build_object('nombre', d.nombre, 'anterior', v.nombre,
                            'quedaron', (select coalesce(sum(s.cantidad), 0) from pos_stock s where s.deposito_id = v.id));
end $function$;

CREATE OR REPLACE FUNCTION public.pos_deposito_borrar(p_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d pos_depositos;
begin
  select * into d from pos_depositos where id = p_id for update;
  if not found then raise exception 'No existe ese depósito.'; end if;
  /* SQL 258: los de la Fábrica (sin sucursal), quien entra a Fábrica; los de una sucursal, como antes. */
  if d.local_id is null then
    perform pos_fabrica_ok();
  else
    perform pos_permiso('envios');
    perform pos_local_ok(d.local_id);
  end if;
  if d.predeterminado then raise exception 'Es el depósito predeterminado: no se puede borrar.'; end if;
  if exists (select 1 from pos_stock where deposito_id = p_id) or exists (select 1 from pos_stock_movs where deposito_id = p_id)
     or exists (select 1 from pos_remitos where origen_deposito_id = p_id or destino_deposito_id = p_id)
     or exists (select 1 from pos_inventarios where deposito_id = p_id) then
    raise exception 'Ya tuvo mercadería: no se puede borrar. Si no se usa más, sacale «Activo».';
  end if;
  delete from pos_depositos where id = p_id;
  return true;
end $function$;

/* El primer depósito de la Fábrica: vacío y predeterminado (el nombre se cambia en Fábrica → Depósitos). */
insert into pos_depositos (numero, local_id, nombre, predeterminado, predeterminado_en, creado_nombre)
select (select coalesce(max(numero), 0) + 1 from pos_depositos), null, 'Depósito de Primera', true, now(), 'SQL 258'
 where not exists (select 1 from pos_depositos where local_id is null);

/* Quedó así: los depósitos de la Fábrica, y el stock de las sucursales igual que antes. */
select d.numero, d.nombre, d.predeterminado, (select count(*) from pos_stock s where s.deposito_id = d.id) renglones
  from pos_depositos d where d.local_id is null order by d.numero;
select count(*) renglones_de_las_sucursales, coalesce(sum(cantidad), 0) unidades from pos_stock where local_id is not null;
