-- ════════════════════════════════════════════════════════════
-- MIGRACIÓN: Portal candidato — firma digital y funeraria
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════

-- 1. Agregar campo funeraria_acepta a checklist_documentos
--    true  = quiere afiliación Los Olivos ($11.500/mes)
--    false = tiene certificado propio (deberá subirlo)
--    null  = aún no ha respondido
alter table checklist_documentos
  add column if not exists funeraria_acepta boolean default null;

-- 2. Agregar campos de firma digital a portal_candidato_tokens
alter table portal_candidato_tokens
  add column if not exists firma_url    text default null,
  add column if not exists firma_nombre text default null,
  add column if not exists firma_fecha  timestamptz default null;

-- 3. Verificar resultado
select column_name, data_type
from information_schema.columns
where table_name = 'checklist_documentos'
order by ordinal_position;

select column_name, data_type
from information_schema.columns
where table_name = 'portal_candidato_tokens'
order by ordinal_position;
