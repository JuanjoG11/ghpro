-- ============================================================
-- GH PRO — Conectar tabla trabajadores con módulo de evaluación
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Columnas nuevas en trabajadores ───────────────────────
alter table trabajadores
  add column if not exists cargo_evaluacion_id  uuid references cargos_evaluacion(id),
  add column if not exists lider_evaluacion_id  uuid references usuarios_evaluacion(id),
  add column if not exists periodo_prueba_dias  integer default 60,
  add column if not exists es_primer_contrato   boolean default true,
  add column if not exists tipo_contrato        text default 'termino_indefinido';

-- ── 2. Mapeo automático cargo texto → cargo_evaluacion_id ────
-- Intenta hacer match por nombre (case-insensitive, sin tildes no problemáticas).
-- Los que no hagan match quedan en NULL y GH los asigna manualmente.
update trabajadores t
set cargo_evaluacion_id = ce.id
from cargos_evaluacion ce
where t.cargo_evaluacion_id is null
  and (
    lower(t.cargo) = lower(ce.nombre)
    or lower(t.cargo) like '%' || lower(split_part(ce.nombre, '(', 1)) || '%'
    or lower(ce.nombre) like '%' || lower(t.cargo) || '%'
  )
  and t.estado = 'activo';

-- ── 3. Mapeo automático jefe texto → lider_evaluacion_id ─────
update trabajadores t
set lider_evaluacion_id = u.id
from usuarios_evaluacion u
where t.lider_evaluacion_id is null
  and lower(t.jefe) = lower(u.nombre)
  and t.estado = 'activo';

-- ── 4. Función: crear evaluación de prueba desde trabajador ──
-- Alternativa a fn_crear_evaluacion_prueba (que usa orden_contratacion).
-- Esta usa directamente la tabla trabajadores.
create or replace function fn_crear_eval_prueba_trabajador(p_trabajador_id uuid)
returns uuid language plpgsql as $$
declare
  v_t             record;
  v_ciclo_id      uuid;
  v_eval_id       uuid;
  v_fecha_venc    date;
  v_fecha_lim     date;
  v_dias_lim      integer;
  v_evaluador_nom text;
  v_evaluador_uid uuid;
  v_comp          record;
  v_puntaje_ex    integer;
begin
  select * into v_t from trabajadores where id = p_trabajador_id;

  -- Solo activos con periodo de prueba y primer contrato
  if v_t.estado <> 'activo' then return null; end if;
  if coalesce(v_t.periodo_prueba_dias, 0) = 0 then return null; end if;
  if v_t.es_primer_contrato = false then return null; end if;
  if v_t.fecha_ingreso is null then return null; end if;

  -- No crear si ya existe una evaluación de prueba para este trabajador
  if exists (
    select 1 from evaluaciones e
    join ciclos_evaluacion c on c.id = e.ciclo_id
    where e.trabajador_id = p_trabajador_id
      and c.tipo = 'PRUEBA'
      and e.estado not in ('anulada')
  ) then return null; end if;

  -- Ciclo permanente de prueba
  select id into v_ciclo_id from ciclos_evaluacion
  where tipo = 'PRUEBA' and estado = 'abierto' limit 1;

  -- Fecha límite
  v_fecha_venc := v_t.fecha_ingreso + v_t.periodo_prueba_dias - 1;
  select valor::integer into v_dias_lim
  from parametros_evaluacion where clave = 'dias_limite_lider_prueba';
  v_fecha_lim := v_fecha_venc - coalesce(v_dias_lim, 10);

  -- Evaluador: si el cargo es de liderazgo → Gerente General; si no → su líder
  if exists (select 1 from cargos_evaluacion where id = v_t.cargo_evaluacion_id and tiene_personal_a_cargo = true) then
    select id, nombre into v_evaluador_uid, v_evaluador_nom
    from usuarios_evaluacion where rol = 'gerencia' and activo = true limit 1;
  else
    select id, nombre into v_evaluador_uid, v_evaluador_nom
    from usuarios_evaluacion where id = v_t.lider_evaluacion_id limit 1;
    if v_evaluador_nom is null then v_evaluador_nom := v_t.jefe; end if;
  end if;

  -- Crear evaluación
  insert into evaluaciones (
    ciclo_id, trabajador_id, cargo_nombre, cargo_evaluacion_id,
    evaluador_nombre, evaluador_usuario_id, rol_evaluador,
    fecha_limite, estado, version_diccionario
  ) values (
    v_ciclo_id, p_trabajador_id, v_t.cargo, v_t.cargo_evaluacion_id,
    v_evaluador_nom, v_evaluador_uid, 'JEFE',
    v_fecha_lim, 'pendiente', 2
  )
  returning id into v_eval_id;

  -- Cargar competencias desde la matriz
  if v_t.cargo_evaluacion_id is not null then
    for v_comp in
      select c.id as comp_id, c.codigo, c.nombre, m.grado_exigido
      from matriz_cargo_competencia m
      join competencias c on c.id = m.competencia_id
      where m.cargo_id = v_t.cargo_evaluacion_id and m.version_diccionario = 2
      order by c.codigo
    loop
      v_puntaje_ex := case v_comp.grado_exigido when 'A' then 4 when 'B' then 3 when 'C' then 2 else 1 end;
      insert into evaluacion_detalle (
        evaluacion_id, competencia_id, codigo, nombre_comp, grado_exigido, puntaje_exigido
      ) values (v_eval_id, v_comp.comp_id, v_comp.codigo, v_comp.nombre, v_comp.grado_exigido, v_puntaje_ex);
    end loop;
  end if;

  insert into auditoria_evaluacion (tabla, registro_id, accion, valor_nuevo, usuario_nombre)
  values ('evaluaciones', v_eval_id, 'creacion', 'pendiente', 'sistema');

  return v_eval_id;
end;
$$;

-- ── 5. Columna trabajador_id en evaluaciones ─────────────────
-- Para que las evaluaciones puedan apuntar directamente a trabajadores
-- (además del flujo por orden_contratacion que ya existía)
alter table evaluaciones
  add column if not exists trabajador_id uuid references trabajadores(id);

-- Actualizar la vista de periodos de prueba para incluir ambas fuentes
create or replace view v_periodos_prueba as
-- Desde orden_contratacion (flujo de contratación)
select
  e.id                                                            as evaluacion_id,
  e.estado,
  e.orden_contratacion_num,
  oc.nombres                                                      as colaborador,
  oc.numero_id                                                    as cedula,
  oc.empresa,
  oc.cargo,
  oc.sede_nombre,
  oc.jefe_inmediato                                               as lider,
  oc.fecha_ingreso,
  oc.periodo_prueba_dias,
  (oc.fecha_ingreso + oc.periodo_prueba_dias - 1)                 as fecha_fin_prueba,
  e.fecha_limite                                                  as fecha_limite_lider,
  ((oc.fecha_ingreso + oc.periodo_prueba_dias - 1) - current_date)::int as dias_restantes,
  e.concepto_prueba,
  e.indice_ajuste,
  e.clasificacion
from evaluaciones e
join orden_contratacion oc on oc.id = e.colaborador_id
join ciclos_evaluacion  c  on c.id  = e.ciclo_id and c.tipo = 'PRUEBA'
where e.rol_evaluador = 'JEFE'

union all

-- Desde trabajadores (flujo directo)
select
  e.id                                                            as evaluacion_id,
  e.estado,
  null                                                            as orden_contratacion_num,
  t.nombre                                                        as colaborador,
  t.cedula,
  t.empresa,
  t.cargo,
  t.ciudad                                                        as sede_nombre,
  t.jefe                                                          as lider,
  t.fecha_ingreso,
  t.periodo_prueba_dias,
  (t.fecha_ingreso + t.periodo_prueba_dias - 1)                   as fecha_fin_prueba,
  e.fecha_limite                                                  as fecha_limite_lider,
  ((t.fecha_ingreso + t.periodo_prueba_dias - 1) - current_date)::int as dias_restantes,
  e.concepto_prueba,
  e.indice_ajuste,
  e.clasificacion
from evaluaciones e
join trabajadores t on t.id = e.trabajador_id
join ciclos_evaluacion c on c.id = e.ciclo_id and c.tipo = 'PRUEBA'
where e.rol_evaluador = 'JEFE';

-- ── 6. Verificar mapeo ────────────────────────────────────────
select
  t.nombre,
  t.cargo,
  ce.nombre                   as cargo_diccionario,
  t.jefe,
  u.nombre                    as lider_sistema,
  t.cargo_evaluacion_id is not null as cargo_mapeado,
  t.lider_evaluacion_id is not null as lider_mapeado
from trabajadores t
left join cargos_evaluacion  ce on ce.id = t.cargo_evaluacion_id
left join usuarios_evaluacion u  on u.id  = t.lider_evaluacion_id
where t.estado = 'activo'
order by cargo_mapeado, t.nombre;
