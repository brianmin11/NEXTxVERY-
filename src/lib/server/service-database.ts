import { AsyncLocalStorage } from "node:async_hooks"
import type { DatabaseSync } from "node:sqlite"
import type { ServiceDatabase } from "../../contracts/storage"
const adapters = new WeakMap<DatabaseSync, ServiceDatabase>()
export function asServiceDatabase(
  input: DatabaseSync | ServiceDatabase
): ServiceDatabase {
  if ("transaction" in input) return input
  const existing = adapters.get(input)
  if (existing) return existing
  const context = new AsyncLocalStorage<boolean>()
  let tail = Promise.resolve()
  async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (context.getStore()) return fn()
    const previous = tail
    let release!: () => void
    tail = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      return await context.run(true, fn)
    } finally {
      release()
    }
  }
  const adapter: ServiceDatabase = {
    prepare(sql) {
      return {
        get: (...args) =>
          exclusive(async () => input.prepare(sql).get(...args)),
        all: (...args) =>
          exclusive(async () => input.prepare(sql).all(...args)),
        run: (...args) =>
          exclusive(async () => input.prepare(sql).run(...args)),
      }
    },
    transaction: (fn) =>
      exclusive(async () => {
        input.exec("BEGIN IMMEDIATE")
        try {
          const result = await fn()
          input.exec("COMMIT")
          return result
        } catch (error) {
          if (input.isTransaction) input.exec("ROLLBACK")
          throw error
        }
      }),
  }
  adapters.set(input, adapter)
  return adapter
}
