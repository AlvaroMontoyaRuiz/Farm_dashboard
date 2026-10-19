// GET /api/stock
// What is available right now, so the forms can show it and stop mistakes
// before they are sent:  { stock: { levante, finalizador }, animals: { [corralId]: n } }

import { requireUser, json } from '../_lib/auth.js';
import { feedRemaining } from '../_lib/stock.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const [levante, finalizador, animals] = await Promise.all([
    feedRemaining(env, 'levante'),
    feedRemaining(env, 'finalizador'),
    env.DB.prepare(
      `SELECT c.id, COALESCE(SUM(CASE WHEN m.movement='ingreso' THEN m.quantity ELSE -m.quantity END), 0) AS n
         FROM corrales c LEFT JOIN animal_movements m ON m.corral_id = c.id GROUP BY c.id`
    ).all(),
  ]);
  const byCorral = {};
  for (const r of animals.results || []) byCorral[r.id] = Number(r.n);
  return json({ stock: { levante, finalizador }, animals: byCorral });
};
