-- ============================================================================
-- Farm Inventory – initial schema
-- Target: Cloudflare D1 (SQLite)
-- ============================================================================

-- Users (admin + up to 3 workers). Passwords are stored as a SHA-256 hash
-- generated at the API layer with a per-user salt. For a 4-user internal
-- app this is adequate; see README to switch to bcrypt if you ever expose
-- this to the internet widely.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  salt          TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('admin','worker')),
  display_name  TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Session tokens (opaque random strings). Simpler than JWTs for this scale.
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Corrales (pens). 20 of them.
CREATE TABLE IF NOT EXISTS corrales (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL UNIQUE,
  notes      TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Food inventory. Each row is a lot of bultos received into storage.
-- type = 'levante' | 'finalizador'
CREATE TABLE IF NOT EXISTS food_lots (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  type            TEXT    NOT NULL CHECK (type IN ('levante','finalizador')),
  bultos_received INTEGER NOT NULL CHECK (bultos_received > 0),
  received_at     TEXT    NOT NULL DEFAULT (date('now')),
  note            TEXT,
  created_by      INTEGER REFERENCES users(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_food_lots_type ON food_lots(type);
CREATE INDEX IF NOT EXISTS idx_food_lots_date ON food_lots(received_at);

-- Animal movements (ingreso / salida) per corral. A positive quantity on
-- 'ingreso' increases the headcount, 'salida' decreases it.
CREATE TABLE IF NOT EXISTS animal_movements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  corral_id   INTEGER NOT NULL REFERENCES corrales(id),
  movement    TEXT    NOT NULL CHECK (movement IN ('ingreso','salida')),
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  movement_at TEXT    NOT NULL DEFAULT (date('now')),
  note        TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_movements_corral ON animal_movements(corral_id);
CREATE INDEX IF NOT EXISTS idx_movements_date   ON animal_movements(movement_at);

-- Daily feed consumption: how many bultos were given to each corral that day.
CREATE TABLE IF NOT EXISTS feed_consumption (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  corral_id   INTEGER NOT NULL REFERENCES corrales(id),
  food_type   TEXT    NOT NULL CHECK (food_type IN ('levante','finalizador')),
  bultos      REAL    NOT NULL CHECK (bultos > 0),
  consumed_at TEXT    NOT NULL DEFAULT (date('now')),
  note        TEXT,
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cons_corral ON feed_consumption(corral_id);
CREATE INDEX IF NOT EXISTS idx_cons_date   ON feed_consumption(consumed_at);
CREATE INDEX IF NOT EXISTS idx_cons_type   ON feed_consumption(food_type);

-- Audit log of deleted records. Nothing is hard-deleted silently: when a
-- worker/admin deletes a row through the UI (after confirming), the row's
-- payload is copied here and then removed from the source table.
CREATE TABLE IF NOT EXISTS deletion_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name    TEXT    NOT NULL,
  record_id     INTEGER NOT NULL,
  payload_json  TEXT    NOT NULL,
  deleted_by    INTEGER REFERENCES users(id),
  deleted_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  reason        TEXT
);
CREATE INDEX IF NOT EXISTS idx_del_table ON deletion_log(table_name);
CREATE INDEX IF NOT EXISTS idx_del_date  ON deletion_log(deleted_at);
