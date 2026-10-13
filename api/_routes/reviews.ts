import { requireCustomer } from "../_customer-auth.js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql, authenticateAdmin } from "../_helpers.js";
import { ensureCommerceSchema } from "../_schema.js";
import { positiveInteger, ShopError } from "../_commerce.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureCommerceSchema();
    if (req.method === "GET") {
      if (req.query.admin === "true") {
        if (!(await authenticateAdmin(req)).authorized)
          return res.status(401).json({ ok: false });
        return res.json({
          ok: true,
          reviews: (
            await sql`SELECT r.*,p.name AS product_name FROM product_reviews r JOIN products p ON p.id=r.product_id ORDER BY r.created_at DESC LIMIT 200`
          ).rows,
        });
      }
      return res.json({
        ok: true,
        reviews: (
          await sql`SELECT id,rating,message,created_at FROM product_reviews WHERE product_id=${positiveInteger(req.query.productId)} AND visible ORDER BY created_at DESC LIMIT 50`
        ).rows,
      });
    }
    if (req.method === "PUT") {
      if (!(await authenticateAdmin(req)).authorized)
        return res.status(401).json({ ok: false });
      await sql`UPDATE product_reviews SET visible=${req.body?.visible === true} WHERE id=${positiveInteger(req.body?.id)}`;
      return res.json({ ok: true });
    }
    if (req.method !== "POST") return res.status(405).json({ ok: false });
    const customer = await requireCustomer(req),
      userId = Number(customer.id);
    const productId = positiveInteger(req.body?.productId),
      rating = positiveInteger(req.body?.rating, 5),
      message = String(req.body?.message || "").trim();
    if (message.length > 2000) throw new ShopError("Отзыв слишком длинный");
    const purchase =
      await sql`SELECT 1 FROM orders o,jsonb_array_elements(o.items) item WHERE o.user_id=${userId} AND o.payment_status='succeeded' AND o.status!='cancelled' AND item->'product'->>'id'=${String(productId)} LIMIT 1`;
    if (!purchase.rows.length)
      throw new ShopError("Оценить товар можно после его покупки", 403);
    await sql`INSERT INTO product_reviews(product_id,user_id,telegram_id,rating,message) VALUES(${productId},${userId},${customer.telegram_id},${rating},${message}) ON CONFLICT(product_id,user_id) DO UPDATE SET rating=EXCLUDED.rating,message=EXCLUDED.message,visible=FALSE,created_at=NOW()`;
    return res.json({ ok: true });
  } catch (error) {
    return res.status(error instanceof ShopError ? error.status : 503).json({
      ok: false,
      error:
        error instanceof ShopError
          ? error.message
          : "Не удалось обработать отзывы",
    });
  }
}
