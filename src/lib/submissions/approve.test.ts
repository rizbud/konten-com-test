import { afterEach, describe, expect, it } from 'vitest'

import { calculateEarning } from '@/lib/money'
import {
  dropFixture,
  earningsFor,
  remainingBudget,
  seedFixture,
  statusOf,
  type Fixture,
} from '@/test/fixtures'

import { approveSubmission } from './approve'

const fixtures: Fixture[] = []
const seed = async (...args: Parameters<typeof seedFixture>) => {
  const fixture = await seedFixture(...args)
  fixtures.push(fixture)
  return fixture
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(dropFixture))
})

describe('approveSubmission', () => {
  it('pays once, decrements the budget by gross, and records the view snapshot', async () => {
    const { campaignId, submissionIds, creatorId } = await seed({
      cpm: 1500,
      remainingBudget: 1_000_000,
      subs: [{ views: 12_345 }],
    })
    const [id] = submissionIds

    const result = await approveSubmission(id)

    expect(result).toEqual({
      ok: true,
      earning: { gross: 18_517, fee: 3_704, net: 14_813, submissionId: id, viewsAtApproval: 12_345 },
    })
    expect(await statusOf(id)).toBe('approved')
    expect(await remainingBudget(campaignId)).toBe(1_000_000 - 18_517)

    const [earning] = await earningsFor(id)
    expect(earning).toMatchObject({
      creatorId,
      campaignId,
      grossAmount: 18_517,
      feeAmount: 3_704,
      netAmount: 14_813,
      viewsAtApproval: 12_345,
    })
  })

  it('pays exactly once when ten admins approve the same submission at once', async () => {
    const { campaignId, submissionIds } = await seed({
      cpm: 2000,
      remainingBudget: 5_000_000,
      subs: [{ views: 50_000 }],
    })
    const [id] = submissionIds
    const { gross } = calculateEarning(50_000, 2000)

    const results = await Promise.all(
      Array.from({ length: 10 }, () => approveSubmission(id)),
    )

    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect(results.filter((r) => !r.ok && r.reason === 'already_reviewed')).toHaveLength(9)
    expect(await earningsFor(id)).toHaveLength(1)
    expect(await remainingBudget(campaignId)).toBe(5_000_000 - gross)
  })

  it('lets concurrent approvals share a budget without overspending it', async () => {
    // cpm 1000, 10 000 views each -> gross 10 000. Budget covers exactly three.
    const { campaignId, submissionIds } = await seed({
      cpm: 1000,
      remainingBudget: 30_000,
      subs: Array.from({ length: 8 }, () => ({ views: 10_000 })),
    })

    const results = await Promise.all(submissionIds.map((id) => approveSubmission(id)))

    expect(results.filter((r) => r.ok)).toHaveLength(3)
    expect(results.filter((r) => !r.ok && r.reason === 'insufficient_budget')).toHaveLength(5)
    expect(await remainingBudget(campaignId)).toBe(0)
    // The five that could not be paid are still pending, and paid nothing.
    const statuses = await Promise.all(submissionIds.map(statusOf))
    expect(statuses.filter((s) => s === 'approved')).toHaveLength(3)
    expect(statuses.filter((s) => s === 'pending')).toHaveLength(5)
  })

  it('approves when gross is exactly the remaining budget', async () => {
    const { campaignId, submissionIds } = await seed({
      cpm: 1000,
      remainingBudget: 12_000,
      subs: [{ views: 12_000 }],
    })

    expect(await approveSubmission(submissionIds[0])).toMatchObject({ ok: true })
    expect(await remainingBudget(campaignId)).toBe(0)
  })

  it('refuses when gross is one rupiah over the remaining budget, changing nothing', async () => {
    const { campaignId, submissionIds } = await seed({
      cpm: 1000,
      remainingBudget: 11_999,
      subs: [{ views: 12_000 }],
    })
    const [id] = submissionIds

    expect(await approveSubmission(id)).toEqual({ ok: false, reason: 'insufficient_budget' })
    expect(await statusOf(id)).toBe('pending')
    expect(await remainingBudget(campaignId)).toBe(11_999)
    expect(await earningsFor(id)).toHaveLength(0)
  })

  it('refuses a submission worth zero rupiah and leaves it pending — ADR-0002', async () => {
    const { campaignId, submissionIds } = await seed({
      cpm: 900,
      remainingBudget: 1_000_000,
      subs: [{ views: 1 }],
    })
    const [id] = submissionIds

    expect(await approveSubmission(id)).toEqual({ ok: false, reason: 'zero_earning' })
    expect(await statusOf(id)).toBe('pending')
    expect(await remainingBudget(campaignId)).toBe(1_000_000)
    expect(await earningsFor(id)).toHaveLength(0)
  })

  it('approves on a paused or closed campaign — budget is the only gate, ADR-0001', async () => {
    for (const campaignStatus of ['paused', 'closed'] as const) {
      const { submissionIds } = await seed({
        cpm: 1500,
        remainingBudget: 1_000_000,
        campaignStatus,
        subs: [{ views: 10_000 }],
      })
      expect(await approveSubmission(submissionIds[0])).toMatchObject({ ok: true })
    }
  })

  it('reports an already-reviewed submission without paying again', async () => {
    const { submissionIds } = await seed({
      cpm: 1500,
      remainingBudget: 1_000_000,
      subs: [{ views: 10_000, status: 'approved' }, { views: 10_000, status: 'rejected' }],
    })

    for (const id of submissionIds) {
      expect(await approveSubmission(id)).toEqual({ ok: false, reason: 'already_reviewed' })
      expect(await earningsFor(id)).toHaveLength(0)
    }
  })

  it('reports a submission that does not exist', async () => {
    expect(await approveSubmission(2_147_483_000)).toEqual({ ok: false, reason: 'not_found' })
  })
})
