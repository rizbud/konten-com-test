-- Custom migration: hand-written, because the tables it indexes are given by
-- schema.sql and are not ours to generate. See drizzle.config.ts.

-- Default listing: filter on status, order by submitted_at desc, id desc.
-- Serves the page and its count(*) from one index, no sort.
create index if not exists submissions_status_submitted_at_id_idx
  on submissions (status, submitted_at desc, id desc);
--> statement-breakpoint

-- Same listing with a campaign filter. campaign_id leads because it is the more
-- selective of the two (8 campaigns vs 3 statuses).
create index if not exists submissions_campaign_status_submitted_at_id_idx
  on submissions (campaign_id, status, submitted_at desc, id desc);
--> statement-breakpoint

-- Second, DB-level double-pay guard behind the approve transaction's
-- conditional UPDATE. It is real money; app-level guards alone are not enough.
create unique index if not exists earnings_submission_id_key
  on earnings (submission_id);
--> statement-breakpoint

-- Redundant now: both are leading-column prefixes of the composites above.
drop index if exists submissions_status_idx;
--> statement-breakpoint
drop index if exists submissions_campaign_id_idx;
--> statement-breakpoint

analyze submissions;
--> statement-breakpoint
analyze earnings;
