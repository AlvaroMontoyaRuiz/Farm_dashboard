-- ============================================================================
-- 0004 — types of animal movement (run ONCE, after 0003)
--
--   animal_movements.reason
--     exits  : 'venta' | 'enfermeria' | 'muerte'
--     entries: NULL (new animals) | 'regreso_enfermeria' (back from the infirmary)
--
-- Exits recorded before this update were all treated as sales.
-- ============================================================================

ALTER TABLE animal_movements ADD COLUMN reason TEXT;

UPDATE animal_movements SET reason = 'venta' WHERE movement = 'salida' AND reason IS NULL;
