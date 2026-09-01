import { campaignSummary } from '@/lib/campaigns/summary'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isSafeInteger(id) || id < 1) {
    return Response.json({ error: 'id must be an integer >= 1' }, { status: 400 })
  }

  const summary = await campaignSummary(id)
  if (!summary) {
    return Response.json({ error: 'Campaign not found.' }, { status: 404 })
  }

  return Response.json(summary)
}
