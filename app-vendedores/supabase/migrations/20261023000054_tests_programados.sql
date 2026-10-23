-- ════════════════════════════════════════════════════════════════════════
-- Migración 54 (SQL 161, 23/10/2026, pedido de Mauricio): "Mandar un test"
-- con día y hora.
--   · En Supervisión → Ajustes → Tests, el test se manda ahora (como antes)
--     o se programa para otro día y otra hora: "que se pueda elegir el día",
--     para mandar una sorpresa cuando él quiera.
--   · Hasta esa hora los vendedores no ven nada. A esa hora la base lo arma
--     igual que "ahora": las mismas preguntas para todos los vendedores
--     aprobados de esos locales, con "Tenés un test de conocimiento: …". El
--     reloj de los tests revisa cada 5 minutos; el aviso al celular sale con
--     el reloj de siempre (cada 15 minutos).
--   · Los programados se ven en la misma pestaña y se pueden cancelar hasta
--     que salen. Las preguntas se eligen al salir (si en el medio se apagan
--     todas las del grupo, no sale y queda dicho por qué).
--   · orden_test_mandar hace lo mismo que antes: ahora revisa y arma con las
--     dos funciones de abajo, que comparte con el programado.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Los tests programados. Los vendedores no los ven (es sorpresa): sólo
--    quien ve el equipo de alguno de esos locales. Se escriben sólo con las
--    funciones de abajo.
create table if not exists orden_tests_programados (
  id          uuid primary key default gen_random_uuid(),
  locales     uuid[] not null,
  titulo      text not null,
  grupo       text,                              -- las preguntas de ese grupo; si no, las del tema
  tema        text not null default 'todo',      -- 'producto', 'retail' o 'todo'
  cantidad    int not null,
  dias        int not null,                      -- días para hacerlo, desde que sale
  sale_en     timestamptz not null,
  estado      text not null default 'programado' check (estado in ('programado', 'mandado', 'cancelado', 'no_salio')),
  personas    int,                               -- a cuántos les llegó
  preguntas   int,
  error       text,                              -- por qué no salió
  creado_por  uuid references orden_personas(id) on delete set null,
  creado_en   timestamptz not null default now(),
  resuelto_en timestamptz                        -- cuándo salió, se canceló o no salió
);
create index if not exists orden_tests_programados_pendientes on orden_tests_programados (sale_en) where estado = 'programado';
alter table orden_tests_programados enable row level security;
drop policy if exists ver on orden_tests_programados;
create policy ver on orden_tests_programados for select to authenticated
  using (exists (select 1 from unnest(locales) l where orden_ve_equipo(l)));

-- 2. Revisar un test antes de mandarlo o programarlo: los datos, el permiso
--    en cada local y que haya preguntas. Los mismos mensajes que antes.
create or replace function orden_test_revisar_(p_locales uuid[], p_titulo text, p_grupo text, p_tema text, p_cantidad int, p_dias int)
returns void language plpgsql stable security definer set search_path = public as $$
declare
  v_titulo text := nullif(trim(coalesce(p_titulo, '')), ''); v_grupo text := nullif(trim(coalesce(p_grupo, '')), '');
  v_tema text := case when p_tema in ('producto', 'retail') then p_tema else 'todo' end;
  v_loc uuid;
begin
  if v_titulo is null then raise exception 'Ponele un título al test (por ejemplo: Colección verano)'; end if;
  if length(v_titulo) > 60 then raise exception 'El título es muy largo (hasta 60 letras)'; end if;
  if coalesce(array_length(p_locales, 1), 0) = 0 then raise exception 'Elegí al menos un local'; end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 20 then raise exception 'De 1 a 20 preguntas'; end if;
  if p_dias is null or p_dias < 1 or p_dias > 14 then raise exception 'Que venza en 1 a 14 días'; end if;
  foreach v_loc in array p_locales loop
    if not orden_es_supervisor_de(v_loc) or orden_es_gerencia() then
      raise exception 'No podés mandar el test en %', coalesce((select nombre from orden_locales where id = v_loc), 'ese local');
    end if;
  end loop;
  if not exists (select 1 from orden_preguntas q
                  where q.activo
                    and case when v_grupo is not null then lower(trim(q.grupo)) = lower(v_grupo)
                             when v_tema = 'producto' then q.tema in ('tela', 'molderia')
                             when v_tema = 'retail' then q.tema = 'retail'
                             else true end) then
    raise exception 'No hay preguntas activas %', case when v_grupo is not null then 'del grupo "' || v_grupo || '"' else 'de ese tema' end;
  end if;
end $$;

-- 3. Armar el test y avisarles (lo de "Mandar un test ahora", sin revisar
--    permisos: lo llaman orden_test_mandar y el reloj de los programados).
create or replace function orden_test_crear_(p_locales uuid[], p_titulo text, p_grupo text, p_tema text, p_cantidad int, p_dias int, p_por uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_titulo text := nullif(trim(coalesce(p_titulo, '')), ''); v_grupo text := nullif(trim(coalesce(p_grupo, '')), '');
  v_tema text := case when p_tema in ('producto', 'retail') then p_tema else 'todo' end;
  v_preg uuid[]; p record; v_id uuid; v_n int := 0;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  select array_agg(id) into v_preg from (
    select q.id from orden_preguntas q
     where q.activo
       and case when v_grupo is not null then lower(trim(q.grupo)) = lower(v_grupo)
                when v_tema = 'producto' then q.tema in ('tela', 'molderia')
                when v_tema = 'retail' then q.tema = 'retail'
                else true end
     order by random() limit p_cantidad) x;
  if v_preg is null then
    raise exception 'No hay preguntas activas %', case when v_grupo is not null then 'del grupo "' || v_grupo || '"' else 'de ese tema' end;
  end if;
  for p in select pe.id, pe.local_id from orden_personas pe
            where pe.local_id = any (p_locales) and pe.activo and pe.aprobado and pe.rol = 'vendedor' loop
    insert into orden_desafios (local_id, persona_id, semana, categoria, dificultad, preguntas, total, vence_en, titulo, enviado_por)
    values (p.local_id, p.id, v_hoy - (extract(isodow from v_hoy)::int - 1), case when v_grupo is not null then 'grupo' else v_tema end, 1,
            v_preg, array_length(v_preg, 1), now() + make_interval(days => p_dias), v_titulo, p_por)
    returning id into v_id;
    perform orden_encolar_aviso(p.id, 'desafio', 'Tenés un test de conocimiento: ' || v_titulo,
      array_length(v_preg, 1) || ' preguntas de opción múltiple. Si le errás, no pasa nada: es para aprender.',
      '/desafio', 'test:' || v_id, 2::smallint);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'personas', v_n, 'preguntas', array_length(v_preg, 1));
end $$;

-- 4. Mandar un test ahora (el administrador, o el supervisor en su local): igual que antes.
create or replace function orden_test_mandar(p_locales uuid[], p_titulo text, p_grupo text, p_tema text, p_cantidad int, p_dias int default 2)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  perform orden_test_revisar_(p_locales, p_titulo, p_grupo, p_tema, p_cantidad, p_dias);
  return orden_test_crear_(p_locales, p_titulo, p_grupo, p_tema, p_cantidad, p_dias, orden_yo_id());
end $$;

-- 5. Programarlo para un día y una hora de la Argentina (de ahora a 60 días).
create or replace function orden_test_programar(p_locales uuid[], p_titulo text, p_grupo text, p_tema text, p_cantidad int, p_dias int,
                                                p_fecha date, p_hora time)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_sale timestamptz; v_id uuid;
begin
  perform orden_test_revisar_(p_locales, p_titulo, p_grupo, p_tema, p_cantidad, p_dias);
  if p_fecha is null or p_hora is null then raise exception 'Elegí el día y la hora'; end if;
  v_sale := (p_fecha + p_hora) at time zone 'America/Argentina/Buenos_Aires';
  if v_sale <= now() then raise exception 'Esa hora ya pasó: elegí una más adelante, o mandalo ahora'; end if;
  if v_sale > now() + interval '60 days' then raise exception 'Se puede programar hasta 60 días adelante'; end if;
  insert into orden_tests_programados (locales, titulo, grupo, tema, cantidad, dias, sale_en, creado_por)
  values ((select array_agg(distinct l) from unnest(p_locales) l), trim(p_titulo), nullif(trim(coalesce(p_grupo, '')), ''),
          case when p_tema in ('producto', 'retail') then p_tema else 'todo' end, p_cantidad, p_dias, v_sale, orden_yo_id())
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'sale_en', v_sale);
end $$;

-- 6. Cancelarlo mientras no salió (quien lo podría mandar en todos sus locales).
create or replace function orden_test_cancelar(p_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare t orden_tests_programados; v_loc uuid;
begin
  select * into t from orden_tests_programados where id = p_id for update;
  if not found then raise exception 'Ese test no existe'; end if;
  foreach v_loc in array t.locales loop
    if not orden_es_supervisor_de(v_loc) or orden_es_gerencia() then raise exception 'No podés cancelar este test'; end if;
  end loop;
  if t.estado = 'mandado' then raise exception 'Ese test ya salió: no se puede cancelar'; end if;
  if t.estado <> 'programado' then raise exception 'Ese test ya no estaba programado'; end if;
  update orden_tests_programados set estado = 'cancelado', resuelto_en = now() where id = p_id;
end $$;

-- 7. El reloj de los tests: los programados que llegaron a su hora salen.
--    Si uno no puede salir (por ejemplo, sin preguntas activas), queda
--    "no salió" con el motivo y los demás siguen.
create or replace function orden_tests_programados_mandar_()
returns int language plpgsql volatile security definer set search_path = public as $$
declare t orden_tests_programados; r jsonb; v_n int := 0;
begin
  for t in select * from orden_tests_programados where estado = 'programado' and sale_en <= now()
            order by sale_en for update skip locked loop
    begin
      r := orden_test_crear_(t.locales, t.titulo, t.grupo, t.tema, t.cantidad, t.dias, t.creado_por);
      update orden_tests_programados set estado = 'mandado', resuelto_en = now(),
             personas = (r ->> 'personas')::int, preguntas = (r ->> 'preguntas')::int
       where id = t.id;
      v_n := v_n + 1;
    exception when others then
      update orden_tests_programados set estado = 'no_salio', resuelto_en = now(), error = sqlerrm where id = t.id;
    end;
  end loop;
  return v_n;
end $$;

do $$
begin
  perform cron.schedule('orden-tests-programados', '*/5 * * * *', 'select orden_tests_programados_mandar_()');
end $$;

-- 8. Permisos
do $$
begin
  revoke all on table orden_tests_programados from anon, authenticated;
  grant select on table orden_tests_programados to authenticated;
  grant all on table orden_tests_programados to service_role;
  revoke all on function orden_test_revisar_(uuid[], text, text, text, int, int) from public, anon, authenticated;
  grant execute on function orden_test_revisar_(uuid[], text, text, text, int, int) to service_role;
  revoke all on function orden_test_crear_(uuid[], text, text, text, int, int, uuid) from public, anon, authenticated;
  grant execute on function orden_test_crear_(uuid[], text, text, text, int, int, uuid) to service_role;
  revoke all on function orden_tests_programados_mandar_() from public, anon, authenticated;
  grant execute on function orden_tests_programados_mandar_() to service_role;
  revoke all on function orden_test_mandar(uuid[], text, text, text, int, int) from public, anon;
  grant execute on function orden_test_mandar(uuid[], text, text, text, int, int) to authenticated, service_role;
  revoke all on function orden_test_programar(uuid[], text, text, text, int, int, date, time) from public, anon;
  grant execute on function orden_test_programar(uuid[], text, text, text, int, int, date, time) to authenticated, service_role;
  revoke all on function orden_test_cancelar(uuid) from public, anon;
  grant execute on function orden_test_cancelar(uuid) to authenticated, service_role;
end $$;
