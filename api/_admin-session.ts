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
  telegramId: number | null,
) {
  await ensureCommerceSchema();
  const value = crypto.randomBytes(32).toString("hex");
  await sql`DELETE FROM admin_sessions WHERE expires_at<=NOW()`;
  const previous = token(req);
  if (previous)
    await sql`DELETE FROM admin_sessions WHERE token_hash=${fingerprint(previous)}`;
  await sql`INSERT INTO admin_sessions(token_hash,telegram_id,key_version,expires_at) VALUES(${fingerprint(value)},${telegramId},${telegramId === null ? adminKeyVersion() : null},NOW()+${HOURS}*INTERVAL '1 hour')`;
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
    await sql`SELECT s.telegram_id,s.key_version,a.role FROM admin_sessions s LEFT JOIN admins a ON a.telegram_id=s.telegram_id WHERE s.token_hash=${fingerprint(value)} AND s.expires_at>NOW()`
  ).rows[0];
  if (!row) return null;
  if (row.telegram_id !== null) {
    if (!["admin", "super_admin"].includes(String(row.role))) return null;
    return { telegramId: Number(row.telegram_id), role: String(row.role) };
  }
  const version = adminKeyVersion();
  return version && row.key_version === version
    ? { telegramId: 0, role: "super_admin", firstName: "Admin" }
    : null;
}
