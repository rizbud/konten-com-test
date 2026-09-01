# Rejection is the other half of a review

The brief only asks for approval, and the first pass built only that — leaving an
admin a queue with one exit and zero-earning submissions with none
([ADR-0002](0002-zero-earning-submissions-are-not-approvable.md)). `submissions`
already has a `rejected` status and the seed already uses it, so the data model
was waiting for the action. It is built: `POST /api/submissions/:id/reject`, and
a Reject button beside Approve on every pending row.

No money moves, so there is no transaction to open. One conditional
`update … where id = ? and status = 'pending'` is the whole operation, atomic on
its own, carrying the same guard as the approve path: a second admin or a
double-click updates zero rows and gets a 409 instead of overwriting a decision.

## Consequences

A review is now a decision with two outcomes rather than one action, and the
queue drains. Rejecting writes no earning and touches no budget, so nothing
about the money path changes.

The `status = 'pending'` condition means the two actions cannot both land on one
submission: an approved submission cannot be rejected out from under its earning
(approval is final — [ADR-0004](0004-approval-is-final.md)), and a rejected one
cannot later be paid. Racing an approve against a reject leaves exactly one
winner, and the row always agrees with the books — there is a test for it.

Rejection carries no reason code. The schema has nowhere to put one, and
inventing a column for a field no screen collects would be worse than the gap.
That is the first thing to add if an admin ever needs to explain a decision.
