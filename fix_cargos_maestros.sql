-- ============================================================
-- FIX: Reemplazar cargos_maestros con los cargos reales TYM/TAT
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Borrar los cargos genéricos de plantilla
DELETE FROM cargos_maestros;

-- 2. Insertar solo los cargos reales de TYM / TAT
INSERT INTO cargos_maestros (nombre, area, activo) VALUES
  ('Supervisor Comercial',       'Comercial',       true),
  ('Supernumerario Comercial',   'Comercial',       true),
  ('Asesor Comercial',           'Comercial',       true),
  ('Jefe Logístico',             'Logística',       true),
  ('Auxiliar Logístico',         'Logística',       true),
  ('Auxiliar de Bodega',         'Logística',       true),
  ('Auxiliar de Separación',     'Logística',       true),
  ('Auxiliar de Recibo',         'Logística',       true),
  ('Auxiliar de Despacho',       'Logística',       true),
  ('Auxiliar Contable',          'Administrativa',  true),
  ('Analista de Cartera',        'Administrativa',  true),
  ('Auxiliar de Caja',           'Administrativa',  true)
ON CONFLICT DO NOTHING;

-- 3. Verificar
SELECT nombre, area FROM cargos_maestros ORDER BY area, nombre;
