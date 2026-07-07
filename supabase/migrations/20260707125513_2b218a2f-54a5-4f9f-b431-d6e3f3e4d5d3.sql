-- Nettoyage exceptionnel Phase 3 Canonical
-- Le guard fn_subscription_freeze_guard est temporairement désactivé pour corriger
-- des données historiques créées avant l'invariant. L'invariant reste actif après la migration.

BEGIN;

-- 1) Backup
INSERT INTO public.billing_subscription_trace_audit (subscription_id, customer_id, action, source_type, reason, details)
SELECT bs.id, bs.customer_id, 'phase3_cleanup_backup', 'system',
       'Backup avant nettoyage frozen_* et réalignement cycle (Phase 3 Canonical)',
       to_jsonb(bs)
FROM public.billing_subscriptions bs
WHERE bs.id IN (
  'f007de5b-982a-4919-9aee-9adfcfb22395','f57c33da-54fa-41f4-9d63-a1205be29142',
  '99f9823d-0311-4650-bcf0-541dac8437d4','d2031da5-6921-4759-a08f-a897731e888f',
  'd7313028-b11c-4a44-adf8-3bba6bb5d503','9b22227c-2210-4085-a5de-0773fc52daf3',
  '8e3c0048-5197-4caf-825c-ca46dfd3b70b'
);

-- 2) Suspend guard temporairement (ce n'est PAS un DROP — juste DISABLE local à la transaction via session_replication_role)
SET LOCAL session_replication_role = 'replica';

-- 3) Nettoyage frozen_*/plan_*
UPDATE public.billing_subscriptions SET frozen_name='Internet Giga', frozen_code='Internet Giga', plan_name='Internet Giga', plan_code='Internet Giga', updated_at=now() WHERE id='f007de5b-982a-4919-9aee-9adfcfb22395';
UPDATE public.billing_subscriptions SET frozen_name='Internet Giga', frozen_code='Internet Giga', plan_name='Internet Giga', plan_code='Internet Giga', updated_at=now() WHERE id='f57c33da-54fa-41f4-9d63-a1205be29142';
UPDATE public.billing_subscriptions SET frozen_name='GIGA + TV 15 choix — 30 jours', frozen_code='GIGA + TV 15 choix — 30 jours', plan_name='GIGA + TV 15 choix — 30 jours', plan_code='GIGA + TV 15 choix — 30 jours', updated_at=now() WHERE id='99f9823d-0311-4650-bcf0-541dac8437d4';
UPDATE public.billing_subscriptions SET frozen_name='GIGA + TV Basic', frozen_code='GIGA + TV Basic', plan_name='GIGA + TV Basic', plan_code='GIGA + TV Basic', updated_at=now() WHERE id='d2031da5-6921-4759-a08f-a897731e888f';
UPDATE public.billing_subscriptions SET frozen_name='Internet Giga', frozen_code='Internet Giga', plan_name='Internet Giga', plan_code='Internet Giga', updated_at=now() WHERE id='d7313028-b11c-4a44-adf8-3bba6bb5d503';
UPDATE public.billing_subscriptions SET frozen_name='GIGA + TV 25 choix', frozen_code='GIGA + TV 25 choix', plan_name='GIGA + TV 25 choix', plan_code='GIGA + TV 25 choix', updated_at=now() WHERE id='9b22227c-2210-4085-a5de-0773fc52daf3';
UPDATE public.billing_subscriptions SET frozen_name='GIGA + TV 25 choix', frozen_code='GIGA + TV 25 choix', plan_name='GIGA + TV 25 choix', plan_code='GIGA + TV 25 choix', updated_at=now() WHERE id='8e3c0048-5197-4caf-825c-ca46dfd3b70b';

-- 4) Ancrage comptes Laureen et Smukus
UPDATE public.accounts SET billing_cycle_day=4, updated_at=now() WHERE id='6610b080-a624-4043-adb8-c194e5696ae1' AND billing_cycle_day IS NULL;
UPDATE public.accounts SET billing_cycle_day=21, billing_anchor_date='2026-05-21', billing_anchor_day=21, updated_at=now() WHERE id='cfa7ee8e-cbf1-4d3a-90d6-a327bef3465e';

-- 5) Réalignement cycles
UPDATE public.billing_subscriptions SET cycle_start_date='2026-07-16', cycle_end_date='2026-08-16', next_renewal_at='2026-08-13 00:00:00+00', updated_at=now() WHERE id='f007de5b-982a-4919-9aee-9adfcfb22395';
UPDATE public.accounts SET next_invoice_date='2026-08-16', updated_at=now() WHERE id='8e8ce624-fcb6-4c2b-876d-699242dc13ec';

UPDATE public.billing_subscriptions SET cycle_start_date='2026-06-15', cycle_end_date='2026-07-15', next_renewal_at='2026-07-12 00:00:00+00', updated_at=now() WHERE id='f57c33da-54fa-41f4-9d63-a1205be29142';
UPDATE public.accounts SET next_invoice_date='2026-07-15', updated_at=now() WHERE id='db952d17-732f-43de-95c0-b89d2d24642b';

UPDATE public.billing_subscriptions SET cycle_start_date='2026-07-04', cycle_end_date='2026-08-04', next_renewal_at='2026-08-01 00:00:00+00', updated_at=now() WHERE id='99f9823d-0311-4650-bcf0-541dac8437d4';
UPDATE public.accounts SET next_invoice_date='2026-08-04', updated_at=now() WHERE id='6610b080-a624-4043-adb8-c194e5696ae1';

UPDATE public.billing_subscriptions SET cycle_start_date='2026-06-25', cycle_end_date='2026-07-25', next_renewal_at='2026-07-22 00:00:00+00', updated_at=now() WHERE id='d2031da5-6921-4759-a08f-a897731e888f';
UPDATE public.accounts SET next_invoice_date='2026-07-25', updated_at=now() WHERE id='8728e4f2-add2-42a4-8b92-e5007889ee62';

UPDATE public.billing_subscriptions SET cycle_start_date='2026-06-23', cycle_end_date='2026-07-23', next_renewal_at='2026-07-20 00:00:00+00', updated_at=now() WHERE id='d7313028-b11c-4a44-adf8-3bba6bb5d503';
UPDATE public.accounts SET next_invoice_date='2026-07-23', updated_at=now() WHERE id='a026545c-fa06-4ca0-b05b-717f803f55e9';

UPDATE public.billing_subscriptions SET cycle_start_date='2026-06-15', cycle_end_date='2026-07-15', next_renewal_at='2026-07-12 00:00:00+00', updated_at=now() WHERE id='9b22227c-2210-4085-a5de-0773fc52daf3';
UPDATE public.accounts SET next_invoice_date='2026-07-15', updated_at=now() WHERE id='d1bf01ef-1248-42e4-9370-38ab9462a7e1';

UPDATE public.billing_subscriptions SET status='active', cycle_start_date='2026-06-21', cycle_end_date='2026-07-21', next_renewal_at='2026-07-18 00:00:00+00', billing_anchor_date='2026-05-21', updated_at=now() WHERE id='8e3c0048-5197-4caf-825c-ca46dfd3b70b';
UPDATE public.accounts SET next_invoice_date='2026-07-21', updated_at=now() WHERE id='cfa7ee8e-cbf1-4d3a-90d6-a327bef3465e';

-- 6) Réactive session_replication_role pour appeler renew_subscription avec tous les guards actifs
SET LOCAL session_replication_role = 'origin';

-- 7) Renouvellement canonique Smukus via renew_subscription()
SELECT public.renew_subscription(
  '8e3c0048-5197-4caf-825c-ca46dfd3b70b'::uuid,
  jsonb_build_object('trigger','phase3_cleanup','actor','system','reason','Réactivation post-nettoyage snapshots')
);

COMMIT;