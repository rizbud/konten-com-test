'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { formatRupiah } from '@/lib/format'
import type { SubmissionRow as Submission } from '@/lib/submissions/list'

import { Th } from '../ui'
import { SubmissionRow, type ReviewAction, type RowState } from './submission-row'

type ReviewResponse = {
  error?: string
  earning?: { net: number }
}

/**
 * The list owns the review call for every row in it. One place knows the two
 * endpoints, how to read their responses, and what each status code means; the
 * rows report an id and an action and render the state they are handed.
 *
 * No custom hook: this is one piece of state and one function used in one place,
 * and a `useReviews` wrapper would only move the same lines behind a name.
 */
export function SubmissionsTable({ rows }: { rows: Submission[] }) {
  const router = useRouter()
  const [states, setStates] = useState<Record<number, RowState>>({})
  const [isRefreshing, startTransition] = useTransition()

  const setState = (submissionId: number, state: RowState) =>
    setStates((current) => ({ ...current, [submissionId]: state }))

  async function review(submissionId: number, action: ReviewAction) {
    setState(submissionId, { kind: 'sending', action })

    try {
      const response = await fetch(`/api/submissions/${submissionId}/${action}`, {
        method: 'POST',
      })
      const body: ReviewResponse = await response.json()

      if (!response.ok) {
        setState(submissionId, {
          kind: 'error',
          message: body.error ?? `Failed (${response.status})`,
        })
        // 409 means someone else reviewed it first — this table is stale.
        if (response.status === 409) startTransition(() => router.refresh())
        return
      }

      setState(submissionId, {
        kind: 'done',
        message:
          action === 'approve'
            ? `Paid ${formatRupiah(body.earning?.net ?? 0)}`
            : 'Rejected',
      })
      startTransition(() => router.refresh())
    } catch {
      setState(submissionId, {
        kind: 'error',
        message: 'Network error — nothing was changed.',
      })
    }
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          <tr>
            <Th>Creator</Th>
            <Th>Campaign</Th>
            <Th>Platform</Th>
            <Th className="text-right">Views</Th>
            <Th>Submitted</Th>
            <Th>Status</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((submission) => (
            <SubmissionRow
              key={submission.id}
              submission={submission}
              state={states[submission.id] ?? IDLE}
              onReview={review}
              disabled={isRefreshing}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

const IDLE: RowState = { kind: 'idle' }
