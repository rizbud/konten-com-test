# ClipPay — review & approve

*English — the long version, with the implementation detail.
[Bahasa Indonesia](README.md) is the default and the shorter read.*

The admin slice: list submissions, review one, pay the creator, spend the
campaign's budget. Money correctness and behaviour under concurrent approvals
were the two things optimised for; everything else was kept boring on purpose.

Domain vocabulary is in [CONTEXT.md](CONTEXT.md), the decisions that were made
before writing code in [docs/adr/](docs/adr/), and the build order in
[PLAN.md](PLAN.md).

## Run it

`.env` needs one line:

```
DATABASE_URL=postgresql://clippay:clippay@localhost:5433/clippay
```

```bash
docker compose up -d
npm install
npm run db:setup     # applies the given schema.sql: tables + 50 000-row seed
npm run db:migrate   # drizzle-kit migrate: our indexes, from drizzle/
npm run dev          # http://localhost:3000/review
```

No `psql` needed at all — `db:setup` replays `schema.sql` over the `pg` driver
and `db:migrate` is drizzle-kit. Both are idempotent in the sense that matters:
`db:setup` recreates the tables from scratch (it replays the file's `drop table`s),
and `db:migrate` skips migrations already recorded in `drizzle.__drizzle_migrations`.

```bash
npm test        # 57 tests, needs the database up
npm run lint
npm run build
```

## What is here

| | |
|---|---|
| `GET /api/submissions` | pagination, `status` / `campaignId` filters, creator username search, exact total |
| `POST /api/submissions/:id/approve` | the money path: one transaction, budget guard, no double pay |
| `POST /api/submissions/:id/reject` | the other half of a review — no money, same 409 guard |
| `GET /api/creators` | typeahead source for the creator filter, capped at 5 |
| `GET /api/campaigns/:id/summary` | bonus B3, one round trip |
| `/review` | server-rendered table, URL filter state, per-row approve and reject behind a confirmation, detail dialog |

### Where things live

```
src/app/                 routes only — a page, five route handlers, one error boundary
src/components/ui.tsx    shared presentational pieces and the colour tokens
src/components/modal.tsx, toasts.tsx, pagination.tsx
src/components/review/   the review screen's own components
src/db/                  drizzle model of the given schema, and the pool
src/lib/                 money, formatting, page windows, and the query modules
src/test/                fixtures for the behaviour tests
drizzle/                 hand-written migrations for the indexes we add
scripts/db-setup.mjs     applies the given schema.sql without psql
```

Nothing under `src/app/` holds logic beyond reading its own inputs: routes
validate and delegate, the page fetches and composes. The money is in
[`src/lib/money.ts`](src/lib/money.ts), the approve transaction in
[`src/lib/submissions/approve.ts`](src/lib/submissions/approve.ts), the listing
query in [`src/lib/submissions/list.ts`](src/lib/submissions/list.ts).

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
- **Rejection is the other half of a review**, added beyond the brief so the
  queue has a second exit —
  [ADR-0005](docs/adr/0005-rejection-is-the-other-half-of-a-review.md).

## Rejecting

No money moves, so there is no transaction to open: one conditional
`update … where id = ? and status = 'pending'` is the whole operation, atomic on
its own, with the same guard the approve path uses. Ten concurrent rejects of one
submission produce exactly one success and nine 409s.

Because both actions carry that condition, they cannot both land: an approved
submission cannot be rejected out from under its earning, a rejected one cannot
later be paid, and racing an approve against a reject leaves exactly one winner
with the row always agreeing with the books —
[`reject.test.ts`](src/lib/submissions/reject.test.ts) asserts that, including
the race.

Rejection carries no reason code; the schema has nowhere to put one. First thing
to add if an admin needs to explain a decision.

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

In [`drizzle/`](drizzle/), applied by `npm run db:migrate`.

drizzle-kit is installed for `migrate` only. `drizzle-kit generate` (without
`--custom`) and `drizzle-kit push` must never be run here: the tables in
`schema.sql` are given, not ours to author, so a generated diff would try to
recreate them and push would drop what it does not recognise. Both migrations
were created with `generate --custom`, which writes an empty file and its journal
entry without inspecting the schema, and then filled in by hand — so the DDL
stays reviewable SQL while drizzle keeps track of what has been applied.
[`drizzle.config.ts`](drizzle.config.ts) says the same thing next to the config.

| Index | Query it serves |
|---|---|
| `submissions (status, submitted_at desc, id desc)` | the default listing. `EXPLAIN` shows an index scan feeding the LIMIT with **no sort node** — the index supplies both the filter and the order |
| `submissions (campaign_id, status, submitted_at desc, id desc)` | the same listing with a campaign filter. `campaign_id` leads because it is the more selective column (8 campaigns vs 3 statuses) |
| `earnings (submission_id)` unique | the second double-pay guard, not a read path |
| `creators using gin (lower(username) gin_trgm_ops)` | creator substring search |

Dropped: the seed's `submissions (status)` and `submissions (campaign_id)`. Both
are leading-column prefixes of the composites above, so they only cost write
throughput now. `submissions (submitted_at desc)` was left alone; it serves an
unfiltered listing, which is not a path this app takes.

### Username search is a substring match

`lower(username) like '%creator_1%'`, with `%`, `_` and `\` in the user's input
escaped so a search for `%` matches nothing instead of everything (there is a
test for that). A fragment from the middle of a name finds it: `eator_195` and
the suffix `r_1999` both return rows.

That leading `%` is exactly what a b-tree cannot serve — there is no prefix to
seek on — so this needs `pg_trgm`
([`drizzle/0001`](drizzle/0001_username_trigram.sql)): a GIN index over the
three-character shingles of `lower(username)`. `EXPLAIN ANALYZE` on
`like '%tor_123%'` is a bitmap index scan on `creators_username_trgm_idx`,
0.2 ms, 3 heap blocks. The b-tree `text_pattern_ops` index this replaced could
only ever have served a prefix, and the planner never chose it even for that —
2 000 creators fit in 51 pages, so a sequential scan won.

`ilike` reads better but cannot use the index: the indexed expression is
`lower(username)`, so the predicate has to be written the same way.

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

**Both side effects are owned by the list, not by the widget that triggers
them.** This is deliberate and is the shape worth reviewing:

- [`ReviewFilters`](src/components/review/review-filters.tsx) owns one `apply`
  function. It is the only code that knows what a filter change means — which
  params it touches, that it clears the offset, and that it happens inside a
  transition so `isPending` can say "Updating…". The status `<select>`, the
  [`CampaignPicker`](src/components/review/campaign-picker.tsx) and the
  [`CreatorPicker`](src/components/review/creator-picker.tsx) are inputs that
  report a value and nothing else.
- [`SubmissionsTable`](src/components/review/submissions-table.tsx) owns
  everything a review touches: the confirmation, both endpoints, reading their
  responses, what each status code means, and the toast that reports the
  outcome. [`SubmissionRow`](src/components/review/submission-row.tsx) is
  presentational — it reports an id and an action, and renders the state it was
  handed. It does not know reviewing is HTTP, or that a dialog opens first.

No custom hooks. Each of those is one piece of state and one function used in one
place; a `useReviews`/`useFilters` wrapper would move the same lines behind a
name and buy nothing. They earn their keep at the second caller, not the first.

**Nothing filters until Apply.** Every control edits a local draft and one
submit turns the whole draft into one navigation, so changing status and campaign
together costs one round trip instead of two and half-typed input never queries
50 000 rows. The draft starts from the URL, and the page gives the component a
key derived from the query string — a navigation remounts it and the draft
matches what is on screen, instead of an effect syncing two sources of truth.

Pagination is numbered, capped at **five page numbers** — always the first and
the last, always the current one, and the window slides to stay inside the ends
so the row keeps a fixed width at page 1 and at page 2 500:

```
page 1     of 2500 -> [1] 2 3 4 … 2500
page 4     of 2500 -> 1 … 3 [4] 5 … 2500
page 2499  of 2500 -> 1 … 2497 2498 [2499] 2500
```

[`pageWindow`](src/lib/pagination.ts) computes it and a test pins all three
shapes plus the invariants: never more than five numbers, first/last/current
always present, sorted, no repeats, and a page number past the end clamped. The
cap does mean a gap can hide a single page (`1 2 3 4 … 6` on six pages) — naming
that page instead would be friendlier but would make the row six numbers wide,
and the cap is the point. They are plain `<Link>`s, so paging needs no client
JavaScript and every page is a real bookmarkable URL.

Both filters that name a thing are typeaheads rather than `<select>`s, because a
native select cannot be typed into. Neither is a combobox library — a plain
filtered listbox: click, Enter for the first match, Escape to close.

- **Campaign** filters locally. The eight campaigns already arrive with the page,
  so there is nothing to fetch.
- **Creator** queries the database, five at a time, because 2 000 names is not a
  list to scroll — typing more narrows it. It debounces 250 ms, aborts the
  in-flight request on the next keystroke, and stores results *with the query
  they answer*, so a reply that arrives after the text moved on is never
  displayed. The value stays free text: a partial username applies as a substring
  search whether or not a suggestion was picked.

### Confirming, and saying what happened

Both actions are irreversible and one of them moves money, so neither fires on a
single click. The confirmation states the amount before it moves — for an
approve: who gets paid, how much net, the gross coming off which campaign, and
what the remaining budget will be afterwards; for a reject: that nothing is paid
and that a review happens once.

The numbers in it come from [`calculateEarning`](src/lib/money.ts) — the same
pure function the server uses, so the preview cannot drift from the payment. It
is still only a preview: the amount actually written is computed inside the
transaction from the views the row holds when it is locked.

`window.confirm` would have been one line, and was the first thing considered.
It cannot lay out an amount legibly, and it blocks the event loop while it is up.
[`Modal`](src/components/modal.tsx) wraps the native `<dialog>` instead, which
brings the focus trap, the backdrop, the top layer and Escape-to-close with it —
no library, and nothing reimplemented.

Outcomes are [toasts](src/components/toasts.tsx), not text crammed into the
row's action cell: success is green and names the amount paid, failure is red and
carries the endpoint's own message, so "already reviewed" still reads differently
from "not enough remaining budget". A failed row goes back to idle with its
buttons live, because most failures are worth retrying. The row keeps its own
terminal state ("Paid Rp…", "Rejected") so it is obvious *which* row succeeded.

### Detail dialog

Every row has a Details button, and the campaign title opens the same thing. It
covers the submission (id, creator, platform, video link, views, status, both
timestamps), its campaign (brand, status, CPM, total and remaining budget), and
what approving would pay right now — including a line explaining, where it
applies, that the views round down to zero rupiah or that the budget will not
cover the gross.

It needs no endpoint and has no loading state: the campaign columns ride along on
a join the listing already does. A per-row fetch on open would have been an N+1
waiting to be written.

The four states: loading is a `Suspense` skeleton keyed on the query string, so
it reappears on every filter change; empty distinguishes "nothing matches" from
"this page is past the end"; invalid filters render the validation errors
server-side; and `error.tsx` catches a database that does not answer, saying
plainly that nothing was approved.

Colour is centralised in [`src/components/ui.tsx`](src/components/ui.tsx) so a
contrast fix happens once. Muted text is `zinc-600` / `zinc-400` rather than
`zinc-500`, which read as grey-on-grey against *both* backgrounds. Every text
node on the page was measured against its real computed background in the
browser: the lowest ratio is now 5.36:1 (white on `emerald-700`, the Approve
button) in both themes, against the 4.5:1 minimum. The only deliberate exception
is a disabled Previous/Next, which has to read as unavailable.

Smaller things in the same file so they are consistent by construction: status
renders `UPPERCASE` in the table and `Capitalised` in the filter (`<option>`
ignores `text-transform` in some browsers, so that label is capitalised in JS),
platform is `Capitalised`, Approve is green and Reject is red because they do
opposite things, and every button carries `cursor-pointer` — Tailwind's reset
gives buttons `cursor: default`, which reads as "not clickable".

The table carries the two numbers an approve decision actually turns on, side by
side: **amount to pay** (net to the creator, with the gross that leaves the budget
underneath) and the campaign's **remaining budget with its total underneath**.
Both come from the same `calculateEarning` the transaction uses, so the row cannot
disagree with the payment, and a refusal for insufficient budget is visible in the
row before the button is pressed.

**Campaign status** is a column too, and deliberately not alarming on
`paused`/`closed`: those still approve, because budget is the only gate
([ADR-0001](docs/adr/0001-budget-is-the-only-approval-gate.md)). It is context an
admin should see, not a reason the row cannot be paid.

Ten columns is a lot, so the page is `max-w-[96rem]` with `px-4` and the cells are
`px-3 py-2`: the whole table fits without a scrollbar at 1 280 px and above
(measured: 1 246 px of table in a 1 246 px wrapper at 1 280). Below that the table
scrolls inside its own `overflow-x-auto` container and the page body never
scrolls sideways.

### One bug this refactor exposed

"All statuses" did not work. The page treats an absent `status` as "use the
default, `pending`", and the filter used to *delete* the param when cleared — so
picking "All statuses" snapped straight back to pending. `apply` now writes
`?status=` for that case: absent means "default", present-but-empty means "all".
The API already read a blank param as no filter, so only the page's writer was
wrong.

## Cut for time, and what comes next

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
- **No rejection reason.** The schema has nowhere to store one
  ([ADR-0005](docs/adr/0005-rejection-is-the-other-half-of-a-review.md)).
- **No bulk review.** One row at a time; a 50 000-row queue eventually wants
  "approve everything matching these filters", which is a different transaction
  and a different confirmation story.
