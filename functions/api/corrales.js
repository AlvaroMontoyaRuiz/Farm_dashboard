import { requireUser, json } from '../_lib/auth.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    await requireUser(request, env);
  } catch (r) {
    return r;
  }
  const rows = await env.DB.prepare(`SELECT id, name, notes FROM corrales ORDER BY id`).all();
  return json({ corrales: rows.results || [] });
};
