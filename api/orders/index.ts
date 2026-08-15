import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, authenticateAdmin, sendJSON, unauthorized } from '../_helpers.js';

const VALID_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { authorized } = await authenticateAdmin(req);
  if (!authorized) return unauthorized(res);

  // GET /api/orders?status=X — список
  if (req.method === 'GET') {
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

  // PUT /api/orders?id=X — смена статуса
  if (req.method === 'PUT') {
    const orderId = parseInt(req.query.id as string, 10);
    if (isNaN(orderId)) {
      return sendJSON(res, 400, { ok: false, error: 'Невалидный ID' });
    }

    const { status } = (req.body || {}) as { status?: string };

    if (!status || !VALID_STATUSES.includes(status)) {
      return sendJSON(res, 400, {
        ok: false,
        error: `Статус должен быть одним из: ${VALID_STATUSES.join(', ')}`,
      });
    }

    try {
      await sql`
        UPDATE orders SET status = ${status}, updated_at = NOW()
        WHERE id = ${orderId}
      `;
      return sendJSON(res, 200, { ok: true, message: 'Статус обновлён' });
    } catch {
      return sendJSON(res, 500, { ok: false, error: 'Ошибка обновления заказа' });
    }
  }

  return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
}
