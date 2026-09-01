import type { NextRequest } from 'next/server'

import {
  DEFAULT_CREATOR_MATCHES,
  MAX_CREATOR_MATCHES,
  searchCreators,
} from '@/lib/creators/search'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const rawLimit = params.get('limit')?.trim()
  const limit = rawLimit ? Number(rawLimit) : DEFAULT_CREATOR_MATCHES
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_CREATOR_MATCHES) {
    return Response.json(
      { error: `limit must be an integer between 1 and ${MAX_CREATOR_MATCHES}` },
      { status: 400 },
    )
  }

  const data = await searchCreators(params.get('q') ?? '', limit)

  return Response.json({ data })
}
