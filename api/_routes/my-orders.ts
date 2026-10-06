import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, validateInitData } from "../_helpers.js";
import { ensureCommerceSchema } from "../_schema.js";
import { mapOrder } from "../_commerce.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  const { valid, userId } = validateInitData(req.body?.initData || "");
  if (!valid || !userId)
    return res
      .status(401)
      .json({ ok: false, error: "Откройте магазин в Telegram" });
  try {
    await ensureCommerceSchema();
    const result =
      await sql`SELECT * FROM orders WHERE telegram_user_id=${userId} ORDER BY created_at DESC LIMIT 100`;
    return res.json({ ok: true, orders: result.rows.map(mapOrder) });
  } catch {
    return res.status(503).json({
      ok: false,
      error: "Не удалось загрузить заказы. Повторите попытку.",
    });
  }
}
