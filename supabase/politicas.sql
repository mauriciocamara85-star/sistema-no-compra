-- VDH · Sistema No Compra — quién puede hacer qué.
--
-- Correr DESPUÉS de schema.sql.
--
-- ── El problema que resuelve este archivo ─────────────────────────────────
-- La clave que va en el frontend es pública: está en un repo público y
-- cualquiera puede leerla del navegador. O sea que **cualquier persona de
-- internet puede hablarle a esta base**, igual que hoy le puede hablar al
-- doPost de Apps Script.
--
-- La diferencia es que hoy lo único que separa a un desconocido de la lista
-- de clientes con sus teléfonos es un PIN de cuatro dígitos sin límite de
-- intentos. Acá eso se reemplaza por una regla que el motor hace cumplir:
--
--   El vendedor NO LEE registros. Nunca. Ni uno.
--
-- Escribe los suyos, ve números agregados, y para el beneficio pregunta por
-- un teléfono exacto que le dictó el cliente. Leer clientes requiere haber
-- iniciado sesión con Google.
--
-- ── Las dos formas de entrar ──────────────────────────────────────────────
--   anon           cualquiera con la clave pública: el celular del vendedor
--   authenticated  quien entró con Google: Atención al Cliente, Mauricio, el dueño
--   service_role   las Edge Functions, que se saltean todo esto a propósito
--
-- ── La regla para decidir dónde va cada cosa ──────────────────────────────
--   Números agregados          → vista, lectura directa
--   Datos de un cliente        → función con SECURITY DEFINER, que devuelve
--                                lo mínimo y nada más
--   Efectos afuera (Kommo,     → Edge Function
--   Telegram, mail)

-- ════════════════════════════════════════════════════════════════════════
-- TODO CERRADO PRIMERO
--
-- Enciende RLS en las cinco tablas. Con RLS prendido y sin políticas, nadie
-- ve ni escribe nada: el estado por defecto pasa a ser "no", y cada permiso
-- de abajo es un sí explícito. Es al revés de como viene una base, y es la
-- única forma de que un olvido resulte en algo que no anda en vez de en
-- algo que se filtra.
-- ════════════════════════════════════════════════════════════════════════

alter table registros enable row level security;
alter table equipo    enable row level security;
alter table objetivos enable row level security;
alter table log       enable row level security;
alter table ajustes   enable row level security;


-- ════════════════════════════════════════════════════════════════════════
-- REGISTROS · acá están los teléfonos
-- ════════════════════════════════════════════════════════════════════════

-- El vendedor puede CARGAR, y nada más. No hay política de select para anon,
-- así que ni siquiera puede leer lo que él mismo acaba de escribir: el
-- celular se acuerda de eso solo, como ya hace hoy.
grant insert on registros to anon;

create policy "cargar un no-compra"
  on registros for insert
  to anon
  with check (
    -- Que no puedan escribir un registro ya resuelto: el vendedor carga un
    -- cliente que se va, no una venta cerrada ni un seguimiento hecho.
    not compro
    and beneficio_dado is null
    and estado is null
    and not contactado
    and length(trim(sucursal)) > 0
    and length(trim(vendedor)) > 0
    and length(regexp_replace(whatsapp, '[^0-9]', '', 'g')) >= 8
  );

-- Atención al Cliente y el dueño sí leen y completan el seguimiento.
grant select, update on registros to authenticated;

create policy "el equipo de adentro ve todo"
  on registros for select
  to authenticated
  using (true);

create policy "el equipo de adentro completa el seguimiento"
  on registros for update
  to authenticated
  using (true)
  with check (true);


-- ════════════════════════════════════════════════════════════════════════
-- EQUIPO · quién carga en cada local
--
-- Abierto, y es una decisión vieja que se mantiene: acá no hay datos de
-- nadie, son nombres de vendedores. Ponerle una puerta significa que alguien
-- que entra a trabajar un sábado no puede registrar hasta que aparezca el
-- encargado, y esa fricción ya mató este sistema una vez.
-- ════════════════════════════════════════════════════════════════════════

grant select, insert, update on equipo to anon, authenticated;

create policy "ver el equipo del local"      on equipo for select to anon, authenticated using (true);
create policy "anotarse en el local"         on equipo for insert to anon, authenticated with check (length(trim(vendedor)) > 0);
create policy "activar o desactivar a alguien" on equipo for update to anon, authenticated using (true) with check (true);


-- ════════════════════════════════════════════════════════════════════════
-- OBJETIVOS · por el mismo motivo, abiertos
-- ════════════════════════════════════════════════════════════════════════

grant select, insert, update, delete on objetivos to anon, authenticated;

create policy "ver los objetivos"    on objetivos for select to anon, authenticated using (true);
create policy "poner un objetivo"    on objetivos for insert to anon, authenticated with check (true);
create policy "cambiar un objetivo"  on objetivos for update to anon, authenticated using (true) with check (true);
create policy "sacar un objetivo"    on objetivos for delete to anon, authenticated using (true);


-- ════════════════════════════════════════════════════════════════════════
-- LOG · se escribe, no se lee
--
-- Cualquiera puede dejar constancia de lo que hizo; leer el historial es de
-- adentro. Un log que el que lo ensucia puede leer y editar no sirve para
-- lo único que está: entender qué pasó.
-- ════════════════════════════════════════════════════════════════════════

grant insert on log to anon, authenticated;
grant select on log to authenticated;

create policy "dejar constancia"   on log for insert to anon, authenticated with check (true);
create policy "leer el historial"  on log for select to authenticated using (true);


-- ════════════════════════════════════════════════════════════════════════
-- AJUSTES · sólo de adentro
--
-- Acá viven el mail de avisos y el grupo de Telegram. Son exactamente las
-- cosas que hoy piden el PIN del panel, así que pasan a pedir sesión.
-- ════════════════════════════════════════════════════════════════════════

grant select, insert, update on ajustes to authenticated;

create policy "ver los ajustes"     on ajustes for select to authenticated using (true);
create policy "cambiar los ajustes" on ajustes for insert to authenticated with check (true);
create policy "corregir un ajuste"  on ajustes for update to authenticated using (true) with check (true);


-- ════════════════════════════════════════════════════════════════════════
-- LAS VISTAS · los números que puede ver cualquiera
--
-- **OJO, acá hay una trampa y es a propósito.** Una vista de Postgres lee las
-- tablas con los permisos de SU DUEÑO, no los de quien la consulta. Por eso
-- estas tres funcionan para el vendedor aunque él no pueda leer `registros`.
--
-- Eso las vuelve una puerta lateral: **cualquier columna que se agregue acá
-- queda pública.** Estas tres devuelven conteos y sumas y ninguna trae un
-- nombre, un teléfono ni un mail. Antes de tocarlas, mirar esa línea otra vez.
-- ════════════════════════════════════════════════════════════════════════

grant select on v_motivos, v_resultados, v_metricas to anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- EL BENEFICIO · la única forma en que el mostrador toca un cliente
--
-- Son funciones y no acceso a la tabla porque una política no alcanza:
-- podría limitar QUÉ FILAS se ven, pero no QUÉ COLUMNAS vuelven ni cuánto
-- se puede tantear. Una función devuelve lo que devuelve y nada más.
--
-- SECURITY DEFINER: corren con permisos de su dueño, así que leen `registros`
-- aunque quien llama no pueda. Esa es la idea, y también por qué hay que
-- mirarlas con lupa: son las dos únicas puertas al dato del cliente.
--
-- Se busca por TELÉFONO COMPLETO, que es la llave que sólo tiene el cliente.
-- Por nombre sería un buscador de clientes repartido a los 14 locales.
-- ════════════════════════════════════════════════════════════════════════

create or replace function beneficio_buscar(telefono text)
returns table (nombre text, pct smallint, buscaba text, disponible boolean)
language sql
security definer
set search_path = public
as $$
  select r.nombre,
         r.beneficio_pct,
         r.producto,
         r.beneficio_usado is null
  from registros r
  where r.beneficio_dado is not null
    -- Comparación sobre el número pelado: nadie dicta un teléfono dos veces
    -- igual, y el índice registros_telefono está hecho sobre esto mismo.
    and regexp_replace(r.whatsapp, '[^0-9]', '', 'g')
        = regexp_replace(telefono, '[^0-9]', '', 'g')
    -- Un número mal escrito no puede devolver medio padrón.
    and length(regexp_replace(telefono, '[^0-9]', '', 'g')) >= 8
  order by r.beneficio_dado desc
  limit 1;
$$;

/*
 * Usar el beneficio. Es la acción que cierra el círculo entero: marca el
 * beneficio como usado y, con el mismo movimiento, deja el registro como
 * venta recuperada.
 *
 * Por eso "Recuperado" deja de depender de que la venta pase por el CRM o de
 * que alguien complete columnas a mano.
 *
 * Devuelve false si ya estaba usado, que es la razón de ser de todo esto:
 * un solo uso. La condición va en el WHERE y no en un `if` para que dos
 * mostradores que lo intenten en el mismo segundo no puedan ganar los dos.
 */
create or replace function beneficio_usar(
  telefono text,
  p_local text,
  p_vendedor text,
  p_monto numeric,
  p_producto text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  tocadas integer;
begin
  if length(regexp_replace(telefono, '[^0-9]', '', 'g')) < 8 then
    return false;
  end if;

  update registros
     set beneficio_usado    = now(),
         beneficio_local    = p_local,
         beneficio_vendedor = p_vendedor,
         compro             = true,
         compro_canal       = 'local',
         monto              = p_monto,
         producto_final     = coalesce(p_producto, producto_final),
         estado             = 'Cerrado - compró'
   where regexp_replace(whatsapp, '[^0-9]', '', 'g')
         = regexp_replace(telefono, '[^0-9]', '', 'g')
     and beneficio_dado is not null
     and beneficio_usado is null;

  get diagnostics tocadas = row_count;
  return tocadas > 0;
end;
$$;

-- Las funciones no heredan permisos: hay que dárselos aunque sean definer.
grant execute on function beneficio_buscar(text) to anon, authenticated;
grant execute on function beneficio_usar(text, text, text, numeric, text) to anon, authenticated;
