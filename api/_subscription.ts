import { sql } from './_db.js';

export const SUBSCRIPTION_PRICE_RUB = Number(process.env.SUBSCRIPTION_PRICE_RUB || 199);
export const SUBSCRIPTION_DAYS = Number(process.env.SUBSCRIPTION_DAYS || 30);

export async function ensureSubscriptionsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      payment_method TEXT DEFAULT 'stars',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

export async function getSubscription(
  telegramId: number
): Promise<{ active: boolean; expiresAt: string | null }> {
  await ensureSubscriptionsTable();
  const result =
    await sql`SELECT expires_at FROM subscriptions WHERE telegram_id = ${telegramId}`;
  if (result.rows.length === 0) return { active: false, expiresAt: null };
  const expiresAt = (result.rows[0] as { expires_at: string }).expires_at;
  const active = new Date(expiresAt).getTime() > Date.now();
  return { active, expiresAt: active ? expiresAt : null };
}

export async function hasActiveSubscription(telegramId: number): Promise<boolean> {
  try {
    const { active } = await getSubscription(telegramId);
    return active;
  } catch {
    return false;
  }
}
