# ClipPay — Review & Approve

ClipPay pays creators for the views their videos earn. This context covers the
admin side: reviewing submitted videos and approving the ones that get paid.

## Language

### People and money sources

**Brand**:
The party that funds a campaign. Does not appear as a table — it is a name on
the campaign.
_Avoid_: advertiser, client, sponsor

**Creator**:
A person who submits videos to campaigns and receives earnings.
_Avoid_: influencer, user, publisher

**Admin**:
The person who reviews submissions and decides which ones get approved. The only
actor in this context.
_Avoid_: reviewer, moderator, operator

### Campaign

**Campaign**:
A funded brief from a brand that creators submit videos to. Carries the CPM that
sets what its videos are worth.

**CPM**:
What a campaign pays per one thousand views, in whole rupiah.
_Avoid_: rate, price per view

**Total Budget**:
The full amount a brand funded a campaign with. Never changes.

**Remaining Budget**:
What is left of a campaign's funding to pay out. Reduced by the gross of every
approval. Can reach zero, never goes below it.
_Avoid_: balance, saldo, available budget

### Submission and review

**Submission**:
One video a creator entered into one campaign, carrying the view count it is
paid on.
_Avoid_: entry, post, clip, video

**Views**:
The current view count on a submission. Not stable over time — platforms remove
fake views, so it can fall.

**Review**:
The admin's decision on a pending submission. Only approval is built here;
rejection exists in the data but has no action behind it.

**Approval**:
The act that turns a pending submission into a paid one. Produces exactly one
earning and consumes campaign budget.
_Avoid_: accept, confirm, publish

**Views at Approval**:
The view count captured at the moment of approval. The earning was calculated
from it and stays fixed to it, however far the real view count later drifts.
_Avoid_: final views, locked views

### Earning

**Earning**:
What a creator was paid for one approved submission. Every approval this system
makes produces exactly one, and it is never revised afterwards.
_Avoid_: claim, obligation, owed amount

**Legacy Approval**:
A submission approved before earnings were tracked. Carries no earning and
consumed no budget. Read-only history, not a defect to reconcile.
_Avoid_: orphaned approval, unpaid approval

**Gross Earning**:
What a submission is worth at approval, before the platform's cut.
_Avoid_: gross amount, kotor

**Platform Fee**:
ClipPay's twenty percent cut of a gross earning. Derived from gross and net so
the three always reconcile.
_Avoid_: commission, service charge

**Net Earning**:
What the creator ends up with after the platform fee.
_Avoid_: net amount, take-home, bersih

**Zero Earning**:
A submission whose views are too low to be worth even one rupiah. Not
approvable.
