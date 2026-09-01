import { formatDateTime, formatNumber } from '@/lib/format'
import type { SubmissionRow as Submission } from '@/lib/submissions/list'

import { DANGER, MUTED, StatusBadge, SUCCESS, Td } from '../ui'

export type ApprovalState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; message: string }

/**
 * Presentational. It knows how to draw one submission and which of the four
 * approval states it is in; it does not know that approving is an HTTP call.
 * The id it reports back is the only thing it says about the outside world.
 */
export function SubmissionRow({
  submission,
  state,
  onApprove,
  disabled,
}: {
  submission: Submission
  state: ApprovalState
  onApprove: (submissionId: number) => void
  disabled: boolean
}) {
  return (
    <tr>
      <Td className="font-medium">{submission.creatorUsername}</Td>
      <Td>{submission.campaignTitle}</Td>
      <Td className={MUTED}>{submission.platform}</Td>
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
              onClick={() => onApprove(submission.id)}
              disabled={disabled || state.kind === 'sending'}
              className="h-8 shrink-0 rounded-md bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {state.kind === 'sending' ? 'Approving…' : 'Approve'}
            </button>
          </div>
        )}
      </Td>
    </tr>
  )
}
