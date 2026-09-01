-- Creator search became a substring match (`%creator_12%`), which a b-tree
-- cannot serve at all: a leading wildcard has no prefix to seek on. pg_trgm
-- indexes the three-character shingles of the value instead, so `like '%...%'`
-- becomes an index lookup rather than a scan of every creator.
--
-- Applied by hand, after 0001:
--   docker compose exec -T db psql -U clippay -d clippay -f - < migrations/0002_username_trigram.sql

create extension if not exists pg_trgm;

-- lower(username), matching the query, so the expression is indexable as written.
create index if not exists creators_username_trgm_idx
  on creators using gin (lower(username) gin_trgm_ops);

-- Superseded: text_pattern_ops only helps a prefix pattern.
drop index if exists creators_lower_username_idx;

analyze creators;
