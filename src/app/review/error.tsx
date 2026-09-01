'use client'

/**
 * Catches what the query layer cannot report as a filter problem — the database
 * being unreachable, mainly. Nothing is retried automatically: an admin should
 * see plainly that the list did not load rather than a table that half-renders.
 */
export default function ReviewError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Review submissions</h1>
      <div className="mt-6 rounded-lg border border-red-200 p-8 text-center dark:border-red-900">
        <p className="font-medium text-red-700 dark:text-red-400">
          Could not load submissions.
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          The database did not answer. Nothing was approved.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 h-9 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
