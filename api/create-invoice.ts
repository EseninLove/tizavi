import type { VercelRequest, VercelResponse } from '@vercel/node';

const BOT_TOKEN = process.env.BOT_TOKEN;
const PROVIDER_TOKEN = process.env.PROVIDER_TOKEN;

interface CreateInvoiceBody {
  title: string;
  description: string;
  payload: string;
  method: 'stars' | 'telegram-pay';
  rubAmount: number;
  starsAmount: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!BOT_TOKEN) {
    return res.status(500).json({ ok: false, error: 'BOT_TOKEN не задан' });
  }

  const { title, description, payload, method, rubAmount, starsAmount } =
    (req.body || {}) as CreateInvoiceBody;

  const isStars = method === 'stars';
  const currency = isStars ? 'XTR' : 'RUB';
  const providerToken = isStars ? '' : PROVIDER_TOKEN;
  const amount = isStars ? starsAmount : Math.round(rubAmount * 100);

  if (!isStars && !providerToken) {
    return res.status(500).json({
      ok: false,
      error: 'PROVIDER_TOKEN не задан — оплата картой недоступна',
    });
  }

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
