import { parseCookies, clearSessionCookie, json } from '../../_lib/auth.js';

export const onRequestPost = async ({ request, env }) => {
  const t = parseCookies(request).session;
  if (t) await env.DB.prepare(`DELETE FROM sessions WHERE token = ?`).bind(t).run();
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
};
