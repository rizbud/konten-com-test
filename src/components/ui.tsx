/**
 * The handful of presentational pieces more than one screen needs. Not a design
 * system — just the place shared classes live so a contrast fix happens once.
 *
 * Muted text is `zinc-600` on light and `zinc-400` on dark: `zinc-500` reads as
 * grey-on-grey against both backgrounds and failed a contrast pass.
 */
import type { ReactNode } from 'react'

export const MUTED = 'text-zinc-600 dark:text-zinc-400'
export const DANGER = 'text-red-700 dark:text-red-400'
export const SUCCESS = 'text-emerald-700 dark:text-emerald-400'

export const CONTROL =
  'h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-400'

export const BUTTON =
  'h-9 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-medium ${MUTED}`}>
      {label}
      {children}
    </label>
  )
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 rounded-lg border border-zinc-200 p-8 text-center dark:border-zinc-800">
      {children}
    </div>
  )
}

export function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 font-medium ${className}`}>{children}</th>
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 ${className}`}>{children}</td>
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'approved'
      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
      : status === 'rejected'
        ? 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-800 dark:text-amber-50'

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>
  )
}
