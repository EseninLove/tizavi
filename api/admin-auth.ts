import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { initData, adminKey } = (req.body || {}) as {
    initData?: string;
    adminKey?: string;
  };

  // Авторизация по ADMIN_KEY (веб-доступ)
  if (adminKey) {
    if (ADMIN_KEY && adminKey.trim() === ADMIN_KEY.trim()) {
      return res.status(200).json({
        ok: true,
        method: 'key',
        user: { role: 'super_admin', firstName: 'Admin' },
      });
    }
    return res.status(401).json({
      ok: false,
      error: `Неверный ключ (введено ${adminKey.trim().length} симв., ожидается ${ADMIN_KEY.length} симв.)`,
    });
  }

  // Авторизация через Telegram initData (Mini App)
  if (initData) {
    const { valid, userId } = validateInitData(initData);
    if (!valid || !userId) {
      return res.status(401).json({ ok: false, error: 'Невалидные данные Telegram' });
    }

    let isAdmin = false;
    try {
      const { sql } = await import('./db.js');
      const result = await sql`SELECT 1 FROM admins WHERE telegram_id = ${userId}`;
      isAdmin = (result.rowCount ?? 0) > 0;
    } catch {
      return res.status(500).json({
        ok: false,
        error: 'База данных недоступна. Подключите Vercel Postgres и инициализируйте БД.',
      });
    }

    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'У вас нет прав администратора' });
    }

    const userParam = new URLSearchParams(initData).get('user');
    const user = userParam ? JSON.parse(userParam) : {};

    return res.status(200).json({
      ok: true,
      method: 'telegram',
      user: {
        telegramId: userId,
        username: user.username,
        firstName: user.first_name,
        role: 'admin',
      },
    });
  }

  return res.status(400).json({ ok: false, error: 'Не переданы данные для авторизации' });
}

function validateInitData(initData: string): { valid: boolean; userId?: number } {
  try {
    if (!BOT_TOKEN) return { valid: false };

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };

    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) return { valid: false };

    const userParam = new URLSearchParams(initData).get('user');
    if (!userParam) return { valid: false };

    const user = JSON.parse(userParam);
    return { valid: true, userId: user.id };
  } catch {
    return { valid: false };
  }
}
