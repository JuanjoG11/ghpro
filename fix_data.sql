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
