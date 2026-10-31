import { readFileSync } from "node:fs"
import { loadEnvFile } from "node:process"
import { getMigrations } from "better-auth/db/migration"
import { createPostgresPool } from "../src/lib/server/postgres"
if (process.env.STORAGE_ENV_FILE) loadEnvFile(process.env.STORAGE_ENV_FILE)
if (!process.argv.includes("--apply"))
  throw new Error(
    "Explicit --apply required; configure approved target in STORAGE_ENV_FILE"
  )
const pool = createPostgresPool()
try {
  await pool.query(readFileSync("migrations/postgres/001-service.sql", "utf8"))
  const migrations = await getMigrations({
    database: pool,
    emailAndPassword: { enabled: true },
  })
  await migrations.runMigrations()
  // Schema is not exposed through Data API. Deny direct browser roles, including future tables.
  for (const role of ["anon", "authenticated"]) {
    const exists = await pool.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [
      role,
    ])
    if (exists.rowCount) {
      await pool.query(`REVOKE ALL ON SCHEMA woorijip FROM ${role}`)
      await pool.query(
        `REVOKE ALL ON ALL TABLES IN SCHEMA woorijip FROM ${role}`
      )
      await pool.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA woorijip REVOKE ALL ON TABLES FROM ${role}`
      )
    }
  }
  console.log(
    JSON.stringify({
      status: "migrated",
      schema: "woorijip",
      rawPrivateLegacyTablesMigrated: false,
    })
  )
} catch {
  console.error(
    "Migration failed; inspect target configuration without logging credentials"
  )
  process.exitCode = 1
} finally {
  await pool.end()
}
