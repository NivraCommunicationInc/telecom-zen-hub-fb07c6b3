# Facture mensuelle consolidée par compte

Passer du modèle **1 facture = 1 abonnement** au modèle **1 facture = 1 compte** (peu importe le nombre d'adresses et de services).

## Ce que ça change concrètement

Avant :
- Oldo : 2 factures/mois (une pour Monet, une pour Moreau), 2 cycles indépendants, 2 paiements.

Après :
- Oldo : **1 seule facture le 25 du mois** avec 2 sections adresses :
  - Adresse 1 — 2352 Rue Monet, Laval : Internet 60 $
  - Adresse 2 — 21 Rue Moreau, Gatineau : GIGA + TV Basic 110 $
  - Sous-total 170 $ · TPS/TVQ · Rabais autopay -5 $ · Total unique
  - 1 seul paiement, 1 seul PDF

## Étapes

### 1. Schéma DB (migration)
- Ajouter `account_id` (uuid, FK accounts) sur `billing_invoices` — nullable pour rétrocompat, mais rempli sur toutes les nouvelles factures.
- Assouplir la contrainte `unique_invoice_per_cycle` : quand `subscription_id IS NULL`, la clé unique devient `(account_id, cycle_start_date, type)`.
- Backfill : remplir `account_id` sur toutes les factures existantes via `billing_customers.user_id → accounts.client_id`.
- Aligner les cycles : forcer tous les abonnements actifs d'un même compte à partager `billing_anchor_date` et `cycle_start_date`/`cycle_end_date` basés sur `accounts.billing_cycle_day`.

### 2. Réécriture de `billing-generate-renewals`
Basculer la boucle : au lieu de parcourir `billing_subscriptions`, parcourir les **comptes** dont le prochain cycle tombe dans la fenêtre J-60 → J+3.

Pour chaque compte :
1. Lister tous les `billing_subscriptions` actifs du compte (via `billing_customers.user_id`).
2. Vérifier l'idempotence : existe-t-il déjà une facture `renewal` pour `(account_id, cycle_start_date)` ?
3. Calculer les rabais promo par service, appliquer autopay -5 $ **une seule fois par facture** (pas par service).
4. Insérer une facture consolidée avec `subscription_id = NULL`, `account_id` renseigné, `notes` regroupant les mentions par service.
5. Insérer les lignes de facture avec `service_address_id` sur chaque ligne pour permettre le groupement PDF.
6. Un seul rappel autopay/email par cycle.

### 3. Regroupement PDF par adresse
- Modifier `pdfFromDb.ts` (renderer partagé) : quand la facture n'a pas de `subscription_id` unique, grouper les lignes par `service_address_id` avec un en-tête de section "Adresse X — <adresse complète>".
- Ordre : adresse par défaut en premier, puis les autres par ordre d'ajout.
- Ne rien changer au format visuel corporate #0066CC — juste ajouter les headers de section.

### 4. Autopay retry
`square-autopay-retry` fonctionne déjà par `invoice_id` — aucune modif nécessaire, sauf s'assurer qu'il route les erreurs au bon `account_id` (déjà OK via `billing_customers.user_id`).

### 5. Portail client + Core admin
- `ClientBillingHub` et `CoreInvoiceDetail` : afficher les lignes groupées par adresse quand la facture couvre plusieurs adresses.
- Aucune migration UI cassante — l'ancien layout continue de marcher pour les factures avec `subscription_id` non NULL.

### 6. Backfill du compte Oldo (test)
Après les modifs, aligner manuellement les cycles des 2 abonnements SUB-001011 et SUB-001024 sur le jour 25 du compte, puis appeler `billing-generate-renewals` pour créer la 1ʳᵉ facture consolidée du prochain cycle et vérifier le PDF.

## Détails techniques

- **Triggers impactés** : `fn_block_orphan_invoice`, `fn_hydrate_invoice_account_snapshot`, `fn_lock_invoice_account_snapshot`, `enforce_invoice_invariants` — tous doivent accepter `subscription_id IS NULL` quand `account_id IS NOT NULL`.
- **Nouveau service activé en cours de cycle** : ajouté au **prochain** cycle du compte, avec ligne prorata sur la même facture (edge `billing-create-prorata-invoice` génère toujours une facture séparée immédiate — inchangé).
- **Résiliation en cours de cycle** : crédit prorata sur la facture consolidée du prochain cycle.
- **Rétrocompat** : les factures existantes avec `subscription_id` non NULL restent lisibles et affichables comme avant.

## Risques

- **Contraintes uniques** : bien testées avant migration (`(account_id, cycle_start_date, type)` doit être partiel `WHERE subscription_id IS NULL`).
- **Alignment des cycles** : les abonnements créés à des dates différentes doivent tous "sauter" vers le prochain jour de cycle du compte au premier renouvellement consolidé. Peut créer un cycle plus court pour l'un des services (prorata négatif appliqué automatiquement).
- **Rollback** : si un bug émerge, le flag `account_id IS NULL` sur l'ancien modèle sert de fallback ; aucune facture existante n'est modifiée.

## Livrable de test
Après exécution : facture consolidée pour Oldo avec les 2 adresses, PDF regroupé, un seul paiement autopay attendu.
