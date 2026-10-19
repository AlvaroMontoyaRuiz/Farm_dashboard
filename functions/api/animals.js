// GET  /api/animals?corralId=&from=&to=   — list movements (filterable)
// POST /api/animals  { corralId, movement:'ingreso'|'salida', quantity, movementAt?, note? }

import { requireUser, json } from '../_lib/auth.js';
import { TODAY_SQL, todayStr } from '../_lib/time.js';
import { animalsIn, loadAnimalEvents, animalKey, newNegative, isDate, nowTs } from '../_lib/stock.js';

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
  const today = todayStr();
  if (movementAt && (!isDate(movementAt) || movementAt > today)) return json({ error: 'bad_date' }, 400);

  const corral = await env.DB.prepare(`SELECT id, name FROM corrales WHERE id = ?`).bind(Number(corralId)).first();
  if (!corral) return json({ error: 'corral_not_found' }, 404);

  if (movement === 'salida') {
    // Rule 1: you cannot take out more animals than the corral has.
    const have = await animalsIn(env, corral.id);
    if (q > have) return json({ error: 'not_enough_animals', corral: corral.name, available: Math.max(0, have) }, 400);

    // Rule 2: a backdated exit must not leave an earlier day below zero.
    if (movementAt && movementAt < today) {
      const events = await loadAnimalEvents(env, corral.id);
      const hit = newNegative(events, animalKey, {
        add: { uid: 'new', id: Number.MAX_SAFE_INTEGER, corral: corral.id, date: movementAt, delta: -q, createdAt: nowTs() },
      });
      if (hit) return json({ error: 'breaks_history', scope: 'animals', corral: corral.name, date: hit.split('|')[1] }, 400);
    }

    // Re-checked inside the INSERT so two simultaneous exits cannot both succeed.
    const res = await env.DB.prepare(
      `INSERT INTO animal_movements (corral_id, movement, quantity, movement_at, note, created_by)
       SELECT ?1, 'salida', ?2, COALESCE(?3, ${TODAY_SQL}), ?4, ?5
        WHERE (SELECT COALESCE(SUM(CASE WHEN movement='ingreso' THEN quantity ELSE -quantity END), 0)
                 FROM animal_movements WHERE corral_id = ?1) >= ?2`
    )
      .bind(corral.id, q, movementAt || null, note || null, user.id)
      .run();
    if (!res.meta?.changes) {
      const now = await animalsIn(env, corral.id);
      return json({ error: 'not_enough_animals', corral: corral.name, available: Math.max(0, now) }, 400);
    }
    return json({ ok: true, id: res.meta?.last_row_id });
  }

  const res = await env.DB.prepare(
    `INSERT INTO animal_movements (corral_id, movement, quantity, movement_at, note, created_by)
     VALUES (?, 'ingreso', ?, COALESCE(?, ${TODAY_SQL}), ?, ?)`
  )
    .bind(corral.id, q, movementAt || null, note || null, user.id)
    .run();
  return json({ ok: true, id: res.meta?.last_row_id });
};
