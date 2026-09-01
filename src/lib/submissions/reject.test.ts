import { afterEach, describe, expect, it } from 'vitest'

import {
  dropFixture,
  earningsFor,
  remainingBudget,
  seedFixture,
  statusOf,
  type Fixture,
} from '@/test/fixtures'

import { approveSubmission } from './approve'
import { rejectSubmission } from './reject'

const fixtures: Fixture[] = []
const seed = async (...args: Parameters<typeof seedFixture>) => {
  const fixture = await seedFixture(...args)
  fixtures.push(fixture)
  return fixture
}

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(dropFixture))
})

describe('rejectSubmission', () => {
  it('rejects a pending submission without touching money', async () => {
    const { campaignId, submissionIds } = await seed({
      cpm: 1500,
      remainingBudget: 1_000_000,
      subs: [{ views: 12_345 }],
    })
    const [id] = submissionIds

    expect(await rejectSubmission(id)).toEqual({ ok: true })
    expect(await statusOf(id)).toBe('rejected')
    expect(await remainingBudget(campaignId)).toBe(1_000_000)
    expect(await earningsFor(id)).toHaveLength(0)
  })

  it('clears a zero-earning submission, which approval cannot', async () => {
    const { submissionIds } = await seed({
      cpm: 900,
      remainingBudget: 1_000_000,
      subs: [{ views: 1 }],
    })
    const [id] = submissionIds

    expect(await approveSubmission(id)).toEqual({ ok: false, reason: 'zero_earning' })
    expect(await rejectSubmission(id)).toEqual({ ok: true })
    expect(await statusOf(id)).toBe('rejected')
  })

  it('takes effect once when ten admins reject at the same time', async () => {
    const { submissionIds } = await seed({
      cpm: 1500,
      remainingBudget: 1_000_000,
      subs: [{ views: 12_345 }],
    })
    const [id] = submissionIds

    const results = await Promise.all(
      Array.from({ length: 10 }, () => rejectSubmission(id)),
    )

    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(results.filter((r) => !r.ok && r.reason === 'already_reviewed')).toHaveLength(9)
  })

  it('cannot reject an approved submission out from under its earning', async () => {
    const { campaignId, submissionIds } = await seed({
      cpm: 1500,
      remainingBudget: 1_000_000,
      subs: [{ views: 12_345 }],
    })
    const [id] = submissionIds

    expect(await approveSubmission(id)).toMatchObject({ ok: true })
    expect(await rejectSubmission(id)).toEqual({ ok: false, reason: 'already_reviewed' })
    expect(await statusOf(id)).toBe('approved')
    expect(await earningsFor(id)).toHaveLength(1)
    expect(await remainingBudget(campaignId)).toBe(1_000_000 - 18_517)
  })

  it('races against an approval without both landing', async () => {
    const { campaignId, submissionIds } = await seed({
      cpm: 1500,
      remainingBudget: 1_000_000,
      subs: [{ views: 12_345 }],
    })
    const [id] = submissionIds

    const [approved, rejected] = await Promise.all([
      approveSubmission(id),
      rejectSubmission(id),
    ])

    expect([approved.ok, rejected.ok].filter(Boolean)).toHaveLength(1)
    // Whichever won, the books agree with the row: paid means one earning and a
    // smaller budget, rejected means neither.
    const paid = approved.ok
    expect(await statusOf(id)).toBe(paid ? 'approved' : 'rejected')
    expect(await earningsFor(id)).toHaveLength(paid ? 1 : 0)
    expect(await remainingBudget(campaignId)).toBe(paid ? 1_000_000 - 18_517 : 1_000_000)
  })

  it('lets the reject through when the racing approve rolls back on budget', async () => {
    // The interesting interleaving: approve claims the row first, so reject
    // blocks on its lock — then approve fails the budget check and rolls back,
    // releasing a row that is still pending. The reject re-evaluates and wins.
    // Which of the two grabs the lock first is not deterministic, but the end
    // state is: an approve that cannot pay never wins either way.
    const { campaignId, submissionIds } = await seed({
      cpm: 1500,
      remainingBudget: 100,
      subs: [{ views: 12_345 }],
    })
    const [id] = submissionIds

    const [approved, rejected] = await Promise.all([
      approveSubmission(id),
      rejectSubmission(id),
    ])

    expect(approved.ok).toBe(false)
    expect(rejected).toEqual({ ok: true })
    expect(await statusOf(id)).toBe('rejected')
    expect(await earningsFor(id)).toHaveLength(0)
    expect(await remainingBudget(campaignId)).toBe(100)
  })

  it('holds the invariant over repeated approve/reject races', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { campaignId, submissionIds } = await seed({
        cpm: 1500,
        remainingBudget: 1_000_000,
        subs: [{ views: 12_345 }],
      })
      const [id] = submissionIds

      const [approved, rejected] = await Promise.all([
        approveSubmission(id),
        rejectSubmission(id),
      ])

      // Exactly one decision lands, and the row always agrees with the books.
      expect([approved.ok, rejected.ok].filter(Boolean)).toHaveLength(1)
      const paid = approved.ok
      expect(await statusOf(id)).toBe(paid ? 'approved' : 'rejected')
      expect(await earningsFor(id)).toHaveLength(paid ? 1 : 0)
      expect(await remainingBudget(campaignId)).toBe(
        paid ? 1_000_000 - 18_517 : 1_000_000,
      )
    }
  })

  it('reports a submission that does not exist', async () => {
    expect(await rejectSubmission(2_147_483_000)).toEqual({
      ok: false,
      reason: 'not_found',
    })
  })
})
