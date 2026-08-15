import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, authenticateAdmin, sendJSON, unauthorized } from '../_helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const { authorized } = await authenticateAdmin(req);
  if (!authorized) return unauthorized(res);

  const status = typeof req.query.status === 'string' ? req.query.status : null;

  try {
    const result =
      status && status !== 'all'
        ? await sql`SELECT * FROM orders WHERE status = ${status} ORDER BY created_at DESC`
        : await sql`SELECT * FROM orders ORDER BY created_at DESC`;

    return sendJSON(res, 200, { ok: true, orders: result.rows });
  } catch {
    return sendJSON(res, 500, { ok: false, error: 'Ошибка получения заказов' });
  }
}
