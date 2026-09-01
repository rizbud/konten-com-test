-- Creator search is a substring match (`%creator_12%`), which a b-tree cannot
-- serve at all: a leading wildcard has no prefix to seek on. pg_trgm indexes the
-- three-character shingles of the value instead, so `like '%...%'` becomes an
-- index lookup rather than a scan of every creator.

create extension if not exists pg_trgm;
--> statement-breakpoint

-- lower(username), matching the query, so the expression is indexable as written.
create index if not exists creators_username_trgm_idx
  on creators using gin (lower(username) gin_trgm_ops);
--> statement-breakpoint

analyze creators;
