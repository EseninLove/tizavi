import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const dbUrl = process.env.DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const masked = dbUrl
    ? dbUrl.replace(/:[^:@]+@/, ':***@').slice(0, 50) + '...'
    : 'НЕ ЗАДАН';

  try {
    const { pool } = await import('./db.js');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now, version() as version');
    client.release();
    return res.status(200).json({
      ok: true,
      dbUrl: masked,
      time: result.rows[0].now,
      version: (result.rows[0].version as string).slice(0, 60),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      dbUrl: masked,
      error: err instanceof Error ? err.message : String(err),
      code: (err as any)?.code,
    });
  }
}
