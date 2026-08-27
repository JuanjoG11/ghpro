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
