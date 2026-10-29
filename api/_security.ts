import crypto from "node:crypto";
import type { VercelRequest } from "@vercel/node";
import { sql } from "./_db.js";
import { ensureCommerceSchema } from "./_schema.js";
import { ShopError } from "./_commerce.js";

export const fingerprint = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
export function clientAddress(req: VercelRequest) {
  // Forwarded addresses are trusted only behind our deployment proxy.
  const forwarded = process.env.VERCEL
    ? req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"]
    : undefined;
  return String(forwarded || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim()
    .slice(0, 100);
}
export async function limitRequest(
  scope: string,
  identity: string,
  maximum: number,
  seconds = 60,
) {
  await ensureCommerceSchema();
  const r = await sql<{
    attempts: number;
  }>`INSERT INTO request_limits(key_hash) VALUES(${fingerprint(scope + ":" + identity)}) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN request_limits.started_at<NOW()-${seconds}*INTERVAL '1 second' THEN 1 ELSE LEAST(request_limits.attempts+1,1000000) END,started_at=CASE WHEN request_limits.started_at<NOW()-${seconds}*INTERVAL '1 second' THEN NOW() ELSE request_limits.started_at END RETURNING attempts`;
  // Bounded opportunistic cleanup keeps one-off addresses from accumulating forever.
  if (Number(r.rows[0].attempts) === 1 && crypto.randomInt(32) === 0)
    await sql`DELETE FROM request_limits WHERE key_hash IN (SELECT key_hash FROM request_limits WHERE started_at<NOW()-INTERVAL '1 day' LIMIT 1000)`;
  if (Number(r.rows[0].attempts) > maximum)
    throw new ShopError("Слишком много запросов. Повторите позже.", 429);
}
export function sameOrigin(req: VercelRequest) {
  const origin = req.headers.origin;
  const host = String(
    req.headers["x-forwarded-host"] || req.headers.host || "",
  );
  try {
    const url = new URL(String(origin));
    if (url.host !== host || !["https:", "http:"].includes(url.protocol))
      throw new Error();
    if (process.env.VERCEL && url.protocol !== "https:") throw new Error();
  } catch {
    throw new ShopError("Обновите страницу и повторите попытку", 403);
  }
  if (req.headers["sec-fetch-site"] === "cross-site")
    throw new ShopError("Недопустимый источник запроса", 403);
}
export function validAdminKey(value: unknown) {
  const expected = (process.env.ADMIN_KEY || "").trim();
  if (
    !expected ||
    typeof value !== "string" ||
    value.length > 1024 ||
    !value.trim()
  )
    return false;
  return crypto.timingSafeEqual(
    Buffer.from(fingerprint(value.trim()), "hex"),
    Buffer.from(fingerprint(expected), "hex"),
  );
}
export function adminKeyVersion() {
  const key = (process.env.ADMIN_KEY || "").trim();
  return key ? fingerprint("admin-session-v1:" + key) : null;
}
export async function writeAdminAudit(
  actor: string,
  action: string,
  target: string | null,
  result: number,
) {
  await sql`INSERT INTO admin_audit(actor,action,target,result) VALUES(${actor},${action},${target?.slice(0, 100) || null},${result})`;
}
