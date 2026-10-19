// GET  /api/consumption?from=&to=&corralId=   — list consumption logs
// POST /api/consumption  { corralId, foodType, bultos, consumedAt?, note? }
//
// Posting a consumption row DOES NOT touch food_lots: remaining stock is
// computed as SUM(received) - SUM(consumed) by /api/summary. This keeps the
// write path simple and lets admins correct history without rebalancing lots.

import { requireUser, json } from '../_lib/auth.js';
import { TODAY_SQL, todayStr } from '../_lib/time.js';
import { feedRemaining, loadFeedEvents, feedKey, newNegative, isDate, nowTs } from '../_lib/stock.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const corralId = url.searchParams.get('corralId');
  const where = [];
  const binds = [];
  if (from) {
    where.push('fc.consumed_at >= ?');
    binds.push(from);
  }
  if (to) {
    where.push('fc.consumed_at <= ?');
    binds.push(to);
  }
  if (corralId) {
    where.push('fc.corral_id = ?');
    binds.push(Number(corralId));
  }
  const sql = `
    SELECT fc.id, fc.corral_id AS corralId, c.name AS corralName, fc.food_type AS foodType,
           fc.bultos, fc.kg_per_bulto AS kgPerBulto, fc.consumed_at AS consumedAt, fc.note,
           u.display_name AS createdBy, fc.created_at AS createdAt
      FROM feed_consumption fc
      JOIN corrales c ON c.id = fc.corral_id
 LEFT JOIN users u ON u.id = fc.created_by
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY fc.consumed_at DESC, fc.id DESC
     LIMIT 500`;
  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return json({ consumption: rows.results || [] });
};

export const onRequestPost = async ({ request, env }) => {
  let user;
  try {
    user = await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const { corralId, foodType, bultos, consumedAt, note } =
    (await request.json().catch(() => ({}))) || {};
  if (!corralId) return json({ error: 'corral_required' }, 400);
  if (!['levante', 'finalizador'].includes(foodType)) return json({ error: 'bad_food_type' }, 400);
  const b = Number(bultos);
  if (!Number.isFinite(b) || b <= 0) return json({ error: 'bad_bultos' }, 400);
  const today = todayStr();
  if (consumedAt && (!isDate(consumedAt) || consumedAt > today)) return json({ error: 'bad_date' }, 400);

  const corral = await env.DB.prepare(`SELECT id FROM corrales WHERE id = ?`).bind(Number(corralId)).first();
  if (!corral) return json({ error: 'corral_not_found' }, 404);

  // Rule 1: you cannot feed more bultos than there are in storage.
  const available = await feedRemaining(env, foodType);
  if (b > available + 1e-9) {
    return json({ error: 'not_enough_stock', foodType, available: Math.max(0, available) }, 400);
  }

  // Rule 2: a backdated entry must not leave an earlier day below zero.
  if (consumedAt && consumedAt < today) {
    const events = await loadFeedEvents(env);
    const hit = newNegative(events, feedKey, {
      add: { uid: 'new', id: Number.MAX_SAFE_INTEGER, type: foodType, date: consumedAt, delta: -b, createdAt: nowTs() },
    });
    if (hit) return json({ error: 'breaks_history', foodType, date: hit.split('|')[1] }, 400);
  }

  // The insert itself re-checks the stock inside one SQL statement, so two
  // workers saving at the same moment cannot both take the last bultos.
  const res = await env.DB.prepare(
    `INSERT INTO feed_consumption (corral_id, food_type, bultos, consumed_at, note, created_by, kg_per_bulto)
     SELECT ?1, ?2, ?3, COALESCE(?4, ${TODAY_SQL}), ?5, ?6, COALESCE((SELECT kg_per_bulto FROM food_types WHERE type = ?2), 40)
      WHERE (SELECT COALESCE(SUM(bultos_received),0) FROM food_lots WHERE type = ?2)
          - (SELECT COALESCE(SUM(bultos),0) FROM feed_consumption WHERE food_type = ?2) >= ?3 - 0.000001`
  )
    .bind(Number(corralId), foodType, b, consumedAt || null, note || null, user.id)
    .run();

  if (!res.meta?.changes) {
    const now = await feedRemaining(env, foodType);
    return json({ error: 'not_enough_stock', foodType, available: Math.max(0, now) }, 400);
  }
  return json({ ok: true, id: res.meta?.last_row_id });
};
