export type SqlValue = string | number | bigint | null | Uint8Array
export interface ServiceDatabase {
  prepare(sql: string): {
    get(...params: SqlValue[]): Promise<unknown>
    all(...params: SqlValue[]): Promise<unknown[]>
    run(...params: SqlValue[]): Promise<{ changes: number | bigint }>
  }
  transaction<T>(fn: () => Promise<T>): Promise<T>
}
export interface PrivateAssetStore {
  put(key: string, bytes: Uint8Array): Promise<void>
  get(key: string): Promise<Uint8Array>
  remove(key: string): Promise<void>
  list(): AsyncIterable<{ key: string; modifiedAt: number }>
}
