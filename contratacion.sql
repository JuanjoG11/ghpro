-- ============================================================
-- GH PRO — Módulo de Contratación
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Empresa: TYM / TAT  ·  Fecha: 2026-10-29
-- ============================================================

-- ── PARÁMETROS ANUALES (SMMLV + Auxilio transporte) ──────────
create table if not exists parametros_legales (
  id           uuid primary key default gen_random_uuid(),
  anio         integer not null unique,
  smmlv        numeric(14,2) not null,
  aux_transporte numeric(14,2) not null default 0,
  created_at   timestamptz default now()
);

-- Valores históricos y vigentes
insert into parametros_legales (anio, smmlv, aux_transporte) values
  (2024, 1300000,  162000),
  (2025, 1423500,  200000),
  (2026, 1560000,  220000)
on conflict (anio) do nothing;

-- ── TABLAS MAESTRAS ──────────────────────────────────────────

-- Sedes
create table if not exists sedes (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  ciudad text not null,
  activo boolean default true
);
insert into sedes (nombre, ciudad) values
  ('Pereira Centro', 'Pereira'),
  ('Manizales', 'Manizales'),
  ('Armenia', 'Armenia'),
  ('Bodega Principal', 'Pereira')
on conflict do nothing;

-- Cargos
create table if not exists cargos_maestros (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  area   text,
  activo boolean default true
);
insert into cargos_maestros (nombre, area) values
  ('Auxiliar de Bodega', 'Bodega'),
  ('Conductor', 'Logística'),
  ('Asesor Comercial', 'Comercial'),
  ('Auxiliar Administrativo', 'Administrativa'),
  ('Coordinador de Logística', 'Logística'),
  ('Jefe de Bodega', 'Bodega'),
  ('Mercaderista', 'Comercial'),
  ('Auxiliar de Cartera', 'Administrativa'),
  ('Operario de Producción', 'Operaciones'),
  ('Aprendiz SENA', 'Administrativa')
on conflict do nothing;

-- EPS
create table if not exists eps_lista (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean default true
);
insert into eps_lista (nombre) values
  ('Sura EPS'), ('Nueva EPS'), ('Sanitas'), ('Compensar'), ('Coosalud'),
  ('Famisanar'), ('Mutual Ser'), ('Capresoca'), ('Emssanar'), ('Comfenalco Valle')
on conflict do nothing;

-- AFP
create table if not exists afp_lista (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  es_publica boolean default false,
  activo boolean default true
);
insert into afp_lista (nombre, es_publica) values
  ('Colpensiones', true), ('Porvenir', false), ('Protección', false),
  ('Colfondos', false), ('Old Mutual', false)
on conflict do nothing;

-- Fondos de cesantías
create table if not exists cesantias_lista (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean default true
);
insert into cesantias_lista (nombre) values
  ('Porvenir'), ('Protección'), ('Colfondos'), ('Old Mutual'), ('Fondo Nacional del Ahorro')
on conflict do nothing;

-- ARL
create table if not exists arl_lista (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean default true
);
insert into arl_lista (nombre) values
  ('Sura ARL'), ('Positiva'), ('Colmena Seguros'), ('Liberty Seguros'), ('Seguros Bolívar')
on conflict do nothing;

-- Cajas de compensación familiar
create table if not exists cajas_lista (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean default true
);
insert into cajas_lista (nombre) values
  ('Comfamiliar Risaralda'), ('Comfenalco Quindío'), ('Confa Manizales'),
  ('Cafam'), ('Compensar'), ('Colsubsidio')
on conflict do nothing;

-- Bancos
create table if not exists bancos_lista (
  id     uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean default true
);
insert into bancos_lista (nombre) values
  ('Bancolombia'), ('Davivienda'), ('Banco de Bogotá'), ('BBVA'),
  ('Nequi'), ('Daviplata'), ('Banco AV Villas'), ('Itaú'), ('Banco Popular'),
  ('Citibank'), ('Lulo Bank'), ('Nu Colombia')
on conflict do nothing;

-- ── REQUISICIÓN DE PERSONAL (GH-F01) ─────────────────────────
create table if not exists requisicion_personal (
  id                     uuid primary key default gen_random_uuid(),
  numero                 text unique not null,            -- REQ-2026-0001
  empresa                text not null check (empresa in ('TYM','TAT')),
  fecha_solicitud        date not null default current_date,
  sede_id                uuid references sedes(id),
  sede_nombre            text,
  area                   text not null,
  nombre_solicitante     text not null,
  cargo_solicitante      text not null,
  fecha_requerida        date not null,
  -- Datos del cargo
  cargo_id               uuid references cargos_maestros(id),
  cargo_nombre           text not null,
  num_vacantes           integer not null default 1 check (num_vacantes >= 1),
  jefe_inmediato         text not null,
  horario                text not null check (horario in ('tiempo_completo','medio_tiempo','por_turnos')),
  lugar_trabajo          text not null,
  cargo_nuevo            boolean default false,
  -- Motivo
  motivo                 text not null check (motivo in ('reemplazo_retiro','reemplazo_temporal','cargo_nuevo','aumento_operacion','temporada')),
  persona_reemplazar     text,                            -- solo si motivo = reemplazo
  justificacion          text not null,
  -- Condiciones
  tipo_contrato          text not null check (tipo_contrato in ('termino_indefinido','termino_fijo','obra_labor','aprendizaje')),
  duracion_meses         integer,                         -- si es fijo u obra
  salario                numeric(14,2) not null,
  auxilio_transporte     boolean not null default false,
  otros_pagos            text,
  nivel_riesgo_arl       text not null check (nivel_riesgo_arl in ('I','II','III','IV','V')),
  requiere_dotacion      boolean default false,
  herramientas           text,
  -- Perfil
  nivel_educativo        text not null check (nivel_educativo in ('bachiller','tecnico','tecnologo','profesional','posgrado')),
  formacion_especifica   text,
  experiencia_meses      integer not null default 0,
  experiencia_especifica text,
  conocimientos_tecnicos text,
  licencias              text,
  competencias           text[],                          -- array de tags
  funciones              text not null,
  fuente_reclutamiento   text check (fuente_reclutamiento in ('interna','referido','bolsa_empleo','sena','redes_sociales','agencia_publica',null)),
  -- Estado
  estado                 text not null default 'pendiente'
                           check (estado in ('pendiente','aprobada','rechazada','en_seleccion','cubierta','cancelada')),
  motivo_rechazo         text,
  vacantes_cubiertas     integer default 0,
  created_by             text,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

-- ── CANDIDATOS ───────────────────────────────────────────────
create table if not exists candidatos (
  id                uuid primary key default gen_random_uuid(),
  requisicion_id    uuid references requisicion_personal(id) on delete cascade,
  requisicion_num   text,
  nombre            text not null,
  tipo_id           text not null default 'CC' check (tipo_id in ('CC','CE','PPT','PA')),
  numero_id         text not null,
  telefono          text,
  email             text,
  estado            text not null default 'activo' check (estado in ('activo','eliminado','seleccionado','descartado')),
  autorizacion_datos boolean default false,
  adjunto_autorizacion text,                              -- URL Supabase Storage
  obs               text,
  created_at        timestamptz default now()
);

-- ── VALIDACIÓN DE REFERENCIAS (GH-F02) ───────────────────────
create table if not exists validacion_referencias (
  id                  uuid primary key default gen_random_uuid(),
  numero              text unique not null,               -- VR-2026-0001
  requisicion_id      uuid references requisicion_personal(id),
  requisicion_num     text,
  candidato_id        uuid references candidatos(id) on delete cascade,
  candidato_nombre    text not null,
  tipo_id             text not null default 'CC',
  numero_id           text not null,
  cargo_aspira        text not null,
  autorizacion_firmada boolean default false,
  adjunto_autorizacion text,
  fecha_verificacion  date not null,
  responsable         text not null,
  -- Concepto final
  concepto            text check (concepto in ('favorable','favorable_con_obs','no_favorable',null)),
  inconsistencias     text,
  observaciones       text,
  obs_gh              text,                               -- observación obligatoria si hay ref no favorable
  estado              text not null default 'borrador'
                        check (estado in ('borrador','cerrada')),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── REFERENCIAS PERSONALES (N:1 con validacion) ──────────────
create table if not exists referencias_personales (
  id                   uuid primary key default gen_random_uuid(),
  validacion_id        uuid references validacion_referencias(id) on delete cascade,
  nombre_referencia    text not null,
  telefono             text,
  relacion             text check (relacion in ('amigo','vecino','excompanero','otro')),
  tiempo_conoce        text,
  descripcion_persona  text,
  es_responsable       boolean,
  obs_responsable      text,
  conoce_direccion     text,
  recomienda           text check (recomienda in ('si','no','con_reservas')),
  resultado_contacto   text check (resultado_contacto in ('contactada','no_contesta','numero_errado','no_conoce')),
  created_at           timestamptz default now()
);

-- ── REFERENCIAS LABORALES (N:1 con validacion) ───────────────
create table if not exists referencias_laborales (
  id                   uuid primary key default gen_random_uuid(),
  validacion_id        uuid references validacion_referencias(id) on delete cascade,
  empresa              text not null,
  nombre_contacto      text,
  cargo_contacto       text,
  telefono             text,
  cargo_candidato      text,
  fecha_ingreso        date,
  fecha_retiro         date,
  motivo_retiro        text check (motivo_retiro in ('renuncia','terminacion','despido_justa','despido_sin_justa','otro')),
  desempeno            text check (desempeno in ('excelente','bueno','regular','deficiente')),
  puntualidad          text check (puntualidad in ('excelente','bueno','regular','deficiente')),
  relacion_jefes       text check (relacion_jefes in ('excelente','bueno','regular','deficiente')),
  tuvo_disciplinarios  boolean,
  obs_disciplinarios   text,
  volveria_contratar   boolean,
  motivo_no_contratar  text,
  coincide_hv          boolean,
  resultado_contacto   text check (resultado_contacto in ('contactada','no_contesta','empresa_no_existe','no_entrega_info')),
  created_at           timestamptz default now()
);

-- ── ORDEN DE CONTRATACIÓN (GH-F03) ───────────────────────────
create table if not exists orden_contratacion (
  id                    uuid primary key default gen_random_uuid(),
  numero                text unique not null,             -- OC-2026-0001
  requisicion_id        uuid references requisicion_personal(id),
  requisicion_num       text,
  validacion_id         uuid references validacion_referencias(id),
  candidato_id          uuid references candidatos(id),
  -- Datos del seleccionado
  nombres               text not null,
  tipo_id               text not null default 'CC',
  numero_id             text not null,
  lugar_expedicion      text,
  fecha_expedicion      date,
  fecha_nacimiento      date,
  lugar_nacimiento      text,
  direccion             text not null,
  barrio                text,
  ciudad                text not null,
  telefono              text not null,
  email                 text not null,
  estado_civil          text,
  contacto_emergencia   text,
  parentesco_emergencia text,
  telefono_emergencia   text,
  talla_camisa          text,
  talla_pantalon        text,
  talla_calzado         text,
  -- Condiciones del contrato
  empresa               text not null check (empresa in ('TYM','TAT')),
  cargo                 text not null,
  area                  text not null,
  jefe_inmediato        text not null,
  tipo_contrato         text not null,
  fecha_ingreso         date not null,
  fecha_terminacion     date,
  periodo_prueba_dias   integer not null default 60 check (periodo_prueba_dias >= 0 and periodo_prueba_dias <= 60),
  salario               numeric(14,2) not null,
  tipo_salario          text not null default 'ordinario' check (tipo_salario in ('ordinario','integral')),
  auxilio_transporte    boolean default false,
  otros_pagos           text,
  jornada               text,
  sede_id               uuid references sedes(id),
  sede_nombre           text,
  forma_pago            text not null check (forma_pago in ('quincenal','mensual')),
  banco_id              uuid references bancos_lista(id),
  banco_nombre          text,
  tipo_cuenta           text check (tipo_cuenta in ('ahorros','corriente')),
  -- Seguridad social
  eps_id                uuid references eps_lista(id),
  eps_nombre            text,
  afp_id                uuid references afp_lista(id),
  afp_nombre            text,
  cesantias_id          uuid references cesantias_lista(id),
  cesantias_nombre      text,
  arl_id                uuid references arl_lista(id),
  arl_nombre            text,
  clase_riesgo          text check (clase_riesgo in ('I','II','III','IV','V')),
  caja_id               uuid references cajas_lista(id),
  caja_nombre           text,
  -- Lista de chequeo (JSON: {item: estado})
  checklist             jsonb default '{}'::jsonb,
  -- Estado
  estado                text not null default 'borrador'
                          check (estado in ('borrador','pendiente_aprobacion','aprobada','rechazada','contrato_generado','anulada')),
  motivo_rechazo        text,
  motivo_anulacion      text,
  created_by            text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ── BENEFICIARIOS (N:1 con orden) ────────────────────────────
create table if not exists beneficiarios_orden (
  id             uuid primary key default gen_random_uuid(),
  orden_id       uuid references orden_contratacion(id) on delete cascade,
  nombre         text not null,
  tipo_id        text default 'CC',
  numero_id      text,
  parentesco     text,
  created_at     timestamptz default now()
);

-- ── APROBACIONES (polimórfica) ───────────────────────────────
create table if not exists aprobaciones_contratacion (
  id             uuid primary key default gen_random_uuid(),
  tabla_origen   text not null,                           -- 'requisicion_personal' | 'orden_contratacion'
  registro_id    uuid not null,
  rol            text not null,                           -- 'solicitante' | 'gh' | 'gerencia' | 'jefe_inmediato'
  nombre_usuario text not null,
  decision       text not null check (decision in ('aprobado','rechazado','pendiente')),
  comentario     text,
  fecha          timestamptz default now()
);

-- ── HISTORIAL DE CAMBIOS ─────────────────────────────────────
create table if not exists historial_contratacion (
  id             uuid primary key default gen_random_uuid(),
  tabla_origen   text not null,
  registro_id    uuid not null,
  campo          text not null,
  valor_anterior text,
  valor_nuevo    text,
  usuario        text,
  fecha          timestamptz default now()
);

-- ── SECUENCIAS / CONSECUTIVOS ────────────────────────────────
create table if not exists consecutivos_contratacion (
  id       uuid primary key default gen_random_uuid(),
  tipo     text unique not null,                          -- 'REQ' | 'VR' | 'OC'
  anio     integer not null,
  ultimo   integer not null default 0
);

insert into consecutivos_contratacion (tipo, anio, ultimo) values
  ('REQ', extract(year from current_date)::integer, 0),
  ('VR',  extract(year from current_date)::integer, 0),
  ('OC',  extract(year from current_date)::integer, 0)
on conflict (tipo) do nothing;

-- Función para generar consecutivo atómico
create or replace function fn_siguiente_consecutivo(p_tipo text)
returns text language plpgsql as $$
declare
  v_anio   integer := extract(year from current_date)::integer;
  v_ultimo integer;
  v_prefijo text;
begin
  -- Reset año si cambió
  update consecutivos_contratacion
  set ultimo = case when anio < v_anio then 1 else ultimo + 1 end,
      anio   = v_anio
  where tipo = p_tipo
  returning ultimo into v_ultimo;

  if not found then
    insert into consecutivos_contratacion (tipo, anio, ultimo) values (p_tipo, v_anio, 1);
    v_ultimo := 1;
  end if;

  v_prefijo := case p_tipo
    when 'REQ' then 'REQ'
    when 'VR'  then 'VR'
    when 'OC'  then 'OC'
    else p_tipo
  end;

  return v_prefijo || '-' || v_anio || '-' || lpad(v_ultimo::text, 4, '0');
end;
$$;

-- ── ÍNDICES ──────────────────────────────────────────────────
create index if not exists idx_req_empresa    on requisicion_personal(empresa);
create index if not exists idx_req_estado     on requisicion_personal(estado);
create index if not exists idx_req_fecha      on requisicion_personal(fecha_solicitud);
create index if not exists idx_cand_req       on candidatos(requisicion_id);
create index if not exists idx_vr_candidato   on validacion_referencias(candidato_id);
create index if not exists idx_oc_requisicion on orden_contratacion(requisicion_id);
create index if not exists idx_oc_estado      on orden_contratacion(estado);
create index if not exists idx_aprob_registro on aprobaciones_contratacion(registro_id);
create index if not exists idx_hist_registro  on historial_contratacion(registro_id);

-- ── RLS ──────────────────────────────────────────────────────
alter table requisicion_personal        enable row level security;
alter table candidatos                  enable row level security;
alter table validacion_referencias      enable row level security;
alter table referencias_personales      enable row level security;
alter table referencias_laborales       enable row level security;
alter table orden_contratacion          enable row level security;
alter table beneficiarios_orden         enable row level security;
alter table aprobaciones_contratacion   enable row level security;
alter table historial_contratacion      enable row level security;
alter table parametros_legales          enable row level security;
alter table consecutivos_contratacion   enable row level security;
alter table sedes                       enable row level security;
alter table cargos_maestros             enable row level security;
alter table eps_lista                   enable row level security;
alter table afp_lista                   enable row level security;
alter table cesantias_lista             enable row level security;
alter table arl_lista                   enable row level security;
alter table cajas_lista                 enable row level security;
alter table bancos_lista                enable row level security;

-- Políticas de acceso abierto (ajustar según autenticación futura)
do $$ declare t text; begin
  foreach t in array array[
    'requisicion_personal','candidatos','validacion_referencias','referencias_personales',
    'referencias_laborales','orden_contratacion','beneficiarios_orden',
    'aprobaciones_contratacion','historial_contratacion','parametros_legales',
    'consecutivos_contratacion','sedes','cargos_maestros','eps_lista',
    'afp_lista','cesantias_lista','arl_lista','cajas_lista','bancos_lista'
  ] loop
    execute format(
      'create policy "allow_all_%s" on %I for all using (true) with check (true)',
      t, t
    );
  end loop;
end $$;
