// GET /api/deletion-log?from=&to=&table=
import { requireUser, requireAdmin, json } from '../_lib/auth.js';

export const onRequestGet = async ({ request, env }) => {
  try {
    requireAdmin(await requireUser(request, env));
  } catch (r) {
    return r;
  }
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const table = url.searchParams.get('table');
  const where = [];
  const binds = [];
  if (from) {
    where.push('d.deleted_at >= ?');
    binds.push(from);
  }
  if (to) {
    where.push('d.deleted_at <= ?');
    binds.push(to + ' 23:59:59');
  }
  if (table) {
    where.push('d.table_name = ?');
    binds.push(table);
  }
  const sql = `
    SELECT d.id, d.table_name AS tableName, d.record_id AS recordId,
           d.payload_json AS payloadJson, d.reason, d.deleted_at AS deletedAt,
           u.display_name AS deletedBy
      FROM deletion_log d LEFT JOIN users u ON u.id = d.deleted_by
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY d.deleted_at DESC LIMIT 500`;
  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return json({ log: rows.results || [] });
};
