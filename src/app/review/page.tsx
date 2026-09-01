import { asc } from 'drizzle-orm'
import { Suspense } from 'react'

import { Pagination } from '@/components/pagination'
import { ReviewFilters } from '@/components/review/review-filters'
import { SubmissionsTable } from '@/components/review/submissions-table'
import { DANGER, MUTED, Panel } from '@/components/ui'
import { db } from '@/db/client'
import { campaigns } from '@/db/schema'
import { formatNumber } from '@/lib/format'
import { listSubmissions } from '@/lib/submissions/list'
import { parseListParams, type ListParams } from '@/lib/submissions/params'

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
    <main className="mx-auto w-full max-w-[96rem] px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Review submissions</h1>
      <p className={`mt-1 text-sm ${MUTED}`}>
        Approving pays the creator immediately and spends the campaign&rsquo;s remaining
        budget.
      </p>

      <div className="mt-6">
        {/* Keyed on the query so a navigation resets the filter draft to the
            URL it landed on, instead of an effect syncing the two. */}
        <ReviewFilters key={query.toString()} campaigns={campaignOptions} />
      </div>

      {parsed.ok ? (
        // Keyed on the query so every filter change shows the skeleton again.
        <Suspense key={query.toString()} fallback={<Skeleton per={parsed.params.per} />}>
          <Results params={parsed.params} query={query} />
        </Suspense>
      ) : (
        <Panel>
          <p className={`font-medium ${DANGER}`}>That filter combination is not valid.</p>
          <ul className={`mt-2 list-inside list-disc text-sm ${MUTED}`}>
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
        <p className={`mt-1 text-sm ${MUTED}`}>
          {total > 0
            ? `Page ${page} is past the end of ${formatNumber(total)} matching submissions.`
            : 'No submission matches these filters.'}
        </p>
      </Panel>
    )
  }

  return (
    <>
      <SubmissionsTable rows={rows} />
      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        query={query}
        basePath="/review"
      />
    </>
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
        <div key={i} className="h-8 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      ))}
    </div>
  )
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
