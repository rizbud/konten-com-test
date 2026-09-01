'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

import { SUBMISSION_STATUSES } from '@/db/schema'

import { BUTTON, CONTROL, Field, MUTED } from '../ui'
import { CampaignPicker, type CampaignOption } from './campaign-picker'
import { CreatorPicker } from './creator-picker'

type Draft = { status: string; campaignId: string; q: string }

/**
 * Nothing is filtered until Apply. Every control edits a local draft, and one
 * submit turns the whole draft into one navigation — so changing status and
 * campaign together costs one round trip instead of two, and half-typed input
 * never queries 50 000 rows.
 *
 * `apply` is the only code that knows what a filter change means: which params
 * it touches, that it resets the offset, and that it runs in a transition so the
 * table can say it is updating. The controls below report values and nothing
 * else.
 *
 * The draft starts from the URL. The page gives this component a key derived
 * from the query string, so a navigation (paging, a shared link) remounts it and
 * the draft matches what is on screen — no effect syncing two sources of truth.
 */
export function ReviewFilters({ campaigns }: { campaigns: CampaignOption[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [draft, setDraft] = useState<Draft>(() => ({
    status: searchParams.get('status') ?? 'pending',
    campaignId: searchParams.get('campaignId') ?? '',
    q: searchParams.get('q') ?? '',
  }))

  const edit = (changes: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...changes }))

  function apply() {
    const next = new URLSearchParams(searchParams)

    // `status` is written even when empty, because the page treats an *absent*
    // status as "use the default, pending". Deleting it would make "All
    // statuses" snap back to pending; `?status=` means all of them.
    next.set('status', draft.status)
    setOrDelete(next, 'campaignId', draft.campaignId)
    setOrDelete(next, 'q', draft.q.trim())
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
        apply()
      }}
    >
      <Field label="Status">
        <select
          name="status"
          className={`${CONTROL} cursor-pointer`}
          value={draft.status}
          onChange={(event) => edit({ status: event.target.value })}
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
        <CampaignPicker
          campaigns={campaigns}
          value={draft.campaignId ? Number(draft.campaignId) : null}
          onChange={(id) => edit({ campaignId: id === null ? '' : String(id) })}
        />
      </Field>

      <Field label="Creator username">
        <CreatorPicker value={draft.q} onChange={(q) => edit({ q })} />
      </Field>

      <button type="submit" className={BUTTON}>
        Apply filter
      </button>

      <span role="status" className={`h-9 self-end text-sm leading-9 ${MUTED}`}>
        {isPending ? 'Updating…' : ''}
      </span>
    </form>
  )
}

function setOrDelete(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value)
  else params.delete(key)
}
