// Requests to move animals from one corral to another.
//
// GET  /api/solicitudes            workers: their own requests · administrator: all of them (pending first)
// GET  /api/solicitudes?count=1    { pending } — how many are waiting (for the badge)
// POST /api/solicitudes            { fromCorralId, toCorralId, quantity, note? }
//        worker  -> creates a PENDING request; nothing moves until the administrator approves it
//        admin   -> the move is done right away (and recorded as approved)
// Approve / reject / cancel: POST /api/solicitudes/:id

import { requireUser, json } from '../_lib/auth.js';
import { animalsIn } from '../_lib/stock.js';
import { executeTransfer } from '../_lib/transfers.js';

export const onRequestGet = async ({ request, env }) => {
  let user;
  try {
    user = await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const isAdmin = user.role === 'admin';
  const url = new URL(request.url);
  if (url.searchParams.get('count')) {
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM transfer_requests WHERE status = 'pendiente' AND (?1 = 1 OR requested_by = ?2)`
    )
      .bind(isAdmin ? 1 : 0, user.id)
      .first();
    return json({ pending: Number(r?.n || 0) });
  }
  const rows = await env.DB.prepare(
    `SELECT t.id, t.from_corral_id AS fromCorralId, f.name AS fromName, t.to_corral_id AS toCorralId, g.name AS toName,
            t.quantity, t.note, t.status, t.requested_by AS requestedById, u.display_name AS requestedBy, t.requested_at AS requestedAt,
            r.display_name AS resolvedBy, t.resolved_at AS resolvedAt, t.decision_note AS decisionNote,
            (SELECT COALESCE(SUM(CASE WHEN m.movement='ingreso' THEN m.quantity ELSE -m.quantity END), 0)
               FROM animal_movements m WHERE m.corral_id = t.from_corral_id) AS fromAnimals
       FROM transfer_requests t
       JOIN corrales f ON f.id = t.from_corral_id
       JOIN corrales g ON g.id = t.to_corral_id
  LEFT JOIN users u ON u.id = t.requested_by
  LEFT JOIN users r ON r.id = t.resolved_by
      WHERE ?1 = 1 OR t.requested_by = ?2
      ORDER BY CASE t.status WHEN 'pendiente' THEN 0 ELSE 1 END, t.id DESC
      LIMIT 200`
  )
    .bind(isAdmin ? 1 : 0, user.id)
    .all();
  return json({ requests: rows.results || [] });
};

export const onRequestPost = async ({ request, env }) => {
  let user;
  try {
    user = await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const { fromCorralId, toCorralId, quantity, note } = (await request.json().catch(() => ({}))) || {};
  const from = Number(fromCorralId);
  const to = Number(toCorralId);
  const q = Number(quantity);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from <= 0 || to <= 0 || from === to) return json({ error: 'bad_transfer' }, 400);
  if (!Number.isInteger(q) || q <= 0) return json({ error: 'bad_quantity' }, 400);
  const cleanNote = String(note || '').trim().slice(0, 200) || null;

  const corrales = await env.DB.prepare(`SELECT id, name FROM corrales WHERE id IN (?, ?)`).bind(from, to).all();
  if ((corrales.results || []).length !== 2) return json({ error: 'corral_not_found' }, 404);
  const fromName = corrales.results.find((c) => c.id === from).name;

  // The origin must have that many animals now (it is checked again when the move is done).
  const have = await animalsIn(env, from);
  if (q > have) return json({ error: 'not_enough_animals', corral: fromName, available: Math.max(0, have) }, 400);

  const res = await env.DB.prepare(
    `INSERT INTO transfer_requests (from_corral_id, to_corral_id, quantity, note, requested_by) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(from, to, q, cleanNote, user.id)
    .run();
  const id = res.meta?.last_row_id;

  if (user.role === 'admin') {
    const r = await executeTransfer(env, { id, from_corral_id: from, to_corral_id: to, quantity: q, note: cleanNote }, user);
    if (r.error) {
      await env.DB.prepare(`UPDATE transfer_requests SET status = 'cancelada', resolved_by = ?, resolved_at = datetime('now') WHERE id = ?`).bind(user.id, id).run();
      const { status, ...body } = r;
      return json(body, status);
    }
    return json({ ok: true, id, done: true });
  }
  return json({ ok: true, id, done: false });
};
