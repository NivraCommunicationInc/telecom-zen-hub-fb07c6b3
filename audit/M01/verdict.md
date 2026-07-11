# Module 1 — Modifier le profil — Audit réel

## Inventaire (voir inventory.json)
- 6 UI d'édition profil concurrentes
- 1 EF (`client-account-admin`, 627 lignes) — **couvre uniquement l'accès portail, pas l'édition profil**
- 91 colonnes sur `profiles`, 13 triggers, 7 CHECK, 12 index, 11 policies
- Table `client_profile_changes` (8 lignes historiques, self-service client uniquement)

## Flux réel (observé, pas supposé)
- **Client self-service** : UI → `.from('profiles').update()` directe → trigger `enforce_profiles_client_safe_update` filtre les champs privilégiés → trigger `fn_lock_identity_fields` bloque nom/DOB/email si KYC → INSERT dans `client_profile_changes` pour audit
- **Admin/Employee** : Dialog → `.from('profiles').update()` directe puis `writeAccountJournal` (gateway) puis `admin_audit_log.insert()` supplémentaire (double write)
- **Portal access** (mot de passe, invite, blocage) : passe correctement par EF `client-account-admin`

## Bypass scan (bypass-scan.txt)
7 sites d'écriture directe `.from('profiles')` depuis le frontend. **Aucun** ne passe par une EF gateway pour l'édition des champs métier.

## Gateway
❌ **Pas de gateway EF unique** pour l'édition profil. Le "gateway" réel est le couple **RLS + triggers PostgreSQL**. C'est une architecture "database-as-gateway" fonctionnelle mais différente du pattern Modules 35→47.

## RBAC
- Client : peut UPDATE ses propres champs (via `Client updates own contact fields`), champs privilégiés bloqués par trigger
- Employee/Admin : full UPDATE via policies staff + bypass triggers (via `is_staff_user`/`has_role`)
- Anon : refusé (`Deny anonymous access to profiles`)

## RLS — problèmes détectés (rls.sql)
- **`Users can manage own profile`** : utilise `(id = auth.uid())` — la colonne d'identité auth est `user_id`, PAS `id`. Cette policy est **effectivement inerte** (jamais matchée) → **redondance/dead code**.
- **`audit_readonly_profiles`** : ALL avec `USING = NULL` (permissif SELECT). Confusant, mais non exploitable seul.
- **Redondances** : `Staff can view all profiles` + `Employee reads all profiles` + `staff_manage_profiles` + `Admin manages all profiles` se chevauchent.
- **`Deny anonymous access`** correctement scopé sur `{anon}`.

## SQL
- ✅ 13 triggers actifs, dont 2 triggers de sécurité (safe_update + lock_identity)
- ✅ 7 CHECK contraintes sur enums de statut
- ✅ 12 indexes
- ⚠️ Pas de FK explicite `profiles.user_id → auth.users(id)` (contrainte Supabase, normal)

## Audit trail
- ✅ `admin_audit_log.action='client_profile_update'` : 3 entrées récentes → présent
- ✅ `client_profile_changes` : 8 entrées (self-service)
- ✅ Dialogs admin appellent `writeAccountJournal` (gateway journal canonique)
- ⚠️ Double-write dans `Account360ProfileEditDialog:226` : `writeAccountJournal` + `admin_audit_log.insert()` séparé → risque doublon audit
- ❌ **`v_customer_timeline` ne contient AUCUN événement `source_table = 'profiles'` ou `client_profile_changes`** (requête retourne 0 lignes). Les modifications profil ne remontent pas dans la timeline Client 360.

## Idempotency
❌ **Aucune** — l'écriture directe `.from('profiles').update()` n'a pas de clé d'idempotence. Un double-clic du dialog admin peut créer deux audits.

## Timeline
❌ **NON couvert par `v_customer_timeline`**. Les changements profil sont visibles via `client_profile_changes` (client) et `admin_audit_log` (admin), mais pas dans la vue unifiée Module 44.

## Communications
Hors périmètre écriture profil. Les actions portail (`send_password_reset`, `send_invite`) passent par `rpc_communication_enqueue` — **VÉRIFIÉ dans EF, non testé end-to-end ce tour-ci**.

## Journal gateway
❌ **NON systématique**. Frontend appelle `writeAccountJournal` en best-effort après le UPDATE, mais l'UPDATE lui-même n'est pas gaté. Un client malveillant pourrait UPDATE sans logger.

## QA réel
- Vérification live des 11 policies : dump dans `rls.sql`
- Vérification live des 13 triggers : sortie `pg_trigger`
- Vérification live 7 checks : sortie `pg_constraint`
- Test anon/staff/admin end-to-end via Playwright : **NON VÉRIFIÉ** ce tour-ci (pas exécuté)
- Test que `enforce_profiles_client_safe_update` rejette une élévation balance côté client : **NON VÉRIFIÉ** (pas exécuté)

## Code mort / obsolète
- Policy `Users can manage own profile` (colonne `id` inerte) — candidate suppression
- Redondance policies staff (3 policies qui font la même chose)

## Prod parity
- EF `client-account-admin` présente dans repo (24kB) — **NON VÉRIFIÉ** que la version déployée = version repo (pas de hash comparison ce tour-ci)
- Migrations : les 13 triggers + 11 policies interrogés live sur la DB de prod → **CONFORMES** au code

---

## STATUS: **PASS AVEC RÉSERVES**

### Réserves (par sévérité)

**P1 — Timeline manquante**
- `v_customer_timeline` ne surface pas les changements profil. Violation du principe Module 44 "timeline unifiée".
- Impact : historique Client 360 incomplet.
- Correction : ajouter branche UNION `client_profile_changes` + `admin_audit_log WHERE action='client_profile_update'` dans la vue.

**P1 — Absence de gateway unique**
- 7 sites frontend écrivent `.from('profiles').update()` directement. La sécurité repose entièrement sur triggers/RLS, pas sur une EF canonique.
- Impact : incohérence architecturale avec Modules 35→47. Idempotence impossible.
- Correction : soit accepter le pattern "DB-as-gateway" comme officiel pour Module 1, soit créer `client-profile-actions` EF.

**P2 — RLS dead policy**
- `Users can manage own profile` avec `(id = auth.uid())` — jamais match car identity col = `user_id`.
- Correction : DROP la policy.

**P2 — Double-write audit**
- `Account360ProfileEditDialog:226` fait `writeAccountJournal` + `admin_audit_log.insert`. Risque doublon.
- Correction : supprimer le second insert.

**P2 — Redondance policies staff**
- 3 policies équivalentes (`Staff can view`, `Employee reads`, `staff_manage_profiles`).
- Correction : consolider.

**NON VÉRIFIÉ** :
- Test Playwright anon/staff/admin end-to-end
- Test de rejet trigger `enforce_profiles_client_safe_update` sur élévation privilège
- Hash comparison EF repo↔déployée
