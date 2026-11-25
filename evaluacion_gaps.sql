-- ============================================================
-- GH PRO — Gaps del módulo de evaluación (orden del documento)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- GAP 1 — Tabla cargo_alias (sección 4)
-- Relaciona nombres viejos/alternativos con el cargo del diccionario
-- ════════════════════════════════════════════════════════════
create table if not exists cargo_alias (
  id              uuid primary key default gen_random_uuid(),
  nombre_anterior text not null unique,
  cargo_id        uuid references cargos_evaluacion(id) on delete cascade,
  created_at      timestamptz default now()
);

-- Poblar con los alias conocidos (nombres de nómina vs diccionario)
insert into cargo_alias (nombre_anterior, cargo_id)
select 'Coordinadora Comercial', id from cargos_evaluacion where nombre = 'Coordinador comercial'
on conflict (nombre_anterior) do nothing;
insert into cargo_alias (nombre_anterior, cargo_id)
select 'Coordinador Comercial', id from cargos_evaluacion where nombre = 'Coordinador comercial'
on conflict (nombre_anterior) do nothing;
insert into cargo_alias (nombre_anterior, cargo_id)
select 'Asesor Comercial', id from cargos_evaluacion where nombre = 'Asesor(a) comercial'
on conflict (nombre_anterior) do nothing;
insert into cargo_alias (nombre_anterior, cargo_id)
select 'Auxiliar Logístico', id from cargos_evaluacion where nombre = 'Auxiliar logístico de entrega'
on conflict (nombre_anterior) do nothing;
insert into cargo_alias (nombre_anterior, cargo_id)
select 'Auxiliar de Bodega', id from cargos_evaluacion where nombre = 'Auxiliar de bodega (cargue y descargue)'
on conflict (nombre_anterior) do nothing;
insert into cargo_alias (nombre_anterior, cargo_id)
select 'Auxiliar de Separación', id from cargos_evaluacion where nombre = 'Auxiliar de separación'
on conflict (nombre_anterior) do nothing;
insert into cargo_alias (nombre_anterior, cargo_id)
select 'Supernumerario', id from cargos_evaluacion where nombre = 'Supernumerario comercial'
on conflict (nombre_anterior) do nothing;
insert into cargo_alias (nombre_anterior, cargo_id)
select 'Logística', id from cargos_evaluacion where nombre = 'Jefe logístico'
on conflict (nombre_anterior) do nothing;
insert into cargo_alias (nombre_anterior, cargo_id)
select 'Administrativo', id from cargos_evaluacion where nombre = 'Auxiliar contable'
on conflict (nombre_anterior) do nothing;

-- RLS
alter table cargo_alias enable row level security;
create policy "allow_all_cargo_alias" on cargo_alias for all using (true) with check (true);

-- ════════════════════════════════════════════════════════════
-- GAP 2 — Columnas adicionales en ciclos_evaluacion (sección 6)
-- ════════════════════════════════════════════════════════════
alter table ciclos_evaluacion
  add column if not exists fecha_inicio_autoevaluacion date,
  add column if not exists fecha_fin_autoevaluacion    date,
  add column if not exists fecha_inicio_jefe           date,
  add column if not exists fecha_fin_jefe              date,
  add column if not exists fecha_inicio_revision       date,
  add column if not exists fecha_fin_revision          date,
  add column if not exists fecha_inicio_retro          date,
  add column if not exists fecha_fin_retro             date,
  add column if not exists dias_firma_colaborador      integer default 5,
  add column if not exists periodo_evaluado_inicio     date,
  add column if not exists periodo_evaluado_fin        date,
  add column if not exists creado_por                  text;

-- ════════════════════════════════════════════════════════════
-- GAP 3 — Columna justificacion en evaluaciones (sección 5)
-- Cuando índice < banda_no_cumple y el jefe marca Continúa
-- ════════════════════════════════════════════════════════════
alter table evaluaciones
  add column if not exists justificacion_continua text,
  add column if not exists evaluador_usuario_id   uuid references usuarios_evaluacion(id),
  add column if not exists fecha_reapertura       timestamptz,
  add column if not exists motivo_reapertura      text,
  add column if not exists pdf_url                text;

-- ════════════════════════════════════════════════════════════
-- GAP 4 — Función: generar ciclo de desempeño masivo (sección 6)
-- ════════════════════════════════════════════════════════════
create or replace function fn_generar_ciclo_desempeno(p_ciclo_id uuid)
returns jsonb language plpgsql as $$
declare
  v_ciclo         record;
  v_t             record;
  v_meses_min     integer;
  v_eval_id       uuid;
  v_eval_auto_id  uuid;
  v_incluidos     integer := 0;
  v_excluidos     jsonb   := '[]'::jsonb;
  v_motivo        text;
  v_incluir       boolean;
  v_puntaje_ex    integer;
  v_comp          record;
  v_evaluador_nom text;
  v_evaluador_uid uuid;
begin
  select * into v_ciclo from ciclos_evaluacion where id = p_ciclo_id;
  if v_ciclo.tipo <> 'DESEMPENO' then
    raise exception 'Solo se puede generar para ciclos de tipo DESEMPENO';
  end if;

  select valor::integer into v_meses_min
  from parametros_evaluacion where clave = 'meses_antiguedad_ciclo';
  v_meses_min := coalesce(v_meses_min, 6);

  -- Recorrer trabajadores activos
  for v_t in
    select t.*, ce.tiene_personal_a_cargo
    from trabajadores t
    left join cargos_evaluacion ce on ce.id = t.cargo_evaluacion_id
    where t.estado = 'activo'
  loop
    v_incluir := true;
    v_motivo  := null;

    -- Gerente General y aprendices SENA no entran
    if v_t.cargo ilike '%gerente%' or v_t.cargo ilike '%aprendiz%' or v_t.cargo ilike '%sena%' then
      v_incluir := false; v_motivo := 'Gerente General o aprendiz SENA';
    end if;

    -- Sin cargo mapeado al diccionario
    if v_t.cargo_evaluacion_id is null then
      v_incluir := false; v_motivo := 'Cargo sin mapear al diccionario de competencias';
    end if;

    -- Sin fecha de ingreso
    if v_t.fecha_ingreso is null then
      v_incluir := false; v_motivo := 'Sin fecha de ingreso registrada';
    end if;

    -- Reglas de antigüedad (solo si aún no fue excluido)
    if v_incluir and v_ciclo.fecha_corte is not null then
      declare
        v_antiguedad_meses numeric;
        v_eval_prueba record;
        v_tuvo_brechas boolean := false;
      begin
        v_antiguedad_meses := extract(year from age(v_ciclo.fecha_corte, v_t.fecha_ingreso)) * 12
                            + extract(month from age(v_ciclo.fecha_corte, v_t.fecha_ingreso));

        -- Aún en periodo de prueba
        if v_t.periodo_prueba_dias > 0 and
           v_t.fecha_ingreso + v_t.periodo_prueba_dias - 1 >= v_ciclo.fecha_corte then
          v_incluir := false; v_motivo := 'Aún en periodo de prueba';

        -- Menos de 6 meses
        elsif v_antiguedad_meses < v_meses_min then
          -- Revisar si su evaluación de prueba tuvo brechas
          select e.id, e.concepto_prueba into v_eval_prueba
          from evaluaciones e
          join ciclos_evaluacion c on c.id = e.ciclo_id
          where e.trabajador_id = v_t.id
            and c.tipo = 'PRUEBA'
            and e.estado in ('cerrada','firmada','socializada')
          order by e.created_at desc limit 1;

          if found then
            select exists (
              select 1 from evaluacion_detalle
              where evaluacion_id = v_eval_prueba.id and cumple = false
            ) into v_tuvo_brechas;
          end if;

          if not v_tuvo_brechas then
            v_incluir := false;
            v_motivo  := 'Menos de ' || v_meses_min || ' meses y periodo de prueba sin novedades';
          end if;
          -- Si tuvo brechas, sí entra (v_incluir queda true)
        end if;
      end;
    end if;

    -- Ya tiene evaluación en este ciclo
    if v_incluir and exists (
      select 1 from evaluaciones
      where trabajador_id = v_t.id and ciclo_id = p_ciclo_id
        and rol_evaluador = 'JEFE' and estado <> 'anulada'
    ) then
      v_incluir := false; v_motivo := 'Ya tiene evaluación en este ciclo';
    end if;

    if not v_incluir then
      v_excluidos := v_excluidos || jsonb_build_object(
        'nombre', v_t.nombre, 'cargo', v_t.cargo, 'motivo', v_motivo
      );
      continue;
    end if;

    -- Determinar evaluador
    if v_t.tiene_personal_a_cargo then
      select id, nombre into v_evaluador_uid, v_evaluador_nom
      from usuarios_evaluacion where rol = 'gerencia' and activo = true limit 1;
    else
      select id, nombre into v_evaluador_uid, v_evaluador_nom
      from usuarios_evaluacion where id = v_t.lider_evaluacion_id limit 1;
      if v_evaluador_nom is null then v_evaluador_nom := v_t.jefe; end if;
    end if;

    -- Crear evaluación del jefe
    insert into evaluaciones (
      ciclo_id, trabajador_id, cargo_nombre, cargo_evaluacion_id,
      evaluador_nombre, evaluador_usuario_id, rol_evaluador,
      fecha_limite, estado, version_diccionario
    ) values (
      p_ciclo_id, v_t.id, v_t.cargo, v_t.cargo_evaluacion_id,
      v_evaluador_nom, v_evaluador_uid, 'JEFE',
      v_ciclo.fecha_fin_jefe, 'pendiente', 2
    ) returning id into v_eval_id;

    -- Crear evaluación autoevaluación si el ciclo la incluye
    if v_ciclo.incluye_autoevaluacion then
      insert into evaluaciones (
        ciclo_id, trabajador_id, cargo_nombre, cargo_evaluacion_id,
        evaluador_nombre, rol_evaluador,
        fecha_limite, estado, version_diccionario
      ) values (
        p_ciclo_id, v_t.id, v_t.cargo, v_t.cargo_evaluacion_id,
        v_t.nombre, 'AUTO',
        v_ciclo.fecha_fin_autoevaluacion, 'pendiente', 2
      ) returning id into v_eval_auto_id;
    end if;

    -- Cargar competencias
    for v_comp in
      select c.id as comp_id, c.codigo, c.nombre, c.tipo, m.grado_exigido
      from matriz_cargo_competencia m
      join competencias c on c.id = m.competencia_id
      where m.cargo_id = v_t.cargo_evaluacion_id and m.version_diccionario = 2
      order by c.codigo
    loop
      v_puntaje_ex := case v_comp.grado_exigido when 'A' then 4 when 'B' then 3 when 'C' then 2 else 1 end;

      insert into evaluacion_detalle (
        evaluacion_id, competencia_id, codigo, nombre_comp,
        grado_exigido, puntaje_exigido, grupo_competencia
      ) values (
        v_eval_id, v_comp.comp_id, v_comp.codigo, v_comp.nombre,
        v_comp.grado_exigido, v_puntaje_ex, v_comp.tipo
      );

      if v_ciclo.incluye_autoevaluacion and v_eval_auto_id is not null then
        insert into evaluacion_detalle (
          evaluacion_id, competencia_id, codigo, nombre_comp,
          grado_exigido, puntaje_exigido, grupo_competencia
        ) values (
          v_eval_auto_id, v_comp.comp_id, v_comp.codigo, v_comp.nombre,
          v_comp.grado_exigido, v_puntaje_ex, v_comp.tipo
        );
      end if;
    end loop;

    insert into auditoria_evaluacion (tabla, registro_id, accion, valor_nuevo, usuario_nombre)
    values ('evaluaciones', v_eval_id, 'creacion', 'pendiente', 'sistema');

    v_incluidos := v_incluidos + 1;
  end loop;

  -- Marcar ciclo como en_curso
  update ciclos_evaluacion set estado = 'en_curso' where id = p_ciclo_id;

  return jsonb_build_object(
    'incluidos',  v_incluidos,
    'excluidos',  jsonb_array_length(v_excluidos),
    'detalle_excluidos', v_excluidos
  );
end;
$$;

-- ════════════════════════════════════════════════════════════
-- GAP 5 — Vistas para reportes (sección 8)
-- ════════════════════════════════════════════════════════════

-- Reporte: avance del ciclo
create or replace view v_avance_ciclo as
select
  ce.nombre                                   as ciclo,
  coalesce(t.nombre, oc.nombres)              as colaborador,
  coalesce(t.empresa, oc.empresa)             as empresa,
  coalesce(t.ciudad, oc.sede_nombre)          as sede,
  e.cargo_nombre,
  e.evaluador_nombre,
  e.estado,
  e.indice_ajuste,
  e.clasificacion,
  e.fecha_limite,
  e.fecha_envio,
  (e.fecha_limite < current_date and e.estado = 'pendiente') as vencida
from evaluaciones e
join ciclos_evaluacion ce on ce.id = e.ciclo_id
left join trabajadores t on t.id = e.trabajador_id
left join orden_contratacion oc on oc.id = e.colaborador_id
where e.rol_evaluador = 'JEFE';

-- Reporte: brechas por competencia y cargo
create or replace view v_brechas_por_competencia as
select
  ce.nombre                                   as ciclo,
  ev.cargo_nombre,
  ed.codigo,
  ed.nombre_comp,
  ed.grupo_competencia,
  ed.grado_exigido,
  count(*) filter (where ed.cumple = false)   as total_brechas,
  count(*) filter (where ed.cumple = true
    and not ed.es_fortaleza)                  as total_cumplen,
  count(*) filter (where ed.es_fortaleza)     as total_fortalezas,
  count(*)                                    as total_evaluados,
  round(
    count(*) filter (where ed.cumple = false)::numeric
    / nullif(count(*), 0) * 100, 1
  )                                           as pct_brecha,
  round(
    count(*) filter (where ed.cumple = false)::numeric
    / nullif(count(*), 0) * 100, 1
  ) >= (
    select valor::numeric from parametros_evaluacion
    where clave = 'umbral_capacitacion'
  )                                           as requiere_capacitacion
from evaluacion_detalle ed
join evaluaciones ev on ev.id = ed.evaluacion_id
join ciclos_evaluacion ce on ce.id = ev.ciclo_id
where ev.rol_evaluador = 'JEFE'
  and ed.grado_observado is not null
group by ce.nombre, ev.cargo_nombre, ed.codigo, ed.nombre_comp, ed.grupo_competencia, ed.grado_exigido
order by pct_brecha desc;

-- Reporte: elegibles para promoción
create or replace view v_elegibles_promocion as
select
  coalesce(t.nombre, oc.nombres)             as colaborador,
  coalesce(t.cedula, oc.numero_id)           as cedula,
  coalesce(t.cargo, e1.cargo_nombre)         as cargo,
  e1.indice_ajuste                           as indice_ultimo,
  e1.clasificacion                           as clasif_ultimo,
  e2.indice_ajuste                           as indice_penultimo,
  e2.clasificacion                           as clasif_penultimo
from evaluaciones e1
left join trabajadores t on t.id = e1.trabajador_id
left join orden_contratacion oc on oc.id = e1.colaborador_id
join evaluaciones e2
  on (e2.trabajador_id = e1.trabajador_id or e2.colaborador_id = e1.colaborador_id)
  and e2.id <> e1.id
  and e2.rol_evaluador = 'JEFE'
  and e2.estado = 'cerrada'
where e1.rol_evaluador = 'JEFE'
  and e1.estado = 'cerrada'
  and e1.clasificacion in ('cumple_perfil','oportunidades_mejora')
  and e2.clasificacion in ('cumple_perfil','oportunidades_mejora')
  and not exists (
    select 1 from planes_mejora pm
    where (pm.evaluacion_id = e1.id or pm.evaluacion_id = e2.id)
      and pm.estado = 'vencido'
  )
  -- Solo la evaluación más reciente por persona
  and e1.created_at = (
    select max(created_at) from evaluaciones
    where (trabajador_id = e1.trabajador_id or colaborador_id = e1.colaborador_id)
      and rol_evaluador = 'JEFE' and estado = 'cerrada'
  );

-- Reporte: candidatos a reconocimiento
create or replace view v_candidatos_reconocimiento as
select
  coalesce(t.nombre, oc.nombres)             as colaborador,
  coalesce(t.cedula, oc.numero_id)           as cedula,
  e.cargo_nombre,
  e.indice_ajuste,
  count(*) filter (where ed.es_fortaleza)    as fortalezas,
  string_agg(
    case when ed.es_fortaleza then ed.nombre_comp end,
    ', ' order by ed.codigo
  )                                           as nombres_fortalezas
from evaluaciones e
join evaluacion_detalle ed on ed.evaluacion_id = e.id
left join trabajadores t on t.id = e.trabajador_id
left join orden_contratacion oc on oc.id = e.colaborador_id
where e.rol_evaluador = 'JEFE'
  and e.estado = 'cerrada'
  and e.clasificacion = 'cumple_perfil'
group by e.id, t.nombre, oc.nombres, t.cedula, oc.numero_id, e.cargo_nombre, e.indice_ajuste
having count(*) filter (where ed.es_fortaleza) >= (
  select valor::integer from parametros_evaluacion
  where clave = 'min_fortalezas_reconocimiento'
);

-- Reporte: planes de mejora con seguimiento
create or replace view v_planes_seguimiento as
select
  coalesce(t.nombre, oc.nombres)             as colaborador,
  ev.cargo_nombre,
  ev.evaluador_nombre                        as lider,
  ce.nombre                                  as ciclo,
  pm.nombre_competencia,
  pm.accion,
  pm.responsable_nombre,
  pm.fecha_compromiso,
  pm.fecha_seguimiento,
  pm.estado,
  pm.resultado_seguimiento,
  (pm.fecha_seguimiento < current_date
   and pm.estado = 'pendiente')              as vencido_sin_seguimiento
from planes_mejora pm
join evaluaciones ev on ev.id = pm.evaluacion_id
join ciclos_evaluacion ce on ce.id = ev.ciclo_id
left join trabajadores t on t.id = ev.trabajador_id
left join orden_contratacion oc on oc.id = ev.colaborador_id
order by pm.fecha_seguimiento;

-- Reporte: necesidades de capacitación (brecha >= 30% del cargo)
create or replace view v_necesidades_capacitacion as
select
  ciclo,
  cargo_nombre,
  codigo,
  nombre_comp,
  grupo_competencia,
  grado_exigido,
  total_evaluados,
  total_brechas,
  pct_brecha
from v_brechas_por_competencia
where requiere_capacitacion = true
order by cargo_nombre, pct_brecha desc;

-- Informe consolidado
create or replace view v_informe_consolidado as
select
  ce.nombre                                       as ciclo,
  coalesce(t.empresa, oc.empresa)                 as empresa,
  coalesce(t.unidad_organizacional, oc.area)      as area,
  e.cargo_nombre,
  coalesce(t.ciudad, oc.sede_nombre)              as sede,
  e.evaluador_nombre                              as lider,
  count(*)                                        as total,
  count(*) filter (where e.estado = 'cerrada')    as cerradas,
  count(*) filter (where e.clasificacion = 'cumple_perfil')           as cumple_perfil,
  count(*) filter (where e.clasificacion = 'oportunidades_mejora')    as oportunidades_mejora,
  count(*) filter (where e.clasificacion = 'cumple_parcialmente')     as cumple_parcialmente,
  count(*) filter (where e.clasificacion = 'no_cumple')               as no_cumple,
  round(avg(e.indice_ajuste), 1)                  as indice_promedio,
  round(min(e.indice_ajuste), 1)                  as indice_minimo,
  round(max(e.indice_ajuste), 1)                  as indice_maximo
from evaluaciones e
join ciclos_evaluacion ce on ce.id = e.ciclo_id
left join trabajadores t on t.id = e.trabajador_id
left join orden_contratacion oc on oc.id = e.colaborador_id
where e.rol_evaluador = 'JEFE'
group by ce.nombre, coalesce(t.empresa, oc.empresa),
         coalesce(t.unidad_organizacional, oc.area),
         e.cargo_nombre, coalesce(t.ciudad, oc.sede_nombre), e.evaluador_nombre
order by empresa, area, cargo_nombre;
