# Budget is the only gate on approval

The seed data deliberately contains a paused campaign and a closed campaign that
both still hold plenty of remaining budget, which invites a rule that approval
requires an active campaign. The brief names insufficient budget as the only
reason to refuse an approval, so that is the only condition we enforce — a
submission on a paused or closed campaign approves normally.

## Consequences

Inventing a status gate would have been indistinguishable from a budget failure
at the point where it fires, forcing an extra query or an ambiguous error just to
tell the admin which rule stopped them. Declining the rule keeps one gate, one
race-sensitive check, and one unambiguous 422. If the business does want
paused/closed campaigns to stop paying out, it is a condition added to the same
statement — not a redesign.
