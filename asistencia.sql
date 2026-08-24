-- ============================================================
-- GH PRO — Tabla Asistencia
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

create table if not exists asistencia (
  id                uuid primary key default gen_random_uuid(),
  trabajador_id     uuid references trabajadores(id) on delete set null,
  trabajador_nombre text,
  cedula            text,
  cargo             text,
  ciudad            text,
  tipo              text default 'entrada' check (tipo in ('entrada','salida')),
  fecha             date not null,
  hora              time not null,
  metodo            text default 'cedula' check (metodo in ('cedula','qr')),
  obs               text,
  created_at        timestamptz default now()
);

-- Índices para consultas frecuentes
create index if not exists idx_asistencia_fecha        on asistencia(fecha);
create index if not exists idx_asistencia_cedula       on asistencia(cedula);
create index if not exists idx_asistencia_trabajador   on asistencia(trabajador_id);

-- RLS
alter table asistencia enable row level security;
create policy "allow_all_asistencia" on asistencia for all using (true) with check (true);
