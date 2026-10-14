-- =====================================================================
-- Módulo VDH · Migración 25 (SQL 115), 14/10/2026: el CIERRE DEL MES de las
-- cajas, como la planilla "Control Diario" (pedido de Mauricio).
--
-- En la planilla, al terminar cada mes, Administración controla los totales
-- (Mercado Pago, tarjeta, Go Cuotas, efectivo) y escribe "Todo controlado y
-- ok" o lo que faltó. Ahora eso vive en Equipo VDH → Cajas:
--
--   · orden_cajas_meses: un renglón por local y mes cerrado, con la
--     observación, los totales que se vieron al cerrar, quién y cuándo, y la
--     historia de cierres y reaperturas.
--   · orden_caja_mes_cerrar / orden_caja_mes_reabrir: SÓLO Administración
--     (rol admin). Se cierra un mes que ya terminó; para reabrir hay que
--     decir por qué. Todo queda anotado.
--   · Con el mes cerrado, los montos de sus días quedan trabados: nadie los
--     cambia (un trigger en orden_cajas). El encargado igual puede marcar un
--     día como controlado: eso no cambia plata.
--   · El día 1 (y los siguientes, hasta que se cierre) Administración recibe
--     UN aviso por mes: "Cajas de septiembre para cerrar". Lo manda un job
--     de pg_cron propio (orden-cierre-cajas, 10 h de Argentina); no toca el
--     tick.
--
-- Reversible: select cron.unschedule('orden-cierre-cajas');
-- drop trigger orden_cajas_mes_trabado on orden_cajas; y borrar las
-- funciones, la vista y la tabla (se pierden los cierres anotados; las
-- cajas no se tocan).
-- =====================================================================

create table if not exists orden_cajas_meses (
  local_id        uuid not null references orden_locales(id) on delete cascade,
  mes             text not null check (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),   -- 'AAAA-MM', como orden_v_cajas
  estado          text not null default 'controlado' check (estado in ('controlado', 'reabierto')),
  observacion     text check (observacion is null or length(observacion) <= 600),
  totales         jsonb,          -- lo que mostraba el mes al cerrarlo (por si después cambia algo)
  controlado_por  uuid references orden_personas(id) on delete set null,
  controlado_por_nombre text,     -- el nombre, guardado: el encargado no ve la ficha del administrador
  controlado_en   timestamptz,
  historia        jsonb not null default '[]',   -- cada cierre y reapertura: qué, quién, cuándo y qué dijo
  primary key (local_id, mes)
);

alter table orden_cajas_meses enable row level security;
drop policy if exists ver on orden_cajas_meses;
create policy ver on orden_cajas_meses for select to authenticated using (orden_ve_equipo(local_id));

/* Si la tabla ya existía de una corrida anterior, sin el nombre. */
alter table orden_cajas_meses add column if not exists controlado_por_nombre text;

/* Para la pantalla (la misma tabla, con la seguridad de quien mira). */
create or replace view orden_v_cajas_meses with (security_invoker = true) as
select m.* from orden_cajas_meses m;

/* ¿Es Administración (el rol admin, activo y aprobado)? */
create or replace function orden_es_admin_caja()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from orden_personas where id = orden_yo_id() and rol = 'admin' and activo and aprobado)
$$;

/* ═══ Cerrar el mes ════════════════════════════════════════════════════
   Un mes que ya terminó (en la hora del local) y que tiene cajas. Si
   quedaron días sin cargar se puede cerrar igual (un día que nadie cargó no
   se puede cargar después, y el mes quedaría abierto para siempre): la
   pantalla lo avisa y la observación lo dice. */
create or replace function orden_caja_mes_cerrar(p_local uuid, p_mes text, p_observacion text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_obs text := nullif(trim(regexp_replace(coalesce(p_observacion, ''), '\s+', ' ', 'g')), '');
  v_tot jsonb; m orden_cajas_meses; v_quien text;
begin
  if not orden_es_admin_caja() then raise exception 'Sólo Administración cierra el mes de las cajas'; end if;
  if coalesce(p_mes, '') !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'El mes no es válido'; end if;
  if not exists (select 1 from orden_locales where id = p_local) then raise exception 'No encontramos ese local'; end if;
  if p_mes >= to_char(orden_fecha_local(p_local), 'YYYY-MM') then
    raise exception 'El mes todavía no terminó: se cierra desde el día 1 del mes siguiente';
  end if;
  if v_obs is null then raise exception 'Escribí la observación (por ejemplo: "Todo controlado y ok")'; end if;
  if length(v_obs) > 600 then raise exception 'La observación es muy larga (hasta 600 letras)'; end if;
  select to_jsonb(t) - 'local_id' - 'local_nombre' - 'mes' into v_tot
    from orden_v_cajas_mes t where t.local_id = p_local and t.mes = p_mes;
  if v_tot is null then raise exception 'No hay cajas de ese mes en este local'; end if;

  select * into m from orden_cajas_meses where local_id = p_local and mes = p_mes for update;
  if found and m.estado = 'controlado' then raise exception 'Ese mes ya estaba cerrado'; end if;
  select nombre into v_quien from orden_personas where id = orden_yo_id();

  insert into orden_cajas_meses as x (local_id, mes, estado, observacion, totales, controlado_por, controlado_por_nombre, controlado_en, historia)
  values (p_local, p_mes, 'controlado', v_obs, v_tot, orden_yo_id(), v_quien, now(),
          jsonb_build_array(jsonb_build_object('que', 'cerrado', 'por', v_quien, 'en', now(), 'texto', v_obs)))
  on conflict (local_id, mes) do update
    set estado = 'controlado', observacion = excluded.observacion, totales = excluded.totales,
        controlado_por = excluded.controlado_por, controlado_por_nombre = excluded.controlado_por_nombre,
        controlado_en = excluded.controlado_en,
        historia = x.historia || excluded.historia
  returning * into m;
  return to_jsonb(m);
end $$;

/* ═══ Reabrir el mes ══════════════════════════════════════════════════
   Para corregir algo de un mes cerrado. Hay que decir por qué; queda en la
   historia, y el mes vuelve a cerrarse con "Dar el mes por controlado". */
create or replace function orden_caja_mes_reabrir(p_local uuid, p_mes text, p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_mot text := nullif(trim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g')), '');
  m orden_cajas_meses; v_quien text;
begin
  if not orden_es_admin_caja() then raise exception 'Sólo Administración reabre el mes de las cajas'; end if;
  select * into m from orden_cajas_meses where local_id = p_local and mes = p_mes for update;
  if not found or m.estado <> 'controlado' then raise exception 'Ese mes no está cerrado'; end if;
  if v_mot is null then raise exception 'Contá por qué se reabre'; end if;
  if length(v_mot) > 600 then raise exception 'Es muy largo (hasta 600 letras)'; end if;
  select nombre into v_quien from orden_personas where id = orden_yo_id();
  update orden_cajas_meses
     set estado = 'reabierto',
         historia = historia || jsonb_build_array(jsonb_build_object('que', 'reabierto', 'por', v_quien, 'en', now(), 'texto', v_mot))
   where local_id = p_local and mes = p_mes
  returning * into m;
  return to_jsonb(m);
end $$;

/* ═══ La traba: con el mes cerrado, la plata de sus días no se toca ═════
   Sí se puede marcar un día como controlado (estado, quién, cuándo y su
   nota): eso no cambia montos. Todo lo demás (montos, observaciones,
   alertas, historial, agregar o borrar un día) se rechaza. */
create or replace function orden_cajas_mes_trabado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_fila orden_cajas := case when tg_op = 'DELETE' then old else new end;
  v_libres text[] := array['estado', 'controlada_por', 'controlada_en', 'nota_control',
                           'desvio_mp', 'desvio_tarjeta', 'desvio_gocuotas', 'desvio_efectivo'];
begin
  if exists (select 1 from orden_cajas_meses
              where local_id = v_fila.local_id and mes = to_char(v_fila.fecha, 'YYYY-MM') and estado = 'controlado')
     or (tg_op = 'UPDATE' and exists (select 1 from orden_cajas_meses
              where local_id = old.local_id and mes = to_char(old.fecha, 'YYYY-MM') and estado = 'controlado')) then
    if tg_op = 'UPDATE' and (to_jsonb(new) - v_libres) is not distinct from (to_jsonb(old) - v_libres) then
      return new;
    end if;
    raise exception 'El mes de esta caja ya está cerrado por Administración: para cambiar algo, que lo reabra';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists orden_cajas_mes_trabado on orden_cajas;
create trigger orden_cajas_mes_trabado before insert or update or delete on orden_cajas
  for each row execute function orden_cajas_mes_trabado();

/* ═══ El aviso del día 1 ══════════════════════════════════════════════
   Un aviso por mes a Administración con los locales que tienen cajas del mes
   pasado sin cerrar. La clave lleva el mes: sale una sola vez (el primer día
   que corre con algo pendiente). */
create or replace function orden_cajas_aviso_cierre(p_ahora timestamptz default now())
returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  v_mes text := to_char(((p_ahora at time zone 'America/Argentina/Buenos_Aires')::date - interval '1 month'), 'YYYY-MM');
  v_nombre_mes text;
  v_locales text; v_n int;
begin
  select string_agg(t.local_nombre, ', ' order by t.local_nombre), count(*)
    into v_locales, v_n
    from orden_v_cajas_mes t
    join orden_config c on c.local_id = t.local_id and c.caja_activa
   where t.mes = v_mes
     and not exists (select 1 from orden_cajas_meses m where m.local_id = t.local_id and m.mes = v_mes and m.estado = 'controlado');
  if coalesce(v_n, 0) = 0 then return 0; end if;
  v_nombre_mes := (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])[substr(v_mes, 6, 2)::int];
  return orden_avisar_responsables(null, 'admins', 'cierre_cajas',
    'Cajas de ' || v_nombre_mes || ' para cerrar',
    case when v_n = 1 then v_locales || ': revisá el mes y dalo por controlado en Equipo VDH → Cajas.'
         else v_n || ' locales (' || v_locales || '): revisá cada mes y dalo por controlado en Equipo VDH → Cajas.' end,
    '/admin', 'cierre-cajas:' || v_mes, 2::smallint);
end $$;

select cron.schedule('orden-cierre-cajas', '0 13 * * *', $c$select orden_cajas_aviso_cierre()$c$);

/* ═══ Permisos ═══════════════════════════════════════════════════════════ */
do $$
begin
  revoke all on table orden_cajas_meses from anon;
  grant select on table orden_cajas_meses to authenticated;
  revoke all on table orden_v_cajas_meses from anon;
  grant select on table orden_v_cajas_meses to authenticated;
  revoke all on function orden_es_admin_caja() from public, anon;
  grant execute on function orden_es_admin_caja() to authenticated, service_role;
  revoke all on function orden_caja_mes_cerrar(uuid, text, text) from public, anon;
  grant execute on function orden_caja_mes_cerrar(uuid, text, text) to authenticated, service_role;
  revoke all on function orden_caja_mes_reabrir(uuid, text, text) from public, anon;
  grant execute on function orden_caja_mes_reabrir(uuid, text, text) to authenticated, service_role;
  revoke all on function orden_cajas_mes_trabado() from public, anon, authenticated;
  revoke all on function orden_cajas_aviso_cierre(timestamptz) from public, anon, authenticated;
  grant execute on function orden_cajas_aviso_cierre(timestamptz) to service_role;
end $$;
