import { calculateEarning } from '@/lib/money'
import { capitalize, formatDateTime, formatNumber, formatRupiah } from '@/lib/format'
import type { SubmissionRow as Submission } from '@/lib/submissions/list'

import { MUTED, StatusBadge } from '../ui'

/**
 * What approving this submission would pay, at the views it currently carries.
 * The same pure function the server uses, so the preview and the payment cannot
 * drift — but it is still a preview: the amount that gets written is computed
 * inside the transaction, from the views the row holds when it is locked.
 */
export function earningPreview(submission: Submission) {
  return calculateEarning(submission.views, submission.campaignCpm)
}

export function DefinitionList({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-2">{children}</dl>
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className={MUTED}>{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  )
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className={`mb-2 mt-5 text-xs font-semibold uppercase tracking-wide ${MUTED}`}>
      {children}
    </h3>
  )
}

/** The shared body of the detail dialog: one submission and its campaign. */
export function SubmissionDetails({ submission }: { submission: Submission }) {
  const { gross, fee, net } = earningPreview(submission)
  const spent = submission.campaignTotalBudget - submission.campaignRemainingBudget

  return (
    <div>
      <SectionHeading>Submission</SectionHeading>
      <DefinitionList>
        <Row label="ID">
          <span className="tabular-nums">{submission.id}</span>
        </Row>
        <Row label="Creator">{submission.creatorUsername}</Row>
        <Row label="Platform">
          <span className="capitalize">{submission.platform}</span>
        </Row>
        <Row label="Video">
          <a
            href={submission.videoUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="underline underline-offset-2"
          >
            {submission.videoUrl}
          </a>
        </Row>
        <Row label="Views">
          <span className="tabular-nums">{formatNumber(submission.views)}</span>
        </Row>
        <Row label="Status">
          <StatusBadge status={submission.status} />
        </Row>
        <Row label="Submitted">{formatDateTime(submission.submittedAt)}</Row>
        <Row label="Reviewed">
          {submission.reviewedAt ? (
            formatDateTime(submission.reviewedAt)
          ) : (
            <span className={MUTED}>not yet</span>
          )}
        </Row>
      </DefinitionList>

      <SectionHeading>Campaign</SectionHeading>
      <DefinitionList>
        <Row label="Title">{submission.campaignTitle}</Row>
        <Row label="Brand">{submission.campaignBrand}</Row>
        <Row label="Status">{capitalize(submission.campaignStatus)}</Row>
        <Row label="CPM">
          <span className="tabular-nums">
            {formatRupiah(submission.campaignCpm)} per 1.000 views
          </span>
        </Row>
        <Row label="Total budget">
          <span className="tabular-nums">
            {formatRupiah(submission.campaignTotalBudget)}
          </span>
        </Row>
        <Row label="Remaining budget">
          <span className="tabular-nums">
            {formatRupiah(submission.campaignRemainingBudget)}
          </span>
          {/* "spent", not "paid out by this system": on the seeded campaigns
              most of the gap is Legacy Approvals that consumed no budget at
              all. See CONTEXT.md. */}
          <span className={`ml-2 text-xs ${MUTED}`}>
            {formatRupiah(spent)} of it already spent
          </span>
        </Row>
      </DefinitionList>

      <SectionHeading>If approved now</SectionHeading>
      <DefinitionList>
        <Row label="Gross earning">
          <span className="tabular-nums">{formatRupiah(gross)}</span>
        </Row>
        <Row label="Platform fee">
          <span className="tabular-nums">{formatRupiah(fee)}</span>
        </Row>
        <Row label="Net to creator">
          <span className="font-semibold tabular-nums">{formatRupiah(net)}</span>
        </Row>
      </DefinitionList>

      {gross === 0 ? (
        <p className={`mt-3 text-xs ${MUTED}`}>
          {formatNumber(submission.views)} views at this CPM round down to zero
          rupiah, so this submission cannot be approved — only rejected.
        </p>
      ) : gross > submission.campaignRemainingBudget ? (
        <p className={`mt-3 text-xs ${MUTED}`}>
          The campaign has {formatRupiah(submission.campaignRemainingBudget)} left,
          which does not cover the gross earning. Approving would be refused.
        </p>
      ) : null}
    </div>
  )
}
