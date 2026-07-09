# Module 8 — Remboursement

Statut : **OPEN — STATIC FIXES DONE — E2E PENDING**

## Périmètre
- UI : `src/core-app/components/account-360/modules/RefundModule.tsx`
- Route canonique : `billing-account-actions` → action `create_direct_refund`
- RPC financière : `refund_payment` (chemin Square uniquement)
- Tables impactées : `client_direct_refunds`, `billing_payments`, `billing_invoices` (via RPC), `admin_audit_log`, `client_activity_logs`, `client_internal_notes`, `email_queue`

## Corrections statiques déposées ce cycle
1. **Bug critique de routage Square** : `billing-account-actions` testait `refund_method === "original"` alors que l'UI envoie `"square"`. Résultat : aucun remboursement Square ne passait par la RPC canonique `refund_payment`, seulement un `insert` dans `client_direct_refunds`. Corrigé (`refund_method === "square"`).
2. **Traçabilité client alignée Modules 1-7** : ajout de `client_activity_logs` (`action_type=refund_processed`) + `client_internal_notes` (note système) après insert du remboursement.
3. Aucun changement UI nécessaire (dialog déjà connecté à `callCoreAction`, motif ≥5 chars enforcé, idempotency_key envoyé, garde `squareWithoutSource` déjà en place).

## E2E checklist (à exécuter sur QA après feu vert)

### T1-T5 Validations erreurs
- [ ] T1 motif vide / <5 chars → 400
- [ ] T2 amount ≤ 0 → 400
- [ ] T3 refund_method invalide → 400
- [ ] T4 amount > 10 000 $ → 400 (blocage senior)
- [ ] T5 idempotency_key manquant → 400 ; rejeu même key → 200 idempotent

### T6 Remboursement Square (chemin RPC)
- [ ] Sélection paiement Square existant sur QA
- [ ] Appel `create_direct_refund` avec method=square
- [ ] Vérifier `refund_payment` RPC déclenchée (log EF)
- [ ] `billing_payments.status` → `refunded`/`partially_refunded`
- [ ] `billing_invoices.balance_due` recalculé par triggers
- [ ] `client_direct_refunds` row=1 status=processed
- [ ] `admin_audit_log` + `client_activity_logs` + `client_internal_notes` présents
- [ ] `email_queue` : snapshot avant/après (email `client_direct_refund_processed` attendu — ne pas envoyer)

### T7 Remboursement hors-Square (Interac / chèque / bank_transfer)
- [ ] Insert `client_direct_refunds` sans passage RPC (pas de mutation billing_payments — attendu)
- [ ] Audit + activity + note système écrits
- [ ] Reference externe optionnelle bien persistée

### T8 Crédit au compte (credit_balance)
- [ ] Comportement actuel : uniquement `client_direct_refunds` inséré. Vérifier qu'aucune écriture directe `account_adjustments` n'est faite (RefundModule affiche cet impact — à valider ou reporter au backlog module Ajustements unifiés)

### T9 Over-refund guard
- [ ] Tentative amount > paiement source → 400 côté EF
- [ ] Ré-remboursement au-delà du restant → refusé

### Sécurité workflow
- [ ] Grep `RefundModule.tsx` : zéro écriture directe `.from("billing_payments"|"billing_invoices"|"client_direct_refunds")` — passage exclusif via `callCoreAction`
- [ ] Rôles autorisés : admin / supervisor / billing_admin (403 sinon)

## Rappels protocole
- Compte QA uniquement (`test-c360-planchange-v2@nivra-test.ca`)
- Aucun envoi d'email réel — snapshot email_queue seulement
- Aucun paiement/carte réel

## Findings potentiels à documenter au backlog (ne pas rouvrir)
- Le chemin `credit_balance` n'écrit pas dans `account_adjustments` malgré l'affichage `impactedTables` — à traiter dans le Module Ajustements unifiés.
- Les remboursements hors Square ne touchent pas `billing_invoices.balance_due` : c'est intentionnel (paiement resté valide, remboursement traité hors-bande), mais à confirmer avec la comptabilité.
