import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, authenticateAdmin, sendJSON, unauthorized } from '../_helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const { authorized } = await authenticateAdmin(req);
  if (!authorized) return unauthorized(res);

  try {
    const result = await sql`
      SELECT id, telegram_id, username, first_name, last_name, photo_url,
             orders_count, total_spent, created_at, last_seen
      FROM users
      ORDER BY last_seen DESC
    `;

    return sendJSON(res, 200, { ok: true, users: result.rows });
  } catch {
    return sendJSON(res, 500, { ok: false, error: 'Ошибка получения пользователей' });
  }
}
