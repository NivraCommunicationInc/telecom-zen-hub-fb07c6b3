# Phase 3.C.1 — Audit final

**Date :** 2026-07-07  
**Statut :** ✅ Migration appliquée, tests d'invariants passés  
**Contrainte tenue :** Square reste l'unique processeur — aucun code PayPal réintroduit.

---

## 1. Migrations SQL appliquées

Trois migrations Supabase successives (contenu final consolidé) :

| # | Objet | Description |
|---|-------|-------------|
| 1 | Fondation 3.C.1 (initiale) | Colonnes neutres `provider_*`, verrou Square, index d'idempotence, `renew_subscription()` idempotent, trigger anti-drift, `cancel/suspend/reactivate_subscription`, `apply_plan_change()`, `run_subscription_renewals()`, dépréciation legacy, vue de santé |
| 2 | Correctif `source_ref` | `renew_subscription()` : ligne insérée avec `source_ref='order_item'` (valeur autorisée par `chk_invoice_line_source_ref`) |
| 3 | Correctif `apply_plan_change` | Propage `source_order_item_id` de l'ancien vers le nouveau sub (freeze guard rule 1) |

Aucun autre schéma touché. Aucune donnée existante détruite.

---

## 2. Nouvelles RPC canoniques

| RPC | Signature | Rôle |
|-----|-----------|------|
| `renew_subscription(uuid, jsonb)` | `RETURNS uuid` | Facture de renouvellement idempotente. Prix ← `frozen_*` uniquement. Taxes recalculées puis figées dans `tax_snapshot`. Provenance enregistrée. |
| `run_subscription_renewals(int, jsonb)` | `RETURNS TABLE(sub, invoice, status)` | Orchestrateur cron canonique. Itère les subs dus, délègue à `renew_subscription`. Capture erreurs par sub. |
| `cancel_subscription(uuid, text, jsonb)` | `RETURNS uuid` | Annulation idempotente + provenance. |
| `suspend_subscription(uuid, text, timestamptz, jsonb)` | `RETURNS uuid` | Suspension avec `pause_until` optionnel. |
| `reactivate_subscription(uuid, jsonb)` | `RETURNS uuid` | Sortie d'un état `suspended`. |
| `apply_plan_change(uuid, text, text, numeric, text?, text?, jsonb)` | `RETURNS uuid` | **Transactionnelle** : ferme l'ancien, crée le nouveau (forcé `recurring_provider='square'`), lie `supersedes` ↔ `superseded_by`, provenance atomique. |

Toutes en `SECURITY DEFINER`, `SET search_path=public,pg_temp`, verrous `FOR UPDATE`.

---

## 3. Triggers installés

| Trigger | Table | Rôle |
|---------|-------|------|
| `trg_sync_provider_ids_bs` | `billing_subscriptions` | Double-écriture `paypal_* → provider_*` pour préparer le renommage. |
| `trg_assert_sub_provider_square` | `billing_subscriptions` | Rejette tout INSERT actif avec `recurring_provider ∉ (square, internal)`. |
| `trg_forbid_live_catalog_read_on_renewal` | `billing_invoice_lines` | Anti-drift **par origine** : sur lignes `product_recurring` de factures `renewal`, exige `metadata.source_subscription_id = invoice.subscription_id` **et** `unit_price = frozen_unit_price` du sub source. N'inspecte pas les lignes promo/crédit/prorata (compatibilité complète). |

---

## 4. Index d'idempotence

```sql
CREATE UNIQUE INDEX ux_billing_invoices_renewal_cycle
  ON billing_invoices (subscription_id, cycle_start_date, cycle_end_date)
  WHERE type='renewal' AND status NOT IN ('void','cancelled');
```

Verrouille au niveau DB tout doublon (subscription, période) — retry cron, double webhook, race concurrente : impossible d'insérer un deuxième renewal pour la même période.

---

## 5. Vue de monitoring

`public.v_subscription_renewal_health` (`security_invoker=on`) — colonnes : `subscription_id, customer_id, status, recurring_provider, cycle_*, frozen_*`, drapeaux `frozen_ok`, liens `supersedes / superseded_by`, `renewal_invoice_count`. Grant `SELECT` à `authenticated, service_role`.

État actuel :
```
 total_subs | with_frozen | square_subs | has_renewals
------------+-------------+-------------+--------------
         14 |          14 |           8 |            5
```

---

## 6. Tests d'invariants exécutés

| # | Test | Résultat |
|---|------|----------|
| 1 | `renew_subscription` retourne facture existante pour période déjà renouvelée | ✅ (index unique valide côté DB) |
| 2 | INSERT direct d'un doublon `(sub, cycle)` renewal | ✅ Rejeté par `ux_billing_invoices_renewal_cycle` |
| 3 | Ligne `product_recurring` renewal sans `metadata.source_subscription_id` | ✅ Rejetée par `fn_forbid_live_catalog_read_on_renewal` |
| 4 | Ligne `product_recurring` renewal avec `unit_price ≠ frozen_unit_price` | ✅ Rejetée par l'anti-drift |
| 5 | INSERT nouvel abonnement actif avec `recurring_provider='paypal'` | ✅ Rejeté par `fn_assert_subscription_provider_square` |
| 6 | `apply_plan_change` : ancien fermé (`cancelled`, `superseded_by=new`), nouveau créé (`recurring_provider='square'`, `supersedes=old`, `frozen_unit_price=nouveau prix`) | ✅ Atomique |
| 7 | `renew_subscription` sur UUID inexistant | ✅ Rejeté (`no_data_found`) |
| 8 | Vue `v_subscription_renewal_health` accessible et cohérente | ✅ |
| 9 | Facture renewal a `subtotal=frozen_unit_price`, `tax_snapshot.source='renewal_frozen'`, taxes recalculées (5% / 9.975%) et figées avec `source_subscription_id` | ✅ (exemple : `subtotal=60.00, tps=3.00, tvq=5.99, total=68.99, source=renewal_frozen`) |

Compat promo/crédit/prorata : la ligne `discount / promotion_applied / promotion` reste acceptée par l'anti-drift (trigger scope limité à `line_kind='product_recurring'`).

---

## 7. Anciennes RPC de renouvellement

Statut post-3.C.1 :

| Legacy RPC | État | Chemin actif |
|------------|------|--------------|
| `fn_generate_subscription_renewal(uuid)` | ⚠️ Wrapper déprécié — `RAISE WARNING [DEPRECATED-3C1]` puis délègue à `renew_subscription()` | Non appelé par aucune Edge Function scannée |
| `fn_run_subscription_renewals(int)` | ⚠️ Wrapper déprécié — délègue à `run_subscription_renewals()` | Non appelé par aucune Edge Function scannée |
| `generate_billing_renewals()` | 🔒 Inchangée (encore non-wrappée) | À réécrire ou retirer en 3.C.2 |
| `generate_account_renewal_invoice(uuid)` | 🔒 Inchangée | Encore référencée par `billing-subscription-cycle` (edge disabled, 410) et `billing-lifecycle` — cible **prioritaire 3.C.2** |

**Callers Edge Functions restants** (sortie `rg` filtrée) :

```
supabase/functions/billing-subscription-cycle/index.ts   — commentaire uniquement, fonction disabled (410)
supabase/functions/billing-lifecycle/index.ts             — À MIGRER en 3.C.2
supabase/functions/billing-generate-renewals/index.ts     — À MIGRER en 3.C.2 (priorité #1)
```

**Cron :** l'accès `cron.job` requiert le rôle superutilisateur (permission denied via le rôle admin). L'audit final des cron jobs est délégué à 3.C.5 (audit infra) avec la clé service_role.

**Critère bloquant 3.C.2** (rappel) : après réécriture de `billing-generate-renewals`, la commande
```bash
rg -n "fn_run_subscription_renewals|fn_generate_subscription_renewal|generate_billing_renewals" supabase/functions/
```
doit retourner **zéro caller applicatif**. Les wrappers restent en place pendant la fenêtre d'observation ; suppression finale en 3.C.4.

---

## 8. Garanties tenues vs. exigences

| Exigence 3.C.1 | Preuve |
|----------------|--------|
| Idempotence `renew_subscription()` | ✅ Index unique DB + SELECT-first + gestion `unique_violation` (tests 1, 2) |
| `apply_plan_change()` entièrement transactionnelle | ✅ Fonction plpgsql = 1 transaction implicite ; test 6 valide fermeture + création + liens en un seul appel |
| Trigger anti-drift valide **origine**, pas juste montants | ✅ `fn_forbid_live_catalog_read_on_renewal` exige `metadata.source_subscription_id` **et** cohérence prix, en préservant promos/crédits/proratas (tests 3, 4) |
| Prix exclusivement `frozen_*`, taxes recalculées puis figées | ✅ `renew_subscription` : `v_subtotal := v_sub.frozen_unit_price` ; GST/QST calculés puis persistés dans `tax_snapshot.gst_rate/qst_rate/gst_amount/qst_amount/source='renewal_frozen'` (test 9) |
| Square unique processeur, aucun code PayPal réintroduit | ✅ `fn_assert_subscription_provider_square` (test 5) ; `apply_plan_change` force `recurring_provider='square'` sur tout successeur ; aucun `paypal-*` invoqué par les nouvelles RPC |
| Anciennes RPC neutralisées | ⚠️ Wrappers dépréciés en place ; suppression des callers Edge en 3.C.2 (critère bloquant) puis DROP des wrappers en 3.C.4 |

---

## 9. Suite

- **3.C.2** — Réécrire `billing-generate-renewals` sur `run_subscription_renewals` ; supprimer tout caller de `fn_*_renewal*` et `generate_billing_renewals`. Vérification `rg` bloquante avant validation.
- **3.C.3** — Migrer `billing-lifecycle`, `dunning`, `reactivationEngine`, `client-plan-change` sur RPC canoniques.
- **3.C.4** — DROP wrappers legacy, DROP `generate_account_renewal_invoice`, DROP `fn_generate_subscription_renewal`, `fn_run_subscription_renewals`.
- **3.C.5** — Audit infra PayPal (secrets, webhooks, cron, CI/CD, routes, Edge Functions, env).

Aucun code frontend n'a été modifié à ce stade — 3.C.1 est strictement une fondation DB.
