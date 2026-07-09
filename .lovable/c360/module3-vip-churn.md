# Module 3 — VIP / Churn risk

Statut : **CLOSED — VALIDÉ** ✅ (E2E exécuté le 2026-07-09 sur compte QA)

## Périmètre
`VipChurnToggleDialog` dans `Account360NewActionDialogs.tsx` — application/retrait des étiquettes officielles `vip` et `churn_risk` sur un compte client.

## Corrections statiques appliquées
- Edge Function `account-tags-actions` :
  - Bugs bloquants corrigés : `user.id` → `userData.user.id` ; `json(status, body)` inversé.
  - Parité audit : `client_activity_logs` (`action_type = "account_tag"`) + `client_internal_notes` (`note_type = "system"`) sur `add` et `remove` en plus de `admin_audit_log`.
  - Preset `churn_risk` ajouté au catalogue.
- Dialog `VipChurnToggleDialog` :
  - Ne fait plus d'écriture directe sur `account_tags`. Route via `account-tags-actions`.
  - Chargement de l'état existant à l'ouverture (date + note).
  - Motif obligatoire ; `window.confirm` sur retrait ; support du retrait.
  - Reset `reason`/`note` après ajout réussi et sur changement de preset (VIP ↔ Churn).
  - Mapping FR des erreurs (`Motif obligatoire`, `Cette étiquette existe déjà sur ce compte`, `Action réservée au personnel autorisé`, `Étiquette introuvable`).

## Preuves E2E collectées (compte QA `test-c360-planchange-v2@nivra-test.ca`)
- ✅ Edge Function `account-tags-actions` — validée (list / add ×2 / remove ×2, tous 200)
- ✅ `admin_audit_log` — 4 entrées (`account_ops.tag_add` ×2, `account_ops.tag_remove` ×2), `details.reason` non vide
- ✅ `client_activity_logs` — 4 entrées `action_type='account_tag'`
- ✅ `client_internal_notes` — 4 entrées `note_type='system'` FR + email admin
- ✅ `account_tags` — 0 ligne finale (add + remove complets)
- ✅ `email_queue` — 0 insertion (aucun email envoyé)
- ✅ Aucun impact client réel
- ✅ Aucun 5xx sur les appels EF
- ✅ Aucune écriture UI directe vers `account_tags`

## Erreurs hors périmètre (backlog, non corrigées)
- Erreurs console 400 sur `auth.getUser` de l'app principale hors flow module.

## Modifications hors périmètre — SIGNALÉES
Les correctifs de bugs dans `account-tags-actions` bénéficient aussi à `AccountTagsDialog` (Module « Étiquettes & alertes », backlog). Aucune modification du dialog `AccountTagsDialog` lui-même.
