ALTER TABLE admins ALTER COLUMN telegram_id DROP NOT NULL;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
UPDATE admins a SET user_id=u.id FROM users u WHERE a.user_id IS NULL AND a.telegram_id=u.telegram_id;
CREATE UNIQUE INDEX IF NOT EXISTS admins_account_unique ON admins(user_id) WHERE user_id IS NOT NULL;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS customer_token_hash TEXT REFERENCES customer_sessions(token_hash) ON DELETE CASCADE;
UPDATE admin_sessions s SET user_id=a.user_id FROM admins a WHERE s.telegram_id=a.telegram_id AND a.user_id IS NOT NULL;
-- Only unlinked legacy sessions expire; employee records and permissions are preserved.
DELETE FROM admin_sessions WHERE telegram_id IS NOT NULL AND user_id IS NULL;
ALTER TABLE admin_sessions DROP CONSTRAINT IF EXISTS admin_sessions_check;
ALTER TABLE admin_sessions ADD CONSTRAINT admin_sessions_identity CHECK (
 (user_id IS NOT NULL AND key_version IS NULL) OR
 (user_id IS NULL AND telegram_id IS NULL AND key_version IS NOT NULL)
);
