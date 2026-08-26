-- ============================================================
-- INSERT: Trabajadores empresa TAT
-- Generado: 2026-08-26
-- Lógica:
--   marca  → 'FAMILIA' si la unidad contiene '/ FAMILIA /'
--            'General' en caso contrario
--   cargo  → derivado del segmento final de unidad_organizacional
--   obs    → número de contrato
-- ============================================================

INSERT INTO trabajadores
  (nombre, cedula, tipo_id, cargo, marca, unidad_organizacional, fecha_ingreso, estado, obs)
VALUES

-- / ADMINISTRATIVO → General / Administrativo
('ALEXANDRA MILENA VANEGAS CALVO',  '1088262963', 'CC', 'Administrativo',    'General', '/ ADMINISTRATIVO',                    '2022-05-18', 'activo', 'a012000068'),
('MARCO AURELIO PARRA AVILA',       '16774226',   'CC', 'Administrativo',    'General', '/ ADMINISTRATIVO',                    '2022-03-16', 'activo', 'a012000007'),
('SEBASTIAN QUEVEDO SUAREZ',        '1089100450', 'TI', 'Administrativo',    'General', '/ ADMINISTRATIVO',                    '2025-10-22', 'activo', 'a012000332'),
('TATIANA GARCIA CARDONA',          '1140064939', 'TI', 'Administrativo',    'General', '/ ADMINISTRATIVO',                    '2026-07-03', 'activo', 'a012000357'),
('NICOL DAYANA PARRA CALDERON',     '1076652811', 'CC', 'Administrativo',    'General', '/ ADMINISTRATIVO',                    '2026-08-05', 'activo', 'a012000358'),

-- / LOGISTICA → General / Logística
('JULIAN DAVID RODRIGUEZ MONTOYA',  '1088305468', 'CC', 'Logística',         'General', '/ LOGISTICA',                         '2023-07-04', 'activo', 'a012000147'),
('YERFREY FLORES ARROYAVE',         '1094956074', 'CC', 'Logística',         'General', '/ LOGISTICA',                         '2022-04-21', 'activo', 'a012000053'),
('JOHN RAUL GRAJALES CANO',         '10030398',   'CC', 'Logística',         'General', '/ LOGISTICA',                         '2025-03-10', 'activo', 'a012000274'),

-- LOGISTICA (sin /) → General / Logística
('NELLY YURANNY SALDARRIAGA CAÑAS', '1060586518', 'CC', 'Logística',         'General', 'LOGISTICA',                           '2022-04-27', 'activo', 'a012000056'),

-- / COMERCIALES → General / Asesor Comercial
('CARLOS ADRIAN CALLE RENDON',      '9958008',    'CC', 'Asesor Comercial',  'General', '/ COMERCIALES',                       '2023-11-17', 'activo', 'a012000173'),
('ANDRES FERNANDO SANCHEZ VILLEGAS','1053766771', 'CC', 'Asesor Comercial',  'General', '/ COMERCIALES',                       '2026-05-04', 'activo', 'a012000353'),

-- COMERCIALES (sin /) → General / Asesor Comercial
('NANCY EUGENIA CASTRO ARBELAEZ',   '30321892',   'CC', 'Asesor Comercial',  'General', 'COMERCIALES',                         '2024-05-17', 'activo', 'a012000216'),

-- / FAMILIA / AUXILIARES LOGISTICOS → FAMILIA / Auxiliar Logístico
('LUIS ALFONSO RIOS GONZALEZ',      '75071571',   'CC', 'Auxiliar Logístico','FAMILIA', '/ FAMILIA / AUXILIARES LOGISTICOS',   '2024-11-09', 'activo', 'a012000254'),
('JUDY FRANCY BUITRAGO',            '42161511',   'CC', 'Auxiliar Logístico','FAMILIA', '/ FAMILIA / AUXILIARES LOGISTICOS',   '2026-04-07', 'activo', 'a012000348'),

-- / FAMILIA / ASESORE COMERCIALES → FAMILIA / Asesor Comercial
('MARIA CARMENZA GUAPACHA CASTAÑEDA','30415268',  'CC', 'Asesor Comercial',  'FAMILIA', '/ FAMILIA / ASESORE COMERCIALES',     '2025-10-14', 'activo', 'a012000330'),
('PAULA ANDREA RAMOS BORJA',        '1047467581', 'CC', 'Asesor Comercial',  'FAMILIA', '/ FAMILIA / ASESORE COMERCIALES',     '2025-05-27', 'activo', 'a012000293'),
('YEIMY LUCIA HOLGUIN OSORIO',      '25181643',   'CC', 'Asesor Comercial',  'FAMILIA', '/ FAMILIA / ASESORE COMERCIALES',     '2025-06-03', 'activo', 'a012000296'),
('MARIA DEL PILAR ARANGO BLANDON',  '42149772',   'CC', 'Asesor Comercial',  'FAMILIA', '/ FAMILIA / ASESORE COMERCIALES',     '2025-06-03', 'activo', 'a012000295');

-- Verificar los insertados
SELECT nombre, cedula, tipo_id, cargo, marca, unidad_organizacional, fecha_ingreso, obs
FROM trabajadores
WHERE obs IN (
  'a012000068','a012000007','a012000254','a012000147','a012000173',
  'a012000053','a012000056','a012000216','a012000274','a012000330',
  'a012000332','a012000348','a012000353','a012000357','a012000358',
  'a012000293','a012000296','a012000295'
)
ORDER BY marca, cargo, nombre;
