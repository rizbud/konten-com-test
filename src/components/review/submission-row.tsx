import { formatDateTime, formatNumber, formatRupiah } from '@/lib/format'
import type { SubmissionRow as Submission } from '@/lib/submissions/list'

import {
  APPROVE_BUTTON,
  CampaignStatusBadge,
  CLICKABLE,
  MUTED,
  REJECT_BUTTON,
  StatusBadge,
  SUCCESS,
  Td,
} from '../ui'
import { earningPreview } from './review-details'

export type ReviewAction = 'approve' | 'reject'

export type RowState =
  | { kind: 'idle' }
  | { kind: 'sending'; action: ReviewAction }
  | { kind: 'done'; message: string }

/**
 * Presentational. It knows how to draw one submission and whether its review is
 * in flight or finished; it does not know that reviewing is an HTTP call, or
 * that the buttons open a confirmation first. Failures are reported by the
 * list's toasts, not squeezed into this cell.
 */
export function SubmissionRow({
  submission,
  state,
  onReview,
  onOpenDetail,
  disabled,
}: {
  submission: Submission
  state: RowState
  onReview: (submissionId: number, action: ReviewAction) => void
  onOpenDetail: (submissionId: number) => void
  disabled: boolean
}) {
  const sending = state.kind === 'sending'
  const busy = disabled || sending
  // Same pure function the transaction uses, so the column and the payment
  // cannot disagree. Still a preview: the written amount is computed in-tx.
  const { gross, net } = earningPreview(submission)

  return (
    <tr>
      <Td className="font-medium">{submission.creatorUsername}</Td>
      <Td>
        <button
          type="button"
          onClick={() => onOpenDetail(submission.id)}
          className={`text-left underline decoration-dotted underline-offset-2 hover:decoration-solid ${CLICKABLE}`}
        >
          {submission.campaignTitle}
        </button>
        <div className={`text-xs ${MUTED}`}>{submission.campaignBrand}</div>
      </Td>
      <Td>
        <CampaignStatusBadge status={submission.campaignStatus} />
      </Td>
      <Td className={`capitalize ${MUTED}`}>{submission.platform}</Td>
      <Td className="text-right tabular-nums">{formatNumber(submission.views)}</Td>
      <Td className="whitespace-nowrap text-right tabular-nums">
        {formatRupiah(net)}
        <div className={`text-xs ${MUTED}`}>{formatRupiah(gross)} gross</div>
      </Td>
      <Td className="whitespace-nowrap text-right tabular-nums">
        {formatRupiah(submission.campaignRemainingBudget)}
        <div className={`text-xs ${MUTED}`}>
          of {formatRupiah(submission.campaignTotalBudget)}
        </div>
      </Td>
      <Td className={`whitespace-nowrap ${MUTED}`}>
        {formatDateTime(submission.submittedAt)}
      </Td>
      <Td>
        <StatusBadge status={submission.status} />
      </Td>
      <Td className="text-right">
        <div className="flex items-center justify-end gap-2">
          {submission.status !== 'pending' ? null : state.kind === 'done' ? (
            <span className={`text-sm font-medium ${SUCCESS}`}>{state.message}</span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onReview(submission.id, 'approve')}
                disabled={busy}
                className={`h-8 ${APPROVE_BUTTON}`}
              >
                {sending && state.action === 'approve' ? 'Approving…' : 'Approve'}
              </button>
              <button
                type="button"
                onClick={() => onReview(submission.id, 'reject')}
                disabled={busy}
                className={`h-8 ${REJECT_BUTTON}`}
              >
                {sending && state.action === 'reject' ? 'Rejecting…' : 'Reject'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onOpenDetail(submission.id)}
            className={`h-8 rounded-md px-2 text-sm ${MUTED} hover:bg-zinc-100 dark:hover:bg-zinc-800 ${CLICKABLE}`}
            aria-label={`Details for submission ${submission.id}`}
          >
            Details
          </button>
        </div>
      </Td>
    </tr>
  )
}
