import { afterEach, describe, expect, it } from 'vitest'

import { dropFixture, seedFixture, type Fixture } from '@/test/fixtures'

import { listSubmissions } from './list'

const fixtures: Fixture[] = []
const seed = async (...args: Parameters<typeof seedFixture>) => {
  const fixture = await seedFixture(...args)
  fixtures.push(fixture)
  return fixture
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(dropFixture))
})

/** Fixtures are dated 2030 so they sort ahead of the seed's 120-day window. */
const sixPending = () =>
  seed({
    cpm: 1500,
    remainingBudget: 1_000_000,
    subs: [
      { views: 10 },
      { views: 20 },
      { views: 30 },
      { views: 40, status: 'approved' },
      { views: 50, status: 'rejected' },
      { views: 60 },
    ],
  })

describe('listSubmissions', () => {
  it('filters by campaign and returns the exact total, not the page length', async () => {
    const { campaignId } = await sixPending()

    const { rows, total } = await listSubmissions({ page: 1, per: 2, campaignId })

    expect(total).toBe(6)
    expect(rows).toHaveLength(2)
  })

  it('combines a status and campaign filter', async () => {
    const { campaignId } = await sixPending()

    const pending = await listSubmissions({ page: 1, per: 20, campaignId, status: 'pending' })
    expect(pending.total).toBe(4)
    expect(pending.rows.every((row) => row.status === 'pending')).toBe(true)

    const approved = await listSubmissions({ page: 1, per: 20, campaignId, status: 'approved' })
    expect(approved.total).toBe(1)
  })

  it('paginates without overlapping or skipping rows', async () => {
    const { campaignId, submissionIds } = await sixPending()

    const pages = await Promise.all(
      [1, 2, 3, 4].map((page) => listSubmissions({ page, per: 2, campaignId })),
    )
    const seen = pages.flatMap((p) => p.rows.map((r) => r.id))

    // submittedAt descends with fixture index, so the order is the insert order.
    expect(seen).toEqual(submissionIds)
    expect(pages[3].rows).toEqual([])
    expect(pages[3].total).toBe(6)
  })

  it('joins creator and campaign in the same statement', async () => {
    const { campaignId, username } = await sixPending()

    const { rows } = await listSubmissions({ page: 1, per: 1, campaignId })

    expect(rows[0]).toMatchObject({
      creatorUsername: username,
      campaignId,
      campaignBrand: 'Fixture',
      campaignCpm: 1500,
      campaignStatus: 'active',
      campaignTotalBudget: 1_000_000,
      campaignRemainingBudget: 1_000_000,
    })
    expect(rows[0].campaignTitle).toContain('fixture')
    expect(rows[0].videoUrl).toContain('https://example.test/')
    expect(rows[0].submittedAt).toBeInstanceOf(Date)
    // Pending rows carry no review timestamp; the detail dialog relies on it.
    expect(rows[0].reviewedAt).toBeNull()
  })

  it('searches creator usernames anywhere in the name, not just the start', async () => {
    const { username, campaignId } = await sixPending()

    const byPrefix = await listSubmissions({ page: 1, per: 20, q: username.slice(0, 10) })
    expect(byPrefix.rows.some((row) => row.campaignId === campaignId)).toBe(true)

    // The distinguishing case: a fragment from the middle of the username.
    const byMiddle = await listSubmissions({ page: 1, per: 20, q: username.slice(4, 12) })
    expect(byMiddle.rows.some((row) => row.campaignId === campaignId)).toBe(true)

    const miss = await listSubmissions({ page: 1, per: 20, q: `zz${username}` })
    expect(miss.total).toBe(0)
  })

  it('treats LIKE wildcards in the search term as literal characters', async () => {
    await sixPending()

    // '%' would match every creator if it reached LIKE unescaped.
    const { total } = await listSubmissions({ page: 1, per: 20, q: '%' })
    expect(total).toBe(0)
  })

  it('counts with the search applied, not just the page', async () => {
    const { username } = await sixPending()

    const { total, rows } = await listSubmissions({ page: 1, per: 3, q: username })
    expect(total).toBe(6)
    expect(rows).toHaveLength(3)
  })
})
