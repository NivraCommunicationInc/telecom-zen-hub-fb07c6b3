# Module 7 — Enregistrer paiement

Statut : **OPEN — STATIC FIXES DONE — E2E PENDING**

## Périmètre
Enregistrement d'un paiement offline (`cash` / `cheque` / `interac`) OU application
d'un crédit compte (`credit_account`) sur une facture ouverte, depuis le Client 360.
Les paiements carte (Square) restent routés vers `core-process-card-payment` sur la
page de facture — hors périmètre de ce module.

## Architecture canonique (aucun système parallèle)
- UI : `src/core-app/components/account-360/modules/RecordPaymentModule.tsx`
  (déjà wrappé dans `ClientModuleShell` avec `requireReason`).
- Edge Function : `supabase/functions/core-record-payment/index.ts`
- RPCs canoniques :
  - `public.apply_payment_to_invoice` (cash/cheque/interac) — gère
    `billing_payments`, `billing_invoices`, `billing_provenance`, et déclenche
    les triggers reçu (`trg_payment_receipt_email`), loyalty
    (`trg_earn_loyalty_on_payment`), SMS (`trg_queue_payment_sms`).
  - `public.apply_credit_to_invoice` (credit_account) — puise dans
    `account_adjustments` (type=credit, status=active).
  - `public.core_simulate_record_payment` — lecture pure, alimente `impact`
    avant/après dans le shell.
- Audit : `admin_audit_log` action `core_record_payment` + `client_activity_logs`
  action_type `payment_recorded` + note système dans `client_internal_notes`.

## Corrections statiques déposées (ce cycle)

### `core-record-payment` (Edge Function)
- ✅ Ajout `client_activity_logs` (action_type=`payment_recorded`, entity_type=
  `billing_invoice`, before/after `balance_due` + `status`) — alignement Modules 1-6.
- ✅ Ajout `client_internal_notes` (note système `system` avec méthode, montant,
  facture, référence, motif, acteur) — alignement Modules 1-6.
- ✅ Redeploy effectué.

### Déjà en place (audit code)
- Auth staff/admin obligatoire via `has_role`.
- Motif obligatoire (min 3 chars) UI (`requireReason`) + backend.
- Rejet PayPal (Phase 3.B).
- Rejet paiement carte → route explicite vers Square.
- 400 `invoice_id`/`amount`/`method` invalide.
- 404 facture introuvable.
- 409 facture `void`/`cancelled`/`refunded`.
- Crédit compte : vérifie `account_id`, `type`, `status` avant application.
- Idempotency key transmise dans `context` RPC.
- Snapshot before/after complet dans `admin_audit_log.details`.

## Checklist E2E (à exécuter au feu vert)

Contexte : compte QA `test-c360-planchange-v2@nivra-test.ca`
(`account_id=6c163bc0…`, `client_user_id=d97815e8…`).
Prérequis : provisionner une facture ouverte en `env=test` (via cycle de
facturation QA ou seed contrôlé).

1. **T1 — Motif vide** → 400 `audit reason required (min 3 chars)`.
2. **T2 — Facture inexistante** → 404.
3. **T3 — Facture `void`/`cancelled`/`refunded`** → 409.
4. **T4 — Méthode non supportée** (ex. `paypal`) → 400.
5. **T5 — Montant ≤ 0** → 400.
6. **T6 — Paiement `interac` nominal** :
   - `billing_payments` +1 ligne (method=`interac`, provider=`interac`).
   - `billing_invoices.balance_due` diminue de `amount`, `amount_paid` augmente.
   - `billing_provenance` +1 (déclenché par RPC).
   - `admin_audit_log` +1 `core_record_payment`.
   - `client_activity_logs` +1 `payment_recorded`.
   - `client_internal_notes` +1 note système.
   - `email_queue` : reçu déclenché par trigger — **documenter** (rappel : trigger
     hors périmètre, comme F6-2).
7. **T7 — Crédit compte** :
   - `account_adjustments.applied_count` incrémenté.
   - `billing_invoice_lines` +1 (credit_applied).
   - Balance mise à jour, audit + activity + note.
   - `credit_id` manquant → 400 ; crédit `used`/`inactive` → 409 ; crédit d'un
     autre compte → 409.
8. **T8 — Overpay** : facture soldée + surplus documenté (trop-perçu selon
   triggers canoniques).
9. **Sécurité workflow** :
   - Grep : aucune écriture directe `.from("billing_payments").insert` /
     `.from("billing_invoices").update` depuis `RecordPaymentModule.tsx`.
   - Uniquement `callCoreAction("core-record-payment", …)`.
10. **Aucun email externe réel** — domaine `@nivra-test.ca`.

## Findings connus (backlog, à ne pas rouvrir ici)
- Trigger `trg_payment_receipt_email` peut enfiler `payment_receipt` sur T6/T7
  (comportement DB attendu — module communication).
- Trigger `trg_earn_loyalty_on_payment` : loyalty auto (module dédié).

## Rappel protocole
- aucun email externe (domaine QA uniquement)
- aucun compte réel touché
- aucun système parallèle : passe uniquement par les RPC canoniques
