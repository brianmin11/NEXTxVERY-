// Explicit maintenance tool. Backups contain credentials: local ignored paths, mode 0600.
// sqlite <existing SQLite snapshot> <new bundle> | backup <new bundle> | restore <bundle> --apply
import { DatabaseSync } from "node:sqlite"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile, rename, lstat } from "node:fs/promises"
import { resolve, join } from "node:path"
import { parseEnv } from "node:util"
import { readFileSync } from "node:fs"
import { createPostgresPool, databaseSchema } from "../src/lib/server/postgres"
import { createSupabaseAssetStore } from "../src/lib/server/asset-store"
import type { PoolClient } from "pg"
if (process.env.STORAGE_ENV_FILE)
  Object.assign(
    process.env,
    parseEnv(readFileSync(process.env.STORAGE_ENV_FILE, "utf8"))
  )
if (
  process.env.DATABASE_URL &&
  new URL(process.env.DATABASE_URL).port === "6543"
)
  throw Error(
    "Snapshot maintenance requires direct or session-pooler connection"
  )
const tables = [
  "user",
  "account",
  "session",
  "verification",
  "v2_families",
  "v2_members",
  "v2_invites",
  "v2_records",
  "v2_receipts",
] as const
const keyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/
type Row = Record<string, unknown>
type Data = Record<string, Row[]>
type Manifest = {
  version: 2
  createdAt: string
  dataHash: string
  assets: Record<string, string>
}
const hash = (b: Uint8Array | string) =>
  createHash("sha256").update(b).digest("hex")
const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"'
async function file(p: string) {
  if (!(await lstat(p)).isFile()) throw Error("Expected regular snapshot file")
  return readFile(p)
}
function assetNames(data: Data) {
  return [
    ...new Set(
      data.v2_records
        .filter((r) => r.kind === "asset")
        .map((r) => JSON.parse(String(r.payload)))
        .filter((r) => r.state !== "deleting")
        .map((r) => {
          if (typeof r.file !== "string" || !keyPattern.test(r.file))
            throw Error("Invalid asset key")
          return r.file as string
        })
    ),
  ]
}
async function bundle(
  destination: string,
  data: Data,
  getAsset: (name: string) => Promise<Uint8Array>
) {
  // mkdir without recursive refuses overwrite and symlink destinations.
  const partial = destination + ".partial"
  await mkdir(partial, { mode: 0o700 })
  await mkdir(join(partial, "uploads"), { mode: 0o700 })
  const bytes = JSON.stringify(data)
  const manifest: Manifest = {
    version: 2,
    createdAt: new Date().toISOString(),
    dataHash: hash(bytes),
    assets: {},
  }
  await writeFile(join(partial, "data.json"), bytes, {
    mode: 0o600,
    flag: "wx",
  })
  for (const key of assetNames(data)) {
    const asset = await getAsset(key)
    manifest.assets[key] = hash(asset)
    await writeFile(join(partial, "uploads", key), asset, {
      mode: 0o600,
      flag: "wx",
    })
  }
  await writeFile(join(partial, "manifest.json"), JSON.stringify(manifest), {
    mode: 0o600,
    flag: "wx",
  })
  // Refuse an existing final destination; reserve it before moving children.
  await mkdir(destination, { mode: 0o700 })
  await rename(join(partial, "data.json"), join(destination, "data.json"))
  await rename(join(partial, "uploads"), join(destination, "uploads"))
  await rename(
    join(partial, "manifest.json"),
    join(destination, "manifest.json")
  )
  console.log(
    JSON.stringify({
      status: "snapshot-created",
      assets: Object.keys(manifest.assets).length,
      rows: Object.fromEntries(tables.map((t) => [t, data[t].length])),
    })
  )
}
async function loadBundle(source: string) {
  const manifest: Manifest = JSON.parse(
    (await file(join(source, "manifest.json"))).toString()
  )
  const bytes = await file(join(source, "data.json"))
  if (manifest.version !== 2 || hash(bytes) !== manifest.dataHash)
    throw Error("Invalid snapshot checksum/version")
  const data: Data = JSON.parse(bytes.toString())
  if (
    Object.keys(data).length !== tables.length ||
    tables.some((t) => !Array.isArray(data[t]))
  )
    throw Error("Invalid table allowlist")
  const names = assetNames(data)
  if (
    Object.keys(manifest.assets).length !== names.length ||
    names.some((k) => !manifest.assets[k])
  )
    throw Error("Incomplete asset manifest")
  for (const name of names)
    if (
      hash(await file(join(source, "uploads", name))) !== manifest.assets[name]
    )
      throw Error("Asset checksum mismatch")
  return { manifest, data }
}
async function empty(client: PoolClient) {
  for (const t of tables)
    if ((await client.query(`SELECT 1 FROM ${quote(t)} LIMIT 1`)).rowCount)
      throw Error("Restore requires empty application tables")
}
const [mode, input, output] = process.argv.slice(2)
if (!input || !["sqlite", "backup", "restore"].includes(mode))
  throw Error(
    "Usage: sqlite <snapshot> <bundle> | backup <bundle> | restore <bundle> --apply"
  )
try {
  if (mode === "sqlite") {
    if (!output) throw Error("New bundle destination required")
    // Read ONLY allowlisted current app/auth tables, never legacy private documents.
    const source = resolve(input)
    const original: { version: number; files: Record<string, string> } =
      JSON.parse((await file(join(source, "manifest.json"))).toString())
    if (
      original.version !== 1 ||
      hash(await file(join(source, "family.sqlite"))) !==
        original.files["family.sqlite"]
    )
      throw Error("Invalid SQLite snapshot")
    const db = new DatabaseSync(join(source, "family.sqlite"), {
      readOnly: true,
    })
    try {
      const data = Object.fromEntries(
        tables.map((t) => [t, db.prepare(`SELECT * FROM ${quote(t)}`).all()])
      ) as Data
      await bundle(resolve(output), data, async (key) => {
        const b = await file(join(source, "uploads", key))
        if (hash(b) !== original.files["uploads/" + key])
          throw Error("SQLite asset checksum mismatch")
        return b
      })
    } finally {
      db.close()
    }
  } else {
    const pool = createPostgresPool(),
      store = createSupabaseAssetStore()
    const client = await pool.connect()
    try {
      if (mode === "backup") {
        // Maintenance lock spans DB snapshot + immutable object reads. Business writers wait.
        // Acquire before BEGIN so the repeatable-read snapshot cannot predate a completing delete.
        await client.query("SELECT pg_advisory_lock(782104031)")
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY")
        const data: Data = {}
        for (const t of tables)
          data[t] = (await client.query(`SELECT * FROM ${quote(t)}`)).rows
        await bundle(resolve(input), data, (key) => store.get(key))
        await client.query("COMMIT")
      } else {
        if (!process.argv.includes("--apply"))
          throw Error("Restore requires --apply")
        const source = resolve(input),
          { manifest, data } = await loadBundle(source)
        await client.query("SELECT pg_advisory_lock(782104031)")
        const done = await client.query(
          "SELECT manifest_hash FROM storage_imports WHERE id=$1",
          [manifest.dataHash]
        )
        if (done.rowCount)
          throw Error("Snapshot already imported; no changes made")
        await empty(client)
        // Reusing orphaned objects from an interrupted import requires exact bytes.
        const present = new Set<string>()
        for await (const item of store.list()) present.add(item.key)
        for (const key of assetNames(data)) {
          if (present.has(key)) {
            if (hash(await store.get(key)) !== manifest.assets[key])
              throw Error("Existing object differs; refusing overwrite")
          } else await store.put(key, await file(join(source, "uploads", key)))
          if (hash(await store.get(key)) !== manifest.assets[key])
            throw Error("Uploaded object checksum mismatch")
        }
        await client.query("BEGIN")
        // Auth writes do not take the business advisory lock. Freeze all imported tables too.
        await client.query(
          `LOCK TABLE ${tables.map(quote).join(",")} IN ACCESS EXCLUSIVE MODE`
        )
        await empty(client)
        const columns = (
          await client.query(
            "SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=$1",
            [databaseSchema()]
          )
        ).rows as {
          table_name: string
          column_name: string
          data_type: string
        }[]
        for (const table of tables)
          for (const row of data[table]) {
            const names = Object.keys(row)
            const values = names.map((name) => {
              const column = columns.find(
                (c) => c.table_name === table && c.column_name === name
              )
              if (!column) throw Error("Snapshot column not in target schema")
              const value = row[name]
              if (column.data_type === "boolean" && typeof value === "number")
                return value !== 0
              return value
            })
            await client.query(
              `INSERT INTO ${quote(table)}(${names.map(quote).join(",")}) VALUES(${values.map((_, i) => "$" + (i + 1)).join(",")})`,
              values
            )
          }
        await client.query(
          "INSERT INTO storage_imports(id,manifest_hash) VALUES($1,$1)",
          [manifest.dataHash]
        )
        await client.query("COMMIT")
        console.log(
          JSON.stringify({
            status: "restored-to-empty-target",
            schema: databaseSchema(),
            assets: Object.keys(manifest.assets).length,
            rows: Object.fromEntries(tables.map((t) => [t, data[t].length])),
          })
        )
      }
    } finally {
      await client.query("ROLLBACK").catch(() => {})
      await client.query("SELECT pg_advisory_unlock(782104031)").catch(() => {})
      client.release()
      await pool.end()
    }
  }
} catch (error) {
  // Never print database driver details: constraint errors may contain user values.
  console.error(
    JSON.stringify({
      status: "snapshot-failed",
      code: (error as { code?: string }).code || "VALIDATION_OR_IO",
    })
  )
  process.exitCode = 1
}
