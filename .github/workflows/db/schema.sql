-- Tizavi Shop — схема базы данных для Vercel Postgres

-- Таблица администраторов
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица товаров
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
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order);

-- Таблица заказов
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
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(telegram_user_id);

-- Таблица пользователей
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
);

-- Начальный админ (замените TELEGRAM_ID на свой)
-- INSERT INTO admins (telegram_id, role) VALUES (YOUR_TELEGRAM_ID, 'super_admin')
-- Выполнить через API /api/seed или через Vercel dashboard
