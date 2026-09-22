-- VDH · Sistema No Compra — lo que corre solo.
--
-- Correr DESPUÉS de kommo.sql.
--
-- Dos trabajos:
--   · despachar la bandeja de salida, cada minuto
--   · el recordatorio de la mañana en el grupo de Telegram, a las 9
--
-- Los dos los dispara pg_cron, que reemplaza a los disparadores por tiempo
-- de Apps Script.


-- ════════════════════════════════════════════════════════════════════════
-- CUÁNTO SE REINTENTA
--
-- Seis intentos con espera creciente: al minuto, a los dos, a los cuatro…
-- El último cae unas dos horas después del primero. Si en dos horas Kommo no
-- levantó, no es un hipo de red y alguien tiene que mirarlo; seguir
-- reintentando para siempre sólo esconde el problema.
-- ════════════════════════════════════════════════════════════════════════

create or replace function despachar_salidas()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  s       salidas%rowtype;
  res     jsonb;
  hechos  integer := 0;
begin
  /* El tiempo de espera de `http` es POR SESIÓN y arranca en un segundo, que
     no le alcanza ni para saludar a Kommo. Cada corrida de pg_cron es una
     sesión nueva, así que hay que ponerlo acá adentro todas las veces. */
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '20000');

  for s in
    select * from salidas
     where estado = 'pendiente'
       and intentos < 6
       -- Espera creciente entre intentos: 1, 2, 4, 8, 16 minutos.
       and (ultimo is null or ultimo < now() - (power(2, intentos) * interval '1 minute'))
     order by creado
     -- De a veinte: una corrida que se lleva cinco minutos se pisa con la
     -- siguiente. Lo que no entra queda para el minuto que viene.
     limit 20
     for update skip locked
  loop
    begin
      res := case s.destino
               when 'kommo'    then mandar_kommo(s.registro)
               when 'telegram' then mandar_telegram(s.registro)
             end;

      update salidas
         set estado = 'hecho', intentos = intentos + 1, ultimo = now(),
             error = null, resultado = res
       where id = s.id;
      hechos := hechos + 1;

    exception when others then
      /* El fallo de UNO no puede cortar la vuelta: sin este bloque, un lead
         que Kommo rechaza por un dato raro dejaría sin mandar a todos los que
         venían atrás. */
      update salidas
         set intentos = intentos + 1,
             ultimo = now(),
             error = left(sqlerrm, 500),
             -- Al sexto se deja de intentar y pasa a ser algo que mirar.
             estado = case when intentos + 1 >= 6 then 'fallado'::estado_salida
                           else 'pendiente'::estado_salida end
       where id = s.id;
    end;
  end loop;

  return hechos;
end;
$$;

revoke execute on function despachar_salidas() from anon, authenticated, public;


-- ════════════════════════════════════════════════════════════════════════
-- EL RECORDATORIO DE LA MAÑANA
--
-- Es el port de src/Recordatorio.gs, con el mismo texto.
--
-- **Dos renglones y nada más:** el día, y cómo viene el acumulado. El segundo
-- le da escala al primero —"entraron 2" no dice nada solo, "entraron 2, van
-- 137" sí—. Tres líneas para un sistema con cuatro registros se leen
-- infladas, y un mensaje que parece relleno se empieza a saltear.
--
-- **Tampoco da instrucciones.** Antes decía "hay que hablar con ellos" abajo
-- del día sin cargas: el hecho dicho en seco ya es el mensaje, y mandarle
-- tarea a un grupo donde está el dueño suena a otra cosa.
--
-- **Y un día sin cargas se avisa igual.** Es la noticia más importante que
-- puede dar este mensaje, no un motivo para callarse.
-- ════════════════════════════════════════════════════════════════════════

create or replace function pesos(n numeric)
returns text
language sql
immutable
as $$
  select '$ ' || replace(to_char(coalesce(n, 0), 'FM999G999G999G990'), ',', '.')
$$;

create or replace function recordatorio_diario()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  token  text := secreto('TELEGRAM_TOKEN');
  chat   text := secreto('TELEGRAM_CHAT');
  -- Se llama UMBRAL y no DIAS porque PL/pgSQL no distingue mayúsculas: con
  -- `DIAS` choca con la variable `dias` de dos líneas más abajo.
  UMBRAL constant integer := 3;
  ayer         integer;
  total        integer;
  pendientes   integer;
  contactados  integer;
  viejos       integer;
  dias         integer;
  mes_cargados integer;
  mes_compraron integer;
  mes_plata    numeric;
  lineas   text[] := '{}';
  estado   text;
  van      text;
  cuerpo   jsonb;
  res      extensions.http_response;
  salida   jsonb;
begin
  if token is null or chat is null then
    return 'El aviso por Telegram está apagado: no hay a dónde mandarlo.';
  end if;

  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '20000');

  select
    count(*) filter (where creado >= inicio_de('day') - interval '1 day'
                       and creado <  inicio_de('day')),
    count(*),
    count(*) filter (where not contactado and estado is null)
    into ayer, total, pendientes
  from registros;

  contactados := total - pendientes;

  /* Dos números sobre los pendientes, y no miden lo mismo: `viejos` son los
     que pasaron el umbral, y `dias` es lo que espera el más viejo de TODOS,
     pasen o no el umbral. Por eso el filtro va adentro del count y no en el
     where: sacarlos de la consulta dejaría a `dias` midiendo sólo entre los
     viejos, que es una cuenta distinta. */
  select coalesce(count(*) filter (
           where creado <= now() - (UMBRAL || ' days')::interval), 0),
         coalesce(max(floor(extract(epoch from now() - creado) / 86400))::int, 0)
    into viejos, dias
  from registros
   where not contactado and estado is null;

  /* El mes se corta por la fecha del REGISTRO, no por la de la venta: no se
     guarda cuándo se cerró la compra. "Este mes" quiere decir "de lo que
     entró este mes, esto ya volvió", que es la única pregunta que los datos
     pueden contestar sin inventar nada. Mismo criterio que el tablero. */
  select count(*),
         count(*) filter (where compro),
         coalesce(sum(monto) filter (where compro), 0)
    into mes_cargados, mes_compraron, mes_plata
  from registros where creado >= inicio_de('month');

  lineas := array_append(lineas, '<b>Buen día.</b>');
  lineas := array_append(lineas, '');

  lineas := array_append(lineas, case
    when ayer = 0 then '<b>Ayer no cargó ningún local.</b>'
    when ayer = 1 then 'Ayer entró <b>1</b>.'
    else 'Ayer entraron <b>' || ayer || '</b>.' end);

  if total = 0 then
    lineas := array_append(lineas, 'Todavía no se cargó ninguno desde que arrancamos.');
  else
    van := case when total = 1 then 'Va <b>1</b> cargado desde que arrancamos'
                else 'Van <b>' || total || '</b> cargados desde que arrancamos' end;

    if pendientes = 0 then
      lineas := array_append(lineas, van ||
        case when total = 1 then ' y ya se le escribió.' else ' y ya se les escribió a todos.' end);
    else
      /* Lo hecho antes que lo que falta, a propósito: este mensaje lo lee el
         que atiende, y si arranca por la deuda es un reclamo diario. */
      estado := van || ': ';
      if contactados > 0 then
        estado := estado || 'se les escribió a <b>' || contactados ||
                  '</b> y faltan <b>' || pendientes || '</b>';
      else
        estado := estado || 'falta contestarle a <b>' || pendientes || '</b>';
      end if;

      if viejos > 0 then
        estado := estado || ', ' || case when viejos = 1 then 'uno' else viejos::text end ||
                  ' hace más de ' || UMBRAL || ' días';
        if dias > UMBRAL then
          estado := estado || ' (el más viejo, ' || dias || ' días)';
        end if;
      end if;
      lineas := array_append(lineas, estado || '.');
    end if;
  end if;

  /* El acumulado del mes, separado: es la única línea que no le pide nada a
     nadie. Contesta para qué sirvió todo lo de arriba, que es lo que mira el
     dueño. Aparece recién cuando hay una venta: un "0 volvieron · $ 0" todas
     las mañanas del primer mes no informa nada y desanima a los que sí están
     haciendo el trabajo de cargar y llamar. */
  if mes_compraron > 0 then
    lineas := array_append(lineas, '');
    lineas := array_append(lineas, 'Este mes volvieron a comprar <b>' || mes_compraron ||
      '</b> de los ' || mes_cargados || ' que entraron · <b>' || pesos(mes_plata) || '</b> recuperados.');
  end if;

  cuerpo := jsonb_build_object(
    'chat_id', chat,
    'text', array_to_string(lineas, E'\n'),
    'parse_mode', 'HTML',
    'disable_web_page_preview', true,
    -- El botón es lo que convierte el recordatorio en una acción: se toca y
    -- ya está adentro de la lista que hay que trabajar.
    'reply_markup', jsonb_build_object('inline_keyboard', jsonb_build_array(jsonb_build_array(
      jsonb_build_object('text', 'Abrir el panel',
                         'url', coalesce(secreto('SITIO'), '') || 'panel.html')))));

  res := extensions.http_post('https://api.telegram.org/bot' || token || '/sendMessage',
                              cuerpo::text, 'application/json');
  begin salida := res.content::jsonb; exception when others then salida := null; end;

  if res.status >= 300 or coalesce((salida->>'ok')::boolean, false) = false then
    raise exception 'El recordatorio no salió: % · %', res.status,
      left(coalesce(salida->>'description', res.content, ''), 200);
  end if;

  return array_to_string(lineas, ' | ');
end;
$$;

revoke execute on function recordatorio_diario() from anon, authenticated, public;


-- ════════════════════════════════════════════════════════════════════════
-- EL RELOJ
--
-- pg_cron trabaja en UTC. Argentina es UTC-3 todo el año —no hay horario de
-- verano—, así que las 9 de la mañana de acá son las 12 UTC. Escrito así y
-- no con una función de zona horaria porque cron no entiende de zonas: el
-- número tiene que estar bien a mano, y si algún día el país vuelve a mover
-- la hora, hay que cambiarlo acá.
-- ════════════════════════════════════════════════════════════════════════

select cron.unschedule('despachar-salidas') where exists
  (select 1 from cron.job where jobname = 'despachar-salidas');
select cron.schedule('despachar-salidas', '* * * * *', 'select despachar_salidas()');

select cron.unschedule('recordatorio-diario') where exists
  (select 1 from cron.job where jobname = 'recordatorio-diario');
select cron.schedule('recordatorio-diario', '0 12 * * *', 'select recordatorio_diario()');
