/**
 * Models the tables in schema.sql. Nothing here creates or alters a table —
 * drizzle-kit is deliberately not installed.
 *
 * Money columns are `bigint` in Postgres and read here as `mode: 'number'`,
 * which is exact up to 2^53 rupiah. Rupiah amounts that large are not a
 * business case; the alternative (`mode: 'bigint'`) would push BigInt through
 * every calculation and JSON boundary for no gain.
 */
import {
  bigint,
  bigserial,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const creators = pgTable('creators', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  username: text().notNull(),
  email: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull(),
})

export type CampaignStatus = 'active' | 'paused' | 'closed'

export const campaigns = pgTable('campaigns', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  title: text().notNull(),
  brand: text().notNull(),
  /** Rupiah paid per 1000 views. */
  cpm: integer().notNull(),
  totalBudget: bigint({ mode: 'number' }).notNull(),
  remainingBudget: bigint({ mode: 'number' }).notNull(),
  status: text().$type<CampaignStatus>().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull(),
})

export const SUBMISSION_STATUSES = ['pending', 'approved', 'rejected'] as const
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

export const submissions = pgTable(
  'submissions',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    creatorId: bigint({ mode: 'number' }).notNull(),
    campaignId: bigint({ mode: 'number' }).notNull(),
    platform: text().$type<'tiktok' | 'instagram' | 'youtube'>().notNull(),
    videoUrl: text().notNull(),
    views: integer().notNull(),
    status: text().$type<SubmissionStatus>().notNull(),
    submittedAt: timestamp({ withTimezone: true }).notNull(),
    reviewedAt: timestamp({ withTimezone: true }),
  },
  // Declared so the listing query's index usage is visible from the model.
  // Created by migrations/0001_indexes.sql, not by drizzle.
  (t) => [
    index('submissions_status_submitted_at_id_idx').on(
      t.status,
      t.submittedAt.desc(),
      t.id.desc(),
    ),
    index('submissions_campaign_status_submitted_at_id_idx').on(
      t.campaignId,
      t.status,
      t.submittedAt.desc(),
      t.id.desc(),
    ),
  ],
)

export const earnings = pgTable('earnings', {
  id: bigserial({ mode: 'number' }).primaryKey(),
  submissionId: bigint({ mode: 'number' }).notNull(),
  creatorId: bigint({ mode: 'number' }).notNull(),
  campaignId: bigint({ mode: 'number' }).notNull(),
  grossAmount: bigint({ mode: 'number' }).notNull(),
  feeAmount: bigint({ mode: 'number' }).notNull(),
  netAmount: bigint({ mode: 'number' }).notNull(),
  viewsAtApproval: integer().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull(),
})
