## Infrastructure confirmée (réutilisée, rien de cassé)

**Backend existant réutilisable :**
- `billing_payments` — table principale, on **ajoute** une colonne `nivra_reference` (TEXT UNIQUE)
- `billing_invoices` — trigger INV-AAAA-XXXX déjà en place, aucune modif de schéma
- `client_internal_notes` — utilisé pour note système auto post-paiement
- `email_queue` + template `baseStyles.ts` bleu #0066CC — utilisé pour tous les emails
- Edge functions Square existantes : `core-square-payment-link`, `square-charge-invoice`, `public-payment-link-resolve`, `billing-confirm-payment`
- PDF : infra existante (`client-pdf-download`, `debug-invoice-pdf`, `generate-payslip-pdf`) utilise pdf-lib côté edge → **on ajoute** `generate-payment-receipt-pdf` sur le même pattern
- `activity_logs` + `rate_limits` — pour rate-limit 3 tentatives/IP/h
- `account_adjustments` — pour excédent en crédit

**Nouveau système NVR-XXXX :**
- Nouvelle séquence Postgres `nivra_reference_seq`
- Fonction `generate_nivra_reference()` → format `NVR-2026-00042`
- Colonne `billing_payments.nivra_reference` (UNIQUE, indexée)
- Trigger `BEFORE INSERT` qui remplit auto si NULL

---

## Plan d'exécution

### Étape 1 — Migration base de données
```text
1. ALTER billing_payments ADD nivra_reference TEXT UNIQUE
2. CREATE SEQUENCE nivra_reference_seq
3. CREATE FUNCTION generate_nivra_reference() → 'NVR-YYYY-NNNNN'
4. CREATE TRIGGER trg_billing_payments_nivra BEFORE INSERT
5. CREATE TABLE public_payment_links (
     token, nivra_reference, invoice_id?, account_id?,
     amount_due, description, expires_at, status,
     created_by, sent_to_email, paid_at, payment_id)
   + GRANT + RLS (public SELECT via token, staff full)
6. CREATE TABLE public_payment_attempts (ip, identifier, success, created_at)
   + index (ip, created_at) pour rate-limit
```

### Étape 2 — Edge Functions (nouvelles)
```text
- public-invoice-search        POST { query, contact } → rate-limited lookup
- public-payment-process       POST { token|invoice, amount, sqPaymentToken }
- generate-payment-receipt-pdf GET  { payment_id } → PDF officiel Nivra
- core-create-payment-link     POST staff-only → NVR + token + email
- core-create-quick-invoice    POST staff-only → INV + NVR + email + lien
```
Toutes verrouillées CORS, Zod-validées, `has_role` pour les staff endpoints.

### Étape 3 — Page publique /payer (refonte complète)
Wizard 4 étapes, design opérateur télécom (dark hero + carte blanche premium) :
```text
Step 1  RECHERCHE      — 2 champs, rate-limit, message compte existant
Step 2  DOSSIER TROUVÉ — prénom seul, liste factures multi-select,
                          montant exact / partiel / excédent
Step 3  PAIEMENT       — Square Web SDK inline + Interac secondaire,
                          statut temps réel (3 checkpoints animés)
Step 4  CONFIRMATION   — NVR-XXXX en grand, ref Square petit,
                          bouton "Télécharger reçu PDF", "Copier NVR",
                          email auto envoyé
```
Fichiers :
- `src/pages/public/PayerPublic.tsx` (refonte)
- `src/pages/public/payer/SearchStep.tsx`
- `src/pages/public/payer/InvoiceStep.tsx`
- `src/pages/public/payer/PaymentStep.tsx`
- `src/pages/public/payer/ConfirmationStep.tsx`

### Étape 4 — Nivra Core /core/public-payments (refonte 3 onglets)
Fichier : `src/core-app/pages/CorePublicPaymentsPage.tsx` (refonte)

```text
Onglet 1 — TABLEAU DE BORD
  4 KPI cards (jour / semaine / mois / en attente)
  Tableau paiements temps réel (realtime channel)
  Filtres date/statut/montant/client/agent
  Export CSV
  Actions ligne : voir reçu PDF, renvoyer email

Onglet 2 — CRÉER UN LIEN
  Autocomplete client (accounts) OU nouveau
  Montant + description + expiration
  Génère NVR + token → affiche lien copiable
  Bouton "Envoyer par email" (template bleu)
  Rappel automatique J+3 si non payé

Onglet 3 — FACTURE RAPIDE
  Autocomplete client OU nouveau
  Crée billing_invoices (INV-XXXX via trigger)
  Génère automatiquement un lien NVR
  Affiche INV + NVR en grand avec bouton copier
  Envoie email + PDF facture en pièce jointe
```

Sous-composants : `PublicPaymentsDashboard.tsx`, `CreatePaymentLinkTab.tsx`, `CreateQuickInvoiceTab.tsx`, `PaymentRow.tsx`, `KpiCard.tsx`.

### Étape 5 — Reçu PDF officiel Nivra
Edge function `generate-payment-receipt-pdf` (pdf-lib) :
```text
Logo Nivra + Nivra Communications Inc., Québec
NVR-XXXX (grand)  |  INV-XXXX
Date / heure / client / description
HT + TPS 5% + TVQ 9.975% + Total
Mode : Carte de crédit (Square)
Ref Square (petit, bas de page)
Mention : "Reçu officiel — conserver pour vos dossiers"
```
Style aligné sur les autres PDFs Nivra existants.

### Étape 6 — Automatisations post-paiement (dans `billing-confirm-payment`)
```text
1. billing_payments.nivra_reference auto (trigger)
2. billing_invoices status = paid/partially_paid + balance_due
3. account_adjustments si excédent
4. client_internal_notes (note système auto)
5. invalidateAfterPayment()
6. email_queue → template bleu #0066CC avec PDF reçu
7. billing_system_alerts si échec
```

### Étape 7 — Sécurité
- Rate-limit 3/IP/h via `public_payment_attempts`
- Zod partout côté edge
- RLS : `public_payment_links` lisible via token seul, staff via `has_role`
- Aucune donnée sensible en réponse publique (prénom uniquement)
- Aucune mention PayPal

---

## Contrat que je respecte
1. Zéro régression Square / email_queue / billing_invoices / client_internal_notes
2. NVR-XXXX partout (page, emails, Core, PDF)
3. Reçu PDF téléchargeable + email
4. Template bleu #0066CC obligatoire
5. Aucune mention PayPal
6. Backend = source de vérité (aucun calcul de taxes côté front)

---

## Ordre d'exécution
1. Migration SQL (NVR + tables)
2. Edge functions (5)
3. Page publique /payer (wizard 4 étapes)
4. CorePublicPaymentsPage (3 onglets)
5. PDF reçu
6. Câblage post-paiement
7. Test bout-en-bout + publish

**Confirme-moi ce plan (ou dis-moi quoi ajuster) et je lance la migration + code dans la foulée.**