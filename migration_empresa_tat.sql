-- ============================================================
-- MIGRACIÓN: Columna empresa + identificación TAT
-- Propósito:
--   Agregar columna `empresa` a trabajadores para distinguir
--   empleados de TAT Distribuciones vs Tiendas y Marcas.
-- Idempotente: se puede ejecutar más de una vez sin duplicar.
-- ============================================================

-- ── 1. Agregar columna empresa si no existe ───────────────────
ALTER TABLE trabajadores
  ADD COLUMN IF NOT EXISTS empresa text DEFAULT 'GH';

-- ── 2. Marcar trabajadores TAT por cédula ────────────────────
UPDATE trabajadores
SET empresa = 'TAT'
WHERE cedula IN (
  '16774226',    -- MARCO AURELIO PARRA AVILA
  '75071571',    -- LUIS ALFONSO RIOS GONZALEZ
  '1088305468',  -- JULIAN DAVID RODRIGUEZ MONTOYA
  '9958008',     -- CARLOS ADRIAN CALLE RENDON
  '1060586518',  -- NELLY YURANNY SALDARRIAGA CAÑAS
  '30321892',    -- NANCY EUGENIA CASTRO ARBELAEZ
  '10030398',    -- JOHN RAUL GRAJALES CANO
  '1088262963',  -- ALEXANDRA MILENA VANEGAS CALVO
  '30415268',    -- MARIA CARMENZA GUAPACHA CASTAÑEDA
  '42161511',    -- JUDY FRANCY BUITRAGO
  '10143721',    -- JUAN CARLOS DUQUE TORO
  '4514086',     -- MAURICIO ANDRES BLANDON GALVIS
  '42162210',    -- YULIANA VELEZ FLOREZ
  '1093230289',  -- DANIELA GONZALEZ OSORIO
  '1088036876',  -- ESTEFANIA QUINTERO GONZALEZ
  '1140064939',  -- TATIANA GARCIA CARDONA
  '1089100450',  -- SEBASTIAN QUEVEDO SUAREZ
  '1076652811',  -- NICOL DAYANA PARRA CALDERON
  '1047467581',  -- PAULA ANDREA RAMOS BORJA
  '25181643',    -- YEIMY LUCIA HOLGUIN OSORIO
  '42149772'     -- MARIA DEL PILAR ARANGO BLANDON
);

-- ── 3. Verificar resultado ────────────────────────────────────
SELECT nombre, cedula, cargo, marca, empresa
FROM trabajadores
WHERE empresa = 'TAT'
ORDER BY nombre;
