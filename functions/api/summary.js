// GET /api/summary
// Returns the top-of-dashboard numbers:
//   - bultos remaining in storage (per food type)
//   - total animals and animals per corral
//   - today's total consumption

import { requireUser, json } from '../_lib/auth.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    await requireUser(request, env);
  } catch (r) {
    return r;
  }

  // bultos remaining = received - consumed, per type
  const receivedRows = await env.DB.prepare(
    `SELECT type, COALESCE(SUM(bultos_received), 0) AS r FROM food_lots GROUP BY type`
  ).all();
  const consumedRows = await env.DB.prepare(
    `SELECT food_type AS type, COALESCE(SUM(bultos), 0) AS c FROM feed_consumption GROUP BY food_type`
  ).all();

  const received = { levante: 0, finalizador: 0 };
  for (const r of receivedRows.results || []) received[r.type] = r.r;
  const consumed = { levante: 0, finalizador: 0 };
  for (const r of consumedRows.results || []) consumed[r.type] = r.c;
  const remaining = {
    levante: +(received.levante - consumed.levante).toFixed(2),
    finalizador: +(received.finalizador - consumed.finalizador).toFixed(2),
  };

  // animals per corral = sum(ingreso) - sum(salida)
  const headcount = await env.DB.prepare(
    `SELECT c.id, c.name,
            COALESCE(SUM(CASE WHEN m.movement='ingreso' THEN m.quantity ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN m.movement='salida'  THEN m.quantity ELSE 0 END), 0) AS animals
       FROM corrales c
  LEFT JOIN animal_movements m ON m.corral_id = c.id
   GROUP BY c.id ORDER BY c.id`
  ).all();

  const totalAnimals = (headcount.results || []).reduce((s, r) => s + Number(r.animals), 0);

  // today's consumption
  const today = await env.DB.prepare(
    `SELECT food_type, COALESCE(SUM(bultos), 0) AS b
       FROM feed_consumption WHERE consumed_at = date('now','-5 hours') GROUP BY food_type`
  ).all();
  const todayCons = { levante: 0, finalizador: 0 };
  for (const r of today.results || []) todayCons[r.food_type] = r.b;

  return json({
    inventory: { received, consumed, remaining },
    totalAnimals,
    corrales: headcount.results || [],
    todayConsumption: todayCons,
  });
};
