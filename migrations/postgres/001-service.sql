CREATE SCHEMA IF NOT EXISTS woorijip;
REVOKE ALL ON SCHEMA woorijip FROM PUBLIC;
SET search_path TO woorijip,public;
CREATE TABLE IF NOT EXISTS v2_families(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS v2_members(user_id TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES v2_families(id),name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS v2_invites(code_hash TEXT PRIMARY KEY,family_id TEXT NOT NULL REFERENCES v2_families(id),expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS v2_records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,family_id TEXT NOT NULL REFERENCES v2_families(id),owner_id TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS v2_records_scope ON v2_records(family_id,kind);
CREATE TABLE IF NOT EXISTS v2_receipts(actor_id TEXT NOT NULL,request_id TEXT NOT NULL,payload_hash TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(actor_id,request_id));
CREATE TABLE IF NOT EXISTS storage_imports(id TEXT PRIMARY KEY,completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),manifest_hash TEXT NOT NULL);
-- Better Auth owns its own tables in this same private schema. No Supabase JWT mapping is assumed.
