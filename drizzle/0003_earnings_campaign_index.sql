-- GET /api/campaigns/:id/summary sums a campaign's earnings. schema.sql indexes
-- nothing on earnings.campaign_id, so that side is a sequential scan — harmless
-- against the three rows this system has written so far, and the wrong shape
-- once earnings is the table that grows with every approval.
--
-- The amounts are in the index too, so the sums are answered without touching
-- the heap at all.
create index if not exists earnings_campaign_id_amounts_idx
  on earnings (campaign_id) include (gross_amount, net_amount, fee_amount);
--> statement-breakpoint

analyze earnings;
