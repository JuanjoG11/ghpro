-- ============================================================
-- GH PRO — Módulo de Dotación: Camisas, Pantalones,
--          Chaquetas y Calzado
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ── TABLA ÚNICA DE PRENDAS ───────────────────────────────────
-- tipo     : 'camisa' | 'pantalon' | 'chaqueta' | 'calzado' | 'epp'
-- genero   : 'hombre' | 'mujer' | 'bodega' | 'cuarto_frio'
--            (bodega y cuarto_frio solo aplican para tipo 'epp')
-- talla    : texto libre
--   · camisa / chaqueta : S  M  L  XL  XXL          (ambos)
--   · pantalon hombre   : 28 30 32 34 36 38
--   · pantalon mujer    : 6  8  10 12 14 16 18
--   · calzado hombre    : 35 36 37 38 39 40 41 42 43 44 45
--   · calzado mujer     : 34 35 36 37 38 39 40 41 42 43 44 45
--   · epp               : M  L  (bodega y cuarto_frio)

create table if not exists dotacion_prendas (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('camisa','pantalon','chaqueta','calzado')),
  referencia  text not null,
  genero      text not null check (genero in ('hombre','mujer')),
  talla       text not null,
  stock       integer not null default 0 check (stock >= 0),
  stock_min   integer not null default 2,
  obs         text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (tipo, referencia, genero, talla)
);

-- ── TRIGGER: updated_at automático ───────────────────────────
create or replace function fn_prendas_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists trg_prendas_updated_at on dotacion_prendas;
create trigger trg_prendas_updated_at
  before update on dotacion_prendas
  for each row execute function fn_prendas_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
alter table dotacion_prendas enable row level security;

drop policy if exists "allow_all_dotacion_prendas" on dotacion_prendas;
create policy "allow_all_dotacion_prendas"
  on dotacion_prendas for all using (true) with check (true);

-- =============================================================
-- SEED — se ejecuta de forma idempotente (on conflict do nothing)
-- =============================================================

-- ── CAMISAS: hombre y mujer · tallas S M L XL XXL ────────────
insert into dotacion_prendas (tipo, referencia, genero, talla, stock_min)
select 'camisa', r.ref, g.genero, t.talla, 2
from
  (values
    ('Oxford ROSADA (Alpina + Tiendas y Marcas)'),
    ('Oxford AZUL (Flesichmann + Tiendas y Marcas)'),
    ('Oxford GRIS (ZENÚ + Tiendas y Marcas)'),
    ('Polo GRIS (Tiendas y Marcas)')
  ) as r(ref),
  (values ('hombre'), ('mujer')) as g(genero),
  (values ('S'), ('M'), ('L'), ('XL'), ('XXL')) as t(talla)
on conflict (tipo, referencia, genero, talla) do nothing;

-- ── PANTALONES HOMBRE: tallas numéricas 28–38 ────────────────
insert into dotacion_prendas (tipo, referencia, genero, talla, stock_min)
select 'pantalon', r.ref, 'hombre', t.talla, 2
from
  (values
    ('Jean Indigo Azul'),
    ('Pantalon Térmico'),
    ('Jean Elástico')
  ) as r(ref),
  (values ('28'), ('30'), ('32'), ('34'), ('36'), ('38')) as t(talla)
on conflict (tipo, referencia, genero, talla) do nothing;

-- ── PANTALONES MUJER: tallas numéricas 6–18 ──────────────────
insert into dotacion_prendas (tipo, referencia, genero, talla, stock_min)
select 'pantalon', r.ref, 'mujer', t.talla, 2
from
  (values
    ('Jean Indigo Azul'),
    ('Pantalon Térmico'),
    ('Jean Elástico')
  ) as r(ref),
  (values ('6'), ('8'), ('10'), ('12'), ('14'), ('16'), ('18')) as t(talla)
on conflict (tipo, referencia, genero, talla) do nothing;

-- ── CHAQUETA: hombre y mujer · tallas S M L XL XXL ───────────
insert into dotacion_prendas (tipo, referencia, genero, talla, stock_min)
select 'chaqueta', 'Chaqueta Cuarto Frío', g.genero, t.talla, 2
from
  (values ('hombre'), ('mujer')) as g(genero),
  (values ('S'), ('M'), ('L'), ('XL'), ('XXL')) as t(talla)
on conflict (tipo, referencia, genero, talla) do nothing;

-- ── CALZADO: hombre y mujer · tallas 35–45 ───────────────────
insert into dotacion_prendas (tipo, referencia, genero, talla, stock_min)
select 'calzado', 'Bota de Seguridad con Puntera', g.genero, t.talla, 2
from
  (values ('hombre'), ('mujer')) as g(genero),
  (values ('35'), ('36'), ('37'), ('38'), ('39'), ('40'),
          ('41'), ('42'), ('43'), ('44'), ('45')) as t(talla)
on conflict (tipo, referencia, genero, talla) do nothing;

-- ── NOTA: agregar nuevas referencias en el futuro ────────────
-- Simplemente agrega un nuevo bloque INSERT con el tipo y
-- referencia correspondientes. El constraint UNIQUE evita
-- duplicados si el script se ejecuta más de una vez.
