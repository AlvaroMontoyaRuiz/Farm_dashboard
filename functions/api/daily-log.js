// GET /api/daily-log?date=YYYY-MM-DD   (defaults to today)
// Returns everything that happened that day: consumption per corral,
// animal movements, food lots received. For the admin's daily tracker.

import { requireUser, json } from '../_lib/auth.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || null; // null -> today

  const cons = await env.DB.prepare(
    `SELECT fc.id, fc.corral_id AS corralId, c.name AS corralName,
            fc.food_type AS foodType, fc.bultos, fc.note,
            u.display_name AS createdBy, fc.created_at AS createdAt
       FROM feed_consumption fc
       JOIN corrales c ON c.id = fc.corral_id
  LEFT JOIN users u ON u.id = fc.created_by
      WHERE fc.consumed_at = COALESCE(?, date('now'))
      ORDER BY fc.created_at`
  )
    .bind(date)
    .all();

  const mov = await env.DB.prepare(
    `SELECT m.id, m.corral_id AS corralId, c.name AS corralName,
            m.movement, m.quantity, m.note,
            u.display_name AS createdBy, m.created_at AS createdAt
       FROM animal_movements m
       JOIN corrales c ON c.id = m.corral_id
  LEFT JOIN users u ON u.id = m.created_by
      WHERE m.movement_at = COALESCE(?, date('now'))
      ORDER BY m.created_at`
  )
    .bind(date)
    .all();

  const lots = await env.DB.prepare(
    `SELECT f.id, f.type, f.bultos_received AS bultosReceived, f.note,
            u.display_name AS createdBy, f.created_at AS createdAt
       FROM food_lots f
  LEFT JOIN users u ON u.id = f.created_by
      WHERE f.received_at = COALESCE(?, date('now'))
      ORDER BY f.created_at`
  )
    .bind(date)
    .all();

  // per-corral totals
  const perCorral = {};
  for (const r of cons.results || []) {
    const k = r.corralId;
    perCorral[k] = perCorral[k] || { corralId: k, corralName: r.corralName, levante: 0, finalizador: 0 };
    perCorral[k][r.foodType] += Number(r.bultos);
  }

  return json({
    date: date || new Date().toISOString().slice(0, 10),
    consumption: cons.results || [],
    movements: mov.results || [],
    lots: lots.results || [],
    totalsPerCorral: Object.values(perCorral),
  });
};
