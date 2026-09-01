import { describe, expect, it } from 'vitest'

import { DEFAULT_PER_PAGE, MAX_PER_PAGE, parseListParams } from './params'

const parse = (query: string) => parseListParams(new URLSearchParams(query))

describe('parseListParams', () => {
  it('defaults page and per, and does not default status', () => {
    expect(parse('')).toEqual({
      ok: true,
      params: { page: 1, per: DEFAULT_PER_PAGE, status: undefined, campaignId: undefined, q: undefined },
    })
  })

  it('reads every filter', () => {
    expect(parse('page=3&per=50&status=approved&campaignId=4&q=Creator_12')).toEqual({
      ok: true,
      params: { page: 3, per: 50, status: 'approved', campaignId: 4, q: 'creator_12' },
    })
  })

  it('treats blank values as absent', () => {
    expect(parse('page=&status=&campaignId=&q=  ')).toMatchObject({
      ok: true,
      params: { page: 1, status: undefined, campaignId: undefined, q: undefined },
    })
  })

  it.each([
    'page=0',
    'page=-1',
    'page=1.5',
    'page=12abc',
    'page=abc',
    'per=0',
    `per=${MAX_PER_PAGE + 1}`,
    'status=paid',
    'campaignId=0',
    'campaignId=x',
  ])('rejects %s', (query) => {
    expect(parse(query).ok).toBe(false)
  })

  it('reports every problem at once', () => {
    const result = parse('page=0&status=paid')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors).toHaveLength(2)
  })
})
