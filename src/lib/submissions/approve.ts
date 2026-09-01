import { and, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { campaigns, earnings, submissions } from '@/db/schema'
import { calculateEarning, type Earning } from '@/lib/money'

export type ApproveFailure =
  /** No submission with that id. */
  | 'not_found'
  /** Already approved or rejected — nothing to do, and nothing was paid. */
  | 'already_reviewed'
  /** Views round down to zero rupiah, so there is nothing to pay. ADR-0002. */
  | 'zero_earning'
  /** The campaign cannot cover the gross. Never pay partially. */
  | 'insufficient_budget'

export type ApproveResult =
  | { ok: true; earning: Earning & { submissionId: number; viewsAtApproval: number } }
  | { ok: false; reason: ApproveFailure }

/** Thrown to unwind the transaction; never escapes this module. */
class Abort extends Error {
  constructor(readonly reason: ApproveFailure) {
    super(reason)
  }
}

/**
 * Approving is one transaction built from conditional UPDATEs, so Postgres row
 * locks — not application checks — decide who wins. Two admins clicking at once
 * and a double-clicked button take the same path: the second one finds zero rows
 * updated and gets a 409 without touching the budget.
 */
export async function approveSubmission(id: number): Promise<ApproveResult> {
  try {
    return await db.transaction(async (tx) => {
      // Claim the submission first. This is the double-pay guard: a second
      // caller blocks on this row, then re-reads and finds it no longer pending.
      const [claimed] = await tx
        .update(submissions)
        .set({ status: 'approved', reviewedAt: new Date() })
        .where(and(eq(submissions.id, id), eq(submissions.status, 'pending')))
        .returning({
          views: submissions.views,
          creatorId: submissions.creatorId,
          campaignId: submissions.campaignId,
        })

      // Provisional: it may not exist at all. Told apart after the rollback,
      // so the losing path costs a query and the happy path does not.
      if (!claimed) throw new Abort('already_reviewed')

      const [campaign] = await tx
        .select({ cpm: campaigns.cpm })
        .from(campaigns)
        .where(eq(campaigns.id, claimed.campaignId))

      // campaign_id is a NOT NULL foreign key, so this cannot happen.
      if (!campaign) throw new Error(`submission ${id} has no campaign`)

      const earning = calculateEarning(claimed.views, campaign.cpm)
      if (earning.gross === 0) throw new Abort('zero_earning')

      const budgeted = await tx
        .update(campaigns)
        .set({ remainingBudget: sql`${campaigns.remainingBudget} - ${earning.gross}` })
        .where(
          and(
            eq(campaigns.id, claimed.campaignId),
            gte(campaigns.remainingBudget, earning.gross),
          ),
        )
        .returning({ remainingBudget: campaigns.remainingBudget })

      if (budgeted.length === 0) throw new Abort('insufficient_budget')

      await tx.insert(earnings).values({
        submissionId: id,
        creatorId: claimed.creatorId,
        campaignId: claimed.campaignId,
        grossAmount: earning.gross,
        feeAmount: earning.fee,
        netAmount: earning.net,
        viewsAtApproval: claimed.views,
        createdAt: new Date(),
      })

      return {
        ok: true as const,
        earning: { ...earning, submissionId: id, viewsAtApproval: claimed.views },
      }
    })
  } catch (error) {
    if (error instanceof Abort) {
      const reason =
        error.reason === 'already_reviewed' ? await diagnoseNoClaim(id) : error.reason
      return { ok: false, reason }
    }
    throw error
  }
}

/** Only runs on the losing path, to tell 404 apart from 409. */
async function diagnoseNoClaim(id: number): Promise<ApproveFailure> {
  const [existing] = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.id, id))

  return existing ? 'already_reviewed' : 'not_found'
}
