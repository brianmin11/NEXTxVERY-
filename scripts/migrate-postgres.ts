import { readFileSync } from "node:fs"
import { parseEnv } from "node:util"
import { getMigrations } from "better-auth/db/migration"
import { createPostgresPool, databaseSchema } from "../src/lib/server/postgres"
if (process.env.STORAGE_ENV_FILE)
  Object.assign(
    process.env,
    parseEnv(readFileSync(process.env.STORAGE_ENV_FILE, "utf8"))
  )
if (!process.argv.includes("--apply"))
  throw new Error(
    "Explicit --apply required; configure approved target in STORAGE_ENV_FILE"
  )
const pool = createPostgresPool()
const schema = databaseSchema()
try {
  await pool.query(
    readFileSync("migrations/postgres/001-service.sql", "utf8").replaceAll(
      "woorijip",
      schema
    )
  )
  await pool.query(
    readFileSync("migrations/postgres/002-ai-operations.sql", "utf8")
  )
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
      await pool.query(`REVOKE ALL ON SCHEMA ${schema} FROM ${role}`)
      await pool.query(
        `REVOKE ALL ON ALL TABLES IN SCHEMA ${schema} FROM ${role}`
      )
      await pool.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE ALL ON TABLES FROM ${role}`
      )
    }
  }
  console.log(
    JSON.stringify({
      status: "migrated",
      schema,
      rawPrivateLegacyTablesMigrated: false,
    })
  )
} catch (error) {
  console.error(
    "Migration failed; inspect target configuration without logging credentials"
  )
  console.error(
    JSON.stringify({
      code: (error as { code?: string }).code || "MIGRATION_ERROR",
    })
  )
  process.exitCode = 1
} finally {
  await pool.end()
}
