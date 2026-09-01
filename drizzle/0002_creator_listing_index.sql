-- The creator filter now sends an exact creator_id once a name is picked from
-- the typeahead, so the listing gained a third equality filter. schema.sql ships
-- no index on submissions.creator_id at all — without this, filtering by one
-- creator sequentially scans all 50 000 rows to find its ~25.
--
-- Same shape as the campaign composite: the equality columns first, then the
-- ordering, so one index scan answers the filter and the sort together.
create index if not exists submissions_creator_status_submitted_at_id_idx
  on submissions (creator_id, status, submitted_at desc, id desc);
--> statement-breakpoint

analyze submissions;
