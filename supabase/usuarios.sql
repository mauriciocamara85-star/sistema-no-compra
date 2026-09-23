-- VDH · Sistema No Compra — quién es cada uno.
--
-- Correr DESPUÉS de sincronia.sql y ANTES de beneficios.sql.
--
-- ══════════════════════════════════════════════════════════════════════════
-- POR QUÉ ROLES Y NO UN PIN
-- ══════════════════════════════════════════════════════════════════════════
--
-- La app es un sitio estático en un repo PÚBLICO, y la clave publicable de
-- Supabase está en `datos.js` a la vista de cualquiera. En ese escenario un
-- PIN no protege nada:
--
--   · validado en el navegador, está escrito en el código;
--   · validado en la base, sigue siendo un secreto compartido que viaja, se
--     anota en un papel del mostrador, y no se puede sacar de circulación
--     sin cambiárselo a todos a la vez.
--
-- El rol resuelve las dos cosas. Se revoca de a una persona, y la auditoría
-- dice "lo creó Agustina" y no "alguien que sabía el PIN".
--
-- ══════════════════════════════════════════════════════════════════════════
-- LA REGLA VIVE EN LA FUNCIÓN, NO EN LA PANTALLA
-- ══════════════════════════════════════════════════════════════════════════
--
-- Esconder el botón es cosmética: cualquiera con la clave publicable puede
-- llamarle a PostgREST directo con su propio token. Lo que decide de verdad
-- es el `puede_crear_cupones()` de adentro de `crear_cupon`. La pantalla
-- esconde el botón para no ofrecer lo que después va a fallar, y nada más.
--
-- ══════════════════════════════════════════════════════════════════════════
-- EL ALTA ES A MANO, A PROPÓSITO
-- ══════════════════════════════════════════════════════════════════════════
--
-- No hay pantalla para darse de alta ni para darse un rol: se hace desde el
-- SQL de Supabase. Son cinco personas y cambia dos veces por año; una
-- pantalla para eso es más superficie de ataque que ahorro de trabajo. El
-- registro público ya está cerrado, así que un mail que no esté acá no
-- recibe ni el enlace para entrar.
--
--   insert into usuarios (uid, mail, rol)
--   select id, email, 'atencion' from auth.users where email = 'agus@...';


do $roles$
begin
  if not exists (select 1 from pg_type where typname = 'rol_usuario') then
    /* Dos roles y no cinco. `atencion` puede crear cupones; `admin` puede
       eso y lo que venga después. Un rol `local` no existe porque el
       mostrador trabaja SIN sesión —busca y canjea como anónimo—, así que
       no habría a quién colgárselo. */
    create type rol_usuario as enum ('atencion', 'admin');
  end if;
end
$roles$;


create table if not exists usuarios (
  /* La llave es el uid de auth.users y no el mail: el mail se puede cambiar
     desde la cuenta y ahí el permiso se perdería sin que nadie se entere.
     Se borra en cascada, así que dar de baja la cuenta da de baja el rol. */
  uid      uuid primary key references auth.users(id) on delete cascade,
  /* El mail está repetido acá a propósito: es para poder leer esta tabla y
     entender quién es quién sin cruzarla con auth.users, que es un esquema
     que conviene tocar lo menos posible. Si alguien lo cambia allá, este
     queda viejo — y no importa, porque nadie decide nada con este campo. */
  mail     text,
  rol      rol_usuario not null,
  /* Se desactiva, no se borra: borrar pierde quién lo dio de alta y cuándo,
     y deja los cupones que creó esa persona sin explicación. Es el mismo
     criterio que la tabla `equipo`. */
  activo   boolean not null default true,
  agregado timestamptz not null default now(),
  por      text
);

comment on table usuarios is
  'Quién puede hacer qué. El alta es a mano desde el SQL; no hay pantalla.';


-- ════════════════════════════════════════════════════════════════════════
-- LAS DOS PREGUNTAS
--
-- `mi_rol()` es para la PANTALLA: contesta qué soy, para saber si conviene
-- mostrar el botón. `puede_crear_cupones()` es para las FUNCIONES: contesta
-- si me dejan, y es la que decide.
--
-- Las dos son SECURITY DEFINER porque tienen que leer `usuarios`, que está
-- cerrada con RLS. Y `stable`, no `immutable`: dependen de quién llama.
-- ════════════════════════════════════════════════════════════════════════

create or replace function mi_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol::text from usuarios where uid = auth.uid() and activo
$$;

grant execute on function mi_rol() to authenticated;
/* A `anon` no: preguntarle el rol a un anónimo siempre da null, y tener la
   función abierta invita a usarla como oráculo de qué uids existen. */
revoke execute on function mi_rol() from anon, public;


create or replace function puede_crear_cupones()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from usuarios
     where uid = auth.uid() and activo and rol in ('atencion', 'admin')
  )
$$;

/* Esta NO se concede a nadie desde afuera: la llaman las otras funciones,
   que son security definer y corren como dueñas. Que no se pueda llamar de
   afuera es lo que evita que alguien la use para tantear cuentas. */
revoke execute on function puede_crear_cupones() from anon, authenticated, public;


-- ════════════════════════════════════════════════════════════════════════
-- LA TABLA ESTÁ CERRADA
--
-- Cada uno puede ver SU fila y nada más. Un listado de quién tiene permisos
-- es un mapa de a quién conviene robarle la sesión.
-- ════════════════════════════════════════════════════════════════════════

alter table usuarios enable row level security;

drop policy if exists "ver mi propia fila" on usuarios;
create policy "ver mi propia fila"
  on usuarios for select
  to authenticated
  using (uid = auth.uid());

grant select on usuarios to authenticated;
