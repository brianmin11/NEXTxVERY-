import "server-only"
import { betterAuth, type BetterAuthOptions } from "better-auth"
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
    const secret = process.env.BETTER_AUTH_SECRET
    if (!secret || secret.length < 32)
      throw new Error("BETTER_AUTH_SECRET must be configured")
    const config: BetterAuthOptions = {
      database: getNativeDatabase(),
      secret,
      baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3100",
      emailAndPassword: { enabled: true, minPasswordLength: 12 },
      session: {
        expiresIn: 86400,
        updateAge: 3600,
        cookieCache: { enabled: false },
      },
      rateLimit: { enabled: true, window: 60, max: 50 },
      advanced: { cookiePrefix: "woorijip" },
    }
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
