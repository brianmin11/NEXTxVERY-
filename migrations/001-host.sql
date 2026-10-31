PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS households(id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT UNIQUE NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS memberships(user_id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id), name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, kind TEXT NOT NULL, household_id TEXT NOT NULL REFERENCES households(id), owner_id TEXT, revision INTEGER NOT NULL, payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS document_scope ON documents(household_id,kind,owner_id);
CREATE TABLE IF NOT EXISTS requests(actor_id TEXT NOT NULL, request_id TEXT NOT NULL, payload_hash TEXT NOT NULL, result TEXT NOT NULL, PRIMARY KEY(actor_id,request_id));
CREATE TABLE IF NOT EXISTS model_runs(id TEXT PRIMARY KEY, household_id TEXT NOT NULL, request_id TEXT NOT NULL, status TEXT NOT NULL, reserved_usd REAL NOT NULL, metadata TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY, household_id TEXT NOT NULL, recipient_id TEXT NOT NULL, target_id TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL);
