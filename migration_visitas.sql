-- ============================================================
-- MIGRATION: Tabla de Visitas
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ── TABLA VISITAS ────────────────────────────────────────────
create table if not exists visitas (
  id                  uuid primary key default gen_random_uuid(),
  cedula              text not null,
  nombre_completo     text not null,
  empresa             text,
  visita_a_id         uuid references trabajadores(id) on delete set null,
  visita_a_nombre     text,
  eps                 text,
  arl                 text,
  telefono             text,
  contacto_nombre      text,
  contacto_emergencia  text,
  fecha               date not null default current_date,
  hora                text not null,
  estado              text default 'activo' check (estado in ('activo','salido')),
  hora_salida         text,
  created_at          timestamptz default now()
);

-- ── RLS: permitir acceso anon ───────────────────────────────
alter table visitas enable row level security;

drop policy if exists "allow_all_visitas" on visitas;
create policy "allow_all_visitas" on visitas for all using (true) with check (true);

-- ── Índices para búsquedas frecuentes ─────────────────────────
create index if not exists idx_visitas_fecha on visitas(fecha desc);
create index if not exists idx_visitas_cedula on visitas(cedula);
create index if not exists idx_visitas_estado on visitas(estado);
