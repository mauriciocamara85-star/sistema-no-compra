-- =====================================================================
-- Módulo VDH · Migración 20 (va en el SQL 111): la caja deja borrar un
-- monto, y los avisos de las fotos llevan a la pestaña Fotos.
--
-- Pedido de Mauricio (13/10/2026, "sí, hacé todas las mejoras"):
--
-- 1. Caja: hasta hoy un monto ya guardado no se podía borrar para
--    corregirlo (un campo vacío dejaba el número de antes). Ahora, si la
--    app manda el campo (aunque sea vacío), se guarda lo que manda: vacío
--    lo borra. Si no lo manda (una versión vieja de la app), queda como
--    estaba. El efectivo contado sigue siendo obligatorio.
-- 2. Avisos: "No mandaste 1 control a tiempo" lleva a Fotos. "Hoy: …",
--    "Te falta: …" y el recordatorio del supervisor llevan a Fotos si son
--    sólo fotos; si también hay tareas, a Hoy (la lista de todo).
--
-- Se cambian frases exactas de las funciones como están hoy en la base (así
-- no se pisa nada de lo que les cambiaron los SQL de después). Si alguna
-- frase no está, avisa con un error y no cambia nada.
-- Reversible: volver a reemplazar las frases al revés (están abajo).
-- =====================================================================

do $$
declare
  v_def text; v_nuevo text; v_campo text; i int;
  v_campos text[] := array['sis_tarjeta', 'sis_mp', 'sis_gocuotas', 'sis_saldo_final_efvo', 'real_lote', 'real_mp', 'real_gocuotas', 'real_efectivo'];
  v_avisos text[][] := array[
    ['''/hoy'', ''dia:''', 'case when p.tar = 0 then ''/fotos'' else ''/hoy'' end, ''dia:'''],
    ['''/hoy'', ''tarde:''', 'case when p.tar = 0 then ''/fotos'' else ''/hoy'' end, ''tarde:'''],
    ['''/hoy'', ''ctlv:''', '''/fotos'', ''ctlv:''']];
begin
  /* 1. La caja. */
  v_def := pg_get_functiondef('orden_caja_guardar(uuid, jsonb, text)'::regprocedure);
  v_nuevo := v_def;
  foreach v_campo in array v_campos loop
    v_nuevo := replace(v_nuevo, format('coalesce(orden_num(p_valores ->> %L), %s)', v_campo, v_campo),
                                format('case when p_valores ? %L then orden_num(p_valores ->> %L) else %s end', v_campo, v_campo, v_campo));
  end loop;
  v_nuevo := replace(v_nuevo, 'if orden_num(p_valores ->> ''real_efectivo'') is null and c.real_efectivo is null then',
                              'if orden_num(p_valores ->> ''real_efectivo'') is null and (p_valores ? ''real_efectivo'' or c.real_efectivo is null) then');
  if v_nuevo <> v_def then execute v_nuevo; end if;
  v_def := pg_get_functiondef('orden_caja_guardar(uuid, jsonb, text)'::regprocedure);
  if position('case when p_valores ? ''real_lote''' in v_def) = 0
     or position('(p_valores ? ''real_efectivo'' or c.real_efectivo is null)' in v_def) = 0 then
    raise exception 'SQL 111: orden_caja_guardar no tiene lo que se esperaba; no se cambió. Avisale a Claude.';
  end if;

  /* 2. Los avisos del reloj. */
  v_def := pg_get_functiondef('orden_tick(timestamptz)'::regprocedure);
  v_nuevo := v_def;
  for i in 1..array_length(v_avisos, 1) loop
    v_nuevo := replace(v_nuevo, v_avisos[i][1], v_avisos[i][2]);
  end loop;
  if v_nuevo <> v_def then execute v_nuevo; end if;
  v_def := pg_get_functiondef('orden_tick(timestamptz)'::regprocedure);
  if position('''/fotos'', ''ctlv:''' in v_def) = 0 or position('then ''/fotos'' else ''/hoy'' end, ''dia:''' in v_def) = 0
     or position('then ''/fotos'' else ''/hoy'' end, ''tarde:''' in v_def) = 0 then
    raise exception 'SQL 111: orden_tick no tiene lo que se esperaba; no se cambió. Avisale a Claude.';
  end if;

  /* 3. El recordatorio del supervisor. */
  v_def := pg_get_functiondef('orden_recordar(uuid)'::regprocedure);
  v_nuevo := replace(v_def, '''/hoy'', ''recordar:''', 'case when v_tar = 0 then ''/fotos'' else ''/hoy'' end, ''recordar:''');
  if v_nuevo <> v_def then execute v_nuevo; end if;
  if position('then ''/fotos'' else ''/hoy'' end, ''recordar:''' in pg_get_functiondef('orden_recordar(uuid)'::regprocedure)) = 0 then
    raise exception 'SQL 111: orden_recordar no tiene lo que se esperaba; no se cambió. Avisale a Claude.';
  end if;
end $$;
