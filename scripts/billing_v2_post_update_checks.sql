-- ============================================================
-- Billing V2 — Post-Update Verification Script
-- Nivra Telecom
-- ============================================================
-- PROCÉDURE D'EXÉCUTION:
-- 1. Aller dans Lovable → Cloud View → "Run SQL"
-- 2. Sélectionner l'environnement (Test ou Live)
-- 3. Coller ce script entier
-- 4. Exécuter
-- 5. Vérifier que TOUS les résultats sont "PASS"
--
-- RÔLE REQUIS: postgres (admin) ou service_role
-- TEMPS: ~5 secondes
-- ============================================================
-- CE SCRIPT NE MODIFIE AUCUNE DONNÉE RÉELLE
-- ============================================================

-- Table temporaire pour collecter les résultats
DROP TABLE IF EXISTS _billing_v2_check_results;
CREATE TEMP TABLE _billing_v2_check_results (
  check_id INT,
  check_name TEXT,
  status TEXT,  -- 'PASS', 'FAIL', 'WARNING'
  details TEXT
);

-- ============================================================
-- CHECK 1: Trigger sync_billing_invoice_balance sur billing_invoices
-- ============================================================
INSERT INTO _billing_v2_check_results
SELECT 
  1,
  'Trigger balance sur billing_invoices',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgrelid = 'public.billing_invoices'::regclass 
        AND tgname LIKE '%balance%'
        AND tgenabled != 'D'
    ) THEN 'PASS'
    ELSE 'FAIL'
  END,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgrelid = 'public.billing_invoices'::regclass 
        AND tgname LIKE '%balance%'
        AND tgenabled != 'D'
    ) THEN 'Trigger actif'
    ELSE 'TRIGGER MANQUANT! balance_due ne sera pas recalculé.'
  END;

-- ============================================================
-- CHECK 2: Trigger sync_invoice_amount_paid sur billing_payments
-- ============================================================
INSERT INTO _billing_v2_check_results
SELECT 
  2,
  'Trigger sync sur billing_payments',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgrelid = 'public.billing_payments'::regclass 
        AND tgname LIKE '%sync%'
        AND tgenabled != 'D'
    ) THEN 'PASS'
    ELSE 'FAIL'
  END,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgrelid = 'public.billing_payments'::regclass 
        AND tgname LIKE '%sync%'
        AND tgenabled != 'D'
    ) THEN 'Trigger actif'
    ELSE 'TRIGGER MANQUANT! amount_paid ne sera pas synchronisé.'
  END;

-- ============================================================
-- CHECK 3: Contrainte chk_billing_payments_source_valid
-- ============================================================
INSERT INTO _billing_v2_check_results
SELECT 
  3,
  'Contrainte source_valid',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'public.billing_payments'::regclass 
        AND conname = 'chk_billing_payments_source_valid'
    ) THEN 'PASS'
    ELSE 'FAIL'
  END,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'public.billing_payments'::regclass 
        AND conname = 'chk_billing_payments_source_valid'
    ) THEN 'Valeurs: live, legacy_migration, test, manual_correction'
    ELSE 'CONTRAINTE MANQUANTE! source non validée.'
  END;

-- ============================================================
-- CHECK 4: Contrainte chk_provider_confirmed_reference (Interac/PayPal)
-- ============================================================
INSERT INTO _billing_v2_check_results
SELECT 
  4,
  'Contrainte provider_confirmed_reference (Interac+PayPal)',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'public.billing_payments'::regclass 
        AND conname = 'chk_provider_confirmed_reference'
    ) THEN 'PASS'
    ELSE 'FAIL'
  END,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conrelid = 'public.billing_payments'::regclass 
        AND conname = 'chk_provider_confirmed_reference'
    ) THEN 'Interac=reference, PayPal=provider_payment_id (live+confirmed)'
    ELSE 'CONTRAINTE MANQUANTE! Cohérence provider non enforced.'
  END;

-- ============================================================
-- CHECK 5: Index unique reference (Idempotence Interac)
-- ============================================================
INSERT INTO _billing_v2_check_results
SELECT 
  5,
  'Index unique reference (Interac idempotence)',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'billing_payments' 
        AND schemaname = 'public'
        AND indexdef LIKE '%UNIQUE%'
        AND indexdef LIKE '%reference%'
    ) THEN 'PASS'
    ELSE 'FAIL'
  END,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'billing_payments' 
        AND schemaname = 'public'
        AND indexdef LIKE '%UNIQUE%'
        AND indexdef LIKE '%reference%'
    ) THEN 'Anti-doublon Interac actif'
    ELSE 'INDEX MANQUANT! Doublons Interac possibles.'
  END;

-- ============================================================
-- CHECK 6: Index unique (provider, provider_payment_id) (Idempotence PayPal)
-- ============================================================
INSERT INTO _billing_v2_check_results
SELECT 
  6,
  'Index unique provider_payment_id (PayPal idempotence)',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'billing_payments' 
        AND schemaname = 'public'
        AND indexdef LIKE '%UNIQUE%'
        AND indexdef LIKE '%provider_payment_id%'
    ) THEN 'PASS'
    ELSE 'FAIL'
  END,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'billing_payments' 
        AND schemaname = 'public'
        AND indexdef LIKE '%UNIQUE%'
        AND indexdef LIKE '%provider_payment_id%'
    ) THEN 'Anti-doublon PayPal actif'
    ELSE 'INDEX MANQUANT! Doublons PayPal possibles.'
  END;

-- ============================================================
-- CHECK 7: Aucune facture avec balance_due négative
-- ============================================================
INSERT INTO _billing_v2_check_results
SELECT 
  7,
  'Aucune facture balance_due < 0',
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN COUNT(*) = 0 
    THEN 'Invariant respecté'
    ELSE COUNT(*) || ' factures avec balance négative!'
  END
FROM public.billing_invoices
WHERE balance_due < 0;

-- ============================================================
-- CHECK 8: Crons pg_cron actifs (billing-related)
-- ============================================================
INSERT INTO _billing_v2_check_results
SELECT 
  8,
  'Crons pg_cron billing actifs',
  CASE 
    WHEN (
      SELECT COUNT(*) FROM cron.job 
      WHERE jobname IN (
        'payment-reminders-hourly',
        'billing-check-overdue-hourly', 
        'billing-generate-renewals-hourly'
      )
    ) >= 3 THEN 'PASS'
    ELSE 'FAIL'
  END,
  (
    SELECT string_agg(jobname, ', ' ORDER BY jobname)
    FROM cron.job 
    WHERE jobname LIKE '%billing%' OR jobname LIKE '%payment%' OR jobname LIKE '%renewal%'
  );

-- ============================================================
-- CHECK 9: Aucun doublon reference (Interac - data health)
-- ============================================================
INSERT INTO _billing_v2_check_results
SELECT 
  9,
  'Aucun doublon reference (Interac)',
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN COUNT(*) = 0 
    THEN 'Aucun doublon détecté'
    ELSE COUNT(*) || ' reference(s) en doublon: ' || (
      SELECT string_agg(reference, ', ')
      FROM (
        SELECT reference
        FROM public.billing_payments
        WHERE reference IS NOT NULL AND reference != ''
        GROUP BY reference
        HAVING COUNT(*) > 1
        LIMIT 5
      ) dups
    )
  END
FROM (
  SELECT reference
  FROM public.billing_payments
  WHERE reference IS NOT NULL AND reference != ''
  GROUP BY reference
  HAVING COUNT(*) > 1
) duplicates;

-- ============================================================
-- CHECK 10: Aucun doublon provider_payment_id par provider (PayPal)
-- ============================================================
INSERT INTO _billing_v2_check_results
SELECT 
  10,
  'Aucun doublon provider_payment_id (PayPal)',
  CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
  CASE WHEN COUNT(*) = 0 
    THEN 'Aucun doublon détecté'
    ELSE COUNT(*) || ' provider_payment_id en doublon: ' || (
      SELECT string_agg(provider || ':' || provider_payment_id, ', ')
      FROM (
        SELECT provider, provider_payment_id
        FROM public.billing_payments
        WHERE provider_payment_id IS NOT NULL
        GROUP BY provider, provider_payment_id
        HAVING COUNT(*) > 1
        LIMIT 5
      ) dups
    )
  END
FROM (
  SELECT provider, provider_payment_id
  FROM public.billing_payments
  WHERE provider_payment_id IS NOT NULL
  GROUP BY provider, provider_payment_id
  HAVING COUNT(*) > 1
) duplicates;

-- ============================================================
-- RÉSULTATS FINAUX
-- ============================================================

-- Afficher tous les résultats
SELECT 
  check_id AS "#",
  check_name AS "Invariant",
  CASE status
    WHEN 'PASS' THEN '✅ PASS'
    WHEN 'FAIL' THEN '❌ FAIL'
    WHEN 'WARNING' THEN '⚠️ WARNING'
  END AS "Résultat",
  details AS "Détails"
FROM _billing_v2_check_results
ORDER BY check_id;

-- Résumé
SELECT 
  '======== RÉSUMÉ ========' AS " ",
  COUNT(*) FILTER (WHERE status = 'PASS') || '/10 PASS' AS "Score",
  CASE 
    WHEN COUNT(*) FILTER (WHERE status = 'FAIL') = 0 
    THEN '✅ TOUS LES CHECKS PASSENT'
    ELSE '❌ ' || COUNT(*) FILTER (WHERE status = 'FAIL') || ' ÉCHEC(S) - CORRIGER AVANT DÉPLOIEMENT'
  END AS "Verdict"
FROM _billing_v2_check_results;

-- Si FAIL, lever une exception pour bloquer clairement
DO $$
DECLARE
  fail_count INT;
  fail_names TEXT;
BEGIN
  SELECT COUNT(*), string_agg(check_name, ', ')
  INTO fail_count, fail_names
  FROM _billing_v2_check_results
  WHERE status = 'FAIL';
  
  IF fail_count > 0 THEN
    RAISE EXCEPTION E'\n\n❌❌❌ BILLING V2 CHECK FAILED ❌❌❌\n\n% invariant(s) en échec:\n%\n\nNE PAS DÉPLOYER avant correction!\n', fail_count, fail_names;
  END IF;
END $$;

-- Nettoyage
DROP TABLE IF EXISTS _billing_v2_check_results;
