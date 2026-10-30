// GET /api/stock
// What is available right now, so the forms can show it and stop mistakes
// before they are sent:  { stock: { levante, engorde, finalizador }, animals: { [corralId]: n }, infirmary: { [corralId]: n } }

import { requireUser, json } from '../_lib/auth.js';
import { feedRemaining, infirmaryByCorral } from '../_lib/stock.js';
import { FOOD_TYPES } from '../_lib/foods.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const [remaining, animals, infirmary] = await Promise.all([
    Promise.all(FOOD_TYPES.map((t) => feedRemaining(env, t))),
    env.DB.prepare(
      `SELECT c.id, COALESCE(SUM(CASE WHEN m.movement='ingreso' THEN m.quantity ELSE -m.quantity END), 0) AS n
         FROM corrales c LEFT JOIN animal_movements m ON m.corral_id = c.id GROUP BY c.id`
    ).all(),
    infirmaryByCorral(env),
  ]);
  const byCorral = {};
  for (const r of animals.results || []) byCorral[r.id] = Number(r.n);
  const stock = Object.fromEntries(FOOD_TYPES.map((t, i) => [t, remaining[i]]));
  return json({ stock, animals: byCorral, infirmary });
};
