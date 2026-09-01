---
name: submissions-query
description: Query and pagination rules for the ClipPay submissions list and campaign summary. Use when writing GET /api/submissions, the /review page data flow, campaign summary aggregates, or adding indexes.
---

# Submissions list & aggregates

50.000 rows now, far more in production. Everything below is graded.

## Rules

- Paginate in the database: `limit`/`offset` from validated `page`/`per`
  (`per` capped, e.g. max 100). Never fetch-then-slice.
- One query for the page, one `count(*)` for total, filters shared between them.
  Build the where-clause once and reuse it (drizzle `and(...)` over an array of
  conditions, `.$dynamic()` if needed).
- No N+1: join `creators` and `campaigns` in the same statement, select only the
  columns the table renders (username, campaign title, platform, views, status,
  submitted_at).
- Username search is a **substring** match — `%creator_1%`, so a fragment from
  the middle of a username finds it. A leading `%` cannot use a b-tree, so the
  index behind it is `creators using gin (lower(username) gin_trgm_ops)`
  (`pg_trgm`), and the predicate must be written `lower(username) like ?` to
  match that expression — `ilike` cannot use it. Escape the user's own `%`, `_`
  and `\` so a search for `%` matches nothing rather than everything.
- Deterministic order: `submitted_at desc, id desc`. Without the tiebreak,
  pages overlap.
- Indexes you add: state them in the README with the query they serve. A
  composite `submissions (status, submitted_at desc)` beats the two separate
  single-column indexes for the default filtered listing.
- Validate query params (zod or a small parser) at the route boundary. Bad input
  → 400, not a 500 from the driver.

## Campaign summary (B3)

Single round trip. One statement with aggregates over `submissions` +
`earnings` for that campaign (`count(*)`, `count(*) filter (where status='approved')`,
`sum(net_amount)`) plus `remaining_budget`. Not four separate queries.

## Server/client split

`/review` page is a server component that reads searchParams and does the initial
fetch; the interactive bits (filters, approve button, pending state) are a client
component. Keep filter state in the URL so it survives reload and is shareable.
