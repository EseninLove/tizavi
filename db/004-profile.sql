-- A shop display name is independent of the name supplied by Telegram on each request.
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
