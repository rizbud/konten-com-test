'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { SUBMISSION_STATUSES } from '@/db/schema'

import { BUTTON, CONTROL, Field, MUTED } from '../ui'
import { CampaignPicker, type CampaignOption } from './campaign-picker'

/**
 * Every filter change goes through `apply` here — the controls below are dumb
 * inputs that report a value. One place decides what a filter change means:
 * which params it touches, that it resets the offset, and that it happens
 * inside a transition so the table can say it is updating.
 *
 * State lives in the URL, not in this component, so a filtered view survives a
 * reload and can be pasted to someone else.
 */
export function ReviewFilters({ campaigns }: { campaigns: CampaignOption[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      // `status` is kept even when empty, because the page treats an *absent*
      // status as "use the default, pending". Deleting it would make picking
      // "All statuses" silently snap back to pending; `?status=` means all.
      if (value || key === 'status') next.set(key, value)
      else next.delete(key)
    }
    // Any filter change invalidates the current offset.
    next.delete('page')
    startTransition(() => router.push(`/review?${next}`))
  }

  const campaignId = searchParams.get('campaignId')

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
          className={CONTROL}
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
        <CampaignPicker
          campaigns={campaigns}
          value={campaignId ? Number(campaignId) : null}
          onChange={(id) => apply({ campaignId: id === null ? '' : String(id) })}
        />
      </Field>

      <Field label="Creator username">
        <input
          type="search"
          name="q"
          className={CONTROL}
          placeholder="creator_12"
          defaultValue={searchParams.get('q') ?? ''}
        />
      </Field>

      <button type="submit" className={BUTTON}>
        Search
      </button>

      <span role="status" className={`h-9 self-end text-sm leading-9 ${MUTED}`}>
        {isPending ? 'Updating…' : ''}
      </span>
    </form>
  )
}
