## Plan — 4 points avant publication

### POINT 1 — Bloc Interac sur `/payer`
Dans `src/pages/public/PayerPublic.tsx`, sous le `SquarePaymentForm`, ajouter un bloc statique visible :
- Adresse email : `support@nivra-telecom.ca`
- Montant : préremp­li = `invoice.balance_due` (ou montant custom sélectionné)
- Réponse sécurité : `invoice.invoice_number`
- Note : "Envoyer via votre banque — un accusé sera envoyé une fois le virement reçu."
Aucun flux automatique, pur affichage (comme partout ailleurs).

### POINT 2 — Preuve JWT
Aucune ligne `[functions.square-charge-invoice]` ni `[functions.public-invoice-lookup]` dans `supabase/config.toml`. Par défaut Lovable = `verify_jwt = false`. Les deux fonctions sont donc publiques. **Aucun correctif requis.** Je livrerai la preuve `grep` dans le message final.

### POINT 3 — Montant personnalisé + surpaiement
**Frontend (`PayerPublic.tsx`)** : après match, deux options :
- `Payer X$ (montant exact)` (défaut)
- `Payer un autre montant` → input numérique min 1$, max = balance_due × 3 (garde-fou anti-erreur), pas au-dessus sauf case cochée "je souhaite créditer mon compte".

Passer le montant à `SquarePaymentForm` via une prop `amountOverrideCents?: number`. Étendre `SquarePaymentForm` pour envoyer `amount_cents` optionnel à `square-charge-invoice`.

**Backend (`square-charge-invoice/index.ts`)** :
1. Accepter `amount_cents` optionnel (validation : ≥100, ≤ balance × 3).
2. Charger Square pour ce montant réel (déjà le cas via `amountCents`).
3. Dans `applySquarePaymentDirectly`, après update de la facture :
   - Si `amountPaid > invoiceTotal - paidBefore` (surpaiement), insérer dans `account_adjustments` (`type='credit'`, `amount=overage`, `description="Crédit — surpaiement page publique X$"`, `account_id` résolu via billing_customers→profiles→accounts, `created_by_role='system_auto'`).
4. Statuts déjà gérés (`paid` / `partially_paid`) via logique `newBalanceDue`.

**Preuve** : je livrerai les 3 branches (partial / exact / overpay) commentées avec numéros de ligne.

### POINT 4 — Section Nivra Core « Caisse publique »
Renommer/étendre la page existante `CorePublicPaymentsPage.tsx` en `CorePublicCashierPage.tsx` avec 3 onglets :

**Onglet A — Historique** (existant, enrichi)
- Colonnes : Date · Client · Facture · Montant · Réf Square · IP · Statut · Reçu
- Filtres : date range, statut (succès/échec via `billing_system_alerts` type `square_charge_db_update_failed`), recherche texte
- Export CSV via `exportUtils.ts`

**Onglet B — Nouveau lien de paiement**
- Recherche client existant (nom / email / n° compte via query `profiles` + `billing_customers`)
- OU champ libre (nom + email pour non-enregistré)
- Champs : `amount`, `description`
- Sur submit : insert `field_payment_intents` (déjà supporté par `square-charge-invoice`) avec `source='public_pay_admin'`, `token` random 32 chars
- Retour : URL `/payer/i/<token>` copiable + bouton "Envoyer par email" (queue template dédié)

**Onglet C — Facture rapide**
- Similaire à B mais crée une vraie `billing_invoice` liée à un `billing_customer` (créé si manquant), génère lien `/payer/i/<invoiceToken>`
- Description → 1 ligne dans `billing_invoice_lines`

**Route publique enrichie** : `/payer/i/:token` — page qui skip la recherche 2-facteurs (le token EST l'auth), affiche description + montant, propose Square + Interac. Nouvelle edge fn légère `public-payment-link-resolve` (verify_jwt=false) qui lit `field_payment_intents.token` OU `billing_invoices` via token stocké dans `billing_snapshot_payment.public_token`.

**Migration nécessaire** :
- `field_payment_intents.public_token TEXT UNIQUE` (nullable) + index
- `field_payment_intents.source TEXT` (agrandi pour accepter `public_pay_admin`)
- Contrainte étendue sur `billing_payments.source` (déjà OK avec `public_pay`)

**Menu Core** : entrée « Caisse publique » sous Paiements (remplace « Paiements publics »).

### Fichiers touchés

**Nouveaux** :
- `supabase/functions/public-payment-link-resolve/index.ts`
- `src/pages/public/PayerPublicByToken.tsx`
- `src/core-app/pages/CorePublicCashierPage.tsx` (renomme + 3 onglets)
- `src/core-app/components/public-cashier/{HistoryTab,NewLinkTab,QuickInvoiceTab}.tsx`
- Migration `add_public_token_to_field_payment_intents.sql`

**Modifiés** :
- `src/pages/public/PayerPublic.tsx` — bloc Interac + montant custom
- `src/components/payment/SquarePaymentForm.tsx` — prop `amountOverrideCents`, allowCustom
- `supabase/functions/square-charge-invoice/index.ts` — `amount_cents`, création credit surpaiement
- `src/components/AppRoutes.tsx` — route `/payer/i/:token`
- `src/core-app/CoreApp.tsx` / navigation — entrée menu renommée

### Ce que je NE fais PAS
- Pas de vrai flux Interac automatique (juste instructions statiques).
- Pas de gestion des "échecs" Square autrement que via `billing_system_alerts` (Square ne persiste rien si refus).
- Pas de refonte du composant `SquarePaymentForm` — juste 1 prop optionnelle.

Confirme et je code tout d'un bloc + livre les preuves grep/code.
