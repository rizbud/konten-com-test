import { formatDateTime, formatNumber } from '@/lib/format'
import type { SubmissionRow as Submission } from '@/lib/submissions/list'

import { CLICKABLE, DANGER, MUTED, StatusBadge, SUCCESS, Td } from '../ui'

export type ReviewAction = 'approve' | 'reject'

export type RowState =
  | { kind: 'idle' }
  | { kind: 'sending'; action: ReviewAction }
  | { kind: 'error'; message: string }
  | { kind: 'done'; message: string }

/**
 * Presentational. It knows how to draw one submission and which state its review
 * is in; it does not know that reviewing is an HTTP call. The id it reports back
 * is the only thing it says about the outside world.
 */
export function SubmissionRow({
  submission,
  state,
  onReview,
  disabled,
}: {
  submission: Submission
  state: RowState
  onReview: (submissionId: number, action: ReviewAction) => void
  disabled: boolean
}) {
  const sending = state.kind === 'sending'
  const busy = disabled || sending

  return (
    <tr>
      <Td className="font-medium">{submission.creatorUsername}</Td>
      <Td>{submission.campaignTitle}</Td>
      <Td className={`capitalize ${MUTED}`}>{submission.platform}</Td>
      <Td className="text-right tabular-nums">{formatNumber(submission.views)}</Td>
      <Td className={`whitespace-nowrap ${MUTED}`}>
        {formatDateTime(submission.submittedAt)}
      </Td>
      <Td>
        <StatusBadge status={submission.status} />
      </Td>
      <Td className="text-right">
        {submission.status !== 'pending' ? (
          <span className="text-zinc-500">&mdash;</span>
        ) : state.kind === 'done' ? (
          <span className={`text-sm font-medium ${SUCCESS}`}>{state.message}</span>
        ) : (
          <div className="flex items-center justify-end gap-2">
            {state.kind === 'error' ? (
              <span role="alert" className={`text-right text-xs ${DANGER}`}>
                {state.message}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onReview(submission.id, 'approve')}
              disabled={busy}
              className={`h-8 shrink-0 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60 ${CLICKABLE}`}
            >
              {sending && state.action === 'approve' ? 'Approving…' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={() => onReview(submission.id, 'reject')}
              disabled={busy}
              className={`h-8 shrink-0 rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-600 dark:hover:bg-zinc-800 ${CLICKABLE}`}
            >
              {sending && state.action === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
          </div>
        )}
      </Td>
    </tr>
  )
}
