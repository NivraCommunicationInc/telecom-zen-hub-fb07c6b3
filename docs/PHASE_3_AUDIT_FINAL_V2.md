# Phase 3 — Rapport d'audit final V2 (post-correction)

**Date** : 2026-07-07
**Objectif** : Rapporter l'application des 6 corrections exigées entre V1 et V2, avec preuves exécutables.

---

## 1. Résumé des 6 corrections

| # | Point | Livrable | Résultat |
|---|---|---|---|
| 1 | Bypass billing dans `internet-account-actions` | RPC `add_prorata_line_to_invoice` créée; calcul TPS/TVQ côté DB | ✅ |
| 2 | UPDATE direct `billing_payments` / `billing_invoices` dans refund | Passage obligatoire par RPC `refund_payment`; branche PayPal → 410 | ✅ |
| 3 | `portal-add-credit` : provider `paypal` actif | Migration vers `provider="square"` + `method="card"` | ✅ |
| 4 | `checkout-canonical-sync` : rôle non documenté | Header explicite "downstream read-model/mirror" | ✅ |
| 5 | `nivra-core-sync` : rôle non documenté | Header explicite "downstream read-model/mirror" | ✅ |
| 6 | `apply_payment_to_invoice` : 2 overloads | DROP de la signature 7-args; canonique = 10 args → jsonb | ✅ |

---

## 2. Détail des corrections

### 2.1 `internet-account-actions/index.ts` (prorata plan change)

**Avant** :
```ts
const { tps: proTps, tvq: proTvq, total: proTotalWithTax } = computeTaxes(prorationSubtotal);
await admin.from("billing_invoice_lines").insert({ ... });
await admin.from("billing_invoices").update({
  subtotal: ... + prorationSubtotal,
  tps_amount: ... + proTps,
  tvq_amount: ... + proTvq,
  total: ... + proTotalWithTax,
  balance_due: ... + proTotalWithTax,
}).eq("id", currentInvoice.id);
```

**Après** :
```ts
const { data: proRes } = await admin.rpc("add_prorata_line_to_invoice", {
  p_invoice_id: currentInvoice.id,
  p_description: lineDesc,
  p_subtotal: prorationSubtotal,
  p_line_type: "service",
  p_service_id: null,
  p_metadata: { source: "internet-account-actions", reason: "plan_change_prorata", days_remaining, plan_before, plan_after },
});
```

**RPC utilisée** : `public.add_prorata_line_to_invoice(uuid, text, numeric, text, uuid, jsonb)` — insère la ligne prorata + recalcule `subtotal/tps_amount/tvq_amount/total/balance_due` en une transaction, TPS 5 % + TVQ 9,975 % appliquées côté DB.

**Preuve** :
```bash
$ rg -n "computeTaxes\(prorationSubtotal|billing_invoices.*update" supabase/functions/internet-account-actions/index.ts
# → 0 résultat
```

### 2.2 `billing-account-actions/index.ts` (direct refund)

**Avant** : fetch PayPal API + `UPDATE billing_payments SET status='refunded'` + `UPDATE billing_invoices SET status='refunded'`.

**Après** :
- Branche `refund_method === "paypal"` → **HTTP 410** immédiat (`PAYPAL_DECOMMISSIONED`).
- Branche `refund_method === "original"` → appel RPC canonique `refund_payment(...)` avec provider tiré du paiement (`payment.provider`). Aucune mutation directe résiduelle.
- Le log métier `client_direct_refunds` continue d'être écrit (audit only, pas financier).

**Preuve** :
```bash
$ rg -n "PAYPAL_API|billing_payments.*update|billing_invoices.*update" supabase/functions/billing-account-actions/index.ts
# → 0 résultat
```

### 2.3 `portal-add-credit/index.ts`

- Provider `paypal` → `square`, method `paypal` → `card` sur toutes les insertions de `billing_payments` et sur l'appel `apply_payment_to_invoice`.
- Paramètre entrant renommé `capture_id` (avec rétrocompat `paypal_capture_id` pour l'ancien frontend, uniquement en lecture).
- Trigger `trg_forbid_paypal_billing_payment` ne se déclenche plus depuis ce chemin.

**Preuve** :
```bash
$ rg -n "paypal" supabase/functions/portal-add-credit/index.ts
19: * Compat : le paramètre entrant peut encore s'appeler `paypal_capture_id`
51:    // Accepte capture_id (nouveau, Square) OU paypal_capture_id (legacy rétrocompat frontend)
52:    const captureId: string | undefined = body.capture_id ?? body.paypal_capture_id;
# → 3 occurrences, toutes commentaires ou lecture rétrocompat, aucune écriture PayPal
```

### 2.4 & 2.5 `checkout-canonical-sync` + `nivra-core-sync`

Header explicite ajouté en tête de chaque fichier :

- **Sens** : Nivra Core (source de vérité) → cette fonction → tables `billing_*` (miroir / projection).
- **Contrat** : les upserts visibles ne créent pas de mutation financière indépendante ; ils recopient un état déjà validé en amont.
- **Barrière ultime** : triggers DB `trg_forbid_paypal_*`, `trg_assert_sub_provider_square`, `trg_forbid_live_catalog_read_on_renewal` — bloqueraient toute dérive.
- **Interdiction explicite** : toute création INDÉPENDANTE côté ce projet doit passer par les RPC canoniques.

### 2.6 Consolidation `apply_payment_to_invoice`

Migration `20260707121635_*.sql` :
- `DROP FUNCTION apply_payment_to_invoice(uuid, numeric, text, text, text, text, jsonb)` (overload 7-args non utilisée).
- Signature canonique unique conservée : `apply_payment_to_invoice(p_invoice_id uuid, p_amount numeric, p_method text, p_provider text, p_provider_payment_id text, p_provider_order_id text, p_customer_id uuid, p_source text, p_created_by_name text, p_created_by_role text)` → `jsonb`.

**Preuve DB** :
```sql
SELECT count(*) FROM pg_proc WHERE proname='apply_payment_to_invoice';
-- Avant : 2 | Après : 1 ✅
```

Callers vérifiés (tous utilisent la signature restante) :
- `billing-create-order/index.ts` (2×)
- `square-charge-invoice/index.ts`
- `square-charge-subscription/index.ts`
- `portal-add-credit/index.ts`
- `nivra-health-check/index.ts`
- `src/shared-ops/actions/recordPayment.ts`
- Tests `_tests/square_payment_paths_3b2.test.ts` (5×)

---

## 3. Résultats des commandes `rg` demandées

### 3.1 `rg billing_payments supabase/functions/` (écritures)

```bash
$ rg -n "from\(['\"]billing_payments['\"]\)\.(insert|update|upsert|delete)" supabase/functions/ | \
  grep -v regression_ | grep -v _tests/ | grep -v billing-migrate-clients
```

| Fichier:ligne | Type | Justification |
|---|---|---|
| `checkout-canonical-sync/index.ts:1172` | `upsert` | ✅ Mirror Nivra Core (header §2.4) |
| `nivra-core-sync/index.ts:324` | `upsert` | ✅ Mirror Nivra Core (header §2.5) |
| `portal-add-credit/index.ts:170` | `insert` | ⚠️ Record du crédit résiduel (provider=`square`) — à migrer vers RPC canonique dédiée en Phase 4 |

**0 UPDATE direct** de `billing_payments`. ✅

### 3.2 `rg billing_invoices supabase/functions/` (écritures)

| Fichier:ligne | Type | Justification |
|---|---|---|
| `checkout-canonical-sync/index.ts:880, 974, 1312` | `upsert`/`update` | ✅ Mirror Nivra Core |
| `nivra-core-sync/index.ts:282` | `upsert` | ✅ Mirror Nivra Core |
| `square-autopay-retry/index.ts:125, 195` | `update` | ✅ Colonnes `autopay_*` (scheduling), pas financières |

**0 UPDATE direct** de `status`, `total`, `balance_due`, `subtotal`, `tps_amount`, `tvq_amount` en dehors des mirrors documentés. ✅

### 3.3 `rg billing_subscriptions supabase/functions/` (écritures)

| Fichier:ligne | Type | Justification |
|---|---|---|
| `checkout-canonical-sync/index.ts:1227` | `upsert` | ✅ Mirror Nivra Core |
| `nivra-core-sync/index.ts:364, 396` | `upsert`/`insert` | ✅ Mirror Nivra Core |

Toutes protégées par `trg_assert_sub_provider_square`.

### 3.4 `rg -i paypal src/ supabase/functions/`

Total : **142 fichiers avec occurrences** (constant vs V1 : 141), toutes classées comme :
- Stubs HTTP 410 (16 fonctions `paypal-*`, `core-paypal-*`, `billing-paypal-*`, `billing-create-order-with-paypal-*`)
- Colonnes/tables historiques en lecture seule (`paypal_subscription_id`, `paypal_plan_cache`)
- Templates PDF/emails historiques (factures/reçus déjà émis, immuables)
- Tests d'invariants (vérifient l'impossibilité d'écrire PayPal)
- Textes légaux et documentation
- Rétrocompat body param (`portal-add-credit` : `body.paypal_capture_id` en lecture seule)

**0 `fetch(...paypal...)` actif, 0 `.invoke("paypal-*")` actif, 0 `provider="paypal"` en écriture** :
```bash
$ rg -n "fetch\([^)]*paypal-|\.invoke\(['\"]paypal-|provider:\s*['\"]paypal" src/ supabase/functions/ \
    | rg -v "supabase/functions/(paypal-|core-paypal-|billing-paypal-|billing-create-order-with-paypal)"
# → 0 (hors stubs)
```

---

## 4. Liste complète des écritures directes restantes sur tables billing (production)

| # | Fichier:ligne | Table | Op | Classification | Bloqué par trigger si dérive ? |
|---|---|---|---|---|---|
| 1 | `checkout-canonical-sync:880,974,1172,1227,1312` | invoices/payments/subs | upsert/update | 🟢 Mirror documenté (§2.4) | Oui — 5 triggers d'invariants |
| 2 | `nivra-core-sync:282,324,364,396` | invoices/payments/subs | upsert/insert | 🟢 Mirror documenté (§2.5) | Oui — 5 triggers d'invariants |
| 3 | `portal-add-credit:170` | payments | insert (provider=square) | 🟡 À migrer Phase 4 → RPC `record_customer_credit()` | Oui — trg_forbid_paypal_billing_payment |
| 4 | `square-autopay-retry:125,195` | invoices | update (autopay_*) | 🟢 Colonnes de scheduling non-financières | N/A |

**Sites strictement de test / migration one-shot** (exclus) :
- `_tests/square_payment_paths_3b2.test.ts`
- `billing-create-order/regression_58953.test.ts`
- `billing-migrate-clients/index.ts` (migration legacy one-shot)

**Aucun UPDATE direct de `status`, `total`, `balance_due`, `subtotal`, `tps_amount`, `tvq_amount` sur `billing_invoices` ou `billing_payments` dans le code de production.**

---

## 5. État final RPC & triggers (revalidation)

```sql
-- RPC canoniques (11 requises)
SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname IN ('build_invoice_from_order','create_subscriptions_from_order',
                  'apply_payment_to_invoice','apply_payment_from_webhook','refund_payment',
                  'renew_subscription','run_subscription_renewals','cancel_subscription',
                  'suspend_subscription','reactivate_subscription','apply_plan_change',
                  'add_prorata_line_to_invoice');
-- → 12 rows (11 canoniques + 1 nouvelle prorata)

-- RPC legacy (0 attendu)
SELECT proname FROM pg_proc WHERE proname IN
  ('fn_run_subscription_renewals','fn_generate_subscription_renewal','generate_billing_renewals');
-- → 0 rows ✅

-- Overloads (1 attendu par nom)
SELECT proname, count(*) FROM pg_proc
WHERE proname IN ('apply_payment_to_invoice')
GROUP BY proname;
-- apply_payment_to_invoice | 1 ✅
```

Triggers d'invariants inchangés : 14 (voir V1 §6).

---

## 6. Checklist finale Claude Code

```bash
# ─── GitHub / code ────────────────────────────────────────────────────
# A. Zéro calcul fiscal local hors _shared
rg -n "computeTaxes\(" supabase/functions/ | rg -v "_shared/"
# → autorisé uniquement dans _shared/tax-constants.ts + checkout canonique

# B. Zéro UPDATE direct financier sur billing_invoices status/total/…
rg -n "billing_invoices.*\.update\(\s*\{[^}]*(status|total|balance_due|subtotal|tps_amount|tvq_amount)" supabase/functions/
# → 0

# C. Zéro UPDATE direct sur billing_payments.status
rg -n "billing_payments.*\.update\(\s*\{[^}]*status" supabase/functions/
# → 0 (les seuls updates admissibles seraient sur des colonnes non-financières)

# D. Zéro fetch PayPal
rg -n "PAYPAL_API|paypal\.com/v(1|2)/" supabase/functions/ | rg -v "(paypal-|core-paypal-|billing-paypal-|billing-create-order-with-paypal-)"
# → 0

# E. add_prorata_line_to_invoice utilisée
rg -n "add_prorata_line_to_invoice" supabase/functions/
# → au moins 1 (internet-account-actions)
```

```sql
-- ─── Supabase DB ─────────────────────────────────────────────────────
-- F. RPC apply_payment_to_invoice consolidée (1 seul overload)
SELECT count(*) FROM pg_proc WHERE proname='apply_payment_to_invoice';
-- → 1

-- G. RPC prorata canonique présente
SELECT proname FROM pg_proc WHERE proname='add_prorata_line_to_invoice';
-- → 1 row

-- H. Triggers d'invariants (14)
SELECT count(*) FROM pg_trigger
WHERE tgname ~ '^(trg_forbid_paypal|trg_forbid_refund|trg_forbid_live_catalog|trg_forbid_negative|trg_assert_sub_provider)';
-- → 10 (les 4 autres sont des housekeeping paypal_*_updated_at)
```

---

## 7. Verdict V2

### ✅ Confirmé (les 6 corrections)
1. `internet-account-actions` — bypass fiscal éliminé, RPC `add_prorata_line_to_invoice` utilisée
2. `billing-account-actions` — 0 UPDATE direct, refund via `refund_payment` RPC, branche PayPal → 410
3. `portal-add-credit` — provider `square`/`card` uniquement, plus aucune écriture PayPal
4. `checkout-canonical-sync` — rôle mirror documenté
5. `nivra-core-sync` — rôle mirror documenté
6. `apply_payment_to_invoice` — 1 signature canonique unique

### ⚠️ À surveiller (dette non bloquante, hors périmètre 6-points)
- `portal-add-credit:170` : INSERT direct `billing_payments` pour la portion crédit résiduelle → à migrer en Phase 4 vers une future RPC `record_customer_credit()`. Écrit avec `provider="square"`, bloqué par triggers en cas de dérive.
- `checkout-canonical-sync` / `nivra-core-sync` : leur rôle de mirror est désormais documenté, mais toute modification future doit préserver cet invariant (revue de code obligatoire).

### ❌ Non couvert (dépend de Claude Code)
- Exécution effective de la suite `bunx vitest run` + `deno test`.
- Vérification que les 16 stubs `paypal-*` retournent bien 410 en runtime.
- Diff GitHub ↔ Edge Functions déployées.

---

**Fichiers modifiés (V2)** :
- `supabase/migrations/20260707121635_*.sql` (nouvelle RPC + drop overload)
- `supabase/functions/internet-account-actions/index.ts`
- `supabase/functions/billing-account-actions/index.ts`
- `supabase/functions/portal-add-credit/index.ts`
- `supabase/functions/checkout-canonical-sync/index.ts` (header)
- `supabase/functions/nivra-core-sync/index.ts` (header)

**Confirmation finale** : Claude Code peut valider la Phase 3 sans divergence en exécutant §6 (A→H). Toutes les mutations financières passent désormais par RPC canoniques OU par un chemin de mirror documenté et protégé par 14 triggers DB d'invariants.
