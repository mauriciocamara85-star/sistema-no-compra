-- VDH · Sistema No Compra — el PIN de Beneficios.
--
-- Correr DESPUÉS de usuarios.sql y ANTES de beneficios.sql.
--
-- ══════════════════════════════════════════════════════════════════════════
-- POR QUÉ ACÁ SÍ, Y EN EL PANEL NO
-- ══════════════════════════════════════════════════════════════════════════
--
-- El Panel sigue entrando con el enlace por mail, y no es una inconsistencia:
-- ahí adentro está la lista de clientes con sus teléfonos, que es lo más
-- sensible del sistema, y el mail ya funciona.
--
-- Beneficios es otra cosa. Lo usa el mostrador de los 14 locales todo el día
-- —busca, vende gift cards, canjea— y nada de eso pide entrar. Lo único que
-- necesita llave es el listado y crear cupones, y para eso pedirle a cada
-- persona del local que abra su mail es una fricción que no se paga sola.
--
-- ══════════════════════════════════════════════════════════════════════════
-- UN PIN QUE SÍ PROTEGE
-- ══════════════════════════════════════════════════════════════════════════
--
-- El PIN que no sirve es el que se compara en el navegador: el repo es
-- público y estaría a la vista. Éste NO está en ninguna parte del frontend.
-- Vive acá, **hasheado con bcrypt**, y se compara adentro de una función.
-- Aunque alguien se lleve la base entera, el hash no le devuelve el número.
--
-- ══════════════════════════════════════════════════════════════════════════
-- Y UN FRENO, PORQUE ESTÁ EXPUESTO A INTERNET
-- ══════════════════════════════════════════════════════════════════════════
--
-- Cualquiera puede llamarle a esta función con la clave publicable. Cuatro
-- dígitos son diez mil combinaciones: sin freno, se prueban todas en un rato.
--
-- El freno es una espera que CRECE y es GLOBAL:
--
--   3 fallos seguidos  →  1 minuto
--   el 4º              →  5 minutos
--   del 5º en adelante →  30 minutos
--
-- Con eso, probar diez mil combinaciones lleva meses. Un acierto borra la
-- cuenta y todo vuelve a cero.
--
-- **Global quiere decir que es para todos**, y eso tiene un costo que
-- conviene saber: alguien que escriba cualquier cosa tres veces deja al
-- equipo esperando un minuto. Se eligió así porque la alternativa —contar
-- por dispositivo— no frena a nadie: el que ataca borra su localStorage y
-- vuelve a cero, y el único que queda frenado es el empleado distraído.
--
-- ══════════════════════════════════════════════════════════════════════════
-- CÓMO SE PONE EL PRIMERO
-- ══════════════════════════════════════════════════════════════════════════
--
-- Desde acá, una sola vez:
--
--   select pin_definir(null, '4821');
--
-- Después se cambia desde la misma pantalla de Beneficios, y para cambiarlo
-- hay que saber el actual. Mientras no haya ninguno puesto, la pantalla no
-- ofrece nada: un PIN sin definir no deja entrar, no deja entrar a todos.


create table if not exists pin_estado (
  /* Una sola fila, siempre. El check es lo que lo garantiza: sin él, dos
     filas significan dos PIN válidos y ninguna forma de saber cuál manda. */
  id               smallint primary key default 1 check (id = 1),
  hash             text,
  fallos           integer not null default 0,
  bloqueado_hasta  timestamptz,
  actualizado      timestamptz,
  ultimo_ok        timestamptz
);

insert into pin_estado (id) values (1) on conflict (id) do nothing;

comment on table pin_estado is
  'El PIN de Beneficios, hasheado, y el contador de intentos fallidos.';

/* Nadie la lee de afuera. Tener el hash y el contador a la vista no le sirve
   a nadie de adentro y sí a quien quiera saber cuánto le falta esperar. */
alter table pin_estado enable row level security;
revoke all on pin_estado from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- CUÁNTO SE ESPERA
--
-- Separado en su propia función para que la escalera se lea de un vistazo y
-- se cambie en un solo lugar.
-- ════════════════════════════════════════════════════════════════════════

create or replace function pin_espera(fallos integer)
returns interval
language sql
immutable
as $$
  select case
    when fallos < 3  then interval '0'
    when fallos = 3  then interval '1 minute'
    when fallos = 4  then interval '5 minutes'
    else                  interval '30 minutes'
  end
$$;


-- ════════════════════════════════════════════════════════════════════════
-- PROBAR EL PIN
--
-- Devuelve un jsonb y NO tira excepción, ni siquiera cuando está bloqueado.
-- La razón no es de estilo: una excepción aborta la transacción, y con ella
-- se perdería el incremento del contador de fallos. El que ataca tendría
-- intentos infinitos y el freno no existiría.
--
-- Tampoco distingue "PIN equivocado" de "todavía no hay PIN puesto": las dos
-- son `ok:false` y el mismo texto. Decir cuál es le regala información a
-- quien está probando.
-- ════════════════════════════════════════════════════════════════════════

create or replace function pin_ok(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  e       pin_estado%rowtype;
  espera  integer;
begin
  select * into e from pin_estado where id = 1 for update;

  -- Bloqueado: se contesta cuánto falta, sin gastar un intento.
  if e.bloqueado_hasta is not null and e.bloqueado_hasta > now() then
    espera := ceil(extract(epoch from (e.bloqueado_hasta - now())))::integer;
    return jsonb_build_object('ok', false, 'espera', espera,
      'porque', 'Demasiados intentos. Probá de nuevo en ' ||
                 greatest(1, round(espera / 60.0))::text || ' minuto(s).');
  end if;

  if e.hash is not null and p_pin is not null and e.hash = crypt(p_pin, e.hash) then
    update pin_estado
       set fallos = 0, bloqueado_hasta = null, ultimo_ok = now()
     where id = 1;
    return jsonb_build_object('ok', true);
  end if;

  /* Falló. El contador sube y, pasados los tres, empieza la espera. */
  update pin_estado
     set fallos = fallos + 1,
         bloqueado_hasta = case
           when pin_espera(fallos + 1) > interval '0' then now() + pin_espera(fallos + 1)
           else null end
   where id = 1
   returning * into e;

  espera := case when e.bloqueado_hasta is null then 0
                 else ceil(extract(epoch from (e.bloqueado_hasta - now())))::integer end;

  return jsonb_build_object(
    'ok', false,
    'espera', espera,
    'restantes', greatest(0, 3 - e.fallos),
    'porque', case
      when espera > 0 then 'Demasiados intentos. Probá de nuevo en ' ||
                            greatest(1, round(espera / 60.0))::text || ' minuto(s).'
      else 'PIN incorrecto. Te queda' ||
           case when 3 - e.fallos = 1 then ' 1 intento.' else 'n ' || (3 - e.fallos)::text || ' intentos.' end
    end);
end;
$$;

grant execute on function pin_ok(text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- DEFINIR O CAMBIAR EL PIN
--
-- Para cambiarlo hay que saber el actual. La primera vez no hay actual, así
-- que esa vez la hace Mauricio desde el SQL —o cualquiera con rol, desde una
-- sesión—: lo que no puede pasar es que un PIN sin definir sea una puerta
-- abierta para que el primero que pase ponga el suyo.
--
-- Cambiarlo NO pasa por el freno: el que ya sabe el actual no está
-- adivinando. Pero si el actual viene mal, cuenta como fallo, porque ahí sí
-- está probando.
-- ════════════════════════════════════════════════════════════════════════

create or replace function pin_definir(p_actual text, p_nuevo text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  e pin_estado%rowtype;
  r jsonb;
begin
  if p_nuevo is null or p_nuevo !~ '^[0-9]{4,8}$' then
    raise exception 'El PIN tiene que ser de 4 a 8 dígitos.';
  end if;

  select * into e from pin_estado where id = 1 for update;

  if e.hash is null then
    /* Todavía no hay ninguno. Sólo alguien de adentro puede poner el
       primero; si no, el primero que pase se queda con la llave. */
    if not puede_crear_cupones() then
      raise exception 'Todavía no hay PIN. El primero lo pone un administrador.';
    end if;
  else
    r := pin_ok(p_actual);
    if not (r->>'ok')::boolean then
      return jsonb_build_object('cambiado', false, 'porque', r->>'porque');
    end if;
  end if;

  update pin_estado
     set hash = crypt(p_nuevo, gen_salt('bf')),
         actualizado = now(),
         fallos = 0, bloqueado_hasta = null
   where id = 1;

  return jsonb_build_object('cambiado', true);
end;
$$;

grant execute on function pin_definir(text, text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- ¿HAY PIN, Y ESTÁ LIBRE?
--
-- Lo que la pantalla necesita saber ANTES de pedir nada: si hay PIN puesto
-- —para no ofrecer una puerta que no existe— y si hay que esperar, para
-- decirlo en vez de dejar que la persona pruebe y se coma un fallo.
--
-- No devuelve el hash ni cuántos fallos van: eso es de adentro.
-- ════════════════════════════════════════════════════════════════════════

create or replace function pin_situacion()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'hay', hash is not null,
    'espera', case
      when bloqueado_hasta is not null and bloqueado_hasta > now()
        then ceil(extract(epoch from (bloqueado_hasta - now())))::integer
      else 0 end)
  from pin_estado where id = 1
$$;

grant execute on function pin_situacion() to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- QUIÉN ESTÁ CREANDO EL CUPÓN
--
-- Un desplegable y no un campo de texto, por una razón muy concreta: escrito
-- a mano, la misma persona termina siendo "Agus", "agus", "Agustina" y
-- "agustina ", y la estadística por persona —que es para lo que se guarda—
-- deja de servir. Un selector la vuelve un dato; un campo libre la vuelve
-- cuatro.
--
-- Es la misma idea que `equipo` para los vendedores, en chico. No va en
-- `equipo` porque esa tabla es por LOCAL, y Atención al Cliente no es un
-- local: meterla ahí la haría aparecer en los filtros de todas las
-- pantallas y en el ranking de sucursales.
--
-- No hay uid ni mail: acá no se autentica a nadie. Es una lista de nombres
-- para elegir, del mismo nivel de confianza que el vendedor de la Carga.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists atencion (
  id     bigint generated always as identity primary key,
  nombre text not null,
  -- Se desactiva, no se borra: borrarla dejaría sin explicación los cupones
  -- que esa persona creó. Mismo criterio que `equipo` y que `usuarios`.
  activo boolean not null default true
);

create unique index if not exists atencion_unica on atencion (lower(trim(nombre)));

comment on table atencion is
  'Los nombres que ofrece el selector al crear un cupón. No autentica nada.';

/* Sólo los nombres activos, y sólo los nombres: es lo que la pantalla
   necesita para armar el desplegable. Una lista de nombres de pila no es un
   dato de nadie —no hay mail, ni teléfono, ni qué hizo cada uno— así que
   puede salir sin PIN; pedirlo obligaría a validar el PIN antes de poder
   mostrar el formulario, que es al revés de como se usa. */
create or replace function atencion_lista()
returns table (nombre text)
language sql
stable
security definer
set search_path = public
as $$
  select nombre from atencion where activo order by lower(trim(nombre))
$$;

grant execute on function atencion_lista() to anon, authenticated;

/* Alta y baja, detrás del PIN: es la misma llave que todo lo demás de esta
   pantalla. Sin esto habría que entrar al SQL cada vez que cambia alguien. */
create or replace function atencion_guardar(p_pin text, p_nombre text, p_activo boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare n text;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  n := nullif(trim(coalesce(p_nombre, '')), '');
  if n is null then raise exception 'Falta el nombre.'; end if;

  insert into atencion (nombre, activo) values (n, coalesce(p_activo, true))
  on conflict (lower(trim(nombre))) do update set activo = excluded.activo;

  return jsonb_build_object('guardado', true, 'nombre', n);
end;
$$;

grant execute on function atencion_guardar(text, text, boolean) to anon, authenticated;

alter table atencion enable row level security;
revoke all on atencion from anon, authenticated;
