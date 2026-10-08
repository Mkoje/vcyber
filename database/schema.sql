-- PostgreSQL production schema. Money is an integer number of KES.
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, admin INTEGER NOT NULL DEFAULT 0, expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS admins (email TEXT PRIMARY KEY, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('documents','software','resetters')), description TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>0), file_path TEXT, original_name TEXT, active INTEGER NOT NULL DEFAULT 0, license TEXT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), title TEXT NOT NULL, kind TEXT NOT NULL, template TEXT, pages INTEGER NOT NULL CHECK(pages>0), unit_price INTEGER NOT NULL CHECK(unit_price>0), amount INTEGER NOT NULL CHECK(amount>0), status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(status IN ('UNPAID','PENDING','REVIEW','PAID','FAILED')), pdf_path TEXT, docx_path TEXT, file_path TEXT, original_name TEXT, preview_count INTEGER NOT NULL DEFAULT 0, phone TEXT, receipt TEXT UNIQUE, paid_at BIGINT, expires BIGINT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), checkout_id TEXT UNIQUE, merchant_id TEXT, state TEXT NOT NULL DEFAULT 'STARTING', callback_json TEXT, result_code INTEGER, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS downloads (id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), format TEXT NOT NULL, created_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS prices (id TEXT PRIMARY KEY, label TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>0));
CREATE INDEX IF NOT EXISTS order_session_idx ON orders(session_id);
CREATE INDEX IF NOT EXISTS order_recovery_idx ON orders(phone,receipt);
CREATE INDEX IF NOT EXISTS attempt_state_idx ON attempts(state,created_at);
CREATE INDEX IF NOT EXISTS download_order_idx ON downloads(order_id);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, action TEXT NOT NULL, target_id TEXT NOT NULL, note TEXT NOT NULL, created_at BIGINT NOT NULL);
