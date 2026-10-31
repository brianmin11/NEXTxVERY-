import { DatabaseSync } from "node:sqlite"
import { mkdirSync, readFileSync, chmodSync } from "node:fs"
import { dirname, resolve } from "node:path"
export function openDatabase(
  path = process.env.FAMILY_DB_PATH || ".data/family.sqlite"
) {
  if (process.env.VERCEL)
    throw new Error(
      "External durable database adapter required before deployment"
    )
  if (path !== ":memory:")
    mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 })
  const db = new DatabaseSync(path)
  db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")
  db.exec(readFileSync(resolve("migrations/001-host.sql"), "utf8"))
  if (path !== ":memory:") chmodSync(path, 0o600)
  db.exec(readFileSync(resolve("migrations/002-v2.sql"), "utf8"))
  return db
}
