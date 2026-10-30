// Lotes = groups of corrales (for example "Lote 1" = corrales 7, 5, 9 and 2).
//
// GET  /api/lotes                         — everyone: lotes and which corral belongs to which
// POST /api/lotes  (admin only), one of:
//   { op: 'create', name }                — new empty lote
//   { op: 'rename', id, name }
//   { op: 'delete', id }                  — only when it has no corrales
//   { op: 'assign', corralId, loteId }    — move a corral into a lote (loteId null = sin lote)
//
// The animals of a lote are not stored: the Panel adds up the animals of its corrales.

import { requireUser, requireAdmin, json } from '../_lib/auth.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const [lotes, corrales] = await Promise.all([
    env.DB.prepare(`SELECT id, name FROM lotes ORDER BY id`).all(),
    env.DB.prepare(`SELECT id, name, lote_id AS loteId FROM corrales ORDER BY id`).all(),
  ]);
  return json({ lotes: lotes.results || [], corrales: corrales.results || [] });
};

const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim();

export const onRequestPost = async ({ request, env }) => {
  try {
    requireAdmin(await requireUser(request, env));
  } catch (r) {
    return r;
  }
  const body = (await request.json().catch(() => ({}))) || {};
  const db = env.DB;

  const lote = async (id) => (Number.isInteger(Number(id)) ? db.prepare(`SELECT id, name FROM lotes WHERE id = ?`).bind(Number(id)).first() : null);

  if (body.op === 'create' || body.op === 'rename') {
    const name = cleanName(body.name);
    if (!name || name.length > 40) return json({ error: 'bad_lote_name' }, 400);
    const dup = await db
      .prepare(`SELECT id FROM lotes WHERE lower(name) = lower(?) AND id <> ?`)
      .bind(name, body.op === 'rename' ? Number(body.id) : 0)
      .first();
    if (dup) return json({ error: 'lote_name_taken' }, 409);
    if (body.op === 'create') {
      const res = await db.prepare(`INSERT INTO lotes (name) VALUES (?)`).bind(name).run();
      return json({ ok: true, id: res.meta?.last_row_id });
    }
    if (!(await lote(body.id))) return json({ error: 'lote_not_found' }, 404);
    await db.prepare(`UPDATE lotes SET name = ? WHERE id = ?`).bind(name, Number(body.id)).run();
    return json({ ok: true });
  }

  if (body.op === 'delete') {
    if (!(await lote(body.id))) return json({ error: 'lote_not_found' }, 404);
    const used = await db.prepare(`SELECT COUNT(*) AS n FROM corrales WHERE lote_id = ?`).bind(Number(body.id)).first();
    if (Number(used?.n) > 0) return json({ error: 'lote_not_empty' }, 409);
    await db.prepare(`DELETE FROM lotes WHERE id = ?`).bind(Number(body.id)).run();
    return json({ ok: true });
  }

  if (body.op === 'assign') {
    const corral = await db.prepare(`SELECT id FROM corrales WHERE id = ?`).bind(Number(body.corralId)).first();
    if (!corral) return json({ error: 'corral_not_found' }, 404);
    const loteId = body.loteId === null || body.loteId === '' || body.loteId === undefined ? null : Number(body.loteId);
    if (loteId !== null && !(await lote(loteId))) return json({ error: 'lote_not_found' }, 404);
    await db.prepare(`UPDATE corrales SET lote_id = ? WHERE id = ?`).bind(loteId, Number(body.corralId)).run();
    return json({ ok: true });
  }

  return json({ error: 'bad_request' }, 400);
};
