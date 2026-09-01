/**
 * Applies the given schema.sql (tables + 50 000-row seed) so setup needs no
 * `psql` on the host — `npm run db:setup`.
 *
 * This file is *not* a migration: schema.sql is provided by the brief and is
 * replayed as-is, drops included. Our own DDL lives in drizzle/ and is applied
 * by `npm run db:migrate` afterwards.
 */
import { readFile } from 'node:fs/promises'

import { Client } from 'pg'

try {
  process.loadEnvFile('.env')
} catch {
  // No .env: DATABASE_URL is expected to come from the environment instead.
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set (put it in .env).')
  process.exit(1)
}

const sql = await readFile('schema.sql', 'utf8')
const client = new Client({ connectionString: url })

await client.connect()
try {
  // One call: pg sends this as a simple query, so the whole file runs as a
  // single implicit transaction and a failure leaves nothing half-applied.
  await client.query(sql)
  console.log('schema.sql applied.')
} finally {
  await client.end()
}
