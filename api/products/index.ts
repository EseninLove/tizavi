import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, authenticateAdmin, sendJSON, unauthorized } from '../_helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { authorized } = await authenticateAdmin(req);
  if (!authorized) return unauthorized(res);

  // GET /api/products — список
  if (req.method === 'GET') {
    try {
      const result = await sql`
        SELECT id, name, description, price, old_price, image, category,
               rating, reviews_count, in_stock, badge, sort_order
        FROM products
        ORDER BY sort_order ASC, created_at DESC
      `;
      return sendJSON(res, 200, { ok: true, products: result.rows });
    } catch {
      return sendJSON(res, 500, { ok: false, error: 'Ошибка получения товаров' });
    }
  }

  // POST /api/products — создание
  if (req.method === 'POST') {
    const body = (req.body || {}) as Record<string, unknown>;

    try {
      const result = await sql`
        INSERT INTO products (name, description, price, old_price, image, category, rating, reviews_count, in_stock, badge)
        VALUES (
          ${(body.name as string) || ''},
          ${(body.description as string) || ''},
          ${Number(body.price) || 0},
          ${body.old_price ? Number(body.old_price) : null},
          ${(body.image as string) || ''},
          ${(body.category as string) || 'other'},
          ${Number(body.rating) || 5.0},
          ${Number(body.reviews_count) || 0},
          ${body.in_stock !== false},
          ${(body.badge as string) || null}
        )
        RETURNING id
      `;

      return sendJSON(res, 201, {
        ok: true,
        id: (result.rows[0] as any).id,
        message: 'Товар создан',
      });
    } catch {
      return sendJSON(res, 500, { ok: false, error: 'Ошибка создания товара' });
    }
  }

  // PUT /api/products?id=X — обновление
  if (req.method === 'PUT') {
    const productId = parseInt(req.query.id as string, 10);
    if (isNaN(productId)) {
      return sendJSON(res, 400, { ok: false, error: 'Невалидный ID' });
    }

    const body = (req.body || {}) as Record<string, unknown>;

    try {
      await sql`
        UPDATE products SET
          name = ${(body.name as string) || ''},
          description = ${(body.description as string) || ''},
          price = ${Number(body.price) || 0},
          old_price = ${body.old_price ? Number(body.old_price) : null},
          image = ${(body.image as string) || ''},
          category = ${(body.category as string) || 'other'},
          rating = ${Number(body.rating) || 5.0},
          reviews_count = ${Number(body.reviews_count) || 0},
          in_stock = ${body.in_stock !== false},
          badge = ${(body.badge as string) || null},
          updated_at = NOW()
        WHERE id = ${productId}
      `;

      return sendJSON(res, 200, { ok: true, message: 'Товар обновлён' });
    } catch {
      return sendJSON(res, 500, { ok: false, error: 'Ошибка обновления товара' });
    }
  }

  // DELETE /api/products?id=X — удаление
  if (req.method === 'DELETE') {
    const productId = parseInt(req.query.id as string, 10);
    if (isNaN(productId)) {
      return sendJSON(res, 400, { ok: false, error: 'Невалидный ID' });
    }

    try {
      await sql`DELETE FROM products WHERE id = ${productId}`;
      return sendJSON(res, 200, { ok: true, message: 'Товар удалён' });
    } catch {
      return sendJSON(res, 500, { ok: false, error: 'Ошибка удаления товара' });
    }
  }

  return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
}
