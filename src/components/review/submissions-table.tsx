'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { formatRupiah } from '@/lib/format'
import type { SubmissionRow as Submission } from '@/lib/submissions/list'

import { Toasts, type Toast } from '../toasts'
import { Th } from '../ui'
import { ConfirmReviewDialog, SubmissionDetailDialog } from './review-dialogs'
import { SubmissionRow, type ReviewAction, type RowState } from './submission-row'

type ReviewResponse = {
  error?: string
  earning?: { net: number }
}

type Confirming = { submissionId: number; action: ReviewAction }

const TOAST_MS = 6000

let nextToastId = 0

/**
 * The list owns everything a review touches: the confirmation, both endpoints,
 * reading their responses, what each status code means, and the toast that
 * reports the outcome. The rows report an id and an action and render the state
 * they are handed.
 *
 * No custom hook. It is a handful of `useState` and one async function, all used
 * once — a `useReviews` wrapper would move the same lines behind a name.
 */
export function SubmissionsTable({ rows }: { rows: Submission[] }) {
  const router = useRouter()
  const [states, setStates] = useState<Record<number, RowState>>({})
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirming, setConfirming] = useState<Confirming | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [isRefreshing, startTransition] = useTransition()

  const find = (submissionId: number | undefined) =>
    rows.find((row) => row.id === submissionId) ?? null

  const dismissToast = (id: number) =>
    setToasts((current) => current.filter((toast) => toast.id !== id))

  function toast(tone: Toast['tone'], message: string) {
    const id = nextToastId++
    setToasts((current) => [...current, { id, tone, message }])
    setTimeout(() => dismissToast(id), TOAST_MS)
  }

  async function review({ submissionId, action }: Confirming) {
    setStates((current) => ({
      ...current,
      [submissionId]: { kind: 'sending', action },
    }))

    try {
      const response = await fetch(`/api/submissions/${submissionId}/${action}`, {
        method: 'POST',
      })
      const body: ReviewResponse = await response.json()

      if (!response.ok) {
        setStates((current) => ({ ...current, [submissionId]: IDLE }))
        toast('error', body.error ?? `Failed (${response.status})`)
        // 409 means someone else reviewed it first — this table is stale.
        if (response.status === 409) startTransition(() => router.refresh())
        return
      }

      const paid = formatRupiah(body.earning?.net ?? 0)
      setStates((current) => ({
        ...current,
        [submissionId]: {
          kind: 'done',
          message: action === 'approve' ? `Paid ${paid}` : 'Rejected',
        },
      }))
      toast(
        'success',
        action === 'approve'
          ? `Approved. Paid ${paid} to the creator.`
          : 'Submission rejected. Nothing was paid.',
      )
      startTransition(() => router.refresh())
    } catch {
      setStates((current) => ({ ...current, [submissionId]: IDLE }))
      toast('error', 'Network error — nothing was changed.')
    }
  }

  const confirmingSubmission = find(confirming?.submissionId)
  const confirmingState = confirming ? states[confirming.submissionId] : undefined

  return (
    <>
      <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            <tr>
              <Th>Creator</Th>
              <Th>Campaign</Th>
              <Th>Platform</Th>
              <Th className="text-right">Views</Th>
              <Th className="text-right">Amount to pay</Th>
              <Th className="text-right">Remaining budget</Th>
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
                onReview={(submissionId, action) =>
                  setConfirming({ submissionId, action })
                }
                onOpenDetail={setDetailId}
                disabled={isRefreshing}
              />
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmReviewDialog
        submission={confirmingSubmission}
        action={confirming?.action ?? 'approve'}
        pending={confirmingState?.kind === 'sending'}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (!confirming) return
          const target = confirming
          setConfirming(null)
          void review(target)
        }}
      />

      <SubmissionDetailDialog
        submission={find(detailId ?? undefined)}
        onClose={() => setDetailId(null)}
      />

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}

const IDLE: RowState = { kind: 'idle' }
