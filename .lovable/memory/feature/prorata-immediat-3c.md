---
name: Prorata Immédiat 3C
description: Prorata immédiat par service et par adresse, backend canonique (compute_prorata_for_service), promo au 1er cycle plein
type: feature
---
# Prorata Immédiat (Pass 3C)

- Anniversaire porté par `accounts.billing_anchor_day` (1–28), backfill = jour de création clampé.
- Fonction canonique : `public.compute_prorata_for_service(account_id, service_address_id, monthly_price_cents, activation_date)` → jsonb.
- Wrapper lecture publique : `public.preview_prorata(...)` (utilisé par `useProratePreview` + `ProratePreviewCard`).
- Edge function `billing-create-prorata-invoice` : construit facture d'activation avec 1 ligne prorata par service + lignes équipement plein tarif ; taxes via `compute_invoice_breakdown`.
- **Interdit** : tout calcul de prorata côté frontend. Le composant `ProratePreviewCard` est la seule UI, alimentée par le RPC.
- **Équipement jamais proraté** (borne 60$, terminal 50$, SIM 30$ — plein tarif).
- **Promos BIENVENUE2026 / NIVRA2026** : s'appliquent au **premier cycle plein**, pas au prorata.
- **Multi-adresses** : calcul par service, indépendant par `service_address_id`.
- **PDF template inchangé** : la description formatée `[Adresse, Ville] · Service · Prorata Nj/Nj` est générée serveur, lue telle quelle par le PDF.
- Metadata d'audit stockée dans `billing_invoice_lines.prorata_metadata` (jsonb).
- Doc : `docs/PRORATA_MODEL.md`.
