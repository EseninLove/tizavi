import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, validateInitData, sendJSON } from './_helpers.js';
import {
  getSubscription,
  SUBSCRIPTION_STARS,
  SUBSCRIPTION_DAYS,
} from './_subscription.js';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const DAY_MS = 86400000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const { initData, action } = (req.body || {}) as {
    initData?: string;
    action?: 'status' | 'invoice' | 'activate';
  };

  if (!initData) {
    return sendJSON(res, 400, { ok: false, error: 'initData обязателен' });
  }

  const { valid, userId } = validateInitData(initData);
  if (!valid || !userId) {
    return sendJSON(res, 401, { ok: false, error: 'Невалидные данные Telegram' });
  }

  try {
    if (action === 'activate') {
      const { active, expiresAt } = await getSubscription(userId);
      const base = active && expiresAt ? new Date(expiresAt).getTime() : Date.now();
      const newExpiry = new Date(base + SUBSCRIPTION_DAYS * DAY_MS);

      await sql`
        INSERT INTO subscriptions (telegram_id, expires_at, payment_method)
        VALUES (${userId}, ${newExpiry.toISOString()}, 'stars')
        ON CONFLICT (telegram_id) DO UPDATE SET
          expires_at = ${newExpiry.toISOString()},
          payment_method = 'stars',
          updated_at = NOW()
      `;

      return sendJSON(res, 200, {
        ok: true,
        active: true,
        expiresAt: newExpiry.toISOString(),
        price: SUBSCRIPTION_STARS,
        days: SUBSCRIPTION_DAYS,
      });
    }

    if (action === 'invoice') {
      if (!BOT_TOKEN) {
        return sendJSON(res, 500, { ok: false, error: 'BOT_TOKEN не задан' });
      }

      const tgResponse = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Подписка Tizavi Shop',
            description: `Доступ к оформлению заказов на ${SUBSCRIPTION_DAYS} дней`,
            payload: `sub_${userId}_${Date.now()}`,
            currency: 'XTR',
            prices: [{ label: `Подписка на ${SUBSCRIPTION_DAYS} дней`, amount: SUBSCRIPTION_STARS }],
          }),
        }
      );

      const data = (await tgResponse.json()) as { ok: boolean; result?: string; description?: string };
      if (!data.ok) {
        return sendJSON(res, 400, { ok: false, error: data.description || 'Не удалось создать счёт' });
      }

      return sendJSON(res, 200, {
        ok: true,
        invoiceLink: data.result,
        price: SUBSCRIPTION_STARS,
        days: SUBSCRIPTION_DAYS,
      });
    }

    const { active, expiresAt } = await getSubscription(userId);
    return sendJSON(res, 200, {
      ok: true,
      active,
      expiresAt,
      price: SUBSCRIPTION_STARS,
      days: SUBSCRIPTION_DAYS,
    });
  } catch (err) {
    return sendJSON(res, 500, {
      ok: false,
      error: 'Ошибка работы с подпиской',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
