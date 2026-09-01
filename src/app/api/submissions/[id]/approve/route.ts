import { approveSubmission, type ApproveFailure } from '@/lib/submissions/approve'

const STATUS: Record<ApproveFailure, number> = {
  not_found: 404,
  already_reviewed: 409,
  zero_earning: 422,
  insufficient_budget: 422,
}

const MESSAGE: Record<ApproveFailure, string> = {
  not_found: 'Submission not found.',
  already_reviewed: 'This submission has already been reviewed.',
  zero_earning: 'Views are too low to earn a single rupiah.',
  insufficient_budget: 'The campaign does not have enough remaining budget.',
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isSafeInteger(id) || id < 1) {
    return Response.json({ error: 'id must be an integer >= 1' }, { status: 400 })
  }

  const result = await approveSubmission(id)
  if (!result.ok) {
    return Response.json(
      { error: MESSAGE[result.reason], reason: result.reason },
      { status: STATUS[result.reason] },
    )
  }

  return Response.json({ earning: result.earning })
}
