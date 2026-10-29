-- Idempotent base tables for a new installation, before versioned upgrades.
CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
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
      );
CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
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
CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        payment_method TEXT DEFAULT 'stars',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
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
      );
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'шт';
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight REAL;
