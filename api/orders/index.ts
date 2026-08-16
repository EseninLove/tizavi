import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, authenticateAdmin, validateInitData, upsertUser, sendJSON, unauthorized } from '../_helpers.js';

const VALID_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // POST /api/orders — создание заказа покупателем (нужна активная подписка)
  if (req.method === 'POST') {
    const { initData, order } = (req.body || {}) as {
      initData?: string;
      order?: {
        orderNumber?: string;
        items?: Array<{ product: { id: string; name: string; image: string; price: number }; quantity: number }>;
        total?: number;
        delivery?: { name: string; phone: string; city: string; address: string; comment?: string; deliveryType: string };
        paymentMethod?: string;
      };
    };

    if (!initData || !order || !Array.isArray(order.items) || order.items.length === 0) {
      return sendJSON(res, 400, { ok: false, error: 'Некорректные данные заказа' });
    }

    const { valid, userId } = validateInitData(initData);
    if (!valid || !userId) {
      return sendJSON(res, 401, { ok: false, error: 'Невалидные данные Telegram' });
    }

    const { hasActiveSubscription } = await import('../_subscription.js');
    const subscribed = await hasActiveSubscription(userId);
    if (!subscribed) {
      return sendJSON(res, 403, {
        ok: false,
        error: 'Нужна активная подписка',
        code: 'SUBSCRIPTION_REQUIRED',
      });
    }

    await upsertUser(initData, userId);

    const total = Number(order.total) || 0;
    const orderNumber = order.orderNumber || 'ORD-' + Date.now().toString(36).toUpperCase();
    const customerName = order.delivery?.name || null;
    const customerPhone = order.delivery?.phone || null;
    const paymentMethod = order.paymentMethod === 'telegram-pay' ? 'card' : order.paymentMethod || 'card';

    try {
      const result = await sql`
        INSERT INTO orders (order_number, items, total, delivery, payment_method, status,
                            telegram_user_id, customer_name, customer_phone)
        VALUES (
          ${orderNumber},
          ${JSON.stringify(order.items)}::jsonb,
          ${Math.round(total)},
          ${JSON.stringify(order.delivery || {})}::jsonb,
          ${paymentMethod},
          'paid',
          ${userId},
          ${customerName},
          ${customerPhone}
        )
        RETURNING id, order_number
      `;

      const row = result.rows[0] as { id: number; order_number: string };

      await sql`
        UPDATE users SET
          orders_count = COALESCE(orders_count, 0) + 1,
          total_spent = COALESCE(total_spent, 0) + ${Math.round(total)}
        WHERE telegram_id = ${userId}
      `;

      return sendJSON(res, 201, {
        ok: true,
        id: row.id,
        orderNumber: row.order_number,
        message: 'Заказ сохранён',
      });
    } catch (err) {
      return sendJSON(res, 500, {
        ok: false,
        error: 'Ошибка сохранения заказа',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

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
