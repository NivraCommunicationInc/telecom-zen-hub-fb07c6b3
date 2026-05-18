# Purge complète Stripe — Plan d'exécution sécurisé

## Objectif
Retirer 100% du code Stripe (composants, hooks, edge functions, config) sans casser PayPal, les paiements, ni les abonnements.

## Garde-fous
- **Aucune migration SQL passée ne sera touchée** (historique immuable)
- **PayPal intact** : zéro modification des fichiers `paypal-*`, `usePayPal*`, factories `nivraPaymentIntentFactory` et `nivraSubscriptionFactory` (déjà provider-neutral)
- **Build/typecheck** vérifié à chaque lot
- **Recherche d'imports cassés** après chaque suppression

## Lot 1 — Suppression edge functions Stripe (5 fonctions)
Toutes déjà neutralisées en 403 selon mémoire. Suppression code + `delete_edge_functions` :
- `stripe-admin-actions`
- `stripe-create-checkout-session`
- `stripe-create-payment-intent`
- `stripe-setup-autopay`
- `stripe-webhook`

## Lot 2 — Suppression composants UI Stripe
Fichiers à supprimer (vérification préalable : aucun import vivant) :
- `src/components/payment/StripeCheckoutButton.tsx`
- `src/components/payment/StripeInlinePayment.tsx`
- `src/core-app/hooks/useStripeAdminActions.ts`
- `src/config/stripe.ts`

Si des imports existent → remplacer par l'équivalent PayPal déjà en place (`PayPalCheckoutButton`, `usePayPalActions`).

## Lot 3 — Nettoyage références dans fichiers conservés
Fichiers qui contiennent juste des **mentions/commentaires/labels** Stripe à purger sans casser la logique :
- POS : retirer les boutons/branches "Stripe" mortes, garder PayPal + cash + Interac
- `CoreCancellationsPage`, `ClientBillingHub`, `ClientPayments`, `ClientNewOrder`, `ClientMonthlyInvoices`, `InvoiceActions`, `PaymentDetailDrawer`, `BillingV2Playbook`, `AddAccountCredit`, `ReferralPopup`
- Libs : `checkoutBackfill`, `checkoutFallback`, `createCheckoutDraftInvoice`, `createPOSDraftInvoice`, `recordPayment`, `usePaymentsList`, `validation/schemas`, `paymentMaintenance`
- PDF templates : retirer mentions "Stripe" dans `receiptTemplate`, `refundNoticeTemplate`, `types`
- `PolitiqueConfidentialite.tsx` : remplacer mention Stripe par PayPal

## Lot 4 — Tests à supprimer/réécrire
- `src/__tests__/payment-intent-factory-guard.test.ts`
- `src/__tests__/payment-intent-factory-validation.test.ts`
- `src/__tests__/subscription-factory-guard.test.ts`

Inspection rapide : si tests valident factories provider-neutral → garder, juste renommer assertions. Si tests Stripe-spécifiques morts → supprimer.

## Lot 5 — Backend partagé
Vérifier chaque fichier ; ne purger que les branches mortes (provider === 'stripe') tout en conservant le squelette provider-neutral :
- `_shared/activateSubscriptionForOrder.ts`
- `_shared/nivraPaymentIntentFactory.ts` (cœur — extrême prudence)
- `_shared/nivraSubscriptionFactory.ts`
- `_shared/comboDecomposition.ts`
- Functions : `billing-generate-renewals`, `checkout-canonical-sync`, `field-sale-payment`, `portal-add-credit`, `retry-subscription-activation`, `send-document-validation`, `send-final-validation-docs`

## Lot 6 — Docs & config
- `supabase/config.toml` : retirer blocs `[functions.stripe-*]`
- `CHANGELOG.md`, `README.md`, `SECURITY.md`, `SYSTEM_LOCK_REPORT.md`, `docs/billing_v2.md`, `docs/DOCUMENTATION_FONCTIONNELLE_NIVRA.md` : ajouter note "Stripe retiré YYYY-MM-DD, PayPal seul fournisseur"
- `package.json` : retirer dépendances `stripe` / `@stripe/*` si présentes

## Lot 7 — Vérification finale
1. `rg -i stripe` → doit retourner uniquement migrations historiques + notes "Stripe retiré"
2. Build + typecheck automatique
3. Scan routes payment/checkout : confirmer PayPal flow intact
4. Memory update : marquer "Stripe purge complete"

## Stratégie d'exécution
J'enchaîne **Lot 1 → 2 → 3 → 4 → 5 → 6 → 7**, en vérifiant le build après chaque lot. Si un import casse, je corrige immédiatement avant de passer au suivant.

## #31 (Géocodeur GPS)
**Skip définitif.** Le RPC `get_order_technician_eta` garde son fallback vitesse-seule actuel (suffisant sans coordonnées). On rouvrira si tu prends Mapbox/Nominatim plus tard.

---

**Estimation** : ~30 fichiers édités, ~9 fichiers supprimés, ~5 edge functions retirées. Aucune table touchée.

Tu confirmes je lance ?
