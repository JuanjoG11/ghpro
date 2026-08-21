-- ============================================================
-- GH PRO — Módulo Incapacidades
-- Ejecutar en Supabase SQL Editor
-- ============================================================

create table if not exists incapacidades (
  id                uuid primary key default gen_random_uuid(),
  trabajador_id     uuid references trabajadores(id) on delete cascade,
  trabajador_nombre text not null,
  fecha_inicio      date not null,
  fecha_fin         date,
  dias              integer generated always as (
                      case when fecha_fin is not null
                      then (fecha_fin - fecha_inicio + 1)
                      else null end
                    ) stored,
  diagnostico       text,
  codigo_dx         text,
  entidad           text,
  tipo              text default 'EG' check (tipo in ('EG','EP','AT','LM')),
  status            text default 'ingresada' check (status in (
                      'ingresada','cobrada','transcrita','pagada','en_tramite','radicada'
                    )),
  tiene_fisico      boolean default false,
  historia_clinica  boolean default false,
  radicado          text,
  valor             numeric(12,2),
  observaciones     text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Trigger: actualizar updated_at automáticamente
create or replace function fn_updated_at()
returns trigger language plpgsql as $$
begin NEW.updated_at = now(); return NEW; end; $$;

drop trigger if exists trg_incapacidades_updated on incapacidades;
create trigger trg_incapacidades_updated
  before update on incapacidades
  for each row execute function fn_updated_at();

-- RLS
alter table incapacidades enable row level security;
create policy "allow_all_incapacidades" on incapacidades
  for all using (true) with check (true);

-- Vista: resumen por trabajador
create or replace view v_incapacidades_resumen as
select
  trabajador_id,
  trabajador_nombre,
  count(*)                                        as total,
  sum(dias)                                       as total_dias,
  sum(case when status = 'pagada'     then 1 end) as pagadas,
  sum(case when status = 'en_tramite' then 1 end) as en_tramite,
  sum(case when status = 'radicada'   then 1 end) as radicadas,
  sum(case when tiene_fisico = false  then 1 end) as sin_fisico,
  sum(case when historia_clinica = false then 1 end) as sin_historia,
  max(fecha_inicio)                               as ultima_fecha
from incapacidades
group by trabajador_id, trabajador_nombre;
