-- =====================================================================
-- Módulo VDH · Migración 22 (SQL 112): el croquis del local, "muy parecido
-- a lo real" (pedido de Mauricio, 13/10/2026).
--
--   · La puerta: se elige dónde está (en el salón y en el depósito). El 1 es
--     el primer módulo al lado de la puerta, hacia la izquierda, y sigue
--     dando la vuelta.
--   · Huecos y cosas fijas en las paredes (probadores, una columna, la puerta
--     del depósito): un lugar sin módulo. Módulos dobles: uno solo, el
--     doble de ancho. Lo del centro, donde está; y cosas fijas adentro
--     (mostrador, escalera) para ubicarse.
--   · Al mover la puerta, agregar o sacar un lugar en el medio de una pared,
--     cada módulo se queda en su lugar (con su nombre, su responsable y sus
--     fotos): lo que cambia es su número. Por eso, al guardar, la base los
--     renumera en el orden nuevo (orden_mapa_ordenar_) y recién después arma
--     el mapa como siempre (orden_mapa_guardar).
--   · El dibujo (los lugares, la puerta, las posiciones) se guarda en
--     orden_config.mapa.croquis. La cantidad por pared sigue estando, así
--     las versiones viejas de la app siguen andando.
-- Reversible: borrar las 2 funciones; el croquis guardado no molesta (sin él,
-- el mapa se dibuja como antes). Los números que cambiaron quedan cambiados.
-- =====================================================================

-- Renumera los módulos de las paredes (o los del depósito) en el orden del
-- croquis: el i-ésimo de la lista pasa a ser el número i. Un null es un lugar
-- nuevo (orden_mapa_guardar crea ese número). Los que no están en la lista
-- (los que se sacaron, y los que ya estaban apagados) quedan detrás del
-- último: orden_mapa_guardar apaga los que estaban prendidos.
create or replace function orden_mapa_ordenar_(p_local uuid, p_tipo text, p_orden uuid[])
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_tipo orden_sector_tipo := case when p_tipo = 'deposito' then 'deposito' else 'salon' end;
  v_total int := coalesce(array_length(p_orden, 1), 0); v_num int; i int; r record;
  v_nombre text := case when p_tipo = 'deposito' then 'Depósito ' else 'Módulo ' end;
  v_viejo text := case when p_tipo = 'deposito' then '^dep[oó]sito( sector)? [0-9]+$' else '^m[oó]dulo [0-9]+$' end;
begin
  if exists (select 1 from unnest(p_orden) x
              where x is not null and not exists (
                select 1 from orden_modulos m join orden_sectores s on s.id = m.sector_id
                 where m.id = x and s.local_id = p_local and s.tipo = v_tipo and not m.isla)) then
    raise exception 'Hay un módulo que no es de este local';
  end if;
  if (select count(x) from unnest(p_orden) x) <> (select count(distinct x) from unnest(p_orden) x) then
    raise exception 'Hay un módulo repetido en el croquis';
  end if;
  -- 1) Todos a números provisorios (el número es único por sector: así no chocan al moverlos).
  update orden_modulos m set numero = m.numero + 20000
    from orden_sectores s
   where s.id = m.sector_id and s.local_id = p_local and s.tipo = v_tipo and not m.isla and m.numero < 20000;
  -- 2) Los del croquis, a su número.
  for i in 1..v_total loop
    if p_orden[i] is not null then update orden_modulos set numero = i where id = p_orden[i]; end if;
  end loop;
  -- 3) Los demás, detrás del último (primero los prendidos, en el orden en que
  --    estaban), salteando los números de lo de adentro (101 en adelante).
  v_num := v_total;
  for r in select m.id from orden_modulos m join orden_sectores s on s.id = m.sector_id
            where s.local_id = p_local and s.tipo = v_tipo and not m.isla and m.numero >= 20000
            order by m.activo desc, m.numero loop
    loop
      v_num := v_num + 1;
      exit when not exists (select 1 from orden_modulos m join orden_sectores s on s.id = m.sector_id
                             where s.local_id = p_local and s.tipo = v_tipo and m.numero = v_num);
    end loop;
    update orden_modulos set numero = v_num where id = r.id;
  end loop;
  -- 4) Los nombres de siempre siguen al número nuevo ("Módulo 7", "Depósito 3").
  update orden_modulos m set nombre = v_nombre || m.numero
    from orden_sectores s
   where s.id = m.sector_id and s.local_id = p_local and s.tipo = v_tipo and not m.isla
     and m.nombre ~* v_viejo and m.nombre <> v_nombre || m.numero;
end $$;

-- Guardar el croquis: renumera (salón y depósito), arma el mapa como siempre
-- y guarda el dibujo. Todo junto: si algo falla, no cambia nada.
create or replace function orden_croquis_guardar(p_local uuid, p_mapa jsonb, p_islas text[], p_orden_salon uuid[],
                                                 p_orden_deposito uuid[], p_croquis jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_total int; v_dep int; v_r jsonb; v_lugares int;
begin
  if not orden_es_supervisor_de(p_local) then raise exception 'Sólo el supervisor del local arma el mapa'; end if;
  if p_croquis is null or jsonb_typeof(p_croquis) <> 'object' or octet_length(p_croquis::text) > 60000 then
    raise exception 'El croquis no es válido';
  end if;
  v_total := coalesce(nullif(p_mapa->>'izquierda', '')::int, 0) + coalesce(nullif(p_mapa->>'fondo', '')::int, 0)
           + coalesce(nullif(p_mapa->>'derecha', '')::int, 0) + coalesce(nullif(p_mapa->>'frente', '')::int, 0);
  if coalesce(array_length(p_orden_salon, 1), 0) <> v_total then
    raise exception 'El croquis no coincide con la cantidad de módulos del salón';
  end if;
  select count(*) into v_lugares
    from jsonb_each(coalesce(p_croquis->'salon'->'paredes', '{}'::jsonb)) w, jsonb_array_elements(w.value) e
   where e in ('"m"'::jsonb, '"d"'::jsonb);
  if v_lugares <> v_total then raise exception 'El dibujo del salón no coincide con la cantidad de módulos'; end if;
  v_dep := nullif(p_mapa->>'deposito', '')::int;
  if v_dep is not null and coalesce(array_length(p_orden_deposito, 1), 0) <> v_dep then
    raise exception 'El croquis no coincide con la cantidad de módulos del depósito';
  end if;
  if v_dep is not null and p_croquis->'deposito' is not null then
    select count(*) into v_lugares
      from jsonb_each(coalesce(p_croquis->'deposito'->'paredes', '{}'::jsonb)) w, jsonb_array_elements(w.value) e
     where e in ('"m"'::jsonb, '"d"'::jsonb);
    if v_lugares <> v_dep then raise exception 'El dibujo del depósito no coincide con la cantidad de módulos'; end if;
  end if;

  perform orden_mapa_ordenar_(p_local, 'salon', p_orden_salon);
  if v_dep is not null then perform orden_mapa_ordenar_(p_local, 'deposito', p_orden_deposito); end if;
  v_r := orden_mapa_guardar(p_local, p_mapa, p_islas);
  update orden_config set mapa = coalesce(mapa, '{}'::jsonb) || jsonb_build_object('croquis', p_croquis), actualizado_en = now()
   where local_id = p_local;
  return v_r;
end $$;

do $$
begin
  revoke all on function orden_mapa_ordenar_(uuid, text, uuid[]) from public, anon, authenticated;
  grant execute on function orden_mapa_ordenar_(uuid, text, uuid[]) to service_role;
  revoke all on function orden_croquis_guardar(uuid, jsonb, text[], uuid[], uuid[], jsonb) from public, anon;
  grant execute on function orden_croquis_guardar(uuid, jsonb, text[], uuid[], uuid[], jsonb) to authenticated, service_role;
end $$;
