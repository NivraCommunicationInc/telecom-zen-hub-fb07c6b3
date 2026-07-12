
# Réponse honnête à ta validation — état réel + plan de correction

## 1. Audit calendrier — ce que j'ai trouvé (avant tout code)

Résultat de l'audit source par source. **L'unification n'est PAS complète comme annoncée précédemment.** Trois implémentations coexistent encore.

| Consommateur | Fichier | Composant/Hook | RPC / Tables lues | Écriture réservation |
|---|---|---|---|---|
| Field App — Nouvelle vente | `src/field-app/pages/FieldNewSale.tsx` + `StepCustomer.tsx` | `InstallSlotPicker` → `useInstallationSlots` | RPC `get_available_installation_slots` | `appointments` (hold via `field-sales-sync`) |
| POS Core | `src/components/pos/UnifiedPOSPage.tsx` | `InstallSlotPicker` → `useInstallationSlots` | RPC `get_available_installation_slots` | `appointments` (hold via `createPOSDraftInvoice`) |
| Checkout public | `src/components/checkout/InstallationSection.tsx` → `InstallationScheduler` | **`InstallationScheduler`** (implémentation locale) | Lit directement `appointment_slot_rules` + `appointment_slot_overrides` + `appointment_blocked_dates` + `appointments`, agrégation client-side | `appointments` (via `GuestCheckout.tsx` + `appointmentHold.ts`) |
| Nivra Core — Rendez-vous (`AdminAppointments`) | `src/pages/admin/AdminAppointments.tsx` | Lecture directe `appointments` (liste) | table `appointments` | — |
| Nivra Core — Nouvelle commande manuelle | `ShippingTechnicianStep.tsx` | Aujourd'hui : formulaire date/heure texte + INSERT direct dans `appointments`. **Pas de picker de disponibilité.** | `appointments` seule | `appointments` |
| Nivra Core — Disponibilités (Core admin picker) | `src/core-app/components/appointments/AppointmentSlotPicker.tsx` + `CoreAppointmentSlotsPage.tsx` | `AppointmentSlotPicker` | **RPC différente : `get_appointment_slot_availability`** | `appointments` |
| Client Portal — Reschedule | `src/pages/client/ClientRescheduleAppointment.tsx` | Formulaire propre (pas de picker unifié) | `appointments` | UPDATE `appointments` |

### Divergences confirmées
1. **Deux RPC** cohabitent : `get_available_installation_slots` (Field/POS/Checkout) vs `get_appointment_slot_availability` (Core admin). Résultats potentiellement incohérents.
2. **`InstallationScheduler`** (checkout public) fait sa propre agrégation client-side au lieu d'appeler la RPC — bypass des règles de disponibilité côté serveur.
3. **`ShippingTechnicianStep`** (Core nouvelle commande manuelle) n'utilise **aucun picker** : champ texte libre → réservation sans vérification de capacité.
4. **Client Portal Reschedule** n'utilise pas non plus le picker unifié.

### Ce qui est déjà propre
- `installation_appointments` : **plus aucune référence live** dans le code (uniquement dans `types.ts` auto-généré + vieilles migrations). ✅
- Toutes les écritures pointent bien vers `appointments`. ✅
- Realtime activé sur les 4 tables sources (Lot 2 précédent). ✅

## 2. Plan de correction — Calendrier réellement unifié

### Migration DB
- **Déprécier `get_appointment_slot_availability`** : réécrire la fonction pour qu'elle délègue à `get_available_installation_slots(date, date)` + adapter le format retourné. Pas de suppression pour éviter de casser les appelants externes.

### Frontend
- **`InstallationScheduler.tsx`** : réécrit pour consommer `useInstallationSlots` (suppression des 4 queries directes). L'UI reste identique.
- **`AppointmentSlotPicker.tsx`** (Core) : bascule sur `useInstallationSlots` (jour par jour → filtrer côté hook via `fromDate=toDate`).
- **`ShippingTechnicianStep.tsx`** : ajout du `<InstallSlotPicker>` en amont de l'INSERT `appointments`.
- **`ClientRescheduleAppointment.tsx`** : intègre `InstallSlotPicker` pour choisir un nouveau créneau parmi les disponibilités réelles.

## 3. Lot 3 — Promotions UI Core (livrable manquant assumé)

Nouvelle page `src/core-app/pages/CorePromotionsPage.tsx` protégée par `has_role('admin')`, montée dans le menu **Facturation**.

### Onglets
- **Catalogue** : table `promotions` — CRUD complet.
  - Champs : `code`, `name`, `description`, `discount_type` (percent/fixed), `discount_value`, `duration_months`, `applies_to` (services/equipment/installation/one_time_fees), `status`, `start_at`, `end_at`, `min_subtotal`, `max_discount_amount`, `new_customers_only`, `stackable`, `usage_limit`.
- **Assignations actives** : table `account_promotions` — lecture avec filtres (compte, code promo, statut), affichage `months_remaining` + colonne "Prochaine facture : -X$", action **Désactiver**, action **Assigner à un compte** (réutilise `AddPromotionDialog` existant + choix du compte).

### Fichiers créés
- `src/core-app/pages/CorePromotionsPage.tsx`
- `src/core-app/components/promotions/PromotionCatalogTable.tsx`
- `src/core-app/components/promotions/PromotionEditDialog.tsx`
- `src/core-app/components/promotions/AccountPromotionsTable.tsx`
- `src/core-app/components/promotions/AssignPromotionToAccountDialog.tsx`
- Route ajoutée dans `src/core-app/main.tsx` + entrée nav.

### Affichage dans commande
- Sur la page détail commande Core (`src/core-app/pages/CoreOrderDetail.tsx` ou équivalent) : ajout d'une section **"Promotions actives sur le compte"** listant les `account_promotions` liées via `orders.client_id → billing_customers.account_id`.

## 4. Preuves runtime demandées

Une fois le code livré, séquence exécutée en base + captures :

### T1 — Créneau unique multi-portails
1. `INSERT` une override "open" sur 2026-08-15 14h-16h.
2. `SELECT * FROM get_available_installation_slots('2026-08-15','2026-08-15')` → capacité=N.
3. `SELECT * FROM get_appointment_slot_availability('2026-08-15')` → mêmes chiffres exactement (après migration).
4. Réservation via Field (INSERT `appointments` status='hold').
5. Re-SELECT les deux RPC → `available` décrémenté partout.

### T2 — Modification règle → propagation
1. Ouvrir `AdminAppointments` (Core) + `FieldNewSale` (Field) dans deux tabs.
2. Ajouter un `appointment_blocked_dates` pour 2026-08-16 via Core UI.
3. Vérifier disparition du jour dans Field sans reload (realtime).

### T3 — Promotion récurrente end-to-end
1. Via Core UI Catalogue : créer promo `TEST-24M` (-6$/mois, 24 mois, applies_to=services).
2. Via Core UI Assignations : assigner au compte QA.
3. Vérifier affichage dans détail commande.
4. Exécuter `renew_subscription()` × 3 → 3 factures avec ligne `-6$` + `months_remaining` décrémenté de 24 → 21.
5. `SELECT` final : preuve base.

## 5. Ordre d'exécution proposé
1. Migration `get_appointment_slot_availability` → délégation
2. Refactor 4 consommateurs frontend (Scheduler, AppointmentSlotPicker, ShippingTechnicianStep, ClientReschedule)
3. Lot 3 UI Promotions (5 fichiers + nav)
4. Test T1 + T2 + T3 avec preuves SQL et captures

## Hors-scope explicite (à ne pas confondre avec livré)
- Suppression physique de la table `installation_appointments` (déjà orpheline).
- Modèle capacité par technicien/région (`technician_slot_bookings`).
- Migration des types Supabase auto-générés (ils se régénèrent seuls après la migration DB).

---

**Confirme "GO plan" et je livre les 4 phases avec preuves runtime avant clôture.** Je ne re-marquerai rien "CLOSED" tant que T1+T2+T3 ne sont pas verts SQL en main.
