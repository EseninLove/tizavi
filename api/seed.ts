import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAdmin, sendJSON, unauthorized } from './_helpers';
import { products as seedProducts } from '../src/data/products';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const { authorized } = await authenticateAdmin(req);
  if (!authorized) return unauthorized(res);

  const { telegramId } = (req.body || {}) as { telegramId?: number };

  let sql: any;
  try {
    const pg = await import('@vercel/postgres');
    sql = pg.sql;
  } catch {
    return sendJSON(res, 500, {
      ok: false,
      error: 'База данных не подключена',
      detail: 'Vercel Postgres не найден. Создайте базу: Vercel Dashboard → проект → Storage → Create Database → Postgres, затем передеплойте.',
    });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        price INTEGER NOT NULL,
        old_price INTEGER,
        image TEXT DEFAULT '',
        category TEXT NOT NULL,
        rating REAL DEFAULT 5.0,
        reviews_count INTEGER DEFAULT 0,
        in_stock BOOLEAN DEFAULT TRUE,
        badge TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_number TEXT UNIQUE NOT NULL,
        items JSONB NOT NULL DEFAULT '[]',
        total INTEGER NOT NULL,
        delivery JSONB NOT NULL DEFAULT '{}',
        payment_method TEXT NOT NULL DEFAULT 'stars',
        status TEXT NOT NULL DEFAULT 'pending',
        telegram_user_id BIGINT,
        telegram_username TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        photo_url TEXT,
        orders_count INTEGER DEFAULT 0,
        total_spent INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_seen TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    if (telegramId) {
      await sql`
        INSERT INTO admins (telegram_id, role)
        VALUES (${telegramId}, 'super_admin')
        ON CONFLICT (telegram_id) DO NOTHING
      `;
    }

    const countResult = await sql`SELECT COUNT(*) as count FROM products`;
    if (parseInt((countResult.rows[0] as any).count, 10) === 0) {
      for (let i = 0; i < seedProducts.length; i++) {
        const p = seedProducts[i];
        await sql`
          INSERT INTO products (name, description, price, old_price, image, category, rating, reviews_count, in_stock, badge, sort_order)
          VALUES (${p.name}, ${p.description}, ${p.price}, ${p.oldPrice ?? null}, ${p.image}, ${p.category}, ${p.rating}, ${p.reviewsCount}, ${p.inStock}, ${p.badge ?? null}, ${i})
        `;
      }
    }

    return sendJSON(res, 200, {
      ok: true,
      message: 'База данных инициализирована',
      productsSeeded: seedProducts.length,
      adminAdded: telegramId ? true : false,
    });
  } catch (err) {
    return sendJSON(res, 500, {
      ok: false,
      error: 'Ошибка инициализации БД',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
