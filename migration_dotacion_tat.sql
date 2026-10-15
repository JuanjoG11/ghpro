-- ============================================================
-- MIGRACIÓN: Agregar prendas TAT
--   - Camiseta TAT (camisa · hombre y mujer · S M L XL XXL)
--   - Pantalón TAT (pantalon · hombre · 28 30 32 34 36 38)
--   - Pantalón TAT (pantalon · mujer  · 6  8  10 12 14 16 18)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Idempotente: se puede ejecutar más de una vez sin duplicar.
-- ============================================================

-- ── CAMISETA TAT: hombre y mujer · S M L XL XXL ──────────────
INSERT INTO dotacion_prendas (tipo, referencia, genero, talla, stock_min)
SELECT 'camisa', 'Camiseta TAT', g.genero, t.talla, 2
FROM
  (VALUES ('hombre'), ('mujer')) AS g(genero),
  (VALUES ('S'), ('M'), ('L'), ('XL'), ('XXL'))  AS t(talla)
ON CONFLICT (tipo, referencia, genero, talla) DO NOTHING;

-- ── PANTALÓN TAT hombre: tallas 28–38 ────────────────────────
INSERT INTO dotacion_prendas (tipo, referencia, genero, talla, stock_min)
SELECT 'pantalon', 'Pantalón TAT', 'hombre', t.talla, 2
FROM (VALUES ('28'), ('30'), ('32'), ('34'), ('36'), ('38')) AS t(talla)
ON CONFLICT (tipo, referencia, genero, talla) DO NOTHING;

-- ── PANTALÓN TAT mujer: tallas 6–18 ──────────────────────────
INSERT INTO dotacion_prendas (tipo, referencia, genero, talla, stock_min)
SELECT 'pantalon', 'Pantalón TAT', 'mujer', t.talla, 2
FROM (VALUES ('6'), ('8'), ('10'), ('12'), ('14'), ('16'), ('18')) AS t(talla)
ON CONFLICT (tipo, referencia, genero, talla) DO NOTHING;

-- ── Verificar resultado ───────────────────────────────────────
SELECT tipo, referencia, genero, talla, stock, stock_min
FROM dotacion_prendas
WHERE referencia IN ('Camiseta TAT', 'Pantalón TAT')
ORDER BY tipo, genero, talla;
