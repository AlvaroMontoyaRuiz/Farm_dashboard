// Runs before every /api/* route. Turns the two most common deployment
// mistakes into clear JSON error codes instead of an opaque HTTP 500:
//   - db_binding_missing : the D1 binding named "DB" is not attached
//   - db_not_initialized : the database exists but the migrations were not run
//   - db_needs_update    : the code is newer than the database (the automatic update could not run)

import { json } from '../_lib/auth.js';
import { ensureSchema } from '../_lib/migrate.js';

export const onRequest = async ({ env, next }) => {
  if (!env.DB) return json({ error: 'db_binding_missing' }, 500);
  try {
    await ensureSchema(env); // brings an older database up to date, once per server instance
    return await next();
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = String(e && e.message ? e.message : e);
    console.error('API error:', msg);
    if (/food_types|no such column|has no column/i.test(msg)) return json({ error: 'db_needs_update' }, 500);
    if (/no such table/i.test(msg)) return json({ error: 'db_not_initialized' }, 500);
    return json({ error: 'server_error' }, 500);
  }
};
