-- ============================================================
-- Migración: ampliar constraint asistencia_metodo_check
-- Agrega 'link_nutrefrios' como valor válido para el campo metodo
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- 1. Eliminar el constraint actual
ALTER TABLE asistencia
  DROP CONSTRAINT IF EXISTS asistencia_metodo_check;

-- 2. Recrearlo con los valores ampliados
ALTER TABLE asistencia
  ADD CONSTRAINT asistencia_metodo_check
  CHECK (metodo IN ('cedula', 'qr', 'link_nutrefrios'));
