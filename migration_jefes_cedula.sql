-- ============================================================
-- GH PRO — Agregar cédula a jefes_inmediatos
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Agregar columna cédula (única, no nula tras actualizar)
alter table jefes_inmediatos
  add column if not exists cedula text;

-- 2. Crear índice único en cédula (solo sobre valores no nulos)
create unique index if not exists idx_jefes_cedula
  on jefes_inmediatos (cedula)
  where cedula is not null;

-- 3. Actualizar los registros existentes con las cédulas reales
--    ⚠️ Reemplazar los valores 00000000X por las cédulas reales de cada jefe
--    Identificamos por nombre ya que no tenemos el ID en este script.

update jefes_inmediatos set cedula = '00000001' where nombre = 'ANA MARIA ACERO OCAMPO';
update jefes_inmediatos set cedula = '00000002' where nombre = 'ROBINSON HERMES CALDERON NIETO';
update jefes_inmediatos set cedula = '00000003' where nombre = 'MARIA YESENIA CAÑAS GARCIA';
update jefes_inmediatos set cedula = '00000004' where nombre = 'JUAN SEBASTIAN ARIAS MARULANDA';
update jefes_inmediatos set cedula = '00000005' where nombre = 'DANIEL FELIPE MURILLO GRANDA';
update jefes_inmediatos set cedula = '00000006' where nombre = 'CRISTHIAN DAVID CASTAÑO CORREA';
update jefes_inmediatos set cedula = '00000007' where nombre = 'DIEGO ALEJANDRO GONZALEZ VALENCIA';
update jefes_inmediatos set cedula = '00000008' where nombre = 'BIBIANA ESMILDA MONTOYA TABARQUINO';
update jefes_inmediatos set cedula = '00000009' where nombre = 'JUAN JOSE GUZMAN HENAO';
update jefes_inmediatos set cedula = '00000010' where nombre = 'ERIKA LORENA VALENCIA RESTREPO';
update jefes_inmediatos set cedula = '00000011' where nombre = 'JULIANA CLEMENCIA GUTIERREZ GRANADA';
update jefes_inmediatos set cedula = '00000012' where nombre = 'ALEXANDRA MILENA VANEGAS CALVO';
update jefes_inmediatos set cedula = '00000013' where nombre = 'MARCO AURELIO PARRA AVILA';

-- 4. Verificar resultado
select nombre, cedula, pin from jefes_inmediatos order by nombre;
