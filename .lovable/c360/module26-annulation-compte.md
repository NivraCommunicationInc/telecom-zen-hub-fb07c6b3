# Module 26 — Annulation compte

**Statut :** CLOSED ✅
**Date :** 2026-07-10
**E2E :** 26/26 PASS (`qa-module26-runner`)

## Findings corrigés
- **F26-1** Ownership cross-client (compte ↔ client_user_id) → 403 CROSS_CLIENT_TARGET + audit
- **F26-2** Cascade via `billing_customers.id` canonique (plus par user_id)
- **F26-3** Emails bilingues `client_account_cancelled` (FR/EN)
- **F26-4** Motif obligatoire ≥ 5 caractères
- **F26-5** AutoPay désactivé côté `billing_customers`
- **F26-6** Idempotency via `idempotency_key` (rejoue → `idempotent=true`)
- **F26-7** Audit `before_state` / `after_state` complet
- **F26-8** Solde impayé : blocage si `acknowledge_unpaid` absent, agrégé depuis `billing_invoices`
- **F26-9** Demandes de retour d'équipement créées automatiquement (`reason=account_cancelled`, `status=pending`)
- **F26-10** UI : bandeau d'impact + checkboxes de confirmation (solde, équipement)
- **F26-11** Rôles restreints (ALLOWED_ROLES) + refus audité

## Correctifs infra
- Extension du CHECK `support_tickets_source_chk` pour inclure les tickets système générés par les demandes de retour équipement.

## Fichiers clés
- `supabase/functions/account-ops-actions/index.ts` (branche `cancel_account`)
- `src/core-app/components/account-360/Account360RowDialogs.tsx` (CancelAccountDialog)
- `supabase/functions/_shared/customQueueTemplates.ts` (`client_account_cancelled`)
- `supabase/functions/qa-module26-runner/index.ts` (E2E)
