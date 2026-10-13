-- =====================================================================
-- Módulo VDH · Control de cajas + limpieza de fotos viejas
--
-- Una carga por local y por día al cierre:
--   fotos: cierre del sistema, cierre de lote del posnet, resumen de Mercado Pago,
--          Go Cuotas (si hubo) → la IA lee los montos y llena el formulario;
--   quien cierra confirma los números y escribe el efectivo que contó;
--   el sistema calcula los desvíos (como la planilla "Control Diario") y avisa.
-- Desvío = lo que dice el cierre de caja − lo real (positivo = falta plata).
-- =====================================================================

alter table orden_config
  add column caja_activa              boolean not null default false,  -- se prende desde No Compra cuando arranque
  add column caja_minutos_tolerancia  smallint not null default 60,     -- después del cierre del local
  add column caja_tolerancia_pesos    numeric(12,2) not null default 100,
  add column dias_guardar_fotos           smallint not null default 30   -- fotos de módulos ya controladas: 1 mes
                                           check (dias_guardar_fotos >= 7),     -- nunca menos de una semana
  add column dias_guardar_fotos_problemas smallint not null default 90,  -- "A mejorar" o peor: respaldan una falta
  add column dias_guardar_fotos_caja      smallint not null default 60;  -- cierres de caja: por reclamos y cierre de mes

create table orden_cajas (
  id                    uuid primary key default gen_random_uuid(),
  local_id              uuid not null references orden_locales(id) on delete cascade,
  fecha                 date not null,
  -- Lo que dice el cierre de caja del sistema
  sis_saldo_inicial     numeric(14,2),
  sis_tarjeta           numeric(14,2),
  sis_efectivo          numeric(14,2),
  sis_mp                numeric(14,2),
  sis_gocuotas          numeric(14,2),   -- "Ventas DebitoGo"
  sis_cuenta_corriente  numeric(14,2),
  sis_deposito          numeric(14,2),
  sis_total             numeric(14,2),
  sis_gastos            numeric(14,2),
  sis_otras_salidas     numeric(14,2),
  sis_descuentos        numeric(14,2),
  sis_saldo_final_efvo  numeric(14,2),   -- "Saldo final en efectivo"
  -- Lo real
  real_lote             numeric(14,2),   -- total del cierre de lote del posnet
  real_mp               numeric(14,2),   -- total de Mercado Pago del día
  real_gocuotas         numeric(14,2),
  real_efectivo         numeric(14,2),   -- lo que contaron
  -- Desvíos (como la planilla)
  desvio_mp        numeric(14,2) generated always as (coalesce(sis_mp, 0) - coalesce(real_mp, 0)) stored,
  desvio_tarjeta   numeric(14,2) generated always as (coalesce(sis_tarjeta, 0) - coalesce(real_lote, 0)) stored,
  desvio_gocuotas  numeric(14,2) generated always as (coalesce(sis_gocuotas, 0) - coalesce(real_gocuotas, 0)) stored,
  desvio_efectivo  numeric(14,2) generated always as (coalesce(sis_saldo_final_efvo, 0) - coalesce(real_efectivo, 0)) stored,
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'cargada', 'controlada')),
  alertas          jsonb not null default '[]',  -- lo que detectó: desvíos, montos distintos a la foto, foto de otro día
  observaciones    text,
  cargada_por      uuid references orden_personas(id) on delete set null,
  cargada_en       timestamptz,
  controlada_por   uuid references orden_personas(id) on delete set null,
  controlada_en    timestamptz,
  nota_control     text,
  creado_en        timestamptz not null default now(),
  unique (local_id, fecha)
);

create table orden_caja_fotos (
  id            uuid primary key default gen_random_uuid(),
  caja_id       uuid not null references orden_cajas(id) on delete cascade,
  tipo          text not null check (tipo in ('sistema', 'lote', 'mp', 'gocuotas')),
  foto_path     text not null,
  persona_id    uuid references orden_personas(id) on delete set null,
  tomada_en     timestamptz not null default now(),
  ia_estado     text not null default 'pendiente' check (ia_estado in ('pendiente', 'ok', 'invalida', 'error')),
  ia_resultado  jsonb,
  ia_modelo     text,
  borrada_en    timestamptz
);
create index on orden_caja_fotos (caja_id, tipo);

alter table orden_fotos add column borrada_en timestamptz;

-- Cada corrección hecha después de cargada la caja queda registrada (quién, cuándo, valores anteriores)
alter table orden_cajas add column historial jsonb not null default '[]';

-- Conversiones seguras: si la IA o alguien manda algo raro, queda null en vez de romper el guardado
create or replace function orden_num(v text) returns numeric language plpgsql immutable as $$
begin
  if v is null or trim(v) = '' then return null; end if;
  return v::numeric;
exception when others then
  begin
    -- formato argentino: "$ 1.440.100,00"
    return replace(replace(regexp_replace(v, '[^0-9,.-]', '', 'g'), '.', ''), ',', '.')::numeric;
  exception when others then
    return null;
  end;
end $$;

create or replace function orden_fecha_segura(v text) returns date language plpgsql immutable as $$
begin
  if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return v::date;
exception when others then
  return null;
end $$;

-- Día de trabajo del local: antes de la hora de apertura todavía cuenta el día anterior
-- (una caja cargada a las 00:30 queda en el día que cerró)
create or replace function orden_dia_caja(p_local uuid, p_ts timestamptz default now()) returns date
language sql stable as $$
  select case when (p_ts at time zone l.zona_horaria)::time < l.hora_apertura
              then (p_ts at time zone l.zona_horaria)::date - 1
              else (p_ts at time zone l.zona_horaria)::date end
  from orden_locales l where l.id = p_local
$$;

-- Quien cierra puede tocar la caja de hoy y la de ayer; los días anteriores, solo el supervisor
create or replace function orden_puede_editar_caja(p_local uuid, p_fecha date) returns boolean
language sql stable security definer set search_path = public as $$
  select orden_es_supervisor_de(p_local)
      or (orden_ve_local(p_local) and p_fecha >= orden_dia_caja(p_local) - 1)
$$;

-- ---------------------------------------------------------------------
-- Funciones (las llama quien cierra el local)
-- ---------------------------------------------------------------------

-- Devuelve (o crea) la caja de hoy del local de quien la pide
create or replace function orden_caja_hoy()
returns orden_cajas language plpgsql security definer set search_path = public as $$
declare v_local uuid; c orden_cajas;
begin
  select local_id into v_local from orden_personas where id = orden_yo_id();
  if v_local is null then raise exception 'No tenés un local asignado'; end if;
  insert into orden_cajas (local_id, fecha) values (v_local, orden_dia_caja(v_local))
  on conflict (local_id, fecha) do nothing;
  select * into c from orden_cajas where local_id = v_local and fecha = orden_dia_caja(v_local);
  return c;
end $$;

create or replace function orden_caja_registrar_foto(p_caja uuid, p_tipo text, p_foto_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c orden_cajas; v_id uuid;
begin
  select * into c from orden_cajas where id = p_caja;
  if not found or not orden_puede_editar_caja(c.local_id, c.fecha) then raise exception 'No encontramos esa caja'; end if;
  if c.estado = 'controlada' then raise exception 'Esta caja ya fue controlada'; end if;
  if p_foto_path not like c.local_id::text || '/cajas/%' then raise exception 'Ruta de foto inválida'; end if;
  insert into orden_caja_fotos (caja_id, tipo, foto_path, persona_id) values (c.id, p_tipo, p_foto_path, orden_yo_id())
  returning id into v_id;
  return v_id;
end $$;

create or replace function orden_caja_preparar_lectura(p_foto uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f orden_caja_fotos; c orden_cajas; l orden_locales;
begin
  select * into f from orden_caja_fotos where id = p_foto;
  if not found then raise exception 'No encontramos esa foto'; end if;
  select * into c from orden_cajas where id = f.caja_id;
  if not orden_ve_local(c.local_id) then raise exception 'Sin acceso'; end if;
  select * into l from orden_locales where id = c.local_id;
  return jsonb_build_object('foto_id', f.id, 'foto_path', f.foto_path, 'tipo', f.tipo,
                            'fecha', c.fecha, 'local', l.nombre);
end $$;

-- Guarda lo que leyó la IA (solo servidor). No toca los montos: eso lo confirma la persona.
create or replace function orden_caja_aplicar_lectura(p_foto uuid, p_resultado jsonb, p_modelo text)
returns jsonb language sql security definer set search_path = public as $$
  update orden_caja_fotos
     set ia_estado = case when coalesce((p_resultado ->> 'foto_valida')::boolean, true) then 'ok' else 'invalida' end,
         ia_resultado = p_resultado, ia_modelo = p_modelo
   where id = p_foto
  returning p_resultado
$$;

-- Guarda los montos confirmados, calcula desvíos y alertas, y avisa si hay algo raro
create or replace function orden_caja_guardar(p_caja uuid, p_valores jsonb, p_observaciones text default null)
returns orden_cajas language plpgsql security definer set search_path = public as $$
declare
  c orden_cajas; cfg orden_config; v_alertas jsonb := '[]'; v_tol numeric; f record; k text; v_leido numeric; v_tipeado numeric;
  v_mapa jsonb := '{
    "sistema":  {"sis_tarjeta":"ventas_tarjeta","sis_efectivo":"ventas_efectivo","sis_mp":"ventas_mercado_pago",
                 "sis_gocuotas":"ventas_debito_go","sis_total":"ventas_totales","sis_saldo_final_efvo":"saldo_final_efectivo"},
    "lote":     {"real_lote":"total"},
    "mp":       {"real_mp":"total"},
    "gocuotas": {"real_gocuotas":"total"}}';
  v_nombre text;
begin
  select * into c from orden_cajas where id = p_caja for update;
  if not found or not orden_puede_editar_caja(c.local_id, c.fecha) then raise exception 'No encontramos esa caja'; end if;
  if c.estado = 'controlada' and not orden_es_supervisor_de(c.local_id) then
    raise exception 'Esta caja ya fue controlada: solo el supervisor puede cambiarla';
  end if;
  if orden_num(p_valores ->> 'real_efectivo') is null and c.real_efectivo is null then
    raise exception 'Falta el efectivo que contaste';
  end if;
  -- Si ya estaba cargada, se guarda cómo estaba antes del cambio
  if c.estado <> 'pendiente' then
    update orden_cajas set historial = historial || jsonb_build_object(
      'por', (select nombre from orden_personas where id = orden_yo_id()), 'en', now(),
      'antes', jsonb_strip_nulls(jsonb_build_object(
        'sis_tarjeta', c.sis_tarjeta, 'sis_mp', c.sis_mp, 'sis_gocuotas', c.sis_gocuotas,
        'sis_saldo_final_efvo', c.sis_saldo_final_efvo, 'real_lote', c.real_lote, 'real_mp', c.real_mp,
        'real_gocuotas', c.real_gocuotas, 'real_efectivo', c.real_efectivo)))
    where id = c.id;
  end if;
  select * into cfg from orden_config where local_id = c.local_id;
  v_tol := coalesce(cfg.caja_tolerancia_pesos, 100);

  update orden_cajas set
    sis_saldo_inicial    = coalesce(orden_num(p_valores ->> 'sis_saldo_inicial'), sis_saldo_inicial),
    sis_tarjeta          = coalesce(orden_num(p_valores ->> 'sis_tarjeta'), sis_tarjeta),
    sis_efectivo         = coalesce(orden_num(p_valores ->> 'sis_efectivo'), sis_efectivo),
    sis_mp               = coalesce(orden_num(p_valores ->> 'sis_mp'), sis_mp),
    sis_gocuotas         = coalesce(orden_num(p_valores ->> 'sis_gocuotas'), sis_gocuotas),
    sis_cuenta_corriente = coalesce(orden_num(p_valores ->> 'sis_cuenta_corriente'), sis_cuenta_corriente),
    sis_deposito         = coalesce(orden_num(p_valores ->> 'sis_deposito'), sis_deposito),
    sis_total            = coalesce(orden_num(p_valores ->> 'sis_total'), sis_total),
    sis_gastos           = coalesce(orden_num(p_valores ->> 'sis_gastos'), sis_gastos),
    sis_otras_salidas    = coalesce(orden_num(p_valores ->> 'sis_otras_salidas'), sis_otras_salidas),
    sis_descuentos       = coalesce(orden_num(p_valores ->> 'sis_descuentos'), sis_descuentos),
    sis_saldo_final_efvo = coalesce(orden_num(p_valores ->> 'sis_saldo_final_efvo'), sis_saldo_final_efvo),
    real_lote            = coalesce(orden_num(p_valores ->> 'real_lote'), real_lote),
    real_mp              = coalesce(orden_num(p_valores ->> 'real_mp'), real_mp),
    real_gocuotas        = coalesce(orden_num(p_valores ->> 'real_gocuotas'), real_gocuotas),
    real_efectivo        = coalesce(orden_num(p_valores ->> 'real_efectivo'), real_efectivo),
    observaciones        = coalesce(nullif(trim(p_observaciones), ''), observaciones)
  where id = c.id returning * into c;

  -- 1) Desvíos
  if abs(c.desvio_mp)       > v_tol then v_alertas := v_alertas || jsonb_build_object('tipo','desvio','campo','Mercado Pago','monto',c.desvio_mp); end if;
  if abs(c.desvio_tarjeta)  > v_tol then v_alertas := v_alertas || jsonb_build_object('tipo','desvio','campo','Tarjeta','monto',c.desvio_tarjeta); end if;
  if abs(c.desvio_gocuotas) > v_tol then v_alertas := v_alertas || jsonb_build_object('tipo','desvio','campo','Go Cuotas','monto',c.desvio_gocuotas); end if;
  if abs(c.desvio_efectivo) > v_tol then v_alertas := v_alertas || jsonb_build_object('tipo','desvio','campo','Efectivo','monto',c.desvio_efectivo); end if;

  -- 2) Lo que escribieron no coincide con lo que leyó la IA en la foto
  -- 3) La foto es de otro día (ej. un cierre de lote viejo)
  for f in select distinct on (tipo) * from orden_caja_fotos
           where caja_id = c.id and ia_estado = 'ok' order by tipo, tomada_en desc loop
    for k in select jsonb_object_keys(v_mapa -> f.tipo) loop
      v_leido := orden_num(f.ia_resultado ->> (v_mapa -> f.tipo ->> k));
      v_tipeado := orden_num(to_jsonb(c) ->> k);
      if v_leido is not null and v_tipeado is not null and abs(v_leido - v_tipeado) > 1 then
        v_alertas := v_alertas || jsonb_build_object('tipo', 'no_coincide_foto', 'campo', k,
                                                     'en_foto', v_leido, 'cargado', v_tipeado);
      end if;
    end loop;
    if orden_fecha_segura(f.ia_resultado ->> 'fecha') <> c.fecha then
      v_alertas := v_alertas || jsonb_build_object('tipo', 'foto_otro_dia', 'foto', f.tipo, 'fecha_foto', f.ia_resultado ->> 'fecha');
    end if;
  end loop;

  update orden_cajas
     set alertas = v_alertas,
         estado = case when estado = 'pendiente' then 'cargada' else estado end,
         cargada_por = coalesce(cargada_por, orden_yo_id()),
         cargada_en = coalesce(cargada_en, now())
   where id = c.id returning * into c;

  if jsonb_array_length(v_alertas) > 0 then
    select nombre into v_nombre from orden_locales where id = c.local_id;
    perform orden_avisar_responsables(c.local_id, 'ambos', 'caja_alerta',
      'Caja ' || v_nombre || ' ' || to_char(c.fecha, 'DD/MM') || ': revisar',
      (select string_agg(case a ->> 'tipo'
                           when 'desvio' then (a ->> 'campo') || ' $' || to_char((a ->> 'monto')::numeric, 'FM999G999G990')
                           when 'no_coincide_foto' then 'un monto no coincide con la foto'
                           else 'foto de otro día' end, ' · ')
       from jsonb_array_elements(v_alertas) a),
      '/cajas', 'caja-alerta:' || c.id || ':' || md5(v_alertas::text), 2::smallint);
  end if;
  return c;
end $$;

-- El supervisor marca el día como controlado
create or replace function orden_caja_controlar(p_caja uuid, p_nota text default null)
returns orden_cajas language plpgsql security definer set search_path = public as $$
declare c orden_cajas;
begin
  select * into c from orden_cajas where id = p_caja for update;
  if not found or not orden_es_supervisor_de(c.local_id) then raise exception 'Solo el supervisor puede controlar la caja'; end if;
  if c.estado = 'pendiente' then raise exception 'La caja todavía no fue cargada'; end if;
  if jsonb_array_length(c.alertas) > 0 and coalesce(trim(p_nota), '') = '' then
    raise exception 'Esta caja tiene alertas: escribí qué pasó antes de darla por controlada';
  end if;
  update orden_cajas set estado = 'controlada', controlada_por = orden_yo_id(), controlada_en = now(),
                         nota_control = nullif(trim(p_nota), '')
   where id = c.id returning * into c;
  return c;
end $$;

-- Reloj de cajas (lo llama la Edge Function tick después de orden_tick)
create or replace function orden_tick_cajas(p_ahora timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; cfg orden_config; v_hoy date; v_ayer date; v_dia date; v_hora time; p record; v_n int := 0; c record;
begin
  for l in select * from orden_locales where activo loop
    select * into cfg from orden_config where local_id = l.id;
    continue when not found or not cfg.caja_activa;
    v_hoy  := (p_ahora at time zone l.zona_horaria)::date;
    v_ayer := v_hoy - 1;
    v_hora := (p_ahora at time zone l.zona_horaria)::time;

    -- 1) Cerró hace más de N minutos y no cargó la caja → aviso al local y al supervisor.
    --    Se compara con fecha y hora completas: un cierre a las 23:00 + 60 min cae al otro día.
    v_dia := orden_dia_caja(l.id, p_ahora);
    if orden_local_abre(l.id, v_dia)
       and p_ahora >= orden_en_hora(l.id, v_dia, l.hora_cierre) + make_interval(mins => cfg.caja_minutos_tolerancia)
       and not exists (select 1 from orden_cajas where local_id = l.id and fecha = v_dia and estado <> 'pendiente') then
      for p in select id from orden_personas
               where local_id = l.id and activo and rol = 'vendedor' and orden_trabaja(id, v_dia) loop
        perform orden_encolar_aviso(p.id, 'caja_sin_cargar', 'Falta cargar la caja de hoy',
          'Sacá las fotos del cierre y cargá el efectivo.', '/caja', 'caja-local:' || p.id || ':' || v_dia, 2::smallint);
      end loop;
      perform orden_avisar_responsables(l.id, 'supervisores', 'caja_sin_cargar',
        l.nombre || ': no cargó la caja de hoy', null, '/cajas', 'caja-sup:' || l.id || ':' || v_dia, 2::smallint);
      v_n := v_n + 1;
    end if;

    -- 2) A la mañana siguiente (ya abierto el día nuevo) sigue sin cargar → aviso a los admins
    if orden_dia_caja(l.id, p_ahora) = v_hoy and orden_local_abre(l.id, v_ayer) and v_hora >= cfg.hora_aviso_1
       and not exists (select 1 from orden_cajas where local_id = l.id and fecha = v_ayer and estado <> 'pendiente') then
      perform orden_avisar_responsables(l.id, 'admins', 'caja_sin_cargar',
        l.nombre || ': no cargó la caja de ayer', to_char(v_ayer, 'DD/MM'), '/cajas', 'caja-adm:' || l.id || ':' || v_ayer, 2::smallint);
    end if;

    -- 3) Cargada hace más de N horas y el supervisor no la controló → aviso a los admins
    for c in select * from orden_cajas
             where local_id = l.id and estado = 'cargada'
               and cargada_en <= p_ahora - make_interval(hours => cfg.horas_revision_supervisor) loop
      perform orden_avisar_responsables(l.id, 'admins', 'caja_sin_controlar',
        l.nombre || ': caja del ' || to_char(c.fecha, 'DD/MM') || ' sin controlar',
        case when jsonb_array_length(c.alertas) > 0 then 'Tiene alertas.' else null end,
        '/cajas', 'caja-ctl:' || c.id, 2::smallint);
    end loop;
  end loop;
  return jsonb_build_object('locales_sin_caja', v_n);
end $$;

-- Resumen del día para el grupo de Telegram de encargados/supervisores
-- (lo manda la Edge Function resumen-cajas a la noche)
create or replace function orden_resumen_cajas_dia(p_fecha date)
returns jsonb language sql stable security definer set search_path = public as $$
  with l as (
    select l.id, l.nombre, c.estado, c.alertas
    from orden_locales l
    join orden_config cfg on cfg.local_id = l.id and cfg.caja_activa
    left join orden_cajas c on c.local_id = l.id and c.fecha = p_fecha
    where l.activo and orden_local_abre(l.id, p_fecha))
  select jsonb_build_object(
    'fecha', p_fecha,
    'locales', (select count(*) from l),
    'ok', coalesce((select jsonb_agg(nombre order by nombre) from l
                    where estado in ('cargada', 'controlada') and jsonb_array_length(alertas) = 0), '[]'),
    'sin_cargar', coalesce((select jsonb_agg(nombre order by nombre) from l
                            where estado is null or estado = 'pendiente'), '[]'),
    'con_alertas', coalesce((select jsonb_agg(jsonb_build_object('local', nombre, 'alertas', alertas) order by nombre) from l
                             where jsonb_array_length(coalesce(alertas, '[]')) > 0), '[]'))
$$;

-- ---------------------------------------------------------------------
-- Limpieza de fotos viejas (para no llenar el espacio)
-- Se guardan más tiempo: fotos de caja y fotos de módulos con problemas.
-- La Edge Function tick borra los archivos y después marca las filas.
-- ---------------------------------------------------------------------
create or replace function orden_fotos_para_borrar(p_limite int default 500)
returns table (origen text, id uuid, foto_path text)
language sql stable security definer set search_path = public as $$
  (select 'modulo', f.id, f.foto_path
   from orden_fotos f
   join orden_controles c on c.id = f.control_id
   join orden_config cfg on cfg.local_id = c.local_id
   where f.borrada_en is null
     -- solo fotos ya controladas por el supervisor (las que esperan revisión se guardan, con tope de 90 días)
     and (c.estado = 'revisado' or c.tipo = 'correccion'
          or f.tomada_en < now() - make_interval(days => cfg.dias_guardar_fotos_problemas))
     and f.tomada_en < now() - make_interval(days => case
           when coalesce(c.nivel_final, c.nivel_ia) <= 'a_mejorar' then cfg.dias_guardar_fotos_problemas
           else cfg.dias_guardar_fotos end)
     -- la última foto de cada módulo no se borra nunca: es la que se ve en "Cómo está el local"
     and f.id is distinct from (
           select f2.id from orden_fotos f2 join orden_controles c2 on c2.id = f2.control_id
           where c2.modulo_id = c.modulo_id and f2.borrada_en is null
           order by f2.tomada_en desc limit 1)
   limit p_limite)
  union all
  (select 'caja', f.id, f.foto_path
   from orden_caja_fotos f
   join orden_cajas c on c.id = f.caja_id
   join orden_config cfg on cfg.local_id = c.local_id
   where f.borrada_en is null and f.tomada_en < now() - make_interval(days => cfg.dias_guardar_fotos_caja)
   limit p_limite)
$$;

create or replace function orden_marcar_fotos_borradas(p_modulo uuid[], p_caja uuid[])
returns void language sql security definer set search_path = public as $$
  update orden_fotos set borrada_en = now() where id = any(p_modulo);
  update orden_caja_fotos set borrada_en = now() where id = any(p_caja);
$$;

-- ---------------------------------------------------------------------
-- Vista para No Compra (pestaña "Control de cajas"): una fila por local y día,
-- con columnas como la planilla. Los totales del mes salen agrupando.
-- ---------------------------------------------------------------------
create view orden_v_cajas with (security_invoker = true) as
select c.*, l.nombre as local_nombre,
       to_char(c.fecha, 'YYYY-MM') as mes,
       jsonb_array_length(c.alertas) > 0 as con_alertas,
       pc.nombre as cargada_por_nombre, ps.nombre as controlada_por_nombre,
       (select jsonb_object_agg(f.tipo, f.foto_path) from (
          select distinct on (tipo) tipo, foto_path from orden_caja_fotos
          where caja_id = c.id and borrada_en is null order by tipo, tomada_en desc) f) as fotos
from orden_cajas c
join orden_locales l on l.id = c.local_id
left join orden_personas pc on pc.id = c.cargada_por
left join orden_personas ps on ps.id = c.controlada_por;

create view orden_v_cajas_mes with (security_invoker = true) as
-- Se generan todos los días que abrió cada local desde su primera caja: así un día en que
-- nadie abrió la pantalla de caja también cuenta como "sin cargar".
with dias as (
  select l.id as local_id, l.nombre as local_nombre, g::date as fecha
  from orden_locales l
  join lateral (select min(fecha) as desde from orden_cajas c where c.local_id = l.id) ini on ini.desde is not null
  cross join lateral generate_series(ini.desde, orden_dia_caja(l.id), interval '1 day') g
  where l.activo and orden_local_abre(l.id, g::date))
select d.local_id, d.local_nombre, to_char(d.fecha, 'YYYY-MM') as mes,
       sum(c.sis_mp) as sis_mp, sum(c.real_mp) as real_mp, sum(c.desvio_mp) as desvio_mp,
       sum(c.sis_tarjeta) as sis_tarjeta, sum(c.real_lote) as real_lote, sum(c.desvio_tarjeta) as desvio_tarjeta,
       sum(c.sis_gocuotas) as sis_gocuotas, sum(c.real_gocuotas) as real_gocuotas, sum(c.desvio_gocuotas) as desvio_gocuotas,
       sum(c.sis_saldo_final_efvo) as sis_efectivo, sum(c.real_efectivo) as real_efectivo, sum(c.desvio_efectivo) as desvio_efectivo,
       count(*) filter (where c.id is null or c.estado = 'pendiente') as dias_sin_cargar,
       count(*) filter (where c.estado = 'cargada') as dias_sin_controlar,
       count(*) filter (where jsonb_array_length(coalesce(c.alertas, '[]')) > 0) as dias_con_alertas
from dias d left join orden_cajas c on c.local_id = d.local_id and c.fecha = d.fecha
group by d.local_id, d.local_nombre, to_char(d.fecha, 'YYYY-MM');

-- "Cómo está el local": la última foto de cada módulo y del depósito, con su nivel y lo que tiene pendiente.
-- Es la primera pantalla de Seguimiento en No Compra (filtrando por local).
create view orden_v_estado_local with (security_invoker = true) as
select m.id as modulo_id, m.numero as modulo_numero, m.nombre as modulo_nombre,
       s.local_id, l.nombre as local_nombre, s.tipo as sector_tipo, s.numero as sector_numero,
       resp.nombre as responsable,
       u.foto_path, u.tomada_en, u.control_id, u.control_tipo, u.nivel, u.foto_de,
       (u.tomada_en is null or u.tomada_en < now() - interval '7 days') as sin_foto_reciente,
       (select count(*) from orden_tareas t where t.modulo_id = m.id and t.estado in ('pendiente', 'vencida')) as tareas_abiertas
from orden_modulos m
join orden_sectores s on s.id = m.sector_id
join orden_locales l on l.id = s.local_id
left join orden_personas resp on resp.id = s.responsable_id
left join lateral (
  select f.foto_path, f.tomada_en, c.id as control_id, c.tipo as control_tipo,
         coalesce(c.nivel_final, f.ia_nivel, c.nivel_declarado) as nivel, pe.nombre as foto_de
  from orden_fotos f
  join orden_controles c on c.id = f.control_id
  left join orden_personas pe on pe.id = f.persona_id
  where c.modulo_id = m.id and f.borrada_en is null
  order by f.tomada_en desc limit 1) u on true
where m.activo and s.activo and l.activo;

-- Personas con sus avisos: No Compra muestra quién NO tiene las notificaciones activadas
create view orden_v_personas with (security_invoker = true) as
select p.*, l.nombre as local_nombre,
       exists (select 1 from orden_push_subs s where s.persona_id = p.id) as avisos_activos,
       (select max(f.tomada_en) from orden_fotos f where f.persona_id = p.id) as ultima_foto
from orden_personas p left join orden_locales l on l.id = p.local_id;

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------
alter table orden_cajas      enable row level security;
alter table orden_caja_fotos enable row level security;

-- El supervisor ve todas las cajas de su local; quien cierra, solo la de hoy y ayer
create policy ver on orden_cajas for select to authenticated
  using (orden_ve_equipo(local_id)
         or (orden_ve_local(local_id) and fecha >= orden_fecha_local(local_id) - 1));
create policy ver on orden_caja_fotos for select to authenticated
  using (exists (select 1 from orden_cajas c where c.id = caja_id));

do $$
declare t text; f record;
begin
  foreach t in array array['orden_cajas', 'orden_caja_fotos', 'orden_v_cajas', 'orden_v_cajas_mes', 'orden_v_personas',
                           'orden_v_estado_local'] loop
    execute format('revoke all on table %I from anon', t);
    execute format('grant select on table %I to authenticated', t);
    execute format('grant all on table %I to service_role', t);
  end loop;
  for f in select p.oid::regprocedure as firma, p.proname from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname in ('orden_caja_hoy', 'orden_caja_registrar_foto', 'orden_caja_preparar_lectura',
                               'orden_num', 'orden_fecha_segura', 'orden_dia_caja', 'orden_puede_editar_caja',
                               'orden_caja_aplicar_lectura', 'orden_caja_guardar', 'orden_caja_controlar',
                               'orden_tick_cajas', 'orden_fotos_para_borrar', 'orden_marcar_fotos_borradas',
                               'orden_resumen_cajas_dia')
  loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to service_role', f.firma);
    if f.proname in ('orden_caja_aplicar_lectura', 'orden_tick_cajas', 'orden_fotos_para_borrar', 'orden_marcar_fotos_borradas',
                       'orden_resumen_cajas_dia') then
      execute format('revoke all on function %s from authenticated', f.firma);
    else
      execute format('grant execute on function %s to authenticated', f.firma);
    end if;
  end loop;
end $$;
