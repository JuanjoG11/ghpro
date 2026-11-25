-- ============================================================
-- GH PRO — Medición v2: parámetros completos + cálculo corregido
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Nuevos parámetros ──────────────────────────────────────
insert into parametros_evaluacion (clave, valor, descripcion) values
  ('modo_ponderacion',              'POR_PUNTOS', 'POR_PUNTOS o POR_GRUPO'),
  ('peso_transversales',            '30',         'Peso del grupo Transversal (suma con otros debe ser 100)'),
  ('peso_liderazgo',                '20',         'Peso del grupo Liderazgo'),
  ('peso_funcionales',              '25',         'Peso del grupo Funcional'),
  ('peso_tecnicas',                 '25',         'Peso de grupos Técnica comercial y Técnica logística'),
  ('banda_cumple_perfil',           '100',        'Límite inferior banda Cumple el perfil (exactamente 100)'),
  ('banda_oportunidades',           '85',         'Límite inferior banda Cumple con oportunidades de mejora'),
  ('banda_parcial',                 '70',         'Límite inferior banda Cumple parcialmente'),
  ('umbral_diferencia_auto',        '2',          'Grados de diferencia jefe-auto que marcan revisión'),
  ('umbral_capacitacion',           '30',         'Porcentaje mínimo de brechas por cargo para plan de capacitación'),
  ('min_fortalezas_reconocimiento', '2',          'Fortalezas mínimas para candidato a reconocimiento'),
  ('decimales_indice',              '1',          'Decimales para mostrar el índice (truncado, no redondeado)')
on conflict (clave) do update set valor = excluded.valor, descripcion = excluded.descripcion;

-- Actualizar los que ya existían con nombres nuevos consistentes
insert into parametros_evaluacion (clave, valor, descripcion) values
  ('escala_A', '4', 'Puntos del grado A'),
  ('escala_B', '3', 'Puntos del grado B'),
  ('escala_C', '2', 'Puntos del grado C'),
  ('escala_D', '1', 'Puntos del grado D')
on conflict (clave) do nothing;

-- ── 2. Columna grupo en evaluacion_detalle ────────────────────
-- Guarda el grupo de la competencia al crear el detalle
-- para no recalcularlo en cada consulta
alter table evaluacion_detalle
  add column if not exists grupo_competencia text,
  add column if not exists cumplimiento_pct  numeric(6,4),
  add column if not exists puntos_validos    integer;

-- Poblar grupo en detalles existentes
update evaluacion_detalle ed
set grupo_competencia = c.tipo
from competencias c
where c.id = ed.competencia_id
  and ed.grupo_competencia is null;

-- ── 3. Función de cálculo completa ───────────────────────────
create or replace function fn_calcular_indice(p_evaluacion_id uuid)
returns void language plpgsql as $$
declare
  -- parámetros
  v_modo        text;
  v_pts         jsonb;
  v_bandas      jsonb;
  v_decimales   integer;
  -- cálculo
  v_rol         text;
  v_det         record;
  v_obs         integer;
  v_req         integer;
  v_validos     integer;
  v_cumpl       numeric;
  -- modo A
  v_sum_validos numeric := 0;
  v_sum_req     numeric := 0;
  -- modo B por grupo
  v_grupos      jsonb   := '{}'::jsonb;
  v_pesos       jsonb;
  v_grupo_key   text;
  v_g_validos   numeric;
  v_g_req       numeric;
  v_g_cumpl     numeric;
  v_peso_total  numeric := 0;
  v_indice_b    numeric := 0;
  v_peso_g      numeric;
  -- resultado
  v_indice      numeric;
  v_indice_show numeric;
  v_clasif      text;
  -- bandas
  v_b_perfil    numeric;
  v_b_opor      numeric;
  v_b_parcial   numeric;
begin
  -- Solo procesa evaluaciones del jefe
  select rol_evaluador into v_rol from evaluaciones where id = p_evaluacion_id;
  if v_rol <> 'JEFE' then return; end if;

  -- Leer parámetros
  select valor into v_modo      from parametros_evaluacion where clave = 'modo_ponderacion';
  select valor into v_decimales from parametros_evaluacion where clave = 'decimales_indice';
  v_modo      := coalesce(v_modo, 'POR_PUNTOS');
  v_decimales := coalesce(v_decimales::integer, 1);

  -- Escala de puntos desde parámetros
  v_pts := jsonb_build_object(
    'A', (select valor::integer from parametros_evaluacion where clave = 'escala_A'),
    'B', (select valor::integer from parametros_evaluacion where clave = 'escala_B'),
    'C', (select valor::integer from parametros_evaluacion where clave = 'escala_C'),
    'D', (select valor::integer from parametros_evaluacion where clave = 'escala_D')
  );

  -- Pesos por grupo
  v_pesos := jsonb_build_object(
    'Transversal',        (select valor::numeric from parametros_evaluacion where clave = 'peso_transversales'),
    'Liderazgo',          (select valor::numeric from parametros_evaluacion where clave = 'peso_liderazgo'),
    'Funcional',          (select valor::numeric from parametros_evaluacion where clave = 'peso_funcionales'),
    'Técnica comercial',  (select valor::numeric from parametros_evaluacion where clave = 'peso_tecnicas') / 2,
    'Técnica logística',  (select valor::numeric from parametros_evaluacion where clave = 'peso_tecnicas') / 2
  );

  -- Bandas
  v_b_perfil  := (select valor::numeric from parametros_evaluacion where clave = 'banda_cumple_perfil');
  v_b_opor    := (select valor::numeric from parametros_evaluacion where clave = 'banda_oportunidades');
  v_b_parcial := (select valor::numeric from parametros_evaluacion where clave = 'banda_parcial');

  -- ── Recorrer competencias ─────────────────────────────────
  for v_det in
    select ed.id, ed.grado_observado, ed.grado_exigido,
           coalesce(ed.grupo_competencia, c.tipo) as grupo
    from evaluacion_detalle ed
    left join competencias c on c.id = ed.competencia_id
    where ed.evaluacion_id = p_evaluacion_id
      and ed.grado_observado is not null
  loop
    v_obs     := (v_pts ->> v_det.grado_observado)::integer;
    v_req     := (v_pts ->> v_det.grado_exigido)::integer;
    v_validos := least(v_obs, v_req);
    v_cumpl   := v_validos::numeric / v_req * 100;

    -- Actualizar detalle
    update evaluacion_detalle set
      puntos_validos    = v_validos,
      puntaje_observado = v_obs,
      cumplimiento_pct  = v_cumpl,
      cumple            = (v_obs >= v_req),
      brecha_grados     = case when v_obs < v_req then v_req - v_obs else 0 end,
      es_fortaleza      = (v_obs > v_req)
    where id = v_det.id;

    -- Acumulados modo A
    v_sum_validos := v_sum_validos + v_validos;
    v_sum_req     := v_sum_req     + v_req;

    -- Acumulados modo B por grupo
    v_grupo_key := v_det.grupo;
    if v_grupos ? v_grupo_key then
      v_grupos := jsonb_set(v_grupos, array[v_grupo_key, 'validos'],
        to_jsonb((v_grupos -> v_grupo_key ->> 'validos')::numeric + v_validos));
      v_grupos := jsonb_set(v_grupos, array[v_grupo_key, 'req'],
        to_jsonb((v_grupos -> v_grupo_key ->> 'req')::numeric + v_req));
    else
      v_grupos := v_grupos || jsonb_build_object(
        v_grupo_key, jsonb_build_object('validos', v_validos, 'req', v_req)
      );
    end if;
  end loop;

  if v_sum_req = 0 then return; end if;

  -- ── Calcular índice ───────────────────────────────────────
  if v_modo = 'POR_GRUPO' then
    -- Sumar pesos de los grupos presentes
    for v_grupo_key in select jsonb_object_keys(v_grupos)
    loop
      v_peso_total := v_peso_total + coalesce((v_pesos ->> v_grupo_key)::numeric, 0);
    end loop;

    if v_peso_total = 0 then
      -- Fallback a modo A si no hay pesos configurados
      v_indice := v_sum_validos / v_sum_req * 100;
    else
      for v_grupo_key in select jsonb_object_keys(v_grupos)
      loop
        v_g_validos := (v_grupos -> v_grupo_key ->> 'validos')::numeric;
        v_g_req     := (v_grupos -> v_grupo_key ->> 'req')::numeric;
        v_g_cumpl   := v_g_validos / v_g_req * 100;
        v_peso_g    := coalesce((v_pesos ->> v_grupo_key)::numeric, 0);
        v_indice_b  := v_indice_b + (v_peso_g / v_peso_total * v_g_cumpl);
      end loop;
      v_indice := v_indice_b;
    end if;
  else
    -- Modo A: por puntos (default)
    v_indice := v_sum_validos / v_sum_req * 100;
  end if;

  -- Truncar (no redondear) a los decimales configurados
  v_indice_show := trunc(v_indice, v_decimales);

  -- ── Clasificación (con valor sin truncar) ─────────────────
  v_clasif := case
    when v_indice >= v_b_perfil  then 'cumple_perfil'
    when v_indice >= v_b_opor    then 'oportunidades_mejora'
    when v_indice >= v_b_parcial then 'cumple_parcialmente'
    else                              'no_cumple'
  end;

  -- ── Guardar ───────────────────────────────────────────────
  update evaluaciones set
    indice_ajuste    = v_indice_show,
    puntaje_promedio = round(v_sum_validos::numeric / (
      select count(*) from evaluacion_detalle
      where evaluacion_id = p_evaluacion_id and grado_observado is not null
    ), 2),
    clasificacion    = v_clasif,
    updated_at       = now()
  where id = p_evaluacion_id;
end;
$$;

-- ── 4. Verificar con el caso de prueba del documento ─────────
-- Caso 1: Asesor comercial, todo igual al exigido → debe dar 100 %
-- Caso 4: TRA-02 exigido A observado C → debe dar 94,5 %
-- (Ejecutar manualmente con una evaluación real para validar)

-- Vista útil: resultado por evaluación con detalle de grupos
create or replace view v_resultado_evaluacion as
select
  e.id                                        as evaluacion_id,
  coalesce(t.nombre, e.cargo_nombre)          as colaborador,
  e.cargo_nombre,
  e.evaluador_nombre,
  e.indice_ajuste,
  e.clasificacion,
  count(ed.id)                                as total_competencias,
  sum(case when ed.cumple = true  and not coalesce(ed.es_fortaleza,false) then 1 else 0 end) as cumplen,
  sum(case when ed.cumple = false then 1 else 0 end)                         as brechas,
  sum(case when coalesce(ed.es_fortaleza,false) then 1 else 0 end)           as fortalezas
from evaluaciones e
left join evaluacion_detalle   ed on ed.evaluacion_id = e.id
left join trabajadores          t on t.id = e.trabajador_id
where e.rol_evaluador = 'JEFE'
group by e.id, e.cargo_nombre, e.evaluador_nombre,
         e.indice_ajuste, e.clasificacion, t.nombre;
