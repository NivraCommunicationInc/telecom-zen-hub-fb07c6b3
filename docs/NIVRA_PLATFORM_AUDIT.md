# NIVRA TELECOM — AUDIT TECHNIQUE COMPLET DE LA PLATEFORME

> Documentation exhaustive du système Nivra Tech. Destinée à être ingérée par une IA tierce (ChatGPT, Gemini, Claude) ou remise à une équipe de développement pour comprendre, maintenir et faire évoluer la plateforme.
>
> **Date de génération** : 2026-07-14
> **Périmètre** : monorepo React/Vite + backend Lovable Cloud (Supabase managé) + 396 Edge Functions Deno + 1 287 migrations SQL + ~430 tables `public` + 39 tâches `pg_cron`.
> **Statut global** : production active pour la ligne client B2C (Internet, TV, Mobile prépayé Québec).

---

## 0. Résumé exécutif

Nivra Telecom est un **opérateur télécom québécois** offrant Internet, TV, Mobile prépayé, SIM & recharges, principalement en B2C. La plateforme est une **application unique React/Vite** (SPA) qui contient plusieurs sous-portails isolés par route et par rôle, plus un backend serverless Supabase (Postgres + Edge Functions Deno + Storage + Auth + pg_cron + pgmq).

Cinq sous-portails coexistent dans le même bundle :
- **Site public** (`/`, `/forfaits`, `/support`, ...)
- **Portail Client** (`/client/*`, `/account/*`)
- **Nivra Core** — admin interne (`/nivra-secure-hub-2617-internal/*`, `/core/*`)
- **Employee OneView** (`/employee/*`)
- **RH** (`/hr/*` / `/rh/*`)
- **Field Sales** (`/field/*`)
- **Technician** (`/tech/*`)
- **Marketing** (`/marketing/*`)

Le principe d'architecture directeur : **Nivra Core (RPC + Edge Functions) est la seule source de vérité**. Aucun calcul de prix/taxe/statut ne doit exister côté front. Toutes les mutations sensibles passent par des **"single-door" Edge Functions** protégées par des triggers Postgres qui bloquent les inserts/updates directs (invariants "SINGLE-DOOR").

---

## 1. Architecture générale

### 1.1 Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 18 + Vite 5 + TypeScript 5, TailwindCSS v3, shadcn/ui, TanStack Query, React Router v6 |
| Design system | Tokens sémantiques dans `src/index.css` + `tailwind.config.ts` + `src/styles/design-tokens.css` |
| PWA | Service worker `public/sw.js` + `public/push-sw.js`, install prompt, notification prompt |
| Backend | Supabase managé (Lovable Cloud) — Postgres 15, PostgREST, Auth, Storage, Realtime |
| Fonctions serverless | Deno Edge Functions (396 fonctions) |
| Files d'attente | `pgmq` (Postgres Message Queue) : `auth_emails`, `transactional_emails` |
| Scheduling | `pg_cron` (39 jobs) + `pg_net` pour HTTP sortant |
| Paiement | **Square** (SEUL processeur actif — Phase 3.B). PayPal décommissionné (410 stubs + triggers DB bloquants) |
| Email | Domaine dédié Lovable + Resend en fallback + templates dans `supabase/functions/_shared/emailTemplates/` |
| SMS | OpenPhone (webhook + envoi) |
| Cartographie | Mapbox (autocomplétion adresses + suivi technicien) |
| Suivi colis | Ship24 (webhook `shipping-tracking-webhook`) |
| Vocal / STT-TTS | ElevenLabs (`elevenlabs-tts`, `elevenlabs-stt-token`, `interview-tts`, `interview-transcribe`) |
| Chatbot IA | LLM via Lovable AI Gateway (`core-ai-converse`, `chatbot-jonathan`, `nova-*`, `agent-*`) |

### 1.2 Structure du monorepo

```
src/
├── App.tsx                 Root — QueryClient, LanguageProvider, LockdownGuard, AppModeGate, routes
├── components/
│   ├── AppRoutes.tsx       532 <Route> — routing unifié
│   ├── chatbot/            NivraChat (public)
│   ├── pwa/                AppModeGate, InstallPrompt, NotificationPrompt, SWUpdateHandler
│   └── ...                 Header, Footer, Hero, PublicLayout, LockdownGuard, MaintenanceGuard
├── pages/                  Pages publiques + /admin + /client
│   ├── admin/              77 pages Admin/Core (legacy, en cours de migration vers /core-app)
│   └── client/             40 pages du portail Client
├── core-app/               Nivra Core moderne (128 pages)
│   ├── main.tsx            Point d'entrée alternatif (build via vite.config.core.ts)
│   ├── pages/              CoreDashboard, CoreClientProfile, CoreBillingPage, ...
│   ├── components/         CoreLayout, CoreSidebar, ClientNotesDrawer, ...
│   ├── lib/callCoreAction  Gateway vers Edge Function `core-account-actions`
│   └── hooks/
├── employee-app/           OneView agents support (28 pages)
├── hr-app/                 Portail RH (13 pages)
├── field-app/              Ventes terrain (28 pages)
├── tech-app/               Portail technicien (18 pages) — thème "High-Vis Amber"
├── marketing-app/          Portail marketing outbound
├── shared-crm/             Composants et hooks CRM partagés (Field/Employee/Core)
├── shared-ops/             Actions & hooks partagés (paiements, ordres, tickets, ...)
├── shared-training/        Modules formation + CertificationGate
├── integrations/
│   ├── backend/            client, adminClient, portalClient (Supabase wrappers)
│   └── supabase/           client.ts (ré-export) + types générés (auto)
├── contexts/               LanguageContext (i18n custom, non react-i18next)
├── lib/constants/roles.ts  Rôles + USER_ROLE_LABELS
├── config/                 features, seo, company, navigation, partnerContact
└── styles/                 design-tokens, internal-portal, nivra-design, tech-portal, field-portal

supabase/
├── config.toml             Config `verify_jwt` par fonction
├── migrations/             1287 fichiers .sql (source de vérité DB)
└── functions/              396 Edge Functions Deno
    ├── _shared/            Utilitaires (pdf, email, resend, sms, security, tax, ...)
    ├── _tests/             Tests Deno d'idempotence
    └── <function>/index.ts
```

### 1.3 Bootstrapping & Guards

`src/App.tsx` monte l'arbre suivant :

```
QueryClientProvider
└── LanguageProvider (i18n FR/EN maison)
    └── TooltipProvider + Toaster + Sonner
        └── BrowserRouter
            └── LockdownGuard        (bloque tout le site si lockdown activé — verify-lockdown-password)
                └── AppModeGate      (attend la détection PWA/mode avant de rendre l'app)
                    ├── AppRoutes
                    └── ChatWidgetGate → NivraChat  (public seulement, exclu de /core /client /tech …)
            + InstallPrompt + NotificationPrompt + SWUpdateHandler + CookieConsent
```

### 1.4 Cycle de requête typique

```
UI (React) ─► TanStack Query
              ├─► supabase.from(...).select() [lecture directe RLS]
              └─► supabase.functions.invoke("<edge-function>", { body })
                       │
                       ▼
                 Deno Edge Function (Auth JWT ou service_role)
                       │
                       ├─► SQL RPC (fn_*, has_role, apply_payment_to_invoice, ...)
                       ├─► Triggers "single-door" valident/normalisent
                       ├─► Enqueue message dans pgmq (auth_emails / transactional_emails)
                       └─► Retour JSON typé { ok, ...payload }
```

### 1.5 Événements & files

- **pgmq queues** : `auth_emails` (prioritaire), `transactional_emails` (TTL 60 min).
- **Cron drain** : `email-queue-drain` (`* * * * *`) et `sms-queue-drain` (`* * * * *`).
- **Wake trigger** : à chaque `enqueue_email` un trigger réveille pg_cron.
- **Outbox** : `notification_outbox` drainée par `process-notification-outbox` (chaque minute).
- **DLQ** : après 5 échecs → `dlq_*`, log dans `email_send_log`.
- **Idempotence** : tables `*_idempotency` (payments, notes, journal, communication, security, escalation, fraud, document, transfer, ...).

---

## 2. Applications (par portail)

### 2.1 Site public (`/`)
- **Objectif** : conversion visiteurs → clients. SEO Québec.
- **Pages clés** : `Index`, `Forfaits`, `InternetPlans`, `TVPlans`, `MobilePlans`, `PhoneCatalog`, `PhoneDetail`, `PhoneCheckout`, `GuestCheckout`, `QuoteCheckout`, `PublicQuote`, `SignContract`, `TrackOrder`, `CoverageMap`, `Support`, `Contact`, `Careers`, `JobApplication`, `Contest`, `Parrainage`, `PolitiqueConfidentialite`, `TermsOfUse`, `NPSSurvey`, `VerifierNumero`, `TestVitesse`, `StatusPage`.
- **Composants** : `Header`, `Footer`, `Hero`, `HomePricing`, `HomeStatusBanner`, `ReferralProgram`, `NetworkTrust`, `NivraChat`, `CookieConsent`, `MaintenanceGuard`, `LocalBusinessSchema`.
- **Sécurité** : anonyme (RLS `anon`), `submit-contact-form` et `submit-web-form` sans JWT.
- **Checkout** : `GuestCheckout.tsx` → `billing-create-order` → `square-create-customer` + `square-charge-invoice`.

### 2.2 Portail Client (`/client/*`, `/account/*`)
- **Objectif** : self-service abonnement, facturation, équipement, support.
- **Auth** : email/mot de passe + Google, PIN via `client-pin-send`/`verify`, reset via `client-password-reset-send`, guarde `ClientAccessBlocked`.
- **Pages (40)** : Dashboard, Services, Invoices, MonthlyInvoices, Payments, PaymentMethod, AutoPayStatus, AutoPayLog, BillingHub, ChangePlan, Cancellations, Channels, Contracts, Equipment, EquipmentReplacement, Documents/DocumentUpload, Guides, IdentityVerification, Loyalty, NewOrder, PhoneOrders, PortIn, Referrals, RescheduleAppointment, ServiceAddresses, Tickets, UsageHistory, WebForms, VerifyEmail, Activation, OrderConfirmation, Suspended, PaymentReturn.
- **Workflows** : reset password, port-in, changement de plan (prorata immédiat), remplacement d'équipement (RMA), demande de rendez-vous, ouverture de ticket.

### 2.3 Nivra Core — Admin interne
Deux implémentations coexistent : legacy `src/pages/admin/*` (77 pages) et moderne `src/core-app/*` (128 pages). Cible de convergence : `core-app`.

- **Auth** : rôles `admin`, `employee`, `supervisor`, `billing_admin`, `kyc_agent`, `techops`, `support`, `sales` (voir `src/lib/constants/roles.ts`).
- **Gate** : `AdminLogin`, MFA staff (`staff-otp-send`/`verify`), `staff-verify-pin`, `admin_otp_*`, `admin_audit_sessions`.
- **Modules majeurs (extrait)** : Dashboard, Clients (Client 360), Accounts, Orders, Invoices, Payments, Subscriptions, Contracts, POS, Cancellations, ContestedInvoices, ContestedPayments, Recouvrement, PaymentDisputes, Technicians, Installations, Appointments, Coverage, Equipment, Channels, Streaming/Catalog, Promotions, ReferralCodes/Attributions/Cashouts/Commissions, Marketing, EmailActivity/Deliverability, InternalTickets, Tickets, KYCVerifications, IdentityVerification, Employees, HubManagement, SecurityEvents/Guardian, SystemAudit/Health, Telephony, WebForms, WorkQueue, QA/QABlockStatus, PDFTemplatesV2, ReplacementWorkflow, Site, Services.
- **Client 360** : `CoreClientProfile.tsx` — 51 modules audités (voir `.lovable/c360/*`) : Identité, Accès en ligne, Adresses, Services, Facturation, Auto-pay, Paiements manuels, Ajustements, Remboursements, Suspension, Annulation, Réactivation, Notes internes, Timeline, Communications, Documents, Contrats, Rendez-vous, KYC, VIP/Churn, TV, Internet, Mobile, Streaming, Loyalty, Referrals, Fraud, etc.

### 2.4 Employee OneView (`/employee/*`)
- **Objectif** : agents support/billing, une vue par ticket/appel.
- **Pages (28)** : Dashboard, WorkQueue, Clients/ClientDetail, Accounts/AccountDetail, Orders/OrderDetail, Invoices/InvoiceDetail, Payments, Quotes/QuoteDetail, Subscriptions/SubscriptionDetail, Appointments/AppointmentDetail, Activations, Complaints, InternetTickets, Support/SupportDetail, KYC, Equipment, Crm, Academy, Audit, Security, EmailCompose, CreateOrder, CreateQuote, Profile.
- **PIN client** : `employee-verify-customer-pin` avant accès données sensibles.

### 2.5 RH (`/hr/*`)
- **Objectif** : employés — paie, congés, objectifs, documents fiscaux, badge.
- **Pages (13)** : Dashboard, Payslips, Payments, Commissions, Schedule, Requests, Objectives, Documents, EmploymentLetters, TaxDocuments, Notifications, Badge, Profile.
- **Tables** : `employees`, `employee_records`, `employee_payroll_settings`, `pay_periods`, `payroll_runs`/`entries`/`payments`, `payroll_commission_links`, `hr_requests`/`request_notes`, `hr_documents`, `employment_letters`, `tax_documents`, `employee_leave_requests`, `employee_shifts`, `attendance_records`, `time_entries`, `employee_objectives`.

### 2.6 Field Sales (`/field/*`)
- **Objectif** : vendeurs terrain, prise de commandes hors-ligne friendly.
- **Pages (28)** : Dashboard, NewSale (multi-step), NewLead, Leads/LeadDetail, Clients/ClientLookup, Orders/OrderDetail, Submissions, Crm, Territory, Objectives, Performance, Offers, Commissions, MyPay, Notifications, Complaints, DailyReport, Procedures, Tracking, Training, Resources, Badge, Security, Profile, SaleSuccess.
- **Flux commande** : draft persistant (idempotence par `draft.id`) → `field-sales-sync` (Edge) → matérialise commande + facture + paiement → confirmation email/PDF.

### 2.7 Technician (`/tech/*`) — thème "High-Vis Amber"
- **Objectif** : techniciens sur site — installations, stock camion, GPS, chat dispatch.
- **Pages (18)** : Dashboard, Assignments, Appointments, Active, Installation, WorkOrder, Client360, Schedule, Map, Stock, Scanner, Chat, Tickets, Menu (hub), Training, Performance, Vehicle, Profile.
- **Composants clés** : `TechAppLayout`, `TechTopBar`, `TechBottomNav`, `TechHeader`, `TechMiniMap`, `SignaturePad`, `PhotoCapture`, `QRScanner`, `OfflineIndicator`.
- **Statuts d'installation** : `assigned` → `accepted` → `en_route` → `arrived` → `in_progress` → `completed`/`no_show`/`cancelled` — email client à chaque transition via `queue_tech_status_email` (WiFi SSID/password inclus à `completed`).

### 2.8 Marketing (`/marketing/*`)
- **Objectif** : campagnes email/SMS ciblées via Resend.
- **Tables** : `mkt_audiences`, `mkt_campaigns`, `mkt_templates`, `mkt_send_log`, `mkt_webhook_events`, `mkt_contacts_custom`, `mkt_contacts_imports`, `marketing_campaigns`, `email_campaigns`, `sms_campaigns`.
- **Edge Functions** : `marketing-send`, `marketing-send-sms`, `send-marketing-email`, `marketing-resend-webhook`, `marketing-stats`.

---

## 3. Modules Nivra Core (Client 360)

Voir `.lovable/c360/module*.md`. Extrait exhaustif :

| # | Module | Rôle | Statut |
|---|---|---|---|
| 1 | Identité (M50 gateway) | Fusionner nom, DOB, langue, contact | ✅ Verrouillé (Identity Gateway) |
| 2 | Accès en ligne | Reset password, tokens temporaires, `must_change_password` | ✅ (client-account-admin) |
| 3 | VIP / Churn Risk | Score de risque, tag VIP, `account_risk_scores` | ✅ |
| 4 | Pause temporaire | Suspension programmée, `pause-auto-resume-hourly` | ✅ |
| 5 | Annulation compte | Workflow annulation, `cancel-account` | ✅ |
| 6 | Réactivation | Réactive un compte suspendu/annulé | ✅ |
| 7 | Enregistrer paiement | Paiement manuel (cash/interac/chèque) | ✅ (single-door `record-payment`) |
| 8 | Remboursement | Refund complet/partiel, Square API | ✅ |
| 9 | Ajustements | Crédits/débits manuels, `account_adjustments` | ✅ (interdit "refund_as_adjustment") |
| 10 | Plan de paiement | `client_payment_plans` échelonnement | ✅ |
| 11 | Auto-pay | Square card on file, `client_autopay_settings` | ✅ |
| 12 | Collections / Dispute | Escalade recouvrement, chargeback | ✅ |
| 14 | Service TV | Grille canaux, packs, terminaux | ✅ |
| 24 | Accès en ligne (bis) | Journal accès, `client_access_logs` | ✅ |
| 26 | Annulation compte | Version étendue | ✅ |
| 27 | VIP Churn Risk | Alertes automatiques | ✅ |
| 28 | Service Internet | Modem, WiFi, IP statique, diagnostics | ✅ |
| 35 | Support Tickets | Single-door `callSupportAction` | ✅ (INVARIANT-TICKET-SINGLE-DOOR) |
| 40 | Facturation sectionnée 3B | Facture consolidée par compte | ✅ |
| 47 | Adresses (multi) | `service_addresses` canonique | ✅ (multi-address 3A) |
| 50 | Identity Gateway | Champs d'identité verrouillés (`trg_lock_identity_fields`) | ✅ |
| 51 | Timeline Gateway | Événements agrégés | ✅ |
| 52 | Profile edit gateway | Change name/email/phone via edge | ✅ |
| 53 | Audit Service Management | Lecture seule audit services | ✅ (Phase A) |
| 54 | Subscription single source | `billing_subscriptions` seule source | ✅ (writer allowlist actif) |
| 54.2 | Invariants abonnement | Trace audit + guards | ✅ |

Modules complémentaires : Notes internes (drawer), Communications (email/SMS/appel), Documents (auto + upload), Contrats (signature), KYC, Fraud, Loyalty, Referrals, Streaming, Mobile, Phone Orders, Port-in, RMA.

---

## 4. Base de données

### 4.1 Vue macro
- ~430 tables `public` (voir liste complète dans le contexte système).
- 1 287 migrations.
- RLS activé sur quasi tout `public`. Deux tables `trip_requests` et `trips` marquées "RLS off" (legacy, à isoler).
- Extensions actives : `pgcrypto`, `pg_cron`, `pg_net`, `pgmq`, `pgjwt`, `uuid-ossp`.

### 4.2 Domaines de tables

**Identité & comptes**
`profiles` (93 col), `accounts` (45 col, verrouillée), `user_roles` (32 col — jamais rôle sur profile), `authorized_users`, `admin_users`, `employee_records`, `technicians`, `customer_security`, `client_login_pins`, `staff_otp_codes`, `admin_otp_codes`.

**Facturation (single source)**
`billing_customers`, `billing_subscriptions` (48 col — source de vérité), `billing_subscription_services`, `billing_invoices` (40 col), `billing_invoice_lines`, `billing_payments` (35 col), `billing_provenance`, `billing_subscription_trace_audit`, `billing_subscription_writer_allowlist`, `billing_automation_runs`, `billing_system_alerts`. Legacy figée : `billing`, `payments`, `subscriptions`, `monthly_invoices`, `monthly_invoice_lines`.

**Ordres**
`orders` (134 col — grosse table, immuable dans certains champs), `order_items`, `order_events`, `order_status_history`, `order_snapshots`, `order_documents`, `order_internal_notes`, `order_identity_data`, `order_automation_log`, `field_sales_orders`, `field_order_*`, `checkout_sessions`, `checkout_consent_records`.

**Paiements & disputes**
`billing_payments`, `card_payment_intents`, `field_payment_intents`, `square_payment_attempts`, `paypal_autopay_attempts` (gelée), `payment_methods`, `payment_disputes`, `payment_proofs`, `payment_requests`, `crypto_payments`, `crypto_ipn_logs`, `employee_recorded_payments`.

**Ledger & journal**
`ledger_entries`, `ledger_invoice_allocations`, `account_journal_*`, `account_adjustments`, `account_promotions`, `promotions`, `promotion_redemptions`, `agent_discounts`, `field_agent_discounts`.

**Adresses & couverture**
`service_addresses` (30 col — canonique), `account_service_locations` (verrouillée depuis 3A), `service_address_history`, `service_location_history`, `coverage_zones`, `service_coverage_areas`, `address_serviceability_checks`, `coverage_waitlist`.

**Provisioning & équipement**
`services`, `service_instances`, `service_status`, `provisioning_jobs`, `installations`, `installation_jobs`, `installation_appointments`, `installation_steps_template`, `installation_job_logs`, `equipment_inventory`, `equipment_order_lines`, `equipment_return_requests`, `equipment_audit_log`, `inventory_items`, `inventory_stock`, `inventory_assignments`, `phone_inventory`, `phone_orders`, `mobile_addons`, `mobile_fulfillment`, `mobile_topups`, `sim_actions`.

**Réseau & internet/TV/mobile**
`internet_diagnostics`, `internet_modem_actions`, `internet_plan_changes`, `internet_static_ip_assignments`, `internet_wifi_settings`, `tv_channels`, `tv_packs`, `tv_pack_channels`, `tv_addon_subscriptions`, `tv_parental_controls`, `tv_plan_changes`, `tv_terminal_actions`, `tv_vod_purchases`, `streaming_catalog`, `streaming_services`, `client_streaming_subscriptions`, `streaming_activation_tokens`.

**Support & communications**
`support_tickets` (44 col — single door), `ticket_replies`, `ticket_participants`, `ticket_attachments`, `ticket_state_transitions`, `internal_tickets`, `internal_ticket_replies`, `complaints`, `complaint_responses`, `complaint_attachments`, `contact_requests`, `direct_emails`, `direct_email_recipients`, `messages`, `live_chat_sessions`, `live_chat_messages`, `live_chat_admin_replies`.

**Email & SMS**
`email_queue`, `email_send_log`, `email_send_state`, `email_sends`, `email_events`, `email_templates`, `email_campaigns`, `email_change_requests`, `email_unsubscribes`, `email_unsubscribe_tokens`, `email_trigger_queue`, `email_automation_rules`, `suppressed_emails`, `sms_queue`, `sms_campaigns`, `notification_outbox`, `notifications`.

**Rendez-vous & terrain**
`appointments` (32 col — canonique), `appointment_slot_rules`, `appointment_slot_overrides`, `appointment_blocked_dates`, `technician_slots`, `technician_slot_bookings`, `technician_assignments`, `technician_locations`, `dispatch_reservations`, `installation_appointments`.

**RH & paie**
`employees`, `employee_records`, `employee_payroll_settings`, `pay_periods`, `payroll_runs`, `payroll_entries`, `payroll_payments`, `payroll_payment_events`, `payroll_commission_links`, `payroll_records`, `payroll_adjustments`, `pay_adjustments`, `hr_requests`, `hr_request_notes`, `hr_documents`, `hr_audit_log`, `employment_letters`, `tax_documents`, `employee_leave_requests`, `employee_shifts`, `attendance_records`, `time_entries`, `employee_objectives`, `employee_notifications`, `employee_notes`.

**Commissions & ventes**
`sales_commissions`, `sales_targets`, `commission_plans`, `commission_rules`, `commission_grid_assignments`, `commission_ledger_entries`, `commission_ledger_events`, `commission_disputes`, `commission_withdrawal_requests`, `field_commissions`, `field_commission_payouts`, `field_commission_payout_items`, `field_sales_cashout_requests`, `field_sales_commission_rules`.

**CRM & marketing**
`crm_contacts` (53 col), `crm_call_logs`, `crm_agent_status`, `crm_agent_quotas`, `crm_assignment_history`, `crm_territories`, `crm_scripts`, `field_leads`, `field_lead_activities`, `field_lead_tasks`, `mkt_*`, `marketing_*`, `campaign_sends`, `email_campaigns`, `sms_campaigns`.

**KYC, sécurité, audit**
`kyc_requests`, `kyc_requested_documents`, `kyc_verifications`, `identity_documents`, `identity_verification_sessions`, `identity_verification_events`, `admin_audit_log`, `admin_auth_audit_log`, `admin_security_audit`, `security_events`, `security_incidents`, `security_audit_log`, `security_action_logs`, `admin_secret_audit_log`, `staff_impersonation_sessions`, `impersonation_sessions`, `client_activity_logs`, `client_access_logs`, `activity_logs`, `activation_request_history`, `sync_audit_log`, `document_audit_log`, `communication_audit_log`, `employee_audit_logs`, `internal_audit_log`, `agent_audit_log`.

**Contrats & documents**
`contracts` (40 col), `client_auto_documents`, `client_documents`, `document_requests`, `pending_document_jobs`, `pdf_generation_logs`, `pdf_template_config`, `checkout_consent_records`, `consent_records`.

**Loyalty & referral**
`loyalty_points`, `loyalty_transactions`, `loyalty_rewards`, `loyalty_redemptions`, `referral_codes`, `referral_attributions`, `referral_settings_audit`, `referral_program_settings`, `client_referrals`, `client_referral_events`, `influencers`, `influencer_payouts`, `influencer_invites`, `influencer_audit_log`, `contest_entries`, `contest_winners`.

**Site & monitoring**
`site_pages`, `site_settings`, `site_offers`, `site_health_checks`, `system_status`, `service_incidents`, `analytics_reports`, `telecom_analytics`, `daily_backup_log`, `data_retention_log`, `cron_heartbeats`, `rate_limits`, `rate_limit_attempts`, `rate_limit_lockouts`.

### 4.3 Triggers "single-door" et invariants critiques

Extraits confirmés en base (`pg_trigger`) :

| Table | Trigger | Rôle |
|---|---|---|
| `account_adjustments` | `trg_forbid_paypal_adjustment`, `trg_forbid_refund_as_adjustment`, `trg_guard_compensation_writes`, `trg_enqueue_account_adjustment_email` | Bloquent PayPal & mauvais usages |
| `account_promotions` | `trg_forbid_refund_as_promotion`, `trg_forbid_paypal_promotion`, `trg_note_account_promotion` | Interdit PayPal / refund déguisé |
| `accounts` | `trg_lock_account_number`, `trg_protect_billing_anchor`, `trg_guard_account_billing_cycle`, `trg_enforce_account_number_format`, `trg_block_credit_class_update`, `trg_sync_profile_account_number`, `enforce_accounts_client_safe_update_trg`, `doc_*_on_account` | Immutabilité identité comptable + docs auto |
| `activation_requests` | `trg_activation_status_change`, `trg_send_activation_success_email`, `trg_guard_activation_consistency`, `trg_track_activation_status` | Cohérence lifecycle activation |
| `account_service_locations` | `trg_block_asl_insert`, `trg_log_svc_loc_history_*`, `trg_customer_portal_projection_account_service_locations` | Table gelée (canonique = `service_addresses`) |
| `appointments` | `trg_enqueue_appointment_email_upd`, `trigger_notify_appointment`, `trg_customer_portal_projection_appointments` | Email + projection portail |
| `billing_invoices` | `trg_00_block_orphan_invoice`, `trg_sync_billing_invoice_balance`, `trg_04_attach_subscription_to_paid_invoice`, `trg_05_invoice_math_from_subtotal`, `trg_lock_invoice_account_snapshot`, `trg_guard_billable_order_state_invoices` | Cohérence math + snapshot |
| `billing_payments` | `trg_sync_invoice_on_payment`, `trg_guard_billable_order_state_payments` | Sync amount_paid, blocage ordres pas confirmés |
| `orders` | `trg_guard_order_lifecycle_no_skip` | Interdit sauts intake→completed |
| `profiles` | `trg_lock_identity_fields` | Champs identité verrouillés |
| `user_roles` | policies + `has_role()` security definer | Anti-privilege escalation |

Fonctions SQL critiques : `has_role`, `apply_payment_to_invoice`, `compute_checkout_pricing`, `compute_invoice_breakdown`, `fn_canonicalize_order_client_identity`, `fn_normalize_order_installation_flags`, `fn_upsert_canonical_appointment_from_legacy`, `apply_active_account_promotions_to_invoice`, `get_available_installation_slots`, `get_account_service_tree`, `qa_purge_subscription`.

Voir aussi `SYSTEM_LOCK_REPORT.md` — 9 systèmes verrouillés + 3 suites de tests d'invariants (`system-lock-invariants`, `billing-financial-invariants`, `canonical-data-integrity`).

---

## 5. Synchronisations & flux de données

### 5.1 Flux principal Client → Activation

```
   PUBLIC / FIELD                    NIVRA CORE                        PROVISIONING
────────────────────────       ─────────────────────────       ─────────────────────────
GuestCheckout / FieldNewSale
        │
        ▼
 billing-create-order  ────►  compute_checkout_pricing (RPC, source de vérité)
        │                              │
        │                              ▼
        │                    INSERT orders (status=intake)
        │                              │
        │                              ▼
        │                    INSERT billing_invoices (status=draft, pricing_snapshot)
        │                              │
        │                              ▼
        │                    checkout_consent_records (blocking)
        ▼
 square-charge-invoice
        │
        ▼
 square-webhook  ────►  apply_payment_to_invoice(invoice, payment)
                                       │
                                       ├─► trg_sync_invoice_on_payment (amount_paid)
                                       ├─► trg_04_attach_subscription_to_paid_invoice
                                       └─► orchestrate_order → orders.status=confirmed
                                                       │
                                                       ▼
                                             INSERT billing_subscriptions
                                                       │
                                                       ▼
                                             provisioning_jobs (queued)
                                                       │
                                                       ▼
                                             installation_jobs + appointments
                                                       │
                                                       ▼
                                              technician_assignments
                                                       │
                                                       ▼
                                        Tech accepte → en_route → arrived → completed
                                                       │
                                                       ▼
                                            service_instances (active)
                                            + WiFi credentials email
                                            + Activation email
                                            + Welcome PDF
```

À chaque étape :
- **Retry** : payments (Square autopay 10 tentatives J1-J7 daily + J8-J10 alterne, cf. mémoire projet), documents (`process-document-jobs`), notifications (5 retries → DLQ).
- **Rollback** : `cancel-order`, `qa_purge_subscription(uuid)` en QA, refund via `square-charge-invoice` refund + `account_adjustments`.
- **Idempotence** : header/param `idempotency_key` + tables `*_idempotency`.

### 5.2 Autres synchronisations

- **Appointments** : `fn_upsert_canonical_appointment_from_legacy` + trigger sync legacy → `appointments` canonique + projections `customer_portal_snapshots`.
- **Ledger** : chaque paiement/ajustement → `ledger_entries` + `ledger_invoice_allocations`.
- **Customer portal projection** : `customer_portal_projection_events` + `_alerts` + `_audit_logs` + `_logs` + `_repair_jobs`. Trigger `trg_customer_portal_projection_*` sur tables clés.
- **Sync audit** : `sync_audit_log`, `field_order_sync_events`.
- **Ship24** : `shipping-tracking-webhook` → `shipments` → `order-tracking-status-notify` → email client.
- **Resend** : `resend-webhook` + `marketing-resend-webhook` → `email_events`, `mkt_webhook_events`.

---

## 6. Billing (règles complètes)

### 6.1 Source of truth
- **`billing_subscriptions`** = seule source de vérité pour les abonnements actifs.
- **Writer allowlist** : `billing_subscription_writer_allowlist` — seules certaines edge functions peuvent muter.
- **Pricing** : toujours calculé par `compute_checkout_pricing` (RPC serveur). Interdit côté front.
- **Snapshot** : `pricing_snapshot` JSON stocké sur `billing_invoices` → sert d'autorité pour affichages, PDF, emails.

### 6.2 Cycle de vie facture
```
draft → issued → paid | partially_paid | overdue | disputed | cancelled | void
```
Triggers garants :
- `trg_00_block_orphan_invoice` — pas de facture sans client/order valide.
- `trg_05_invoice_math_from_subtotal` — vérifie taxes/total.
- `trg_sync_billing_invoice_balance` — recalcule `balance_due`.
- `trg_lock_invoice_account_snapshot` — snapshot immuable après émission.

### 6.3 Renouvellement / Prorata
- **Renouvellement** : cron `billing-generate-renewals` (`0 0 * * *`) crée la facture mensuelle consolidée du compte (1 facture/compte, groupée par adresse — voir mémoire "Facturation Consolidée").
- **Prorata immédiat 3C** : `billing-create-prorata-invoice` sur changement de plan mi-cycle, base 30 jours (voir `docs/PRORATA_MODEL.md`).
- **Cycle** : ancré sur `accounts.billing_cycle_day` (protégé par `trg_protect_billing_anchor` et `trg_guard_account_billing_cycle`).

### 6.4 Overdue / Dunning / Recouvrement
- `billing-check-overdue` + `check-overdue-invoices` + `overdue_reminder_log`.
- `billing-daily-overdue-reminders` (`0 9 * * *`) — email J+3, J+7, J+15.
- `billing-dunning-engine` (`15 9 * * *`) — escalade automatique.
- `collections-account-actions` → `collections_actions`.
- `alert-daily-lifecycle-errors` (`0 9 * * *`).

### 6.5 Autopay Square (Phase 3.B)
- **Sauvegarde carte** : `square-save-card` → `client_payment_methods`.
- **Charge** : `square-charge-subscription` sur renouvellement.
- **Retry** : `square-autopay-retry` (`30 7 * * *`) — 10 tentatives max (J1-J7 daily, J8-J10 tous les 2 jours) → suspension.
- **Migration email** : `square-migration-email` (invitation à réabonner autopay).
- **Invitations** : `billing-autopay-invitations` (`0 10 * * 1`).
- **Réconciliation** : `square-orphan-reconciliation` (`*/15 * * * *`) + `square_orphan_alerts`.
- **Webhook** : `square-webhook` (idempotent, `webhook_events_processed`).

### 6.6 PayPal — décommissionné
- Toutes les edge functions `paypal-*` renvoient **HTTP 410 Gone**.
- Triggers `trg_forbid_paypal_*` bloquent tout insert avec provider=paypal.
- Front nettoyé (Phase 3.B.3) — aucun path frontal n'invoque paypal.

### 6.7 Crédits & remboursements
- **Crédit** : `account_adjustments` type=credit → applique sur prochaine facture via `apply_active_account_promotions_to_invoice` ou allocation directe.
- **Remboursement** : `client_direct_refunds` → Square refund API → `billing_payments` négatif → sync facture.
- **Interdit** : passer un refund comme adjustment ou promotion (triggers bloquent).

### 6.8 Invariants (tests `src/__tests__/*-invariants.test.ts`)
- `pricing_snapshot ?? total_amount` fallback chain (jamais l'inverse).
- Interdit `order.total_amount` sans guard `pricing_snapshot`.
- Interdit `id.slice()` pour numéros de facture — DB séquences uniquement.
- Interdit calcul taxes local dans chemins transactionnels.
- Interdit `total_amount: monthly_total_tax_in` dans emails.
- Interdit passage `order.status → completed` depuis un hook paiement (violation lifecycle).

---

## 7. Provisioning — de la commande à l'activation

```
1. orders.status = confirmed  (après apply_payment_to_invoice)
2. Trigger orchestrate_order():
     ├─► billing_subscriptions INSERT (status=pending_activation)
     ├─► provisioning_jobs INSERT (par service_type)
     └─► installation_jobs INSERT si besoin technicien
3. installation_appointments : créneau via get_available_installation_slots()
4. technician_assignments : dispatch selon zone & compétence
5. Emails : order-confirmation, contract-notification, appointment-notification
6. Contrat : contracts INSERT → sign-contract-public → signature électronique
7. KYC : identity_verification_sessions → generate-verification-qr → submit-id-verification → admin-review-verification
8. Techniciens :
     ├─► tech_accepted   → email "Rendez-vous confirmé"
     ├─► tech_en_route   → email "Technicien en route" (GPS live)
     ├─► tech_arrived    → email "Technicien sur place"
     └─► tech_completed  → email "Service activé" + SSID + WiFi password + PDF bon de livraison
9. service_instances INSERT (status=active)
10. billing_subscriptions.status = active + activation_date
11. Monitoring : network-uptime-check (*/5) + service_status
12. NPS : nps-survey-batch (0 14 * * *) → submit-nps-survey
```

Cas particuliers :
- **Auto-installation** (client installe seul) : pas d'`installation_jobs`, `provisioning_jobs` déclenchent envoi équipement via Canada Post + Ship24.
- **Équipement manuel** : ajout côté Core avec choix expédition ou remise terrain.
- **Remplacement (RMA)** : `replacement_request_tickets` → `replacement_orders` → `replacement_shipments` → `replacement_timeline`.

---

## 8. CRM

### 8.1 Domaines
- **Prospects** : `crm_contacts` (53 col — call_status, priority, territory, is_dnc, is_locked, ...).
- **Leads terrain** : `field_leads` + `field_lead_activities` + `field_lead_tasks`.
- **Interactions** : `crm_call_logs` (13 col), `messages`, `direct_emails`, `telephony_logs`, `openphone-*`.
- **Attribution** : `crm_assignment_history`, `field_territory_*`.
- **Quotas** : `crm_agent_quotas`, statut agent `crm_agent_status`.
- **Scripts** : `crm_scripts` (versionnables, admin).
- **Territoires** : `crm_territories`, `field_territories`, `field_territory_assignments`, `field_territory_streets`, `field_territory_visits`.
- **Leaderboard** : hook `useCrmLeaderboard` (calls_today/week/month, sales, conversion_rate).

### 8.2 Automations
- `crm-score-leads` cron `0 6 * * *` → score les leads.
- `agent-crm-optimizer`, `agent-crm-sequence`, `agent-crm-email-blast`, `agent-followup`, `agent-retention`, `agent-sales`, `agent-sales-assignment`, `agent-supervisor` (*/6h).

### 8.3 Business hours
Fonction `isWithinBusinessHours` (9h-20h America/Toronto). Interdit d'appeler hors plage.

---

## 9. Inventaire & équipement

- **`equipment_inventory`** (27 col) — routeurs, ONT, ONU, terminaux, POD WiFi, SIM. Numéros de série uniques.
- **`inventory_stock`** (21 col) — stock physique par emplacement.
- **`inventory_assignments`** — attribution technicien / camion.
- **`equipment_return_requests`** — retours après annulation.
- **`equipment_audit_log`** — journal complet.
- **`defective_equipment_alerts`** — équipements défectueux avec suivi.
- **`phone_inventory`** + `phone_orders` — téléphones mobiles.
- **Règles** : max 1 routeur WiFi, 1-4 terminaux TV, 1 SIM par ligne mobile, prix mémorisés (borne WiFi 60$, terminal TV 50$, POD 50$, SIM 30$).
- **Tech Stock** (portail tech) — filtré par catégories `TechStock.tsx`.

---

## 10. Rendez-vous

### 10.1 Tables canoniques
- `appointments` (32 col) — source unique après unification.
- `appointment_slot_rules` + `appointment_slot_overrides` + `appointment_blocked_dates`.
- `technician_slots` + `technician_slot_bookings`.
- `installation_appointments` (legacy, sync via `fn_upsert_canonical_appointment_from_legacy`).

### 10.2 Fonctions
- `get_available_installation_slots(zone, date_range, service_type)` — RPC unique de disponibilité.
- Statuts : `scheduled` → `confirmed` → `in_progress` → `completed` | `no_show` | `cancelled` | `rescheduled`.
- **Règle** : un rendez-vous non-terminal reste visible côté tech même si la plage est dépassée.

### 10.3 Automations
- `appointment-reminder-scan-every-5min` (`*/5 * * * *`) → `send-appointment-reminder`.
- `send-appointment-notification`, `appointment-rescheduled`, `calendly-webhook`.
- Core : bouton "Envoyer un rappel" sur `CoreClientProfile`.

---

## 11. Notifications

### 11.1 Email
- **Infra** : queue `transactional_emails` (pgmq) + queue `auth_emails` (prioritaire).
- **Drain** : `email-queue-drain` cron `* * * * *` (échoue proprement sur 429, retry 30s sur 5xx, DLQ après 5).
- **Templates** : `supabase/functions/_shared/emailTemplates/` — corporate blue #0066CC obligatoire.
- **Registry** : `email_templates`, `email_automation_rules`, `email_trigger_queue`.
- **Tracking** : `track-email-open`, `track-email-click`, `email_events`, `email_send_log`, `email_sends`.
- **Unsubscribe** : `email-unsubscribe`, `email_unsubscribe_tokens`, `handle-email-unsubscribe`.
- **Suppression** : `suppressed_emails` (bounce/complaint/unsub).

### 11.2 SMS
- Queue `sms_queue` + `sms-queue-drain` (`* * * * *`).
- OpenPhone : `openphone-webhook`, `openphone-sms`, `openphone-conversations`, `openphone-call-history`, `openphone-phone-numbers`.
- Marketing SMS : `marketing-send-sms`, `sms_campaigns`.

### 11.3 Push
- `push_subscriptions`, service worker `push-sw.js`, `PushNotificationToggle`.

### 11.4 Outbox interne
- `notification_outbox` — écrit synchrone, drainé par `process-notification-outbox` (`* * * * *`).
- Types : staff, employee, hub, admin, client, technician.

---

## 12. Sécurité

### 12.1 Authentification
- Supabase Auth : email/password + Google (par défaut sur Cloud).
- Client PIN : `client_login_pins` + `client-pin-send`/`verify`.
- Staff OTP : `staff-otp-send`/`verify`, `staff_otp_codes`.
- Admin OTP : `admin_otp_codes`/`sessions`.
- Session revocation : `client-account-admin` (force sign-out + `must_change_password`).
- 2FA : `e2e/2fa-otp.spec.ts` couvre le flux.

### 12.2 Autorisation
- **Rôles** dans `user_roles` (séparé de `profiles` — anti-escalation).
- **Fonction** : `has_role(_user_id, _role)` SECURITY DEFINER, `search_path=public`.
- **Policies RLS** : toutes les tables `public` sensibles, `USING (has_role(auth.uid(), 'admin'))` ou scoping `auth.uid()`.
- **Rôles définis** : admin, employee, technician, client, system, sales, kyc_agent, billing_admin, techops, support, supervisor, influencer, field_sales.

### 12.3 Audit
- `admin_audit_log`, `admin_auth_audit_log`, `admin_security_audit`, `security_events`, `security_incidents`, `security_audit_log`, `security_action_logs`, `client_activity_logs`, `client_access_logs`, `activity_logs`, `sync_audit_log`, `document_audit_log`, `communication_audit_log`, `employee_audit_logs`, `internal_audit_log`, `agent_audit_log`, `hr_audit_log`, `influencer_audit_log`, `nova_reasoning_log`.

### 12.4 Impersonation
- `impersonation_sessions`, `staff_impersonation_sessions`, `staff-impersonate-issue` (audit + timeout).

### 12.5 Rate limiting
- `rate_limits`, `rate_limit_attempts`, `rate_limit_lockouts`, helper `_shared/rateLimit.ts` + `billingRateLimit.ts`.

### 12.6 Lockdown & maintenance
- `LockdownGuard` + `verify-lockdown-password` + `toggle-lockdown` — bloque tout le site (staff-only override).
- `MaintenanceGuard` + `MaintenancePage`.

### 12.7 KYC / Identité
- `identity_verification_sessions` (40 col), `identity_documents`, `identity_verification_events`, `kyc_requests`, `kyc_verifications`.
- `generate-verification-qr` + `submit-id-verification` + `process-id-ocr` + `admin-review-verification`.

### 12.8 Storage
- Buckets sandboxés par RLS. Uploads : documents client, docs KYC (bucket privé), signatures, photos install, PDFs générés.

---

## 13. Règles métier majeures

- **1 seul service par adresse.** Multi-adresses géré via `service_addresses`, jamais dupliquer sur une même adresse.
- **1 seule facture mensuelle par compte** (consolidée toutes adresses + tous services).
- **Auto-pay max 10 tentatives** avant suspension.
- **Un abonnement ne peut pas** être créé sans facture payée liée.
- **Une facture ne peut pas** être émise sans ordre confirmé (`trg_guard_billable_order_state_invoices`).
- **Un paiement ne peut pas** être appliqué à une facture d'ordre non-confirmé.
- **Un ordre ne peut pas** passer `intake → completed` sans passer par `confirmed` (`trg_guard_order_lifecycle_no_skip`).
- **Un technicien ne peut pas** clôturer une installation sans SSID + password WiFi renseignés (validation `TechInstallation.tsx` + backend).
- **Un rendez-vous** reste "actif" en portail tech tant qu'il n'est pas terminal.
- **Un client peut** annuler seul, réactiver sous 30j, changer plan (prorata), demander remplacement équipement.
- **Un employé peut** créer un ordre POS, enregistrer un paiement manuel (avec PIN client vérifié), suspendre, réactiver.
- **Un admin peut** tout, sauf muter directement `billing_subscriptions` hors writer allowlist.
- **Un influencer** peut consulter ses gains mais pas modifier les taux.
- **Numéro de compte** immuable (`trg_lock_account_number`).
- **Champs identité** verrouillés (`trg_lock_identity_fields`) — mutations via `profile-edit gateway`.
- **Rabais custom_core** : appliqués uniquement sur factures récurrentes, jamais sur transaction initiale.
- **Guest checkout** : sans login, mais consentement obligatoire (`checkout_consent_records`).
- **Chat live public** : jamais visible sur portails internes (`ChatWidgetGate`).
- **Prix inventés interdits** : `[À COMPLÉTER]` obligatoire quand valeur manquante.

---

## 14. Workflows (bout-en-bout)

### 14.1 Nouveau client (site public)
1. `CoverageMap` / `address-qualify` → serviceabilité.
2. `Forfaits` → sélection.
3. `GuestCheckout` : identité + adresse + consentement → `checkout-canonical-sync`.
4. `submit-id-verification` (KYC async).
5. `billing-create-order` → order draft + invoice draft (`pricing_snapshot`).
6. Square Payments Web SDK iframe → `square-charge-invoice`.
7. `square-webhook` → `apply_payment_to_invoice` → `orchestrate_order`.
8. Envoi email confirmation + contrat à signer (`send-contract-notification`).
9. Signature `sign-contract-public`.
10. `provisioning_jobs` déclenche install jobs, appointments, techs.
11. Emails à chaque étape tech.
12. Activation → `service_instances.active` → welcome PDF.
13. Facturation mensuelle prend le relais.

### 14.2 Support ticket
1. Client ouvre depuis `/client/tickets` OU email → `support-email-inbound`.
2. `callSupportAction('create_ticket')` (Edge `support-account-actions`).
3. Triggers single-door valident (INVARIANT-TICKET-SINGLE-DOOR).
4. Dispatch : `assignment_rules` + `agent-support`.
5. `support-ai-responder` (`*/2 * * * *`) répond en L1 si config le permet.
6. Réponses via `callSupportAction('reply_ticket')`.
7. Résolution : `transition_status` → `resolved` → `close` après 72h.
8. NPS déclenché.

### 14.3 Cycle de facturation mensuel
1. Cron `billing-generate-renewals` `0 0 * * *`.
2. Pour chaque `billing_subscription` active → génère `billing_invoices` consolidée par compte.
3. Snapshot pricing gelé.
4. Email "Facture émise".
5. Auto-pay tenté immédiatement si activé.
6. Sinon paiement dans `client_billing_settings.due_days`.
7. Overdue rappels J+3, J+7, J+15.
8. J+30 → collections, J+60 → suspension.

### 14.4 Annulation / réactivation
1. Client → `service-cancellation-requests` (portail) ou Core → `cancel-account`.
2. `retention_actions` proposées.
3. Confirmation → suspension services + jour de fin.
4. Équipement retour → `equipment_return_requests`.
5. Facture finale prorata.
6. Réactivation possible sous 30j via Core.

---

## 15. Automatisations (cron + triggers + agents)

### 15.1 pg_cron (39 jobs — tous listés)
| Job | Cadence | But |
|---|---|---|
| agent-supervisor | `0 */6 * * *` | Superviseur IA global |
| alert-daily-lifecycle-errors | `0 9 * * *` | Alertes cycle vie |
| appointment-reminder-scan-every-5min | `*/5 * * * *` | Rappels RDV |
| billing-admin-daily-digest-8am | `0 12 * * *` | Digest admin |
| billing-autopay-invitations | `0 10 * * 1` | Invitations autopay lundi |
| billing-daily-overdue-reminders | `0 9 * * *` | Relances |
| billing-data-retention | `0 3 * * *` | Purge données |
| billing-dunning-engine | `15 9 * * *` | Escalade recouvrement |
| billing-generate-renewals | `0 0 * * *` | Factures mensuelles |
| billing-lifecycle | `0 8 * * *` | Cycle abonnements |
| billing-reconcile-invoices | `30 1 * * *` | Réconciliation |
| commission-monthly-report | `0 8 1 * *` | Rapport mensuel commissions |
| compensation-expire-daily | `0 3 * * *` | Expire compensations |
| complaint-escalate-crtc | `0 10 * * *` | Escalade CRTC |
| contract-signature-reminders-daily | `15 3 * * *` | Relance signature |
| crm-score-leads | `0 6 * * *` | Score leads |
| daily-backup-export | `0 10 * * *` | Export sauvegarde |
| daily-data-backup | `0 2 * * *` | Backup DB |
| email-queue-drain | `* * * * *` | Drain email queue |
| field-order-retry-shell-materialization | `* * * * *` | Retry ordres shell |
| network-uptime-check | `*/5 * * * *` | Ping réseau |
| nivra-health-check | `0 6 * * *` | Santé plateforme |
| noc-monitor | `*/30 * * * *` | Monitoring NOC |
| nova-watchdog | `*/30 * * * *` | Watchdog IA |
| nps-survey-batch | `0 14 * * *` | Envoi NPS |
| ops-watchdog-evening | `0 23 * * *` | Ops soir |
| ops-watchdog-morning | `0 11 * * *` | Ops matin |
| pause-auto-resume-hourly | `0 * * * *` | Reprise auto-pause |
| process-document-jobs | `* * * * *` | Docs pending |
| process-notification-outbox | `* * * * *` | Outbox notifs |
| purge-expired-card-payment-intents | `0 2 * * *` | Purge intents |
| revenue-assurance | `30 3 * * *` | Assurance revenus |
| review-email-dispatcher-hourly | `15 * * * *` | Demandes d'avis |
| sla-monitor | `0 8 * * *` | SLA |
| sms-queue-drain | `* * * * *` | Drain SMS |
| square-autopay-retry | `30 7 * * *` | Retry autopay |
| square-orphan-reconciliation | `*/15 * * * *` | Orphelins Square |
| support-ai-responder | `*/2 * * * *` | IA support |
| weekly-sales-report | `0 13 * * 1` | Rapport ventes hebdo |

### 15.2 Agents IA (`agent-*`)
`agent-analytics`, `agent-billing`, `agent-checkup`, `agent-crm-*`, `agent-directories`, `agent-followup`, `agent-google-ads`, `agent-marketing`, `agent-recruitment`, `agent-retention`, `agent-review-request`, `agent-sales`, `agent-sales-assignment`, `agent-seo`, `agent-site-monitor`, `agent-social`, `agent-supervisor`, `agent-support`, `agent-sync`. Registres `agent_registry`, `agent_runs`, `agent_events`, `agent_audit_log`, `agent_points`.

### 15.3 Nova (couche IA opérationnelle)
`nova_actions`, `nova_conversations`, `nova_decisions`, `nova_memory`, `nova_reasoning_log`, `nova-watchdog`. Exécution via `core-ai-converse` + `novaExecutor.ts`.

---

## 16. Rôles & permissions

| Rôle | Portails accessibles | Peut… |
|---|---|---|
| `admin` | Tous | Tout (sauf writer allowlist bypass) |
| `supervisor` | Core, Employee | Encadrement, override support |
| `employee` | Employee, Core (lecture) | Client 360, POS, tickets, PIN |
| `billing_admin` | Core (billing) | Paiements, refunds, ajustements |
| `kyc_agent` | Core (KYC) | Validation identités |
| `techops` | Core (provisioning) | Provisionnement, réseau |
| `support` | Core, Employee | Tickets, communications |
| `sales` | Core (sales), Field | Devis, commandes, promos |
| `field_sales` | Field | Ventes terrain, leads, offres |
| `technician` | Tech | Installations, stock camion, GPS |
| `influencer` | (dashboard influencer) | Voir gains, générer code |
| `client` | Portail Client | Self-service |
| `system` | Aucun (edge functions) | Exécution automatisée |

Guarde côté route : `ClientProtectedRoute`, `FieldProtectedRoute`, `HrProtectedRoute`, `MarketingProtectedRoute`, `TechProtectedRoute`, `AdminProtectedRoute` (login gate + `has_role` check).

---

## 17. Intégrations externes

| Service | Usage | Edge functions / secrets |
|---|---|---|
| **Square** | Paiement unique + carte on file + autopay | `square-*`, `square-webhook`, secrets Square access token |
| **PayPal** | Décommissionné (410) | `paypal-*` stubs |
| **Resend** | Email transactionnel/marketing | `_shared/resendGateway.ts`, `resend-webhook` |
| **OpenPhone** | Voix + SMS | `openphone-*` |
| **Mapbox** | Autocomplétion adresses + carte tech | `mapbox-address-autocomplete`, `TechMap` |
| **Ship24** | Suivi colis multi-transporteur | `shipping-tracking-webhook`, `shipping-register-tracker` |
| **Canada Post** | Envoi équipement | via Ship24 abstraction |
| **ElevenLabs** | TTS/STT (interview, Nova voice) | `elevenlabs-tts`, `elevenlabs-stt-token`, `interview-tts`, `interview-transcribe` |
| **Lovable AI Gateway** | LLM (chatbot, agents, Nova) | `core-ai-converse`, `chatbot-jonathan`, `ai-improve-message`, `support-ai-responder`, `training-ai-*` |
| **Calendly** | Import RDV externes | `calendly-webhook` |
| **Turnstile** | Anti-bot forms | `_shared/turnstile.ts` |
| **Sentry** | Erreurs | `_shared/sentry.ts` |
| **Cloudflare** | CDN + DNS domaines | (côté infra) |
| **Vercel/Netlify** | (pas utilisé — hébergement Lovable) | — |

---

## 18. Ce qui est terminé (extrait)

- Checkout guest + Square + consentement légal (verrouillé, tests).
- Portail Client complet (self-service).
- Client 360 (51 modules audités).
- Billing consolidé + prorata + autopay Square + dunning.
- Provisioning end-to-end avec technicien mobile (portail Tech High-Vis Amber).
- KYC async (email + QR + OCR + review).
- Tickets support single-door + IA responder.
- CRM outbound multi-portails (Field/Employee/Core).
- Marketing campagnes Resend + tracking.
- PayPal décommissionné proprement.
- 9 systèmes verrouillés + 3 suites d'invariants (30+ tests).
- 39 cron jobs opérationnels.
- Multi-adresses 3A + facturation consolidée 3B + prorata immédiat 3C.
- Idempotence globale ordres (draft.id).

## 19. Partiellement terminé

- **Migration `pages/admin` → `core-app`** : 77 pages legacy encore présentes en parallèle des 128 pages modernes. Duplication de logique.
- **Portail Marketing** : layout + composants OK, campagnes fonctionnelles, mais **manque UI ciblage avancé** et A/B test.
- **RH** : payroll_entries + payslips OK, **manque** génération auto T4/Relevé 1 fiscaux fin d'année.
- **Provisioning réseau** : `internet_*` tables existent, **manque** intégration OLT/OSS directe (activation manuelle par tech aujourd'hui).
- **Live chat portail** : sur site public OK, mais **pas encore proxifié dans Nivra Core** (visualisation seule).
- **NOC monitoring** : cron `*/30`, mais peu de dashboards visuels côté Core.
- **Loyalty** : tables prêtes, **UI portail client basique**.
- **Streaming** : catalog + activation tokens OK, **manque** portail dédié gestion abonnement.
- **Referrals** : moteur OK, **manque** page influencer détaillée avec analytics temps réel.

## 20. Ce qui n'existe pas encore

- API publique documentée (OpenAPI/Swagger).
- App mobile native (Capacitor configuré mais pas publié).
- Portail B2B / entreprise.
- Facturation multi-devise (CAD uniquement).
- Support multi-langues au-delà de FR/EN.
- Intégration comptabilité (QuickBooks/Xero).
- Système de billetterie interne (feature request agents).
- Dashboards BI (Metabase / Superset).
- Alerting Slack / PagerDuty pour incidents (aujourd'hui email + Sentry).
- Feature flags dynamiques (aujourd'hui statiques dans `src/config/features.ts`).
- E2E tests couverture < 40 % (playwright existe mais scénarios limités).
- SLO/SLI formalisés.

## 21. Points faibles & dette technique

### 21.1 Architecture
- **Deux bases de code admin** (`pages/admin` legacy + `core-app` moderne). Nettoyage à planifier.
- **`orders` table à 134 colonnes** — signe de sur-agrégation, candidate à décomposition.
- **`profiles` à 93 colonnes** — même diagnostic.
- **396 Edge Functions** — beaucoup de recouvrement (ex: multiple `agent-*` très proches). Consolider en modules Deno partagés.

### 21.2 UX/UI
- Portail Tech redesign en cours mais toujours perfectible.
- Portail Client fonctionnel mais peu inspirant visuellement (design "corporate blue").
- Site public : conversion pas mesurée (analytics manque).
- Pas de design system publié séparément (les tokens sont dans `index.css`).

### 21.3 Performance
- Bundle Vite unique très gros (>= 2MB) : plusieurs sous-portails chargent tout. **Code splitting par route** à généraliser.
- Requêtes TanStack Query pas toujours optimisées (staleTime 30s global — trop court pour certaines listes).
- Realtime Supabase peu utilisé — surtout du polling.

### 21.4 Sécurité
- Deux tables sans RLS (`trip_requests`, `trips`) — legacy à isoler ou activer RLS.
- `service_role` key non-accessible sur Cloud, donc pas de fuite, mais **plusieurs fonctions utilisent `verify_jwt=false`** — vérifier chaque cas.
- Absence de rotation programmée des JWTs admins.

### 21.5 Dette
- Doubles noms Nivra Core / OneView Employee / Field — l'utilisateur mélange souvent les terminologies.
- `legacy` billing tables (`billing`, `payments`, `subscriptions`, `monthly_invoices`) figées mais toujours lues côté rapports historiques.
- Fichiers de test scriptés dans `test_*.mjs` à la racine (pollution).
- Docs éparpillées : `.lovable/*`, `docs/*`, `audit/*`, `SYSTEM_LOCK_REPORT.md`, `CORE_DEPLOYMENT.md`, `CHANGELOG.md`. Consolider dans `/docs`.

### 21.6 Complexité
- Le concept **"single-door"** est puissant mais opaque : sans lecture des triggers, un dev externe ne comprend pas pourquoi son `INSERT` échoue.
- **Idempotency keys** obligatoires mais non documentés uniformément.

### 21.7 Évolutivité
- Postgres unique (Supabase managé). Sharding non prévu. Ok pour < 1M clients.
- Aucune séparation OLTP/OLAP — les rapports lisent le prod.

---

## 22. Documentation finale — Diagrammes textuels

### 22.1 Vue système

```
                          ┌───────────────────────────────┐
                          │      CLIENTS / VISITEURS       │
                          └───────────────┬────────────────┘
                                          │
       ┌──────────────────────────────────┼───────────────────────────────┐
       │                                  │                               │
       ▼                                  ▼                               ▼
  Site public            Portail Client                          Nivra Chat (LLM)
   (React SPA)             (React SPA)                              (public only)
       │                       │
       │  Square SDK           │
       │  Turnstile            │
       ▼                       ▼
       ├───────────────────────┴──────────────► Supabase Auth (JWT)
       │
       │              ┌────────────────────────────────────────────────┐
       │              │              LOVABLE CLOUD (Supabase)          │
       ▼              │                                                │
  Edge Functions ────►│  Postgres  ──► RLS + Triggers (single-door)   │
   (396 Deno)         │           ──► pg_cron (39 jobs)                │
       ▲              │           ──► pgmq (email/sms queues)          │
       │              │           ──► pg_net (HTTP sortant)            │
       │              │  Storage  ──► KYC, docs, PDF, photos, signs   │
       │              │  Auth     ──► email/pwd + Google + OTP         │
       │              │  Realtime ──► (usage limité)                   │
       │              └────────────────────────────────────────────────┘
       │
       ├────────► Square (paiements)
       ├────────► Resend (emails)
       ├────────► OpenPhone (voice/SMS)
       ├────────► Mapbox (adresses + carte)
       ├────────► Ship24 (suivi colis)
       ├────────► ElevenLabs (TTS/STT)
       ├────────► Lovable AI Gateway (LLM)
       └────────► Calendly (RDV externe)

                          ┌───────────────────────────────┐
                          │      STAFF INTERNE            │
                          └───────────────┬────────────────┘
                                          │
       ┌──────────┬──────────┬───────────┴─────┬───────────┬────────┐
       ▼          ▼          ▼                 ▼           ▼        ▼
    Core     Employee      RH             Field         Tech    Marketing
   Admin     OneView      Portal         Sales        Portal    Portal
```

### 22.2 Flux paiement (canonique)

```
Client  ──►  Square Web SDK  ──►  square-charge-invoice (Edge)
                                          │
                                          ▼
                              Square API : createPayment
                                          │
                                          ▼
                              Payment ID + status ─► frontend UI
                                          │
Square  ────► square-webhook ────► apply_payment_to_invoice(rpc)
                                          │
                             ┌────────────┼────────────┐
                             ▼            ▼            ▼
                    billing_payments  billing_invoices  ledger_entries
                    (INSERT)          (UPDATE)          (INSERT + allocations)
                             │
                             ▼
                    trg_04_attach_subscription_to_paid_invoice
                             │
                             ▼
                    orchestrate_order() : orders.status=confirmed
                             │
                             ▼
                    provisioning_jobs / installation_jobs / appointments
                             │
                             ▼
                    email + PDF (via pgmq transactional_emails)
```

### 22.3 Guide d'ingestion (pour IA tierce)

Pour comprendre ce projet, priorité de lecture :
1. `SYSTEM_LOCK_REPORT.md` — invariants verrouillés.
2. `mem://index.md` (mémoires projet) — décisions produit.
3. `src/App.tsx` + `src/components/AppRoutes.tsx` — points d'entrée frontend.
4. `src/lib/constants/roles.ts` — rôles.
5. `src/core-app/lib/callCoreAction.ts` + `src/shared-ops/lib/callSupportAction.ts` — gateways.
6. `supabase/functions/_shared/` — utilitaires clés.
7. Liste des 39 crons + 396 edge functions ci-dessus.
8. Schéma des ~430 tables (partie 4).
9. `.lovable/c360/module*.md` — spécifs modules Client 360.

### 22.4 Recommandations prioritaires (0-3 mois)
1. **Consolider `pages/admin` → `core-app`** (supprimer les doublons).
2. **Découper `orders` et `profiles`** en sous-tables spécialisées (identity / billing / preferences / lifecycle).
3. **Publier une API OpenAPI** en générant depuis les Edge Functions Deno.
4. **Code-splitter le bundle** par sous-portail (dynamic `import()` par route).
5. **Formaliser SLO/SLI** + intégrer alerting Slack/PagerDuty.
6. **Séparer OLAP** — répliquer vers un DW (Supabase read replica ou ClickHouse).
7. **Compléter e2e Playwright** — couvrir les 14 workflows section 14.
8. **Design system publié** en package `@nivra/ui` (tokens + composants).
9. **App mobile native** (Capacitor déjà configuré) — lancer TestFlight/Internal Testing.
10. **Feature flags dynamiques** (LaunchDarkly ou table `feature_flags`).

### 22.5 Recommandations UX (idées à explorer, respectant l'existant)
- **Portail Client** : hub visuel avec cartes "prochaine facture / prochain RDV / usage" au lieu de la nav classique.
- **Nivra Core** : passer d'un menu latéral gonflé à un **command palette** (⌘K) + Client 360 en drawer plein écran.
- **Portail Tech** : ajouter **carte plein écran** avec route optimisée multi-RDV + panneau bottom-sheet.
- **Field Sales** : mode "offline-first" complet avec sync différée (déjà partiellement).
- **Site public** : refonte hero avec **simulateur d'économies** interactif.

---

## Annexe A — Inventaire brut

- **Edge Functions** : 396 fichiers dans `supabase/functions/` (liste complète disponible via `ls`).
- **Migrations** : 1 287 fichiers `supabase/migrations/*.sql`.
- **Tables `public`** : ~430 (voir contexte système complet).
- **Cron jobs** : 39 (liste section 15.1).
- **Routes** : 532 balises `<Route>` dans `AppRoutes.tsx`.
- **Pages** : Core 128, Admin legacy 77, Client 40, Employee 28, Field 28, Tech 18, HR 13, publics ~55.

## Annexe B — Fichiers clés à référencer

| Objet | Chemin |
|---|---|
| Router principal | `src/components/AppRoutes.tsx` |
| Client Supabase | `src/integrations/backend/client.ts` |
| Rôles | `src/lib/constants/roles.ts` |
| Design tokens | `src/index.css`, `src/styles/design-tokens.css` |
| Gateway Core | `src/core-app/lib/callCoreAction.ts` |
| Gateway Support | `src/shared-ops/lib/callSupportAction.ts` |
| Utilitaires email | `supabase/functions/_shared/resendGateway.ts`, `_shared/emailTemplates/` |
| Utilitaires PDF | `supabase/functions/_shared/pdfGenerator.ts`, `_shared/pdf/`, `_shared/locked-pdf/` |
| Invariants tests | `src/__tests__/system-lock-invariants.test.ts`, `billing-financial-invariants.test.ts`, `canonical-data-integrity.test.ts` |
| Verrouillage systèmes | `SYSTEM_LOCK_REPORT.md` |
| Spécifs C360 | `.lovable/c360/*.md` |
| Plan | `.lovable/plan.md` |
| QA runners | `.lovable/qa/regression-runners/*.md` |

---

**Fin du document — 22 sections, ~950 lignes.**
Cette documentation est destinée à être lue de A à Z pour comprendre Nivra Tech dans sa globalité. Toute IA ou équipe qui en dispose peut proposer des évolutions cohérentes tout en respectant les invariants verrouillés listés en section 4.3 et 6.8.
