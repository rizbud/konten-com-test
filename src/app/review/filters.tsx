'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { SUBMISSION_STATUSES } from '@/db/schema'

type CampaignOption = { id: number; title: string }

/**
 * The only reason this is a client component: filter changes are navigations,
 * and `useTransition` gives the table an "updating" state while the server
 * re-renders. Filter state itself lives in the URL, so it survives a reload and
 * is shareable.
 */
export function Filters({ campaigns }: { campaigns: CampaignOption[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    // Any filter change invalidates the current offset.
    next.delete('page')
    startTransition(() => router.push(`/review?${next}`))
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault()
        const q = new FormData(event.currentTarget).get('q')
        apply({ q: typeof q === 'string' ? q.trim() : '' })
      }}
    >
      <Field label="Status">
        <select
          name="status"
          className={SELECT}
          defaultValue={searchParams.get('status') ?? 'pending'}
          onChange={(event) => apply({ status: event.target.value })}
        >
          <option value="">All statuses</option>
          {SUBMISSION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Campaign">
        <select
          name="campaignId"
          className={SELECT}
          defaultValue={searchParams.get('campaignId') ?? ''}
          onChange={(event) => apply({ campaignId: event.target.value })}
        >
          <option value="">All campaigns</option>
          {campaigns.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.title}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Creator username">
        <input
          type="search"
          name="q"
          className={SELECT}
          placeholder="creator_12"
          defaultValue={searchParams.get('q') ?? ''}
        />
      </Field>

      <button
        type="submit"
        className="h-9 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Search
      </button>

      <span
        role="status"
        className="h-9 self-end text-sm leading-9 text-zinc-500 tabular-nums"
      >
        {isPending ? 'Updating…' : ''}
      </span>
    </form>
  )
}

const SELECT =
  'h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
      {label}
      {children}
    </label>
  )
}
