-- =====================================================================
-- Módulo VDH · Migración 66 (SQL 221), 31/10/2026: el apercibimiento firmado
-- lo puede subir cualquiera del local.
--
-- Pedido de Mauricio (31/10, noche): "el vendedor puede cargar sus propios
-- apercibimientos. Y también el encargado o cualquier compañero puede cargar
-- un apercibimiento de su otro compañero."
--
-- Hasta acá un apercibimiento lo cargaban sólo el encargado, el supervisor
-- o la administración. Desde esto:
-- - La persona sube el suyo, con la foto del papel firmado (la IA completa
--   la fecha y el motivo). Les llega el aviso a sus supervisores.
-- - Un compañero de su mismo local también lo puede subir, con la foto. Le
--   llega el aviso a la persona (como siempre) y a sus supervisores, que
--   ven quién lo subió.
-- - Sin la foto no se puede: es subir el papel que ya está firmado, no
--   hacer un apercibimiento nuevo (eso lo sigue haciendo la supervisión,
--   con o sin foto). Una ausencia sigue igual: la carga la supervisión, o
--   la persona con su certificado.
--
-- Qué cambia (las cuatro con el mismo nombre y los mismos parámetros, así
-- no quedan funciones repetidas):
-- 1. orden_legajo_cargar: las dos reglas de arriba y sus avisos.
-- 2. orden_legajo_carpeta: el compañero puede subir la foto a la carpeta
--    de alguien de su mismo local (no puede verla después).
-- 3. orden_legajo_con_lectura: quien subió el papel le pega lo que leyó la
--    IA (además de la persona y su supervisor).
-- 4. orden_legajo_avisar_sup_: el aviso de un apercibimiento abre
--    "Apercibimientos" (antes abría siempre "Ausencias").
--
-- No cambia ningún dato. Reversible: deshacer-221.sql (vuelven las cuatro
-- como estaban; los apercibimientos que ya se subieron quedan).
-- =====================================================================

select set_config('lock_timeout', '5s', true);

/** El aviso a quienes supervisan el local de un papel (sin la persona misma, si es la encargada); si nadie de ellos
    entró nunca a la app, a la administración. Como orden_avisar_responsables. Abre la pantalla del tipo de papel. */
create or replace function orden_legajo_avisar_sup_(v orden_legajo, p_titulo text, p_cuerpo text, p_clave text)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare r record; n int := 0; v_hay boolean;
begin
  select exists (select 1 from orden_personas where id in (select orden_supervisores_de(v.local_id))
                   and id <> v.persona_id and aprobado and auth_user_id is not null) into v_hay;
  for r in
    select id from orden_personas
     where activo and id <> v.persona_id
       and (id in (select orden_supervisores_de(v.local_id)) or (rol = 'admin' and not v_hay))
  loop
    if orden_encolar_aviso(r.id, 'legajo', p_titulo, p_cuerpo,
                           case when v.tipo = 'apercibimiento' then '/apercibimientos' else '/ausencias' end,
                           p_clave || ':' || r.id, 2::smallint) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function orden_legajo_avisar_sup_(orden_legajo, text, text, text) from public, anon, authenticated;

/** ¿Quien pregunta puede ver (p_subir false) o subir (true) en esta ruta del bucket legajos? {local}/{persona}/archivo. */
create or replace function orden_legajo_carpeta(p_ruta text, p_subir boolean)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  u constant text := '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
  v_local uuid; v_persona uuid; yo orden_personas;
begin
  if p_ruta is null or p_ruta !~ ('^' || u || '/' || u || '/[^/]+$') then return false; end if;
  v_local := split_part(p_ruta, '/', 1)::uuid;
  v_persona := split_part(p_ruta, '/', 2)::uuid;
  select * into yo from orden_personas where auth_user_id = auth.uid() and activo and aprobado limit 1;
  if not found then return false; end if;
  /* La persona, lo suyo: subir sólo a la carpeta de su local de hoy. */
  if yo.id = v_persona and (not p_subir or yo.local_id = v_local) then return true; end if;
  if p_subir then
    /* (SQL 221) Un compañero sube el apercibimiento firmado de alguien de su mismo local. Verlo, no. */
    if yo.local_id = v_local and exists (select 1 from orden_personas where id = v_persona and local_id = v_local and activo) then
      return true;
    end if;
    return orden_es_supervisor_de(v_local);
  end if;
  return orden_ve_equipo(v_local);
end $$;
revoke all on function orden_legajo_carpeta(text, boolean) from public, anon;
grant execute on function orden_legajo_carpeta(text, boolean) to authenticated;

/**
 * Carga una ausencia o un apercibimiento de alguien del local. Lo hace quien supervisa el local (el encargado, el
 * supervisor de zona, la administración); la gerencia mira. Con fotos, la ausencia arranca en "no se descuenta"
 * (trajo el certificado); sin fotos, "a definir".
 * La persona misma puede anotar SU ausencia mandando el certificado (enfermo en su casa, sin esperar al supervisor):
 * queda "a definir" y les llega el aviso a sus supervisores.
 * (SQL 221) El apercibimiento firmado lo sube también la persona misma o un compañero de su local, siempre con la
 * foto: les llega el aviso a sus supervisores (y a la persona, si lo subió otro).
 */
create or replace function orden_legajo_cargar(p_tipo text, p_persona uuid, p_desde date, p_hasta date default null,
                                               p_motivo text default null, p_fotos text[] default '{}')
returns orden_legajo language plpgsql volatile security definer set search_path = public as $$
declare
  p orden_personas; yo uuid := orden_yo_id(); v orden_legajo; v_otra orden_legajo; v_propia boolean;
  v_companero boolean := false; v_quien orden_personas;
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_motivo text := nullif(left(btrim(regexp_replace(coalesce(p_motivo, ''), '\s+', ' ', 'g')), 300), '');
  v_fotos text[]; v_hasta date := coalesce(p_hasta, p_desde);
begin
  if p_tipo not in ('ausencia', 'apercibimiento') then raise exception 'Elegí si es una ausencia o un apercibimiento.'; end if;
  select * into p from orden_personas where id = p_persona;
  if not found or not p.activo then raise exception 'No encontramos a esa persona.'; end if;
  v_propia := yo is not null and p.id = yo;
  if v_propia then
    if p.local_id is null then raise exception 'Lo tuyo te lo carga tu supervisor o la administración.'; end if;
    if cardinality(coalesce(p_fotos, '{}')) = 0 then
      raise exception '%', case when p_tipo = 'ausencia' then 'Falta la foto del certificado.' else 'Falta la foto del apercibimiento firmado.' end;
    end if;
  elsif yo is not null and p.local_id is not null and orden_es_supervisor_de(p.local_id) then
    null;
  elsif yo is not null and p_tipo = 'apercibimiento' and p.local_id is not null
        and p.local_id = (select local_id from orden_personas where id = yo and activo) then
    v_companero := true;
    if cardinality(coalesce(p_fotos, '{}')) = 0 then raise exception 'Falta la foto del apercibimiento firmado.'; end if;
  else
    raise exception 'No podés cargarle papeles a esta persona: lo hacen su encargado, su supervisor o la administración.';
  end if;
  if p_desde is null then raise exception 'Poné la fecha.'; end if;
  if p_tipo = 'apercibimiento' then v_hasta := p_desde; end if;
  if v_hasta < p_desde then raise exception 'El "hasta" no puede ser antes del "desde".'; end if;
  if p_desde < v_hoy - 120 then raise exception 'Es de hace más de 4 meses: revisá la fecha.'; end if;
  if p_tipo = 'apercibimiento' and p_desde > v_hoy then raise exception 'El apercibimiento no puede tener una fecha que todavía no llegó.'; end if;
  if p_tipo = 'ausencia' and p_desde > v_hoy + 7 then raise exception 'Se anota cuando falta (o, con el certificado, hasta una semana antes).'; end if;
  if v_hasta - p_desde > 60 then raise exception 'Son más de 60 días: revisá las fechas (unas vacaciones van en Config → Usuarios).'; end if;
  if p_tipo = 'apercibimiento' and coalesce(length(v_motivo), 0) < 5 then raise exception 'Escribí el motivo del apercibimiento.'; end if;
  v_fotos := orden_legajo_rutas_(p.id, p_fotos);

  if p_tipo = 'ausencia' then
    select * into v_otra from orden_legajo
     where persona_id = p.id and tipo = 'ausencia' and borrado_en is null and desde <= v_hasta and hasta >= p_desde
     order by desde limit 1;
    if found then
      if v_propia then
        raise exception 'Ya tenés una ausencia anotada %: mandá el certificado ahí.', orden_legajo_dias_(v_otra.desde, v_otra.hasta);
      end if;
      raise exception 'Ya tiene una ausencia anotada %. Si falta un certificado, sumalo ahí.', orden_legajo_dias_(v_otra.desde, v_otra.hasta);
    end if;
  end if;

  insert into orden_legajo (tipo, persona_id, local_id, desde, hasta, motivo, fotos, fotos_en, fotos_de, descuento, cargado_por)
  values (p_tipo, p.id, p.local_id, p_desde, v_hasta, v_motivo, v_fotos,
          case when cardinality(v_fotos) > 0 then now() end, case when cardinality(v_fotos) > 0 then yo end,
          case when p_tipo = 'ausencia' then case when cardinality(v_fotos) > 0 and not v_propia then 'no' else 'a_definir' end end, yo)
  returning * into v;

  if v_propia and p_tipo = 'ausencia' then
    perform orden_legajo_avisar_sup_(v, p.nombre || coalesce(' ' || p.inicial || '.', '') || ' mandó un certificado médico',
      'Ausencia ' || orden_legajo_dias_(v.desde, v.hasta) || '. Mirá la foto y decidí si se descuenta.', 'legajo-cert:' || v.id || ':1');
  elsif v_propia then
    perform orden_legajo_avisar_sup_(v, p.nombre || coalesce(' ' || p.inicial || '.', '') || ' subió su apercibimiento',
      'Apercibimiento ' || orden_legajo_dias_(v.desde, v.hasta) || ': ' || v_motivo || '. Mirá la foto.', 'legajo-aperc:' || v.id);
  elsif p_tipo = 'ausencia' then
    perform orden_encolar_aviso(p.id, 'legajo', 'Se anotó tu ausencia ' || orden_legajo_dias_(v.desde, v.hasta),
      case when cardinality(v_fotos) > 0 then 'Con el certificado médico.'
           else 'Si tenés certificado médico, mandá la foto desde la app: tocá este aviso.' end,
      case when cardinality(v_fotos) > 0 then '/certificados' else '/certificado/' || v.id end,
      'legajo:' || v.id, 2::smallint);
  else
    perform orden_encolar_aviso(p.id, 'legajo', 'Se registró un apercibimiento', v_motivo, '/apercibimientos', 'legajo:' || v.id, 2::smallint);
    if v_companero then
      select * into v_quien from orden_personas where id = yo;
      perform orden_legajo_avisar_sup_(v, v_quien.nombre || coalesce(' ' || v_quien.inicial || '.', '') || ' subió un apercibimiento de '
          || p.nombre || coalesce(' ' || p.inicial || '.', ''),
        'Apercibimiento ' || orden_legajo_dias_(v.desde, v.hasta) || ': ' || v_motivo || '. Mirá la foto.', 'legajo-aperc:' || v.id);
    end if;
  end if;
  return v;
end $$;
revoke all on function orden_legajo_cargar(text, uuid, date, date, text, text[]) from public, anon;
grant execute on function orden_legajo_cargar(text, uuid, date, date, text, text[]) to authenticated;

/**
 * Pega una lectura de la IA a un papel: la pide quien hizo leer la hoja (hasta un día después), y tiene que ser la
 * persona del papel, quien lo subió (SQL 221: el compañero que subió el apercibimiento) o quien supervisa su local.
 * Si el papel no tenía motivo, queda el que leyó la IA.
 */
create or replace function orden_legajo_con_lectura(p_id uuid, p_lectura uuid)
returns orden_legajo language plpgsql volatile security definer set search_path = public as $$
declare v orden_legajo; l orden_legajo_lecturas; yo uuid := orden_yo_id();
begin
  if yo is null then raise exception 'Entrá de nuevo a la app.'; end if;
  select * into l from orden_legajo_lecturas
   where id = p_lectura and pedido_por = yo and lectura is not null and error is null
     and (legajo_id is null or legajo_id = p_id) and creado_en > now() - interval '1 day'
   for update;
  if not found then raise exception 'Esa lectura ya no sirve: leé la hoja de nuevo.'; end if;
  select * into v from orden_legajo where id = p_id and borrado_en is null for update;
  if not found then raise exception 'Ese papel ya no está.'; end if;
  if v.tipo <> l.tipo then raise exception 'La lectura es de otro tipo de papel.'; end if;
  if not (v.persona_id = yo or v.cargado_por = yo or (v.local_id is not null and orden_es_supervisor_de(v.local_id))) then
    raise exception 'No podés cambiar este papel.';
  end if;
  update orden_legajo
     set ia_lectura = l.lectura || jsonb_build_object('leido_en', l.creado_en, 'modelo', l.modelo),
         motivo = coalesce(motivo, nullif(left(btrim(regexp_replace(coalesce(l.lectura ->> 'motivo', ''), '\s+', ' ', 'g')), 300), ''))
   where id = v.id
  returning * into v;
  update orden_legajo_lecturas set legajo_id = v.id where id = l.id;
  return v;
end $$;
revoke all on function orden_legajo_con_lectura(uuid, uuid) from public, anon;
grant execute on function orden_legajo_con_lectura(uuid, uuid) to authenticated;
