-- ============================================================
-- GH PRO — Configuración del bucket de Storage para Hojas de Vida
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Crea el bucket "contratacion-docs" y sus políticas de acceso
-- ============================================================

-- 1. Crear el bucket público (si no existe)
insert into storage.buckets (id, name, public)
values ('contratacion-docs', 'contratacion-docs', true)
on conflict (id) do nothing;

-- 2. Políticas de acceso al bucket

-- Permitir subir archivos (jefes desde el portal)
create policy "allow_upload_contratacion_docs"
  on storage.objects for insert
  with check (bucket_id = 'contratacion-docs');

-- Permitir leer/descargar archivos (GH y jefes)
create policy "allow_read_contratacion_docs"
  on storage.objects for select
  using (bucket_id = 'contratacion-docs');

-- Permitir actualizar archivos
create policy "allow_update_contratacion_docs"
  on storage.objects for update
  using (bucket_id = 'contratacion-docs')
  with check (bucket_id = 'contratacion-docs');

-- Permitir eliminar archivos
create policy "allow_delete_contratacion_docs"
  on storage.objects for delete
  using (bucket_id = 'contratacion-docs');
