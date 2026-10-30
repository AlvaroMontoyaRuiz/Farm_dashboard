// GET /api/camadas — admin only. Batches (camadas) and mortality per lote.
//   lotes   : one entry per lote with its whole-history mortality and its current batch
//   batches : every batch of every lote, newest first
// See _lib/batches.js for what a batch is.

import { requireUser, requireAdmin, json } from '../_lib/auth.js';
import { todayStr } from '../_lib/time.js';
import { loadBatches, totalsOf } from '../_lib/batches.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    requireAdmin(await requireUser(request, env));
  } catch (r) {
    return r;
  }
  const today = todayStr();
  const [byLote, lotesRes] = await Promise.all([loadBatches(env, today), env.DB.prepare(`SELECT id, name FROM lotes ORDER BY id`).all()]);

  const lotes = [];
  const batches = [];
  for (const l of lotesRes.results || []) {
    const list = byLote.get(l.id) || [];
    lotes.push({ id: l.id, name: l.name, ...totalsOf(list), current: list.find((b) => b.open) || null });
    for (const b of list) batches.push({ ...b, loteId: l.id, loteName: l.name });
  }
  // newest first: open batches on top, then by end date
  batches.sort((a, b) => (b.open ? 1 : 0) - (a.open ? 1 : 0) || String(b.end || '').localeCompare(String(a.end || '')) || b.start.localeCompare(a.start));
  return json({ today, lotes, batches });
};
