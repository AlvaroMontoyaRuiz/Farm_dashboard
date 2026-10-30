// POST /api/food-lots/:id  { pricePerBulto }  — admin only: correct the price of a delivery.
// Only the price can change here. To fix the number of bultos or the type, delete the record
// and register it again (the stock rules decide whether that is allowed).

import { requireUser, requireAdmin, json } from '../../_lib/auth.js';

export const onRequestPost = async ({ request, env, params }) => {
  try {
    requireAdmin(await requireUser(request, env));
  } catch (r) {
    return r;
  }
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ error: 'bad_id' }, 400);
  const { pricePerBulto } = (await request.json().catch(() => ({}))) || {};
  const price = Number(pricePerBulto);
  if (pricePerBulto === '' || pricePerBulto == null || !Number.isFinite(price) || price <= 0 || price > 100000000) {
    return json({ error: 'bad_price' }, 400);
  }
  const res = await env.DB.prepare(`UPDATE food_lots SET price_per_bulto = ? WHERE id = ?`)
    .bind(Math.round(price * 100) / 100, id)
    .run();
  if (!res.meta?.changes) return json({ error: 'not_found' }, 404);
  return json({ ok: true });
};
