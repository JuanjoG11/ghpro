-- ============================================================
-- FIX: Corregir marca (proveedor) y cargo de todos los
--      trabajadores basándose en unidad_organizacional
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Paso 1: Registros con proveedor Zenú (CIUDAD / ZENU / CARGO)
UPDATE trabajadores
SET
  marca = 'Zenú',
  cargo = CASE
    WHEN unidad_organizacional ILIKE '%ADMINISTRATIVO%'          THEN 'Administrativo'
    WHEN unidad_organizacional ILIKE '%ASESORES COMERCIALES%'    THEN 'Asesor Comercial'
    WHEN unidad_organizacional ILIKE '%AUXILIARES LOGISTICOS%'   THEN 'Auxiliar Logístico'
    WHEN unidad_organizacional ILIKE '%AUXILIAR LOGISTICO%'      THEN 'Auxiliar Logístico'
    ELSE cargo
  END
WHERE unidad_organizacional ILIKE '% / ZENU / %'
   OR unidad_organizacional ILIKE '% / Zenu / %';

-- Paso 2: Registros con proveedor Fleischmann (CIUDAD / FLEISCHMANN / CARGO)
UPDATE trabajadores
SET
  marca = 'Fleischmann',
  cargo = CASE
    WHEN unidad_organizacional ILIKE '%ASESORES COMERCIALES%'    THEN 'Asesor Comercial'
    WHEN unidad_organizacional ILIKE '%asesores comerciales%'    THEN 'Asesor Comercial'
    WHEN unidad_organizacional ILIKE '%AUXILIARES LOGISTICOS%'   THEN 'Auxiliar Logístico'
    WHEN unidad_organizacional ILIKE '%auxiliares logisticos%'   THEN 'Auxiliar Logístico'
    ELSE cargo
  END
WHERE unidad_organizacional ILIKE '% / FLEISCHMANN / %'
   OR unidad_organizacional ILIKE '% / Fleischmann / %'
   OR unidad_organizacional ILIKE '% / fleischmann / %';

-- Paso 3: Todos los demás → marca = 'General', cargo corregido
UPDATE trabajadores
SET
  marca = 'General',
  cargo = CASE
    WHEN unidad_organizacional ILIKE '%ADMINISTRATIVO%'                THEN 'Administrativo'
    WHEN unidad_organizacional ILIKE '%ASESORES COMERCIALES%'          THEN 'Asesor Comercial'
    WHEN unidad_organizacional ILIKE '%AUXILIAR LOGISTICO%'            THEN 'Auxiliar Logístico'
    WHEN unidad_organizacional ILIKE '%AUXILIAR SEPARACION%'           THEN 'Auxiliar de Separación'
    WHEN unidad_organizacional ILIKE '%AUXILIARES DE BODEGA%'          THEN 'Auxiliar de Bodega'
    WHEN unidad_organizacional ILIKE '%AUXILIARES LOGISTICOS%'         THEN 'Auxiliar Logístico'
    ELSE cargo
  END
WHERE unidad_organizacional NOT ILIKE '% / ZENU / %'
  AND unidad_organizacional NOT ILIKE '% / Zenu / %'
  AND unidad_organizacional NOT ILIKE '% / FLEISCHMANN / %'
  AND unidad_organizacional NOT ILIKE '% / Fleischmann / %'
  AND unidad_organizacional NOT ILIKE '% / fleischmann / %';

-- Paso 4: Unificar cualquier variante residual del cargo en toda la tabla
UPDATE trabajadores
SET cargo = 'Auxiliar Logístico'
WHERE cargo IN (
  'Auxiliar Logístico/Entrega',
  'Auxiliar Logistico/Entrega',
  'Auxiliar Logistico',
  'AUXILIAR LOGISTICO',
  'AUXILIAR LOGISTICO/ENTREGA',
  'Auxiliar Logístico/entrega'
);

-- Verificar resultado final
SELECT marca, cargo, COUNT(*) as total
FROM trabajadores
GROUP BY marca, cargo
ORDER BY marca, cargo;


-- ============================================================
-- FIX: Ver y limpiar bloqueos falsos por device_id (hoy)
-- Usar cuando un trabajador dice "Este celular ya marcó Entrada"
-- pero nunca lo ha usado.
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Ver todos los registros de hoy con su device_id
--    (útil para identificar qué dispositivos están bloqueando a quién)
SELECT
  cedula,
  trabajador_nombre,
  tipo,
  hora,
  device_id
FROM asistencia
WHERE fecha = CURRENT_DATE
ORDER BY hora DESC;

-- 2. Ver si una cédula específica tiene registros hoy
--    (reemplaza '1089601941' con la cédula del afectado)
SELECT id, cedula, trabajador_nombre, tipo, hora, device_id
FROM asistencia
WHERE fecha = CURRENT_DATE
  AND cedula = '1089601941';

-- 3. Si hay un registro duplicado o incorrecto, elimínalo por su id:
--    DELETE FROM asistencia WHERE id = <id_del_registro>;

-- 4. Ver si hay device_ids que se repiten (posible colisión de fingerprint)
SELECT device_id, COUNT(*) as registros, array_agg(cedula) as cedulas
FROM asistencia
WHERE fecha = CURRENT_DATE
  AND device_id IS NOT NULL
GROUP BY device_id
HAVING COUNT(DISTINCT cedula) > 1
ORDER BY registros DESC;
