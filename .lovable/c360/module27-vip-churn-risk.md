# Module 27 — VIP / Churn risk / Étiquettes

Statut : **CLOSED ✅** — E2E 28/28 PASS (2026-07-10)

## Périmètre
Catalogue canonique de 15 étiquettes (`vip`, `churn_risk`, `at_risk`, `loyal`, `watchlist`, `satisfaction_risk`, `do_not_contact`, `escalation_required`, `chargeback_history`, `collections`, `fraud_suspected`, `litigation`, `payment_lock`, `portal_lock`, `full_lock`) appliquées via `account-tags-actions`. Toute mutation UI (`NpsSatisfactionDialog`, `FraudLockDialog`, `VipChurnToggleDialog`, `AccountTagsDialog`) passe désormais exclusivement par cette EF.

## Corrections statiques (F27-1 → F27-13)
- **F27-1** Suppression des `supabase.from("account_tags")` et `supabase.from("accounts").update` côté UI (`Account360NewActionDialogs.tsx`). Toute mutation via `account-tags-actions`.
- **F27-2** `ALLOWED_ROLES` par tag : `admin/super_admin` pour `fraud_suspected`, `litigation`, `chargeback_history` et les locks ; `admin/super_admin/supervisor/manager` pour VIP/churn ; `billing_admin` supplémentaire pour `collections`.
- **F27-3** `assertOwnership()` — cross-client → 403 `CROSS_CLIENT_TARGET`.
- **F27-4** Motif obligatoire ≥ 5 caractères (10 pour les locks).
- **F27-5** Idempotency via `admin_audit_log` (replay détecté et retourné).
- **F27-6** Catalogue serveur = 15 tags officiels (labels + severity forcés côté serveur).
- **F27-7** `expires_at` doit être futur ; tags expirés masqués dans `list`.
- **F27-8** `apply_lock` mute `accounts.status = 'suspended'` côté serveur (plus jamais côté UI).
- **F27-9** Erreurs normalisées (`UNKNOWN_TAG`, `REASON_REQUIRED`, `FORBIDDEN_ROLE`, `CROSS_CLIENT_TARGET`, `DUPLICATE_ACTIVE`, `NOT_FOUND`, `INVALID_INPUT`, `RATE_LIMIT`).
- **F27-10** Audit unifié : `admin_audit_log`, `client_activity_logs` (`action_type='account_tag'`), `activity_logs` (`entity_type='account_tag'`), `client_internal_notes` (`note_type='system'`).
- **F27-11** Anti-flood : 20 mutations / 60 s → 429.
- **F27-12** `actor_role` réel extrait de `user_roles`.
- **F27-13** Runner E2E dédié `qa-module27-runner`.

## Preuves E2E (28 checks)
C1 list · C2 catalogue 15 · C3 UNKNOWN_TAG · C4/C5 REASON_REQUIRED · C6 sales+fraud 403 · C7 sales+vip 403 · C8 supervisor+vip 200 · C9 cross-client 403 · C10 admin+churn_risk 200 · C11 DUPLICATE_ACTIVE 409 · C12 expires_at passé 400 · C13 expires_at futur 200 · C14 masque expirés · C15 idempotency replay · C16 remove sans motif · C17 remove NOT_FOUND · C18 remove OK · C19 lock_mode invalide · C20 supervisor+apply_lock 403 · C21 lock motif <10 · C22 full_lock → status=suspended + tag · C23 payment_lock (status inchangé) · C24 admin_audit_log · C25 client_activity_logs · C26 activity_logs · C27 client_internal_notes · C28 anti-flood 429.

Résultat final : **28/28 PASS** — Module 27 CLOSED.
