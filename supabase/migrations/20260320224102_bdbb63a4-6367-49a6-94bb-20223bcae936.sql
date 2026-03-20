ALTER TABLE public.stripe_plan_mapping ADD COLUMN IF NOT EXISTS billing_usage text NOT NULL DEFAULT 'subscription_item';
COMMENT ON COLUMN public.stripe_plan_mapping.billing_usage IS 'subscription_item = used as Stripe subscription item, ux_only = sales/POS display only (not billed as standalone item)';
UPDATE public.stripe_plan_mapping SET billing_usage = 'ux_only' WHERE service_category = 'tv_combo';
UPDATE public.stripe_plan_mapping SET billing_usage = 'subscription_item' WHERE service_category != 'tv_combo';