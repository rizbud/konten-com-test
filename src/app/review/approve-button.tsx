'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { formatRupiah } from './format'

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'error'; message: string }
  | { kind: 'done'; message: string }

/**
 * The endpoint is the source of truth for whether an approval happened, so the
 * button posts to it and reports what came back. Disabled while in flight, and
 * left disabled afterwards: the row's outcome is settled either way until the
 * refreshed server render replaces it.
 */
export function ApproveButton({ submissionId }: { submissionId: number }) {
  const router = useRouter()
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [isRefreshing, startTransition] = useTransition()

  async function approve() {
    setState({ kind: 'sending' })
    try {
      const response = await fetch(`/api/submissions/${submissionId}/approve`, {
        method: 'POST',
      })
      const body: { error?: string; earning?: { net: number } } = await response.json()

      if (!response.ok) {
        setState({ kind: 'error', message: body.error ?? `Failed (${response.status})` })
        // 409 means someone else already reviewed it — the table is stale.
        if (response.status === 409) startTransition(() => router.refresh())
        return
      }

      setState({
        kind: 'done',
        message: `Paid ${formatRupiah(body.earning?.net ?? 0)}`,
      })
      startTransition(() => router.refresh())
    } catch {
      setState({ kind: 'error', message: 'Network error — nothing was approved.' })
    }
  }

  if (state.kind === 'done') {
    return <span className="text-sm text-emerald-600">{state.message}</span>
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {state.kind === 'error' ? (
        <span role="alert" className="text-right text-xs text-red-600">
          {state.message}
        </span>
      ) : null}
      <button
        type="button"
        onClick={approve}
        disabled={state.kind === 'sending' || isRefreshing}
        className="h-8 shrink-0 rounded-md bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {state.kind === 'sending' ? 'Approving…' : 'Approve'}
      </button>
    </div>
  )
}
