-- ============================================================
-- GH PRO — Schema Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Extensiones
create extension if not exists "pgcrypto";

-- ── TRABAJADORES ─────────────────────────────────────────────
create table if not exists trabajadores (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  cedula                text,
  tipo_id               text default 'CC',
  cargo                 text,
  marca                 text,
  ciudad                text,
  unidad_organizacional text,
  jefe                  text,
  fecha_ingreso         date,
  telefono              text,
  estado                text default 'activo' check (estado in ('activo','inactivo','licencia')),
  obs                   text,
  created_at            timestamptz default now()
);

-- ── DOTACION ─────────────────────────────────────────────────
create table if not exists dotacion (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  categoria  text default 'otro' check (categoria in ('ropa','calzado','epp','accesorio','otro')),
  stock      integer not null default 0,
  stock_min  integer not null default 0,
  unidad     text default 'und',
  emoji      text,
  descripcion text,
  created_at timestamptz default now()
);

-- ── ENTREGAS ─────────────────────────────────────────────────
create table if not exists entregas (
  id                uuid primary key default gen_random_uuid(),
  trabajador_id     uuid references trabajadores(id) on delete set null,
  trabajador_nombre text,
  articulo_id       uuid references dotacion(id) on delete set null,
  articulo_nombre   text,
  cantidad          integer not null check (cantidad > 0),
  fecha             date not null,
  talla             text,
  entregado_por     text,
  obs               text,
  created_at        timestamptz default now()
);

-- Trigger: descontar stock automáticamente al registrar entrega
create or replace function fn_descontar_stock()
returns trigger language plpgsql as $$
begin
  update dotacion
  set stock = stock - NEW.cantidad
  where id = NEW.articulo_id;
  return NEW;
end;
$$;

drop trigger if exists trg_descontar_stock on entregas;
create trigger trg_descontar_stock
  after insert on entregas
  for each row execute function fn_descontar_stock();

-- Trigger: restaurar stock al eliminar entrega
create or replace function fn_restaurar_stock()
returns trigger language plpgsql as $$
begin
  update dotacion
  set stock = stock + OLD.cantidad
  where id = OLD.articulo_id;
  return OLD;
end;
$$;

drop trigger if exists trg_restaurar_stock on entregas;
create trigger trg_restaurar_stock
  after delete on entregas
  for each row execute function fn_restaurar_stock();

-- ── BPM ──────────────────────────────────────────────────────
create table if not exists bpm (
  id                uuid primary key default gen_random_uuid(),
  trabajador_id     uuid references trabajadores(id) on delete cascade,
  trabajador_nombre text,
  numero            text,
  emision           date,
  vencimiento       date not null,
  entidad           text,
  capacitacion      text,
  obs               text,
  created_at        timestamptz default now()
);

-- ── VEHICULOS ────────────────────────────────────────────────
create table if not exists vehiculos (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null check (tipo in ('soat','tecno','propiedad','licencia')),
  conductor_id     uuid references trabajadores(id) on delete set null,
  conductor_nombre text,
  placa            text,
  vencimiento      date,
  poliza           text,
  aseguradora      text,
  marca_carro      text,
  modelo           text,
  anio             text,
  num_licencia     text,
  categoria        text,
  obs              text,
  created_at       timestamptz default now()
);

-- ── VISTA: ALERTAS ───────────────────────────────────────────
create or replace view v_alertas as
  select
    'BPM'::text as tipo,
    trabajador_nombre as persona,
    concat('Carnet ', coalesce(numero,'BPM')) as descripcion,
    vencimiento,
    (vencimiento - current_date)::int as dias_restantes
  from bpm
  where vencimiento is not null
  union all
  select
    tipo,
    case when tipo = 'licencia' then conductor_nombre
         else concat(coalesce(placa,''), ' - ', coalesce(conductor_nombre,'')) end,
    'Doc. vehicular',
    vencimiento,
    (vencimiento - current_date)::int
  from vehiculos
  where tipo != 'propiedad' and vencimiento is not null
  order by dias_restantes asc;

-- ── RLS: permitir acceso anon (ajustar en producción) ────────
alter table trabajadores enable row level security;
alter table dotacion      enable row level security;
alter table entregas      enable row level security;
alter table bpm           enable row level security;
alter table vehiculos     enable row level security;

create policy "allow_all_trabajadores" on trabajadores for all using (true) with check (true);
create policy "allow_all_dotacion"     on dotacion     for all using (true) with check (true);
create policy "allow_all_entregas"     on entregas     for all using (true) with check (true);
create policy "allow_all_bpm"          on bpm          for all using (true) with check (true);
create policy "allow_all_vehiculos"    on vehiculos    for all using (true) with check (true);
