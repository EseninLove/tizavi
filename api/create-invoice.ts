import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInitData } from './_helpers.js';
import { hasActiveSubscription } from './_subscription.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const PROVIDER_TOKEN = process.env.PROVIDER_TOKEN;

interface CreateInvoiceBody {
  title: string;
  description: string;
  payload: string;
  rubAmount: number;
  initData?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!BOT_TOKEN) {
    return res.status(500).json({ ok: false, error: 'BOT_TOKEN не задан' });
  }

  if (!PROVIDER_TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'PROVIDER_TOKEN не задан — оплата картой недоступна',
    });
  }

  const { title, description, payload, rubAmount, initData } =
    (req.body || {}) as CreateInvoiceBody;

  const { valid, userId } = initData
    ? validateInitData(initData)
    : { valid: false, userId: undefined };

  if (!valid || !userId) {
    return res.status(401).json({ ok: false, error: 'Оплата доступна только внутри Telegram' });
  }

  const subscribed = await hasActiveSubscription(userId);
  if (!subscribed) {
    return res.status(403).json({
      ok: false,
      error: 'Для оформления заказа нужна активная подписка',
      code: 'SUBSCRIPTION_REQUIRED',
    });
  }

  const currency = 'RUB';
  const providerToken = PROVIDER_TOKEN;
  const amount = Math.round(rubAmount * 100);

  try {
    const tgResponse = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          payload,
          provider_token: providerToken,
          currency,
          prices: [{ label: title, amount }],
        }),
      }
    );

    const data = (await tgResponse.json()) as {
      ok: boolean;
      result?: string;
      description?: string;
    };

    if (!data.ok) {
      return res.status(400).json({
        ok: false,
        error: data.description || 'Не удалось создать счёт',
      });
    }

    return res.status(200).json({ ok: true, invoiceLink: data.result });
  } catch {
    return res.status(500).json({ ok: false, error: 'Ошибка при создании счёта' });
  }
}
