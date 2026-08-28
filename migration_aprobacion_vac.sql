-- ============================================================
-- MIGRACIÓN: Campos del formulario oficial de aprobación
-- de vacaciones / ausencias.
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE vacaciones ADD COLUMN IF NOT EXISTS periodo_inicio          date;
ALTER TABLE vacaciones ADD COLUMN IF NOT EXISTS periodo_fin             date;
ALTER TABLE vacaciones ADD COLUMN IF NOT EXISTS dias_solicitados        integer;
ALTER TABLE vacaciones ADD COLUMN IF NOT EXISTS dias_dinero             integer DEFAULT 0;
ALTER TABLE vacaciones ADD COLUMN IF NOT EXISTS dias_habiles_aprobados  integer;
ALTER TABLE vacaciones ADD COLUMN IF NOT EXISTS fecha_inicio_definitiva date;
ALTER TABLE vacaciones ADD COLUMN IF NOT EXISTS fecha_reintegro         date;
ALTER TABLE vacaciones ADD COLUMN IF NOT EXISTS firma_colaborador       text;
ALTER TABLE vacaciones ADD COLUMN IF NOT EXISTS firma_jefe              text;
ALTER TABLE vacaciones ADD COLUMN IF NOT EXISTS fecha_solicitud         date;
ALTER TABLE vacaciones ADD COLUMN IF NOT EXISTS fecha_aprobacion        date;

-- Verificar que quedaron bien
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vacaciones'
ORDER BY ordinal_position;
