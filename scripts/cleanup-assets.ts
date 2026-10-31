import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"
import { openDatabase } from "../src/lib/server/database"
import { createV2Service } from "../src/lib/server/v2-service"
if (existsSync(".env.local")) loadEnvFile(".env.local")
const db = openDatabase()
try {
  const removed = await createV2Service({
    db,
    uploadDir: process.env.FAMILY_UPLOAD_PATH,
  }).cleanup()
  console.log(JSON.stringify({ status: "completed", removed }))
} finally {
  db.close()
}
