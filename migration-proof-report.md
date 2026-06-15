# RAPPORT DE PREUVE DE MIGRATION — NIVRA TELECOM
**Date d'audit :** 2026-06-15  
**Audité par :** Claude (inspection directe API + fichiers locaux)  
**Source (ancien projet) :** `xtgngmtxggascbxnswvb`  
**Destination (nouveau projet) :** `lacxnbjvcyvhrttprkxr` (créé le 2026-06-02)

---

## 1. SOURCES DE DONNÉES UTILISÉES POUR CET AUDIT

| Source | Type | Date | Chemin |
|---|---|---|---|
| Ancien projet CSV exports | ~480 fichiers CSV | 2026-06-13 06:36–06:43 | `C:\Users\Lavau\Downloads\exports_nivra_extracted\exports\` |
| Nouveau projet DB | API SQL live | 2026-06-15 | `api.supabase.com` via PAT |
| Ancien code Lovable | 4 archives ZIP | 2026-03-05 à 2026-04-14 | `C:\Users\Lavau\Downloads\telecom-zen-hub-*-main\` |
| Fichiers SQL de correction | 3 fichiers | 2026-06-14 | `C:\Users\Lavau\.claude\jobs\e369c3ad\tmp\` |

**Aucun dump SQL complet (pg_dump) trouvé.** Aucune sauvegarde Supabase automatique accessible.

---

## 2. STATUT DE L'ANCIEN PROJET `xtgngmtxggascbxnswvb`

### Erreurs exactes retournées par Supabase Management API :

```
GET  https://api.supabase.com/v1/projects/xtgngmtxggascbxnswvb
→ HTTP 403 Forbidden
→ {"message":"Your account does not have the necessary privileges to access this endpoint.
   For more details, refer to our documentation https://supabase.com/docs/guides/platform/access-control"}

POST https://api.supabase.com/v1/projects/xtgngmtxggascbxnswvb/database/query
→ HTTP 403 Forbidden (même message)

GET  https://api.supabase.com/v1/projects  (liste TOUS les projets du compte)
→ HTTP 200 — 1 seul projet trouvé :
  id=lacxnbjvcyvhrttprkxr  name="nivratelecom's Project"  status=ACTIVE_HEALTHY  region=us-west-2  created=2026-06-02
```

### Conclusion sur le statut de l'ancien projet :
- L'ancien projet **n'apparaît PAS** dans la liste des projets du compte avec ce PAT
- Le PAT utilisé n'a **aucun accès** à `xtgngmtxggascbxnswvb`
- **Possibilités (non confirmables sans accès) :**
  - Projet supprimé après export CSV du 2026-06-13
  - Projet appartenant à une autre organisation Supabase
  - PAT créé uniquement pour le nouveau projet
- **Preuve que le projet existait :** `.env` dans tous les exports Lovable confirme `VITE_SUPABASE_URL=https://xtgngmtxggascbxnswvb.supabase.co`
- **Preuve de données :** 480 CSV exportés le 2026-06-13 contenant les données de l'ancien projet

---

## 3. PREUVE DE MIGRATION — TABLE PAR TABLE

**Légende :**
- `SOURCE` = lignes dans CSV export du 2026-06-13 (ancien projet `xtgngmtxggascbxnswvb`)
- `DEST` = lignes dans nouveau projet `lacxnbjvcyvhrttprkxr` (2026-06-15)
- `DELTA` = SOURCE - DEST (positif = données perdues)
- `STATUS` = OK (migré), PARTIEL (incomplet), PERDU (non migré), NOUVEAU (créé après migration), ABSENT (table manquante dans nouveau projet)

### 3A — TABLES MÉTIER CRITIQUES

| Table | SOURCE | DEST | DELTA | STATUS |
|---|---|---|---|---|
| **profiles** (clients) | **800** | **705** | **-95** | ⚠️ PARTIEL |
| **support_tickets** | **14 264** | **104** | **-14 160** | 🔴 PERDU |
| **ticket_replies** | **33 873** | **242** | **-33 631** | 🔴 PERDU |
| **orders** | **56** | **15** | **-41** | 🔴 PERDU |
| **quotes** | **195** | **18** | **-177** | 🔴 PERDU |
| **billing_invoices** | **14** | **17** | +3 | ✅ OK+ |
| **billing_payments** | **11** | **12** | +1 | ✅ OK+ |
| **billing_subscriptions** | **10** | **11** | +1 | ✅ OK+ |
| **billing_subscription_services** | **17** | **0** | **-17** | 🔴 PERDU |
| **billing_customers** | 13 | 14 | +1 | ✅ OK+ |
| **subscriptions** | 11 | 11 | 0 | ✅ OK |
| **contracts** | 12 | 12 | 0 | ✅ OK |
| **service_addresses** | **17** | **0** | **-17** | 🔴 PERDU |
| **service_instances** | 12 | 12 | 0 | ✅ OK |
| **services** | 36 | 36 | 0 | ✅ OK |
| **installations** | 51 | 51 | 0 | ✅ OK |
| **equipment_inventory** | 80 | 83 | +3 | ✅ OK+ |
| **work_orders** | 4 | 4 | 0 | ✅ OK |
| **technicians** | 2 | 2 | 0 | ✅ OK |
| **employees** | 2 | 2 | 0 | ✅ OK |
| **crm_contacts** | 659 | 659 | 0 | ✅ OK |
| **accounts** | 15 | 17 | +2 | ✅ OK+ |
| **payments** | 0 | 5 | +5 | ✅ NOUVEAU |
| **client_documents** | 7 | 7 | 0 | ✅ OK |
| **client_login_pins** | 25 | 25 | 0 | ✅ OK |
| **payroll_records** | 0 | 7 | +7 | ✅ NOUVEAU |

### 3B — FORMATION ET CONTENU

| Table | SOURCE | DEST | DELTA | STATUS |
|---|---|---|---|---|
| **training_lessons** | **1 756** | **10** | **-1 746** | 🔴 PERDU |
| **training_modules** | **1 104** | **10** | **-1 094** | 🔴 PERDU |
| **training_questions** | 100 | 100 | 0 | ✅ OK |
| **training_answers** | 90 | 90 | 0 | ✅ OK |
| **training_progress** | 13 | 23 | +10 | ✅ OK+ |
| **training_certifications** | 0 | 0 | 0 | ✅ OK |
| **hub_posts** | **47** | **5** | **-42** | 🔴 PERDU |
| **hub_documents** | **4** | **14** | +10 | ✅ OK+ |
| **hub_faq** | 0 | 10 | +10 | ✅ NOUVEAU |
| **hub_store_items** | **10** | **18** | +8 | ✅ OK+ |
| **hub_login_audit** | 197 | 275 | +78 | ✅ OK+ |

### 3C — MARKETING ET COMMUNICATION

| Table | SOURCE | DEST | DELTA | STATUS |
|---|---|---|---|---|
| **marketing_campaigns** | **270** | **12** | **-258** | 🔴 PERDU |
| **marketing_ai_config** | **20** | **2** | **-18** | 🔴 PERDU |
| **marketing_conversations** | 103 | 103 | 0 | ✅ OK |
| **email_queue** | **5 456** | **2 383** | **-3 073** | 🔴 PERDU |
| **email_send_log** | 6 318 | 6 348 | +30 | ✅ OK+ |
| **sms_campaigns** | **18** | **14** | **-4** | ⚠️ PARTIEL |
| **direct_emails** | **70** | **6** | **-64** | 🔴 PERDU |
| **direct_email_recipients** | 429 | 429 | 0 | ✅ OK |
| **social_media_posts** | **104** | **19** | **-85** | 🔴 PERDU |

### 3D — LOGS ET AUDIT

| Table | SOURCE | DEST | DELTA | STATUS |
|---|---|---|---|---|
| **customer_portal_projection_logs** | **661 218** | **0** | **-661 218** | 🔴 PERDU |
| **customer_portal_projection_alerts** | **208 282** | **53 000** | **-155 282** | 🔴 PERDU |
| **agent_events** | 37 611 | 46 383 | +8 772 | ✅ OK+ |
| **agent_audit_log** | 13 753 | 13 284 | -469 | ✅ OK~ |
| **agent_runs** | 4 014 | 4 349 | +335 | ✅ OK+ |
| **sync_audit_log** | 22 419 | 22 419 | 0 | ✅ OK |
| **internal_audit_log** | 2 836 | 3 002 | +166 | ✅ OK+ |
| **live_activity_logs** | 8 297 | 8 308 | +11 | ✅ OK+ |

### 3E — CRM ET FIDÉLITÉ

| Table | SOURCE | DEST | DELTA | STATUS |
|---|---|---|---|---|
| **loyalty_points** | **3** | **0** | **-3** | 🔴 PERDU |
| **loyalty_rewards** | **5** | **4** | **-1** | ⚠️ PARTIEL |
| **loyalty_transactions** | **4** | **0** | **-4** | 🔴 PERDU |
| **referral_codes** | 714 | 714 | 0 | ✅ OK |
| **referral_attributions** | 5 | 5 | 0 | ✅ OK |
| **client_referrals** | **2** | **0** | **-2** | 🔴 PERDU |
| **influencers** | 7 | 7 | 0 | ✅ OK |

### 3F — IPTV ET STREAMING

| Table | SOURCE | DEST | DELTA | STATUS |
|---|---|---|---|---|
| **tv_channels** | 178 | 178 | 0 | ✅ OK |
| **tv_pack_channels** | 0 | **74** | +74 | ✅ NOUVEAU |
| **tv_packs** | 0 | **7** | +7 | ✅ NOUVEAU |
| **channel_packages** | **8** | **16** | +8 | ✅ OK+ |
| **channel_selections** | 17 | 17 | 0 | ✅ OK |
| **streaming_services** | **6** | **12** | +6 | ✅ OK+ |

### 3G — TERRAIN ET COMMISSIONS

| Table | SOURCE | DEST | DELTA | STATUS |
|---|---|---|---|---|
| **field_sales_orders** | **27** | **14** | **-13** | 🔴 PERDU |
| **field_commissions** | 15 | 15 | 0 | ✅ OK |
| **field_leads** | 1 | 1 | 0 | ✅ OK |
| **field_quotes** | 50 | 50 | 0 | ✅ OK |
| **field_payment_intents** | 35 | 35 | 0 | ✅ OK |
| **agent_commissions** | 0 | 0 | 0 | ✅ OK |
| **sales_commissions** | 12 | 12 | 0 | ✅ OK |

### 3H — INVENTAIRE ET TÉLÉPHONES

| Table | SOURCE | DEST | DELTA | STATUS |
|---|---|---|---|---|
| **phone_inventory** | **10** | **0** | **-10** | 🔴 PERDU |
| **phone_orders** | 0 | 0 | 0 | ✅ OK |
| **inventory_items** | 14 | 14 | 0 | ✅ OK |

---

## 4. TABLES PRÉSENTES DANS L'ANCIEN PROJET MAIS ABSENTES DU NOUVEAU

Ces tables **n'existent pas** dans le projet `lacxnbjvcyvhrttprkxr`. Toutes leurs données sont perdues.

| Table absente | Lignes perdues | Catégorie |
|---|---|---|
| `client_internal_notes` | **353** | Notes client internes |
| `email_templates` | **82** | Templates emails |
| `email_trigger_queue` | **704** | File d'attente email |
| `partner_program_terms` | **108** | Programme partenaires |
| `sop_documents` | **66** | Documents procédures |
| `identity_verification_events` | **63** | Vérification identité |
| `staff_schedules` | **61** | Horaires du personnel |
| `automatic_email_dispatches` | **189** | Envois email automatiques |
| `kyc_verifications` | **12** | Vérifications KYC |
| `hr_audit_log` | **36** | Logs audit RH |
| `payroll_entries` | **6** | Entrées de paie |
| `payroll_payment_events` | **25** | Événements paiement paie |
| `payroll_payments` | **5** | Paiements de paie |
| `payroll_runs` | **3** | Cycles de paie |
| `employment_letters` | **8** | Lettres d'emploi |
| `operational_fees` | **11** | Frais opérationnels |
| `pdf_generation_logs` | **40** | Logs génération PDF |
| `security_events` | **108** | Événements sécurité |
| `admin_security_audit` | **107** | Audit sécurité admin |
| `hub_certificates` | **3** | Certificats hub |
| `stripe_plan_mapping` | **32** | Mapping plans Stripe |
| `onboarding_sequences` | **5** | Séquences onboarding |
| `streaming_catalog` | **6** | Catalogue streaming |
| `admin_notification_settings` | **14** | Paramètres notifications admin |
| `admin_notification_logs` | **15** | Logs notifications admin |
| `client_testimonials` | **6** | Témoignages clients |
| `commission_rules` | **9** | Règles de commission |
| `field_bonus_rules` | **4** | Règles bonus terrain |
| `pay_periods` | **6** | Périodes de paie |
| `ledger_invoice_allocations` | **5** | Allocations factures ledger |
| `employee_payroll_settings` | **9** | Paramètres paie employés |
| `time_entries` | **8** | Entrées de temps |
| `jobs` | **77** | Offres d'emploi |
| `job_email_templates` | **22** | Templates email emploi |
| `hr_requests` | **1** | Demandes RH |
| `interview_answers` | **43→58** | Réponses entretiens |
| `ledger_entries` | 31 (vs 66 new) | Entrées ledger |
| `admin_users` | **2** | Utilisateurs admin séparés |
| `staff_roles` | **2** | Rôles du personnel |
| `staff_email_allowlist` | **2** | Liste autorisée emails staff |
| `rate_limits` | 1 | Limites de taux |
| `payment_gateway_settings` | 1 | Paramètres passerelle paiement |
| `commission_disputes` | 1 | Litiges commission |
| `loyalty_redemptions` | 1 | Échanges fidélité |
| `tax_brackets_federal` | 5 | Tranches fiscales fédérales |
| `tax_brackets_quebec` | 4 | Tranches fiscales Québec |
| `installation_steps_template` | 17→38 new | Étapes installation |
| `chatbot_logs` | 174→76 new | Logs chatbot |
| `technician_locations` | 0 | Localisations techniciens |
| `ticket_attachments` | 0 | Pièces jointes tickets |
| `ticket_participants` | 0 | Participants tickets |
| `identity_documents` | 0 | Documents identité |

---

## 5. INVENTAIRE COMPLET DES TABLES PAR NOMBRE DE LIGNES (NOUVEAU PROJET)

### Tables avec 0 ligne (105 tables)

```
account_followups, account_service_locations, account_tags, admin_auth_audit_log,
agent_commissions, appointment_blocked_dates, authorized_users, billing_alerts,
billing_subscription_services, cashout_requests, channel_activity_logs,
checkout_sessions, client_access_logs, client_admin_notes, client_autopay_settings,
client_billing_settings, client_checkups, client_direct_refunds, client_payment_plans,
client_referrals, collections_actions, commission_ledger_entries,
commission_withdrawal_requests, complaint_attachments, complaint_responses,
contact_requests, coverage_waitlist, crm_agent_quotas, crm_agent_status,
customer_access_sessions, customer_duplicate_checks, customer_portal_projection_logs,
customer_referral_usage, customer_security, defective_equipment_alerts,
document_requests, email_claim_challenges, employee_leave_requests, employee_notes,
employee_objectives, employee_operations_audit, employee_pin_attempts,
employee_pin_lockouts, employee_pin_unlocks, employee_recorded_payments,
employee_search_rate_limits, employee_shifts, field_agent_discounts,
field_commission_payout_items, field_commission_payouts, field_customer_addresses,
field_lead_activities, field_lead_tasks, field_objective_templates, field_order_notes,
field_resources, field_territory_streets, field_territory_visits, fulfillment_snapshots,
hub_contests, hub_notifications, hub_reactions, hub_ticket_messages, hub_tickets,
identity_verification_sessions, influencer_audit_log, influencer_payouts,
internet_diagnostics, internet_modem_actions, internet_plan_changes,
internet_static_ip_assignments, internet_wifi_settings, inventory_assignments,
inventory_stock, job_application_notes, loyalty_points, loyalty_transactions,
marketing_ai_replies, messages, mobile_addons, mobile_fulfillment, mobile_topups,
monthly_invoice_lines, monthly_invoices, network_nodes, order_documents,
order_internal_notes, order_snapshots, payment_disputes, payment_methods,
payment_proofs, phone_inventory, phone_orders, pin_invite_tokens, privacy_requests,
product_attributes, product_equipment_rules, product_prices, profile_change_requests,
provisioning_jobs, provisioning_log, quote_adjustments, rate_limit_lockouts,
replacement_internal_orders, replacement_order_items, replacement_orders,
replacement_request_tickets, replacement_shipments, replacement_timeline,
request_replies, retention_actions, rma_requests, security_audit_log,
security_incidents, service_addresses, service_cancellation_requests,
service_change_requests, shipments, sim_actions, step_up_sessions,
streaming_activation_tokens, support_tickets_ai, suppressed_emails,
suspension_requests, telecom_analytics, training_attendance, training_certifications,
training_exam_attempts, training_sessions, training_simulation_sessions,
tv_addon_subscriptions, tv_parental_controls, tv_plan_changes, tv_terminal_actions,
tv_vod_purchases, work_order_files
```

### Tables avec 1 à 10 lignes (64 tables)

| Table | Lignes |
|---|---|
| account_fraud_incidents | 1 |
| account_risk_scores | 1 |
| admin_security_codes | 1 |
| agent_points | 2 |
| attendance_records | 2 |
| auth_login_alerts_sent | 4 |
| billing | 6 |
| checkout_consent_records | 1 |
| client_pin_logs | 1 |
| complaints | 1 |
| core_settings | 2 |
| crm_assignment_history | 3 |
| crm_call_logs | 6 |
| employees | 2 |
| field_lead_activities | 0→1 | 
| field_order_status_history | 2 |
| field_order_sync_events | 2 |
| field_submissions | 1 |
| field_territories | 1 |
| hub_announcements | 1 |
| hub_calendar_events | 1 |
| hub_orders | 1 |
| hub_posts | 5 |
| hub_store_orders | 1 |
| identity_verification_sessions | 0 |
| influencer_invites | 1 |
| installation_appointments | 1 |
| internal_ticket_replies | 2 |
| internal_tickets | 2 |
| jobs | 2 |
| kyc_requests | 5 |
| nova_conversations | 1 |
| nova_reasoning_log | 2 |
| nova_decisions | 0 |
| order_automation_log | 8 |
| order_items | 4 |
| paypal_plan_cache | 4 |
| payments | 5 |
| push_subscriptions | 4 |
| replacement_tickets | 1 |
| site_pages | 7 |
| speedtest_results | 6 |
| system_status | 2 |
| tax_documents | 6 |
| technicians | 2 |
| training_simulations | 3 |
| web_form_email_map | 5 |
| web_form_messages | 5 |
| web_form_threads | 5 |
| work_orders | 4 |

### Tables avec données significatives (>10 lignes) — 139 tables

| Table | Lignes |
|---|---|
| account_adjustments | 9 |
| account_promotions | 2 |
| accounts | 17 |
| activation_request_history | 10 |
| activation_requests | 4 |
| activity_logs | 324 |
| address_serviceability_checks | 36 |
| admin_audit_log | 88 |
| admin_otp_codes | 3 |
| admin_otp_sessions | 307 |
| admin_secret_attempts | 5 |
| admin_secret_audit_log | 322 |
| **agent_audit_log** | **13 284** |
| agent_discount_assignments | 12 |
| agent_discounts | 14 |
| **agent_events** | **46 383** |
| agent_registry | 30 |
| **agent_runs** | **4 349** |
| analytics_reports | 33 |
| applicant_emails | 74 |
| appointment_slot_rules | 24 |
| appointments | 10 |
| assignment_rules | 5 |
| auth_login_attempts | 112 |
| auto_email_dispatch_log | 18 |
| billing_alerts | 0 |
| billing_automation_runs | 96 |
| billing_customers | 14 |
| billing_invoice_lines | 43 |
| **billing_invoices** | **17** |
| **billing_payments** | **12** |
| billing_subscription_trace_audit | 14 |
| **billing_subscriptions** | **11** |
| billing_system_alerts | 83 |
| campaign_sends | 45 |
| card_payment_intents | 13 |
| channel_packages | 16 |
| channel_selections | 17 |
| chatbot_logs | 76 |
| **client_activity_logs** | 9 |
| client_auto_documents | 54 |
| client_billing_preferences | 13 |
| client_documents | 7 |
| **client_errors** | **182** |
| client_login_pins | 25 |
| client_payment_methods | 3 |
| client_reviews | 7 |
| client_streaming_subscriptions | 3 |
| commission_plans | 1 |
| contracts | 12 |
| coverage_zones | 14 |
| **crm_contacts** | **659** |
| crm_scripts | 4 |
| crm_territories | 10 |
| csv_import_logs | 8 |
| **customer_portal_projection_alerts** | **53 000** |
| customer_portal_projection_events | 1 279 |
| **customer_portal_snapshots** | **711** |
| daily_backup_log | 86 |
| direct_email_recipients | 429 |
| direct_emails | 6 |
| directory_submissions | 20 |
| dob_validation_debug | 122 |
| **email_queue** | **2 383** |
| **email_send_log** | **6 348** |
| email_send_state | 1 |
| email_unsubscribe_tokens | 307 |
| employee_audit_logs | 26 |
| employee_notifications | 267 |
| employee_onboarding_forms | 10 |
| **employee_records** | 4 |
| employee_work_items | 142 |
| **equipment_inventory** | **83** |
| equipment_audit_log | 9 |
| equipment_order_lines | 4 |
| field_commissions | 15 |
| field_payment_intents | 35 |
| field_quotes | 50 |
| field_sales_config | 24 |
| **field_sales_orders** | **14** |
| field_sales_promotions | 12 |
| field_territory_assignments | 4 |
| hub_directory | 4 |
| hub_documents | 14 |
| hub_faq | 10 |
| hub_login_audit | 275 |
| hub_store_items | 18 |
| impersonation_sessions | 80 |
| influencers | 7 |
| installation_steps_template | 38 |
| **installations** | **51** |
| **internal_audit_log** | **3 002** |
| interview_answers | 43 |
| interview_questions | 10 |
| inventory_items | 14 |
| job_applicants | 24 |
| job_email_templates | 4 |
| **ledger_entries** | **66** |
| **live_activity_logs** | **8 308** |
| live_chat_admin_replies | 6 |
| live_chat_messages | 43 |
| live_chat_sessions | 29 |
| loyalty_rewards | 4 |
| marketing_ai_config | 2 |
| marketing_campaigns | 12 |
| marketing_conversations | 103 |
| marketing_settings | 11 |
| mobile_topups | 0 |
| network_nodes | 0 |
| notifications | 285 |
| nova_actions | 166 |
| nova_memory | 16 |
| order_status_history | 35 |
| **orders** | **15** |
| overdue_reminder_log | 39 |
| paypal_autopay_attempts | 11 |
| payroll_records | 7 |
| pdf_template_config | 10 |
| pending_document_jobs | 58 |
| **profiles** | **705** |
| promotion_redemptions | 31 |
| promotions | 11 |
| **provisioning_jobs** | 0 |
| quote_approvals | 3 |
| quote_events | 135 |
| quote_lines | 69 |
| **quotes** | **18** |
| **rate_limit_attempts** | **1 065** |
| referral_attributions | 5 |
| **referral_codes** | **714** |
| referral_program_settings | 2 |
| rma_requests | 0 |
| sales_commissions | 12 |
| sales_targets | 19 |
| security_action_logs | 13 |
| service_coverage_areas | 418 |
| service_incidents | 11 |
| service_instances | 12 |
| service_status | 9 |
| **services** | **36** |
| site_health_checks | 15 224 |
| site_offers | 15 |
| site_settings | 14 |
| sms_campaigns | 14 |
| social_media_posts | 19 |
| staff_client_access_sessions | 9 |
| staff_impersonation_sessions | 9 |
| staff_notifications | 97 |
| staff_onboarding_tokens | 23 |
| staff_otp_codes | 15 |
| streaming_services | 12 |
| subscriptions | 11 |
| supplier_accounts | 4 |
| **support_tickets** | **104** |
| **sync_audit_log** | **22 419** |
| technician_assignments | 7 |
| technician_slot_bookings | 44 |
| technician_slots | 208 |
| **telephony_logs** | **373** |
| **ticket_replies** | **242** |
| training_answers | 90 |
| training_certification_whitelist | 2 |
| training_lessons | 10 |
| training_modules | 10 |
| training_progress | 23 |
| training_questions | 100 |
| transaction_events | 37 |
| tv_channels | 178 |
| tv_pack_channels | 74 |
| tv_packs | 7 |
| **user_roles** | **708** |
| work_order_updates | 4 |

---

## 6. VÉRIFICATION DES DONNÉES CRITIQUES (avec plages de dates)

| Objet | Table | Count | Première date | Dernière date |
|---|---|---|---|---|
| **Clients (profiles)** | `profiles` | **705** | 2025-12-12 | 2026-06-14 |
| **Clients (source)** | CSV export | **800** | — | — |
| **Abonnements actifs** | `billing_subscriptions` (status=active) | **8** | 2025-12-12 | 2026-05-30 |
| **Abonnements annulés** | `billing_subscriptions` (status=cancelled) | **3** | — | — |
| **Factures** | `billing_invoices` | **17** | 2026-04-17 | 2026-06-13 |
| **Paiements billing** | `billing_payments` | **12** | 2026-04-17 | 2026-06-13 |
| **Paiements (autres)** | `payments` | **5** | 2026-01-15 | 2026-05-15 |
| **Commandes** | `orders` | **15** | 2025-12-12 | 2026-06-12 |
| **Équipements** | `equipment_inventory` | **83** | 2025-12-12 | 2026-05-30 |
| **Tickets support** | `support_tickets` | **104** | 2026-03-21 | 2026-06-14 |
| **Tickets (source)** | CSV export | **14 264** | — | — |
| **Work orders** | `work_orders` | **4** | 2026-03-07 | 2026-03-07 |
| **Documents clients** | `client_documents` | **7** | 2026-05-15 | 2026-05-30 |
| **Installations** | `installations` | **51** | 2026-03-06 | 2026-03-23 |
| **Contrats** | `contracts` | **12** | 2026-04-17 | 2026-05-30 |
| **Services internet** | `services` | **36** | 2025-12-30 | 2026-03-23 |
| **Techniciens** | `technicians` | **2** | 2026-01-01 | 2026-01-01 |
| **Employés** | `employees` | **2** | 2026-01-01 | 2026-03-20 |

---

## 7. SOURCES DE BACKUPS TROUVÉES

### Exports CSV de l'ancien projet
- **Chemin :** `C:\Users\Lavau\Downloads\exports_nivra_extracted\exports\`
- **Date d'export :** 2026-06-13 entre 06:36 et 06:43
- **Nombre de fichiers :** ~480 fichiers CSV
- **Contient :** toutes les tables du projet `xtgngmtxggascbxnswvb`
- **Taille totale :** >1 GB (fichier plus volumineux : `customer_portal_projection_logs.csv` = 1 025 733 KB)

### Archives Lovable (code source, PAS de données)
| Archive | Date extraction | Migrations SQL | ID Supabase confirmé |
|---|---|---|---|
| `telecom-zen-hub-5944136b-main` | 2026-03-05 | 401 fichiers (jusqu'au 2026-03-05) | `xtgngmtxggascbxnswvb` ✅ |
| `telecom-zen-hub-5944136b-main (1)` | 2026-03-05 | 401 fichiers (copie) | `xtgngmtxggascbxnswvb` ✅ |
| `telecom-zen-hub-b5f9c7c4-main` | 2026-03-09 | 437 fichiers (jusqu'au 2026-03-09) | `xtgngmtxggascbxnswvb` ✅ |
| `telecom-zen-hub-fb07c6b3-main-v4` | 2026-04-14 | 578 fichiers (jusqu'au 2026-04-14) | `xtgngmtxggascbxnswvb` ✅ |

**Note :** Ces 4 archives sont des exports du code React/Lovable. Elles ne contiennent **aucune donnée de base de données** — uniquement le schéma via les migrations SQL.

### Aucun dump SQL complet trouvé
- Aucun fichier `.dump`, `.backup`, `.bak`, `.gz` contenant un export pg_dump
- Aucun snapshot Supabase local
- Les 3 fichiers `.sql` dans `C:\Users\Lavau\.claude\jobs\` sont des corrections appliquées ce session, pas des backups

---

## 8. RAPPORT FINAL — SYNTHÈSE

### Tables migrées correctement (SOURCE = DEST ± tolérance)
**38 tables** ont un count identique ou très proche entre source et destination :
`crm_contacts`, `referral_codes`, `referral_attributions`, `contracts`, `service_instances`, `services`, `installations`, `equipment_inventory`, `work_orders`, `technicians`, `employees`, `client_documents`, `client_login_pins`, `subscriptions`, `tv_channels`, `email_send_log`, `live_activity_logs`, `sync_audit_log`, `customer_portal_snapshots`, `agent_events`, `agent_runs`, `internal_audit_log`, `channel_selections`, `impersonation_sessions`, `client_auto_documents`, `field_commissions`, `field_quotes`, `field_payment_intents`, `field_leads`, `field_territory_assignments`, `activity_logs`, `influencers`, `direct_email_recipients`, `paypal_autopay_attempts`, `customer_portal_projection_events`, `marketing_conversations`, `sms_campaigns (partiel)`, et plusieurs tables de logs/audit

### Tables partiellement migrées
| Table | Source | Dest | % récupéré |
|---|---|---|---|
| `profiles` | 800 | 705 | 88% |
| `email_queue` | 5 456 | 2 383 | 44% |
| `marketing_campaigns` | 270 | 12 | 4% |
| `agent_audit_log` | 13 753 | 13 284 | 97% |
| `customer_portal_projection_alerts` | 208 282 | 53 000 | 25% |
| `sms_campaigns` | 18 | 14 | 78% |
| `social_media_posts` | 104 | 19 | 18% |
| `hub_posts` | 47 | 5 | 11% |
| `marketing_ai_config` | 20 | 2 | 10% |
| `direct_emails` | 70 | 6 | 9% |
| `training_lessons` | 1 756 | 10 | 0.6% |
| `training_modules` | 1 104 | 10 | 0.9% |

### Tables jamais migrées (données dans source, 0 dans destination)
| Table | Lignes perdues |
|---|---|
| `support_tickets` | **14 160** (sur 14 264 total) |
| `ticket_replies` | **33 631** (sur 33 873 total) |
| `orders` | **41** (sur 56 total) |
| `quotes` | **177** (sur 195 total) |
| `billing_subscription_services` | **17** |
| `service_addresses` | **17** |
| `loyalty_points` | **3** |
| `loyalty_transactions` | **4** |
| `phone_inventory` | **10** |
| `client_referrals` | **2** |
| `customer_portal_projection_logs` | **661 218** |
| `field_sales_orders` | **13** (sur 27 total) |

### Données perdues sans possibilité de récupération depuis la DB

Ces données **n'existent ni dans le nouveau projet ni dans un fichier SQL local** :
- **14 160 tickets support** historiques
- **33 631 réponses de tickets** historiques
- **353 notes internes clients** (table `client_internal_notes` — absente du nouveau projet)
- **82 templates email** (table `email_templates` — absente)
- **704 emails en file** (table `email_trigger_queue` — absente)
- **108 événements sécurité** (table `security_events` — absente)
- **66 documents SOP** (table `sop_documents` — absente)
- **61 horaires personnel** (table `staff_schedules` — absente)
- **12 vérifications KYC** (table `kyc_verifications` — absente)
- Données de paie : `payroll_entries`(6), `payroll_payments`(5), `payroll_runs`(3), `payroll_payment_events`(25)
- **95 profils clients** non migrés (800 → 705)

### Données récupérables depuis les exports CSV

Les fichiers CSV dans `C:\Users\Lavau\Downloads\exports_nivra_extracted\exports\` contiennent **toutes les données de l'ancien projet**. Il est possible d'importer :

| Priorité | Table | Lignes | Méthode |
|---|---|---|---|
| 🔴 CRITIQUE | `support_tickets` | 14 264 | Import CSV via Supabase |
| 🔴 CRITIQUE | `ticket_replies` | 33 873 | Import CSV via Supabase |
| 🔴 CRITIQUE | `profiles` (95 manquants) | 95 | Import CSV filtré |
| 🔴 CRITIQUE | `client_internal_notes` | 353 | Créer table + Import CSV |
| 🔴 HAUTE | `orders` (41 manquants) | 41 | Import CSV filtré |
| 🔴 HAUTE | `email_templates` | 82 | Créer table + Import CSV |
| 🟡 HAUTE | `training_lessons` | 1 746 | Import CSV |
| 🟡 HAUTE | `training_modules` | 1 094 | Import CSV |
| 🟡 HAUTE | `marketing_campaigns` | 258 | Import CSV |
| 🟡 HAUTE | `service_addresses` | 17 | Import CSV |
| 🟡 HAUTE | `billing_subscription_services` | 17 | Import CSV |
| 🟡 MOYENNE | `hub_posts` | 42 | Import CSV |
| 🟡 MOYENNE | `social_media_posts` | 85 | Import CSV |
| 🟡 MOYENNE | `phone_inventory` | 10 | Import CSV |
| 🟢 BASSE | Données de paie | ~44 | Créer tables + Import CSV |
| 🟢 BASSE | `sop_documents` | 66 | Créer table + Import CSV |
| 🟢 BASSE | `staff_schedules` | 61 | Créer table + Import CSV |

---

## 9. PLAN DE RESTAURATION

### Étape 1 — Restaurer les tickets support (URGENT)
```bash
# Les 14264 tickets sont dans :
# C:\Users\Lavau\Downloads\exports_nivra_extracted\exports\support_tickets.csv
# C:\Users\Lavau\Downloads\exports_nivra_extracted\exports\ticket_replies.csv

# Option A : Supabase Dashboard → Table Editor → Import CSV
# Option B : Script d'import via Supabase Management API (POST /database/query)
# Attention : vérifier les foreign keys (profiles, employees) avant import
```

### Étape 2 — Créer les tables manquantes et importer
Tables à créer dans le nouveau projet (schéma à récupérer depuis les migrations Lovable) :
- `client_internal_notes` → schéma dans `telecom-zen-hub-*-main/supabase/migrations/`
- `email_templates` → idem
- `sop_documents`, `staff_schedules`, etc.

### Étape 3 — Compléter les profils clients
```sql
-- 95 profils manquants entre CSV (800) et DB (705)
-- Comparer les IDs pour identifier les manquants
-- Importer uniquement les profils absents (éviter doublons)
```

### Étape 4 — Restaurer les données de paie
Tables à créer : `payroll_entries`, `payroll_payments`, `payroll_runs`, `payroll_payment_events`, `pay_periods`

### Étape 5 — Restaurer les données de formation
```bash
# training_lessons.csv = 1756 leçons
# training_modules.csv = 1104 modules
# Import via Supabase Table Editor
```

---

## 10. CONCLUSION

**Ce qui est confirmé avec preuves :**

1. **L'ancien projet `xtgngmtxggascbxnswvb` existe** — confirmé par les `.env` des 4 archives Lovable
2. **L'ancien projet est inaccessible via Management API** — HTTP 403 sur tous les endpoints, absent de la liste des projets
3. **Les données de l'ancien projet ont été exportées le 2026-06-13** — 480 CSV dans `exports_nivra_extracted`
4. **La migration est INCOMPLÈTE** — 14 160 tickets, 33 631 réponses, 1 094 modules de formation, et 47+ tables absentes
5. **Les données récupérables existent localement** — les CSV sont disponibles pour réimport immédiat
6. **Le nouveau projet est ACTIF** — créé le 2026-06-02, ACTIVE_HEALTHY, données depuis 2025-12-12

**Ce que je ne peux pas prouver :**
- Pourquoi l'ancien projet est inaccessible (supprimé ? suspendu ? autre compte ?)
- Si la migration a été intentionnelle (nouveau départ) ou accidentelle (projet coupé)
- Les données qui existaient dans l'ancien projet AVANT les exports CSV du 2026-06-13
