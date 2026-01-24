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

## Historique

| Date | Auteur | Description |
|------|--------|-------------|
| 2026-01-24 | Lovable AI | Création initiale — Billing V2 finalisé |
| 2026-01-24 | Lovable AI | Ajout Policy Paiements & Corrections (Admin) |
| 2026-01-24 | Lovable AI | Ajout Actions Admin + Exemples formats valides |
| 2026-01-24 | Lovable AI | Ajout Release Checklist — Validation Post-Update |
