-- =====================================================================
-- Módulo VDH · Migración 13 (SQL 99): el mapa del local, el reparto de los
-- módulos y los recordatorios de cada día
--
-- Pedido de Mauricio (13/10/2026), con la planilla de los sectores:
--   · El local visto desde arriba (de calle: un rectángulo largo; de shopping:
--     más cuadrado), con la entrada (la vidriera) abajo y la caja atrás. Se
--     dice cuántos módulos hay en cada pared y las "islas" de adentro (la caja,
--     los percheros). Los módulos de las paredes se numeran 1, 2, 3… desde la
--     entrada, dando la vuelta: izquierda → fondo → derecha → frente.
--   · La cantidad y el reparto (qué módulos son de cada uno y quién cubre cada
--     sector) los hacen el supervisor del local o el administrador, desde la
--     administración. Los vendedores ven el mapa en la app con lo suyo marcado.
--   · Los recordatorios de cada día (martes entra mercadería, jueves cambio
--     de imagen, domingo limpieza general…): se cargan por local y ese día
--     aparecen arriba en "Hoy".
-- Se puede correr más de una vez. No borra nada: los módulos que sobran se
-- apagan (sus fotos e historia quedan).
-- =====================================================================

alter table orden_config add column if not exists mapa jsonb;        -- {"forma":"rectangulo","izquierda":5,"fondo":5,"derecha":5,"frente":0}
alter table orden_modulos add column if not exists isla boolean not null default false;   -- adentro del local: caja, percheros, mesas

-- ---------- Armar el mapa (el supervisor del local, o el administrador) ----------
create or replace function orden_mapa_guardar(p_local uuid, p_mapa jsonb, p_islas text[] default '{}')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_iz int := coalesce(nullif(p_mapa->>'izquierda', '')::int, 0);
  v_fo int := coalesce(nullif(p_mapa->>'fondo', '')::int, 0);
  v_de int := coalesce(nullif(p_mapa->>'derecha', '')::int, 0);
  v_fr int := coalesce(nullif(p_mapa->>'frente', '')::int, 0);
  v_forma text := case when p_mapa->>'forma' = 'cuadrado' then 'cuadrado' else 'rectangulo' end;
  v_total int; v_sec uuid; v_n int; v_isla text; v_islas int := 0; v_creados int := 0; v_id uuid; v_num int;
begin
  if not orden_es_supervisor_de(p_local) then raise exception 'Sólo el supervisor del local arma el mapa'; end if;
  if not exists (select 1 from orden_locales where id = p_local) then raise exception 'No encontramos ese local'; end if;
  if least(v_iz, v_fo, v_de, v_fr) < 0 or greatest(v_iz, v_fo, v_de, v_fr) > 40 then
    raise exception 'Cada pared va de 0 a 40 módulos';
  end if;
  v_total := v_iz + v_fo + v_de + v_fr;
  -- Las de adentro van del 101 en adelante: las paredes no pueden pasar de 100.
  if v_total > 100 then raise exception 'Entre todas las paredes, como mucho 100 módulos'; end if;
  if coalesce(array_length(p_islas, 1), 0) > 30 then raise exception 'Como mucho 30 cosas adentro del local'; end if;

  insert into orden_config (local_id) values (p_local) on conflict do nothing;
  update orden_config set mapa = jsonb_build_object('forma', v_forma, 'izquierda', v_iz, 'fondo', v_fo, 'derecha', v_de, 'frente', v_fr),
                         actualizado_en = now()
   where local_id = p_local;

  -- Si el local todavía no tiene ningún sector de salón, se arma el primero.
  select id into v_sec from orden_sectores where local_id = p_local and tipo = 'salon' and activo order by numero limit 1;
  if v_sec is null then
    insert into orden_sectores (local_id, tipo, numero)
    values (p_local, 'salon', coalesce((select max(numero) from orden_sectores where local_id = p_local and tipo = 'salon'), 0) + 1)
    returning id into v_sec;
  end if;

  -- Los de las paredes, del 1 al total. Uno nuevo va al sector del anterior
  -- (así quedan en bloque); si no hay anterior, al primer sector.
  for v_n in 1..v_total loop
    select m.id into v_id from orden_modulos m join orden_sectores s on s.id = m.sector_id
     where s.local_id = p_local and s.tipo = 'salon' and s.activo and not m.isla and m.numero = v_n
     order by m.activo desc, s.numero limit 1;
    if v_id is not null then
      update orden_modulos set activo = true where id = v_id and not activo;
    else
      insert into orden_modulos (sector_id, numero, nombre)
      values (coalesce((select m.sector_id from orden_modulos m join orden_sectores s on s.id = m.sector_id
                         where s.local_id = p_local and s.tipo = 'salon' and s.activo and not m.isla and m.numero < v_n
                         order by m.numero desc limit 1), v_sec),
              v_n, 'Módulo ' || v_n);
      v_creados := v_creados + 1;
    end if;
  end loop;
  -- Los que sobran se apagan (no se borran: sus fotos y su historia quedan).
  update orden_modulos m set activo = false
    from orden_sectores s
   where s.id = m.sector_id and s.local_id = p_local and s.tipo = 'salon' and not m.isla and m.numero > v_total and m.activo;

  -- Las islas, por nombre: las que ya no están se apagan; las nuevas van al
  -- primer sector (el supervisor las reparte) con un número de 101 en adelante.
  update orden_modulos m set activo = false
    from orden_sectores s
   where s.id = m.sector_id and s.local_id = p_local and m.isla and m.activo
     and not (lower(trim(m.nombre)) = any (select lower(trim(x)) from unnest(coalesce(p_islas, '{}'::text[])) x));
  foreach v_isla in array coalesce(p_islas, '{}'::text[]) loop
    v_isla := nullif(trim(v_isla), '');
    continue when v_isla is null;
    if length(v_isla) > 40 then raise exception 'El nombre "%" es muy largo', left(v_isla, 40); end if;
    v_islas := v_islas + 1;
    v_id := null;
    select m.id into v_id from orden_modulos m join orden_sectores s on s.id = m.sector_id
     where s.local_id = p_local and s.activo and m.isla and lower(trim(m.nombre)) = lower(v_isla)
     order by m.activo desc limit 1;
    if v_id is not null then
      update orden_modulos set activo = true where id = v_id and not activo;
    else
      select greatest(100, coalesce(max(m.numero), 0)) + 1 into v_num
        from orden_modulos m join orden_sectores s on s.id = m.sector_id where s.local_id = p_local;
      insert into orden_modulos (sector_id, numero, nombre, isla) values (v_sec, v_num, v_isla, true);
      v_creados := v_creados + 1;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'modulos', v_total, 'islas', v_islas, 'creados', v_creados);
end $$;

-- ---------- Repartir (el supervisor del local, o el administrador) ----------
-- Pasar un módulo a otro sector del mismo local (y del mismo tipo).
create or replace function orden_mover_modulo(p_modulo uuid, p_sector uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare m orden_modulos; desde orden_sectores; hacia orden_sectores;
begin
  select * into m from orden_modulos where id = p_modulo for update;
  if not found then raise exception 'No encontramos ese módulo'; end if;
  select * into desde from orden_sectores where id = m.sector_id;
  if not orden_es_supervisor_de(desde.local_id) then raise exception 'Sólo el supervisor del local reparte los módulos'; end if;
  select * into hacia from orden_sectores where id = p_sector and activo;
  if not found then raise exception 'No encontramos ese sector'; end if;
  if hacia.local_id <> desde.local_id or hacia.tipo <> desde.tipo then raise exception 'Ese módulo no puede ir a ese sector'; end if;
  if hacia.id = desde.id then return; end if;
  if exists (select 1 from orden_modulos where sector_id = hacia.id and numero = m.numero and id <> m.id) then
    raise exception 'En ese sector ya hay un módulo con el número %', m.numero;
  end if;
  update orden_modulos set sector_id = hacia.id where id = m.id;
end $$;

-- Quién es el responsable de un sector, quién lo cubre (el franquero) y, en
-- el depósito, qué tiene ("Remeras, camisas y buzos"). p_nombre null = no se toca.
create or replace function orden_sector_gente(p_sector uuid, p_responsable uuid, p_suplente uuid, p_nombre text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare s orden_sectores;
begin
  select * into s from orden_sectores where id = p_sector for update;
  if not found then raise exception 'No encontramos ese sector'; end if;
  if not orden_es_supervisor_de(s.local_id) then raise exception 'Sólo el supervisor del local reparte los sectores'; end if;
  if p_responsable is not null and p_responsable = p_suplente then raise exception 'El que cubre tiene que ser otra persona'; end if;
  if exists (select 1 from unnest(array[p_responsable, p_suplente]) x(id)
              where x.id is not null and not exists (
                select 1 from orden_personas p where p.id = x.id and p.activo and p.local_id = s.local_id
                  and p.rol in ('vendedor', 'supervisor'))) then
    raise exception 'Esa persona no es del local';
  end if;
  update orden_sectores
     set responsable_id = p_responsable, suplente_id = p_suplente,
         nombre = case when p_nombre is null then nombre else nullif(left(trim(p_nombre), 80), '') end
   where id = s.id;
end $$;

-- ---------- Los recordatorios de cada día ----------
create table if not exists orden_recordatorios (
  id         uuid primary key default gen_random_uuid(),
  local_id   uuid not null references orden_locales(id) on delete cascade,
  dia        smallint not null check (dia between 1 and 7),           -- 1 = lunes … 7 = domingo
  texto      text not null check (length(trim(texto)) between 2 and 300),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);
create index if not exists orden_recordatorios_local_dia on orden_recordatorios (local_id, dia);
alter table orden_recordatorios enable row level security;
drop policy if exists ver on orden_recordatorios;
create policy ver on orden_recordatorios for select to authenticated using (orden_ve_local(local_id));
drop policy if exists editar on orden_recordatorios;
create policy editar on orden_recordatorios for all to authenticated using (orden_es_admin()) with check (orden_es_admin());

do $$
begin
  revoke all on table orden_recordatorios from anon;
  grant select, insert, update, delete on table orden_recordatorios to authenticated;
  grant all on table orden_recordatorios to service_role;
  revoke all on function orden_mapa_guardar(uuid, jsonb, text[]) from public, anon;
  revoke all on function orden_mover_modulo(uuid, uuid) from public, anon;
  revoke all on function orden_sector_gente(uuid, uuid, uuid, text) from public, anon;
  grant execute on function orden_mapa_guardar(uuid, jsonb, text[]) to authenticated, service_role;
  grant execute on function orden_mover_modulo(uuid, uuid) to authenticated, service_role;
  grant execute on function orden_sector_gente(uuid, uuid, uuid, text) to authenticated, service_role;
end $$;
