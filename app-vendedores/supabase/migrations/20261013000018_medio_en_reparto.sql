-- =====================================================================
-- Módulo VDH · Migración 18 (SQL 106): los módulos del centro del salón
-- cuentan como los demás en "Repartir parejo".
--
-- Pedido de Mauricio (13/10/2026): los del centro (exhibidores, mesas,
-- percheros, en fila de la caja hacia la vidriera) son módulos como los de
-- las paredes: tienen responsable, suman a la cuenta y van últimos en la
-- numeración (con 22 en las paredes, el primero del centro es el 23). "Repartir parejo" ahora los incluye, al final,
-- en el mismo reparto en bloques. (En la base siguen guardados del 101 en
-- adelante; el número que se ve, 23, 24…, lo arma la app.)
-- Reversible: volver a crear la función del SQL 102.
-- =====================================================================

create or replace function orden_mapa_repartir(p_local uuid, p_tipo text default 'salon')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_secs uuid[]; v_k int; v_n int; v_base int; v_extra int; v_i int := 0; v_desde int := 1; v_cant int;
  v_sec uuid; v_res jsonb := '[]'::jsonb; v_ids uuid[];
  v_tipo orden_sector_tipo := case when p_tipo = 'deposito' then 'deposito' else 'salon' end;
begin
  if not orden_es_supervisor_de(p_local) then raise exception 'Sólo el supervisor del local reparte los módulos'; end if;
  select array_agg(id order by numero) into v_secs from orden_sectores
   where local_id = p_local and tipo = v_tipo and activo and responsable_id is not null;
  if v_secs is null then
    select array_agg(id order by numero) into v_secs from orden_sectores where local_id = p_local and tipo = v_tipo and activo;
  end if;
  if v_secs is null then raise exception 'El local no tiene sectores en %', case when v_tipo = 'salon' then 'el salón' else 'el depósito' end; end if;
  select array_agg(m.id order by m.isla, m.numero) into v_ids
    from orden_modulos m join orden_sectores s on s.id = m.sector_id
   where s.local_id = p_local and s.tipo = v_tipo and s.activo and m.activo;
  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n = 0 then raise exception 'No hay módulos para repartir'; end if;
  select m.numero into v_cant from orden_modulos m where m.id = any (v_ids) group by m.isla, m.numero having count(*) > 1 limit 1;
  if v_cant is not null then
    raise exception 'Hay dos módulos con el número %: así no se puede repartir solo. Repartilos a mano, tocando cada módulo%.', v_cant,
      case when v_tipo = 'deposito' then ' (o guardá el mapa con el depósito: los numera seguidos)' else '' end;
  end if;
  v_k := array_length(v_secs, 1);
  v_base := v_n / v_k;
  v_extra := v_n % v_k;
  foreach v_sec in array v_secs loop
    v_i := v_i + 1;
    v_cant := v_base + case when v_i > v_k - v_extra then 1 else 0 end;
    if v_cant > 0 then
      -- Si en el sector de destino hay otro módulo (apagado) con el mismo número, se corre a un número libre del 201 en adelante.
      update orden_modulos o set numero = 200 + o.numero
        from orden_modulos m
       where m.id = any (v_ids[v_desde:v_desde + v_cant - 1]) and o.sector_id = v_sec and o.numero = m.numero and o.id <> m.id and not o.activo;
      update orden_modulos set sector_id = v_sec where id = any (v_ids[v_desde:v_desde + v_cant - 1]) and sector_id <> v_sec;
      perform orden_controles_reasignar(v_sec);
      v_res := v_res || jsonb_build_object('sector', v_sec, 'cantidad', v_cant,
        'desde', (select numero from orden_modulos where id = v_ids[v_desde]),
        'hasta', (select numero from orden_modulos where id = v_ids[v_desde + v_cant - 1]));
    end if;
    v_desde := v_desde + v_cant;
  end loop;
  return jsonb_build_object('ok', true, 'modulos', v_n, 'sectores', v_k, 'reparto', v_res);
end $$;
