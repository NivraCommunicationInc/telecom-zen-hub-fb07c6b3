# Pass 3C — Rapport final (Prorata immédiat)

## Résumé

Le prorata immédiat est désormais **appliqué de bout en bout** sur toute
commande d'activation qui passe par le sync canonique
(`checkout-canonical-sync`). Une seule source de vérité SQL, aucun calcul
frontend, aucune divergence possible entre l'aperçu client et la facture émise.

## Chaîne canonique

```
┌────────────────┐     ┌──────────────────────────┐     ┌───────────────────────────┐
│  Frontend UI   │     │ checkout-canonical-sync  │     │  billing_invoices +       │
│                │     │ (edge function)          │     │  billing_invoice_lines    │
│ ProratePreview │────▶│                          │────▶│                           │
│ Card / Section │     │ 1. Insert lignes brutes  │     │ Lignes récurrentes        │
│                │     │ 2. apply_prorata_to_     │     │ réécrites en prorata,     │
│ (RPC preview_  │     │    invoice() ← SQL       │     │ métadonnées d'audit       │
│  prorata)      │     │ 3. Cascade order.total   │     │ dans prorata_metadata     │
└────────────────┘     └──────────────────────────┘     └───────────────────────────┘
        │                          │                                  │
        └──────────────────────────┴──────────────────────────────────┘
                   Même fonction SQL compute_prorata_for_service
                   → même montant partout, byte-for-byte.
```

## Livrables

### Migrations SQL
- `20260704014213` — `compute_prorata_for_service`, `preview_prorata`,
  `accounts.billing_anchor_day` (Pass 3C initial).
- `20260704020257` — **`apply_prorata_to_invoice(invoice_id, account_id,
  service_address_id, activation_date)`** (canonique, idempotente,
  SECURITY DEFINER, `service_role` uniquement).

### Edge Functions
- `billing-create-prorata-invoice` — pour créer une facture d'activation
  ex nihilo (usage futur, appels admin/employé directs).
- `checkout-canonical-sync` — **appelle `apply_prorata_to_invoice`** après
  insertion des lignes si `payload.service_address.id` est fourni.

### Composants partagés (frontend)
- `<ProratePreviewCard>` — aperçu lecture seule via `preview_prorata` RPC.
- `<CheckoutProrataSection>` — wrapper checkout (résout `account_id`,
  affiche un preview par service).
- `useProratePreview` — hook React Query.

### Écrans câblés
| Portail | Écran | Statut |
|---|---|---|
| Client — Checkout | `ClientNewOrder` → étape adresse | ✅ Preview affiché + `service_address.id` propagé au sync |
| Nivra Core — Admin | `AccountServicesTab` → dialogue "Changer de forfait" | ✅ Preview affiché en direct |
| Client — Portail | `ClientMyServices` | N/A (aucun flux d'ajout de service — passe par le checkout) |
| Employé | — | N/A (aucun flux d'ajout de service — délégué au Core) |

## Invariants garantis

1. **Preview === Facture** : le composant `<ProratePreviewCard>` appelle
   `preview_prorata`, qui appelle `compute_prorata_for_service`. La fonction
   `apply_prorata_to_invoice` appelle **la même fonction SQL**. Zéro
   divergence possible.
2. **Idempotence** : `apply_prorata_to_invoice` skip si `prorata_metadata`
   est déjà présente sur au moins une ligne.
3. **Équipement jamais proraté** : filtre `line_type = 'service'` (les
   lignes `equipment` et `fee` sont ignorées).
4. **Taxes recalculées** : après réécriture des lignes, `subtotal`, `tps`,
   `tvq`, `total` sont recalculés puis cascadés sur `orders.total_amount`.
5. **Audit** : chaque ligne prorata stocke `applied_at`, `original_line_total`,
   `days_remaining`, `days_in_cycle`, `prev_anchor`, `next_anchor` dans
   `billing_invoice_lines.prorata_metadata`.

## Points volontairement hors périmètre

- **`billing-create-order-with-paypal-subscription`** — ne passe pas
  systématiquement par le sync canonique. Le prorata s'y appliquera
  automatiquement dès que la commande sera reconciliée par
  `checkout-canonical-sync`. Pour un correctif immédiat (prorata dès la
  1re facture PayPal), ajouter le même appel RPC dans cette fonction.
- **Template PDF** — inchangé, respecte la contrainte utilisateur.
  Les descriptions de ligne portent désormais le suffixe
  `· Prorata Nj/Nj jours`, rendu tel quel par le PDF existant.
- **Promotions BIENVENUE2026 / NIVRA2026** — inchangées : elles s'appliquent
  au 1er cycle plein, pas au prorata (rappel documenté dans
  `docs/PRORATA_MODEL.md`).

## Vérifications effectuées

- ✅ `tsgo --noEmit` — aucune erreur TypeScript.
- ✅ Migration appliquée sans erreur.
- ✅ Fonction `apply_prorata_to_invoice` restreinte à `service_role`
  (aucun accès depuis le client).
- ✅ Fonction avec `search_path = public` (pas de warning ajouté au linter).

## Comment tester en preview

1. **Checkout** : `/portal/nouvelle-commande` → choisir un forfait
   Internet/TV → étape adresse → sélectionner une adresse existante
   ou en créer une → le bloc "Ajustement au prorata" apparaît sous
   le sélecteur d'adresse pour chaque service.
2. **Admin** : `/admin/accounts/:id` → onglet Services → menu ⋮ sur
   un service → "Changer de forfait" → saisir un nouveau prix → le
   bloc prorata apparaît dans le dialogue.
3. **Facture réelle** : compléter une commande de bout en bout et
   vérifier que `billing_invoices.total` correspond au preview.
