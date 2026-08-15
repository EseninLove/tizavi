import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, authenticateAdmin, sendJSON, unauthorized } from '../_helpers.js';

const VALID_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { authorized } = await authenticateAdmin(req);
  if (!authorized) return unauthorized(res);

  const { id } = req.query;

  if (typeof id !== 'string') {
    return sendJSON(res, 400, { ok: false, error: 'ID не указан' });
  }

  const orderId = parseInt(id, 10);
  if (isNaN(orderId)) {
    return sendJSON(res, 400, { ok: false, error: 'Невалидный ID' });
  }

  if (req.method === 'GET') {
    try {
      const result = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
      if (result.rows.length === 0) {
        return sendJSON(res, 404, { ok: false, error: 'Заказ не найден' });
      }
      return sendJSON(res, 200, { ok: true, order: result.rows[0] });
    } catch {
      return sendJSON(res, 500, { ok: false, error: 'Ошибка получения заказа' });
    }
  }

  if (req.method === 'PUT') {
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
