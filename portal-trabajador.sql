-- ============================================================
-- GH PRO — Campos adicionales para portal de trabajadores
-- Ejecutar en Supabase SQL Editor
-- ============================================================
-- Agrega campos opcionales a la tabla vacaciones para soportar
-- permisos con hora, remuneración y motivo.
-- Los campos son nullable para no afectar registros existentes.
-- ============================================================

alter table vacaciones
  add column if not exists hora_inicio   time,
  add column if not exists hora_fin      time,
  add column if not exists motivo        text,
  add column if not exists es_remunerado boolean default null,
  add column if not exists solicitado_en timestamptz default null;

-- Comentarios descriptivos
comment on column vacaciones.hora_inicio    is 'Hora de inicio del permiso (solo aplica cuando tipo = permiso)';
comment on column vacaciones.hora_fin       is 'Hora de fin del permiso (solo aplica cuando tipo = permiso)';
comment on column vacaciones.motivo         is 'Motivo de la solicitud (obligatorio en permisos)';
comment on column vacaciones.es_remunerado  is 'Indica si el permiso es remunerado (true) o no remunerado (false). Null = no aplica';
comment on column vacaciones.solicitado_en  is 'Fecha/hora en que el trabajador envió la solicitud desde el portal';

-- ============================================================
-- UNIFICAR ESTADOS DE SOLICITUDES: en_proceso, aprobada, rechazada
-- ============================================================
-- 1. Eliminar constraint antiguo si existe
alter table vacaciones drop constraint if exists vacaciones_status_check;

-- 2. Migrar registros existentes a los 3 estados oficiales
update vacaciones set status = 'en_proceso' where status in ('solicitada', 'en_curso') or status is null;
update vacaciones set status = 'rechazada'  where status = 'no_aprobada';
update vacaciones set status = 'aprobada'   where status = 'finalizada';

-- 3. Crear constraint estricto con los 3 estados
alter table vacaciones add constraint vacaciones_status_check
  check (status in ('en_proceso', 'aprobada', 'rechazada'));

-- 4. Valor por defecto 'en_proceso'
alter table vacaciones alter column status set default 'en_proceso';

