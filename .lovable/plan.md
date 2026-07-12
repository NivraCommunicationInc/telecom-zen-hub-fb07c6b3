
# Plan d'exécution — Calendrier unifié + Promotions récurrentes

Deux corrections livrées en une passe, découpées en 3 lots courts. Chaque lot est autonome et vérifiable indépendamment.

## Lot 1 — Promotions récurrentes (le vrai bug facturation)

**Problème racine confirmé par audit** : `renew_subscription()` (RPC canonique appelée par `billing-generate-renewals`) crée les factures mensuelles à partir de `frozen_unit_price` uniquement. Elle n'ouvre jamais `account_promotions`. Résultat : un rabais -6$/mois × 24 mois n'est appliqué qu'au checkout initial, jamais aux 23 renouvellements suivants.

Le catalogue (`promotions`), l'attachement par compte (`account_promotions` avec `months_remaining`) et le dialog d'ajout (`AddPromotionDialog`) existent déjà. Il manque uniquement l'application automatique côté renouvellement.

### Migration DB
1. Nouvelle RPC `apply_active_account_promotions_to_invoice(p_invoice_id uuid)` — SECURITY DEFINER :
   - Charge l'invoice + `customer_id` → remonte à `account_id` (via `billing_customers.account_id`)
   - Boucle sur `account_promotions WHERE account_id = ? AND is_active = true AND months_remaining > 0`
   - Pour chaque promo : insère une ligne `billing_invoice_lines` (`line_type='discount'`, `line_kind='promotion'`, unit_price négatif, description = `label`, `metadata.account_promotion_id`)
   - Recalcule `subtotal`, `tps_amount`, `tvq_amount`, `total` sur `billing_invoices` (les taxes s'appliquent après discount)
   - Décrémente `months_remaining`, désactive automatiquement quand il tombe à 0
   - Idempotent : si une ligne `metadata->>'account_promotion_id' = ? AND invoice_id = ?` existe déjà, skip.
2. Patch `renew_subscription()` : appel de la nouvelle RPC juste après l'insert de la ligne service, avant `RETURN v_invoice_id`.

### Preuve E2E
Script SQL : créer un compte QA, attacher une promo -6$/24mois, exécuter `renew_subscription` × 25 fois (en avançant `cycle_end_date` manuellement), asserter :
- Factures 1-24 : ligne discount présente, total = 70+taxes -6
- Facture 25 : aucune ligne discount, `months_remaining = 0`, `is_active = false`

## Lot 2 — Calendrier realtime unifié

**Constat audit** : la source de vérité est déjà unique (`appointments` + `appointment_slot_rules/overrides/blocked_dates` + RPC `get_available_installation_slots`). Le composant partagé `InstallSlotPicker` + hook `useInstallationSlots` sont déjà utilisés par Field, POS et checkout. Ce qui manque = synchronisation temps réel entre portails.

### Migration DB
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.appointments,
  public.appointment_slot_rules,
  public.appointment_slot_overrides,
  public.appointment_blocked_dates;
```

### Modification `src/hooks/useInstallationSlots.ts`
Ajout d'un `useEffect` qui ouvre 4 channels `postgres_changes` (event `*`) et invalide la queryKey `["installation-slots"]` à chaque change. Nettoyage `removeChannel` au unmount.

### Effet immédiat
- Employé modifie une règle de disponibilité dans Core → Field/POS/Portal Client voient la mise à jour en < 1s.
- Client réserve un créneau → hold créé dans `appointments` → row event → recompute → créneau disparaît partout.

### Preuve
Test manuel documenté : ouvrir Core `/staff/appointments/rules` dans un onglet, Field `/field/new-sale` dans un autre, ajouter un override "closed" à demain 13h-16h côté Core → le créneau disparaît de la grille Field sans reload.

## Lot 3 — UI Core Promotions (catalogue + assignation)

Nouvelle route `src/core-app/pages/CorePromotionsPage.tsx` sous menu **Facturation**, protégée par `has_role('admin')`.

### Contenu
- **Onglet Catalogue** : table `promotions` avec create/edit dialog. Champs exposés : code, name, discount_type (percent/fixed), discount_value, `duration_months`, applies_to (checkboxes services/equipment/installation/one_time_fees), status, start_at, end_at, min_subtotal, max_discount_amount, new_customers_only, stackable.
- **Onglet Assignations actives** : lecture directe `account_promotions` avec filtres (compte, label, promo_code, statut). Affiche `months_remaining`, colonne "Prochaine facture: -X$", action "Désactiver".
- Bouton "Appliquer promo à un compte" → réutilise `AddPromotionDialog` existant.

### Fichiers
- `src/core-app/pages/CorePromotionsPage.tsx` (nouveau)
- `src/core-app/components/promotions/PromotionCatalogTable.tsx` (nouveau)
- `src/core-app/components/promotions/PromotionEditDialog.tsx` (nouveau)
- `src/core-app/components/promotions/AccountPromotionsTable.tsx` (nouveau)
- Ajout entrée menu dans `src/core-app/main.tsx` ou config nav Core

## Ce qui est HORS-scope (à documenter, pas livré)
- Migration des pickers legacy potentiels dans checkout public / portail client vers `InstallSlotPicker` : audit sépare ; si des composants séparés subsistent ils feront l'objet d'un ticket dédié BUG-CAL-002.
- Modèle capacité par technicien/région (`technician_slot_bookings`, `field_territories`) : le RPC actuel utilise capacité globale par règle ; passage à capacité par région = ticket séparé.
- Suppression physique des tables `installation_appointments` (déjà orphelines depuis 002B).

## Ordre d'exécution
1. Lot 1 migration + patch RPC + preuve E2E SQL
2. Lot 2 migration realtime + patch hook
3. Lot 3 UI Core Promotions

Chaque lot est committé indépendamment ; si un lot échoue en preuve runtime, les suivants ne partent pas.

## Livrables finaux
- 2 migrations Supabase
- 1 hook TS modifié
- 4 nouveaux fichiers UI Core
- Rapport E2E promo 25 factures + capture realtime multi-portails

