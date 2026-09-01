import { and, count, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { campaigns, creators, submissions } from '@/db/schema'

import type { ListParams } from './params'

/**
 * Everything the review screen shows about one submission, table and detail
 * dialog together. The campaign columns ride along on a join that already
 * happens — a per-row lookup when the dialog opens would be an N+1 waiting to
 * be written, and the dialog would need a loading state for data the page
 * already had.
 */
export type SubmissionRow = {
  id: number
  creatorUsername: string
  platform: string
  videoUrl: string
  views: number
  status: string
  submittedAt: Date
  reviewedAt: Date | null
  campaignId: number
  campaignTitle: string
  campaignBrand: string
  campaignCpm: number
  campaignStatus: string
  campaignTotalBudget: number
  campaignRemainingBudget: number
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
    q ? sql`lower(${creators.username}) like ${likeContains(q)}` : undefined,
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
        platform: submissions.platform,
        videoUrl: submissions.videoUrl,
        views: submissions.views,
        status: submissions.status,
        submittedAt: submissions.submittedAt,
        reviewedAt: submissions.reviewedAt,
        campaignId: submissions.campaignId,
        campaignTitle: campaigns.title,
        campaignBrand: campaigns.brand,
        campaignCpm: campaigns.cpm,
        campaignStatus: campaigns.status,
        campaignTotalBudget: campaigns.totalBudget,
        campaignRemainingBudget: campaigns.remainingBudget,
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
 * Substring match: `creator_12` finds `bestcreator_123` too. A leading `%`
 * cannot use a b-tree, so the index behind this is a pg_trgm GIN index on
 * `lower(username)` — see migrations/0002.
 *
 * The user's own `%`, `_` and `\` are escaped, so searching for `%` matches
 * nothing rather than everything.
 */
function likeContains(value: string): string {
  const escaped = value.replace(/[\\%_]/g, (character) => `\\${character}`)
  return `%${escaped}%`
}
