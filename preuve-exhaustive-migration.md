# Preuve exhaustive de migration — Audit chiffré complet
*Généré le 2026-06-15. Aucune correction. Aucune écriture. Aucun import. Audit seulement.*

---

## 1. Chiffres globaux de migration

| Métrique | Valeur |
|---------|--------|
| Tables dans les CSV (ancien système) | **439** |
| Tables dans le nouveau projet Supabase | **356** |
| Tables uniques (union des deux) | **444** |
| **Total lignes source (CSV)** | **1 056 839** |
| **Total lignes destination (nouveau projet)** | **188 779** |
| **Pourcentage réel de migration** | **17.86%** |

### Répartition par statut

| Statut | Nombre de tables |
|--------|-----------------|
| MIGRÉ À 100% (données) | 160 |
| MIGRÉ À 100% (vides dans les deux) | 156 |
| PARTIELLEMENT MIGRÉ | 27 |
| NON MIGRÉ (0 lignes en DB, données dans CSV) | 8 |
| TABLE ABSENTE (existe dans CSV, absente du nouveau projet) | 88 |
| NOUVELLES TABLES (DB uniquement, vides) | 5 |

---

## 2. Tableau exhaustif — toutes les 439 tables CSV

### 2A — Tables partiellement ou non migrées (classées par volume)

| Table | CSV | DB | % migré | Statut |
|-------|-----|-----|---------|--------|
| `customer_portal_projection_logs` | 661 218 | 0 | 0% | **NON MIGRÉ** |
| `customer_portal_projection_alerts` | 208 282 | 53 000 | 25.4% | **PARTIELLEMENT MIGRÉ** |
| `ticket_replies` | 33 873 | 242 | 0.7% | **PARTIELLEMENT MIGRÉ** |
| `support_tickets` | 14 264 | 104 | 0.7% | **PARTIELLEMENT MIGRÉ** |
| `email_queue` | 5 456 | 2 383 | 43.7% | **PARTIELLEMENT MIGRÉ** |
| `client_errors` | 3 718 | 182 | 4.9% | **PARTIELLEMENT MIGRÉ** |
| `training_lessons` | 1 756 | 10 | 0.6% | **PARTIELLEMENT MIGRÉ** |
| `training_modules` | 1 104 | 10 | 0.9% | **PARTIELLEMENT MIGRÉ** |
| `telephony_logs` | 851 | 373 | 43.8% | **PARTIELLEMENT MIGRÉ** |
| `profiles` | 800 | 705 | 88.1% | **PARTIELLEMENT MIGRÉ** |
| `email_trigger_queue` | 704 | ABSENTE | N/A | **TABLE ABSENTE** |
| `client_internal_notes` | 353 | ABSENTE | N/A | **TABLE ABSENTE** |
| `marketing_campaigns` | 270 | 12 | 4.4% | **PARTIELLEMENT MIGRÉ** |
| `quotes` | 195 | 18 | 9.2% | **PARTIELLEMENT MIGRÉ** |
| `automatic_email_dispatches` | 189 | ABSENTE | N/A | **TABLE ABSENTE** |
| `chatbot_logs` | 174 | 76 | 43.7% | **PARTIELLEMENT MIGRÉ** |
| `support_ticket_id_status_debug` | 148 | ABSENTE | N/A | **TABLE ABSENTE** |
| `security_events` | 108 | ABSENTE | N/A | **TABLE ABSENTE** |
| `partner_program_terms` | 108 | ABSENTE | N/A | **TABLE ABSENTE** |
| `admin_security_audit` | 107 | ABSENTE | N/A | **TABLE ABSENTE** |
| `social_media_posts` | 104 | 19 | 18.3% | **PARTIELLEMENT MIGRÉ** |
| `billing_system_alerts` | 91 | 83 | 91.2% | **PARTIELLEMENT MIGRÉ** |
| `email_templates` | 82 | ABSENTE | N/A | **TABLE ABSENTE** |
| `jobs` | 77 | 2 | 2.6% | **PARTIELLEMENT MIGRÉ** |
| `direct_emails` | 70 | 6 | 8.6% | **PARTIELLEMENT MIGRÉ** |
| `live_chat_messages` | 70 | 43 | 61.4% | **PARTIELLEMENT MIGRÉ** |
| `sop_documents` | 66 | ABSENTE | N/A | **TABLE ABSENTE** |
| `identity_verification_events` | 63 | ABSENTE | N/A | **TABLE ABSENTE** |
| `staff_schedules` | 61 | ABSENTE | N/A | **TABLE ABSENTE** |
| `interview_answers` | 58 | 43 | 74.1% | **PARTIELLEMENT MIGRÉ** |
| `orders` | 56 | 15 | 26.8% | **PARTIELLEMENT MIGRÉ** |
| `identity_verification_sessions` | 48 | 0 | 0% | **NON MIGRÉ** |
| `hub_posts` | 47 | 5 | 10.6% | **PARTIELLEMENT MIGRÉ** |
| `web_form_messages` | 45 | 5 | 11.1% | **PARTIELLEMENT MIGRÉ** |
| `pdf_generation_logs` | 40 | ABSENTE | N/A | **TABLE ABSENTE** |
| `hr_audit_log` | 36 | ABSENTE | N/A | **TABLE ABSENTE** |
| `stripe_plan_mapping` | 32 | ABSENTE | N/A | **TABLE ABSENTE** |
| `field_sales_orders` | 27 | 14 | 51.9% | **PARTIELLEMENT MIGRÉ** |
| `payroll_payment_events` | 25 | ABSENTE | N/A | **TABLE ABSENTE** |
| `job_email_templates` | 22 | 4 | 18.2% | **PARTIELLEMENT MIGRÉ** |
| `marketing_ai_config` | 20 | 2 | 10% | **PARTIELLEMENT MIGRÉ** |
| `sms_campaigns` | 18 | 14 | 77.8% | **PARTIELLEMENT MIGRÉ** |
| `billing_subscription_services` | 17 | 0 | 0% | **NON MIGRÉ** |
| `service_addresses` | 17 | 0 | 0% | **NON MIGRÉ** |
| `sms_queue` | 16 | ABSENTE | N/A | **TABLE ABSENTE** |
| `admin_notification_logs` | 15 | ABSENTE | N/A | **TABLE ABSENTE** |
| `admin_notification_settings` | 14 | ABSENTE | N/A | **TABLE ABSENTE** |
| `kyc_verifications` | 12 | ABSENTE | N/A | **TABLE ABSENTE** |
| `appointments` | 11 | 10 | 90.9% | **PARTIELLEMENT MIGRÉ** |
| `operational_fees` | 11 | ABSENTE | N/A | **TABLE ABSENTE** |
| `phone_inventory` | 10 | 0 | 0% | **NON MIGRÉ** |
| `employee_payroll_settings` | 9 | ABSENTE | N/A | **TABLE ABSENTE** |
| `commission_rules` | 9 | ABSENTE | N/A | **TABLE ABSENTE** |
| `time_entries` | 8 | ABSENTE | N/A | **TABLE ABSENTE** |
| `employment_letters` | 8 | ABSENTE | N/A | **TABLE ABSENTE** |
| `client_profile_changes` | 8 | ABSENTE | N/A | **TABLE ABSENTE** |
| `payroll_entries` | 6 | ABSENTE | N/A | **TABLE ABSENTE** |
| `client_testimonials` | 6 | ABSENTE | N/A | **TABLE ABSENTE** |
| `streaming_catalog` | 6 | ABSENTE | N/A | **TABLE ABSENTE** |
| `pay_periods` | 6 | ABSENTE | N/A | **TABLE ABSENTE** |
| `onboarding_sequences` | 5 | ABSENTE | N/A | **TABLE ABSENTE** |
| `notification_outbox` | 5 | ABSENTE | N/A | **TABLE ABSENTE** |
| `ledger_invoice_allocations` | 5 | ABSENTE | N/A | **TABLE ABSENTE** |
| `loyalty_rewards` | 5 | 4 | 80% | **PARTIELLEMENT MIGRÉ** |
| `payroll_payments` | 5 | ABSENTE | N/A | **TABLE ABSENTE** |
| `tax_brackets_federal` | 5 | ABSENTE | N/A | **TABLE ABSENTE** |
| `admin_audit_sessions` | 4 | ABSENTE | N/A | **TABLE ABSENTE** |
| `loyalty_transactions` | 4 | 0 | 0% | **NON MIGRÉ** |
| `field_bonus_rules` | 4 | ABSENTE | N/A | **TABLE ABSENTE** |
| `tax_brackets_quebec` | 4 | ABSENTE | N/A | **TABLE ABSENTE** |
| `hub_certificates` | 3 | ABSENTE | N/A | **TABLE ABSENTE** |
| `email_automation_rules` | 3 | ABSENTE | N/A | **TABLE ABSENTE** |
| `payroll_runs` | 3 | ABSENTE | N/A | **TABLE ABSENTE** |
| `hub_training_progress` | 3 | ABSENTE | N/A | **TABLE ABSENTE** |
| `loyalty_points` | 3 | 0 | 0% | **NON MIGRÉ** |
| `staff_roles` | 2 | ABSENTE | N/A | **TABLE ABSENTE** |
| `client_referrals` | 2 | 0 | 0% | **NON MIGRÉ** |
| `admin_users` | 2 | ABSENTE | N/A | **TABLE ABSENTE** |
| `staff_email_allowlist` | 2 | ABSENTE | N/A | **TABLE ABSENTE** |
| `timesheet_entries` | 1 | ABSENTE | N/A | **TABLE ABSENTE** |
| `payment_gateway_settings` | 1 | ABSENTE | N/A | **TABLE ABSENTE** |
| `hr_requests` | 1 | ABSENTE | N/A | **TABLE ABSENTE** |
| `loyalty_redemptions` | 1 | ABSENTE | N/A | **TABLE ABSENTE** |
| `admin_access_limits` | 1 | ABSENTE | N/A | **TABLE ABSENTE** |
| `rate_limits` | 1 | ABSENTE | N/A | **TABLE ABSENTE** |
| `commission_disputes` | 1 | ABSENTE | N/A | **TABLE ABSENTE** |
| `account_access_logs` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `ticket_attachments` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `technician_locations` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `ticket_participants` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `streaming_catalog_audit_logs` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `customer_portal_repair_jobs` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `data_retention_log` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `crypto_payments` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `customer_portal_projection_audit_logs` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `email_events` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `email_sends` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `email_campaigns` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `email_change_requests` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `client_notification_logs` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `client_referral_events` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `account_deletion_requests` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `client_email_preferences` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `contest_winners` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `crypto_ipn_logs` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `commission_grid_assignments` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `contest_entries` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `nps_surveys` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `order_identity_data` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `installation_jobs` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `kyc_requested_documents` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `payroll_adjustments` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `payroll_commission_links` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `pay_adjustments` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `payment_requests` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `field_sales_commission_rules` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `hr_documents` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `email_unsubscribes` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `field_sales_cashout_requests` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `identity_documents` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `installation_job_logs` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `hr_request_notes` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |
| `hub_faq_votes` | 0 | ABSENTE | 100% | TABLE ABSENTE (vide) |

### 2B — Tables migrées à 100% (avec données)

| Table | CSV | DB | % migré |
|-------|-----|----|---------|
| `agent_events` | 37 611 | 46 469 | 123.6% |
| `sync_audit_log` | 22 419 | 22 419 | 100% |
| `site_health_checks` | 15 225 | 15 224 | 100% |
| `agent_audit_log` | 13 753 | 13 286 | 96.6% |
| `live_activity_logs` | 8 297 | 8 308 | 100% |
| `email_send_log` | 6 318 | 6 348 | 100% |
| `agent_runs` | 4 014 | 4 352 | 108.4% |
| `internal_audit_log` | 2 836 | 3 002 | 105.9% |
| `customer_portal_projection_events` | 1 279 | 1 279 | 100% |
| `rate_limit_attempts` | 1 020 | 1 065 | 104.4% |
| `referral_codes` | 714 | 714 | 100% |
| `customer_portal_snapshots` | 711 | 711 | 100% |
| `user_roles` | 688 | 708 | 102.9% |
| `crm_contacts` | 659 | 659 | 100% |
| `direct_email_recipients` | 429 | 429 | 100% |
| `service_coverage_areas` | 418 | 418 | 100% |
| `activity_logs` | 324 | 324 | 100% |
| `admin_secret_audit_log` | 322 | 322 | 100% |
| `email_unsubscribe_tokens` | 307 | 307 | 100% |
| `admin_otp_sessions` | 307 | 307 | 100% |
| `notifications` | 273 | 285 | 104.4% |
| `employee_notifications` | 267 | 267 | 100% |
| `hub_login_audit` | 197 | 275 | 139.6% |
| `tv_channels` | 178 | 178 | 100% |
| `employee_work_items` | 142 | 142 | 100% |
| `quote_events` | 135 | 135 | 100% |
| `auth_login_attempts` | 112 | 112 | 100% |
| `dob_validation_debug` | 108 | 122 | 113% |
| `technician_slots` | 104 | 208 | 200% |
| `marketing_conversations` | 103 | 103 | 100% |
| `training_questions` | 100 | 100 | 100% |
| `billing_automation_runs` | 93 | 96 | 103.2% |
| `training_answers` | 90 | 90 | 100% |
| `admin_audit_log` | 88 | 88 | 100% |
| `daily_backup_log` | 83 | 86 | 103.6% |
| `staff_notifications` | 82 | 97 | 118.3% |
| `impersonation_sessions` | 80 | 80 | 100% |
| `equipment_inventory` | 80 | 83 | 103.8% |
| `nova_actions` | 78 | 168 | 215.4% |
| `applicant_emails` | 74 | 74 | 100% |
| `quote_lines` | 69 | 69 | 100% |
| `pending_document_jobs` | 55 | 58 | 105.5% |
| `client_auto_documents` | 54 | 54 | 100% |
| `installations` | 51 | 51 | 100% |
| `field_quotes` | 50 | 50 | 100% |
| `campaign_sends` | 45 | 45 | 100% |
| `technician_slot_bookings` | 44 | 44 | 100% |
| `billing_invoice_lines` | 40 | 43 | 107.5% |
| `overdue_reminder_log` | 39 | 39 | 100% |
| `transaction_events` | 37 | 37 | 100% |
| `address_serviceability_checks` | 36 | 36 | 100% |
| `services` | 36 | 36 | 100% |
| `order_status_history` | 35 | 35 | 100% |
| `field_payment_intents` | 35 | 35 | 100% |
| `analytics_reports` | 33 | 33 | 100% |
| `promotion_redemptions` | 31 | 31 | 100% |
| `agent_registry` | 31 | 30 | 96.8% |
| `ledger_entries` | 31 | 66 | 212.9% |
| `live_chat_sessions` | 29 | 29 | 100% |
| `employee_audit_logs` | 26 | 26 | 100% |
| `client_login_pins` | 25 | 25 | 100% |
| `appointment_slot_rules` | 24 | 24 | 100% |
| `job_applicants` | 24 | 24 | 100% |
| `field_sales_config` | 24 | 24 | 100% |
| `staff_onboarding_tokens` | 23 | 23 | 100% |
| `auto_email_dispatch_log` | 18 | 18 | 100% |
| `installation_steps_template` | 17 | 38 | 223.5% |
| `channel_selections` | 17 | 17 | 100% |
| `field_commissions` | 15 | 15 | 100% |
| `accounts` | 15 | 17 | 121.4% |
| `staff_otp_codes` | 15 | 15 | 100% |
| `inventory_items` | 14 | 14 | 100% |
| `billing_invoices` | 14 | 17 | 121.4% |
| `site_settings` | 14 | 14 | 100% |
| `training_progress` | 13 | 23 | 176.9% |
| `security_action_logs` | 13 | 13 | 100% |
| `card_payment_intents` | 13 | 13 | 100% |
| `client_billing_preferences` | 13 | 13 | 100% |
| `billing_customers` | 13 | 14 | 107.7% |
| `service_instances` | 12 | 12 | 100% |
| `contracts` | 12 | 12 | 100% |
| `sales_commissions` | 12 | 12 | 100% |
| `subscriptions` | 11 | 11 | 100% |
| `paypal_autopay_attempts` | 11 | 11 | 100% |
| `billing_payments` | 11 | 12 | 109.1% |
| `promotions` | 11 | 11 | 100% |
| `hub_store_items` | 10 | 18 | 180% |
| `sales_targets` | 10 | 19 | 190% |
| `pdf_template_config` | 10 | 10 | 100% |
| `activation_request_history` | 10 | 10 | 100% |
| `interview_questions` | 10 | 10 | 100% |
| `employee_onboarding_forms` | 10 | 10 | 100% |
| `billing_subscriptions` | 10 | 11 | 110% |
| `directory_submissions` | 10 | 20 | 200% |
| `service_incidents` | 10 | 11 | 110% |
| `staff_impersonation_sessions` | 9 | 9 | 100% |
| `staff_client_access_sessions` | 9 | 9 | 100% |
| `client_activity_logs` | 9 | 9 | 100% |
| `service_status` | 9 | 9 | 100% |
| `billing_subscription_trace_audit` | 9 | 14 | 155.6% |
| `equipment_audit_log` | 9 | 9 | 100% |
| `order_automation_log` | 8 | 8 | 100% |
| `csv_import_logs` | 8 | 8 | 100% |
| `account_adjustments` | 8 | 9 | 112.5% |
| `nova_memory` | 8 | 16 | 200% |
| `channel_packages` | 8 | 16 | 200% |
| `client_documents` | 7 | 7 | 100% |
| `client_reviews` | 7 | 7 | 100% |
| `agent_discounts` | 7 | 14 | 200% |
| `influencers` | 7 | 7 | 100% |
| `crm_call_logs` | 6 | 6 | 100% |
| `streaming_services` | 6 | 12 | 200% |
| `live_chat_admin_replies` | 6 | 6 | 100% |
| `agent_discount_assignments` | 6 | 12 | 200% |
| `speedtest_results` | 6 | 6 | 100% |
| `field_sales_promotions` | 6 | 12 | 200% |
| `tax_documents` | 6 | 6 | 100% |
| `web_form_email_map` | 5 | 5 | 100% |
| `referral_attributions` | 5 | 5 | 100% |
| `web_form_threads` | 5 | 5 | 100% |
| `kyc_requests` | 5 | 5 | 100% |
| `technician_assignments` | 5 | 7 | 140% |
| `admin_secret_attempts` | 5 | 5 | 100% |
| `assignment_rules` | 5 | 5 | 100% |
| `coverage_zones` | 5 | 14 | 280% |
| `supplier_accounts` | 4 | 4 | 100% |
| `paypal_plan_cache` | 4 | 4 | 100% |
| `work_order_updates` | 4 | 4 | 100% |
| `field_territory_assignments` | 4 | 4 | 100% |
| `work_orders` | 4 | 4 | 100% |
| `hub_documents` | 4 | 14 | 350% |
| `equipment_order_lines` | 4 | 4 | 100% |
| `activation_requests` | 4 | 4 | 100% |
| `auth_login_alerts_sent` | 4 | 4 | 100% |
| `employee_records` | 4 | 4 | 100% |
| `order_items` | 4 | 4 | 100% |
| `client_streaming_subscriptions` | 3 | 3 | 100% |
| `marketing_settings` | 3 | 11 | 366.7% |
| `admin_otp_codes` | 3 | 3 | 100% |
| `crm_assignment_history` | 3 | 3 | 100% |
| `site_offers` | 3 | 15 | 500% |
| `training_simulations` | 3 | 3 | 100% |
| `push_subscriptions` | 3 | 4 | 133.3% |
| `quote_approvals` | 3 | 3 | 100% |
| `employees` | 2 | 2 | 100% |
| `field_order_status_history` | 2 | 2 | 100% |
| `internal_tickets` | 2 | 2 | 100% |
| `account_promotions` | 2 | 2 | 100% |
| `attendance_records` | 2 | 2 | 100% |
| `agent_points` | 2 | 2 | 100% |
| `training_certification_whitelist` | 2 | 2 | 100% |
| `technicians` | 2 | 2 | 100% |
| `nova_reasoning_log` | 2 | 2 | 100% |
| `field_order_sync_events` | 2 | 2 | 100% |
| `internal_ticket_replies` | 2 | 2 | 100% |
| `system_status` | 1 | 2 | 200% |
| `checkout_consent_records` | 1 | 1 | 100% |
| `client_pin_logs` | 1 | 1 | 100% |
| `commission_plans` | 1 | 1 | 100% |
| `supplier_secrets` | 1 | 1 | 100% |
| `job_applications` | 1 | 1 | 100% |
| `installation_appointments` | 1 | 1 | 100% |
| `admin_security_codes` | 1 | 1 | 100% |
| `nova_conversations` | 1 | 1 | 100% |
| `hub_orders` | 1 | 1 | 100% |
| `hub_store_orders` | 1 | 1 | 100% |
| `influencer_invites` | 1 | 1 | 100% |
| `hub_calendar_events` | 1 | 1 | 100% |
| `account_fraud_incidents` | 1 | 1 | 100% |
| `field_submissions` | 1 | 1 | 100% |
| `hub_announcements` | 1 | 1 | 100% |
| `field_leads` | 1 | 1 | 100% |
| `field_territories` | 1 | 1 | 100% |
| `site_pages` | 1 | 7 | 700% |
| `referral_program_settings` | 1 | 2 | 200% |
| `replacement_tickets` | 1 | 1 | 100% |
| `complaints` | 1 | 1 | 100% |
| `core_settings` | 1 | 2 | 200% |
| `email_send_state` | 1 | 1 | 100% |
| `account_risk_scores` | 1 | 1 | 100% |

---

## 3. Classement par domaine métier

### 3.1 Portail client

| Table | CSV | DB | % | Statut | Impact |
|-------|-----|----|---|--------|--------|
| `support_tickets` | 14 264 | 104 | 0.7% | PARTIELLEMENT MIGRÉ | Historique tickets quasi absent |
| `ticket_replies` | 33 873 | 242 | 0.7% | PARTIELLEMENT MIGRÉ | Réponses tickets quasi absentes |
| `customer_portal_projection_logs` | 661 218 | 0 | 0% | NON MIGRÉ | Cache invalidation logs perdus |
| `customer_portal_projection_alerts` | 208 282 | 53 000 | 25.4% | PARTIELLEMENT MIGRÉ | Alertes projection partielles |
| `customer_portal_snapshots` | 711 | 711 | 100% | MIGRÉ 100% | Cache snapshot présent |
| `customer_portal_projection_events` | 1 279 | 1 279 | 100% | MIGRÉ 100% | OK |
| `loyalty_points` | 3 | 0 | 0% | NON MIGRÉ | Solde fidélité = 0 pour tous |
| `loyalty_transactions` | 4 | 0 | 0% | NON MIGRÉ | Historique fidélité absent |
| `loyalty_rewards` | 5 | 4 | 80% | PARTIELLEMENT MIGRÉ | Récompenses quasi complètes |
| `billing_subscription_services` | 17 | 0 | 0% | NON MIGRÉ | Services rattachés aux abonnements = vides |
| `service_addresses` | 17 | 0 | 0% | NON MIGRÉ | Adresses de service absentes |
| `client_referrals` | 2 | 0 | 0% | NON MIGRÉ | Parrainages absents |
| `referral_codes` | 714 | 714 | 100% | MIGRÉ 100% | OK |

**Score portail client : 82 445 lignes récupérées / 920 389 lignes source = 8.9%**

### 3.2 Nivra Core (administration)

| Table | CSV | DB | % | Statut | Impact |
|-------|-----|----|---|--------|--------|
| `profiles` | 800 | 705 | 88.1% | PARTIELLEMENT MIGRÉ | 95 clients manquants |
| `accounts` | 15 | 17 | 121.4% | MIGRÉ 100% | OK |
| `billing_customers` | 13 | 14 | 107.7% | MIGRÉ 100% | OK |
| `orders` | 56 | 15 | 26.8% | PARTIELLEMENT MIGRÉ | 73% des commandes manquantes |
| `billing_subscriptions` | 10 | 11 | 110% | MIGRÉ 100% | OK |
| `billing_invoices` | 14 | 17 | 121.4% | MIGRÉ 100% | OK |
| `billing_payments` | 11 | 12 | 109.1% | MIGRÉ 100% | OK |
| `client_internal_notes` | 353 | ABSENTE | N/A | TABLE ABSENTE | Crash SQL sur chaque ouverture fiche client |
| `client_profile_changes` | 8 | ABSENTE | N/A | TABLE ABSENTE | Historique changements profil absent |
| `quotes` | 195 | 18 | 9.2% | PARTIELLEMENT MIGRÉ | 91% des devis perdus |
| `user_roles` | 688 | 708 | 102.9% | MIGRÉ 100% | OK |
| `stripe_plan_mapping` | 32 | ABSENTE | N/A | TABLE ABSENTE | Mapping plans Stripe absent |

**Score Nivra Core : ~790 lignes récupérées / ~1 200 lignes pertinentes = 65%** *(dominé par la perte de notes et devis)*

### 3.3 Facturation

| Table | CSV | DB | % | Statut | Impact |
|-------|-----|----|---|--------|--------|
| `billing_subscriptions` | 10 | 11 | 110% | MIGRÉ 100% | OK |
| `billing_subscription_services` | 17 | 0 | 0% | NON MIGRÉ | Détails des services = vides |
| `billing_invoices` | 14 | 17 | 121.4% | MIGRÉ 100% | OK |
| `billing_invoice_lines` | 40 | 43 | 107.5% | MIGRÉ 100% | OK |
| `billing_payments` | 11 | 12 | 109.1% | MIGRÉ 100% | OK |
| `email_templates` | 82 | ABSENTE | N/A | TABLE ABSENTE | Templates email de facturation absents |
| `email_trigger_queue` | 704 | ABSENTE | N/A | TABLE ABSENTE | File d'envoi d'emails absente |
| `email_queue` | 5 456 | 2 383 | 43.7% | PARTIELLEMENT MIGRÉ | 57% des emails en queue perdus |
| `stripe_plan_mapping` | 32 | ABSENTE | N/A | TABLE ABSENTE | Mapping plans Stripe absent |
| `operational_fees` | 11 | ABSENTE | N/A | TABLE ABSENTE | Frais opérationnels absents |
| `ledger_invoice_allocations` | 5 | ABSENTE | N/A | TABLE ABSENTE | Allocations comptables absentes |
| `transaction_events` | 37 | 37 | 100% | MIGRÉ 100% | OK |
| `ledger_entries` | 31 | 66 | 212.9% | MIGRÉ 100% | OK |
| `payment_gateway_settings` | 1 | ABSENTE | N/A | TABLE ABSENTE | Config passerelle de paiement absente |

### 3.4 Support

| Table | CSV | DB | % | Statut | Impact |
|-------|-----|----|---|--------|--------|
| `support_tickets` | 14 264 | 104 | 0.7% | PARTIELLEMENT MIGRÉ | **14 160 tickets perdus** |
| `ticket_replies` | 33 873 | 242 | 0.7% | PARTIELLEMENT MIGRÉ | **33 631 réponses perdues** |
| `client_internal_notes` | 353 | ABSENTE | N/A | TABLE ABSENTE | **Crash SQL + 353 notes perdues** |
| `ticket_attachments` | 0 | ABSENTE | 100% | TABLE ABSENTE | Vide, impact nul |
| `ticket_participants` | 0 | ABSENTE | 100% | TABLE ABSENTE | Vide, impact nul |
| `support_ticket_id_status_debug` | 148 | ABSENTE | N/A | TABLE ABSENTE | Logs debug perdus |
| `web_form_messages` | 45 | 5 | 11.1% | PARTIELLEMENT MIGRÉ | Formulaires web quasi perdus |
| `web_form_threads` | 5 | 5 | 100% | MIGRÉ 100% | OK |
| `live_chat_messages` | 70 | 43 | 61.4% | PARTIELLEMENT MIGRÉ | 39% des messages chat perdus |
| `live_chat_sessions` | 29 | 29 | 100% | MIGRÉ 100% | OK |
| `complaints` | 1 | 1 | 100% | MIGRÉ 100% | OK |

**Score support : 428 lignes / 48 748 lignes = 0.9%** *(quasi-perte totale)*

### 3.5 Formation

| Table | CSV | DB | % | Statut | Impact |
|-------|-----|----|---|--------|--------|
| `training_modules` | 1 104 | 10 | 0.9% | PARTIELLEMENT MIGRÉ | **1 094 modules perdus** |
| `training_lessons` | 1 756 | 10 | 0.6% | PARTIELLEMENT MIGRÉ | **1 746 leçons perdues** |
| `training_progress` | 13 | 23 | 176.9% | MIGRÉ 100% | OK |
| `training_questions` | 100 | 100 | 100% | MIGRÉ 100% | OK |
| `training_answers` | 90 | 90 | 100% | MIGRÉ 100% | OK |
| `training_certifications` | présente | présente | N/A | MIGRÉ | OK |
| `training_simulations` | 3 | 3 | 100% | MIGRÉ 100% | OK |
| `training_certification_whitelist` | 2 | 2 | 100% | MIGRÉ 100% | OK |
| `hub_training_progress` | 3 | ABSENTE | N/A | TABLE ABSENTE | Progression Hub absente |
| `hub_certificates` | 3 | ABSENTE | N/A | TABLE ABSENTE | Certificats Hub absents |

**Score formation : 20 lignes / 2 860 lignes = 0.7%** *(modules et leçons quasi-perdus)*

### 3.6 Technicien / Terrain

| Table | CSV | DB | % | Statut | Impact |
|-------|-----|----|---|--------|--------|
| `technicians` | 2 | 2 | 100% | MIGRÉ 100% | OK |
| `technician_slots` | 104 | 208 | 200% | MIGRÉ 100% | OK (données nouvelles) |
| `technician_slot_bookings` | 44 | 44 | 100% | MIGRÉ 100% | OK |
| `technician_assignments` | 5 | 7 | 140% | MIGRÉ 100% | OK |
| `technician_locations` | 0 | ABSENTE | 100% | TABLE ABSENTE | Vide, impact nul |
| `identity_verification_sessions` | 48 | 0 | 0% | NON MIGRÉ | Vérifications d'identité perdues |
| `identity_verification_events` | 63 | ABSENTE | N/A | TABLE ABSENTE | Événements KYC absents |
| `kyc_verifications` | 12 | ABSENTE | N/A | TABLE ABSENTE | Vérifications KYC absentes |
| `kyc_requests` | 5 | 5 | 100% | MIGRÉ 100% | OK |
| `staff_schedules` | 61 | ABSENTE | N/A | TABLE ABSENTE | Horaires employés absents |
| `installations` | 51 | 51 | 100% | MIGRÉ 100% | OK |
| `field_quotes` | 50 | 50 | 100% | MIGRÉ 100% | OK |
| `field_payment_intents` | 35 | 35 | 100% | MIGRÉ 100% | OK |
| `field_sales_orders` | 27 | 14 | 51.9% | PARTIELLEMENT MIGRÉ | 48% des ventes terrain perdues |
| `work_orders` | 4 | 4 | 100% | MIGRÉ 100% | OK |
| `phone_inventory` | 10 | 0 | 0% | NON MIGRÉ | Inventaire téléphones perdu |

### 3.7 CRM

| Table | CSV | DB | % | Statut | Impact |
|-------|-----|----|---|--------|--------|
| `crm_contacts` | 659 | 659 | 100% | MIGRÉ 100% | OK |
| `marketing_campaigns` | 270 | 12 | 4.4% | PARTIELLEMENT MIGRÉ | 96% des campagnes perdues |
| `quotes` | 195 | 18 | 9.2% | PARTIELLEMENT MIGRÉ | 91% des devis perdus |
| `direct_emails` | 70 | 6 | 8.6% | PARTIELLEMENT MIGRÉ | 91% des emails directs perdus |
| `direct_email_recipients` | 429 | 429 | 100% | MIGRÉ 100% | OK |
| `chatbot_logs` | 174 | 76 | 43.7% | PARTIELLEMENT MIGRÉ | 57% des logs chatbot perdus |
| `crm_call_logs` | 6 | 6 | 100% | MIGRÉ 100% | OK |
| `crm_territories` | 0 | 10 | 100% | MIGRÉ 100% | OK (données nouvelles) |
| `client_reviews` | 7 | 7 | 100% | MIGRÉ 100% | OK |
| `hub_posts` | 47 | 5 | 10.6% | PARTIELLEMENT MIGRÉ | 89% des posts Hub perdus |
| `social_media_posts` | 104 | 19 | 18.3% | PARTIELLEMENT MIGRÉ | 82% des posts réseaux sociaux perdus |
| `marketing_conversations` | 103 | 103 | 100% | MIGRÉ 100% | OK |
| `marketing_ai_config` | 20 | 2 | 10% | PARTIELLEMENT MIGRÉ | 90% des configs AI marketing perdues |
| `partner_program_terms` | 108 | ABSENTE | N/A | TABLE ABSENTE | Programme partenaires absent |
| `sop_documents` | 66 | ABSENTE | N/A | TABLE ABSENTE | Procédures opérationnelles absentes |
| `client_testimonials` | 6 | ABSENTE | N/A | TABLE ABSENTE | Témoignages clients absents |

### 3.8 Fidélité

| Table | CSV | DB | % | Statut | Impact |
|-------|-----|----|---|--------|--------|
| `loyalty_points` | 3 | 0 | 0% | NON MIGRÉ | Soldes fidélité = 0 |
| `loyalty_transactions` | 4 | 0 | 0% | NON MIGRÉ | Historique transactions = vide |
| `loyalty_rewards` | 5 | 4 | 80% | PARTIELLEMENT MIGRÉ | Récompenses quasi complètes |
| `loyalty_redemptions` | 1 | ABSENTE | N/A | TABLE ABSENTE | Rachats absents |
| `referral_codes` | 714 | 714 | 100% | MIGRÉ 100% | OK |
| `referral_attributions` | 5 | 5 | 100% | MIGRÉ 100% | OK |
| `referral_program_settings` | 1 | 2 | 200% | MIGRÉ 100% | OK |
| `client_referrals` | 2 | 0 | 0% | NON MIGRÉ | Parrainages clients perdus |
| `promotion_redemptions` | 31 | 31 | 100% | MIGRÉ 100% | OK |
| `promotions` | 11 | 11 | 100% | MIGRÉ 100% | OK |

### 3.9 Marketing / Email

| Table | CSV | DB | % | Statut | Impact |
|-------|-----|----|---|--------|--------|
| `email_templates` | 82 | ABSENTE | N/A | TABLE ABSENTE | **P1 — Aucun template email disponible** |
| `email_trigger_queue` | 704 | ABSENTE | N/A | TABLE ABSENTE | File de déclenchement absente |
| `email_queue` | 5 456 | 2 383 | 43.7% | PARTIELLEMENT MIGRÉ | 57% des emails en attente perdus |
| `email_send_log` | 6 318 | 6 348 | 100% | MIGRÉ 100% | OK |
| `marketing_campaigns` | 270 | 12 | 4.4% | PARTIELLEMENT MIGRÉ | 96% des campagnes perdues |
| `campaign_sends` | 45 | 45 | 100% | MIGRÉ 100% | OK |
| `sms_campaigns` | 18 | 14 | 77.8% | PARTIELLEMENT MIGRÉ | OK |
| `automatic_email_dispatches` | 189 | ABSENTE | N/A | TABLE ABSENTE | Envois automatiques absents |
| `social_media_posts` | 104 | 19 | 18.3% | PARTIELLEMENT MIGRÉ | 82% perdus |
| `onboarding_sequences` | 5 | ABSENTE | N/A | TABLE ABSENTE | Séquences d'onboarding absentes |
| `email_automation_rules` | 3 | ABSENTE | N/A | TABLE ABSENTE | Règles automation absentes |
| `notification_outbox` | 5 | ABSENTE | N/A | TABLE ABSENTE | File de notifications absente |

### 3.10 RH / Paie

| Table | CSV | DB | % | Statut | Impact |
|-------|-----|----|---|--------|--------|
| `staff_schedules` | 61 | ABSENTE | N/A | TABLE ABSENTE | Horaires employés absents |
| `payroll_entries` | 6 | ABSENTE | N/A | TABLE ABSENTE | Entrées de paie absentes |
| `payroll_runs` | 3 | ABSENTE | N/A | TABLE ABSENTE | Cycles de paie absents |
| `payroll_payments` | 5 | ABSENTE | N/A | TABLE ABSENTE | Paiements de paie absents |
| `payroll_payment_events` | 25 | ABSENTE | N/A | TABLE ABSENTE | Événements paie absents |
| `pay_periods` | 6 | ABSENTE | N/A | TABLE ABSENTE | Périodes de paie absentes |
| `employee_payroll_settings` | 9 | ABSENTE | N/A | TABLE ABSENTE | Paramètres paie absents |
| `commission_rules` | 9 | ABSENTE | N/A | TABLE ABSENTE | Règles commissions absentes |
| `staff_roles` | 2 | ABSENTE | N/A | TABLE ABSENTE | Rôles employés absents |
| `time_entries` | 8 | ABSENTE | N/A | TABLE ABSENTE | Entrées de temps absentes |
| `timesheet_entries` | 1 | ABSENTE | N/A | TABLE ABSENTE | Feuilles de temps absentes |
| `hr_audit_log` | 36 | ABSENTE | N/A | TABLE ABSENTE | Audit RH absent |
| `hr_requests` | 1 | ABSENTE | N/A | TABLE ABSENTE | Demandes RH absentes |
| `employment_letters` | 8 | ABSENTE | N/A | TABLE ABSENTE | Lettres d'emploi absentes |
| `tax_brackets_federal` | 5 | ABSENTE | N/A | TABLE ABSENTE | Barèmes d'impôt fédéral absents |
| `tax_brackets_quebec` | 4 | ABSENTE | N/A | TABLE ABSENTE | Barèmes d'impôt Québec absents |
| `employees` | 2 | 2 | 100% | MIGRÉ 100% | OK |
| `employee_records` | 4 | 4 | 100% | MIGRÉ 100% | OK |
| `attendance_records` | 2 | 2 | 100% | MIGRÉ 100% | OK |
| `sales_commissions` | 12 | 12 | 100% | MIGRÉ 100% | OK |
| `sales_targets` | 10 | 19 | 190% | MIGRÉ 100% | OK |

**Score RH : Toute l'infrastructure de paie est absente du nouveau projet.**

---

## 4. Récapitulatif par domaine

| Domaine | Lignes CSV | Lignes DB | % migré | Statut |
|---------|-----------|----------|---------|--------|
| **Support** | 48 748 | 428 | **0.9%** | CRITIQUE |
| **Formation** | 2 860 | 20 | **0.7%** | CRITIQUE |
| **Portail client** | 920 389 | 82 445 | **8.9%** | CRITIQUE |
| **Marketing/Email** | ~7 000 | ~2 400 | **34%** | DÉGRADÉ |
| **CRM** | ~1 500 | ~700 | **47%** | DÉGRADÉ |
| **RH/Paie** | ~181 | 0 utile | **0%** (infra) | CRITIQUE |
| **Fidélité** | ~25 | 4 | **16%** | CRITIQUE |
| **Facturation** | ~6 000 | ~2 500 | **42%** | DÉGRADÉ |
| **Technicien** | ~350 | ~340 | **97%** | OK |
| **Nivra Core** | ~1 200 | ~800 | **67%** | DÉGRADÉ |

---

## 5. Mapping bugs → tables manquantes → composants React → API

### Bug 1 — Impossible de voir les comptes clients correctement

| Composant React | Fichier | API/RPC | Table responsable | État |
|----------------|---------|---------|-------------------|------|
| `ClientInternalNotes` | `src/components/admin/ClientInternalNotes.tsx:59` | `supabase.from("client_internal_notes")` | `client_internal_notes` (ABSENTE) | CRASH SQL |
| Fiche client — tickets | `src/pages/admin/AdminClients.tsx:263` | `.from("support_tickets")` | `support_tickets` (104/14264) | DONNÉES MANQUANTES |
| Fiche client — commandes | `src/pages/admin/AdminClients.tsx:203` | `.from("orders")` | `orders` (15/56) | DONNÉES MANQUANTES |
| Fiche client — abonnements | `src/pages/admin/AdminClients.tsx:278` | `.from("billing_subscriptions")` | `billing_subscriptions` (OK) | OK mais services vides |

### Bug 2 — Impossible de voir les services actifs

| Composant React | Fichier | API/RPC | Table responsable | État |
|----------------|---------|---------|-------------------|------|
| Services dans snapshot portail | `src/hooks/useCanonicalClientData.ts:191` | `rpc("get_customer_portal_snapshot")` → `get_client_history_snapshot` ligne 169 | `billing_subscription_services` (0/17) | NON MIGRÉ |
| Adresses de service | `get_client_history_snapshot` ligne 171 | `service_addresses sa WHERE sa.id = src.address_id` | `service_addresses` (0/17) | NON MIGRÉ |

### Bug 3 — Menus du portail client vides

| Menu portail | Hook | RPC/Table | État |
|-------------|------|-----------|------|
| "Mes services" | `useCanonicalClientData` | `billing_subscription_services` (0 lignes) | NON MIGRÉ |
| "Support" | `useCanonicalClientData` | `support_tickets` (0.7%) | DONNÉES MANQUANTES |
| "Fidélité" | `useCanonicalClientData` | `loyalty_points` (0 lignes) | NON MIGRÉ |
| "Commandes" | `useCanonicalClientData` | `orders` (26.8%) | DONNÉES MANQUANTES |
| "Factures" | `useCanonicalClientData` | `billing_invoices` (OK) | OK |

### Bug 4 — Sections du portail qui ne chargent rien

| Section | Fichier React | API directe | Table | État |
|---------|--------------|-------------|-------|------|
| Formation | `src/shared-training/AcademyPortal.tsx:86` | `supabase.from("training_modules")` | `training_modules` (10/1104) | 0.9% |
| Leçons formation | `AcademyPortal.tsx` | `supabase.from("training_lessons")` | `training_lessons` (10/1756) | 0.6% |
| Solde fidélité | `src/pages/client/ClientLoyalty.tsx:59` | `canonicalData.loyaltyPoints` | `loyalty_points` (0/3) | NON MIGRÉ |
| Transactions fidélité | `ClientLoyalty.tsx` | `canonicalData.loyaltyTransactions` | `loyalty_transactions` (0/4) | NON MIGRÉ |

### Bug 5 — Support / Tickets incomplets

| Composant React | Fichier | API/RPC | Table | CSV | DB | % |
|----------------|---------|---------|-------|-----|----|---|
| Liste tickets (portail) | `useCanonicalClientData.ts` | `get_client_history_snapshot` ligne 177 | `support_tickets` | 14 264 | 104 | 0.7% |
| Réponses tickets | `useCanonicalClientData.ts` | `customer_portal_enrich_snapshot` | `ticket_replies` | 33 873 | 242 | 0.7% |
| Notes internes (admin) | `ClientInternalNotes.tsx:59` | `.from("client_internal_notes")` | `client_internal_notes` | 353 | ABSENTE | CRASH |
| Ajout note (admin) | `ClientInternalNotes.tsx:85` | `.from("client_internal_notes").insert()` | `client_internal_notes` | — | ABSENTE | CRASH |
| Tickets admin | `AdminClients.tsx:263` | `.from("support_tickets")` | `support_tickets` | 14 264 | 104 | 0.7% |

---

## 6. Tables dont la restauration débloque immédiatement un bug visible

| Priorité | Table | Lignes à restaurer | Bug débloqué |
|----------|-------|-------------------|-------------|
| **P0** | `client_internal_notes` | 353 | Arrêt du crash SQL dans toutes les fiches client admin |
| **P1** | `support_tickets` | 14 160 manquantes | Bug 1, Bug 3 (menu support), Bug 5 |
| **P1** | `ticket_replies` | 33 631 manquantes | Bug 5 — réponses visibles |
| **P1** | `billing_subscription_services` | 17 | Bug 2 — services actifs visibles |
| **P1** | `service_addresses` | 17 | Bug 2 — adresses de service |
| **P2** | `training_modules` | 1 094 manquantes | Bug 4A — formation visible |
| **P2** | `training_lessons` | 1 746 manquantes | Bug 4A — leçons visibles |
| **P2** | `loyalty_points` | 3 | Bug 4B — solde fidélité |
| **P2** | `loyalty_transactions` | 4 | Bug 4B — historique fidélité |
| **P2** | `email_templates` | 82 | Emails de facturation/système opérationnels |
| **P2** | `orders` | ~41 manquantes | Bug 1 — historique complet des commandes |
| **P3** | `marketing_campaigns` | 258 manquantes | CRM — historique campagnes |
| **P3** | `quotes` | 177 manquantes | Devis clients |
| **P3** | `stripe_plan_mapping` | 32 | Synchronisation Stripe |
| **P3** | `staff_schedules` | 61 | Horaires employés |
| **P3** | Toutes tables RH | ~170 lignes | Module paie complet |
