# Module 10 — Plan de paiement

Statut : **PASS ✅** (E2E validé sur compte QA)

## Périmètre
- UI : `src/core-app/components/account-360/modules/PaymentPlanModule.tsx`
- Edge Function : `supabase/functions/billing-account-actions/index.ts`
  - `action=create_payment_plan`
  - `action=cancel_payment_plan`
- Table cible : `public.client_payment_plans`
- Traçabilité : `admin_audit_log` + `client_activity_logs` + `client_internal_notes`

## Bug racine trouvé & corrigé
**F10-1 · admin_audit_log column mismatch** — Le helper `audit()` insérait `admin_id` / `metadata`, mais la table expose `admin_user_id` / `details`. Résultat : audit silencieusement perdu (try/catch swallow) pour **toutes** les actions billing (Modules 7, 8, 10). Corrigé + `console.error` remis sur `audErr` pour ne plus perdre d’erreur.

## Résultats E2E

Compte QA : `account 200785` (`6c163bc0-…`), user `d97815e8-…`, facture `3635760` (balance 7,49 $).

| # | Cas | Résultat |
|---|---|---|
| E1 | create sans reason | 400 `reason requis (min 3)` ✅ |
| E2 | `installment_count=1` | 400 `entre 2 et 24` ✅ |
| E3 | `installment_count=25` | 400 idem ✅ |
| E4 | `total_amount=0` | 400 `total_amount invalide` ✅ |
| E5 | `frequency='daily'` | 400 `frequency invalide` ✅ |
| E6 | `first_due_date='oops'` | 400 `first_due_date invalide` ✅ |
| E7 | `total=9999` avec facture 7,49 $ | 400 **cap invoice appliqué** ✅ |
| E8 | sans `idempotency_key` | 400 ✅ |
| E9 | replay même idempotency_key | 200 `idempotent:true`, **aucun 2ᵉ insert** ✅ |
| T1 | create nominal 3× 2,00 $ monthly | 200 plan actif, activity log + note système ✅ |
| T2 | cancel sans reason | 400 ✅ |
| T3 | cancel plan_id inexistant | 404 `Plan introuvable` ✅ |
| T4 | cancel plan actif | 200, status=`cancelled`, `cancelled_reason` non-NULL, activity log + note + audit ✅ |
| T5 | cancel plan déjà annulé | 409 `Plan déjà clos` ✅ |

## Preuves SQL
- `client_payment_plans` : plan `5646e193-…` créé avec `installment_amount=2,00`, `status=cancelled`, `cancelled_reason='E2E audit trace v3 real cancel'`.
- `client_activity_logs` : 2 lignes (`payment_plan_created` + `payment_plan_cancelled`) — 1 par action, pas de doublon.
- `client_internal_notes` : 2 notes `system` correspondantes.
- `admin_audit_log` : `billing.cancel_payment_plan` écrit (après fix F10-1) avec `details.plan_id` et `details.reason` populés.
- `billing_invoices` (3635760) : `balance_due=7,49`, `amount_paid=50,00`, `status=partially_paid` — **inchangé** (aucun paiement automatique).
- `email_queue` : templates `client_payment_plan_created` + `client_payment_plan_cancelled` en `queued/sent` **uniquement vers `test-c360-planchange-v2@nivra-test.ca`** (QA).

## Point critique — cap invoice
✅ Confirmé : le plan ne peut pas planifier une dette > `balance_due` (E7 rejeté).
✅ L’annulation touche uniquement `client_payment_plans` (status + reason) — aucune écriture rétroactive sur les paiements ou la facture.

## Sécurité
- Toutes les actions passent par `callCoreAction` → EF `billing-account-actions` (aucune écriture directe UI).
- `requireFinancial=true` maintenu (rôles: admin / supervisor / billing_admin).
- Aucun 5xx, aucune erreur console pendant la passe.

## Backlog conservé
- **F9-1** : vue `client_unpaid_invoices` incompatible (workflow writeoff, hors périmètre).
