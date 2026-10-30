// GET /api/consumption/today?corralId=N
// What this corral was fed today (all users, and the part registered by the person asking),
// per type of bulto, with the stock in storage. Feeds the tablet screen.

import { requireUser, json } from '../../_lib/auth.js';
import { todaySnapshot } from '../../_lib/consumo.js';

export const onRequestGet = async ({ request, env }) => {
  let user;
  try {
    user = await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const corralId = Number(new URL(request.url).searchParams.get('corralId'));
  if (!Number.isInteger(corralId) || corralId <= 0) return json({ error: 'corral_required' }, 400);
  const snap = await todaySnapshot(env, corralId, user.id);
  if (!snap) return json({ error: 'corral_not_found' }, 404);
  return json(snap);
};
