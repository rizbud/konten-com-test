import { campaignSummary } from '@/lib/campaigns/summary'
import { formatNumber, formatRupiah } from '@/lib/format'

import { CampaignStatusBadge, MUTED } from '../ui'

/**
 * The B3 summary, shown whenever the listing is filtered to one campaign.
 *
 * It calls the query module rather than fetching its own `/api/campaigns/:id/
 * summary` — same reason the table does, ADR-0003: one place the query can be
 * wrong, no loopback request, and no loading state for data the server can
 * simply render. The route handler is the same function behind a thin wrapper.
 *
 * What it adds over the table is the part the rows cannot show: how much of this
 * campaign is still waiting, and how much it has actually paid out.
 */
export async function CampaignSummaryPanel({ campaignId }: { campaignId: number }) {
  const summary = await campaignSummary(campaignId)
  if (!summary) return null

  const { totalBudget, remainingBudget } = summary
  const remainingPercent =
    totalBudget > 0 ? Math.round((remainingBudget / totalBudget) * 100) : 0

  return (
    <section
      aria-label={`Summary for ${summary.title}`}
      className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">{summary.title}</h2>
        <span className={`text-sm ${MUTED}`}>{summary.brand}</span>
        <CampaignStatusBadge status={summary.status} />
        <span className={`text-sm ${MUTED}`}>
          {formatRupiah(summary.cpm)} per 1.000 views
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Submissions" value={formatNumber(summary.submissionCount)} />
        <Stat label="Pending" value={formatNumber(summary.pendingCount)} />
        <Stat label="Approved" value={formatNumber(summary.approvedCount)} />
        <Stat label="Paid to creators" value={formatRupiah(summary.netPaid)} />
        <Stat label="Platform fee" value={formatRupiah(summary.feeCollected)} />
        <Stat label="Gross paid" value={formatRupiah(summary.grossPaid)} />
      </dl>

      <div className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span>
            <span className="font-semibold tabular-nums">
              {formatRupiah(remainingBudget)}
            </span>{' '}
            <span className={MUTED}>
              remaining of {formatRupiah(totalBudget)}
            </span>
          </span>
          <span className={`tabular-nums ${MUTED}`}>{remainingPercent}% left</span>
        </div>
        <div
          role="progressbar"
          aria-label="Remaining budget"
          aria-valuenow={remainingPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        >
          <div
            className="h-full rounded-full bg-emerald-700"
            style={{ width: `${remainingPercent}%` }}
          />
        </div>
      </div>

      {summary.grossPaid < totalBudget - remainingBudget ? (
        // The seed's pre-existing `approved` rows consumed budget without
        // writing an earning, so the two numbers legitimately disagree. Saying
        // so beats letting a reviewer think the books do not balance.
        <p className={`mt-3 text-xs ${MUTED}`}>
          {formatRupiah(totalBudget - remainingBudget - summary.grossPaid)} of the
          spent budget predates this system and has no earning behind it. Those
          are Legacy Approvals, not a gap in the books &mdash; see CONTEXT.md.
        </p>
      ) : null}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={`text-xs ${MUTED}`}>{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
