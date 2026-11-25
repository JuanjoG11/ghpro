-- ============================================================
-- GH PRO — Migración: líderes evaluadores
-- Ejecutar después de evaluacion_desempeno.sql
-- ============================================================

-- ── Tabla de usuarios del módulo de evaluación ───────────────
-- Los únicos que pueden evaluar son los 4 cargos con personal
-- a cargo. GH administra. Gerente General evalúa a los líderes.
create table if not exists usuarios_evaluacion (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  cargo              text not null,
  rol                text not null check (rol in ('lider','gh','gerencia')),
  cedula             text unique,
  pin                text,
  jefe_inmediato_id  uuid references jefes_inmediatos(id),
  activo             boolean default true,
  created_at         timestamptz default now()
);

-- RLS abierto (igual que el resto del módulo)
alter table usuarios_evaluacion enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'usuarios_evaluacion' and policyname = 'allow_all_usuarios_evaluacion'
  ) then
    create policy "allow_all_usuarios_evaluacion"
      on usuarios_evaluacion for all using (true) with check (true);
  end if;
end $$;

-- ── Columna en evaluaciones para vincular al usuario ─────────
alter table evaluaciones
  add column if not exists evaluador_usuario_id uuid references usuarios_evaluacion(id);

-- ── Vista: bandeja por líder ──────────────────────────────────
-- Devuelve las evaluaciones que le corresponden a cada usuario.
-- Líderes: solo las de su equipo (evaluador_nombre = su nombre).
-- GH: todas.
-- Gerencia: solo las de los 4 cargos de liderazgo.
create or replace view v_bandeja_evaluaciones as
select
  e.id,
  e.estado,
  e.rol_evaluador,
  e.evaluador_nombre,
  e.evaluador_usuario_id,
  e.cargo_nombre,
  e.fecha_limite,
  e.concepto_prueba,
  e.indice_ajuste,
  e.clasificacion,
  e.orden_contratacion_num,
  e.created_at,
  oc.nombres        as colaborador_nombre,
  oc.numero_id      as colaborador_cedula,
  oc.empresa,
  oc.sede_nombre,
  oc.fecha_ingreso,
  oc.periodo_prueba_dias,
  (oc.fecha_ingreso + oc.periodo_prueba_dias - 1) as fecha_fin_prueba,
  c.tipo            as ciclo_tipo,
  c.nombre          as ciclo_nombre,
  ce.tiene_personal_a_cargo
from evaluaciones e
join orden_contratacion oc  on oc.id = e.colaborador_id
join ciclos_evaluacion  c   on c.id  = e.ciclo_id
left join cargos_evaluacion ce on ce.id = e.cargo_evaluacion_id;

-- ── Función actualizada: asignar evaluador correcto ──────────
-- Regla:
--   Si el cargo del colaborador es de un líder (tiene_personal_a_cargo = true)
--     → el evaluador es el Gerente General (rol = 'gerencia')
--   Si no
--     → el evaluador es el jefe_inmediato registrado en la orden,
--       que debe ser uno de los 4 líderes de proceso
create or replace function fn_crear_evaluacion_prueba(p_orden_id uuid)
returns uuid language plpgsql as $$
declare
  v_orden          record;
  v_ciclo_id       uuid;
  v_cargo_ev_id    uuid;
  v_cargo_ev       record;
  v_eval_id        uuid;
  v_fecha_venc     date;
  v_fecha_lim      date;
  v_dias_apertura  integer;
  v_dias_limite    integer;
  v_comp           record;
  v_puntaje_ex     integer;
  v_evaluador_nom  text;
  v_evaluador_uid  uuid;
  v_es_lider_cargo boolean := false;
begin
  -- Leer la orden
  select * into v_orden from orden_contratacion where id = p_orden_id;

  -- Solo si tiene periodo de prueba pactado y es primer contrato
  if v_orden.periodo_prueba_dias is null or v_orden.periodo_prueba_dias = 0 then
    return null;
  end if;
  if v_orden.es_primer_contrato = false then
    return null;
  end if;

  -- Validar tope para contratos a término fijo < 1 año
  if v_orden.tipo_contrato = 'termino_fijo'
     and v_orden.duracion_contrato_dias is not null
     and v_orden.duracion_contrato_dias < 365 then
    declare
      v_tope integer := least(floor(v_orden.duracion_contrato_dias::numeric / 5)::integer, 60);
    begin
      if v_orden.periodo_prueba_dias > v_tope then
        raise exception
          'El periodo de prueba (% días) supera el tope legal (% días = 1/5 de % días de contrato)',
          v_orden.periodo_prueba_dias, v_tope, v_orden.duracion_contrato_dias;
      end if;
    end;
  end if;

  -- Buscar ciclo permanente de prueba
  select id into v_ciclo_id from ciclos_evaluacion
  where tipo = 'PRUEBA' and estado = 'abierto'
  limit 1;

  -- Buscar cargo en tabla de evaluación por nombre
  select * into v_cargo_ev from cargos_evaluacion
  where nombre ilike v_orden.cargo
  limit 1;

  v_cargo_ev_id := v_cargo_ev.id;

  -- ── Determinar quién evalúa ──────────────────────────────
  -- Si el cargo del colaborador es de liderazgo (tiene personal a cargo)
  -- lo evalúa el Gerente General.
  -- Si no, lo evalúa el jefe_inmediato (que debe ser un líder de proceso).
  if v_cargo_ev.tiene_personal_a_cargo = true then
    v_es_lider_cargo := true;
    -- Buscar el usuario Gerente General
    select id, nombre into v_evaluador_uid, v_evaluador_nom
    from usuarios_evaluacion
    where rol = 'gerencia' and activo = true
    limit 1;
    -- Si no existe aún el gerente en la tabla, usar texto del jefe_inmediato
    if v_evaluador_nom is null then
      v_evaluador_nom := v_orden.jefe_inmediato;
    end if;
  else
    -- Colaborador normal: lo evalúa su jefe inmediato (líder de proceso)
    v_evaluador_nom := v_orden.jefe_inmediato;
    -- Intentar vincular con el usuario registrado
    select id into v_evaluador_uid
    from usuarios_evaluacion
    where nombre ilike v_evaluador_nom and rol = 'lider' and activo = true
    limit 1;
  end if;

  -- Fechas
  v_fecha_venc := v_orden.fecha_ingreso + v_orden.periodo_prueba_dias - 1;

  select valor::integer into v_dias_apertura
  from parametros_evaluacion where clave = 'dias_apertura_prueba';
  select valor::integer into v_dias_limite
  from parametros_evaluacion where clave = 'dias_limite_lider_prueba';

  v_dias_apertura := coalesce(v_dias_apertura, 20);
  v_dias_limite   := coalesce(v_dias_limite, 10);

  v_fecha_lim := v_fecha_venc - v_dias_limite;

  -- Crear evaluación
  insert into evaluaciones (
    ciclo_id, colaborador_id, cargo_nombre, cargo_evaluacion_id,
    evaluador_nombre, evaluador_usuario_id, rol_evaluador,
    fecha_limite, estado, version_diccionario, orden_contratacion_num
  ) values (
    v_ciclo_id, p_orden_id, v_orden.cargo, v_cargo_ev_id,
    v_evaluador_nom, v_evaluador_uid, 'JEFE',
    v_fecha_lim, 'pendiente', 2, v_orden.numero
  )
  returning id into v_eval_id;

  -- Cargar competencias del cargo desde la matriz
  if v_cargo_ev_id is not null then
    for v_comp in
      select c.id as comp_id, c.codigo, c.nombre, m.grado_exigido
      from matriz_cargo_competencia m
      join competencias c on c.id = m.competencia_id
      where m.cargo_id = v_cargo_ev_id
        and m.version_diccionario = 2
      order by c.codigo
    loop
      v_puntaje_ex := case v_comp.grado_exigido
        when 'A' then 4
        when 'B' then 3
        when 'C' then 2
        else 1
      end;

      insert into evaluacion_detalle (
        evaluacion_id, competencia_id, codigo, nombre_comp,
        grado_exigido, puntaje_exigido
      ) values (
        v_eval_id, v_comp.comp_id, v_comp.codigo, v_comp.nombre,
        v_comp.grado_exigido, v_puntaje_ex
      );
    end loop;
  end if;

  -- Auditoría
  insert into auditoria_evaluacion (tabla, registro_id, accion, valor_nuevo, usuario_nombre)
  values ('evaluaciones', v_eval_id, 'creacion', 'pendiente', 'sistema');

  return v_eval_id;
end;
$$;
