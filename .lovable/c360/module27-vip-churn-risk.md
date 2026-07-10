# Module 27 — VIP / Churn risk (Étiquettes & alertes compte)

**Statut :** OPEN — STATIC AUDIT
**Date :** 2026-07-10
**Périmètre :** l'ensemble de la surface « étiquettes / alertes / VIP / churn » exposée dans Client 360, pas uniquement le raccourci VIP/Churn (Module 3 déjà fermé).

## 1. Cartographie (UI → EF → DB → emails/audit)

### 1.1 Surfaces UI concernées
| Composant | Fichier | Rôle |
|---|---|---|
| `VipChurnToggleDialog` | `src/core-app/components/account-360/Account360NewActionDialogs.tsx` (ligne 1211) | Raccourci VIP / Risque de churn — **route via EF** ✅ (fermé au Module 3) |
| `AccountTagsDialog` | `src/shared-ops/components/AccountTagsDialog.tsx` | Gestion complète du catalogue (11 presets + custom) — **route via EF** ✅ |
| `SatisfactionNpsDialog` (bloc NPS ≤ 6) | `Account360NewActionDialogs.tsx` L943-955 | **ÉCRITURE DIRECTE `account_tags` UPSERT** ❌ |
| `FraudLockDialog` | `Account360NewActionDialogs.tsx` L1022-1042 | **ÉCRITURE DIRECTE `account_tags` UPSERT + UPDATE `accounts.status`** ❌ |

### 1.2 Edge Function canonique
`supabase/functions/account-tags-actions/index.ts` (221 lignes).
- Actions supportées : `list`, `add`, `remove`.
- Auth : `checkStaffAuth` (retourne `isStaff` sans filtrage de rôle spécifique — voir F27-2).
- Preset catalogue : 11 étiquettes (vip, churn_risk, loyal, watchlist, at_risk, collections, chargeback_history, fraud_suspected, do_not_contact, litigation, escalation_required).
- Audit : `admin_audit_log` + parité `client_activity_logs` (action_type `account_tag`) + `client_internal_notes` (note_type `system`).
- Emails : **aucun** (par design — étiquette interne).

### 1.3 DB
`public.account_tags` (11 colonnes) :
- Clés : `client_user_id`, `account_id`, `tag_key`, `tag_label`, `severity`, `note`, `expires_at`.
- RLS ON. Politiques :
  - INSERT/DELETE limités à `admin | support | billing_admin | supervisor`.
  - SELECT étendu à `employee` en plus.
  - `Deny anon access` sur ALL.
- Contrainte unique active `account_tags_unique_active` (référencée dans l'EF).

### 1.4 Audit / logs
- `admin_audit_log` : `account_ops.tag_add`, `account_ops.tag_remove` avec `details.reason`.
- `client_activity_logs` : `action_type='account_tag'`.
- `client_internal_notes` : `note_type='system'`, uniquement si `account_id` fourni.

---

## 2. Findings

### P1 — Critique

**F27-1 — Écritures directes frontend → `account_tags` (contournement de l'EF canonique)**
- `SatisfactionNpsDialog` (NPS ≤ 6) fait `supabase.from("account_tags").upsert(...)` L945.
- `FraudLockDialog` fait `supabase.from("account_tags").upsert(...)` L1033 + `supabase.from("accounts").update({status:"blocked"})` L1029.
- Conséquences :
  - Aucune entrée `admin_audit_log`, aucun `reason` audité pour la pose des tags `satisfaction_risk`, `full_lock`, `payment_lock`, `portal_lock`.
  - Pas de parité `client_activity_logs` / `client_internal_notes` pour ces tags.
  - Contourne la validation serveur (severity, longueur, key normalisation, unicité).
  - Contourne le contrôle de rôle explicite (dépend uniquement de la RLS INSERT).
- Viole la règle « aucune écriture directe du frontend, tout passe par l'EF canonique ».

**F27-2 — Aucune restriction de rôle dans l'EF (`isStaff` seul)**
- `account-tags-actions` fait uniquement `checkStaffAuth(admin, actor.id)` → tout rôle staff (`admin, super_admin, employee, supervisor, support, billing_admin, sales, manager, hr, field_agent, field_sales`) peut poser/retirer une étiquette `fraud_suspected`, `do_not_contact`, `litigation`.
- La RLS DB est plus restrictive (`admin|support|billing_admin|supervisor`) — donc `sales|hr|field_*|employee` sont bloqués par la RLS mais l'EF utilise `service_role` : **la RLS ne les protège pas dans l'EF**.
- Résultat : `sales`, `hr`, `field_sales` peuvent poser des étiquettes critiques (fraude, litige) via l'EF, sans passer par la RLS.
- Doit être aligné sur les `ALLOWED_ROLES = ['admin','supervisor','support','billing_admin']` (+ `super_admin`).

**F27-3 — Aucune validation d'ownership `client_user_id ↔ account_id`**
- L'EF accepte n'importe quelle combinaison `client_user_id` + `account_id` sans vérifier que le compte appartient bien au client.
- Un staff peut poser une étiquette sur `account_id` d'un client A en passant le `client_user_id` d'un client B → contamination croisée des timelines (`client_activity_logs`, `client_internal_notes`).
- Même pattern que F26-1 / F24 déjà corrigés dans les autres modules.

### P2 — Élevé

**F27-4 — Motif faible : accepté dès 1 caractère non-espace**
- `if (!body.reason?.trim()) return json({ error: "Motif requis" }, 400);` → « x » suffit.
- Standard des modules récents : min 5 (Module 26) ou 10 (fraud lock). Pour une étiquette `fraud_suspected` / `litigation` / `do_not_contact`, min 10 caractères recommandé, min 5 pour les autres.

**F27-5 — Aucune idempotency_key**
- Un double-clic sur "Appliquer" peut générer deux inserts (le second sera bloqué par `account_tags_unique_active`, ok) mais un `add` puis `remove` puis `add` répétés créent plusieurs entrées audit sans clé de rejeu.
- À aligner avec Modules 25/26.

**F27-6 — Tags système utilisés hors preset catalog**
- `SatisfactionNpsDialog` pose `tag_key='satisfaction_risk'` : absent du preset catalogue exposé par `list`.
- `FraudLockDialog` pose `full_lock | payment_lock | portal_lock` : absents du catalogue.
- Divergence source-de-vérité : la liste "presets" affichée dans `AccountTagsDialog` ne couvre pas les tags actifs réellement présents en base.

**F27-7 — Aucune purge auto des tags expirés (`expires_at`)**
- Colonne `expires_at` existe et est écrite par `AccountTagsDialog`, mais aucun cron ne les retire ni ne les masque côté `list`.
- Les tags "expirés" restent visibles/actifs indéfiniment.

**F27-8 — Verrouillage de compte via `accounts.status='blocked'` sans passer par EF `account-ops-actions`**
- `FraudLockDialog` L1029 fait un `UPDATE accounts` direct → même problème que F27-1, mais pour la table `accounts`.
- Sortie de scope stricte du Module 27 (relève du Module « FraudLock/Verrou compte ») mais listé ici car imbriqué dans le même dialog qui écrit `account_tags`.

### P3 — Moyen

**F27-9 — Réponses d'erreur non normalisées**
- Codes d'erreur incohérents avec les autres modules récents (pas de `code` machine, mapping FR fait côté client par `mapTagError`).
- Aucune trace des refus (403 rôle, 404 tag introuvable, 409 doublon) dans `admin_audit_log`.

**F27-10 — Parité audit conditionnelle**
- `client_internal_notes` inséré **seulement si `account_id` fourni** (EF L95). Pour un client sans compte encore rattaché, la timeline staff perd la trace.

**F27-11 — Pas de rate-limit / anti-flood**
- Rien n'empêche 50 tags/minute sur un même compte (spam ou script). Pas critique mais à noter.

### P4 — Faible

**F27-12 — `actor_role: "admin"` hard-codé dans les logs de parité**
- EF L83 : `actor_role: "admin"` alors que le vrai rôle du caller peut être `support` ou `billing_admin`. Précision d'audit dégradée.

**F27-13 — Absence de tests E2E dédiés**
- Pas de `qa-module27-runner`. Module 3 a couvert VIP/Churn manuellement, mais rien pour les 9 autres presets ni pour `AccountTagsDialog`.

---

## 3. Synthèse

| Priorité | Findings |
|---|---|
| P1 | F27-1, F27-2, F27-3 |
| P2 | F27-4, F27-5, F27-6, F27-7, F27-8 |
| P3 | F27-9, F27-10, F27-11 |
| P4 | F27-12, F27-13 |

**Recommandations de correction (à valider avant application) :**
1. **F27-1** : router `SatisfactionNpsDialog` et `FraudLockDialog` via `account-tags-actions` (et `account-ops-actions` pour le status). Ajouter `satisfaction_risk`, `full_lock`, `payment_lock`, `portal_lock` au catalogue serveur.
2. **F27-2** : `ALLOWED_ROLES = ['admin','super_admin','supervisor','support','billing_admin']`. Rejet 403 audité pour les autres.
3. **F27-3** : valider `accounts.id = account_id AND accounts.user_id = client_user_id` (ou `accounts.client_user_id`, selon canonique) avant tout `add/remove` → 403 `CROSS_CLIENT_TARGET` audité.
4. **F27-4** : min 5 caractères, min 10 pour `severity='critical'`.
5. **F27-5** : accepter `idempotency_key` optionnel + court-circuit sur rejeu.
6. **F27-6** : étendre le catalogue serveur avec les tags système (`satisfaction_risk`, `full_lock`, `payment_lock`, `portal_lock`), avec un flag `system_only: true` pour empêcher l'ajout manuel depuis `AccountTagsDialog`.
7. **F27-7** : cron horaire `account-tags-expire` qui supprime/masque les tags dont `expires_at < now()` + entrée audit `tag_expired`.
8. **F27-8** : hors scope 27 — flag pour Module dédié FraudLock.
9. **F27-9/10** : normaliser codes/erreurs + auditer les refus + retirer la condition `if (accountId)` sur `client_internal_notes` (fallback vers `client_id`).
10. **F27-12** : lire le vrai rôle depuis `checkStaffAuth` et l'écrire dans les logs.
11. **F27-13** : livrer `qa-module27-runner` couvrant list/add/remove pour les 11 presets + presets système + cross-client + rôles refusés + expiration.

---

**Prochaine étape :** en attente du feu vert pour appliquer les corrections F27-1 → F27-13.
