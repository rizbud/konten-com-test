import type { NextRequest } from 'next/server'

import { listSubmissions } from '@/lib/submissions/list'
import { parseListParams } from '@/lib/submissions/params'

// Thin on purpose: validate, delegate, serialise. The query itself is shared
// with the /review page — see docs/adr/0003.
export async function GET(request: NextRequest) {
  const parsed = parseListParams(request.nextUrl.searchParams)
  if (!parsed.ok) {
    return Response.json({ errors: parsed.errors }, { status: 400 })
  }

  const { rows, total, page, per } = await listSubmissions(parsed.params)

  return Response.json({
    data: rows,
    total,
    page,
    per,
    pageCount: Math.ceil(total / per),
  })
}
