import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateInitData, isAdminTelegramId, sendJSON } from './_helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const { initData, adminKey } = req.body as {
    initData?: string;
    adminKey?: string;
  };

  // Авторизация по ADMIN_KEY (веб-доступ)
  if (adminKey) {
    if (adminKey === process.env.ADMIN_KEY) {
      return sendJSON(res, 200, {
        ok: true,
        method: 'key',
        user: { role: 'super_admin', firstName: 'Admin' },
      });
    }
    return sendJSON(res, 401, { ok: false, error: 'Неверный ключ администратора' });
  }

  // Авторизация через Telegram initData (Mini App)
  if (initData) {
    const { valid, userId } = validateInitData(initData);
    if (!valid || !userId) {
      return sendJSON(res, 401, { ok: false, error: 'Невалидные данные Telegram' });
    }

    const isAdmin = await isAdminTelegramId(userId);
    if (!isAdmin) {
      return sendJSON(res, 403, { ok: false, error: 'У вас нет прав администратора' });
    }

    const userParam = new URLSearchParams(initData).get('user');
    const user = userParam ? JSON.parse(userParam) : {};

    return sendJSON(res, 200, {
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

  return sendJSON(res, 400, { ok: false, error: 'Не переданы данные для авторизации' });
}
