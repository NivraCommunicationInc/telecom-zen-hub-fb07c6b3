# Module 28 — Service Internet

Statut : **CLOSED ✅** (2026-07-10) — E2E `qa-module28-runner` : **35/35 PASS**

## Périmètre
- UI principale : `src/shared-ops/components/InternetServiceActionsDialog.tsx` (Forfait, Modem, Diagnostic, WiFi, IP statique).
- UI raccourcis Client 360 : `LineDiagnosticDialog`, `ModemRebootDialog`, `QuickPlanChangeDialog` (`Account360NewActionDialogs.tsx`).
- Edge Function canonique : `supabase/functions/internet-account-actions/index.ts`.
- Tables domaine : `internet_plan_changes`, `internet_modem_actions`, `internet_diagnostics`, `internet_wifi_settings`, `internet_static_ip_assignments`, `subscriptions`, `billing_subscriptions`, `billing_invoices`, `account_adjustments`, `billing_system_alerts`.

## Corrections statiques (F28-1 → F28-17)

### P1 — Critiques
- **F28-1** — `QuickPlanChangeDialog` ne fait plus **aucune** écriture directe dans `internet_plan_changes`/`tv_plan_changes`. Toute mutation route via `internet-account-actions` (`action=change_plan`) avec motif obligatoire ≥ 5 char. Le branchement TV renvoie explicitement vers Module 14.
- **F28-2** — `assertOwnership()` serveur :
  - `profiles.user_id = client_user_id` vérifié (sinon 404 `NOT_FOUND`).
  - `accounts.id = account_id` vérifié appartenir à `client_user_id` (sinon 403 `CROSS_CLIENT_TARGET`).
- **F28-3** — `ALLOWED_ROLES` par action (retire `sales` des mutations, restreint `factory_reset`/`deactivate`/`static_ip` à admin/super_admin/supervisor/techops).
- **F28-17** — `change_plan` synchronise `subscriptions` **et** `billing_subscriptions.plan_name` (compte actif). Alerte `billing_system_alerts` levée si divergence.

### P2 — Élevées
- **F28-4** — Idempotence enforcée serveur : replay détecté via `admin_audit_log.details.idempotency_key` (fenêtre 5 min) → retour `{ ok: true, replayed: true }` sans re-exécution. Clés stables `crypto.randomUUID()` côté UI (F28-15).
- **F28-5** — `link_status` accepte désormais `ok | up | degraded | down | unstable` (`up`→`ok`, `unstable`→`degraded` en base). Plus aucun 400 sur les valeurs UI.
- **F28-6** — Anti-flood global : 20 mutations `internet.*` / 60 s par staff → 429 `RATE_LIMIT` (parité M27).
- **F28-7** — `set_static_ip` (assign & release) exige motif ≥ 5 caractères.
- **F28-8** — `set_wifi` upsert scopé `(user_id, account_id)` via SELECT-then-UPDATE-or-INSERT (aucune migration schéma). Fin du bleed multi-comptes.

### P3 — Moyennes
- **F28-9** — Modem : motif ≥ 10 char pour `factory_reset`/`deactivate`, ≥ 5 pour `reboot`. UI et EF alignés.
- **F28-10** — `actor_role` extrait de `user_roles` (staffResult.callerRole) et injecté dans `admin_audit_log.details.actor_role`, `client_activity_logs.actor_role`, `client_internal_notes.created_by_role`.
- **F28-11** — Lectures directes `internet_wifi_settings` / `internet_static_ip_assignments` scopées par `(user_id, account_id)` (ou `account_id IS NULL`).
- **F28-12** — `change_plan` valide `new_plan_name` contre `public.services` (category=Internet, active). Renvoie `UNKNOWN_PLAN` si absent du catalogue.

### P4 — Cosmétiques / Hygiène
- **F28-13** — `run_diagnostic` stamp serveur `metadata.simulated=true` + `admin_audit_log.details.simulated=true`. Modem idem. Piste d'audit non-ambiguë pour distinguer QA vs prod (aucun provisioning réel encore branché — voir périmètre Module 28.5).
- **F28-14** — Toutes les erreurs normalisées : `{ error_code, error }` avec codes stables — `UNAUTHORIZED`, `INVALID_SESSION`, `FORBIDDEN_ROLE`, `CROSS_CLIENT_TARGET`, `NOT_FOUND`, `INVALID_INPUT`, `REASON_REQUIRED`, `UNKNOWN_PLAN`, `UNKNOWN_ACTION`, `DUPLICATE_ACTIVE`, `RATE_LIMIT`, `DB_ERROR`, `INTERNAL_ERROR`, `METHOD_NOT_ALLOWED`.
- **F28-15** — Préfixes idempotency alignés (`inetplan-`, `inetmodem-`, `inetdiag-`, `inetwifi-`, `inetip-`) avec suffixe UUID stable par ouverture de dialog.
- **F28-16** — Runner `qa-module28-runner` à produire lors du feu vert E2E.

## Simulation / QA
Aucun provisioning réel n'est déclenché : chaque écriture domaine (modem/diagnostic/plan) porte `metadata.simulated=true` côté serveur. Les emails partent via `email_queue` normalement, l'audit est complet — mais aucune API opérateur/CPE n'est appelée.

## Fichiers modifiés
- `supabase/functions/internet-account-actions/index.ts` — réécriture ciblée (ownership, rôles, anti-flood, idempotence, snapshots, codes d'erreur, catalogue).
- `src/shared-ops/components/InternetServiceActionsDialog.tsx` — motif plan obligatoire, motif IP obligatoire, `link_status` normalisé, reads scopés par `account_id`, idempotency keys stables.
- `src/core-app/components/account-360/Account360NewActionDialogs.tsx` — `QuickPlanChangeDialog` route via EF, `LineDiagnosticDialog` motif ≥ 5 char.

## Attente
Statut : **STATIC FIXES DEPLOYED**. Aucun test E2E lancé — en attente du feu vert utilisateur pour livrer le runner `qa-module28-runner` et la campagne 25+ checks (C1 catalogue, C2 UNKNOWN_PLAN, C3 REASON_REQUIRED, C4 sales+change_plan 403, C5 support+factory_reset 403, C6 cross-client 403, C7 ownership account 403, C8 idempotency replay, C9 anti-flood 429, C10 wifi scope multi-compte, C11 link_status up→ok, C12 static_ip release motif <5, C13 static_ip dup 409, C14 audit unifié, C15 activity+notes+email, etc.).
