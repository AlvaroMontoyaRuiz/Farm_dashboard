// The app updates its own database.
//
// Runs once per server instance, on the first API request. Each step looks at the real
// structure of the database and only does its work when it has not been done yet, so it is
// safe on a brand-new install, on a database that already had 0003/0004 applied by hand,
// and when two requests arrive at the same moment.
//
//   0003  food_types table, weight_kg on animal movements, kg_per_bulto on consumption
//   0004  reason on animal movements (venta / enfermeria / muerte / regreso_enfermeria)
//   0005  'engorde' feed type + price per bulto on every delivery
//   0006  lotes (groups of corrales)
//
// Steps 0005 and 0006 are ONE atomic batch whose first statement fails if the step was
// already applied; the failure rolls the whole batch back, so nothing is ever half-done.
//
// The same changes exist as .sql files in /migrations for people who prefer the command line
// (0003 and 0004). 0005 and 0006 are only here.

const TYPES_SQL = `('levante','engorde','finalizador')`;

// Starting groups of corrales. Only used the first time; afterwards the admin edits them in the Panel.
const LOTES = [
  ['Lote 1', [7, 5, 9, 2]],
  ['Lote 2', [4, 3, 12, 1]],
  ['Lote 3', [10, 11]],
  ['Lote 4', [8, 6, 13]],
];

async function hasTable(db, name) {
  return !!(await db.prepare(`SELECT 1 AS x FROM sqlite_master WHERE type = 'table' AND name = ?`).bind(name).first());
}
async function hasColumn(db, table, col) {
  const r = await db.prepare(`PRAGMA table_info(${table})`).all();
  return (r.results || []).some((c) => c.name === col);
}
async function addColumn(db, table, def) {
  const col = def.split(' ')[0];
  if (!(await hasColumn(db, table, col))) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${def}`).run();
}

// Rebuilds a table (SQLite cannot change a CHECK in place), keeping its ids and the id counter.
function rebuild(db, table, createSql, cols, indexes = []) {
  const tmp = `${table}_new`;
  return [
    db.prepare(`DROP TABLE IF EXISTS ${tmp}`),
    db.prepare(createSql.replace('__T__', tmp)),
    db.prepare(`INSERT INTO ${tmp} (${cols}) SELECT ${cols} FROM ${table}`),
    // keep the id counter, so ids of deleted records are never handed out again
    db.prepare(`UPDATE sqlite_sequence SET seq = MAX(seq, COALESCE((SELECT seq FROM sqlite_sequence WHERE name = '${table}'), 0)) WHERE name = '${tmp}'`),
    db.prepare(
      `INSERT INTO sqlite_sequence (name, seq)
       SELECT '${tmp}', seq FROM sqlite_sequence
        WHERE name = '${table}' AND NOT EXISTS (SELECT 1 FROM sqlite_sequence WHERE name = '${tmp}')`
    ),
    db.prepare(`DROP TABLE ${table}`),
    db.prepare(`ALTER TABLE ${tmp} RENAME TO ${table}`),
    ...indexes.map((i) => db.prepare(i)),
  ];
}

const STEPS = [
  {
    id: '0003',
    async needed(db) {
      return !(await hasTable(db, 'food_types')) || !(await hasColumn(db, 'animal_movements', 'weight_kg')) || !(await hasColumn(db, 'feed_consumption', 'kg_per_bulto'));
    },
    async run(db) {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS food_types (
             type TEXT PRIMARY KEY CHECK (type IN ('levante','finalizador')),
             kg_per_bulto REAL NOT NULL CHECK (kg_per_bulto > 0),
             description TEXT,
             updated_at TEXT NOT NULL DEFAULT (datetime('now')))`
        )
        .run();
      await db.prepare(`INSERT OR IGNORE INTO food_types (type, kg_per_bulto) VALUES ('levante', 40), ('finalizador', 40)`).run();
      await addColumn(db, 'animal_movements', 'weight_kg REAL');
      await addColumn(db, 'feed_consumption', 'kg_per_bulto REAL');
      await db
        .prepare(
          `UPDATE feed_consumption
              SET kg_per_bulto = (SELECT t.kg_per_bulto FROM food_types t WHERE t.type = feed_consumption.food_type)
            WHERE kg_per_bulto IS NULL`
        )
        .run();
    },
  },
  {
    id: '0004',
    async needed(db) {
      return !(await hasColumn(db, 'animal_movements', 'reason'));
    },
    async run(db) {
      await addColumn(db, 'animal_movements', 'reason TEXT');
      await db.prepare(`UPDATE animal_movements SET reason = 'venta' WHERE movement = 'salida' AND reason IS NULL`).run();
    },
  },
  {
    id: '0005',
    async needed(db) {
      return !(await hasColumn(db, 'food_lots', 'price_per_bulto'));
    },
    async run(db) {
      await db.batch([
        // First statement = the lock: fails (and rolls everything back) if another request already did this.
        db.prepare(`ALTER TABLE food_lots ADD COLUMN price_per_bulto REAL`),

        ...rebuild(
          db,
          'food_lots',
          `CREATE TABLE __T__ (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             type TEXT NOT NULL CHECK (type IN ${TYPES_SQL}),
             bultos_received INTEGER NOT NULL CHECK (bultos_received > 0),
             received_at TEXT NOT NULL DEFAULT (date('now')),
             note TEXT,
             created_by INTEGER REFERENCES users(id),
             created_at TEXT NOT NULL DEFAULT (datetime('now')),
             price_per_bulto REAL)`,
          'id, type, bultos_received, received_at, note, created_by, created_at, price_per_bulto',
          [
            `CREATE INDEX IF NOT EXISTS idx_food_lots_type ON food_lots(type)`,
            `CREATE INDEX IF NOT EXISTS idx_food_lots_date ON food_lots(received_at)`,
          ]
        ),

        ...rebuild(
          db,
          'feed_consumption',
          `CREATE TABLE __T__ (
             id INTEGER PRIMARY KEY AUTOINCREMENT,
             corral_id INTEGER NOT NULL REFERENCES corrales(id),
             food_type TEXT NOT NULL CHECK (food_type IN ${TYPES_SQL}),
             bultos REAL NOT NULL CHECK (bultos > 0),
             consumed_at TEXT NOT NULL DEFAULT (date('now')),
             note TEXT,
             created_by INTEGER REFERENCES users(id),
             created_at TEXT NOT NULL DEFAULT (datetime('now')),
             kg_per_bulto REAL)`,
          'id, corral_id, food_type, bultos, consumed_at, note, created_by, created_at, kg_per_bulto',
          [
            `CREATE INDEX IF NOT EXISTS idx_cons_corral ON feed_consumption(corral_id)`,
            `CREATE INDEX IF NOT EXISTS idx_cons_date ON feed_consumption(consumed_at)`,
            `CREATE INDEX IF NOT EXISTS idx_cons_type ON feed_consumption(food_type)`,
          ]
        ),

        db.prepare(`DROP TABLE IF EXISTS food_types_new`),
        db.prepare(
          `CREATE TABLE food_types_new (
             type TEXT PRIMARY KEY CHECK (type IN ${TYPES_SQL}),
             kg_per_bulto REAL NOT NULL CHECK (kg_per_bulto > 0),
             description TEXT,
             updated_at TEXT NOT NULL DEFAULT (datetime('now')))`
        ),
        db.prepare(`INSERT INTO food_types_new (type, kg_per_bulto, description, updated_at) SELECT type, kg_per_bulto, description, updated_at FROM food_types`),
        db.prepare(`DROP TABLE food_types`),
        db.prepare(`ALTER TABLE food_types_new RENAME TO food_types`),
        db.prepare(`INSERT OR IGNORE INTO food_types (type, kg_per_bulto) VALUES ('engorde', 40)`),
      ]);
    },
  },
  {
    id: '0006',
    async needed(db) {
      return !(await hasTable(db, 'lotes')) || !(await hasColumn(db, 'corrales', 'lote_id'));
    },
    async run(db) {
      await db.prepare(`CREATE TABLE IF NOT EXISTS lotes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT (datetime('now')))`).run();
      const seed = [];
      // lock: adding the column fails if another request already did this
      const lock = db.prepare(`ALTER TABLE corrales ADD COLUMN lote_id INTEGER REFERENCES lotes(id)`);
      for (const [name, nums] of LOTES) {
        seed.push(db.prepare(`INSERT OR IGNORE INTO lotes (name) VALUES (?)`).bind(name));
        const names = nums.map((n) => `Corral ${n}`);
        seed.push(
          db
            .prepare(`UPDATE corrales SET lote_id = (SELECT id FROM lotes WHERE name = ?) WHERE name IN (${names.map(() => '?').join(',')})`)
            .bind(name, ...names)
        );
      }
      await db.batch([lock, ...seed]);
    },
  },
];

let ready = null;

// Call before handling an API request. Cheap after the first success.
export function ensureSchema(env) {
  if (!ready) {
    ready = (async () => {
      const db = env.DB;
      // A database without tables is "not initialized" (handled by the caller): nothing to update.
      if (!(await hasTable(db, 'corrales'))) {
        ready = null;
        return;
      }
      for (const step of STEPS) {
        if (!(await step.needed(db))) continue;
        try {
          await step.run(db);
          console.log('Database updated:', step.id);
        } catch (e) {
          // Another request got there first: fine as long as the step is now done.
          if (await step.needed(db)) throw e;
        }
      }
    })().catch((e) => {
      ready = null; // try again on the next request
      throw e;
    });
  }
  return ready;
}
