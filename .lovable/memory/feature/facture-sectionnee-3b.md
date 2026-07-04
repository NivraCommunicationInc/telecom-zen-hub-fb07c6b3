---
name: Facture sectionnée par adresse (Pass 3B)
description: Détail facture groupé par service_address_id avec sous-total par adresse
type: feature
---
# Facture sectionnée par adresse (Pass 3B)

- `billing_invoice_lines.service_address_id` (nullable) est la clé de regroupement.
- Hook `useAdminInvoiceDetail` joint `service_addresses` sur chaque ligne (`address_line, city, province, postal_code`).
- Page `CoreInvoiceDetail` affiche une carte par adresse : en-tête `<MapPin>` avec adresse formatée + sous-total, puis table des lignes de cette adresse.
- Les lignes sans `service_address_id` (frais génériques, ajustements) tombent dans un bucket "Général — sans adresse de service".
- **PDF inchangé** : la description formatée par le backend (`[Adresse, Ville] · Service · …`) reste la seule source pour le PDF. Aucun regroupement PDF côté front.
- Totaux facture (`subtotal`, `tps`, `tvq`, `total`) restent inchangés — canoniques DB, jamais recalculés côté UI.
