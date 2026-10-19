// Inventory rules: bultos and animals can never go below zero.
//
// Stock is never stored; it is always (what came in) minus (what went out), in
// date order. These helpers answer two questions:
//   1. How much is available right now?        feedRemaining / animalsIn
//   2. Would adding or removing this record push any day below zero?
//      (covers backdated entries and deleting a delivery that was already used)
//
// Existing data may already be negative (it was possible before these rules
// existed). So "would break" means "introduces a NEW negative day", not "the
// history contains a negative day".

const EPS = 1e-9;

// Same-day order: things coming IN count before things going OUT, so a delivery
// registered late with its real arrival date still covers that day's feeding.
export function compareEvents(a, b) {
  return (
    a.date.localeCompare(b.date) ||
    (a.delta > 0 ? 0 : 1) - (b.delta > 0 ? 0 : 1) ||
    String(a.createdAt || '').localeCompare(String(b.createdAt || '')) ||
    (a.id || 0) - (b.id || 0)
  );
}

// Set of "key|date" for every day where the running balance of `key` is < 0.
export function negativeDays(events, keyFn) {
  const sorted = [...events].sort(compareEvents);
  const bal = {};
  const out = new Set();
  for (const e of sorted) {
    const k = keyFn(e);
    bal[k] = (bal[k] || 0) + e.delta;
    if (bal[k] < -EPS) out.add(`${k}|${e.date}`);
  }
  return out;
}

// First "key|date" that is negative AFTER the change but was not before. null = safe.
// change = { add?: event, removeUid?: string }
export function newNegative(events, keyFn, change) {
  const before = negativeDays(events, keyFn);
  let after = events;
  if (change.removeUid) after = after.filter((e) => e.uid !== change.removeUid);
  if (change.add) after = [...after, change.add];
  for (const x of negativeDays(after, keyFn)) if (!before.has(x)) return x;
  return null;
}

/* ---------------- feed (bultos) ---------------- */

export async function loadFeedEvents(env) {
  const [lots, cons] = await Promise.all([
    env.DB.prepare(`SELECT id, type, bultos_received AS qty, received_at AS date, created_at AS createdAt FROM food_lots`).all(),
    env.DB.prepare(`SELECT id, food_type AS type, bultos AS qty, consumed_at AS date, created_at AS createdAt FROM feed_consumption`).all(),
  ]);
  return [
    ...(lots.results || []).map((x) => ({ ...x, uid: `food_lots:${x.id}`, delta: Number(x.qty) })),
    ...(cons.results || []).map((x) => ({ ...x, uid: `feed_consumption:${x.id}`, delta: -Number(x.qty) })),
  ];
}
export const feedKey = (e) => e.type;

// Bultos in storage right now for one feed type.
export async function feedRemaining(env, type) {
  const r = await env.DB.prepare(
    `SELECT (SELECT COALESCE(SUM(bultos_received),0) FROM food_lots WHERE type = ?1)
          - (SELECT COALESCE(SUM(bultos),0) FROM feed_consumption WHERE food_type = ?1) AS n`
  )
    .bind(type)
    .first();
  return Math.round(Number(r?.n || 0) * 100) / 100;
}

/* ---------------- animals ---------------- */

export async function loadAnimalEvents(env, corralId) {
  const q = corralId
    ? env.DB.prepare(`SELECT id, corral_id AS corral, movement, quantity, movement_at AS date, created_at AS createdAt FROM animal_movements WHERE corral_id = ?`).bind(Number(corralId))
    : env.DB.prepare(`SELECT id, corral_id AS corral, movement, quantity, movement_at AS date, created_at AS createdAt FROM animal_movements`);
  const rows = (await q.all()).results || [];
  return rows.map((x) => ({
    ...x,
    uid: `animal_movements:${x.id}`,
    delta: x.movement === 'ingreso' ? Number(x.quantity) : -Number(x.quantity),
  }));
}
export const animalKey = (e) => e.corral;

// Animals currently in one corral.
export async function animalsIn(env, corralId) {
  const r = await env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN movement='ingreso' THEN quantity ELSE -quantity END), 0) AS n
       FROM animal_movements WHERE corral_id = ?`
  )
    .bind(Number(corralId))
    .first();
  return Number(r?.n || 0);
}

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z'));
export const nowTs = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
