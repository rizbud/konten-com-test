# Build plan

Ordered so each step is a commit that leaves the tree green. Decisions are
already settled in [CONTEXT.md](CONTEXT.md) and [docs/adr/](docs/adr/) — this is
sequencing, not design.

Money and concurrency come before UI: they are the two heaviest grading rows, and
the page is worthless if the endpoint under its button is wrong.

## 0. Database up

`docker compose up -d`, then `psql … -f schema.sql`. Confirm the seed:
`select status, count(*) from submissions group by status` and the campaign rows
with 0 / 950 000 remaining budget — those are the fixtures the budget tests need.
No commit.

## 1. Dependencies and config

Add `drizzle-orm`, `pg`, `@types/pg`, `vitest`, `dotenv`. No `drizzle-kit` — we
never generate migrations against the provided schema. No React Testing Library
yet; nothing in the chosen test scope needs it.

`.env` with `DATABASE_URL`, `test` script in package.json, `vitest.config.ts`
(node environment, loads `.env`).

## 2. `src/db/`

`schema.ts` models the existing tables — `bigint({ mode: 'number' })` on money
columns, ceiling noted in the README. `client.ts` exports a pooled drizzle
instance. Nothing here creates or alters a table.

## 3. Index migration

`migrations/0001_indexes.sql`, applied by hand with psql:

```sql
create index on submissions (status, submitted_at desc, id desc);
create index on submissions (campaign_id, status, submitted_at desc, id desc);
create unique index on earnings (submission_id);
create index on creators (lower(username) text_pattern_ops);
drop index submissions_status_idx;
drop index submissions_campaign_id_idx;
```

Kept as reviewable SQL, one line of *why* per index carried into the README.

## 4. Money calc + tests (B1)

`src/lib/money.ts` — pure, no DB import. `gross = floor(views*cpm/1000)`,
`net = floor(gross*80/100)`, `fee = gross - net`.

`money.test.ts` covers: the brief's 12 345 @ 1500 → 18 517 / 14 813 / 3 704
reference, `gross === net + fee` across a range, the
`floor(gross*0.8)` vs `gross - floor(gross*0.2)` divergence that makes the brief's
number the correct one, and `views = 0` → zero.

First real commit, and the one that proves the money is right before anything
spends it.

## 5. Query params + list module

`src/lib/submissions/params.ts` — one zod schema, `status` optional with **no**
default (the page supplies `pending` itself).

`src/lib/submissions/list.ts` — `listSubmissions(params)`: joined select plus
`count(*)` under `Promise.all`, one shared where-clause built against the joined
shape so the count carries the `creators` join when search is active. Order
`submitted_at desc, id desc`. Prefix-only username search with `_` and `%`
escaped.

## 6. `GET /api/submissions`

Thin: parse `searchParams` → 400 on failure → `listSubmissions` → JSON. Read
`node_modules/next/dist/docs/` on route handlers first; Next 16 async APIs differ
from what I remember.

## 7. Approve

`src/lib/submissions/approve.ts` — one transaction:

1. conditional `update submissions … where id = ? and status = 'pending'
   returning views, campaign_id` → 0 rows means already reviewed
2. read `cpm` in-tx, compute gross/net/fee
3. gross of 0 → refuse, roll back
4. conditional `update campaigns set remaining_budget = remaining_budget - gross
   where id = ? and remaining_budget >= gross` → 0 rows means insufficient
5. insert the earning with `views_at_approval`

No campaign-status condition — [ADR-0001](docs/adr/0001-budget-is-the-only-approval-gate.md).

`POST /api/submissions/[id]/approve` maps outcomes to 400 / 404 / 409 / 422.

## 8. Behaviour tests against the real database

- ten concurrent approves of one submission → exactly one success, one earning
  row, budget decremented exactly once
- gross == remaining_budget succeeds; gross == remaining + 1 gives 422 and leaves
  the submission pending and the budget untouched
- zero-earning submission is refused and stays pending
- list: pagination boundaries, filter combinations, prefix search, 400 paths

Widest scope of the options considered. If time runs short the list tests are the
cut — concurrency and money are not.

## 9. `/review`

Server component reads `searchParams`, applies its own `status=pending` default,
calls `listSubmissions` directly (no self-HTTP —
[ADR-0003](docs/adr/0003-one-query-module-not-a-self-http-call.md)), and queries
the 8 campaigns for the filter dropdown.

Client components own only interactivity: filter controls and pagination writing
to the URL via `router.push`, and the per-row Approve button — `fetch` the real
endpoint, disabled while in flight, distinct message per status code,
`router.refresh()` on success. Loading is Suspense plus `isPending`; empty and
error render on the server.

## 10. README

Run instructions · every decision with its *why*, pointing at the ADRs rather
than repeating them · each index and the query it serves · the bigint ceiling ·
the prefix-search limitation and `pg_trgm` as the upgrade · the B2 views-decay
answer · what was cut and what comes next.

## 11. Final pass

`npm run lint`, `npm run build`, full test run. Read the diff for dead code,
stray `any`, and commented-out blocks.

## Known loose ends

- A zero-earning submission cannot be cleared from the queue — rejection is not
  in scope ([ADR-0002](docs/adr/0002-zero-earning-submissions-are-not-approvable.md)).
- Legacy Approvals (seeded `approved` rows) carry no earning and consumed no
  budget. Read-only history; nothing reconciles them.
- `count(*)` on every listing is exact and is the first thing to degrade well
  past 50 000 rows.
