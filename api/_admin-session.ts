import { isStaffRole } from "../src/shared/staff.js";
import crypto from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "./_db.js";
import { ensureCommerceSchema } from "./_schema.js";
import { fingerprint, adminKeyVersion, sameOrigin } from "./_security.js";
const COOKIE = "tizavi_admin";
const HOURS = 8;
function token(req: VercelRequest) {
  const value = String(req.headers.cookie || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
function flags(req: VercelRequest) {
  return `Path=/api; HttpOnly; SameSite=Strict${process.env.VERCEL || req.headers["x-forwarded-proto"] === "https" ? "; Secure" : ""}`;
}
export async function createAdminSession(
  req: VercelRequest,
  res: VercelResponse,
  userId: number | null,
  customerTokenHash: string | null = null,
) {
  await ensureCommerceSchema();
  const value = crypto.randomBytes(32).toString("hex");
  await sql`DELETE FROM admin_sessions WHERE expires_at<=NOW()`;
  const previous = token(req);
  if (previous)
    await sql`DELETE FROM admin_sessions WHERE token_hash=${fingerprint(previous)}`;
  await sql`INSERT INTO admin_sessions(token_hash,user_id,customer_token_hash,key_version,expires_at) VALUES(${fingerprint(value)},${userId},${customerTokenHash},${userId === null ? adminKeyVersion() : null},NOW()+${HOURS}*INTERVAL '1 hour')`;
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${value}; ${flags(req)}; Max-Age=${HOURS * 3600}`,
  );
}
export async function removeAdminSession(
  req: VercelRequest,
  res: VercelResponse,
) {
  await ensureCommerceSchema();
  const value = token(req);
  if (value)
    await sql`DELETE FROM admin_sessions WHERE token_hash=${fingerprint(value)}`;
  res.setHeader("Set-Cookie", `${COOKIE}=; ${flags(req)}; Max-Age=0`);
}
export async function readAdminSession(req: VercelRequest) {
  const value = token(req);
  if (!value) return null;
  if (req.method !== "GET" && req.method !== "HEAD") sameOrigin(req);
  await ensureCommerceSchema();
  const row = (
    await sql`SELECT s.user_id,s.key_version,s.customer_token_hash,a.telegram_id,a.role FROM admin_sessions s LEFT JOIN admins a ON a.user_id=s.user_id WHERE s.token_hash=${fingerprint(value)} AND s.expires_at>NOW()`
  ).rows[0];
  if (!row) return null;
  if (row.customer_token_hash) {
    const customerCookie = String(req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("tizavi_customer="))
      ?.slice("tizavi_customer=".length);
    if (
      !customerCookie ||
      fingerprint(customerCookie) !== row.customer_token_hash
    )
      return null;
    if (
      !(
        await sql`SELECT 1 FROM customer_sessions WHERE token_hash=${row.customer_token_hash} AND expires_at>NOW()`
      ).rows.length
    )
      return null;
  }
  if (row.user_id !== null) {
    if (!isStaffRole(row.role)) return null;
    return {
      telegramId: Number(row.telegram_id || 0),
      userId: Number(row.user_id),
      role: String(row.role),
    };
  }
  const version = adminKeyVersion();
  return version && row.key_version === version
    ? { telegramId: 0, role: "super_admin", firstName: "Admin" }
    : null;
}
