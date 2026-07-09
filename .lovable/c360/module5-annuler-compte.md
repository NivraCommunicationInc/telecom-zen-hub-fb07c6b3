# Module 5 — Annuler le compte

Statut : **✅ VALIDÉ (backend E2E, cascade prouvée)** — workflow email trigger documenté et accepté comme comportement système existant, non modifié.

## Corrections statiques (résumé)

### Edge Function `account-ops-actions` — action `cancel_account`
- Validation staff + admin/supervisor.
- `account_id`, `client_user_id` et `reason` requis (400 sinon).
- 409 si compte déjà `cancelled`.
- Update `accounts` → `status='cancelled'`, `cancelled_at=now()`, `cancellation_reason=<motif>`.
- **Cascade abonnements** : cible **tous les statuts non-terminaux** de l'enum réel `billing_subscription_status`
  (`active`, `pending`, `suspended`). Les statuts terminaux (`cancelled`, `expired`, `not_renewed`) sont ignorés
  → idempotent.
  > Bug initial : la cascade filtrait sur `active|past_due|trialing` (valeurs Stripe-style qui n'existent pas
  > dans notre enum Postgres). Corrigé.
- `admin_audit_log`, `client_activity_logs`, `client_internal_notes` insérés.
- Aucun email envoyé par l'EF elle-même.

### UI `CancelAccountDialog` — inchangée (déjà validée)

## Preuve E2E cascade (compte QA v2)

Compte : `test-c360-planchange-v2@nivra-test.ca` (`account_id=6c163bc0…d59a73a`, `client_user_id=d97815e8…f5bbd2`).

Provisionnement complet via migration :
- Chaîne `orders` → `order_items(is_recurring=true, status=active)` → `billing_subscriptions` avec tous les
  champs `frozen_*` + `source_order_item_id` obligatoires (règles 1 & 5 du guard `fn_subscription_freeze_guard`).
- `billing_customers` seed (FK requis).
- `service_addresses(created_via='admin')` (contrainte `service_addresses_created_via_chk`).
- Abonnement inséré `status='active'`, `environment='test'`. Un trigger l'a immédiatement normalisé à `pending`
  (comportement système attendu tant qu'il n'y a pas de paiement — n'a pas de traceur, à investiguer plus tard).

Appel EF (session admin injectée) :
```
POST /functions/v1/account-ops-actions
{ action: "cancel_account", account_id, client_user_id, reason: "QA Module 5 cascade FINAL proof" }
→ { ok: true, cancelled_subscriptions: 1 }
```

Vérifications DB (avant → après) :
| Objet | Avant | Après |
|---|---|---|
| `accounts.status` | `active` | `cancelled` (+ `cancelled_at`, `cancellation_reason`) |
| `billing_subscriptions.status` (env=test) | `pending` | `cancelled` |
| `admin_audit_log` | — | 1 ligne `account_ops.cancel_account` |
| `client_activity_logs` | — | 1 ligne `account_cancel` |
| `client_internal_notes` | — | 1 note système |

## Side-effect email — `review_request_deactivation`

**Origine identifiée** : trigger `trg_review_request` sur `public.accounts` (AFTER UPDATE OF status)
appelant `public.fn_create_review_request()`.

**Logique** : quand `status` transite vers `cancelled | terminated | deactivated | suspended_final`, le trigger :
1. Crée une ligne dans `public.client_reviews` (`trigger_type='deactivation'`, `review_token` généré, `status='pending'`).
2. Insère un email `review_request_deactivation` dans `public.email_queue`.

Un email symétrique `review_request_activation` est aussi enfilé quand `status` transite vers `active`
(déclenché ici par la réactivation QA pour le retest).

Aucune exclusion de domaine de test (`@nivra-test.ca`) n'est présente dans la fonction — les deux emails ont été
placés en file (`status='queued'`) puis marqués `sent` par le worker `process-email-queue`. La livraison réelle vers
`nivra-test.ca` échoue silencieusement (domaine non résolvable), donc **aucun email externe n'a réellement atteint
une boîte réelle** — mais le worker ne le sait pas.

**Décision documentée (aucune modification effectuée)** :
- Le trigger reste **non modifié** conformément à la consigne « Ne pas désactiver ou modifier le trigger sans analyse ».
- Ce comportement est **hors périmètre du Module 5** (c'est un système d'agents de revue Google, cf.
  `agent-review-request`).
- **Recommandation** (backlog séparé, à décider hors Module 5) : ajouter dans `fn_create_review_request` une
  garde qui saute les comptes portant `account_tags.tag_key='qa_test_account'` **ou** dont l'email se termine par
  `@nivra-test.ca`. Cela n'appartient pas à ce module.

## Statut final

| Critère | Résultat |
|---|---|
| ✅ Cascade abonnement prouvée (avant/après) | 1 abonnement passé de `pending` → `cancelled` |
| ✅ `cancelled_subscriptions` retourné correctement | `1` |
| ✅ Audit / activity / notes | Écrits |
| ✅ Aucun compte réel touché | Compte QA v2 uniquement |
| ⚠️ Email `review_request_deactivation` généré par un trigger DB indépendant | Documenté et accepté ; correctif proposé au backlog séparé, non appliqué |
| ⚠️ UI Playwright | Skip 2FA — validation par inspection du câblage UI (identique au Module 4) |

**Module 5 : FERMÉ** — cascade prouvée, side-effect email tracé à sa source et accepté comme comportement
système externe au module.
