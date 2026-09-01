# ClipPay — review & approve

The admin slice: list submissions, approve one, pay the creator, spend the
campaign's budget. Money correctness and behaviour under concurrent approvals
were the two things optimised for; everything else was kept boring on purpose.

Domain vocabulary is in [CONTEXT.md](CONTEXT.md), the decisions that were made
before writing code in [docs/adr/](docs/adr/), and the build order in
[PLAN.md](PLAN.md).

## Run it

```bash
docker compose up -d
psql "postgresql://clippay:clippay@localhost:5433/clippay" -f schema.sql
psql "postgresql://clippay:clippay@localhost:5433/clippay" -f migrations/0001_indexes.sql
```

`.env` needs one line:

```
DATABASE_URL=postgresql://clippay:clippay@localhost:5433/clippay
```

```bash
npm install
npm run dev     # http://localhost:3000/review
npm test        # 38 tests, needs the database up
npm run lint
npm run build
```

No `psql` on the host? Every command above works through the container:

```bash
docker compose exec -T db psql -U clippay -d clippay -f - < schema.sql
```

## What is here

| | |
|---|---|
| `GET /api/submissions` | pagination, `status` / `campaignId` filters, creator username search, exact total |
| `POST /api/submissions/:id/approve` | the money path: one transaction, budget guard, no double pay |
| `GET /api/campaigns/:id/summary` | bonus B3, one round trip |
| `/review` | server-rendered table, URL filter state, per-row approve |

Source map: money in [`src/lib/money.ts`](src/lib/money.ts), the approve
transaction in [`src/lib/submissions/approve.ts`](src/lib/submissions/approve.ts),
the listing query in [`src/lib/submissions/list.ts`](src/lib/submissions/list.ts),
the page in [`src/app/review/`](src/app/review/).

## The money

```
gross = floor(views * cpm / 1000)
net   = floor(gross * 80 / 100)
fee   = gross - net
```

Integers throughout, one `floor` per value, no float ever touches an amount.
`fee` is the remainder rather than its own rounded number, so `gross = net + fee`
holds by construction.

The brief's reference case is the reason `net` is written that way:
12 345 views at cpm 1500 gives gross 18 517, and `floor(18517 * 0.8)` is 14 813
while `18517 - floor(18517 * 0.2)` is 14 814. Both are defensible roundings; only
one matches the brief. [`money.test.ts`](src/lib/money.test.ts) pins that
divergence explicitly so a future "simplification" cannot silently move a rupiah.

**Bonus B1 — the tests that matter**, in order: the reference case, the
`gross = net + fee` reconciliation across every seeded CPM, the rounding
direction at an exact boundary, and `views = 0`. The reconciliation test is the
one that would catch a real regression, because it is the invariant the
`earnings` table has to satisfy for the books to balance.

## The approve transaction

One `db.transaction`, built entirely out of conditional UPDATEs so Postgres row
locks — not application checks — decide who wins:

1. `update submissions set status = 'approved', reviewed_at = now() where id = ? and status = 'pending' returning views, creator_id, campaign_id`
   — **this is the double-pay guard.** A second caller blocks on the same row,
   then re-evaluates the condition after the first commits, sees it is no longer
   pending, and updates zero rows.
2. Read `cpm` in the same transaction, compute gross/net/fee from the `views`
   returned in step 1.
3. `update campaigns set remaining_budget = remaining_budget - gross where id = ? and remaining_budget >= gross`
   — zero rows means the campaign cannot cover it. Roll back; never pay part of
   an earning.
4. Insert the earning with `views_at_approval` set to the snapshot from step 1.

The `views` used for the money comes out of step 1's `RETURNING`, so the amount
paid is computed from the row as it was locked, not from a value read earlier.

Outcomes map to `404` (no such submission), `409` (already reviewed), `422`
(zero earning, or insufficient budget), `400` (bad id). The UI shows a different
message for each, because "already reviewed" and "out of budget" call for
different things from an admin.

`create unique index on earnings (submission_id)` is a second, database-level
double-pay guard behind the conditional UPDATE. Redundant by design: it is real
money, and an index is cheaper than an incident.

Verified by [`approve.test.ts`](src/lib/submissions/approve.test.ts) against the
real database — ten concurrent approves of one submission produce exactly one
success, one earning row and one budget decrement; eight concurrent approves
against a budget that covers three produce exactly three payments, a budget of
exactly zero, and five submissions still pending. Mocking the driver would have
tested none of that.

### Decisions

- **Budget is the only gate.** A paused or closed campaign still approves —
  [ADR-0001](docs/adr/0001-budget-is-the-only-approval-gate.md).
- **A zero-earning submission is refused** and stays pending —
  [ADR-0002](docs/adr/0002-zero-earning-submissions-are-not-approvable.md).
- **Approval is final**, no clawback when views later fall —
  [ADR-0004](docs/adr/0004-approval-is-final.md), and bonus B2 below.
- **The page calls the query module, not its own API** —
  [ADR-0003](docs/adr/0003-one-query-module-not-a-self-http-call.md). Worth
  knowing before looking for a `fetch` in the page that is not there.

## The listing query

One statement for the page and one `count(*)` for the total, both built from the
same where-clause, both under one `Promise.all`. `limit`/`offset` come from
validated `page`/`per` (`per` capped at 100) — nothing is fetched and then
sliced. `creators` and `campaigns` are joined in the same statement; the select
list is only the columns the table renders.

Order is `submitted_at desc, id desc`. The tiebreak is not decoration:
`submitted_at` is not unique in the seed, and without `id` pages silently
overlap.

Query params are validated at the route boundary and **all** problems come back
in one 400, so a client fixing a URL sees both mistakes at once. `status` has no
default in the API — the `/review` page applies `pending` itself, which keeps the
endpoint a faithful view of the table.

Validation is hand-written rather than zod: five parameters did not justify a
dependency.

### Indexes

In [`migrations/0001_indexes.sql`](migrations/0001_indexes.sql), applied by hand.
`drizzle-kit` is deliberately not installed — the tables in `schema.sql` are
given, and a generated migration would try to recreate them. Indexes are the
only DDL this project adds, so they stay as reviewable SQL.

| Index | Query it serves |
|---|---|
| `submissions (status, submitted_at desc, id desc)` | the default listing. `EXPLAIN` shows an index scan feeding the LIMIT with **no sort node** — the index supplies both the filter and the order |
| `submissions (campaign_id, status, submitted_at desc, id desc)` | the same listing with a campaign filter. `campaign_id` leads because it is the more selective column (8 campaigns vs 3 statuses) |
| `earnings (submission_id)` unique | the second double-pay guard, not a read path |
| `creators (lower(username) text_pattern_ops)` | creator prefix search |

Dropped: the seed's `submissions (status)` and `submissions (campaign_id)`. Both
are leading-column prefixes of the composites above, so they only cost write
throughput now.

Honest note on the last one: at 2 000 creators the planner prefers a sequential
scan of that tiny table, so the index does not fire today —
`set enable_seqscan = off` confirms it is used and that the prefix range is
extracted correctly. It is in because creators is the table that grows without
bound. `submissions (submitted_at desc)` from the seed was left alone; it serves
an unfiltered listing, which is not a path this app takes.

### Username search is prefix-only

`lower(username) like 'creator_1%'`, with `%`, `_` and `\` in the user's input
escaped so a search for `%` matches nothing instead of everything (there is a
test for that). Prefix-only is what makes it indexable: a leading `%` cannot use
a b-tree at all and would sequentially scan `creators` on every keystroke.

`ilike` would have read better but cannot use a `text_pattern_ops` index —
`lower()` on both sides is what makes the index applicable. If infix search is
actually wanted, the answer is a `pg_trgm` GIN index on `lower(username)`, not a
slower LIKE pretending to be fast.

## Bonus B2 — views fall after an approval

**Nothing happens. The earning stands.** Approving pays the creator there and
then; there is no later payout stage to adjust, and `earnings` has no room to
store a revision. A video approved at 100 000 views that decays to 60 000 keeps
its earning, and `views_at_approval` records the 100 000 the payment was computed
from, so the basis of every past payment stays auditable when the live count no
longer matches it.

**For the creator:** their income is final the moment an admin clicks approve.
The alternative — clawing back the difference — makes a creator's balance a
function of a platform's fake-view sweep, something they do not control and
cannot predict. Retroactive debt against people who have already been paid is the
fastest way to lose the supply side of a two-sided marketplace, and the accounting
is worse than the exposure it recovers.

**For the brand:** they carry the decay on work already paid for. That is a real
cost, and the lever for it is on the approval side, not the reversal side:

- approve on settled views — a hold period (approve at day 7, not day 1) removes
  most of the decay, because scrubbing happens early;
- price it in — a decay reserve in the campaign budget, or a CPM that assumes a
  few percent of scrub;
- cap per submission, so one viral outlier cannot take a disproportionate share
  of a budget on views that may not survive.

If a brand genuinely needs the corrected number, the honest shape is not a
clawback but a **second stage**: `earnings` becomes an accrual and payout happens
after a settle window. That is a schema change and a different product decision,
so it is named here rather than half-built. Written up as
[ADR-0004](docs/adr/0004-approval-is-final.md).

## Notes worth reading before the code

- **`bigint` money is read as JavaScript numbers** (`mode: 'number'`), exact to
  2^53 rupiah — about 9 quadrillion. `mode: 'bigint'` would push `BigInt`
  through every calculation and JSON boundary for a ceiling no campaign will
  reach. The one place a real `bigint` survives is `sum()` in the campaign
  summary, which pg returns as a string and which is converted explicitly.
- **Drizzle drops the table qualifier** for a column object interpolated into a
  `sql` template in a select list: `${submissions.campaignId} = ${campaigns.id}`
  renders as `"campaign_id" = "id"`, which resolves to submissions' *own* id and
  silently counts the wrong rows. The campaign summary's correlated subqueries
  are therefore written as literal SQL, with a comment saying why. This was found
  because the endpoint returned `submissionCount: 2` for a campaign with 6 297
  submissions — hence a test that pins the count.
- **The seed lands every submission in `pending`** on Postgres 16. The status is
  picked in a `cross join lateral` that does not reference the outer row, so the
  planner evaluates it once and all 50 000 rows share it. `schema.sql` is given
  input and was left untouched; the behaviour tests build their own fixtures, so
  they cover `approved` and `rejected` rows regardless. Filtering `/review` by
  `approved` on a fresh database shows an empty table for this reason, not a bug
  in the filter.
- **Legacy approvals**: the seed's `approved` rows deliberately have no earning
  and consumed no budget. Read-only history, nothing reconciles them — which is
  why `grossPaid` in the campaign summary does not equal
  `totalBudget - remainingBudget`.

## The `/review` page

A server component reads `searchParams`, applies its own `status=pending`
default, and calls `listSubmissions` directly. Filter state lives in the URL, so
it survives a reload and can be pasted to someone else.

Two client components, both only for interactivity:

- **Filters** — selects and a search box that `router.push` the new URL inside a
  transition, so `isPending` can say "Updating…" while the server re-renders.
- **Approve** — posts to the real endpoint, disabled in flight, a distinct
  message per status code, and `router.refresh()` on success (and on a 409,
  where the table is by definition stale).

The four states: loading is a `Suspense` skeleton keyed on the query string, so
it reappears on every filter change; empty distinguishes "nothing matches" from
"this page is past the end"; invalid filters render the validation errors
server-side; and `error.tsx` catches a database that does not answer, saying
plainly that nothing was approved.

CSS was the last priority — the brief does not grade it.

## Cut for time, and what comes next

- **Rejection.** Not in scope, which leaves zero-earning submissions stranded in
  the queue with no action that clears them
  ([ADR-0002](docs/adr/0002-zero-earning-submissions-are-not-approvable.md)).
  First thing to build next.
- **No component tests.** React Testing Library is not installed. The graded
  risk is in the money and the transaction, and the budget went there; the page
  was verified by driving it in a browser instead — approving a row, watching the
  earning row and the budget land exactly, and checking the 409/422 messages.
- **`count(*)` is exact on every listing**, and it is the first thing to degrade
  well past 50 000 rows. The upgrade is a cheap estimate from
  `pg_class.reltuples` for unfiltered counts, or dropping the exact total for an
  offset-free keyset cursor (`where (submitted_at, id) < (?, ?)`), which the
  `submitted_at desc, id desc` ordering already sets up.
- **Deep offsets.** `offset 40000` still walks 40 000 index entries. Same fix:
  keyset pagination. Fine at 2 500 pages of admin queue, not fine as a public API.
- **No auth.** There is one actor in this slice and the brief does not ask for
  it, so every request is trusted as an admin.
- **A summary page for the endpoint.** B3 ships as JSON only; nothing in the UI
  consumes it yet.
