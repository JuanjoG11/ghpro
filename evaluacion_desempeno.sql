  -- ============================================================
-- GH PRO — Módulo de Evaluación de Desempeño
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Empresa: TYM / TAT  ·  Versión 1  ·  Nov 2026
-- ============================================================

-- ── EXTENSIONES ──────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ════════════════════════════════════════════════════════════
-- CATÁLOGOS
-- ════════════════════════════════════════════════════════════

-- Versiones del diccionario
create table if not exists versiones_diccionario (
  id          uuid primary key default gen_random_uuid(),
  numero      integer not null,
  descripcion text,
  fecha_carga timestamptz default now(),
  usuario     text,
  activo      boolean default true
);

-- Competencias
create table if not exists competencias (
  id                   uuid primary key default gen_random_uuid(),
  codigo               text not null,                       -- TRA-01, LID-01, etc.
  nombre               text not null,
  tipo                 text not null check (tipo in ('Transversal','Liderazgo','Funcional','Técnica comercial','Técnica logística')),
  definicion           text,
  activo               boolean default true,
  version_diccionario  integer not null default 2,
  created_at           timestamptz default now(),
  unique(codigo, version_diccionario)
);

-- Grados por competencia (4 filas por competencia: A, B, C, D)
create table if not exists competencia_grados (
  id              uuid primary key default gen_random_uuid(),
  competencia_id  uuid references competencias(id) on delete cascade,
  grado           text not null check (grado in ('A','B','C','D')),
  puntaje         integer not null check (puntaje in (1,2,3,4)),
  conducta        text not null,
  unique(competencia_id, grado)
);

-- Cargos para evaluación (complementa cargos_maestros con campos del diccionario)
create table if not exists cargos_evaluacion (
  id                     uuid primary key default gen_random_uuid(),
  nombre                 text not null unique,
  area                   text not null,
  nivel                  text,                              -- Liderazgo / Profesional-Analista / Auxiliar-Operativo
  tiene_personal_a_cargo boolean default false,
  empresa                text default 'Ambas' check (empresa in ('TYM','TAT','Ambas')),
  activo                 boolean default true,
  created_at             timestamptz default now()
);

-- Matriz cargo × competencia
create table if not exists matriz_cargo_competencia (
  id                  uuid primary key default gen_random_uuid(),
  cargo_id            uuid references cargos_evaluacion(id) on delete cascade,
  competencia_id      uuid references competencias(id) on delete cascade,
  grado_exigido       text not null check (grado_exigido in ('A','B','C')),
  version_diccionario integer not null default 2,
  unique(cargo_id, competencia_id, version_diccionario)
);

-- Parámetros del módulo
create table if not exists parametros_evaluacion (
  clave      text primary key,
  valor      text not null,
  descripcion text
);

insert into parametros_evaluacion (clave, valor, descripcion) values
  ('dias_apertura_prueba',       '20',    'Días calendario antes del vencimiento para abrir evaluación de periodo de prueba'),
  ('dias_limite_lider_prueba',   '10',    'Días calendario antes del vencimiento como fecha límite del líder'),
  ('dias_recordatorio_prueba',   '2',     'Cada cuántos días se envía recordatorio al líder'),
  ('dias_firma_colaborador',     '5',     'Días hábiles para que el colaborador firme después de socializada'),
  ('rango_cumple_perfil',        '100',   'Índice mínimo para Cumple el perfil (exactamente 100%)'),
  ('rango_oportunidades_min',    '85',    'Índice mínimo para Cumple con oportunidades de mejora'),
  ('rango_parcial_min',          '70',    'Índice mínimo para Cumple parcialmente'),
  ('meses_antiguedad_ciclo',     '6',     'Meses de antigüedad mínimos para entrar a ciclo de desempeño'),
  ('dias_seguimiento_no_cumple', '30',    'Días para seguimiento cuando clasificación es No cumple'),
  ('dias_seguimiento_parcial',   '90',    'Días para seguimiento cuando clasificación es Cumple parcialmente'),
  ('evidencia_min_chars',        '30',    'Caracteres mínimos en campo de evidencia'),
  ('obs_no_continua_min_chars',  '100',   'Caracteres mínimos en observaciones cuando concepto es No continúa'),
  ('brecha_capacitacion_pct',    '30',    'Porcentaje mínimo de personas con brecha en un cargo para incluirla en plan de capacitación')
on conflict (clave) do nothing;

-- ════════════════════════════════════════════════════════════
-- CARGA INICIAL — Diccionario v2
-- ════════════════════════════════════════════════════════════

-- Versión del diccionario
insert into versiones_diccionario (numero, descripcion, usuario)
values (2, 'Diccionario de Competencias TYM/TAT v2 — carga inicial', 'sistema')
on conflict do nothing;

-- Competencias
insert into competencias (codigo, nombre, tipo, definicion, version_diccionario) values
('TRA-01','Sentido de pertenencia y compromiso organizacional','Transversal','Identificación del colaborador con la organización: conoce sus valores, políticas y procesos, y actúa de acuerdo con ellos y con las buenas prácticas profesionales, cuidando los recursos de la empresa como propios.',2),
('TRA-02','Orientación al cliente y actitud de servicio','Transversal','Disposición para actuar según las necesidades y expectativas de los clientes internos y externos (tenderos, proveedores, compañeros y otras áreas), resolviendo sus requerimientos con amabilidad, diligencia y respeto.',2),
('TRA-03','Orientación a resultados','Transversal','Capacidad para enfocar su trabajo en alcanzar o superar las metas y objetivos del cargo, administrando su tiempo, recursos y procesos para que no interfieran con los resultados esperados.',2),
('TRA-04','Trabajo en equipo','Transversal','Capacidad para colaborar con otros y formar parte de un grupo con intereses comunes, estableciendo relaciones de cooperación y preocupándose no solo por las responsabilidades propias sino por las del resto del equipo.',2),
('TRA-05','Responsabilidad y cumplimiento','Transversal','Cumplir horarios, funciones, procedimientos y normas internas (Reglamento Interno de Trabajo), respondiendo por los resultados de su trabajo.',2),
('TRA-06','Autocuidado y seguridad','Transversal','Aplicar las normas de Seguridad y Salud en el Trabajo y de Buenas Prácticas de Manufactura/manipulación, cuidando su integridad, la de los demás y la de los productos.',2),
('LID-01','Liderazgo','Liderazgo','Capacidad para orientar, dirigir, motivar y supervisar a un equipo, planteando objetivos que articulen el trabajo de todos hacia las metas propuestas, generando confianza y desarrollando a las personas.',2),
('LID-02','Toma de decisiones','Liderazgo','Capacidad para analizar situaciones, evaluar alternativas y decidir de forma oportuna, incluso cuando hay controversia o indecisión, asumiendo las consecuencias.',2),
('LID-03','Planificación, supervisión y control','Liderazgo','Capacidad para establecer objetivos, prioridades, recursos y plazos del área, y para verificar su cumplimiento mediante seguimiento continuo y control del trabajo, la información y las funciones de las personas a cargo.',2),
('FUN-01','Comunicación asertiva','Funcional','Capacidad para expresar de manera clara, honesta y directa lo que piensa o necesita, respetando sus derechos y los de los demás, y saber cuándo y a quién preguntar para lograr un propósito.',2),
('FUN-02','Efectividad bajo presión','Funcional','Capacidad para mantener un desempeño satisfactorio, la motivación y el control emocional en situaciones de alta exigencia, cambio o límite de tiempo, adaptándose y priorizando sin bajar la calidad.',2),
('FUN-03','Confidencialidad','Funcional','Capacidad para manejar con prudencia y reserva la información de la empresa, los clientes y los colaboradores, revelando solo lo necesario y cumpliendo la política de tratamiento de datos personales (Ley 1581 de 2012).',2),
('FUN-04','Atención al detalle','Funcional','Capacidad para realizar las tareas de forma minuciosa y completa, revisando la información que suministra para que el resultado refleje calidad, sin importar su grado de prioridad.',2),
('FUN-05','Iniciativa e innovación','Funcional','Capacidad para actuar de forma proactiva, anticiparse a los hechos y proponer soluciones nuevas a los problemas del cargo, de la organización o del cliente, sin necesidad de que se lo pidan.',2),
('FUN-06','Credibilidad técnica','Funcional','Capacidad para demostrar conocimiento y experticia en los temas técnicos de su cargo, incluido el manejo de los sistemas y herramientas de la empresa (SYT, SIDIS, AMOVIL, software de nómina, Excel, GH PRO, entre otros).',2),
('FUN-07','Integridad y objetividad','Funcional','Capacidad para actuar de manera honesta, coherente y objetiva con lo que dice y con las políticas de la empresa, especialmente en el manejo de dinero, mercancía, información y negociaciones.',2),
('FUN-08','Análisis de información','Funcional','Interpretar datos e indicadores para identificar causas y tendencias y proponer acciones.',2),
('FUN-09','Relaciones públicas','Funcional','Habilidad para establecer y mantener relaciones con proveedores, clientes, entidades y demás actores externos que puedan beneficiar o afectar a la organización, representándola adecuadamente.',2),
('COM-01','Negociación','Técnica comercial','Capacidad para dirigir una negociación con enfoque gana-gana, preparándola y planteando estrategias para llegar a acuerdos que fortalezcan la relación con el cliente sin descuidar los intereses de la empresa.',2),
('COM-02','Ejecución en el punto de venta','Técnica comercial','Garantizar la exhibición, rotación, frescura y visibilidad de los productos según los estándares de cada proveedor.',2),
('LOG-01','Precisión en el manejo de mercancía','Técnica logística','Recibir, separar, despachar, entregar o registrar la mercancía sin errores de referencia, cantidad ni estado.',2),
('LOG-02','Orden y organización del área de trabajo','Técnica logística','Mantener el área, la mercancía y los equipos ordenados, limpios e identificados.',2),
('LOG-03','Cumplimiento de tiempos de la operación','Técnica logística','Ejecutar las tareas dentro de los horarios de recibo, separación, cargue, despacho y entrega definidos.',2)
on conflict (codigo, version_diccionario) do nothing;

-- Grados por competencia (INSERT directo por competencia)
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Conoce a fondo los procesos y políticas de la empresa, los promueve entre sus compañeros, cuida los recursos como propios y propone mejoras que aportan a la organización.'
from competencias where codigo='TRA-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Conoce y respeta las políticas y valores de la empresa, desarrolla su trabajo de acuerdo con ellos y cuida los recursos a su cargo.'
from competencias where codigo='TRA-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Conoce las políticas básicas pero necesita recordatorios para aplicarlas; su disposición y el cuidado de los recursos son variables.'
from competencias where codigo='TRA-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Desconoce o incumple las políticas de la empresa, muestra apatía o hace mal uso de los recursos.'
from competencias where codigo='TRA-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Anticipa las necesidades del cliente, resuelve situaciones complejas, propone mejoras al servicio y es referente de buen trato para el equipo.'
from competencias where codigo='TRA-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Es amable y respetuoso, responde oportunamente a preguntas, quejas o problemas, y hace seguimiento hasta resolverlos.'
from competencias where codigo='TRA-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Atiende cuando se le solicita, pero necesita apoyo para resolver o para hacer seguimiento; su trato es correcto pero distante.'
from competencias where codigo='TRA-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Muestra desinterés o trato inadecuado, deja requerimientos sin respuesta o genera quejas recurrentes.'
from competencias where codigo='TRA-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Supera de forma consistente sus metas, mide sus resultados con indicadores y emprende acciones adicionales para mejorarlos.'
from competencias where codigo='TRA-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Cumple sus metas y objetivos en los tiempos establecidos, controla el tiempo de sus actividades y entrega un trabajo de calidad.'
from competencias where codigo='TRA-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Cumple de forma parcial o irregular; necesita acompañamiento para alcanzar sus metas.'
from competencias where codigo='TRA-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Incumple sus metas de forma reiterada sin tomar acciones de mejora.'
from competencias where codigo='TRA-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Integra al equipo, comparte su conocimiento, maneja los desacuerdos de forma constructiva y se esfuerza para que sus compañeros también logren sus objetivos.'
from competencias where codigo='TRA-04' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Colabora con compañeros y otras áreas, escucha sus opiniones, comparte sus ideas y la información necesaria.'
from competencias where codigo='TRA-04' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Colabora solo cuando se le pide o con personas cercanas; comparte la información de forma incompleta.'
from competencias where codigo='TRA-04' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Trabaja aislado, genera conflictos o no comparte información que el equipo necesita.'
from competencias where codigo='TRA-04' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Cumple siempre horarios y procedimientos, entrega antes de lo previsto y reconoce y corrige sus errores sin que se lo pidan.'
from competencias where codigo='TRA-05' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Cumple horarios, procedimientos y tareas en los tiempos establecidos; corrige sus errores cuando se los señalan.'
from competencias where codigo='TRA-05' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Presenta incumplimientos ocasionales de horario, tiempos o procedimientos; necesita supervisión frecuente.'
from competencias where codigo='TRA-05' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Incumple de forma reiterada horarios, tareas o normas; tiene llamados de atención o procesos disciplinarios en el periodo.'
from competencias where codigo='TRA-05' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Aplica las normas siempre, reporta actos y condiciones inseguras y promueve el autocuidado entre sus compañeros.'
from competencias where codigo='TRA-06' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Usa los elementos de protección, sigue los procedimientos seguros y participa en las actividades de SST.'
from competencias where codigo='TRA-06' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Cumple las normas cuando lo supervisan; en ocasiones olvida los EPP o los procedimientos.'
from competencias where codigo='TRA-06' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Omite las normas de seguridad o BPM y pone en riesgo su integridad, la de otros o la del producto.'
from competencias where codigo='TRA-06' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Forma equipos autónomos y motivados, delega con criterio, es receptivo a las ideas del equipo, retroalimenta de forma oportuna y prepara reemplazos.'
from competencias where codigo='LID-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Coordina las actividades y delega funciones con claridad, motiva al equipo para cumplir los plazos y retroalimenta su desempeño.'
from competencias where codigo='LID-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Asigna tareas pero retroalimenta poco o solo cuando hay problemas; el equipo depende de su presencia para avanzar.'
from competencias where codigo='LID-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'No orienta al equipo, trata de forma inadecuada a las personas o tolera los incumplimientos.'
from competencias where codigo='LID-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Decide con rapidez y criterio incluso en situaciones críticas, anticipa riesgos y comunica las razones de sus decisiones.'
from competencias where codigo='LID-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Toma decisiones oportunas dentro de su alcance con base en información y escala lo que corresponde.'
from competencias where codigo='LID-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Aplaza decisiones o las consulta todas; necesita aprobación en situaciones que están dentro de su alcance.'
from competencias where codigo='LID-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Evita decidir o decide sin análisis, generando reprocesos o pérdidas.'
from competencias where codigo='LID-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Planea con anticipación, usa indicadores y mecanismos de control, detecta desviaciones y las corrige antes de que afecten el resultado.'
from competencias where codigo='LID-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Organiza las actividades, recursos y prioridades del área, hace seguimiento periódico al trabajo del equipo y corrige oportunamente los inconvenientes.'
from competencias where codigo='LID-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Planea a corto plazo; el seguimiento es irregular y reacciona cuando el problema ya ocurrió.'
from competencias where codigo='LID-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Trabaja sin planeación ni control; el área incumple de forma repetida.'
from competencias where codigo='LID-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Transmite mensajes claros a distintos públicos, interviene oportunamente exponiendo su criterio, escucha y logra acuerdos aun en conversaciones difíciles.'
from competencias where codigo='FUN-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Expresa sus ideas con claridad a jefes y compañeros, interviene en reuniones respetando el criterio de los demás.'
from competencias where codigo='FUN-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Comunica de forma incompleta o tardía; le cuesta expresar su opinión o sus mensajes necesitan aclaración.'
from competencias where codigo='FUN-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Comunica de forma confusa, agresiva o irrespetuosa, o no informa lo que los demás necesitan.'
from competencias where codigo='FUN-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Mantiene la calma y el ritmo en situaciones críticas, prioriza con facilidad, se adapta rápido a los cambios y apoya a otros a manejar la presión.'
from competencias where codigo='FUN-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Controla sus emociones y cumple con calidad en momentos de alta exigencia; recibe las sugerencias de sus jefes sin que afecte su ánimo.'
from competencias where codigo='FUN-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Bajo presión baja su desempeño o se le dificulta priorizar; necesita apoyo para reorganizarse.'
from competencias where codigo='FUN-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Pierde el control o abandona tareas en situaciones de exigencia; reacciona mal a las observaciones.'
from competencias where codigo='FUN-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Protege la información de forma ejemplar, transmite solo lo necesario y promueve buenas prácticas de reserva en su área.'
from competencias where codigo='FUN-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Cuida su discurso, archiva y protege la información y la usa solo para su labor.'
from competencias where codigo='FUN-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Organiza la información de forma irregular; a veces descuida la reserva.'
from competencias where codigo='FUN-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Divulga información reservada o la pierde.'
from competencias where codigo='FUN-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Entrega su trabajo sin errores, revisa todo antes de entregarlo y detecta errores de otros.'
from competencias where codigo='FUN-04' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Realiza sus tareas de forma completa y revisa la información que entrega; los errores son mínimos y los corrige de inmediato.'
from competencias where codigo='FUN-04' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Presenta errores repetitivos que otros deben revisar y corregir.'
from competencias where codigo='FUN-04' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Comete errores frecuentes con impacto económico, legal o en la operación.'
from competencias where codigo='FUN-04' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Se anticipa a los problemas, propone e implementa soluciones nuevas y planes de mejora que benefician a la empresa.'
from competencias where codigo='FUN-05' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Propone mejoras para su proceso y actúa con criterio propio ante situaciones de su cargo.'
from competencias where codigo='FUN-05' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Actúa solo cuando se le indica; sus propuestas son ocasionales.'
from competencias where codigo='FUN-05' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Espera instrucciones para todo y no aporta soluciones.'
from competencias where codigo='FUN-05' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Su trabajo es modelo de experticia, domina las herramientas, aprovecha funciones avanzadas y capacita a otros.'
from competencias where codigo='FUN-06' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Realiza sus tareas técnicas con habilidad y usa las herramientas de su cargo con autonomía.'
from competencias where codigo='FUN-06' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Maneja lo básico del cargo y de las herramientas; necesita apoyo frecuente.'
from competencias where codigo='FUN-06' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'No domina los conocimientos ni las herramientas que requiere su cargo.'
from competencias where codigo='FUN-06' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Actúa con total transparencia, sus acciones son coherentes con lo que dice y reporta irregularidades aunque no lo afecten directamente.'
from competencias where codigo='FUN-07' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Es abierto y honesto en su trabajo y actúa de forma coherente con sus funciones y las políticas de la empresa.'
from competencias where codigo='FUN-07' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Presenta inconsistencias menores entre lo que dice y lo que hace, o es poco transparente al reportar novedades.'
from competencias where codigo='FUN-07' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Oculta información, presenta faltantes injustificados o actúa en contra de las políticas.'
from competencias where codigo='FUN-07' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Integra varias fuentes, identifica causas de fondo y propone acciones que se implementan.'
from competencias where codigo='FUN-08' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Interpreta los datos de su área, identifica desviaciones y propone acciones.'
from competencias where codigo='FUN-08' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Presenta datos sin interpretarlos o con conclusiones superficiales.'
from competencias where codigo='FUN-08' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'No analiza la información o llega a conclusiones erradas.'
from competencias where codigo='FUN-08' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Construye relaciones de confianza con proveedores y aliados, da a conocer la empresa y logra beneficios para ella.'
from competencias where codigo='FUN-09' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Se relaciona con facilidad y con lenguaje adecuado con proveedores y clientes, y representa bien a la empresa.'
from competencias where codigo='FUN-09' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Mantiene relaciones formales pero limitadas; le cuesta gestionar contactos clave.'
from competencias where codigo='FUN-09' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Su relación con actores externos genera conflictos o afecta la imagen de la empresa.'
from competencias where codigo='FUN-09' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Prepara cada negociación, cierra acuerdos complejos, amplía el portafolio en el cliente y convierte las objeciones en ventas.'
from competencias where codigo='COM-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Presenta el portafolio con argumentos, responde las objeciones comunes y llega a acuerdos satisfactorios en la mayoría de sus negociaciones.'
from competencias where codigo='COM-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Toma pedidos pero argumenta poco; ante una objeción desiste o cede sin criterio.'
from competencias where codigo='COM-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'No presenta el portafolio ni maneja objeciones, o da descuentos o condiciones no autorizadas.'
from competencias where codigo='COM-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Ejecuta los estándares del proveedor sin fallas, gana espacios adicionales y controla vencimientos y rotación.'
from competencias where codigo='COM-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Cumple los estándares de exhibición, rotación y precios en los puntos asignados.'
from competencias where codigo='COM-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Cumple parcialmente los estándares; se encuentran faltantes, desorden o producto próximo a vencer.'
from competencias where codigo='COM-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Descuida la exhibición y la rotación; se presentan quejas del cliente o del proveedor.'
from competencias where codigo='COM-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Trabaja sin errores ni novedades, y detecta y reporta a tiempo las inconsistencias de otros.'
from competencias where codigo='LOG-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Sus errores son mínimos y los reporta y corrige de inmediato.'
from competencias where codigo='LOG-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Presenta errores recurrentes de cantidad o referencia que generan reprocesos.'
from competencias where codigo='LOG-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Genera faltantes, sobrantes o daños frecuentes, o no reporta las novedades.'
from competencias where codigo='LOG-01' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Mantiene su área ejemplar y propone mejoras en la ubicación y el flujo de la mercancía.'
from competencias where codigo='LOG-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Mantiene el área ordenada, limpia e identificada y devuelve los equipos a su lugar.'
from competencias where codigo='LOG-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Ordena solo cuando se le recuerda.'
from competencias where codigo='LOG-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Deja el área desordenada, mezcla productos o pierde elementos y equipos.'
from competencias where codigo='LOG-02' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'A', 4, 'Cumple siempre los tiempos y apoya a otros para que la operación salga a tiempo.'
from competencias where codigo='LOG-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'B', 3, 'Cumple los tiempos establecidos para su labor.'
from competencias where codigo='LOG-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'C', 2, 'Presenta retrasos ocasionales que afectan la salida o la entrega.'
from competencias where codigo='LOG-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;
insert into competencia_grados (competencia_id, grado, puntaje, conducta)
select id, 'D', 1, 'Retrasa la operación con frecuencia.'
from competencias where codigo='LOG-03' and version_diccionario=2
on conflict (competencia_id, grado) do nothing;

-- Cargos evaluación
insert into cargos_evaluacion (nombre, area, nivel, tiene_personal_a_cargo, empresa) values
('Coordinador de GGHH/SST',                   'Dirección y administrativo', 'Liderazgo',              true,  'Ambas'),
('Analista de Gestión Humana',                 'Dirección y administrativo', 'Profesional / Analista', false, 'Ambas'),
('Auxiliar de SST',                            'Dirección y administrativo', 'Auxiliar / Operativo',   false, 'Ambas'),
('Auxiliar contable',                          'Dirección y administrativo', 'Auxiliar / Operativo',   false, 'Ambas'),
('Auxiliar de cartera',                        'Dirección y administrativo', 'Profesional / Analista', false, 'Ambas'),
('Cajero(a) / Auxiliar de caja',               'Dirección y administrativo', 'Auxiliar / Operativo',   false, 'Ambas'),
('Auxiliar de facturación',                    'Dirección y administrativo', 'Auxiliar / Operativo',   false, 'Ambas'),
('Analista de inventarios',                    'Dirección y administrativo', 'Profesional / Analista', false, 'Ambas'),
('Analista de desarrollo',                     'Dirección y administrativo', 'Profesional / Analista', false, 'Ambas'),
('Coordinador comercial',                      'Comercial',                  'Liderazgo',              true,  'Ambas'),
('Supervisor comercial',                       'Comercial',                  'Liderazgo',              true,  'Ambas'),
('Asesor(a) comercial',                        'Comercial',                  'Auxiliar / Operativo',   false, 'Ambas'),
('Supernumerario comercial',                   'Comercial',                  'Auxiliar / Operativo',   false, 'Ambas'),
('Mercaderista',                               'Comercial',                  'Auxiliar / Operativo',   false, 'Ambas'),
('Jefe logístico',                             'Logística y bodega',         'Liderazgo',              true,  'Ambas'),
('Auxiliar de bodega (cargue y descargue)',     'Logística y bodega',         'Auxiliar / Operativo',   false, 'Ambas'),
('Auxiliar de despacho',                       'Logística y bodega',         'Auxiliar / Operativo',   false, 'Ambas'),
('Auxiliar de recibo',                         'Logística y bodega',         'Auxiliar / Operativo',   false, 'Ambas'),
('Auxiliar de devoluciones',                   'Logística y bodega',         'Auxiliar / Operativo',   false, 'Ambas'),
('Auxiliar de separación',                     'Logística y bodega',         'Auxiliar / Operativo',   false, 'Ambas'),
('Auxiliar logístico de entrega',              'Logística y bodega',         'Auxiliar / Operativo',   false, 'Ambas')
on conflict (nombre) do nothing;

-- Matriz cargo × competencia (INSERT directo con subquery de lookup)
insert into matriz_cargo_competencia (cargo_id, competencia_id, grado_exigido, version_diccionario)
select ce.id, c.id, v.grado, 2
from (values
  ('Coordinador de GGHH/SST','TRA-01','A'),('Coordinador de GGHH/SST','TRA-02','A'),('Coordinador de GGHH/SST','TRA-03','A'),
  ('Coordinador de GGHH/SST','TRA-04','A'),('Coordinador de GGHH/SST','TRA-05','A'),('Coordinador de GGHH/SST','TRA-06','A'),
  ('Coordinador de GGHH/SST','LID-01','A'),('Coordinador de GGHH/SST','LID-02','B'),('Coordinador de GGHH/SST','LID-03','A'),
  ('Coordinador de GGHH/SST','FUN-01','A'),('Coordinador de GGHH/SST','FUN-02','B'),('Coordinador de GGHH/SST','FUN-03','A'),
  ('Coordinador de GGHH/SST','FUN-04','A'),('Coordinador de GGHH/SST','FUN-06','A'),('Coordinador de GGHH/SST','FUN-07','A'),
  ('Coordinador de GGHH/SST','FUN-08','A'),
  ('Analista de Gestión Humana','TRA-01','B'),('Analista de Gestión Humana','TRA-02','B'),('Analista de Gestión Humana','TRA-03','B'),
  ('Analista de Gestión Humana','TRA-04','B'),('Analista de Gestión Humana','TRA-05','B'),('Analista de Gestión Humana','TRA-06','B'),
  ('Analista de Gestión Humana','FUN-01','B'),('Analista de Gestión Humana','FUN-03','A'),('Analista de Gestión Humana','FUN-04','A'),
  ('Analista de Gestión Humana','FUN-06','B'),('Analista de Gestión Humana','FUN-07','A'),('Analista de Gestión Humana','FUN-08','B'),
  ('Auxiliar de SST','TRA-01','B'),('Auxiliar de SST','TRA-02','B'),('Auxiliar de SST','TRA-03','B'),
  ('Auxiliar de SST','TRA-04','B'),('Auxiliar de SST','TRA-05','B'),('Auxiliar de SST','TRA-06','A'),
  ('Auxiliar de SST','FUN-01','B'),('Auxiliar de SST','FUN-03','B'),('Auxiliar de SST','FUN-04','B'),
  ('Auxiliar de SST','FUN-06','B'),
  ('Auxiliar contable','TRA-01','B'),('Auxiliar contable','TRA-02','B'),('Auxiliar contable','TRA-03','B'),
  ('Auxiliar contable','TRA-04','B'),('Auxiliar contable','TRA-05','B'),('Auxiliar contable','TRA-06','B'),
  ('Auxiliar contable','FUN-03','A'),('Auxiliar contable','FUN-04','A'),('Auxiliar contable','FUN-06','B'),
  ('Auxiliar contable','FUN-07','A'),('Auxiliar contable','FUN-08','B'),
  ('Auxiliar de cartera','TRA-01','B'),('Auxiliar de cartera','TRA-02','B'),('Auxiliar de cartera','TRA-03','B'),
  ('Auxiliar de cartera','TRA-04','B'),('Auxiliar de cartera','TRA-05','B'),('Auxiliar de cartera','TRA-06','B'),
  ('Auxiliar de cartera','FUN-01','B'),('Auxiliar de cartera','FUN-03','A'),('Auxiliar de cartera','FUN-04','A'),
  ('Auxiliar de cartera','FUN-06','B'),('Auxiliar de cartera','FUN-07','A'),('Auxiliar de cartera','FUN-08','B'),
  ('Auxiliar de cartera','FUN-09','B'),
  ('Cajero(a) / Auxiliar de caja','TRA-01','B'),('Cajero(a) / Auxiliar de caja','TRA-02','B'),('Cajero(a) / Auxiliar de caja','TRA-03','B'),
  ('Cajero(a) / Auxiliar de caja','TRA-04','B'),('Cajero(a) / Auxiliar de caja','TRA-05','B'),('Cajero(a) / Auxiliar de caja','TRA-06','B'),
  ('Cajero(a) / Auxiliar de caja','FUN-02','B'),('Cajero(a) / Auxiliar de caja','FUN-03','A'),('Cajero(a) / Auxiliar de caja','FUN-04','A'),
  ('Cajero(a) / Auxiliar de caja','FUN-06','C'),('Cajero(a) / Auxiliar de caja','FUN-07','A'),
  ('Auxiliar de facturación','TRA-01','B'),('Auxiliar de facturación','TRA-02','B'),('Auxiliar de facturación','TRA-03','B'),
  ('Auxiliar de facturación','TRA-04','B'),('Auxiliar de facturación','TRA-05','B'),('Auxiliar de facturación','TRA-06','B'),
  ('Auxiliar de facturación','FUN-02','B'),('Auxiliar de facturación','FUN-03','B'),('Auxiliar de facturación','FUN-04','A'),
  ('Auxiliar de facturación','FUN-06','B'),('Auxiliar de facturación','LOG-02','B'),
  ('Analista de inventarios','TRA-01','B'),('Analista de inventarios','TRA-02','B'),('Analista de inventarios','TRA-03','B'),
  ('Analista de inventarios','TRA-04','B'),('Analista de inventarios','TRA-05','B'),('Analista de inventarios','TRA-06','B'),
  ('Analista de inventarios','FUN-01','B'),('Analista de inventarios','FUN-03','A'),('Analista de inventarios','FUN-04','A'),
  ('Analista de inventarios','FUN-06','A'),('Analista de inventarios','FUN-07','A'),('Analista de inventarios','FUN-08','A'),
  ('Analista de inventarios','COM-02','A'),
  ('Analista de desarrollo','TRA-01','B'),('Analista de desarrollo','TRA-02','B'),('Analista de desarrollo','TRA-03','B'),
  ('Analista de desarrollo','TRA-04','B'),('Analista de desarrollo','TRA-05','B'),('Analista de desarrollo','TRA-06','B'),
  ('Analista de desarrollo','FUN-03','A'),('Analista de desarrollo','FUN-04','A'),('Analista de desarrollo','FUN-05','A'),
  ('Analista de desarrollo','FUN-07','A'),('Analista de desarrollo','FUN-08','A'),
  ('Coordinador comercial','TRA-01','A'),('Coordinador comercial','TRA-02','A'),('Coordinador comercial','TRA-03','A'),
  ('Coordinador comercial','TRA-04','A'),('Coordinador comercial','TRA-05','A'),('Coordinador comercial','TRA-06','A'),
  ('Coordinador comercial','LID-01','A'),('Coordinador comercial','LID-02','A'),('Coordinador comercial','LID-03','A'),
  ('Coordinador comercial','FUN-01','A'),('Coordinador comercial','FUN-02','A'),('Coordinador comercial','FUN-06','B'),
  ('Coordinador comercial','FUN-07','A'),('Coordinador comercial','FUN-08','A'),('Coordinador comercial','FUN-09','A'),
  ('Coordinador comercial','COM-01','A'),
  ('Supervisor comercial','TRA-01','A'),('Supervisor comercial','TRA-02','A'),('Supervisor comercial','TRA-03','A'),
  ('Supervisor comercial','TRA-04','A'),('Supervisor comercial','TRA-05','A'),('Supervisor comercial','TRA-06','A'),
  ('Supervisor comercial','LID-01','B'),('Supervisor comercial','LID-02','B'),('Supervisor comercial','LID-03','B'),
  ('Supervisor comercial','FUN-01','B'),('Supervisor comercial','FUN-02','A'),('Supervisor comercial','FUN-06','B'),
  ('Supervisor comercial','FUN-07','B'),('Supervisor comercial','FUN-09','A'),('Supervisor comercial','COM-01','A'),
  ('Asesor(a) comercial','TRA-01','B'),('Asesor(a) comercial','TRA-02','A'),('Asesor(a) comercial','TRA-03','A'),
  ('Asesor(a) comercial','TRA-04','B'),('Asesor(a) comercial','TRA-05','B'),('Asesor(a) comercial','TRA-06','B'),
  ('Asesor(a) comercial','FUN-01','B'),('Asesor(a) comercial','FUN-02','B'),('Asesor(a) comercial','FUN-06','C'),
  ('Asesor(a) comercial','FUN-07','B'),('Asesor(a) comercial','FUN-09','B'),('Asesor(a) comercial','COM-01','B'),
  ('Supernumerario comercial','TRA-01','B'),('Supernumerario comercial','TRA-02','A'),('Supernumerario comercial','TRA-03','A'),
  ('Supernumerario comercial','TRA-04','B'),('Supernumerario comercial','TRA-05','B'),('Supernumerario comercial','TRA-06','B'),
  ('Supernumerario comercial','FUN-01','B'),('Supernumerario comercial','FUN-02','B'),('Supernumerario comercial','FUN-06','C'),
  ('Supernumerario comercial','FUN-07','B'),('Supernumerario comercial','FUN-09','B'),('Supernumerario comercial','COM-01','B'),
  ('Mercaderista','TRA-01','B'),('Mercaderista','TRA-02','B'),('Mercaderista','TRA-03','B'),
  ('Mercaderista','TRA-04','B'),('Mercaderista','TRA-05','B'),('Mercaderista','TRA-06','B'),
  ('Mercaderista','FUN-01','C'),('Mercaderista','FUN-04','B'),('Mercaderista','FUN-07','B'),
  ('Mercaderista','COM-02','A'),
  ('Jefe logístico','TRA-01','A'),('Jefe logístico','TRA-02','A'),('Jefe logístico','TRA-03','A'),
  ('Jefe logístico','TRA-04','A'),('Jefe logístico','TRA-05','A'),('Jefe logístico','TRA-06','A'),
  ('Jefe logístico','LID-01','A'),('Jefe logístico','LID-02','A'),('Jefe logístico','LID-03','A'),
  ('Jefe logístico','FUN-01','A'),('Jefe logístico','FUN-02','A'),('Jefe logístico','FUN-06','B'),
  ('Jefe logístico','FUN-07','B'),('Jefe logístico','LOG-01','A'),('Jefe logístico','LOG-02','A'),
  ('Jefe logístico','LOG-03','A'),
  ('Auxiliar de bodega (cargue y descargue)','TRA-01','B'),('Auxiliar de bodega (cargue y descargue)','TRA-02','B'),('Auxiliar de bodega (cargue y descargue)','TRA-03','B'),
  ('Auxiliar de bodega (cargue y descargue)','TRA-04','B'),('Auxiliar de bodega (cargue y descargue)','TRA-05','B'),('Auxiliar de bodega (cargue y descargue)','TRA-06','A'),
  ('Auxiliar de bodega (cargue y descargue)','FUN-02','B'),('Auxiliar de bodega (cargue y descargue)','LOG-01','B'),('Auxiliar de bodega (cargue y descargue)','LOG-02','B'),
  ('Auxiliar de bodega (cargue y descargue)','LOG-03','B'),
  ('Auxiliar de despacho','TRA-01','B'),('Auxiliar de despacho','TRA-02','B'),('Auxiliar de despacho','TRA-03','B'),
  ('Auxiliar de despacho','TRA-04','B'),('Auxiliar de despacho','TRA-05','B'),('Auxiliar de despacho','TRA-06','A'),
  ('Auxiliar de despacho','FUN-02','B'),('Auxiliar de despacho','FUN-04','B'),('Auxiliar de despacho','LOG-01','A'),
  ('Auxiliar de despacho','LOG-02','B'),('Auxiliar de despacho','LOG-03','A'),
  ('Auxiliar de recibo','TRA-01','B'),('Auxiliar de recibo','TRA-02','B'),('Auxiliar de recibo','TRA-03','B'),
  ('Auxiliar de recibo','TRA-04','B'),('Auxiliar de recibo','TRA-05','B'),('Auxiliar de recibo','TRA-06','A'),
  ('Auxiliar de recibo','FUN-04','A'),('Auxiliar de recibo','FUN-06','B'),('Auxiliar de recibo','LOG-01','A'),
  ('Auxiliar de recibo','LOG-02','B'),('Auxiliar de recibo','LOG-03','B'),
  ('Auxiliar de devoluciones','TRA-01','B'),('Auxiliar de devoluciones','TRA-02','B'),('Auxiliar de devoluciones','TRA-03','B'),
  ('Auxiliar de devoluciones','TRA-04','B'),('Auxiliar de devoluciones','TRA-05','B'),('Auxiliar de devoluciones','TRA-06','A'),
  ('Auxiliar de devoluciones','FUN-04','A'),('Auxiliar de devoluciones','FUN-06','B'),('Auxiliar de devoluciones','LOG-01','A'),
  ('Auxiliar de devoluciones','LOG-02','B'),('Auxiliar de devoluciones','LOG-03','B'),
  ('Auxiliar de separación','TRA-01','B'),('Auxiliar de separación','TRA-02','B'),('Auxiliar de separación','TRA-03','B'),
  ('Auxiliar de separación','TRA-04','B'),('Auxiliar de separación','TRA-05','B'),('Auxiliar de separación','TRA-06','A'),
  ('Auxiliar de separación','FUN-02','B'),('Auxiliar de separación','FUN-04','B'),('Auxiliar de separación','LOG-01','A'),
  ('Auxiliar de separación','LOG-02','B'),('Auxiliar de separación','LOG-03','A'),
  ('Auxiliar logístico de entrega','TRA-01','B'),('Auxiliar logístico de entrega','TRA-02','B'),('Auxiliar logístico de entrega','TRA-03','B'),
  ('Auxiliar logístico de entrega','TRA-04','B'),('Auxiliar logístico de entrega','TRA-05','B'),('Auxiliar logístico de entrega','TRA-06','A'),
  ('Auxiliar logístico de entrega','FUN-01','B'),('Auxiliar logístico de entrega','FUN-02','B'),('Auxiliar logístico de entrega','FUN-07','A'),
  ('Auxiliar logístico de entrega','LOG-01','B'),('Auxiliar logístico de entrega','LOG-03','A')
) as v(cargo, comp, grado)
join cargos_evaluacion ce on ce.nombre = v.cargo
join competencias c on c.codigo = v.comp and c.version_diccionario = 2
on conflict (cargo_id, competencia_id, version_diccionario) do nothing;

-- ════════════════════════════════════════════════════════════
-- CAMPOS NUEVOS EN ORDEN_CONTRATACION
-- ════════════════════════════════════════════════════════════

-- Columnas adicionales en orden_contratacion (solo si existe la tabla)
do $$ begin
  if exists (select 1 from information_schema.tables where table_name = 'orden_contratacion') then
    alter table orden_contratacion
      add column if not exists es_primer_contrato      boolean default true,
      add column if not exists duracion_contrato_dias  integer,
      add column if not exists cargo_evaluacion_id     uuid,
      add column if not exists lider_id                uuid;
  end if;
end $$;

-- ════════════════════════════════════════════════════════════
-- EVALUACIONES
-- ════════════════════════════════════════════════════════════

-- Ciclos de evaluación
create table if not exists ciclos_evaluacion (
  id                     uuid primary key default gen_random_uuid(),
  tipo                   text not null check (tipo in ('PRUEBA','DESEMPENO')),
  nombre                 text not null,
  fecha_inicio           date,
  fecha_corte            date,
  fecha_limite           date,
  incluye_autoevaluacion boolean default true,
  estado                 text not null default 'abierto' check (estado in ('abierto','en_curso','cerrado')),
  created_at             timestamptz default now()
);

-- Ciclo permanente para periodo de prueba
insert into ciclos_evaluacion (tipo, nombre, estado, incluye_autoevaluacion)
values ('PRUEBA', 'Periodo de Prueba — Ciclo Permanente', 'abierto', false)
on conflict do nothing;

-- Evaluaciones
create table if not exists evaluaciones (
  id                      uuid primary key default gen_random_uuid(),
  ciclo_id                uuid references ciclos_evaluacion(id),
  colaborador_id          uuid,                                     -- referencia opcional a orden_contratacion
  cargo_nombre            text not null,                            -- copia al crear
  cargo_evaluacion_id     uuid references cargos_evaluacion(id),
  evaluador_nombre        text,
  evaluador_cedula        text,
  rol_evaluador           text not null check (rol_evaluador in ('JEFE','AUTO')),
  fecha_limite            date,
  estado                  text not null default 'pendiente'
                            check (estado in ('pendiente','en_diligenciamiento','enviada_gh','devuelta','socializada','firmada','cerrada','anulada','vencida')),
  puntaje_promedio        numeric(5,2),
  indice_ajuste           numeric(5,2),
  clasificacion           text check (clasificacion in ('cumple_perfil','oportunidades_mejora','cumple_parcialmente','no_cumple')),
  concepto_prueba         text check (concepto_prueba in ('CONTINUA','NO_CONTINUA')),
  observaciones_generales text,
  observacion_devolucion  text,                                     -- cuando GH devuelve
  fecha_envio             timestamptz,
  fecha_cierre            timestamptz,
  version_diccionario     integer not null default 2,
  orden_contratacion_num  text,                                     -- para trazabilidad
  trabajador_id           uuid,                                     -- referencia opcional a trabajadores
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- Detalle por competencia
create table if not exists evaluacion_detalle (
  id              uuid primary key default gen_random_uuid(),
  evaluacion_id   uuid references evaluaciones(id) on delete cascade,
  competencia_id  uuid references competencias(id),
  codigo          text not null,
  nombre_comp     text not null,
  grado_exigido   text not null check (grado_exigido in ('A','B','C')),
  puntaje_exigido integer not null,
  grado_observado text check (grado_observado in ('A','B','C','D')),
  puntaje_observado integer,
  cumple          boolean,
  brecha_grados   integer,                                          -- diferencia negativa
  es_fortaleza    boolean default false,
  evidencia       text,
  created_at      timestamptz default now(),
  unique(evaluacion_id, competencia_id)
);

-- Planes de mejora
create table if not exists planes_mejora (
  id                   uuid primary key default gen_random_uuid(),
  evaluacion_id        uuid references evaluaciones(id) on delete cascade,
  competencia_id       uuid references competencias(id),
  codigo_competencia   text,
  nombre_competencia   text,
  accion               text not null,
  responsable_nombre   text,
  fecha_compromiso     date not null,
  fecha_seguimiento    date,
  estado               text not null default 'pendiente'
                         check (estado in ('pendiente','en_curso','cumplido','vencido')),
  resultado_seguimiento text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- Firmas
create table if not exists evaluacion_firmas (
  id            uuid primary key default gen_random_uuid(),
  evaluacion_id uuid references evaluaciones(id) on delete cascade,
  rol           text not null check (rol in ('LIDER','COLABORADOR','GH')),
  usuario_nombre text not null,
  usuario_cedula text,
  fecha_hora    timestamptz default now(),
  aceptacion    boolean not null default true,
  comentario    text
);

-- Auditoría
create table if not exists auditoria_evaluacion (
  id             uuid primary key default gen_random_uuid(),
  tabla          text not null,
  registro_id    uuid not null,
  accion         text not null,                                     -- 'cambio_estado','edicion','creacion','reapertura'
  valor_anterior text,
  valor_nuevo    text,
  campo          text,
  usuario_nombre text,
  usuario_cedula text,
  fecha_hora     timestamptz default now()
);

-- ════════════════════════════════════════════════════════════
-- FUNCIÓN: calcular índice de ajuste
-- ════════════════════════════════════════════════════════════
create or replace function fn_calcular_indice(p_evaluacion_id uuid)
returns void language plpgsql as $$
declare
  v_sum_min     integer := 0;
  v_sum_exigido integer := 0;
  v_sum_obs     numeric := 0;
  v_count       integer := 0;
  v_indice      numeric;
  v_promedio    numeric;
  v_clasif      text;
begin
  select
    coalesce(sum(least(puntaje_observado, puntaje_exigido)), 0),
    coalesce(sum(puntaje_exigido), 0),
    coalesce(sum(puntaje_observado::numeric), 0),
    count(*)
  into v_sum_min, v_sum_exigido, v_sum_obs, v_count
  from evaluacion_detalle
  where evaluacion_id = p_evaluacion_id
    and grado_observado is not null
    and rol_evaluador_cache = 'JEFE';

  if v_sum_exigido = 0 or v_count = 0 then return; end if;

  v_indice   := round((v_sum_min::numeric / v_sum_exigido) * 100, 2);
  v_promedio := round(v_sum_obs / v_count, 2);

  v_clasif := case
    when v_indice = 100            then 'cumple_perfil'
    when v_indice >= 85            then 'oportunidades_mejora'
    when v_indice >= 70            then 'cumple_parcialmente'
    else                                'no_cumple'
  end;

  update evaluaciones
  set indice_ajuste    = v_indice,
      puntaje_promedio = v_promedio,
      clasificacion    = v_clasif,
      updated_at       = now()
  where id = p_evaluacion_id;

  -- marcar brechas y fortalezas en el detalle
  update evaluacion_detalle
  set cumple        = puntaje_observado >= puntaje_exigido,
      brecha_grados = case when puntaje_observado < puntaje_exigido
                           then puntaje_exigido - puntaje_observado else 0 end,
      es_fortaleza  = puntaje_observado > puntaje_exigido
  where evaluacion_id = p_evaluacion_id
    and grado_observado is not null;
end;
$$;

-- La función referencia una columna que no existe; usamos la join al crear.
-- Versión limpia sin columna cache:
create or replace function fn_calcular_indice(p_evaluacion_id uuid)
returns void language plpgsql as $$
declare
  v_sum_min     integer := 0;
  v_sum_exigido integer := 0;
  v_sum_obs     numeric := 0;
  v_count       integer := 0;
  v_indice      numeric;
  v_promedio    numeric;
  v_clasif      text;
  v_rol         text;
begin
  select rol_evaluador into v_rol from evaluaciones where id = p_evaluacion_id;
  if v_rol <> 'JEFE' then return; end if;

  select
    coalesce(sum(least(puntaje_observado, puntaje_exigido)), 0),
    coalesce(sum(puntaje_exigido), 0),
    coalesce(sum(puntaje_observado::numeric), 0),
    count(*)
  into v_sum_min, v_sum_exigido, v_sum_obs, v_count
  from evaluacion_detalle
  where evaluacion_id = p_evaluacion_id
    and grado_observado is not null;

  if v_sum_exigido = 0 or v_count = 0 then return; end if;

  v_indice   := round((v_sum_min::numeric / v_sum_exigido) * 100, 2);
  v_promedio := round(v_sum_obs / v_count, 2);

  v_clasif := case
    when v_indice = 100 then 'cumple_perfil'
    when v_indice >= 85 then 'oportunidades_mejora'
    when v_indice >= 70 then 'cumple_parcialmente'
    else                     'no_cumple'
  end;

  update evaluaciones
  set indice_ajuste    = v_indice,
      puntaje_promedio = v_promedio,
      clasificacion    = v_clasif,
      updated_at       = now()
  where id = p_evaluacion_id;

  update evaluacion_detalle
  set cumple        = puntaje_observado >= puntaje_exigido,
      brecha_grados = case when puntaje_observado < puntaje_exigido
                           then puntaje_exigido - puntaje_observado else 0 end,
      es_fortaleza  = puntaje_observado > puntaje_exigido
  where evaluacion_id = p_evaluacion_id
    and grado_observado is not null;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- FUNCIÓN: crear evaluación de periodo de prueba desde trabajador
-- ════════════════════════════════════════════════════════════
create or replace function fn_crear_evaluacion_prueba(p_trabajador_id uuid)
returns uuid language plpgsql as $$
declare
  v_t             record;
  v_ciclo_id      uuid;
  v_eval_id       uuid;
  v_fecha_venc    date;
  v_fecha_lim     date;
  v_dias_limite   integer;
  v_evaluador_nom text;
  v_evaluador_uid uuid;
  v_comp          record;
  v_puntaje_ex    integer;
begin
  select * into v_t from trabajadores where id = p_trabajador_id;

  if v_t is null then return null; end if;
  if v_t.estado <> 'activo' then return null; end if;
  if coalesce(v_t.periodo_prueba_dias, 0) = 0 then return null; end if;
  if v_t.es_primer_contrato = false then return null; end if;
  if v_t.fecha_ingreso is null then return null; end if;

  -- No duplicar
  if exists (
    select 1 from evaluaciones e
    join ciclos_evaluacion c on c.id = e.ciclo_id
    where e.trabajador_id = p_trabajador_id
      and c.tipo = 'PRUEBA'
      and e.estado <> 'anulada'
  ) then return null; end if;

  -- Ciclo permanente
  select id into v_ciclo_id from ciclos_evaluacion
  where tipo = 'PRUEBA' and estado = 'abierto' limit 1;

  -- Fechas
  v_fecha_venc := v_t.fecha_ingreso + v_t.periodo_prueba_dias - 1;
  select valor::integer into v_dias_limite
  from parametros_evaluacion where clave = 'dias_limite_lider_prueba';
  v_fecha_lim := v_fecha_venc - coalesce(v_dias_limite, 10);

  -- Evaluador
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

  -- Competencias
  if v_t.cargo_evaluacion_id is not null then
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
    end loop;
  end if;

  insert into auditoria_evaluacion (tabla, registro_id, accion, valor_nuevo, usuario_nombre)
  values ('evaluaciones', v_eval_id, 'creacion', 'pendiente', 'sistema');

  return v_eval_id;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- VISTA: periodos de prueba activos
-- ════════════════════════════════════════════════════════════
create or replace view v_periodos_prueba as
select
  e.id                                                            as evaluacion_id,
  e.estado,
  e.orden_contratacion_num,
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

-- ════════════════════════════════════════════════════════════
-- ÍNDICES
-- ════════════════════════════════════════════════════════════
create index if not exists idx_eval_colaborador  on evaluaciones(colaborador_id);
create index if not exists idx_eval_ciclo        on evaluaciones(ciclo_id);
create index if not exists idx_eval_estado       on evaluaciones(estado);
create index if not exists idx_det_evaluacion    on evaluacion_detalle(evaluacion_id);
create index if not exists idx_plan_evaluacion   on planes_mejora(evaluacion_id);
create index if not exists idx_firma_evaluacion  on evaluacion_firmas(evaluacion_id);
create index if not exists idx_audit_registro    on auditoria_evaluacion(registro_id);
create index if not exists idx_matriz_cargo      on matriz_cargo_competencia(cargo_id);
create index if not exists idx_matriz_comp       on matriz_cargo_competencia(competencia_id);

-- ════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════
alter table versiones_diccionario    enable row level security;
alter table competencias             enable row level security;
alter table competencia_grados       enable row level security;
alter table cargos_evaluacion        enable row level security;
alter table matriz_cargo_competencia enable row level security;
alter table parametros_evaluacion    enable row level security;
alter table ciclos_evaluacion        enable row level security;
alter table evaluaciones             enable row level security;
alter table evaluacion_detalle       enable row level security;
alter table planes_mejora            enable row level security;
alter table evaluacion_firmas        enable row level security;
alter table auditoria_evaluacion     enable row level security;

do $$ declare t text; begin
  foreach t in array array[
    'versiones_diccionario','competencias','competencia_grados','cargos_evaluacion',
    'matriz_cargo_competencia','parametros_evaluacion','ciclos_evaluacion',
    'evaluaciones','evaluacion_detalle','planes_mejora','evaluacion_firmas','auditoria_evaluacion'
  ] loop
    execute format('alter table %I enable row level security', t);
    if not exists (
      select 1 from pg_policies
      where tablename = t and policyname = 'allow_all_' || t
    ) then
      execute format(
        'create policy "allow_all_%s" on %I for all using (true) with check (true)',
        t, t
      );
    end if;
  end loop;
end $$;
