-- ============================================================
-- GH PRO — Mapeo manual de cargos trabajadores → diccionario
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ── Mapeo cargo texto → cargo_evaluacion_id ──────────────────

-- "Asesor Comercial" → "Asesor(a) comercial"
update trabajadores
set cargo_evaluacion_id = (
  select id from cargos_evaluacion where nombre = 'Asesor(a) comercial'
)
where cargo = 'Asesor Comercial' and estado = 'activo';

-- "Coordinador Comercial" y "Coordinadora Comercial" → "Coordinador comercial"
update trabajadores
set cargo_evaluacion_id = (
  select id from cargos_evaluacion where nombre = 'Coordinador comercial'
)
where cargo in ('Coordinador Comercial','Coordinadora Comercial') and estado = 'activo';

-- "Auxiliar de Bodega" → "Auxiliar de bodega (cargue y descargue)"
update trabajadores
set cargo_evaluacion_id = (
  select id from cargos_evaluacion where nombre = 'Auxiliar de bodega (cargue y descargue)'
)
where cargo = 'Auxiliar de Bodega' and estado = 'activo';

-- "Auxiliar de Separación" → "Auxiliar de separación"
update trabajadores
set cargo_evaluacion_id = (
  select id from cargos_evaluacion where nombre = 'Auxiliar de separación'
)
where cargo = 'Auxiliar de Separación' and estado = 'activo';

-- "Auxiliar Logístico" → "Auxiliar logístico de entrega"
update trabajadores
set cargo_evaluacion_id = (
  select id from cargos_evaluacion where nombre = 'Auxiliar logístico de entrega'
)
where cargo = 'Auxiliar Logístico' and estado = 'activo';

-- "Mercaderista" → "Mercaderista"
update trabajadores
set cargo_evaluacion_id = (
  select id from cargos_evaluacion where nombre = 'Mercaderista'
)
where cargo = 'Mercaderista' and estado = 'activo';

-- "Supernumerario" → "Supernumerario comercial"
update trabajadores
set cargo_evaluacion_id = (
  select id from cargos_evaluacion where nombre = 'Supernumerario comercial'
)
where cargo = 'Supernumerario' and estado = 'activo';

-- "Logística" → "Jefe logístico"
-- (solo 2 personas, posiblemente sean el jefe logístico)
update trabajadores
set cargo_evaluacion_id = (
  select id from cargos_evaluacion where nombre = 'Jefe logístico'
)
where cargo = 'Logística' and estado = 'activo';

-- "Administrativo" → NULL por ahora
-- Son 25 personas con cargos distintos dentro de lo administrativo.
-- Necesita revisión manual cargo por cargo.
-- Ver sección al final.

-- "Externo" y "Servicios Generales" → no están en el diccionario, se dejan sin mapear.

-- ── Mapeo jefe texto → lider_evaluacion_id ───────────────────
update trabajadores t
set lider_evaluacion_id = u.id
from usuarios_evaluacion u
where lower(trim(t.jefe)) = lower(trim(u.nombre))
  and t.lider_evaluacion_id is null
  and t.estado = 'activo';

-- ── Verificar resultado ───────────────────────────────────────
select
  t.cargo,
  ce.nombre                             as cargo_diccionario,
  count(*)                              as personas,
  sum(case when t.lider_evaluacion_id is not null then 1 else 0 end) as con_lider
from trabajadores t
left join cargos_evaluacion ce on ce.id = t.cargo_evaluacion_id
where t.estado = 'activo'
group by t.cargo, ce.nombre
order by t.cargo;
