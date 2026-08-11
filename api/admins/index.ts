import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAdmin, sendJSON, unauthorized } from '../_helpers';
import { sql } from '../db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { authorized } = await authenticateAdmin(req);
  if (!authorized) return unauthorized(res);

  if (req.method === 'GET') {
    try {
      const result = await sql`
        SELECT id, telegram_id, role, created_at
        FROM admins
        ORDER BY created_at ASC
      `;
      return sendJSON(res, 200, { ok: true, admins: result.rows });
    } catch {
      return sendJSON(res, 500, { ok: false, error: 'Ошибка получения списка админов' });
    }
  }

  if (req.method === 'POST') {
    const { telegramId, role } = (req.body || {}) as { telegramId?: number; role?: string };
    if (!telegramId || isNaN(telegramId)) {
      return sendJSON(res, 400, { ok: false, error: 'Укажите корректный Telegram ID' });
    }

    try {
      await sql`
        INSERT INTO admins (telegram_id, role)
        VALUES (${telegramId}, ${role || 'admin'})
        ON CONFLICT (telegram_id) DO NOTHING
      `;
      return sendJSON(res, 201, { ok: true, message: 'Админ добавлен' });
    } catch {
      return sendJSON(res, 500, { ok: false, error: 'Ошибка добавления админа' });
    }
  }

  return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
}
