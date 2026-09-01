import Link from 'next/link'

import { formatNumber } from '@/lib/format'
import { pageWindow } from '@/lib/pagination'

import { MUTED } from './ui'

/**
 * Plain links, so this stays a server component: no client JavaScript is needed
 * to change page, and every page is a real URL an admin can bookmark.
 */
export function Pagination({
  page,
  pageCount,
  total,
  query,
  basePath,
}: {
  page: number
  pageCount: number
  total: number
  /** The current filters. Every link carries them forward. */
  query: URLSearchParams
  basePath: string
}) {
  const href = (target: number) => {
    const next = new URLSearchParams(query)
    next.set('page', String(target))
    return `${basePath}?${next}`
  }

  return (
    <nav
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"
      aria-label="Pagination"
    >
      <p className={`${MUTED} tabular-nums`}>
        {formatNumber(total)} submissions &middot; page {formatNumber(page)} of{' '}
        {formatNumber(pageCount)}
      </p>

      <div className="flex items-center gap-1">
        <Step href={href(page - 1)} disabled={page <= 1}>
          Previous
        </Step>

        {pageWindow(page, pageCount).map((item, index) =>
          item === 'gap' ? (
            <span key={`gap-${index}`} className={`px-2 ${MUTED}`} aria-hidden>
              &hellip;
            </span>
          ) : item === page ? (
            <span
              key={item}
              aria-current="page"
              className="min-w-9 rounded-md bg-zinc-900 px-3 py-1.5 text-center font-medium text-white tabular-nums dark:bg-zinc-100 dark:text-zinc-900"
            >
              {item}
            </span>
          ) : (
            <Link
              key={item}
              href={href(item)}
              aria-label={`Page ${item}`}
              className={`${STEP} min-w-9 text-center tabular-nums hover:bg-zinc-100 dark:hover:bg-zinc-800`}
            >
              {item}
            </Link>
          ),
        )}

        <Step href={href(page + 1)} disabled={page >= pageCount}>
          Next
        </Step>
      </div>
    </nav>
  )
}

const STEP = 'rounded-md border border-zinc-300 px-3 py-1.5 dark:border-zinc-600'

function Step({
  href,
  disabled,
  children,
}: {
  href: string
  disabled: boolean
  children: React.ReactNode
}) {
  if (disabled) {
    // Inactive controls are exempt from the contrast minimum, but zinc-600 on
    // near-black read as absent rather than unavailable.
    return <span className={`${STEP} text-zinc-500 dark:text-zinc-500`}>{children}</span>
  }
  return (
    <Link href={href} className={`${STEP} hover:bg-zinc-100 dark:hover:bg-zinc-800`}>
      {children}
    </Link>
  )
}
