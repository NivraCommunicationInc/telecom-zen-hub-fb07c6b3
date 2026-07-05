-- 1. Supprimer la facture test 8936800 et ses lignes
DELETE FROM public.billing_invoice_lines WHERE invoice_id = 'b77ae257-8773-4757-8077-6d5473564eb9';
DELETE FROM public.billing_invoices WHERE id = 'b77ae257-8773-4757-8077-6d5473564eb9';

-- 2. Réouvrir les ajustements consommés par le test
UPDATE public.account_adjustments
SET status = 'active',
    applied_count = 0,
    last_applied_at = NULL,
    months_remaining = 1
WHERE id IN (
  'de6ec3ce-c2bf-4e77-861f-a79aa06f52f2',  -- crédit prorata 37,94$
  '336f445c-8ce5-4873-a46d-8219c1d400f1'   -- frais 5$
);

-- 3. Restaurer les cycles originaux
UPDATE public.billing_subscriptions
SET cycle_start_date = '2026-07-02', cycle_end_date = '2026-08-01'
WHERE id = '56391e93-45f0-4bdd-ac2e-efa109fe119d';

UPDATE public.billing_subscriptions
SET cycle_start_date = '2026-07-04', cycle_end_date = '2026-07-25'
WHERE id = 'd2031da5-6921-4759-a08f-a897731e888f';