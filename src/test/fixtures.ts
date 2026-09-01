/**
 * Test-only helpers. The behaviour tests run against the real Postgres from
 * docker-compose: the parts being graded are row locks and transaction
 * boundaries, and a mocked driver would test neither.
 *
 * Every fixture creates its own creator, campaign and submissions and removes
 * them afterwards, so nothing depends on — or damages — the seed data.
 */
import { eq, inArray } from 'drizzle-orm'

import { db } from '@/db/client'
import { campaigns, creators, earnings, submissions } from '@/db/schema'
import type { SubmissionStatus } from '@/db/schema'

let unique = 0
const runId = `test_${process.pid}`

export type Fixture = {
  creatorId: number
  campaignId: number
  submissionIds: number[]
  username: string
}

export async function seedFixture(options: {
  cpm: number
  remainingBudget: number
  /** One entry per submission. */
  subs: Array<{ views: number; status?: SubmissionStatus }>
  campaignStatus?: 'active' | 'paused' | 'closed'
  /**
   * Overrides the generated username, so a test can create a creator whose name
   * has another fixture's name as a prefix. Must still be unique.
   */
  username?: string
}): Promise<Fixture> {
  const username = options.username ?? `${runId}_${unique++}`

  const [creator] = await db
    .insert(creators)
    .values({ username, email: `${username}@example.test`, createdAt: new Date() })
    .returning({ id: creators.id })

  const [campaign] = await db
    .insert(campaigns)
    .values({
      title: `fixture ${username}`,
      brand: 'Fixture',
      cpm: options.cpm,
      totalBudget: options.remainingBudget,
      remainingBudget: options.remainingBudget,
      status: options.campaignStatus ?? 'active',
      createdAt: new Date(),
    })
    .returning({ id: campaigns.id })

  const inserted = await db
    .insert(submissions)
    .values(
      options.subs.map((sub, i) => ({
        creatorId: creator.id,
        campaignId: campaign.id,
        platform: 'tiktok' as const,
        videoUrl: `https://example.test/${username}/${i}`,
        views: sub.views,
        status: sub.status ?? ('pending' as const),
        // Descending, so index 0 is the newest and ordering is predictable.
        submittedAt: new Date(Date.UTC(2030, 0, 1) - i * 60_000),
        reviewedAt: sub.status && sub.status !== 'pending' ? new Date() : null,
      })),
    )
    .returning({ id: submissions.id })

  return {
    creatorId: creator.id,
    campaignId: campaign.id,
    submissionIds: inserted.map((row) => row.id),
    username,
  }
}

export async function dropFixture(fixture: Fixture): Promise<void> {
  await db.delete(earnings).where(inArray(earnings.submissionId, fixture.submissionIds))
  await db.delete(submissions).where(inArray(submissions.id, fixture.submissionIds))
  await db.delete(campaigns).where(eq(campaigns.id, fixture.campaignId))
  await db.delete(creators).where(eq(creators.id, fixture.creatorId))
}

export async function remainingBudget(campaignId: number): Promise<number> {
  const [row] = await db
    .select({ remainingBudget: campaigns.remainingBudget })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
  return row.remainingBudget
}

export async function earningsFor(submissionId: number) {
  return db.select().from(earnings).where(eq(earnings.submissionId, submissionId))
}

export async function statusOf(submissionId: number): Promise<SubmissionStatus> {
  const [row] = await db
    .select({ status: submissions.status })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
  return row.status
}
