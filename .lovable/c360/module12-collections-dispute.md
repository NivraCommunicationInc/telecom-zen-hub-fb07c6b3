# Module 12 — Recouvrement & Litige

Statut : **PASS ✅ — CLOSED**

## Périmètre
- UI : `src/core-app/components/account-360/modules/CollectionsDisputeModule.tsx`
- EF : `collections-account-actions`, `disputes-account-actions`
- Tables : `collections_actions`, `payment_disputes`, `billing_payments`, `client_unpaid_invoices` (union `billing` + `monthly_invoices`)

## Static fixes appliqués

1. **F12-1** — `disputes-account-actions.open_on_behalf` interrogeait `billing`. Corrigé → `billing_payments`, scope par `customer_id` (isolation client stricte).
2. **F12-2** — Trigger `enforce_dispute_client_update` bloquait les updates faits en `service_role` depuis l'EF. Corrigé pour reconnaître `service_role`.
3. **FK correction** — `payment_disputes.payment_id` FK migrée de `billing(id)` → `billing_payments(id)` `ON DELETE RESTRICT`.
4. **Traceability parity** — chaque action écrit `admin_audit_log` + `client_activity_logs` (`actor_user_id`, `actor_name`) + `client_internal_notes` (`note_type=system`).

## Preuves E2E (compte QA `d97815e8-…5bbd2`)

### Disputes
| Test | Résultat |
|---|---|
| E5 open_on_behalf sans payment_id | 400 ✅ |
| E6 open_on_behalf paiement autre client (`0fa06703-…`) | 403 « Paiement hors compte » ✅ |
| E7 request_client_info sans public_message | 400 ✅ |
| T6 open_on_behalf QA payment | `DIS-000003` créé (status=submitted) ✅ |
| T7 set_under_review | status transition + email queued ✅ |
| T8 resolve_approved | status=resolved_approved + note ✅ |

### Collections (invoice QA `be2d6d8c-…9043`, `QA-COLL-M12-001`)
| Test | Résultat |
|---|---|
| E2 create_payment_plan installments=1 | 400 « 2 à 12 versements » ✅ |
| E3 writeoff motif court | 400 « Motif de radiation requis » ✅ |
| T1 log_contact (email) | `contact_email` inséré + audit/activity/note ✅ |
| T2 create_promise 50$ 2026-07-25 | `promise_to_pay` inséré ✅ |
| T3 create_payment_plan 3× | `payment_plan` inséré + note formatée ✅ |
| T4 escalate | `escalation` inséré ✅ |
| T5 mark_resolved | `resolved` inséré ✅ |

### Traçabilité (SQL)
```
admin_audit_log account_ops.{collections_*,dispute_*} : 9 rows, 0 orphelins (admin_user_id IS NULL = 0)
client_activity_logs collections_* : 5 action_type distincts
client_internal_notes note_type=system (10 min) : 15 rows
collections_actions : 5 rows (contact_email, promise_to_pay, payment_plan, escalation, resolved)
payment_disputes : 1 row status=resolved_approved
```

## Point critique validé
**Isolation client stricte** : tentative d'ouvrir un litige sur un paiement d'un autre client retournée en 403. Aucun accès cross-tenant possible via les EFs.

## Aucun email envoyé
Les rows `email_queue` sur `@nivra-test.ca` restent en `queued`, aucun worker n'a traité durant l'E2E.
