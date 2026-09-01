'use client'

import { useId, useMemo, useState } from 'react'

import { CONTROL, MUTED } from '../ui'

export type CampaignOption = { id: number; title: string }

const ALL = 'All campaigns'

/**
 * Presentational: it owns the typing and open/closed state of its own popup and
 * nothing else. Which campaign is selected is the caller's business — see
 * ReviewFilters, which is where the URL gets written.
 *
 * A native <select> cannot be typed into, and eight campaigns is only eight
 * today. This is a plain filtered listbox rather than a combobox library: click
 * to pick, Enter takes the first match, Escape closes.
 */
export function CampaignPicker({
  campaigns,
  value,
  onChange,
}: {
  campaigns: CampaignOption[]
  value: number | null
  onChange: (campaignId: number | null) => void
}) {
  const listboxId = useId()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')

  const selectedTitle = campaigns.find((c) => c.id === value)?.title ?? ''

  const matches = useMemo(() => {
    const needle = typed.trim().toLowerCase()
    if (!needle) return campaigns
    return campaigns.filter((c) => c.title.toLowerCase().includes(needle))
  }, [campaigns, typed])

  function close() {
    setOpen(false)
    setTyped('')
  }

  function pick(campaignId: number | null) {
    close()
    onChange(campaignId)
  }

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close()
      }}
    >
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className={`${CONTROL} w-56`}
        placeholder={ALL}
        value={open ? typed : selectedTitle}
        onChange={(event) => {
          setOpen(true)
          setTyped(event.target.value)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close()
          if (event.key === 'Enter') {
            event.preventDefault()
            if (matches.length > 0) pick(matches[0].id)
          }
        }}
      />

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-72 overflow-y-auto rounded-md border border-zinc-300 bg-white py-1 shadow-lg dark:border-zinc-600 dark:bg-zinc-900"
        >
          <Option selected={value === null} onSelect={() => pick(null)}>
            <span className={MUTED}>{ALL}</span>
          </Option>

          {matches.map((campaign) => (
            <Option
              key={campaign.id}
              selected={campaign.id === value}
              onSelect={() => pick(campaign.id)}
            >
              {campaign.title}
            </Option>
          ))}

          {matches.length === 0 ? (
            <li className={`px-3 py-2 text-sm ${MUTED}`}>No campaign matches.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}

function Option({
  selected,
  onSelect,
  children,
}: {
  selected: boolean
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <li role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={onSelect}
        className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
          selected ? 'font-semibold' : ''
        }`}
      >
        {children}
      </button>
    </li>
  )
}
