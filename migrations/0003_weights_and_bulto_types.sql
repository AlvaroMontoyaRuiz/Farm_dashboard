-- ============================================================================
-- 0003 — weights and bulto specs (run ONCE on a database that already has 0001+0002)
--
--   food_types        : the specs of each type of bulto (kg per bulto, notes).
--                       The administrator edits them in the Bultos page. Demo value: 40 kg.
--   animal_movements  : + weight_kg    total weight of the group that enters/leaves
--   feed_consumption  : + kg_per_bulto kg per bulto AT THE TIME of feeding, so changing
--                       the specs later never rewrites old feed-conversion results.
-- ============================================================================

CREATE TABLE IF NOT EXISTS food_types (
  type         TEXT PRIMARY KEY CHECK (type IN ('levante','finalizador')),
  kg_per_bulto REAL NOT NULL CHECK (kg_per_bulto > 0),
  description  TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO food_types (type, kg_per_bulto) VALUES ('levante', 40), ('finalizador', 40);

ALTER TABLE animal_movements ADD COLUMN weight_kg REAL;
ALTER TABLE feed_consumption ADD COLUMN kg_per_bulto REAL;

UPDATE feed_consumption
   SET kg_per_bulto = (SELECT t.kg_per_bulto FROM food_types t WHERE t.type = feed_consumption.food_type)
 WHERE kg_per_bulto IS NULL;
