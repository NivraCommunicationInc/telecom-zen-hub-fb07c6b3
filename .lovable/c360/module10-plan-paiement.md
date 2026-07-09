# Module 10 — Plan de paiement

Statut : **OPEN — STATIC FIXES DONE — E2E PENDING**

## Périmètre
- UI : `src/core-app/components/account-360/modules/PaymentPlanModule.tsx` (shell canonique déjà en place, contexte + simulation + audit + realtime ✅)
- Edge Function : `supabase/functions/billing-account-actions/index.ts`
  - `action=create_payment_plan`
  - `action=cancel_payment_plan`
- Table cible : `public.client_payment_plans` (source de vérité)
- Emails : `client_payment_plan_created` / `client_payment_plan_cancelled` via `email_queue`
- Traçabilité : `admin_audit_log` + `client_activity_logs` + `client_internal_notes`

## Corrections statiques déposées

Toutes appliquées à `billing-account-actions/index.ts` cette passe.

### `create_payment_plan`
1. **Reason obligatoire** — rejet 400 si `reason` < 3 caractères (alignement Module 8/9).
2. **Frequency whitelist** — rejet 400 si hors `weekly|biweekly|monthly`.
3. **first_due_date validée** — rejet 400 si date invalide.
4. **Cap invoice** — si `invoice_id` fourni, `total_amount` ne peut pas excéder `billing_invoices.balance_due` (+0.01 tolérance arrondi). Rejet 400 sinon, 404 si facture introuvable.
5. **Activity log + internal note** — parité Module 8/9 : 1 ligne `client_activity_logs` (`action_type='payment_plan_created'`) + 1 note `client_internal_notes` (`note_type='system'`).
6. Idempotency + audit + email conservés.

### `cancel_payment_plan`
1. **Reason obligatoire** — rejet 400 si `reason` < 3 caractères (avant : accepté vide, `cancelled_reason` NULL).
2. **Activity log + internal note** — parité Module 8/9.
3. Guards existants conservés (plan_id requis, cible == user, status=active).

## Ce que le E2E devra prouver

Compte QA : `test-c360-planchange@nivra-test.ca`.

| # | Cas | Attendu |
|---|---|---|
| E1 | POST create sans reason | 400 `reason requis` |
| E2 | POST create `installment_count=1` | 400 `entre 2 et 24` |
| E3 | POST create `installment_count=25` | 400 idem |
| E4 | POST create `total_amount=0` | 400 `total_amount invalide` |
| E5 | POST create `frequency='daily'` | 400 `frequency invalide` |
| E6 | POST create `first_due_date='oops'` | 400 |
| E7 | POST create `invoice_id` avec `total > balance_due` | 400 |
| E8 | POST create sans `idempotency_key` | 400 |
| E9 | POST create doublon (même idempotency_key) | 200 + `idempotent:true`, aucun 2ᵉ insert |
| T1 | POST create nominal (3× monthly) | 200, 1 row `client_payment_plans` status=active, 1 audit, 1 activity log, 1 note, 1 email enqueued |
| T2 | POST cancel sans reason | 400 |
| T3 | POST cancel `plan_id` inexistant | 404 |
| T4 | POST cancel plan T1 | 200, status=cancelled, `cancelled_reason` non-NULL, 1 audit, 1 activity log, 1 note, 1 email |
| T5 | POST cancel plan déjà cancelled | 409 |

## Findings backlog rappelés
- **F9-1** : vue `client_unpaid_invoices` incompatible avec `billing_invoices` (workflow collections/writeoff uniquement, hors périmètre).

## Notes de sécurité
- Rôles requis : `admin` / `supervisor` / `billing_admin` (ALLOWED_FINANCIAL). Vérifié : `requireFinancial=true` sur les 2 actions.
- Aucune écriture directe UI sur `client_payment_plans` (recherche `rg 'from("client_payment_plans")'` → uniquement `PaymentPlanModule.tsx` en LECTURE + EF en écriture).
- Emails : 2 templates seulement (`_created`, `_cancelled`), branchés sur `email_queue`. **Aucun envoi automatique** hors des 2 actions.

Feu vert requis avant lancement du E2E (compte QA uniquement, aucun email envoyé sur compte réel).
