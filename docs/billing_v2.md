# Billing V2 — Convention & Garde-fous (Nivra Telecom)

> **⚠️ RÈGLE DE NON-RÉGRESSION**  
> Toute modification future liée à la facturation, paiements, crons ou triggers **DOIT** mettre à jour ce document.

## Objectif

Standardiser la facturation V2 pour garantir :

- une **source de vérité unique** (V2),
- une **idempotence des paiements** (anti-doublons),
- des **règles cohérentes** entre Interac et PayPal,
- une **stabilité face aux updates** (Lovable / refactors).

---

## Modèle de paiement (`billing_payments`)

### Champs clés

| Champ | Description |
|-------|-------------|
| `provider` | Processeur / réseau de paiement. Valeurs usuelles : `interac`, `paypal` (extensible) |
| `method` | Mode de paiement côté produit (ex. `interac`, `paypal`, `manual`). Ne pas confondre avec `provider`. |
| `reference` | Référence bancaire Interac (ex: `CA1234…`). **UNIQUE globale** (idempotence Interac) |
| `provider_payment_id` | Identifiant PayPal (ex: `capture_id` / `order_id`). **UNIQUE composite** `(provider, provider_payment_id)` |
| `status` | Ex. `pending`, `confirmed` (autres statuts possibles selon design) |
| `source` | Origine d'écriture du paiement. Valeurs autorisées : `live`, `legacy_migration`, `test`, `manual_correction` |
| `legacy_note` | Note interne pour conserver des traces legacy (si applicable) |

### Règles de cohérence (enforced DB)

Ces règles s'appliquent **uniquement** pour `source='live'` et `status='confirmed'` :

#### Interac (`provider='interac'`)
- `reference` **requise**
- `provider_payment_id` **doit être NULL**

#### PayPal (`provider='paypal'`)
- `provider_payment_id` **requis**
- `reference` **doit être NULL**

#### Autres providers (futur)
- **Au moins une clé** doit être présente (`reference` OU `provider_payment_id`)

> **Note** : Les paiements `pending` (ou non confirmés) peuvent être incomplets (ex. Interac sans référence tant que la preuve n'est pas validée).

### Idempotence (anti-doublons)

| Provider | Mécanisme |
|----------|-----------|
| **Interac** | `reference` est unique (index unique, ignoré si NULL/empty) |
| **PayPal** | `(provider, provider_payment_id)` est unique (index unique, ignoré si NULL) |

---

## Modèle facture (`billing_invoices`)

### Montants (règles immuables)

| Champ | Description |
|-------|-------------|
| `total` | **Immutable** — montant taxes incluses hors frais |
| `fees` | Frais additionnels (ex. late fee) |
| `amount_paid` | Somme des paiements confirmés rattachés à la facture |
| `balance_due` | **Calculé automatiquement** : `balance_due = total + fees - amount_paid` |

### Statuts

| Statut | Description |
|--------|-------------|
| `pending` | Non payée |
| `overdue` | En retard (après `due_date`) |
| `paid` | Payée |

---

## Triggers / Automations (invariants)

### Paiements → Facture (`amount_paid`)

`billing_invoices.amount_paid` est recalculé depuis `billing_payments` :

- **Inclusion** : `billing_payments.status = 'confirmed'`
- **Somme** : `SUM(amount)` sur les paiements confirmés par facture

### Facture (`balance_due` + auto-paid)

Le trigger facture maintient :

1. `balance_due = total + fees - amount_paid`
2. **Clamp** : si `balance_due < 0` → `balance_due = 0`
3. **Transition automatique** :
   - Si `status IN ('pending','overdue')` et `balance_due <= 0`
   - Alors `status = 'paid'` + `paid_at = now()` (si `paid_at` NULL)

---

## Checklist Post-Update (5 checks rapides)

### 1. Crons actifs

Doit rester **uniquement** :
- `billing-check-overdue-hourly`
- `billing-generate-renewals-hourly`
- `payment-reminders-hourly`
- `process-email-queue`

❌ **Aucun** ancien cron `*-daily` / doublon.

### 2. Trigger invoice

- Sur `billing_invoices` : trigger `sync_billing_invoice_balance` actif
- Vérifier que `balance_due` se recalcule sur UPDATE.

### 3. Trigger payments

- Sur `billing_payments` : trigger `sync_invoice_amount_paid` actif
- Vérifier qu'un paiement confirmé met à jour `amount_paid`.

### 4. Test paiement → paid

Ajouter un paiement `confirmed` sur une facture `pending` :

**Attendu** :
- `amount_paid` augmente
- `balance_due` diminue jusqu'à 0
- `status` passe à `paid`
- `paid_at` est rempli

### 5. Test idempotence Interac

Tenter 2 INSERT avec la même `reference` (live + non vide) :

**Attendu** : une seule ligne est acceptée (doublon bloqué)

---

## Règle d'or

> **Ne jamais modifier les contraintes/triggers ci-dessus sans conserver les mêmes invariants** (idempotence, cohérence provider, `balance_due` calculé, auto-paid).

---

## Policy Paiements & Corrections (Admin)

### 1. Règle générale

- Un paiement ne doit être mis à `confirmed` **que lorsqu'il est vérifié** (preuve Interac valide ou confirmation PayPal).
- Les paiements `pending` peuvent être incomplets (ex. Interac sans référence), **c'est normal**.

### 2. Interac (virement)

| Étape | Action |
|-------|--------|
| Avant confirmation | `status = pending` |
| À la confirmation | L'admin **doit obligatoirement** saisir une référence bancaire Interac (champ `reference`) |

⚠️ **Anti-doublon** : Une référence Interac ne peut être utilisée qu'**une seule fois**.  
Si la référence existe déjà → ne pas recréer un paiement : vérifier l'invoice associée et corriger au besoin.

### 3. PayPal Business

| Règle | Description |
|-------|-------------|
| À la confirmation | `provider = paypal` et `provider_payment_id` doit être rempli (`capture_id`) |
| Interdit | Ne **jamais** mettre de `reference` Interac sur un paiement PayPal |

### 4. Corrections / erreurs

> ❌ **Pas de rétrogradation automatique** — Ne pas éditer les champs au hasard.

**Procédure recommandée :**

1. **Annuler** le paiement (`status = voided` ou `reversed` si disponible, ou via procédure interne)
2. **Ajouter une note** (raison, date, opérateur)
3. **Réouvrir la facture** si nécessaire (action admin dédiée)

🎯 **Objectif** : Garder une piste d'audit claire et éviter de casser le service client.

### 5. Après chaque mise à jour du site

```bash
# Exécuter dans Lovable Cloud → Run SQL
scripts/billing_v2_post_update_checks.sql
```

✅ Le site est considéré **"validé"** seulement si **tous les checks sont PASS**.

---

## Actions Admin (Mapping UI → Règles)

| Bouton / Écran | Action système | Règle appliquée |
|----------------|----------------|-----------------|
| **Confirm payment (Interac)** | `status = confirmed` | Exige `reference` non vide |
| **Confirm payment (PayPal)** | `status = confirmed` | Exige `provider_payment_id` non vide |
| **Reopen invoice** | `status = pending` ou `overdue` | Selon `due_date` vs `now()` |
| **Add admin note** | Stocke dans `legacy_note` | Piste d'audit interne |
| **Void payment** | `status = voided` | Ne supprime pas — garde la trace |
| **Apply late fee** | Ajoute à `fees` | Recalcule `balance_due` automatiquement |

---

## Exemples acceptés (formats valides)

| Champ | Exemple | Notes |
|-------|---------|-------|
| `reference` (Interac) | `CA1234567890` | Format alphanumérique bancaire |
| `provider_payment_id` (PayPal) | `8MC585209K746631H` | Capture ID PayPal |
| `source` | `live` | **Seule valeur en production** |
| `source` | `legacy_migration` | Import données historiques |
| `source` | `test` | Environnement de test uniquement |
| `source` | `manual_correction` | Correction admin avec justification |

---

## 🚀 Release Checklist — Validation Post-Update

### ☐ 1. Déploiement terminé

L'update est bien appliquée sur l'environnement visé (**Test** ou **Live**).

### ☐ 2. Exécuter le script de validation

1. Ouvrir **Lovable** → **Cloud View** → **Run SQL**
2. Coller et exécuter : `scripts/billing_v2_post_update_checks.sql`

### ☐ 3. Résultat obligatoire

| Condition | Statut |
|-----------|--------|
| `10/10 PASS` | ✅ Release VALIDÉE |
| Un check `FAIL` (exception) | ❌ Release NON validée → corriger → relancer |

### ☐ 4. Validation métier minimale (~1 minute)

Vérifier rapidement dans l'**Admin Portal** :

- [ ] Une facture `pending` existe (ou en créer une en test)
- [ ] Un paiement `confirmed` met bien la facture à `paid` quand `balance_due = 0`

### ☐ 5. Documentation

Si l'update touche **facturation / paiements / crons / triggers** :

- [ ] Confirmer que `docs/billing_v2.md` est à jour
- [ ] Sinon, mettre à jour la doc **avant** de considérer la release terminée

### ☐ 6. Release Log (obligatoire)

Consigner chaque release dans une note interne ou champ "Release log" :

```
Date (MTL): YYYY-MM-DD HH:MM
Environnement: Test | Live
Version/Commit: (hash ou label)
Script post-update: 10/10 PASS (OK)
Opérateur: (nom)
Notes: (ex: "billing only", "UI admin", "cron change", "none")
```

> ⚠️ **Règle** : S'il n'y a pas de log + pas de 10/10 PASS, la release **n'est pas considérée validée**.

---

## Scripts de vérification

- **Post-update checks** : `scripts/billing_v2_post_update_checks.sql`
- Exécution : Lovable Cloud → Run SQL (rôle `postgres` ou `service_role`)
- Sortie attendue : `10/10 PASS` + aucune exception

---

## Conventions UI (couleurs et alertes)

### Règle Amber (warning visuel)

Les couleurs **amber** sont utilisées intentionnellement pour distinguer un **warning visuel non-bloquant**.

| Règle | Description |
|-------|-------------|
| **Usage autorisé** | UI-only, indicateur informatif, non-bloquant |
| **Usage interdit** | États PASS/FAIL, statuts critiques, validations binaires |
| **Nouvelle utilisation** | Toute nouvelle utilisation amber doit être limitée à : UI-only / non-blocking |

### États PASS/FAIL (script de validation)

- Le script `billing_v2_post_update_checks.sql` utilise un système **strictement binaire** :
  - `PASS` = check réussi (vert implicite)
  - `FAIL` = check échoué → **RAISE EXCEPTION** (bloque l'exécution)
- Aucune ambiguïté : un FAIL empêche la validation de la release.

### Localisation de la bannière

- La bannière "Post-update validation" est affichée **uniquement** sur la page Admin Facturation V2.
- Elle n'apparaît **jamais** sur le portail client.

---

## Snapshot Checkout — Source de Vérité (v2.2)

### Principe

Le **snapshot checkout** (`billing_totals`) est la source unique de vérité pour tous les montants financiers.

| Composant | Source de données |
|-----------|-------------------|
| `billing-create-order` Edge Function | `body.billing_totals` (reçu du frontend) |
| `orders.equipment_details` | Contient `billing_totals` + `line_items` |
| Facture PDF | `billingTotalsSnapshot` (extrait de `equipment_details.billing_totals`) |
| Contrat PDF | `equipment_details.billing_totals` |

### Structure `billing_totals`

```typescript
interface BillingTotals {
  subtotal: number;           // Sous-total brut avant taxes/rabais
  discount_amount: number;    // Montant du rabais appliqué
  base_amount: number;        // Montant taxable (subtotal - discount)
  tps_amount: number;         // TPS (5%)
  tvq_amount: number;         // TVQ (9.975%)
  total: number;              // Total final à payer
  promo_code?: string;        // Code promo appliqué
  promo_name?: string;        // Description du promo
  payment_method?: string;    // Méthode de paiement
  monthly_recurring?: number; // Montant mensuel récurrent
  one_time_fees?: number;     // Frais uniques
}
```

### Règle d'or

> **Les PDFs doivent TOUJOURS afficher les mêmes montants que le client a vus au checkout.**

---

## Templates PDF V2 (v2.3)

### Vue d'ensemble

Trois templates professionnels pour la facturation, tous avec layout A4/Letter printable:

| Template | Usage | Fichier |
|----------|-------|---------|
| **Invoice Monthly** | Factures mensuelles récurrentes (prépayé style postpayé) | `src/lib/pdf/invoiceMonthlyTemplate.ts` |
| **Invoice One-Time** | Équipements et frais ponctuels | `src/lib/pdf/invoiceOneTimeTemplate.ts` |
| **Order Summary** | Résumé de commande après paiement | `src/lib/pdf/orderSummaryTemplate.ts` |

### Header Standard

Tous les documents utilisent un header centré identique:

```
NIVRA COMMUNICATIONS INC.
Billing Division
Québec
1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5
Support@nivra-telecom.ca
```

### Variables Communes

| Variable | Description |
|----------|-------------|
| `account_number` | Numéro de compte client |
| `invoice_number` | Numéro de facture unique |
| `invoice_date` | Date d'émission |
| `bill_cycle_date` | Jour du cycle (1-28) |
| `cycle_start` / `cycle_end` | Période de service |
| `status` | pending / paid / overdue / cancelled |
| `subtotal_before_discounts` | Sous-total brut |
| `total_discounts` | Rabais appliqués |
| `subtotal_after_discounts` | Sous-total net |
| `tax_gst` | TPS (5%) |
| `tax_qst` | TVQ (9.975%) |
| `total_due` | Total à payer |
| `payment_reference` | Référence PayPal/Interac |

### Structure `invoice_lines[]` (Monthly)

```typescript
{
  service_type: "Internet" | "TV" | "Mobile" | "Security" | "Streaming";
  service_description: string;
  service_period: string;
  service_price: number;
  service_promo?: string;
  service_total: number;
}
```

### Structure `items[]` (One-Time)

```typescript
{
  item_name: string;
  item_description?: string;
  qty: number;
  unit_price: number;
  line_total: number;
  serial_number?: string;
}
```

### Logique Automatique

1. **Commande payée** → Créer Order + générer Order Summary + générer facture
2. **Type de facture** → One-Time si équipement/frais uniquement, sinon Monthly si cycle
3. **J-5 du cycle** → Générer facture mensuelle "à payer" et notifier
4. **Paiement confirmé** → Marquer Paid, démarrer cycle à la date/heure de confirmation

### Règles d'affichage

- **Ne jamais afficher** TV/Mobile/Internet si non souscrit
- **Toujours calculer** rabais/promos et taxes avec sections dédiées
- **Footer légal** prépayé obligatoire en bas de chaque page

### Hooks React

```typescript
import { 
  useInvoiceMonthlyPDF, 
  useInvoiceOneTimePDF, 
  useOrderSummaryPDF 
} from "@/hooks/usePDFTemplates";

// Usage
const { download, open, isGenerating } = useInvoiceMonthlyPDF();
await download(invoiceData);
```

### Preview Admin

Composant `<PDFTemplatePreview />` disponible pour tester les 4 templates avec données exemple.

---

## Convention des Identifiants Numériques (v2.4)

### Règle Globale (Obligatoire)

**Tous les identifiants visibles dans les PDFs doivent :**

| Règle | Description |
|-------|-------------|
| ❌ Premier chiffre | Ne JAMAIS commencer par 0 ou 1 |
| ✅ Premier chiffre | Toujours commencer par 2–9 |
| 📏 Longueur | Fixe selon le type de document |
| 🔢 Format | 100% numérique, unique |

### Longueurs par Type d'Identifiant

| Type | Longueur | Exemple | Placeholder |
|------|----------|---------|-------------|
| **Numéro de compte** | 6 chiffres | `234567` | `{{account_number}}` |
| **Numéro de commande** | 5 chiffres | `23456` | `{{order_number}}` |
| **Numéro de facture** | 7 chiffres | `2345678` | `{{invoice_number}}` |
| **Numéro de contrat** | 9 chiffres | `234567890` | `{{contract_number}}` |
| **Confirmation paiement** | 10 chiffres | `2345678901` | `{{payment_confirmation}}` |
| **Référence paiement** | 8 chiffres | `23456789` | `{{payment_reference}}` |

### Génération Sécurisée

```typescript
import { 
  generateAccountNumber,
  generateOrderNumber,
  generateInvoiceNumber,
  generateContractNumber,
  generatePaymentConfirmation,
  generatePaymentReference,
  generateDocumentIdSet,
} from "@/lib/secureIdGenerator";

// Génération individuelle
const accountNumber = generateAccountNumber();     // "234567"
const invoiceNumber = generateInvoiceNumber();     // "2345678"

// Génération d'un ensemble complet
const idSet = generateDocumentIdSet();
// { account_number, order_number, invoice_number, contract_number, 
//   payment_confirmation, payment_reference }

// Référence paiement dérivée de la facture
const payRef = generatePaymentReference(invoiceNumber);  // "5234567x"
```

### Logique Interne

```
function generateNumber(length):
  first_digit = random(2..9)       // JAMAIS 0 ou 1
  remaining = random_digits(length - 1)
  return concat(first_digit, remaining)
```

### Garde-fou Automatique

Le module `secureIdGenerator.ts` inclut une validation automatique :

```typescript
// Validation
isValidSecureId("234567", 6)  // true
isValidSecureId("034567", 6)  // false (commence par 0)
isValidSecureId("134567", 6)  // false (commence par 1)

// Auto-régénération si invalide
const safeId = ensureValidSecureId(maybeInvalidId, 'account');
```

### Règles d'Affichage PDF (Anti-erreurs)

| Règle | Description |
|-------|-------------|
| Wrap/Clamp | Jamais de texte qui dépasse |
| Sections visibles | Rabais / Promotions / Taxes toujours affichés si > 0 |
| Services non souscrits | Non affichés |
| Pagination auto | Si tables longues |
| Zones fixes | Aucune superposition autorisée |

### Tests de Validation (Checklist)

- [ ] Tous les numéros commencent par 2–9
- [ ] Internet seul (mensuelle) → OK
- [ ] Internet + Mobile + TV → OK
- [ ] Vente équipement (unique) → OK
- [ ] Rabais + promo + TPS/TVQ → OK

---

## Règles de Facturation, Non-Renouvellement et Litiges (v2.5)

### Principe Fondamental — Modèle Prépayé

Nivra Telecom opère **exclusivement** selon un modèle prépayé.
Aucun service n'est fourni sans paiement confirmé pour le cycle correspondant.

| Règle | Description |
|-------|-------------|
| ❌ Aucune dette | Jamais créée automatiquement en cas de non-renouvellement normal |
| ✅ Expérience postpayée | Factures mensuelles, dates d'échéance visibles |
| ✅ Logique prépayée | Strictement appliquée côté financier |

---

### Scénario A — Non-Renouvellement Normal (Prépayé)

Ce scénario s'applique lorsque le client ne paie pas volontairement son renouvellement mensuel **sans contestation bancaire**.

#### Chronologie

| Jour | Action | Résultat |
|------|--------|----------|
| **J-3** | Facture mensuelle générée | `status = 'pending'` + Email rappel |
| **J0** | Date de cycle, paiement non reçu | Service **non renouvelé** |
| **J0 immédiat** | Accès interrompu | `service_status = 'expired'` |

#### Conséquences Financières

| Élément | Appliqué? |
|---------|-----------|
| Frais de retard | ❌ NON |
| Intérêts | ❌ NON |
| Pénalité | ❌ NON |
| Création de dette | ❌ NON |

> **Interprétation** : Le non-renouvellement est une interruption volontaire du service, **non** un défaut de paiement postpayé.

---

### Scénario B — Paiement Contesté / Frauduleux / Rétrofacturation

Ce scénario s'applique **uniquement** lorsqu'un paiement :
- Est contesté auprès de l'institution bancaire
- Fait l'objet d'un chargeback
- Est identifié comme frauduleux

#### Déclenchement

```
Webhook PayPal/Stripe → payment_status IN ('disputed', 'chargeback', 'fraud')
OU
Confirmation manuelle Admin (Interac annulé / fraude détectée)
```

#### Chronologie Spécifique

| Jour | Action | Résultat |
|------|--------|----------|
| **Immédiat** | Compte gelé | `account_status = 'hold'` ou `'frozen'` |
| **Immédiat** | Service suspendu | Accès coupé |
| **J+2** | Frais administratifs | +5% appliqués |
| **J+5** | Expiration définitive | `service_status = 'expired'` |

#### Conséquences Financières (Litige UNIQUEMENT)

| Élément | Appliqué? |
|---------|-----------|
| Frais administratifs 5% | ✅ OUI |
| Intérêts possibles | ✅ OUI (selon type de litige) |
| Frais de réactivation | ✅ OUI (requis pour rétablir) |

> ⚠️ **Ces frais ne s'appliquent JAMAIS dans un non-renouvellement normal.**

---

### Réactivation du Service

#### Après Non-Renouvellement Normal

| Étape | Action |
|-------|--------|
| 1 | Paiement du cycle requis |
| 2 | Service réactivé **automatiquement** |
| — | ❌ Aucun frais de réactivation |

#### Après Litige / Fraude

| Étape | Action |
|-------|--------|
| 1 | Paiement du solde contesté (si applicable) |
| 2 | Paiement des frais administratifs 5% |
| 3 | Frais de réactivation fixes (ex. 15$) |
| 4 | Validation manuelle possible par admin |

---

### Conservation du Numéro / Service

| Période | État |
|---------|------|
| **J0 → J+90** | Service récupérable, numéro conservé |
| **Après 90 jours** | Service annulé, numéro potentiellement perdu |

---

### Terminologie Officielle (Obligatoire)

| ✅ Terme Autorisé | Utilisation |
|-------------------|-------------|
| Non-renouvellement | Prépayé normal |
| Renouvellement non confirmé | Facture non payée (prépayé) |
| Paiement contesté | Litige bancaire |
| Service expiré | Accès coupé |

| ❌ Terme Interdit | Raison |
|-------------------|--------|
| Impayé | Vocabulaire postpayé |
| Dette client | Interdit en prépayé |
| Overdue (ambigu) | Confusion avec postpayé |

---

### Pseudo-Code Opérateur (Logique Métier Exacte)

#### Paiement Confirmé

```sql
IF payment.status IN ('confirmed', 'captured') THEN
  -- Mise à jour statuts
  orders.payment_status = 'confirmed';
  billing_payments.amount = provider_amount;
  billing_invoices.amount_paid += provider_amount;
  billing_invoices.balance_due = 0;
  billing_invoices.status = 'paid';

  -- Générations automatiques (Rule 2-9)
  generate_confirmation_number(10);  -- Ex: 2195393431
  generate_payment_reference(8);     -- Ex: 81143403
  generate_invoice_number(7);        -- Ex: 3916061
  generate_contract_number(9);       -- Ex: 200885783

  -- Contrat automatique
  INSERT INTO contracts (order_id, version, status)
  VALUES (order_id, 1, 'sent');

  -- Service actif
  subscriptions.status = 'active';
  subscriptions.current_period_start = now();
  subscriptions.current_period_end = now() + INTERVAL '30 days';

  -- Envoi emails + PDFs
  CALL send_email_with_pdfs();
END IF;
```

#### Non-Renouvellement Normal

```sql
IF today = bill_cycle_date AND payment_not_received THEN
  -- ⚠️ AUCUNE dette créée
  billing_invoices.status = 'void';
  orders.payment_status = 'not_renewed';

  subscriptions.status = 'expired';  -- ou 'suspended'
  CALL disable_service_access();

  -- ❌ Aucun frais
  -- ❌ Aucun intérêt
END IF;
```

#### Paiement Contesté / Frauduleux

```sql
IF payment.status IN ('disputed', 'chargeback', 'fraud') THEN
  orders.payment_status = payment.status;
  account_status = 'hold';

  subscriptions.status = 'suspended';
  CALL disable_service_access();

  -- Tâches planifiées
  CALL schedule_task('J+2', 'apply_admin_fee(5%)');
  CALL schedule_task('J+5', 'mark_service_expired()');
END IF;
```

#### Réactivation

```sql
-- Après non-renouvellement normal
IF scenario = 'non_renewal' AND payment_received THEN
  subscriptions.status = 'active';
  -- ❌ Aucun frais supplémentaire
END IF;

-- Après litige
IF scenario = 'dispute' AND admin_approved THEN
  -- Requiert: paiement + admin_fee + reactivation_fee
  subscriptions.status = 'active';
END IF;
```

---

### Structure Admin Opérateur (Obligatoire)

#### Admin Orders — Visible Sans Cliquer

| Colonne | Source | Obligatoire |
|---------|--------|-------------|
| Client | `profiles.full_name` | ✅ |
| Numéro compte | `profiles.account_number` | ✅ |
| Numéro commande | `orders.order_number` | ✅ |
| Total facture | `billing_totals.total` (snapshot) | ✅ |
| Payé | `SUM(billing_payments.amount WHERE confirmed)` | ✅ |
| Payment status | `orders.payment_status` | ✅ |
| Service status | `subscriptions.status` | ✅ |

#### Admin Payments — Réconciliation Bancaire

| Colonne | Règle |
|---------|-------|
| **Payé** | TOUJOURS `billing_payments.amount` |
| **Facture** | TOUJOURS `billing_invoices.total` |
| **Écart** | `payé − facture` |
| **Provider ID** | PayPal capture_id / référence banque |
| **Statut** | `confirmed` / `disputed` / `chargeback` |

> ⚠️ **INTERDIT** : Recalculer depuis items ou UI.

#### Admin Contracts

| Règle | Description |
|-------|-------------|
| ❌ Génération manuelle | Jamais autorisée |
| ✅ Génération auto | Au paiement confirmé |
| ✅ Versioning | v1, v2, v3... obligatoire |
| ✅ Modification commande | → `superseded` + nouvelle version |

---

### Ce Que le Client Voit (Exactement)

#### Portail Client — Facturation

**Toujours visible :**
- Numéro de compte (6 chiffres, 2–9)
- Facture mensuelle (PDF)
- Statut service
- Date de cycle
- Bouton Payer / Renouveler

**Jamais visible :**
- ❌ "Dette"
- ❌ "Intérêt" (sauf litige)
- ❌ "Overdue" ambigu

#### PDFs Envoyés

| Document | Quand |
|----------|-------|
| Résumé commande | Après checkout |
| Facture | À chaque cycle / paiement |
| Reçu | Paiement confirmé |
| Contrat | Paiement confirmé |

**Tous contiennent :**
- Numéro de compte
- Numéro facture
- Référence paiement
- Confirmation paiement

---

### Erreurs à Ne Plus Jamais Faire

| ❌ Erreur | Impact |
|-----------|--------|
| Mélanger non-renouvellement et litige | Frais injustifiés |
| Utiliser "impayé" pour prépayé | Confusion client |
| Générer contrats manuellement | Incohérence versions |
| Montrer 0$ payé quand paiement existe | Réconciliation impossible |
| Cacher le numéro de compte au client | Non-conformité opérateur |

---

### Checklist Finale (GO / NO-GO)

Avant mise en production, **tout doit être OUI** :

| Check | Requis |
|-------|--------|
| Numéro de compte visible portail + PDFs | ✅ |
| Paiement confirmé ≠ non-renouvellement | ✅ |
| Contrat auto-généré | ✅ |
| Admin voit client + montant sans cliquer | ✅ |
| Payé ≠ Facture bien séparés | ✅ |
| Aucun frais hors litige | ✅ |
| Service suspendu automatiquement si non payé | ✅ |

---

## Historique

| Date | Auteur | Description |
|------|--------|-------------|
| 2026-01-24 | Lovable AI | Création initiale — Billing V2 finalisé |
| 2026-01-24 | Lovable AI | Ajout Policy Paiements & Corrections (Admin) |
| 2026-01-24 | Lovable AI | Ajout Actions Admin + Exemples formats valides |
| 2026-01-24 | Lovable AI | Ajout Release Checklist — Validation Post-Update |
| 2026-02-06 | Lovable AI | v2.2: Ajout Snapshot Checkout comme source de vérité pour PDFs |
| 2026-02-06 | Lovable AI | v2.3: Ajout 3 Templates PDF (Monthly, One-Time, Order Summary) |
| 2026-02-06 | Lovable AI | v2.4: Convention des Identifiants Numériques (2-9, longueurs fixes) |
| 2026-02-07 | Lovable AI | v2.5: Règles Non-Renouvellement vs Litige, Pseudo-Code Opérateur, Checklist GO/NO-GO |
