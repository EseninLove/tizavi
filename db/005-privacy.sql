CREATE TABLE IF NOT EXISTS privacy_settings (
 id INTEGER PRIMARY KEY CHECK(id=1), operator_name TEXT NOT NULL DEFAULT '', inn TEXT NOT NULL DEFAULT '',
 address TEXT NOT NULL DEFAULT '', contact_email TEXT NOT NULL DEFAULT '', retention TEXT NOT NULL DEFAULT '',
 recipients TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO privacy_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS privacy_requests (
 id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('access','correction','withdrawal','deletion')),
 message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','answered')),
 reply TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS privacy_one_open_kind ON privacy_requests(user_id,kind) WHERE status IN ('open','in_progress');
CREATE TABLE IF NOT EXISTS privacy_audit (
 id BIGSERIAL PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, request_id BIGINT REFERENCES privacy_requests(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
