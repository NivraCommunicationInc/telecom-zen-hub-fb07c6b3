# Module 30 — Ligne mobile · Audit statique

**Statut** : AUDIT STATIQUE — en attente feu vert corrections
**Référence méthodologique** : Modules 27, 28 (Internet) et 29 (TV)

---

## 1. Cartographie

### UI
- `src/shared-ops/components/MobileServiceActionsDialog.tsx` (dialog principal, 3 onglets : Recharge / Options / SIM)
- Point d'entrée : `src/core-app/components/account-360/Account360QuickActions.tsx:363` (`<MobileServiceActionsDialog />`)
- Aucune autre surface Core ne touche aux tables mobiles clientes (les écritures dans `mobile_fulfillment` de `useOrderProcessing.ts`, `CoreCancellationsPage.tsx` et `MobileFulfillmentSection.tsx` sont **provisionnement de commande**, hors périmètre M30 — à revalider séparément).

### Edge Function canonique
- `supabase/functions/mobile-account-actions/index.ts` — 461 lignes, 4 actions :
  - `topup` → INSERT `mobile_topups`
  - `add_addon` → INSERT `mobile_addons`
  - `remove_addon` → UPDATE `mobile_addons` (status=cancelled)
  - `sim_action` → INSERT `sim_actions` (+ UPDATE `mobile_fulfillment.sim_iccid` / `sim_type` sur replace/swap)

### RPC
- Aucune RPC utilisée. Uniquement `checkStaffAuth` (helper `_shared/adminAuth.ts`).

### DB tables touchées
- `mobile_topups` (INSERT)
- `mobile_addons` (INSERT/UPDATE)
- `sim_actions` (INSERT)
- `mobile_fulfillment` (UPDATE — champs `sim_iccid`, `sim_type`)
- `admin_audit_log`, `client_activity_logs`, `client_internal_notes`, `email_queue` (best-effort try/catch — swallow)

### Emails
- `client_mobile_topup_confirmation`
- `client_mobile_addon_change` (activated | cancelled)
- `client_mobile_sim_action`

### Audit
- `admin_audit_log` : `mobile.topup`, `mobile.add_addon`, `mobile.remove_addon`, `mobile.sim_action`
- `client_activity_logs` : `balance_add`, `service_add`, `service_remove`, `service_change`
- `client_internal_notes` : préfixes `[MOBILE.TOPUP]`, `[MOBILE.ADD_ADDON]`, `[MOBILE.REMOVE_ADDON]`, `[MOBILE.SIM_ACTION]`

### Provisioning réel vs simulation
- **Provisioning réel** : `mobile_fulfillment.sim_iccid` est réécrit sur `replace_sim`, `swap_to_physical`, `swap_to_esim` — pas de flag `simulated`, pas d'appel opérateur mais l'état canonique de la SIM est modifié en base.
- `metadata.simulated=true` **absent partout** (contraire au standard M28/M29).

---

## 2. Findings

### P1 — Bloquants (sécurité / intégrité)

| ID | Description |
|---|---|
| **F30-1** | **Aucun `assertOwnership()`** : la fonction ne vérifie pas que `account_id` (et `subscription_id`) appartiennent bien à `client_user_id`. Un staff avec un rôle valide peut passer n'importe quelle combinaison `(client_user_id, account_id)` cross-client. Pattern M28/M29 non appliqué. |
| **F30-2** | **RBAC uniforme et permissif** : `ALLOWED_ROLES = {admin, employee, supervisor, support, billing_admin, sales}` s'applique à **toutes** les actions, y compris `suspend_stolen`, `replace_sim`, `swap_to_esim` (critiques). `sales` peut suspendre/remplacer une SIM. Pas de granularité par action comme M28 (change_plan / factory_reset restreints). |
| **F30-3** | **Prix et code d'add-on contrôlés par le frontend** : `addon_code`, `addon_name`, `addon_type`, `monthly_price` viennent tous du client. Aucun catalogue serveur (pas de `mobile_addons_catalog` équivalent à `tv_packs`/`channel_packages`). Un staff pénalisé pourrait activer un « add-on » à 0 $ ou à un nom arbitraire — validation catalogue **inexistante**. |
| **F30-4** | **Lecture cross-account côté UI** : `MobileServiceActionsDialog.tsx:119-124` liste `mobile_addons` par `user_id` uniquement, sans filtrer par `account_id`. Sur un compte multi-lignes, on affiche/annule les add-ons d'un autre account_id. Même défaut que M29 pré-durcissement (CoreChannelsPage). |
| **F30-5** | **`payment_reference` de recharge contrôlable client** : `body.payment_reference` accepté tel quel; en cas de méthode carte/interac le serveur devrait le générer (comme M29 VOD). Risque de collision ou d'usurpation de référence de paiement. |

### P2 — Importants (traçabilité / robustesse)

| ID | Description |
|---|---|
| **F30-6** | **Anti-flood absent** : aucun `checkAntiFlood` (le helper M28/M29 20/60 s n'est pas appelé). Une boucle de topup ou d'add-on n'est pas rate-limitée côté serveur. |
| **F30-7** | **Idempotency non-enforce** : `idempotency_key` est écrit dans `metadata` mais **jamais lu** pour détecter un replay. Les clés générées côté UI incluent `Date.now()` (`topup-<uid>-<ms>`, `sim-<uid>-<action>-<ms>`), donc un double-clic génère deux clés distinctes → deux inserts. Aucune barrière serveur. |
| **F30-8** | **Motifs non-obligatoires côté serveur** pour les actions critiques (`suspend_lost`, `suspend_stolen`, `replace_sim`, `remove_addon`). La validation existe uniquement dans le dialog (UI-side). Un appel direct à l'edge function passe sans motif. Pas de longueur minimale (5/10 chars) comme M27-M29. |
| **F30-9** | **Pas de `metadata.simulated=true`** sur aucune action. Empêche toute campagne QA propre (M29 : toutes actions marquées `simulated`). |
| **F30-10** | **Aucune synchronisation facturation** : les recharges (`mobile_topups`) et add-ons (`mobile_addons.monthly_price`) ne propagent rien vers `billing_subscriptions` / `monthly_invoice_lines` / `billing`. Un add-on récurrent à 10 $/mois n'apparaît dans aucune facture consolidée (violation de la règle Core « facturation consolidée » — mem://features/billing/consolidated-account-invoicing). |
| **F30-11** | **`sim_action` sans `subscription_id`** : si `body.subscription_id` est vide, `mobile_fulfillment_id` = null, `old_iccid` = null, et l'action est quand même écrite. Les actions critiques (replace/swap) exécutent alors un `UPDATE mobile_fulfillment` conditionné sur `mobile_fulfillment_id`, donc silencieusement ignoré — mais l'événement `sim_actions` est journalisé comme « completed ». **État incohérent**. |
| **F30-12** | **Pas de vérification d'état avant transition** : `reactivate` ne vérifie pas que la SIM est suspendue; `suspend_*` ne vérifie pas qu'elle est active. Aucune machine à états. |
| **F30-13** | **`remove_addon` : ownership partiel** : la fonction vérifie `existing.user_id === client_user_id` mais pas `existing.account_id === body.account_id`. Un staff avec accès à un compte A du même user peut annuler un add-on du compte B. |

### P3 — Qualité / conformité

| ID | Description |
|---|---|
| **F30-14** | **Format `payment_method` inclut `paypal`** dans l'UI (`MobileServiceActionsDialog.tsx:293`) — PayPal est décommissionné (mem://features/billing/paypal-decommissioned-3b). À retirer ou renommer. |
| **F30-15** | **Validation entrées manquante** : aucun regex sur `msisdn` (E.164 / 10 chiffres CA), `new_iccid` (19-20 chiffres), `payment_reference`. `amount` accepté sans borne max (`Number.isFinite && > 0` uniquement) — un topup de 10 000 000 $ passe. |
| **F30-16** | **Codes d'erreur non standardisés** : la fonction retourne `{ error: "message français" }` sans `error_code` machine-lisible (`OWNERSHIP_DENIED`, `RATE_LIMIT`, `IDEMPOTENCY_REPLAY`, `INVALID_MOTIF`) → régression vs M28/M29. Tests E2E impossibles à écrire de façon stable. |
| **F30-17** | **`actor_role` = `"staff"` en dur** dans `client_activity_logs` — pas la vraie granularité (admin / support / sales). Empêche l'analyse comportementale par rôle. |
| **F30-18** | **`admin_audit_log` sans `severity` / criticality flag** pour les actions SIM critiques (`suspend_stolen`, `replace_sim`). M27 utilise `severity` pour les tags critiques — pattern à propager. |
| **F30-19** | **Try/catch swallow silencieux** sur `audit`, `logActivity`, `addNote`, `enqueueEmail` : une action réussit domain-side même si l'audit échoue → perte de traçabilité indétectable. Devrait au minimum écrire dans `billing_system_alerts` / `notification_outbox` (comme M28 fait pour sync gaps). |

### P4 — Cosmétique / dette

| ID | Description |
|---|---|
| **F30-20** | Bandeau UI « Aucun catalogue d'options mobiles n'est encore configuré » (`MobileServiceActionsDialog.tsx:327-329`) — dette assumée depuis longtemps, à convertir en vrai catalogue serveur (voir F30-3). |
| **F30-21** | Emails enqueued avec `priority: 0` sans détection de langue client → pas de garantie bilingue (M28/M29 lisent `client_email_preferences.preferred_language`). |
| **F30-22** | `SIM_ACTION_LABELS` en dur dans l'EF : dupliqué côté UI (`SIM_ACTIONS`). Source de vérité à unifier. |
| **F30-23** | Header commentaire de la fonction mentionne « suspend / reactivate / replace / swap eSIM / block intl-roaming » mais liste `block_roaming` / `unblock_roaming` sans documenter la distinction avec `block_international`. Doc à préciser. |

---

## 3. Vérifications standard

| Contrôle | État |
|---|---|
| Écritures directes frontend | ⚠️ **1 lecture directe** (`mobile_addons` par `user_id` sans `account_id`). Aucune écriture directe détectée — tout passe par l'EF ✅. |
| RBAC par action | ❌ Uniforme, permissif (F30-2). |
| Ownership `client_user_id` ↔ `account_id` | ❌ Absent (F30-1, F30-13). |
| Validation données | ❌ MSISDN, ICCID, borne montant, catalogue add-on (F30-3, F30-15). |
| Synchronisation facturation | ❌ Absente (F30-10). |
| Provisioning réel vs simulation | ⚠️ Écritures réelles sur `mobile_fulfillment`, aucun flag `simulated` (F30-9). |
| Idempotency | ❌ Non enforce serveur (F30-7). |
| Anti-flood | ❌ Absent (F30-6). |
| `admin_audit_log` | ✅ Présent (best-effort, sans severity — F30-18). |
| `client_activity_logs` | ✅ Présent (`actor_role` en dur — F30-17). |
| `client_internal_notes` | ✅ Présent. |
| `email_queue` | ✅ Présent (sans langue client — F30-21). |
| Rollback / cleanup | ⚠️ Aucun rollback transactionnel : si `mobile_fulfillment` UPDATE échoue après `sim_actions` INSERT, la ligne SIM est journalisée « completed » sans changement effectif (F30-11). |

---

## 4. Verdict

**Module 30 antérieur au durcissement M27 → M29.** Architecture fonctionnelle mais **sous-standardisée** :

- 5 P1 dont un critique de contrôle des prix (F30-3) et un cross-account (F30-1) — non-conformes au standard Core actuel.
- 8 P2 dont l'absence complète d'idempotency, anti-flood et sync facturation.
- 4 P3 de qualité (payload d'erreur, actor_role, sévérité audit).
- 3 P4 dette.

## 5. Recommandations (à valider avant application)

1. Aligner `mobile-account-actions` sur le squelette `tv-account-actions` / `internet-account-actions` (assertOwnership, RBAC granulaire, anti-flood, idempotency serveur, error codes, `metadata.simulated`, `actor_role` réel).
2. Créer un catalogue serveur `mobile_addons_catalog` (ou réutiliser `product_prices` filtré par famille) et forcer `addon_id` → lookup côté EF (comme M29 packs).
3. Ajouter une synchronisation `billing_subscriptions.plan_name` / `monthly_invoice_lines` pour les add-ons récurrents.
4. Refactorer `MobileServiceActionsDialog` pour scoper toutes les lectures par `account_id` et générer les `idempotency_key` stables (UUID par ouverture de dialog).
5. Retirer l'option `paypal` de la liste `payment_method`.
6. Serveur : générer `payment_reference` server-side pour toute méthode ≠ `manual`/`cash`.
7. Ajouter une machine à états SIM (active ↔ suspended) et refuser les transitions incohérentes.
8. Standardiser les erreurs (`error_code` + `error` + `checks[]`) pour permettre l'écriture de `qa-module30-runner`.

---

**En attente feu vert pour appliquer F30-1 → F30-23.**

---

## 4. Static Fixes — F30-1 → F30-23 appliqués (2026-07-10)

**Migration** : `mobile_addons_catalog` créée (source de vérité serveur pour les options mobiles). RLS admin-only sur écriture, lecture publique restreinte aux entrées actives.

**Edge Function `mobile-account-actions`** — réécrite selon le patron M28/M29 :
- F30-1 ownership stricte : profile → account → subscription (403 `CROSS_CLIENT_TARGET`)
- F30-2 RBAC granulaire : `ROLES_TOPUP`, `ROLES_ADDON`, `ROLES_SIM_STD`, `ROLES_SIM_CRITICAL` (suspend_stolen / replace_sim ⇒ admin/super_admin/supervisor/techops uniquement)
- F30-3 add-ons résolus depuis `mobile_addons_catalog` (catalog_id ou addon_code) — plus jamais dictés par le frontend
- F30-4 lectures scopées `(user_id, account_id)` côté UI ET EF
- F30-5 `payment_reference` généré serveur (`serverRef("TOP")`) sauf `manual`/`cash` où une référence agent sanitisée est acceptée
- F30-6 anti-flood 20 mobile.* / 60 s (audit log)
- F30-7 idempotency replay 5 min via `admin_audit_log.details.idempotency_key`
- F30-8 motifs obligatoires : ≥5 chars std, ≥10 chars critiques
- F30-9 `metadata.simulated = true` sur toutes les actions
- F30-10 alertes `mobile_addon_billing_sync_pending` levées pour tout addon récurrent
- F30-11 `sim_action` : `subscription_id` obligatoire + fulfillment résolu strictement
- F30-12 machine à états SIM (suspend/reactivate/replace) dérivée de la dernière `sim_actions.status='completed'`
- F30-13 `remove_addon` valide `account_id` scope
- F30-14 PayPal retiré (`ALLOWED_PAYMENT_METHODS` = manual/cash/interac/credit_card/debit_card/square/adjustment)
- F30-15 regex MSISDN + ICCID + cap montant (500 $) + cap addon (200 $/mois) + whitelist devises
- F30-16 codes normalisés (`UNAUTHORIZED`, `FORBIDDEN_ROLE`, `CROSS_CLIENT_TARGET`, `RATE_LIMIT`, `REASON_REQUIRED`, `INVALID_STATE`, `AMOUNT_EXCEEDED`, `UNKNOWN_ADDON`, `ADDON_ALREADY_ACTIVE`, `INVALID_PAYMENT_METHOD`, `NOT_FOUND`, `DB_ERROR`, `INTERNAL_ERROR`)
- F30-17 `actor_role` réel via `checkStaffAuth().callerRole`
- F30-18 `admin_audit_log.details.severity` = `critical` pour SIM criticals
- F30-19 échec audit/activity/notes/email ⇒ `billing_system_alerts` (`mobile_audit_write_failed`, `mobile_activity_write_failed`, `mobile_note_write_failed`, `mobile_email_enqueue_failed`, `mobile_fulfillment_sync_failed`)
- F30-20 catalogue serveur (couvre F30-3)
- F30-21 emails lisent `client_email_preferences.preferred_language`
- F30-22 `SIM_ACTION_LABELS` canonique (UI mirroir)
- F30-23 header documente `block_roaming` vs `block_international`

**Frontend `MobileServiceActionsDialog.tsx`** :
- Aucune écriture directe — toutes les mutations passent par l'EF canonique
- Add-ons lus depuis `mobile_addons_catalog` (dropdown), plus aucune saisie de prix libre
- Lectures `mobile_addons` scopées par `account_id`
- PayPal retiré du sélecteur méthode de paiement
- Motifs obligatoires côté UI (miroir des règles serveur 5/10)
- Idempotency keys stables par intention (`topup:*`, `addon-add:*`, `addon-remove:*`, `sim:*`)
- Bouton SIM désactivé sans `subscription_id`

**Statut** : STATIC FIXES DÉPLOYÉS ✅ — en attente feu vert pour lancer l'E2E QA du Module 30.
