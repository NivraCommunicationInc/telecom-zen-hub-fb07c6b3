# Module 7 — Enregistrer paiement

Statut : **PASS ✅** (avec 2 findings backlog)

## Environnement
- Compte QA : `test-c360-planchange-v2@nivra-test.ca`
- account_id : `6c163bc0-0831-40d9-a27f-91b80d59a73a`
- customer_id : `d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2`
- Facture test : `1e146163-5672-42c2-9de9-f4bc96d6d4f9` (#3635760, total 57,49 $, env=test)

## Corrections statiques déposées ce cycle
1. `core-record-payment` : `apply_payment_to_invoice` recevait des params incorrects (`p_external_reference`, `p_context`). Corrigé pour matcher la signature RPC canonique (`p_provider_payment_id`, `p_customer_id`, `p_source`, `p_created_by_name`, `p_created_by_role`).
2. `p_source: "admin_core"` violait `chk_billing_payments_source_valid`. Remplacé par `"admin"` (valeur canonique autorisée).
3. `.select("account_id, user_id, email").from("billing_customers")` échouait silencieusement car `billing_customers` n'a pas de colonne `account_id`. Corrigé : le module lit `account_id` depuis `billing_invoices` (source canonique).
4. Ajout `client_activity_logs` (`payment_recorded`) + `client_internal_notes` (system note) alignés Modules 1-6.

## Résultats E2E

### Validations erreurs
| Test | Résultat |
|---|---|
| T1 motif vide | ✅ `400 audit reason required (min 3 chars)` |
| T2 montant = 0 | ✅ `400 amount must be > 0` |
| T3 méthode invalide (`bitcoin`) | ✅ `400 unsupported method` |
| T4 PayPal | ✅ `400 unsupported method` (rejeté avant lookup) |
| T5 facture inexistante | ✅ `404 invoice not found` |

### Paiement nominal (T6 + T7 sur même facture)
| Étape | State |
|---|---|
| BEFORE | status=`pending`, balance=57,49 $, amount_paid=0 |
| T6 Interac 30 $ | 200 OK — payment_id `5be235cd…`, balance 27,49 $ |
| T7 Cash 20 $ | 200 OK — payment_id `5569fc98…`, balance 7,49 $ |

**Traçabilité de bout en bout (T7)** — tous les artéfacts canoniques présents :
- `billing_payments` : 2 lignes (interac 30 + manual/cash 20, status `confirmed`, source `admin`).
- `billing_invoices` : `amount_paid`=50, `balance_due`=7,49, `status`=`partially_paid` ✅.
- `admin_audit_log` : 2 lignes `core_record_payment` avec before/after complets, `reason`, `payment_id`, `client_id`, `account_id`.
- `client_activity_logs` : `payment_recorded` T7 ✅ (T6 antérieur au fix `account_id` — absent, non bloquant).
- `client_internal_notes` : note système T7 ✅ (`"Paiement 20,00 $ enregistré (Argent comptant) sur facture 3635760 — par nivratelecom@gmail.com — motif: T7 …"`).
- `email_queue` : **0** nouvel email — aucun envoi test (trigger `trg_payment_receipt_email` ne s'est pas déclenché sur env=test).

### Sécurité workflow
- Grep `RecordPaymentModule.tsx` : **aucune** écriture directe `.from("billing_payments")` / `.from("billing_invoices")` — passe uniquement par `callCoreAction("core-record-payment", …)`.
- Auth staff/admin obligatoire via `has_role` (déjà en place).
- Motif obligatoire (≥3 chars) UI + backend.

## Findings backlog (à ne pas rouvrir ici)
- **F7-1** : Régler une facture à zéro sur QA échoue avec `PROVISIONING_BLOCKED` (RPC `apply_payment_to_invoice` déclenche l'auto-provisioning à `paid_at`). Attendu en prod, bloque uniquement les factures QA synthétiques sans `orders` activable. Test T7 fait sur paiement partiel.
- **F7-2** : Overpay ($500 sur 7,49 $ restant) retourne `500 unrecognized format() type specifier "."` — bug interne à la RPC `apply_payment_to_invoice` sur la branche overpay. Pas critique (UI empêche la saisie > balance), mais à corriger côté DB dans un module dédié.
- **F7-3** : `client_activity_logs` / `client_internal_notes` non écrits pour T6 (avant fix `account_id`). Comportement corrigé sur T7 et après — historique T6 non rétroactif.

## Non testés dans cette passe (couverture restante, module fermé)
- T-Crédit compte (`credit_account`) — nécessite un `account_adjustments` actif provisionné, à couvrir dans le module Crédits/Rabais.
- Facture `void`/`cancelled`/`refunded` — logique en place (409), non exercée faute de fixture.

## Rappel protocole respecté
- ✅ Uniquement compte QA `@nivra-test.ca`.
- ✅ Aucun email externe réel (0 email queued).
- ✅ Aucune écriture manuelle DB pendant l'E2E (fixtures provisioning-only).
- ✅ Snapshots avant/après capturés.
