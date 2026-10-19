// POST /api/auth/setup
// One-time: creates admin + 3 workers with passwords you choose.
// Refuses to run once ANY user already exists.
//
// Body: {
//   admin:   { username, password, displayName },
//   workers: [ { username, password, displayName }, ... ] // up to 3
// }

import { hashPassword, randomToken, json } from '../../_lib/auth.js';

export const onRequestPost = async ({ request, env }) => {
  const existing = await env.DB.prepare(`SELECT COUNT(*) AS n FROM users`).first();
  if (existing && existing.n > 0) {
    return json({ error: 'already_initialized' }, 409);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { admin, workers = [] } = body || {};
  if (!admin || !admin.username || !admin.password) {
    return json({ error: 'admin_required' }, 400);
  }
  if (workers.length > 3) {
    return json({ error: 'too_many_workers' }, 400);
  }

  const all = [{ ...admin, role: 'admin' }, ...workers.map((w) => ({ ...w, role: 'worker' }))];

  for (const u of all) {
    if (!u.username || !u.password) return json({ error: 'missing_credentials' }, 400);
    if (u.password.length < 6) return json({ error: 'password_too_short' }, 400);
  }

  const stmts = [];
  for (const u of all) {
    const salt = randomToken(8);
    const hash = await hashPassword(u.password, salt);
    stmts.push(
      env.DB.prepare(
        `INSERT INTO users (username, password_hash, salt, role, display_name)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(u.username, hash, salt, u.role, u.displayName || u.username)
    );
  }
  await env.DB.batch(stmts);

  return json({ ok: true, created: all.length });
};
