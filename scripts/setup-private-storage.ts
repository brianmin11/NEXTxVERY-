import { readFileSync } from "node:fs"
import { parseEnv } from "node:util"
import { createClient } from "@supabase/supabase-js"
if (process.env.STORAGE_ENV_FILE)
  Object.assign(
    process.env,
    parseEnv(readFileSync(process.env.STORAGE_ENV_FILE, "utf8"))
  )
if (!process.argv.includes("--apply")) throw Error("Explicit --apply required")
const {
  SUPABASE_URL: url,
  SUPABASE_SERVICE_ROLE_KEY: key,
  SUPABASE_STORAGE_BUCKET: bucket,
} = process.env
if (!url?.startsWith("https://") || !key || !bucket)
  throw Error("Private storage configuration required")
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const existing = await client.storage.listBuckets()
if (existing.error) throw Error("Unable to inspect private storage")
const found = existing.data.find((item) => item.name === bucket)
if (found?.public) throw Error("Refusing existing public bucket")
if (!found) {
  const created = await client.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 10485760,
    allowedMimeTypes: ["image/webp"],
  })
  if (created.error) throw Error("Unable to create private bucket")
}
const result = await client.storage.getBucket(bucket)
if (result.error || result.data.public)
  throw Error("Private bucket verification failed")
console.log(JSON.stringify({ bucket, public: false, status: "ready" }))
