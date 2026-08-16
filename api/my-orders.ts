import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, validateInitData, sendJSON } from './_helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const { initData } = (req.body || {}) as { initData?: string };
  if (!initData) {
    return sendJSON(res, 400, { ok: false, error: 'initData обязателен' });
  }

  const { valid, userId } = validateInitData(initData);
  if (!valid || !userId) {
    return sendJSON(res, 401, { ok: false, error: 'Невалидные данные Telegram' });
  }

  try {
    const result = await sql`
      SELECT order_number, items, total, delivery, payment_method, status, created_at
      FROM orders
      WHERE telegram_user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 50
    `;

    const orders = result.rows.map((row) => {
      const r = row as {
        order_number: string;
        items: Array<{ product: { id?: string; name?: string; image?: string; price?: number; unit?: string; weight?: number }; quantity?: number }>;
        total: number;
        delivery: Record<string, unknown>;
        payment_method: string;
        status: string;
        created_at: string;
      };
      const statusMap: Record<string, 'paid' | 'shipped' | 'delivered'> = {
        paid: 'paid',
        shipped: 'shipped',
        delivered: 'delivered',
      };
      return {
        id: r.order_number,
        items: (r.items || []).map((i) => ({
          product: {
            id: String(i.product?.id ?? ''),
            name: i.product?.name ?? 'Товар',
            description: '',
            price: Number(i.product?.price ?? 0),
            image: i.product?.image ?? '',
            category: '',
            rating: 5,
            reviewsCount: 0,
            inStock: true,
            unit: i.product?.unit,
            weight: i.product?.weight,
          },
          quantity: Number(i.quantity ?? 1),
        })),
        total: Number(r.total),
        delivery: (r.delivery || {}) as { name: string; phone: string; address: string; city: string; comment?: string; deliveryType: 'courier' | 'pickup' },
        paymentMethod: (r.payment_method === 'card' ? 'telegram-pay' : 'telegram-pay') as 'stars' | 'telegram-pay',
        createdAt: new Date(r.created_at).getTime(),
        status: statusMap[r.status] ?? 'paid',
      };
    });

    return sendJSON(res, 200, { ok: true, orders });
  } catch {
    return sendJSON(res, 200, { ok: true, orders: [] });
  }
}
