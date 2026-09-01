import { asc, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { creators } from '@/db/schema'

export type CreatorMatch = { id: number; username: string }

export const MAX_CREATOR_MATCHES = 20
export const DEFAULT_CREATOR_MATCHES = 5

/**
 * Typeahead source for the creator filter. Deliberately capped and unpaginated:
 * it exists so an admin can find one username, not to browse 2 000 of them —
 * typing more characters is the way to narrow it.
 *
 * Same substring predicate as the submissions list, so it rides the same
 * pg_trgm index on `lower(username)`.
 */
export async function searchCreators(
  query: string,
  limit = DEFAULT_CREATOR_MATCHES,
): Promise<CreatorMatch[]> {
  const needle = query.trim().toLowerCase()
  if (!needle) return []

  const escaped = needle.replace(/[\\%_]/g, (character) => `\\${character}`)

  return db
    .select({ id: creators.id, username: creators.username })
    .from(creators)
    .where(sql`lower(${creators.username}) like ${`%${escaped}%`}`)
    // Shortest first would be friendlier, but alphabetical is stable and lets
    // the caller trust that the same query returns the same five rows.
    .orderBy(asc(creators.username))
    .limit(limit)
}
