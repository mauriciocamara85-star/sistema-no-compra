-- SQL 239 (migración 68): a qué administrador le llega cada aviso.
--
-- Pedido (4/11/2026): los avisos de los administradores no deberían incluir el cierre de caja y demás; a cada supervisor le
-- tiene que llegar lo suyo, igual que ahora; lo del producto testigo, a la encargada del testigo; al administrador que se hace
-- cargo de un local, sólo lo de ese local; a los demás administradores, nada ("entra al sistema y lo ve").
--
-- Hasta ahora, a TODOS los administradores les llegaba lo que es "para los administradores" (fotos sin revisar, la caja sin
-- cargar o sin controlar, el cierre del mes, el PIN que están probando…) y, en los locales sin un supervisor con usuario, también
-- lo del supervisor (controles vencidos, certificados, llegadas tarde…). Ahora a un administrador le llega un aviso de esos sólo
-- si tiene un renglón en orden_avisos_admin que lo cubra:
--   local_id null = de cualquier local (y los que no son de un local), si no, sólo de ese local;
--   tipos null    = de todos los tipos, si no, sólo de esos (orden_avisos.tipo).
-- Sin renglón, nada. Quiénes tienen renglón se carga aparte (los datos de las personas no van al repo).
-- Lo de los supervisores no cambia. Tampoco los avisos que le llegan a alguien por algo que hizo él mismo (por ejemplo «Ya
-- grabaron de nuevo el video» a quien lo pidió): ésos no pasan por acá.
--
-- Cambia una sola condición en cada una de las tres funciones que eligen a los administradores: orden_avisar_responsables
-- (casi todos), orden_legajo_avisar_sup_ (certificados y apercibimientos) y pos_tarde_avisar_sup_ (llegadas tarde). Se puede
-- correr dos veces. Deshacer: deshacer-239.sql.

create table if not exists orden_avisos_admin (
  id bigint generated always as identity primary key,
  persona_id uuid not null references orden_personas(id) on delete cascade,
  local_id uuid references orden_locales(id) on delete cascade,
  tipos text[],
  creado_en timestamptz not null default now()
);
comment on table orden_avisos_admin is
  'SQL 239: qué avisos de los "para administradores" le llegan a cada administrador. local_id null = de cualquier local; tipos null = todos. Sin renglón, ninguno.';
alter table orden_avisos_admin enable row level security;
revoke all on table orden_avisos_admin from anon, authenticated;

create or replace function orden_admin_recibe(p_persona uuid, p_local uuid, p_tipo text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from orden_avisos_admin r
                  where r.persona_id = p_persona
                    and (r.local_id is null or r.local_id = p_local)
                    and (r.tipos is null or p_tipo = any (r.tipos)))
$$;
revoke all on function orden_admin_recibe(uuid, uuid, text) from public, anon, authenticated;
grant execute on function orden_admin_recibe(uuid, uuid, text) to service_role;

do $$
declare
  c record; v_def text; v_veces int;
begin
  for c in select * from (values
    ('public.orden_avisar_responsables(uuid,text,text,text,text,text,text,smallint)',
     '(rol = ''admin'' and (p_destino in (''admins'', ''ambos'') or not v_hay_sup))',
     '(rol = ''admin'' and (p_destino in (''admins'', ''ambos'') or not v_hay_sup) and orden_admin_recibe(id, p_local, p_tipo))'),
    ('public.orden_legajo_avisar_sup_(orden_legajo,text,text,text)',
     '(rol = ''admin'' and not v_hay)',
     '(rol = ''admin'' and not v_hay and orden_admin_recibe(id, v.local_id, ''legajo''))'),
    ('public.pos_tarde_avisar_sup_(uuid,uuid,text,text,text)',
     '(rol = ''admin'' and not v_hay)',
     '(rol = ''admin'' and not v_hay and orden_admin_recibe(id, p_local, ''llegadas''))')
  ) t(fn, antes, despues)
  loop
    v_def := pg_get_functiondef(c.fn::regprocedure);
    if position('orden_admin_recibe(' in v_def) > 0 then
      raise notice 'SQL 239: % ya estaba cambiada', c.fn;
      continue;
    end if;
    v_veces := (length(v_def) - length(replace(v_def, c.antes, ''))) / length(c.antes);
    if v_veces <> 1 then
      raise exception 'SQL 239: en % la condición de los administradores está % veces (tiene que estar una). No se cambió nada.', c.fn, v_veces;
    end if;
    execute replace(v_def, c.antes, c.despues);
  end loop;
end $$;
