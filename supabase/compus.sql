/* ══════════════════════════════════════════════════════════════════════════
   SQL 235 (3/11/2026) — LAS COMPUS QUE USAN EL SISTEMA: EL MODO AVISO
   ══════════════════════════════════════════════════════════════════════════
   Mauricio, 3/11: "no quiero que nadie use el enlace fuera de los locales;
   sólo los supervisores, con sus compus y sus notebooks: me van a pedir
   autorización y los autorizo". El plan tiene tres pasos:
     1. MODO AVISO (este SQL): cada vez que alguien entra, se anota desde qué
        aparato y si ese aparato trae la llave de un local (la del enlace de
        Config → General → Las compus de los locales). No traba nada.
     2. El pedido: una compu sin llave le pide permiso a Mauricio, y él la
        aprueba o la rechaza desde Config.
     3. La traba: sin llave ni aprobación, el sistema no abre.

   Cada aparato guarda un código al azar (nc_aparato, en el navegador). En la
   base va cifrado, como la llave de las compus: quien lea la tabla no puede
   hacerse pasar por ese aparato.

   Sin claves foráneas a propósito: así correrlo no frena a club_cajas ni a
   orden_personas mientras los locales trabajan. Es sólo un registro.

   Se deshace con deshacer-235.sql (borra estas dos tablas y las dos
   funciones; no toca nada más). */

do $$ begin
  if to_regclass('public.nc_compus') is not null then
    raise exception 'El SQL 235 ya está corrido (la tabla nc_compus ya existe).';
  end if;
end $$;

/* Un renglón por aparato. */
create table nc_compus (
  id            bigint generated always as identity primary key,
  aparato_hash  text not null unique,             -- el código del aparato, cifrado
  tipo          text,                             -- 'Compu Windows', 'Celular Android'…
  tactil        boolean not null default false,   -- celular o tablet (sin mouse)
  caja_id       bigint,                           -- la compu del local cuya llave trajo la última vez (null: sin llave)
  llave_mala    boolean not null default false,   -- trajo una llave que la base no reconoce (deshabilitada o vieja)
  primera       timestamptz not null default now(),
  ultima        timestamptz not null default now(),
  ultima_ip     text                              -- la conexión a internet de la última vez
);

/* Quién entró en cada aparato, un renglón por persona y por día. */
create table nc_compu_usos (
  compu_id    bigint not null,
  persona_id  uuid not null,
  dia         date not null,                      -- el día de Argentina
  caja_id     bigint,
  ip          text,
  pagina      text,
  primera     timestamptz not null default now(),
  ultima      timestamptz not null default now(),
  veces       int not null default 1,
  primary key (compu_id, persona_id, dia)
);
create index nc_compu_usos_dia on nc_compu_usos (dia);
create index nc_compu_usos_ip on nc_compu_usos (ip) where caja_id is not null;

alter table nc_compus enable row level security;
alter table nc_compu_usos enable row level security;
-- Sin políticas: nadie las lee ni las escribe desde afuera. Lo hacen las dos funciones.
revoke all on nc_compus, nc_compu_usos from anon, authenticated;

/* Lo llama persona.js una vez por ventana y por día, cuando la base ya dijo
   quién entró. Sin sesión no anota nada (así nadie de afuera llena la tabla). */
create or replace function nc_compu_anotar(p_aparato text, p_llave text default null, p_tipo text default null,
                                           p_tactil boolean default false, p_pagina text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $ca$
declare
  v_yo   uuid := orden_yo_id();
  v_ip   text := left(club_origen(), 64);
  v_dia  date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_caja club_cajas%rowtype;
  v_mala boolean := false;
  v_id   bigint;
begin
  if v_yo is null then return jsonb_build_object('ok', false, 'porque', 'Sin sesión.'); end if;
  if coalesce(p_aparato, '') !~ '^[A-Za-z0-9_-]{20,80}$' then
    return jsonb_build_object('ok', false, 'porque', 'El código del aparato no sirve.');
  end if;

  if coalesce(p_llave, '') like 'caja\_%' then
    select * into v_caja from club_cajas where llave_hash = club_caja_hash(p_llave) and baja is null;
    if not found then
      v_mala := true;
    elsif v_caja.ultimo_uso is null or v_caja.ultimo_uso < now() - interval '1 hour' then
      -- Como club_caja_local: así Config dice bien cuándo se usó por última vez.
      update club_cajas set ultimo_uso = now() where id = v_caja.id;
    end if;
  end if;

  insert into nc_compus (aparato_hash, tipo, tactil, caja_id, llave_mala, ultima_ip)
  values (club_caja_hash(p_aparato), left(nullif(trim(coalesce(p_tipo, '')), ''), 40), coalesce(p_tactil, false), v_caja.id, v_mala, v_ip)
  on conflict (aparato_hash) do update
     set ultima = now(),
         tipo = coalesce(excluded.tipo, nc_compus.tipo),
         tactil = excluded.tactil,
         caja_id = excluded.caja_id,
         llave_mala = excluded.llave_mala,
         ultima_ip = excluded.ultima_ip
  returning id into v_id;

  insert into nc_compu_usos (compu_id, persona_id, dia, caja_id, ip, pagina)
  values (v_id, v_yo, v_dia, v_caja.id, v_ip, left(p_pagina, 40))
  on conflict (compu_id, persona_id, dia) do update
     set ultima = now(),
         veces = nc_compu_usos.veces + 1,
         caja_id = excluded.caja_id,
         ip = excluded.ip,
         pagina = excluded.pagina;

  return jsonb_build_object('ok', true, 'llave', v_caja.id is not null, 'llave_mala', v_mala);
end;
$ca$;

/* La lista para Config → General → Las compus de los locales: cada aparato
   usado en los últimos p_dias días, con quién entró, si tiene la llave de un
   local y si su internet es la de algún local. Sólo para Administración.
   p_aparato: el código de ESTE aparato, para marcarlo ("Esta compu"). */
create or replace function nc_compus_listar(p_dias int default 14, p_aparato text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $cl$
declare
  v_desde date := (now() at time zone 'America/Argentina/Buenos_Aires')::date - greatest(least(coalesce(p_dias, 14), 90), 1) + 1;
  v_mio   text := case when coalesce(p_aparato, '') ~ '^[A-Za-z0-9_-]{20,80}$' then club_caja_hash(p_aparato) end;
begin
  if not orden_es_admin() then
    raise exception 'La lista de las compus es de Administración.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'desde', v_desde,
    'compus', coalesce((
      select jsonb_agg(x.fila order by x.sin_llave desc, x.ultima desc)
        from (
          select (c.caja_id is null) as sin_llave, c.ultima,
                 jsonb_build_object(
                   'id', c.id,
                   'tipo', c.tipo,
                   'tactil', c.tactil,
                   'local', k.local,                       -- el código del local de su llave (null: sin llave)
                   'caja', c.caja_id,
                   'llave_mala', c.llave_mala,
                   'esta', c.aparato_hash = v_mio,
                   'primera', c.primera,
                   'ultima', c.ultima,
                   /* Los locales cuya compu (con la llave) usó esta misma internet en los últimos 30 días. */
                   'internet', coalesce((
                     select jsonb_agg(distinct kk.local)
                       from nc_compu_usos u2 join club_cajas kk on kk.id = u2.caja_id
                      where c.ultima_ip is not null and u2.ip = c.ultima_ip
                        and u2.dia >= v_desde - 16), '[]'::jsonb),
                   'personas', coalesce((
                     select jsonb_agg(jsonb_build_object(
                              'nombre', orden_nombre_lista(p.nombre, p.inicial),
                              'rol', p.rol,
                              'ultima', s.ultima,
                              'dias', s.dias,
                              'veces', s.veces) order by s.ultima desc)
                       from (select u.persona_id, max(u.ultima) ultima, count(*) dias, sum(u.veces) veces
                               from nc_compu_usos u
                              where u.compu_id = c.id and u.dia >= v_desde
                              group by u.persona_id) s
                       join orden_personas p on p.id = s.persona_id), '[]'::jsonb)
                 ) as fila
            from nc_compus c
            left join club_cajas k on k.id = c.caja_id
           where c.ultima >= v_desde
        ) x), '[]'::jsonb));
end;
$cl$;

revoke all on function nc_compu_anotar(text, text, text, boolean, text) from public;
revoke all on function nc_compus_listar(int, text) from public;
grant execute on function nc_compu_anotar(text, text, text, boolean, text) to anon, authenticated;
grant execute on function nc_compus_listar(int, text) to authenticated;


/* ══════════════════════════════════════════════════════════════════════════
   SQL 283 (12/11/2026) — CÓMO ABRE EL SISTEMA CADA COMPU: INSTALADO O DESDE
   EL NAVEGADOR
   ══════════════════════════════════════════════════════════════════════════
   Mauricio, 12/11: les explicó a los locales cómo instalar el sistema con la
   flechita de Chrome, y quiere saber cuál lo instaló de verdad. Además, desde
   la no-compra-v485 cada compu le pide al navegador que no borre por su
   cuenta lo que tiene guardado (las ventas sin internet y la llave del local).

   Qué suma, encima del SQL 235 (el modo aviso):
     - En nc_compus, tres datos de cada aparato:
         instalado         la última vez lo abrieron instalado (true) o en una
                           pestaña del navegador (false)
         instalado_ultima  la última vez que lo abrieron instalado
         guardado_fijo     si el navegador concedió que lo guardado no se
                           borre solo
       Quedan vacíos hasta que ese aparato vuelva a entrar.
     - nc_compu_anotar recibe esos datos (p_instalado, p_fijo). Una ventana
       que quedó abierta con la versión vieja no los manda: no se pisa lo que
       ya se sabía.
     - nc_compus_listar los devuelve para Config → General → Las compus de los
       locales → «Desde qué compu entra cada uno».

   No cambia ningún dato que ya esté ni traba nada. Sin este SQL la pantalla
   anda igual (anota como antes y avisa que falta correrlo).
   Se deshace con deshacer-283.sql (saca las tres columnas y deja las dos
   funciones como las dejó el 235). */

do $$ begin
  if to_regclass('public.nc_compus') is null then
    raise exception 'Falta correr antes el SQL 235 (la tabla nc_compus no existe).';
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'nc_compus' and column_name = 'instalado') then
    raise exception 'El SQL 283 ya está corrido (nc_compus ya tiene la columna instalado).';
  end if;
end $$;

alter table nc_compus
  add column instalado        boolean,       -- la última vez: instalado (true) o desde el navegador (false); null: todavía no se sabe
  add column instalado_ultima timestamptz,   -- la última vez que lo abrieron instalado
  add column guardado_fijo    boolean;       -- el navegador concedió que lo guardado no se borre solo; null: no se sabe

/* La de antes tenía cinco datos: con dos más es otra función, y las dos juntas
   confunden a la base. Se va la vieja y queda la nueva, que también acepta el
   pedido de cinco datos (los dos nuevos tienen valor por omisión). */
drop function nc_compu_anotar(text, text, text, boolean, text);

create function nc_compu_anotar(p_aparato text, p_llave text default null, p_tipo text default null,
                                p_tactil boolean default false, p_pagina text default null,
                                p_instalado boolean default null, p_fijo boolean default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $ca$
declare
  v_yo   uuid := orden_yo_id();
  v_ip   text := left(club_origen(), 64);
  v_dia  date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_caja club_cajas%rowtype;
  v_mala boolean := false;
  v_id   bigint;
begin
  if v_yo is null then return jsonb_build_object('ok', false, 'porque', 'Sin sesión.'); end if;
  if coalesce(p_aparato, '') !~ '^[A-Za-z0-9_-]{20,80}$' then
    return jsonb_build_object('ok', false, 'porque', 'El código del aparato no sirve.');
  end if;

  if coalesce(p_llave, '') like 'caja\_%' then
    select * into v_caja from club_cajas where llave_hash = club_caja_hash(p_llave) and baja is null;
    if not found then
      v_mala := true;
    elsif v_caja.ultimo_uso is null or v_caja.ultimo_uso < now() - interval '1 hour' then
      -- Como club_caja_local: así Config dice bien cuándo se usó por última vez.
      update club_cajas set ultimo_uso = now() where id = v_caja.id;
    end if;
  end if;

  insert into nc_compus (aparato_hash, tipo, tactil, caja_id, llave_mala, ultima_ip, instalado, instalado_ultima, guardado_fijo)
  values (club_caja_hash(p_aparato), left(nullif(trim(coalesce(p_tipo, '')), ''), 40), coalesce(p_tactil, false), v_caja.id, v_mala, v_ip,
          p_instalado, case when p_instalado then now() end, p_fijo)
  on conflict (aparato_hash) do update
     set ultima = now(),
         tipo = coalesce(excluded.tipo, nc_compus.tipo),
         tactil = excluded.tactil,
         caja_id = excluded.caja_id,
         llave_mala = excluded.llave_mala,
         ultima_ip = excluded.ultima_ip,
         -- Lo que no vino (una ventana con la versión vieja) no pisa lo que ya se sabía.
         instalado = coalesce(excluded.instalado, nc_compus.instalado),
         instalado_ultima = coalesce(excluded.instalado_ultima, nc_compus.instalado_ultima),
         guardado_fijo = coalesce(excluded.guardado_fijo, nc_compus.guardado_fijo)
  returning id into v_id;

  insert into nc_compu_usos (compu_id, persona_id, dia, caja_id, ip, pagina)
  values (v_id, v_yo, v_dia, v_caja.id, v_ip, left(p_pagina, 40))
  on conflict (compu_id, persona_id, dia) do update
     set ultima = now(),
         veces = nc_compu_usos.veces + 1,
         caja_id = excluded.caja_id,
         ip = excluded.ip,
         pagina = excluded.pagina;

  return jsonb_build_object('ok', true, 'llave', v_caja.id is not null, 'llave_mala', v_mala);
end;
$ca$;

/* La misma lista del 235, con los tres datos nuevos de cada aparato. */
create or replace function nc_compus_listar(p_dias int default 14, p_aparato text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $cl$
declare
  v_desde date := (now() at time zone 'America/Argentina/Buenos_Aires')::date - greatest(least(coalesce(p_dias, 14), 90), 1) + 1;
  v_mio   text := case when coalesce(p_aparato, '') ~ '^[A-Za-z0-9_-]{20,80}$' then club_caja_hash(p_aparato) end;
begin
  if not orden_es_admin() then
    raise exception 'La lista de las compus es de Administración.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'desde', v_desde,
    'compus', coalesce((
      select jsonb_agg(x.fila order by x.sin_llave desc, x.ultima desc)
        from (
          select (c.caja_id is null) as sin_llave, c.ultima,
                 jsonb_build_object(
                   'id', c.id,
                   'tipo', c.tipo,
                   'tactil', c.tactil,
                   'local', k.local,                       -- el código del local de su llave (null: sin llave)
                   'caja', c.caja_id,
                   'llave_mala', c.llave_mala,
                   'esta', c.aparato_hash = v_mio,
                   'primera', c.primera,
                   'ultima', c.ultima,
                   'instalado', c.instalado,               -- SQL 283: instalado (true) o desde el navegador (false)
                   'instalado_ultima', c.instalado_ultima,
                   'fijo', c.guardado_fijo,
                   /* Los locales cuya compu (con la llave) usó esta misma internet en los últimos 30 días. */
                   'internet', coalesce((
                     select jsonb_agg(distinct kk.local)
                       from nc_compu_usos u2 join club_cajas kk on kk.id = u2.caja_id
                      where c.ultima_ip is not null and u2.ip = c.ultima_ip
                        and u2.dia >= v_desde - 16), '[]'::jsonb),
                   'personas', coalesce((
                     select jsonb_agg(jsonb_build_object(
                              'nombre', orden_nombre_lista(p.nombre, p.inicial),
                              'rol', p.rol,
                              'ultima', s.ultima,
                              'dias', s.dias,
                              'veces', s.veces) order by s.ultima desc)
                       from (select u.persona_id, max(u.ultima) ultima, count(*) dias, sum(u.veces) veces
                               from nc_compu_usos u
                              where u.compu_id = c.id and u.dia >= v_desde
                              group by u.persona_id) s
                       join orden_personas p on p.id = s.persona_id), '[]'::jsonb)
                 ) as fila
            from nc_compus c
            left join club_cajas k on k.id = c.caja_id
           where c.ultima >= v_desde
        ) x), '[]'::jsonb));
end;
$cl$;

revoke all on function nc_compu_anotar(text, text, text, boolean, text, boolean, boolean) from public;
revoke all on function nc_compus_listar(int, text) from public;
grant execute on function nc_compu_anotar(text, text, text, boolean, text, boolean, boolean) to anon, authenticated;
grant execute on function nc_compus_listar(int, text) to authenticated;

notify pgrst, 'reload schema';
