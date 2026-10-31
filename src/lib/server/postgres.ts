import { AsyncLocalStorage } from "node:async_hooks"
import { Pool, type PoolClient } from "pg"
import type { ServiceDatabase } from "../../contracts/storage"
export function databaseSchema() {
  const schema = process.env.DATABASE_SCHEMA || "woorijip"
  if (!/^woorijip(?:_[a-z0-9_]{1,40})?$/.test(schema))
    throw new Error("Invalid application database schema")
  return schema
}
// Repository statements use SQLite positional placeholders; quoted SQL is preserved.
export function postgresSql(sql: string) {
  let index = 0,
    quoted = false,
    out = ""
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]
    if (c === "'") {
      out += c
      if (quoted && sql[i + 1] === "'") {
        out += "'"
        i++
        continue
      }
      quoted = !quoted
    } else out += c === "?" && !quoted ? "$" + ++index : c
  }
  return out
}
export function createPostgresDatabase(pool: Pool): ServiceDatabase {
  const scope = new AsyncLocalStorage<PoolClient>()
  return {
    prepare(sql) {
      const query = async (args: unknown[]) =>
        (scope.getStore() || pool).query(postgresSql(sql), args)
      return {
        get: async (...args) => (await query(args)).rows[0],
        all: async (...args) => (await query(args)).rows,
        run: async (...args) => ({
          changes: (await query(args)).rowCount ?? 0,
        }),
      }
    },
    async transaction(fn) {
      if (scope.getStore()) return fn()
      const client = await pool.connect()
      try {
        await client.query("BEGIN")
        // Preserve SQLite business-write serialization across processes. Auth uses separate tables.
        await client.query("SELECT pg_advisory_xact_lock(782104031)")
        const value = await scope.run(client, fn)
        await client.query("COMMIT")
        return value
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {})
        throw e
      } finally {
        client.release()
      }
    },
  }
}
export function createPostgresPool(
  connectionString = process.env.DATABASE_URL
) {
  if (!connectionString) throw new Error("DATABASE_URL required")
  const url = new URL(connectionString)
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("PostgreSQL URL required")
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  // Do not allow connection URL SSL parameters to silently disable certificate validation.
  for (const name of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(name)
  const pool = new Pool({
    connectionString: url.toString(),
    // Small per-process pool leaves room for maintenance on the product's Nano plan.
    max: 2,
    connectionTimeoutMillis: 20000,
    query_timeout: 20000,
    idleTimeoutMillis: 120000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: local
      ? false
      : {
          rejectUnauthorized: true,
          ...(process.env.DATABASE_SSL_CA
            ? { ca: process.env.DATABASE_SSL_CA }
            : {}),
        },
    options: `-c search_path=${databaseSchema()},public -c statement_timeout=15000 -c lock_timeout=10000`,
  })
  // pg evicts the failed idle client; keep the process alive for a fresh connection.
  pool.on("error", () =>
    console.error(
      "PostgreSQL idle connection lost; reconnecting on next request"
    )
  )
  return pool
}
