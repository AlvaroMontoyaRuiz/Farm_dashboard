// GET  /api/animals?corralId=&from=&to=   — list movements (filterable)
// POST /api/animals  { corralId, movement:'ingreso'|'salida', quantity, movementAt?, note? }

import { requireUser, json } from '../_lib/auth.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const url = new URL(request.url);
  const corralId = url.searchParams.get('corralId');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const where = [];
  const binds = [];
  if (corralId) {
    where.push('m.corral_id = ?');
    binds.push(Number(corralId));
  }
  if (from) {
    where.push('m.movement_at >= ?');
    binds.push(from);
  }
  if (to) {
    where.push('m.movement_at <= ?');
    binds.push(to);
  }
  const sql = `
    SELECT m.id, m.corral_id AS corralId, c.name AS corralName, m.movement,
           m.quantity, m.movement_at AS movementAt, m.note,
           u.display_name AS createdBy, m.created_at AS createdAt
      FROM animal_movements m
      JOIN corrales c ON c.id = m.corral_id
 LEFT JOIN users u ON u.id = m.created_by
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY m.movement_at DESC, m.id DESC
     LIMIT 500`;
  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return json({ movements: rows.results || [] });
};

export const onRequestPost = async ({ request, env }) => {
  let user;
  try {
    user = await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const { corralId, movement, quantity, movementAt, note } =
    (await request.json().catch(() => ({}))) || {};
  if (!corralId) return json({ error: 'corral_required' }, 400);
  if (!['ingreso', 'salida'].includes(movement)) return json({ error: 'bad_movement' }, 400);
  const q = Number(quantity);
  if (!Number.isInteger(q) || q <= 0) return json({ error: 'bad_quantity' }, 400);

  // For 'salida', make sure we don't go below zero. (Headcount is cheap to
  // recompute in SQL for one corral.)
  if (movement === 'salida') {
    const row = await env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN movement='ingreso' THEN quantity ELSE -quantity END), 0) AS n
         FROM animal_movements WHERE corral_id = ?`
    )
      .bind(Number(corralId))
      .first();
    if ((row?.n || 0) - q < 0) return json({ error: 'not_enough_animals' }, 400);
  }

  const res = await env.DB.prepare(
    `INSERT INTO animal_movements (corral_id, movement, quantity, movement_at, note, created_by)
     VALUES (?, ?, ?, COALESCE(?, date('now','-5 hours')), ?, ?)`
  )
    .bind(Number(corralId), movement, q, movementAt || null, note || null, user.id)
    .run();

  return json({ ok: true, id: res.meta?.last_row_id });
};
