-- =====================================================================
-- Módulo VDH · Migración 32 (SQL 123), 15/10/2026: Ajustes más limpios,
-- fotos modelo para la IA y reglas que son sugerencia.
--
-- Pedido de Mauricio: "Sectores y módulos quedó media innecesaria con el
-- croquis", "lo de abajo no lo entiendo", "darle a la IA fotos para que
-- compare" y sus reglas nuevas de doblado. Con la propuesta delante dijo
-- "hacelo todo lo que recomendás".
--
-- 1. orden_reglas.sugerencia: una regla puede ser "hay que corregir" (como
--    hasta ahora) o una sugerencia de estilo, que nunca se vuelve tarea.
-- 2. orden_fotos_ejemplo: una foto ejemplo por tipo de mueble (módulo de
--    pared, mesa, perchero, vidriera, depósito). La IA la usa cuando el
--    módulo todavía no tiene su foto modelo. Sólo la carga el administrador.
-- 3. orden_tipo_mueble(): el tipo de mueble de un módulo, sacado del croquis
--    (si está en el medio, si es del depósito) y del nombre.
-- 4. orden_preparar_analisis: le pasa a la IA la foto modelo del módulo o, si
--    no tiene, la ejemplo de su tipo (y cuál de las dos es), el tipo de mueble
--    y si cada regla es sugerencia. Deja de mandar el "exhibidor": la pestaña
--    Exhibidores se sacó (los mínimos y máximos estaban vacíos y la única nota
--    repetía la regla de los frontales); los datos quedan en la tabla.
-- 5. Las reglas nuevas de doblado que mandó Mauricio, y la de los colores que
--    combinen como sugerencia ("combina lindo" es subjetivo: no es una falta).
-- 6. Las sugerencias de estilo de la IA se prenden en todos los locales (eran
--    la condición para que la regla de los colores se use; recomendado y
--    aceptado). Cada local las puede apagar en Ajustes → El local.
--
-- Se puede correr más de una vez (las reglas no se duplican; las
-- sugerencias se vuelven a prender en todos los locales).
--
-- Reversible:
--   update orden_config set ia_sugerencias = false;
--   delete from orden_reglas where texto in (las 6 de la parte 5);
--   volver orden_preparar_analisis a la de la migración 1 (orden_esquema);
--   drop function orden_tipo_mueble(boolean, text, orden_sector_tipo);
--   drop table orden_fotos_ejemplo;  alter table orden_reglas drop column sugerencia;
-- =====================================================================

-- 1. Reglas que son sugerencia
alter table orden_reglas add column if not exists sugerencia boolean not null default false;
comment on column orden_reglas.sugerencia is 'true: sugerencia de estilo (la IA la usa sólo con las sugerencias prendidas y nunca como "corregir")';

-- 2. Una foto ejemplo por tipo de mueble
create table if not exists orden_fotos_ejemplo (
  tipo            text primary key check (tipo in ('estantes', 'mesa', 'perchero', 'vidriera', 'deposito')),
  foto_path       text not null,   -- en el bucket orden-fotos (carpeta ejemplos/)
  actualizado_en  timestamptz not null default now()
);
alter table orden_fotos_ejemplo enable row level security;
drop policy if exists ver on orden_fotos_ejemplo;
create policy ver on orden_fotos_ejemplo for select to authenticated using (true);
drop policy if exists editar on orden_fotos_ejemplo;
create policy editar on orden_fotos_ejemplo for all to authenticated using (orden_es_admin()) with check (orden_es_admin());
grant select, insert, update, delete on orden_fotos_ejemplo to authenticated;
grant all on orden_fotos_ejemplo to service_role;

-- 3. El tipo de mueble de un módulo (el mismo criterio que el croquis)
create or replace function orden_tipo_mueble(p_isla boolean, p_nombre text, p_sector orden_sector_tipo)
returns text language sql immutable set search_path = public as $$
  select case
    when p_sector = 'deposito' then 'deposito'
    when coalesce(p_nombre, '') ~* 'vidriera' then 'vidriera'
    when coalesce(p_nombre, '') ~* 'perch' then 'perchero'
    when coalesce(p_isla, false) then 'mesa'
    else 'estantes' end
$$;
grant execute on function orden_tipo_mueble(boolean, text, orden_sector_tipo) to authenticated, service_role;

-- 4. Lo que recibe la IA con cada foto
create or replace function orden_preparar_analisis(p_foto uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  f orden_fotos; c orden_controles; m orden_modulos; s orden_sectores; cfg orden_config;
  v_tipo text; v_ejemplo text;
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
  -- La foto modelo del módulo; si no tiene, la ejemplo de su tipo de mueble
  v_tipo := orden_tipo_mueble(m.isla, m.nombre, s.tipo);
  select fe.foto_path into v_ejemplo from orden_fotos_ejemplo fe where fe.tipo = v_tipo;

  return jsonb_build_object(
    'foto_id', f.id,
    'foto_path', f.foto_path,
    'ia_estado', f.ia_estado,
    'local_id', c.local_id,
    'control_tipo', c.tipo,
    'sector_tipo', s.tipo,
    'modulo_nombre', m.nombre,
    'referencia_path', coalesce(m.foto_referencia_path, v_ejemplo),
    'referencia_tipo', case when m.foto_referencia_path is not null then 'modulo'
                            when v_ejemplo is not null then 'ejemplo' end,
    'mueble', case v_tipo when 'estantes' then 'Módulo de pared con estantes'
                          when 'mesa' then 'Mesa o exhibidor del medio'
                          when 'perchero' then 'Perchero'
                          when 'vidriera' then 'Vidriera'
                          else 'Estantería del depósito' end,
    'reglas_extra', m.reglas_extra,
    'exhibidor', null,
    'checks', to_jsonb(orden_checks_ia(s.tipo)),
    'reglas', coalesce((
       select jsonb_agg(jsonb_build_object('check', r.check_clave, 'texto', r.texto, 'sugerencia', r.sugerencia)
                        order by r.check_clave, r.orden)
       from orden_reglas r
       where r.activo and (r.local_id is null or r.local_id = c.local_id)
         and (r.sector_tipo is null or r.sector_tipo = s.tipo)), '[]'::jsonb),
    'colores', coalesce((
       select jsonb_agg(col.nombre order by col.orden) from orden_colores col where col.activo), '[]'::jsonb),
    'ia_activa', coalesce(cfg.ia_activa, true),
    'ia_sugerencias', coalesce(cfg.ia_sugerencias, false)
  );
end $$;

-- 5. Las reglas nuevas (15/10/2026). La de "Estantes sin huecos" sigue.
insert into orden_reglas (sector_tipo, check_clave, texto, orden, sugerencia)
select v.sector_tipo::orden_sector_tipo, v.check_clave, v.texto, v.orden, v.sugerencia
from (values
  ('salon', 'dobladas', 'Prendas finas (remeras, camisas, buzos finos, de tela tipo rústico): 4 prendas apiladas en cada estante, bien dobladas, anchas y con volumen, para que la pila quede alta y pareja.', 3, false),
  ('salon', 'dobladas', 'Prendas gruesas (buzos gruesos, camperas livianas): 3 prendas apiladas por estante está bien.', 4, false),
  ('salon', 'dobladas', 'Shorts: 4 por pila, que el espacio quede cargado, prolijo y estético.', 5, false),
  ('salon', 'dobladas', 'La pila aprovecha el alto del estante: ni baja ni desparramada.', 6, false),
  ('salon', 'dobladas', 'Todo parejo: bordes alineados y estampas o logos visibles hacia el frente.', 7, false),
  ('salon', 'exhibicion', 'Colores que combinen entre pilas vecinas: claros con claros, o tonos que armen un degradé o un contraste lindo, sin mezclas que "ensucien".', 4, true)
) as v(sector_tipo, check_clave, texto, orden, sugerencia)
where not exists (select 1 from orden_reglas r where r.texto = v.texto);

-- 6. Las sugerencias de estilo, prendidas en todos los locales
update orden_config set ia_sugerencias = true where not ia_sugerencias;
