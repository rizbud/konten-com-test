import { SUBMISSION_STATUSES, type SubmissionStatus } from '@/db/schema'

/** Cap on rows per page, so a client cannot ask for all 50 000 at once. */
export const MAX_PER_PAGE = 100
export const DEFAULT_PER_PAGE = 20

export type ListParams = {
  page: number
  per: number
  status?: SubmissionStatus
  campaignId?: number
  /** Creator username prefix, already trimmed and lowercased. */
  q?: string
}

export type ParseResult =
  | { ok: true; params: ListParams }
  | { ok: false; errors: string[] }

/**
 * Hand-rolled rather than zod: five params, and this keeps the dependency list
 * to what the app actually needs. `status` has no default — the /review page
 * supplies `pending` itself, so the API stays a faithful view of the table.
 *
 * All problems are reported at once; a client fixing one param at a time is a
 * worse experience than seeing both mistakes in the first 400.
 */
export function parseListParams(input: URLSearchParams): ParseResult {
  const errors: string[] = []

  const integer = (name: string, min: number, max?: number) => {
    const raw = input.get(name)?.trim()
    if (!raw) return undefined
    // Number, not parseInt: '12abc' must be rejected, not silently read as 12.
    const value = Number(raw)
    if (!Number.isSafeInteger(value) || value < min || (max !== undefined && value > max)) {
      errors.push(
        max === undefined
          ? `${name} must be an integer >= ${min}`
          : `${name} must be an integer between ${min} and ${max}`,
      )
      return undefined
    }
    return value
  }

  const page = integer('page', 1)
  const per = integer('per', 1, MAX_PER_PAGE)
  const campaignId = integer('campaignId', 1)

  const rawStatus = input.get('status')?.trim()
  let status: SubmissionStatus | undefined
  if (rawStatus) {
    if (isSubmissionStatus(rawStatus)) status = rawStatus
    else errors.push(`status must be one of ${SUBMISSION_STATUSES.join(', ')}`)
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    params: {
      page: page ?? 1,
      per: per ?? DEFAULT_PER_PAGE,
      status,
      campaignId,
      q: input.get('q')?.trim().toLowerCase() || undefined,
    },
  }
}

function isSubmissionStatus(value: string): value is SubmissionStatus {
  return (SUBMISSION_STATUSES as readonly string[]).includes(value)
}
