import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "../../_db.js";
import { authenticateAdmin } from "../../_helpers.js";
import { ensureCommerceSchema } from "../../_schema.js";
import { positiveInteger, ShopError } from "../../_commerce.js";
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureCommerceSchema();
    if (req.method === "GET") {
      const products =
        await sql`SELECT p.*,COALESCE(r.actual_count,0) AS actual_reviews_count,
        CASE WHEN p.reviews_count+COALESCE(r.actual_count,0)>0 THEN ROUND(((p.rating*p.reviews_count+COALESCE(r.rating_sum,0))/(p.reviews_count+COALESCE(r.actual_count,0)))::numeric,1) ELSE 0 END AS effective_rating,
        COALESCE(s.purchase_count,0) AS purchase_count
        FROM products p
        LEFT JOIN LATERAL(SELECT COUNT(*)::int AS actual_count,SUM(rating) AS rating_sum FROM product_reviews WHERE product_id=p.id AND visible) r ON TRUE
        LEFT JOIN LATERAL(SELECT COUNT(*)::int AS purchase_count FROM orders o,jsonb_array_elements(o.items) item WHERE o.payment_status='succeeded' AND o.status!='cancelled' AND item->'product'->>'id'=p.id::text) s ON TRUE
        ORDER BY p.sort_order ASC,p.created_at DESC`;
      return res.json({ ok: true, products: products.rows });
    }
    if (!(await authenticateAdmin(req)).authorized)
      return res.status(401).json({ ok: false, error: "Нет доступа" });
    if (req.method === "DELETE") {
      await sql`DELETE FROM products WHERE id=${positiveInteger(req.query.id)}`;
      return res.json({ ok: true });
    }
    if (!["POST", "PUT"].includes(req.method || ""))
      return res.status(405).json({ ok: false });
    const b = req.body || {};
    const price = Number(b.price),
      rating = Number(b.rating || 0),
      reviews = Number(b.reviews_count || 0);
    if (
      !b.name?.trim() ||
      !Number.isFinite(price) ||
      price <= 0 ||
      price > 1000000 ||
      !Number.isFinite(rating) ||
      rating < 0 ||
      rating > 5 ||
      !Number.isSafeInteger(reviews) ||
      reviews < 0 ||
      reviews > 1000000 ||
      (reviews > 0 && rating < 1)
    )
      throw new ShopError("Проверьте название, цену и оценки");
    if (!["шт", "кг", "л"].includes(b.unit))
      throw new ShopError("Выберите единицу продажи");
    if (
      !b.category ||
      (await sql`SELECT 1 FROM categories WHERE slug=${b.category}`).rows
        .length === 0
    )
      throw new ShopError("Выберите существующую категорию");
    const old = b.old_price ? Number(b.old_price) : null,
      weight = b.weight ? Number(b.weight) : null;
    if (
      (old !== null && (!Number.isFinite(old) || old <= price)) ||
      (weight !== null && (!Number.isFinite(weight) || weight <= 0))
    )
      throw new ShopError(
        "Старая цена должна быть выше текущей, вес — положительным",
      );
    if (req.method === "POST") {
      const result =
        await sql`INSERT INTO products(name,description,price,old_price,image,category,rating,reviews_count,in_stock,badge,unit,weight,brand,synonyms,seasonal,popular,package_label) VALUES(${b.name.trim()},${String(b.description || "")},${price},${old},${String(b.image || "")},${b.category},${rating},${reviews},${b.in_stock !== false},${b.badge || null},${b.unit},${weight},${String(b.brand || "")},${String(b.synonyms || "")},${b.seasonal === true},${b.popular === true},${String(b.package_label || "")}) RETURNING id`;
      return res.status(201).json({ ok: true, id: result.rows[0].id });
    }
    await sql`UPDATE products SET name=${b.name.trim()},description=${String(b.description || "")},price=${price},old_price=${old},image=${String(b.image || "")},category=${b.category},rating=${rating},reviews_count=${reviews},in_stock=${b.in_stock !== false},badge=${b.badge || null},unit=${b.unit},weight=${weight},brand=${String(b.brand || "")},synonyms=${String(b.synonyms || "")},seasonal=${b.seasonal === true},popular=${b.popular === true},package_label=${String(b.package_label || "")},updated_at=NOW() WHERE id=${positiveInteger(req.query.id)}`;
    return res.json({ ok: true });
  } catch (error) {
    return res.status(error instanceof ShopError ? error.status : 503).json({
      ok: false,
      error:
        error instanceof ShopError
          ? error.message
          : "Не удалось обработать товары",
    });
  }
}
