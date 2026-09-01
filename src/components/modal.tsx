'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import { CLICKABLE, MUTED } from './ui'

/**
 * Wraps the native `<dialog>`: it already does the focus trap, the backdrop, the
 * top layer and Escape-to-close, none of which is worth reimplementing or
 * installing a library for. `onClose` is wired to the element's own close event,
 * so Escape and a backdrop click keep the caller's state in step.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // The dialog element itself is the backdrop area; the panel inside is not.
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-lg bg-white p-0 text-zinc-900 shadow-xl backdrop:bg-black/60 dark:bg-zinc-900 dark:text-zinc-50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`-mr-1 -mt-1 rounded px-2 text-lg leading-none hover:bg-zinc-100 dark:hover:bg-zinc-800 ${MUTED} ${CLICKABLE}`}
        >
          &times;
        </button>
      </div>

      <div className="px-5 py-4 text-sm">{children}</div>

      {footer ? (
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          {footer}
        </div>
      ) : null}
    </dialog>
  )
}
