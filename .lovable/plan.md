
# Refonte architecturale — Facturation, commandes, abonnements, PDF

Objectif : rendre permanentes les 7 règles énoncées. Le correctif n'est **pas** spécifique à la commande 58953. Il touche 80+ Edge Functions, une centaine de migrations, tous les générateurs PDF, le portail client, le Core Admin, l'API terrain et toutes les automatisations.

Vu l'ampleur (plus de 80 Edge Functions liées à la facturation, 157 migrations touchant `billing_invoice_lines` / `billing_subscriptions`), je propose de livrer la refonte en **6 phases séquentielles**, chacune vérifiable, chacune livrée dans une PR/turn distincte. Cette approche évite qu'une modification massive en un seul passage ne casse silencieusement une automatisation critique (renouvellements, PayPal, Square, terrain).

Je te demande de valider ce plan **avant** que je commence — parce que la phase 1 modifie des invariants de base de données qui vont, à dessein, faire échouer immédiatement toute logique fautive existante.

---

## Phase 1 — Invariants base de données (garde-fous non contournables)

Une seule migration qui rend impossible, au niveau SQL, la violation des règles 1, 2, 3, 4, 5.

**Table `billing_invoice_lines`** — ajout de :
- Colonne `source_ref` (obligatoire) : `order_item`, `manual_admin`, `credit_application`, `payment_application`, `tax`, `promotion_applied`. **Aucune ligne ne peut exister sans une source traçable.**
- Colonne `line_kind` enum stricte : `product_recurring`, `product_one_time`, `equipment`, `activation_fee`, `shipping`, `travel_fee`, `installation_fee`, `promotion`, `discount`, `tax`, `credit_application`, `payment_application`, `manual_adjustment`.
- CHECK contrainte : `line_kind IN ('promotion','discount','credit_application','payment_application') OR amount >= 0`. Un paiement/crédit ne peut plus jamais être stocké comme rabais négatif sur une ligne produit.
- CHECK contrainte : une ligne `manual_adjustment` exige `created_by_user_id NOT NULL` + `reason NOT NULL`.

**Table `billing_subscriptions`** — ajout de :
- Colonne `source_order_item_id` (FK obligatoire vers `order_items`). Un abonnement sans ligne de commande d'origine devient impossible.
- Colonnes figées : `frozen_name`, `frozen_code`, `frozen_unit_price`, `frozen_currency`, `frozen_cycle`, `frozen_frequency`, `frozen_tax_profile_id`, `frozen_anchor_date`. Toutes NOT NULL.
- Trigger `billing_subscriptions_freeze_guard` : après INSERT, ces colonnes deviennent immuables (UPDATE bloqué sauf pour un rôle `service_role` avec raison explicite).
- CHECK : l'`order_item` référencé doit avoir `is_recurring = true`. Impossible de créer un abonnement sur une borne WiFi, une SIM, des frais d'activation, une livraison, un déplacement, une taxe, etc.

**Table `order_items`** — normalisation :
- `is_recurring` (boolean NOT NULL) devient la **seule** condition pour déclencher la création d'un abonnement. Les catégories (`internet`, `tv`, `mobile`, `streaming`) redeviennent purement descriptives.
- `item_kind` (enum) aligné sur `line_kind` ci-dessus.

**Trigger d'intégrité commande ↔ facture** :
- `trg_invoice_lines_match_order` : à la génération/mise à jour d'une facture liée à une commande, la somme des lignes non-fiscales/non-paiement/non-crédit doit égaler la somme des `order_items` correspondants à ±0.01 $. Sinon → exception SQL, facture rejetée.

## Phase 2 — Source de vérité unique côté serveur

**Nouvelle RPC canonique** `public.build_invoice_from_order(order_id uuid)` :
- Lit uniquement `orders` + `order_items` + `promotions` réellement appliquées à la commande.
- Calcule subtotal, taxes (via `tax_brackets_*`), total.
- Écrit `billing_invoices` + `billing_invoice_lines` avec `source_ref = 'order_item'` pour chaque ligne.
- **Interdit** : lignes ajoutées de nulle part, "ajustement pour combler l'écart", subtotal dérivé à l'envers depuis un total cible.
- Retourne une erreur si `orders.total_amount` diffère de `SUM(order_items) + taxes` de plus de 0,05 $.

**Nouvelle RPC** `public.create_subscriptions_from_order(order_id uuid)` :
- Itère `order_items WHERE is_recurring = true`.
- Crée **un abonnement par ligne récurrente**, avec `source_order_item_id`, colonnes figées.
- Ignore explicitement tous les items non récurrents (équipement, SIM, frais uniques, livraison, déplacement, taxes, crédits, promotions, rabais).

**Nouvelle RPC** `public.apply_payment_to_invoice(invoice_id, amount, method, provider, reference, source)` :
- Écrit dans `billing_payments` uniquement.
- N'écrit **jamais** de ligne négative sur la facture.
- Met à jour `amount_paid` et `payment_status` via calcul explicite.

**Nouvelle RPC** `public.apply_credit_to_invoice(invoice_id, credit_id, amount)` :
- Objet crédit reste séparé (`account_adjustments` de type crédit).
- Crée une ligne `credit_application` liée, jamais un rabais.

**Nouvelle RPC** `public.apply_promotion_to_order_item(order_item_id, promotion_id)` :
- Une promotion s'applique **à une ligne de commande**, pas à un total de facture.
- Génère une ligne facture `promotion` liée à cet `order_item`.

## Phase 3 — Suppression du recalcul dans les 80+ Edge Functions

Toutes les fonctions ci-dessous seront modifiées pour **appeler les 4 RPC canoniques ci-dessus** au lieu de calculer/insérer directement. Aucune fonction n'écrira plus jamais dans `billing_invoice_lines` ou `billing_subscriptions` directement.

**Édition/création de commandes → facture** :
- `billing-create-order`
- `billing-create-order-with-paypal-subscription`
- `billing-create-prorata-invoice`
- `checkout-canonical-sync`
- `quote-checkout-finalize`
- `field-sales-sync`
- `field-order-engine`
- `crm-create-sale`
- `nivra-core-sync`
- `send-order-confirmation`

**Abonnements / renouvellements / changement de forfait** :
- `billing-create-subscription`
- `billing-generate-renewals`
- `billing-subscription-cycle`
- `billing-lifecycle`
- `client-plan-change`
- `equipment-account-actions`
- `internet-account-actions`
- `request-streaming-subscription`
- `cancel-account`
- `paypal-charge-subscription`
- `paypal-sync-subscription-state`
- `paypal-verify-subscription`
- `paypal-webhook`
- `square-charge-subscription`

**Paiements, crédits, remboursements** :
- `billing-confirm-payment`
- `core-process-card-payment`
- `core-square-payment-link`
- `core-paypal-order-link`
- `portal-add-credit`
- `portal-card-payment`
- `portal-submit-interac-payment`
- `paypal-capture-order`
- `paypal-refund`
- `square-charge-invoice`
- `billing-reconcile-invoices`
- `billing-reconciliation`

**Migration / imports** :
- `billing-migrate-clients`
- `admin-bulk-import-clients`

**Facturation mensuelle consolidée & relances** :
- `generate-monthly-invoices`
- `billing-dunning-engine`
- `billing-check-overdue`
- `check-overdue-invoices`
- `billing-daily-overdue-reminders`

## Phase 4 — Générateurs PDF : lecture seule stricte

Tous les générateurs PDF cesseront **toute** logique de calcul. Ils liront exclusivement `billing_invoices` + `billing_invoice_lines` + `billing_payments`.

Fonctions modifiées :
- `_shared/pdfFromDb.ts` (module partagé)
- `admin-preview-pdf`
- `admin-regenerate-pdfs`
- `admin-test-pdf-email`
- `audit-generate-pdfs`
- `client-dossier-pdf`
- `client-pdf-download`
- `debug-invoice-pdf`
- `regenerate-order-documents`
- `send-invoice-preview`
- `send-pdf-templates`
- `send-pdf-templates-email`
- `send-blank-pdf-templates`
- `send-template-pdf-preview`
- `send-terms-pdf-email`
- `test-payment-confirmed-pdf`

Tout code de type « si écart entre commande et facture, ajouter ligne d'ajustement » est **supprimé**. Si les données stockées sont incohérentes, le PDF affiche un bandeau `Facture incohérente — contactez le support` et écrit dans `billing_system_alerts`. Le PDF n'invente rien.

## Phase 5 — Frontend (portail client + Core Admin)

- `src/pages/client/*` et `src/pages/admin/*` : suppression de tout code TS qui recalcule totaux/sous-totaux/taxes. Affichage lit uniquement les colonnes de `billing_invoices` et les lignes de `billing_invoice_lines`.
- Composants `InvoiceView`, `SubscriptionCard`, `OrderSummary`, `AccountBalance` : passe en lecture pure. Aucune addition côté client.
- Résultat : ce qui est affiché dans le portail, le Core Admin, l'API et le PDF est **byte-for-byte** identique.

## Phase 6 — Nettoyage rétroactif + audit final

- Migration one-shot qui détecte toute facture existante dont `SUM(lines) ≠ total` et les marque `needs_manual_review = true` (sans les modifier). L'admin voit un tableau dédié.
- Script d'audit qui liste tout abonnement existant sans `source_order_item_id` ou pointant vers un item `is_recurring = false` → marqués pour revue.
- Rapport final livré ici même : liste exhaustive des fonctions/RPC/triggers/PDF modifiés avec diff résumé.

---

## Ce qui disparaît définitivement du code

- Toute création automatique de lignes « Ajustement promotionnel », « Frais de déplacement », « Frais d'installation » qui ne proviennent pas d'un `order_item` explicite.
- Toute conversion `paiement reçu → rabais négatif`.
- Toute conversion `crédit → promotion`.
- Tout recalcul de subtotal à partir d'un total cible.
- Toute création d'abonnement basée sur `category = 'internet'|'tv'|'mobile'` — remplacée par `is_recurring = true`.
- Toute relecture du catalogue produit au moment d'un renouvellement pour « rafraîchir » le prix.

## Livrables de vérification (ce que tu recevras à la fin)

1. La liste **exhaustive et nommée** des :
   - migrations SQL créées (triggers, contraintes, RPC),
   - Edge Functions modifiées (avec le comportement retiré),
   - générateurs PDF modifiés,
   - composants frontend modifiés.
2. Un rapport `audit_billing_integrity.md` généré depuis la base : nombre de factures existantes cohérentes / à revoir, nombre d'abonnements orphelins, nombre de lignes fabriquées détectées historiquement.
3. Des tests d'intégration Deno pour chaque RPC canonique couvrant : commande simple, commande multi-services récurrents, paiement partiel, paiement externe, crédit appliqué, promotion appliquée, remboursement, changement de forfait, annulation.

---

## Décision requise avant que je commence

Confirme-moi :

1. **OK pour livrer en 6 phases** (chaque phase = une réponse/PR distincte, testable), ou tu veux tout en un seul passage massif ?
2. **OK pour que la Phase 1 fasse échouer immédiatement toute écriture illégale en base** (y compris d'anciens jobs cron mal câblés) — c'est le point — ou tu veux d'abord un mode `warn` pendant 24-48h ?
3. **Périmètre des abonnements figés** : je gèle `prix, cycle, fréquence, nom, taxes, ancrage`. Confirme que **les changements de forfait** doivent créer un **nouvel abonnement** (et clôturer l'ancien) plutôt que muter l'abonnement existant. C'est la seule façon de respecter la règle 5 sans exception.

Dès que tu réponds, j'attaque la Phase 1.
