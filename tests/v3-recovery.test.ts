import test from "node:test"
import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import { randomUUID } from "node:crypto"
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import sharp from "sharp"
import { createV2Service } from "../src/lib/server/v2-service"

test("upload recovery removes only old unreferenced server UUID files and preserves active or unfamiliar paths", async () => {
  const root = mkdtempSync(join(tmpdir(), "v3-upload-recovery-"))
  const uploadDir = join(root, "uploads")
  mkdirSync(uploadDir)
  const db = new DatabaseSync(":memory:")
  db.exec(
    readFileSync(new URL("../migrations/002-v2.sql", import.meta.url), "utf8")
  )
  const service = createV2Service({
    db,
    uploadDir,
    inviteSecret: "synthetic-upload-secret-at-least-32-characters",
  })
  const who = { id: randomUUID(), name: "복구 검증 계정" }
  const oldTime = new Date(Date.now() - 48 * 3600 * 1000)
  const oldFile = (name: string) => {
    const path = join(uploadDir, name)
    writeFileSync(path, "synthetic orphan")
    utimesSync(path, oldTime, oldTime)
    return path
  }
  try {
    await service.request(who, "POST", "families", {
      name: "복구 가족",
      requestId: randomUUID(),
    })
    const bytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#abc" },
    })
      .webp()
      .toBuffer()
    const attached = await service.upload(who, bytes, "image/webp")
    await service.request(who, "POST", "memories", {
      fields: {
        assetId: attached.id,
        memoryDate: "2026-11-01",
        caption: "보존할 추억",
      },
      requestId: randomUUID(),
    })
    const attachedPath = join(uploadDir, `${attached.id}.webp`)
    utimesSync(attachedPath, oldTime, oldTime)
    const orphan = oldFile(`${randomUUID()}.webp`)
    const fresh = join(uploadDir, `${randomUUID()}.webp`)
    writeFileSync(fresh, "upload might still be pending")
    const unknown = oldFile("manual-backup.webp")
    const hexButNotUuid = oldFile("deadbeef.webp")
    const target = join(root, "target-do-not-delete.bin")
    writeFileSync(target, "symlink target")
    utimesSync(target, oldTime, oldTime)
    const link = join(uploadDir, `${randomUUID()}.webp`)
    symlinkSync(target, link)
    const directory = join(uploadDir, `${randomUUID()}.webp`)
    mkdirSync(directory)
    assert.equal(await service.cleanup(), 1)
    assert.equal(existsSync(orphan), false)
    for (const path of [
      fresh,
      unknown,
      hexButNotUuid,
      attachedPath,
      target,
      link,
      directory,
    ])
      assert.equal(existsSync(path), true, `${path} must remain`)
    assert.equal(lstatSync(link).isSymbolicLink(), true)
    assert.ok((await service.content(who, attached.id)).bytes.byteLength > 0)
    assert.equal(await service.cleanup(), 0)
  } finally {
    db.close()
    rmSync(root, { recursive: true, force: true })
  }
})
