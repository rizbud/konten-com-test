import { and, count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { campaigns, creators, submissions } from '@/db/schema'

import type { ListParams } from './params'

export type SubmissionRow = {
  id: number
  creatorUsername: string
  campaignId: number
  campaignTitle: string
  platform: string
  views: number
  status: string
  submittedAt: Date
}

export type SubmissionList = {
  rows: SubmissionRow[]
  /** Exact row count for the current filters, before limit/offset. */
  total: number
  page: number
  per: number
}

/**
 * The one place the listing query lives. Both GET /api/submissions and the
 * /review page call this — see docs/adr/0003.
 */
export async function listSubmissions(params: ListParams): Promise<SubmissionList> {
  const { page, per, q } = params

  const where = and(
    params.status ? eq(submissions.status, params.status) : undefined,
    params.campaignId ? eq(submissions.campaignId, params.campaignId) : undefined,
    q ? sql`lower(${creators.username}) like ${likePrefix(q)}` : undefined,
  )

  // The count query only joins creators when the search needs it; the page
  // query needs both joins anyway to render username and campaign title.
  const countQuery = db.select({ total: count() }).from(submissions).$dynamic()
  if (q) countQuery.innerJoin(creators, eq(creators.id, submissions.creatorId))

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: submissions.id,
        creatorUsername: creators.username,
        campaignId: submissions.campaignId,
        campaignTitle: campaigns.title,
        platform: submissions.platform,
        views: submissions.views,
        status: submissions.status,
        submittedAt: submissions.submittedAt,
      })
      .from(submissions)
      .innerJoin(creators, eq(creators.id, submissions.creatorId))
      .innerJoin(campaigns, eq(campaigns.id, submissions.campaignId))
      .where(where)
      // id breaks ties on submitted_at; without it pages overlap.
      .orderBy(desc(submissions.submittedAt), desc(submissions.id))
      .limit(per)
      .offset((page - 1) * per),
    countQuery.where(where),
  ])

  return { rows, total: totals[0]?.total ?? 0, page, per }
}

/**
 * Prefix-only, so `creators (lower(username) text_pattern_ops)` can serve it.
 * A leading `%` would force a full scan on every keystroke — if infix search is
 * wanted the answer is pg_trgm, not a slower LIKE. See the README.
 */
function likePrefix(value: string): string {
  const escaped = value.replace(/[\\%_]/g, (character) => `\\${character}`)
  return `${escaped}%`
}
