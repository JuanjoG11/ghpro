-- ============================================================
-- GH PRO — Bloqueo estricto por dispositivo (máx. 2 por día)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Agregar columna device_id a la tabla asistencia existente
-- (si ya existe la columna, no hace nada)
alter table asistencia
  add column if not exists device_id text;

-- Índice para que la consulta de conteo sea rápida
create index if not exists idx_asistencia_device_fecha
  on asistencia (device_id, fecha);
