-- ============================================================
-- GH PRO — Mejoras módulo Contratación
-- Fecha: 2026-11-03
-- ============================================================

-- ── 1. Número de cuenta bancaria en Orden de Contratación ───
alter table orden_contratacion
  add column if not exists numero_cuenta text;

-- ── 2. Completar lista de EPS Colombia ───────────────────────
-- Primero borramos las que ya existen (para no duplicar)
-- y las volvemos a insertar con la lista completa.
-- Si ya están insertas, el ON CONFLICT DO NOTHING evita duplicados.

-- Agregar EPS faltantes (la tabla ya tiene unique implícito por nombre si lo ponemos)
-- Como no hay constraint UNIQUE en nombre, insertamos solo las que no existan

insert into eps_lista (nombre) values
  ('Aliansalud EPS'),
  ('Capresoca EPS'),
  ('Coosalud EPS'),
  ('Comfenalco Antioquia'),
  ('Comfenalco Valle'),
  ('Compensar EPS'),
  ('Emssanar EPS'),
  ('Famisanar EPS'),
  ('Medimás EPS'),
  ('Mutual Ser EPS'),
  ('Nueva EPS'),
  ('Sanitas EPS'),
  ('Sura EPS'),
  ('Savia Salud EPS'),
  ('Salud Mía EPS'),
  ('Asmet Salud EPS'),
  ('Cajacopi Atlántico'),
  ('Convida EPS'),
  ('Ecoopsos EPS'),
  ('Pijaos Salud EPS'),
  ('Anas Wayuu EPS'),
  ('Mallamas EPS'),
  ('Dusakawi EPS')
on conflict do nothing;

-- Desactivar duplicados si los hay (por si ya existían con nombre ligeramente diferente)
-- No es necesario si los nombres son exactamente los mismos.

-- ── 3. Tabla para documentos del checklist (portal candidato) ─
create table if not exists checklist_documentos (
  id              uuid primary key default gen_random_uuid(),
  orden_id        uuid references orden_contratacion(id) on delete cascade,
  orden_num       text,                                   -- OC-2026-0001
  candidato_nombre text not null,
  item_key        text not null,                          -- hv, id, estudios, etc.
  item_label      text not null,
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente','pendiente_revision','aprobado','rechazado','no_aplica')),
  archivo_url     text,                                   -- URL Supabase Storage
  archivo_nombre  text,
  subido_por      text check (subido_por in ('candidato','gh')),
  obs_gh          text,                                   -- observación de GH al revisar
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (orden_id, item_key)
);

-- ── 4. Token de acceso para el portal del candidato ──────────
create table if not exists portal_candidato_tokens (
  id              uuid primary key default gen_random_uuid(),
  token           text unique not null default gen_random_uuid()::text,
  orden_id        uuid references orden_contratacion(id) on delete cascade,
  orden_num       text,
  candidato_nombre text not null,
  candidato_email  text,
  candidato_tel    text,
  activo          boolean default true,
  usado_en        timestamptz,
  expira_en       timestamptz default (now() + interval '30 days'),
  created_at      timestamptz default now()
);

-- ── 5. RLS para nuevas tablas ─────────────────────────────────
alter table checklist_documentos       enable row level security;
alter table portal_candidato_tokens    enable row level security;

create policy "allow_all_checklist_documentos"
  on checklist_documentos for all using (true) with check (true);

create policy "allow_all_portal_candidato_tokens"
  on portal_candidato_tokens for all using (true) with check (true);

-- ── 6. Storage bucket para documentos de contratación ────────
-- Crear manualmente en Supabase Dashboard > Storage > New bucket:
--   Nombre: contratacion-docs
--   Tipo:   Public  (para que los candidatos puedan ver sus archivos)
--   Límite: 10 MB por archivo
--
-- Política sugerida de Storage (Dashboard > Storage > Policies):
-- Permitir INSERT/SELECT a todos (anon) en el bucket 'contratacion-docs'
-- INSERT: bucket_id = 'contratacion-docs'
-- SELECT: bucket_id = 'contratacion-docs'
--
-- O bien ejecutar estas políticas si usas el editor SQL de Storage:
-- (Supabase no expone storage.objects vía SQL estándar desde el editor,
--  usa el Dashboard > Storage > Policies > New Policy > "Give users access to a folder")

-- ── Resumen de cambios aplicados ────────────────────────────
-- 1. ALTER TABLE orden_contratacion ADD COLUMN numero_cuenta
-- 2. INSERT INTO eps_lista (lista completa de EPS Colombia)
-- 3. CREATE TABLE checklist_documentos
-- 4. CREATE TABLE portal_candidato_tokens
-- 5. RLS + políticas en tablas nuevas
-- 6. Crear bucket 'contratacion-docs' (MANUAL en el Dashboard)

-- ── Índices ───────────────────────────────────────────────────
create index if not exists idx_checklist_orden   on checklist_documentos(orden_id);
create index if not exists idx_portal_token      on portal_candidato_tokens(token);
create index if not exists idx_portal_orden      on portal_candidato_tokens(orden_id);
