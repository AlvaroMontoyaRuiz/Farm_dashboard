// Batches (camadas) and mortality, per lote. Nothing is stored: everything is calculated from the
// animal movements, so deleting or correcting a record fixes the numbers automatically.
//
// A batch is a group of animals that goes through a lote together:
//   - it STARTS when new animals enter a lote that has no animals (0 -> some),
//   - more entries while animals are still there belong to the same batch,
//   - it ENDS when the lote is empty again (everything sold or dead).
//
//   mortality % = deaths ÷ animals that entered the batch        (5 of 150 = 3,3 %)
//
// What counts as "in the batch":
//   ingreso (new)          +entered, +present
//   venta                  -present, +sold
//   muerte                 -present, +deaths
//   enfermeria             no change: the animals are still part of the batch while in the infirmary
//   regreso_enfermeria     no change
// A batch closes when `present` reaches 0, so animals in the infirmary keep it open.
//
// The lote of a batch is the lote its corrales belong to NOW. If the administrator moves a corral to
// another lote, the history of both lotes is recalculated with the new makeup.

const r1 = (n) => Math.round(n * 10) / 10;
const dayNo = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;

// movements: animal_movements rows (corral_id, movement, reason, quantity, movement_at, created_at, id)
// loteOf: Map(corralId -> loteId or null)
// Returns Map(loteId -> [batch, ...]) with batches oldest first.
// batch = { n, start, end|null, entered, deaths, sold, present, mortality (%) , open }
export function computeBatches(movements, loteOf, today) {
  const byLote = new Map();
  for (const m of movements) {
    const lote = loteOf.get(m.corral_id);
    if (lote == null) continue;
    if (!byLote.has(lote)) byLote.set(lote, []);
    byLote.get(lote).push(m);
  }

  const out = new Map();
  for (const [lote, list] of byLote) {
    // same order as everywhere else: by date, entries before exits within a day, then creation
    list.sort(
      (a, b) =>
        a.movement_at.localeCompare(b.movement_at) ||
        (a.movement === 'ingreso' ? 0 : 1) - (b.movement === 'ingreso' ? 0 : 1) ||
        String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
        a.id - b.id
    );

    const batches = [];
    let cur = null;
    for (const m of list) {
      const q = Number(m.quantity);
      const isNew = m.movement === 'ingreso' && m.reason !== 'regreso_enfermeria';
      if (isNew) {
        if (!cur) cur = { n: batches.length + 1, start: m.movement_at, end: null, entered: 0, deaths: 0, sold: 0, present: 0 };
        cur.entered += q;
        cur.present += q;
        continue;
      }
      if (!cur || m.movement !== 'salida') continue; // returns from the infirmary change nothing
      if (m.reason === 'muerte') {
        cur.deaths += q;
        cur.present -= q;
      } else if (m.reason === 'enfermeria') {
        continue;
      } else {
        cur.sold += q; // venta (and old records without a type)
        cur.present -= q;
      }
      if (cur.present <= 1e-9) {
        cur.end = m.movement_at;
        batches.push(cur);
        cur = null;
      }
    }
    if (cur) batches.push(cur);

    out.set(
      lote,
      batches.map((b) => ({
        ...b,
        present: Math.max(0, b.present),
        open: b.end == null,
        days: Math.max(1, Math.round(dayNo(b.end || today) - dayNo(b.start)) + 1),
        mortality: b.entered > 0 ? r1((b.deaths / b.entered) * 100) : 0,
      }))
    );
  }
  return out;
}

// Whole-history figure for a lote: all deaths ÷ all animals that ever entered it.
export function totalsOf(batches) {
  const entered = batches.reduce((s, b) => s + b.entered, 0);
  const deaths = batches.reduce((s, b) => s + b.deaths, 0);
  return { batches: batches.length, entered, deaths, mortality: entered > 0 ? r1((deaths / entered) * 100) : 0 };
}

// Reads the movements and the makeup of the lotes, and returns Map(loteId -> batches).
export async function loadBatches(env, today) {
  const [mv, co] = await Promise.all([
    env.DB.prepare(`SELECT id, corral_id, movement, reason, quantity, movement_at, created_at FROM animal_movements`).all(),
    env.DB.prepare(`SELECT id, lote_id FROM corrales`).all(),
  ]);
  const loteOf = new Map((co.results || []).map((c) => [c.id, c.lote_id]));
  return computeBatches(mv.results || [], loteOf, today);
}
