// GET  /api/food-lots            — admin: list recent deliveries (newest first), with their cost
// POST /api/food-lots            — admin only: register new bultos received
//   { type, bultosReceived, pricePerBulto, receivedAt?, note? }
//
// pricePerBulto is the price of ONE bulto WITHOUT IVA (COP). The IVA (5%) and the totals are
// calculated here, never stored, so they always agree with the price.

import { requireUser, requireAdmin, json } from '../_lib/auth.js';
import { isFoodType, costOf } from '../_lib/foods.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    requireAdmin(await requireUser(request, env));
  } catch (r) {
    return r;
  }
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
  const rows = await env.DB.prepare(
    `SELECT f.id, f.type, f.bultos_received AS bultosReceived, f.price_per_bulto AS pricePerBulto,
            f.received_at AS receivedAt, f.note, u.display_name AS createdBy, f.created_at AS createdAt
       FROM food_lots f LEFT JOIN users u ON u.id = f.created_by
      ORDER BY f.received_at DESC, f.id DESC LIMIT ?`
  )
    .bind(limit)
    .all();
  const lots = (rows.results || []).map((r) => ({ ...r, cost: costOf(r.bultosReceived, r.pricePerBulto) }));
  return json({ lots });
};

export const onRequestPost = async ({ request, env }) => {
  let user;
  try {
    user = await requireUser(request, env);
    requireAdmin(user);
  } catch (r) {
    return r;
  }
  const { type, bultosReceived, pricePerBulto, receivedAt, note } = (await request.json().catch(() => ({}))) || {};
  if (!isFoodType(type)) return json({ error: 'bad_type' }, 400);
  const n = Number(bultosReceived);
  if (!Number.isFinite(n) || n <= 0) return json({ error: 'bad_quantity' }, 400);
  const price = Number(pricePerBulto);
  if (pricePerBulto === '' || pricePerBulto == null || !Number.isFinite(price) || price <= 0 || price > 100000000) {
    return json({ error: 'bad_price' }, 400);
  }

  const res = await env.DB.prepare(
    `INSERT INTO food_lots (type, bultos_received, price_per_bulto, received_at, note, created_by)
     VALUES (?, ?, ?, COALESCE(?, date('now','-5 hours')), ?, ?)`
  )
    .bind(type, Math.round(n), Math.round(price * 100) / 100, receivedAt || null, note || null, user.id)
    .run();

  return json({ ok: true, id: res.meta?.last_row_id });
};
