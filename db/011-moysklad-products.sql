ALTER TABLE products ALTER COLUMN price TYPE NUMERIC(12,2);
ALTER TABLE products ALTER COLUMN old_price TYPE NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS moysklad_id UUID UNIQUE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS moysklad_hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS moysklad_issue TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_available NUMERIC(15,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_synced_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS moysklad_product_images (
 product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
 remote_key TEXT NOT NULL,
 content BYTEA NOT NULL,
 content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE moysklad_settings ADD COLUMN IF NOT EXISTS products_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE moysklad_settings ADD COLUMN IF NOT EXISTS products_synced_at TIMESTAMPTZ;
ALTER TABLE moysklad_settings ADD COLUMN IF NOT EXISTS products_error TEXT;
ALTER TABLE moysklad_settings ADD COLUMN IF NOT EXISTS products_summary JSONB NOT NULL DEFAULT '{}';
