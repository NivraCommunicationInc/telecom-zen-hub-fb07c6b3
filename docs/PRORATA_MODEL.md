# Prorata Model — Pass 3C

## Principe

Lorsqu'un client ajoute un service en cours de cycle de facturation, il paie
immédiatement un **montant proraté** couvrant la période entre la date
d'activation et la prochaine date d'anniversaire de facturation. Le premier
cycle plein commence ensuite au prochain anniversaire.

## Source de vérité

- **`accounts.billing_anchor_day`** (1–28) : jour d'anniversaire de facturation
  du compte. Backfill = `LEAST(EXTRACT(day FROM created_at), 28)`.
- **`public.compute_prorata_for_service(account_id, service_address_id,
  monthly_price_cents, activation_date)`** : fonction SQL canonique.
- **`public.preview_prorata(...)`** : wrapper lecture publique utilisé par
  le frontend (aucun calcul côté client).

## Formule

```
prev_anchor = dernier anniversaire ≤ activation_date
next_anchor = prev_anchor + 1 mois
days_in_cycle = next_anchor - prev_anchor
days_remaining = next_anchor - activation_date
prorata_cents = round( monthly_price_cents * days_remaining / days_in_cycle )
```

Cas particulier : si `activation_date == anchor_day`, `prorata = 0` et le cycle
plein démarre immédiatement.

## Interaction avec les autres règles

| Règle | Comportement |
|-------|-------------|
| Taxes (TPS/TVQ) | Appliquées **après** prorata via `compute_invoice_breakdown`. |
| Équipement (borne, terminal, SIM) | **Jamais proraté**. Facturé plein tarif dans la même facture d'activation. |
| Promotions BIENVENUE2026 / NIVRA2026 | 100 % off s'applique au **premier cycle plein**, pas au prorata. Le client paie donc le prorata même avec promo. |
| Multi-adresses | Calcul **par service**, lié à `service_address_id`. Ajouter un service sur l'adresse B ne modifie pas les cycles de l'adresse A. |
| Réactivation | Nouveau prorata sur la nouvelle date d'activation. |

## Facture

- Description ligne : `[Adresse, Ville] · <Service> · Prorata Nj/Nj jours`.
- Metadata JSON stockée dans `billing_invoice_lines.prorata_metadata`
  (traçabilité audit).
- **Aucun changement au template PDF** : la description est générée côté
  serveur, le PDF lit `description` inchangé.

## Écrans concernés

- Checkout — étape review : `<ProratePreviewCard>` par service sélectionné.
- Portail client — ajout de service sur une adresse existante.
- Portail admin — ajout de service depuis la fiche compte.

Tous utilisent le **même composant** et le **même RPC** que le montant
finalement facturé par `billing-create-prorata-invoice`. Aucune divergence
possible entre l'aperçu et la facture.

## Exemples

- Anchor = 15, activation = 5 juillet → prev = 15 juin, next = 15 juillet,
  days_in_cycle = 30, days_remaining = 10, prorata = 10/30 du prix mensuel.
- Anchor = 28, activation = 28 janvier → prorata = 0, cycle plein dès le 28.
- Anchor = 28, activation = 10 février → prev = 28 janvier, next = 28 février,
  days_in_cycle = 31, days_remaining = 18.

## Retrait futur

Non applicable : cette fonctionnalité est permanente. Toute évolution
(cycles non-mensuels, alignement calendaire, etc.) devra ajouter des
colonnes dédiées et versionner `compute_prorata_for_service` (`_v2`).
