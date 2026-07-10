
ALTER TABLE public.mobile_fulfillment
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS mobile_fulfillment_subscription_idx
  ON public.mobile_fulfillment(subscription_id);
CREATE INDEX IF NOT EXISTS mobile_fulfillment_account_idx
  ON public.mobile_fulfillment(account_id);

INSERT INTO public.mobile_addons_catalog (addon_code, addon_name, addon_type, monthly_price, one_time_price, currency, is_active, sort_order)
SELECT * FROM (VALUES
  ('DATA_5GB',       'Données 5 Go supplémentaires', 'data',          15.00,  0.00, 'CAD', true, 10),
  ('INTL_CALLING',   'Appels internationaux',        'international', 10.00,  0.00, 'CAD', true, 20),
  ('ROAMING_DAY',    'Itinérance journalière',       'roaming',        0.00, 12.00, 'CAD', true, 30),
  ('VOICEMAIL_PLUS', 'Boîte vocale Plus',            'voicemail',      3.00,  0.00, 'CAD', true, 40)
) AS v(addon_code, addon_name, addon_type, monthly_price, one_time_price, currency, is_active, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.mobile_addons_catalog WHERE addon_code = v.addon_code);
