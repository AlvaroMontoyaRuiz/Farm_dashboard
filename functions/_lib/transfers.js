// Moving animals from one corral to another (traslado).
//
// A move is stored as TWO animal movements that share transfer_id = the request id:
//   an exit  (reason 'traslado') from the origin corral, and
//   an entry (reason 'traslado') to the destination corral.
// Neither is a sale or a new batch: the feed-conversion engine hands the animals' history (feed eaten,
// entry weight, entry date) from the origin to the destination, so they are rated only when sold.
//
// executeTransfer is the ONE place that makes a move happen. It runs as a single batch whose statements
// each check what they need, so it cannot half-happen, cannot run twice and cannot take more animals than
// the origin corral has.

import { TODAY_SQL } from './time.js';
import { animalsIn } from './stock.js';

export async function executeTransfer(env, req, approver, decisionNote = null) {
  const db = env.DB;
  const [from, to] = await Promise.all([
    db.prepare(`SELECT id, name FROM corrales WHERE id = ?`).bind(req.from_corral_id).first(),
    db.prepare(`SELECT id, name FROM corrales WHERE id = ?`).bind(req.to_corral_id).first(),
  ]);
  if (!from || !to) return { error: 'corral_not_found', status: 404 };
  const extra = req.note ? ` · ${req.note}` : '';
  const insert = (corral, movement, note, where) =>
    db
      .prepare(
        `INSERT INTO animal_movements (corral_id, movement, quantity, movement_at, note, created_by, weight_kg, reason, transfer_id)
         SELECT ?1, ?2, ?3, ${TODAY_SQL}, ?4, ?5, NULL, 'traslado', ?6 WHERE ${where}`
      )
      .bind(corral, movement, req.quantity, note, approver.id, req.id);

  const results = await db.batch([
    // 1) out of the origin: only while the request is pending and the corral still has the animals
    insert(
      from.id,
      'salida',
      `Traslado a ${to.name}${extra}`,
      `EXISTS (SELECT 1 FROM transfer_requests WHERE id = ?6 AND status = 'pendiente')
       AND (SELECT COALESCE(SUM(CASE WHEN movement='ingreso' THEN quantity ELSE -quantity END), 0)
              FROM animal_movements WHERE corral_id = ?1) >= ?3`
    ),
    // 2) into the destination: only if the exit happened
    insert(
      to.id,
      'ingreso',
      `Traslado desde ${from.name}${extra}`,
      `EXISTS (SELECT 1 FROM animal_movements WHERE transfer_id = ?6 AND movement = 'salida')
       AND NOT EXISTS (SELECT 1 FROM animal_movements WHERE transfer_id = ?6 AND movement = 'ingreso')`
    ),
    // 3) mark the request approved, only if both halves exist
    db
      .prepare(
        `UPDATE transfer_requests SET status = 'aprobada', resolved_by = ?2, resolved_at = datetime('now'), decision_note = ?3
          WHERE id = ?1 AND status = 'pendiente'
            AND (SELECT COUNT(*) FROM animal_movements WHERE transfer_id = ?1) = 2`
      )
      .bind(req.id, approver.id, decisionNote),
  ]);

  if (results[2]?.meta?.changes) return { ok: true };
  // Nothing happened (or only half, which cannot be: statement 2 needs statement 1). Say why.
  const now = await db.prepare(`SELECT status FROM transfer_requests WHERE id = ?`).bind(req.id).first();
  if (now && now.status !== 'pendiente') return { error: 'already_resolved', status: 409 };
  return { error: 'not_enough_animals', status: 400, corral: from.name, available: Math.max(0, await animalsIn(env, from.id)) };
}
