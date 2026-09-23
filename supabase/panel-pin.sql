-- VDH · Sistema No Compra — el Panel también entra con PIN.
--
-- Correr DESPUÉS de beneficios-acciones.sql. Es lo último.
--
-- ══════════════════════════════════════════════════════════════════════════
-- QUÉ CAMBIA Y POR QUÉ
-- ══════════════════════════════════════════════════════════════════════════
--
-- El Panel entraba con un enlace por mail. Pasa a entrar con el mismo PIN que
-- Beneficios, que es lo que se pidió: una sola llave para las dos secciones.
--
-- **Esto no es sólo cambiar la pantalla de entrada.** El Panel leía y escribía
-- la tabla `registros` DIRECTO, con el token de la sesión, y era el grant a
-- `authenticated` lo que lo protegía. Si se cambia la puerta y se deja el
-- grant, queda una puerta sin llave al lado de la nueva: cualquiera con una
-- sesión —o con una sesión robada— sigue leyendo la lista entera de clientes
-- con sus teléfonos, sin pasar por ningún PIN.
--
-- Así que acá se hacen las dos mitades:
--   1. los datos salen por funciones que verifican el PIN adentro;
--   2. se le SACA a `authenticated` el permiso de leer y escribir `registros`.
--
-- La segunda mitad es la que hace que la primera signifique algo.
--
-- ══════════════════════════════════════════════════════════════════════════
-- LO QUE SE PIERDE, DICHO EN VOZ ALTA
-- ══════════════════════════════════════════════════════════════════════════
--
-- Con el enlace por mail, el acceso era **por persona**: se daba de a uno, se
-- sacaba de a uno, y quedaba registrado quién entró. Un PIN es una sola llave
-- compartida: no se puede quitar a una sola persona sin cambiárselo a todos,
-- y no se sabe quién miró.
--
-- Acá adentro están los nombres y teléfonos de los clientes, así que ese
-- cambio no es gratis. Es una decisión tomada a sabiendas (Mauricio,
-- 23/09/2026), a cambio de que el equipo no tenga que abrir el mail para
-- trabajar. El freno de intentos y el hasheo del PIN están en pin.sql.


-- ════════════════════════════════════════════════════════════════════════
-- LOS NÚMEROS DE ARRIBA
--
-- El cuerpo de `resumen_panel()` no se toca: se lo envuelve. Es una función
-- larga que ya funciona y reescribirla para agregarle una línea de PIN sería
-- arriesgar algo que anda por una comodidad.
--
-- La de adentro es `security invoker`, y llamada desde acá corre como la
-- dueña de esta —que es dueña de las tablas—, así que ve todo. Es el mismo
-- mecanismo por el que el resto de las funciones de este proyecto pueden leer
-- tablas cerradas.
-- ════════════════════════════════════════════════════════════════════════

create or replace function resumen_panel(p_pin text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  return resumen_panel();
end;
$$;

grant execute on function resumen_panel(text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- LAS FICHAS
--
-- Devuelve exactamente la misma forma que devolvía PostgREST leyendo la tabla
-- —todas las columnas del registro más un arreglo `beneficios` anidado—, para
-- que `deLaBase_` del frontend siga funcionando sin tocarle una línea.
--
-- "Pendiente" no es un estado guardado: es no haber sido tocado. Tiene que
-- ser el MISMO criterio que usa resumen_panel, o el número del filtro no
-- coincide con la cantidad de fichas que abre y el panel se ve roto.
-- ════════════════════════════════════════════════════════════════════════

create or replace function registros_listar(p_pin text, p_filtro text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  return coalesce((
    /* El id desempata: dos registros que caen en el mismo instante —dos
       celulares del mismo local, a la vez— dejarían el orden librado a lo que
       devuelva Postgres, y la lista se reacomodaría sola al refrescar. */
    select json_agg(x order by creado desc, id desc)
      from (
        select r.creado, r.id,
               to_jsonb(r) || jsonb_build_object(
                 'beneficios',
                 coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'id', b.id, 'pct', b.pct, 'usado', b.usado,
                            'anulado', b.anulado, 'vence', b.vence))
                     from beneficios b where b.registro = r.id), '[]'::jsonb)
               ) as x
          from registros r
         where p_filtro is null
            or p_filtro = 'Todos'
            or (p_filtro = 'Pendiente' and not r.contactado and r.estado is null)
            or (p_filtro not in ('Todos', 'Pendiente') and r.estado::text = p_filtro)
      ) t
  ), '[]'::json);
end;
$$;

grant execute on function registros_listar(text, text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- GUARDAR EL SEGUIMIENTO
--
-- Los campos se enumeran UNO POR UNO y no se arma el UPDATE con lo que venga
-- en el jsonb. Escribir columnas por nombre desde algo que manda el navegador
-- es dejar que el navegador elija qué columna tocar: con eso se podría
-- escribir `whatsapp`, o `creado`, o cualquier cosa que esta pantalla no
-- tiene por qué cambiar.
--
-- `p_campos ? 'clave'` distingue "vino en null" de "no vino". Sin eso, guardar
-- el estado borraría el monto, porque ambos llegarían como null.
-- ════════════════════════════════════════════════════════════════════════

create or replace function seguimiento_guardar(p_pin text, p_id bigint, p_campos jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare tocadas integer;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;
  if p_campos is null or p_campos = '{}'::jsonb then return true; end if;

  update registros set
    contactado = case when p_campos ? 'contactado'
                      then coalesce((p_campos->>'contactado')::boolean, false) else contactado end,
    responsable = case when p_campos ? 'responsable'
                       then p_campos->>'responsable' else responsable end,
    contacto1_result = case when p_campos ? 'contacto1_result'
                            then (p_campos->>'contacto1_result')::resultado_contacto else contacto1_result end,
    contacto1_fecha = case when p_campos ? 'contacto1_fecha'
                           then (p_campos->>'contacto1_fecha')::date else contacto1_fecha end,
    estado = case when p_campos ? 'estado'
                  then (p_campos->>'estado')::estado_seguimiento else estado end,
    obs_seguimiento = case when p_campos ? 'obs_seguimiento'
                           then p_campos->>'obs_seguimiento' else obs_seguimiento end,
    compro = case when p_campos ? 'compro'
                  then coalesce((p_campos->>'compro')::boolean, false) else compro end,
    compro_canal = case when p_campos ? 'compro_canal'
                        then (p_campos->>'compro_canal')::canal_venta else compro_canal end,
    producto_final = case when p_campos ? 'producto_final'
                          then p_campos->>'producto_final' else producto_final end,
    monto = case when p_campos ? 'monto'
                 then (p_campos->>'monto')::numeric else monto end
  where id = p_id;

  get diagnostics tocadas = row_count;
  return tocadas > 0;
end;
$$;

grant execute on function seguimiento_guardar(text, bigint, jsonb) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- DAR UN DESCUENTO
--
-- Mismo cuerpo de antes; lo único que cambia es que la llave pasó de ser la
-- sesión a ser el PIN. Se baja la vieja porque le cambia la firma, y dejarla
-- viva sería dejar abierta la puerta que ésta reemplaza.
-- ════════════════════════════════════════════════════════════════════════

drop function if exists dar_descuento(bigint, smallint, integer, text, text);

create or replace function dar_descuento(
  p_pin      text,
  p_registro bigint,
  p_pct      smallint,
  p_dias     integer default 30,
  p_quien    text default null,
  p_obs      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r   registros%rowtype;
  nid bigint;
begin
  if not (pin_ok(p_pin)->>'ok')::boolean then
    raise exception 'PIN incorrecto.' using errcode = '28000';
  end if;

  select * into r from registros where id = p_registro;
  if not found then raise exception 'No existe el registro %.', p_registro; end if;

  /* Si ya tiene uno vivo, no se crea otro: se devuelve el que hay. Dos
     personas mirando el mismo panel no pueden dejar al cliente con dos
     descuentos, que es lo que pasaba repartiendo cupones de papel. */
  select id into nid from v_beneficios
   where tipo = 'descuento' and estado = 'disponible'
     and regexp_replace(coalesce(telefono, ''), '[^0-9]', '', 'g')
       = regexp_replace(coalesce(r.whatsapp, ''), '[^0-9]', '', 'g')
   limit 1;
  if nid is not null then
    return jsonb_build_object('dado', false, 'porque', 'ese cliente ya tiene un descuento sin usar', 'id', nid);
  end if;

  insert into beneficios (tipo, registro, telefono, nombre, pct, vence, local, vendedor, obs)
  values ('descuento', r.id, r.whatsapp, r.nombre, p_pct,
          ((now() at time zone 'America/Argentina/Buenos_Aires')::date + coalesce(p_dias, 30)),
          r.sucursal, coalesce(p_quien, r.vendedor), p_obs)
  returning id into nid;

  return jsonb_build_object('dado', true, 'id', nid, 'pct', p_pct);
end;
$$;

grant execute on function dar_descuento(text, bigint, smallint, integer, text, text) to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- Y SE CIERRA EL CAMINO VIEJO
--
-- Esto es la mitad que importa. Sin esto, todo lo de arriba es un candado
-- nuevo en una puerta que quedó abierta: la lista de clientes con sus
-- teléfonos se sigue pudiendo pedir directo con cualquier sesión.
--
-- Se le saca a `authenticated` leer y escribir `registros`. Lo que NO se
-- toca es el INSERT de `anon`: por ahí carga el vendedor desde el mostrador,
-- y esa política ya revisa lo suyo.
--
-- Las funciones de este archivo y las de estadísticas siguen leyendo igual,
-- porque son SECURITY DEFINER y corren como la dueña de las tablas.
-- ════════════════════════════════════════════════════════════════════════

revoke select, update on registros from authenticated;

drop policy if exists "el equipo de adentro ve todo" on registros;
drop policy if exists "el equipo de adentro completa el seguimiento" on registros;

/* Y los beneficios, por lo mismo: el listado sale por beneficios_listar. */
revoke select on beneficios from authenticated;
drop policy if exists "el equipo de adentro ve los beneficios" on beneficios;
revoke select on v_beneficios from authenticated;
