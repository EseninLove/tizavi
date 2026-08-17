import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticateAdmin, sendJSON, unauthorized } from './_helpers.js';
import { sql } from './_db.js';
import { seedProducts } from './_seed-data.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const { authorized } = await authenticateAdmin(req);
  if (!authorized) return unauthorized(res);

  const { telegramId } = (req.body || {}) as { telegramId?: number };

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
        unit TEXT DEFAULT 'шт',
        weight REAL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
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
    await sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        payment_method TEXT DEFAULT 'stars',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT NOT NULL,
        username TEXT,
        user_name TEXT,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        reply TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        replied_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Миграции под продуктовый формат
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'шт'`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS weight REAL`;
    await sql`ALTER TABLE categories DROP COLUMN IF EXISTS emoji`;

    if (telegramId) {
      await sql`
        INSERT INTO admins (telegram_id, role)
        VALUES (${telegramId}, 'super_admin')
        ON CONFLICT (telegram_id) DO NOTHING
      `;
    }

    // Сидируем продуктовые категории по умолчанию
    const defaultCategories = [
      { slug: 'fruits-vegetables', name: 'Овощи и фрукты' },
      { slug: 'dairy', name: 'Молочные продукты и яйца' },
      { slug: 'meat', name: 'Мясо и птица' },
      { slug: 'fish', name: 'Рыба и морепродукты' },
      { slug: 'bakery', name: 'Хлеб и выпечка' },
      { slug: 'pantry', name: 'Бакалея' },
      { slug: 'drinks', name: 'Напитки' },
      { slug: 'frozen', name: 'Заморозка' },
      { slug: 'sweets', name: 'Сладости и снеки' },
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

    return sendJSON(res, 200, {
      ok: true,
      message: 'База данных инициализирована',
      productsSeeded,
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
