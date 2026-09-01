import { defineConfig } from 'drizzle-kit'

/**
 * Only `drizzle-kit migrate` is used here — `npm run db:migrate`.
 *
 * Do NOT run `drizzle-kit generate` (without `--custom`) or `drizzle-kit push`.
 * The tables in schema.sql are given, not ours to author: a generated diff would
 * try to recreate them, and push would drop what it does not recognise. Every
 * migration in `drizzle/` is hand-written SQL added with
 * `drizzle-kit generate --custom`, which only creates the file and its journal
 * entry and never inspects the schema.
 */
// drizzle-kit runs outside Next, which is what normally loads .env. Node's own
// loader covers it — no dotenv dependency for one line.
try {
  process.loadEnvFile('.env')
} catch {
  // No .env: DATABASE_URL is expected to come from the environment instead.
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
})
