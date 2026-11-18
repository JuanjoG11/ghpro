-- ============================================================
-- FIX: Restaurar cargos_a_cargo de jefes_inmediatos
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

UPDATE jefes_inmediatos SET cargos_a_cargo = array['Supervisor Comercial','Supernumerario Comercial','Jefe Logístico']
WHERE nombre = 'ANA MARIA ACERO OCAMPO';

UPDATE jefes_inmediatos SET cargos_a_cargo = array['Supervisor Comercial','Supernumerario Comercial','Jefe Logístico']
WHERE nombre = 'ROBINSON HERMES CALDERON NIETO';

UPDATE jefes_inmediatos SET cargos_a_cargo = array['Asesor Comercial','Supernumerario Comercial','Auxiliar Logístico']
WHERE nombre = 'MARIA YESENIA CAÑAS GARCIA';

UPDATE jefes_inmediatos SET cargos_a_cargo = array['Auxiliar Logístico','Auxiliar de Bodega','Auxiliar de Separación','Auxiliar de Recibo','Auxiliar de Despacho']
WHERE nombre = 'JUAN SEBASTIAN ARIAS MARULANDA';

UPDATE jefes_inmediatos SET cargos_a_cargo = array['Auxiliar Logístico']
WHERE nombre = 'DANIEL FELIPE MURILLO GRANDA';

UPDATE jefes_inmediatos SET cargos_a_cargo = array['Asesor Comercial']
WHERE nombre = 'CRISTHIAN DAVID CASTAÑO CORREA';

UPDATE jefes_inmediatos SET cargos_a_cargo = array['Asesor Comercial','Supernumerario Comercial']
WHERE nombre = 'DIEGO ALEJANDRO GONZALEZ VALENCIA';

UPDATE jefes_inmediatos SET cargos_a_cargo = array['Asesor Comercial','Supernumerario Comercial']
WHERE nombre = 'BIBIANA ESMILDA MONTOYA TABARQUINO';

UPDATE jefes_inmediatos SET cargos_a_cargo = array['Asesor Comercial','Supernumerario Comercial']
WHERE nombre = 'JUAN JOSE GUZMAN HENAO';

UPDATE jefes_inmediatos SET cargos_a_cargo = array['TODOS']
WHERE nombre = 'ERIKA LORENA VALENCIA RESTREPO';

UPDATE jefes_inmediatos SET cargos_a_cargo = array['Auxiliar Contable','Analista de Cartera','Auxiliar de Caja']
WHERE nombre = 'JULIANA CLEMENCIA GUTIERREZ GRANADA';

UPDATE jefes_inmediatos SET cargos_a_cargo = array['Auxiliar Contable','Analista de Cartera','Auxiliar de Caja']
WHERE nombre = 'ALEXANDRA MILENA VANEGAS CALVO';

UPDATE jefes_inmediatos SET cargos_a_cargo = array['TODOS']
WHERE nombre = 'MARCO AURELIO PARRA AVILA';

-- Verificar resultado
SELECT nombre, cargo, empresa, cargos_a_cargo
FROM jefes_inmediatos
ORDER BY nombre;
