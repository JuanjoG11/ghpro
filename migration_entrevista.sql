-- ============================================================
-- GH PRO — Migración: campo de observaciones de entrevista en requisicion_personal
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

alter table requisicion_personal
  add column if not exists obs_entrevista text;  -- notas de entrevista (fecha, lugar, entrevistador, resultado)
