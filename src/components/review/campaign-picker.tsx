'use client'

import { useId, useMemo, useState } from 'react'

import { CONTROL, MUTED, Popup, PopupNote, PopupOption } from '../ui'

export type CampaignOption = { id: number; title: string }

const ALL = 'All campaigns'

/**
 * Presentational: it owns the typing and open/closed state of its own popup and
 * nothing else. Which campaign is selected is the caller's business.
 *
 * Filtering is local because the eight campaigns already arrive with the page —
 * unlike the creator picker, there is nothing to fetch.
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

  const selectedTitle = campaigns.find((campaign) => campaign.id === value)?.title ?? ''

  const matches = useMemo(() => {
    const needle = typed.trim().toLowerCase()
    if (!needle) return campaigns
    return campaigns.filter((campaign) => campaign.title.toLowerCase().includes(needle))
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
            // Enter would otherwise submit the form before the pick lands.
            event.preventDefault()
            if (matches.length > 0) pick(matches[0].id)
          }
        }}
      />

      {open ? (
        <Popup id={listboxId}>
          <PopupOption selected={value === null} onSelect={() => pick(null)}>
            <span className={MUTED}>{ALL}</span>
          </PopupOption>

          {matches.map((campaign) => (
            <PopupOption
              key={campaign.id}
              selected={campaign.id === value}
              onSelect={() => pick(campaign.id)}
            >
              {campaign.title}
            </PopupOption>
          ))}

          {matches.length === 0 ? <PopupNote>No campaign matches.</PopupNote> : null}
        </Popup>
      ) : null}
    </div>
  )
}
