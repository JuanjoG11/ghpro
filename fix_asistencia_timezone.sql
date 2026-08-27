-- ============================================================
-- FIX: Corregir fechas de asistencia desplazadas por zona horaria
--
-- PROBLEMA: Los registros guardados entre las 00:00 y 04:59 (hora
-- mostrada en la app) fueron insertados con la fecha UTC en lugar
-- de la fecha local de Colombia (UTC-5).
-- Colombia es UTC-5, por lo que:
--   - 00:00 Colombia = 05:00 UTC (siguiente día)
--   - 04:59 Colombia = 09:59 UTC (siguiente día)
-- Esos registros quedaron con fecha = día_siguiente en la BD.
--
-- SOLUCIÓN: Restar 1 día a todos los registros donde hora < '05:00:00'
-- Solo aplica para fechas donde existan estos registros nocturnos
-- anómalos. Revisar antes de ejecutar con el SELECT de verificación.
--
-- EJECUTAR EN: Supabase SQL Editor
-- ============================================================

-- ── PASO 1: Verificar qué registros serán afectados ───────────────
-- (Ejecuta esto primero para revisar antes de modificar)
SELECT
  id,
  fecha,
  hora,
  tipo,
  trabajador_nombre,
  cedula,
  (fecha - INTERVAL '1 day')::date AS fecha_corregida
FROM asistencia
WHERE hora < '05:00:00'
ORDER BY fecha DESC, hora DESC;

-- ── PASO 2: Aplicar corrección ────────────────────────────────────
-- Retrocede 1 día en la fecha de todos los registros cuya hora
-- quedó registrada entre 00:00 y 04:59 (madrugada Colombia).
-- IMPORTANTE: Ejecuta primero el SELECT anterior para confirmar.

UPDATE asistencia
SET fecha = (fecha - INTERVAL '1 day')::date
WHERE hora < '05:00:00';

-- ── PASO 3: Verificar resultado ───────────────────────────────────
SELECT
  fecha,
  COUNT(*) AS total_registros,
  MIN(hora) AS hora_mas_temprana,
  MAX(hora) AS hora_mas_tarde
FROM asistencia
GROUP BY fecha
ORDER BY fecha DESC
LIMIT 10;
