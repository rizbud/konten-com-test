'use client'

import { CLICKABLE } from './ui'

export type Toast = {
  id: number
  tone: 'success' | 'error'
  message: string
}

/**
 * Presentational. The producer owns the list and schedules each toast's
 * dismissal, because it is the one that knows when a call finished — a timer in
 * here would be an effect calling back into the caller's state for no gain.
 */
export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: number) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-3 rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.tone === 'error' ? 'bg-red-700' : 'bg-emerald-700'
          }`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss"
            className={`text-lg leading-none opacity-80 hover:opacity-100 ${CLICKABLE}`}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}
