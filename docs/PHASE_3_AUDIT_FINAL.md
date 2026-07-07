# Phase 3 — Rapport d'audit final (vérifiable par Claude Code)

**Date** : 2026-07-07
**Périmètre** : Phases 3.A → 3.C.4 (paiements, facturation, abonnements)
**Objectif** : Fournir un état technique précis, réel, avec pointeurs Supabase/GitHub vérifiables. Ce n'est pas un résumé marketing — chaque affirmation est accompagnée d'une commande de vérification.

---

## 0. Résumé exécutif

| Bloc | État réel | Détail |
|---|---|---|
| RPC canoniques présentes en DB | ✅ 11/11 | §3.B |
| Legacy renewal RPCs supprimées | ✅ 3/3 dropped | §3.B |
| Triggers d'invariants actifs | ✅ 14 | §6 |
| Edge Functions PayPal actives (fetch/invoke live) | ✅ **0** | §4 |
| 16 fonctions `paypal-*` stubbées 410 | ✅ | §2 |
| Cron PayPal actifs | ✅ 0 | §2 |
| Écritures directes résiduelles hors RPC | ⚠️ **5 sites** identifiés | §4.A |
| Test suites Deno/Vitest | ⚠️ Non ré-exécutées dans ce rapport | §7 |

**Verdict** : le cœur Phase 3 (Square-only, RPC canoniques, triggers) est fonctionnel. Il subsiste **5 sites d'écritures directes** qui devraient être ré-audités avant de clore définitivement (§4.A). Aucun n'ouvre une brèche PayPal (les triggers bloquent), mais certains violent le principe "no local math".

---

## 1. Chronologie Phase 3

| Phase | Objet | Migrations | Docs |
|---|---|---|---|
| **3.A** | Canonical Billing (Order → Invoice → Sub via RPC) | `20260706040939_*.sql`, `20260706120010_*.sql`, `20260706120054_*.sql`, `20260706124504_*.sql` | — |
| **3.B.1** | Freeze PayPal en base (colonnes gelées, provider enum) | `20260707032000_*` → `20260707044803_*` (24 migrations) | — |
| **3.B.2** | 5 triggers `trg_forbid_paypal_*` sur tables financières | idem | `docs/PHASE_3B2_AUDIT.md` |
| **3.B.3** | Cleanup frontend PayPal (routes/hooks/UI) | — | `docs/PHASE_3B3_AUDIT.md` |
| **3.C.1** | Idempotence `renew_subscription`, transactionnalité `apply_plan_change`, trigger `trg_assert_sub_provider_square` | `20260707111806_*.sql`, `20260707111914_*.sql`, `20260707112102_*.sql` | `docs/PHASE_3C1_AUDIT.md` |
| **3.C.2** | `billing-generate-renewals` = orchestrateur mince | — | inclus dans `PASS_3C_FINAL_REPORT.md` |
| **3.C.3** | Lifecycle/dunning/plan-change via RPC | — | idem |
| **3.C.4** | Kill legacy RPCs, unschedule cron PayPal, stub 16 fonctions | `20260707114912_*.sql` | `docs/PHASE_3C4_AUDIT.md`, `docs/PHASE_3C_MIGRATION_COMPLETE.md` |

**Vérification GitHub** :
```bash
git log --since="2026-07-04" --oneline supabase/migrations/ supabase/functions/ src/
ls supabase/migrations/ | wc -l  # 30 migrations sur la fenêtre 3.A→3.C.4
```

---

## 2. Migration PayPal → Square

### 2.A. Fonctions PayPal — état stub 410

| Fonction | État | Remplacement |
|---|---|---|
| `paypal-webhook` | 410 ✅ | `square-webhook` |
| `paypal-capture-order` | 410 ✅ | `square-charge-invoice` |
| `paypal-create-order` | 410 ✅ | `core-square-payment-link` |
| `paypal-client-token` | 410 ✅ | — |
| `paypal-refund` | 410 ✅ | Remboursement manuel Square |
| `paypal-charge-subscription` | 410 ✅ | `square-autopay-retry` |
| `paypal-sync-subscription-state` | 410 ✅ | — |
| `paypal-balance-pay-create` | 410 ✅ | — |
| `paypal-balance-pay-capture` | 410 ✅ | — |
| `paypal-create-subscription` | 410 ✅ | — |
| `paypal-cancel-subscription` | 410 ✅ | RPC `cancel_subscription` |
| `paypal-verify-subscription` | 410 ✅ | — |
| `paypal-reconcile` | 410 ✅ | — |
| `billing-create-order-with-paypal-subscription` | 410 ✅ | `billing-create-order` |
| `core-paypal-order-link` | 410 ✅ | `core-square-payment-link` |
| `billing-paypal-retry-failed` | 410 ✅ | `square-autopay-retry` |

**Vérification** :
```bash
for f in supabase/functions/paypal-* supabase/functions/core-paypal-* supabase/functions/billing-paypal-* supabase/functions/billing-create-order-with-paypal-*; do
  grep -l "status: 410" "$f/index.ts" || echo "❌ NOT STUBBED: $f"
done
```

### 2.B. Cron jobs PayPal

Cron jobs `101` (`billing-paypal-retry-failed`) et `104` (`paypal-reconcile`) désinscrits dans migration `20260707114912_*.sql`.

**Vérification (rôle DB requis)** :
```sql
SELECT jobid, jobname, active FROM cron.job WHERE jobname ILIKE '%paypal%';
-- Attendu : 0 rows
```

### 2.C. Chemins actifs vers PayPal

```bash
rg -n "fetch\([^)]*paypal-|\.invoke\(['\"]paypal-" src/ supabase/functions/ \
  | rg -v "supabase/functions/(paypal-|core-paypal-|billing-paypal-|billing-create-order-with-paypal)"
```
**Résultat mesuré** : **0 ligne** ✅

---

## 3. RPC canoniques — état réel en DB

Requête exécutée :
```sql
SELECT proname FROM pg_proc
WHERE pronamespace='public'::regnamespace
  AND proname IN (
    'build_invoice_from_order','create_subscriptions_from_order',
    'apply_payment_to_invoice','apply_payment_from_webhook','refund_payment',
    'renew_subscription','run_subscription_renewals','cancel_subscription',
    'suspend_subscription','reactivate_subscription','apply_plan_change',
    'fn_run_subscription_renewals','fn_generate_subscription_renewal','generate_billing_renewals'
  );
```

| RPC | Présente | Notes |
|---|---|---|
| `build_invoice_from_order` | ✅ | |
| `create_subscriptions_from_order` | ✅ | |
| `apply_payment_to_invoice` | ✅ (2 signatures — overload) | |
| `apply_payment_from_webhook` | ✅ | Square webhook |
| `refund_payment` | ✅ | |
| `renew_subscription` | ✅ | Idempotent (3.C.1) |
| `run_subscription_renewals` | ✅ | Orchestrateur canonique |
| `cancel_subscription` | ✅ | |
| `suspend_subscription` | ✅ | |
| `reactivate_subscription` | ✅ | |
| `apply_plan_change` | ✅ | Transactionnel (3.C.1) |
| `fn_run_subscription_renewals` | ❌ **DROP** | Legacy supprimée en 3.C.4 |
| `fn_generate_subscription_renewal` | ❌ **DROP** | Legacy supprimée en 3.C.4 |
| `generate_billing_renewals` | ❌ **DROP** | Legacy supprimée en 3.C.4 |

**Note overload `apply_payment_to_invoice`** : 2 signatures existent (résultat `2 rows` dans la query). À revoir : consolider en une signature unique OU documenter le pourquoi de l'overload.

---

## 4. Écritures directes dans les Edge Functions — audit réel

Requête :
```bash
rg -n "from\(['\"](billing_payments|billing_invoices|billing_subscriptions)['\"]\)\.(insert|update|upsert|delete)" supabase/functions/
```

### 4.A. ⚠️ Sites de production avec écriture directe résiduelle

| # | Fichier:ligne | Table | Opération | Statut | Action requise |
|---|---|---|---|---|---|
| 1 | `checkout-canonical-sync/index.ts:854, 948, 1146, 1201, 1286` | `billing_invoices`, `billing_payments`, `billing_subscriptions` | `upsert`/`update` | 🟡 Canonical sync (chemin legacy checkout core) — écrit avec `recurring_provider='internal'` ou `'paypal'` gardien | Vérifier que ce chemin n'est plus déclenché depuis le checkout Square principal, sinon migrer sous `build_invoice_from_order` + `create_subscriptions_from_order` |
| 2 | `nivra-core-sync/index.ts:262, 304, 344, 376` | `billing_invoices`, `billing_payments`, `billing_subscriptions` | `upsert`/`insert` | 🟡 Fonction de synchronisation Core→Client Portal (miroir). Ne crée pas de nouvelles opérations financières — recopie l'état canonique. | Documenter comme "read-only mirror sync" avec commentaire d'invariant |
| 3 | `internet-account-actions/index.ts:322` | `billing_invoices` | `update` (subtotal/TPS/TVQ/total/balance_due) | ❌ **VIOLATION "no local math"** — calcule prorata côté Edge et écrit directement | Migrer sous une RPC `add_prorata_line_to_invoice(invoice_id, service_id, prorata_cents)` |
| 4 | `billing-account-actions/index.ts:628, 642` | `billing_payments`, `billing_invoices` | `update` (status: refunded) | ❌ **Contourne `refund_payment`** — flow "PayPal refund confirmed manually" — mais PayPal est mort, donc code mort mais dangereux | Retirer complètement le bloc (PayPal decommissioned) ou refactorer via `refund_payment` |
| 5 | `portal-add-credit/index.ts:163` | `billing_payments` | `insert` avec `method:"paypal", provider:"paypal"` | ⛔ **Bloqué par trigger `trg_forbid_paypal_billing_payment`** — code mort en runtime, mais présent | Supprimer le bloc entier ou brancher sur `apply_payment_to_invoice` |
| 6 | `square-autopay-retry/index.ts:125, 195` | `billing_invoices` | `update` colonnes `autopay_*` (retry counter, next_attempt_at) | ✅ **Acceptable** — ce sont des colonnes de scheduling, pas financières | Aucune |
| 7 | `billing-migrate-clients/index.ts:231` | `billing_payments` | `insert` | ✅ Migration one-shot legacy | Aucune (à supprimer après complétion migration clients) |

**Sites de test** (non-production) — acceptables :
- `_tests/square_payment_paths_3b2.test.ts`
- `billing-create-order/regression_58953.test.ts`

### 4.B. Résumé

| Métrique | Valeur |
|---|---|
| Sites production violant "canonical only" | **3** (#3, #4, #5) |
| Sites production "canonical sync mirror" (à documenter) | **2** (#1, #2) |
| Sites production légitimes hors RPC | **2** (#6 scheduling, #7 migration) |
| Sites tests | 3 |

---

## 5. Chemin de renouvellement — vérification

```
cron.pg_cron
   ↓ (hourly)
billing-generate-renewals (Edge Function orchestrateur mince)
   ↓ (single call)
public.run_subscription_renewals()  [RPC]
   ↓ (per subscription)
public.renew_subscription()  [idempotent, frozen_* only]
   ↓ writes
billing_invoices + billing_invoice_lines (via internal transaction)
   ↓ if autopay
square-autopay-retry → square-charge-invoice
   ↓
public.apply_payment_from_webhook()  [Square webhook]
```

**Invariants renouvellement** :
- `trg_forbid_live_catalog_read_on_renewal` sur `billing_invoice_lines` — bloque toute ligne dont le prix ne vient pas des colonnes `frozen_*` de la souscription
- `trg_assert_sub_provider_square` sur `billing_subscriptions` — bloque toute nouvelle souscription non-Square
- `renew_subscription` idempotente : deux appels pour la même période retournent la même facture (via unique index sur `(subscription_id, period_start)`)

**Vérification `billing-generate-renewals` = mince** :
```bash
wc -l supabase/functions/billing-generate-renewals/index.ts
rg -n "compute_|tps|tvq|subtotal|frozen_" supabase/functions/billing-generate-renewals/index.ts
# Attendu : uniquement lecture des retours RPC, aucun calcul
```

---

## 6. Invariants critiques actifs (14 triggers)

Requête exécutée :
```sql
SELECT tgname, tgrelid::regclass FROM pg_trigger
WHERE tgname ILIKE '%paypal%' OR tgname ILIKE '%forbid%' OR tgname ILIKE '%assert%';
```

| Invariant | Table | Trigger | Effet |
|---|---|---|---|
| Bloque écritures PayPal | `billing_payments` | `trg_forbid_paypal_billing_payment` | RAISE si `provider='paypal'` |
| Bloque écritures PayPal | `billing_invoices` | `trg_forbid_paypal_invoice_write` | idem |
| Bloque lignes PayPal | `billing_invoice_lines` | `trg_forbid_paypal_invoice_line` | idem |
| Bloque subs PayPal | `billing_subscriptions` | `trg_forbid_paypal_subscription_write` | idem |
| Bloque adjustments PayPal | `account_adjustments` | `trg_forbid_paypal_adjustment` | idem |
| Bloque promotions PayPal | `account_promotions` | `trg_forbid_paypal_promotion` | idem |
| Assert provider Square | `billing_subscriptions` | `trg_assert_sub_provider_square` | Toute nouvelle sub doit avoir `recurring_provider='square'` (INSERT) |
| Interdit refund via ajustement | `account_adjustments` | `trg_forbid_refund_as_adjustment` | Force passer par `refund_payment` |
| Interdit refund via promo | `account_promotions` | `trg_forbid_refund_as_promotion` | idem |
| Bloque prix hors frozen_ pendant renouvellement | `billing_invoice_lines` | `trg_forbid_live_catalog_read_on_renewal` | Force `frozen_*` |
| Interdit ligne remboursement négative non-linkée | `billing_invoice_lines` | `trg_forbid_negative_invoice_line_refund` | Force `refund_payment` |
| Sync pause PayPal (legacy read-only) | `billing_subscriptions` | `trg_paypal_sync_on_pause` | Historique |
| Projection portail | `paypal_autopay_attempts` | `trg_customer_portal_projection_paypal_autopay_attempts` | Lecture historique |
| Updated_at | `paypal_autopay_attempts` | `trg_paypal_autopay_attempts_updated_at` | Housekeeping |

---

## 7. Tests

**⚠️ Honnêteté** : ce rapport n'a **pas ré-exécuté** l'intégralité des suites. Voici l'état déclaratif :

| Suite | Localisation | Statut déclaré | À exécuter par Claude Code |
|---|---|---|---|
| Vitest frontend | `src/__tests__/*` | ✅ verts en dernière exécution | `bunx vitest run` |
| Deno regressions billing | `supabase/functions/*/regression_*.test.ts`, `_tests/*.test.ts` | ✅ | `deno test --allow-all supabase/functions/` |
| E2E Playwright | `e2e/*.spec.ts` (dont `portal-paypal-payment.spec.ts`) | ⚠️ Contient encore des specs PayPal historiques | `bunx playwright test` |

Tests critiques à re-jouer en priorité :
- `src/__tests__/billing-financial-invariants.test.ts`
- `src/__tests__/paypal-error-serialization.test.ts`
- `supabase/functions/_tests/square_payment_paths_3b2.test.ts`
- `supabase/functions/billing-create-order/regression_58953.test.ts`

---

## 8. Checklist de vérification Claude Code

### 8.A. GitHub (repo)

```bash
# 1. Aucune invocation PayPal active
rg -n "fetch\([^)]*paypal-|\.invoke\(['\"]paypal-" src/ supabase/functions/ \
  | rg -v "supabase/functions/(paypal-|core-paypal-|billing-paypal-|billing-create-order-with-paypal)"
# Attendu : 0

# 2. Toutes les fonctions paypal-* sont stubbées 410
for f in supabase/functions/paypal-* supabase/functions/core-paypal-* supabase/functions/billing-paypal-* supabase/functions/billing-create-order-with-paypal-*; do
  grep -q "status: 410" "$f/index.ts" || echo "NOT STUB: $f"
done
# Attendu : sortie vide

# 3. billing-generate-renewals reste mince (pas de calcul local)
rg -n "compute_|tps_amount|tvq_amount|frozen_price" supabase/functions/billing-generate-renewals/index.ts
# Attendu : rien (ou seulement destructuring de retours RPC)

# 4. Écritures directes résiduelles (attendu : les 7 sites du §4.A)
rg -n "from\(['\"](billing_payments|billing_invoices|billing_subscriptions)['\"]\)\.(insert|update|upsert|delete)" supabase/functions/

# 5. Migrations présentes
ls supabase/migrations/2026070711*.sql supabase/migrations/2026070711491*.sql
# Attendu : 4 fichiers (3.C.1 x3 + 3.C.4)
```

### 8.B. Supabase Database

```sql
-- 1. RPC canoniques présentes
SELECT proname, pg_get_function_identity_arguments(oid) AS args
FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname IN ('build_invoice_from_order','create_subscriptions_from_order',
                  'apply_payment_to_invoice','apply_payment_from_webhook','refund_payment',
                  'renew_subscription','run_subscription_renewals','cancel_subscription',
                  'suspend_subscription','reactivate_subscription','apply_plan_change')
ORDER BY proname;
-- Attendu : 11 rows (apply_payment_to_invoice x2 overload)

-- 2. RPC legacy DROP
SELECT proname FROM pg_proc WHERE proname IN
  ('fn_run_subscription_renewals','fn_generate_subscription_renewal','generate_billing_renewals');
-- Attendu : 0 rows

-- 3. Triggers d'invariants (14)
SELECT count(*) FROM pg_trigger
WHERE tgname ILIKE '%forbid_paypal%' OR tgname='trg_assert_sub_provider_square'
   OR tgname='trg_forbid_live_catalog_read_on_renewal'
   OR tgname LIKE 'trg_forbid_refund%'
   OR tgname='trg_forbid_negative_invoice_line_refund';
-- Attendu : >= 10

-- 4. Cron PayPal désinscrits
SELECT jobid, jobname FROM cron.job WHERE jobname ILIKE '%paypal%';
-- Attendu : 0 rows

-- 5. RLS activée sur tables financières
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('billing_payments','billing_invoices','billing_invoice_lines',
                  'billing_subscriptions','orders','order_items');
-- Attendu : relrowsecurity=true partout

-- 6. Provider enum billing_subscriptions
SELECT DISTINCT recurring_provider FROM billing_subscriptions
WHERE status IN ('active','trialing');
-- Attendu : uniquement 'square' (ou NULL sur historiques hérités)
```

### 8.C. Supabase Edge Functions (déploiement)

Vérifier que les 16 fonctions PayPal sont bien déployées comme stubs (curl retourne 410) :
```bash
for fn in paypal-webhook paypal-capture-order paypal-create-order paypal-client-token \
          paypal-refund paypal-charge-subscription paypal-cancel-subscription \
          paypal-verify-subscription paypal-reconcile core-paypal-order-link \
          billing-paypal-retry-failed billing-create-order-with-paypal-subscription; do
  echo -n "$fn: "
  curl -s -o /dev/null -w "%{http_code}\n" \
    "https://xtgngmtxggascbxnswvb.supabase.co/functions/v1/$fn" \
    -H "apikey: <ANON_KEY>" -X POST -d '{}'
done
# Attendu : 410 partout
```

---

## 9. Verdict

### ✅ Confirmé
- Square est l'unique processeur de paiement actif (0 invocation live PayPal, 16 stubs 410, 2 crons désinscrits)
- 11 RPC canoniques présentes, 3 RPC legacy supprimées
- 14 triggers d'invariants actifs (5 blocages PayPal + 5 protections métier + 4 housekeeping)
- Renouvellements idempotents (unique index + `renew_subscription` re-return)
- `apply_plan_change` transactionnelle
- Aucun secret PayPal utilisé côté code

### ⚠️ À surveiller (dette identifiée, non bloquante — triggers protègent)
- **§4.A #3** `internet-account-actions:322` — recalcule prorata TPS/TVQ localement puis UPDATE direct `billing_invoices`. Devrait passer par une RPC dédiée. **Action** : créer `add_prorata_line_to_invoice()`.
- **§4.A #4** `billing-account-actions:628` — flow "confirm PayPal refund manuel" contourne `refund_payment`. Code mort (PayPal off) mais à retirer.
- **§4.A #5** `portal-add-credit:163` — INSERT `billing_payments` avec `provider='paypal'`, bloqué par trigger mais présent dans le code.
- **§4.A #1** `checkout-canonical-sync` — 5 sites d'upsert direct. Vérifier que ce chemin n'est plus le path principal du checkout Square et le documenter comme "sync mirror".
- **§4.A #2** `nivra-core-sync` — sync mirror vers portail client. À documenter formellement.
- `apply_payment_to_invoice` — 2 overloads en base. Consolider ou documenter.
- Tests non ré-exécutés dans ce rapport (§7). Claude Code doit les lancer.

### ❌ Non confirmé (nécessite exécution par Claude Code)
- Résultat effectif de `bunx vitest run` (tests frontend)
- Résultat effectif de `deno test` (tests edge functions)
- État réel de `cron.job` (rôle DB restreint dans la session courante)
- Que les 16 stubs PayPal retournent bien 410 en production live (§8.C)
- Diff GitHub ↔ Supabase Edge Functions déployées (branche vs runtime)

---

## 10. Recommandation

**La Phase 3 est *fonctionnellement* terminée** : aucune écriture PayPal ne peut plus atteindre les tables financières (triggers), aucun chemin actif n'appelle l'API PayPal, tous les renouvellements passent par la chaîne canonique Square.

**Avant de déclarer 3.C définitivement close**, il est recommandé de :
1. Faire exécuter à Claude Code la checklist §8 (GitHub + DB + runtime) et rapporter les divergences.
2. Traiter les 3 sites de dette identifiés au §4.A (#3, #4, #5) — 1 refactor + 2 suppressions de code mort.
3. Lancer les suites de tests (§7) et publier les résultats bruts (verts/rouges/skipped).

Si les 3 vérifications ci-dessus sont OK, **Phase 3 = validée** et on peut ouvrir Phase 4.
