// POST /api/consumption/adjust  { corralId, foodType, delta }
//
// The + and − buttons of the tablet screen. delta > 0 adds that many bultos to today's feeding of the
// corral, delta < 0 takes them off (steps of ½ bulto).
//
//   + Adds to the record this person already made today for that corral and type, or creates it, so
//     ten taps are one line ("Pedro: 10 bultos"), not ten. Same stock rule as always: it cannot exceed
//     what is in storage (checked inside the SQL, so two people tapping together cannot both take the last bulto).
//   − Takes bultos off the most recent record of today. Workers can only take off their own; the
//     administrator can take off anyone's. Whatever is taken off is copied to the deletion history.
//
// Returns the new snapshot of the corral, same as GET /api/consumption/today.

import { requireUser, json } from '../../_lib/auth.js';
import { TODAY_SQL } from '../../_lib/time.js';
import { isFoodType } from '../../_lib/foods.js';
import { feedRemaining } from '../../_lib/stock.js';
import { todaySnapshot } from '../../_lib/consumo.js';

const EPS = 1e-9;

export const onRequestPost = async ({ request, env }) => {
  let user;
  try {
    user = await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const { corralId, foodType, delta } = (await request.json().catch(() => ({}))) || {};
  const cid = Number(corralId);
  const d = Number(delta);
  if (!Number.isInteger(cid) || cid <= 0) return json({ error: 'corral_required' }, 400);
  if (!isFoodType(foodType)) return json({ error: 'bad_food_type' }, 400);
  if (!Number.isFinite(d) || d === 0 || Math.abs(d) > 50 || Math.abs(d * 2 - Math.round(d * 2)) > EPS) {
    return json({ error: 'bad_bultos' }, 400);
  }
  const corral = await env.DB.prepare(`SELECT id FROM corrales WHERE id = ?`).bind(cid).first();
  if (!corral) return json({ error: 'corral_not_found' }, 404);
  const db = env.DB;

  if (d > 0) {
    const noStock = async () => json({ error: 'not_enough_stock', foodType, available: Math.max(0, await feedRemaining(env, foodType)) }, 400);
    const mine = await db
      .prepare(
        `SELECT id FROM feed_consumption
          WHERE corral_id = ?1 AND food_type = ?2 AND consumed_at = ${TODAY_SQL} AND created_by = ?3
          ORDER BY id DESC LIMIT 1`
      )
      .bind(cid, foodType, user.id)
      .first();
    // both branches re-check the stock in the same statement
    const enough = `(SELECT COALESCE(SUM(bultos_received),0) FROM food_lots WHERE type = ?2)
                  - (SELECT COALESCE(SUM(bultos),0) FROM feed_consumption WHERE food_type = ?2) >= ?3 - 0.000001`;
    const res = mine
      ? await db
          .prepare(`UPDATE feed_consumption SET bultos = bultos + ?3 WHERE id = ?1 AND ${enough}`)
          .bind(mine.id, foodType, d)
          .run()
      : await db
          .prepare(
            `INSERT INTO feed_consumption (corral_id, food_type, bultos, consumed_at, created_by, kg_per_bulto)
             SELECT ?1, ?2, ?3, ${TODAY_SQL}, ?4, COALESCE((SELECT kg_per_bulto FROM food_types WHERE type = ?2), 40)
              WHERE ${enough}`
          )
          .bind(cid, foodType, d, user.id)
          .run();
    if (!res.meta?.changes) return noStock();
  } else {
    const isAdmin = user.role === 'admin';
    const rows =
      (
        await db
          .prepare(
            `SELECT * FROM feed_consumption
              WHERE corral_id = ?1 AND food_type = ?2 AND consumed_at = ${TODAY_SQL} AND (?4 = 1 OR created_by = ?3)
              ORDER BY id DESC`
          )
          .bind(cid, foodType, user.id, isAdmin ? 1 : 0)
          .all()
      ).results || [];
    if (!rows.length) {
      const others = await db
        .prepare(`SELECT 1 AS x FROM feed_consumption WHERE corral_id = ? AND food_type = ? AND consumed_at = ${TODAY_SQL} LIMIT 1`)
        .bind(cid, foodType)
        .first();
      return json({ error: others ? 'not_your_record' : 'nothing_to_remove' }, others ? 403 : 400);
    }

    let left = -d;
    const stmts = [];
    const log = (row, bultos, reason) =>
      db
        .prepare(`INSERT INTO deletion_log (table_name, record_id, payload_json, deleted_by, reason) VALUES ('feed_consumption', ?, ?, ?, ?)`)
        .bind(row.id, JSON.stringify({ ...row, bultos }), user.id, reason);
    for (const row of rows) {
      if (left <= EPS) break;
      const take = Math.min(left, Number(row.bultos));
      if (Number(row.bultos) - take <= EPS) {
        stmts.push(log(row, Number(row.bultos), 'Se quitó con el botón −'));
        stmts.push(db.prepare(`DELETE FROM feed_consumption WHERE id = ?`).bind(row.id));
      } else {
        stmts.push(log(row, take, 'Se quitó una parte con el botón −'));
        stmts.push(db.prepare(`UPDATE feed_consumption SET bultos = bultos - ? WHERE id = ?`).bind(take, row.id));
      }
      left -= take;
    }
    await db.batch(stmts);
  }

  return json({ ok: true, ...(await todaySnapshot(env, cid, user.id)) });
};
