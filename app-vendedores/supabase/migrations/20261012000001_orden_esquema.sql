-- =====================================================================
-- Módulo VDH · Control de orden de los locales
-- Migración 1: tablas, funciones, seguridad (RLS) y vistas
--
-- Pensado para el MISMO Supabase del sistema No Compra (Postgres 15+).
-- Todas las tablas llevan prefijo orden_ (y testigo_ para productos
-- testigo) para no chocar con lo que ya existe.
--
-- Si No Compra ya tiene tablas de locales o de usuarios, ver la guía
-- (README_PARA_CLAUDE_CODE.md, sección "Integración con lo que ya hay").
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type orden_rol            as enum ('vendedor', 'supervisor', 'admin', 'gerencia'); -- gerencia: ve todo, no cambia nada
-- El orden importa: de peor a mejor. Permite comparar niveles con < y >.
create type orden_nivel          as enum ('fuera_de_estandar', 'a_mejorar', 'bien', 'impecable');
create type orden_sector_tipo    as enum ('salon', 'deposito');
create type orden_control_tipo   as enum ('programado', 'sorpresa', 'deposito', 'correccion');
create type orden_control_estado as enum ('pendiente', 'enviado', 'revisado', 'vencido');
create type orden_tarea_origen   as enum ('ia', 'supervisor', 'admin', 'sistema');
create type orden_tarea_estado   as enum ('pendiente', 'hecha', 'no_pude', 'vencida', 'cancelada');
create type orden_plazo          as enum ('hoy', 'manana', 'semana');
create type orden_prorroga_estado as enum ('pedida', 'aprobada', 'rechazada');
create type orden_falta_tipo     as enum ('advertencia', 'apercibimiento', 'suspension');
create type orden_falta_estado   as enum ('sugerida', 'confirmada', 'descartada');
create type orden_aviso_estado   as enum ('pendiente', 'enviado', 'omitido', 'error');

-- ---------------------------------------------------------------------
-- Estructura: locales, personas, sectores, exhibidores, módulos
-- ---------------------------------------------------------------------
create table orden_locales (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null unique,
  -- El mismo local en No Compra (tabla locales). Si allá lo renombran, acá se actualiza solo.
  codigo         text unique references locales(codigo) on update cascade,
  zona_horaria   text not null default 'America/Argentina/Buenos_Aires',
  -- Días que abre el local. ISO: 1 = lunes ... 7 = domingo.
  dias_abiertos  smallint[] not null default '{1,2,3,4,5,6}',
  hora_apertura  time not null default '10:00',
  hora_cierre    time not null default '20:00',
  activo         boolean not null default true,
  creado_en      timestamptz not null default now()
);

create table orden_personas (
  id               uuid primary key default gen_random_uuid(),
  local_id         uuid references orden_locales(id) on delete set null, -- null = admin de todos los locales
  nombre           text not null,
  inicial          text,                              -- del apellido, para la lista del login ("Lautaro G.")
  equipo_id        bigint references equipo(id) on delete set null, -- el mismo vendedor en la Carga de No Compra
  rol              orden_rol not null default 'vendedor',
  auth_user_id     uuid unique references auth.users(id) on delete set null,
  dias_libres      smallint[] not null default '{}',  -- franco fijo semanal (ISO 1..7)
  telegram_chat_id text,                              -- para supervisores y admins
  foto_perfil      text,                              -- la cambia cada uno desde su perfil
  activo           boolean not null default true,
  creado_en        timestamptz not null default now()
);
create index on orden_personas (local_id);

-- Vacaciones, licencias o francos sueltos. Mientras dure, la persona no recibe controles.
create table orden_ausencias (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references orden_personas(id) on delete cascade,
  desde       date not null,
  hasta       date not null,
  motivo      text,
  check (hasta >= desde)
);
create index on orden_ausencias (persona_id, desde, hasta);

create table orden_sectores (
  id              uuid primary key default gen_random_uuid(),
  local_id        uuid not null references orden_locales(id) on delete cascade,
  tipo            orden_sector_tipo not null,
  numero          smallint not null,
  nombre          text,
  responsable_id  uuid references orden_personas(id) on delete set null,
  suplente_id     uuid references orden_personas(id) on delete set null, -- quien lo cubre si el responsable no está (ej. el franquero)
  activo          boolean not null default true,
  unique (local_id, tipo, numero)
);

-- Tipos de exhibidor con la cantidad ideal de prendas (ni muy lleno ni muy vacío).
create table orden_exhibidores (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null unique,          -- ej. "Perchero de pared", "Mesa", "Módulo con estantes"
  prendas_min  smallint,
  prendas_max  smallint,
  notas        text,
  check (prendas_min is null or prendas_max is null or prendas_max >= prendas_min)
);

create table orden_modulos (
  id                    uuid primary key default gen_random_uuid(),
  sector_id             uuid not null references orden_sectores(id) on delete cascade,
  numero                smallint not null,
  nombre                text not null,
  exhibidor_id          uuid references orden_exhibidores(id) on delete set null,
  foto_referencia_path  text,   -- foto de cómo tiene que verse (bucket orden-fotos)
  reglas_extra          text,   -- algo propio de este módulo, en texto libre
  activo                boolean not null default true,
  unique (sector_id, numero)
);

-- ---------------------------------------------------------------------
-- Reglas de orden (editables desde No Compra, la IA las lee en cada foto)
-- ---------------------------------------------------------------------
create table orden_reglas (
  id           uuid primary key default gen_random_uuid(),
  local_id     uuid references orden_locales(id) on delete cascade, -- null = todos los locales
  sector_tipo  orden_sector_tipo,                                   -- null = salón y depósito
  check_clave  text not null,  -- a qué punto pertenece: dobladas, frontales, etiquetas, limpieza, exhibicion, rotulado, talles
  texto        text not null,
  activo       boolean not null default true,
  orden        smallint not null default 0
);

-- Regla de colores: el orden del degradé, del más claro al más oscuro.
create table orden_colores (
  id      uuid primary key default gen_random_uuid(),
  orden   smallint not null,
  nombre  text not null,
  hex     text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  activo  boolean not null default true
);

-- ---------------------------------------------------------------------
-- Configuración por local (lo que se toca desde No Compra)
-- ---------------------------------------------------------------------
create table orden_config (
  local_id                     uuid primary key references orden_locales(id) on delete cascade,
  dias_control                 smallint[] not null default '{2,5}', -- mar y vie: control de todos los módulos
  hora_aviso_1                 time not null default '10:30',       -- aviso de la mañana
  hora_aviso_2                 time not null default '16:00',       -- recordatorio de la tarde
  hora_limite                  time not null default '18:00',       -- vencen controles y tareas "de hoy"
  sorpresas_por_semana         smallint not null default 1,         -- por sector de salón
  deposito_dia_vence           smallint not null default 5,         -- el control semanal del depósito vence el viernes
  cambio_imagen_dia            smallint default 4,                  -- jueves; null = apagado
  cambio_imagen_cada_semanas   smallint not null default 1,
  ia_activa                    boolean not null default true,
  ia_crea_tareas               boolean not null default true,
  ia_sugerencias               boolean not null default false,      -- primera etapa: solo cosas puntuales a corregir
  plazo_tarea_default          orden_plazo not null default 'manana',
  max_avisos_dia               smallint not null default 4,         -- tope de avisos "normales" por persona y día
  modo_prueba                  boolean not null default true,       -- en prueba no se sugieren faltas
  ventana_faltas_dias          smallint not null default 30,
  umbral_tareas_vencidas       smallint not null default 3,         -- días con tareas fuera de plazo
  umbral_dias_sin_control      smallint not null default 3,         -- días con controles sin mandar a tiempo
  umbral_fuera_estandar        smallint not null default 2,         -- días con algún control "Fuera de estándar"
  ventana_escalera_dias        smallint not null default 90,
  apercibimientos_para_suspension smallint not null default 2,
  horas_revision_supervisor    smallint not null default 24,
  desafio_activo               boolean not null default false,      -- se prende desde No Compra cuando arranque
  desafio_preguntas            smallint not null default 5,
  desafio_categorias           text[] not null default '{producto,retail}', -- se alternan semana a semana
  actualizado_en               timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Controles (un pedido de foto de un módulo) y fotos (cada intento)
-- ---------------------------------------------------------------------
create table orden_controles (
  id                     uuid primary key default gen_random_uuid(),
  local_id               uuid not null references orden_locales(id) on delete cascade,
  modulo_id              uuid not null references orden_modulos(id) on delete cascade,
  persona_id             uuid references orden_personas(id) on delete set null,
  fecha                  date not null,
  tipo                   orden_control_tipo not null,
  estado                 orden_control_estado not null default 'pendiente',
  vence_en               timestamptz not null,
  ultimo_intento_id      uuid,
  respuestas             jsonb,             -- las 4 preguntas de "Antes de enviar": {clave: true/false}
  nivel_declarado        orden_nivel,       -- sale de las respuestas
  nivel_ia               orden_nivel,       -- lo que sugirió la IA en la última foto
  discrepancia           boolean not null default false, -- lo declarado no coincide con lo que vio la IA
  enviado_en             timestamptz,
  enviado_con_problemas  boolean not null default false,
  nivel_final            orden_nivel,       -- lo que confirma el supervisor
  revisado_por           uuid references orden_personas(id) on delete set null,
  revisado_en            timestamptz,
  comentario             text,
  creado_en              timestamptz not null default now()
);
-- Un control de cada tipo por módulo y día (las correcciones pueden ser varias)
create unique index orden_controles_unico on orden_controles (modulo_id, fecha, tipo) where tipo <> 'correccion';
create index on orden_controles (persona_id, estado);
create index on orden_controles (local_id, estado, vence_en);

create table orden_fotos (
  id            uuid primary key default gen_random_uuid(),
  control_id    uuid not null references orden_controles(id) on delete cascade,
  persona_id    uuid references orden_personas(id) on delete set null,
  foto_path     text not null,
  tomada_en     timestamptz not null default now(),
  ia_estado     text not null default 'pendiente' check (ia_estado in ('pendiente', 'ok', 'invalida', 'error', 'omitida')),
  ia_resultado  jsonb,
  ia_nivel      orden_nivel,
  ia_modelo     text,
  ia_error      text,
  analizada_en  timestamptz
);
create index on orden_fotos (control_id);

alter table orden_controles
  add constraint orden_controles_ultimo_intento_fk
  foreign key (ultimo_intento_id) references orden_fotos(id) on delete set null;

-- ---------------------------------------------------------------------
-- Tareas
-- ---------------------------------------------------------------------
create table orden_tareas (
  id                       uuid primary key default gen_random_uuid(),
  local_id                 uuid not null references orden_locales(id) on delete cascade,
  persona_id               uuid references orden_personas(id) on delete set null,
  modulo_id                uuid references orden_modulos(id) on delete set null,
  control_id               uuid references orden_controles(id) on delete set null,
  foto_origen_id           uuid references orden_fotos(id) on delete set null, -- la foto donde la IA lo detectó
  origen                   orden_tarea_origen not null,
  titulo                   text not null,
  detalle                  text,
  requiere_foto            boolean not null default false,
  estado                   orden_tarea_estado not null default 'pendiente',
  plazo                    orden_plazo not null,
  vence_en                 timestamptz not null,
  vence_original           timestamptz,  -- si se aprobó una prórroga, el vencimiento anterior
  completada_en            timestamptz,
  completada_a_tiempo      boolean,
  foto_path                text,
  motivo_no_pude           text,
  prorroga_estado          orden_prorroga_estado,
  prorroga_motivo          text,
  prorroga_pedida_en       timestamptz,
  prorroga_respondida_por  uuid references orden_personas(id) on delete set null,
  creada_por               uuid references orden_personas(id) on delete set null,
  clave                    text,  -- evita duplicados (ej. la IA no repite la misma tarea abierta)
  creado_en                timestamptz not null default now()
);
create unique index orden_tareas_clave_abierta on orden_tareas (persona_id, clave)
  where estado = 'pendiente' and clave is not null;
create index on orden_tareas (persona_id, estado);
create index on orden_tareas (local_id, estado, vence_en);

-- ---------------------------------------------------------------------
-- Avisos (notificaciones) y suscripciones push
-- ---------------------------------------------------------------------
create table orden_avisos (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references orden_personas(id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  cuerpo      text,
  url         text,              -- pantalla de la app que abre al tocar
  prioridad   smallint not null default 1, -- 1 normal (cuenta para el tope diario), 2 importante
  canal       text[] not null default '{push}',
  clave       text unique,       -- evita mandar dos veces lo mismo
  estado      orden_aviso_estado not null default 'pendiente',
  error       text,
  creado_en   timestamptz not null default now(),
  enviado_en  timestamptz,
  leido_en    timestamptz
);
create index on orden_avisos (persona_id, creado_en desc);
create index on orden_avisos (estado) where estado = 'pendiente';

create table orden_push_subs (
  id          uuid primary key default gen_random_uuid(),
  persona_id  uuid not null references orden_personas(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  creado_en   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Faltas (advertencia → apercibimiento → suspensión)
-- El sistema solo SUGIERE. Siempre decide una persona.
-- ---------------------------------------------------------------------
create table orden_faltas (
  id            uuid primary key default gen_random_uuid(),
  local_id      uuid references orden_locales(id) on delete set null,
  persona_id    uuid not null references orden_personas(id) on delete cascade,
  tipo          orden_falta_tipo not null,
  estado        orden_falta_estado not null default 'sugerida',
  motivo        text not null,
  evidencia     jsonb not null default '{}',
  decidida_por  uuid references orden_personas(id) on delete set null,
  decidida_en   timestamptz,
  nota          text,
  descargo      text,           -- lo que responde el vendedor
  descargo_en   timestamptz,
  creado_en     timestamptz not null default now()
);
create index on orden_faltas (persona_id, creado_en desc);

-- ---------------------------------------------------------------------
-- Tableros de ideas (Pinterest)
-- ---------------------------------------------------------------------
create table orden_tableros (
  id         uuid primary key default gen_random_uuid(),
  local_id   uuid references orden_locales(id) on delete cascade, -- null = todos los locales
  titulo     text not null,
  url        text not null,
  destacado  boolean not null default false,  -- ej. "Frontales de la semana"
  orden      smallint not null default 0,
  activo     boolean not null default true
);

-- ---------------------------------------------------------------------
-- Desafío semanal de telas y molderías
-- Banco de preguntas (lo carga el admin) + un intento por vendedor y semana.
-- Los vendedores NO leen el banco directo (tiene las respuestas):
-- juegan solo a través de orden_desafio_mio y orden_desafio_responder.
-- ---------------------------------------------------------------------
create table orden_preguntas (
  id           uuid primary key default gen_random_uuid(),
  tema         text not null check (tema in ('tela', 'molderia', 'retail')),
  dificultad   smallint not null default 1 check (dificultad between 1 and 3),
  fuente       text,                 -- de qué manual sale (para actualizarla si cambia)
  pregunta     text not null,
  imagen_path  text,                 -- foto de la tela o de la prenda (bucket orden-fotos)
  opciones     text[] not null check (array_length(opciones, 1) between 2 and 4),
  correcta     smallint not null,    -- posición de la opción correcta (1..4)
  explicacion  text,                 -- se muestra después de responder: así aprenden
  activo       boolean not null default true,
  creado_en    timestamptz not null default now(),
  check (correcta between 1 and array_length(opciones, 1))
);

create table orden_desafios (
  id            uuid primary key default gen_random_uuid(),
  local_id      uuid not null references orden_locales(id) on delete cascade,
  persona_id    uuid not null references orden_personas(id) on delete cascade,
  semana        date not null check (extract(isodow from semana) = 1),
  categoria     text not null check (categoria in ('producto', 'retail')), -- producto = telas y molderías
  dificultad    smallint not null default 1,
  preguntas     uuid[] not null,
  respuestas    jsonb not null default '{}',  -- {pregunta_id: opción elegida}
  puntaje       smallint not null default 0,  -- respuestas correctas
  total         smallint not null,
  vence_en      timestamptz not null,
  terminado_en  timestamptz,
  creado_en     timestamptz not null default now(),
  unique (persona_id, semana)
);

-- ---------------------------------------------------------------------
-- Productos testigo (sección de No Compra, la carga el encargado)
-- ---------------------------------------------------------------------
create table testigo_semanas (
  id           uuid primary key default gen_random_uuid(),
  local_id     uuid not null references orden_locales(id) on delete cascade,
  semana       date not null check (extract(isodow from semana) = 1), -- lunes de la semana
  cargado_por  uuid references orden_personas(id) on delete set null,
  cerrada      boolean not null default false,
  creado_en    timestamptz not null default now(),
  unique (local_id, semana)
);

create table testigo_items (
  id             uuid primary key default gen_random_uuid(),
  semana_id      uuid not null references testigo_semanas(id) on delete cascade,
  item           smallint not null,
  producto       text not null,
  color          text,
  enviada        integer not null default 0,
  stock_sistema  integer,
  cantidad_real  integer,
  dev_fabrica    integer not null default 0,
  salieron       integer not null default 0,
  entraron       integer not null default 0,
  observacion    text,
  unique (semana_id, item)
);

-- =====================================================================
-- Funciones de apoyo
-- =====================================================================

-- Nivel ↔ puntos: fuera_de_estandar = 1, a_mejorar = 2, bien = 3, impecable = 4
create or replace function orden_puntos(n orden_nivel) returns integer
language sql immutable as $$
  select array_position(enum_range(null::orden_nivel), n)
$$;

create or replace function orden_nivel_desde_puntos(p numeric) returns orden_nivel
language sql immutable as $$
  select case when p is null then null
    else (enum_range(null::orden_nivel))[greatest(1, least(4, round(p)::int))] end
$$;

create or replace function orden_nivel_texto(n orden_nivel) returns text
language sql immutable as $$
  select case n when 'impecable' then 'Impecable' when 'bien' then 'Bien'
                when 'a_mejorar' then 'A mejorar' when 'fuera_de_estandar' then 'Fuera de estándar' end
$$;

-- Las 4 preguntas que responde el vendedor según el tipo de sector
create or replace function orden_checks(t orden_sector_tipo) returns text[]
language sql immutable as $$
  select case t when 'salon' then array['dobladas', 'frontales', 'etiquetas', 'limpieza']
                else array['dobladas', 'rotulado', 'talles', 'limpieza'] end
$$;

-- Lo que mira la IA (en salón suma "exhibicion": colores, cantidades, estantes)
create or replace function orden_checks_ia(t orden_sector_tipo) returns text[]
language sql immutable as $$
  select case t when 'salon' then orden_checks(t) || array['exhibicion']
                else orden_checks(t) end
$$;

-- 4 sí = Impecable, 3 = Bien, 2 = A mejorar, 1 o 0 = Fuera de estándar
create or replace function orden_nivel_desde_respuestas(r jsonb) returns orden_nivel
language sql immutable as $$
  select orden_nivel_desde_puntos(greatest(1,
    (select count(*) from jsonb_each(coalesce(r, '{}'::jsonb)) e where e.value = 'true'::jsonb)))
$$;

create or replace function orden_texto_conteo(p_controles int, p_tareas int) returns text
language sql immutable as $$
  select concat_ws(' y ',
    case when p_controles = 1 then '1 control' when p_controles > 1 then p_controles || ' controles' end,
    case when p_tareas = 1 then '1 tarea' when p_tareas > 1 then p_tareas || ' tareas' end)
$$;

-- ---------- Fechas y horas en la zona del local ----------
create or replace function orden_en_hora(p_local uuid, p_fecha date, p_hora time) returns timestamptz
language sql stable as $$
  select ((p_fecha + p_hora) at time zone l.zona_horaria) from orden_locales l where l.id = p_local
$$;

create or replace function orden_fecha_local(p_local uuid, p_ts timestamptz default now()) returns date
language sql stable as $$
  select (p_ts at time zone l.zona_horaria)::date from orden_locales l where l.id = p_local
$$;

create or replace function orden_hora_local(p_local uuid, p_ts timestamptz default now()) returns time
language sql stable as $$
  select (p_ts at time zone l.zona_horaria)::time from orden_locales l where l.id = p_local
$$;

create or replace function orden_local_abre(p_local uuid, p_fecha date) returns boolean
language sql stable as $$
  select coalesce((select l.activo and extract(isodow from p_fecha)::smallint = any(l.dias_abiertos)
                   from orden_locales l where l.id = p_local), false)
$$;

-- ¿La persona trabaja ese día? (local abierto, no es su franco, no está de vacaciones)
create or replace function orden_trabaja(p_persona uuid, p_fecha date) returns boolean
language sql stable as $$
  select coalesce((
    select p.activo
       and p.local_id is not null
       and orden_local_abre(p.local_id, p_fecha)
       and not (extract(isodow from p_fecha)::smallint = any(p.dias_libres))
       and not exists (select 1 from orden_ausencias a
                       where a.persona_id = p.id and p_fecha between a.desde and a.hasta)
    from orden_personas p where p.id = p_persona), false)
$$;

-- A quién le toca el sector ese día: el responsable, o si no está, el suplente
create or replace function orden_asignado(p_sector uuid, p_fecha date) returns uuid
language sql stable as $$
  select case when orden_trabaja(s.responsable_id, p_fecha) then s.responsable_id
              when orden_trabaja(s.suplente_id, p_fecha) then s.suplente_id end
  from orden_sectores s where s.id = p_sector
$$;

create or replace function orden_proximo_dia_laboral(p_persona uuid, p_desde date) returns date
language plpgsql stable as $$
declare d date := p_desde;
begin
  for i in 1..21 loop
    d := d + 1;
    if orden_trabaja(p_persona, d) then return d; end if;
  end loop;
  return p_desde + 1;
end $$;

-- Vencimiento de una tarea según el plazo, contando solo días que la persona trabaja.
--   hoy:    hoy a la hora límite (si queda menos de 1 h, pasa al próximo día que trabaje)
--   manana: próximo día que trabaje, a la hora límite
--   semana: último día que trabaje en esta semana, a la hora límite
create or replace function orden_calcular_vencimiento(p_persona uuid, p_plazo orden_plazo, p_desde timestamptz default now())
returns timestamptz language plpgsql stable as $$
declare
  v_local uuid; v_limite time; v_hoy date; v_hora time; v_dia date; d date;
begin
  select p.local_id into v_local from orden_personas p where p.id = p_persona;
  if v_local is null then return p_desde + interval '24 hours'; end if;

  select coalesce(c.hora_limite, '18:00'::time) into v_limite
  from orden_locales l left join orden_config c on c.local_id = l.id where l.id = v_local;

  v_hoy  := orden_fecha_local(v_local, p_desde);
  v_hora := orden_hora_local(v_local, p_desde);

  if p_plazo = 'hoy' then
    if orden_trabaja(p_persona, v_hoy) and v_hora <= v_limite - interval '1 hour' then
      v_dia := v_hoy;
    else
      v_dia := orden_proximo_dia_laboral(p_persona, v_hoy);
    end if;
  elsif p_plazo = 'manana' then
    v_dia := orden_proximo_dia_laboral(p_persona, v_hoy);
  else
    for i in reverse (7 - extract(isodow from v_hoy)::int)..0 loop
      d := v_hoy + i;
      if orden_trabaja(p_persona, d) and (d > v_hoy or v_hora <= v_limite - interval '1 hour') then
        v_dia := d; exit;
      end if;
    end loop;
    if v_dia is null then v_dia := orden_proximo_dia_laboral(p_persona, v_hoy); end if;
  end if;

  return orden_en_hora(v_local, v_dia, v_limite);
end $$;

-- ---------- Quién soy y qué puedo ver ----------
-- Si No Compra ya maneja usuarios y roles a su manera, alcanza con
-- adaptar estas funciones: todo lo demás se apoya en ellas.
create or replace function orden_es_servicio() returns boolean
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    '') = 'service_role'
$$;

create or replace function orden_yo_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from orden_personas where auth_user_id = auth.uid() and activo limit 1
$$;

create or replace function orden_es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select orden_es_servicio() or exists (
    select 1 from orden_personas where auth_user_id = auth.uid() and activo and rol = 'admin')
$$;

create or replace function orden_es_supervisor_de(p_local uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select orden_es_servicio() or exists (
    select 1 from orden_personas
    where auth_user_id = auth.uid() and activo
      and (rol = 'admin' or (rol = 'supervisor' and local_id = p_local)))
$$;

create or replace function orden_ve_local(p_local uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select orden_es_servicio() or exists (
    select 1 from orden_personas
    where auth_user_id = auth.uid() and activo
      and (rol in ('admin', 'gerencia') or local_id = p_local))
$$;

-- Gerencia (ej. los dueños): entra a No Compra y ve cómo está cada local, sin poder cambiar nada
create or replace function orden_es_gerencia() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from orden_personas where auth_user_id = auth.uid() and activo and rol = 'gerencia')
$$;

-- Ver lo del equipo de un local (controles, fotos, tareas, faltas, cajas): supervisor, admin o gerencia
create or replace function orden_ve_equipo(p_local uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select orden_es_supervisor_de(p_local) or orden_es_gerencia()
$$;

-- =====================================================================
-- Avisos
-- =====================================================================
create or replace function orden_encolar_aviso(
  p_persona uuid, p_tipo text, p_titulo text, p_cuerpo text, p_url text,
  p_clave text, p_prioridad smallint default 1)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_rol orden_rol; v_max int; v_cuenta int;
  v_estado orden_aviso_estado := 'pendiente';
begin
  if p_persona is null then return null; end if;
  if p_clave is not null and exists (select 1 from orden_avisos where clave = p_clave) then
    return null;
  end if;

  select p.rol, coalesce(c.max_avisos_dia, 4) into v_rol, v_max
  from orden_personas p left join orden_config c on c.local_id = p.local_id
  where p.id = p_persona and p.activo;
  if not found then return null; end if;

  -- Tope diario: los avisos normales que pasan el tope quedan registrados pero no se mandan
  if p_prioridad <= 1 then
    select count(*) into v_cuenta from orden_avisos
    where persona_id = p_persona and prioridad <= 1
      and estado in ('pendiente', 'enviado') and creado_en > now() - interval '24 hours';
    if v_cuenta >= v_max then v_estado := 'omitido'; end if;
  end if;

  insert into orden_avisos (persona_id, tipo, titulo, cuerpo, url, prioridad, canal, clave, estado)
  values (p_persona, p_tipo, p_titulo, p_cuerpo, p_url, p_prioridad,
          case when v_rol = 'vendedor' then array['push'] else array['push', 'telegram'] end,
          p_clave, v_estado)
  on conflict (clave) do nothing
  returning id into v_id;
  return v_id;
end $$;

-- Avisa a supervisores del local, a admins o a ambos.
-- Si el local no tiene supervisor cargado, avisa a los admins.
create or replace function orden_avisar_responsables(
  p_local uuid, p_destino text, p_tipo text, p_titulo text, p_cuerpo text,
  p_url text, p_clave text, p_prioridad smallint default 2)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n int := 0; v_hay_sup boolean;
begin
  select exists (select 1 from orden_personas where rol = 'supervisor' and local_id = p_local and activo)
  into v_hay_sup;

  for r in
    select id from orden_personas
    where activo and (
      (p_destino in ('supervisores', 'ambos') and rol = 'supervisor' and local_id = p_local)
      or (rol = 'admin' and (p_destino in ('admins', 'ambos') or not v_hay_sup)))
  loop
    if orden_encolar_aviso(r.id, p_tipo, p_titulo, p_cuerpo, p_url,
                           p_clave || ':' || r.id, p_prioridad) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- =====================================================================
-- Funciones que llama la app del VENDEDOR
-- =====================================================================

-- 1) Registra una foto (después de subirla a Storage). Devuelve el id de la foto
--    para pedir el análisis de la IA (Edge Function analizar-foto).
create or replace function orden_registrar_foto(p_control uuid, p_foto_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c orden_controles; v_yo uuid := orden_yo_id(); v_id uuid; v_ia boolean;
begin
  select * into c from orden_controles where id = p_control for update;
  if not found then raise exception 'No encontramos ese control'; end if;
  if c.persona_id is distinct from v_yo then raise exception 'Este control no es tuyo'; end if;
  if c.estado in ('enviado', 'revisado') then raise exception 'Ya enviaste este control'; end if;
  if p_foto_path not like c.local_id::text || '/%' then raise exception 'Ruta de foto inválida'; end if;

  select coalesce(ia_activa, true) into v_ia from orden_config where local_id = c.local_id;

  insert into orden_fotos (control_id, persona_id, foto_path, ia_estado)
  values (c.id, v_yo, p_foto_path, case when coalesce(v_ia, true) then 'pendiente' else 'omitida' end)
  returning id into v_id;

  update orden_controles set ultimo_intento_id = v_id, nivel_ia = null where id = c.id;
  return v_id;
end $$;

-- 2) Envía el control con las respuestas de "Antes de enviar"
create or replace function orden_enviar_control(p_control uuid, p_respuestas jsonb)
returns orden_controles language plpgsql security definer set search_path = public as $$
declare
  c orden_controles; v_tipo orden_sector_tipo; v_checks text[]; v_resp jsonb := '{}';
  v_ia_checks jsonb; v_nivel_ia orden_nivel; v_decl orden_nivel; v_disc boolean; v_problemas boolean; k text;
begin
  select * into c from orden_controles where id = p_control for update;
  if not found then raise exception 'No encontramos ese control'; end if;
  if c.persona_id is distinct from orden_yo_id() then raise exception 'Este control no es tuyo'; end if;
  if c.estado in ('enviado', 'revisado') then raise exception 'Este control ya fue enviado'; end if;
  if c.ultimo_intento_id is null then raise exception 'Primero sacá la foto'; end if;

  select s.tipo into v_tipo from orden_modulos m join orden_sectores s on s.id = m.sector_id where m.id = c.modulo_id;
  v_checks := orden_checks(v_tipo);
  foreach k in array v_checks loop
    if jsonb_typeof(p_respuestas -> k) is distinct from 'boolean' then
      raise exception 'Respondé las 4 preguntas antes de enviar';
    end if;
    v_resp := v_resp || jsonb_build_object(k, p_respuestas -> k);
  end loop;

  select ia_resultado -> 'checks', ia_nivel into v_ia_checks, v_nivel_ia
  from orden_fotos where id = c.ultimo_intento_id;

  v_decl := orden_nivel_desde_respuestas(v_resp);
  v_disc := (v_nivel_ia is not null and abs(orden_puntos(v_decl) - orden_puntos(v_nivel_ia)) >= 2)
         or exists (select 1 from unnest(v_checks) x
                    where v_resp ->> x = 'true' and v_ia_checks ->> x = 'mal');
  v_problemas := (v_nivel_ia is not null and v_nivel_ia <= 'a_mejorar')
         or exists (select 1 from orden_tareas
                    where modulo_id = c.modulo_id and origen = 'ia' and estado = 'pendiente');

  update orden_controles
     set estado = 'enviado', respuestas = v_resp, nivel_declarado = v_decl, nivel_ia = v_nivel_ia,
         discrepancia = v_disc, enviado_en = now(), enviado_con_problemas = v_problemas
   where id = c.id
  returning * into c;
  return c;
end $$;

-- 3) Marca una tarea como hecha. Si manda foto de un módulo, se crea un control
--    de corrección: la app pide el análisis de la IA con el foto_id que devuelve.
create or replace function orden_completar_tarea(p_tarea uuid, p_foto_path text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t orden_tareas; v_yo uuid := orden_yo_id(); v_control uuid; v_foto uuid;
begin
  select * into t from orden_tareas where id = p_tarea for update;
  if not found then raise exception 'No encontramos esa tarea'; end if;
  if t.persona_id is distinct from v_yo then raise exception 'Esta tarea no es tuya'; end if;
  if t.estado not in ('pendiente', 'vencida') then raise exception 'Esta tarea ya está cerrada'; end if;
  if t.requiere_foto and p_foto_path is null then raise exception 'Esta tarea pide una foto'; end if;
  if p_foto_path is not null and p_foto_path not like t.local_id::text || '/%' then
    raise exception 'Ruta de foto inválida';
  end if;

  update orden_tareas
     set estado = 'hecha', completada_en = now(), completada_a_tiempo = now() <= vence_en, foto_path = p_foto_path
   where id = t.id;

  if p_foto_path is not null and t.modulo_id is not null then
    insert into orden_controles (local_id, modulo_id, persona_id, fecha, tipo, estado, vence_en, enviado_en)
    values (t.local_id, t.modulo_id, v_yo, orden_fecha_local(t.local_id), 'correccion', 'enviado', now(), now())
    returning id into v_control;

    insert into orden_fotos (control_id, persona_id, foto_path) values (v_control, v_yo, p_foto_path)
    returning id into v_foto;
    update orden_controles set ultimo_intento_id = v_foto where id = v_control;
  end if;

  return jsonb_build_object('tarea_id', t.id, 'control_id', v_control, 'foto_id', v_foto);
end $$;

create or replace function orden_no_pude_tarea(p_tarea uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare t orden_tareas; v_nombre text;
begin
  select * into t from orden_tareas where id = p_tarea for update;
  if not found or t.persona_id is distinct from orden_yo_id() then raise exception 'Esta tarea no es tuya'; end if;
  if t.estado <> 'pendiente' then raise exception 'Esta tarea ya está cerrada'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Contá en una línea por qué no pudiste'; end if;

  update orden_tareas set estado = 'no_pude', motivo_no_pude = trim(p_motivo), completada_en = now() where id = t.id;
  select nombre into v_nombre from orden_personas where id = t.persona_id;
  perform orden_avisar_responsables(t.local_id, 'supervisores', 'tarea_no_pude',
    v_nombre || ' no pudo hacer una tarea', t.titulo || ' — ' || trim(p_motivo),
    '/equipo', 'nopude:' || t.id, 2::smallint);
end $$;

create or replace function orden_pedir_prorroga(p_tarea uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare t orden_tareas; v_nombre text;
begin
  select * into t from orden_tareas where id = p_tarea for update;
  if not found or t.persona_id is distinct from orden_yo_id() then raise exception 'Esta tarea no es tuya'; end if;
  if t.estado <> 'pendiente' then raise exception 'Esta tarea ya está cerrada'; end if;
  if t.prorroga_estado is not null then raise exception 'Ya pediste más tiempo para esta tarea'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Contá en una línea por qué necesitás más tiempo'; end if;

  update orden_tareas
     set prorroga_estado = 'pedida', prorroga_motivo = trim(p_motivo), prorroga_pedida_en = now()
   where id = t.id;
  select nombre into v_nombre from orden_personas where id = t.persona_id;
  perform orden_avisar_responsables(t.local_id, 'supervisores', 'prorroga',
    v_nombre || ' pide más tiempo', t.titulo || ' — ' || trim(p_motivo),
    '/equipo', 'prorroga:' || t.id, 2::smallint);
end $$;

create or replace function orden_registrar_descargo(p_falta uuid, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update orden_faltas set descargo = trim(p_texto), descargo_en = now()
   where id = p_falta and persona_id = orden_yo_id() and estado = 'confirmada';
  if not found then raise exception 'No encontramos esa falta'; end if;
end $$;

-- Perfil: lo único que cada uno puede cambiar de sí mismo
create or replace function orden_actualizar_perfil(p_nombre text default null, p_foto_path text default null)
returns orden_personas language plpgsql security definer set search_path = public as $$
declare p orden_personas;
begin
  update orden_personas
     set nombre = coalesce(nullif(trim(p_nombre), ''), nombre),
         foto_perfil = coalesce(p_foto_path, foto_perfil)
   where id = orden_yo_id() returning * into p;
  if not found then raise exception 'Usuario sin persona asignada'; end if;
  return p;
end $$;

create or replace function orden_marcar_avisos_leidos(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update orden_avisos set leido_en = now()
   where id = any(p_ids) and persona_id = orden_yo_id() and leido_en is null
$$;

create or replace function orden_guardar_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = public as $$
declare v_yo uuid := orden_yo_id();
begin
  if v_yo is null then raise exception 'Usuario sin persona asignada'; end if;
  insert into orden_push_subs (persona_id, endpoint, p256dh, auth)
  values (v_yo, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set persona_id = excluded.persona_id, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;

-- 4) Desafío semanal (telas y molderías / cómo trabajamos en el local)

-- Dificultad que le toca: los primeros 3 son fáciles; después sube si le viene yendo bien
-- (promedio de los últimos 3: 60% o más → nivel 2; 80% o más y 6 hechos → nivel 3).
create or replace function orden_desafio_dificultad(p_persona uuid) returns smallint
language sql stable security definer set search_path = public as $$
  with hechos as (
    select puntaje::numeric / nullif(total, 0) as pct,
           row_number() over (order by semana desc) as n,
           count(*) over () as total_hechos
    from orden_desafios where persona_id = p_persona and terminado_en is not null)
  select case
    when coalesce(max(total_hechos), 0) < 3 then 1
    when avg(pct) filter (where n <= 3) >= 0.8 and max(total_hechos) >= 6 then 3
    when avg(pct) filter (where n <= 3) >= 0.6 then 2
    else 1 end::smallint
  from hechos
$$;

-- Elige las preguntas: primero las que le erró la última vez (para que las aprenda),
-- después las que nunca le tocaron, priorizando la dificultad que le corresponde.
create or replace function orden_desafio_elegir(p_persona uuid, p_categoria text, p_dificultad smallint, p_cantidad int)
returns uuid[] language sql volatile security definer set search_path = public as $$
  select array_agg(id) from (
    select q.id
    from orden_preguntas q
    left join lateral (
      select (d.respuestas ->> q.id::text)::int as ultima
      from orden_desafios d
      where d.persona_id = p_persona and d.respuestas ? q.id::text
      order by d.semana desc limit 1) u on true
    where q.activo and q.dificultad <= p_dificultad
      and case p_categoria when 'producto' then q.tema in ('tela', 'molderia') else q.tema = 'retail' end
    order by case when u.ultima is not null and u.ultima <> q.correcta then 0
                  when u.ultima is null then 1 else 2 end,
             (q.dificultad = p_dificultad) desc,
             random()
    limit p_cantidad) x
$$;

-- Devuelve el último desafío con las preguntas, SIN la respuesta correcta
-- de las que todavía no respondió.
create or replace function orden_desafio_mio()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare d orden_desafios; v_yo uuid := orden_yo_id();
begin
  select * into d from orden_desafios where persona_id = v_yo order by semana desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', d.id, 'semana', d.semana, 'categoria', d.categoria, 'dificultad', d.dificultad,
    'vence_en', d.vence_en, 'terminado_en', d.terminado_en,
    'puntaje', d.puntaje, 'total', d.total,
    'preguntas', (
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'tema', q.tema, 'pregunta', q.pregunta, 'imagen_path', q.imagen_path, 'opciones', to_jsonb(q.opciones),
        'respondida', d.respuestas ? q.id::text,
        'elegida', (d.respuestas ->> q.id::text)::int,
        'correcta', case when d.respuestas ? q.id::text then q.correcta end,
        'explicacion', case when d.respuestas ? q.id::text then q.explicacion end)
        order by x.pos)
      from unnest(d.preguntas) with ordinality x(pid, pos) join orden_preguntas q on q.id = x.pid));
end $$;

-- Responde una pregunta. No se puede cambiar una respuesta ya dada.
create or replace function orden_desafio_responder(p_desafio uuid, p_pregunta uuid, p_opcion smallint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d orden_desafios; q orden_preguntas; v_ok boolean;
begin
  select * into d from orden_desafios where id = p_desafio for update;
  if not found or d.persona_id is distinct from orden_yo_id() then raise exception 'Este desafío no es tuyo'; end if;
  if d.terminado_en is not null then raise exception 'Ya terminaste el desafío de esta semana'; end if;
  if now() > d.vence_en then raise exception 'El desafío de esta semana ya cerró'; end if;
  if not (p_pregunta = any(d.preguntas)) then raise exception 'Esa pregunta no es de tu desafío'; end if;
  if d.respuestas ? p_pregunta::text then raise exception 'Ya respondiste esa pregunta'; end if;

  select * into q from orden_preguntas where id = p_pregunta;
  if p_opcion < 1 or p_opcion > array_length(q.opciones, 1) then raise exception 'Opción inválida'; end if;
  v_ok := p_opcion = q.correcta;

  update orden_desafios
     set respuestas = respuestas || jsonb_build_object(p_pregunta::text, p_opcion),
         puntaje = puntaje + case when v_ok then 1 else 0 end
   where id = d.id returning * into d;

  if (select count(*) from jsonb_object_keys(d.respuestas)) >= d.total then
    update orden_desafios set terminado_en = now() where id = d.id returning * into d;
  end if;

  return jsonb_build_object('acerto', v_ok, 'correcta', q.correcta, 'explicacion', q.explicacion,
                            'puntaje', d.puntaje, 'total', d.total, 'terminado', d.terminado_en is not null);
end $$;

-- =====================================================================
-- Funciones del SUPERVISOR / ADMIN (desde la app o desde No Compra)
-- =====================================================================
create or replace function orden_revisar_control(p_control uuid, p_nivel orden_nivel, p_comentario text default null)
returns orden_controles language plpgsql security definer set search_path = public as $$
declare
  c orden_controles; m orden_modulos; v_base orden_nivel; v_coment text := nullif(trim(p_comentario), '');
  v_plazo orden_plazo;
begin
  select * into c from orden_controles where id = p_control for update;
  if not found then raise exception 'No encontramos ese control'; end if;
  if not orden_es_supervisor_de(c.local_id) then raise exception 'Solo el supervisor del local puede revisar'; end if;
  if c.estado not in ('enviado', 'revisado') then raise exception 'Este control todavía no fue enviado'; end if;

  v_base := coalesce(c.nivel_ia, c.nivel_declarado);
  if v_base is not null and abs(orden_puntos(p_nivel) - orden_puntos(v_base)) > 1 and v_coment is null then
    raise exception 'Para cambiar más de un nivel, dejá un comentario';
  end if;

  update orden_controles
     set nivel_final = p_nivel, revisado_por = orden_yo_id(), revisado_en = now(),
         comentario = v_coment, estado = 'revisado'
   where id = c.id
  returning * into c;

  select * into m from orden_modulos where id = c.modulo_id;

  -- A mejorar o peor: tarea para el vendedor, si no tiene ya una abierta de ese módulo
  if p_nivel <= 'a_mejorar' and c.persona_id is not null and not exists (
       select 1 from orden_tareas where modulo_id = c.modulo_id and persona_id = c.persona_id and estado = 'pendiente') then
    select coalesce(plazo_tarea_default, 'manana') into v_plazo from orden_config where local_id = c.local_id;
    insert into orden_tareas (local_id, persona_id, modulo_id, control_id, origen, titulo, detalle,
                              requiere_foto, plazo, vence_en, creada_por, clave)
    values (c.local_id, c.persona_id, c.modulo_id, c.id, 'supervisor',
            m.nombre || ': ' || coalesce(v_coment, 'mejorar el orden'), v_coment, true,
            coalesce(v_plazo, 'manana'), orden_calcular_vencimiento(c.persona_id, coalesce(v_plazo, 'manana')),
            orden_yo_id(), 'rev:' || c.id);
  end if;

  perform orden_encolar_aviso(c.persona_id, 'revisado',
    m.nombre || ': ' || orden_nivel_texto(p_nivel), v_coment, '/historial', 'revisado:' || c.id, 1::smallint);
  return c;
end $$;

-- Botón "Recordar" del supervisor: le manda un aviso al vendedor con lo que le falta hoy
-- (como mucho uno por hora, para no saturar)
create or replace function orden_recordar(p_persona uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare p orden_personas; v_ctl int; v_tar int; v_id uuid;
begin
  select * into p from orden_personas where id = p_persona and activo;
  if not found or not orden_es_supervisor_de(p.local_id) then raise exception 'No podés mandarle recordatorios'; end if;
  select count(*) into v_ctl from orden_controles c where c.persona_id = p.id and c.estado = 'pendiente';
  select count(*) into v_tar from orden_tareas t where t.persona_id = p.id and t.estado in ('pendiente', 'vencida');
  if v_ctl + v_tar = 0 then return false; end if;
  v_id := orden_encolar_aviso(p.id, 'recordatorio_supervisor', 'Tu supervisor te recuerda: ' || orden_texto_conteo(v_ctl, v_tar),
            'Entrá a la app para verlo.', '/hoy', 'recordar:' || p.id || ':' || to_char(now(), 'YYYYMMDDHH24'), 2::smallint);
  return v_id is not null;
end $$;

create or replace function orden_crear_tarea(
  p_personas uuid[], p_titulo text, p_detalle text default null, p_modulo uuid default null,
  p_plazo orden_plazo default null, p_requiere_foto boolean default false)
returns setof uuid language plpgsql security definer set search_path = public as $$
declare
  v_persona uuid; v_local uuid; v_plazo orden_plazo; v_id uuid; v_yo uuid := orden_yo_id();
  v_origen orden_tarea_origen;
begin
  if coalesce(trim(p_titulo), '') = '' then raise exception 'La tarea necesita un título'; end if;
  v_origen := case when orden_es_servicio() or exists (select 1 from orden_personas where id = v_yo and rol = 'admin')
                   then 'admin' else 'supervisor' end;

  foreach v_persona in array p_personas loop
    select local_id into v_local from orden_personas where id = v_persona and activo;
    if v_local is null then raise exception 'Persona no encontrada o sin local'; end if;
    if not orden_es_supervisor_de(v_local) then raise exception 'No podés asignar tareas en ese local'; end if;

    select coalesce(p_plazo, c.plazo_tarea_default, 'manana') into v_plazo
    from orden_locales l left join orden_config c on c.local_id = l.id where l.id = v_local;

    insert into orden_tareas (local_id, persona_id, modulo_id, origen, titulo, detalle, requiere_foto,
                              plazo, vence_en, creada_por)
    values (v_local, v_persona, p_modulo, v_origen, trim(p_titulo), nullif(trim(p_detalle), ''),
            coalesce(p_requiere_foto, false), v_plazo, orden_calcular_vencimiento(v_persona, v_plazo), v_yo)
    returning id into v_id;

    perform orden_encolar_aviso(v_persona, 'tarea_nueva', 'Nueva tarea: ' || trim(p_titulo),
      'Vence ' || to_char((select vence_en from orden_tareas where id = v_id)
                 at time zone (select zona_horaria from orden_locales where id = v_local), 'DD/MM HH24:MI'),
      '/tareas', 'tarea:' || v_id, 2::smallint);
    return next v_id;
  end loop;
end $$;

create or replace function orden_responder_prorroga(p_tarea uuid, p_aprobar boolean, p_plazo orden_plazo default 'manana')
returns orden_tareas language plpgsql security definer set search_path = public as $$
declare t orden_tareas;
begin
  select * into t from orden_tareas where id = p_tarea for update;
  if not found then raise exception 'No encontramos esa tarea'; end if;
  if not orden_es_supervisor_de(t.local_id) then raise exception 'Solo el supervisor puede responder'; end if;
  if t.prorroga_estado is distinct from 'pedida' then raise exception 'No hay un pedido de más tiempo pendiente'; end if;

  if p_aprobar then
    update orden_tareas
       set prorroga_estado = 'aprobada', prorroga_respondida_por = orden_yo_id(),
           vence_original = vence_en, vence_en = orden_calcular_vencimiento(persona_id, p_plazo),
           estado = case when estado = 'vencida' then 'pendiente' else estado end
     where id = t.id returning * into t;
    perform orden_encolar_aviso(t.persona_id, 'prorroga', 'Te dieron más tiempo', t.titulo, '/tareas',
                                'prorroga-ok:' || t.id, 2::smallint);
  else
    update orden_tareas set prorroga_estado = 'rechazada', prorroga_respondida_por = orden_yo_id()
     where id = t.id returning * into t;
    perform orden_encolar_aviso(t.persona_id, 'prorroga', 'No se aprobó más tiempo', t.titulo || ' — mantiene el plazo',
                                '/tareas', 'prorroga-no:' || t.id, 2::smallint);
  end if;
  return t;
end $$;

-- El supervisor cancela una tarea que ya no corresponde (queda registrado quién y por qué)
create or replace function orden_cancelar_tarea(p_tarea uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare t orden_tareas;
begin
  select * into t from orden_tareas where id = p_tarea for update;
  if not found then raise exception 'No encontramos esa tarea'; end if;
  if not orden_es_supervisor_de(t.local_id) then raise exception 'Solo el supervisor puede cancelar tareas'; end if;
  if t.estado not in ('pendiente', 'vencida') then raise exception 'Esta tarea ya está cerrada'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribí por qué se cancela'; end if;
  update orden_tareas
     set estado = 'cancelada', motivo_no_pude = 'Cancelada: ' || trim(p_motivo),
         completada_en = now(), prorroga_respondida_por = orden_yo_id()
   where id = t.id;
end $$;

-- La próxima sanción de la escalera según lo confirmado en los últimos N días
create or replace function orden_siguiente_sancion(p_persona uuid) returns orden_falta_tipo
language plpgsql stable security definer set search_path = public as $$
declare v_cfg orden_config; v_total int; v_aperc int;
begin
  select c.* into v_cfg from orden_personas p join orden_config c on c.local_id = p.local_id where p.id = p_persona;
  select count(*), count(*) filter (where tipo = 'apercibimiento') into v_total, v_aperc
  from orden_faltas
  where persona_id = p_persona and estado = 'confirmada'
    and creado_en > now() - make_interval(days => coalesce(v_cfg.ventana_escalera_dias, 90));
  if v_total = 0 then return 'advertencia'; end if;
  if v_aperc >= coalesce(v_cfg.apercibimientos_para_suspension, 2) then return 'suspension'; end if;
  return 'apercibimiento';
end $$;

create or replace function orden_registrar_falta(p_persona uuid, p_tipo orden_falta_tipo, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_local uuid; v_id uuid;
begin
  select local_id into v_local from orden_personas where id = p_persona;
  if not orden_es_supervisor_de(v_local) then raise exception 'No podés registrar faltas en ese local'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Escribí el motivo'; end if;
  insert into orden_faltas (local_id, persona_id, tipo, estado, motivo, decidida_por, decidida_en)
  values (v_local, p_persona, p_tipo, 'confirmada', trim(p_motivo), orden_yo_id(), now())
  returning id into v_id;
  perform orden_encolar_aviso(p_persona, 'falta', 'Se registró una ' || p_tipo::text, trim(p_motivo),
                              '/perfil', 'falta:' || v_id, 2::smallint);
  return v_id;
end $$;

create or replace function orden_decidir_falta(p_falta uuid, p_confirmar boolean, p_tipo orden_falta_tipo default null, p_nota text default null)
returns orden_faltas language plpgsql security definer set search_path = public as $$
declare f orden_faltas;
begin
  select * into f from orden_faltas where id = p_falta for update;
  if not found then raise exception 'No encontramos esa falta'; end if;
  if not orden_es_supervisor_de(f.local_id) then raise exception 'No podés decidir faltas en ese local'; end if;
  if f.estado <> 'sugerida' then raise exception 'Esta falta ya fue decidida'; end if;

  update orden_faltas
     set estado = case when p_confirmar then 'confirmada'::orden_falta_estado else 'descartada' end,
         tipo = coalesce(p_tipo, tipo), decidida_por = orden_yo_id(), decidida_en = now(),
         nota = nullif(trim(p_nota), '')
   where id = f.id returning * into f;

  if p_confirmar then
    perform orden_encolar_aviso(f.persona_id, 'falta', 'Se registró una ' || f.tipo::text, f.motivo,
                                '/perfil', 'falta:' || f.id, 2::smallint);
  end if;
  return f;
end $$;

-- =====================================================================
-- IA: preparar el análisis y guardar el resultado (las usa analizar-foto)
-- =====================================================================
create or replace function orden_preparar_analisis(p_foto uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  f orden_fotos; c orden_controles; m orden_modulos; s orden_sectores; cfg orden_config; e orden_exhibidores;
begin
  select * into f from orden_fotos where id = p_foto;
  if not found then raise exception 'No encontramos esa foto'; end if;
  select * into c from orden_controles where id = f.control_id;
  if c.persona_id is distinct from orden_yo_id() and not orden_es_supervisor_de(c.local_id) then
    raise exception 'No tenés acceso a esta foto';
  end if;
  select * into m from orden_modulos where id = c.modulo_id;
  select * into s from orden_sectores where id = m.sector_id;
  select * into cfg from orden_config where local_id = c.local_id;
  select * into e from orden_exhibidores where id = m.exhibidor_id;

  return jsonb_build_object(
    'foto_id', f.id,
    'foto_path', f.foto_path,
    'ia_estado', f.ia_estado,
    'local_id', c.local_id,
    'control_tipo', c.tipo,
    'sector_tipo', s.tipo,
    'modulo_nombre', m.nombre,
    'referencia_path', m.foto_referencia_path,
    'reglas_extra', m.reglas_extra,
    'exhibidor', case when e.id is null then null else jsonb_build_object(
                   'nombre', e.nombre, 'prendas_min', e.prendas_min, 'prendas_max', e.prendas_max, 'notas', e.notas) end,
    'checks', to_jsonb(orden_checks_ia(s.tipo)),
    'reglas', coalesce((
       select jsonb_agg(jsonb_build_object('check', r.check_clave, 'texto', r.texto) order by r.check_clave, r.orden)
       from orden_reglas r
       where r.activo and (r.local_id is null or r.local_id = c.local_id)
         and (r.sector_tipo is null or r.sector_tipo = s.tipo)), '[]'::jsonb),
    'colores', coalesce((
       select jsonb_agg(col.nombre order by col.orden) from orden_colores col where col.activo), '[]'::jsonb),
    'ia_activa', coalesce(cfg.ia_activa, true),
    'ia_sugerencias', coalesce(cfg.ia_sugerencias, false)
  );
end $$;

create or replace function orden_aplicar_resultado_ia(p_foto uuid, p_resultado jsonb, p_modelo text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f orden_fotos; c orden_controles; m orden_modulos; cfg orden_config;
  v_valida boolean; v_nivel orden_nivel; h jsonb; v_clave text; v_claves text[] := '{}';
  v_tarea uuid; v_creadas jsonb := '[]'; v_resueltas int := 0; v_titulo text;
begin
  select * into f from orden_fotos where id = p_foto for update;
  if not found then raise exception 'No encontramos esa foto'; end if;
  -- Una foto se analiza una sola vez: para volver a revisar, hay que sacar otra.
  if f.ia_estado in ('ok', 'invalida') then raise exception 'Esta foto ya fue analizada'; end if;
  select * into c from orden_controles where id = f.control_id;
  select * into m from orden_modulos where id = c.modulo_id;
  select * into cfg from orden_config where local_id = c.local_id;

  v_valida := coalesce((p_resultado ->> 'foto_valida')::boolean, true);
  v_nivel  := case when v_valida then (p_resultado ->> 'nivel_sugerido')::orden_nivel end;

  update orden_fotos
     set ia_estado = case when v_valida then 'ok' else 'invalida' end,
         ia_resultado = p_resultado, ia_nivel = v_nivel, ia_modelo = p_modelo, ia_error = null, analizada_en = now()
   where id = f.id;

  if not v_valida then
    return jsonb_build_object('foto_valida', false, 'motivo', p_resultado ->> 'motivo_foto_invalida',
                              'tareas_creadas', '[]'::jsonb, 'tareas_resueltas', 0);
  end if;

  if c.ultimo_intento_id = f.id then
    update orden_controles set nivel_ia = v_nivel where id = c.id;
  end if;

  if coalesce(cfg.ia_crea_tareas, true) and c.persona_id is not null then
    for h in select * from jsonb_array_elements(coalesce(p_resultado -> 'hallazgos', '[]'::jsonb)) loop
      continue when coalesce(h ->> 'gravedad', '') <> 'corregir';
      v_clave := 'ia:' || m.id || ':' || coalesce(nullif(h ->> 'check', ''), 'general');
      v_claves := v_claves || v_clave;
      v_titulo := left(m.nombre || ': ' || coalesce(h ->> 'titulo', 'corregir'), 140);

      v_tarea := null;
      insert into orden_tareas (local_id, persona_id, modulo_id, control_id, foto_origen_id, origen,
                                titulo, detalle, requiere_foto, plazo, vence_en, clave)
      values (c.local_id, c.persona_id, m.id, c.id, f.id, 'ia', v_titulo, h ->> 'detalle', true, 'hoy',
              orden_calcular_vencimiento(c.persona_id, 'hoy'), v_clave)
      on conflict (persona_id, clave) where estado = 'pendiente' and clave is not null do nothing
      returning id into v_tarea;

      if v_tarea is not null then
        v_creadas := v_creadas || jsonb_build_object('id', v_tarea, 'titulo', v_titulo);
      end if;
    end loop;

    -- Lo que la IA había marcado antes y ahora se ve BIEN: se cierra solo.
    -- Solo si la IA está segura y ese punto quedó "ok" (una foto oscura o un "no_se_ve" no cierra nada).
    if coalesce(p_resultado ->> 'confianza', 'media') <> 'baja' then
      update orden_tareas t
         set estado = 'hecha', completada_en = now(), completada_a_tiempo = now() <= t.vence_en, foto_path = f.foto_path
       where t.modulo_id = m.id and t.origen = 'ia' and t.estado = 'pendiente'
         and not (t.clave = any(v_claves))
         and p_resultado -> 'checks' ->> split_part(t.clave, ':', 3) = 'ok';
      get diagnostics v_resueltas = row_count;
    end if;
  end if;

  return jsonb_build_object(
    'foto_valida', true,
    'nivel', v_nivel,
    'nivel_texto', orden_nivel_texto(v_nivel),
    'checks', p_resultado -> 'checks',
    'hallazgos', p_resultado -> 'hallazgos',
    'comentario', p_resultado -> 'comentario',
    'tareas_creadas', v_creadas,
    'tareas_resueltas', v_resueltas);
end $$;

create or replace function orden_marcar_error_ia(p_foto uuid, p_error text)
returns void language sql security definer set search_path = public as $$
  update orden_fotos set ia_estado = 'error', ia_error = left(p_error, 1000), analizada_en = now() where id = p_foto
$$;

-- =====================================================================
-- El "reloj": corre cada 15 minutos (Edge Function tick + pg_cron)
-- Genera controles, manda recordatorios, vence lo atrasado, escala y
-- sugiere faltas. Se puede correr las veces que sea: no duplica nada.
-- =====================================================================
create or replace function orden_tick(p_ahora timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l record; cfg orden_config; s record; mo record; p record; r record;
  v_hoy date; v_hora time; v_dow smallint; v_semana date; v_persona uuid;
  v_dias date[]; v_mods uuid[]; v_dia date; v_n int; v_desde timestamptz; v_ult timestamptz;
  v_tv int; v_cv int; v_fde int; v_tipo orden_falta_tipo; v_motivo text; v_falta uuid; v_preg uuid[];
  v_categoria text; v_dif smallint;
  v_generados int := 0; v_ctl_venc int := 0; v_tar_venc int := 0; v_faltas int := 0;
begin
  for l in select * from orden_locales where activo loop
    select * into cfg from orden_config where local_id = l.id;
    if not found then
      insert into orden_config (local_id) values (l.id) returning * into cfg;
    end if;

    v_hoy    := (p_ahora at time zone l.zona_horaria)::date;
    v_hora   := (p_ahora at time zone l.zona_horaria)::time;
    v_dow    := extract(isodow from v_hoy);
    v_semana := v_hoy - (v_dow - 1);

    if orden_local_abre(l.id, v_hoy) then

      -- 1. Controles programados (todos los módulos del salón, los días de control)
      if v_dow = any(cfg.dias_control) then
        for s in select * from orden_sectores where local_id = l.id and tipo = 'salon' and activo loop
          v_persona := orden_asignado(s.id, v_hoy);
          continue when v_persona is null;
          insert into orden_controles (local_id, modulo_id, persona_id, fecha, tipo, vence_en)
          select l.id, m.id, v_persona, v_hoy, 'programado', orden_en_hora(l.id, v_hoy, cfg.hora_limite)
          from orden_modulos m where m.sector_id = s.id and m.activo
          on conflict do nothing;
          get diagnostics v_n = row_count; v_generados := v_generados + v_n;
        end loop;
      end if;

      -- 2. Controles sorpresa (día y módulo elegidos al azar dentro de la semana)
      if cfg.sorpresas_por_semana > 0 then
        for s in select * from orden_sectores where local_id = l.id and tipo = 'salon' and activo loop
          v_persona := orden_asignado(s.id, v_hoy);
          continue when v_persona is null;

          select array_agg(g::date order by g) into v_dias
          from generate_series(v_semana, v_semana + 6, interval '1 day') g
          where orden_local_abre(l.id, g::date)
            and not (extract(isodow from g)::smallint = any(cfg.dias_control))
            and orden_asignado(s.id, g::date) is not null;
          if v_dias is null then
            select array_agg(g::date order by g) into v_dias
            from generate_series(v_semana, v_semana + 6, interval '1 day') g
            where orden_local_abre(l.id, g::date) and orden_asignado(s.id, g::date) is not null;
          end if;
          select array_agg(m.id order by m.numero) into v_mods from orden_modulos m where m.sector_id = s.id and m.activo;
          continue when v_dias is null or v_mods is null;

          -- cuántas sorpresas ya tuvo este sector esta semana (nunca más de las configuradas)
          select count(*) into v_n from orden_controles c join orden_modulos m on m.id = c.modulo_id
          where m.sector_id = s.id and c.tipo = 'sorpresa' and c.fecha between v_semana and v_semana + 6;

          for k in (v_n + 1)..cfg.sorpresas_por_semana loop
            v_dia := v_dias[1 + (abs(hashtext(s.id::text || v_semana::text || 'd' || k)::bigint) % array_length(v_dias, 1))];
            -- si el día elegido ya pasó sin generarse (cambió un franco a mitad de semana), va hoy
            if v_dia <= v_hoy and v_hoy = any(v_dias) then
              insert into orden_controles (local_id, modulo_id, persona_id, fecha, tipo, vence_en)
              values (l.id, v_mods[1 + (abs(hashtext(s.id::text || v_semana::text || 'm' || k)::bigint) % array_length(v_mods, 1))],
                      v_persona, v_hoy, 'sorpresa', orden_en_hora(l.id, v_hoy, cfg.hora_limite))
              on conflict do nothing;
              get diagnostics v_n = row_count; v_generados := v_generados + v_n;
            end if;
          end loop;
        end loop;
      end if;

      -- 3. Depósito: un control por semana, vence el día configurado
      for s in select * from orden_sectores where local_id = l.id and tipo = 'deposito' and activo loop
        v_dia := greatest(v_semana + (cfg.deposito_dia_vence - 1), v_hoy);
        v_persona := case
          when s.responsable_id is not null and exists (
                 select 1 from generate_series(v_hoy, v_dia, interval '1 day') g
                 where orden_trabaja(s.responsable_id, g::date)) then s.responsable_id
          else orden_asignado(s.id, v_hoy) end;
        continue when v_persona is null;
        for mo in select * from orden_modulos where sector_id = s.id and activo loop
          if not exists (select 1 from orden_controles
                         where modulo_id = mo.id and tipo = 'deposito' and fecha between v_semana and v_semana + 6) then
            insert into orden_controles (local_id, modulo_id, persona_id, fecha, tipo, vence_en)
            values (l.id, mo.id, v_persona, v_hoy, 'deposito', orden_en_hora(l.id, v_dia, cfg.hora_limite))
            on conflict do nothing;
            get diagnostics v_n = row_count; v_generados := v_generados + v_n;
          end if;
        end loop;
      end loop;

      -- 4. Cambio de imagen (por defecto, los jueves)
      if cfg.cambio_imagen_dia is not null and v_dow = cfg.cambio_imagen_dia
         and extract(week from v_hoy)::int % greatest(cfg.cambio_imagen_cada_semanas, 1) = 0 then
        for s in select * from orden_sectores where local_id = l.id and tipo = 'salon' and activo loop
          v_persona := orden_asignado(s.id, v_hoy);
          continue when v_persona is null;
          -- una sola vez por sector y día, aunque ya se haya hecho o vencido
          continue when exists (select 1 from orden_tareas where clave = 'imagen:' || s.id || ':' || v_hoy);
          insert into orden_tareas (local_id, persona_id, origen, titulo, detalle, requiere_foto, plazo, vence_en, clave, creado_en)
          values (l.id, v_persona, 'sistema', 'Cambio de imagen: renovar los frontales del sector ' || s.numero,
                  'Mirá el tablero "Frontales de la semana" en Ideas.', false, 'hoy',
                  orden_en_hora(l.id, v_hoy, cfg.hora_limite), 'imagen:' || s.id || ':' || v_hoy, p_ahora)
          on conflict do nothing;
        end loop;
      end if;

      -- 4b. Desafío semanal: llega un día y una hora al azar (distintos para cada vendedor),
      --     alterna los temas semana a semana y no cuenta para faltas: es para aprender.
      if cfg.desafio_activo and v_hora >= cfg.hora_aviso_1 then
        for p in select pe.id from orden_personas pe
                 where pe.local_id = l.id and pe.activo and pe.rol = 'vendedor' and orden_trabaja(pe.id, v_hoy)
                   and not exists (select 1 from orden_desafios d where d.persona_id = pe.id and d.semana = v_semana)
        loop
          select array_agg(g::date order by g) into v_dias
          from generate_series(v_semana, v_semana + 6, interval '1 day') g
          where orden_trabaja(p.id, g::date);
          continue when v_dias is null;
          v_dia := v_dias[1 + (abs(hashtext(p.id::text || v_semana::text || 'desafio')::bigint) % array_length(v_dias, 1))];
          continue when v_dia > v_hoy;  -- si el día elegido ya pasó sin generarse, va hoy
          -- hora al azar entre el aviso de la mañana y el de la tarde
          continue when v_hora < cfg.hora_aviso_1 + make_interval(mins =>
            (abs(hashtext(p.id::text || v_semana::text || 'hora')::bigint)
             % greatest(1, (extract(epoch from (cfg.hora_aviso_2 - cfg.hora_aviso_1)) / 60)::int))::int);

          v_categoria := cfg.desafio_categorias[1 + (extract(week from v_hoy)::int % array_length(cfg.desafio_categorias, 1))];
          v_dif := orden_desafio_dificultad(p.id);
          v_preg := orden_desafio_elegir(p.id, v_categoria, v_dif, cfg.desafio_preguntas);
          continue when v_preg is null;

          insert into orden_desafios (local_id, persona_id, semana, categoria, dificultad, preguntas, total, vence_en, creado_en)
          values (l.id, p.id, v_semana, v_categoria, v_dif, v_preg, array_length(v_preg, 1),
                  orden_calcular_vencimiento(p.id, 'manana', p_ahora), p_ahora)
          on conflict do nothing
          returning id into v_falta;
          continue when v_falta is null;

          perform orden_encolar_aviso(p.id, 'desafio', 'Llegó tu desafío de la semana',
            array_length(v_preg, 1) || ' preguntas rápidas de '
              || case v_categoria when 'producto' then 'telas y molderías' else 'cómo trabajamos en el local' end
              || '. Si le errás, no pasa nada: es para aprender.',
            '/desafio', 'desafio:' || v_falta, 2::smallint);
        end loop;

        -- recordatorio el día que cierra
        if v_hora >= cfg.hora_aviso_2 then
          for r in select d.* from orden_desafios d
                   where d.local_id = l.id and d.terminado_en is null and d.vence_en > p_ahora
                     and (d.vence_en at time zone l.zona_horaria)::date = v_hoy loop
            perform orden_encolar_aviso(r.persona_id, 'desafio', 'Hoy cierra tu desafío',
              'Te quedan ' || (r.total - (select count(*) from jsonb_object_keys(r.respuestas)))::int || ' preguntas.',
              '/desafio', 'desafio-cierre:' || r.id, 1::smallint);
          end loop;
        end if;
      end if;

      -- 5. Aviso de la mañana y 6. recordatorio de la tarde
      if v_hora >= cfg.hora_aviso_1 then
        for p in
          select pe.id,
            (select count(*) from orden_controles c where c.persona_id = pe.id and c.estado = 'pendiente'
               and (c.vence_en at time zone l.zona_horaria)::date = v_hoy)::int as ctl,
            (select count(*) from orden_controles c where c.persona_id = pe.id and c.estado = 'pendiente'
               and c.tipo = 'sorpresa' and c.fecha = v_hoy)::int as sorpresa,
            (select count(*) from orden_tareas t where t.persona_id = pe.id and t.estado = 'pendiente'
               and (t.vence_en at time zone l.zona_horaria)::date = v_hoy)::int as tar
          from orden_personas pe
          where pe.local_id = l.id and pe.activo and pe.rol = 'vendedor' and orden_trabaja(pe.id, v_hoy)
        loop
          continue when p.ctl + p.tar = 0;
          if v_hora < cfg.hora_aviso_2 then
            perform orden_encolar_aviso(p.id, 'dia', 'Hoy: ' || orden_texto_conteo(p.ctl, p.tar),
              case when p.sorpresa > 0 then 'Incluye un control sorpresa. ' else '' end
                || 'Vence a las ' || to_char(cfg.hora_limite, 'HH24:MI') || '.',
              '/hoy', 'dia:' || p.id || ':' || v_hoy, 2::smallint);
          elsif v_hora < cfg.hora_limite then
            perform orden_encolar_aviso(p.id, 'recordatorio', 'Te falta: ' || orden_texto_conteo(p.ctl, p.tar),
              'Vence a las ' || to_char(cfg.hora_limite, 'HH24:MI') || '.',
              '/hoy', 'tarde:' || p.id || ':' || v_hoy, 2::smallint);
          end if;
        end loop;
      end if;
    end if; -- local abierto

    -- 7. Controles vencidos
    for r in
      with v as (
        update orden_controles c set estado = 'vencido'
         where c.local_id = l.id and c.estado = 'pendiente' and c.vence_en <= p_ahora
        returning c.persona_id)
      select v.persona_id, pe.nombre, count(*)::int as n
      from v join orden_personas pe on pe.id = v.persona_id group by v.persona_id, pe.nombre
    loop
      v_ctl_venc := v_ctl_venc + r.n;
      perform orden_encolar_aviso(r.persona_id, 'control_vencido',
        case when r.n = 1 then 'No mandaste 1 control a tiempo' else 'No mandaste ' || r.n || ' controles a tiempo' end,
        'Queda registrado. Si podés, mandalo igual.', '/hoy', 'ctlv:' || r.persona_id || ':' || v_hoy, 1::smallint);
      perform orden_avisar_responsables(l.id, 'supervisores', 'control_vencido',
        r.nombre || ' no mandó ' || case when r.n = 1 then '1 control' else r.n || ' controles' end,
        null, '/equipo', 'ctlv-sup:' || r.persona_id || ':' || v_hoy, 2::smallint);
    end loop;

    -- 8. Tareas vencidas (si pidió más tiempo y no le respondieron, se espera)
    for r in
      with v as (
        update orden_tareas t set estado = 'vencida'
         where t.local_id = l.id and t.estado = 'pendiente' and t.vence_en <= p_ahora
           and t.prorroga_estado is distinct from 'pedida'
        returning t.persona_id)
      select v.persona_id, pe.nombre, count(*)::int as n
      from v join orden_personas pe on pe.id = v.persona_id group by v.persona_id, pe.nombre
    loop
      v_tar_venc := v_tar_venc + r.n;
      perform orden_encolar_aviso(r.persona_id, 'tarea_vencida',
        case when r.n = 1 then 'Se venció 1 tarea' else 'Se vencieron ' || r.n || ' tareas' end,
        'Queda registrado. Hacela igual y marcala como hecha.', '/tareas', 'tarv:' || r.persona_id || ':' || v_hoy, 1::smallint);
      perform orden_avisar_responsables(l.id, 'supervisores', 'tarea_vencida',
        r.nombre || ': ' || case when r.n = 1 then '1 tarea vencida' else r.n || ' tareas vencidas' end,
        null, '/equipo', 'tarv-sup:' || r.persona_id || ':' || v_hoy, 2::smallint);
    end loop;

    -- 9. Fotos que el supervisor no revisó a tiempo → aviso a los admins
    select count(*) into v_n from orden_controles
    where local_id = l.id and estado = 'enviado'
      and enviado_en <= p_ahora - make_interval(hours => cfg.horas_revision_supervisor);
    if v_n > 0 then
      perform orden_avisar_responsables(l.id, 'admins', 'sin_revisar',
        l.nombre || ': ' || v_n || ' foto' || case when v_n = 1 then '' else 's' end || ' sin revisar',
        'Hace más de ' || cfg.horas_revision_supervisor || ' h que esperan revisión.',
        '/revisar', 'rev:' || l.id || ':' || v_hoy, 2::smallint);
    end if;

    -- 10. Abandono: 3 o más controles vencidos en 3 días y ninguna foto
    for p in
      select pe.id, pe.nombre from orden_personas pe
      where pe.local_id = l.id and pe.activo and pe.rol = 'vendedor'
        and (select count(*) from orden_controles c where c.persona_id = pe.id and c.estado = 'vencido'
               and c.vence_en > p_ahora - interval '3 days') >= 3
        and not exists (select 1 from orden_fotos f where f.persona_id = pe.id and f.tomada_en > p_ahora - interval '3 days')
    loop
      perform orden_avisar_responsables(l.id, 'ambos', 'abandono',
        p.nombre || ' no sube fotos hace 3 días', 'Conviene hablar con él hoy.',
        '/equipo', 'aband:' || p.id || ':' || v_semana, 2::smallint);
    end loop;

    -- 11. Faltas sugeridas (apagado en modo prueba). Decide siempre una persona.
    if not cfg.modo_prueba then
      for p in select pe.id, pe.nombre from orden_personas pe
               where pe.local_id = l.id and pe.activo and pe.rol = 'vendedor' loop
        select max(creado_en) into v_ult from orden_faltas where persona_id = p.id;
        v_desde := greatest(p_ahora - make_interval(days => cfg.ventana_faltas_dias), coalesce(v_ult, '-infinity'::timestamptz));

        -- Todo se cuenta en DÍAS: un día malo (5 módulos, o una foto que generó 4 tareas)
        -- cuenta como 1, no como 5.
        select count(distinct (t.vence_en at time zone l.zona_horaria)::date) into v_tv from orden_tareas t
        where t.persona_id = p.id and t.vence_en > v_desde and t.vence_en <= p_ahora
          and (t.estado = 'vencida' or (t.estado = 'hecha' and t.completada_a_tiempo = false));
        select count(distinct c.fecha) into v_cv from orden_controles c
        where c.persona_id = p.id and c.tipo <> 'correccion' and c.vence_en > v_desde and c.vence_en <= p_ahora
          and (c.estado = 'vencido' or c.enviado_en > c.vence_en);
        select count(distinct c.fecha) into v_fde from orden_controles c
        where c.persona_id = p.id and c.nivel_final = 'fuera_de_estandar' and c.revisado_en > v_desde;

        if v_tv >= cfg.umbral_tareas_vencidas or v_cv >= cfg.umbral_dias_sin_control
           or v_fde >= cfg.umbral_fuera_estandar then
          v_tipo := orden_siguiente_sancion(p.id);
          v_motivo := concat_ws(', ',
            case when v_tv  > 0 then v_tv  || ' día(s) con tareas fuera de plazo' end,
            case when v_cv  > 0 then v_cv  || ' día(s) con controles sin mandar a tiempo' end,
            case when v_fde > 0 then v_fde || ' día(s) con controles fuera de estándar' end)
            || ' desde el ' || to_char(v_desde at time zone l.zona_horaria, 'DD/MM');
          -- creado_en = momento evaluado: la próxima cuenta arranca desde acá (no se repite la evidencia)
          insert into orden_faltas (local_id, persona_id, tipo, estado, motivo, evidencia, creado_en)
          values (l.id, p.id, v_tipo, 'sugerida', v_motivo,
                  jsonb_build_object('desde', v_desde, 'hasta', p_ahora, 'dias_tareas_fuera_de_plazo', v_tv,
                                     'dias_sin_control', v_cv, 'dias_fuera_de_estandar', v_fde),
                  p_ahora)
          returning id into v_falta;
          v_faltas := v_faltas + 1;
          perform orden_avisar_responsables(l.id, 'ambos', 'falta_sugerida',
            p.nombre || ': sugerencia de ' || v_tipo::text, v_motivo, '/faltas', 'falta-sug:' || v_falta, 2::smallint);
        end if;
      end loop;
    end if;
  end loop;

  return jsonb_build_object('controles_generados', v_generados, 'controles_vencidos', v_ctl_venc,
                            'tareas_vencidas', v_tar_venc, 'faltas_sugeridas', v_faltas);
end $$;

-- =====================================================================
-- Vistas para las pantallas y las estadísticas de No Compra
-- (security_invoker: cada uno ve solo lo que le permite la seguridad)
-- =====================================================================
create view orden_v_controles with (security_invoker = true) as
select c.*,
       m.numero  as modulo_numero, m.nombre as modulo_nombre, m.foto_referencia_path,
       s.tipo    as sector_tipo,   s.numero as sector_numero,
       pe.nombre as persona_nombre,
       f.foto_path, f.ia_estado, f.ia_resultado, f.tomada_en,
       coalesce(c.nivel_final, c.nivel_ia, c.nivel_declarado) as nivel,
       (c.enviado_en is not null and c.enviado_en <= c.vence_en) as a_tiempo
from orden_controles c
join orden_modulos m on m.id = c.modulo_id
join orden_sectores s on s.id = m.sector_id
left join orden_personas pe on pe.id = c.persona_id
left join orden_fotos f on f.id = c.ultimo_intento_id;

-- Cola del supervisor: primero lo dudoso (no coincide con la IA), después lo peor
create view orden_v_por_revisar with (security_invoker = true) as
select * from orden_v_controles
where estado = 'enviado'
order by discrepancia desc, orden_puntos(nivel) asc nulls first, enviado_en asc;

create view orden_v_tareas with (security_invoker = true) as
select t.*, pe.nombre as persona_nombre, m.nombre as modulo_nombre,
       (t.estado = 'vencida' or (t.estado = 'hecha' and t.completada_a_tiempo = false)) as fuera_de_plazo
from orden_tareas t
left join orden_personas pe on pe.id = t.persona_id
left join orden_modulos m on m.id = t.modulo_id;

-- Resumen por persona y semana (lunes). Un control no enviado cuenta como "Fuera de estándar".
-- Nivel de la semana = promedio de puntos; si hubo algún "Fuera de estándar", no puede ser "Impecable".
create view orden_v_persona_semana with (security_invoker = true) as
with ctl as (
  select c.persona_id, c.local_id, (c.fecha - (extract(isodow from c.fecha)::int - 1)) as semana,
         count(*) as controles,
         count(*) filter (where c.enviado_en <= c.vence_en) as controles_a_tiempo,
         count(*) filter (where c.enviado_en > c.vence_en) as controles_tarde,
         count(*) filter (where c.estado = 'vencido') as controles_vencidos,
         avg(case when c.estado = 'vencido' then 1
                  when c.estado in ('enviado', 'revisado')
                    then orden_puntos(coalesce(c.nivel_final, c.nivel_ia, c.nivel_declarado)) end) as puntos,
         count(*) filter (where c.estado = 'vencido'
                             or coalesce(c.nivel_final, c.nivel_ia, c.nivel_declarado) = 'fuera_de_estandar') as fuera_de_estandar
  from orden_controles c
  where c.persona_id is not null and c.tipo <> 'correccion'
  group by 1, 2, 3
), tar as (
  select t.persona_id, t.local_id,
         ((t.vence_en at time zone l.zona_horaria)::date - (extract(isodow from (t.vence_en at time zone l.zona_horaria))::int - 1)) as semana,
         count(*) filter (where t.estado <> 'cancelada') as tareas,
         count(*) filter (where t.estado = 'hecha') as tareas_hechas,
         count(*) filter (where t.estado = 'hecha' and t.completada_a_tiempo) as tareas_a_tiempo,
         count(*) filter (where t.estado = 'vencida' or (t.estado = 'hecha' and t.completada_a_tiempo = false)) as tareas_fuera_de_plazo,
         count(*) filter (where t.estado = 'no_pude') as tareas_no_pude,
         count(*) filter (where t.estado = 'pendiente') as tareas_pendientes,
         count(*) filter (where t.origen = 'ia') as tareas_de_ia
  from orden_tareas t join orden_locales l on l.id = t.local_id
  where t.persona_id is not null
  group by 1, 2, 3
)
select coalesce(ctl.persona_id, tar.persona_id) as persona_id,
       coalesce(ctl.local_id, tar.local_id)     as local_id,
       coalesce(ctl.semana, tar.semana)         as semana,
       pe.nombre as persona_nombre,
       coalesce(ctl.controles, 0)          as controles,
       coalesce(ctl.controles_a_tiempo, 0) as controles_a_tiempo,
       coalesce(ctl.controles_tarde, 0)    as controles_tarde,
       coalesce(ctl.controles_vencidos, 0) as controles_vencidos,
       round(ctl.puntos, 2)                as puntos,
       case when coalesce(ctl.fuera_de_estandar, 0) > 0
            then least(orden_nivel_desde_puntos(ctl.puntos), 'bien'::orden_nivel)
            else orden_nivel_desde_puntos(ctl.puntos) end as nivel_semana,
       coalesce(tar.tareas, 0)                as tareas,
       coalesce(tar.tareas_hechas, 0)         as tareas_hechas,
       coalesce(tar.tareas_a_tiempo, 0)       as tareas_a_tiempo,
       coalesce(tar.tareas_fuera_de_plazo, 0) as tareas_fuera_de_plazo,
       coalesce(tar.tareas_no_pude, 0)        as tareas_no_pude,
       coalesce(tar.tareas_pendientes, 0)     as tareas_pendientes,
       coalesce(tar.tareas_de_ia, 0)          as tareas_de_ia,
       de.puntaje                             as desafio_puntaje,  -- null = no tenía desafío esa semana
       de.total                               as desafio_total,
       (de.terminado_en is not null)          as desafio_terminado
from ctl
full join tar on tar.persona_id = ctl.persona_id and tar.semana = ctl.semana
left join orden_personas pe on pe.id = coalesce(ctl.persona_id, tar.persona_id)
left join orden_desafios de on de.persona_id = coalesce(ctl.persona_id, tar.persona_id)
                           and de.semana = coalesce(ctl.semana, tar.semana);

-- Productos testigo con los cálculos
-- Vendida    = Enviada − Dev. a fábrica − Salieron + Entraron − Stock sistema
-- Diferencia = Stock sistema − Cantidad real (positivo = falta mercadería)
-- Desvío     = PENDIENTE: confirmar con Mau cómo lo calcula la planilla
create view testigo_v_items with (security_invoker = true) as
select i.*, s.local_id, s.semana,
       (i.enviada - i.dev_fabrica - i.salieron + i.entraron - i.stock_sistema) as vendida,
       (i.stock_sistema - i.cantidad_real) as diferencia,
       null::numeric as desvio
from testigo_items i join testigo_semanas s on s.id = i.semana_id;

-- Resumen semanal de un local (lo usa la Edge Function resumen-semanal)
create or replace function orden_resumen_semanal(p_local uuid, p_semana date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not orden_ve_equipo(p_local) then raise exception 'Sin acceso a ese local'; end if;
  select jsonb_build_object(
    'local', (select nombre from orden_locales where id = p_local),
    'semana', p_semana,
    'controles', coalesce(sum(controles), 0),
    'controles_a_tiempo', coalesce(sum(controles_a_tiempo), 0),
    'controles_vencidos', coalesce(sum(controles_vencidos), 0),
    'controles_tarde', coalesce(sum(controles_tarde), 0),
    'tareas', coalesce(sum(tareas), 0),
    'tareas_hechas', coalesce(sum(tareas_hechas), 0),
    'tareas_fuera_de_plazo', coalesce(sum(tareas_fuera_de_plazo), 0),
    'tareas_pendientes', coalesce(sum(tareas_pendientes), 0),
    'nivel_local', orden_nivel_texto(orden_nivel_desde_puntos(avg(puntos))),
    'personas', coalesce(jsonb_agg(jsonb_build_object(
        'nombre', persona_nombre, 'nivel', orden_nivel_texto(nivel_semana),
        'controles', controles, 'controles_a_tiempo', controles_a_tiempo,
        'tareas', tareas, 'tareas_hechas', tareas_hechas, 'tareas_fuera_de_plazo', tareas_fuera_de_plazo,
        'desafio_puntaje', desafio_puntaje, 'desafio_total', desafio_total)
        order by puntos desc nulls last), '[]'::jsonb),
    'sin_revisar', (select count(*) from orden_controles where local_id = p_local and estado = 'enviado'),
    'sin_avisos', (select coalesce(jsonb_agg(pe.nombre order by pe.nombre), '[]'::jsonb) from orden_personas pe
                   where pe.local_id = p_local and pe.activo and pe.rol = 'vendedor'
                     and not exists (select 1 from orden_push_subs s where s.persona_id = pe.id)),
    'faltas_sugeridas', (select coalesce(jsonb_agg(pe.nombre || ' (' || f.tipo || ')'), '[]'::jsonb)
                         from orden_faltas f join orden_personas pe on pe.id = f.persona_id
                         where f.local_id = p_local and f.estado = 'sugerida')
  ) into v
  from orden_v_persona_semana where local_id = p_local and semana = p_semana;
  return v;
end $$;

-- =====================================================================
-- Seguridad (RLS)
-- Lecturas: cada uno ve lo suyo; el supervisor ve su local; el admin todo.
-- Escrituras del vendedor: solo a través de las funciones de arriba (y su perfil).
-- Configuración (locales, personas, sectores, módulos, reglas, horarios, qué está prendido):
-- SOLO el admin, desde No Compra. El supervisor revisa, asigna tareas, decide faltas,
-- controla cajas y carga francos/vacaciones (ausencias).
-- =====================================================================
alter table orden_locales     enable row level security;
alter table orden_personas    enable row level security;
alter table orden_ausencias   enable row level security;
alter table orden_sectores    enable row level security;
alter table orden_exhibidores enable row level security;
alter table orden_modulos     enable row level security;
alter table orden_reglas      enable row level security;
alter table orden_colores     enable row level security;
alter table orden_config      enable row level security;
alter table orden_controles   enable row level security;
alter table orden_fotos       enable row level security;
alter table orden_tareas      enable row level security;
alter table orden_avisos      enable row level security;
alter table orden_push_subs   enable row level security;
alter table orden_faltas      enable row level security;
alter table orden_tableros    enable row level security;
alter table orden_preguntas   enable row level security;
alter table orden_desafios    enable row level security;
alter table testigo_semanas   enable row level security;
alter table testigo_items     enable row level security;

create policy ver on orden_locales for select to authenticated using (orden_ve_local(id));
create policy admin on orden_locales for all to authenticated using (orden_es_admin()) with check (orden_es_admin());

create policy ver on orden_personas for select to authenticated
  using (auth_user_id = auth.uid() or orden_ve_local(local_id) or orden_es_admin());
create policy editar on orden_personas for all to authenticated
  using (orden_es_admin()) with check (orden_es_admin());

create policy ver on orden_ausencias for select to authenticated using (exists (
  select 1 from orden_personas p where p.id = persona_id and (p.id = orden_yo_id() or orden_ve_equipo(p.local_id))));
create policy editar on orden_ausencias for all to authenticated
  using (exists (select 1 from orden_personas p where p.id = persona_id and orden_es_supervisor_de(p.local_id)))
  with check (exists (select 1 from orden_personas p where p.id = persona_id and orden_es_supervisor_de(p.local_id)));

create policy ver on orden_sectores for select to authenticated using (orden_ve_local(local_id));
create policy editar on orden_sectores for all to authenticated
  using (orden_es_admin()) with check (orden_es_admin());

create policy ver on orden_exhibidores for select to authenticated using (true);
create policy editar on orden_exhibidores for all to authenticated using (orden_es_admin()) with check (orden_es_admin());

create policy ver on orden_modulos for select to authenticated using (exists (
  select 1 from orden_sectores s where s.id = sector_id and orden_ve_local(s.local_id)));
create policy editar on orden_modulos for all to authenticated
  using (orden_es_admin()) with check (orden_es_admin());

create policy ver on orden_reglas for select to authenticated using (local_id is null or orden_ve_local(local_id));
create policy editar on orden_reglas for all to authenticated
  using (orden_es_admin()) with check (orden_es_admin());

create policy ver on orden_colores for select to authenticated using (true);
create policy editar on orden_colores for all to authenticated using (orden_es_admin()) with check (orden_es_admin());

create policy ver on orden_config for select to authenticated using (orden_ve_local(local_id));
create policy editar on orden_config for all to authenticated
  using (orden_es_admin()) with check (orden_es_admin());

create policy ver on orden_controles for select to authenticated
  using (persona_id = orden_yo_id() or orden_ve_equipo(local_id));
-- Sin escritura directa: todo pasa por las funciones, que validan.

create policy ver on orden_fotos for select to authenticated
  using (exists (select 1 from orden_controles c where c.id = control_id));

create policy ver on orden_tareas for select to authenticated
  using (persona_id = orden_yo_id() or orden_ve_equipo(local_id));
-- Sin escritura directa: crear, cancelar y cerrar tareas pasa por las funciones.

create policy ver on orden_avisos for select to authenticated using (persona_id = orden_yo_id() or orden_es_admin());

create policy ver on orden_push_subs for select to authenticated using (persona_id = orden_yo_id());
create policy borrar on orden_push_subs for delete to authenticated using (persona_id = orden_yo_id());

create policy ver on orden_faltas for select to authenticated
  using ((persona_id = orden_yo_id() and estado = 'confirmada') or orden_ve_equipo(local_id));

create policy ver on orden_tableros for select to authenticated using (local_id is null or orden_ve_local(local_id));
create policy editar on orden_tableros for all to authenticated
  using (orden_es_admin()) with check (orden_es_admin());

-- El banco de preguntas tiene las respuestas: solo supervisores y admins
create policy ver on orden_preguntas for select to authenticated using (
  orden_es_admin() or exists (select 1 from orden_personas where auth_user_id = auth.uid() and activo and rol = 'supervisor'));
create policy editar on orden_preguntas for all to authenticated using (orden_es_admin()) with check (orden_es_admin());

create policy ver on orden_desafios for select to authenticated
  using (persona_id = orden_yo_id() or orden_ve_equipo(local_id));

create policy ver on testigo_semanas for select to authenticated using (orden_ve_equipo(local_id));
create policy ver on testigo_items for select to authenticated
  using (exists (select 1 from testigo_semanas s where s.id = semana_id and orden_ve_equipo(s.local_id)));
create policy todo on testigo_semanas for all to authenticated
  using (orden_es_supervisor_de(local_id)) with check (orden_es_supervisor_de(local_id));
create policy todo on testigo_items for all to authenticated
  using (exists (select 1 from testigo_semanas s where s.id = semana_id and orden_es_supervisor_de(s.local_id)))
  with check (exists (select 1 from testigo_semanas s where s.id = semana_id and orden_es_supervisor_de(s.local_id)));

-- ---------- Permisos ----------
do $$
declare t text; f record;
begin
  -- Tablas y vistas: nada para anónimos; RLS decide para los usuarios logueados
  foreach t in array array[
    'orden_locales','orden_personas','orden_ausencias','orden_sectores','orden_exhibidores','orden_modulos',
    'orden_reglas','orden_colores','orden_config','orden_controles','orden_fotos','orden_tareas','orden_avisos',
    'orden_push_subs','orden_faltas','orden_tableros','orden_preguntas','orden_desafios','testigo_semanas','testigo_items',
    'orden_v_controles','orden_v_por_revisar','orden_v_tareas','orden_v_persona_semana','testigo_v_items']
  loop
    execute format('revoke all on table %I from anon', t);
    execute format('grant select, insert, update, delete on table %I to authenticated', t);
    execute format('grant all on table %I to service_role', t);
  end loop;

  -- Funciones: ninguna para anónimos
  for f in select p.oid::regprocedure as firma, p.proname from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'orden\_%'
  loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to service_role', f.firma);
    -- Las que solo debe usar el servidor (Edge Functions con la clave de servicio)
    if f.proname in ('orden_tick', 'orden_aplicar_resultado_ia', 'orden_marcar_error_ia',
                     'orden_encolar_aviso', 'orden_avisar_responsables',
                     'orden_siguiente_sancion', 'orden_desafio_dificultad', 'orden_desafio_elegir') then
      execute format('revoke all on function %s from authenticated', f.firma);
    else
      execute format('grant execute on function %s to authenticated', f.firma);
    end if;
  end loop;
end $$;
