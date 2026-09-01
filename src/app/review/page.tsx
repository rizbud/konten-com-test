import { asc } from 'drizzle-orm'
import Link from 'next/link'
import { Suspense } from 'react'

import { db } from '@/db/client'
import { campaigns } from '@/db/schema'
import { listSubmissions } from '@/lib/submissions/list'
import { parseListParams, type ListParams } from '@/lib/submissions/params'

import { ApproveButton } from './approve-button'
import { Filters } from './filters'
import { formatDateTime, formatNumber } from './format'

export const metadata = { title: 'Review submissions — ClipPay' }

export default async function ReviewPage({ searchParams }: PageProps<'/review'>) {
  const query = toSearchParams(await searchParams)
  // The page defaults to the queue that needs work. The API deliberately does
  // not default `status`, so it stays a faithful view of the table.
  if (!query.has('status')) query.set('status', 'pending')

  const parsed = parseListParams(query)
  const campaignOptions = await db
    .select({ id: campaigns.id, title: campaigns.title })
    .from(campaigns)
    .orderBy(asc(campaigns.title))

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Review submissions</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Approving pays the creator immediately and spends the campaign&rsquo;s remaining
        budget.
      </p>

      <div className="mt-6">
        <Filters campaigns={campaignOptions} />
      </div>

      {parsed.ok ? (
        // Keyed on the query so every filter change shows the skeleton again.
        <Suspense key={query.toString()} fallback={<Skeleton per={parsed.params.per} />}>
          <Results params={parsed.params} query={query} />
        </Suspense>
      ) : (
        <Panel>
          <p className="font-medium text-red-600">That filter combination is not valid.</p>
          <ul className="mt-2 list-inside list-disc text-sm text-zinc-500">
            {parsed.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Panel>
      )}
    </main>
  )
}

async function Results({
  params,
  query,
}: {
  params: ListParams
  query: URLSearchParams
}) {
  const { rows, total, page, per } = await listSubmissions(params)
  const pageCount = Math.max(1, Math.ceil(total / per))

  if (rows.length === 0) {
    return (
      <Panel>
        <p className="font-medium">Nothing to review here.</p>
        <p className="mt-1 text-sm text-zinc-500">
          {total > 0
            ? `Page ${page} is past the end of ${formatNumber(total)} matching submissions.`
            : 'No submission matches these filters.'}
        </p>
      </Panel>
    )
  }

  return (
    <>
      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <Th>Creator</Th>
              <Th>Campaign</Th>
              <Th>Platform</Th>
              <Th className="text-right">Views</Th>
              <Th>Submitted</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((row) => (
              <tr key={row.id}>
                <Td className="font-medium">{row.creatorUsername}</Td>
                <Td>{row.campaignTitle}</Td>
                <Td className="text-zinc-500">{row.platform}</Td>
                <Td className="text-right tabular-nums">{formatNumber(row.views)}</Td>
                <Td className="whitespace-nowrap text-zinc-500">
                  {formatDateTime(row.submittedAt)}
                </Td>
                <Td>
                  <StatusBadge status={row.status} />
                </Td>
                <Td className="text-right">
                  {row.status === 'pending' ? (
                    <ApproveButton submissionId={row.id} />
                  ) : (
                    <span className="text-zinc-400">&mdash;</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav
        className="mt-4 flex items-center justify-between text-sm"
        aria-label="Pagination"
      >
        <p className="text-zinc-500 tabular-nums">
          {formatNumber(total)} submissions &middot; page {formatNumber(page)} of{' '}
          {formatNumber(pageCount)}
        </p>
        <div className="flex gap-2">
          <PageLink query={query} page={page - 1} disabled={page <= 1}>
            Previous
          </PageLink>
          <PageLink query={query} page={page + 1} disabled={page >= pageCount}>
            Next
          </PageLink>
        </div>
      </nav>
    </>
  )
}

function PageLink({
  query,
  page,
  disabled,
  children,
}: {
  query: URLSearchParams
  page: number
  disabled: boolean
  children: React.ReactNode
}) {
  const className = 'rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-700'

  if (disabled) {
    return <span className={`${className} text-zinc-400`}>{children}</span>
  }

  const next = new URLSearchParams(query)
  next.set('page', String(page))
  return (
    <Link
      href={`/review?${next}`}
      className={`${className} hover:bg-zinc-100 dark:hover:bg-zinc-800`}
    >
      {children}
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'approved'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
      : status === 'rejected'
        ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {status}
    </span>
  )
}

function Skeleton({ per }: { per: number }) {
  return (
    <div
      className="mt-6 space-y-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
      aria-busy="true"
    >
      <span className="sr-only">Loading submissions…</span>
      {Array.from({ length: Math.min(per, 10) }, (_, i) => (
        <div key={i} className="h-8 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      ))}
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-lg border border-zinc-200 p-8 text-center dark:border-zinc-800">
      {children}
    </div>
  )
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <th className={`px-4 py-2.5 font-medium ${className}`}>{children}</th>
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return <td className={`px-4 py-2.5 ${className}`}>{children}</td>
}

function toSearchParams(
  raw: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value
    if (first !== undefined) params.set(key, first)
  }
  return params
}
