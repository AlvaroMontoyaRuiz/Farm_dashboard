// Runs before every /api/* route. Turns the two most common deployment
// mistakes into clear JSON error codes instead of an opaque HTTP 500:
//   - db_binding_missing : the D1 binding named "DB" is not attached
//   - db_not_initialized : the database exists but the migrations were not run

import { json } from '../_lib/auth.js';

export const onRequest = async ({ env, next }) => {
  if (!env.DB) return json({ error: 'db_binding_missing' }, 500);
  try {
    return await next();
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = String(e && e.message ? e.message : e);
    console.error('API error:', msg);
    if (/no such table/i.test(msg)) return json({ error: 'db_not_initialized' }, 500);
    return json({ error: 'server_error' }, 500);
  }
};
