-- ============================================================
-- GH PRO — Migración: Tabla de jefes inmediatos para portal requisición
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Tabla de jefes inmediatos con sus cargos a cargo y acceso
create table if not exists jefes_inmediatos (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  cargo            text not null,
  empresa          text not null check (empresa in ('TYM','TAT')),
  proveedores      text,                        -- lista separada por coma
  sedes            text,                        -- lista separada por coma
  cargos_a_cargo   text[],                      -- array de cargos que supervisa
  num_cargos       integer default 0,
  pin              text not null default '1234',-- PIN simple de 4-6 dígitos
  activo           boolean default true,
  created_at       timestamptz default now()
);

-- Insertar los jefes del documento
insert into jefes_inmediatos (nombre, cargo, empresa, proveedores, sedes, cargos_a_cargo, num_cargos, pin) values
  ('ANA MARIA ACERO OCAMPO',       'Coordinador Comercial',  'TYM',
   'ZENÚ',                          'PEREIRA',
   array['Supervisor Comercial','Supernumerario Comercial','Jefe Logístico'], 3, '1001'),

  ('ROBINSON HERMES CALDERON NIETO','Coordinador Comercial',  'TYM',
   'ALPINA',                        'PEREIRA, ARMENIA, MANIZALES',
   array['Supervisor Comercial','Supernumerario Comercial','Jefe Logístico'], 3, '1002'),

  ('MARIA YESENIA CAÑAS GARCIA',   'Coordinador Comercial',  'TYM',
   'FLEISCHMANN, FAMILIA',          'MANIZALES, PEREIRA, ARMENIA',
   array['Asesor Comercial','Supernumerario Comercial','Auxiliar Logístico'], 3, '1003'),

  ('JUAN SEBASTIAN ARIAS MARULANDA','Jefe Logístico',         'TYM',
   'ALPINA, FLEISCHMANN',           'PEREIRA',
   array['Auxiliar Logístico','Auxiliar de Bodega','Auxiliar de Separación','Auxiliar de Recibo','Auxiliar de Despacho'], 5, '1004'),

  ('DANIEL FELIPE MURILLO GRANDA', 'Jefe Logístico',         'TYM',
   'ZENÚ',                          '',
   array['Auxiliar Logístico'], 1, '1005'),

  ('CRISTHIAN DAVID CASTAÑO CORREA','Supervisor Comercial',   'TYM',
   'ZENÚ',                          '',
   array['Asesor Comercial'], 1, '1006'),

  ('DIEGO ALEJANDRO GONZALEZ VALENCIA','Supervisor Comercial','TYM',
   'ALPINA',                        'PEREIRA',
   array['Asesor Comercial','Supernumerario Comercial'], 2, '1007'),

  ('BIBIANA ESMILDA MONTOYA TABARQUINO','Supervisor Comercial','TYM',
   'ALPINA',                        'MANIZALES',
   array['Asesor Comercial','Supernumerario Comercial'], 2, '1008'),

  ('JUAN JOSE GUZMAN HENAO',       'Supervisor Comercial',   'TYM',
   'ALPINA',                        'ARMENIA',
   array['Asesor Comercial','Supernumerario Comercial'], 2, '1009'),

  ('ERIKA LORENA VALENCIA RESTREPO','Coordinador GGHH/SST',  'TYM',
   'ZENÚ, FLEISCHMANN, FAMILIA, ALPINA, POSTOBON', 'PEREIRA, ARMENIA, MANIZALES',
   array['TODOS'], 1, '1010'),

  ('JULIANA CLEMENCIA GUTIERREZ GRANADA','Contador',          'TYM',
   'ZENÚ, FLEISCHMANN, ALPINA',     'PEREIRA, ARMENIA, MANIZALES',
   array['Auxiliar Contable','Analista de Cartera','Auxiliar de Caja'], 3, '1011'),

  ('ALEXANDRA MILENA VANEGAS CALVO','Contador',               'TAT',
   'POSTOBON, FAMILIA',             'PEREIRA',
   array['Auxiliar Contable','Analista de Cartera','Auxiliar de Caja'], 3, '1012'),

  ('MARCO AURELIO PARRA AVILA',    'Gerente',                'TYM',
   'ZENÚ, FLEISCHMANN, FAMILIA, ALPINA, POSTOBON', 'PEREIRA, ARMENIA, MANIZALES',
   array['TODOS'], 1, '1013')
on conflict do nothing;

-- RLS
alter table jefes_inmediatos enable row level security;
create policy "allow_all_jefes_inmediatos" on jefes_inmediatos for all using (true) with check (true);

-- Agregar columna de adjunto HV a requisicion_personal (si no existe)
alter table requisicion_personal
  add column if not exists hv_candidato_nombre text,
  add column if not exists hv_candidato_url    text,  -- URL en Supabase Storage
  add column if not exists creado_desde_portal boolean default false,
  add column if not exists jefe_id             uuid references jefes_inmediatos(id);

-- Índice
create index if not exists idx_jefes_nombre on jefes_inmediatos(nombre);
create index if not exists idx_req_jefe_id  on requisicion_personal(jefe_id);

-- ============================================================
-- BUCKET DE STORAGE PARA HV Y DOCUMENTOS DE CONTRATACIÓN
-- Ejecutar el archivo: migration_storage_hv.sql
-- (crea el bucket "contratacion-docs" y sus políticas de acceso)
-- ============================================================
