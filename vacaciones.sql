-- ============================================================
-- GH PRO — Módulo Vacaciones / Ausencias
-- Ejecutar en Supabase SQL Editor
-- ============================================================

create table if not exists vacaciones (
  id                uuid primary key default gen_random_uuid(),
  trabajador_id     uuid references trabajadores(id) on delete cascade,
  trabajador_nombre text not null,
  fecha_inicio      date not null,
  fecha_fin         date not null,
  dias              integer generated always as (
                      (fecha_fin - fecha_inicio + 1)
                    ) stored,
  tipo              text default 'vacaciones' check (tipo in (
                      'vacaciones','licencia_remunerada','licencia_no_remunerada',
                      'permiso','calamidad','otro'
                    )),
  status            text default 'solicitada' check (status in (
                      'solicitada','aprobada','rechazada','en_curso','finalizada'
                    )),
  aprobado_por      text,
  observaciones     text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Trigger: actualizar updated_at automáticamente
create or replace function fn_vacaciones_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end; $$;

drop trigger if exists trg_vacaciones_updated on vacaciones;
create trigger trg_vacaciones_updated
  before update on vacaciones
  for each row execute function fn_vacaciones_updated_at();

-- RLS
alter table vacaciones enable row level security;
create policy "allow_all_vacaciones" on vacaciones
  for all using (true) with check (true);

-- Vista: resumen de vacaciones por trabajador
-- Calcula días tomados vs días disponibles según la ley colombiana
-- (15 días hábiles por año = ~18 días calendario aprox.)
create or replace view v_vacaciones_resumen as
select
  v.trabajador_id,
  v.trabajador_nombre,
  count(*)                                                      as total_solicitudes,
  sum(v.dias)                                                   as total_dias_tomados,
  sum(case when v.tipo = 'vacaciones' then v.dias else 0 end)  as dias_vacaciones,
  sum(case when v.status = 'aprobada'  then v.dias else 0 end) as dias_aprobados,
  sum(case when v.status in ('solicitada','en_curso') then 1 else 0 end) as pendientes,
  max(v.fecha_fin)                                              as ultima_vacacion,
  -- Días disponibles estimados según fecha de ingreso del trabajador
  -- Se calcula en la app porque requiere join con trabajadores.fecha_ingreso
  null::integer                                                 as dias_disponibles
from vacaciones v
group by v.trabajador_id, v.trabajador_nombre;
