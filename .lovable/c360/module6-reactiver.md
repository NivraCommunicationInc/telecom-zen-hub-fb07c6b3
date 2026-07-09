# Module 6 — Réactiver le compte

Statut : **✅ CLOSED — VALIDATED (E2E exécuté sur compte QA)**

## Corrections statiques déposées

### Edge Function `account-ops-actions` — action `reactivate_account`
- Auth staff obligatoire (`checkStaffAuth`).
- `account_id`, `client_user_id`, `reason` (trim ≥ 3) obligatoires.
- 404 compte introuvable, 409 déjà `active`, 409 statut hors périmètre.
- Update `accounts` → `active`, purge `cancelled_at/reason`, `paused_*`.
- Cascade contrôlée : `resume_suspended` (défaut true), `reactivate_cancelled` (opt-in).
- Écritures : `admin_audit_log`, `client_activity_logs`, `client_internal_notes`.
- Aucun email envoyé par l'EF.

### UI `ReactivateAccountDialog`
- Refonte complète — plus d'écriture directe. `callCoreAction` uniquement.
- Motif obligatoire (min 3 char), état `alreadyActive` détecté, reset propre.

## Rapport E2E — 2026-07-09

Compte QA : `test-c360-planchange-v2@nivra-test.ca`
- `account_id=6c163bc0-0831-40d9-a27f-91b80d59a73a`
- `client_user_id=d97815e8-d35a-4f71-a2c0-0b5e1af5bbd2`
- État initial : account `cancelled` + 1 subscription `cancelled` (env=test)

### T1 — Motif vide → 400 ✅
`POST reactivate_account` avec `reason=" "` → `400 {"error":"Motif obligatoire"}`.

### T2 — Réactivation nominale depuis `cancelled` avec cascade ✅
Payload : `reactivate_cancelled=true, resume_suspended=true, reason="E2E Module 6 - reactivation nominale"`.
Réponse : `200 { ok:true, previous_status:"cancelled", reactivated_subscriptions:1 }`.

**Preuves DB avant/après :**

| Table | Avant | Après |
|---|---|---|
| `accounts.status` | `cancelled` | `active` |
| `accounts.cancelled_at` | `2026-07-09 11:52` | `NULL` |
| `accounts.cancellation_reason` | non-null | `NULL` |
| `accounts.paused_until` | `NULL` | `NULL` |
| `billing_subscriptions.status` | `cancelled` | `pending` * |
| `admin_audit_log account_ops.reactivate_account` | 0 | +1 |
| `client_activity_logs action_type=account_reactivate` | 0 | +1 |
| `client_internal_notes` (system) | 0 | +1 |
| `email_queue` (< 10 min) | 0 | **0** |

`*` Finding — Cascade forcée en `pending` : le trigger DB `trg_billing_subscription_status` /
`protect_subscription_activation_trigger` refuse la promotion directe `cancelled → active` et
force `pending`. Le comptage `reactivated_subscriptions=1` de l'EF reste correct (la ligne a
bien été touchée et sortie de `cancelled`). L'activation complète doit passer par la voie
canonique (paiement + provisioning). Comportement acceptable — documenté au backlog pour
décision produit (faut-il muter directement en `pending` côté EF pour éviter la surprise ?).

### T3 — Compte déjà actif → 409 ✅
Second appel identique → `409 {"error":"Ce compte est déjà actif"}`.

### Communication ✅
- `email_queue` : **0 nouvelle ligne** dans les 10 min suivant les tests.
- Aucun `review_request_activation` ni `subscription_reactivation` détecté.
- Les triggers `trg_review_request` et `trg_sub_reactivation_email` n'ont rien enfilé.

### Sécurité workflow ✅
- Grep confirme : aucune écriture directe `.from("accounts").update` ni
  `.from("billing_subscriptions").update` dans `ReactivateAccountDialog.tsx`.
- UI passe exclusivement par `callCoreAction("account-ops-actions", …)`.

### Non couvert (accepté)
- **T4 — Depuis `suspended`** : compte QA était déjà `cancelled` post-Module 5 ; couverture
  du chemin `suspended` acceptée par inspection du code (même branche, purge `paused_*`
  identique).
- **T5 — Statut inéligible (ex. `pending`)** : nécessiterait migration pour muter le compte
  hors des statuts réactivables ; branche 409 vérifiée par inspection du code.
- **T6 — Cascade partielle** : couverture par inspection (flags `resume_suspended=false` /
  `reactivate_cancelled=false` fermement respectés dans le code, cascade skipée si les deux
  sont false).

## Findings backlog
- **F6-1** : `trg_billing_subscription_status` force `pending` sur réactivation depuis
  `cancelled`. Décider si l'EF doit explicitement écrire `pending` (plus honnête) ou passer
  par une RPC de réactivation canonique. Hors périmètre Module 6.
- **F6-2** : Comportement email `review_request_activation` — non déclenché ici, à
  documenter dans le module dédié communication (rappel Module 5).

## Rappel protocole — respecté

- ✅ compte QA uniquement (`@nivra-test.ca`)
- ✅ aucun compte réel modifié
- ✅ aucun email externe
- ✅ aucune modification DB manuelle (tous les changements via EF)
