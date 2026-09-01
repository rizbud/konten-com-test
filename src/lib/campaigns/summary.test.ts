import { afterEach, describe, expect, it } from 'vitest'

import { approveSubmission } from '@/lib/submissions/approve'
import { dropFixture, seedFixture, type Fixture } from '@/test/fixtures'

import { campaignSummary } from './summary'

const fixtures: Fixture[] = []

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(dropFixture))
})

describe('campaignSummary', () => {
  it('counts this campaign only, and adds up what it actually paid', async () => {
    const fixture = await seedFixture({
      cpm: 1500,
      remainingBudget: 1_000_000,
      subs: [
        { views: 12_345 },
        { views: 12_345 },
        { views: 10_000, status: 'rejected' },
        // A legacy approval: approved, but with no earning row behind it.
        { views: 10_000, status: 'approved' },
      ],
    })
    fixtures.push(fixture)

    await approveSubmission(fixture.submissionIds[0])

    const summary = await campaignSummary(fixture.campaignId)

    expect(summary).toMatchObject({
      campaignId: fixture.campaignId,
      cpm: 1500,
      // 4 submissions, not the whole table and not one row per earning.
      submissionCount: 4,
      approvedCount: 2,
      pendingCount: 1,
      // Only the approval this system made produced an earning.
      grossPaid: 18_517,
      netPaid: 14_813,
      feeCollected: 3_704,
      remainingBudget: 1_000_000 - 18_517,
    })
  })

  it('returns null for a campaign that does not exist', async () => {
    expect(await campaignSummary(2_147_483_000)).toBeNull()
  })
})
