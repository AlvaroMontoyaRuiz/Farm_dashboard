// POST /api/auth/login  { username, password }
import { hashPassword, randomToken, sessionCookie, json } from '../../_lib/auth.js';

export const onRequestPost = async ({ request, env }) => {
  const { username, password } = await request.json().catch(() => ({}));
  if (!username || !password) return json({ error: 'missing_credentials' }, 400);

  const u = await env.DB.prepare(
    `SELECT id, username, password_hash, salt, role, display_name
       FROM users WHERE username = ?`
  )
    .bind(username)
    .first();
  if (!u) return json({ error: 'invalid_credentials' }, 401);

  const h = await hashPassword(password, u.salt);
  if (h !== u.password_hash) return json({ error: 'invalid_credentials' }, 401);

  const token = randomToken(32);
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`
  )
    .bind(token, u.id, expires)
    .run();

  return json(
    {
      ok: true,
      user: { id: u.id, username: u.username, role: u.role, displayName: u.display_name },
    },
    200,
    { 'Set-Cookie': sessionCookie(token) }
  );
};
