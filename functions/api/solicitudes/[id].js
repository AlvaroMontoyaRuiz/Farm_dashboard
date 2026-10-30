// POST /api/solicitudes/:id   { action: 'approve' | 'reject' | 'cancel', note? }
//   approve  administrator: the animals are moved now (see _lib/transfers.js)
//   reject   administrator: nothing moves; the note tells the worker why
//   cancel   the person who asked (or the administrator), while it is still pending

import { requireUser, json } from '../../_lib/auth.js';
import { executeTransfer } from '../../_lib/transfers.js';

export const onRequestPost = async ({ request, env, params }) => {
  let user;
  try {
    user = await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'bad_id' }, 400);
  const { action, note } = (await request.json().catch(() => ({}))) || {};
  const cleanNote = String(note || '').trim().slice(0, 200) || null;
  const isAdmin = user.role === 'admin';

  const req = await env.DB.prepare(`SELECT * FROM transfer_requests WHERE id = ?`).bind(id).first();
  if (!req) return json({ error: 'not_found' }, 404);

  if (action === 'approve') {
    if (!isAdmin) return json({ error: 'admin_only' }, 403);
    if (req.status !== 'pendiente') return json({ error: 'already_resolved' }, 409);
    const r = await executeTransfer(env, req, user, cleanNote);
    if (r.error) {
      const { status, ...body } = r;
      return json(body, status);
    }
    return json({ ok: true });
  }

  if (action === 'reject' || action === 'cancel') {
    if (action === 'reject' && !isAdmin) return json({ error: 'admin_only' }, 403);
    if (action === 'cancel' && !isAdmin && req.requested_by !== user.id) return json({ error: 'not_your_record' }, 403);
    const res = await env.DB.prepare(
      `UPDATE transfer_requests SET status = ?2, resolved_by = ?3, resolved_at = datetime('now'), decision_note = ?4
        WHERE id = ?1 AND status = 'pendiente'`
    )
      .bind(id, action === 'reject' ? 'rechazada' : 'cancelada', user.id, cleanNote)
      .run();
    if (!res.meta?.changes) return json({ error: 'already_resolved' }, 409);
    return json({ ok: true });
  }

  return json({ error: 'bad_request' }, 400);
};
