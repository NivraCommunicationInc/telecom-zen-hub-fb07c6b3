# Module 11 — AutoPay & méthode de paiement

Statut : **OPEN — STATIC FIXES DONE — E2E PENDING**

## Périmètre
- UI : `src/core-app/components/account-360/modules/AutopayModule.tsx`
- EF : `supabase/functions/core-apply-autopay-action/index.ts`
- Actions : `enable_autopay`, `disable_autopay`, `detach_card`, `retry_now`, `record_replace_card`
- Tables source : `billing_customers`, `billing_invoices`, `square_payment_attempts`
- Traçabilité : `admin_audit_log` + `client_activity_logs` + `client_internal_notes`

## Static fixes appliqués

1. **Traceability parity (F10-1 aligné)** — chaque action écrit :
   - `admin_audit_log` (mapping `admin_user_id` / `details`) avec `before_state` + `after_state` + `console.error` sur échec.
   - `client_activity_logs` avec `action_type` explicite (`autopay_enabled|disabled|card_detached|retry_forced|card_replaced`).
   - `client_internal_notes` (`note_type=system`) avec motif + acteur.
2. **Fix insertion audit orpheline côté client** — l'ancien `onSaved` du widget `SquareCardForm` insérait directement dans `admin_audit_log` avec `admin_user_id: null` (perte d'attribution + risque RLS). Remplacé par `callCoreAction("core-apply-autopay-action", { action: "record_replace_card", ... })`.
3. **`record_replace_card`** — nouvelle action serveur qui stampe uniquement l'audit + activity + note après attache réussie de la carte via widget Square (aucune écriture directe UI sur `admin_audit_log`).
4. **`invalid action` étendu** — `VALID_ACTIONS` inclut désormais `record_replace_card`.

## Non modifié (déjà conforme)
- Délégation vers `square-detach-card` pour la suppression canonique + email `autopay_cancelled`.
- Délégation vers `square-autopay-retry` pour l'exécuteur immédiat sur `retry_now`.
- Contrôle d'accès `has_role(admin|staff|core)` + `__audit_reason` requis (min 3).
- UI shell : simulation impact, impactedTables, plannedEmails, tabs Etat/Historique/Actions.

## Plan E2E (à lancer sur QA)
1. **E1** `enable_autopay` sans carte → 400.
2. **E2** `disable_autopay` alors qu'inactif → 200 `already_disabled`.
3. **E3** `retry_now` avec AutoPay off → 400.
4. **E4** action invalide → 400.
5. **T1** `enable_autopay` avec carte → BC.autopay_enabled=true + audit + activity + note.
6. **T2** `disable_autopay` → autopay_enabled=false + autopay_discount_active=false.
7. **T3** `record_replace_card` (payload brand/last4) → audit + activity + note (aucune modification BC).
8. **T4** `retry_now` avec 0 facture éligible → 200 `invoices_rescheduled=[]`, aucun email.
9. **T5** `detach_card` → délégation EF + audit + activity + note + email `autopay_cancelled` file d'attente QA.

Feu vert pour lancer le E2E ?
