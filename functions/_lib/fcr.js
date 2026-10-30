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
// Types of exit (reason):
//   venta       rated: this is the conversion shown (Buena / Regular / Mala).
//   muerte      not rated. The feed those animals ate stays in the batch: it is spread over the
//               animals that remain, so losses raise the conversion of the group that is sold.
//   traslado    not rated. A move to another corral (approved request): the animals take their history
//               (feed eaten, entry weight, entry date) with them to the destination corral, where the
//               matching 'traslado' entry picks it up. They are rated only when they are finally sold.
//   enfermeria  not rated. The animals leave the corral count but keep their history (feed eaten,
//               entry weight, entry date) in an infirmary pool until a 'regreso_enfermeria' entry
//               brings them back.
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
  // One timeline for the whole farm, because a traslado (move between corrales) hands the history of
  // the animals from one corral to another. Inside each corral the order is the same as always.
  const events = [];
  for (const m of movements) {
    const isMove = m.reason === 'traslado';
    events.push({
      corral: m.corral_id,
      // a traslado entry is processed after its exit even if both share the same second
      kind: m.movement === 'ingreso' ? (isMove ? 3 : 0) : 2,
      date: m.movement_at, at: m.created_at || '', id: m.id, tid: m.transfer_id ?? null,
      q: Number(m.quantity), w: m.weight_kg == null ? null : Number(m.weight_kg),
      reason: m.movement === 'salida' ? m.reason || 'venta' : m.reason || null,
    });
  }
  for (const c of consumption) {
    const kgb = c.kg_per_bulto ?? kgByType[c.food_type] ?? DEFAULT_KG_PER_BULTO;
    events.push({ corral: c.corral_id, kind: 1, date: c.consumed_at, at: c.created_at || '', id: c.id, kg: Number(c.bultos) * Number(kgb) });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at) || a.kind - b.kind || a.id - b.id);

  const out = new Map();
  const states = new Map();
  const moving = new Map(); // transfer id -> history of the animals on their way to another corral
  const stateOf = (corral) => {
    if (!states.has(corral)) {
      states.set(corral, {
        A: 0, I: 0, S: 0, D: 0, unknown: 0, c: 0,
        Q: { n: 0, feed: 0, init: 0, day: 0, unknown: 0 }, // animals in the infirmary, with their history
      });
    }
    return states.get(corral);
  };

  for (const e of events) {
    const st = stateOf(e.corral);
    const Q = st.Q;
    if (e.kind === 0 || e.kind === 3) {
      if (e.reason === 'regreso_enfermeria' && Q.n > 1e-9) {
        // Back from the infirmary: they come back with the history they left with.
        const q = Math.min(e.q, Q.n);
        const sh = q / Q.n;
        st.S += q * st.c - sh * Q.feed;
        st.I += sh * Q.init;
        st.D += sh * Q.day;
        st.unknown += sh * Q.unknown;
        st.A += q;
        Q.feed -= sh * Q.feed; Q.init -= sh * Q.init; Q.day -= sh * Q.day; Q.unknown -= sh * Q.unknown; Q.n -= q;
        if (Q.n < 1e-9) { Q.n = 0; Q.feed = 0; Q.init = 0; Q.day = 0; Q.unknown = 0; }
      } else if (e.reason === 'traslado' && moving.has(e.tid)) {
        // Arrived from another corral: they bring the feed they already ate, their entry weight and entry date.
        const p = moving.get(e.tid);
        moving.delete(e.tid);
        const q = Math.min(e.q, p.n);
        const sh = p.n > 0 ? q / p.n : 1;
        st.S += q * st.c - sh * p.feed;
        st.I += sh * p.init;
        st.D += sh * p.day;
        st.unknown += sh * p.unknown;
        st.A += q;
      } else {
        st.S += e.q * st.c;
        st.D += e.q * dayNo(e.date);
        st.A += e.q;
        if (e.w == null) st.unknown += e.q; else st.I += e.w;
      }
    } else if (e.kind === 1) {
      if (st.A > 0) st.c += e.kg / st.A; // feed given to an empty corral is not charged to anyone
    } else {
      if (st.A <= 0) continue;
      const { A, I, S, D, unknown, c } = st;
      const q = Math.min(e.q, A);
      const share = q / A;
      const feedKg = Math.max(0, q * (c - S / A));
      const initialKg = share * I;
      const days = dayNo(e.date) - D / A;
      let res;
      if (e.reason === 'muerte' || e.reason === 'enfermeria' || e.reason === 'traslado') {
        res = { fcr: null, rating: null, reason: 'no_aplica', type: e.reason, animals: q, feedKg: r2(feedKg) };
      } else if (e.w == null || unknown > 1e-9) {
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
      const leftI = share * I, leftD = share * D, leftU = share * unknown;
      st.S -= share * S; st.I -= leftI; st.D -= leftD; st.unknown -= leftU; st.A -= q;
      if (e.reason === 'enfermeria') {
        Q.n += q; Q.feed += feedKg; Q.init += leftI; Q.day += leftD; Q.unknown += leftU;
      } else if (e.reason === 'traslado') {
        moving.set(e.tid, { n: q, feed: feedKg, init: leftI, day: leftD, unknown: leftU });
      } else if (e.reason === 'muerte' && st.A > 1e-9) {
        st.S -= feedKg; // the dead animals' feed is carried by those that remain
      }
      if (st.A < 1e-9) { st.A = 0; st.S = 0; st.I = 0; st.D = 0; st.unknown = 0; }
    }
  }
  return out;
}

export async function exitAnalysis(env) {
  const [mv, co, ft] = await Promise.all([
    env.DB.prepare(`SELECT id, corral_id, movement, quantity, movement_at, created_at, weight_kg, reason, transfer_id FROM animal_movements`).all(),
    env.DB.prepare(`SELECT id, corral_id, food_type, bultos, consumed_at, created_at, kg_per_bulto FROM feed_consumption`).all(),
    env.DB.prepare(`SELECT type, kg_per_bulto FROM food_types`).all(),
  ]);
  const kgByType = {};
  for (const t of ft.results || []) kgByType[t.type] = t.kg_per_bulto;
  return analyzeExits(mv.results || [], co.results || [], kgByType);
}
