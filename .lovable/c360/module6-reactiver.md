# Module 6 — Réactiver le compte

Statut : **OPEN — STATIC FIXES DONE — E2E PENDING**

## Corrections statiques déposées

### Edge Function `account-ops-actions` — nouvelle action `reactivate_account`
- Auth staff obligatoire (`checkStaffAuth`).
- `account_id`, `client_user_id` et `reason` (min. trimmed) obligatoires (400 sinon).
- 404 si compte introuvable.
- 409 si compte déjà `active`.
- 409 si statut hors périmètre réactivable (`cancelled`, `suspended` uniquement).
- Update `accounts` → `status='active'`, purge `cancelled_at`, `cancellation_reason`,
  `paused_at`, `paused_until`, `pause_charge_pct`, `pause_reason`.
- **Cascade abonnements** (contrôlée par le caller) :
  - `resume_suspended` (défaut `true`) → cible `status='suspended'`
  - `reactivate_cancelled` (défaut `false`, opt-in) → cible `status='cancelled'`
  - Update `billing_subscriptions.status='active'` sur `customer_id=client_user_id`
  - Idempotent : n'affecte que les statuts ciblés
- Écritures d'audit :
  - `admin_audit_log` action `account_ops.reactivate_account`
    (previous_status, reason, reactivated_subscriptions, flags cascade)
  - `client_activity_logs` action_type `account_reactivate`
  - `client_internal_notes` note système
- **Aucun email envoyé par l'EF.**
  > Note : le trigger DB `trg_review_request` sur `accounts` peut enfiler
  > `review_request_activation` lors de la transition `→ active` (comportement
  > système documenté au Module 5, hors périmètre — backlog séparé).

### UI `ReactivateAccountDialog`
- **Refonte complète** : plus aucune écriture directe (`from("accounts").update`,
  `from("billing_subscriptions").update`, `from("billing_subscription_trace_audit").insert`).
- Passe exclusivement par `callCoreAction("account-ops-actions", …)`.
- **Motif obligatoire** (min. 3 caractères), bouton désactivé sinon.
- Détection `alreadyActive` : affiche un panneau vert et masque les contrôles si le
  compte est déjà `active`.
- Reset propre du state à chaque ouverture (`reason`, `resumeSuspended`,
  `reactivateCancelled`).
- Invalidation cache via `queryClient` (invalidateAfterPayment).
- Toast erreur détaillé (via `callCoreAction`).

## Checklist E2E (à exécuter au feu vert)

Contexte : compte QA `test-c360-planchange-v2@nivra-test.ca`
(`account_id=6c163bc0…d59a73a`, `client_user_id=d97815e8…f5bbd2`) —
actuellement `cancelled` avec 1 abonnement `cancelled` (env=test)
suite au Module 5. Provisionner un compte QA-v3 si besoin.

1. **T1 — Motif vide** → 400 `Motif obligatoire`.
2. **T2 — Compte déjà actif** → 409 `Ce compte est déjà actif`.
3. **T3 — Réactivation nominale depuis `cancelled`** avec
   `reactivate_cancelled=true`, `resume_suspended=true` :
   - `accounts.status` `cancelled → active`, purge `cancelled_at`, `cancellation_reason`.
   - `billing_subscriptions.status` `cancelled → active` (1 ligne).
   - `admin_audit_log` +1 ligne `account_ops.reactivate_account`.
   - `client_activity_logs` +1 ligne `account_reactivate`.
   - `client_internal_notes` +1 note système.
4. **T4 — Réactivation depuis `suspended`** (compte QA v3 pausé) :
   - `pause_*` purgés.
   - Abonnements suspendus repris.
5. **T5 — Statut inéligible** (ex. `pending`) → 409.
6. **T6 — Cascade partielle** (`resume_suspended=false`,
   `reactivate_cancelled=false`) → compte actif, `reactivated_subscriptions=0`.
7. **Side-effect email** : documenter si `review_request_activation` a été
   enfilé par le trigger DB (rappel Module 5, hors périmètre).
8. **Aucun email externe réel** livré (domaine `@nivra-test.ca`).
9. **Aucune écriture directe** sur `accounts`/`billing_subscriptions` depuis
   le frontend (grep vérifié).

## Rappel protocole

- aucun email sans approbation
- aucun abonnement annulé/réactivé hors QA
- aucun compte client réel modifié sans avertissement
