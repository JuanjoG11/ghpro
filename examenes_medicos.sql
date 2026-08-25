-- ============================================================
-- GH PRO — Módulo Exámenes Médicos Ocupacionales
-- Ejecutar en Supabase SQL Editor
-- ============================================================

create table if not exists examenes_medicos (
  id                    uuid primary key default gen_random_uuid(),
  trabajador_id         uuid references trabajadores(id) on delete cascade,
  trabajador_nombre     text not null,
  tipo_examen           text not null default 'periodico' check (tipo_examen in (
                          'ingreso', 'periodico', 'egreso', 'post_incapacidad', 'reubicacion', 'otro'
                        )),
  fecha_examen          date not null,
  fecha_vencimiento     date,
  entidad               text, -- IPS o Centro Médico (ej: Sura, Colmédica, etc.)
  concepto              text not null default 'apto' check (concepto in (
                          'apto', 'apto_con_restricciones', 'no_apto', 'aplazado'
                        )),
  enfasis               text, -- Ej: General, Osteomuscular, Visiometría, Audiometría, Alturas, Manipulación de alimentos
  restricciones         text, -- Recomendaciones o restricciones laborales
  tiene_concepto_fisico boolean default false,
  costo                 numeric(12,2),
  observaciones         text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Trigger: actualizar updated_at automáticamente
create or replace function fn_examenes_medicos_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end; $$;

drop trigger if exists trg_examenes_medicos_updated on examenes_medicos;
create trigger trg_examenes_medicos_updated
  before update on examenes_medicos
  for each row execute function fn_examenes_medicos_updated_at();

-- Índices para búsquedas rápidas y alertas
create index if not exists idx_examenes_trabajador on examenes_medicos(trabajador_id);
create index if not exists idx_examenes_fecha on examenes_medicos(fecha_examen);
create index if not exists idx_examenes_vencimiento on examenes_medicos(fecha_vencimiento);
create index if not exists idx_examenes_concepto on examenes_medicos(concepto);

-- RLS
alter table examenes_medicos enable row level security;
create policy "allow_all_examenes_medicos" on examenes_medicos
  for all using (true) with check (true);

-- Vista resumen por trabajador
create or replace view v_examenes_medicos_resumen as
select
  trabajador_id,
  trabajador_nombre,
  count(*) as total_examenes,
  sum(case when concepto = 'apto' then 1 else 0 end) as total_aptos,
  sum(case when concepto = 'apto_con_restricciones' then 1 else 0 end) as con_restricciones,
  sum(case when concepto = 'no_apto' then 1 else 0 end) as no_aptos,
  sum(case when tiene_concepto_fisico = false then 1 else 0 end) as sin_fisico,
  max(fecha_examen) as ultimo_examen,
  max(fecha_vencimiento) as proximo_vencimiento
from examenes_medicos
group by trabajador_id, trabajador_nombre;
