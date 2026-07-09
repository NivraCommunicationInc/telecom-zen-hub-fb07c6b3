# Module 12 — Recouvrement & Litige

Statut : **OPEN — STATIC FIXES DONE — E2E PENDING**

## Périmètre
- UI : `src/core-app/components/account-360/modules/CollectionsDisputeModule.tsx`
- EF : `supabase/functions/collections-account-actions/index.ts`
       `supabase/functions/disputes-account-actions/index.ts`
- Actions collections : `log_contact`, `create_promise`, `create_payment_plan`, `escalate`, `writeoff`, `mark_resolved`, `add_note`
- Actions litiges : `open_on_behalf`, `set_under_review`, `request_client_info`, `resolve_approved`, `resolve_rejected`, `add_staff_note`
- Tables source : `collections_actions`, `payment_disputes`, `billing_payments`, `client_unpaid_invoices`
- Traçabilité : `admin_audit_log` + `client_activity_logs` + `client_internal_notes`

## Static fixes appliqués

1. **F12-1** — `disputes-account-actions.open_on_behalf` interrogeait `from("billing")` alors que le module UI liste les paiements depuis `billing_payments`. Corrigé : lookup `billing_payments` + scope par `customer_id`. Retourne désormais 404 propre au lieu de 403 systématique.
2. **Traceability parity (F10-1 aligné)** — les deux EFs écrivent maintenant :
   - `admin_audit_log` (déjà présent, conservé)
   - `client_activity_logs` avec `actor_user_id`, `actor_name`, `action_type` explicite par action (`collections_*` / `dispute_*`)
   - `client_internal_notes` (`note_type=system`) systématique
3. **Aucun email sans approbation** — les emails brandés existants (`client_collections_*`, `client_dispute_status_update`) restent gated par la présence de `clientEmail`. Aucun nouvel envoi ajouté.

## Non modifié (déjà conforme)
- Contrôle d'accès `checkStaffAuth` + `writeoff` restreint `admin|billing_admin`.
- Motifs obligatoires (min. longueur) sur `escalate`, `writeoff`, `resolve_approved/rejected`, `request_client_info`, `add_note/staff_note`.
- Scope defense-in-depth des UPDATE `payment_disputes` par `id + user_id`.
- Templates PDF `collections_transfer` + `chargeback_notice` inchangés.

## Plan E2E (à lancer sur QA)

### Collections
1. **E1** `create_promise` sans montant → 400.
2. **E2** `create_payment_plan` avec installments=1 → 400.
3. **E3** `writeoff` sans motif suffisant → 400.
4. **E4** `writeoff` par rôle non-admin → 403.
5. **T1** `log_contact` (email) → row collections_actions + audit + activity + note + email queued.
6. **T2** `create_promise` valide → amount_promised/promise_date persistés.
7. **T3** `create_payment_plan` (3×) → note plan formatée + email queued.
8. **T4** `escalate` → row escalation + PDF `collections_transfer` en attachment.
9. **T5** `mark_resolved` / `add_note` → parité audit/activity/note.

### Disputes
10. **E5** `open_on_behalf` sans payment_id → 400.
11. **E6** `open_on_behalf` avec payment d'un autre client → 403.
12. **E7** `request_client_info` sans public_message → 400.
13. **T6** `open_on_behalf` valide → payment_disputes.status=submitted + audit + activity + note.
14. **T7** `set_under_review` → status transition + email `client_dispute_status_update` queued.
15. **T8** `resolve_approved` avec resolution_notes → status + email + note.
16. **T9** `resolve_rejected` avec rejection_reason → status + email + note.
17. **T10** `add_staff_note` → staff_notes append + activity + note.

## Points de vigilance
- **Aucun audit orphelin** : vérifier `admin_user_id IS NOT NULL` sur toutes les entrées `account_ops.collections_*` et `account_ops.dispute_*`.
- **Aucun compte réel** : E2E uniquement sur compte QA `test-c360-planchange@nivra-test.ca`.
- **Aucun email envoyé hors approbation** : la file `email_queue` doit contenir les rows mais aucun worker ne doit les traiter durant l'E2E QA.
