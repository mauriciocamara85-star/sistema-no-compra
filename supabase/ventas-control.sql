-- ═══ SQL 185 · Ventas: el control de carga de cada mañana (28/10/2026) ═══
-- Pedido de Mauricio: que a Cintia, que controla que los locales carguen bien
-- Ventas, le llegue un mail con los errores de la carga del día anterior:
-- el que no cargó, el que se olvidó, el que no actualizó el Informe por
-- vendedor. Es el mail "VDH · Control de carga" que mandaba el consolidador
-- de las planillas, ahora desde el sistema y con más controles.
-- · Arma el control de un día (por defecto, ayer) para los 14 locales.
-- · Lo lee el Apps Script del mail con su llave (la llave no se guarda: sólo
--   su huella). Nadie más lo puede leer de afuera.
-- No borra nada ni cambia nada de lo cargado: sólo lee.
-- Se puede correr dos veces. Se deshace con deshacer-185.sql.

-- 1. La huella de la llave del mail (sha256). La llave la tiene sólo el Apps Script.
create table if not exists ventas_control_llave (
  id smallint primary key default 1 check (id = 1),
  huella text not null,
  cambiada_en timestamptz not null default now()
);
alter table ventas_control_llave enable row level security;
revoke all on table ventas_control_llave from public, anon, authenticated;

-- 2. Cómo se escriben los números en el mail: $1.234.567, 7,5, "mar 27/10".
create or replace function ventas_ctl_pesos(n numeric)
returns text language sql immutable as $$
  select '$' || replace(to_char(round(n), 'FM999,999,999,990'), ',', '.')
$$;

create or replace function ventas_ctl_num(n numeric)
returns text language sql immutable as $$
  select case when round(n, 1) = trunc(round(n, 1)) then to_char(round(n, 1), 'FM999999990')
              else replace(to_char(round(n, 1), 'FM999999990.0'), '.', ',') end
$$;

create or replace function ventas_ctl_lista(a text[])
returns text language sql immutable as $$
  select case when cardinality(a) <= 1 then a[1]
              else array_to_string(a[1:cardinality(a) - 1], ', ') || ' y ' || a[cardinality(a)] end
$$;

create or replace function ventas_ctl_dia(d date)
returns text language sql immutable as $$
  select (array['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'])[extract(isodow from d)::int] || ' ' || to_char(d, 'DD/MM')
$$;

/* 3. El control de un día. Por local:
   · si abría (el % del día en Ventas; si el mes no existe, sus días abiertos);
   · la venta del día, el tráfico del local, y quién y cuándo cargó;
   · lo que falta: la venta, el tráfico, la conversión o el ticket, el Informe por vendedor de la semana
     (o que no lo actualizaron después de cargar la venta del día);
   · lo que no cierra: tickets por la venta y el ticket promedio contra tráfico × conversión, del local
     (desde 0,9 tickets: un ticket de diferencia en un día es un error real; medido en octubre, 13 días
     de 335) y de cada vendedor en la semana (desde 1,5: en la semana, uno solo es ruido);
   · los números raros (los mismos límites del cartel "¿Está bien este número?" de ventas.js);
   · la venta sin vendedor, y la venta cargada antes de abrir (¿era del día anterior?).
   Cada aviso: g = 'falta' | 'revisar' | 'ojo', t = el texto. */
create or replace function ventas_control(p_fecha date default null)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_tz  constant text := 'America/Argentina/Buenos_Aires';
  v_dia date := coalesce(p_fecha, ventas_hoy() - 1);
  v_mes date := ventas_mes_de(v_dia);
  v_sem smallint := ventas_semana(v_dia);
  l record; x record; t record;
  probs jsonb; res jsonb := '[]'::jsonb; v_n int := 0;
  v_abre boolean; v_venta numeric; v_nv int; v_por text; v_fin timestamptz;
  v_tkv numeric; v_tkc numeric; v_inf text; v_faltan text[]; v_raro boolean; v_antes int; v_viejos text[]; v_dia_mal boolean;
begin
  for l in select * from orden_locales where activo order by nombre loop
    probs := '[]'::jsonb; v_inf := null; v_faltan := '{}'; v_viejos := '{}';

    select d.peso > 0 into v_abre from ventas_dias d where d.local_id = l.id and d.fecha = v_dia;
    v_abre := coalesce(v_abre, extract(isodow from v_dia)::int = any(l.dias_abiertos));

    select sum(d.monto), count(*) filter (where d.monto > 0), max(d.cargado_en)
      into v_venta, v_nv, v_fin
      from ventas_diarias d join ventas_vendedores v on v.id = d.vendedor_id
     where v.local_id = l.id and v.mes = v_mes and d.fecha = v_dia;
    v_venta := coalesce(v_venta, 0);

    select tr.trafico, tr.conversion, tr.ticket, tr.cargado_por, tr.cargado_en into t
      from ventas_trafico tr where tr.local_id = l.id and tr.fecha = v_dia;

    -- Quién cargó la venta y el tráfico del día, cada uno una vez, en el orden en que cargaron.
    select string_agg(q.por, ', ' order by q.primero) into v_por
      from (select c.por, min(c.en) as primero
              from (select d.cargado_por as por, d.cargado_en as en
                      from ventas_diarias d join ventas_vendedores v on v.id = d.vendedor_id
                     where v.local_id = l.id and v.mes = v_mes and d.fecha = v_dia
                    union all
                    select tr.cargado_por, tr.cargado_en from ventas_trafico tr where tr.local_id = l.id and tr.fecha = v_dia) c
             where c.por is not null group by c.por) q;

    -- Lo que falta del día.
    if (v_abre or coalesce(t.trafico, 0) > 0) and v_venta = 0 and not (coalesce(t.trafico, 0) > 0 and t.conversion = 0) then
      probs := probs || jsonb_build_object('g', 'falta', 't', 'No cargó la venta del día.');
    end if;
    if (v_abre or v_venta > 0) and t.trafico is null then
      probs := probs || jsonb_build_object('g', 'falta', 't', 'No cargó el tráfico del día.');
    elsif v_venta > 0 and t.trafico = 0 then
      probs := probs || jsonb_build_object('g', 'revisar', 't',
        format('El tráfico del día dice 0, pero hubo venta (%s).', ventas_ctl_pesos(v_venta)));
    elsif v_venta > 0 and (t.conversion is null or coalesce(t.ticket, 0) = 0) then
      probs := probs || jsonb_build_object('g', 'falta', 't',
        'En el tráfico del día falta ' || case when t.conversion is null and coalesce(t.ticket, 0) = 0 then 'la conversión y el ticket promedio'
                                              when t.conversion is null then 'la conversión' else 'el ticket promedio' end || '.');
    end if;

    -- Los números raros del día.
    v_raro := false; v_dia_mal := false;
    if t.trafico > 500 then
      v_raro := true;
      probs := probs || jsonb_build_object('g', 'revisar', 't', format('El tráfico del día dice %s: es mucha gente para un día%s',
        t.trafico, case when t.trafico >= 10000 then '. ¿No será la venta?' else '. ¿Está bien?' end));
    end if;
    if t.conversion > 1 then
      v_raro := true;
      probs := probs || jsonb_build_object('g', 'revisar', 't', format('La conversión del día dice %s%%: serían más tickets que gente que entró.',
        ventas_ctl_num(t.conversion * 100)));
    end if;
    if t.ticket > 0 and t.ticket < 5000 then
      v_raro := true;
      probs := probs || jsonb_build_object('g', 'revisar', 't', format('El ticket promedio del día dice %s. ¿No le faltan los miles?', ventas_ctl_pesos(t.ticket)));
    elsif t.ticket > 1000000 then
      v_raro := true;
      probs := probs || jsonb_build_object('g', 'revisar', 't', format('El ticket promedio del día dice %s: es mucho para un ticket. ¿No será la venta?', ventas_ctl_pesos(t.ticket)));
    end if;
    for x in select v.nombre, d.monto from ventas_diarias d join ventas_vendedores v on v.id = d.vendedor_id
              where v.local_id = l.id and v.mes = v_mes and d.fecha = v_dia and d.monto > 0 and d.monto < 5000 and v.nombre <> ''
              order by v.orden, v.id loop
      probs := probs || jsonb_build_object('g', 'revisar', 't', format('La venta de %s dice %s. ¿No le faltan ceros?', x.nombre, ventas_ctl_pesos(x.monto)));
    end loop;

    -- Los números del día tienen que cerrar: tickets = venta / ticket promedio = tráfico × conversión.
    if not v_raro and v_venta > 0 and t.ticket > 0 and t.trafico > 0 and t.conversion is not null then
      v_tkv := v_venta / t.ticket; v_tkc := t.trafico * t.conversion;
      if abs(v_tkv - v_tkc) >= 0.9 then
        probs := probs || jsonb_build_object('g', 'revisar', 't', format(
          'No cierran los números del día: la venta (%s) dividida por el ticket promedio (%s) da %s tickets, pero el tráfico (%s) por la conversión (%s%%) da %s. Alguno de los cuatro está mal.',
          ventas_ctl_pesos(v_venta), ventas_ctl_pesos(t.ticket), ventas_ctl_num(v_tkv), t.trafico, ventas_ctl_num(t.conversion * 100), ventas_ctl_num(v_tkc)));
        v_dia_mal := true;
      end if;
    end if;
    v_dia_mal := v_dia_mal or v_raro;

    -- La venta sin vendedor.
    select sum(d.monto) into v_tkv from ventas_diarias d join ventas_vendedores v on v.id = d.vendedor_id
     where v.local_id = l.id and v.mes = v_mes and d.fecha = v_dia and v.nombre = '';
    if v_tkv > 0 then
      probs := probs || jsonb_build_object('g', 'revisar', 't', format('Hay %s cargados sin vendedor: ¿de quién son?', ventas_ctl_pesos(v_tkv)));
    end if;

    -- El Informe por vendedor de la semana, si el local abrió ese día (si no, no hay nada nuevo que cargar): cada
    -- vendedor que vendió en la semana hasta ese día. Falta si no tiene tráfico, conversión o ticket; quedó viejo si
    -- vendió ese día y su informe es de más de una hora antes de esa venta (se carga al cerrar, después de la venta).
    v_antes := jsonb_array_length(probs);
    if v_abre or v_venta > 0 then
      for x in
        with vv as (
          select v.id, v.nombre, v.orden, sum(d.monto) as venta_sem,
                 max(d.cargado_en) filter (where d.fecha = v_dia and d.monto > 0) as venta_dia_en
            from ventas_vendedores v join ventas_diarias d on d.vendedor_id = v.id
           where v.local_id = l.id and v.mes = v_mes and v.nombre <> '' and d.fecha <= v_dia and ventas_semana(d.fecha) = v_sem
           group by v.id, v.nombre, v.orden having sum(d.monto) > 0)
        select vv.*, s.trafico, s.conversion, s.ticket, s.pxt, s.cargado_en
          from vv left join ventas_semanal s on s.vendedor_id = vv.id and s.semana = v_sem
         order by vv.orden, vv.id
      loop
        v_inf := coalesce(v_inf, 'ok');
        if coalesce(x.trafico, 0) = 0 or coalesce(x.ticket, 0) = 0 or x.conversion is null then
          v_faltan := v_faltan || x.nombre;
          continue;
        end if;
        if x.venta_dia_en is not null and x.cargado_en < x.venta_dia_en - interval '1 hour' then
          v_viejos := v_viejos || x.nombre;
          continue;
        end if;
        v_raro := false;
        if x.trafico > 400 then
          v_raro := true;
          probs := probs || jsonb_build_object('g', 'revisar', 't', format('El tráfico de %s en la semana %s dice %s: es mucha gente para una semana%s',
            x.nombre, v_sem, x.trafico, case when x.trafico >= 10000 then '. ¿No será la venta?' else '. ¿Está bien?' end));
        end if;
        if x.conversion > 1 then
          v_raro := true;
          probs := probs || jsonb_build_object('g', 'revisar', 't', format('La conversión de %s en la semana %s dice %s%%: serían más tickets que gente que entró.',
            x.nombre, v_sem, ventas_ctl_num(x.conversion * 100)));
        end if;
        if x.ticket < 5000 then
          v_raro := true;
          probs := probs || jsonb_build_object('g', 'revisar', 't', format('El ticket promedio de %s en la semana %s dice %s. ¿No le faltan los miles?',
            x.nombre, v_sem, ventas_ctl_pesos(x.ticket)));
        elsif x.ticket > 1000000 then
          v_raro := true;
          probs := probs || jsonb_build_object('g', 'revisar', 't', format('El ticket promedio de %s en la semana %s dice %s: es mucho para un ticket. ¿No será la venta?',
            x.nombre, v_sem, ventas_ctl_pesos(x.ticket)));
        end if;
        if x.pxt > 8 then
          probs := probs || jsonb_build_object('g', 'revisar', 't', format('Las prendas por ticket de %s en la semana %s dicen %s: es mucho. ¿No será el total de prendas?',
            x.nombre, v_sem, ventas_ctl_num(x.pxt)));
        end if;
        if not v_raro then
          v_tkv := x.venta_sem / x.ticket; v_tkc := x.trafico * x.conversion;
          if abs(v_tkv - v_tkc) >= 1.5 then
            probs := probs || jsonb_build_object('g', 'revisar', 't', format(
              'El Informe por vendedor de %s (semana %s) no cierra con lo que vendió: con su venta (%s) y su ticket promedio (%s) dan %s tickets; con su tráfico (%s) y su conversión (%s%%), %s.',
              x.nombre, v_sem, ventas_ctl_pesos(x.venta_sem), ventas_ctl_pesos(x.ticket), ventas_ctl_num(v_tkv), x.trafico,
              ventas_ctl_num(x.conversion * 100), ventas_ctl_num(v_tkc)));
          end if;
        end if;
      end loop;
    end if;
    if cardinality(v_faltan) > 0 then
      probs := probs || jsonb_build_object('g', 'falta', 't',
        format('Falta cargar el Informe por vendedor de la semana %s de %s.', v_sem, ventas_ctl_lista(v_faltan)));
    end if;
    if cardinality(v_viejos) > 0 then
      probs := probs || jsonb_build_object('g', 'falta', 't',
        format('No actualizaron el Informe por vendedor de %s después de cargar la venta del %s.', ventas_ctl_lista(v_viejos), ventas_ctl_dia(v_dia)));
    end if;
    if cardinality(v_faltan) + cardinality(v_viejos) > 0 then
      v_inf := 'falta';
    elsif jsonb_array_length(probs) > v_antes then
      v_inf := 'revisar';
    end if;

    -- La venta cargada antes de abrir (ese día o hoy): ¿era del día anterior?
    for x in select v.nombre, d.fecha, d.monto, d.cargado_en
               from ventas_diarias d join ventas_vendedores v on v.id = d.vendedor_id
              where v.local_id = l.id and d.fecha between v_dia and v_dia + 1 and d.monto > 0
                and d.cargado_por <> 'Planilla'
                and (d.cargado_en at time zone v_tz) < d.fecha + coalesce(l.hora_apertura, time '09:00')
              order by d.fecha, v.orden, v.id loop
      probs := probs || jsonb_build_object('g', 'ojo', 't', format(
        'Cargaron %s a %s el %s a las %s, antes de abrir. ¿No era del día anterior?',
        ventas_ctl_pesos(x.monto), coalesce(nullif(x.nombre, ''), 'Sin vendedor'), ventas_ctl_dia(x.fecha), to_char(x.cargado_en at time zone v_tz, 'HH24:MI')));
    end loop;

    if jsonb_array_length(probs) > 0 then v_n := v_n + 1; end if;
    res := res || jsonb_build_object(
      'local', l.nombre, 'abre', v_abre,
      'venta', v_venta, 'vendedores', v_nv,
      'trafico', t.trafico, 'conversion', t.conversion, 'ticket', t.ticket, 'trafico_mal', v_dia_mal,
      'informe', v_inf,
      'cargo', v_por,
      'cuando', case when coalesce(v_fin, t.cargado_en) is null then null
                     else ventas_ctl_dia((greatest(v_fin, t.cargado_en) at time zone v_tz)::date) || ' ' ||
                          to_char(greatest(v_fin, t.cargado_en) at time zone v_tz, 'HH24:MI') end,
      'problemas', probs);
  end loop;

  return jsonb_build_object('fecha', v_dia, 'dia', ventas_ctl_dia(v_dia), 'semana', v_sem,
                            'generado', now(), 'con_problemas', v_n, 'locales', res);
end $$;
revoke all on function ventas_control(date) from public, anon, authenticated;

-- 4. Para el mail: con la llave (el Apps Script no tiene sesión).
create or replace function ventas_control_mail(p_llave text, p_fecha date default null)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not exists (select 1 from ventas_control_llave k
                  where k.id = 1 and length(coalesce(p_llave, '')) >= 32
                    and k.huella = encode(digest(p_llave, 'sha256'), 'hex')) then
    raise exception 'ventas_control: la llave no es la del mail';
  end if;
  return ventas_control(p_fecha);
end $$;
revoke all on function ventas_control_mail(text, date) from public;
grant execute on function ventas_control_mail(text, date) to anon, authenticated;
