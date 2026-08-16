import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, authenticateAdmin, sendJSON, unauthorized } from '../_helpers.js';

function slugify(name: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return name
    .trim()
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'cat_' + Date.now().toString(36);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET /api/categories — список (публичный)
  if (req.method === 'GET') {
    try {
      const result = await sql`
        SELECT id, slug, name, emoji, sort_order
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
  if (req.method === 'POST') {
    const { name, emoji, sort_order } = (req.body || {}) as {
      name?: string;
      emoji?: string;
      sort_order?: number;
    };

    if (!name || !name.trim()) {
      return sendJSON(res, 400, { ok: false, error: 'Укажите название категории' });
    }

    const slug = slugify(name);

    try {
      const result = await sql`
        INSERT INTO categories (slug, name, emoji, sort_order)
        VALUES (${slug}, ${name.trim()}, ${(emoji || '📁').trim()}, ${Number(sort_order) || 0})
        RETURNING id, slug, name, emoji
      `;
      return sendJSON(res, 201, {
        ok: true,
        category: result.rows[0],
        message: 'Категория создана',
      });
    } catch {
      return sendJSON(res, 500, { ok: false, error: 'Ошибка создания категории' });
    }
  }

  // PUT /api/categories?id=X — обновление
  if (req.method === 'PUT') {
    const catId = parseInt(req.query.id as string, 10);
    if (isNaN(catId)) {
      return sendJSON(res, 400, { ok: false, error: 'Невалидный ID' });
    }

    const { name, emoji, sort_order } = (req.body || {}) as {
      name?: string;
      emoji?: string;
      sort_order?: number;
    };

    try {
      if (name && name.trim()) {
        await sql`
          UPDATE categories SET name = ${name.trim()}, slug = ${slugify(name)}
          WHERE id = ${catId}
        `;
      }
      if (emoji !== undefined) {
        await sql`UPDATE categories SET emoji = ${emoji.trim() || '📁'} WHERE id = ${catId}`;
      }
      if (sort_order !== undefined) {
        await sql`UPDATE categories SET sort_order = ${Number(sort_order) || 0} WHERE id = ${catId}`;
      }
      return sendJSON(res, 200, { ok: true, message: 'Категория обновлена' });
    } catch {
      return sendJSON(res, 500, { ok: false, error: 'Ошибка обновления категории' });
    }
  }

  // DELETE /api/categories?id=X — удаление
  if (req.method === 'DELETE') {
    const catId = parseInt(req.query.id as string, 10);
    if (isNaN(catId)) {
      return sendJSON(res, 400, { ok: false, error: 'Невалидный ID' });
    }

    try {
      await sql`DELETE FROM categories WHERE id = ${catId}`;
      return sendJSON(res, 200, { ok: true, message: 'Категория удалена' });
    } catch {
      return sendJSON(res, 500, { ok: false, error: 'Ошибка удаления категории' });
    }
  }

  return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
}
