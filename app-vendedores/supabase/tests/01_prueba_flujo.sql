-- =====================================================================
-- Prueba del flujo completo en un Postgres local (con 00_stubs_local.sql).
-- Simula el martes 13/10/2026 en Rivadavia. Si algo falla, corta con error.
--   psql -v ON_ERROR_STOP=1 -f 00_stubs_local.sql -f ../migrations/...01 -f ...04 -f ...05 -f 01_prueba_flujo.sql
-- =====================================================================
\set QUIET on
\pset footer off
\pset tuples_only on

-- ---------- Usuarios de prueba ----------
insert into auth.users (id) select gen_random_uuid() from generate_series(1, 4);
with u as (select id, row_number() over (order by id) n from auth.users),
     p as (select id, row_number() over (order by nombre) n from orden_personas where nombre in ('Mau','Lautaro','Nano','Mel'))
update orden_personas pe set auth_user_id = u.id from u join p on p.n = u.n where pe.id = p.id;

create or replace function pg_temp.uid(p_nombre text) returns text language sql as
$$ select auth_user_id::text from orden_personas where nombre = p_nombre $$;
create or replace function pg_temp.ok(cond boolean, msg text) returns text language plpgsql as
$$ begin if not coalesce(cond, false) then raise exception 'FALLÓ: %', msg; end if; return 'OK  ' || msg; end $$;

-- ---------- 1. El reloj genera los controles del martes (día de control) ----------
select set_config('request.jwt.claim.role', 'service_role', false);
select orden_tick('2026-10-13 03:05+00') as tick_madrugada;
select pg_temp.ok((select count(*) from orden_controles where tipo = 'programado' and fecha = '2026-10-13') = 15,
                  '15 controles programados (5 por vendedor)');
select pg_temp.ok((select count(*) from orden_controles where tipo = 'deposito') = 3, '3 controles semanales de depósito');
select pg_temp.ok((select count(*) from orden_avisos) = 0, 'a las 00:05 todavía no se avisa a nadie');
select orden_tick('2026-10-13 03:20+00');
select pg_temp.ok((select count(*) from orden_controles) = 18, 'correr el reloj de nuevo no duplica nada');

-- ---------- 2. Aviso de la mañana (10:35) ----------
select orden_tick('2026-10-13 13:35+00') as tick_manana;
select pg_temp.ok((select count(*) from orden_avisos where tipo = 'dia') = 3, 'aviso de la mañana a Lautaro, Nano y Seba');
select titulo, cuerpo from orden_avisos where tipo = 'dia' order by titulo limit 1;
select orden_tick('2026-10-13 13:50+00');
select pg_temp.ok((select count(*) from orden_avisos where tipo = 'dia') = 3, 'el aviso de la mañana no se repite');

-- ---------- 3. Lautaro: ve solo lo suyo ----------
select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claim.sub', pg_temp.uid('Lautaro'), false);
set role authenticated;
select pg_temp.ok((select count(*) from orden_v_controles) = 6, 'Lautaro ve sus 5 módulos + su depósito');
select pg_temp.ok((select count(*) from orden_v_controles where persona_nombre = 'Nano') = 0, 'Lautaro no ve los controles de Nano');
select pg_temp.ok((select count(*) from orden_preguntas) = 0, 'Lautaro no puede leer el banco de preguntas (tiene las respuestas)');
select pg_temp.ok((select count(*) from orden_avisos) = 1, 'Lautaro ve solo su aviso');

-- Foto del módulo 1 → la IA encuentra un frontal incompleto
select id as ctl1 from orden_controles where modulo_id = (select id from orden_modulos where nombre = 'Módulo 1') \gset
select orden_registrar_foto(:'ctl1', (select id from orden_locales limit 1)::text || '/2026-10-13/' || :'ctl1' || '/a.jpg') as foto1 \gset
reset role;

select set_config('request.jwt.claim.role', 'service_role', false);
select orden_aplicar_resultado_ia(:'foto1', '{
  "foto_valida": true, "confianza": "alta", "nivel_sugerido": "a_mejorar",
  "checks": {"dobladas":"ok","frontales":"mal","etiquetas":"no_se_ve","limpieza":"ok","exhibicion":"ok"},
  "hallazgos": [{"check":"frontales","titulo":"Completá el frontal: faltan 2 prendas","detalle":"Si no hay más stock, cambiá la prenda por otro producto.","gravedad":"corregir"}]
}'::jsonb, 'prueba') -> 'tareas_creadas' as tareas_creadas;
select pg_temp.ok((select count(*) from orden_tareas where origen = 'ia' and estado = 'pendiente') = 1, 'la IA creó 1 tarea');
select titulo, to_char(vence_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI') as vence from orden_tareas where origen = 'ia';

-- Lautaro corrige y saca otra foto → la IA ya no ve el problema → la tarea se cierra sola
select set_config('request.jwt.claim.role', '', false);
set role authenticated;
select orden_registrar_foto(:'ctl1', (select id from orden_locales limit 1)::text || '/2026-10-13/' || :'ctl1' || '/b.jpg') as foto2 \gset
reset role;
select set_config('request.jwt.claim.role', 'service_role', false);
select orden_aplicar_resultado_ia(:'foto2', '{
  "foto_valida": true, "confianza": "alta", "nivel_sugerido": "bien",
  "checks": {"dobladas":"ok","frontales":"ok","etiquetas":"no_se_ve","limpieza":"ok","exhibicion":"ok"},
  "hallazgos": []}'::jsonb, 'prueba') ->> 'tareas_resueltas' as tareas_resueltas;
select pg_temp.ok((select estado from orden_tareas where origen = 'ia') = 'hecha', 'la tarea de la IA se cerró sola con la foto nueva');

-- Envía declarando todo "sí"
select set_config('request.jwt.claim.role', '', false);
set role authenticated;
select estado, nivel_declarado, nivel_ia, discrepancia
from orden_enviar_control(:'ctl1', '{"dobladas":true,"frontales":true,"etiquetas":true,"limpieza":true}');
select pg_temp.ok((select estado from orden_controles where id = :'ctl1') = 'enviado', 'control enviado');

-- Módulo 2: la IA ve un problema y Lautaro lo manda igual (declara que está todo bien) → queda marcado como dudoso
select id as ctl2 from orden_controles where modulo_id = (select id from orden_modulos where nombre = 'Módulo 2') \gset
select orden_registrar_foto(:'ctl2', (select id from orden_locales limit 1)::text || '/x/' || :'ctl2' || '/a.jpg') as foto3 \gset
reset role;
select set_config('request.jwt.claim.role', 'service_role', false);
select orden_aplicar_resultado_ia(:'foto3', '{
  "foto_valida": true, "confianza": "alta", "nivel_sugerido": "fuera_de_estandar",
  "checks": {"dobladas":"mal","frontales":"mal","etiquetas":"ok","limpieza":"mal","exhibicion":"ok"},
  "hallazgos": [{"check":"dobladas","titulo":"Redoblá las pilas del estante de abajo","gravedad":"corregir"},
                {"check":"limpieza","titulo":"Sacá las cajas de arriba del módulo","gravedad":"corregir"},
                {"check":"exhibicion","titulo":"Podrías ordenar por color","gravedad":"sugerencia"}]
}'::jsonb, 'prueba') -> 'tareas_creadas' as tareas_creadas;
select pg_temp.ok((select count(*) from orden_tareas where control_id = :'ctl2') = 2, 'solo los puntos "corregir" son tareas (la sugerencia no)');
select set_config('request.jwt.claim.role', '', false);
set role authenticated;
select pg_temp.ok((orden_enviar_control(:'ctl2', '{"dobladas":true,"frontales":true,"etiquetas":true,"limpieza":true}')).discrepancia,
                  'lo declarado no coincide con la IA → discrepancia');
-- No puede enviar sin responder las 4 preguntas
select id as ctl3 from orden_controles where modulo_id = (select id from orden_modulos where nombre = 'Módulo 3') \gset
select orden_registrar_foto(:'ctl3', (select id from orden_locales limit 1)::text || '/x/' || :'ctl3' || '/a.jpg') \gset
do $$ begin
  perform orden_enviar_control((select id from orden_controles where modulo_id = (select id from orden_modulos where nombre = 'Módulo 3')), '{"dobladas":true}');
  raise exception 'FALLÓ: dejó enviar con respuestas incompletas';
exception when others then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'OK  no deja enviar sin las 4 respuestas (%)', sqlerrm;
end $$;
-- No puede tocar controles ajenos
do $$ begin
  perform orden_registrar_foto((select id from orden_controles c where c.persona_id = (select id from orden_personas where nombre = 'Nano') limit 1), 'x/y.jpg');
  raise exception 'FALLÓ: dejó registrar foto en un control ajeno';
exception when others then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'OK  no deja tocar controles ajenos (%)', sqlerrm;
end $$;
reset role;

-- ---------- 4. Supervisor (Mau, admin) revisa ----------
select set_config('request.jwt.claim.sub', pg_temp.uid('Mau'), false);
set role authenticated;
select pg_temp.ok((select modulo_nombre from orden_v_por_revisar limit 1) = 'Módulo 2', 'primero en la cola: el dudoso (discrepancia)');
do $$ begin
  perform orden_revisar_control((select id from orden_controles where modulo_id = (select id from orden_modulos where nombre = 'Módulo 2')), 'impecable', null);
  raise exception 'FALLÓ: dejó saltar 3 niveles sin comentario';
exception when others then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'OK  para cambiar más de un nivel pide comentario (%)', sqlerrm;
end $$;
select nivel_final, estado from orden_revisar_control(:'ctl2', 'fuera_de_estandar', 'Módulo desarmado');
select nivel_final, estado from orden_revisar_control(:'ctl1', 'bien', null);

-- Botón "Recordar" (una vez por hora)
select pg_temp.ok(orden_recordar((select id from orden_personas where nombre = 'Nano')), 'botón Recordar le manda aviso a Nano');
select pg_temp.ok(not orden_recordar((select id from orden_personas where nombre = 'Nano')), 'Recordar no se repite en la misma hora');

-- Mau le asigna una tarea a Nano; Nano pide más tiempo; Mau aprueba
select orden_crear_tarea(array[(select id from orden_personas where nombre = 'Nano')], 'Limpiar debajo de la PC', null, null, 'hoy', false) as tarea_nano \gset
reset role;
select set_config('request.jwt.claim.sub', pg_temp.uid('Nano'), false);
set role authenticated;
select orden_pedir_prorroga(:'tarea_nano', 'Hoy estoy solo en el salón');
reset role;
select set_config('request.jwt.claim.sub', pg_temp.uid('Mau'), false);
set role authenticated;
select prorroga_estado, to_char(vence_en at time zone 'America/Argentina/Buenos_Aires', 'Dy DD/MM HH24:MI') as nuevo_vencimiento
from orden_responder_prorroga(:'tarea_nano', true, 'manana');
reset role;

-- ---------- 5. 16:05 recordatorio · 18:05 vence lo que no se mandó ----------
select set_config('request.jwt.claim.role', 'service_role', false);
select orden_tick('2026-10-13 19:05+00');
select pg_temp.ok((select count(*) from orden_avisos where tipo = 'recordatorio') >= 2, 'recordatorio de la tarde a quien le falta');
select orden_tick('2026-10-13 21:05+00') as tick_cierre;
select pg_temp.ok((select count(*) from orden_controles where estado = 'vencido' and tipo = 'programado') = 13,
                  '13 controles vencidos (Nano 5, Seba 5, Lautaro 3: el módulo 3 sacó foto pero no lo envió)');
select pg_temp.ok((select count(*) from orden_avisos where tipo = 'control_vencido' and persona_id = (select id from orden_personas where nombre = 'Mau')) = 3,
                  'Mau (sin supervisor cargado) recibe 1 aviso por vendedor atrasado');
select pg_temp.ok((select count(*) from orden_faltas) = 0, 'en modo prueba no se sugieren faltas');

-- ---------- 6. Fuera del modo prueba: falta sugerida ----------
update orden_config set modo_prueba = false;
select orden_tick('2026-10-13 21:20+00');
select pg_temp.ok((select count(*) from orden_faltas) = 0, 'un solo día malo no alcanza para sugerir una falta (umbral: 3 días)');
-- Para la prueba bajamos el umbral a 1 día
update orden_config set umbral_dias_sin_control = 1;
select orden_tick('2026-10-13 21:25+00');
select pe.nombre, f.tipo, f.estado, f.motivo from orden_faltas f join orden_personas pe on pe.id = f.persona_id order by pe.nombre;
select pg_temp.ok((select count(*) from orden_faltas where tipo = 'advertencia' and estado = 'sugerida') = 3, 'con umbral 1: advertencia sugerida a los 3');
select orden_tick('2026-10-13 21:35+00');
select pg_temp.ok((select count(*) from orden_faltas) = 3, 'no vuelve a sugerir por lo mismo');
update orden_config set umbral_dias_sin_control = 3;

-- Mau confirma la de Nano → la próxima ya sería apercibimiento
select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claim.sub', pg_temp.uid('Mau'), false);
set role authenticated;
select tipo, estado from orden_decidir_falta((select f.id from orden_faltas f join orden_personas p on p.id = f.persona_id where p.nombre = 'Nano'), true, null, 'Hablado en persona');
reset role;
select pg_temp.ok(orden_siguiente_sancion((select id from orden_personas where nombre = 'Nano')) = 'apercibimiento', 'la siguiente de Nano sería apercibimiento');
update orden_config set modo_prueba = true;

-- ---------- 7. Desafío semanal ----------
update orden_config set desafio_activo = true;
select set_config('request.jwt.claim.role', 'service_role', false);
-- recorre la semana cada hora hasta que a todos les llegue
do $$ declare t timestamptz;
begin
  for t in select generate_series('2026-10-12 13:00+00'::timestamptz, '2026-10-18 23:00+00', interval '15 minutes') loop
    perform orden_tick(t);
  end loop;
end $$;
select pe.nombre, d.categoria, d.dificultad, d.total,
       to_char(d.creado_en at time zone 'America/Argentina/Buenos_Aires', 'Dy DD/MM HH24:MI') as llega,
       to_char(d.vence_en at time zone 'America/Argentina/Buenos_Aires', 'Dy DD/MM HH24:MI') as cierra,
       (select count(*) from orden_avisos a where a.clave = 'desafio:' || d.id) as avisos
from orden_desafios d join orden_personas pe on pe.id = d.persona_id order by pe.nombre;
select pg_temp.ok((select count(*) from orden_desafios) >= 4, 'cada vendedor que trabaja tiene su desafío');

select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claim.sub', pg_temp.uid('Lautaro'), false);
set role authenticated;
select pg_temp.ok(not exists (select 1 from jsonb_array_elements(orden_desafio_mio() -> 'preguntas') q where q ->> 'correcta' is not null),
                  'el vendedor no ve la respuesta correcta antes de contestar');
reset role;
-- habilita el desafío de Lautaro hasta "ahora" para poder responder en la prueba
update orden_desafios set vence_en = now() + interval '1 day' where persona_id = (select id from orden_personas where nombre = 'Lautaro');
set role authenticated;
select x.r ->> 'acerto' as acerto, left(x.r ->> 'explicacion', 60) as explicacion
from (select orden_desafio_responder((orden_desafio_mio() ->> 'id')::uuid, (q ->> 'id')::uuid, 1::smallint) as r
      from jsonb_array_elements(orden_desafio_mio() -> 'preguntas') q) x;
select pg_temp.ok((orden_desafio_mio() ->> 'terminado_en') is not null, 'desafío terminado');
reset role;

-- ---------- 8. Estadísticas (lo que ve No Compra) ----------
select set_config('request.jwt.claim.sub', pg_temp.uid('Mau'), false);
set role authenticated;
select persona_nombre, controles, controles_a_tiempo, controles_vencidos, nivel_semana,
       tareas, tareas_hechas, tareas_fuera_de_plazo, desafio_puntaje || '/' || desafio_total as desafio
from orden_v_persona_semana where semana = '2026-10-12' order by persona_nombre;
select jsonb_pretty(orden_resumen_semanal((select id from orden_locales limit 1), '2026-10-12'));
reset role;

-- ---------- 9. Plazos ----------
select pg_temp.ok(
  to_char(orden_calcular_vencimiento((select id from orden_personas where nombre = 'Lautaro'), 'hoy', '2026-10-17 20:30+00')
          at time zone 'America/Argentina/Buenos_Aires', 'Dy DD/MM HH24:MI') = 'Mon 19/10 18:00',
  'tarea "para hoy" pedida el sábado 17:30 → vence el lunes (el domingo no abre)');
select pg_temp.ok(
  to_char(orden_calcular_vencimiento((select id from orden_personas where nombre = 'Lautaro'), 'hoy', '2026-10-14 13:00+00')
          at time zone 'America/Argentina/Buenos_Aires', 'Dy DD/MM HH24:MI') = 'Wed 14/10 18:00',
  'tarea "para hoy" pedida el miércoles 10:00 → vence ese día 18:00');

-- ---------- 10. Control de caja (con los números de las fotos que mandó Mau) ----------
update orden_config set caja_activa = true;
select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claim.sub', pg_temp.uid('Lautaro'), false);
set role authenticated;
select id as caja from orden_caja_hoy() \gset
select orden_caja_registrar_foto(:'caja', 'lote', (select id from orden_locales limit 1)::text || '/cajas/hoy/lote.jpg') as foto_lote \gset
reset role;
-- la IA leyó un cierre de lote de OTRO día (11/10) por $708.000
select set_config('request.jwt.claim.role', 'service_role', false);
select orden_caja_aplicar_lectura(:'foto_lote', ('{"foto_valida": true, "total": 708000, "fecha": "2026-10-11"}')::jsonb, 'prueba');
select set_config('request.jwt.claim.role', '', false);
set role authenticated;
-- cargan: sistema tarjeta 708.000, lote 700.000 (tipeado distinto a la foto), efectivo: saldo 45.100 y contaron 36.100
select estado, desvio_tarjeta, desvio_efectivo, jsonb_array_length(alertas) as alertas
from orden_caja_guardar(:'caja', '{"sis_tarjeta": 708000, "sis_mp": 173000, "real_mp": 173000, "sis_saldo_final_efvo": 45100,
                                   "real_lote": 700000, "real_efectivo": 36100}', null);
select a ->> 'tipo' as alerta, a ->> 'campo' as campo from orden_cajas, jsonb_array_elements(alertas) a where id = :'caja';
select pg_temp.ok((select count(*) from orden_cajas c, jsonb_array_elements(c.alertas) a where c.id = :'caja') = 4,
                  'caja: desvío tarjeta + desvío efectivo + monto distinto a la foto + foto de otro día');
reset role;
select pg_temp.ok((select count(*) from orden_avisos where tipo = 'caja_alerta') >= 1, 'el supervisor/admin recibe la alerta de caja al instante');
-- Mau no puede darla por controlada sin escribir qué pasó
select set_config('request.jwt.claim.sub', pg_temp.uid('Mau'), false);
set role authenticated;
do $$ begin
  perform orden_caja_controlar((select id from orden_cajas limit 1), null);
  raise exception 'FALLÓ: dejó controlar una caja con alertas sin nota';
exception when others then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'OK  caja con alertas pide nota para controlarla (%)', sqlerrm;
end $$;
select estado from orden_caja_controlar(:'caja', 'Faltaron $9.000, hablado con el encargado');
reset role;
select set_config('request.jwt.claim.role', 'service_role', false);
select jsonb_pretty(orden_resumen_cajas_dia(orden_fecha_local((select id from orden_locales limit 1))));
-- Un día sin cargar la caja: a la hora del cierre + 60 min avisa al local
select orden_tick_cajas('2026-10-14 00:05+00');  -- martes 21:05 (cierra 20:00)
select pg_temp.ok((select count(*) from orden_avisos where tipo = 'caja_sin_cargar') >= 1, 'local sin cargar la caja → aviso');
select pg_temp.ok((select count(*) from orden_v_personas where not avisos_activos) = 6, 'No Compra ve quién no activó las notificaciones');

-- ---------- 11. Arreglos de la revisión independiente ----------
-- a) Una foto con poca confianza NO cierra las tareas abiertas; una foto se analiza una sola vez
select set_config('request.jwt.claim.role', '', false);
select set_config('request.jwt.claim.sub', pg_temp.uid('Lautaro'), false);
set role authenticated;
select id as ctl4 from orden_controles where modulo_id = (select id from orden_modulos where nombre = 'Módulo 4') and tipo = 'programado' order by fecha limit 1 \gset
select orden_registrar_foto(:'ctl4', (select id from orden_locales limit 1)::text || '/x/' || :'ctl4' || '/a.jpg') as f4a \gset
reset role;
select set_config('request.jwt.claim.role', 'service_role', false);
select orden_aplicar_resultado_ia(:'f4a', '{"foto_valida": true, "confianza": "alta", "nivel_sugerido": "a_mejorar",
  "checks": {"dobladas":"ok","frontales":"mal","etiquetas":"ok","limpieza":"ok","exhibicion":"ok"},
  "hallazgos": [{"check":"frontales","titulo":"Completá el frontal","gravedad":"corregir"}]}'::jsonb, 'prueba') is not null;
select set_config('request.jwt.claim.role', '', false);
set role authenticated;
select orden_registrar_foto(:'ctl4', (select id from orden_locales limit 1)::text || '/x/' || :'ctl4' || '/b.jpg') as f4b \gset
reset role;
select set_config('request.jwt.claim.role', 'service_role', false);
select pg_temp.ok((orden_aplicar_resultado_ia(:'f4b', '{"foto_valida": true, "confianza": "baja", "nivel_sugerido": "bien",
  "checks": {"dobladas":"ok","frontales":"no_se_ve","etiquetas":"ok","limpieza":"ok","exhibicion":"ok"},
  "hallazgos": []}'::jsonb, 'prueba') ->> 'tareas_resueltas')::int = 0, 'foto con poca confianza no cierra tareas');
select pg_temp.ok((select estado from orden_tareas where clave = 'ia:' || (select id from orden_modulos where nombre = 'Módulo 4') || ':frontales'
                   order by creado_en desc limit 1) = 'pendiente', 'la tarea del frontal sigue abierta');
do $$ begin
  perform orden_aplicar_resultado_ia((select id from orden_fotos order by tomada_en desc limit 1), '{"foto_valida": true}'::jsonb, 'x');
  raise exception 'FALLÓ: dejó analizar dos veces la misma foto';
exception when others then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'OK  una foto se analiza una sola vez (%)', sqlerrm;
end $$;

-- b) Quien cierra no puede tocar la caja de días anteriores (solo el supervisor)
insert into orden_cajas (local_id, fecha, estado, real_efectivo) select id, orden_dia_caja(id) - 3, 'cargada', 60000 from orden_locales
returning id as caja_vieja \gset
select set_config('orden.caja_vieja', :'caja_vieja', false);
select set_config('request.jwt.claim.role', '', false);
set role authenticated;
do $$ begin
  perform orden_caja_guardar(current_setting('orden.caja_vieja')::uuid, '{"real_efectivo": 40000}'::jsonb, null);
  raise exception 'FALLÓ: un vendedor cambió la caja de hace 3 días';
exception when others then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'OK  la caja de días anteriores no la puede tocar un vendedor (%)', sqlerrm;
end $$;
-- e) Un vendedor no puede consultar la situación disciplinaria de otro
do $$ begin
  perform orden_siguiente_sancion((select id from orden_personas where nombre = 'Seba'));
  raise exception 'FALLÓ: un vendedor consultó la sanción de otro';
exception when others then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'OK  un vendedor no puede consultar sanciones ajenas (%)', sqlerrm;
end $$;
reset role;

-- c) Montos y fechas raras no rompen el guardado
select pg_temp.ok(orden_num('$ 1.440.100,00') = 1440100 and orden_num('708000') = 708000 and orden_num('abc') is null,
                  'montos en formato argentino se leen bien');
select pg_temp.ok(orden_fecha_segura('2026-13-10') is null and orden_fecha_segura('2026-10-11') = '2026-10-11', 'fechas imposibles quedan en null');

-- f) El supervisor no puede saltear las validaciones escribiendo directo en las tablas
select set_config('request.jwt.claim.sub', pg_temp.uid('Mau'), false);
set role authenticated;
do $$ begin
  insert into orden_controles (local_id, modulo_id, persona_id, fecha, tipo, estado, vence_en, nivel_final)
  select l.id, m.id, (select id from orden_personas where nombre = 'Nano'), '2026-10-20', 'programado', 'revisado', now(), 'fuera_de_estandar'
  from orden_locales l, orden_modulos m limit 1;
  raise exception 'FALLÓ: se pudo insertar un control revisado directo en la tabla';
exception when others then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'OK  no se puede escribir directo en controles (%)', sqlerrm;
end $$;
-- y cancelar una tarea pide motivo y queda registrada
select pg_temp.ok((select count(*) from orden_tareas where estado = 'pendiente') > 0, 'hay tareas para cancelar');
select orden_cancelar_tarea((select id from orden_tareas where estado = 'pendiente' order by creado_en limit 1), 'Se reorganizó el local');
reset role;
select pg_temp.ok((select count(*) from orden_tareas where estado = 'cancelada') = 1, 'tarea cancelada por el supervisor con motivo');

-- g) Cierre a las 23:00: el aviso de "falta la caja" sale después de medianoche y es por el día que cerró
update orden_locales set hora_cierre = '23:00';
delete from orden_avisos where tipo = 'caja_sin_cargar';
select set_config('request.jwt.claim.role', 'service_role', false);
select orden_tick_cajas('2026-10-15 02:20+00');  -- miércoles 14, 23:20: todavía dentro de la tolerancia
select pg_temp.ok((select count(*) from orden_avisos where tipo = 'caja_sin_cargar' and clave like '%2026-10-14%') = 0,
                  '23:20: todavía no avisa por el miércoles');
select orden_tick_cajas('2026-10-15 03:05+00');  -- jueves 15, 00:05: ya pasó la hora de cierre + 60 min
select pg_temp.ok((select count(*) from orden_avisos where tipo = 'caja_sin_cargar' and clave like '%2026-10-14%') >= 1,
                  '00:05: avisa que falta la caja del miércoles 14 (el día que cerró), no la del jueves');
select pg_temp.ok((select count(*) from orden_avisos where tipo = 'caja_sin_cargar' and clave like '%2026-10-15%') = 0,
                  'no avisa del jueves antes de que abra'); 

-- ---------- 12. Gerencia ("solo mirar"), "Cómo está el local" y borrado de fotos ----------
reset role;
select set_config('request.jwt.claim.role', '', false);
insert into auth.users (id) values (gen_random_uuid()) returning id as uid_gerencia \gset
select set_config('orden.ctl1', :'ctl1', false);
insert into orden_personas (nombre, rol, local_id, auth_user_id) values ('Gerencia prueba', 'gerencia', null, :'uid_gerencia');
select set_config('request.jwt.claim.sub', :'uid_gerencia', false);
set role authenticated;
select pg_temp.ok((select count(*) from orden_v_estado_local) = 18, 'gerencia ve los 15 módulos y los 3 depósitos de Rivadavia');
select pg_temp.ok((select count(*) from orden_v_estado_local where foto_path is not null) >= 3, '"Cómo está el local" muestra la última foto de cada módulo');
select pg_temp.ok((select count(*) from orden_controles) > 0 and (select count(*) from orden_v_persona_semana) > 0, 'gerencia ve controles y estadísticas');
update orden_config set modo_prueba = false;
reset role;
select pg_temp.ok((select bool_and(modo_prueba) from orden_config), 'gerencia no puede cambiar la configuración');
set role authenticated;
do $$ begin
  perform orden_revisar_control(current_setting('orden.ctl1')::uuid, 'bien', null);
  raise exception 'FALLÓ: gerencia pudo revisar un control';
exception when others then
  if sqlerrm like 'FALLÓ%' then raise; end if;
  raise notice 'OK  gerencia no revisa ni califica: solo mira (%)', sqlerrm;
end $$;
-- un vendedor ve en "Cómo está el local" solo sus propias fotos
reset role;
select set_config('request.jwt.claim.sub', pg_temp.uid('Nano'), false);
set role authenticated;
select pg_temp.ok((select count(*) from orden_v_estado_local where foto_path is not null and foto_de <> 'Nano') = 0,
                  'un vendedor no ve las fotos de los demás');
reset role;

-- Borrado: al mes se borran las fotos ya controladas, salvo la última de cada módulo
select pg_temp.ok((select count(*) from orden_fotos_para_borrar(500)) = 0, 'fotos recientes: no se borra nada');
do $$ begin
  update orden_config set dias_guardar_fotos = 3;
  raise exception 'FALLÓ: dejó guardar fotos menos de una semana';
exception when check_violation then
  raise notice 'OK  la configuración no deja guardar fotos menos de 7 días';
end $$;
update orden_fotos set tomada_en = now() - case when foto_path like '%/a.jpg' then interval '41 days' else interval '40 days' end
 where control_id in (select id from orden_controles where modulo_id = (select id from orden_modulos where nombre = 'Módulo 1'));
select pg_temp.ok((select count(*) from orden_fotos_para_borrar(500) b join orden_fotos f on f.id = b.id
                   where f.foto_path like '%/a.jpg' and f.control_id in (select id from orden_controles where modulo_id = (select id from orden_modulos where nombre = 'Módulo 1'))) = 1,
                  'foto vieja del módulo 1 → se borra');
select pg_temp.ok((select count(*) from orden_fotos_para_borrar(500) b join orden_fotos f on f.id = b.id
                   where f.foto_path like '%/b.jpg' and f.control_id in (select id from orden_controles where modulo_id = (select id from orden_modulos where nombre = 'Módulo 1'))) = 0,
                  'la última foto del módulo 1 no se borra aunque sea vieja');

\echo
\echo '=== PRUEBA COMPLETA: todo OK ==='
