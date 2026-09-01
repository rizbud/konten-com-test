import { rejectSubmission, type RejectFailure } from '@/lib/submissions/reject'

const STATUS: Record<RejectFailure, number> = {
  not_found: 404,
  already_reviewed: 409,
}

const MESSAGE: Record<RejectFailure, string> = {
  not_found: 'Submission not found.',
  already_reviewed: 'This submission has already been reviewed.',
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

  const result = await rejectSubmission(id)
  if (!result.ok) {
    return Response.json(
      { error: MESSAGE[result.reason], reason: result.reason },
      { status: STATUS[result.reason] },
    )
  }

  return Response.json({ status: 'rejected' })
}
