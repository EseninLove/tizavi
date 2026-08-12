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
    let result;
    if (status && status !== 'all') {
      result = await sql`
        SELECT id, order_number, items, total, delivery, payment_method,
               status, telegram_user_id, telegram_username, customer_name,
               customer_phone, created_at, updated_at
        FROM orders
        WHERE status = ${status}
        ORDER BY created_at DESC
      `;
    } else {
      result = await sql`
        SELECT id, order_number, items, total, delivery, payment_method,
               status, telegram_user_id, telegram_username, customer_name,
               customer_phone, created_at, updated_at
        FROM orders
        ORDER BY created_at DESC
      `;
    }

    return sendJSON(res, 200, { ok: true, orders: result.rows });
  } catch {
    return sendJSON(res, 500, { ok: false, error: 'Ошибка получения заказов' });
  }
}
