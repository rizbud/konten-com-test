import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')

// One pool per process. `next dev` re-evaluates modules on every edit, so it is
// stashed on globalThis to stop each reload leaking another pool.
const globalForPool = globalThis as { clippayPool?: Pool }
const pool = (globalForPool.clippayPool ??= new Pool({ connectionString: url }))

export const db = drizzle(pool, { schema, casing: 'snake_case' })
