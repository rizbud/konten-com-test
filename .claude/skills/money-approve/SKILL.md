---
name: money-approve
description: Rules for ClipPay earning math and the approve transaction. Use whenever touching earning/fee/net calculation, the approve endpoint, campaign budget updates, the earnings table, or tests for any of those.
---

# Money & approve

## Math (integer rupiah only, never float money)

```
gross = floor(views * cpm / 1000)
net   = floor(gross * 80 / 100)     // 20% platform fee
fee   = gross - net                 // derived, never rounded on its own
```

- One `floor` per value, integer arithmetic only. `views` and `cpm` are integers,
  so `Math.floor((views * cpm) / 1000)` is exact.
- Reference case from the brief: 12345 views @ cpm 1500 → gross 18517,
  net 14813, fee 3704. Note net is `floor(gross * 0.8)`, **not**
  `gross - floor(gross * 0.2)` — that would give 14814 and disagree with the
  brief. Assert `gross === net + fee` in a test.
- DB columns are `bigint`. Drizzle returns `bigint` as `string` by default —
  either configure the pg type parser or convert explicitly; never let a
  `string` reach arithmetic.
- Pure calc function lives in one module with no DB import so it is trivially unit-testable (vitest).

## Approve transaction (the graded part)

Two admins clicking at once and a double-clicked button must both be safe. Do it
inside one `db.transaction`, using conditional UPDATEs so Postgres row locks do the work:

1. `update submissions set status='approved', reviewed_at=now() where id=? and status='pending' returning views, campaign_id`
   → 0 rows means already approved/rejected: return 409, no earning.
2. Compute gross/net from the returned `views` and the campaign `cpm` (read cpm in the same tx).
3. `update campaigns set remaining_budget = remaining_budget - gross where id=? and remaining_budget >= gross`
   → 0 rows means insufficient budget: roll back, return 422. Never pay partially.
4. `insert into earnings (...)` with `views_at_approval` = the snapshot from step 1.

Add `create unique index on earnings (submission_id)` as a second, DB-level
double-pay guard. Belt and suspenders is justified here — it is real money.

Do NOT: read-then-write without a condition, use `SELECT` then `UPDATE` without
`FOR UPDATE`, guard only in app code, or let the API return 200 on a no-op.

## Error contract

409 already reviewed · 422 insufficient budget · 404 missing submission ·
400 bad id. The UI must be able to tell these apart.
