# Plan — Environnement QA Nivra pour validation Client 360 (Option C)

Objectif : créer un compte de test permanent, isolé, utilisable pour valider Upgrade/Downgrade **et** tous les futurs modules Client 360, sans jamais toucher un vrai client ni un vrai flux.

---

## 1. Découvertes de schéma (fait)

- `billing_subscriptions.environment` existe déjà (`'live'` aujourd'hui) → **canal officiel de séparation test/prod**. On introduit la valeur `'test'`.
- Pas de colonne `is_test` sur `accounts` / `profiles`.
- `account_tags` = mécanisme canonique de marquage (`tag_key` texte libre déjà utilisé : `vip`, `portal_lock`, `payment_lock`). On ajoute `tag_key = 'qa_test_account'`.
- Plans Internet actifs : Internet 100 (45$), Internet 500 (50$), Internet Giga (60$) → couverts pour upgrade **et** downgrade.
- `email_queue` existe déjà → on garde les emails en `status='queued'` et on ne déclenche jamais `process-email-queue` sur les rows du compte test (filtre par recipient domain `@nivra-test.ca`).

---

## 2. Périmètre du compte QA

Un seul compte, permanent, réutilisable :

| Élément | Valeur |
|---|---|
| Email | `test-c360-planchange@nivra-test.ca` |
| Nom | `QA C360 PlanChange` |
| Marquage | `account_tags(tag_key='qa_test_account', severity='info', note='Compte QA interne — ne jamais facturer, ne jamais provisionner')` |
| Profil | `profiles` row lié à un `auth.users` créé via `auth.admin.createUser` (email non confirmé, mot de passe aléatoire non exposé) |
| Account | `accounts` row standard, `status='active'` |
| Abonnement | `billing_subscriptions` sur **Internet 500 Mbps** (50 $), `environment='test'`, `auto_billing_enabled=false`, `recurring_provider=null` |
| Cycle | `cycle_start_date = today`, `cycle_end_date = today + 29`, `billing_anchor_date = today` (cohérent avec l'invariant qu'on a corrigé ce matin) |
| Adresse service | `service_addresses` factice à Laval (utilisée uniquement en interne, jamais soumise à provisioning) |
| Équipement | 1 `equipment_inventory` fictif type `router`, serial `QA-ROUTER-C360-001`, statut `assigned` |
| Méthode paiement | Aucune. `client_payment_methods` vide → toute tentative de charge Square échoue immédiatement, on ne risque pas d'appel réel |
| Historique | 1 facture passée `billing_invoices` status `paid` (montant symbolique) + 1 ligne dans `billing_invoice_lines`, pour que Upgrade/Downgrade ait un contexte réaliste |

Aucune écriture dans : `provisioning_jobs`, `activation_requests`, `paypal_*`, `square_payment_attempts`, `card_payment_intents`, `payments` réels, `sms_queue`.

---

## 3. Isolement — garde-fous techniques

Pour garantir zéro fuite vers de vrais systèmes :

1. **`environment='test'`** sur toute row `billing_subscriptions` du compte → les edge functions de charge Square (`square-charge-*`) refusent déjà les subs non-`live` (à vérifier ; sinon on ajoute un garde `if environment != 'live' return early` dans un patch dédié — pas dans ce lot).
2. **Domaine `@nivra-test.ca`** → filtrable partout. On ajoute une note dans `email_queue.metadata` : `{ "qa_test": true }` sur toute insertion générée par ces tests.
3. **Tag `qa_test_account`** vérifiable via une seule requête : `SELECT account_id FROM account_tags WHERE tag_key='qa_test_account'`.
4. **Pas de méthode de paiement enregistrée** → impossible de déclencher un paiement réel même en cas de bug.

---

## 4. Migration proposée (contenu, pas encore soumise)

Une seule migration idempotente :

```text
-- 1. Créer auth user (via extension helper si dispo, sinon INSERT direct dans auth.users
--    est INTERDIT par la règle "ne pas toucher schema auth")
--    ⇒ on utilisera plutôt un edge function admin one-shot avec service_role,
--       PAS une migration SQL, pour créer l'utilisateur auth proprement.
-- 2. Migration SQL = uniquement les rows public.* :
--    - profiles
--    - accounts
--    - service_addresses
--    - account_tags (qa_test_account)
--    - services : réutilisation Internet 500 existant, aucune création
--    - billing_subscriptions (environment='test')
--    - equipment_inventory (1 router fictif)
--    - billing_invoices + billing_invoice_lines (historique minimal)
-- 3. Toutes les INSERT sont wrappées dans un ON CONFLICT DO NOTHING sur un UUID stable
--    (défini en constantes) → migration ré-exécutable sans doublon.
```

**Point à confirmer avec toi** : la création du `auth.users` doit se faire via un edge function `qa-provision-test-account` avec `service_role` (pattern déjà utilisé ailleurs), pas via SQL migration, parce que le schema `auth` est interdit d'écriture directe par nos règles internes. C'est **exactement** le workflow canonique.

---

## 5. Validation Upgrade/Downgrade

Scénarios exécutés sur ce compte, dans cet ordre :

### 5.1 Upgrade Internet 500 → Internet Giga (+10 $/mois)
- Snapshot **avant** : `billing_subscriptions`, `billing_invoices` open, MRR, équipement, cycle
- Appel `core_simulate_plan_change` → prorata attendu = `10 * (jours_restants / 30)`, MRR delta = +10
- Appel `core-apply-plan-change` avec `effective='immediate'`
- Snapshot **après** : `billing_subscriptions.plan_code`, `service_change_requests`, `billing_invoice_lines` (ligne prorata), `admin_audit_log` (before/after), `activity_logs`, `email_queue` (template `plan-change-confirmation` — enqueued, jamais envoyé)

### 5.2 Downgrade Internet Giga → Internet 100 (–15 $/mois)
- Idem, avec `effective='next_cycle'` pour tester le second mode
- Vérifier absence de ligne prorata négative + création d'un `service_change_requests` scheduled

### 5.3 Contrôles réutilisables
- Realtime : ouvrir le portail client dans un second onglet (session impersonation sur ce compte QA) et vérifier propagation live.
- Rollback : après chaque scénario, `UPDATE billing_subscriptions SET plan_code='internet_500', plan_price=50 …` pour ré-armer le compte en état initial.

---

## 6. Teardown & réutilisation

Le compte **reste en base** (c'est le but : QA permanent). Le teardown est un **script de reset** livré à côté :

```text
-- scripts/qa-c360-reset.sql
-- Remet le compte QA dans son état initial (Internet 500, cycle courant, historique nettoyé)
-- Idempotent, safe à relancer avant chaque nouvelle passe.
```

Livrables à la fin :

- IDs stables (UUID) : `account_id`, `subscription_id`, `user_id`, `equipment_id`, `service_address_id` documentés dans `.lovable/qa/c360-test-account.md`
- Script `qa-c360-reset.sql`
- Bloc de preuve (before/after/tables/RPC/audit) pour Upgrade **et** Downgrade
- Confirmation SQL : `SELECT count(*) FROM billing_subscriptions WHERE environment='test'` = attendu / `WHERE environment='live'` inchangé

---

## 7. Ce que je te demande avant d'exécuter

1. **Tu confirmes le compte unique** `test-c360-planchange@nivra-test.ca` sur **Internet 500 Mbps** comme point de départ ? (permet upgrade vers Giga et downgrade vers 100 dans la même passe)
2. **Tu confirmes le pattern edge function `qa-provision-test-account` + migration SQL** (auth via service_role, public via migration) plutôt qu'une migration monolithique ? C'est le seul chemin propre qui respecte la règle "ne pas toucher `auth`".
3. **Tu confirmes qu'aucune vraie carte / vrai Square sandbox n'est branchée** sur ce compte (juste `client_payment_methods` vide) ? Les tests Upgrade/Downgrade ne nécessitent pas de charge réelle : la simulation + l'application génèrent des lignes de facture, pas un débit.

Dès que tu réponds oui/oui/oui (ou ajustements), je livre : edge function + migration + script reset + doc, dans le même lot, puis j'enchaîne la validation Upgrade/Downgrade et je te ramène le bloc de preuve.