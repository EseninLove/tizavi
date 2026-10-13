import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "./_db.js";
import { validateInitData, parseInitDataUser } from "./_helpers.js";
import { ensureCommerceSchema } from "./_schema.js";
import { ShopError } from "./_commerce.js";
// Fixed work factor keeps verification bounded and avoids trusting parameters from stored strings.
const scrypt = (password: string, salt: string, length: number) =>
  new Promise<Buffer>((resolve, reject) =>
    crypto.scrypt(
      password,
      salt,
      length,
      { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
export const SESSION_COOKIE = "tizavi_customer";
export interface Customer {
  id: number;
  telegram_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  photo_url: string | null;
  email_verified: boolean;
}
export const digest = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new ShopError("Введите email");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email))
    throw new ShopError("Введите корректный email");
  return email;
}
export function validatePassword(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length < 10 ||
    value.length > 128 ||
    !value.trim()
  )
    throw new ShopError("Пароль должен содержать от 10 до 128 символов");
}
export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string | null) {
  const parts = (stored || "").split("$");
  const valid =
    parts.length === 3 &&
    parts[0] === "scrypt" &&
    /^[a-f0-9]{32}$/.test(parts[1]) &&
    /^[a-f0-9]{128}$/.test(parts[2]);
  const computed = (await scrypt(
    password,
    valid ? parts[1] : "00000000000000000000000000000000",
    64,
  )) as Buffer;
  return (
    valid && crypto.timingSafeEqual(computed, Buffer.from(parts[2], "hex"))
  );
}
export function publicCustomer(row: Customer) {
  return {
    id: Number(row.id),
    telegramId: row.telegram_id ? Number(row.telegram_id) : null,
    email: row.email,
    emailVerified: row.email_verified,
    name:
      [row.first_name, row.last_name].filter(Boolean).join(" ") ||
      row.email ||
      "Покупатель",
    firstName: row.first_name || "",
    username: row.username,
    photoUrl: row.photo_url,
  };
}
export function checkOrigin(req: VercelRequest, required = false) {
  const origin = req.headers.origin;
  if (!origin) {
    if (required)
      throw new ShopError("Обновите страницу и повторите попытку", 403);
    return;
  }
  const host = String(
    req.headers["x-forwarded-host"] || req.headers.host || "",
  );
  try {
    if (new URL(String(origin)).host !== host) throw new Error();
  } catch {
    throw new ShopError("Недопустимый источник запроса", 403);
  }
}
export function sessionToken(req: VercelRequest) {
  const match = String(req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(SESSION_COOKIE + "="));
  const token = match?.slice(SESSION_COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export async function sessionCustomer(
  req: VercelRequest,
): Promise<Customer | null> {
  const token = sessionToken(req);
  if (!token) return null;
  if (req.method !== "GET" && req.method !== "HEAD") checkOrigin(req, true);
  await ensureCommerceSchema();
  const r =
    await sql<Customer>`SELECT u.* FROM customer_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=${digest(token)} AND s.expires_at>NOW()`;
  return r.rows[0] || null;
}
export async function telegramCustomer(
  initData: string,
): Promise<Customer | null> {
  const auth = validateInitData(initData);
  if (!auth.valid || !auth.userId) return null;
  await ensureCommerceSchema();
  const user = parseInitDataUser(initData);
  const r =
    await sql<Customer>`INSERT INTO users(telegram_id,first_name,last_name,username,photo_url,last_seen) VALUES(${auth.userId},${user?.first_name || null},${user?.last_name || null},${user?.username || null},${user?.photo_url || null},NOW()) ON CONFLICT(telegram_id) DO UPDATE SET first_name=COALESCE(EXCLUDED.first_name,users.first_name),last_name=COALESCE(EXCLUDED.last_name,users.last_name),username=COALESCE(EXCLUDED.username,users.username),photo_url=COALESCE(EXCLUDED.photo_url,users.photo_url),last_seen=NOW() RETURNING *`;
  return r.rows[0];
}
export async function authenticateCustomer(
  req: VercelRequest,
): Promise<Customer | null> {
  const initData = req.body?.initData;
  // A supplied Mini App identity must validate; never silently fall back to another browser account.
  if (initData)
    return typeof initData === "string" ? telegramCustomer(initData) : null;
  return sessionCustomer(req);
}
export async function requireCustomer(req: VercelRequest) {
  const user = await authenticateCustomer(req);
  if (!user) throw new ShopError("Войдите в аккаунт, чтобы продолжить", 401);
  return user;
}
function cookieFlags(req: VercelRequest) {
  const secure =
    process.env.VERCEL || req.headers["x-forwarded-proto"] === "https";
  return `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}
export async function createSession(
  req: VercelRequest,
  res: VercelResponse,
  userId: number,
) {
  const token = crypto.randomBytes(32).toString("hex");
  await sql`DELETE FROM customer_sessions WHERE expires_at<=NOW()`;
  await sql`INSERT INTO customer_sessions(token_hash,user_id,expires_at) VALUES(${digest(token)},${userId},NOW()+INTERVAL '30 days')`;
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; ${cookieFlags(req)}; Max-Age=2592000`,
  );
}
export async function removeSession(req: VercelRequest, res: VercelResponse) {
  const token = sessionToken(req);
  if (token)
    await sql`DELETE FROM customer_sessions WHERE token_hash=${digest(token)}`;
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; ${cookieFlags(req)}; Max-Age=0`,
  );
}
export async function limitAuth(req: VercelRequest, email = "") {
  // Atomic counters live in PostgreSQL, so limits apply across serverless instances.
  const ip = String(
    req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown",
  )
    .split(",")[0]
    .trim();
  for (const value of ["ip:" + ip, ...(email ? ["email:" + email] : [])]) {
    const r = await sql<{
      attempts: number;
    }>`INSERT INTO auth_attempts(key_hash) VALUES(${digest(value)}) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN auth_attempts.started_at<NOW()-INTERVAL '15 minutes' THEN 1 ELSE auth_attempts.attempts+1 END,started_at=CASE WHEN auth_attempts.started_at<NOW()-INTERVAL '15 minutes' THEN NOW() ELSE auth_attempts.started_at END RETURNING attempts`;
    if (Number(r.rows[0].attempts) > 15)
      throw new ShopError(
        "Слишком много попыток. Повторите через 15 минут",
        429,
      );
  }
  await sql`DELETE FROM auth_attempts WHERE started_at<NOW()-INTERVAL '1 day'`;
}
