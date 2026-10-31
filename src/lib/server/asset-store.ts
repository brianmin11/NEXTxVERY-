import {
  mkdir,
  readFile,
  writeFile,
  unlink,
  readdir,
  stat,
} from "node:fs/promises"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import type { PrivateAssetStore } from "../../contracts/storage"
const valid = (key: string) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/.test(
    key
  )
function check(key: string) {
  if (!valid(key)) throw new Error("Invalid asset key")
}
export function createLocalAssetStore(
  directory = resolve(".data/uploads")
): PrivateAssetStore {
  return {
    async put(key, bytes) {
      check(key)
      await mkdir(directory, { recursive: true, mode: 0o700 })
      await writeFile(resolve(directory, key), bytes, {
        flag: "wx",
        mode: 0o600,
      })
    },
    async get(key) {
      check(key)
      return new Uint8Array(await readFile(resolve(directory, key)))
    },
    async remove(key) {
      check(key)
      try {
        await unlink(resolve(directory, key))
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e
      }
    },
    async *list() {
      const entries = await readdir(directory, { withFileTypes: true }).catch(
        (e) => {
          if (e.code === "ENOENT") return []
          throw e
        }
      )
      for (const entry of entries)
        if (entry.isFile() && valid(entry.name)) {
          try {
            yield {
              key: entry.name,
              modifiedAt: (await stat(resolve(directory, entry.name))).mtimeMs,
            }
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e
          }
        }
    },
  }
}
export function createSupabaseAssetStore(): PrivateAssetStore {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket = process.env.SUPABASE_STORAGE_BUCKET
  if (!url || !key || !bucket || !url.startsWith("https://"))
    throw new Error("Private storage configuration required")
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  // Verify configuration on use; never create a public fallback bucket.
  let verified: Promise<void> | undefined
  async function ready() {
    if (!verified)
      verified = (async () => {
        const { data, error } = await client.storage.getBucket(bucket!)
        if (error || !data || data.public)
          throw new Error("Private bucket required")
      })().catch((e) => {
        verified = undefined
        throw e
      })
    await verified
  }
  const store = client.storage.from(bucket)
  return {
    async put(name, bytes) {
      check(name)
      await ready()
      const { error } = await store.upload(name, bytes, {
        contentType: "image/webp",
        upsert: false,
      })
      if (error) throw new Error("Private asset upload failed")
    },
    async get(name) {
      check(name)
      await ready()
      const { data, error } = await store.download(name)
      if (error || !data) throw new Error("Private asset unavailable")
      return new Uint8Array(await data.arrayBuffer())
    },
    async remove(name) {
      check(name)
      await ready()
      const { error } = await store.remove([name])
      if (error) throw new Error("Private asset removal failed")
    },
    async *list() {
      await ready()
      let offset = 0
      for (;;) {
        const { data, error } = await store.list("", {
          limit: 100,
          offset,
          sortBy: { column: "name", order: "asc" },
        })
        if (error) throw new Error("Private assets unavailable")
        if (!data?.length) return
        for (const item of data)
          if (item.id && valid(item.name))
            yield {
              key: item.name,
              modifiedAt: Date.parse(item.updated_at || item.created_at),
            }
        offset += data.length
        if (data.length < 100) return
      }
    },
  }
}
export function configuredAssetStore() {
  if (process.env.STORAGE_BACKEND === "supabase")
    return createSupabaseAssetStore()
  if (process.env.STORAGE_BACKEND && process.env.STORAGE_BACKEND !== "local")
    throw new Error("Unknown storage backend")
  if (process.env.VERCEL)
    throw new Error("Durable private asset store required")
  return createLocalAssetStore(process.env.FAMILY_UPLOAD_PATH)
}
