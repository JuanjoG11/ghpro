-- ============================================================
-- GH PRO — Poblar usuarios_evaluacion desde jefes_inmediatos
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Agregar columnas nuevas a la tabla (ya creada sin ellas)
alter table usuarios_evaluacion
  add column if not exists cedula            text unique,
  add column if not exists pin               text,
  add column if not exists jefe_inmediato_id uuid references jefes_inmediatos(id);

-- 2. Insertar desde jefes_inmediatos asignando el rol correcto
insert into usuarios_evaluacion (nombre, cargo, rol, cedula, pin, jefe_inmediato_id)
select
  j.nombre,
  j.cargo,
  case
    when j.cargo ilike '%gerente%'   then 'gerencia'
    when j.cargo ilike '%GGHH%'
      or j.cargo ilike '%contador%'  then 'gh'
    else                                  'lider'
  end as rol,
  j.cedula,
  j.pin,
  j.id
from jefes_inmediatos j
where j.activo = true
  and (
    j.cargo ilike '%Coordinador%'
    or j.cargo ilike '%Supervisor%'
    or j.cargo ilike '%Jefe%'
    or j.cargo ilike '%Gerente%'
    or j.cargo ilike '%Contador%'
    or j.cargo ilike '%GGHH%'
  )
on conflict (cedula) do update
  set nombre            = excluded.nombre,
      cargo             = excluded.cargo,
      rol               = excluded.rol,
      pin               = excluded.pin,
      jefe_inmediato_id = excluded.jefe_inmediato_id;

-- 3. Verificar resultado
select nombre, cargo, rol, cedula from usuarios_evaluacion order by rol, nombre;
