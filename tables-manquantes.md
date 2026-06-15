# TABLES MANQUANTES — ABSENT DU NOUVEAU PROJET
**Date :** 2026-06-15  
**Source CSV :** `exports_nivra_extracted/exports/` (exporté 2026-06-13)  
**Nouveau projet :** `lacxnbjvcyvhrttprkxr`

Ces 83 tables existent dans les CSV de l'ancien projet mais n'ont **aucune table correspondante** dans le nouveau projet.

---

## CATÉGORIE A — DONNÉES MÉTIER CRITIQUES (lignes > 0, schéma connu)

### 1. `email_templates` — 82 lignes
**Schéma trouvé dans :** `20260114171231_*.sql`
```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
**Impact métier :** CRITIQUE. Tous les emails transactionnels (bienvenue, factures, notifications) utilisent ces templates. Sans cette table, le système d'email est aveugle — il ne peut pas charger de contenu de template personnalisé.

---

### 2. `email_trigger_queue` — 704 lignes
**Schéma trouvé dans :** `20260114172150_*.sql`
```sql
CREATE TABLE email_trigger_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  template_slug TEXT,
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error TEXT
);
```
**Impact métier :** ÉLEVÉ. File d'attente de 704 emails non traités ou en attente. Ces emails pourraient inclure des notifications critiques à des clients actifs.

---

### 3. `client_internal_notes` — 353 lignes
**Schéma trouvé dans :** `20260102214807_*.sql`
```sql
CREATE TABLE client_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL DEFAULT 'general',
  body TEXT NOT NULL,
  created_by_user_id UUID REFERENCES auth.users(id),
  created_by_role TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
**Impact métier :** ÉLEVÉ. 353 notes internes sur les clients (historique d'appels, remarques agents, problèmes connus). Ces données sont invisibles dans Nivra Core — toute la mémoire contextuelle des clients est perdue.

---

### 4. `staff_schedules` — 61 lignes
**Schéma trouvé dans :** `20260328211259_*.sql`
```sql
CREATE TABLE staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE,
  effective_until DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
**Impact métier :** MOYEN. Horaires des 61 créneaux d'employés perdus. Le module RH ne peut pas afficher les plannings.

---

### 5. `partner_program_terms` — 108 lignes
**Schéma trouvé dans :** `20260117221751_*.sql`
```sql
CREATE TABLE partner_program_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
**Impact métier :** MOYEN. 108 versions des conditions du programme partenaire/influenceur. Les influenceurs ne peuvent pas voir ou accepter les conditions.

---

### 6. `stripe_plan_mapping` — 32 lignes
**Schéma trouvé dans :** `20260320221559_*.sql`
```sql
CREATE TABLE stripe_plan_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id),
  stripe_product_id TEXT,
  stripe_price_id TEXT UNIQUE,
  interval TEXT DEFAULT 'month',
  amount INTEGER,
  currency TEXT DEFAULT 'CAD',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
**Impact métier :** ÉLEVÉ. 32 correspondances entre les services Nivra et les prix Stripe. Sans cette table, le billing automatique Stripe ne peut pas trouver le bon price_id à facturer.

---

### 7. `security_events` — 108 lignes
**Schéma trouvé dans :** `20260111201555_*.sql`
```sql
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  severity TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT now()
);
```
**Impact métier :** MOYEN. 108 événements de sécurité (tentatives de connexion suspectes, blocages). Perte d'historique d'audit de sécurité.

---

### 8. `identity_verification_events` — 63 lignes
**Schéma trouvé dans :** `20260303192308_*.sql`
```sql
CREATE TABLE identity_verification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES identity_verification_sessions(id),
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES auth.users(id),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```
**Impact métier :** MOYEN. 63 événements de vérification d'identité. Perd l'audit trail des vérifications KYC.

---

### 9. `payroll_entries` — 6 lignes
**Schéma trouvé dans :** `20260328211259_*.sql`
```sql
CREATE TABLE payroll_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_period_id UUID NOT NULL REFERENCES pay_periods(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  base_salary NUMERIC(12,2),
  commission_total NUMERIC(12,2),
  gross_pay NUMERIC(12,2),
  net_pay NUMERIC(12,2),
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
**Impact métier :** ÉLEVÉ. 6 entrées de paie des employés. Le module paie du hub interne est cassé.

---

### 10. `payroll_payment_events` — 25 lignes
```sql
-- Schéma partiellement reconstitué depuis les références dans migrations
CREATE TABLE payroll_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_payment_id UUID REFERENCES payroll_payments(id),
  event_type TEXT NOT NULL,
  amount NUMERIC(12,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```
**Impact métier :** MOYEN. Historique des événements de paiement de paie.

---

### 11. `payroll_payments` — 5 lignes
```sql
CREATE TABLE payroll_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID,
  user_id UUID REFERENCES auth.users(id),
  amount NUMERIC(12,2),
  payment_method TEXT,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
**Impact métier :** ÉLEVÉ. 5 paiements de paie effectués. Perte de traçabilité financière.

---

### 12. `staff_roles` — 2 lignes
**Schéma trouvé dans :** `20260117035101_*.sql`
```sql
CREATE TABLE staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role staff_role NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
**Impact métier :** CRITIQUE. Sans cette table, le module de gestion des rôles du staff est cassé. Note: `user_roles` existe en parallèle avec 708 lignes et sert probablement le même rôle.

---

### 13. `hr_audit_log` — 36 lignes
**Schéma trouvé dans :** `20260328223945_*.sql`
```sql
CREATE TABLE hr_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  target_user_id UUID REFERENCES auth.users(id),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
```
**Impact métier :** MOYEN. 36 actions RH auditées perdues.

---

### 14. `operational_fees` — 11 lignes
**Schéma trouvé dans :** `20260315034838_*.sql`
```sql
CREATE TABLE operational_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  applies_to TEXT,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE,
  effective_until DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
**Impact métier :** ÉLEVÉ. 11 frais opérationnels configurés (frais d'installation, frais de connexion, etc.). Sans cette table, les frais ne peuvent pas être calculés correctement.

---

### 15. `sop_documents` — 66 lignes
**Schéma :** NON TROUVÉ dans les migrations Lovable
```sql
-- Schéma inconnu — reconstruit depuis le nom de la table
-- Contient probablement: id, title, category, content/file_path, is_active, created_at
```
**Impact métier :** MOYEN. 66 documents de procédures opérationnelles (SOPs). Le hub interne perd l'accès aux procédures opérationnelles.

---

### 16. `automatic_email_dispatches` — 189 lignes
```sql
-- Schéma non trouvé dans migrations
CREATE TABLE automatic_email_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- probablement: trigger_type, recipient_id, email_template_id, sent_at, status
);
```
**Impact métier :** MOYEN. 189 envois automatiques enregistrés.

---

## CATÉGORIE B — DONNÉES AVEC CONTENU (lignes > 0, schéma inconnu ou partiellement connu)

| Table | Lignes | Schéma | Impact |
|---|---|---|---|
| `kyc_verifications` | 12 | Partiellement connu | ÉLEVÉ — Vérifications KYC des clients |
| `payroll_runs` | 3 | Partiellement connu | ÉLEVÉ — Runs de paie historiques |
| `streaming_catalog` | 6 | Inconnu | MOYEN — Catalogue de streaming |
| `admin_users` | 2 | Inconnu | CRITIQUE — Comptes admin de l'ancien projet |
| `employee_payroll_settings` | 9 | Partiellement connu | MOYEN — Paramètres de paie des employés |
| `employment_letters` | 8 | Inconnu | MOYEN — Lettres d'emploi générées |
| `onboarding_sequences` | 5 | Inconnu | MOYEN — Séquences d'onboarding |
| `hub_certificates` | 3 | Inconnu | FAIBLE — Certificats du hub |
| `hub_training_progress` | 3 | Inconnu | FAIBLE — Progression formation hub |
| `client_profile_changes` | 8 | Inconnu | MOYEN — Historique des changements de profil |
| `client_testimonials` | 6 | Inconnu | FAIBLE — Témoignages clients |
| `loyalty_redemptions` | 1 | Inconnu | FAIBLE — Échanges de points fidélité |
| `pdf_generation_logs` | 40 | Inconnu | FAIBLE — Logs de génération PDF |
| `notification_outbox` | 5 | Inconnu | MOYEN — Notifications en attente |
| `commission_rules` | 9 | Inconnu | ÉLEVÉ — Règles de commission |
| `admin_audit_sessions` | 4 | Inconnu | MOYEN — Sessions d'audit admin |
| `commission_disputes` | 1 | Inconnu | MOYEN — Litiges de commission |
| `ledger_invoice_allocations` | 5 | Inconnu | MOYEN — Allocations de factures au ledger |
| `admin_notification_logs` | 15 | Inconnu | FAIBLE — Logs de notifications admin |
| `admin_notification_settings` | 14 | Inconnu | MOYEN — Paramètres de notification admin |
| `admin_security_audit` | 107 | Inconnu | MOYEN — Audit de sécurité admin |
| `email_automation_rules` | 3 | Inconnu | ÉLEVÉ — Règles d'automatisation email |
| `pay_periods` | 6 | Partiellement connu | ÉLEVÉ — Périodes de paie |
| `pay_adjustments` | 0 | Partiellement connu | MOYEN — Ajustements de paie |
| `field_bonus_rules` | 4 | Inconnu | MOYEN — Règles de bonus terrain |
| `hr_requests` | 1 | Inconnu | MOYEN — Demandes RH |
| `tax_brackets_federal` | 5 | Inconnu | ÉLEVÉ — Tranches d'imposition fédérale |
| `tax_brackets_quebec` | 4 | ÉLEVÉ — Tranches d'imposition Québec |
| `sms_queue` | 16 | Inconnu | MOYEN — File d'attente SMS |
| `time_entries` | 8 | Inconnu | MOYEN — Entrées de temps |
| `identity_documents` | 0 | Inconnu | MOYEN — Documents d'identité |
| `payment_gateway_settings` | 1 | Inconnu | CRITIQUE — Configuration passerelle paiement |
| `staff_email_allowlist` | 2 | Inconnu | MOYEN — Liste blanche emails staff |
| `rate_limits` | 1 | Inconnu | FAIBLE — Config rate limiting |

---

## CATÉGORIE C — TABLES VIDES (0 lignes, non prioritaires)

Ces tables étaient présentes dans l'ancien projet mais n'ont aucune donnée à récupérer :

| Table | Lignes | Note |
|---|---|---|
| account_access_logs | 0 | Logs d'accès vides |
| account_deletion_requests | 0 | Aucune demande de suppression |
| admin_access_limits | 1 | 1 règle de limite d'accès |
| client_email_preferences | 0 | Préférences email vides |
| client_notification_logs | 0 | Logs notifs vides |
| client_referral_events | 0 | Événements référral vides |
| commission_grid_assignments | 0 | Grilles de commission vides |
| contest_entries | 0 | Concours vides |
| contest_winners | 0 | Gagnants vides |
| crypto_ipn_logs | 0 | Logs IPN crypto vides |
| crypto_payments | 0 | Paiements crypto vides |
| customer_portal_projection_audit_logs | 0 | Logs audit projection vides |
| customer_portal_repair_jobs | 0 | Jobs de réparation portail vides |
| data_retention_log | 0 | Logs rétention vides |
| email_campaigns | 0 | Campagnes email vides |
| email_change_requests | 0 | Demandes changement email vides |
| email_events | 0 | Événements email vides |
| email_sends | 0 | Envois email vides |
| field_sales_cashout_requests | 0 | Demandes cashout ventes terrain vides |
| field_sales_commission_rules | 0 | Règles commission terrain vides |
| hr_documents | 0 | Documents RH vides |
| hr_request_notes | 0 | Notes demandes RH vides |
| hub_faq_votes | 0 | Votes FAQ hub vides |
| installation_job_logs | 0 | Logs jobs installation vides |
| installation_jobs | 0 | Jobs installation vides |
| kyc_requested_documents | 0 | Documents KYC demandés vides |
| nps_surveys | 0 | Sondages NPS vides |
| order_identity_data | 0 | Données identité commandes vides |
| payroll_adjustments | 0 | Ajustements paie vides |
| payroll_commission_links | 0 | Liens commissions paie vides |
| payment_requests | 0 | Demandes paiement vides |
| streaming_catalog_audit_logs | 0 | Logs audit catalogue streaming vides |
| technician_locations | 0 | Localisations techniciens vides |
| ticket_attachments | 0 | Pièces jointes tickets vides |
| ticket_participants | 0 | Participants tickets vides |
| timesheet_entries | 1 | 1 entrée de feuille de temps |
| client_billing_settings | 0 | Paramètres facturation client vides |

---

## RÉSUMÉ PAR PRIORITÉ DE RECRÉATION

| Priorité | Table | Lignes | Raison |
|---|---|---|---|
| 🔴 P1 | `email_templates` | 82 | Emails système cassés |
| 🔴 P1 | `stripe_plan_mapping` | 32 | Billing Stripe cassé |
| 🔴 P1 | `payment_gateway_settings` | 1 | Configuration paiement perdue |
| 🔴 P1 | `email_trigger_queue` | 704 | 704 emails en attente |
| 🔴 P1 | `client_internal_notes` | 353 | Mémoire contextuelle clients perdue |
| 🔴 P1 | `operational_fees` | 11 | Frais de service non configurés |
| 🔴 P1 | `commission_rules` | 9 | Règles de commission absentes |
| 🟠 P2 | `staff_schedules` | 61 | Module RH incomplet |
| 🟠 P2 | `kyc_verifications` | 12 | Vérifications KYC perdues |
| 🟠 P2 | `payroll_entries` | 6 | Module paie cassé |
| 🟠 P2 | `payroll_payments` | 5 | Traçabilité financière perdue |
| 🟠 P2 | `pay_periods` | 6 | Périodes de paie perdues |
| 🟠 P2 | `tax_brackets_federal` | 5 | Calcul impôt fédéral impossible |
| 🟠 P2 | `tax_brackets_quebec` | 4 | Calcul impôt Québec impossible |
| 🟠 P2 | `partner_program_terms` | 108 | Programme influenceur cassé |
| 🟡 P3 | `sop_documents` | 66 | SOPs internes perdus |
| 🟡 P3 | `security_events` | 108 | Audit sécurité incomplet |
| 🟡 P3 | `identity_verification_events` | 63 | Audit KYC incomplet |
| 🟡 P3 | `automatic_email_dispatches` | 189 | Historique envois automatiques |
| 🟡 P3 | `hr_audit_log` | 36 | Audit RH incomplet |
| 🟡 P3 | `admin_security_audit` | 107 | Audit sécurité admin incomplet |
