# Module 4 — Pause temporaire

Statut : **OPEN — STATIC FIXES DONE — E2E PENDING**

## Périmètre
`PauseAccountDialog` dans `Account360RowDialogs.tsx` (déclenché depuis `Account360QuickActions` — action « Pause temporaire »).
Applique ou lève une pause temporaire sur un `accounts.status` avec facturation réduite pendant la période.

## Corrections statiques appliquées

### Edge Function `account-ops-actions` (module orchestré — pas de nouvelle EF parallèle)
Deux nouvelles actions ajoutées à l'EF existante :
- `pause_account` : valide (`account_id`, `paused_until` futur, `reason` non vide, `pause_charge_pct` clampé 0–100). Bloque si compte déjà `suspended` (409) ou `cancelled` (409). Écrit `accounts.status='suspended'` + `paused_at` / `paused_until` / `pause_charge_pct` / `pause_reason`.
- `unpause_account` : bloque si compte non `suspended` (409). Remet `status='active'` et nettoie les colonnes de pause.
- Parité audit : `admin_audit_log` (`account_ops.pause_account` / `account_ops.unpause_account`) + `client_activity_logs` (`action_type='account_pause'`) + `client_internal_notes` (`note_type='system'`).
- Aucun email — `email_queue` non alimentée.
- Déployée.

### Dialog `PauseAccountDialog`
- Ne fait plus d'écriture directe sur `accounts`. Route via `account-ops-actions`.
- Reçoit `clientUserId` et `accountStatus` en props (câblés depuis `Account360QuickActions`).
- Détecte automatiquement l'état :
  - Compte `active` → formulaire de mise en pause (date + %).
  - Compte `suspended` → formulaire de levée de pause (motif seul).
- Motif obligatoire dans les deux cas ; bouton disabled tant que vide (ou date manquante).
- `window.confirm` avant chaque soumission.
- Reset des champs à l'ouverture.
- Mapping FR des erreurs.

## Checklist E2E (compte QA uniquement — `test-c360-planchange-v2@nivra-test.ca`)
1. Ouvrir le dialog Pause temporaire (compte actif).
2. Bouton `Mettre en pause` disabled sans motif ou sans date.
3. Saisir date passée → EF retourne « La date doit être dans le futur ».
4. Saisir date futur + motif + % → `window.confirm` → succès toast + `accounts.status='suspended'` + colonnes de pause remplies.
5. Rouvrir : dialog affiche l'état pause + formulaire de levée.
6. Bouton `Lever la pause` disabled sans motif.
7. Motif + confirm → succès toast + `accounts.status='active'` + colonnes de pause à null.
8. Re-tenter pause sur compte déjà `cancelled` → EF 409 « pause impossible ».

## Preuves DB à collecter
Pour chaque action réussie :
- `accounts` : `status`, `paused_at`, `paused_until`, `pause_charge_pct`, `pause_reason` mis à jour (pause) ou remis à null (unpause).
- `admin_audit_log` : `action='account_ops.pause_account'` ou `unpause_account`, `details.reason` non vide.
- `client_activity_logs` : `action_type='account_pause'`, `summary` FR correct.
- `client_internal_notes` : `note_type='system'`, corps FR + email admin.
- `email_queue` : **0 insertion**.

## Modifications hors périmètre
Aucune. Ajout uniquement d'actions à `account-ops-actions` (module orchestré, aucune EF parallèle créée).

## Ce que je ne fais pas
- Aucun email client (pas de notification de pause pour l'instant — pourra être ajouté explicitement plus tard).
- Aucun compte réel touché.
- Aucun changement d'abonnement (subscription) — la pause est au niveau du compte uniquement.
