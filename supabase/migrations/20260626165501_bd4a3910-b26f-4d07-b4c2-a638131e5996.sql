
-- Add missing price columns for plan changes — required by client-plan-change & billing-generate-renewals
ALTER TABLE public.service_change_requests
  ADD COLUMN IF NOT EXISTS requested_plan_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS current_plan_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS applied_at timestamp with time zone;

COMMENT ON COLUMN public.service_change_requests.requested_plan_price IS 'Target plan price for the change (used by billing-generate-renewals to apply downgrades).';
COMMENT ON COLUMN public.service_change_requests.current_plan_price IS 'Snapshot of plan price at request time, for audit/proration math.';
COMMENT ON COLUMN public.service_change_requests.applied_at IS 'When the change actually took effect (set by billing-generate-renewals for downgrades, by client-plan-change for upgrades).';
