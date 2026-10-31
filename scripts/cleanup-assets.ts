import { existsSync, readFileSync } from "node:fs"
import { loadEnvFile } from "node:process"
import { parseEnv } from "node:util"
import { openDatabase } from "../src/lib/server/database"
import { createV2Service } from "../src/lib/server/v2-service"
import { configuredAssetStore } from "../src/lib/server/asset-store"
import {
  createPostgresPool,
  createPostgresDatabase,
} from "../src/lib/server/postgres"
if (existsSync(".env.local")) loadEnvFile(".env.local")
if (process.env.STORAGE_ENV_FILE)
  Object.assign(
    process.env,
    parseEnv(readFileSync(process.env.STORAGE_ENV_FILE, "utf8"))
  )
if (process.env.DATABASE_URL && process.env.STORAGE_BACKEND !== "supabase")
  throw Error("PostgreSQL cleanup requires Supabase assets")
const pool = process.env.DATABASE_URL ? createPostgresPool() : undefined
const local = pool ? undefined : openDatabase()
try {
  const removed = await createV2Service({
    db: pool ? createPostgresDatabase(pool) : local!,
    assetStore: configuredAssetStore(),
  }).cleanup()
  console.log(JSON.stringify({ status: "completed", removed }))
} finally {
  local?.close()
  await pool?.end()
}
