import "server-only"
import { betterAuth } from "better-auth"
import { createAuthOptions } from "./auth-config"
import { getMigrations } from "better-auth/db/migration"
import { openDatabase } from "./database"
import { asServiceDatabase } from "./service-database"
import { createPostgresPool, createPostgresDatabase } from "./postgres"
import type { ServiceDatabase } from "../../contracts/storage"
type Actor = { id: string; name: string; email: string }
const globalAuth = globalThis as unknown as {
  familyAuth?: Promise<ReturnType<typeof betterAuth>>
  familyDb?: ReturnType<typeof openDatabase>
  postgresPool?: ReturnType<typeof createPostgresPool>
  serviceDb?: ServiceDatabase
}
export function getNativeDatabase() {
  if (process.env.DATABASE_URL)
    return (globalAuth.postgresPool ??= createPostgresPool())
  return (globalAuth.familyDb ??= openDatabase())
}
export function getDatabase(): ServiceDatabase {
  return (globalAuth.serviceDb ??= process.env.DATABASE_URL
    ? createPostgresDatabase((globalAuth.postgresPool ??= createPostgresPool()))
    : asServiceDatabase((globalAuth.familyDb ??= openDatabase())))
}
export function getAuth() {
  return (globalAuth.familyAuth ??= (async () => {
    const config = createAuthOptions({ database: getNativeDatabase() })
    if (!process.env.DATABASE_URL) {
      const migrations = await getMigrations(config)
      await migrations.runMigrations()
    }
    return betterAuth(config)
  })())
}
export async function getActor(headers: Headers): Promise<Actor | null> {
  const session = await (await getAuth()).api.getSession({ headers })
  return session
    ? {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      }
    : null
}
