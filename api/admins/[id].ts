import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAdmin, sendJSON, unauthorized } from '../_helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { authorized } = await authenticateAdmin(req);
  if (!authorized) return unauthorized(res);

  const { id } = req.query;
  if (typeof id !== 'string') {
    return sendJSON(res, 400, { ok: false, error: 'ID не указан' });
  }

  const adminId = parseInt(id, 10);
  if (isNaN(adminId)) {
    return sendJSON(res, 400, { ok: false, error: 'Невалидный ID' });
  }

  if (req.method === 'DELETE') {
    try {
      const { sql } = await import('@vercel/postgres');
      await sql`DELETE FROM admins WHERE id = ${adminId}`;
      return sendJSON(res, 200, { ok: true, message: 'Админ удалён' });
    } catch {
      return sendJSON(res, 500, { ok: false, error: 'Ошибка удаления админа' });
    }
  }

  return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
}
