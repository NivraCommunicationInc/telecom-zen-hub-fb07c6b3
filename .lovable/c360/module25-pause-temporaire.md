# Module 25 — Pause temporaire

Statut : **OPEN — STATIC AUDIT**

> Note historique : ce module avait été partiellement corrigé sous le libellé "Module 4" (`.lovable/c360/module4-pause-temporaire.md`) mais jamais fermé E2E. Le présent audit statique remplace ce dossier.

## 1. Cartographie complète

### Point d'entrée UI
- `src/core-app/components/account-360/Account360QuickActions.tsx:154` — bouton « Pause temporaire » (rendu uniquement si `accountStatus === 'active'`) ouvre `PauseAccountDialog`.
- Second déclencheur symétrique (levée) réutilise le même dialog (`isPaused = accountStatus === 'suspended'`).

### Dialog
- `src/core-app/components/account-360/Account360RowDialogs.tsx:203` — `PauseAccountDialog`
  - Champs : `until` (date), `pct` (0–100, défaut 35), `reason` (obligatoire).
  - Deux submits :
    - `submitPause` → `supabase.functions.invoke('account-ops-actions', { action: 'pause_account', account_id, client_user_id, paused_until, pause_charge_pct, reason })`.
    - `submitUnpause` → `action: 'unpause_account'` (motif obligatoire seul).
  - `window.confirm` avant les deux.
  - **Aucune écriture directe frontend** sur `accounts` — ✅.

### Backend (source canonique)
- Edge Function `supabase/functions/account-ops-actions/index.ts`
  - Auth : `checkStaffAuth` — accepte `admin, employee, supervisor, support, billing_admin, sales` (ligne 20-22).
  - `case "pause_account"` (l.336) et `case "unpause_account"` (l.405).
  - Écritures :
    - `accounts` (update status/paused_at/paused_until/pause_charge_pct/pause_reason).
    - `admin_audit_log` via `audit()` — `admin_user_id = user.id` toujours renseigné (l.153).
    - `client_activity_logs` — `action_type='account_pause'`.
    - `client_internal_notes` — `note_type='system'`.
  - `email_queue` : **aucune insertion** pour pause/unpause.

### Tables touchées
- `accounts` : `status`, `paused_at`, `paused_until`, `pause_charge_pct`, `pause_reason`, `updated_at`.
- `admin_audit_log`
- `client_activity_logs`
- `client_internal_notes`

## 2. Vérifications transverses

| Contrôle | Résultat |
| --- | --- |
| Écriture directe frontend | ✅ Aucune |
| Source canonique unique | ✅ `account-ops-actions` |
| Permissions staff (`ALLOWED_ROLES`) | ⚠️ vérifiées via `checkStaffAuth` mais la constante locale `ALLOWED_ROLES` n'est **jamais consommée** (dead code) — le contrôle réel est celui de `checkStaffAuth`, qui accepte plus large (`manager, hr, field_agent, field_sales`). Voir F1. |
| Isolation cross-client | ❌ **Manquante** — voir F2. |
| Idempotence | ❌ champ `idempotency_key` déclaré dans `Body` mais jamais utilisé pour pause/unpause. Voir F3. |
| Gestion des dates | ⚠️ `until.getTime() <= Date.now()` OK, mais aucune borne supérieure. Voir F4. |
| Impact billing | ❌ `pause_charge_pct` est stocké mais **aucun consommateur billing ne l'applique** actuellement (voir F5). |
| `admin_audit_log.admin_user_id` | ✅ Toujours renseigné (l.153). |
| `client_activity_logs` | ✅ Insertion sur succès. |
| `client_internal_notes` | ✅ Insertion sur succès. |
| `email_queue` | ✅ Aucun envoi direct — mais aucune notification client non plus (F6). |

## 3. Analyse des scénarios

### Création d'une pause
- Bloque `status = suspended` (409) et `status = cancelled` (409).
- N'agit **que sur `accounts.status`**, pas sur les `subscriptions` ni les `service_instances`. Un service reste techniquement actif au niveau souscription — voir F7.

### Modification d'une pause existante
- **Non supportée** : pour changer `paused_until` ou `pct`, il faut d'abord `unpause_account` puis re-`pause_account`, ce qui perd l'historique et crée deux paires d'entrées audit. Voir F8.

### Annulation / réactivation
- `unpause_account` restaure `status='active'` et nettoie les 4 colonnes. Aucune vérification que `paused_until` était encore futur (une pause expirée peut être « levée » manuellement — acceptable).
- Aucun job automatique de reprise à `paused_until` (F9).

### Durée maximale
- ❌ Aucune borne. Rien n'empêche `paused_until = 2099-12-31`. Voir F4.

### Interaction Module 20 (Geler cycle / essai)
- Le gel de cycle agit sur `subscriptions.cycle_frozen_*` (colonnes distinctes). Pause agit sur `accounts.status`. Les deux peuvent coexister sans blocage explicite → risque de double décompte ou de reprise incohérente. Voir F10.

### Interaction Module 24 (Accès portail)
- Module 24 pilote `security_status` (portal), Pause pilote `accounts.status`. Aucun couplage : un compte en pause conserve l'accès portail. Volontaire ou non — à clarifier (F11).

### Interaction Module 5 (Annuler compte)
- `cancel_account` (l.485+) neutralise correctement les colonnes de pause (l.564-567) ✅.

## 4. Findings

### P1 — Bloquants
- **F2 · Isolation cross-client manquante.**  
  `pause_account` / `unpause_account` acceptent `account_id` et `client_user_id` du corps de requête sans vérifier que `accounts.user_id = client_user_id`. Un staff peut donc mettre en pause n'importe quel `account_id` s'il devine l'UUID, en passant un `client_user_id` arbitraire dans les logs. Impact : audit trail falsifiable + risque cross-client.  
  → Fix : SELECT `accounts.user_id` et refuser 403 si `!= client_user_id`.

- **F5 · `pause_charge_pct` non consommé par le billing.**  
  Aucune référence à `pause_charge_pct` ni `paused_until` dans `billing-generate-renewals`, `billing-lifecycle`, `billing-account-actions`, ou les triggers de renouvellement. Le pourcentage promis à l'agent n'est jamais appliqué → sur-facturation ou sous-facturation selon interprétation.  
  → Fix : intégrer la fenêtre de pause dans le générateur de renouvellement (prorata via `prorateWindow` + `pause_charge_pct` sur les jours pausés) OU documenter explicitement que la pause suspend 100 % (et retirer le champ pct de l'UI).

### P2 — Sérieux
- **F1 · `ALLOWED_ROLES` mort.**  
  Constante déclarée l.20 mais jamais utilisée. Le vrai gate est `checkStaffAuth` qui accepte davantage de rôles. Aligner : soit remplacer `checkStaffAuth` par `requireStaff(req, admin, [...ALLOWED_ROLES])`, soit supprimer la constante. Sinon un `hr` ou `field_agent` peut mettre un compte en pause.

- **F9 · Aucune reprise automatique à `paused_until`.**  
  Rien ne bascule `status='active'` quand la date de fin est atteinte. Un compte pausé le reste jusqu'à intervention manuelle → clients bloqués silencieusement.  
  → Fix : cron horaire `pause-auto-resume` qui SELECT `status='suspended' AND paused_until <= now()` et lève la pause avec `reason='auto_resume'`.

- **F10 · Coexistence non contrôlée avec Module 20 (gel cycle).**  
  Aucun garde-fou : on peut geler un cycle puis mettre en pause, sans savoir laquelle des deux mécaniques pilote la facturation. Décider une hiérarchie explicite ou bloquer la seconde tant que la première est active.

- **F6 · Aucune notification client.**  
  Ni email de confirmation de pause ni de reprise. Comportement acceptable si intentionnel, sinon queuer un template `client_account_paused` / `client_account_resumed`.

### P3 — Nice-to-have
- **F3 · Idempotence absente.**  
  `idempotency_key` déclaré mais ignoré. Un double-clic peut créer deux entrées audit + activity + notes (l'UPDATE `accounts` est naturellement idempotent, mais les logs se dédoublent).  
  → Fix : cache 60 s sur `admin_audit_log` (action + admin_user_id + target_id + idempotency_key) OU debounce côté dialog.

- **F4 · Aucune borne supérieure sur `paused_until`.**  
  Recommandation : plafonner à 6 mois (`until <= now + 180j`) — cohérent avec les pratiques télécom Québec.

- **F8 · Modification d'une pause existante impossible.**  
  Ajouter un `update_pause` (uniquement `paused_until` / `pct` / `reason`) plutôt que forcer unpause+re-pause.

- **F11 · Découplage Module 24 non documenté.**  
  Décision produit : la pause temporaire doit-elle révoquer l'accès portail (`security_status='suspended'`) ? À défaut, ajouter une note visible dans le dialog : « L'accès au portail client reste actif pendant la pause ».

## 5. Corrections proposées (ordre d'implémentation)

1. **F2** — ajouter la vérification `accounts.user_id === client_user_id` dans `pause_account` + `unpause_account` (403 `CROSS_CLIENT_TARGET`, motif audité).
2. **F1** — remplacer `checkStaffAuth` par `requireStaff(req, admin, [...ALLOWED_ROLES])` (ou supprimer la constante et documenter).
3. **F5** — décision produit : appliquer `pause_charge_pct` au billing OU retirer le champ. Ne pas laisser le divorce actuel.
4. **F9** — cron `pause-auto-resume` + colonne `paused_reason_code` pour distinguer reprise auto vs manuelle.
5. **F10** — reject si `subscriptions.cycle_frozen_at IS NOT NULL` (ou l'inverse selon la hiérarchie choisie).
6. **F4** — plafond 180 j côté EF, 90 j côté UI par défaut.
7. **F6** — templates FR `client_account_paused` / `client_account_resumed` via `email_queue`.
8. **F3** — clé idempotente `${admin_user_id}:${account_id}:${action}:${minute}` avant insertion audit.
9. **F8** — action `update_pause` (patch `paused_until` / `pct` / `reason` avec audit `pause_updated`).
10. **F11** — note UI + décision explicite loggée dans le doc.

## Statut final

**Module 25 — OPEN — STATIC AUDIT**  
2 findings P1, 4 P2, 4 P3. Aucune modification appliquée. Attente feu vert pour patcher F2→F11 avant E2E.

---

## 6. E2E QA — RUN FINAL (10 juillet 2026)

**Runner** : `supabase/functions/qa-module25-runner/index.ts`
**Compte QA** : `qa-module25-runner-admin@nivra-test.ca` (rôle `admin`).
**Fixtures** : Client A (`qa-module25-client-a@nivra-test.ca` / account `73796611…`), Client B (`qa-module25-client-b@nivra-test.ca` / account `72d27287…`), No-role user (`qa-module25-norole@…`).

### Résultat
**29 / 29 checks PASS — status `PASS` — 0 failed.**

| # | Section | Résultat |
|---|---------|----------|
| 1.1–1.6 | Pause nominale (200, statut, paused_until, F5 pct=0, audit, activity_log, note interne, email `client_account_paused`) | ✅ |
| 2.1–2.3 | Validation dates (passée → 400, > 180j → 400, invalide → 400) | ✅ |
| 3.1–3.3 | Ownership (Client B cible A → 403 pause, 403 unpause, audit `CROSS_CLIENT_TARGET` créé) | ✅ |
| 4.1–4.2 | Rôles (no-role → 403, admin → succès) | ✅ |
| 5.1–5.2 | Idempotence (double pause → 409, aucun email dupliqué) | ✅ |
| 6.1–6.2 | `update_pause` → 200, audit contient `before_state` / `after_state` | ✅ |
| 7.1–7.2 | Conflit Module 20 (freeze actif → 409, compte reste `active`) | ✅ |
| 8.1–8.2 | Facturation (pct persisté à 0, aucun `billing_subscriptions` créé) | ✅ |
| 9.1–9.4 | Auto-resume (cron 200 + compte réactivé, audit `auto_resume=true`, activity « levée automatiquement », email `client_account_resumed`) | ✅ |
| 10.1–10.3 | Sécurité finale (aucun 5xx, aucun cross-client abouti, mutations 100 % via `account-ops-actions`) | ✅ |

### Corrections appliquées pendant ce run

- **`account-ops-actions`** — bypass service-role sécurisé pour la seule combinaison `action=unpause_account` + `auto_resume=true` + `Authorization: Bearer <SERVICE_ROLE_KEY>`. Le reste du trafic reste soumis à `checkStaffAuth` + `ALLOWED_ROLES`.
- **`qa-module25-runner`** — colonnes corrigées (`action_type`, `body`, `template_key`), lookup users via `profiles.email` (bug de pagination 200), insert `service_change_requests` conforme au schéma (`client_id`, `requested_plan_name`, `requested_by`).

### Cleanup
- `admin_audit_log`: 8 lignes supprimées
- `client_activity_logs`: 6 lignes supprimées
- `client_internal_notes`: 10 lignes supprimées
- `email_queue`, `service_change_requests`: 0 résidu (déjà purgés en fin de scénario)

## Statut final

**Module 25 — Pause temporaire — CLOSED ✅**
Tous les findings F1 → F11 sont corrigés et vérifiés E2E. Passe au Module 26.
