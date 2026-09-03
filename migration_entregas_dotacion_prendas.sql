-- ============================================================
-- GH PRO — Migración: Conectar Entregas con dotacion_prendas
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Eliminar la foreign key antigua que apuntaba a la tabla obsoleta 'dotacion'
ALTER TABLE entregas
  DROP CONSTRAINT IF EXISTS entregas_articulo_id_fkey;

-- 2. Conectar articulo_id hacia la tabla moderna 'dotacion_prendas'
ALTER TABLE entregas
  ADD CONSTRAINT entregas_articulo_id_fkey
  FOREIGN KEY (articulo_id) REFERENCES dotacion_prendas(id)
  ON DELETE SET NULL;

-- 3. Eliminar triggers antiguos que apuntaban a la tabla obsoleta 'dotacion'
DROP TRIGGER IF EXISTS trg_descontar_stock ON entregas;
DROP TRIGGER IF EXISTS trg_restaurar_stock ON entregas;
DROP FUNCTION IF EXISTS fn_descontar_stock();
DROP FUNCTION IF EXISTS fn_restaurar_stock();

-- 4. Asegurar permisos en Supabase para dotacion_prendas y entregas
GRANT ALL ON TABLE dotacion_prendas TO anon, authenticated, service_role;
GRANT ALL ON TABLE entregas TO anon, authenticated, service_role;

-- 5. Consulta de verificación
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'entregas';
