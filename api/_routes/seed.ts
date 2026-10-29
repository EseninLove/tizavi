import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateAdmin, sendJSON } from "../_helpers.js";
import { sql } from "../_db.js";
import { seedProducts } from "../_seed-data.js";
import { ensureCommerceSchema } from "../_schema.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendJSON(res, 405, { ok: false, error: "Method not allowed" });
  }

  const { authorized, user } = await authenticateAdmin(req);
  if (!authorized || user?.role !== "super_admin")
    return res
      .status(403)
      .json({ ok: false, error: "Операция доступна владельцу" });
  if (process.env.ENABLE_CATALOG_SEED !== "true")
    return res.status(403).json({
      ok: false,
      error: "Первоначальное заполнение отключено на сервере",
    });

  try {
    await ensureCommerceSchema();

    // Сидируем продуктовые категории по умолчанию
    const defaultCategories = [
      { slug: "fruits-vegetables", name: "Овощи и фрукты" },
      { slug: "dairy", name: "Молочные продукты и яйца" },
      { slug: "meat", name: "Мясо и птица" },
      { slug: "fish", name: "Рыба и морепродукты" },
      { slug: "bakery", name: "Хлеб и выпечка" },
      { slug: "pantry", name: "Бакалея" },
      { slug: "drinks", name: "Напитки" },
      { slug: "frozen", name: "Заморозка" },
      { slug: "sweets", name: "Сладости и снеки" },
    ];
    for (let i = 0; i < defaultCategories.length; i++) {
      const c = defaultCategories[i];
      await sql`
        INSERT INTO categories (slug, name, sort_order)
        VALUES (${c.slug}, ${c.name}, ${i})
        ON CONFLICT (slug) DO NOTHING
      `;
    }

    // Удаляем демо-категории старого универсального магазина, если они не используются
    await sql`
      DELETE FROM categories
      WHERE slug IN ('electronics', 'clothing', 'home', 'beauty', 'sports', 'books', 'other')
        AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category = categories.slug)
    `;

    const countResult = await sql`SELECT COUNT(*) as count FROM products`;
    let productsSeeded = 0;
    if (parseInt((countResult.rows[0] as any).count, 10) === 0) {
      for (let i = 0; i < seedProducts.length; i++) {
        const p = seedProducts[i];
        await sql`
          INSERT INTO products (name, description, price, old_price, image, category, rating, reviews_count, in_stock, badge, unit, weight, sort_order)
          VALUES (${p.name}, ${p.description}, ${p.price}, ${p.oldPrice ?? null}, ${p.image}, ${p.category}, ${p.rating}, ${p.reviewsCount}, ${p.inStock}, ${p.badge ?? null}, ${p.unit}, ${p.weight ?? null}, ${i})
        `;
      }
      productsSeeded = seedProducts.length;
    }

    await ensureCommerceSchema();
    return sendJSON(res, 200, {
      ok: true,
      message: "База данных инициализирована",
      productsSeeded,
      adminAdded: false,
    });
  } catch (err) {
    return sendJSON(res, 500, {
      ok: false,
      error: "Ошибка инициализации БД",
    });
  }
}
