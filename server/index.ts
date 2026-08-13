import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

// ─── База данных ───────────────────────────────────────────
const connectionString =
  process.env.DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  '';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function sql(strings, ...values) {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''),
    ''
  );
  const client = await pool.connect();
  try {
    const result = await client.query(text, values);
    return { rows: result.rows, rowCount: result.rowCount };
  } finally {
    client.release();
  }
}

// ─── Авторизация ───────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const ADMIN_KEY = process.env.ADMIN_KEY || '';

function validateInitData(initData) {
  try {
    if (!BOT_TOKEN) return { valid: false };
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    if (calculatedHash !== hash) return { valid: false };
    const userParam = new URLSearchParams(initData).get('user');
    if (!userParam) return { valid: false };
    const user = JSON.parse(userParam);
    return { valid: true, userId: user.id };
  } catch {
    return { valid: false };
  }
}

async function authenticateAdmin(req) {
  const authHeader = req.headers['x-admin-auth'];
  if (!authHeader) return { authorized: false };

  const [type, token] = authHeader.split(' ');

  if (type === 'Key' && token && token.trim() === ADMIN_KEY.trim()) {
    return { authorized: true, user: { role: 'super_admin', firstName: 'Admin' } };
  }

  if (type === 'Telegram' && token) {
    const { valid, userId } = validateInitData(token);
    if (!valid || !userId) return { authorized: false };
    try {
      const result = await sql`SELECT 1 FROM admins WHERE telegram_id = ${userId}`;
      if ((result.rowCount ?? 0) > 0) {
        return { authorized: true, user: { telegramId: userId, role: 'admin' } };
      }
    } catch {
      // ignore
    }
  }

  return { authorized: false };
}

function requireAuth(req, res, next) {
  authenticateAdmin(req).then(({ authorized }) => {
    if (authorized) return next();
    res.status(401).json({ ok: false, error: 'Не авторизован' });
  });
}

// ─── API маршруты ──────────────────────────────────────────

// Проверка API
app.get('/api/ping', (_req, res) => {
  res.json({
    ok: true,
    message: 'API работает',
    time: new Date().toISOString(),
    hasAdminKey: !!ADMIN_KEY,
    hasBotToken: !!BOT_TOKEN,
    hasDb: !!connectionString,
  });
});

// Проверка БД
app.get('/api/db-test', async (_req, res) => {
  try {
    const result = await sql`SELECT NOW() as now, version() as version`;
    res.json({ ok: true, time: result.rows[0].now, version: String(result.rows[0].version).slice(0, 60) });
  } catch (err) {
    res.status(500).json({
      ok: false,
      hasDb: !!connectionString,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// Авторизация админа
app.post('/api/admin-auth', async (req, res) => {
  const { initData, adminKey } = req.body || {};
  if (adminKey) {
    if (ADMIN_KEY && adminKey.trim() === ADMIN_KEY.trim()) {
      return res.json({ ok: true, method: 'key', user: { role: 'super_admin', firstName: 'Admin' } });
    }
    return res.status(401).json({ ok: false, error: 'Неверный ключ администратора' });
  }
  if (initData) {
    const { valid, userId } = validateInitData(initData);
    if (!valid || !userId) {
      return res.status(401).json({ ok: false, error: 'Невалидные данные Telegram' });
    }
    let isAdmin = false;
    try {
      const result = await sql`SELECT 1 FROM admins WHERE telegram_id = ${userId}`;
      isAdmin = (result.rowCount ?? 0) > 0;
    } catch {
      return res.status(500).json({ ok: false, error: 'База данных недоступна' });
    }
    if (!isAdmin) return res.status(403).json({ ok: false, error: 'У вас нет прав администратора' });
    const userParam = new URLSearchParams(initData).get('user');
    const user = userParam ? JSON.parse(userParam) : {};
    return res.json({
      ok: true,
      method: 'telegram',
      user: { telegramId: userId, username: user.username, firstName: user.first_name, role: 'admin' },
    });
  }
  return res.status(400).json({ ok: false, error: 'Не переданы данные' });
});

// Дашборд
app.get('/api/dashboard', requireAuth, async (_req, res) => {
  try {
    const [productsR, ordersR, usersR] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM products`,
      sql`SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue FROM orders`,
      sql`SELECT COUNT(*) as count FROM users`,
    ]);
    const statusCounts = {};
    const statusR = await sql`SELECT status, COUNT(*) as count FROM orders GROUP BY status`;
    statusR.rows.forEach(r => (statusCounts[r.status] = parseInt(r.count, 10)));

    const recentOrders = await sql`
      SELECT id, order_number, total, status, customer_name, created_at
      FROM orders ORDER BY created_at DESC LIMIT 10
    `;
    const topProducts = await sql`
      SELECT p.name, p.image, COUNT(oi->>'product_id') as times_ordered
      FROM orders, jsonb_array_elements(items) as oi
      JOIN products p ON (oi->>'product_id')::int = p.id
      GROUP BY p.name, p.image
      ORDER BY times_ordered DESC LIMIT 5
    `;
    res.json({
      ok: true,
      stats: {
        products: parseInt(productsR.rows[0].count, 10),
        orders: parseInt(ordersR.rows[0].count, 10),
        users: parseInt(usersR.rows[0].count, 10),
        revenue: parseInt(ordersR.rows[0].revenue, 10),
        statusCounts,
      },
      recentOrders: recentOrders.rows,
      topProducts: topProducts.rows,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Ошибка БД', detail: err.message });
  }
});

// Товары
app.get('/api/products', async (_req, res) => {
  try {
    const result = await sql`
      SELECT id, name, description, price, old_price, image, category,
             rating, reviews_count, in_stock, badge, sort_order
      FROM products ORDER BY sort_order ASC, created_at DESC
    `;
    res.json({ ok: true, products: result.rows });
  } catch {
    res.status(500).json({ ok: false, error: 'Ошибка получения товаров' });
  }
});

app.post('/api/products', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const result = await sql`
      INSERT INTO products (name, description, price, old_price, image, category, rating, reviews_count, in_stock, badge)
      VALUES (${b.name || ''}, ${b.description || ''}, ${Number(b.price) || 0}, ${b.old_price || null},
              ${b.image || ''}, ${b.category || 'other'}, ${Number(b.rating) || 5}, ${Number(b.reviews_count) || 0},
              ${b.in_stock !== false}, ${b.badge || null})
      RETURNING id
    `;
    res.status(201).json({ ok: true, id: result.rows[0].id, message: 'Товар создан' });
  } catch {
    res.status(500).json({ ok: false, error: 'Ошибка создания товара' });
  }
});

app.put('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    await sql`
      UPDATE products SET
        name = ${b.name || ''}, description = ${b.description || ''},
        price = ${Number(b.price) || 0}, old_price = ${b.old_price || null},
        image = ${b.image || ''}, category = ${b.category || 'other'},
        rating = ${Number(b.rating) || 5}, reviews_count = ${Number(b.reviews_count) || 0},
        in_stock = ${b.in_stock !== false}, badge = ${b.badge || null},
        updated_at = NOW()
      WHERE id = ${parseInt(req.params.id, 10)}
    `;
    res.json({ ok: true, message: 'Товар обновлён' });
  } catch {
    res.status(500).json({ ok: false, error: 'Ошибка обновления товара' });
  }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  try {
    await sql`DELETE FROM products WHERE id = ${parseInt(req.params.id, 10)}`;
    res.json({ ok: true, message: 'Товар удалён' });
  } catch {
    res.status(500).json({ ok: false, error: 'Ошибка удаления товара' });
  }
});

// Заказы
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const status = req.query.status;
    const result = status && status !== 'all'
      ? await sql`SELECT * FROM orders WHERE status = ${status} ORDER BY created_at DESC`
      : await sql`SELECT * FROM orders ORDER BY created_at DESC`;
    res.json({ ok: true, orders: result.rows });
  } catch {
    res.status(500).json({ ok: false, error: 'Ошибка получения заказов' });
  }
});

app.put('/api/orders/:id', requireAuth, async (req, res) => {
  const VALID = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  const { status } = req.body || {};
  if (!status || !VALID.includes(status)) {
    return res.status(400).json({ ok: false, error: `Статус должен быть: ${VALID.join(', ')}` });
  }
  try {
    await sql`UPDATE orders SET status = ${status}, updated_at = NOW() WHERE id = ${parseInt(req.params.id, 10)}`;
    res.json({ ok: true, message: 'Статус обновлён' });
  } catch {
    res.status(500).json({ ok: false, error: 'Ошибка обновления заказа' });
  }
});

// Пользователи
app.get('/api/users', requireAuth, async (_req, res) => {
  try {
    const result = await sql`
      SELECT id, telegram_id, username, first_name, last_name, photo_url,
             orders_count, total_spent, created_at, last_seen
      FROM users ORDER BY last_seen DESC
    `;
    res.json({ ok: true, users: result.rows });
  } catch {
    res.status(500).json({ ok: false, error: 'Ошибка получения пользователей' });
  }
});

// Администраторы
app.get('/api/admins', requireAuth, async (_req, res) => {
  try {
    const result = await sql`SELECT id, telegram_id, role, created_at FROM admins ORDER BY created_at ASC`;
    res.json({ ok: true, admins: result.rows });
  } catch {
    res.status(500).json({ ok: false, error: 'Ошибка получения админов' });
  }
});

app.post('/api/admins', requireAuth, async (req, res) => {
  const { telegramId, role } = req.body || {};
  if (!telegramId || isNaN(telegramId)) {
    return res.status(400).json({ ok: false, error: 'Укажите корректный Telegram ID' });
  }
  try {
    await sql`
      INSERT INTO admins (telegram_id, role)
      VALUES (${telegramId}, ${role || 'admin'})
      ON CONFLICT (telegram_id) DO NOTHING
    `;
    res.status(201).json({ ok: true, message: 'Админ добавлен' });
  } catch {
    res.status(500).json({ ok: false, error: 'Ошибка добавления админа' });
  }
});

app.delete('/api/admins/:id', requireAuth, async (req, res) => {
  try {
    await sql`DELETE FROM admins WHERE id = ${parseInt(req.params.id, 10)}`;
    res.json({ ok: true, message: 'Админ удалён' });
  } catch {
    res.status(500).json({ ok: false, error: 'Ошибка удаления админа' });
  }
});

// Инициализация БД
app.post('/api/seed', requireAuth, async (req, res) => {
  const { telegramId } = req.body || {};
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

    const countR = await sql`SELECT COUNT(*) as count FROM products`;
    let productsSeeded = 0;
    if (parseInt(countR.rows[0].count, 10) === 0) {
      const { seedProducts } = await import('./seed-data.js');
      for (let i = 0; i < seedProducts.length; i++) {
        const p = seedProducts[i];
        await sql`
          INSERT INTO products (name, description, price, old_price, image, category, rating, reviews_count, in_stock, badge, sort_order)
          VALUES (${p.name}, ${p.description}, ${p.price}, ${p.oldPrice ?? null}, ${p.image}, ${p.category}, ${p.rating}, ${p.reviewsCount}, ${p.inStock}, ${p.badge ?? null}, ${i})
        `;
      }
      productsSeeded = seedProducts.length;
    }

    res.json({
      ok: true,
      message: 'База данных инициализирована',
      productsSeeded,
      adminAdded: !!telegramId,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: 'Ошибка инициализации БД',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

// Создание счёта для оплаты
app.post('/api/create-invoice', async (req, res) => {
  const BOT = process.env.BOT_TOKEN;
  const PROVIDER = process.env.PROVIDER_TOKEN;
  const { title, description, payload, method, rubAmount, starsAmount } = req.body || {};

  if (!BOT) return res.status(500).json({ ok: false, error: 'BOT_TOKEN не задан' });

  const isStars = method === 'stars';
  const providerToken = isStars ? '' : PROVIDER;
  const amount = isStars ? starsAmount : Math.round(rubAmount * 100);

  if (!isStars && !providerToken) {
    return res.status(500).json({ ok: false, error: 'PROVIDER_TOKEN не задан' });
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        payload,
        provider_token: providerToken,
        currency: isStars ? 'XTR' : 'RUB',
        prices: [{ label: title, amount }],
      }),
    });
    const data = await tgRes.json();
    if (!data.ok) {
      return res.status(400).json({ ok: false, error: data.description || 'Не удалось создать счёт' });
    }
    res.json({ ok: true, invoiceLink: data.result });
  } catch {
    res.status(500).json({ ok: false, error: 'Ошибка при создании счёта' });
  }
});

// ─── Статика (SPA) ─────────────────────────────────────────
const distPath = path.join(__dirname, '..', 'dist');
import fs from 'fs';
if (!fs.existsSync(distPath)) {
  console.error(`[warning] dist folder not found at ${distPath}`);
}
app.use(express.static(distPath));
app.get(/^\/(?!api).*/, (_req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Build not found');
  }
});

// ─── Запуск ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Dist path: ${distPath}`);
  console.log(`DB_URL set: ${!!connectionString}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
