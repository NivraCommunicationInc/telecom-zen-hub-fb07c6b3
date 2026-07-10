# Module 28 — Service Internet

Statut : **OPEN — STATIC AUDIT** (2026-07-10)

## Périmètre
Gestion complète du service Internet depuis Client 360 :
- **UI principale** : `src/shared-ops/components/InternetServiceActionsDialog.tsx` (5 onglets — Forfait, Modem, Diagnostic, WiFi, IP statique). Ouverte depuis `Account360QuickActions.tsx` bouton « Service Internet ».
- **UI secondaires (raccourcis QuickActions)** dans `src/core-app/components/account-360/Account360NewActionDialogs.tsx` : `LineDiagnosticDialog` (diagnostic rapide), `ModemRebootDialog` (reboot), `QuickPlanChangeDialog` (changement de forfait Internet/TV).
- **Edge Function canonique** : `supabase/functions/internet-account-actions/index.ts` (actions : `change_plan`, `modem_action`, `run_diagnostic`, `set_wifi`, `set_static_ip`).
- **Tables** : `internet_plan_changes`, `internet_modem_actions`, `internet_diagnostics`, `internet_wifi_settings`, `internet_static_ip_assignments`, `subscriptions`, `billing_subscriptions`, `billing_invoices`, `account_adjustments`, `billing_system_alerts`.
- **Emails** : `client_internet_plan_change`, `client_internet_modem_action`, `client_internet_diagnostic`, `client_internet_wifi_change`, `client_internet_static_ip`, `invoice_created` (si prorata).
- **Audit** : `admin_audit_log`, `client_activity_logs`, `client_internal_notes`.

## Findings

### P1 — Critiques

- **F28-1 — Écriture directe frontend `internet_plan_changes` / `tv_plan_changes`** (`QuickPlanChangeDialog`, lignes 561-572). Contourne totalement `internet-account-actions` : pas d'`admin_audit_log`, pas de synchro `subscriptions`, pas de prorata, pas de motif validé serveur, `change_type="core_manual"` inconnu du catalogue EF. **Rupture du principe "toutes mutations via EF canonique"**.
- **F28-2 — Absence de validation d'ownership** dans `internet-account-actions`. L'EF vérifie `checkStaffAuth` mais n'exige jamais que `client_user_id` corresponde à un compte réel ni que `account_id` fourni appartienne au même client. Un membre du personnel peut deviner un UUID et agir sur n'importe quel compte (parité M24/M25/M26/M27 non respectée).
- **F28-3 — `ALLOWED_ROLES` trop permissif pour actions destructives** (`admin, employee, supervisor, support, billing_admin, sales`). `factory_reset` et `deactivate` (modem) et `assign/release` d'IP statique devraient être restreintes à `admin / super_admin / supervisor / techops`. `sales` et `billing_admin` ne devraient pas pouvoir factory-reset un modem.
- **F28-17 — Split-brain `subscriptions` vs `billing_subscriptions`** dans `change_plan`. L'EF met à jour `subscriptions.plan_name/monthly_price/amount` mais jamais `billing_subscriptions.plan_name`. Le prorata puise pourtant dans `billing_subscriptions`. Divergence garantie entre le module Abonnements Core et Facturation.

### P2 — Élevées

- **F28-4 — Idempotency non-enforcée**. Les clés `idempotency_key` sont générées avec `Date.now()` côté UI (donc uniques à chaque clic) et ne sont **jamais vérifiées côté EF** (aucun `select` sur `admin_audit_log`/`metadata` pour détecter un replay). Un double-clic = double action / double email / double prorata.
- **F28-5 — Incohérence des `link_status` UI ↔ EF**. L'UI (`InternetServiceActionsDialog`) propose `up | degraded | down | unstable` mais l'EF n'accepte que `ok | degraded | down` → toute valeur `up` ou `unstable` renvoie 400. Diagnostic cassé pour deux options sur quatre.
- **F28-6 — Anti-flood partiel**. Cooldown seulement sur `reboot` (120 s même S/N). Aucune limite sur `factory_reset`, `deactivate`, `run_diagnostic`, `set_wifi`, `set_static_ip` → risque flood. Parité M27 (20 mutations/60 s) non respectée.
- **F28-7 — `set_static_ip` release sans motif obligatoire**. `body.reason` reste optionnel côté serveur alors que l'action a un impact tarifaire et technique. Devrait exiger ≥ 5 caractères.
- **F28-8 — `set_wifi` upsert scoped par `user_id` uniquement**. `internet_wifi_settings.user_id` est utilisé comme conflict key ; un client multi-adresses/multi-comptes voit ses réglages écrasés d'un compte à l'autre. Devrait être scopé `(user_id, account_id)`.

### P3 — Moyennes

- **F28-9 — Motif minimum trop court pour actions critiques**. `factory_reset`/`deactivate` acceptent 3 caractères ; devrait être ≥ 10 (parité locks M27).
- **F28-10 — `actor_role` hardcodé "staff"** dans `client_activity_logs` et `client_internal_notes` (au lieu du rôle réel extrait de `user_roles`). Parité F27-12 non respectée.
- **F28-11 — Lecture directe frontend sans scope `account_id`**. `InternetServiceActionsDialog` lignes 124-138 et 143-155 lit `internet_wifi_settings` et `internet_static_ip_assignments` filtré uniquement par `user_id`. Multi-comptes → fuite cross-account côté UI.
- **F28-12 — Absence de catalogue serveur pour les forfaits**. `change_plan` accepte n'importe quel `new_plan_name`/`new_monthly_price` — pas de contrôle contre `public.services` (catégorie `Internet`). Un forfait fantaisiste peut être poussé.

### P4 — Cosmétiques / Hygiène

- **F28-13 — Diagnostic simulé côté client** (`LineDiagnosticDialog`, `Math.random()` lignes 468-472). Génère des valeurs aléatoires côté UI puis les envoie à l'EF. Devrait être générée serveur (ou marquée `simulated=true` par l'EF, jamais fabriquée en front) pour préserver l'intégrité de la piste d'audit.
- **F28-14 — Erreurs non-normalisées**. L'EF renvoie des `error: "…"` en clair sans codes stables (`UNKNOWN_ACTION`, `REASON_REQUIRED`, `FORBIDDEN_ROLE`, `CROSS_CLIENT_TARGET`, `DUPLICATE_ACTIVE`, `NOT_FOUND`, `INVALID_INPUT`, `RATE_LIMIT`) — rend le E2E fragile. Parité F27-9.
- **F28-15 — Préfixes `idempotency_key` incohérents** (`inetplan-`, `inetmodem-`, `inetdiag-`, `inetip-` ; pas de préfixe pour `set_wifi`).
- **F28-16 — Runner E2E dédié absent** (`qa-module28-runner`).

## Récapitulatif priorités
| Priorité | Findings |
|---|---|
| P1 | F28-1, F28-2, F28-3, F28-17 |
| P2 | F28-4, F28-5, F28-6, F28-7, F28-8 |
| P3 | F28-9, F28-10, F28-11, F28-12 |
| P4 | F28-13, F28-14, F28-15, F28-16 |

## Attente
Statut : **OPEN — STATIC AUDIT**.
Aucune modification appliquée. En attente du feu vert pour corriger F28-1 → F28-17 avant la campagne E2E QA.
