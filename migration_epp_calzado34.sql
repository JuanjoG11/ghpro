-- ============================================================
-- GH PRO — Migración: EPP + Talla 34 calzado mujer
-- Fecha   : 2026-09-01
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Ampliar el CHECK de tipo para incluir 'epp' ───────────
--    (ALTER CONSTRAINT no existe en PG; se re-crea el check)
ALTER TABLE dotacion_prendas
  DROP CONSTRAINT IF EXISTS dotacion_prendas_tipo_check;

ALTER TABLE dotacion_prendas
  ADD CONSTRAINT dotacion_prendas_tipo_check
  CHECK (tipo IN ('camisa','pantalon','chaqueta','calzado','epp'));

-- ── 2. Ampliar el CHECK de genero para incluir áreas EPP ─────
--    El campo "genero" se reutiliza para almacenar el área
--    ('bodega' | 'cuarto_frio') en los registros de tipo 'epp'.
ALTER TABLE dotacion_prendas
  DROP CONSTRAINT IF EXISTS dotacion_prendas_genero_check;

ALTER TABLE dotacion_prendas
  ADD CONSTRAINT dotacion_prendas_genero_check
  CHECK (genero IN ('hombre','mujer','bodega','cuarto_frio'));

-- ── 3. Actualizar comentario de la tabla ─────────────────────
COMMENT ON TABLE dotacion_prendas IS
  'Inventario de prendas y EPP. tipo: camisa|pantalon|chaqueta|calzado|epp. '
  'genero: hombre|mujer|bodega|cuarto_frio (las dos últimas solo para epp).';

-- ── 4. SEED: talla 34 para botas de seguridad · mujer ────────
INSERT INTO dotacion_prendas (tipo, referencia, genero, talla, stock_min)
VALUES ('calzado', 'Bota de Seguridad con Puntera', 'mujer', '34', 2)
ON CONFLICT (tipo, referencia, genero, talla) DO NOTHING;

-- ── 5. SEED: EPP — Bodega · tallas M y L ─────────────────────
INSERT INTO dotacion_prendas (tipo, referencia, genero, talla, stock_min)
SELECT 'epp', r.ref, 'bodega', t.talla, 2
FROM
  (VALUES
    ('Casco'),
    ('Barbuquejo'),
    ('Guantes')
  ) AS r(ref),
  (VALUES ('M'), ('L')) AS t(talla)
ON CONFLICT (tipo, referencia, genero, talla) DO NOTHING;

-- ── 6. SEED: EPP — Cuarto Frío · tallas M y L ────────────────
INSERT INTO dotacion_prendas (tipo, referencia, genero, talla, stock_min)
SELECT 'epp', r.ref, 'cuarto_frio', t.talla, 2
FROM
  (VALUES
    ('Casco'),
    ('Barbuquejo'),
    ('Guantes')
  ) AS r(ref),
  (VALUES ('M'), ('L')) AS t(talla)
ON CONFLICT (tipo, referencia, genero, talla) DO NOTHING;

-- ── Verificación rápida ───────────────────────────────────────
SELECT tipo, referencia, genero, talla, stock, stock_min
FROM dotacion_prendas
WHERE tipo = 'epp'
   OR (tipo = 'calzado' AND genero = 'mujer' AND talla = '34')
ORDER BY tipo, referencia, genero, talla;
