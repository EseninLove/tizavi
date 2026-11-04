-- Connection preparation only. Catalog and orders are not modified by this migration.
CREATE TABLE IF NOT EXISTS moysklad_settings (
 id INTEGER PRIMARY KEY CHECK(id=1),
 token_encrypted TEXT,
 organization_id UUID,
 store_id UUID,
 price_type_id UUID,
 reference_data JSONB NOT NULL DEFAULT '{"organizations":[],"stores":[],"priceTypes":[]}'::jsonb,
 catalog_count INTEGER NOT NULL DEFAULT 0 CHECK(catalog_count>=0),
 catalog_preview JSONB NOT NULL DEFAULT '[]'::jsonb,
 checked_at TIMESTAMPTZ,
 last_error TEXT,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO moysklad_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
