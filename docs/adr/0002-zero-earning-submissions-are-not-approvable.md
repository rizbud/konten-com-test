# Zero-earning submissions are not approvable

A submission with few enough views rounds down to a gross earning of zero rupiah.
Approving it would pay nothing, consume nothing, and write an earning row that
records no obligation, so approval refuses it with a distinct error and the
submission stays pending.

## Consequences

This is a rule the brief did not ask for, chosen because "approve" means "pay"
and there is nothing to pay. It keeps every approval this system makes paired
with exactly one earning. The cost is that it strands the affected submissions:
rejection is not built in this slice, so nothing clears them from the queue.
