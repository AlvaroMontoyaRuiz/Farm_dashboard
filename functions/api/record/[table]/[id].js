// DELETE /api/record/:table/:id   { reason? }
// Allowed tables: feed_consumption, animal_movements, food_lots.
// Copies the row into deletion_log, then removes it. Workers can delete
// their own rows; admin can delete anyone's.

import { requireUser, json } from '../../../_lib/auth.js';
import { loadFeedEvents, feedKey, loadAnimalEvents, animalKey, newNegative } from '../../../_lib/stock.js';

const ALLOWED = new Set(['feed_consumption', 'animal_movements', 'food_lots']);

export const onRequestDelete = async ({ request, env, params }) => {
  let user;
  try {
    user = await requireUser(request, env);
  } catch (r) {
    return r;
  }

  const table = params.table;
  const id = Number(params.id);
  if (!ALLOWED.has(table)) return json({ error: 'bad_table' }, 400);
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'bad_id' }, 400);

  const { reason } = await request.json().catch(() => ({}));

  const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
  if (!row) return json({ error: 'not_found' }, 404);

  if (user.role !== 'admin' && row.created_by !== user.id) {
    return json({ error: 'not_your_record' }, 403);
  }

  // Deleting something that ADDED stock (a delivery, an animal entry) can leave
  // the balance negative if that stock was already used. Deleting consumption or
  // an exit only gives stock back, so it is always allowed.
  if (table === 'food_lots') {
    const hit = newNegative(await loadFeedEvents(env), feedKey, { removeUid: `food_lots:${id}` });
    if (hit) return json({ error: 'would_go_negative', scope: 'food', foodType: hit.split('|')[0], date: hit.split('|')[1] }, 409);
  }
  if (table === 'animal_movements' && row.movement === 'ingreso') {
    const hit = newNegative(await loadAnimalEvents(env, row.corral_id), animalKey, { removeUid: `animal_movements:${id}` });
    if (hit) return json({ error: 'would_go_negative', scope: 'animals', date: hit.split('|')[1] }, 409);
  }

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO deletion_log (table_name, record_id, payload_json, deleted_by, reason)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(table, id, JSON.stringify(row), user.id, reason || null),
    env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id),
  ]);

  return json({ ok: true });
};
