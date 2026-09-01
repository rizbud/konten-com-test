'use client'

import { useEffect, useId, useState } from 'react'

import { CONTROL, MUTED, Popup, PopupNote, PopupOption } from '../ui'

type Match = { id: number; username: string }

/** Characters before a lookup is worth a round trip. */
const MIN_QUERY = 2
const DEBOUNCE_MS = 250

/**
 * Suggests creators from the database as you type, five at a time — typing more
 * narrows it rather than scrolling 2 000 names.
 *
 * The value is still free text: the suggestions are a convenience, and a partial
 * username applies as a substring search whether or not one is picked. So this
 * owns *its own* options (a read of /api/creators, debounced and abortable) and
 * nothing about what the filter means — that stays in ReviewFilters.
 *
 * Fetching here rather than in a hook: one caller, and a `useRemoteOptions`
 * wrapper would move the same lines behind a name.
 */
export function CreatorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (username: string) => void
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

  const needle = value.trim()
  const active = open && needle.length >= MIN_QUERY
  const matches = result?.query === needle ? result.matches : []
  const loading = active && result?.query !== needle

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
        value={value}
        onChange={(event) => {
          setOpen(true)
          onChange(event.target.value)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
          if (event.key === 'Enter' && matches.length > 0) {
            // Enter would otherwise submit the form with the partial text.
            event.preventDefault()
            onChange(matches[0].username)
            setOpen(false)
          }
        }}
      />

      {active ? (
        <Popup id={listboxId}>
          {matches.map((match) => (
            <PopupOption
              key={match.id}
              selected={match.username === needle}
              onSelect={() => {
                onChange(match.username)
                setOpen(false)
              }}
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
