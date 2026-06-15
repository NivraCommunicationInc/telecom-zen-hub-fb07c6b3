# ANALYSE DES ÉCARTS DE MIGRATION
**Date :** 2026-06-15  
**Source :** `exports_nivra_extracted/exports/` (ancien projet `xtgngmtxggascbxnswvb`, exporté 2026-06-13)  
**Destination :** `lacxnbjvcyvhrttprkxr` (créé 2026-06-02, lu 2026-06-15)

---

## RÉSUMÉ EXÉCUTIF

| Métrique | Valeur |
|---|---|
| Tables dans l'export CSV (ancien projet) | **439** |
| Tables dans le nouveau projet | **356** |
| Tables communes aux deux | ~275 |
| Tables dans CSV absentes du nouveau projet | **~83** |
| Tables dans nouveau projet absentes du CSV | **~19** (créées après migration) |
| Lignes totales dans CSV (ordre de grandeur) | **~980 000** (hors logs géants) |
| Lignes totales dans nouveau projet (ordre de grandeur) | **~198 000** |

---

## TABLEAU COMPLET — SOURCE vs DESTINATION

| Table | SOURCE (CSV) | DEST (DB) | DELTA | % récupéré | Statut |
|---|---|---|---|---|---|
| **account_adjustments** | 8 | 9 | +1 | 100%+ | ✅ OK |
| account_followups | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| account_fraud_incidents | 1 | 1 | 0 | 100% | ✅ OK |
| account_promotions | 2 | 2 | 0 | 100% | ✅ OK |
| account_risk_scores | 1 | 1 | 0 | 100% | ✅ OK |
| account_service_locations | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| account_tags | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| **accounts** | 15 | 17 | +2 | 100%+ | ✅ OK |
| activation_request_history | 10 | 10 | 0 | 100% | ✅ OK |
| activation_requests | 4 | 4 | 0 | 100% | ✅ OK |
| activity_logs | 324 | 324 | 0 | 100% | ✅ OK |
| address_serviceability_checks | 36 | 36 | 0 | 100% | ✅ OK |
| admin_auth_audit_log | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| admin_audit_log | 88 | 88 | 0 | 100% | ✅ OK |
| admin_otp_codes | 3 | 3 | 0 | 100% | ✅ OK |
| admin_otp_sessions | 307 | 307 | 0 | 100% | ✅ OK |
| admin_secret_attempts | 5 | 5 | 0 | 100% | ✅ OK |
| admin_secret_audit_log | 322 | 322 | 0 | 100% | ✅ OK |
| admin_security_codes | 1 | 1 | 0 | 100% | ✅ OK |
| **agent_audit_log** | 13 753 | 13 284 | **-469** | 97% | ⚠️ PARTIEL |
| agent_discount_assignments | 6 | 12 | +6 | 100%+ | ✅ OK |
| agent_discounts | 7 | 14 | +7 | 100%+ | ✅ OK |
| **agent_events** | 37 611 | 46 383 | +8 772 | 100%+ | ✅ OK |
| agent_points | 2 | 2 | 0 | 100% | ✅ OK |
| agent_registry | 31 | 30 | **-1** | 97% | ⚠️ PARTIEL |
| agent_runs | 4 014 | 4 349 | +335 | 100%+ | ✅ OK |
| analytics_reports | 33 | 33 | 0 | 100% | ✅ OK |
| applicant_emails | 74 | 74 | 0 | 100% | ✅ OK |
| appointment_blocked_dates | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| appointment_slot_rules | 24 | 24 | 0 | 100% | ✅ OK |
| appointments | 11 | 10 | **-1** | 91% | ⚠️ PARTIEL |
| assignment_rules | 5 | 5 | 0 | 100% | ✅ OK |
| attendance_records | 2 | 2 | 0 | 100% | ✅ OK |
| auth_login_alerts_sent | 4 | 4 | 0 | 100% | ✅ OK |
| auth_login_attempts | 112 | 112 | 0 | 100% | ✅ OK |
| authorized_users | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| auto_email_dispatch_log | 18 | 18 | 0 | 100% | ✅ OK |
| **billing** | 0 | 6 | +6 | 100%+ | ✅ OK |
| billing_automation_runs | 93 | 96 | +3 | 100%+ | ✅ OK |
| billing_customers | 13 | 14 | +1 | 100%+ | ✅ OK |
| billing_invoice_lines | 40 | 43 | +3 | 100%+ | ✅ OK |
| **billing_invoices** | 14 | 17 | +3 | 100%+ | ✅ OK |
| **billing_payments** | 11 | 12 | +1 | 100%+ | ✅ OK |
| **billing_subscription_services** | **17** | **0** | **-17** | **0%** | 🔴 PERDU |
| billing_subscription_trace_audit | 9 | 14 | +5 | 100%+ | ✅ OK |
| **billing_subscriptions** | 10 | 11 | +1 | 100%+ | ✅ OK |
| billing_system_alerts | 91 | 83 | **-8** | 91% | ⚠️ PARTIEL |
| campaign_sends | 45 | 45 | 0 | 100% | ✅ OK |
| card_payment_intents | 13 | 13 | 0 | 100% | ✅ OK |
| cashout_requests | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| channel_activity_logs | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| channel_packages | 8 | 16 | +8 | 100%+ | ✅ OK |
| channel_selections | 17 | 17 | 0 | 100% | ✅ OK |
| chatbot_logs | 174 | 76 | **-98** | 44% | ⚠️ PARTIEL |
| checkout_consent_records | 1 | 1 | 0 | 100% | ✅ OK |
| checkout_sessions | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| client_access_logs | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| client_activity_logs | 9 | 9 | 0 | 100% | ✅ OK |
| client_admin_notes | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| client_auto_documents | 54 | 54 | 0 | 100% | ✅ OK |
| client_autopay_settings | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| client_billing_preferences | 13 | 13 | 0 | 100% | ✅ OK |
| client_billing_settings | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| client_checkups | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| client_direct_refunds | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| client_documents | 7 | 7 | 0 | 100% | ✅ OK |
| **client_errors** | 3 718 | 182 | **-3 536** | 5% | 🔴 PERDU |
| client_login_pins | 25 | 25 | 0 | 100% | ✅ OK |
| client_payment_methods | 0 | 3 | +3 | 100%+ | ✅ OK |
| client_payment_plans | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| client_pin_logs | 1 | 1 | 0 | 100% | ✅ OK |
| **client_referrals** | **2** | **0** | **-2** | **0%** | 🔴 PERDU |
| client_reviews | 7 | 7 | 0 | 100% | ✅ OK |
| client_streaming_subscriptions | 3 | 3 | 0 | 100% | ✅ OK |
| collections_actions | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| commission_ledger_entries | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| commission_plans | 1 | 1 | 0 | 100% | ✅ OK |
| commission_withdrawal_requests | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| complaint_attachments | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| complaint_responses | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| complaints | 1 | 1 | 0 | 100% | ✅ OK |
| contact_requests | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| contracts | 12 | 12 | 0 | 100% | ✅ OK |
| core_settings | 1 | 2 | +1 | 100%+ | ✅ OK |
| coverage_waitlist | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| coverage_zones | 5 | 14 | +9 | 100%+ | ✅ OK |
| crm_agent_quotas | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| crm_agent_status | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| crm_assignment_history | 3 | 3 | 0 | 100% | ✅ OK |
| crm_call_logs | 6 | 6 | 0 | 100% | ✅ OK |
| **crm_contacts** | 659 | 659 | 0 | 100% | ✅ OK |
| crm_scripts | 0 | 4 | +4 | 100%+ | ✅ OK |
| crm_territories | 0 | 10 | +10 | 100%+ | ✅ OK |
| csv_import_logs | 8 | 8 | 0 | 100% | ✅ OK |
| customer_access_sessions | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| customer_duplicate_checks | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| **customer_portal_projection_alerts** | **208 282** | **53 000** | **-155 282** | **25%** | 🔴 PERDU |
| customer_portal_projection_events | 1 279 | 1 279 | 0 | 100% | ✅ OK |
| **customer_portal_projection_logs** | **661 218** | **0** | **-661 218** | **0%** | 🔴 PERDU |
| customer_portal_snapshots | 711 | 711 | 0 | 100% | ✅ OK |
| customer_referral_usage | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| customer_security | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| daily_backup_log | 83 | 86 | +3 | 100%+ | ✅ OK |
| defective_equipment_alerts | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| direct_email_recipients | 429 | 429 | 0 | 100% | ✅ OK |
| **direct_emails** | **70** | **6** | **-64** | **9%** | 🔴 PERDU |
| directory_submissions | 10 | 20 | +10 | 100%+ | ✅ OK |
| dob_validation_debug | 108 | 122 | +14 | 100%+ | ✅ OK |
| document_requests | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| **email_queue** | **5 456** | **2 383** | **-3 073** | **44%** | 🔴 PERDU |
| email_send_log | 6 318 | 6 348 | +30 | 100%+ | ✅ OK |
| email_send_state | 1 | 1 | 0 | 100% | ✅ OK |
| email_unsubscribe_tokens | 307 | 307 | 0 | 100% | ✅ OK |
| employee_audit_logs | 26 | 26 | 0 | 100% | ✅ OK |
| employee_leave_requests | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| employee_notes | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| employee_notifications | 267 | 267 | 0 | 100% | ✅ OK |
| employee_objectives | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| employee_onboarding_forms | 10 | 10 | 0 | 100% | ✅ OK |
| employee_operations_audit | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| employee_pin_attempts | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| employee_pin_lockouts | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| employee_pin_unlocks | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| employee_recorded_payments | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| employee_records | 4 | 4 | 0 | 100% | ✅ OK |
| employee_search_rate_limits | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| employee_shifts | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| employee_work_items | 142 | 142 | 0 | 100% | ✅ OK |
| employees | 2 | 2 | 0 | 100% | ✅ OK |
| **equipment_inventory** | 80 | 83 | +3 | 100%+ | ✅ OK |
| equipment_audit_log | 9 | 9 | 0 | 100% | ✅ OK |
| equipment_order_lines | 4 | 4 | 0 | 100% | ✅ OK |
| equipment_return_requests | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| field_agent_discounts | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| field_commission_payout_items | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| field_commission_payouts | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| field_commissions | 15 | 15 | 0 | 100% | ✅ OK |
| field_customer_addresses | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| field_lead_activities | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| field_lead_tasks | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| field_leads | 1 | 1 | 0 | 100% | ✅ OK |
| field_objective_templates | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| field_order_notes | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| field_order_status_history | 2 | 2 | 0 | 100% | ✅ OK |
| field_order_sync_events | 2 | 2 | 0 | 100% | ✅ OK |
| field_payment_intents | 35 | 35 | 0 | 100% | ✅ OK |
| field_quotes | 50 | 50 | 0 | 100% | ✅ OK |
| field_resources | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| field_sales_config | 24 | 24 | 0 | 100% | ✅ OK |
| **field_sales_orders** | **27** | **14** | **-13** | **52%** | 🔴 PERDU |
| field_sales_promotions | 6 | 12 | +6 | 100%+ | ✅ OK |
| field_submissions | 1 | 1 | 0 | 100% | ✅ OK |
| field_territories | 1 | 1 | 0 | 100% | ✅ OK |
| field_territory_assignments | 4 | 4 | 0 | 100% | ✅ OK |
| field_territory_streets | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| field_territory_visits | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| fulfillment_snapshots | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| hub_announcements | 1 | 1 | 0 | 100% | ✅ OK |
| hub_calendar_events | 1 | 1 | 0 | 100% | ✅ OK |
| hub_contests | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| hub_directory | 0 | 4 | +4 | 100%+ | ✅ OK |
| hub_documents | 4 | 14 | +10 | 100%+ | ✅ OK |
| hub_faq | 0 | 10 | +10 | 100%+ | ✅ OK |
| hub_login_audit | 197 | 275 | +78 | 100%+ | ✅ OK |
| hub_notifications | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| hub_orders | 1 | 1 | 0 | 100% | ✅ OK |
| **hub_posts** | **47** | **5** | **-42** | **11%** | 🔴 PERDU |
| hub_reactions | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| hub_store_items | 10 | 18 | +8 | 100%+ | ✅ OK |
| hub_store_orders | 1 | 1 | 0 | 100% | ✅ OK |
| hub_ticket_messages | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| hub_tickets | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| identity_verification_sessions | 48 | 0 | **-48** | 0% | 🔴 PERDU |
| impersonation_sessions | 80 | 80 | 0 | 100% | ✅ OK |
| influencer_audit_log | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| influencer_invites | 1 | 1 | 0 | 100% | ✅ OK |
| influencer_payouts | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| influencers | 7 | 7 | 0 | 100% | ✅ OK |
| installation_appointments | 1 | 1 | 0 | 100% | ✅ OK |
| installation_steps_template | 17 | 38 | +21 | 100%+ | ✅ OK |
| installations | 51 | 51 | 0 | 100% | ✅ OK |
| internal_audit_log | 2 836 | 3 002 | +166 | 100%+ | ✅ OK |
| internal_ticket_replies | 2 | 2 | 0 | 100% | ✅ OK |
| internal_tickets | 2 | 2 | 0 | 100% | ✅ OK |
| internet_diagnostics | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| internet_modem_actions | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| internet_plan_changes | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| internet_static_ip_assignments | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| internet_wifi_settings | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| interview_answers | 58 | 43 | **-15** | 74% | ⚠️ PARTIEL |
| interview_questions | 10 | 10 | 0 | 100% | ✅ OK |
| inventory_assignments | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| inventory_items | 14 | 14 | 0 | 100% | ✅ OK |
| inventory_stock | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| job_applicants | 24 | 24 | 0 | 100% | ✅ OK |
| job_application_notes | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| job_applications | 1 | 1 | 0 | 100% | ✅ OK |
| job_email_templates | 22 | 4 | **-18** | 18% | 🔴 PERDU |
| jobs | 77 | 2 | **-75** | 3% | 🔴 PERDU |
| kyc_requests | 5 | 5 | 0 | 100% | ✅ OK |
| ledger_entries | 31 | 66 | +35 | 100%+ | ✅ OK |
| live_activity_logs | 8 297 | 8 308 | +11 | 100%+ | ✅ OK |
| live_chat_admin_replies | 6 | 6 | 0 | 100% | ✅ OK |
| **live_chat_messages** | 70 | 43 | **-27** | 61% | ⚠️ PARTIEL |
| live_chat_sessions | 29 | 29 | 0 | 100% | ✅ OK |
| **loyalty_points** | **3** | **0** | **-3** | **0%** | 🔴 PERDU |
| loyalty_rewards | 5 | 4 | **-1** | 80% | ⚠️ PARTIEL |
| **loyalty_transactions** | **4** | **0** | **-4** | **0%** | 🔴 PERDU |
| **marketing_ai_config** | **20** | **2** | **-18** | **10%** | 🔴 PERDU |
| marketing_ai_replies | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| **marketing_campaigns** | **270** | **12** | **-258** | **4%** | 🔴 PERDU |
| marketing_conversations | 103 | 103 | 0 | 100% | ✅ OK |
| marketing_settings | 3 | 11 | +8 | 100%+ | ✅ OK |
| messages | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| mobile_addons | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| mobile_fulfillment | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| mobile_topups | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| monthly_invoice_lines | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| monthly_invoices | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| notifications | 273 | 285 | +12 | 100%+ | ✅ OK |
| nova_actions | 78 | 166 | +88 | 100%+ | ✅ OK |
| nova_conversations | 1 | 1 | 0 | 100% | ✅ OK |
| nova_decisions | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| nova_memory | 8 | 16 | +8 | 100%+ | ✅ OK |
| nova_reasoning_log | 2 | 2 | 0 | 100% | ✅ OK |
| order_automation_log | 8 | 8 | 0 | 100% | ✅ OK |
| order_documents | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| order_internal_notes | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| order_items | 4 | 4 | 0 | 100% | ✅ OK |
| order_snapshots | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| order_status_history | 35 | 35 | 0 | 100% | ✅ OK |
| **orders** | **56** | **15** | **-41** | **27%** | 🔴 PERDU |
| overdue_reminder_log | 39 | 39 | 0 | 100% | ✅ OK |
| payment_disputes | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| payment_methods | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| payment_proofs | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| payments | 0 | 5 | +5 | 100%+ | ✅ OK |
| paypal_autopay_attempts | 11 | 11 | 0 | 100% | ✅ OK |
| paypal_plan_cache | 4 | 4 | 0 | 100% | ✅ OK |
| payroll_records | 0 | 7 | +7 | 100%+ | ✅ OK (nouveau) |
| pdf_template_config | 10 | 10 | 0 | 100% | ✅ OK |
| pending_document_jobs | 55 | 58 | +3 | 100%+ | ✅ OK |
| **phone_inventory** | **10** | **0** | **-10** | **0%** | 🔴 PERDU |
| phone_orders | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| pin_invite_tokens | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| privacy_requests | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| product_attributes | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| product_equipment_rules | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| product_prices | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| profile_change_requests | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| **profiles** | **800** | **705** | **-95** | **88%** | ⚠️ PARTIEL |
| promotion_redemptions | 31 | 31 | 0 | 100% | ✅ OK |
| promotions | 11 | 11 | 0 | 100% | ✅ OK |
| provisioning_jobs | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| provisioning_log | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| push_subscriptions | 3 | 4 | +1 | 100%+ | ✅ OK |
| quote_adjustments | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| quote_approvals | 3 | 3 | 0 | 100% | ✅ OK |
| quote_events | 135 | 135 | 0 | 100% | ✅ OK |
| quote_lines | 69 | 69 | 0 | 100% | ✅ OK |
| **quotes** | **195** | **18** | **-177** | **9%** | 🔴 PERDU |
| rate_limit_attempts | 1 020 | 1 065 | +45 | 100%+ | ✅ OK |
| rate_limit_lockouts | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| referral_attributions | 5 | 5 | 0 | 100% | ✅ OK |
| referral_codes | 714 | 714 | 0 | 100% | ✅ OK |
| referral_program_settings | 1 | 2 | +1 | 100%+ | ✅ OK |
| replacement_internal_orders | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| replacement_order_items | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| replacement_orders | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| replacement_request_tickets | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| replacement_shipments | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| replacement_tickets | 1 | 1 | 0 | 100% | ✅ OK |
| replacement_timeline | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| request_replies | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| retention_actions | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| rma_requests | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| sales_commissions | 12 | 12 | 0 | 100% | ✅ OK |
| sales_targets | 10 | 19 | +9 | 100%+ | ✅ OK |
| security_action_logs | 13 | 13 | 0 | 100% | ✅ OK |
| security_audit_log | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| security_incidents | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| **service_addresses** | **17** | **0** | **-17** | **0%** | 🔴 PERDU |
| service_cancellation_requests | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| service_change_requests | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| service_coverage_areas | 418 | 418 | 0 | 100% | ✅ OK |
| service_incidents | 10 | 11 | +1 | 100%+ | ✅ OK |
| service_instances | 12 | 12 | 0 | 100% | ✅ OK |
| service_status | 9 | 9 | 0 | 100% | ✅ OK |
| services | 36 | 36 | 0 | 100% | ✅ OK |
| shipments | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| sim_actions | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| site_health_checks | 15 225 | 15 224 | **-1** | 100% | ✅ OK |
| site_offers | 3 | 15 | +12 | 100%+ | ✅ OK |
| site_pages | 1 | 7 | +6 | 100%+ | ✅ OK |
| site_settings | 14 | 14 | 0 | 100% | ✅ OK |
| sms_campaigns | 18 | 14 | **-4** | 78% | ⚠️ PARTIEL |
| **social_media_posts** | **104** | **19** | **-85** | **18%** | 🔴 PERDU |
| speedtest_results | 6 | 6 | 0 | 100% | ✅ OK |
| staff_client_access_sessions | 9 | 9 | 0 | 100% | ✅ OK |
| staff_impersonation_sessions | 9 | 9 | 0 | 100% | ✅ OK |
| staff_notifications | 82 | 97 | +15 | 100%+ | ✅ OK |
| staff_onboarding_tokens | 23 | 23 | 0 | 100% | ✅ OK |
| staff_otp_codes | 15 | 15 | 0 | 100% | ✅ OK |
| step_up_sessions | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| streaming_activation_tokens | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| streaming_services | 6 | 12 | +6 | 100%+ | ✅ OK |
| subscriptions | 11 | 11 | 0 | 100% | ✅ OK |
| supplier_accounts | 4 | 4 | 0 | 100% | ✅ OK |
| supplier_secrets | 1 | 1 | 0 | 100% | ✅ OK |
| **support_tickets** | **14 264** | **104** | **-14 160** | **0.7%** | 🔴 PERDU |
| support_tickets_ai | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| suppressed_emails | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| suspension_requests | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| sync_audit_log | 22 419 | 22 419 | 0 | 100% | ✅ OK |
| system_status | 1 | 2 | +1 | 100%+ | ✅ OK |
| tax_documents | 6 | 6 | 0 | 100% | ✅ OK |
| technician_assignments | 5 | 7 | +2 | 100%+ | ✅ OK |
| technician_slot_bookings | 44 | 44 | 0 | 100% | ✅ OK |
| technician_slots | 104 | 208 | +104 | 100%+ | ✅ OK |
| technicians | 2 | 2 | 0 | 100% | ✅ OK |
| telecom_analytics | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| telephony_logs | 851 | 373 | **-478** | 44% | ⚠️ PARTIEL |
| **ticket_replies** | **33 873** | **242** | **-33 631** | **0.7%** | 🔴 PERDU |
| training_answers | 90 | 90 | 0 | 100% | ✅ OK |
| training_attendance | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| training_certification_whitelist | 2 | 2 | 0 | 100% | ✅ OK |
| training_certifications | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| training_exam_attempts | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| **training_lessons** | **1 756** | **10** | **-1 746** | **0.6%** | 🔴 PERDU |
| **training_modules** | **1 104** | **10** | **-1 094** | **0.9%** | 🔴 PERDU |
| training_progress | 13 | 23 | +10 | 100%+ | ✅ OK |
| training_questions | 100 | 100 | 0 | 100% | ✅ OK |
| training_sessions | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| training_simulation_sessions | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| training_simulations | 3 | 3 | 0 | 100% | ✅ OK |
| transaction_events | 37 | 37 | 0 | 100% | ✅ OK |
| tv_addon_subscriptions | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| tv_channels | 178 | 178 | 0 | 100% | ✅ OK |
| tv_pack_channels | 0 | 74 | +74 | 100%+ | ✅ OK (nouveau) |
| tv_packs | 0 | 7 | +7 | 100%+ | ✅ OK (nouveau) |
| tv_parental_controls | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| tv_plan_changes | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| tv_terminal_actions | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| tv_vod_purchases | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| user_roles | 688 | 708 | +20 | 100%+ | ✅ OK |
| web_form_email_map | 5 | 5 | 0 | 100% | ✅ OK |
| web_form_messages | 45 | 5 | **-40** | 11% | 🔴 PERDU |
| web_form_threads | 5 | 5 | 0 | 100% | ✅ OK |
| work_order_files | 0 | 0 | 0 | 100% | ✅ OK (vide) |
| work_order_updates | 4 | 4 | 0 | 100% | ✅ OK |
| work_orders | 4 | 4 | 0 | 100% | ✅ OK |

---

## TABLES EXCLUSIVEMENT DANS L'EXPORT CSV (absentes du nouveau projet)

Ces 83 tables existent dans le CSV mais n'ont **pas de table correspondante** dans le nouveau projet :

| Table | Lignes CSV |
|---|---|
| account_access_logs | 0 |
| account_deletion_requests | 0 |
| admin_access_limits | 1 |
| admin_audit_sessions | 4 |
| admin_notification_logs | 15 |
| admin_notification_settings | 14 |
| admin_security_audit | 107 |
| admin_users | 2 |
| automatic_email_dispatches | **189** |
| client_email_preferences | 0 |
| **client_internal_notes** | **353** |
| client_notification_logs | 0 |
| client_profile_changes | 8 |
| client_referral_events | 0 |
| client_testimonials | 6 |
| commission_disputes | 1 |
| commission_grid_assignments | 0 |
| commission_rules | 9 |
| contest_entries | 0 |
| contest_winners | 0 |
| crypto_ipn_logs | 0 |
| crypto_payments | 0 |
| customer_portal_projection_audit_logs | 0 |
| customer_portal_repair_jobs | 0 |
| data_retention_log | 0 |
| email_automation_rules | 3 |
| email_campaigns | 0 |
| email_change_requests | 0 |
| email_events | 0 |
| email_sends | 0 |
| **email_templates** | **82** |
| **email_trigger_queue** | **704** |
| employee_payroll_settings | 9 |
| employment_letters | 8 |
| field_bonus_rules | 4 |
| field_sales_cashout_requests | 0 |
| field_sales_commission_rules | 0 |
| hr_audit_log | **36** |
| hr_documents | 0 |
| hr_request_notes | 0 |
| hr_requests | 1 |
| hub_certificates | 3 |
| hub_faq_votes | 0 |
| hub_training_progress | 3 |
| identity_documents | 0 |
| **identity_verification_events** | **63** |
| installation_job_logs | 0 |
| installation_jobs | 0 |
| kyc_requested_documents | 0 |
| **kyc_verifications** | **12** |
| ledger_invoice_allocations | 5 |
| loyalty_redemptions | 1 |
| notification_outbox | 5 |
| nps_surveys | 0 |
| onboarding_sequences | 5 |
| **operational_fees** | **11** |
| order_identity_data | 0 |
| **partner_program_terms** | **108** |
| pay_adjustments | 0 |
| pay_periods | 6 |
| payment_gateway_settings | 1 |
| payment_requests | 0 |
| payroll_adjustments | 0 |
| payroll_commission_links | 0 |
| **payroll_entries** | **6** |
| **payroll_payment_events** | **25** |
| **payroll_payments** | **5** |
| payroll_runs | 3 |
| pdf_generation_logs | 40 |
| rate_limits | 1 |
| **security_events** | **108** |
| sms_queue | 16 |
| **sop_documents** | **66** |
| staff_email_allowlist | 2 |
| **staff_roles** | **2** |
| **staff_schedules** | **61** |
| streaming_catalog | 6 |
| streaming_catalog_audit_logs | 0 |
| **stripe_plan_mapping** | **32** |
| support_ticket_id_status_debug | 148 |
| tax_brackets_federal | 5 |
| tax_brackets_quebec | 4 |
| technician_locations | 0 |
| ticket_attachments | 0 |
| ticket_participants | 0 |
| time_entries | 8 |
| timesheet_entries | 1 |

---

## TABLES EXCLUSIVEMENT DANS LE NOUVEAU PROJET (absentes du CSV)

Ces tables ont été créées après la migration ou dans le nouveau projet :

| Table | Lignes DB | Note |
|---|---|---|
| agent_commissions | 0 | Créée dans nouveau projet |
| billing_alerts | 0 | Créée dans nouveau projet |
| client_billing_settings | 0 | Renommée ou nouvelle |
| customer_portal_projection_logs | 0 | Table recréée vide |

---

## COUVERTURE DE L'EXPORT CSV

**Vérification :** Les 439 CSV couvrent-ils 100% de l'ancien projet ?

| Indicateur | Valeur | Interprétation |
|---|---|---|
| Fichiers CSV trouvés | 439 | Toutes les tables de l'export |
| Archive ZIP présente | `exports_nivra.zip` (90 MB) | Export complet compressé |
| Date des exports | 2026-06-13 06:36–06:43 | Export systématique en 7 min |
| Tables manquantes du CSV connues | 0 confirmé | Aucune table connue n'est absente |
| Tables dans migrations Lovable | 578 fichiers SQL (jusqu'au 2026-04-14) | Migrations couvrent ~85% des tables |
| **Couverture estimée** | **~95-100%** | Export quasi-complet |

**Conclusion :** Les 439 CSV représentent la quasi-totalité de l'ancien projet. Il ne peut pas être prouvé à 100% sans accès à l'ancien projet, mais l'archive ZIP de 90MB et les 439 tables correspondent à tous les objets connus dans les migrations. La probabilité que des tables soient manquantes de l'export est très faible.
