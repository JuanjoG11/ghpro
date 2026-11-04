-- ════════════════════════════════════════════════════════════
-- MIGRACIÓN: Limpiar y dejar sedes correctas
-- Sedes: Armenia, Dosquebradas, Manizales
-- ════════════════════════════════════════════════════════════

-- 1. Borrar TODAS las sedes (más seguro que intentar deduplicar)
delete from sedes;

-- 2. Insertar las tres sedes correctas (una sola vez cada una)
insert into sedes (nombre, ciudad, activo) values
  ('Armenia',      'Armenia',      true),
  ('Dosquebradas', 'Dosquebradas', true),
  ('Manizales',    'Manizales',    true);

-- 3. Verificar resultado
select id, nombre, ciudad, activo from sedes order by nombre;
