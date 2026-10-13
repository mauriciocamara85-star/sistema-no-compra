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
