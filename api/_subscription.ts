import { ensureCommerceSchema } from "./_schema.js";
import { sql } from "./_db.js";

export const SUBSCRIPTION_PRICE_RUB = Number(
  process.env.SUBSCRIPTION_PRICE_RUB || 199,
);
export const SUBSCRIPTION_DAYS = Number(process.env.SUBSCRIPTION_DAYS || 30);

export async function getSubscription(
  userId: number,
): Promise<{ active: boolean; expiresAt: string | null }> {
  await ensureCommerceSchema();
  const result =
    await sql`SELECT expires_at FROM subscriptions WHERE user_id = ${userId}`;
  if (result.rows.length === 0) return { active: false, expiresAt: null };
  const expiresAt = (result.rows[0] as { expires_at: string }).expires_at;
  const active = new Date(expiresAt).getTime() > Date.now();
  return { active, expiresAt: active ? expiresAt : null };
}

export async function hasActiveSubscription(userId: number): Promise<boolean> {
  try {
    const { active } = await getSubscription(userId);
    return active;
  } catch {
    return false;
  }
}
