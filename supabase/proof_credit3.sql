-- Vérifier les tables créées
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('account_credit_scores','credit_check_requests')
ORDER BY table_name;
