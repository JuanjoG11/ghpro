-- ============================================================
-- GH PRO — Módulo de Entrevistas (simplificado)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Crear tabla si no existe
create table if not exists entrevistas (
  id                uuid primary key default gen_random_uuid(),
  requisicion_id    uuid references requisicion_personal(id) on delete cascade,
  requisicion_num   text,
  candidato_id      uuid references candidatos(id) on delete set null,
  candidato_nombre  text not null,
  entrevistador     text not null default 'GH',
  fecha             date not null default current_date,
  hora              time,
  lugar             text,
  modalidad         text default 'presencial',
  estado            text not null default 'pendiente'
                      check (estado in ('pendiente','asistio','no_paso','no_asistio','cancelada')),
  resultado         text check (resultado in ('apto','no_apto','en_evaluacion',null)),
  observaciones     text,
  created_by        text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Si la tabla ya existía con el check viejo, actualizar el constraint de estado
do $$
begin
  -- Eliminar constraint viejo si existe
  alter table entrevistas drop constraint if exists entrevistas_estado_check;
  -- Agregar el nuevo
  alter table entrevistas
    add constraint entrevistas_estado_check
    check (estado in ('pendiente','asistio','no_paso','no_asistio','cancelada'));
exception when others then
  null; -- Si falla silenciosamente, el check ya era correcto
end
$$;

-- RLS (idempotente)
alter table entrevistas enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'entrevistas' and policyname = 'allow_all_entrevistas'
  ) then
    execute 'create policy "allow_all_entrevistas" on entrevistas for all using (true) with check (true)';
  end if;
end
$$;

-- Índices
create index if not exists idx_ent_requisicion on entrevistas(requisicion_id);
create index if not exists idx_ent_candidato   on entrevistas(candidato_id);
create index if not exists idx_ent_estado      on entrevistas(estado);
create index if not exists idx_ent_fecha       on entrevistas(fecha);
