# Module 3 — VIP / Churn risk

Statut : **OPEN — STATIC FIXES DONE — E2E PENDING**

## Périmètre
`VipChurnToggleDialog` dans `Account360NewActionDialogs.tsx` — application/retrait des étiquettes officielles `vip` et `churn_risk` sur un compte client.

## Corrections statiques appliquées

### Edge Function `account-tags-actions`
- **Bugs bloquants corrigés** (signalés : cette EF est aussi utilisée par `AccountTagsDialog` — Module « Étiquettes & alertes ») :
  - `user.id` → `userData.user.id` (référence non définie qui plantait `add`/`remove`).
  - `json(403, {...})` inversé → `json({...}, 403)`.
- **Parité audit avec Modules 1 & 2** : insertion `client_activity_logs` (`action_type = "account_tag"`) + `client_internal_notes` (`note_type = "system"`) sur `add` et `remove`, en plus de `admin_audit_log` existant.
- **Preset `churn_risk`** ajouté au catalogue exposé au UI.
- Déployée.

### Dialog `VipChurnToggleDialog`
- Ne fait plus d'écriture directe sur `account_tags`. Route via `account-tags-actions` (actions `list` / `add` / `remove`).
- Chargement de l'état existant à l'ouverture : détecte si VIP ou Risque de churn est déjà posée et affiche la date + la note.
- **Motif obligatoire** (Textarea) — bouton disabled tant que vide.
- Confirmation `window.confirm` sur `remove`.
- Support du **retrait** de l'étiquette (nouveau flux).
- Mapping FR des erreurs (`Motif obligatoire`, `Cette étiquette existe déjà sur ce compte`, `Action réservée au personnel autorisé`, `Étiquette introuvable`).
- Invalidate `useInvalidateClient` + `onRefresh` après succès.

## Modifications hors périmètre — SIGNALÉES
Les correctifs de bugs dans `account-tags-actions` bénéficient aussi à `AccountTagsDialog` (Module « Étiquettes & alertes », statut backlog 🟡).
Aucune modification du dialog `AccountTagsDialog` lui-même.
Aucune migration DB. Aucune modification d'un compte client. Aucun email envoyé.

## Checklist E2E (compte QA uniquement — `test-c360-planchange-v2@nivra-test.ca`)

1. Ouvrir le dialog VIP/Churn depuis le 360.
2. Sélectionner `VIP` — l'état "Aucune étiquette de ce type" doit s'afficher.
3. Tentative `Appliquer` sans motif → bouton disabled.
4. Saisir motif → `Appliquer` → toast succès "Étiquette VIP appliquée".
5. Rouvrir : l'état doit afficher "Actuellement appliquée le …" + bouton `Retirer` visible.
6. `Retirer` sans motif → bouton disabled. Avec motif → confirm → toast succès "Étiquette retirée".
7. Basculer sur `Risque de churn` → répéter add + remove.
8. Cas d'erreur : réappliquer VIP sans clore, essayer d'ajouter à nouveau via un second onglet / rafraîchir puis add → toast "Cette étiquette existe déjà sur ce compte".

## Preuves DB à collecter

Pour chaque action réussie (add/remove) :
- `account_tags` : ligne présente (add) ou supprimée (remove).
- `admin_audit_log` : `action` = `account_ops.tag_add` / `account_ops.tag_remove` ; `details.reason` non vide.
- `client_activity_logs` : `action_type = 'account_tag'`, `summary` FR correct.
- `client_internal_notes` : `note_type = 'system'`, corps FR contenant l'action + l'email de l'admin.
- `customer_portal_snapshots.last_refreshed_at` : à vérifier (projection éventuelle sur `account_tags`).
- `email_queue` : **0 insertion** — aucune notification client n'est prévue pour ce module.

## Ce que je ne fais pas
- Aucun email client.
- Aucun abonnement modifié.
- Aucun compte réel touché.
- Pas de refactor `AccountTagsDialog` (backlog).
