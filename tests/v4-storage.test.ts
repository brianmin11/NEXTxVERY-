import test from "node:test"
import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import sharp from "sharp"
import { asServiceDatabase } from "../src/lib/server/service-database"
import type { PrivateAssetStore } from "../src/contracts/storage"
import { createV2Service } from "../src/lib/server/v2-service"
const key = () => randomUUID()
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

test("async database isolates outside reads and queued transactions from an uncommitted rollback", async () => {
  const raw = new DatabaseSync(":memory:")
  raw.exec("CREATE TABLE example(id TEXT PRIMARY KEY)")
  const db = asServiceDatabase(raw),
    entered = deferred(),
    release = deferred()
  try {
    const writer = db.transaction(async () => {
      await db.prepare("INSERT INTO example(id) VALUES(?)").run("rolled-back")
      entered.resolve()
      await release.promise
      throw new Error("deliberate rollback")
    })
    const rejection = assert.rejects(writer, /deliberate rollback/)
    await entered.promise
    let readSettled = false
    const read = db
      .prepare("SELECT * FROM example")
      .all()
      .then((rows) => {
        readSettled = true
        return rows
      })
    const next = asServiceDatabase(raw).transaction(async () => {
      await db.prepare("INSERT INTO example(id) VALUES(?)").run("committed")
    })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(readSettled, false)
    release.resolve()
    await rejection
    assert.deepEqual(await read, [])
    await next
    assert.deepEqual(
      (await db.prepare("SELECT id FROM example").all()).map(
        (row) => (row as { id: string }).id
      ),
      ["committed"]
    )
  } finally {
    raw.close()
  }
})

class MemoryStore implements PrivateAssetStore {
  objects = new Map<string, { bytes: Uint8Array; modifiedAt: number }>()
  failPut = false
  failRemove = false
  beforeIO: () => void = () => {}
  async put(name: string, bytes: Uint8Array) {
    this.beforeIO()
    if (this.failPut) throw new Error("object put failed")
    if (this.objects.has(name)) throw new Error("overwrite")
    this.objects.set(name, { bytes: bytes.slice(), modifiedAt: Date.now() })
  }
  async get(name: string) {
    this.beforeIO()
    const obj = this.objects.get(name)
    if (!obj) throw new Error("object missing")
    return obj.bytes.slice()
  }
  async remove(name: string) {
    this.beforeIO()
    if (this.failRemove) throw new Error("object delete failed")
    this.objects.delete(name)
  }
  async *list() {
    this.beforeIO()
    for (const [name, obj] of this.objects)
      yield { key: name, modifiedAt: obj.modifiedAt }
  }
}
async function fixture() {
  const raw = new DatabaseSync(":memory:")
  raw.exec(
    readFileSync(new URL("../migrations/002-v2.sql", import.meta.url), "utf8")
  )
  const db = asServiceDatabase(raw),
    store = new MemoryStore()
  store.beforeIO = () =>
    assert.equal(
      raw.isTransaction,
      false,
      "object I/O must not hold a database transaction"
    )
  // The migration adds assetStore to this existing service contract.
  const service = createV2Service({
    db,
    assetStore: store,
    inviteSecret: "synthetic-invite-secret-with-at-least-32-characters",
  })
  const a = { id: key(), name: "A" },
    b = { id: key(), name: "B" },
    other = { id: key(), name: "Other" }
  await service.request(a, "POST", "families", {
    name: "Family",
    requestId: key(),
  })
  const invite = (await service.request(a, "POST", "family/invites", {
    requestId: key(),
  })) as { inviteCode: string }
  await service.request(b, "POST", "family/join", {
    inviteCode: invite.inviteCode,
    requestId: key(),
  })
  await service.request(other, "POST", "families", {
    name: "Other",
    requestId: key(),
  })
  const bytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#abc" },
  })
    .png()
    .toBuffer()
  return { raw, db, store, service, a, b, other, bytes }
}
const status = (n: number) => (e: unknown) =>
  (e as { status: number }).status === n

test("private object upload preserves pending ownership, family attachment and delete failure recovery", async () => {
  const f = await fixture()
  try {
    const asset = await f.service.upload(f.a, f.bytes, "image/png")
    assert.equal(f.store.objects.size, 1)
    assert.equal(
      (await sharp((await f.service.content(f.a, asset.id)).bytes).metadata())
        .format,
      "webp"
    )
    await assert.rejects(f.service.content(f.b, asset.id), status(404))
    await assert.rejects(f.service.content(f.other, asset.id), status(404))
    const post = (await f.service.request(f.a, "POST", "memories", {
      fields: {
        assetId: asset.id,
        memoryDate: "2026-11-01",
        caption: "Approved photo",
      },
      requestId: key(),
    })) as { id: string; revision: number }
    await f.service.content(f.b, asset.id)
    await assert.rejects(f.service.content(f.other, asset.id), status(404))
    f.store.failRemove = true
    await f.service.request(f.a, "DELETE", "memories/" + post.id, {
      expectedRevision: post.revision,
      requestId: key(),
    })
    await assert.rejects(f.service.content(f.a, asset.id), status(404))
    assert.equal(f.store.objects.size, 1)
    assert.equal(
      JSON.parse(
        (
          f.raw
            .prepare("SELECT payload FROM v2_records WHERE id=?")
            .get(asset.id) as { payload: string }
        ).payload
      ).state,
      "deleting"
    )
    f.store.failRemove = false
    assert.equal(await f.service.cleanup(), 1)
    assert.equal(f.store.objects.size, 0)
    assert.equal(await f.service.cleanup(), 0)
  } finally {
    f.raw.close()
  }
})

test("failed object upload creates no asset row; failed asset insert compensates or leaves reclaimable orphan", async () => {
  const f = await fixture()
  try {
    f.store.failPut = true
    await assert.rejects(f.service.upload(f.a, f.bytes, "image/png"))
    assert.equal(
      f.raw
        .prepare("SELECT count(*) AS n FROM v2_records WHERE kind='asset'")
        .get()?.n,
      0
    )
    f.store.failPut = false
    f.raw.exec(
      "CREATE TRIGGER fail_asset BEFORE INSERT ON v2_records WHEN NEW.kind='asset' BEGIN SELECT RAISE(ABORT,'test asset failure'); END"
    )
    await assert.rejects(f.service.upload(f.a, f.bytes, "image/png"))
    assert.equal(f.store.objects.size, 0)
    f.store.failRemove = true
    await assert.rejects(f.service.upload(f.a, f.bytes, "image/png"))
    assert.equal(f.store.objects.size, 1)
    for (const obj of f.store.objects.values())
      obj.modifiedAt = Date.now() - 86400001
    f.store.failRemove = false
    assert.equal(await f.service.cleanup(), 1)
    assert.equal(f.store.objects.size, 0)
  } finally {
    f.raw.close()
  }
})

test("remote orphan cleanup ignores fresh or unrecognized keys and preserves attached assets", async () => {
  const f = await fixture()
  try {
    const asset = await f.service.upload(f.a, f.bytes, "image/png")
    await f.service.request(f.a, "POST", "memories", {
      fields: { assetId: asset.id, memoryDate: "2026-11-01", caption: "Keep" },
      requestId: key(),
    })
    const old = key() + ".webp",
      fresh = key() + ".webp"
    for (const name of [
      old,
      fresh,
      "deadbeef.webp",
      "folder/" + key() + ".webp",
    ])
      f.store.objects.set(name, {
        bytes: f.bytes,
        modifiedAt: Date.now() - 86400001,
      })
    f.store.objects.get(fresh)!.modifiedAt = Date.now()
    f.store.objects.get(asset.id + ".webp")!.modifiedAt = Date.now() - 86400001
    assert.equal(await f.service.cleanup(), 1)
    assert.equal(f.store.objects.has(old), false)
    for (const name of [fresh, "deadbeef.webp", asset.id + ".webp"])
      assert.equal(f.store.objects.has(name), true)
    await f.service.content(f.b, asset.id)
  } finally {
    f.raw.close()
  }
})

test("asynchronous independent service instances preserve same-key idempotency and competing revisions", async () => {
  const f = await fixture()
  try {
    const second = createV2Service({ db: f.db, assetStore: f.store })
    const fields = {
      title: "Dinner",
      category: "meal",
      date: "2028-02-29",
      allDay: false,
      startTime: "19:00",
      endTime: "20:00",
      location: "Home",
      memo: "",
      participantIds: [f.a.id, f.b.id],
    }
    const body = { fields, requestId: key() }
    const result = (await Promise.all([
      f.service.request(f.a, "POST", "calendar/events", body),
      second.request(f.a, "POST", "calendar/events", body),
    ])) as { id: string; revision: number }[]
    assert.equal(result[0].id, result[1].id)
    const writes = await Promise.allSettled(
      [f.service, second].map((s, i) =>
        s.request(f.a, "PATCH", "calendar/events/" + result[0].id, {
          fields: { ...fields, title: "Change " + i },
          expectedRevision: 1,
          requestId: key(),
        })
      )
    )
    assert.equal(writes.filter((x) => x.status === "fulfilled").length, 1)
    const failed = writes.find(
      (x) => x.status === "rejected"
    ) as PromiseRejectedResult
    assert.equal(failed.reason.status, 409)
    assert.equal(
      f.raw
        .prepare("SELECT count(*) n FROM v2_records WHERE kind='event'")
        .get()?.n,
      1
    )
  } finally {
    f.raw.close()
  }
})
