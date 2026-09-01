import { eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { campaigns } from '@/db/schema'

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
 * One round trip. The aggregates are correlated scalar subqueries rather than a
 * join: joining submissions to earnings and then aggregating would count each
 * submission once per earning row.
 *
 * They are written as literal SQL because drizzle drops the table qualifier
 * when a column object is interpolated into a `sql` template in the select
 * list — `${submissions.campaignId} = ${campaigns.id}` renders as
 * `"campaign_id" = "id"`, which silently resolves to submissions' own id and
 * counts the wrong rows. Spelling the correlation out is the honest fix.
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
      // Row counts, safely within int range.
      submissionCount: sql<number>`(
        select count(*)::int from submissions s where s.campaign_id = campaigns.id
      )`,
      approvedCount: sql<number>`(
        select count(*)::int from submissions s
        where s.campaign_id = campaigns.id and s.status = 'approved'
      )`,
      pendingCount: sql<number>`(
        select count(*)::int from submissions s
        where s.campaign_id = campaigns.id and s.status = 'pending'
      )`,
      // sum() over bigint stays bigint, which pg hands back as a string.
      grossPaid: sql<string>`(
        select coalesce(sum(e.gross_amount), 0) from earnings e
        where e.campaign_id = campaigns.id
      )`,
      netPaid: sql<string>`(
        select coalesce(sum(e.net_amount), 0) from earnings e
        where e.campaign_id = campaigns.id
      )`,
      feeCollected: sql<string>`(
        select coalesce(sum(e.fee_amount), 0) from earnings e
        where e.campaign_id = campaigns.id
      )`,
    })
    .from(campaigns)
    .where(eq(campaigns.id, id))

  if (!row) return null

  return {
    ...row,
    grossPaid: Number(row.grossPaid),
    netPaid: Number(row.netPaid),
    feeCollected: Number(row.feeCollected),
  }
}
