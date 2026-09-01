import { and, eq } from 'drizzle-orm'

import { db } from '@/db/client'
import { submissions } from '@/db/schema'

export type RejectFailure = 'not_found' | 'already_reviewed'

export type RejectResult = { ok: true } | { ok: false; reason: RejectFailure }

/**
 * The other half of a review: no money moves, so there is no transaction to
 * open — one conditional UPDATE is the whole operation, and it is atomic on its
 * own.
 *
 * The `status = 'pending'` condition is the same guard the approve path uses:
 * a second admin, or a double-clicked button, updates zero rows and gets a 409
 * rather than overwriting someone else's decision. Notably it also means a
 * submission that was just approved cannot be rejected out from under its
 * earning — approval is final (ADR-0004).
 */
export async function rejectSubmission(id: number): Promise<RejectResult> {
  const rejected = await db
    .update(submissions)
    .set({ status: 'rejected', reviewedAt: new Date() })
    .where(and(eq(submissions.id, id), eq(submissions.status, 'pending')))
    .returning({ id: submissions.id })

  if (rejected.length > 0) return { ok: true }

  const [existing] = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(eq(submissions.id, id))

  return { ok: false, reason: existing ? 'already_reviewed' : 'not_found' }
}
