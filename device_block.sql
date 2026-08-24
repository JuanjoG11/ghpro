-- ============================================================
-- GH PRO — Bloqueo de dispositivos por día
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Tabla que registra qué dispositivos ya marcaron asistencia hoy
create table if not exists device_registros (
  id         uuid primary key default gen_random_uuid(),
  device_id  text not null,
  fecha      date not null default current_date,
  cedula     text,          -- cédula que registró (referencia informativa)
  created_at timestamptz default now(),

  -- Un dispositivo solo puede tener un registro por día
  unique (device_id, fecha)
);

-- Índice para que la consulta de verificación sea rápida
create index if not exists idx_device_registros_device_fecha
  on device_registros (device_id, fecha);

-- RLS
alter table device_registros enable row level security;

create policy "allow_all_device_registros"
  on device_registros for all
  using (true) with check (true);
