## Page publique de paiement — Plan complet

### 1. Route et intégration menu

- **Route publique** : `/payer` (FR, court, mémorisable) — alias `/pay` redirige vers `/payer`.
- **Menu header public** (composant nav marketing) : ajouter un lien **"Payer une facture"** à droite, séparé visuellement, style bouton secondaire (pas primary — le CTA principal reste "Commander").
- Aussi accessible depuis le footer sous "Support".

### 2. Champs de recherche (2-facteurs OBLIGATOIRE)

**Champ 1 — Référence** (un des trois) :
- Numéro de facture → `billing_invoices.invoice_number`
- Numéro de dossier/compte → `accounts.account_number` OU `profiles.client_number`
- Numéro de ticket → `support_tickets` (ajout d'un lien de paiement optionnel)

**Champ 2 — Identité** (un des quatre) :
- Email → `profiles.email`
- Téléphone → `profiles.phone` (normalisation E.164)
- Numéro de compte → `accounts.account_number` / `profiles.client_number`
- NIP client (4 chiffres) → validé via RPC contre `client_login_pins` (hash+salt)

**Règle** : les deux doivent pointer vers le MÊME `client_id`/`user_id`. Un seul match = refus générique ("Aucun dossier trouvé"), jamais indiquer lequel a échoué.

### 3. Sécurité

- **Rate limit** : 3 tentatives / IP / heure via `rate_limit_attempts` (clé `public-pay-search:<ip>`), verrou 1h après échec.
- **Log complet** : chaque tentative (succès + échec) dans `activity_logs` avec IP, user-agent, champs saisis (référence hashée SHA-256 pour éviter fuite si dump), résultat.
- **Aucune donnée sensible** exposée : jamais solde global, jamais autres factures, jamais méthodes de paiement enregistrées, prénom uniquement.
- **Edge function** `public-invoice-lookup` en `verify_jwt = false` avec validation stricte serveur.

### 4. Paiement Square

- `square-charge-invoice` accepte déjà les appels anonymes (JWT non requis pour ce cas) — je vérifie et documente. Sinon j'ajoute une branche `public_token` signé issu du lookup, valide 15 min, à usage unique.
- Formulaire `SquarePaymentForm` réutilisé tel quel (composant existant, corporate blue).
- Interac en secondaire (bouton "Payer par virement Interac" → affiche instructions email + référence).

### 5. Après paiement

- `square-charge-invoice` fait déjà : update `billing_invoices` (status=paid, balance_due=0, amount_paid), création `billing_payments`, invalidation caches.
- **Ajouts** :
  - Note auto dans `client_internal_notes` (type=`system`) : "Paiement public reçu — X$ — Réf Square: XXXXX — IP: xxx"
  - Email confirmation via template existant `payment_received` (bleu #0066CC, avec réf Square)
- **UI** : `SquarePaymentSuccessCard` existant, reste affiché jusqu'à fermeture manuelle.

### 6. Section Nivra Core — "Paiements publics"

- Nouvelle page `/core/paiements-publics` (sous menu Paiements).
- Vue = filtre sur `billing_payments` où `source = 'public_pay_page'` (nouveau champ) OU tag dans `notes`.
- Colonnes : Client · Facture · Montant · Réf Square · Date · IP.
- Réutilise `useAdminPayments` avec filtre.

### 7. Base de données

**Vérifications faites** :
- `billing_invoices` : `invoice_number`, `customer_id`, `balance_due`, `status`, `total` ✓
- `accounts` : `account_number`, `client_id` ✓
- `profiles` : `email`, `phone`, `client_number`, `first_name` ✓
- `support_tickets` : existe ✓
- `client_login_pins` : `pin_hash`, `pin_salt`, `user_id` ✓

**Migration nécessaire** :
- Ajouter `billing_payments.source TEXT` (valeurs: `portal`, `core_pos`, `public_pay`, `autopay`, `field`)
- Ajouter `billing_payments.payer_ip TEXT` (nullable, seulement public_pay)
- Vue `public_payments_view` pour Core

### 8. Fichiers touchés

**Nouveaux** :
- `src/pages/public/PayerPublic.tsx` — page recherche + paiement
- `src/core-app/pages/CorePublicPayments.tsx` — vue Core
- `supabase/functions/public-invoice-lookup/index.ts` — recherche 2-facteurs, rate limit, log
- Migration : colonnes `source`/`payer_ip` sur `billing_payments`, vue Core

**Modifiés** :
- Header/nav marketing → ajout lien "Payer une facture"
- Footer → même lien sous Support
- `src/components/AppRoutes.tsx` → route `/payer` + `/pay`
- `supabase/functions/square-charge-invoice/index.ts` → accepte `public_token` du lookup, écrit `source='public_pay'`
- `src/core-app/pages/CorePOSPage.tsx` / navigation Core → ajout entrée menu

### 9. Ce que je NE fais PAS

- Pas de création de compte automatique.
- Pas d'exposition du portail client.
- Pas de recherche par nom (trop faible).
- Pas d'affichage d'autres factures du même client.

---

**Confirmations demandées avant de coder** :
1. OK pour la route `/payer` et l'ajout menu header + footer ?
2. OK pour ajouter les colonnes `source` + `payer_ip` sur `billing_payments` ?
3. OK pour rate limit **3/h/IP avec verrou 1h** (strict) ou préfères-tu **5/h** ?
