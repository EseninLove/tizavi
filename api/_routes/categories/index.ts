import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  sql,
  authenticateAdmin,
  sendJSON,
  unauthorized,
} from "../../_helpers.js";
import { ensureCommerceSchema } from "../../_schema.js";
import crypto from "node:crypto";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureCommerceSchema();
  // GET /api/categories — список (публичный)
  if (req.method === "GET") {
    try {
      const result = await sql`
        SELECT id, slug, name, sort_order, image, icon
        FROM categories
        ORDER BY sort_order ASC, id ASC
      `;
      return sendJSON(res, 200, { ok: true, categories: result.rows });
    } catch {
      return sendJSON(res, 200, { ok: true, categories: [] });
    }
  }

  const { authorized } = await authenticateAdmin(req);
  if (!authorized) return unauthorized(res);

  // POST /api/categories — создание
  if (req.method === "POST") {
    const { name, sort_order, image, icon } = (req.body || {}) as {
      name?: string;
      sort_order?: number;
      image?: string;
      icon?: string;
    };

    if (!name || !name.trim()) {
      return sendJSON(res, 400, {
        ok: false,
        error: "Укажите название категории",
      });
    }

    const slug = "cat_" + crypto.randomUUID();

    try {
      const result = await sql`
        INSERT INTO categories (slug, name, sort_order, image, icon)
        VALUES (${slug}, ${name.trim()}, ${Number(sort_order) || 0}, ${image || ""}, ${icon || "📦"})
        RETURNING id, slug, name
      `;
      return sendJSON(res, 201, {
        ok: true,
        category: result.rows[0],
        message: "Категория создана",
      });
    } catch {
      return sendJSON(res, 500, {
        ok: false,
        error: "Ошибка создания категории",
      });
    }
  }

  // PUT /api/categories?id=X — обновление
  if (req.method === "PUT") {
    const catId = parseInt(req.query.id as string, 10);
    if (isNaN(catId)) {
      return sendJSON(res, 400, { ok: false, error: "Невалидный ID" });
    }

    const { name, sort_order, image, icon } = (req.body || {}) as {
      name?: string;
      sort_order?: number;
      image?: string;
      icon?: string;
    };

    try {
      if (name && name.trim()) {
        await sql`
          UPDATE categories SET name = ${name.trim()}
          WHERE id = ${catId}
        `;
      }
      if (sort_order !== undefined) {
        await sql`UPDATE categories SET sort_order = ${Number(sort_order) || 0} WHERE id = ${catId}`;
      }
      if (image !== undefined)
        await sql`UPDATE categories SET image=${String(image).slice(0, 1000)} WHERE id=${catId}`;
      if (icon !== undefined)
        await sql`UPDATE categories SET icon=${String(icon).slice(0, 20)} WHERE id=${catId}`;
      return sendJSON(res, 200, { ok: true, message: "Категория обновлена" });
    } catch {
      return sendJSON(res, 500, {
        ok: false,
        error: "Ошибка обновления категории",
      });
    }
  }

  // DELETE /api/categories?id=X — удаление
  if (req.method === "DELETE") {
    const catId = parseInt(req.query.id as string, 10);
    if (isNaN(catId)) {
      return sendJSON(res, 400, { ok: false, error: "Невалидный ID" });
    }

    try {
      const used =
        await sql`SELECT 1 FROM products WHERE category=(SELECT slug FROM categories WHERE id=${catId}) LIMIT 1`;
      if (used.rows.length)
        return sendJSON(res, 409, {
          ok: false,
          error: "Сначала перенесите товары в другую категорию",
        });
      await sql`DELETE FROM categories WHERE id = ${catId}`;
      return sendJSON(res, 200, { ok: true, message: "Категория удалена" });
    } catch {
      return sendJSON(res, 500, {
        ok: false,
        error: "Ошибка удаления категории",
      });
    }
  }

  return sendJSON(res, 405, { ok: false, error: "Method not allowed" });
}
