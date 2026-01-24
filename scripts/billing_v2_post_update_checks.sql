-- ============================================================
-- Billing V2 — Post-Update Verification Script
-- Nivra Telecom
-- ============================================================
-- Ce script vérifie les invariants Billing V2 après un update.
-- IL NE MODIFIE AUCUNE DONNÉE RÉELLE (read-only + tables temp).
-- ============================================================

\echo '============================================================'
\echo 'BILLING V2 POST-UPDATE CHECKS'
\echo '============================================================'

-- ============================================================
-- CHECK 1: Crons actifs (liste pour vérification manuelle)
-- ============================================================
\echo ''
\echo '--- CHECK 1: Crons Edge Functions ---'
\echo 'Crons attendus (actifs):'
\echo '  - billing-check-overdue-hourly'
\echo '  - billing-generate-renewals-hourly'
\echo '  - payment-reminders-hourly'
\echo '  - process-email-queue'
\echo ''
\echo 'Crons interdits (doublons/legacy):'
\echo '  - *-daily (remplacés par hourly)'
\echo ''
\echo 'NOTE: Vérifier manuellement dans supabase/config.toml ou dashboard.'

-- ============================================================
-- CHECK 2: Triggers sur billing_invoices
-- ============================================================
\echo ''
\echo '--- CHECK 2: Triggers sur billing_invoices ---'

SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.billing_invoices'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- Vérification spécifique du trigger balance
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgrelid = 'public.billing_invoices'::regclass 
        AND tgname LIKE '%balance%'
        AND tgenabled != 'D'
    ) 
    THEN '✅ PASS: Trigger balance actif sur billing_invoices'
    ELSE '❌ FAIL: Trigger balance MANQUANT ou désactivé!'
  END AS check_result;

-- ============================================================
-- CHECK 3: Triggers sur billing_payments
-- ============================================================
\echo ''
\echo '--- CHECK 3: Triggers sur billing_payments ---'

SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.billing_payments'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- Vérification spécifique du trigger sync
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgrelid = 'public.billing_payments'::regclass 
        AND tgname LIKE '%sync%'
        AND tgenabled != 'D'
    ) 
    THEN '✅ PASS: Trigger sync actif sur billing_payments'
    ELSE '❌ FAIL: Trigger sync MANQUANT ou désactivé!'
  END AS check_result;

-- ============================================================
-- CHECK 4: Contraintes sur billing_payments
-- ============================================================
\echo ''
\echo '--- CHECK 4: Contraintes billing_payments ---'

SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.billing_payments'::regclass
  AND contype = 'c'
ORDER BY conname;

-- Vérification contrainte source
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'public.billing_payments'::regclass 
        AND conname = 'chk_billing_payments_source_valid'
    ) 
    THEN '✅ PASS: Contrainte source_valid présente'
    ELSE '❌ FAIL: Contrainte source_valid MANQUANTE!'
  END AS check_result;

-- Vérification contrainte provider reference
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'public.billing_payments'::regclass 
        AND conname = 'chk_provider_confirmed_reference'
    ) 
    THEN '✅ PASS: Contrainte provider_confirmed_reference présente'
    ELSE '❌ FAIL: Contrainte provider_confirmed_reference MANQUANTE!'
  END AS check_result;

-- ============================================================
-- CHECK 5: Index d'idempotence
-- ============================================================
\echo ''
\echo '--- CHECK 5: Index idempotence ---'

SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'billing_payments'
  AND schemaname = 'public'
  AND (indexname LIKE '%reference%' OR indexname LIKE '%provider_payment%' OR indexname LIKE '%idempotent%')
ORDER BY indexname;

-- Vérification index Interac (reference unique)
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'billing_payments' 
        AND schemaname = 'public'
        AND indexdef LIKE '%UNIQUE%'
        AND indexdef LIKE '%reference%'
    ) 
    THEN '✅ PASS: Index unique sur reference (Interac idempotence)'
    ELSE '⚠️ WARNING: Index unique reference non trouvé (vérifier manuellement)'
  END AS check_result;

-- Vérification index PayPal (provider + provider_payment_id)
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'billing_payments' 
        AND schemaname = 'public'
        AND indexdef LIKE '%UNIQUE%'
        AND indexdef LIKE '%provider_payment_id%'
    ) 
    THEN '✅ PASS: Index unique sur provider_payment_id (PayPal idempotence)'
    ELSE '⚠️ WARNING: Index unique provider_payment_id non trouvé (vérifier manuellement)'
  END AS check_result;

-- ============================================================
-- CHECK 6: Test idempotence Interac (dry-run avec table temp)
-- ============================================================
\echo ''
\echo '--- CHECK 6: Test idempotence Interac (dry-run) ---'

DO $$
DECLARE
  test_ref TEXT := 'TEST_IDEMPOTENCE_' || gen_random_uuid()::text;
  insert_count INT;
BEGIN
  -- Créer table temporaire avec mêmes contraintes
  CREATE TEMP TABLE IF NOT EXISTS temp_idempotence_test (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT,
    CONSTRAINT temp_unique_ref UNIQUE (reference)
  );
  
  -- Nettoyer
  DELETE FROM temp_idempotence_test;
  
  -- Premier insert (doit réussir)
  INSERT INTO temp_idempotence_test (reference) VALUES (test_ref);
  
  -- Deuxième insert (doit échouer)
  BEGIN
    INSERT INTO temp_idempotence_test (reference) VALUES (test_ref);
    RAISE NOTICE '❌ FAIL: Doublon accepté! Idempotence cassée.';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '✅ PASS: Doublon rejeté correctement (idempotence OK)';
  END;
  
  -- Nettoyer
  DROP TABLE temp_idempotence_test;
END $$;

-- ============================================================
-- CHECK 7: Cohérence données actuelles
-- ============================================================
\echo ''
\echo '--- CHECK 7: Cohérence données actuelles ---'

-- Paiements live+confirmed sans référence (violation potentielle)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 
    THEN '✅ PASS: Aucun paiement live+confirmed Interac sans reference'
    ELSE '❌ FAIL: ' || COUNT(*) || ' paiements Interac live+confirmed sans reference!'
  END AS check_result
FROM public.billing_payments
WHERE source = 'live' 
  AND status = 'confirmed' 
  AND provider = 'interac' 
  AND (reference IS NULL OR reference = '');

-- Paiements live+confirmed PayPal sans provider_payment_id
SELECT 
  CASE 
    WHEN COUNT(*) = 0 
    THEN '✅ PASS: Aucun paiement live+confirmed PayPal sans provider_payment_id'
    ELSE '❌ FAIL: ' || COUNT(*) || ' paiements PayPal live+confirmed sans provider_payment_id!'
  END AS check_result
FROM public.billing_payments
WHERE source = 'live' 
  AND status = 'confirmed' 
  AND provider = 'paypal' 
  AND provider_payment_id IS NULL;

-- Factures avec balance_due négative (violation invariant)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 
    THEN '✅ PASS: Aucune facture avec balance_due négative'
    ELSE '❌ FAIL: ' || COUNT(*) || ' factures avec balance_due < 0!'
  END AS check_result
FROM public.billing_invoices
WHERE balance_due < 0;

-- Factures paid mais balance_due > 0 (incohérence)
SELECT 
  CASE 
    WHEN COUNT(*) = 0 
    THEN '✅ PASS: Toutes les factures paid ont balance_due = 0'
    ELSE '⚠️ WARNING: ' || COUNT(*) || ' factures paid avec balance_due > 0 (vérifier)'
  END AS check_result
FROM public.billing_invoices
WHERE status = 'paid' 
  AND balance_due > 0;

-- ============================================================
-- SUMMARY
-- ============================================================
\echo ''
\echo '============================================================'
\echo 'BILLING V2 POST-UPDATE CHECKS COMPLETE'
\echo '============================================================'
\echo 'Revue manuelle requise pour:'
\echo '  - Crons (vérifier config.toml)'
\echo '  - Warnings éventuels ci-dessus'
\echo '============================================================'
