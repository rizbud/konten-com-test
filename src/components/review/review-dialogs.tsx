"use client";

import { capitalize, formatNumber, formatRupiah } from "@/lib/format";
import type { SubmissionRow as Submission } from "@/lib/submissions/list";

import { Modal } from "../modal";
import {
  APPROVE_BUTTON,
  DANGER,
  MUTED,
  QUIET_BUTTON,
  REJECT_BUTTON,
} from "../ui";
import { earningPreview, SubmissionDetails } from "./review-details";
import type { ReviewAction } from "./submission-row";

/**
 * Both dialogs are presentational: they render what they are given and call
 * back. The list decides when they are open and what confirming means.
 *
 * Native `<dialog>` via Modal rather than `window.confirm`: the confirmation has
 * to state the amount that is about to move, which a browser alert cannot show
 * legibly, and it blocks the event loop while it is up.
 */
export function ConfirmReviewDialog({
  submission,
  action,
  pending,
  onConfirm,
  onCancel,
}: {
  submission: Submission | null;
  action: ReviewAction;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const approving = action === "approve";
  const preview = submission ? earningPreview(submission) : null;

  return (
    <Modal
      open={submission !== null}
      onClose={onCancel}
      title={approving ? "Approve and pay?" : "Reject this submission?"}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className={`h-9 ${QUIET_BUTTON}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`h-9 ${approving ? APPROVE_BUTTON : REJECT_BUTTON}`}
          >
            {pending
              ? approving
                ? "Approving…"
                : "Rejecting…"
              : approving
                ? "Approve and pay"
                : "Reject"}
          </button>
        </>
      }
    >
      {submission ? (
        <>
          <p>
            {approving ? (
              <>
                This pays <strong>{submission.creatorUsername}</strong>{" "}
                <strong>{formatRupiah(preview?.net ?? 0)}</strong> for{" "}
                {formatNumber(submission.views)} views, and takes{" "}
                {formatRupiah(preview?.gross ?? 0)} off{" "}
                <strong>{submission.campaignTitle}</strong>&rsquo;s remaining
                budget.
              </>
            ) : (
              <>
                This closes <strong>{submission.creatorUsername}</strong>
                &rsquo;s submission to{" "}
                <strong>{submission.campaignTitle}</strong> without paying it.
                No earning is written and no budget is spent.
              </>
            )}
          </p>
          <p className={`mt-3 text-xs ${DANGER}`}>
            {approving
              ? "An approval is settled money — it is not reversed if views fall later."
              : "A review happens once. A rejected submission cannot be approved afterwards."}
          </p>
          {approving ? (
            <dl className={`mt-3 flex gap-6 text-xs ${MUTED}`}>
              <div>
                <dt>Gross</dt>
                <dd className="tabular-nums">
                  {formatRupiah(preview?.gross ?? 0)}
                </dd>
              </div>
              <div>
                <dt>Platform fee</dt>
                <dd className="tabular-nums">
                  {formatRupiah(preview?.fee ?? 0)}
                </dd>
              </div>
              <div>
                <dt>Budget left after</dt>
                <dd className="tabular-nums">
                  {formatRupiah(
                    submission.campaignRemainingBudget - (preview?.gross ?? 0),
                  )}
                </dd>
              </div>
            </dl>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}

/**
 * Reviewing from here is the same decision as reviewing from the row, so it
 * takes the same route: the buttons report an id and an action, and the list
 * swaps this dialog for the confirmation. Two stacked dialogs would be worse,
 * and nothing is lost — the confirmation repeats the amount.
 */
export function SubmissionDetailDialog({
  submission,
  onReview,
  onClose,
  disabled,
}: {
  submission: Submission | null;
  onReview: (submissionId: number, action: ReviewAction) => void;
  onClose: () => void;
  disabled: boolean;
}) {
  const reviewable = submission?.status === "pending";

  return (
    <Modal
      open={submission !== null}
      onClose={onClose}
      title={
        submission
          ? `${capitalize(submission.status)} submission #${submission.id}`
          : "Submission"
      }
      footer={
        <>
          {submission && reviewable ? (
            <>
              <button
                type="button"
                onClick={() => onReview(submission.id, "reject")}
                disabled={disabled}
                className={`h-9 ${REJECT_BUTTON}`}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => onReview(submission.id, "approve")}
                disabled={disabled}
                className={`h-9 ${APPROVE_BUTTON}`}
              >
                Approve
              </button>
            </>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className={`h-9 ${QUIET_BUTTON}`}
          >
            Close
          </button>
        </>
      }
    >
      {submission ? <SubmissionDetails submission={submission} /> : null}
    </Modal>
  );
}
