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
