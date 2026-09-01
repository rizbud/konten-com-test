-- Applied by hand:
--   docker compose exec -T db psql -U clippay -d clippay -f - < migrations/0001_indexes.sql
--
-- No drizzle-kit in this project: the tables in schema.sql are given, and a
-- generated migration would try to recreate them. Indexes are the only DDL we
-- add, so they stay reviewable SQL.

-- Default listing: filter on status, order by submitted_at desc, id desc.
-- Serves the page and its count(*) from one index, no sort.
create index if not exists submissions_status_submitted_at_id_idx
  on submissions (status, submitted_at desc, id desc);

-- Same listing with a campaign filter. campaign_id leads because it is the
-- more selective of the two (8 campaigns vs 3 statuses).
create index if not exists submissions_campaign_status_submitted_at_id_idx
  on submissions (campaign_id, status, submitted_at desc, id desc);

-- Second, DB-level double-pay guard behind the approve transaction's
-- conditional UPDATE. It is real money; app-level guards alone are not enough.
create unique index if not exists earnings_submission_id_key
  on earnings (submission_id);

-- Prefix search on creator username: `lower(username) like 'creator_1%'`.
-- text_pattern_ops is what makes a LIKE prefix indexable in a non-C collation.
create index if not exists creators_lower_username_idx
  on creators (lower(username) text_pattern_ops);

-- Redundant now: both are leading-column prefixes of the composites above.
drop index if exists submissions_status_idx;
drop index if exists submissions_campaign_id_idx;

analyze submissions;
analyze creators;
analyze earnings;
