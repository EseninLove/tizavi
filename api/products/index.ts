import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, authenticateAdmin, sendJSON, unauthorized } from '../_helpers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  if (req.method === 'POST') {
    const { authorized } = await authenticateAdmin(req);
    if (!authorized) return unauthorized(res);

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

  return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
}
