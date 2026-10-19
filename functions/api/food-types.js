// GET  /api/food-types                              — specs of each type of bulto
// POST /api/food-types { type, kgPerBulto, description? }  — admin only
//
// kg per bulto is copied onto every consumption record when it is saved, so changing it
// here only affects feedings registered from now on.

import { requireUser, requireAdmin, json } from '../_lib/auth.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const rows = await env.DB.prepare(
    `SELECT type, kg_per_bulto AS kgPerBulto, description, updated_at AS updatedAt FROM food_types ORDER BY type`
  ).all();
  return json({ types: rows.results || [] });
};

export const onRequestPost = async ({ request, env }) => {
  try {
    requireAdmin(await requireUser(request, env));
  } catch (r) {
    return r;
  }
  const { type, kgPerBulto, description } = (await request.json().catch(() => ({}))) || {};
  if (!['levante', 'finalizador'].includes(type)) return json({ error: 'bad_type' }, 400);
  const kg = Number(kgPerBulto);
  if (!Number.isFinite(kg) || kg <= 0 || kg > 200) return json({ error: 'bad_kg_per_bulto' }, 400);
  await env.DB.prepare(
    `UPDATE food_types SET kg_per_bulto = ?, description = ?, updated_at = datetime('now') WHERE type = ?`
  )
    .bind(Math.round(kg * 100) / 100, (description || '').trim().slice(0, 200) || null, type)
    .run();
  return json({ ok: true });
};
