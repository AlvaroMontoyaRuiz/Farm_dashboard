// GET  /api/food-lots            — list recent lots (newest first)
// POST /api/food-lots            — admin only: register new bultos received
//   { type: 'levante'|'finalizador', bultosReceived, receivedAt?, note? }

import { requireUser, requireAdmin, json } from '../_lib/auth.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
  const rows = await env.DB.prepare(
    `SELECT f.id, f.type, f.bultos_received AS bultosReceived, f.received_at AS receivedAt,
            f.note, u.display_name AS createdBy, f.created_at AS createdAt
       FROM food_lots f LEFT JOIN users u ON u.id = f.created_by
      ORDER BY f.received_at DESC, f.id DESC LIMIT ?`
  )
    .bind(limit)
    .all();
  return json({ lots: rows.results || [] });
};

export const onRequestPost = async ({ request, env }) => {
  let user;
  try {
    user = await requireUser(request, env);
    requireAdmin(user);
  } catch (r) {
    return r;
  }
  const { type, bultosReceived, receivedAt, note } = (await request.json().catch(() => ({}))) || {};
  if (!['levante', 'finalizador'].includes(type)) return json({ error: 'bad_type' }, 400);
  const n = Number(bultosReceived);
  if (!Number.isFinite(n) || n <= 0) return json({ error: 'bad_quantity' }, 400);

  const res = await env.DB.prepare(
    `INSERT INTO food_lots (type, bultos_received, received_at, note, created_by)
     VALUES (?, ?, COALESCE(?, date('now','-5 hours')), ?, ?)`
  )
    .bind(type, Math.round(n), receivedAt || null, note || null, user.id)
    .run();

  return json({ ok: true, id: res.meta?.last_row_id });
};
