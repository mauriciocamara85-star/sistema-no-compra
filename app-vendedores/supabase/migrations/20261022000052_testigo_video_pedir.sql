-- =====================================================================
-- Módulo VDH · Migración 52 (SQL 157), 22/10/2026: en el producto testigo,
-- cada video se puede dar por bueno ("Está bien") o pedir que lo graben de
-- nuevo ("Que lo graben de nuevo"). Pedido de Mauricio después del primer
-- control de Rivadavia: "que haya una opción para que algún video en
-- particular se pueda mandar de vuelta".
--   · Pedirlo de nuevo, sólo el mismo día que lo grabaron (Mauricio: "se
--     puede pedir en el mismo día; si no, hay que volver a hacer todo").
--   · Les llega un aviso a los vendedores del local que trabajan hoy, y lo
--     pueden grabar de nuevo aunque ya hayan mandado el control.
--   · Cuando lo graban de nuevo, le avisa a quien lo pidió, y el video vuelve
--     a quedar para mirar.
-- Reversible: deshacer-157.sql.
-- =====================================================================

-- ---------- Quién miró el video y quién pidió grabarlo de nuevo ----------
alter table testigo_items
  add column if not exists video_revisado_en timestamptz,
  add column if not exists video_revisado_por uuid references orden_personas(id) on delete set null,
  add column if not exists video_pedido_en timestamptz,
  add column if not exists video_pedido_por uuid references orden_personas(id) on delete set null,
  add column if not exists video_pedido_msg text;
alter table testigo_items drop constraint if exists testigo_items_pedido_msg_largo;
alter table testigo_items add constraint testigo_items_pedido_msg_largo check (length(video_pedido_msg) <= 200);
comment on column testigo_items.video_revisado_en is '"Está bien": el supervisor miró el video (SQL 157)';
comment on column testigo_items.video_pedido_en is '"Que lo graben de nuevo" (SQL 157): vale sólo el día que lo grabaron';

-- ---------- La planilla con las cuentas: lo mismo, y cómo está el video al final ----------
-- video_estado: null (sin video), 'para_mirar', 'bien', 'pedido' (lo tienen que grabar hoy)
-- o 'pedido_vencido' (lo pidieron y no lo grabaron ese día).
create or replace view testigo_v_items with (security_invoker = true) as
 SELECT i.id,
    i.semana_id,
    i.item,
    i.producto,
    i.color,
    i.enviada,
    i.stock_sistema,
    i.cantidad_real,
    i.dev_fabrica,
    i.salieron,
    i.entraron,
    i.observacion,
    i.vendida,
    i.video_path,
    i.video_subido_en,
    i.video_borrado,
    i.cargado_en,
    i.cargado_por,
    s.local_id,
    s.semana,
    s.fecha,
    s.cargada_en,
    i.stock_sistema - i.cantidad_real AS diferencia,
        CASE
            WHEN COALESCE(i.enviada, 0) > 0 AND i.stock_sistema IS NOT NULL AND i.cantidad_real IS NOT NULL THEN round(100.0 * (i.stock_sistema - i.cantidad_real)::numeric / i.enviada::numeric, 1)
            ELSE NULL::numeric
        END AS desvio,
    i.rubro,
    i.video_revisado_en,
    i.video_pedido_en,
    i.video_pedido_msg,
        CASE
            WHEN i.video_path IS NULL OR i.video_borrado THEN NULL::text
            WHEN i.video_pedido_en > COALESCE(i.video_subido_en, '-infinity'::timestamptz) AND i.video_pedido_en > COALESCE(i.video_revisado_en, '-infinity'::timestamptz) THEN
                CASE WHEN (i.video_pedido_en AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
                     THEN 'pedido' ELSE 'pedido_vencido' END
            WHEN i.video_revisado_en >= i.video_subido_en THEN 'bien'
            ELSE 'para_mirar'
        END AS video_estado
   FROM testigo_items i
     JOIN testigo_semanas s ON s.id = i.semana_id;

-- ---------- "Está bien" o "Que lo graben de nuevo" (el supervisor, en la compu o en Revisar) ----------
create or replace function testigo_video_revisar(p_item uuid, p_bien boolean, p_mensaje text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  i testigo_items; s testigo_semanas; r record; v_yo uuid := orden_yo_id(); v_n int := 0; v_que text; v_aviso uuid;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_msg text := left(nullif(trim(coalesce(p_mensaje, '')), ''), 200);
begin
  select * into i from testigo_items where id = p_item for update;
  if not found then raise exception 'No encontramos ese producto'; end if;
  select * into s from testigo_semanas where id = i.semana_id;
  if not orden_es_supervisor_de(s.local_id) or orden_es_gerencia() then
    raise exception 'No podés revisar el producto testigo de ese local';
  end if;
  if s.cerrada then raise exception 'Esta semana ya está cerrada'; end if;
  if i.video_path is null or i.video_borrado then raise exception 'Ese producto no tiene video'; end if;

  if p_bien then
    update testigo_items set video_revisado_en = now(), video_revisado_por = v_yo where id = i.id;
    return jsonb_build_object('item', i.id, 'bien', true);
  end if;

  -- Sólo el mismo día: al otro ya se vendió o entró mercadería, y habría que volver a contar todo.
  if i.video_subido_en is null or (i.video_subido_en at time zone 'America/Argentina/Buenos_Aires')::date <> v_hoy then
    raise exception 'Sólo se puede pedir el mismo día que lo grabaron (lo grabaron el %): ahora habría que volver a contar todo',
      coalesce(to_char(i.video_subido_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM'), 'otro día');
  end if;
  if i.video_pedido_en > i.video_subido_en and i.video_pedido_en > coalesce(i.video_revisado_en, '-infinity'::timestamptz) then
    raise exception 'Ya pidieron que lo graben de nuevo (a las %)', to_char(i.video_pedido_en at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI');
  end if;
  update testigo_items set video_pedido_en = now(), video_pedido_por = v_yo, video_pedido_msg = v_msg where id = i.id;

  -- El aviso, a los vendedores del local que trabajan hoy (si no hay ninguno anotado, a todos los del local).
  v_que := i.producto || coalesce(' ' || i.color, '');
  for r in
    select p.id from orden_personas p
     where p.activo and p.aprobado and p.local_id = s.local_id and p.rol = 'vendedor' and p.id is distinct from v_yo
       and (orden_trabaja(p.id, v_hoy) or not exists (
             select 1 from orden_personas q
              where q.activo and q.aprobado and q.local_id = s.local_id and q.rol = 'vendedor' and orden_trabaja(q.id, v_hoy)))
  loop
    v_aviso := orden_encolar_aviso(r.id, 'testigo', left('Grabá de nuevo el video de ' || v_que, 120),
      left(case when v_msg is null then 'Te lo pidió tu supervisor.' when v_msg ~ '[.!?…]$' then v_msg else v_msg || '.' end
           || ' Es para hoy: entrá a Producto testigo.', 300),
      '/testigo/' || s.id, 'testigo-video:' || i.id || ':' || floor(extract(epoch from now()))::bigint || ':' || r.id, 2::smallint);
    if v_aviso is not null then v_n := v_n + 1; end if;
  end loop;
  return jsonb_build_object('item', i.id, 'bien', false, 'avisados', v_n);
end $$;

-- ---------- Guardar el video: si hoy pidieron grabarlo de nuevo, se puede aunque ya lo hayan mandado ----------
create or replace function testigo_video_guardar(p_item uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare i testigo_items; s testigo_semanas; v_pedido boolean; v_local text;
begin
  select * into i from testigo_items where id = p_item for update;
  if not found then raise exception 'No encontramos ese producto'; end if;
  select * into s from testigo_semanas where id = i.semana_id;
  v_pedido := coalesce(i.video_pedido_en > coalesce(i.video_subido_en, '-infinity'::timestamptz)
                       and i.video_pedido_en > coalesce(i.video_revisado_en, '-infinity'::timestamptz)
                       and (i.video_pedido_en at time zone 'America/Argentina/Buenos_Aires')::date = (now() at time zone 'America/Argentina/Buenos_Aires')::date, false);
  if not (v_pedido and not s.cerrada and orden_es_del_local(s.local_id) and not orden_es_gerencia()) then
    perform testigo_abierto_(s);
  end if;
  if p_path is null or p_path not like s.local_id::text || '/' || s.id::text || '/' || i.id::text || '-%' or p_path like '%..%' then
    raise exception 'Ese video no es de este producto';
  end if;
  if i.video_path is not null and i.video_path <> p_path and not i.video_borrado and i.video_path like s.local_id::text || '/%' then
    insert into testigo_videos_viejos (path) values (i.video_path) on conflict do nothing;
  end if;
  update testigo_items set video_path = p_path, video_subido_en = now(), video_borrado = false where id = i.id;
  -- Al que lo pidió: que ya está, para mirarlo.
  if v_pedido then
    select nombre into v_local from orden_locales where id = s.local_id;
    perform orden_encolar_aviso(i.video_pedido_por, 'testigo', 'Ya grabaron de nuevo el video',
      left(i.producto || coalesce(' ' || i.color, '') || coalesce(' · ' || v_local, '') || '. Miralo en Revisar.', 300), '/revisar',
      'testigo-video-nuevo:' || i.id || ':' || floor(extract(epoch from i.video_pedido_en))::bigint, 1::smallint);
  end if;
end $$;

do $$
begin
  revoke all on function testigo_video_revisar(uuid, boolean, text) from public, anon;
  grant execute on function testigo_video_revisar(uuid, boolean, text) to authenticated, service_role;
end $$;
