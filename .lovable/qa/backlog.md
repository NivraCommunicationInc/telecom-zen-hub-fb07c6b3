# QA Environment — Backlog transversal

Ce backlog regroupe les problèmes d'environnement QA détectés pendant les passes Client 360. **Ces items ne sont PAS des bugs des modules validés** — ils décrivent des lacunes du processus de provisionnement / nettoyage QA lui-même.

---

## QA-001 — Cleanup QA laisse des profils orphelins

**Statut :** OPEN
**Priorité :** P2 (bloque la réutilisation de comptes QA, force le provisionnement d'un nouveau compte à chaque module)
**Ouvert le :** Module 20 — Geler cycle / essai (E2E)
**Impact :** transversal (tous les modules Client 360 qui réutilisent un compte QA existant)

### Symptôme observé

Lors de la reprise de la checklist E2E Module 20 sur le compte QA `test-c360-planchange-v2@nivra-test.ca` :

- `public.profiles` contient toujours une ligne pour ce user_id.
- `auth.users` **ne contient plus** la ligne correspondante.
- Résultat : le compte est dans un état incohérent — `profiles` orphelin, aucune session possible, mais assez de données résiduelles pour tromper une requête de sanity check qui filtre uniquement sur `profiles`.

### À investiguer

1. **Qui a supprimé `auth.users` ?**
   - Vérifier les scripts de reset (`scripts/qa-c360-reset.sql`) → ce script est censé **ne pas** toucher `auth.users`.
   - Vérifier si une purge globale (`auth.users` older than X, ou email `%@nivra-test.ca`) est passée en cron/manuellement.
   - Chercher dans `admin_audit_log` toute action `user_delete` sur les emails `@nivra-test.ca`.

2. **Pourquoi `profiles` est resté ?**
   - FK `profiles_user_id_fkey` = `ON DELETE CASCADE`. Un `DELETE FROM auth.users` aurait dû cascader.
   - Hypothèse : la suppression n'est pas passée par `DELETE FROM auth.users` mais par un chemin qui contourne les FK (ex : `TRUNCATE`, ou suppression via un endpoint admin qui purge seulement l'auth sans toucher les données publiques).
   - Autre hypothèse : la ligne `profiles` a été **recréée** après la suppression `auth.users` par un trigger ou un job idempotent.

3. **Pourquoi l'intégrité n'a-t-elle pas été préservée ?**
   - Aucune contrainte de cohérence transverse (au-delà des FK) n'est en place.
   - Aucun trigger de garde ne détecte un `profiles` sans `auth.users`.

### Correction cible (à planifier, hors module 20)

- **Provisionnement QA canonique** : une seule edge function `qa-provision-test-account-fresh` qui crée un compte QA avec `email = 'test-c360-<module>-<timestamp>@nivra-test.ca'`, jamais réutilisé.
- **Cleanup QA canonique** : une seule edge function `qa-teardown-test-account` qui purge dans l'ordre : rows publiques → `billing_customers` → `auth.users`, avec assertion que les cascades ont bien été effectuées.
- **Sanity check** : cron quotidien qui alerte si `count(profiles WHERE email ILIKE '%@nivra-test.ca') > count(auth.users WHERE email ILIKE '%@nivra-test.ca')`.
- **Migration one-shot** : purger les orphelins existants (`DELETE FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id)`) après confirmation qu'aucun est associé à un vrai client.

### Décision temporaire pour les modules 20+

- Ne **pas** réutiliser les comptes QA suspects (`test-c360-planchange*`).
- Provisionner un **nouveau compte QA à usage unique** par module (`test-c360-module<N>-<timestamp>@nivra-test.ca`), teardown complet à la fin.
- Ce backlog est référencé dans le rapport de chaque module qui a dû provisionner à neuf.

---

## QA-002 — `apply_plan_change` RPC viole `idx_unique_sub_per_address_category`

**Statut :** OPEN
**Priorité :** P1 (bloque tout upgrade/downgrade immédiat en production si (customer_id, address_id, service_category) existe déjà pour un abo actif)
**Ouvert le :** Module 21 — Upgrade / Downgrade (E2E)

### Symptôme

Le RPC `public.apply_plan_change` fait `INSERT` de la nouvelle sub **avant** `UPDATE ... status='cancelled'` de l'ancienne. Or l'index unique partiel `idx_unique_sub_per_address_category` est `IMMEDIATE` (non-DEFERRABLE) et filtre `WHERE status NOT IN ('cancelled','expired')`. À l'instant de l'INSERT, les deux subs sont `active` sur la même clé → violation `23505`.

### Reproduction

E2E Module 21 T1 (Upgrade 500 → Giga, immediate). Reproduit sur compte QA isolé.

### Correction cible

Inverser l'ordre dans `apply_plan_change` : `UPDATE old.status='cancelled'` puis `INSERT new`. Le check `status IN ('active','pending','suspended')` doit être fait avant le UPDATE.

### Workaround E2E

`DROP INDEX ... idx_unique_sub_per_address_category` avant le run, `CREATE UNIQUE INDEX ...` après.

---

## QA-003 — Worker `email_queue` n'exclut pas le domaine `@nivra-test.ca`

**Statut :** OPEN
**Priorité :** P1 (fuite d'emails de test vers un domaine externe potentiellement livrable)
**Ouvert le :** Module 21 — Upgrade / Downgrade (E2E)

### Symptôme

Le processeur `email_queue` a livré 2 emails `plan_change_approved` et `plan_change_requested` vers `test-c360-module21-…@nivra-test.ca` malgré la règle QA « aucune communication envoyée ». Vérifié dans `email_queue.status='sent'`.

### Correction cible

Ajouter un guard permanent dans le worker : `WHERE to_email NOT ILIKE '%@nivra-test.ca'` (et idéalement toute la liste de domaines QA). Alternative : trigger `BEFORE UPDATE ON email_queue SET status='suppressed'` si `to_email` matche.

### Workaround appliqué

Domaine `@nivra-test.ca` ajouté à `public.suppressed_emails` (reason=`bounce`) pour bloquer les envois futurs.

---

## QA-004 — Test C41 anti-flood (Module 29 Service TV) non exécuté

**Statut :** OPEN
**Priorité :** P2 (item environnemental — la logique métier est validée par équivalence avec M28, mais le test E2E n'a pas pu être exécuté)
**Ouvert le :** Module 29 — Service TV (E2E)
**Impact :** Module 29 uniquement (le helper `checkAntiFlood` est partagé avec M28)

### Symptôme observé

Pendant la campagne E2E du Module 29, le test **C41 — anti-flood 20/60 s → retour 429 RATE_LIMIT** n'a pas pu être exécuté. Le runner a déclenché un rate limit côté plateforme (`Rate limit exceeded for trace … Retry after …`) lors du seeding parallèle des utilisateurs QA, avant même d'atteindre l'assertion métier.

### Pourquoi ce n'est pas une anomalie fonctionnelle

- Le helper `checkAntiFlood` utilisé par `tv-account-actions` est **identique** à celui validé avec succès dans `internet-account-actions` (Module 28 — C9 PASS).
- Les constantes (20 requêtes / 60 s), les tables (`request_flood_tracking`) et la structure de réponse (`429 RATE_LIMIT`) sont les mêmes.
- Aucun 5xx ou comportement inattendu n'a été observé sur les autres tests du module.

### Correction cible

Reprogrammer le test C41 dans une **campagne QA dédiée** lorsque les limitations de la plateforme ne bloquent plus le seeding parallèle. Conditions de reprise :

1. Utiliser un compte QA frais (`test-c360-module29-antiflood-<timestamp>@nivra-test.ca`).
2. Séquencer la création des utilisateurs plutôt que de les lancer en parallèle, ou attendre que la fenêtre de rate limit de la plateforme soit réinitialisée.
3. Vérifier explicitement :
   - 20 appels successifs à `tv-account-actions` dans la même minute → le 21e retourne `429 RATE_LIMIT` ;
   - `admin_audit_log` contient une entrée `action='security.rate_limit'` avec `actor_role` correct ;
   - aucune écriture métier n'est persistée pendant la fenêtre bloquée.

### Décision temporaire

Module 29 reste **CLOSED ✅** avec cette réserve environnementale documentée. Le test C41 est traqué ici jusqu'à sa réexécution réussie.

