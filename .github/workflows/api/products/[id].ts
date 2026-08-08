import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, authenticateAdmin, sendJSON, unauthorized } from '../_helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { authorized } = await authenticateAdmin(req);
  if (!authorized) return unauthorized(res);

  const { id } = req.query;

  if (typeof id !== 'string') {
    return sendJSON(res, 400, { ok: false, error: 'ID не указан' });
  }

  const productId = parseInt(id, 10);
  if (isNaN(productId)) {
    return sendJSON(res, 400, { ok: false, error: 'Невалидный ID' });
  }

  // PUT — обновление товара
  if (req.method === 'PUT') {
    const body = req.body as Record<string, unknown>;

    try {
      await sql`
        UPDATE products SET
          name = ${body.name as string},
          description = ${(body.description as string) || ''},
          price = ${Number(body.price)},
          old_price = ${body.old_price ? Number(body.old_price) : null},
          image = ${(body.image as string) || ''},
          category = ${(body.category as string) || 'other'},
          rating = ${body.rating ? Number(body.rating) : 5.0},
          reviews_count = ${body.reviews_count ? Number(body.reviews_count) : 0},
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

  // DELETE — удаление товара
  if (req.method === 'DELETE') {
    try {
      await sql`DELETE FROM products WHERE id = ${productId}`;
      return sendJSON(res, 200, { ok: true, message: 'Товар удалён' });
    } catch {
      return sendJSON(res, 500, { ok: false, error: 'Ошибка удаления товара' });
    }
  }

  return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
}
