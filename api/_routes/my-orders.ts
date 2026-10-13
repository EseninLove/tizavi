import { requireCustomer } from "../_customer-auth.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../_helpers.js";
import { ensureCommerceSchema } from "../_schema.js";
import { mapOrder, ShopError } from "../_commerce.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });
  try {
    const customer = await requireCustomer(req),
      userId = Number(customer.id);
    await ensureCommerceSchema();
    const result =
      await sql`SELECT * FROM orders WHERE user_id=${userId} ORDER BY created_at DESC LIMIT 100`;
    return res.json({ ok: true, orders: result.rows.map(mapOrder) });
  } catch (error) {
    return res.status(error instanceof ShopError ? error.status : 503).json({
      ok: false,
      error:
        error instanceof ShopError
          ? error.message
          : "Не удалось загрузить заказы. Повторите попытку.",
    });
  }
}
