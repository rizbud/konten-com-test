import { eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { campaigns, earnings, submissions } from '@/db/schema'

export type CampaignSummary = {
  campaignId: number
  title: string
  brand: string
  cpm: number
  totalBudget: number
  remainingBudget: number
  status: string
  submissionCount: number
  approvedCount: number
  pendingCount: number
  /** Gross this system has paid out. Excludes legacy approvals — see below. */
  grossPaid: number
  netPaid: number
  feeCollected: number
}

/**
 * Every count over this campaign's submissions, in one pass. `count(*) filter`
 * is why: the three numbers come out of a single index-only scan instead of one
 * scan each.
 */
const submissionCounts = db
  .select({
    total: sql<number>`count(*)::int`.as('total'),
    approved: sql<number>`count(*) filter (where ${submissions.status} = 'approved')::int`.as(
      'approved',
    ),
    pending: sql<number>`count(*) filter (where ${submissions.status} = 'pending')::int`.as(
      'pending',
    ),
  })
  .from(submissions)
  .where(sql`${submissions.campaignId} = ${campaigns.id}`)
  .as('submission_counts')

/**
 * Same idea for the money. `sum()` over `bigint` stays `bigint`, which pg hands
 * back as a string, so these are converted explicitly below rather than being
 * let loose into arithmetic.
 */
const earningTotals = db
  .select({
    gross: sql<string>`coalesce(sum(${earnings.grossAmount}), 0)`.as('gross'),
    net: sql<string>`coalesce(sum(${earnings.netAmount}), 0)`.as('net'),
    fee: sql<string>`coalesce(sum(${earnings.feeAmount}), 0)`.as('fee'),
  })
  .from(earnings)
  .where(sql`${earnings.campaignId} = ${campaigns.id}`)
  .as('earning_totals')

/**
 * One round trip, and two scans inside it: one over the campaign's submissions
 * and one over its earnings. The obvious shape — a correlated scalar subquery
 * per number — is six scans, because a scalar subquery can only return one
 * column. `LEFT JOIN LATERAL` lets each side return three.
 *
 * Lateral rather than a plain join for the same reason the subqueries were not
 * one join: joining submissions to earnings and then aggregating would count
 * each submission once per earning row.
 *
 * `grossPaid` will not equal `totalBudget - remainingBudget` on the seeded
 * campaigns. The seed's pre-existing `approved` rows are legacy approvals that
 * carry no earning and consumed no budget — read-only history, see CONTEXT.md.
 */
export async function campaignSummary(id: number): Promise<CampaignSummary | null> {
  const [row] = await db
    .select({
      campaignId: campaigns.id,
      title: campaigns.title,
      brand: campaigns.brand,
      cpm: campaigns.cpm,
      totalBudget: campaigns.totalBudget,
      remainingBudget: campaigns.remainingBudget,
      status: campaigns.status,
      submissionCount: submissionCounts.total,
      approvedCount: submissionCounts.approved,
      pendingCount: submissionCounts.pending,
      grossPaid: earningTotals.gross,
      netPaid: earningTotals.net,
      feeCollected: earningTotals.fee,
    })
    .from(campaigns)
    .leftJoinLateral(submissionCounts, sql`true`)
    .leftJoinLateral(earningTotals, sql`true`)
    .where(eq(campaigns.id, id))

  if (!row) return null

  return {
    ...row,
    grossPaid: Number(row.grossPaid),
    netPaid: Number(row.netPaid),
    feeCollected: Number(row.feeCollected),
  }
}
