// GET /api/consumption/corrales
// Everything the feeding screen needs to draw one tile per corral: animals, today's bultos, fed today?
// Open to workers (they do not get the Panel).

import { requireUser, json } from '../../_lib/auth.js';
import { TODAY_SQL } from '../../_lib/time.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const rows = await env.DB.prepare(
    `SELECT c.id, c.name, l.name AS lote,
            COALESCE((SELECT SUM(CASE WHEN m.movement='ingreso' THEN m.quantity ELSE -m.quantity END) FROM animal_movements m WHERE m.corral_id = c.id), 0) AS animals,
            COALESCE((SELECT SUM(f.bultos) FROM feed_consumption f WHERE f.corral_id = c.id AND f.consumed_at = ${TODAY_SQL}), 0) AS todayBultos,
            (SELECT COUNT(*) FROM feed_consumption f WHERE f.corral_id = c.id AND f.consumed_at = ${TODAY_SQL}) AS entriesToday
       FROM corrales c LEFT JOIN lotes l ON l.id = c.lote_id
      ORDER BY c.id`
  ).all();
  const corrales = (rows.results || []).map((c) => ({
    id: c.id,
    name: c.name,
    lote: c.lote || null,
    animals: Number(c.animals),
    todayBultos: Math.round(Number(c.todayBultos) * 100) / 100,
    fedToday: Number(c.entriesToday) > 0,
  }));
  return json({ corrales });
};
