
# Workflow Agent → Client — Finalisation Premium

Objectif : transformer l'actuelle page `/payer/:intentId` en véritable expérience de commande professionnelle, comparable aux grands fournisseurs télécom.

---

## 1. Renommage & repositionnement

- **Route** : garder `/payer/:intentId` (compat email déjà envoyés) + ajouter alias `/ma-commande/:intentId`.
- **Fichier** : `src/pages/PayerCommande.tsx` → renommé `RevoirMaCommande.tsx` (ancien réexporte le nouveau).
- **Titre H1** : « Revoir votre commande » (pas « Payer »).
- **Bandeau haut** : « Bonjour {prénom}, votre représentant {agent} a préparé votre commande. Vérifiez, confirmez, puis payez en toute sécurité. »
- **Stepper visuel** : 1. Vérifier → 2. Confirmer & signer → 3. Payer → 4. Confirmation.

## 2. Affichage complet de la commande

Nouvelle section « Détails de votre commande » avec cartes :

- **Forfait choisi** : nom + vitesse Internet (download/upload) + description.
- **Promotions actives** (BIENVENUE2026, rabais agent…).
- **Rabais** : détail par ligne.
- **Équipements inclus** vs **équipements en location** (badge distinct).
- **Frais uniques** (activation, installation, équipement).
- **Frais mensuels récurrents**.
- **Taxes** (TPS 5%, TVQ 9.975%) — via `compute_invoice_breakdown` côté backend, jamais recalculé.
- **Total aujourd'hui** vs **Total mensuel après promotions**.
- **Mode et date d'installation** (voir §5).
- **Adresse de service**, **adresse de facturation**, **coordonnées du titulaire**.

## 3. Modifications limitées

Par défaut tout est **verrouillé** (icône cadenas). Bouton primaire « Modifier mes informations » ouvre un dialog permettant d'éditer uniquement :

- téléphone, courriel
- adresse de facturation
- adresse de service (revalidation `useServiceCoverage` si changée — bloque paiement si non couverte)

Sauvegarde → update `field_quotes.client_info` + refresh intent. Historique dans `field_order_notes`.

## 4. Signature électronique

Nouvelle section « Confirmation de la commande » avant le paiement :

- 3 cases à cocher obligatoires (renseignements exacts / conditions Nivra / autorisation activation).
- **Signature** : composant `TypedSignatureInput` (existe déjà) ou `CanvasSignaturePad` (toggle).
- Nom complet requis.
- Bouton « Payer » reste désactivé tant que : cases cochées + signature + nom.

Persistence : nouvelle colonne `field_payment_intents.signature` (jsonb : `{ name, signature_png_or_typed, method, signed_at, ip, consent_flags }`).

## 5. Date d'installation

- Migration : `ALTER TABLE field_quotes ADD COLUMN install_date date, install_mode text` + `field_sales_orders` idem.
- Ajout `install_date`, `install_mode` dans `FieldSaleCustomer`/`FieldSaleDraft` + `StepRecap` (agent choisit via `<Calendar>`).
- Affiché sur `RevoirMaCommande`.
- Bouton « Demander une autre date » → note interne dans `field_order_notes`, envoie email staff.

## 6. Email « field_payment_link » redesigné

Template `field_payment_link` (baseStyles.ts / corporate #0066CC — règle mémoire) :

- Logo Nivra en tête (asset existant).
- « Bonjour {first_name}, »
- « Votre représentant {agent_name} a préparé votre commande. Il ne vous reste qu'à la confirmer et à finaliser le paiement. »
- Carte résumé : forfait, prix mensuel, total aujourd'hui, date d'installation.
- CTA bleu large : **« Revoir ma commande »** → `/payer/{intent_id}`.
- Mention validité 7 jours + sceau sécurité Square.

## 7. Page de confirmation post-paiement

Nouvelle page `/commande/confirmee/:intentId` (`CommandeConfirmee.tsx`) affichée après charge Square OK :

- 🎉 « Merci {prénom} ! Votre commande est confirmée. »
- Numéro de commande (`field_sales_orders.id`).
- Date prévue d'installation.
- Timeline « Prochaines étapes » (Traitement → Contact technicien → Installation → Activation).
- Estimation de contact technicien (« sous 24-48h »).
- Boutons :
  - « Télécharger ma facture » (invoice PDF)
  - « Créer mon portail client » (redirige `/portal/creer-mot-de-passe` avec token si compte auto-créé) OU « Accéder à mon portail »
  - « Nous contacter »

`PayerCommande` redirige vers cette page après succès Square.

## 8. Détails techniques

### Migrations
```sql
ALTER TABLE field_quotes
  ADD COLUMN install_date date,
  ADD COLUMN install_mode text CHECK (install_mode IN ('self','technician')) DEFAULT 'technician';

ALTER TABLE field_payment_intents
  ADD COLUMN signature jsonb,
  ADD COLUMN consent_flags jsonb,
  ADD COLUMN client_edits jsonb;

ALTER TABLE field_sales_orders
  ADD COLUMN install_date date,
  ADD COLUMN install_mode text;
```

### Fichiers touchés
- `src/pages/RevoirMaCommande.tsx` (renommage + refonte majeure)
- `src/pages/CommandeConfirmee.tsx` (nouveau)
- `src/pages/PayerCommande.tsx` (réexporte pour compat)
- `src/App.tsx` (routes)
- `src/field-app/components/sale/StepRecap.tsx` (ajout date picker + install_mode)
- `src/field-app/lib/fieldSaleTypes.ts` (ajout champs)
- `src/field-app/lib/fieldQuoteService.ts` (persist install_date)
- `supabase/functions/field-payment-link-create/index.ts` (vars install_date + template redesigné)
- `supabase/functions/_shared/transactional-email-templates/field-payment-link.tsx` (nouveau template React Email premium)
- `supabase/functions/square-charge-invoice/index.ts` (redirect confirmé + persistance signature)
- `supabase/functions/field-sales-sync/index.ts` (copie install_date/install_mode dans field_sales_orders)

### Composants réutilisés
- `TypedSignatureInput` / `CanvasSignaturePad` (déjà présents)
- `Calendar` shadcn (voir shadcn-datepicker knowledge)
- `useServiceCoverage` (revalidation adresse)
- Design system existant (bleu corporate #0066CC — règle mémoire email)

### Sécurité
- Modifications client sur `field_quotes` : validée server-side dans nouvel edge `field-payment-intent-update` (aucun update total/prix — seulement contact + adresses).
- Signature immuable une fois enregistrée.

### Ordre d'exécution
1. Migration DB
2. Edge fn `field-payment-intent-update`
3. Refonte template email + redéploiement
4. Page `RevoirMaCommande` + composants
5. Page `CommandeConfirmee` + routes
6. Patch `StepRecap` (date d'installation)
7. Patch `square-charge-invoice` (redirect + persist signature)
8. `tsgo --noEmit` = 0
9. Publish

---

**Livraison** : expérience de commande de niveau grand fournisseur télécom, sans double saisie, avec vraie perception de « ma commande » et non « un paiement ».
