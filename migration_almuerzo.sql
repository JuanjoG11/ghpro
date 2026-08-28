-- ============================================================
-- MIGRACIÓN: Agregar tipos salida_almuerzo y regreso_almuerzo
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Eliminar el constraint CHECK anterior que solo admitía
--    'entrada' y 'salida', para poder insertar los nuevos tipos.
--
--    NOTA: En Supabase el nombre del constraint sigue el patrón
--    <tabla>_<columna>_check. Si falla, busca el nombre exacto con:
--    SELECT conname FROM pg_constraint WHERE conrelid = 'asistencia'::regclass;

ALTER TABLE asistencia
  DROP CONSTRAINT IF EXISTS asistencia_tipo_check;

-- 2. Agregar el nuevo constraint ampliado con los 4 tipos válidos.
ALTER TABLE asistencia
  ADD CONSTRAINT asistencia_tipo_check
  CHECK (tipo IN ('entrada', 'salida_almuerzo', 'regreso_almuerzo', 'salida'));

-- 3. Verificar que quedó bien (debe mostrar los 4 valores aceptados).
SELECT conname, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'asistencia'::regclass
  AND conname = 'asistencia_tipo_check';
