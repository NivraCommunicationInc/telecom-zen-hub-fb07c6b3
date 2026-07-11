
# Module 48 — Account Ownership Transfer

Nouveau module Client 360 pour transférer la responsabilité d'un compte télécom d'un client vers un autre, avec workflow de consentement, audit complet et notifications.

## Livrables

### 1. Base de données (migration)

**Table `public.account_ownership_transfers`** (avec GRANT + RLS)
- Colonnes : `id`, `account_id`, `old_client_id`, `new_client_id`, `requested_by`, `status` (enum), `transfer_type` (`personal_transfer` | `business_transfer`), `services_transferred jsonb`, `billing_transfer_option` (`new_owner_all` | `old_keeps_debt` | `full_transfer`), `equipment_transfer_option`, `service_address_option` (`keep` | `new`), `new_service_address jsonb`, `old_owner_confirmed_at`, `new_owner_confirmed_at`, `completed_at`, `cancelled_at`, `expires_at`, `reason`, `correlation_id`, `created_at`, `updated_at`.
- Enum `account_transfer_status`: `pending_review`, `awaiting_old_owner_confirmation`, `awaiting_new_owner_confirmation`, `approved`, `processing`, `completed`, `cancelled`, `rejected`, `expired`, `failed`.
- RLS : admin/supervisor SELECT ; write via service_role uniquement.

**Table `public.account_transfer_idempotency`**
- `idempotency_key` unique, `request_hash`, `result jsonb`, `status`, `created_at`.
- Retour du résultat existant sur même clé ; 409 sur hash différent.

**RPC** `rpc_account_transfer_transition(p_transfer_id, p_next_status, p_actor)` : machine à états stricte (aucun retour arrière hors `cancelled`/`rejected`/`failed`).

**Vue** `v_customer_timeline` : étendre pour inclure `account_ownership_transfers` avec `visibility='staff'`.

**Trigger** : `updated_at`.

### 2. Edge Function `account-transfer-actions`

Actions (Zod validées) :
- `create_transfer` — recherche/création nouveau propriétaire, écrit ligne + envoie 2 emails de consentement.
- `approve_old_owner` / `approve_new_owner` — token signé dans l'URL email.
- `cancel_transfer` / `reject_transfer`
- `execute_transfer` — transaction atomique :
  1. Réaffecter `accounts.client_id`, `orders.user_id` (services sélectionnés), `billing_subscriptions`, `equipment_inventory`.
  2. Selon `billing_transfer_option` : garder ou transférer `billing_invoices` impayées.
  3. Purger `client_payment_methods` du nouveau (ne pas transférer cartes).
  4. Écrire `admin_audit_log`, `writeAccountJournal` (ancien + nouveau), timeline.
  5. Notifs via `rpc_communication_enqueue` (`transfer_completed_*`).
- `rollback_transfer` — réversion tant que `completed_at` < 24h.

Guards :
- Balance impayée > 0 → exige `admin_override=true` + `reason`.
- Compte suspendu → autorisé mais conserve état.
- RBAC serveur : `has_role('admin')` ou `has_role('supervisor')`.
- Idempotency obligatoire (`account_transfer:{account_id}:{nonce}`).

### 3. Templates email (React Email, `_shared/transactional-email-templates/`)

- `transfer-requested-old-owner.tsx` — bouton "Confirmer/Refuser".
- `transfer-requested-new-owner.tsx` — bouton "Accepter les responsabilités" + création de mot de passe.
- `transfer-completed-old-owner.tsx`
- `transfer-completed-new-owner.tsx`
- `transfer-cancelled.tsx`

Design : template bleu #0066CC. Enregistrer dans `registry.ts`. Deploy.

### 4. UI Nivra Core (`src/core-app/`)

Wizard 4 étapes dans `AccountOwnershipTransferDialog.tsx`, ouvert depuis `Account360QuickActions.tsx` (visible admin/supervisor seulement via `useIsCoreAdmin` + rôle supervisor).

- **Étape 1** — Recherche via `search_clients_unified` OU onglet "Nouveau client" (form complet).
- **Étape 2** — Résumé compte actuel (services, équipements, factures, balance, tickets) + résumé nouveau propriétaire.
- **Étape 3** — Options : checkboxes services, radio billing (3 options), équipements, adresse.
- **Étape 4** — Confirmation + envoi.

Page publique `/account-transfer/confirm/:token` pour la confirmation des deux parties (client portal ou public).

### 5. Journal & Timeline

`writeAccountJournal` avec eventKeys :
- `account_transfer:{account_id}:created`
- `account_transfer:{account_id}:old_owner_confirmed`
- `account_transfer:{account_id}:new_owner_confirmed`
- `account_transfer:{account_id}:completed`
- `account_transfer:{account_id}:cancelled`

Visibility `admin` pour événements, `staff` pour timeline.

### 6. QA — `qa-module48-runner`

Cas couverts : succès complet, client inexistant, email invalide, double clic (idempotency), refus ancien/nouveau, dette, suspension, transfert partiel, RLS anon, employee non autorisé, timeline présente, emails enfilés, rollback.

Sortie : Run ID + PASS count consigné dans `.lovable/module48-report.md`.

## Ordre d'exécution

1. Migration DB (table, enum, RPC, idempotency, timeline view, GRANTs, RLS).
2. Edge Function `account-transfer-actions` + secrets si besoin.
3. Templates email + `registry.ts` + deploy.
4. UI Core (dialog + wizard + entrypoint action).
5. Page publique de confirmation.
6. QA runner + rapport.
7. Preuves : migration appliquée, EF déployée, tests QA, screenshots UI, liste fichiers modifiés.

## Notes techniques

- Aucun INSERT/UPDATE direct frontend sur `accounts`, `orders`, `billing_*`, `equipment_inventory`.
- Toutes les communications via `rpc_communication_enqueue` + `communication_idempotency`.
- Cartes de paiement (`client_payment_methods`) : jamais transférées, purgées côté nouveau propriétaire.
- Machine à états : transitions unidirectionnelles sauf `cancelled`/`rejected`/`failed` terminaux.
- Expiration automatique après 7 jours sans confirmation (cron optionnel — hors périmètre initial, marqué en tâche de fond).

Confirme pour lancer la Phase 1 (migration DB).
