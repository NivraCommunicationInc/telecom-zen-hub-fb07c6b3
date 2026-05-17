# Refonte Paiements de paie — Page dédiée A1, synchronisée Core/RH/Field/Employé

## Objectif
Créer une **page dédiée** `/core/hr/paiements` (et miroir `/hr/paiements`) avec un système de paiement de paie de niveau entreprise, synchronisé sur tous les portails (Core, RH, Field, Employé).

## Architecture

### 1. Base de données (migration)

**Nouvelle table `payroll_payments`** (séparée de `payroll_entries` pour traçabilité complète) :
- `id`, `payment_number` (PAY-YYYYMMDD-XXXX auto)
- `payroll_entry_id` → FK vers entrée de paie
- `employee_user_id`, `employee_name`, `employee_number` (snapshot)
- `gross_amount`, `net_amount`, `deductions_total`
- `payment_method`: `interac` | `direct_deposit` | `cheque` | `cash` | `wire_transfer` | `paypal`
- `payment_status`: `draft` | `scheduled` | `pending_approval` | `approved` | `processing` | `sent` | `confirmed` | `failed` | `bounced` | `cancelled` | `reversed` | `disputed` | `on_hold`
- `scheduled_date`, `sent_date`, `confirmed_date`, `bounced_date`
- `bank_reference`, `confirmation_number`, `transaction_id`
- `recipient_email`, `recipient_account_last4`, `recipient_bank_name`
- `failure_reason`, `failure_code`, `retry_count`
- `pdf_avis_url`, `pdf_paystub_url`
- `email_sent_at`, `email_opened_at`, `email_bounced_at`
- `internal_notes`, `client_visible_notes`
- `created_by`, `approved_by`, `sent_by`, `confirmed_by` (audit trail)
- `requires_approval` (boolean), `approval_threshold_amount`
- `attachments` (jsonb — pièces justificatives spécimen chèque, etc.)
- Index sur status, employee_user_id, scheduled_date

**Table `payroll_payment_events`** (timeline complet) :
- `payment_id`, `event_type`, `event_data`, `actor_id`, `actor_name`, `actor_role`, `created_at`

**RLS** : Admin Core full access, RH read+write, Employé read own only, Field read own only.

### 2. Edge Function `payroll-payments` (CRUD + actions)

Actions :
- `create` — créer paiement depuis entrée de paie
- `schedule` — planifier date d'envoi
- `request_approval` — workflow approbation
- `approve` / `reject`
- `mark_sent` — marquer envoyé (avec méthode/référence)
- `confirm` — confirmation banque
- `mark_failed` / `mark_bounced` — avec retry
- `cancel` / `reverse`
- `resend_notification` — re-notifier employé
- `bulk_process` — traitement en lot
- `generate_avis_pdf` — PDF officiel template système
- `send_notification` — email via queue système avec PDF attachés

### 3. Page dédiée `/core/hr/paiements` + `/hr/paiements`

**Sections** :
1. **Dashboard stats** : Total à payer, En attente d'approbation, Programmés, Envoyés, Confirmés, Échoués, Total ce mois
2. **Filtres avancés** : Statut, Méthode, Période, Employé, Montant min/max, Recherche
3. **Tableau principal** avec colonnes :
   - Sélection (bulk actions), # Paiement, Employé, Méthode, Montant, Statut (badge coloré), Date programmée, Date envoyée, Référence, Actions
4. **Actions par ligne** : Voir détails, Marquer envoyé, Confirmer, Annuler, Renotifier, Télécharger Avis PDF, Télécharger Talon, Voir timeline
5. **Drawer détail paiement** : Toutes les infos, timeline événements, pièces jointes, notes
6. **Bulk actions** : Approuver lot, Marquer envoyés en lot, Renotifier en lot, Export CSV
7. **Modal "Marquer payé"** avancé : Méthode, Date, Référence, Banque, # transaction, Notes internes, Notes client, Pièces jointes, Switch notification email

### 4. Synchronisation multi-portail

- **Nivra Core** (`/core/hr/paiements`) : vue admin complète + toutes actions
- **Nivra RH** (`/hr/paiements`) : même page, mêmes droits RH
- **Portail Employé** (`/employee/paiements` nouvelle section) : voir SES paiements, télécharger PDFs, statut en temps réel
- **Field Sales** (`/field/mes-paies` existante étendue) : voir SES paiements commission

Realtime sur `payroll_payments` pour synchro instantanée tous portails.

### 5. Email & PDF
- Template `payment_notification_v2` (utilise customQueueTemplates.ts existant)
- PDF "Avis de Paiement" avec branding Nivra (template officiel)
- Pièces jointes : Avis PDF + Talon de paie PDF
- Tracking ouverture email

## Détails techniques

### Fichiers à créer
- `supabase/migrations/...` — nouvelles tables
- `supabase/functions/payroll-payments/index.ts` — edge function
- `supabase/functions/_shared/pdf/avisPaiementTemplate.ts` — refonte PDF
- `src/core-app/pages/hr/HrPaymentsPage.tsx` — page dédiée
- `src/core-app/components/payroll/PaymentDashboard.tsx`
- `src/core-app/components/payroll/PaymentTable.tsx`
- `src/core-app/components/payroll/PaymentDetailDrawer.tsx`
- `src/core-app/components/payroll/PaymentTimeline.tsx`
- `src/core-app/components/payroll/MarkSentDialog.tsx`
- `src/core-app/components/payroll/ConfirmPaymentDialog.tsx`
- `src/core-app/components/payroll/BulkActionsBar.tsx`
- `src/hr-app/pages/HrPayments.tsx` — miroir RH
- `src/employee-app/pages/EmployeeMyPayments.tsx` — vue employé
- `src/core-app/hooks/usePayrollPayments.ts` — hook avec realtime

### Routes à ajouter
- Sidebar Core HR : ajouter "Paiements" sous "Paie"
- Sidebar RH : ajouter "Paiements"
- Sidebar Employé : ajouter "Mes paiements"

### Statuts (12 statuts au lieu de 2)
draft → scheduled → pending_approval → approved → processing → sent → confirmed
Branches d'erreur : failed, bounced, cancelled, reversed, disputed, on_hold

## Ce qui reste inchangé
- Calcul des déductions (process-payroll continue de calculer)
- Génération talon de paie existante
- Système email queue existant

Confirmation pour procéder?
