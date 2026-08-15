import { sql } from './db.js';
import type { VercelRequest } from '@vercel/node';
import crypto from 'crypto';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

export { sql };

export interface AdminUser {
  telegramId: number;
  username?: string;
  firstName?: string;
  role: string;
}

export function validateInitData(initData: string): { valid: boolean; userId?: number } {
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

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

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

export async function authenticateAdmin(req: VercelRequest): Promise<{
  authorized: boolean;
  user?: AdminUser;
}> {
  const authHeader = req.headers['x-admin-auth'] as string | undefined;

  if (!authHeader) {
    return { authorized: false };
  }

  const [type, token] = authHeader.split(' ');

  if (type === 'Key' && token && token.trim() === ADMIN_KEY.trim()) {
    return {
      authorized: true,
      user: { telegramId: 0, role: 'super_admin', firstName: 'Admin' },
    };
  }

  if (type === 'Telegram' && token) {
    const { valid, userId } = validateInitData(token);
    if (!valid || !userId) return { authorized: false };

    try {
      const result =
        await sql`SELECT telegram_id, role FROM admins WHERE telegram_id = ${userId}`;
      if (result.rows.length > 0) {
        const row = result.rows[0] as { telegram_id: number; role: string };
        return {
          authorized: true,
          user: { telegramId: row.telegram_id, role: row.role },
        };
      }
    } catch {
      // ignore
    }
  }

  return { authorized: false };
}

export function sendJSON(res: any, status: number, data: unknown) {
  return res.status(status).json(data);
}

export function unauthorized(res: any) {
  return sendJSON(res, 401, { ok: false, error: 'Не авторизован' });
}
