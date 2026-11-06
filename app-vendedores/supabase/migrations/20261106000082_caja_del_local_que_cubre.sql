-- SQL 254 (6/11/2026): la caja del local que uno cubre.
-- Karen Ramos (su local es San Justo Shopping) también trabaja en San Justo y a veces cierra ahí, pero la app sólo le
-- abría la caja de su local: no podía sacar las fotos del cierre de San Justo. En Equipo VDH cada persona tiene UN local;
-- dónde trabaja además ya lo dice la lista de vendedores de Ventas del mes (ventas_vendedores, con su usuario unido):
-- Karen está en San Justo y en San Justo Shopping. Con esto, quien está en la lista de Ventas de otro local puede cargar
-- la caja de ese local como la gente de ahí (la de hoy y la de ayer, si ese local usa el control de caja):
--   1) orden_cubre_local(local, fecha): ¿quien entró está en la lista de Ventas de ese local (la del mes de esa fecha o,
--      si ese mes todavía no se abrió, la última)? Sólo vendedor o encargado con un local propio que no sea ése.
--      orden_cubre_caja(local, fecha): eso, para la caja de hoy o la de ayer.
--   2) orden_mis_cajas(): para la app, su local y los que cubre con la caja prendida, con la IA y la tolerancia de cada
--      uno (de otro local el vendedor no puede leer orden_config).
--   3) orden_caja_hoy_de(local): la caja de hoy de ese local (la crea si falta, como orden_caja_hoy). orden_caja_hoy()
--      no cambia: la app vieja sigue igual.
--   4) orden_puede_editar_caja: también quien cubre, hoy y ayer (registrar la foto y guardar). Igual que la gente del
--      local: le piden el efectivo contado y lo que escribe a mano queda para revisar.
--   5) orden_caja_preparar_lectura (la lectura de la foto, leer-caja): también quien puede cargar esa caja.
--   6) Ver esa caja (y sus fotos, que cuelgan de ella): una política más en orden_cajas, sólo hoy y ayer.
--   7) Las fotos en el almacenamiento: subir y ver en <local>/cajas/<día> de esa caja, hoy y ayer.
-- Nada más se abre: lo demás del otro local (controles, tareas, el equipo, la config) sigue siendo sólo de su gente.
-- Se puede correr dos veces. Se deshace con deshacer-254.sql (las cajas que cargaron quedan cargadas).
-- Pedido de Mauricio (6/11): "Karen Ramos no puede sacar fotos del cierre de San Justo1, solo la deja del Shopping SJ
-- su app … la vendedora debe estar en otro local y cubra … había que habilitar eso".

-- 1) ¿Cubre ese local? La lista de Ventas del mes de la caja (si el mes todavía no se abrió, la última de antes).
create or replace function public.orden_cubre_local(p_local uuid, p_fecha date default null)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select p_local is not null and exists (
    select 1
      from orden_personas p
      join ventas_vendedores v on v.persona_id = p.id and v.local_id = p_local
     where p.auth_user_id = auth.uid() and p.activo and p.aprobado
       and p.rol in ('vendedor', 'supervisor') and p.local_id is not null and p.local_id <> p_local
       and v.mes = (select max(w.mes) from ventas_vendedores w
                     where w.local_id = p_local
                       and w.mes <= date_trunc('month', coalesce(p_fecha, orden_fecha_local(p_local)))::date))
$function$;
revoke all on function public.orden_cubre_local(uuid, date) from public, anon;
grant execute on function public.orden_cubre_local(uuid, date) to authenticated, service_role;

-- La caja de ese día de un local que cubre: la de hoy o la de ayer. Va en una función (security definer) porque el
-- vendedor no puede leer orden_locales de otro local: orden_dia_caja con sus permisos le daría vacío.
create or replace function public.orden_cubre_caja(p_local uuid, p_fecha date)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(p_fecha >= orden_dia_caja(p_local) - 1, false) and orden_cubre_local(p_local, p_fecha)
$function$;
revoke all on function public.orden_cubre_caja(uuid, date) from public, anon;
grant execute on function public.orden_cubre_caja(uuid, date) to authenticated, service_role;

-- 2) Los locales donde puede cargar la caja: el suyo primero y después los que cubre (con la caja prendida).
create or replace function public.orden_mis_cajas()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'nombre', l.nombre, 'propio', l.id = p.local_id,
           'caja_ia', coalesce(c.caja_ia, true), 'caja_tolerancia_pesos', c.caja_tolerancia_pesos)
         order by (l.id = p.local_id) desc, l.nombre), '[]'::jsonb)
    from orden_personas p
    join orden_locales l on l.id = p.local_id
                         or (l.activo and l.id <> p.local_id and orden_cubre_local(l.id))
    left join orden_config c on c.local_id = l.id
   where p.id = orden_yo_id() and p.local_id is not null and p.rol in ('vendedor', 'supervisor')
     and (l.id = p.local_id or coalesce(c.caja_activa, false))
$function$;
revoke all on function public.orden_mis_cajas() from public, anon;
grant execute on function public.orden_mis_cajas() to authenticated, service_role;

-- 3) La caja de hoy de otro local (la del suyo, la de siempre).
create or replace function public.orden_caja_hoy_de(p_local uuid)
 returns orden_cajas
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_propio uuid; c orden_cajas;
begin
  select local_id into v_propio from orden_personas where id = orden_yo_id();
  if p_local is null or p_local is not distinct from v_propio then return orden_caja_hoy(); end if;
  if not orden_es_supervisor_de(p_local) and not orden_cubre_local(p_local, orden_dia_caja(p_local)) then
    raise exception 'No estás en la lista de vendedores de ese local';
  end if;
  if not coalesce((select caja_activa from orden_config where local_id = p_local), false) and not orden_es_supervisor_de(p_local) then
    raise exception 'El control de caja está apagado en este local.';
  end if;
  insert into orden_cajas (local_id, fecha) values (p_local, orden_dia_caja(p_local))
  on conflict (local_id, fecha) do nothing;
  select * into c from orden_cajas where local_id = p_local and fecha = orden_dia_caja(p_local);
  return c;
end $function$;
revoke all on function public.orden_caja_hoy_de(uuid) from public, anon;
grant execute on function public.orden_caja_hoy_de(uuid) to authenticated, service_role;

-- 4) Quién puede tocar la caja: lo de antes (SQL 243) + quien cubre ese local, hoy y ayer. (create or replace: los
--    permisos quedan.)
create or replace function public.orden_puede_editar_caja(p_local uuid, p_fecha date)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select orden_es_supervisor_de(p_local)
      or (orden_es_del_local(p_local)
          and coalesce((select caja_activa from orden_config where local_id = p_local), false)
          and (p_fecha >= orden_dia_caja(p_local) - 1
               or exists (select 1 from orden_caja_dias_atrasados a
                           where a.local_id = p_local and a.fecha = p_fecha and a.hasta >= orden_dia_caja(p_local))))
      -- (SQL 254) quien cubre ese local (está en su lista de Ventas): hoy y ayer.
      or (coalesce((select caja_activa from orden_config where local_id = p_local), false)
          and orden_cubre_caja(p_local, p_fecha))
$function$;

-- 5) Leer la foto: quien ve el local, o quien puede cargar esa caja (el que cubre).
create or replace function public.orden_caja_preparar_lectura(p_foto uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
declare f orden_caja_fotos; c orden_cajas; l orden_locales;
begin
  select * into f from orden_caja_fotos where id = p_foto;
  if not found then raise exception 'No encontramos esa foto'; end if;
  select * into c from orden_cajas where id = f.caja_id;
  -- (SQL 254) También quien cubre ese local y puede cargar esa caja.
  if not (orden_ve_local(c.local_id) or orden_puede_editar_caja(c.local_id, c.fecha)) then raise exception 'Sin acceso'; end if;
  if not coalesce((select caja_ia from orden_config where local_id = c.local_id), true) then
    raise exception 'La lectura con IA de la caja está apagada en este local (Ajustes → El local → La caja): cargá los números a mano.';
  end if;
  select * into l from orden_locales where id = c.local_id;
  return jsonb_build_object('foto_id', f.id, 'foto_path', f.foto_path, 'tipo', f.tipo,
                            'fecha', c.fecha, 'local', l.nombre);
end $function$;

-- 6) Ver la caja del local que cubre (hoy y ayer). Sus fotos se ven con ella (la política de orden_caja_fotos mira
--    orden_cajas). Va aparte de "ver": las políticas se suman.
drop policy if exists "ver la del local que cubre" on public.orden_cajas;
create policy "ver la del local que cubre" on public.orden_cajas for select to authenticated
  using (orden_cubre_caja(local_id, fecha));

-- 7) Las fotos: <local>/cajas/<día>/… de una caja que puede cargar porque cubre ese local (hoy y ayer). La carpeta se
--    compara como texto (una carpeta que no es un local no rompe nada).
create or replace function public.orden_cubre_carpeta_caja(p_carpeta text, p_dia text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from orden_cajas c
     where c.local_id = case when p_carpeta ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
                             then p_carpeta::uuid end
       and c.fecha::text = p_dia
       and orden_cubre_caja(c.local_id, c.fecha))
$function$;
revoke all on function public.orden_cubre_carpeta_caja(text, text) from public, anon;
grant execute on function public.orden_cubre_carpeta_caja(text, text) to authenticated, service_role;

drop policy if exists "orden: subir fotos de la caja del local que cubre" on storage.objects;
create policy "orden: subir fotos de la caja del local que cubre" on storage.objects for insert to authenticated
  with check (bucket_id = 'orden-fotos' and (storage.foldername(name))[2] = 'cajas'
              and public.orden_cubre_carpeta_caja((storage.foldername(name))[1], (storage.foldername(name))[3]));
drop policy if exists "orden: ver fotos de la caja del local que cubre" on storage.objects;
create policy "orden: ver fotos de la caja del local que cubre" on storage.objects for select to authenticated
  using (bucket_id = 'orden-fotos' and (storage.foldername(name))[2] = 'cajas'
         and public.orden_cubre_carpeta_caja((storage.foldername(name))[1], (storage.foldername(name))[3]));

notify pgrst, 'reload schema';
