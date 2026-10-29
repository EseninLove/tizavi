import { ensureCommerceSchema } from "../../_schema.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, authorizeStaff, sendJSON } from "../../_helpers.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendJSON(res, 405, { ok: false, error: "Method not allowed" });
  }

  if (!(await authorizeStaff(req, res, "customers"))) return;

  try {
    await ensureCommerceSchema();
    const result = await sql`
      SELECT id, telegram_id, email, email_verified, username, first_name, last_name, photo_url,
             orders_count, total_spent, created_at, last_seen
      FROM users
      ORDER BY last_seen DESC
    `;

    return sendJSON(res, 200, { ok: true, users: result.rows });
  } catch {
    return sendJSON(res, 500, {
      ok: false,
      error: "Ошибка получения пользователей",
    });
  }
}
