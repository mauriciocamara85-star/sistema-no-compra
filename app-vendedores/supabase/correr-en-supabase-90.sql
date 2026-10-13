-- ═══ SQL 90 (12/10/2026) · la app de los vendedores: la base y el login ═══
-- Control de orden de los módulos con fotos e IA, tareas, avisos, desafío y
-- control de caja (estos dos, apagados). Todo con prefijo orden_ y testigo_:
-- no toca nada de lo que ya existe, salvo DESACTIVAR (no borrar) la fila
-- suelta "RIVADAVIA / Mau" del equipo (pedido de Mauricio).
--   · El local piloto se muestra como "Rivadavia" (en No Compra es
--     MAR DEL PLATA): Lautaro, Nano, Seba y Mel, con sus francos.
--     Mauricio, administrador y supervisor, sin módulos.
--   · El login: local → nombre → PIN de 4 números, una vez por celular.
--     Freno: 5 PIN mal seguidos y espera 5 minutos, por persona.
--   · AL FINAL MUESTRA EL PIN DE CADA UNO, UNA SOLA VEZ: anotalos.
--     Si se pierde uno: select nombre, orden_pin_sortear(id) as pin
--                       from orden_personas where nombre = 'Lautaro';
-- Corre entero o no hace nada: pegado entero en el editor, Postgres lo corre
-- como un solo bloque y, si algo falla, lo deshace todo y no deja nada tomado.
-- (Sin "begin;" a mano a propósito: con un begin, un error deja la conexión
-- trabada en una transacción fallida, con tablas tomadas, hasta que se cierra.)
-- Si ya se corrió, avisa y no cambia nada.
-- El reloj automático (pg_cron) va en otro SQL, con las funciones del servidor.

do $$
begin
  if to_regclass('public.orden_personas') is not null then
    raise exception 'El SQL 90 ya está corrido: no hace falta correrlo de nuevo (no se cambió nada).';
  end if;
  if not exists (select 1 from locales where codigo = 'MAR DEL PLATA') then
    raise exception 'No encuentro el local MAR DEL PLATA en la tabla locales (no se cambió nada).';
  end if;
end $$;


-- ████████ 20261012000001_orden_esquema.sql ████████

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


-- ████████ 20261012000002_orden_storage.sql ████████

-- =====================================================================
-- Módulo VDH · Migración 2: bucket de fotos (solo en Supabase)
-- Estructura de carpetas:  {local_id}/{fecha}/{control_id}/{archivo}.jpg
--                          {local_id}/tareas/{tarea_id}/{archivo}.jpg
--                          {local_id}/referencias/{modulo_id}.jpg
--                          {local_id}/cajas/{fecha}/{tipo}-{archivo}.jpg   (control de caja)
--                          preguntas/{pregunta_id}.jpg   (fotos de telas y prendas del desafío)
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('orden-fotos', 'orden-fotos', false, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

-- Subir: solo dentro de la carpeta de tu local (admins: cualquier carpeta)
create policy "orden: subir fotos de mi local" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'orden-fotos'
  and (orden_es_admin()
       or (storage.foldername(name))[1] = (select local_id::text from orden_personas
                                           where auth_user_id = auth.uid() and activo limit 1))
);

-- Ver: las fotos de tu local y las del desafío.
-- Las fotos de caja solo las ven supervisores y admins (los vendedores ven la de hoy en su celular, no hace falta bajarla).
create policy "orden: ver fotos de mi local" on storage.objects
for select to authenticated
using (
  bucket_id = 'orden-fotos'
  and (orden_es_admin()
       or orden_es_gerencia()
       or (storage.foldername(name))[1] = 'preguntas'
       or ((storage.foldername(name))[1] = (select local_id::text from orden_personas
                                            where auth_user_id = auth.uid() and activo limit 1)
           and ((storage.foldername(name))[2] is distinct from 'cajas'
                or orden_es_supervisor_de(((storage.foldername(name))[1])::uuid))))
);

-- Borrar: solo supervisores/admins (los vendedores no pueden borrar evidencia)
create policy "orden: borrar fotos (supervisores)" on storage.objects
for delete to authenticated
using (
  bucket_id = 'orden-fotos'
  and (orden_es_admin()
       or exists (select 1 from orden_personas
                  where auth_user_id = auth.uid() and activo and rol = 'supervisor'
                    and local_id::text = (storage.foldername(name))[1]))
);


-- ████████ 20261012000004_orden_datos_iniciales.sql ████████

-- =====================================================================
-- Módulo VDH · Migración 4: datos iniciales
--   · Reglas de orden (las que dio Mau, editables después desde No Compra)
--   · Regla de colores (PROPUESTA: Mau tiene que confirmar el orden)
--   · Tipos de exhibidor (falta cargar mínimo y máximo de prendas)
--   · Local piloto Rivadavia (en No Compra: MAR DEL PLATA) con su
--     equipo, sectores y módulos
-- Todo se puede cambiar después desde la configuración.
-- =====================================================================

-- ---------- Reglas de orden (todos los locales) ----------
insert into orden_reglas (sector_tipo, check_clave, texto, orden) values
  ('salon', 'frontales',  'Cada frontal lleva 4 prendas.', 1),
  ('salon', 'frontales',  'La prenda del frontal también tiene que estar doblada en un estante del mismo módulo (por ejemplo, del lado izquierdo, en el estante del medio).', 2),
  ('salon', 'frontales',  'Si no hay más stock para completar un frontal, se cambia por otro producto. Nunca se deja incompleto.', 3),
  ('salon', 'dobladas',   'Prendas dobladas prolijas, del mismo tamaño, en pilas parejas y derechas.', 1),
  ('salon', 'dobladas',   'Estantes sin huecos: no puede faltar mercadería en un estante.', 2),
  ('salon', 'etiquetas',  'Etiquetas adentro de la prenda, sin que cuelguen.', 1),
  ('salon', 'limpieza',   'Módulo limpio: sin polvo, bolsas, cajas, perchas sueltas, vasos ni cosas personales a la vista.', 1),
  ('salon', 'exhibicion', 'Percheros de colección nueva ordenados por color, en degradé del más claro al más oscuro (ver regla de colores).', 1),
  ('salon', 'exhibicion', 'En los estantes de arriba de un perchero van los mismos colores que las prendas colgadas.', 2),
  ('salon', 'exhibicion', 'Cada exhibidor tiene una cantidad ideal de prendas: ni muy lleno ni muy vacío.', 3),
  ('deposito', 'dobladas',  'Prendas dobladas en tamaño A4 parejo.', 1),
  ('deposito', 'talles',    'Separado por segmento (tipo de prenda) y por talle.', 1),
  ('deposito', 'rotulado',  'Estantes o cajas rotulados y que se lean bien.', 1),
  ('deposito', 'limpieza',  'Pasillos libres, sin cajas abiertas desordenadas y limpio.', 1);

-- ---------- Regla de colores (PROPUESTA, del más claro al más oscuro) ----------
insert into orden_colores (orden, nombre, hex) values
  (1,  'Blanco',               '#FFFFFF'),
  (2,  'Crudo / natural',      '#EFE8D8'),
  (3,  'Beige / arena',        '#D9C7A7'),
  (4,  'Gris claro / melange', '#C9CACC'),
  (5,  'Celeste',              '#A9C8E4'),
  (6,  'Camel',                '#B98A54'),
  (7,  'Gris topo',            '#7E7770'),
  (8,  'Verde oliva / militar','#6B6B3A'),
  (9,  'Azul',                 '#2F4F8F'),
  (10, 'Bordó',                '#6D1F2B'),
  (11, 'Marrón / chocolate',   '#4E3527'),
  (12, 'Gris oscuro / grafito','#3C3F44'),
  (13, 'Azul marino',          '#1F2A44'),
  (14, 'Negro',                '#111111');

-- ---------- Tipos de exhibidor (Mau pasa las cantidades) ----------
insert into orden_exhibidores (nombre, prendas_min, prendas_max, notas) values
  ('Módulo con estantes',          null, null, 'Frontales de 4 prendas.'),
  ('Perchero de colección nueva',  null, null, 'Por color, en degradé.'),
  ('Perchero de pared',            null, null, null),
  ('Mesa',                         null, null, null);

-- ---------- Local piloto: Rivadavia ----------
-- En la app se muestra "Rivadavia"; en No Compra es MAR DEL PLATA (codigo) desde el 24/09/2026.
-- Abre todos los días: lunes a sábado de 9 a 21 y domingo de 10 a 21
-- (acá va un solo horario: 9 a 21).
-- Francos (ISO: 1 = lunes ... 7 = domingo): Seba el martes, Nano el miércoles,
-- Lautaro el jueves. Mel es el franquero: trabaja solo martes, miércoles y
-- jueves, y cubre el sector del que tiene franco.
-- El supervisor del local es Mauricio (admin: ve y revisa todos los locales).
-- Las iniciales del apellido (para la lista del login) se cargan después.
do $$
declare
  v_local uuid; v_lautaro uuid; v_nano uuid; v_seba uuid; v_mel uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid; v_d1 uuid; v_d2 uuid; v_d3 uuid; v_ex uuid; n int;
begin
  insert into orden_locales (nombre, codigo, dias_abiertos, hora_apertura, hora_cierre)
  values ('Rivadavia', 'MAR DEL PLATA', '{1,2,3,4,5,6,7}', '09:00', '21:00') returning id into v_local;
  insert into orden_config (local_id) values (v_local);

  -- equipo_id: la misma persona en el equipo de la Carga de No Compra
  insert into orden_personas (nombre, rol, local_id) values ('Mauricio', 'admin', null);
  insert into orden_personas (nombre, rol, local_id, dias_libres, equipo_id)
    values ('Lautaro', 'vendedor', v_local, '{4}',
            (select id from equipo where local = 'MAR DEL PLATA' and lower(trim(vendedor)) in ('lau', 'lautaro') order by id limit 1))
    returning id into v_lautaro;
  insert into orden_personas (nombre, rol, local_id, dias_libres, equipo_id)
    values ('Nano', 'vendedor', v_local, '{3}',
            (select id from equipo where local = 'MAR DEL PLATA' and lower(trim(vendedor)) = 'nano' order by id limit 1))
    returning id into v_nano;
  insert into orden_personas (nombre, rol, local_id, dias_libres, equipo_id)
    values ('Seba', 'vendedor', v_local, '{2}',
            (select id from equipo where local = 'MAR DEL PLATA' and lower(trim(vendedor)) = 'seba' order by id limit 1))
    returning id into v_seba;
  insert into orden_personas (nombre, rol, local_id, dias_libres, equipo_id)
    values ('Mel', 'vendedor', v_local, '{1,5,6,7}',
            (select id from equipo where local = 'MAR DEL PLATA' and lower(trim(vendedor)) = 'mel' order by id limit 1))
    returning id into v_mel;

  -- Salón: sector 1 Lautaro, 2 Nano, 3 Seba. Mel (franquero) cubre al que no está.
  insert into orden_sectores (local_id, tipo, numero, responsable_id, suplente_id)
    values (v_local, 'salon', 1, v_lautaro, v_mel) returning id into v_s1;
  insert into orden_sectores (local_id, tipo, numero, responsable_id, suplente_id)
    values (v_local, 'salon', 2, v_nano, v_mel) returning id into v_s2;
  insert into orden_sectores (local_id, tipo, numero, responsable_id, suplente_id)
    values (v_local, 'salon', 3, v_seba, v_mel) returning id into v_s3;

  -- Depósito: sector 1 Nano, 2 Lautaro, 3 Seba
  insert into orden_sectores (local_id, tipo, numero, responsable_id, suplente_id)
    values (v_local, 'deposito', 1, v_nano, v_mel) returning id into v_d1;
  insert into orden_sectores (local_id, tipo, numero, responsable_id, suplente_id)
    values (v_local, 'deposito', 2, v_lautaro, v_mel) returning id into v_d2;
  insert into orden_sectores (local_id, tipo, numero, responsable_id, suplente_id)
    values (v_local, 'deposito', 3, v_seba, v_mel) returning id into v_d3;

  -- 15 módulos del salón (5 por sector), numerados 1 a 15 en el local
  select id into v_ex from orden_exhibidores where nombre = 'Módulo con estantes';
  for n in 1..15 loop
    insert into orden_modulos (sector_id, numero, nombre, exhibidor_id)
    values (case when n <= 5 then v_s1 when n <= 10 then v_s2 else v_s3 end, n, 'Módulo ' || n, v_ex);
  end loop;

  -- Un "módulo" por sector del depósito (una foto por semana)
  insert into orden_modulos (sector_id, numero, nombre) values (v_d1, 1, 'Depósito sector 1');
  insert into orden_modulos (sector_id, numero, nombre) values (v_d2, 1, 'Depósito sector 2');
  insert into orden_modulos (sector_id, numero, nombre) values (v_d3, 1, 'Depósito sector 3');
end $$;

-- La fila que quedó de cuando el local se llamaba RIVADAVIA: se desactiva, no se borra (pedido de Mauricio)
update equipo set activo = false where local = 'RIVADAVIA' and vendedor = 'Mau';


-- ████████ 20261012000005_orden_preguntas.sql ████████

-- =====================================================================
-- Módulo VDH · Banco de preguntas del desafío semanal
-- Sacadas de: "Explicación de telas y su uso en artículos",
--             "Molderías VDH" y "Manual Retail 2025".
-- Dificultad: 1 = básico, 2 = intermedio, 3 = detalle fino.
-- Todo editable desde No Compra. Si cambia un manual (ej. códigos de
-- cuotas), hay que actualizar las preguntas con esa fuente.
-- =====================================================================

insert into orden_preguntas (tema, dificultad, fuente, pregunta, opciones, correcta, explicacion) values

-- ------------------------------ TELAS ------------------------------
('tela', 1, 'Telas y su uso', '¿Qué composición tiene el Jersey 40/1?',
 array['100% algodón', '50% algodón y 50% poliéster', '80% algodón y 20% poliéster', '98% algodón y 2% elastano'], 2,
 'El Jersey 40/1 es 50% algodón y 50% poliéster. Lo usamos en la mayoría de las remeras de moldería regular, como la Clásica O.'),

('tela', 1, 'Telas y su uso', '¿En qué remeras usamos sobre todo el Jersey 24/1?',
 array['En las regulares, como la Clásica O', 'En la mayoría de las oversize, como la Overs', 'Solo en las chombas', 'En las camisas'], 2,
 'El Jersey 24/1 (100% algodón) es pesado y suave. Lo usamos en la mayoría de las remeras oversize, por ejemplo la Overs.'),

('tela', 2, 'Telas y su uso', 'De estos jerseys, ¿cuál es el más pesado?',
 array['Jersey 40/1', 'Jersey 24/1', 'Jersey 20/1', 'Pesan todos igual'], 3,
 'El 20/1 es más pesado que el 24/1, y el 24/1 más que el 40/1. El 20/1 lo usamos en remeras over, extra over, Hi y Boxy.'),

('tela', 1, 'Telas y su uso', 'Un cliente compra una remera de Jersey 24/1. ¿Qué le recomendás para lavarla?',
 array['Agua caliente para que no encoja', 'Agua fría, separando colores y colgarla a la sombra', 'Secarropas en temperatura alta', 'Secarla al sol para que no quede humedad'], 2,
 'Es 100% algodón: muy linda por ser natural pero menos estable que las sintéticas. Siempre agua fría, colores separados y secado a la sombra.'),

('tela', 2, 'Telas y su uso', '¿Por qué el Jersey 40/1 casi no se arruga y seca rápido?',
 array['Por su porcentaje de poliéster', 'Porque es 100% algodón', 'Porque tiene elastano', 'Porque es más pesado'], 1,
 'El poliéster (50% en el 40/1) hace que la tela no tienda a arrugarse y que seque rápido.'),

('tela', 2, 'Telas y su uso', 'La frisa liviana esmerilada tiene un "pelito" suave. ¿Qué es?',
 array['Una falla de fabricación', 'El acabado esmerilado que le da la suavidad', 'Pelusa que se va con el primer lavado', 'Un forro que se cose aparte'], 2,
 'Ese "pelito" es el acabado esmerilado, y es lo que le da la suavidad al tacto. Es la tela de la mayoría de buzos y pantalones de invierno, como el Colston Relax.'),

('tela', 2, 'Telas y su uso', '¿Qué composición tiene la frisa liviana esmerilada?',
 array['50% algodón y 50% poliéster', '100% algodón', '80% algodón y 20% poliéster', '100% poliéster'], 3,
 'Es 80% algodón y 20% poliéster. La frisa algodón poliéster, en cambio, es 50 y 50.'),

('tela', 3, 'Telas y su uso', '¿Cómo distinguís a simple vista la frisa algodón poliéster de la frisa liviana esmerilada?',
 array['La algodón poliéster no tiene el "pelito" y es más pesada', 'La algodón poliéster es brillante', 'La esmerilada es más pesada', 'No se pueden distinguir'], 1,
 'La frisa algodón poliéster es más pesada y no tiene el "pelito" del esmerilado. La usamos en algunos buzos y pantalones como el Nesta Relax o el Ader Over.'),

('tela', 1, 'Telas y su uso', '¿Cómo se lavan los buzos y pantalones de frisa?',
 array['Del derecho y con agua tibia', 'Del revés, con agua fría y secado a la sombra', 'Solo en tintorería', 'Con suavizante y al sol'], 2,
 'Para todas las frisas: siempre del revés, agua fría y secar a la sombra.'),

('tela', 2, 'Telas y su uso', '¿En qué prendas usamos el Rústico Pesado?',
 array['En la mayoría de los buzos y pantalones, como el Journey Relax', 'En las camisas', 'En las camperas de jean', 'En las chombas'], 1,
 'El Rústico Pesado (50% algodón, 50% poliéster) no tiende a arrugarse. Lo usamos en la mayoría de los buzos y pantalones, por ejemplo el Journey Relax (buzo y pantalón).'),

('tela', 1, 'Telas y su uso', '¿De qué tela son la mayoría de nuestras chombas, como la Aries?',
 array['Piqué 30/1, 100% algodón', 'Jersey 40/1', 'Frisa esmerilada', 'Poplin con elastano'], 1,
 'La mayoría son de Piqué 30/1: liviano, respirable y 100% algodón.'),

('tela', 3, 'Telas y su uso', 'La chomba Tari no es de piqué. ¿De qué tela es?',
 array['Gabardina', 'Jersey 24/1, la misma de las remeras', 'Lino', 'Rústico'], 2,
 'Algunas chombas se hacen en Jersey 24/1, la misma tela de remería. Llevan el mismo cuidado: agua fría, colores separados y secado a la sombra.'),

('tela', 2, 'Telas y su uso', '¿Qué tela usamos en la mayoría de las camisas manga larga, como la Sigma o la Venecia?',
 array['Lino 100%', 'Poplin con elastano (98% algodón y 2% elastano)', 'Jersey 24/1', 'Gabardina rígida'], 2,
 'El poplin con elastano es liviano, elastizado y respirable gracias a su alto porcentaje de algodón.'),

('tela', 2, 'Telas y su uso', '¿Qué composición tiene la gabardina con elastano de pantalones como el New Dalis?',
 array['100% algodón', '97% algodón y 3% elastano', '50% algodón y 50% poliéster', '100% poliéster'], 2,
 'Es 97% algodón y 3% elastano: liviana, elastizada, noble y resistente.'),

('tela', 1, 'Telas y su uso', 'La mayoría de nuestros jeans son…',
 array['Rígidos, 100% algodón', 'Elastizados, 98% algodón y 2% elastano', 'De poliéster', 'De gabardina'], 2,
 'La gran mayoría son elastizados (98% algodón y 2% elastano) y algunos pocos de denim rígido 100% algodón. Todos son durables y resistentes.'),

('tela', 1, 'Telas y su uso', '¿Cómo recomendás lavar un jean?',
 array['Del revés, con agua fría y secado a la sombra', 'Con lavandina para que no se destiña', 'Del derecho y al sol', 'Con agua caliente'], 1,
 'Igual que las frisas: del revés, agua fría y secar a la sombra. Las camperas de jean llevan el mismo cuidado.'),

('tela', 2, 'Telas y su uso', '¿De qué tela suelen ser las camperas de jean, como la Essence 90s?',
 array['Denim elastizado', 'Denim rígido 100% algodón', 'Frisa', 'Poliéster'], 2,
 'Generalmente usamos denim rígido 100% algodón: muy durable y resistente.'),

('tela', 3, 'Telas y su uso', 'Las camperas de telas de fantasía, como la Tolhuin CP o la Giovani, ¿qué composición suelen tener?',
 array['100% algodón', '100% poliéster', '50% algodón y 50% poliéster', '98% algodón y 2% elastano'], 2,
 'Suelen ser 100% poliéster: durables en el tiempo, y algunas más resistentes al viento.'),

('tela', 2, 'Telas y su uso', '¿Qué tienen en común las telas tipo "lino" que usamos?',
 array['Son pesadas y abrigadas', 'Son livianas y frescas; algunas tienen elastano', 'Son 100% poliéster', 'Se pueden lavar con agua caliente'], 2,
 'Son livianas y frescas. Algunas tienen elastano y estiran un poco más que las 100% algodón. Se lavan con agua fría y se secan a la sombra.'),

-- ---------------------------- MOLDERÍAS ----------------------------
('molderia', 1, 'Molderías VDH', '¿Cómo es el calce de una remera regular, como la Clásica O o la Daily?',
 array['Muy suelta y con hombro caído', 'Regular, ligeramente entallada', 'Corta y ancha', 'Extra oversize'], 2,
 'La regular tiene un calce regular, ligeramente entallado.'),

('molderia', 1, 'Molderías VDH', '¿Qué caracteriza a una remera oversize, como la Overs?',
 array['Es entallada', 'Es suelta, más ancha que la regular y con los hombros ligeramente caídos', 'Es más corta que la Boxy', 'Tiene el cuello más alto'], 2,
 'La oversize es suelta, más ancha que la regular y con los hombros ligeramente caídos.'),

('molderia', 2, 'Molderías VDH', 'La remera Oversize "Hi", como la Zen Hi, comparada con la oversize clásica…',
 array['Es un poco más corta y tiene el cuello más alto', 'Es más larga y entallada', 'Es igual pero de otra tela', 'Es más ancha de hombros'], 1,
 'La Hi tiene calce oversize, pero es un poco más corta y con el cuello más alto.'),

('molderia', 2, 'Molderías VDH', '¿Qué moldería de remera es la más corta?',
 array['Oversize', 'Oversize Hi', 'Boxy', 'X-Over'], 3,
 'La Boxy (por ejemplo, la Nois Boxy) tiene calce oversize pero es más corta que la Oversize y que la Hi.'),

('molderia', 2, 'Molderías VDH', '¿Qué es la moldería X-Over?',
 array['Una regular con cuello alto', 'Un calce extra oversize, más amplio que la oversize', 'Una remera corta y entallada', 'Una camisa'], 2,
 'La X-Over es extra oversize, más amplia que la oversize. Ejemplos: Eminem X-Over en remera, Vibe X-Over en buzo.'),

('molderia', 3, 'Molderías VDH', '¿Qué es la terminación "collareta cortada"?',
 array['Un cuello con botones', 'Una tira de tela en cuello y mangas que después se corta', 'Un estampado en el cuello', 'Un cuello alto tipo Hi'], 2,
 'Es una tira de tela que se aplica en el cuello y las mangas y después se corta. Es una variación de la remera regular.'),

('molderia', 2, 'Molderías VDH', 'En el lavado "Maltinto" o "Fade Out" hecho del revés, ¿qué queda del lado de afuera?',
 array['La parte más oscura', 'El lado más claro', 'Un estampado', 'Nada cambia'], 2,
 'Del derecho, la parte oscura del lavado queda afuera. Del revés, queda afuera el lado más claro. Ejemplos: Inky e Ink Over.'),

('molderia', 3, 'Molderías VDH', '¿Qué se ve en una remera con lavado "Acid", como la Seventy Boxy?',
 array['Un desgaste en el color', 'Roturas', 'Un brillo metalizado', 'Un estampado en relieve'], 1,
 'El Acid deja un desgaste en el color.'),

('molderia', 1, 'Molderías VDH', 'Un cliente compra una remera con lavado Maltinto o Acid. ¿Qué le avisás?',
 array['Que la puede lavar con todo junto', 'Que cada prenda es única, que la lave con agua fría y separada de los oscuros, porque al principio puede soltar color', 'Que no la puede lavar nunca', 'Que va a encoger un talle'], 2,
 'Son teñidos artesanales: ninguna prenda queda igual a otra. Agua fría, oscuros separados (los primeros lavados pueden soltar color) y secado a la sombra.'),

('molderia', 2, 'Molderías VDH', '¿Cómo es la moldería Relax de buzo, como el Journey Relax?',
 array['Igual a la regular', 'Intermedia: más corta que la oversize pero bastante más amplia que la regular', 'Más larga que la oversize', 'Entallada'], 2,
 'La Relax es intermedia entre la regular y la oversize: más corta que la oversize y bastante más amplia que la regular.'),

('molderia', 1, 'Molderías VDH', '¿Cómo es el jean de corte "Denim" (regular), como el Denim Blacky?',
 array['Corte clásico, piernas rectas, largo debajo del tobillo y tela elastizada', 'Piernas anchas y tela rígida', 'Holgado en caderas y piernas ajustadas', 'Piernas anchas tipo baggy'], 1,
 'Es el corte clásico: piernas rectas, largo debajo del tobillo y confeccionado con telas elastizadas.'),

('molderia', 2, 'Molderías VDH', '¿Cómo es el jean Relax, como el Rucci Relax?',
 array['Holgado en caderas, piernas ajustadas y largo hasta el tobillo', 'Piernas anchas y rígido', 'Igual al 90''s', 'Muy ajustado en todo'], 1,
 'El Relax es ligeramente holgado en caderas, con piernas ajustadas y largo hasta el tobillo. Tela elastizada.'),

('molderia', 2, 'Molderías VDH', '¿Cómo es el jean 90''s, como el Kelian 90s?',
 array['Holgado en caderas, piernas rectas y tela rígida', 'Ajustado y elastizado', 'Piernas muy anchas', 'Corto al tobillo y elastizado'], 1,
 'El 90''s es holgado en caderas y de piernas rectas, confeccionado con telas rígidas.'),

('molderia', 2, 'Molderías VDH', '¿Qué diferencia hay entre el jean Wide y el Ultra Wide?',
 array['El Ultra Wide tiene las piernas ligeramente más anchas', 'El Wide es elastizado', 'El Ultra Wide es más corto', 'Ninguna'], 1,
 'Los dos son holgados en caderas y de tela rígida. El Ultra Wide (como el Breda Ultrawide) tiene las piernas un poco más anchas que el Wide (como el Chardi Wide).'),

('molderia', 3, 'Molderías VDH', '¿Cuál de estos jeans es de tela elastizada?',
 array['Kelian 90s', 'Chardi Wide', 'Rucci Relax', 'Team Baggy'], 3,
 'El Denim regular y el Relax son elastizados. El 90''s, el Wide, el Ultra Wide y el Baggy son de tela rígida.'),

('molderia', 2, 'Molderías VDH', '¿Cómo es el jean Baggy, como el Team Baggy?',
 array['El calce más amplio y las piernas más anchas, tela rígida', 'Ajustado y elastizado', 'Recto y elastizado', 'Corto al tobillo'], 1,
 'El Baggy tiene el calce más amplio y las piernas más anchas, en tela rígida.'),

('molderia', 1, 'Molderías VDH', '¿Qué calce tiene la camisa Fit, como la Sigma?',
 array['Entallado', 'Oversize', 'Regular', 'Boxy'], 1,
 'La Fit es entallada. La Regular (Venecia, Bucare) es ligeramente entallada y la Oversize (Marco Over) es suelta con hombro caído.'),

('molderia', 3, 'Molderías VDH', 'En nuestros jeans, ¿qué es la badana?',
 array['El bolsillo chico', 'La etiqueta trasera, en PU personalizada', 'El forro del bolsillo', 'El botón de bronce'], 2,
 'La badana es la etiqueta trasera. La nuestra es de PU personalizada.'),

('molderia', 2, 'Molderías VDH', '¿Para qué sirve la doble presilla (pasacinto) de atrás en nuestros jeans?',
 array['Es solo decorativa', 'Para más comodidad al usar cinturón', 'Para colgar llaves', 'Para reforzar el bolsillo'], 2,
 'Los jeans llevan costuras reforzadas y, atrás, doble presilla para más comodidad al usar cinturón.'),

('molderia', 3, 'Molderías VDH', '¿Qué detalles de calidad tienen nuestros jeans?',
 array['Cierres YKK de bronce y botones y remaches personalizados con logo', 'Cierres plásticos', 'Botones sin marca', 'No tienen detalles especiales'], 1,
 'Llevan cierres YKK de bronce, botones y remaches personalizados con logo y badana de PU personalizada. Sirve para explicarle al cliente la calidad.'),

-- ---------------------- CÓMO TRABAJAMOS (RETAIL) ----------------------
('retail', 1, 'Manual Retail 2025', 'Tarjeta bancaria Visa, Master o Cabal en 3 cuotas sin interés. ¿Qué código ingresás en el posnet?',
 array['3', '13', '16', '11'], 2,
 'Con tarjeta bancaria se usa "Ingresar más cuotas": 13 para 3 cuotas sin interés y 16 para 6 cuotas sin interés.'),

('retail', 1, 'Manual Retail 2025', 'Tarjeta bancaria en 6 cuotas sin interés. ¿Qué código ingresás?',
 array['6', '13', '16', '7'], 3,
 'El 16 es para 6 cuotas sin interés con tarjeta bancaria. El 13 es para 3.'),

('retail', 2, 'Manual Retail 2025', 'Tarjeta Visa o Master NO bancaria. ¿Qué podés ofrecer sin interés?',
 array['3 cuotas, con el código 3', '6 cuotas, con el código 16', '12 cuotas', 'Ninguna cuota sin interés'], 1,
 'Las no bancarias tienen solo 3 cuotas sin interés (código 3). El resto de las cuotas que aparecen en el sistema tienen recargo.'),

('retail', 2, 'Manual Retail 2025', 'Un cliente quiere pagar con Plan Z de Naranja X. ¿Qué código usás?',
 array['1', '3', '11', '13'], 3,
 'Plan Z: código 11. Para 1 cuota con Naranja X: código 1. En los dos casos el banco le cobra un recargo al cliente.'),

('retail', 1, 'Manual Retail 2025', 'Es martes y el cliente tiene la promo de su banco con 35% de descuento. ¿Qué hacés?',
 array['Le hago el 35% de descuento en el sistema', 'Paso el monto total del sistema; el descuento se lo reintegra el banco', 'Le digo que la promo no aplica', 'Le cobro la mitad en efectivo'], 2,
 'Nosotros no hacemos ningún descuento. El banco o la financiera reintegra el descuento, y aparece en el próximo resumen o en el siguiente (1 o 2 meses).'),

('retail', 2, 'Manual Retail 2025', 'Un cliente paga con una tarjeta Maestro. ¿Cómo se pasa?',
 array['En cuotas si las ofrece', 'Se elige "caja de ahorro", el cliente pone su PIN y va siempre en un pago', 'Como crédito', 'No se acepta'], 2,
 'Maestro es débito: se elige "caja de ahorro", el cliente ingresa su PIN de 4 dígitos y, aunque el posnet ofrezca cuotas, va sí o sí en un pago.'),

('retail', 2, 'Manual Retail 2025', 'Un cliente trae una gift card de un banco. ¿Cómo la cobrás?',
 array['Como crédito en 3 cuotas', 'Por el posnet como débito, sin cuotas', 'No se aceptan', 'Con el link de Mercado Pago'], 2,
 'Las gift cards bancarias se pasan como una tarjeta de débito normal, sin cuotas. Puede pasar que no alcance el monto.'),

('retail', 2, 'Manual Retail 2025', 'El posnet de Payway rechaza una operación. ¿Qué se hace?',
 array['Llamar al teléfono de autorizaciones', 'El cliente paga con otra tarjeta u otro medio de pago', 'Pasarla 5 veces seguidas', 'Anotarla y cobrarla al otro día'], 2,
 'En Payway ya no hay teléfonos para autorizaciones: es todo online. Si sale rechazada, el cliente paga con otra tarjeta u otro medio.'),

('retail', 2, 'Manual Retail 2025', '¿Qué es el CAE?',
 array['Un código de descuento', 'El código que da AFIP al autorizar una factura electrónica; sin él la factura no tiene validez fiscal', 'El número de la caja', 'Un tipo de tarjeta'], 2,
 'CAE significa Código de Autorización Electrónico. Sin CAE, la factura no tiene validez fiscal.'),

('retail', 1, 'Manual Retail 2025', '¿Cuándo se hace una factura A?',
 array['En todas las ventas', 'Solo si el cliente la pide', 'Solo los sábados', 'Cuando la venta es en efectivo'], 2,
 'La factura A se hace solo si el cliente la pide. Después de cargar sus datos, hay que verificar que el ticket esté en "A" y con la opción de generar factura tildada.'),

('retail', 2, 'Manual Retail 2025', 'En un retiro de fondos, ¿qué datos lleva la faja de papel del dinero?',
 array['Solo el monto', 'Monto, fecha, local, y firma y aclaración del responsable', 'El nombre del cliente', 'El número de factura'], 2,
 'La faja lleva monto, fecha, local, y firma y aclaración del responsable. Después se envuelve con el nombre del local, la fecha y la firma, en una bolsa bien cerrada.'),

('retail', 2, 'Manual Retail 2025', '¿Cuál es el depósito del sistema en el que se descuenta lo que vendemos y se suma lo que manda la fábrica?',
 array['Depósito de Temporada', 'Depósito de Ventas', 'Depósito de Envío entre Locales', 'Depósito de Devoluciones'], 2,
 'Trabajamos en el Depósito de Ventas. El de Temporada se usa en los cambios de temporada y el de Envío entre Locales para mandar o recibir ropa de otro local.'),

('retail', 3, 'Manual Retail 2025', 'Vas a mandar mercadería a otro local. En el sistema, ¿a qué depósito va como destino?',
 array['Depósito de Ventas', 'Depósito de Envío entre Locales', 'Depósito de Temporada', 'Al depósito del otro local directo'], 2,
 'Si enviás, el destino es "Depósito Envío entre Locales". Si recibís, el origen es ese depósito y el destino es el que estén usando. En observaciones se detalla el movimiento.'),

('retail', 2, 'Manual Retail 2025', 'Hacés una nota de crédito de una venta que tuvo dos descuentos. ¿A qué tenés que prestar atención?',
 array['A nada, se calcula sola', 'La nota de crédito toma solo el primer descuento: hay que agregar el otro para que coincidan los montos', 'Hay que borrar la venta original', 'Hay que hacerla dos veces'], 2,
 'La nota de crédito solo toma el primer descuento. Hay que agregar el que falta para que el ticket y la nota tengan el mismo monto. Se hace una sola vez y la venta no se borra.'),

('retail', 2, 'Manual Retail 2025', '¿Cuándo se mandan el reporte de IVA y el de percepciones de Ingresos Brutos?',
 array['Todos los viernes', 'El 1° de cada mes, con los datos del mes anterior', 'Cuando lo pida el supervisor', 'Una vez por año'], 2,
 'Los dos se hacen el 1° de cada mes con el mes anterior completo, y se mandan por mail a administración. El error más común es poner mal las fechas del mes.'),

('retail', 1, 'Manual Retail 2025', '¿Cuándo conviene usar el link manual de Mercado Pago?',
 array['Siempre, en todas las ventas', 'Cuando no anda el posnet o el cliente quiere cuotas sin interés con una tarjeta que no tenemos', 'Solo para pagos en efectivo', 'Nunca'], 2,
 'Se usa si no anda el posnet o si el cliente quiere cuotas sin interés con una tarjeta que no tenemos (por ejemplo, American sin entidad bancaria). Hay que explicarle que es una herramienta oficial y segura.'),

('retail', 2, 'Manual Retail 2025', 'El cliente paga con el link de Mercado Pago y quiere cuotas. ¿Qué le avisás?',
 array['Que toque "Pagar" enseguida', 'Que espere unos segundos a que carguen las opciones de cuotas; si paga enseguida, sale en 1 cuota', 'Que no se pueden hacer cuotas', 'Que mande una foto de la tarjeta'], 2,
 'En el último paso tiene que esperar a que carguen las cuotas. Si toca "Pagar" enseguida, sale en 1 cuota.'),

('retail', 1, 'Manual Retail 2025', 'El posnet da "error de comunicación". ¿Qué hacés primero?',
 array['Lo apagás y lo guardás', 'Revisás la conexión y probás la opuesta: si está en 4G, pasalo a Wi-Fi, y al revés', 'Llamás a la fábrica', 'Le pedís efectivo al cliente'], 2,
 'Primero, cambiar de conexión (4G ↔ Wi-Fi). Si sigue, se inicializa: menú de tres líneas → Funciones → Inicialización, y se espera sin tocarlo.'),

('retail', 3, 'Manual Retail 2025', '¿Dónde está la opción para inicializar el posnet?',
 array['En Ventas → Anular', 'En el menú de tres líneas → Funciones → Inicialización', 'Apretando el botón verde 10 segundos', 'En Configuración → Wi-Fi'], 2,
 'Menú desplazable (tres líneas arriba a la izquierda) → Funciones → Inicialización. Tarda unos minutos: no hay que tocarlo hasta que vuelva solo a la pantalla principal.'),

('retail', 2, 'Manual Retail 2025', '¿Qué se necesita para hacer una devolución a la fábrica?',
 array['Nada, se manda directo', 'Que la apruebe el supervisor y coordinar con depósito y con logística', 'Solo avisar por WhatsApp', 'Esperar a fin de mes'], 2,
 'Tiene que estar aprobada por el supervisor, hay que coordinar con depósito que haya espacio y con logística el retiro de los bultos.'),

('retail', 3, 'Manual Retail 2025', 'En una devolución hay prendas de primera y prendas falladas. ¿Cómo se arman los bultos?',
 array['Todo junto en un bulto', 'En bultos separados, con cartel, y las falladas con una cinta en la falla', 'Solo se mandan las falladas', 'Las falladas se tiran'], 2,
 'Primera y falladas van en bultos distintos y bien rotulados. Las falladas llevan una cinta en la falla, y además se separan por temporada (invierno o verano).'),

('retail', 2, 'Manual Retail 2025', '¿Qué datos lleva el rótulo de cada bulto de una devolución?',
 array['Solo el nombre del local', 'Local, cantidad de bultos (ej. 1/5), fecha de envío y número de remito de devolución', 'El nombre del vendedor', 'El precio de las prendas'], 2,
 'Cada bulto lleva local (o franquiciado o cliente), cantidad de bultos (1/5, 2/5…), fecha de envío y el número de remito de devolución del sistema.');


-- ████████ 20261012000006_orden_cajas.sql ████████

-- =====================================================================
-- Módulo VDH · Control de cajas + limpieza de fotos viejas
--
-- Una carga por local y por día al cierre:
--   fotos: cierre del sistema, cierre de lote del posnet, resumen de Mercado Pago,
--          Go Cuotas (si hubo) → la IA lee los montos y llena el formulario;
--   quien cierra confirma los números y escribe el efectivo que contó;
--   el sistema calcula los desvíos (como la planilla "Control Diario") y avisa.
-- Desvío = lo que dice el cierre de caja − lo real (positivo = falta plata).
-- =====================================================================

alter table orden_config
  add column caja_activa              boolean not null default false,  -- se prende desde No Compra cuando arranque
  add column caja_minutos_tolerancia  smallint not null default 60,     -- después del cierre del local
  add column caja_tolerancia_pesos    numeric(12,2) not null default 100,
  add column dias_guardar_fotos           smallint not null default 30   -- fotos de módulos ya controladas: 1 mes
                                           check (dias_guardar_fotos >= 7),     -- nunca menos de una semana
  add column dias_guardar_fotos_problemas smallint not null default 90,  -- "A mejorar" o peor: respaldan una falta
  add column dias_guardar_fotos_caja      smallint not null default 60;  -- cierres de caja: por reclamos y cierre de mes

create table orden_cajas (
  id                    uuid primary key default gen_random_uuid(),
  local_id              uuid not null references orden_locales(id) on delete cascade,
  fecha                 date not null,
  -- Lo que dice el cierre de caja del sistema
  sis_saldo_inicial     numeric(14,2),
  sis_tarjeta           numeric(14,2),
  sis_efectivo          numeric(14,2),
  sis_mp                numeric(14,2),
  sis_gocuotas          numeric(14,2),   -- "Ventas DebitoGo"
  sis_cuenta_corriente  numeric(14,2),
  sis_deposito          numeric(14,2),
  sis_total             numeric(14,2),
  sis_gastos            numeric(14,2),
  sis_otras_salidas     numeric(14,2),
  sis_descuentos        numeric(14,2),
  sis_saldo_final_efvo  numeric(14,2),   -- "Saldo final en efectivo"
  -- Lo real
  real_lote             numeric(14,2),   -- total del cierre de lote del posnet
  real_mp               numeric(14,2),   -- total de Mercado Pago del día
  real_gocuotas         numeric(14,2),
  real_efectivo         numeric(14,2),   -- lo que contaron
  -- Desvíos (como la planilla)
  desvio_mp        numeric(14,2) generated always as (coalesce(sis_mp, 0) - coalesce(real_mp, 0)) stored,
  desvio_tarjeta   numeric(14,2) generated always as (coalesce(sis_tarjeta, 0) - coalesce(real_lote, 0)) stored,
  desvio_gocuotas  numeric(14,2) generated always as (coalesce(sis_gocuotas, 0) - coalesce(real_gocuotas, 0)) stored,
  desvio_efectivo  numeric(14,2) generated always as (coalesce(sis_saldo_final_efvo, 0) - coalesce(real_efectivo, 0)) stored,
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'cargada', 'controlada')),
  alertas          jsonb not null default '[]',  -- lo que detectó: desvíos, montos distintos a la foto, foto de otro día
  observaciones    text,
  cargada_por      uuid references orden_personas(id) on delete set null,
  cargada_en       timestamptz,
  controlada_por   uuid references orden_personas(id) on delete set null,
  controlada_en    timestamptz,
  nota_control     text,
  creado_en        timestamptz not null default now(),
  unique (local_id, fecha)
);

create table orden_caja_fotos (
  id            uuid primary key default gen_random_uuid(),
  caja_id       uuid not null references orden_cajas(id) on delete cascade,
  tipo          text not null check (tipo in ('sistema', 'lote', 'mp', 'gocuotas')),
  foto_path     text not null,
  persona_id    uuid references orden_personas(id) on delete set null,
  tomada_en     timestamptz not null default now(),
  ia_estado     text not null default 'pendiente' check (ia_estado in ('pendiente', 'ok', 'invalida', 'error')),
  ia_resultado  jsonb,
  ia_modelo     text,
  borrada_en    timestamptz
);
create index on orden_caja_fotos (caja_id, tipo);

alter table orden_fotos add column borrada_en timestamptz;

-- Cada corrección hecha después de cargada la caja queda registrada (quién, cuándo, valores anteriores)
alter table orden_cajas add column historial jsonb not null default '[]';

-- Conversiones seguras: si la IA o alguien manda algo raro, queda null en vez de romper el guardado
create or replace function orden_num(v text) returns numeric language plpgsql immutable as $$
begin
  if v is null or trim(v) = '' then return null; end if;
  return v::numeric;
exception when others then
  begin
    -- formato argentino: "$ 1.440.100,00"
    return replace(replace(regexp_replace(v, '[^0-9,.-]', '', 'g'), '.', ''), ',', '.')::numeric;
  exception when others then
    return null;
  end;
end $$;

create or replace function orden_fecha_segura(v text) returns date language plpgsql immutable as $$
begin
  if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return v::date;
exception when others then
  return null;
end $$;

-- Día de trabajo del local: antes de la hora de apertura todavía cuenta el día anterior
-- (una caja cargada a las 00:30 queda en el día que cerró)
create or replace function orden_dia_caja(p_local uuid, p_ts timestamptz default now()) returns date
language sql stable as $$
  select case when (p_ts at time zone l.zona_horaria)::time < l.hora_apertura
              then (p_ts at time zone l.zona_horaria)::date - 1
              else (p_ts at time zone l.zona_horaria)::date end
  from orden_locales l where l.id = p_local
$$;

-- Quien cierra puede tocar la caja de hoy y la de ayer; los días anteriores, solo el supervisor
create or replace function orden_puede_editar_caja(p_local uuid, p_fecha date) returns boolean
language sql stable security definer set search_path = public as $$
  select orden_es_supervisor_de(p_local)
      or (orden_ve_local(p_local) and p_fecha >= orden_dia_caja(p_local) - 1)
$$;

-- ---------------------------------------------------------------------
-- Funciones (las llama quien cierra el local)
-- ---------------------------------------------------------------------

-- Devuelve (o crea) la caja de hoy del local de quien la pide
create or replace function orden_caja_hoy()
returns orden_cajas language plpgsql security definer set search_path = public as $$
declare v_local uuid; c orden_cajas;
begin
  select local_id into v_local from orden_personas where id = orden_yo_id();
  if v_local is null then raise exception 'No tenés un local asignado'; end if;
  insert into orden_cajas (local_id, fecha) values (v_local, orden_dia_caja(v_local))
  on conflict (local_id, fecha) do nothing;
  select * into c from orden_cajas where local_id = v_local and fecha = orden_dia_caja(v_local);
  return c;
end $$;

create or replace function orden_caja_registrar_foto(p_caja uuid, p_tipo text, p_foto_path text)
returns uuid language plpgsql security definer set search_path = public as $$
declare c orden_cajas; v_id uuid;
begin
  select * into c from orden_cajas where id = p_caja;
  if not found or not orden_puede_editar_caja(c.local_id, c.fecha) then raise exception 'No encontramos esa caja'; end if;
  if c.estado = 'controlada' then raise exception 'Esta caja ya fue controlada'; end if;
  if p_foto_path not like c.local_id::text || '/cajas/%' then raise exception 'Ruta de foto inválida'; end if;
  insert into orden_caja_fotos (caja_id, tipo, foto_path, persona_id) values (c.id, p_tipo, p_foto_path, orden_yo_id())
  returning id into v_id;
  return v_id;
end $$;

create or replace function orden_caja_preparar_lectura(p_foto uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f orden_caja_fotos; c orden_cajas; l orden_locales;
begin
  select * into f from orden_caja_fotos where id = p_foto;
  if not found then raise exception 'No encontramos esa foto'; end if;
  select * into c from orden_cajas where id = f.caja_id;
  if not orden_ve_local(c.local_id) then raise exception 'Sin acceso'; end if;
  select * into l from orden_locales where id = c.local_id;
  return jsonb_build_object('foto_id', f.id, 'foto_path', f.foto_path, 'tipo', f.tipo,
                            'fecha', c.fecha, 'local', l.nombre);
end $$;

-- Guarda lo que leyó la IA (solo servidor). No toca los montos: eso lo confirma la persona.
create or replace function orden_caja_aplicar_lectura(p_foto uuid, p_resultado jsonb, p_modelo text)
returns jsonb language sql security definer set search_path = public as $$
  update orden_caja_fotos
     set ia_estado = case when coalesce((p_resultado ->> 'foto_valida')::boolean, true) then 'ok' else 'invalida' end,
         ia_resultado = p_resultado, ia_modelo = p_modelo
   where id = p_foto
  returning p_resultado
$$;

-- Guarda los montos confirmados, calcula desvíos y alertas, y avisa si hay algo raro
create or replace function orden_caja_guardar(p_caja uuid, p_valores jsonb, p_observaciones text default null)
returns orden_cajas language plpgsql security definer set search_path = public as $$
declare
  c orden_cajas; cfg orden_config; v_alertas jsonb := '[]'; v_tol numeric; f record; k text; v_leido numeric; v_tipeado numeric;
  v_mapa jsonb := '{
    "sistema":  {"sis_tarjeta":"ventas_tarjeta","sis_efectivo":"ventas_efectivo","sis_mp":"ventas_mercado_pago",
                 "sis_gocuotas":"ventas_debito_go","sis_total":"ventas_totales","sis_saldo_final_efvo":"saldo_final_efectivo"},
    "lote":     {"real_lote":"total"},
    "mp":       {"real_mp":"total"},
    "gocuotas": {"real_gocuotas":"total"}}';
  v_nombre text;
begin
  select * into c from orden_cajas where id = p_caja for update;
  if not found or not orden_puede_editar_caja(c.local_id, c.fecha) then raise exception 'No encontramos esa caja'; end if;
  if c.estado = 'controlada' and not orden_es_supervisor_de(c.local_id) then
    raise exception 'Esta caja ya fue controlada: solo el supervisor puede cambiarla';
  end if;
  if orden_num(p_valores ->> 'real_efectivo') is null and c.real_efectivo is null then
    raise exception 'Falta el efectivo que contaste';
  end if;
  -- Si ya estaba cargada, se guarda cómo estaba antes del cambio
  if c.estado <> 'pendiente' then
    update orden_cajas set historial = historial || jsonb_build_object(
      'por', (select nombre from orden_personas where id = orden_yo_id()), 'en', now(),
      'antes', jsonb_strip_nulls(jsonb_build_object(
        'sis_tarjeta', c.sis_tarjeta, 'sis_mp', c.sis_mp, 'sis_gocuotas', c.sis_gocuotas,
        'sis_saldo_final_efvo', c.sis_saldo_final_efvo, 'real_lote', c.real_lote, 'real_mp', c.real_mp,
        'real_gocuotas', c.real_gocuotas, 'real_efectivo', c.real_efectivo)))
    where id = c.id;
  end if;
  select * into cfg from orden_config where local_id = c.local_id;
  v_tol := coalesce(cfg.caja_tolerancia_pesos, 100);

  update orden_cajas set
    sis_saldo_inicial    = coalesce(orden_num(p_valores ->> 'sis_saldo_inicial'), sis_saldo_inicial),
    sis_tarjeta          = coalesce(orden_num(p_valores ->> 'sis_tarjeta'), sis_tarjeta),
    sis_efectivo         = coalesce(orden_num(p_valores ->> 'sis_efectivo'), sis_efectivo),
    sis_mp               = coalesce(orden_num(p_valores ->> 'sis_mp'), sis_mp),
    sis_gocuotas         = coalesce(orden_num(p_valores ->> 'sis_gocuotas'), sis_gocuotas),
    sis_cuenta_corriente = coalesce(orden_num(p_valores ->> 'sis_cuenta_corriente'), sis_cuenta_corriente),
    sis_deposito         = coalesce(orden_num(p_valores ->> 'sis_deposito'), sis_deposito),
    sis_total            = coalesce(orden_num(p_valores ->> 'sis_total'), sis_total),
    sis_gastos           = coalesce(orden_num(p_valores ->> 'sis_gastos'), sis_gastos),
    sis_otras_salidas    = coalesce(orden_num(p_valores ->> 'sis_otras_salidas'), sis_otras_salidas),
    sis_descuentos       = coalesce(orden_num(p_valores ->> 'sis_descuentos'), sis_descuentos),
    sis_saldo_final_efvo = coalesce(orden_num(p_valores ->> 'sis_saldo_final_efvo'), sis_saldo_final_efvo),
    real_lote            = coalesce(orden_num(p_valores ->> 'real_lote'), real_lote),
    real_mp              = coalesce(orden_num(p_valores ->> 'real_mp'), real_mp),
    real_gocuotas        = coalesce(orden_num(p_valores ->> 'real_gocuotas'), real_gocuotas),
    real_efectivo        = coalesce(orden_num(p_valores ->> 'real_efectivo'), real_efectivo),
    observaciones        = coalesce(nullif(trim(p_observaciones), ''), observaciones)
  where id = c.id returning * into c;

  -- 1) Desvíos
  if abs(c.desvio_mp)       > v_tol then v_alertas := v_alertas || jsonb_build_object('tipo','desvio','campo','Mercado Pago','monto',c.desvio_mp); end if;
  if abs(c.desvio_tarjeta)  > v_tol then v_alertas := v_alertas || jsonb_build_object('tipo','desvio','campo','Tarjeta','monto',c.desvio_tarjeta); end if;
  if abs(c.desvio_gocuotas) > v_tol then v_alertas := v_alertas || jsonb_build_object('tipo','desvio','campo','Go Cuotas','monto',c.desvio_gocuotas); end if;
  if abs(c.desvio_efectivo) > v_tol then v_alertas := v_alertas || jsonb_build_object('tipo','desvio','campo','Efectivo','monto',c.desvio_efectivo); end if;

  -- 2) Lo que escribieron no coincide con lo que leyó la IA en la foto
  -- 3) La foto es de otro día (ej. un cierre de lote viejo)
  for f in select distinct on (tipo) * from orden_caja_fotos
           where caja_id = c.id and ia_estado = 'ok' order by tipo, tomada_en desc loop
    for k in select jsonb_object_keys(v_mapa -> f.tipo) loop
      v_leido := orden_num(f.ia_resultado ->> (v_mapa -> f.tipo ->> k));
      v_tipeado := orden_num(to_jsonb(c) ->> k);
      if v_leido is not null and v_tipeado is not null and abs(v_leido - v_tipeado) > 1 then
        v_alertas := v_alertas || jsonb_build_object('tipo', 'no_coincide_foto', 'campo', k,
                                                     'en_foto', v_leido, 'cargado', v_tipeado);
      end if;
    end loop;
    if orden_fecha_segura(f.ia_resultado ->> 'fecha') <> c.fecha then
      v_alertas := v_alertas || jsonb_build_object('tipo', 'foto_otro_dia', 'foto', f.tipo, 'fecha_foto', f.ia_resultado ->> 'fecha');
    end if;
  end loop;

  update orden_cajas
     set alertas = v_alertas,
         estado = case when estado = 'pendiente' then 'cargada' else estado end,
         cargada_por = coalesce(cargada_por, orden_yo_id()),
         cargada_en = coalesce(cargada_en, now())
   where id = c.id returning * into c;

  if jsonb_array_length(v_alertas) > 0 then
    select nombre into v_nombre from orden_locales where id = c.local_id;
    perform orden_avisar_responsables(c.local_id, 'ambos', 'caja_alerta',
      'Caja ' || v_nombre || ' ' || to_char(c.fecha, 'DD/MM') || ': revisar',
      (select string_agg(case a ->> 'tipo'
                           when 'desvio' then (a ->> 'campo') || ' $' || to_char((a ->> 'monto')::numeric, 'FM999G999G990')
                           when 'no_coincide_foto' then 'un monto no coincide con la foto'
                           else 'foto de otro día' end, ' · ')
       from jsonb_array_elements(v_alertas) a),
      '/cajas', 'caja-alerta:' || c.id || ':' || md5(v_alertas::text), 2::smallint);
  end if;
  return c;
end $$;

-- El supervisor marca el día como controlado
create or replace function orden_caja_controlar(p_caja uuid, p_nota text default null)
returns orden_cajas language plpgsql security definer set search_path = public as $$
declare c orden_cajas;
begin
  select * into c from orden_cajas where id = p_caja for update;
  if not found or not orden_es_supervisor_de(c.local_id) then raise exception 'Solo el supervisor puede controlar la caja'; end if;
  if c.estado = 'pendiente' then raise exception 'La caja todavía no fue cargada'; end if;
  if jsonb_array_length(c.alertas) > 0 and coalesce(trim(p_nota), '') = '' then
    raise exception 'Esta caja tiene alertas: escribí qué pasó antes de darla por controlada';
  end if;
  update orden_cajas set estado = 'controlada', controlada_por = orden_yo_id(), controlada_en = now(),
                         nota_control = nullif(trim(p_nota), '')
   where id = c.id returning * into c;
  return c;
end $$;

-- Reloj de cajas (lo llama la Edge Function tick después de orden_tick)
create or replace function orden_tick_cajas(p_ahora timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; cfg orden_config; v_hoy date; v_ayer date; v_dia date; v_hora time; p record; v_n int := 0; c record;
begin
  for l in select * from orden_locales where activo loop
    select * into cfg from orden_config where local_id = l.id;
    continue when not found or not cfg.caja_activa;
    v_hoy  := (p_ahora at time zone l.zona_horaria)::date;
    v_ayer := v_hoy - 1;
    v_hora := (p_ahora at time zone l.zona_horaria)::time;

    -- 1) Cerró hace más de N minutos y no cargó la caja → aviso al local y al supervisor.
    --    Se compara con fecha y hora completas: un cierre a las 23:00 + 60 min cae al otro día.
    v_dia := orden_dia_caja(l.id, p_ahora);
    if orden_local_abre(l.id, v_dia)
       and p_ahora >= orden_en_hora(l.id, v_dia, l.hora_cierre) + make_interval(mins => cfg.caja_minutos_tolerancia)
       and not exists (select 1 from orden_cajas where local_id = l.id and fecha = v_dia and estado <> 'pendiente') then
      for p in select id from orden_personas
               where local_id = l.id and activo and rol = 'vendedor' and orden_trabaja(id, v_dia) loop
        perform orden_encolar_aviso(p.id, 'caja_sin_cargar', 'Falta cargar la caja de hoy',
          'Sacá las fotos del cierre y cargá el efectivo.', '/caja', 'caja-local:' || p.id || ':' || v_dia, 2::smallint);
      end loop;
      perform orden_avisar_responsables(l.id, 'supervisores', 'caja_sin_cargar',
        l.nombre || ': no cargó la caja de hoy', null, '/cajas', 'caja-sup:' || l.id || ':' || v_dia, 2::smallint);
      v_n := v_n + 1;
    end if;

    -- 2) A la mañana siguiente (ya abierto el día nuevo) sigue sin cargar → aviso a los admins
    if orden_dia_caja(l.id, p_ahora) = v_hoy and orden_local_abre(l.id, v_ayer) and v_hora >= cfg.hora_aviso_1
       and not exists (select 1 from orden_cajas where local_id = l.id and fecha = v_ayer and estado <> 'pendiente') then
      perform orden_avisar_responsables(l.id, 'admins', 'caja_sin_cargar',
        l.nombre || ': no cargó la caja de ayer', to_char(v_ayer, 'DD/MM'), '/cajas', 'caja-adm:' || l.id || ':' || v_ayer, 2::smallint);
    end if;

    -- 3) Cargada hace más de N horas y el supervisor no la controló → aviso a los admins
    for c in select * from orden_cajas
             where local_id = l.id and estado = 'cargada'
               and cargada_en <= p_ahora - make_interval(hours => cfg.horas_revision_supervisor) loop
      perform orden_avisar_responsables(l.id, 'admins', 'caja_sin_controlar',
        l.nombre || ': caja del ' || to_char(c.fecha, 'DD/MM') || ' sin controlar',
        case when jsonb_array_length(c.alertas) > 0 then 'Tiene alertas.' else null end,
        '/cajas', 'caja-ctl:' || c.id, 2::smallint);
    end loop;
  end loop;
  return jsonb_build_object('locales_sin_caja', v_n);
end $$;

-- Resumen del día para el grupo de Telegram de encargados/supervisores
-- (lo manda la Edge Function resumen-cajas a la noche)
create or replace function orden_resumen_cajas_dia(p_fecha date)
returns jsonb language sql stable security definer set search_path = public as $$
  with l as (
    select l.id, l.nombre, c.estado, c.alertas
    from orden_locales l
    join orden_config cfg on cfg.local_id = l.id and cfg.caja_activa
    left join orden_cajas c on c.local_id = l.id and c.fecha = p_fecha
    where l.activo and orden_local_abre(l.id, p_fecha))
  select jsonb_build_object(
    'fecha', p_fecha,
    'locales', (select count(*) from l),
    'ok', coalesce((select jsonb_agg(nombre order by nombre) from l
                    where estado in ('cargada', 'controlada') and jsonb_array_length(alertas) = 0), '[]'),
    'sin_cargar', coalesce((select jsonb_agg(nombre order by nombre) from l
                            where estado is null or estado = 'pendiente'), '[]'),
    'con_alertas', coalesce((select jsonb_agg(jsonb_build_object('local', nombre, 'alertas', alertas) order by nombre) from l
                             where jsonb_array_length(coalesce(alertas, '[]')) > 0), '[]'))
$$;

-- ---------------------------------------------------------------------
-- Limpieza de fotos viejas (para no llenar el espacio)
-- Se guardan más tiempo: fotos de caja y fotos de módulos con problemas.
-- La Edge Function tick borra los archivos y después marca las filas.
-- ---------------------------------------------------------------------
create or replace function orden_fotos_para_borrar(p_limite int default 500)
returns table (origen text, id uuid, foto_path text)
language sql stable security definer set search_path = public as $$
  (select 'modulo', f.id, f.foto_path
   from orden_fotos f
   join orden_controles c on c.id = f.control_id
   join orden_config cfg on cfg.local_id = c.local_id
   where f.borrada_en is null
     -- solo fotos ya controladas por el supervisor (las que esperan revisión se guardan, con tope de 90 días)
     and (c.estado = 'revisado' or c.tipo = 'correccion'
          or f.tomada_en < now() - make_interval(days => cfg.dias_guardar_fotos_problemas))
     and f.tomada_en < now() - make_interval(days => case
           when coalesce(c.nivel_final, c.nivel_ia) <= 'a_mejorar' then cfg.dias_guardar_fotos_problemas
           else cfg.dias_guardar_fotos end)
     -- la última foto de cada módulo no se borra nunca: es la que se ve en "Cómo está el local"
     and f.id is distinct from (
           select f2.id from orden_fotos f2 join orden_controles c2 on c2.id = f2.control_id
           where c2.modulo_id = c.modulo_id and f2.borrada_en is null
           order by f2.tomada_en desc limit 1)
   limit p_limite)
  union all
  (select 'caja', f.id, f.foto_path
   from orden_caja_fotos f
   join orden_cajas c on c.id = f.caja_id
   join orden_config cfg on cfg.local_id = c.local_id
   where f.borrada_en is null and f.tomada_en < now() - make_interval(days => cfg.dias_guardar_fotos_caja)
   limit p_limite)
$$;

create or replace function orden_marcar_fotos_borradas(p_modulo uuid[], p_caja uuid[])
returns void language sql security definer set search_path = public as $$
  update orden_fotos set borrada_en = now() where id = any(p_modulo);
  update orden_caja_fotos set borrada_en = now() where id = any(p_caja);
$$;

-- ---------------------------------------------------------------------
-- Vista para No Compra (pestaña "Control de cajas"): una fila por local y día,
-- con columnas como la planilla. Los totales del mes salen agrupando.
-- ---------------------------------------------------------------------
create view orden_v_cajas with (security_invoker = true) as
select c.*, l.nombre as local_nombre,
       to_char(c.fecha, 'YYYY-MM') as mes,
       jsonb_array_length(c.alertas) > 0 as con_alertas,
       pc.nombre as cargada_por_nombre, ps.nombre as controlada_por_nombre,
       (select jsonb_object_agg(f.tipo, f.foto_path) from (
          select distinct on (tipo) tipo, foto_path from orden_caja_fotos
          where caja_id = c.id and borrada_en is null order by tipo, tomada_en desc) f) as fotos
from orden_cajas c
join orden_locales l on l.id = c.local_id
left join orden_personas pc on pc.id = c.cargada_por
left join orden_personas ps on ps.id = c.controlada_por;

create view orden_v_cajas_mes with (security_invoker = true) as
-- Se generan todos los días que abrió cada local desde su primera caja: así un día en que
-- nadie abrió la pantalla de caja también cuenta como "sin cargar".
with dias as (
  select l.id as local_id, l.nombre as local_nombre, g::date as fecha
  from orden_locales l
  join lateral (select min(fecha) as desde from orden_cajas c where c.local_id = l.id) ini on ini.desde is not null
  cross join lateral generate_series(ini.desde, orden_dia_caja(l.id), interval '1 day') g
  where l.activo and orden_local_abre(l.id, g::date))
select d.local_id, d.local_nombre, to_char(d.fecha, 'YYYY-MM') as mes,
       sum(c.sis_mp) as sis_mp, sum(c.real_mp) as real_mp, sum(c.desvio_mp) as desvio_mp,
       sum(c.sis_tarjeta) as sis_tarjeta, sum(c.real_lote) as real_lote, sum(c.desvio_tarjeta) as desvio_tarjeta,
       sum(c.sis_gocuotas) as sis_gocuotas, sum(c.real_gocuotas) as real_gocuotas, sum(c.desvio_gocuotas) as desvio_gocuotas,
       sum(c.sis_saldo_final_efvo) as sis_efectivo, sum(c.real_efectivo) as real_efectivo, sum(c.desvio_efectivo) as desvio_efectivo,
       count(*) filter (where c.id is null or c.estado = 'pendiente') as dias_sin_cargar,
       count(*) filter (where c.estado = 'cargada') as dias_sin_controlar,
       count(*) filter (where jsonb_array_length(coalesce(c.alertas, '[]')) > 0) as dias_con_alertas
from dias d left join orden_cajas c on c.local_id = d.local_id and c.fecha = d.fecha
group by d.local_id, d.local_nombre, to_char(d.fecha, 'YYYY-MM');

-- "Cómo está el local": la última foto de cada módulo y del depósito, con su nivel y lo que tiene pendiente.
-- Es la primera pantalla de Seguimiento en No Compra (filtrando por local).
create view orden_v_estado_local with (security_invoker = true) as
select m.id as modulo_id, m.numero as modulo_numero, m.nombre as modulo_nombre,
       s.local_id, l.nombre as local_nombre, s.tipo as sector_tipo, s.numero as sector_numero,
       resp.nombre as responsable,
       u.foto_path, u.tomada_en, u.control_id, u.control_tipo, u.nivel, u.foto_de,
       (u.tomada_en is null or u.tomada_en < now() - interval '7 days') as sin_foto_reciente,
       (select count(*) from orden_tareas t where t.modulo_id = m.id and t.estado in ('pendiente', 'vencida')) as tareas_abiertas
from orden_modulos m
join orden_sectores s on s.id = m.sector_id
join orden_locales l on l.id = s.local_id
left join orden_personas resp on resp.id = s.responsable_id
left join lateral (
  select f.foto_path, f.tomada_en, c.id as control_id, c.tipo as control_tipo,
         coalesce(c.nivel_final, f.ia_nivel, c.nivel_declarado) as nivel, pe.nombre as foto_de
  from orden_fotos f
  join orden_controles c on c.id = f.control_id
  left join orden_personas pe on pe.id = f.persona_id
  where c.modulo_id = m.id and f.borrada_en is null
  order by f.tomada_en desc limit 1) u on true
where m.activo and s.activo and l.activo;

-- Personas con sus avisos: No Compra muestra quién NO tiene las notificaciones activadas
create view orden_v_personas with (security_invoker = true) as
select p.*, l.nombre as local_nombre,
       exists (select 1 from orden_push_subs s where s.persona_id = p.id) as avisos_activos,
       (select max(f.tomada_en) from orden_fotos f where f.persona_id = p.id) as ultima_foto
from orden_personas p left join orden_locales l on l.id = p.local_id;

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------
alter table orden_cajas      enable row level security;
alter table orden_caja_fotos enable row level security;

-- El supervisor ve todas las cajas de su local; quien cierra, solo la de hoy y ayer
create policy ver on orden_cajas for select to authenticated
  using (orden_ve_equipo(local_id)
         or (orden_ve_local(local_id) and fecha >= orden_fecha_local(local_id) - 1));
create policy ver on orden_caja_fotos for select to authenticated
  using (exists (select 1 from orden_cajas c where c.id = caja_id));

do $$
declare t text; f record;
begin
  foreach t in array array['orden_cajas', 'orden_caja_fotos', 'orden_v_cajas', 'orden_v_cajas_mes', 'orden_v_personas',
                           'orden_v_estado_local'] loop
    execute format('revoke all on table %I from anon', t);
    execute format('grant select on table %I to authenticated', t);
    execute format('grant all on table %I to service_role', t);
  end loop;
  for f in select p.oid::regprocedure as firma, p.proname from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public'
             and p.proname in ('orden_caja_hoy', 'orden_caja_registrar_foto', 'orden_caja_preparar_lectura',
                               'orden_num', 'orden_fecha_segura', 'orden_dia_caja', 'orden_puede_editar_caja',
                               'orden_caja_aplicar_lectura', 'orden_caja_guardar', 'orden_caja_controlar',
                               'orden_tick_cajas', 'orden_fotos_para_borrar', 'orden_marcar_fotos_borradas',
                               'orden_resumen_cajas_dia')
  loop
    execute format('revoke all on function %s from public, anon', f.firma);
    execute format('grant execute on function %s to service_role', f.firma);
    if f.proname in ('orden_caja_aplicar_lectura', 'orden_tick_cajas', 'orden_fotos_para_borrar', 'orden_marcar_fotos_borradas',
                       'orden_resumen_cajas_dia') then
      execute format('revoke all on function %s from authenticated', f.firma);
    else
      execute format('grant execute on function %s to authenticated', f.firma);
    end if;
  end loop;
end $$;


-- ████████ 20261012000007_orden_login.sql ████████

-- =====================================================================
-- Módulo VDH · Migración 7: el login de la app
--
-- Cada persona elige su local (o "Oficina", si no es de un local), elige su
-- nombre y pone su PIN de 4 números UNA vez por celular: después la sesión
-- queda guardada. "No soy yo" cierra la sesión y vuelve a la lista.
--
-- Lo interno:
--   · El PIN se guarda cifrado, en una tabla que nadie lee desde afuera
--     (ni los compañeros del local ni el propio vendedor).
--   · El PIN NO es la contraseña de la cuenta de Supabase. Si lo fuera, se
--     podrían probar PIN directo contra Supabase sin pasar por el freno.
--     La Edge Function "entrar" revisa acá el freno y el PIN, y recién ahí
--     abre la sesión con una contraseña larga que arma ella y nadie ve.
--     El mail de la cuenta también lo arma el sistema.
--   · Freno: 5 PIN mal seguidos y espera 5 minutos, por persona.
--     Con un PIN malo NO se tira un error: un error deshace todo, también
--     el intento anotado, y el freno no correría nunca.
--   · El PIN lo cambia el administrador desde Configuración en No Compra.
-- =====================================================================

create table orden_pins (
  persona_id       uuid primary key references orden_personas(id) on delete cascade,
  hash             text not null,
  fallos           smallint not null default 0,  -- PIN mal seguidos
  bloqueado_hasta  timestamptz,
  clave_cuenta     text,                         -- contraseña de la cuenta de Supabase: solo la usa "entrar"
  cambiado_en      timestamptz not null default now()
);
alter table orden_pins enable row level security;  -- sin políticas: desde afuera no se ve nada
revoke all on table orden_pins from public, anon, authenticated;
grant all on table orden_pins to service_role;

-- "Lautaro G." (sin inicial cargada: "Lautaro")
create or replace function orden_nombre_lista(p_nombre text, p_inicial text) returns text
language sql immutable as $$
  select p_nombre || coalesce(' ' || nullif(upper(left(trim(p_inicial), 1)), '') || '.', '')
$$;

-- El mail interno de la cuenta: lo arma el sistema y nadie lo ve
create or replace function orden_mail_cuenta(p_persona uuid) returns text
language sql immutable as $$
  select 'p-' || p_persona || '@cuentas.vdh.com.ar'
$$;

-- ---------- La lista del login (antes de entrar: sin sesión) ----------

-- Los locales que tienen gente con PIN, y "Oficina" si hay alguien sin local
create or replace function orden_login_locales()
returns jsonb language sql stable security definer set search_path = public as $$
  with gente as (
    select distinct p.local_id from orden_personas p join orden_pins k on k.persona_id = p.id where p.activo)
  select coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'nombre', l.nombre) order by l.nombre)
                   from orden_locales l
                   where l.activo and l.id in (select local_id from gente where local_id is not null)), '[]'::jsonb)
      || case when exists (select 1 from gente where local_id is null)
              then jsonb_build_array(jsonb_build_object('id', null, 'nombre', 'Oficina')) else '[]'::jsonb end
$$;

-- Las personas de un local (sin local = "Oficina"): solo id y "Nombre I."
create or replace function orden_login_personas(p_local uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', orden_nombre_lista(p.nombre, p.inicial))
                            order by p.nombre), '[]'::jsonb)
  from orden_personas p join orden_pins k on k.persona_id = p.id
  where p.activo and p.local_id is not distinct from p_local
$$;

-- ---------- Las que usa la Edge Function "entrar" (solo el servidor) ----------

-- Revisa el freno y el PIN. Con el PIN bien devuelve lo que hace falta para abrir la sesión.
create or replace function orden_login_probar(p_persona uuid, p_pin text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare p orden_personas; k orden_pins;
begin
  select * into p from orden_personas where id = p_persona and activo;
  if not found then return jsonb_build_object('ok', false, 'porque', 'No encontramos a esa persona.'); end if;
  select * into k from orden_pins where persona_id = p.id for update;
  if not found then return jsonb_build_object('ok', false, 'porque', 'Todavía no tenés PIN. Pedíselo a Mauricio.'); end if;

  if k.bloqueado_hasta > now() then
    return jsonb_build_object('ok', false, 'espera', ceil(extract(epoch from k.bloqueado_hasta - now()))::int,
                              'porque', 'Pusiste mal el PIN 5 veces. Esperá unos minutos y probá de nuevo.');
  end if;

  if coalesce(p_pin, '') ~ '^[0-9]{4}$' and crypt(p_pin, k.hash) = k.hash then
    update orden_pins set fallos = 0, bloqueado_hasta = null where persona_id = p.id;
    return jsonb_build_object('ok', true, 'persona_id', p.id, 'auth_user_id', p.auth_user_id,
                              'mail', orden_mail_cuenta(p.id), 'clave', k.clave_cuenta,
                              'nombre', p.nombre, 'rol', p.rol, 'local_id', p.local_id);
  end if;

  -- PIN mal: se anota. Al 5.º seguido, 5 minutos de espera (y vuelve a contar de cero).
  update orden_pins
     set fallos = case when fallos + 1 >= 5 then 0 else fallos + 1 end,
         bloqueado_hasta = case when fallos + 1 >= 5 then now() + interval '5 minutes' end
   where persona_id = p.id
  returning * into k;
  if k.bloqueado_hasta is not null then
    return jsonb_build_object('ok', false, 'espera', 300,
                              'porque', 'Pusiste mal el PIN 5 veces. Esperá 5 minutos y probá de nuevo.');
  end if;
  return jsonb_build_object('ok', false, 'restantes', 5 - k.fallos, 'porque', 'PIN incorrecto.');
end $$;

-- La primera vez que entra, "entrar" le crea la cuenta y la deja anotada acá
create or replace function orden_login_vincular(p_persona uuid, p_auth uuid, p_clave text)
returns void language sql volatile security definer set search_path = public as $$
  update orden_personas set auth_user_id = p_auth where id = p_persona;
  update orden_pins set clave_cuenta = p_clave where persona_id = p_persona;
$$;

-- ---------- PIN: lo cambia el administrador ----------

-- Desde Configuración en No Compra (con la sesión de Mauricio)
create or replace function orden_pin_cambiar(p_persona uuid, p_pin text)
returns void language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if not orden_es_admin() then raise exception 'Solo el administrador puede cambiar los PIN'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then raise exception 'El PIN tiene que tener 4 números'; end if;
  if not exists (select 1 from orden_personas where id = p_persona) then raise exception 'No encontramos a esa persona'; end if;
  insert into orden_pins (persona_id, hash) values (p_persona, crypt(p_pin, gen_salt('bf', 8)))
  on conflict (persona_id) do update
    set hash = excluded.hash, fallos = 0, bloqueado_hasta = null, cambiado_en = now();
end $$;

-- Desde el editor SQL de Supabase (mientras no esté la pantalla de Configuración):
--   select nombre, orden_pin_sortear(id) as pin from orden_personas where nombre = 'Lautaro';
-- Sortea un PIN nuevo, lo guarda cifrado y lo muestra UNA vez.
create or replace function orden_pin_sortear(p_persona uuid)
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare b bytea := gen_random_bytes(2); v_pin text;
begin
  v_pin := lpad(((get_byte(b, 0) * 256 + get_byte(b, 1)) % 10000)::text, 4, '0');
  insert into orden_pins (persona_id, hash) values (p_persona, crypt(v_pin, gen_salt('bf', 8)))
  on conflict (persona_id) do update
    set hash = excluded.hash, fallos = 0, bloqueado_hasta = null, cambiado_en = now();
  return v_pin;
end $$;

-- ---------- Permisos ----------
do $$
declare f text;
begin
  foreach f in array array['orden_nombre_lista(text,text)', 'orden_mail_cuenta(uuid)',
                           'orden_login_locales()', 'orden_login_personas(uuid)',
                           'orden_login_probar(uuid,text)', 'orden_login_vincular(uuid,uuid,text)',
                           'orden_pin_cambiar(uuid,text)', 'orden_pin_sortear(uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
  -- La lista del login se ve antes de entrar
  grant execute on function orden_login_locales() to anon, authenticated, service_role;
  grant execute on function orden_login_personas(uuid) to anon, authenticated, service_role;
  -- Solo la Edge Function "entrar"
  grant execute on function orden_login_probar(uuid, text) to service_role;
  grant execute on function orden_login_vincular(uuid, uuid, text) to service_role;
  -- El administrador, desde No Compra
  grant execute on function orden_pin_cambiar(uuid, text) to authenticated, service_role;
  -- orden_pin_sortear: solo desde el editor SQL (el dueño de la base)
end $$;

-- ---------- Los PIN del arranque ----------
-- Uno sorteado para cada persona. Se muestran UNA vez, al final del SQL:
-- anotalos y pasáselos a cada uno. No quedan escritos en ningún lado.
create temp table orden_pins_iniciales (local text, nombre text, pin text);
insert into orden_pins_iniciales
select coalesce(l.nombre, 'Oficina'), orden_nombre_lista(p.nombre, p.inicial), orden_pin_sortear(p.id)
from orden_personas p left join orden_locales l on l.id = p.local_id
where p.activo;


-- Los PIN del arranque (se ven una sola vez)
select local, nombre, pin from orden_pins_iniciales order by local, nombre;
