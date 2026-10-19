// Shared auth helpers for Pages Functions.
// - hashPassword: SHA-256(salt || password) via Web Crypto. Not bcrypt;
//   adequate for a 4-user internal farm app behind Cloudflare's edge.
// - requireUser: reads the "session" cookie, looks it up in the DB,
//   returns { user } or throws a Response(401).

const te = new TextEncoder();

export async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', te.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, salt) {
  return sha256Hex(salt + ':' + password);
}

export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function parseCookies(req) {
  const header = req.headers.get('Cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

export function sessionCookie(token, maxAgeSec = 60 * 60 * 24 * 7) {
  // Secure; HttpOnly; SameSite=Lax; Path=/
  return `session=${encodeURIComponent(token)}; Max-Age=${maxAgeSec}; Path=/; HttpOnly; SameSite=Lax; Secure`;
}

export function clearSessionCookie() {
  return 'session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure';
}

export async function requireUser(request, env) {
  const token = parseCookies(request).session;
  if (!token) throw json({ error: 'not_authenticated' }, 401);
  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.role, u.display_name, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`
  )
    .bind(token)
    .first();
  if (!row) throw json({ error: 'invalid_session' }, 401);
  if (new Date(row.expires_at) < new Date()) {
    await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(token).run();
    throw json({ error: 'session_expired' }, 401);
  }
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    displayName: row.display_name,
  };
}

export function requireAdmin(user) {
  if (user.role !== 'admin') throw json({ error: 'admin_only' }, 403);
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}
