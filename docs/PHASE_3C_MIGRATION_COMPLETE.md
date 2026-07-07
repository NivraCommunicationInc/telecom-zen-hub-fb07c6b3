# Phase 3.C — Rapport final de migration paiements

**Date** : 2026-07-07
**Statut** : ✅ **Migration terminée** — Square est l'unique processeur de paiement actif.

---

## 1. Dernier nettoyage `nivra-diagnostic`

Les 7 actions PayPal encore présentes (lecture live de l'API PayPal et écritures de « fix orphan ») ont été **retirées** et remplacées par une réponse HTTP 410 unique :

| Action | Ancien comportement | Nouveau |
|---|---|---|
| `paypal_health` | Lecture de `paypal_autopay_attempts`, `paypal_plan_cache`, subs `recurring_provider` | **410** |
| `paypal_webhook_check` | Token OAuth + `GET /v1/notifications/webhooks` | **410** |
| `paypal_webhook_update` | `PATCH` d'un webhook PayPal | **410** |
| `paypal_sub_lookup` | `GET /v1/billing/subscriptions/{id}` | **410** |
| `paypal_deep_check` | Vérif credentials + statuts de plans PayPal | **410** |
| `fix_orphan` | UPDATE direct de `billing_subscriptions` (interdit par triggers 3.B.2) | **410** |
| `fix_orphan_by_paypal_id` | Idem | **410** |

Seul le message d'aide de la fonction (liste blanche d'actions) a été mis à jour pour ne plus proposer d'actions PayPal.

**Fichier supprimé** : `supabase/functions/_shared/nivraPayPalSubscriptionFactory.ts` (helper legacy, plus importé nulle part).

## 2. Types Supabase

`src/integrations/supabase/types.ts` est **auto-régénéré** à chaque migration DB approuvée. Il a été régénéré après les migrations 3.C.1 → 3.C.4 (voir historique). Les 44 occurrences résiduelles de `paypal` sont exclusivement des noms de colonnes historiques (`paypal_subscription_id`, `paypal_plan_id`) et des tables historiques (`paypal_autopay_attempts`, `paypal_plan_cache`) conservées en lecture seule pour la comptabilité — jamais écrites (triggers `trg_forbid_paypal_*` de 3.B.2).

Aucune régénération manuelle nécessaire.

## 3. Décompte final des références PayPal

### 🎯 Code de production exécutable

```bash
rg -n "fetch\([^)]*paypal-|\.invoke\(['\"]paypal-" src/ supabase/functions/ \
  | rg -v "supabase/functions/(paypal-|core-paypal-|billing-paypal-|billing-create-order-with-paypal)"
```

| Métrique | Valeur |
|---|---|
| **Chemins exécutables vers l'API PayPal ou une Edge Function `paypal-*` (hors stubs 410)** | **0** ✅ |
| **`fetch("https://api-m.paypal.com/...")` actifs** | **0** ✅ |
| **UPDATE/INSERT sur `billing_subscriptions` avec `paypal_*`** | **0** ✅ |

### 📊 Références PayPal totales (contexte)

Total brut `rg -in paypal src/ supabase/functions/` = **1 174 occurrences**, réparties comme suit :

| Catégorie | Occurrences | Nature | Statut |
|---|---:|---|---|
| Edge Functions `paypal-*` (16 stubs HTTP 410) | 97 | Stubs de compat | Décommissionnées |
| `supabase/functions/nivra-diagnostic` | 10 | Comparateurs `body.action === "paypal_*"` renvoyant 410 | **Neutre** |
| `supabase/functions/_shared/pdf/*` | ~180 | Templates PDF historiques : label « PayPal » sur factures/reçus émis avant 3.B | Lecture seule |
| `supabase/functions/_shared/locked-pdf/*` | ~90 | PDF verrouillés (facture/contrat/reçu) historiques | Lecture seule |
| `supabase/functions/_shared/email-templates.ts`, `paymentAutoNote.ts`, etc. | ~60 | Libellés historiques dans notifications/journaux | Lecture seule |
| Edge Functions billing/lifecycle/reconciliation (`billing-generate-renewals`, `billing-lifecycle`, `billing-reconciliation`, `crm-create-sale`, `field-*`, `nova-brain`, `ops-watchdog`, …) | ~230 | Enum `provider = 'paypal'` en lecture, colonnes historiques, commentaires | Lecture seule |
| Tests d'invariants (`supabase/functions/_tests/*`, `crm-create-sale/regression_*.test.ts`, `billing-create-order/regression_*.test.ts`) | ~40 | Vérifient que PayPal ne peut plus écrire | Tests |
| `src/integrations/supabase/types.ts` | 44 | Types auto-générés des colonnes/tables historiques | Auto-généré |
| `src/__tests__/*` (`paypal-error-serialization`, `billing-financial-invariants`, `system-lock-invariants`) | 32 | Immutabilité des paiements PayPal historiques | Tests |
| `src/core-app` + `src/pages/admin` (reporting, historique) | 176 | Colonnes `paypal_*` en affichage lecture seule (factures/paiements passés) | Lecture seule |
| `src/lib` (PDF/emails clients) | 90 | Libellés historiques | Lecture seule |
| `src/pages/legal/*` | 14 | Textes contractuels historiques (RefundPolicy, ModalitesPaiement, etc.) | Contractuel |
| `src/core-app/components/payments/PaymentConstants.ts` | 1 | `PAYMENT_METHODS.paypal = "Carte"` (masqué à l'affichage) | Masqué |
| `src/config/paymentMaintenance.ts` | 3 | Commentaires « PayPal décommissionné » + `PAYPAL_PRIMARY = false` | Documentation |

### 📚 Références historiques (non-production)

| Zone | Occurrences |
|---|---:|
| `docs/` (rapports de migration 3.B / 3.C) | **202** |
| `supabase/migrations/` (historique de schéma, jamais rejoué) | **282** |
| Tests unitaires + E2E | **50** |
| PDF/emails historiques (`src/lib/`) | **90** |

## 4. Confirmation — Square est l'unique processeur actif

| Contrôle | Résultat |
|---|---|
| `ACTIVE_PAYMENT_PROVIDER` (`src/config/paymentMaintenance.ts`) | `"square"` ✅ |
| Edge Functions PayPal (16/16) | Stubs HTTP 410 ✅ |
| Cron jobs PayPal | 0 actif (2 unschedulés en 3.C.4) ✅ |
| Chemins `fetch`/`invoke` vers `paypal-*` en dehors des stubs | **0** ✅ |
| RPC de renouvellement legacy (`fn_run_subscription_renewals`, `fn_generate_subscription_renewal`, `generate_billing_renewals`) | **Supprimées** ✅ |
| Triggers DB `trg_forbid_paypal_*` (5 tables financières) | Actifs depuis 3.B.2 ✅ |
| Trigger DB `trg_assert_sub_provider_square` | Actif depuis 3.C.1 ✅ |
| Nouveau moteur de renouvellement (`billing-generate-renewals`) | Appelle uniquement `run_subscription_renewals()` (RPC canonique) + Square ✅ |
| Chemins actifs frontend | `SquareCardForm`, `core-square-payment-link`, `square-charge-invoice`, `square-webhook`, `square-save-card` ✅ |
| Helpers legacy résiduels | `nivraPayPalSubscriptionFactory.ts` supprimé ✅ |

## 5. Conclusion

**0 référence PayPal dans le code exécutable** de production.

L'ensemble des occurrences restantes est constitué de :
- stubs 410 (compat avec anciens clients HTTP),
- colonnes/tables historiques en lecture seule pour la comptabilité et les audits,
- templates PDF/emails historiques déjà émis (immuables par nature),
- tests d'invariants qui vérifient l'impossibilité de réécrire côté PayPal,
- textes légaux et contractuels historiques,
- documentation et migrations SQL archivées.

➡️ **La migration du système de paiement est terminée.** Square est officiellement et exclusivement l'unique processeur de paiement de production.

---

### Actions manuelles restantes (infrastructure — hors code)

Voir `docs/PHASE_3C4_AUDIT.md` §8 : suppression des secrets `PAYPAL_*` côté Lovable Cloud et retrait des webhooks côté PayPal Developer Dashboard.
