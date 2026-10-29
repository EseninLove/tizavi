CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash TEXT PRIMARY KEY,
 telegram_id BIGINT,
 key_version TEXT,
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK ((telegram_id IS NOT NULL AND key_version IS NULL) OR (telegram_id IS NULL AND key_version IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS request_limits (
 key_hash TEXT PRIMARY KEY,
 started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 attempts INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS request_limits_started ON request_limits(started_at);
CREATE TABLE IF NOT EXISTS admin_audit (
 id BIGSERIAL PRIMARY KEY,
 actor TEXT NOT NULL,
 action TEXT NOT NULL,
 target TEXT,
 result INTEGER NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_audit_created ON admin_audit(created_at);
