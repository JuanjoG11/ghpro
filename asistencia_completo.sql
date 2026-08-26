-- ============================================================
-- GH PRO — Setup completo de Asistencia
-- Ejecutar ESTE archivo en lugar de asistencia.sql + device_block.sql
-- Supabase Dashboard > SQL Editor > New query > Pegar y ejecutar
-- ============================================================

-- 1. Crear tabla
create table if not exists asistencia (
  id                uuid primary key default gen_random_uuid(),
  trabajador_id     uuid references trabajadores(id) on delete set null,
  trabajador_nombre text,
  cedula            text not null,
  cargo             text,
  ciudad            text,
  tipo              text default 'entrada' check (tipo in ('entrada','salida')),
  fecha             date not null,
  hora              time not null,
  metodo            text default 'cedula' check (metodo in ('cedula','qr')),
  device_id         text,
  obs               text,
  created_at        timestamptz default now()
);

-- 2. Agregar device_id si la tabla ya existe sin esa columna
alter table asistencia
  add column if not exists device_id text;

-- 3. Limpiar duplicados existentes antes de crear la constraint
--    Conserva solo el registro más antiguo (created_at más bajo) de cada grupo
--    Los demás (registros extra por doble tap, etc.) se eliminan
delete from asistencia
where id in (
  select id from (
    select
      id,
      row_number() over (
        partition by cedula, tipo, fecha
        order by created_at asc
      ) as rn
    from asistencia
  ) sub
  where rn > 1
);

-- 4. Constraint ÚNICA: evita duplicados de (cedula, tipo, fecha)
--    aunque dos personas presionen "Registrar" al mismo tiempo
alter table asistencia
  drop constraint if exists uq_asistencia_cedula_tipo_fecha;
alter table asistencia
  add constraint uq_asistencia_cedula_tipo_fecha
  unique (cedula, tipo, fecha);

-- 4. Índices para consultas frecuentes
create index if not exists idx_asistencia_fecha        on asistencia(fecha);
create index if not exists idx_asistencia_cedula       on asistencia(cedula);
create index if not exists idx_asistencia_trabajador   on asistencia(trabajador_id);
create index if not exists idx_asistencia_device_fecha on asistencia(device_id, fecha);

-- 5. RLS
alter table asistencia enable row level security;

-- Solo crear la policy si no existe
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'asistencia' and policyname = 'allow_all_asistencia'
  ) then
    execute 'create policy "allow_all_asistencia" on asistencia for all using (true) with check (true)';
  end if;
end $$;
