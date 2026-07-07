# Phase 3.C.4 — Rapport de nettoyage final PayPal

**Date** : 2026-07-07  
**Statut** : ✅ Terminé — Square est l'unique processeur de paiement actif.

---

## 1. RPC supprimées (base de données)

| RPC | Signature | État |
|---|---|---|
| `public.fn_run_subscription_renewals` | `(p_lookahead_days int)` | **Supprimée** |
| `public.fn_generate_subscription_renewal` | `(p_subscription_id uuid)` | **Supprimée** |
| `public.generate_billing_renewals` | `()` | **Supprimée** |

Migration : `20260707_phase_3c4_cleanup`.  
`src/integrations/supabase/types.ts` sera régénéré automatiquement et ne référencera plus ces RPC.

## 2. Cron jobs désactivés

| jobid | Nom | Ancienne cible | État |
|---|---|---|---|
| 101 | `billing-paypal-retry-failed` | Edge Function stub 410 | **Unscheduled** |
| 104 | `paypal-reconcile` | Edge Function (API PayPal live) | **Unscheduled** |

Vérification :
```sql
SELECT jobid, jobname FROM cron.job
WHERE command ILIKE '%paypal%';
-- → 0 ligne
```

## 3. Edge Functions — État final (16 fonctions PayPal)

Toutes converties en stubs HTTP 410 (`error: paypal_decommissioned`).  
**Aucune** ne peut plus atteindre l'API PayPal ni écrire en base (bloqué au niveau DB par les triggers `trg_forbid_paypal_*` depuis 3.B.2).

| Fonction | Phase de décommission |
|---|---|
| `paypal-capture-order` | 3.B.2 |
| `paypal-create-order` | 3.B.2 |
| `paypal-client-token` | 3.B.2 |
| `paypal-refund` | 3.B.2 |
| `paypal-charge-subscription` | 3.B.2 |
| `paypal-sync-subscription-state` | 3.B.2 |
| `paypal-balance-pay-create` | 3.B.2 |
| `paypal-balance-pay-capture` | 3.B.2 |
| `paypal-create-subscription` | 3.B.2 |
| `billing-create-order-with-paypal-subscription` | 3.B.2 |
| `billing-paypal-retry-failed` | 3.B.2 |
| `core-paypal-order-link` | 3.B.2 |
| **`paypal-webhook`** | **3.C.4** |
| **`paypal-cancel-subscription`** | **3.C.4** |
| **`paypal-verify-subscription`** | **3.C.4** |
| **`paypal-reconcile`** | **3.C.4** |

## 4. Appelants serveur nettoyés

| Fichier | Changement |
|---|---|
| `supabase/functions/cancel-account/index.ts` | Suppression du `fetch(paypal-cancel-subscription)` — annulation exclusivement via mise à jour DB. |
| `supabase/functions/crm-create-sale/index.ts` | Suppression du `fetch(paypal-create-order)` mort. Champs `paypal_approve_url`/`paypal_order_id` conservés dans la réponse à `null` pour compat clients. |
| `supabase/functions/ops-watchdog/index.ts` | Retrait de la surveillance de `paypal-reconcile`. |

## 5. Validation finale (grep exécutable)

```bash
rg -in "fetch.*paypal-|invoke.*paypal-|/functions/v1/paypal-" src/ supabase/functions/ \
  | rg -v "^supabase/functions/(paypal-|core-paypal-|billing-paypal-|billing-create-order-with-paypal)" \
  | rg -v "__tests__|_tests|\.test\.ts|/docs/"
```
Résultat : **1 seule occurrence**, `nivra-diagnostic/index.ts:477` — endpoint de diagnostic qui **liste** l'URL du webhook (lecture seule, aucun appel). ✅ Acceptable.

## 6. Références PayPal restantes — Justifiées

Les occurrences suivantes ne sont **pas des chemins actifs** :

| Catégorie | Emplacement | Raison |
|---|---|---|
| Historique DB | `billing_payments.provider='paypal'`, `paypal_autopay_attempts`, `paypal_plan_cache` | Comptabilité, audits, remboursements historiques |
| Colonnes historiques | `billing_subscriptions.paypal_subscription_id/plan_id`, `orders.paypal_*`, `contracts.paypal_*` | Lecture seule pour PDF/reçus historiques |
| Enum TS | `BillingPaymentMethod = 'interac' \| 'manual' \| 'paypal'` | Lignes existantes en base référencent cette valeur |
| Constantes UI | `PAYMENT_METHODS.paypal = "Carte"` (masqué en libellé) | Affichage historique masqué |
| Textes légaux | `RefundPolicy.tsx`, `ModalitesPaiement.tsx`, `AccordPreautorisationDebit.tsx`, `CookieConsent.tsx` | Mentions contractuelles historiques |
| Tests legacy | `paypal-error-serialization.test.ts`, `system-lock-invariants.test.ts` (sections PayPal), `billing-financial-invariants.test.ts` | Valident l'immutabilité des paiements PayPal passés |
| Migrations SQL | Répertoire `supabase/migrations/` | Historique de schéma — jamais rejoué |
| Docs | `docs/PHASE_3B*.md`, `docs/PASS_3C_FINAL_REPORT.md`, présent rapport | Documentation |
| Diagnostic | `nivra-diagnostic/index.ts` | Lecture seule de la liste des webhooks |
| Reporting | `useTransactionTraceability.ts`, `ClientPaymentsHistory.tsx` | Affichage lecture seule des paiements passés |

## 7. Renommage neutre — **Différé**

Conformément à la directive initiale (« au fur et à mesure de la migration, pas de big-bang »), le renommage suivant est **différé** :

- `paypalCaptureId → providerCaptureId`
- `paypalOrderId → providerOrderId`
- `paypal_subscription_id → provider_subscription_id`
- `paypal_plan_id → provider_plan_id`
- `nivra_paypal_flow_active → nivra_payment_flow_active`

Ces renommages touchent > 60 fichiers TS et plusieurs colonnes DB en lecture historique. Ils seront appliqués **opportunément** au fil des futures modifications de chaque module concerné, avec adaptateurs de compatibilité si nécessaire.

## 8. Audit infrastructure — Checklist manuelle

Je n'ai pas d'accès direct aux dashboards Vercel / Cloudflare / GitHub / PayPal.  
À vérifier et retirer manuellement :

### Secrets Supabase Edge Functions (Cloud → Secrets)
- [ ] `PAYPAL_CLIENT_ID` — **à supprimer**
- [ ] `PAYPAL_SECRET` — **à supprimer**
- [ ] `PAYPAL_WEBHOOK_ID` — **à supprimer**
- [ ] `PAYPAL_BN_CODE` — **à supprimer** (si présent)
- [ ] `PAYPAL_ENV` / `PAYPAL_MODE` — **à supprimer** (si présent)

### Variables Vite (`.env` du projet)
- [ ] `VITE_PAYPAL_CLIENT_ID` — **à supprimer** (plus consommée par du code actif, mais conserver tant que l'ancien SDK PayPal est référencé dans les tests legacy)

### PayPal Developer Dashboard
- [ ] Désinscrire tous les **webhooks** pointant vers `/functions/v1/paypal-webhook` (retourne désormais 410)
- [ ] Révoquer les **credentials REST API** live et sandbox
- [ ] Suspendre les **billing plans** PayPal actifs (aucun renouvellement ne les charge plus)

### GitHub / CI-CD
- [ ] Rechercher dans `.github/workflows/` : `PAYPAL_*`, `paypal` → aucune référence attendue
- [ ] GitHub Secrets → supprimer `PAYPAL_*` si présents

### Vercel / Cloudflare
- [ ] Variables d'environnement projet → supprimer `PAYPAL_*` et `VITE_PAYPAL_*`
- [ ] Aucun Cloudflare Worker ni Pages Function ne réfère PayPal (rien détecté côté repo)

### Cron / Scheduled
- [x] Supabase cron : nettoyé (voir §2)
- [ ] Aucun autre planificateur externe attendu

## 9. Preuve que Square est l'unique processeur actif

| Contrôle | État |
|---|---|
| Triggers DB `trg_assert_sub_provider_square` (3.C.1) | ✅ Actif |
| Triggers DB `trg_forbid_paypal_*` sur `billing_payments`, `billing_invoices`, `billing_subscriptions`, `account_adjustments`, `account_promotions` (3.B.2) | ✅ Actif |
| Edge Functions PayPal | ✅ 16/16 stubbées 410 |
| Cron PayPal | ✅ 0/2 actif |
| RPC de renouvellement legacy | ✅ 3/3 supprimées |
| Chemins de paiement actifs frontend | ✅ Square uniquement (`SquareCardForm`, `core-square-payment-link`, `square-charge-invoice`, `square-webhook`, `square-save-card`) |
| `ACTIVE_PAYMENT_PROVIDER` (`src/config/paymentMaintenance.ts`) | `"square"` |

---

**Phase 3.C.4 : terminée.** Le legacy PayPal est isolé, décommissionné, et n'a plus de chemin d'écriture actif. Les données historiques sont préservées pour audit, comptabilité et remboursements manuels.
