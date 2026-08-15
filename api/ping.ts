import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    ok: true,
    message: 'API работает',
    time: new Date().toISOString(),
    hasAdminKey: !!process.env.ADMIN_KEY,
    hasBotToken: !!process.env.BOT_TOKEN,
    hasDbUrl: !!(process.env.DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL),
  });
}
