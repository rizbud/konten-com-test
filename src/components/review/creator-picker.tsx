'use client'

import { useEffect, useId, useState } from 'react'

import { CONTROL, MUTED, Popup, PopupNote, PopupOption } from '../ui'

type Match = { id: number; username: string }

/** Characters before a lookup is worth a round trip. */
const MIN_QUERY = 2
const DEBOUNCE_MS = 250

export type CreatorFilter = {
  /** What is typed in the box. */
  query: string
  /** Set only when a suggestion was chosen, and cleared as soon as it is edited. */
  exact: string | null
}

/**
 * Suggests creators from the database as you type, five at a time — typing more
 * narrows it rather than scrolling 2 000 names.
 *
 * Choosing one means *that* creator: it reports an `exact` username alongside
 * the text, and the caller filters on it instead of the substring. Typing again
 * clears it, because the text no longer names anybody in particular. Without
 * that, picking `creator_190` would still return `creator_1909`'s submissions.
 *
 * It owns its own options (a debounced, abortable read of /api/creators) and
 * nothing about what the filter means — that stays in ReviewFilters. Fetching
 * here rather than in a hook: one caller, and a `useRemoteOptions` wrapper would
 * move the same lines behind a name.
 */
export function CreatorPicker({
  value,
  onChange,
}: {
  value: CreatorFilter
  onChange: (next: CreatorFilter) => void
}) {
  const listboxId = useId()
  const [open, setOpen] = useState(false)
  /**
   * Results are stored with the query they answer, so a reply that arrives after
   * the text moved on is simply not the current query and is never displayed.
   * That also means the effect never has to reset state synchronously — the
   * "loading" and "empty" states are derived, not stored.
   */
  const [result, setResult] = useState<{ query: string; matches: Match[] } | null>(null)

  const needle = value.query.trim()
  const active = open && needle.length >= MIN_QUERY
  const matches = result?.query === needle ? result.matches : []
  const loading = active && result?.query !== needle

  function pick(username: string) {
    onChange({ query: username, exact: username })
    setOpen(false)
  }

  useEffect(() => {
    if (!active) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/creators?limit=5&q=${encodeURIComponent(needle)}`,
          { signal: controller.signal },
        )
        const body: { data?: Match[] } = await response.json()
        setResult({ query: needle, matches: body.data ?? [] })
      } catch {
        // An abort is the normal case for every keystroke but the last, and it
        // must not be mistaken for "no matches". A real failure leaves the
        // suggestions empty; neither blocks typing or loses the filter, because
        // Apply reads the text, not the suggestion.
        if (!controller.signal.aborted) setResult({ query: needle, matches: [] })
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [needle, active])

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className={`${CONTROL} w-56`}
        placeholder="creator_12"
        value={value.query}
        onChange={(event) => {
          setOpen(true)
          // Editing the text unpicks whoever was chosen.
          onChange({ query: event.target.value, exact: null })
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'Enter' && matches.length > 0) {
            // Enter would otherwise submit the form with the partial text.
            event.preventDefault()
            pick(matches[0].username)
          }
        }}
      />

      {active ? (
        <Popup id={listboxId}>
          {matches.map((match) => (
            <PopupOption
              key={match.id}
              selected={match.username === value.exact}
              onSelect={() => pick(match.username)}
            >
              {match.username}
            </PopupOption>
          ))}

          {matches.length === 0 ? (
            <PopupNote>{loading ? 'Searching…' : 'No creator matches.'}</PopupNote>
          ) : (
            <PopupNote>
              <span className={MUTED}>Showing the first 5 matches. Type more to narrow.</span>
            </PopupNote>
          )}
        </Popup>
      ) : null}
    </div>
  )
}
