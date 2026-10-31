// Offline recovery artifacts. Never overwrites a database or existing directory.
// Usage: node scripts/data-snapshot.mjs backup <new-directory>
//        node scripts/data-snapshot.mjs restore <snapshot-directory> <new-data-directory>
import { DatabaseSync, backup } from "node:sqlite"
import { createHash } from "node:crypto"
import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  lstat,
  rename,
  chmod,
} from "node:fs/promises"
import { existsSync } from "node:fs"
import { resolve, join, basename } from "node:path"
import { loadEnvFile } from "node:process"
if (existsSync(".env.local")) loadEnvFile(".env.local")
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
async function file(path) {
  if (!(await lstat(path)).isFile())
    throw new Error("Expected a regular snapshot file")
  return readFile(path)
}
async function createDestination(path) {
  if (existsSync(path) || existsSync(path + ".partial"))
    throw new Error("Destination already exists; choose a new directory")
  await mkdir(path + ".partial", { mode: 0o700 })
  await mkdir(join(path + ".partial", "uploads"), { mode: 0o700 })
  return path + ".partial"
}
function assets(db) {
  return db
    .prepare("SELECT payload FROM v2_records WHERE kind='asset'")
    .all()
    .map((row) => JSON.parse(row.payload))
    .filter((value) => value.state !== "deleting")
    .map((value) => {
      if (
        value.file !== basename(value.file) ||
        !/^[a-f0-9-]+\.webp$/.test(value.file)
      )
        throw new Error("Invalid asset path")
      return value.file
    })
}
function integrity(db) {
  const row = db.prepare("PRAGMA integrity_check").get()
  if (!row || Object.values(row)[0] !== "ok")
    throw new Error("Database integrity check failed")
}
const [mode, input, output] = process.argv.slice(2)
try {
  if (
    !input ||
    !["backup", "restore"].includes(mode) ||
    (mode === "restore" && !output)
  )
    throw new Error(
      "Usage: backup <new-directory> | restore <snapshot> <new-directory>"
    )
  if (mode === "backup") {
    const sourcePath = resolve(
      process.env.FAMILY_DB_PATH || ".data/family.sqlite"
    )
    const uploadPath = resolve(
      process.env.FAMILY_UPLOAD_PATH || ".data/uploads"
    )
    if (!existsSync(sourcePath))
      throw new Error("Source database does not exist")
    const destination = resolve(input),
      partial = await createDestination(destination)
    const lock = new DatabaseSync(sourcePath),
      reader = new DatabaseSync(sourcePath, { readOnly: true })
    try {
      lock.exec("PRAGMA busy_timeout=5000; BEGIN IMMEDIATE")
      // Block business commits while snapshot and referenced files are copied together.
      await backup(reader, join(partial, "family.sqlite"))
      const copied = new DatabaseSync(join(partial, "family.sqlite"), {
        readOnly: true,
      })
      let names
      try {
        integrity(copied)
        names = assets(copied)
      } finally {
        copied.close()
      }
      const manifest = {
        version: 1,
        createdAt: new Date().toISOString(),
        files: {},
      }
      for (const name of names) {
        const bytes = await file(join(uploadPath, name))
        await writeFile(join(partial, "uploads", name), bytes, {
          mode: 0o600,
          flag: "wx",
        })
        manifest.files["uploads/" + name] = digest(bytes)
      }
      await chmod(join(partial, "family.sqlite"), 0o600)
      manifest.files["family.sqlite"] = digest(
        await file(join(partial, "family.sqlite"))
      )
      await writeFile(
        join(partial, "manifest.json"),
        JSON.stringify(manifest, null, 2),
        { mode: 0o600, flag: "wx" }
      )
      await rename(partial, destination)
      console.log(
        JSON.stringify({
          status: "backed-up",
          assets: names.length,
          destination,
        })
      )
    } finally {
      if (lock.isTransaction) lock.exec("ROLLBACK")
      reader.close()
      lock.close()
    }
  } else {
    const source = resolve(input),
      destination = resolve(output)
    const manifest = JSON.parse(await file(join(source, "manifest.json")))
    if (manifest.version !== 1 || !manifest.files?.["family.sqlite"])
      throw new Error("Invalid manifest")
    for (const [name, expected] of Object.entries(manifest.files)) {
      if (name !== "family.sqlite" && !/^uploads\/[a-f0-9-]+\.webp$/.test(name))
        throw new Error("Invalid manifest path")
      if (digest(await file(join(source, name))) !== expected)
        throw new Error("Snapshot checksum mismatch")
    }
    const db = new DatabaseSync(join(source, "family.sqlite"), {
      readOnly: true,
    })
    let names
    try {
      integrity(db)
      names = assets(db)
    } finally {
      db.close()
    }
    if (names.some((name) => !manifest.files["uploads/" + name]))
      throw new Error("Snapshot is missing an asset")
    const partial = await createDestination(destination)
    for (const name of Object.keys(manifest.files)) {
      await copyFile(join(source, name), join(partial, name))
      await chmod(join(partial, name), 0o600)
    }
    await rename(partial, destination)
    console.log(
      JSON.stringify({
        status: "restored-to-new-directory",
        assets: names.length,
        destination,
      })
    )
  }
} catch (error) {
  // No DB contents, credentials, or user text are logged.
  console.error(error instanceof Error ? error.message : "Snapshot failed")
  process.exitCode = 1
}
