-- ════════════════════════════════════════════════════════════
-- MIGRACIÓN: Reemplazar ítems del checklist por la lista correcta
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- 1. Agregar columna sort_order si no existe (para controlar el orden de display)
ALTER TABLE checklist_documentos
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 99;

-- 2. Eliminar TODOS los ítems viejos que ya no aplican
--    (los que tienen claves del checklist anterior)
DELETE FROM checklist_documentos
WHERE item_key IN (
  'id', 'estudios', 'laborales', 'vr', 'examen',
  'afiliaciones', 'cert_bancaria', 'licencia', 'autorizacion'
);

-- 3. Para los ítems que ya existen con clave correcta, actualizar label y sort_order
UPDATE checklist_documentos SET item_label = 'Hoja de Vida',                                                                           sort_order = 1  WHERE item_key = 'hv';
UPDATE checklist_documentos SET item_label = 'Fotocopia de la Cédula',                                                                 sort_order = 2  WHERE item_key = 'cedula';
UPDATE checklist_documentos SET item_label = 'Afiliación Hijos',                                                                       sort_order = 3  WHERE item_key = 'afil_hijos';
UPDATE checklist_documentos SET item_label = 'Afiliación Padres',                                                                      sort_order = 4  WHERE item_key = 'afil_padres';
UPDATE checklist_documentos SET item_label = 'Fotocopia Acta de Grado y Diplomas',                                                     sort_order = 5  WHERE item_key = 'acta_grado';
UPDATE checklist_documentos SET item_label = 'Antecedentes Contraloría, Procuraduría y Policía',                                       sort_order = 6  WHERE item_key = 'antecedentes';
UPDATE checklist_documentos SET item_label = 'Certificado de E.P.S.',                                                                  sort_order = 7  WHERE item_key = 'eps';
UPDATE checklist_documentos SET item_label = 'Certificado de A.F.P.',                                                                  sort_order = 8  WHERE item_key = 'afp';
UPDATE checklist_documentos SET item_label = '2 - Referencias Laborales',                                                              sort_order = 9  WHERE item_key = 'ref_laborales';
UPDATE checklist_documentos SET item_label = '2 - Referencias Personales',                                                             sort_order = 10 WHERE item_key = 'ref_personales';
UPDATE checklist_documentos SET item_label = 'Foto fondo blanco',                                                                      sort_order = 11 WHERE item_key = 'foto';
UPDATE checklist_documentos SET item_label = 'Carnet COVID - 19',                                                                      sort_order = 12 WHERE item_key = 'carnet_covid';
UPDATE checklist_documentos SET item_label = 'Carnet de Manipulación de Alimentos (vigencia mayor a 6 meses)',                         sort_order = 13 WHERE item_key = 'carnet_alimentos';
UPDATE checklist_documentos SET item_label = 'Constancia de Apertura de Cuenta',                                                       sort_order = 14 WHERE item_key = 'cuenta_bancaria';
UPDATE checklist_documentos SET item_label = 'Copia Soat, Tecnomecánica, Licencia de Conducción y Tarjeta de Propiedad',               sort_order = 15 WHERE item_key = 'soat';
UPDATE checklist_documentos SET item_label = 'Certificado Funerario',                                                                  sort_order = 16 WHERE item_key = 'funeraria';

-- 4. Insertar los ítems que faltan en órdenes existentes
--    (solo los que no existen aún para esa orden)

-- hv
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'hv', 'Hoja de Vida', 'pendiente', 1
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'hv');

-- cedula
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'cedula', 'Fotocopia de la Cédula', 'pendiente', 2
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'cedula');

-- afil_hijos
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'afil_hijos', 'Afiliación Hijos', 'pendiente', 3
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'afil_hijos');

-- afil_padres
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'afil_padres', 'Afiliación Padres', 'pendiente', 4
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'afil_padres');

-- acta_grado
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'acta_grado', 'Fotocopia Acta de Grado y Diplomas', 'pendiente', 5
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'acta_grado');

-- antecedentes
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'antecedentes', 'Antecedentes Contraloría, Procuraduría y Policía', 'pendiente', 6
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'antecedentes');

-- eps
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'eps', 'Certificado de E.P.S.', 'pendiente', 7
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'eps');

-- afp
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'afp', 'Certificado de A.F.P.', 'pendiente', 8
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'afp');

-- ref_laborales
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'ref_laborales', '2 - Referencias Laborales', 'pendiente', 9
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'ref_laborales');

-- ref_personales
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'ref_personales', '2 - Referencias Personales', 'pendiente', 10
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'ref_personales');

-- foto
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'foto', 'Foto fondo blanco', 'pendiente', 11
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'foto');

-- carnet_covid
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'carnet_covid', 'Carnet COVID - 19', 'pendiente', 12
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'carnet_covid');

-- carnet_alimentos
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'carnet_alimentos', 'Carnet de Manipulación de Alimentos (vigencia mayor a 6 meses)', 'pendiente', 13
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'carnet_alimentos');

-- cuenta_bancaria
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'cuenta_bancaria', 'Constancia de Apertura de Cuenta', 'pendiente', 14
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'cuenta_bancaria');

-- soat
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'soat', 'Copia Soat, Tecnomecánica, Licencia de Conducción y Tarjeta de Propiedad', 'pendiente', 15
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'soat');

-- funeraria
INSERT INTO checklist_documentos (orden_id, orden_num, candidato_nombre, item_key, item_label, estado, sort_order)
SELECT DISTINCT ON (cd.orden_id) cd.orden_id, cd.orden_num, cd.candidato_nombre, 'funeraria', 'Certificado Funerario', 'pendiente', 16
FROM checklist_documentos cd
WHERE NOT EXISTS (SELECT 1 FROM checklist_documentos x WHERE x.orden_id = cd.orden_id AND x.item_key = 'funeraria');

-- 5. Verificar resultado
SELECT item_key, item_label, sort_order, estado, count(*) as ordenes
FROM checklist_documentos
GROUP BY item_key, item_label, sort_order, estado
ORDER BY sort_order, item_key;
