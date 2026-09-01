# Zero-earning submissions are not approvable

A submission with few enough views rounds down to a gross earning of zero rupiah.
Approving it would pay nothing, consume nothing, and write an earning row that
records no obligation, so approval refuses it with a distinct error and the
submission stays pending.

## Consequences

This is a rule the brief did not ask for, chosen because "approve" means "pay"
and there is nothing to pay. It keeps every approval this system makes paired
with exactly one earning.

## Update — rejection now clears them

The original cost of this rule was that it stranded the affected submissions:
rejection was not built, so nothing could clear them from the queue. Rejection
is now built ([ADR-0005](0005-rejection-is-the-other-half-of-a-review.md)), so a
zero-earning submission has a way out. The rule itself is unchanged: approval
still refuses to pay nothing.
