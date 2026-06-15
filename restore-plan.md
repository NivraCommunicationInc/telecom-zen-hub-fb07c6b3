# PLAN DE RESTAURATION — IMPORT CSV → NOUVEAU PROJET
**Date :** 2026-06-15  
**Archive :** `C:\Users\Lavau\Downloads\exports_nivra.zip` (90 MB, 439 CSV)  
**Destination :** `lacxnbjvcyvhrttprkxr` (nouveau projet Supabase)  
**Statut :** AUDIT UNIQUEMENT — AUCUN IMPORT EFFECTUÉ

> ⚠️ Ce plan est fourni à des fins de planification. **Ne pas importer sans validation préalable.**

---

## COUVERTURE DE L'EXPORT

| Indicateur | Valeur |
|---|---|
| Fichiers CSV dans l'export | **439** |
| Tables dans le nouveau projet | **356** |
| Tables CSV présentes dans le nouveau projet | **~275** |
| Tables CSV absentes du nouveau projet | **~83** (nécessitent création préalable) |
| Tables dans nouveau projet absentes du CSV | **~19** (créées après migration) |
| Couverture estimée | **~95–100%** |

**Conclusion :** L'export de 90 MB représente la quasi-totalité de l'ancien projet. Les 439 fichiers correspondent à toutes les tables connues dans les migrations Lovable.

---

## ORDRE D'IMPORT — GROUPES TOPOLOGIQUES

L'ordre respecte les contraintes de clés étrangères (FK). Importer un groupe avant de passer au suivant.

---

### GROUPE 1 — TABLES FONDATIONS (aucune FK vers d'autres tables métier)

Ces tables ne dépendent que de `auth.users` (géré par Supabase Auth) ou n'ont aucune FK.

| # | Fichier CSV | Table cible | Lignes | Statut table | Risque |
|---|---|---|---|---|---|
| 1 | `profiles.csv` | `profiles` | **800** | ✅ Existe (705 lignes) | ⚠️ MOYEN — 95 profils manquants. Vérifier doublons sur `id`. |
| 2 | `accounts.csv` | `accounts` | 15 | ✅ Existe (17 lignes) | FAIBLE — 2 comptes supplémentaires dans nouveau projet. |
| 3 | `services.csv` | `services` | 36 | ✅ Existe (36 lignes) | FAIBLE — Complet. |
| 4 | `technicians.csv` | `technicians` | 2 | ✅ Existe (2 lignes) | FAIBLE — Complet. |
| 5 | `employees.csv` | `employees` | 2 | ✅ Existe (2 lignes) | FAIBLE — Complet. |
| 6 | `training_modules.csv` | `training_modules` | **1 104** | ✅ Existe (10 lignes) | 🔴 ÉLEVÉ — 1094 modules manquants. Conflit sur ID possible. |
| 7 | `tv_channels.csv` | `tv_channels` | 178 | ✅ Existe (178 lignes) | FAIBLE — Complet. Attention: self-ref `replacement_channel_id`. |
| 8 | `tv_packs.csv` | `tv_packs` | 0 | ✅ Existe (7 lignes) | FAIBLE — CSV vide, nouveau projet a 7 lignes. |
| 9 | `marketing_campaigns.csv` | `marketing_campaigns` | **270** | ✅ Existe (12 lignes) | 🔴 ÉLEVÉ — 258 campagnes manquantes. |
| 10 | `commission_plans.csv` | `commission_plans` | 1 | ✅ Existe (1 ligne) | FAIBLE — Complet. |
| 11 | `promotions.csv` | `promotions` | 11 | ✅ Existe (11 lignes) | FAIBLE — Complet. |
| 12 | `jobs.csv` | `jobs` | **77** | ✅ Existe (2 lignes) | 🔴 ÉLEVÉ — 75 offres d'emploi manquantes. |
| 13 | `inventory_items.csv` | `inventory_items` | 14 | ✅ Existe (14 lignes) | FAIBLE — Complet. |
| 14 | `streaming_services.csv` | `streaming_services` | 6 | ✅ Existe (12 lignes) | FAIBLE — Nouveau projet a plus de données. |
| 15 | `field_territories.csv` | `field_territories` | 1 | ✅ Existe (1 ligne) | FAIBLE — Complet. |
| 16 | `field_quotes.csv` | `field_quotes` | 50 | ✅ Existe (50 lignes) | FAIBLE — Complet. |
| 17 | `payment_methods.csv` | `payment_methods` | 0 | ✅ Existe (0 lignes) | FAIBLE — Vide dans les deux. |
| 18 | `referral_program_settings.csv` | `referral_program_settings` | 1 | ✅ Existe (2 lignes) | FAIBLE — Nouveau projet a plus. |
| 19 | `marketing_conversations.csv` | `marketing_conversations` | 103 | ✅ Existe (103 lignes) | FAIBLE — Complet. |
| 20 | `crm_contacts.csv` | `crm_contacts` | 659 | ✅ Existe (659 lignes) | FAIBLE — Complet. |
| 21 | `interview_questions.csv` | `interview_questions` | 10 | ✅ Existe (10 lignes) | FAIBLE — Complet. |
| 22 | `site_settings.csv` | `site_settings` | 14 | ✅ Existe (14 lignes) | FAIBLE — Complet. |
| 23 | `service_coverage_areas.csv` | `service_coverage_areas` | 418 | ✅ Existe (418 lignes) | FAIBLE — Complet. |
| 24 | `sales_targets.csv` | `sales_targets` | 10 | ✅ Existe (19 lignes) | FAIBLE — Nouveau projet a plus. |
| 25 | `coverage_zones.csv` | `coverage_zones` | 5 | ✅ Existe (14 lignes) | FAIBLE — Nouveau projet a plus. |

**Tables du Groupe 1 absentes du nouveau projet (créer avant import) :**
- `email_templates` (82 lignes) — Voir schéma dans `tables-manquantes.md`
- `sop_documents` (66 lignes) — Schéma inconnu
- `partner_program_terms` (108 lignes) — Voir schéma dans `tables-manquantes.md`
- `streaming_catalog` (6 lignes) — Schéma inconnu
- `payment_gateway_settings` (1 ligne) — Schéma inconnu

---

### GROUPE 2 — DÉPENDENT DU GROUPE 1

| # | Fichier CSV | Table cible | Lignes | FK vers | Risque |
|---|---|---|---|---|---|
| 26 | `influencers.csv` | `influencers` | 7 | commission_plans | FAIBLE — Complet. |
| 27 | `referral_codes.csv` | `referral_codes` | 714 | influencers | FAIBLE — Complet. |
| 28 | `orders.csv` | `orders` | **56** | accounts, technicians, payment_methods | 🔴 ÉLEVÉ — 41 commandes manquantes. Conflit UUID possible. |
| 29 | `subscriptions.csv` | `subscriptions` | 11 | accounts | FAIBLE — Complet. |
| 30 | `service_addresses.csv` | `service_addresses` | **17** | accounts | 🔴 ÉLEVÉ — Table absente du nouveau projet. Créer d'abord. |
| 31 | `service_instances.csv` | `service_instances` | 12 | orders, services | FAIBLE — Complet. |
| 32 | `field_leads.csv` | `field_leads` | 1 | — | FAIBLE — Complet. |
| 33 | `field_territory_assignments.csv` | `field_territory_assignments` | 4 | field_territories | FAIBLE — Complet. |
| 34 | `field_sales_config.csv` | `field_sales_config` | 24 | — | FAIBLE — Complet. |
| 35 | `field_sales_promotions.csv` | `field_sales_promotions` | 6 | — | FAIBLE — Complet. |
| 36 | `channel_packages.csv` | `channel_packages` | 8 | tv_packs | FAIBLE — Nouveau projet a 16. |
| 37 | `channel_selections.csv` | `channel_selections` | 17 | tv_channels | FAIBLE — Complet. |
| 38 | `job_applicants.csv` | `job_applicants` | 24 | jobs | FAIBLE — Complet. |
| 39 | `staff_onboarding_tokens.csv` | `staff_onboarding_tokens` | 23 | — | FAIBLE — Complet. |
| 40 | `commission_plans.csv` | — | — | — | (déjà groupe 1) |
| 41 | `pay_periods.csv` | `pay_periods` | 6 | — | ⚠️ MOYEN — Table absente. Créer d'abord. |
| 42 | `employee_payroll_settings.csv` | `employee_payroll_settings` | 9 | employees | ⚠️ MOYEN — Table absente. Créer d'abord. |
| 43 | `tax_brackets_federal.csv` | `tax_brackets_federal` | 5 | — | ⚠️ MOYEN — Table absente. Créer d'abord. |
| 44 | `tax_brackets_quebec.csv` | `tax_brackets_quebec` | 4 | — | ⚠️ MOYEN — Table absente. Créer d'abord. |
| 45 | `admin_users.csv` | `admin_users` | 2 | — | 🔴 ÉLEVÉ — Table absente. Créer + analyser conflit avec auth.users. |
| 46 | `staff_roles.csv` | `staff_roles` | 2 | auth.users | ⚠️ MOYEN — Table absente. Enum `staff_role` à créer. |

---

### GROUPE 3 — DÉPENDENT DES GROUPES 1–2

| # | Fichier CSV | Table cible | Lignes | FK vers | Risque |
|---|---|---|---|---|---|
| 47 | `support_tickets.csv` | `support_tickets` | **14 264** | accounts, orders | 🔴 ÉLEVÉ — 14160 tickets manquants. Import massif. |
| 48 | `billing_customers.csv` | `billing_customers` | 13 | accounts | FAIBLE — Complet. |
| 49 | `billing_subscriptions.csv` | `billing_subscriptions` | 10 | orders | FAIBLE — Complet. |
| 50 | `billing_subscription_services.csv` | `billing_subscription_services` | **17** | billing_subscriptions, services | 🔴 ÉLEVÉ — Table vide dans nouveau projet. |
| 51 | `training_lessons.csv` | `training_lessons` | **1 756** | training_modules | 🔴 ÉLEVÉ — 1746 leçons manquantes. |
| 52 | `quotes.csv` | `quotes` | **195** | accounts, orders | 🔴 ÉLEVÉ — 177 soumissions manquantes. |
| 53 | `client_login_pins.csv` | `client_login_pins` | 25 | profiles | FAIBLE — Complet. |
| 54 | `marketing_campaigns.csv` | — | — | — | (déjà groupe 1) |
| 55 | `client_auto_documents.csv` | `client_auto_documents` | 54 | profiles | FAIBLE — Complet. |
| 56 | `client_billing_preferences.csv` | `client_billing_preferences` | 13 | accounts | FAIBLE — Complet. |
| 57 | `client_reviews.csv` | `client_reviews` | 7 | accounts | FAIBLE — Complet. |
| 58 | `client_referrals.csv` | `client_referrals` | **2** | profiles | 🔴 ÉLEVÉ — Table vide dans nouveau projet. |
| 59 | `kyc_requests.csv` | `kyc_requests` | 5 | accounts | FAIBLE — Complet. |
| 60 | `kyc_verifications.csv` | `kyc_verifications` | 12 | profiles | ⚠️ MOYEN — Table absente. Créer d'abord. |
| 61 | `identity_verification_sessions.csv` | `identity_verification_sessions` | 48 | profiles | 🔴 ÉLEVÉ — Table vide dans nouveau projet. |
| 62 | `identity_verification_events.csv` | `identity_verification_events` | 63 | identity_verification_sessions | ⚠️ MOYEN — Table absente. Import après sessions. |
| 63 | `client_internal_notes.csv` | `client_internal_notes` | **353** | profiles | 🔴 ÉLEVÉ — Table absente. Créer d'abord. |
| 64 | `installations.csv` | `installations` | 51 | orders, technicians | FAIBLE — Complet. |
| 65 | `installation_appointments.csv` | `installation_appointments` | 1 | orders | FAIBLE — Complet. |
| 66 | `field_commissions.csv` | `field_commissions` | 15 | field_leads | FAIBLE — Complet. |
| 67 | `field_sales_orders.csv` | `field_sales_orders` | **27** | — | 🔴 ÉLEVÉ — 13 commandes manquantes. |
| 68 | `field_payment_intents.csv` | `field_payment_intents` | 35 | field_quotes | FAIBLE — Complet. |
| 69 | `staff_schedules.csv` | `staff_schedules` | **61** | auth.users | ⚠️ MOYEN — Table absente. Créer d'abord. |
| 70 | `payroll_runs.csv` | `payroll_runs` | 3 | — | ⚠️ MOYEN — Table absente. Créer d'abord. |
| 71 | `hr_requests.csv` | `hr_requests` | 1 | — | FAIBLE — Table absente. |
| 72 | `commission_rules.csv` | `commission_rules` | 9 | commission_plans | 🔴 ÉLEVÉ — Table absente. Impact billing. |
| 73 | `sms_campaigns.csv` | `sms_campaigns` | 18 | — | ⚠️ MOYEN — 4 campagnes manquantes. |
| 74 | `email_trigger_queue.csv` | `email_trigger_queue` | **704** | — | 🔴 ÉLEVÉ — Table absente. 704 emails. |
| 75 | `security_events.csv` | `security_events` | **108** | auth.users | ⚠️ MOYEN — Table absente. |
| 76 | `stripe_plan_mapping.csv` | `stripe_plan_mapping` | **32** | services | 🔴 ÉLEVÉ — Table absente. Billing Stripe cassé. |
| 77 | `operational_fees.csv` | `operational_fees` | **11** | — | 🔴 ÉLEVÉ — Table absente. Frais de service manquants. |

---

### GROUPE 4 — DÉPENDENT DU GROUPE 3

| # | Fichier CSV | Table cible | Lignes | FK vers | Risque |
|---|---|---|---|---|---|
| 78 | `ticket_replies.csv` | `ticket_replies` | **33 873** | support_tickets | 🔴 ÉLEVÉ — 33631 réponses manquantes. Import massif. |
| 79 | `billing_invoices.csv` | `billing_invoices` | 14 | billing_customers, billing_subscriptions | FAIBLE — Nouveau projet a 17. |
| 80 | `billing_payments.csv` | `billing_payments` | 11 | billing_customers | FAIBLE — Complet. |
| 81 | `billing_invoice_lines.csv` | `billing_invoice_lines` | 40 | billing_invoices | FAIBLE — Nouveau projet a 43. |
| 82 | `training_questions.csv` | `training_questions` | 100 | training_modules | FAIBLE — Complet. |
| 83 | `training_progress.csv` | `training_progress` | 13 | training_modules | FAIBLE — Nouveau projet a 23. |
| 84 | `quote_lines.csv` | `quote_lines` | 69 | quotes | FAIBLE — Complet. |
| 85 | `quote_events.csv` | `quote_events` | 135 | quotes | FAIBLE — Complet. |
| 86 | `quote_approvals.csv` | `quote_approvals` | 3 | quotes | FAIBLE — Complet. |
| 87 | `payroll_entries.csv` | `payroll_entries` | 6 | pay_periods | 🔴 ÉLEVÉ — Table absente. Créer d'abord. |
| 88 | `payroll_payments.csv` | `payroll_payments` | 5 | payroll_runs | 🔴 ÉLEVÉ — Table absente. |
| 89 | `payroll_payment_events.csv` | `payroll_payment_events` | 25 | payroll_payments | ⚠️ MOYEN — Table absente. |
| 90 | `employment_letters.csv` | `employment_letters` | 8 | employees | ⚠️ MOYEN — Table absente. |
| 91 | `hr_audit_log.csv` | `hr_audit_log` | 36 | auth.users | ⚠️ MOYEN — Table absente. |
| 92 | `sop_documents.csv` | `sop_documents` | **66** | — | ⚠️ MOYEN — Table absente. |
| 93 | `hub_posts.csv` | `hub_posts` | **47** | auth.users | 🔴 ÉLEVÉ — 42 posts manquants. |
| 94 | `hub_certificates.csv` | `hub_certificates` | 3 | — | FAIBLE — Table absente. |
| 95 | `hub_training_progress.csv` | `hub_training_progress` | 3 | — | FAIBLE — Table absente. |
| 96 | `job_email_templates.csv` | `job_email_templates` | **22** | — | 🔴 ÉLEVÉ — 18 templates manquants. |
| 97 | `social_media_posts.csv` | `social_media_posts` | **104** | — | 🔴 ÉLEVÉ — 85 posts manquants. |
| 98 | `marketing_campaigns.csv` | (groupe 1) | — | — | |
| 99 | `training_simulations.csv` | `training_simulations` | 3 | — | FAIBLE — Complet. |

---

### GROUPE 5 — LOGS ET DONNÉES DÉRIVÉES

Ces tables peuvent être importées dans n'importe quel ordre après les groupes 1–4 :

| # | Fichier CSV | Table cible | Lignes | Risque |
|---|---|---|---|---|
| 100 | `support_tickets_ai.csv` | `support_tickets_ai` | 0 | FAIBLE |
| 101 | `agent_audit_log.csv` | `agent_audit_log` | 13 753 | ⚠️ MOYEN — 469 entrées différentes |
| 102 | `agent_events.csv` | `agent_events` | 37 611 | FAIBLE — Nouveau projet a 8772 de plus |
| 103 | `agent_runs.csv` | `agent_runs` | 4 014 | FAIBLE |
| 104 | `agent_registry.csv` | `agent_registry` | 31 | FAIBLE |
| 105 | `live_activity_logs.csv` | `live_activity_logs` | 8 297 | FAIBLE |
| 106 | `sync_audit_log.csv` | `sync_audit_log` | 22 419 | FAIBLE — Complet |
| 107 | `internal_audit_log.csv` | `internal_audit_log` | 2 836 | FAIBLE |
| 108 | `auth_login_attempts.csv` | `auth_login_attempts` | 112 | FAIBLE |
| 109 | `admin_audit_log.csv` | `admin_audit_log` | 88 | FAIBLE |
| 110 | `admin_otp_sessions.csv` | `admin_otp_sessions` | 307 | FAIBLE |
| 111 | `admin_secret_audit_log.csv` | `admin_secret_audit_log` | 322 | FAIBLE |
| 112 | `activity_logs.csv` | `activity_logs` | 324 | FAIBLE |
| 113 | `email_send_log.csv` | `email_send_log` | 6 318 | FAIBLE — Complet |
| 114 | `email_queue.csv` | `email_queue` | **5 456** | 🔴 ÉLEVÉ — 3073 emails manquants |
| 115 | `customer_portal_projection_logs.csv` | `customer_portal_projection_logs` | **661 218** | 🔴 ÉLEVÉ — Table vide (0 lignes). Import très volumineux. |
| 116 | `customer_portal_projection_alerts.csv` | `customer_portal_projection_alerts` | **208 282** | 🔴 ÉLEVÉ — 155282 alertes manquantes |
| 117 | `customer_portal_snapshots.csv` | `customer_portal_snapshots` | 711 | FAIBLE |
| 118 | `site_health_checks.csv` | `site_health_checks` | 15 225 | FAIBLE |
| 119 | `rate_limit_attempts.csv` | `rate_limit_attempts` | 1 020 | FAIBLE |
| 120 | `telephony_logs.csv` | `telephony_logs` | 851 | ⚠️ MOYEN — 478 logs manquants |
| 121 | `chatbot_logs.csv` | `chatbot_logs` | 174 | ⚠️ MOYEN — 98 logs manquants |
| 122 | `hub_login_audit.csv` | `hub_login_audit` | 197 | FAIBLE |
| 123 | `dob_validation_debug.csv` | `dob_validation_debug` | 108 | FAIBLE |
| 124 | `billing_system_alerts.csv` | `billing_system_alerts` | 91 | ⚠️ MOYEN — 8 alertes différentes |
| 125 | `billing_automation_runs.csv` | `billing_automation_runs` | 93 | FAIBLE |
| 126 | `direct_emails.csv` | `direct_emails` | **70** | 🔴 ÉLEVÉ — 64 emails manquants |
| 127 | `direct_email_recipients.csv` | `direct_email_recipients` | 429 | FAIBLE |
| 128 | `nova_actions.csv` | `nova_actions` | 78 | FAIBLE |
| 129 | `overdue_reminder_log.csv` | `overdue_reminder_log` | 39 | FAIBLE |
| 130 | `campaign_sends.csv` | `campaign_sends` | 45 | FAIBLE |
| 131 | `daily_backup_log.csv` | `daily_backup_log` | 83 | FAIBLE |
| 132 | `admin_security_audit.csv` | `admin_security_audit` | 107 | ⚠️ MOYEN — Table absente |
| 133 | `admin_audit_sessions.csv` | `admin_audit_sessions` | 4 | FAIBLE — Table absente |
| 134 | `admin_notification_logs.csv` | `admin_notification_logs` | 15 | FAIBLE — Table absente |
| 135 | `pdf_generation_logs.csv` | `pdf_generation_logs` | 40 | FAIBLE — Table absente |
| 136 | `sms_queue.csv` | `sms_queue` | 16 | FAIBLE — Table absente |
| 137 | `client_notification_logs.csv` | `client_notification_logs` | 0 | FAIBLE |
| ... | *tous les autres CSV avec 0 lignes* | — | 0 | FAIBLE |

*(Les CSV avec 0 lignes peuvent être ignorés — aucune donnée à récupérer)*

---

## TABLES NÉCESSITANT CRÉATION PRÉALABLE (avant tout import)

Ces tables doivent être créées dans le nouveau projet **avant** de pouvoir y importer des données :

| Priorité | Table | Lignes | Schéma disponible |
|---|---|---|---|
| 🔴 P1 | `email_templates` | 82 | Oui (migrations) |
| 🔴 P1 | `stripe_plan_mapping` | 32 | Oui (migrations) |
| 🔴 P1 | `client_internal_notes` | 353 | Oui (migrations) |
| 🔴 P1 | `email_trigger_queue` | 704 | Oui (migrations) |
| 🔴 P1 | `operational_fees` | 11 | Oui (migrations) |
| 🔴 P1 | `commission_rules` | 9 | Partiellement |
| 🟠 P2 | `service_addresses` | 17 | Partiellement |
| 🟠 P2 | `staff_schedules` | 61 | Oui (migrations) |
| 🟠 P2 | `partner_program_terms` | 108 | Oui (migrations) |
| 🟠 P2 | `kyc_verifications` | 12 | Partiellement |
| 🟠 P2 | `identity_verification_events` | 63 | Oui (migrations) |
| 🟠 P2 | `payroll_entries` | 6 | Oui (migrations) |
| 🟠 P2 | `payroll_payments` | 5 | Partiellement |
| 🟠 P2 | `payroll_runs` | 3 | Partiellement |
| 🟠 P2 | `pay_periods` | 6 | Partiellement |
| 🟠 P2 | `security_events` | 108 | Oui (migrations) |
| 🟠 P2 | `staff_roles` | 2 | Oui (migrations) |
| 🟠 P2 | `hr_audit_log` | 36 | Oui (migrations) |
| 🟡 P3 | `sop_documents` | 66 | Non trouvé |
| 🟡 P3 | `streaming_catalog` | 6 | Non trouvé |
| 🟡 P3 | `admin_users` | 2 | Non trouvé |
| 🟡 P3 | `payment_gateway_settings` | 1 | Non trouvé |
| 🟡 P3 | `tax_brackets_federal` | 5 | Non trouvé |
| 🟡 P3 | `tax_brackets_quebec` | 4 | Non trouvé |
| 🟡 P3 | `employee_payroll_settings` | 9 | Non trouvé |
| 🟡 P3 | `employment_letters` | 8 | Non trouvé |
| 🟡 P3 | `payroll_payment_events` | 25 | Non trouvé |
| 🟡 P3 | `automatic_email_dispatches` | 189 | Non trouvé |
| ... | *autres tables absentes* | ... | Non trouvé |

---

## RISQUES TRANSVERSAUX

| Risque | Description | Mitigation |
|---|---|---|
| **Conflits UUID** | Les tables avec données dans les deux projets peuvent avoir des UUID identiques | Comparer les IDs avant import — utiliser `ON CONFLICT DO NOTHING` |
| **Intégrité référentielle** | Importer un enfant avant son parent cassera les FK | Respecter l'ordre topologique des groupes |
| **RLS (Row Level Security)** | Le nouveau projet a probablement des politiques RLS actives | Importer via service_role key uniquement |
| **Triggers** | Des triggers automatiques peuvent s'exécuter lors de l'import | Désactiver les triggers non essentiels pendant l'import |
| **Séquences** | Les colonnes `SERIAL` ou `BIGSERIAL` peuvent avoir des séquences décalées | Réinitialiser les séquences après import |
| **Volume** | `customer_portal_projection_logs` = 661 218 lignes, `ticket_replies` = 33 873 | Import par batch de 1000 lignes avec checkpoint |
| **Encodage** | Les CSV exportés de Supabase sont en UTF-8 | Vérifier l'encodage avant import |
| **Timestamps** | Les colonnes `TIMESTAMPTZ` peuvent nécessiter un format spécifique | Vérifier le format ISO 8601 dans les CSV |

---

## COMMANDE D'IMPORT TYPE (référence — NE PAS EXÉCUTER SANS VALIDATION)

```sql
-- Exemple pour support_tickets — À NE PAS EXÉCUTER MAINTENANT
-- Désactiver RLS temporairement
SET LOCAL session_replication_role = 'replica';

-- Import avec gestion des conflits
COPY support_tickets FROM '/path/to/support_tickets.csv' 
WITH (FORMAT csv, HEADER true, DELIMITER ',');

-- Ou via psql (depuis ligne de commande)
-- psql "postgresql://..." -c "\COPY support_tickets FROM 'support_tickets.csv' CSV HEADER"

-- Réactiver RLS
SET LOCAL session_replication_role = 'origin';
```

---

## VÉRIFICATION DE COUVERTURE DE L'EXPORT

| Critère | Résultat |
|---|---|
| Nombre de fichiers CSV | 439 |
| Archive ZIP présente | Oui — `exports_nivra.zip` (90 MB) |
| Date d'export | 2026-06-13 06:36–06:43 |
| Tables dans migrations Lovable | 578 fichiers SQL (jusqu'au 2026-04-14) |
| Tables CSV vs migrations | Toutes les tables connues sont dans le CSV |
| Tables hors migrations (créées dashboard) | Non vérifiable sans accès ancien projet |
| **Couverture estimée** | **~95–100% de l'ancien projet** |

**Conclusion :** L'export CSV représente la totalité observable de l'ancien projet. Aucune table connue n'est absente. La probabilité qu'il manque des tables dans l'export est très faible.
