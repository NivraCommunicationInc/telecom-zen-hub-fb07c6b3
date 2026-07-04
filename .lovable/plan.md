# Pass 3C — Prorata immédiat (per-address)

Objectif : lorsqu'un client ajoute un service à une adresse **en cours de cycle**, il paie immédiatement un montant proraté couvrant la période entre la date d'activation et la prochaine date d'anniversaire de facturation. La facture mensuelle suivante repart plein tarif au prochain cycle.

Toute la logique est **backend-only** (respect de la mémoire "Canonical Tax Engine" et "Nivra Core = seule source de vérité"). Aucune formule côté frontend.

---

## 1. Règles fonctionnelles

- **Anniversaire de facturation** : porté par le compte (`accounts.billing_anchor_day` — jour du mois 1–28). Créé si manquant, backfill = jour de création du compte (clampé à 28).
- **Cycle** : 30 jours calendaires, ancrés sur `billing_anchor_day`. Un service ajouté le jour J est facturé de J → prochain anchor exclu.
- **Formule** : `prorata = round( monthly_price * days_remaining / days_in_cycle, 2 )` avec `days_in_cycle = date(next_anchor) - date(prev_anchor)`.
- **Taxes** : appliquées **après** prorata via `compute_invoice_breakdown` existant (TPS 5%, TVQ 9.975%). Aucune duplication de logique fiscale.
- **Équipement** : jamais proraté — facturé plein tarif dans la même facture (frais one-time).
- **Promotions** (`BIENVENUE2026`/`NIVRA2026` 100% off 1er mois) : s'appliquent au **premier cycle plein**, pas au prorata. Le prorata est donc payé même avec promo. Documenté dans la mémoire.
- **Multi-adresses** : chaque service ajouté est lié à `service_address_id`. Le prorata est calculé **par service**, pas par compte. La ligne de facture affiche `[Adresse, Ville] · Service · Prorata J→J+n`.
- **Cas limites** :
  - Ajout le jour même de l'anchor → 0 prorata, 1er cycle plein démarre immédiatement.
  - Mois court (fév) → `days_in_cycle` reflète la vraie durée du cycle.
  - Ré-activation d'un service annulé → nouveau prorata, nouveau cycle.

---

## 2. Backend (single source of truth)

### 2.1 Migration
- `accounts.billing_anchor_day smallint` (1–28), backfill = `LEAST(EXTRACT(day FROM created_at)::int, 28)`, `NOT NULL DEFAULT` via trigger sur insert.
- Index sur `billing_invoice_lines(service_address_id)` (déjà ajouté en 3A ? vérifier).
- Nouvelle fonction SQL (SECURITY DEFINER, `search_path=public`) :
  ```
  compute_prorata_for_service(
    p_account_id uuid,
    p_service_address_id uuid,
    p_monthly_price_cents int,
    p_activation_date date DEFAULT current_date
  ) RETURNS jsonb
  -- { days_remaining, days_in_cycle, prorata_cents, next_anchor, prev_anchor, is_zero }
  ```
- Aucune vue/table de prorata séparée : le calcul est pur, stocké dans `billing_invoice_lines.prorata_metadata` (déjà ajouté en 3A) au moment de la facturation.

### 2.2 Edge Function
- Nouvelle fonction `billing-create-prorata-invoice` (< 50KB) :
  - Input : `{ account_id, service_address_id, service_ids[], equipment_ids[], activation_date? }`
  - Récupère les prix depuis le catalogue (jamais du client).
  - Appelle `compute_prorata_for_service` pour chaque service.
  - Construit les lignes : 1 ligne prorata par service (avec metadata JSON) + 1 ligne plein tarif équipement.
  - Appelle `compute_invoice_breakdown` pour taxes/totaux.
  - Insère `billing_invoices` + `billing_invoice_lines` (statut `pending`).
  - Retourne `{ invoice_id, total_cents, breakdown }`.
- Réutilise le shell email corporate #0066CC via `renderQueueTemplate` pour l'envoi (respect mémoire email).

### 2.3 Hook lecture
- `useProratePreview(accountId, addressId, serviceSelection)` : appelle un RPC read-only `preview_prorata` pour affichage temps-réel dans le checkout / ajout de service (aucun calcul côté client, juste rendu).

---

## 3. Frontend (rendu uniquement)

Trois points d'intégration, **tous via des composants partagés** :

1. **Checkout** (`CheckoutReviewStep` ou équivalent) : après sélection d'adresse (via `ServiceAddressPicker` existant), affiche un bloc "Ajustement au prorata" retourné par `preview_prorata`. Ligne visible : `Prorata Internet Fibre 500 · 12/30 jours · 24,00 $`.
2. **Ajout de service à une adresse existante** (client portal `ClientMyServices` + admin `AccountEquipmentTab`) : même composant `<ProratePreviewCard addressId serviceId />`.
3. **Facture PDF** : **aucun changement de template**. Les lignes prorata utilisent la description formatée par `format_invoice_line_description` (déjà en place), rendant `[Adresse, Ville] · Internet Fibre · Prorata 12j (04→16 juillet)`.

Nouveau composant partagé unique : `src/components/billing/ProratePreviewCard.tsx`.

---

## 4. Tests

- **SQL** : cas 1 jour, 15 jours, 30 jours, anniversaire même jour, mois de février.
- **Edge function** : appel avec 1 service, 3 services multi-adresses, service + équipement.
- **Invariants financiers** : `sum(lines.total) === invoice.subtotal` ; taxes = `compute_invoice_breakdown` ; aucune régression sur factures mensuelles (le prorata ne touche que les factures d'activation).
- **UI** : le preview affiché correspond exactement au montant facturé (byte-for-byte via même RPC).

---

## 5. Documentation & mémoire

- Nouveau fichier `docs/PRORATA_MODEL.md` : formule, ancrage, cas limites, interaction promotions, exemples.
- Mise à jour mémoire : nouvelle entrée `[Prorata Immédiat 3C]` — backend seul, per-service per-address, promo s'applique au 1er cycle plein.

---

## 6. Livrables

- 1 migration (`billing_anchor_day` + fonctions SQL)
- 1 edge function (`billing-create-prorata-invoice`)
- 1 RPC read-only (`preview_prorata`)
- 1 composant partagé (`ProratePreviewCard`)
- 1 hook (`useProratePreview`)
- 3 écrans branchés (checkout, client portal, admin)
- Documentation + mise à jour mémoire

**Non inclus** (hors périmètre 3C) : refonte du template PDF, changement de la logique de facturation mensuelle récurrente, changement des promotions existantes.

Réponds **"go"** pour exécuter, ou indique les ajustements souhaités.
