// What a corral was fed today, per type of bulto, plus what is in storage.
// Used by the worker's tablet screen (Consumo → corral).
import { FOOD_TYPES } from './foods.js';
import { TODAY_SQL } from './time.js';
import { feedRemaining, animalsIn } from './stock.js';

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export async function todaySnapshot(env, corralId, userId) {
  const [corral, rows, kgRows, remaining, animals] = await Promise.all([
    env.DB.prepare(`SELECT id, name FROM corrales WHERE id = ?`).bind(Number(corralId)).first(),
    env.DB.prepare(
      `SELECT food_type AS t, COALESCE(SUM(bultos),0) AS total,
              COALESCE(SUM(CASE WHEN created_by = ?2 THEN bultos ELSE 0 END),0) AS mine
         FROM feed_consumption WHERE corral_id = ?1 AND consumed_at = ${TODAY_SQL} GROUP BY food_type`
    )
      .bind(Number(corralId), Number(userId))
      .all(),
    env.DB.prepare(`SELECT type, kg_per_bulto AS kg FROM food_types`).all(),
    Promise.all(FOOD_TYPES.map((t) => feedRemaining(env, t))),
    animalsIn(env, corralId),
  ]);
  if (!corral) return null;
  const by = Object.fromEntries((rows.results || []).map((r) => [r.t, r]));
  const kg = Object.fromEntries((kgRows.results || []).map((r) => [r.type, Number(r.kg)]));
  const types = {};
  FOOD_TYPES.forEach((t, i) => {
    types[t] = { today: r2(by[t]?.total), mine: r2(by[t]?.mine), stock: remaining[i], kgPerBulto: kg[t] ?? null };
  });
  return { corral: { id: corral.id, name: corral.name, animals }, types };
}
