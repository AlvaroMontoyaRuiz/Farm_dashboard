// Feed conversion (conversión alimenticia, FCR) for every group of animals that leaves a corral.
//
//   FCR = kg of feed eaten  ÷  kg of weight gained
//
// Animals enter together but leave in small groups, so each exit has to be charged
// with its fair share of what the corral ate. We use the AVERAGE method (animals are
// treated as interchangeable), walking each corral's history in order:
//
//   c  = feed eaten per animal so far (kg/animal). Every feeding adds  kg ÷ animals present.
//   S  = sum of c at the moment each present animal entered
//   I  = total entry weight of the animals present
//
// When q animals leave with total weight W (A animals present before they leave):
//   feed they ate     = q × (c − S/A)
//   their entry weight = q × I/A
//   weight gained      = W − their entry weight
//   FCR                = feed ÷ gain
// Then S, I and A shrink by the same share, and the animals left behind keep their own history.
//
// Nothing is stored: results are recalculated from the records, so deleting or correcting a
// record fixes every conversion automatically.

export const DEFAULT_KG_PER_BULTO = 40;

// Good: up to 2.5 · Regular: 2.6 to 3.0 · Bad: above 3.0 (rounded to one decimal so the ranges meet).
export function ratingFor(fcr) {
  const r = Math.round(fcr * 10) / 10;
  if (r <= 2.5) return 'buena';
  if (r <= 3.0) return 'regular';
  return 'mala';
}

const dayNo = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
const r2 = (n) => Math.round(n * 100) / 100;

// movements: animal_movements rows · consumption: feed_consumption rows · kgByType: {levante, finalizador}
// Returns Map(movementId -> result) for every 'salida'.
export function analyzeExits(movements, consumption, kgByType = {}) {
  const byCorral = new Map();
  const push = (corral, ev) => {
    if (!byCorral.has(corral)) byCorral.set(corral, []);
    byCorral.get(corral).push(ev);
  };
  for (const m of movements) {
    push(m.corral_id, {
      kind: m.movement === 'ingreso' ? 0 : 2,
      date: m.movement_at, at: m.created_at || '', id: m.id,
      q: Number(m.quantity), w: m.weight_kg == null ? null : Number(m.weight_kg),
    });
  }
  for (const c of consumption) {
    const kgb = c.kg_per_bulto ?? kgByType[c.food_type] ?? DEFAULT_KG_PER_BULTO;
    push(c.corral_id, { kind: 1, date: c.consumed_at, at: c.created_at || '', id: c.id, kg: Number(c.bultos) * Number(kgb) });
  }

  const out = new Map();
  for (const events of byCorral.values()) {
    events.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at) || a.kind - b.kind || a.id - b.id);
    let A = 0, I = 0, S = 0, D = 0, unknown = 0, c = 0;
    for (const e of events) {
      if (e.kind === 0) {
        S += e.q * c;
        D += e.q * dayNo(e.date);
        A += e.q;
        if (e.w == null) unknown += e.q; else I += e.w;
      } else if (e.kind === 1) {
        if (A > 0) c += e.kg / A; // feed given to an empty corral is not charged to anyone
      } else {
        if (A <= 0) continue;
        const q = Math.min(e.q, A);
        const share = q / A;
        const feedKg = Math.max(0, q * (c - S / A));
        const initialKg = share * I;
        const days = dayNo(e.date) - D / A;
        let res;
        if (e.w == null || unknown > 1e-9) {
          res = { fcr: null, rating: null, reason: 'sin_peso', animals: q, feedKg: r2(feedKg) };
        } else if (feedKg <= 1e-9) {
          res = { fcr: null, rating: null, reason: 'sin_consumo', animals: q, feedKg: 0, initialKg: r2(initialKg), finalKg: r2(e.w), gainKg: r2(e.w - initialKg) };
        } else {
          const gain = e.w - initialKg;
          const base = { animals: q, feedKg: r2(feedKg), initialKg: r2(initialKg), finalKg: r2(e.w), gainKg: r2(gain), days: Math.max(0, Math.round(days)) };
          if (gain <= 0) res = { ...base, fcr: null, rating: 'mala', reason: 'sin_ganancia' };
          else {
            const fcr = feedKg / gain;
            res = {
              ...base, fcr: Math.round(fcr * 100) / 100, rating: ratingFor(fcr), reason: null,
              dailyGainKg: days >= 1 ? r2(gain / q / days) : null,
            };
          }
        }
        out.set(e.id, res);
        S -= share * S; I -= share * I; D -= share * D; unknown -= share * unknown; A -= q;
        if (A < 1e-9) { A = 0; S = 0; I = 0; D = 0; unknown = 0; }
      }
    }
  }
  return out;
}

export async function exitAnalysis(env) {
  const [mv, co, ft] = await Promise.all([
    env.DB.prepare(`SELECT id, corral_id, movement, quantity, movement_at, created_at, weight_kg FROM animal_movements`).all(),
    env.DB.prepare(`SELECT id, corral_id, food_type, bultos, consumed_at, created_at, kg_per_bulto FROM feed_consumption`).all(),
    env.DB.prepare(`SELECT type, kg_per_bulto FROM food_types`).all(),
  ]);
  const kgByType = {};
  for (const t of ft.results || []) kgByType[t.type] = t.kg_per_bulto;
  return analyzeExits(mv.results || [], co.results || [], kgByType);
}
