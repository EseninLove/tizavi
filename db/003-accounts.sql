ALTER TABLE users ALTER COLUMN telegram_id DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(lower(email)) WHERE email IS NOT NULL;
-- Preserve customers referenced by historical records even if their profile was not saved.
INSERT INTO users(telegram_id) SELECT DISTINCT tid FROM (
 SELECT telegram_user_id AS tid FROM orders UNION SELECT telegram_id FROM payments
 UNION SELECT telegram_id FROM subscriptions UNION SELECT telegram_id FROM product_reviews
 UNION SELECT telegram_id FROM support_tickets
) legacy WHERE tid IS NOT NULL ON CONFLICT(telegram_id) DO NOTHING;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
UPDATE orders o SET user_id=u.id FROM users u WHERE o.telegram_user_id=u.telegram_id AND o.user_id IS NULL;
UPDATE payments p SET user_id=u.id FROM users u WHERE p.telegram_id=u.telegram_id AND p.user_id IS NULL;
UPDATE subscriptions s SET user_id=u.id FROM users u WHERE s.telegram_id=u.telegram_id AND s.user_id IS NULL;
UPDATE product_reviews r SET user_id=u.id FROM users u WHERE r.telegram_id=u.telegram_id AND r.user_id IS NULL;
UPDATE support_tickets t SET user_id=u.id FROM users u WHERE t.telegram_id=u.telegram_id AND t.user_id IS NULL;
ALTER TABLE payments ALTER COLUMN telegram_id DROP NOT NULL;
ALTER TABLE subscriptions ALTER COLUMN telegram_id DROP NOT NULL;
ALTER TABLE product_reviews ALTER COLUMN telegram_id DROP NOT NULL;
ALTER TABLE support_tickets ALTER COLUMN telegram_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_account_request ON orders(user_id,request_key);
CREATE UNIQUE INDEX IF NOT EXISTS payments_account_request ON payments(user_id,request_key);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_account_unique ON subscriptions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_account_unique ON product_reviews(product_id,user_id);
CREATE INDEX IF NOT EXISTS support_account ON support_tickets(user_id);
CREATE TABLE IF NOT EXISTS customer_sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customer_sessions_user ON customer_sessions(user_id);
CREATE TABLE IF NOT EXISTS auth_attempts (
 key_hash TEXT PRIMARY KEY, started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), attempts INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS email_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), provider TEXT NOT NULL DEFAULT 'smtp', host TEXT NOT NULL DEFAULT '',
 port INTEGER NOT NULL DEFAULT 465, username TEXT NOT NULL DEFAULT '', sender TEXT NOT NULL DEFAULT '',
 security TEXT NOT NULL DEFAULT 'tls', encrypted_password TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO email_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
