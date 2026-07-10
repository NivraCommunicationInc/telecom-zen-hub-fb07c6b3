# Module 29 — Service TV

Statut : **AUDIT STATIQUE LIVRÉ** (2026-07-10) — En attente du feu vert avant corrections.

## Cartographie

### UI
- `src/shared-ops/components/TVServiceActionsDialog.tsx` — dialog principal C360/OneView, 6 onglets : Forfait, Bouquets, Chaînes, VOD, Terminal, Parental. Toutes les mutations passent par `supabase.functions.invoke("tv-account-actions", …)`.
- `src/core-app/components/account-360/Account360NewActionDialogs.tsx` — `RemoteRebootDialog` (target=terminal) route vers `tv-account-actions` `terminal_action` `reboot`.
- Lectures directes (read-only, non-mutation) :
  - `tv_addon_subscriptions` (liste bouquets actifs)
  - `tv_channels` + `channel_selections` (catalogue + sélection courante)
  - `tv_parental_controls` (pré-remplissage)
- Écrans hors périmètre Module 29 mais qui touchent le domaine TV (à noter, hors C360) :
  - `src/pages/client/ClientChannels.tsx` — portail client (self-service), writes `channel_selections` avec RLS client.
  - `src/core-app/pages/CoreChannelsPage.tsx` — page staff dédiée aux demandes de chaînes, fait `update channel_selections status=confirmed|cancelled` **directement en frontend** (bypass EF, pas d'audit).
  - `src/pages/staff/StaffTvChannels.tsx` — lecture seule.

### Edge Function canonique
- `supabase/functions/tv-account-actions/index.ts` (601 lignes) — 7 actions : `change_plan`, `add_themed_pack`, `remove_themed_pack`, `purchase_vod`, `terminal_action`, `set_parental`, `set_channels`.

### Tables domaine
- `tv_plan_changes`, `tv_addon_subscriptions`, `tv_vod_purchases`, `tv_terminal_actions`, `tv_parental_controls`, `channel_selections`, `tv_channels` (catalogue), `channel_packages` (catalogue bouquets), `subscriptions` (sync plan best-effort).

### Traçabilité
- `admin_audit_log` : action `tv.<label>`, `admin_user_id`/`admin_email`/`details` (schéma aligné depuis F14-1).
- `client_activity_logs` : 7 actions (`plan_change`, `service_add`, `service_remove`, `equipment_change`, `service_change`, `channels_change`).
- `client_internal_notes` : `note_type='system'`, horodaté + motif.
- `email_queue` : templates `client_tv_plan_change`, `client_tv_pack_change`, `client_tv_vod_purchase`, `client_tv_terminal_action`, `client_tv_parental_controls`, `client_tv_channels_updated`.

---

## Findings

### P1 — Critiques

**F29-1 — Aucune validation ownership `client_user_id` ni `account_id`.**
`tv-account-actions` accepte `client_user_id` + `account_id` sans vérifier :
- que `profiles.user_id = client_user_id` existe ;
- que `accounts.id = account_id` appartient bien au `client_user_id`.
Seuls `remove_themed_pack` fait un check partiel (`existing.user_id !== client_user_id` → 403). Reste : `change_plan`, `add_themed_pack`, `purchase_vod`, `terminal_action`, `set_parental`, `set_channels` acceptent n'importe quel couple. Un staff peut coller `account_id` d'un autre client → écriture cross-account silencieuse. Parité M27/M28 : `assertOwnership()` obligatoire.

**F29-2 — RBAC trop permissif : `sales` autorisé sur toutes actions techniques/financières.**
`ALLOWED_ROLES = {admin, employee, supervisor, support, billing_admin, sales}` appliqué **globalement** (via `checkStaffAuth` sans filtre par action). Or :
- `terminal_action` `factory_reset` / `deactivate` sont critiques → doit être `admin/super_admin/supervisor/techops` (parité F28-3).
- `purchase_vod` engage une charge → doit exclure `support` bas niveau et `sales`.
- `set_parental` (PIN + rating) est sensible → doit exclure `sales`.
- `change_plan` doit exclure `sales` (parité M28 F28-3).
Aucune granularité par action aujourd'hui.

**F29-3 — `CoreChannelsPage.tsx` écrit `channel_selections` directement (bypass EF).**
Lignes 286 et 294 : `.update({ status: "confirmed" | "cancelled" })` en frontend, aucun audit, aucun email, aucun log activity. Doit router via `tv-account-actions` (nouvelle action `approve_channel_selection` / `reject_channel_selection`) ou via une action `set_channels` étendue.

**F29-4 — `set_channels` ignore complètement `account_id`.**
La table `channel_selections` n'est scopée que par `user_id`. En contexte multi-comptes, la sélection d'un compte écrase la précédente ou coexiste sans lien. Aucun rejet si `account_id` invalide. Parité F28-8 (WiFi scope).

### P2 — Élevées

**F29-5 — Idempotency non enforce serveur.**
`idempotency_key` est stocké dans `metadata` mais aucun replay-check. UI génère `${...}-${Date.now()}` (non stable, F29-11). Aucun `{ ok:true, replayed:true }`. Parité F28-4.

**F29-6 — Aucun anti-flood global.**
Seul `terminal_action` `reboot` a un anti-flood 120 s / terminal (l.446-458). Les autres actions (spam `change_plan`, `add_themed_pack`, `purchase_vod`, `set_parental`, `set_channels`) sont illimitées. Parité F28-6 (20 mutations `tv.*` / 60 s / staff → 429 `RATE_LIMIT`).

**F29-7 — `change_plan` ne synchronise pas `billing_subscriptions.plan_name`.**
Seule `subscriptions` est mise à jour (l.274-283) — best-effort, aucun `billing_system_alerts` sur divergence. Parité F28-17.

**F29-8 — `change_plan` ne valide pas `new_plan_name` contre le catalogue.**
Aucun check contre `public.services` (category=TV, active). Un staff peut créer un forfait fantôme. Parité F28-12.

**F29-9 — `add_themed_pack` ne valide pas `addon_code` contre `channel_packages`.**
Frontend fabrique `addon_code = "PACK_${category}_${id.slice(0,8)}"` (l.236 dialog) — code non-canonique, non validé serveur, aucune protection contre doublons actifs (2× même bouquet possible).

**F29-10 — `set_parental` upsert sur `user_id` seul → bleed multi-comptes.**
Table `tv_parental_controls` a `UNIQUE(user_id)`, donc un client avec 2 comptes voit ses réglages écrasés. Documenté comme backlog (F14-2 note interne) mais reste un finding actif. Solution sans migration : upsert manuel `SELECT-then-UPDATE-or-INSERT` scopé `(user_id, account_id)` avec application clef unique côté code (parité F28-8), ou migration `UNIQUE(user_id, COALESCE(account_id, '00…'))`.

### P3 — Moyennes

**F29-11 — Idempotency keys UI non stables.**
Toutes les clefs contiennent `Date.now()` → chaque clic génère une clef différente, replay-check impossible même après F29-5. Parité F28-15 (préfixes stables + UUID par ouverture de dialog).

**F29-12 — Motifs (`reason`) non exigés hors terminal critique.**
- `change_plan` : aucun motif requis.
- `add_themed_pack` / `remove_themed_pack` : aucun motif requis.
- `purchase_vod` : aucun motif.
- `set_parental` : aucun motif.
- `set_channels` : aucun motif.
- `terminal_action` : min. **3** char (should be 5 pour reboot, 10 pour factory_reset/deactivate — parité F28-9).
Impact : audit trail pauvre, `client_internal_notes` affiche "Motif: —".

**F29-13 — `actor_role` non propagé.**
`activity()` code en dur `actor_role: "staff"` (l.202), `sysNote` idem `created_by_role: "staff"` (l.220). `admin_audit_log.details` n'a pas `actor_role` non plus. Parité F28-10 (extraire depuis `staffResult.callerRole`).

**F29-14 — `metadata.simulated=true` manquant sur 6/7 actions.**
Seul `terminal_action` porte `simulated: true` (l.472). `change_plan`, `add_themed_pack`, `remove_themed_pack`, `purchase_vod`, `set_parental`, `set_channels` n'ont **pas** le flag → un run QA laisse des enregistrements indistinguables de vrais. Aucun `admin_audit_log.details.simulated`. Parité F28-13.

**F29-15 — Lectures dialog non scopées par `account_id`.**
- `tv_addon_subscriptions` filtré `user_id` seul (l.137).
- `tv_parental_controls` idem (l.181).
- `channel_selections` idem (l.162).
Dans un compte multi-account, les données bleedent d'un compte à l'autre.

### P4 — Cosmétiques / Hygiène

**F29-16 — Codes d'erreur non standardisés.**
Réponses de la forme `{ error: "…" }` sans `error_code`. Parité F28-14 (`UNAUTHORIZED`, `FORBIDDEN_ROLE`, `CROSS_CLIENT_TARGET`, `NOT_FOUND`, `INVALID_INPUT`, `REASON_REQUIRED`, `UNKNOWN_PLAN`, `UNKNOWN_ADDON`, `DUPLICATE_ACTIVE`, `RATE_LIMIT`, `DB_ERROR`, `INTERNAL_ERROR`, `METHOD_NOT_ALLOWED`).

**F29-17 — PIN parental haché SHA-256 sans salt/pepper.**
`sha256Hex(pin)` (l.112) : 4-8 chiffres, hachage direct → dictionnaire trivial (10k-100M entrées). Devrait au minimum utiliser `pgcrypto crypt(pin, gen_salt('bf'))` côté DB ou HMAC avec pepper env-var.

**F29-18 — `purchase_vod` `payment_reference` généré client-side possible.**
Frontend ne l'envoie pas actuellement, mais le body l'accepte (l.66/395). Devrait être **toujours** généré serveur pour l'audit financier.

**F29-19 — `remove_themed_pack` ne vérifie pas `account_id`.**
Le check ligne 357 valide `user_id` mais pas `account_id`. Un staff pourrait annuler un bouquet actif d'un autre compte du même client sans l'intention.

---

## Résumé priorisation

| Priorité | Findings | Focus |
|---|---|---|
| **P1** | F29-1 → F29-4 (4) | Ownership, RBAC granulaire, écriture directe `CoreChannelsPage`, scope account |
| **P2** | F29-5 → F29-10 (6) | Idempotency, anti-flood, sync billing_subscriptions, catalogue plan/addon, parental scope |
| **P3** | F29-11 → F29-15 (5) | Idempotency keys stables, motifs obligatoires, actor_role, simulated flag, reads scopés |
| **P4** | F29-16 → F29-19 (4) | Codes d'erreur, hash PIN, payment_reference serveur, ownership addon |

**Total : 19 findings.** Architecture proche de M14 (fermé PASS) mais **antérieure au durcissement M27/M28** — aucune reprise des patterns ownership/RBAC granulaire/anti-flood/idempotence-serveur/catalogue-validation/simulated-tag/error-codes qui sont désormais standard.

## Actions non modifiées par cet audit

Aucune. Rapport uniquement — en attente du feu vert utilisateur pour appliquer F29-1 → F29-19, puis livrer `qa-module29-runner` avec ~35+ checks (parité M28).

## Fichiers analysés
- `supabase/functions/tv-account-actions/index.ts` (601 lignes)
- `src/shared-ops/components/TVServiceActionsDialog.tsx` (691 lignes)
- `src/core-app/components/account-360/Account360NewActionDialogs.tsx` (RemoteRebootDialog, l.376-410)
- `src/core-app/pages/CoreChannelsPage.tsx` (writes directs `channel_selections`)
- `.lovable/c360/module14-service-tv.md` (historique F14-1/F14-2)
- `.lovable/c360/module28-service-internet.md` (référence patterns)
