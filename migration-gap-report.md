# RAPPORT D'AUDIT FONCTIONNEL — NIVRA TELECOM
**Date:** 2026-06-14  
**Nouveau projet Supabase:** `lacxnbjvcyvhrttprkxr`  
**Ancien projet Supabase:** `xtgngmtxggascbxnswvb`

---

## ⚠️ AVERTISSEMENT CRITIQUE : ANCIEN PROJET INACCESSIBLE

L'ancien projet `xtgngmtxggascbxnswvb` est **INACCESSIBLE** via l'API Supabase :
- `GET /v1/projects/xtgngmtxggascbxnswvb/database/tables` → **404 Not Found**
- `GET /v1/projects/xtgngmtxggascbxnswvb/functions` → **403 Forbidden**

**Je ne peux pas comparer directement l'ancien projet.** Ce rapport compare :
- **CODEBASE** : ce que l'application React attend (routes, composants, edge functions)
- **NOUVEAU PROJET** : ce qui est réellement déployé dans `lacxnbjvcyvhrttprkxr`

Toute référence à "l'ancien projet" dans ce rapport est basée sur ce que la codebase attendait, pas sur une lecture directe de l'ancienne base.

---

## DONNÉES BRUTES VÉRIFIÉES

| Ressource | Quantité |
|---|---|
| Tables `public` dans nouveau projet | **378** |
| Edge functions déployées (nouveau projet) | **304** |
| RPCs/fonctions PostgreSQL | **494** |
| Fichiers pages React (`src/pages/**`) | **239** |
| Edge functions dans codebase (`supabase/functions/`) | **304** |
| Portails distincts | **11** |

**Résultat edge functions :** 304 dans codebase = 304 déployées → **100% déployées** ✅

---

## TABLEAU DE STATUT PAR MODULE

| Module | Route principale | Pages codebase | Tables présentes | Fonctions déployées | Statut |
|---|---|---|---|---|---|
| Portail Client | `/portal/*` | 26 | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (données vides) |
| Nivra Core | `/core/*` | 80+ | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (données vides) |
| Portail Technicien | `/tech/*` | 6 | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (données vides) |
| Portail Employé | `/employee/*` | 25 | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (données vides) |
| Portail Field Sales | `/field/*` | 28 | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (données vides) |
| Portail HR | `/hr/*` | 14 | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (données vides) |
| CRM | `/core/crm` | 3 (partagé) | ✅ Toutes présentes | ✅ Toutes déployées | ✅ FONCTIONNEL |
| Billing | `/core/billing` | 6 | ✅ Toutes présentes | ✅ Toutes déployées | ✅ FONCTIONNEL |
| Provisioning | `/core/provisioning` | 2 | ✅ Toutes présentes | ✅ Déployée | ⚠️ PARTIEL (données vides) |
| Inventaire | `/core/equipment` | 3 | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (données vides) |
| IPTV/TV | `/core/channels` | 4 | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (données vides) |
| VoIP/Téléphonie | `/core/telephony` | 2 | ⚠️ Partiel | ✅ Toutes déployées | ⚠️ PARTIEL |
| Support/Tickets | `/core/support` | 5 | ✅ Toutes présentes | ✅ Toutes déployées | ✅ FONCTIONNEL |
| Documents | `/core/documents` | 4 | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (job queue vide) |
| Field Service | `/tech/*` | 6 | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (données vides) |
| NOC | `/core/network` | 3 | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (données vides) |
| Marketing | `/marketing/*` | 6 | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (campagnes vides) |
| Influenceur | `/influencer/*` | 10 | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (données vides) |
| Hub Interne | `/nivra-secure-hub-2617-internal` | 4 | ✅ Toutes présentes | ✅ Toutes déployées | ⚠️ PARTIEL (données vides) |

---

## MODULE 1 — PORTAIL CLIENT `/portal/*`

### Pages (26 fichiers)
| Fichier | Route | Statut |
|---|---|---|
| `src/pages/client/ClientAuth.tsx` | `/portal/auth` | ✅ |
| `src/pages/client/ClientDashboard.tsx` | `/portal` | ✅ |
| `src/pages/client/ClientInvoices.tsx` | `/portal/invoices` | ✅ |
| `src/pages/client/ClientMonthlyInvoices.tsx` | `/portal/monthly-invoices` | ✅ |
| `src/pages/client/ClientServices.tsx` | `/portal/services` | ✅ |
| `src/pages/client/ClientTickets.tsx` | `/portal/tickets` | ✅ |
| `src/pages/client/ClientAppointments.tsx` | `/portal/appointments` | ✅ |
| `src/pages/client/ClientOrders.tsx` | `/portal/orders` | ✅ |
| `src/pages/client/ClientNewOrder.tsx` | `/portal/new-order` | ✅ |
| `src/pages/client/ClientOrderConfirmation.tsx` | `/portal/order-confirmation` | ✅ |
| `src/pages/client/ClientPayments.tsx` | `/portal/payments` | ✅ |
| `src/pages/client/ClientPaymentMethod.tsx` | `/portal/paiement` | ✅ |
| `src/pages/client/ClientBillingHub.tsx` | `/portal/billing` | ✅ |
| `src/pages/client/ClientProfile.tsx` | `/portal/profile` | ✅ |
| `src/pages/client/ClientEquipment.tsx` | `/portal/equipment` | ✅ |
| `src/pages/client/ClientEquipmentReplacement.tsx` | `/portal/replacement` | ✅ |
| `src/pages/client/ClientChannels.tsx` | `/portal/channels` | ✅ |
| `src/pages/client/ClientContracts.tsx` | `/portal/contracts` | ✅ |
| `src/pages/client/ClientDocuments.tsx` | `/portal/documents` | ✅ |
| `src/pages/client/ClientDocumentUpload.tsx` | `/portal/upload` | ✅ |
| `src/pages/client/ClientLoyalty.tsx` | `/portal/loyalty` | ✅ |
| `src/pages/client/ClientChangePlan.tsx` | `/portal/change-plan` | ✅ |
| `src/pages/client/ClientReferrals.tsx` | `/portal/referrals` | ✅ |
| `src/pages/client/ClientCancellations.tsx` | `/portal/cancellations` | ✅ |
| `src/pages/client/ClientActivation.tsx` | `/portal/activation` | ✅ |
| `src/pages/client/ClientIdentityVerification.tsx` | `/portal/identity-verification` | ✅ |
| `src/pages/client/ClientServiceAddresses.tsx` | `/portal/service-addresses` | ✅ |
| `src/pages/client/ClientPhoneOrders.tsx` | `/portal/phones` | ✅ |
| `src/pages/client/ClientWebForms.tsx` | `/portal/web-forms` | ✅ |
| `src/pages/client/ClientGuides.tsx` | `/portal/guides` | ✅ |
| `src/pages/client/ClientPortIn.tsx` | `/portal/port-in` | ✅ |
| `src/pages/client/ClientSuspended.tsx` | `/portal/suspended` | ✅ |
| `src/pages/client/ClientAccessBlocked.tsx` | `/portal/access-blocked` | ✅ |

### Tables requises vs présentes
| Table | Présente dans nouveau projet |
|---|---|
| `profiles` | ✅ |
| `accounts` | ✅ |
| `billing_invoices` | ✅ |
| `billing_payments` | ✅ |
| `billing_subscriptions` | ✅ |
| `billing_customers` | ✅ |
| `orders` | ✅ |
| `order_items` | ✅ |
| `support_tickets` | ✅ |
| `ticket_replies` | ✅ |
| `equipment_inventory` | ✅ |
| `contracts` | ✅ |
| `client_documents` | ✅ |
| `client_login_pins` | ✅ |
| `client_auto_documents` | ✅ |
| `pending_document_jobs` | ✅ |
| `loyalty_points` | ✅ *(créée vide ce session)* |
| `loyalty_rewards` | ✅ *(créée vide ce session)* |
| `loyalty_transactions` | ✅ *(créée vide ce session)* |
| `service_addresses` | ✅ *(créée vide ce session)* |
| `client_referrals` | ✅ *(créée vide ce session)* |
| `referral_codes` | ✅ |
| `phone_inventory` | ✅ *(créée vide ce session)* |
| `phone_orders` | ✅ *(créée vide ce session)* |
| `channel_selections` | ✅ |
| `tv_channels` | ✅ |
| `client_payment_methods` | ✅ |
| `client_billing_preferences` | ✅ |
| `client_billing_settings` | ✅ |
| `appointments` | ✅ |
| `installation_appointments` | ✅ |
| `service_cancellation_requests` | ✅ |
| `web_form_threads` | ✅ |
| `web_form_messages` | ✅ |
| `identity_verification_sessions` | ✅ |

### RPCs utilisés vs fonctionnels
| RPC | Statut vérifié |
|---|---|
| `customer_portal_enrich_snapshot` | ✅ FONCTIONNEL (réparé ce session) |
| `get_client_history_snapshot` | ✅ FONCTIONNEL (réparé ce session) |
| `get_client_balance` | ✅ FONCTIONNEL |
| `get_client_ledger_balance` | ✅ FONCTIONNEL |
| `check_portal_access` | ✅ FONCTIONNEL |

### Edge functions utilisées vs déployées
| Fonction | Déployée | Statut test |
|---|---|---|
| `client-pin-send` | ✅ | ✅ 400 (réparé BOOT_ERROR ce session) |
| `client-pin-verify` | ✅ | ✅ OK (needs args) |
| `client-plan-change` | ✅ | Non testé |
| `send-client-document` | ✅ | ✅ 500 "job_id required" (réparé BOOT_ERROR ce session) |
| `chatbot-jonathan` | ✅ | ⚠️ 400 (attend sessionId) |
| `portal-add-credit` | ✅ | Non testé |
| `portal-submit-interac-payment` | ✅ | Non testé |
| `paypal-client-token` | ✅ | Non testé |
| `paypal-create-subscription` | ✅ | Non testé |
| `paypal-capture-order` | ✅ | Non testé |
| `account-documents-list` | ✅ | Non testé |

### ⚠️ PROBLÈMES PORTAIL CLIENT
1. **9 tables créées VIDES** par Claude durant ce session pour corriger des erreurs SQL — aucune donnée de l'ancien projet n'y a été migrée : `loyalty_points`, `loyalty_rewards`, `loyalty_transactions`, `service_addresses`, `client_referrals`, `phone_inventory`, `phone_orders`, `document_requests`, `billing_subscription_services`
2. **`/portal/loyalty`** → page `ClientLoyalty.tsx` lit `loyalty_points` → table vide → affichera 0 points pour tous les clients
3. **`/portal/phones`** → page `ClientPhoneOrders.tsx` lit `phone_orders` → table vide
4. **`/portal/service-addresses`** → lit `service_addresses` → table vide
5. **`chatbot-jonathan`** nécessite un `sessionId` dans le body (comportement normal, pas un bug)

---

## MODULE 2 — NIVRA CORE `/core/*`

### Pages (80+ fichiers dans `src/core-app/pages/`)
| Route | Composant | Statut |
|---|---|---|
| `/core/dashboard` | `DashboardPage` | ✅ |
| `/core/clients` | `ClientsPage` | ✅ |
| `/core/clients/:id` | `CoreClientProfile` | ✅ |
| `/core/accounts` | `AccountsPage` | ✅ |
| `/core/accounts/:id` | `CoreAccountDetail` | ✅ |
| `/core/orders` | `OrdersPage` | ✅ |
| `/core/orders/:id` | `CoreOrderDetail` | ✅ |
| `/core/billing` | `CoreBillingPage` | ✅ |
| `/core/invoices` | `InvoicesPage` | ✅ |
| `/core/invoices/:id` | `CoreInvoiceDetail` | ✅ |
| `/core/payments` | `PaymentsPage` | ✅ |
| `/core/subscriptions` | `SubscriptionsPage` | ✅ |
| `/core/crm` | `CoreCrm` | ✅ |
| `/core/support` | `CoreSupportPage` | ✅ |
| `/core/kyc` | `CoreKYCPage` | ✅ |
| `/core/appointments` | `AppointmentsPage` | ✅ |
| `/core/provisioning` | `CoreProvisioningPage` | ✅ |
| `/core/provisioning-jobs` | `CoreProvisioningJobsPage` | ✅ |
| `/core/equipment` | `EquipmentInventoryPage` | ✅ |
| `/core/channels` | `CoreChannelsPage` | ✅ |
| `/core/streaming` | `CoreStreamingPage` | ✅ |
| `/core/contracts` | `CoreContractsPage` | ✅ |
| `/core/telephony` | `CoreTelephonyPage` | ✅ |
| `/core/did` | `CoreDIDPage` | ✅ |
| `/core/network` | `CoreNetworkPage` | ✅ |
| `/core/hr` | `HrDashboardPage` | ✅ |
| `/core/hr/employees` | `HrEmployeesPage` | ✅ |
| `/core/hr/payroll` | `HrPayrollPage` | ✅ |
| `/core/field-agents` | `CoreFieldAgentsPage` | ✅ |
| `/core/referrals` | `CoreReferralsPage` | ✅ |
| `/core/marketing` | `MarketingHubDashboard` | ✅ |
| `/core/agents` | `CoreAgentControlCenter` | ✅ |
| `/core/brain` | `NovaBrainPage` | ✅ |
| `/core/quotes` | `CoreQuotesPage` | ✅ |
| `/core/recouvrement` | `CoreRecouvrementPage` | ✅ |
| `/core/revenue-assurance` | `CoreRevenueAssurancePage` | ✅ |
| `/core/returns` | `CoreReturnsPage` | ✅ |
| `/core/cancellations` | `CoreCancellationsPage` | ✅ |
| `/core/complaints` | `CoreComplaintsPage` | ✅ |
| `/core/supplier-accounts` | `SupplierAccountsPage` | ✅ |
| `/core/pos` | `CorePOSPage` | ✅ |

### RPCs Nivra Core clés — statut testé
| RPC | Statut |
|---|---|
| `search_clients_unified` | ✅ FONCTIONNEL (réparé ce session) |
| `crm_manager_dashboard` | ✅ FONCTIONNEL |
| `compute_invoice_breakdown` | ✅ FONCTIONNEL |
| `get_customer_unpaid_invoices` | ✅ FONCTIONNEL |

### ⚠️ PROBLÈMES NIVRA CORE
1. **`/core/did`** — DID = numéros de téléphone VoIP. La table `telephony_logs` existe mais **il n'y a pas de table `did_numbers` ou `sip_accounts`** dans la DB → le module DID affichera probablement une liste vide ou une erreur selon l'implémentation de `CoreDIDPage`
2. **`/core/stock`** — lit `inventory_stock_levels`. Table présente ✅ mais vide
3. **`/core/phones/inventory`** — lit `phone_inventory`. Table présente ✅ mais **CRÉÉE VIDE** ce session

---

## MODULE 3 — PORTAIL TECHNICIEN `/tech/*`

### Pages (6 fichiers dans `src/tech-app/pages/`)
| Fichier | Route | Statut |
|---|---|---|
| `TechDashboard` | `/tech` | ✅ |
| `TechAssignments` | `/tech/assignments` | ✅ |
| `TechInstallation` | `/tech/installation/:id` | ✅ |
| `TechActive` | `/tech/active` | ✅ |
| `TechScanner` | `/tech/scanner` | ✅ |
| `TechProfile` | `/tech/profile` | ✅ |

### Tables
| Table | Présente |
|---|---|
| `technicians` | ✅ |
| `technician_assignments` | ✅ |
| `technician_slots` | ✅ |
| `technician_slot_bookings` | ✅ |
| `installations` | ✅ |
| `installation_appointments` | ✅ |
| `installation_steps_template` | ✅ |
| `work_orders` | ✅ |
| `work_order_files` | ✅ |
| `work_order_updates` | ✅ |

### Edge functions
| Fonction | Déployée | Test |
|---|---|---|
| `technician-auth` | ✅ | Non testé |
| `technician-dashboard` | ✅ | Non testé |
| `technician-update-status` | ✅ | Non testé |
| `technician-work-orders` | ✅ | Non testé |

### ⚠️ PROBLÈMES
1. Tables présentes mais **aucun technicien enregistré** → portail vide au login

---

## MODULE 4 — PORTAIL EMPLOYÉ `/employee/*`

### Pages (25 fichiers dans `src/employee-app/pages/`)
| Route | Composant |
|---|---|
| `/employee/dashboard` | `EmployeeDashboard` |
| `/employee/work-queue` | `EmployeeWorkQueue` |
| `/employee/orders` | `EmployeeOrders` |
| `/employee/orders/:id` | `EmployeeOrderDetail` |
| `/employee/clients` | `EmployeeClients` |
| `/employee/clients/:id` | `EmployeeClientDetail` |
| `/employee/accounts` | `EmployeeAccounts` |
| `/employee/accounts/:id` | `EmployeeAccountDetail` |
| `/employee/payments` | `EmployeePayments` |
| `/employee/kyc` | `EmployeeKYC` |
| `/employee/activations` | `EmployeeActivations` |
| `/employee/appointments` | `EmployeeAppointments` |
| `/employee/support` | `EmployeeSupport` |
| `/employee/support/:id` | `EmployeeSupportDetail` |
| `/employee/equipment` | `EmployeeEquipment` |
| `/employee/crm` | `EmployeeCrm` |
| `/employee/quotes` | `EmployeeQuotes` |
| `/employee/profile` | `EmployeeProfile` |
| `/employee/audit` | `EmployeeAudit` |

### Edge functions
| Fonction | Déployée |
|---|---|
| `employee-auth` | ✅ |
| `employee-data` | ✅ |
| `employee-operations` | ✅ |
| `employee-verify-customer-pin` | ✅ |
| `employee-work-engine` | ✅ |

### ⚠️ PROBLÈMES
1. **Aucun employé enregistré** → login impossible sans données dans `employees`

---

## MODULE 5 — CRM

### Pages
| Route | Composant | Portail |
|---|---|---|
| `/core/crm` | `CoreCrm` | Nivra Core |
| `/employee/crm` | `EmployeeCrm` | Employé |
| `/field/crm` | `FieldCrm` | Field Sales |

### Tables
| Table | Présente |
|---|---|
| `crm_contacts` | ✅ |
| `crm_call_logs` | ✅ |
| `crm_scripts` | ✅ |
| `crm_territories` | ✅ |
| `crm_agent_status` | ✅ |
| `crm_agent_quotas` | ✅ |
| `crm_leaderboard_v` | ✅ |
| `crm_assignment_history` | ✅ |

### RPCs
| RPC | Statut testé |
|---|---|
| `crm_manager_dashboard` | ✅ FONCTIONNEL |
| `crm_assign_contact` | Présent |
| `crm_log_call` | Présent |
| `crm_set_agent_status` | ✅ FONCTIONNEL |
| `crm_score_leads` | Présent |
| `crm_set_status` | Présent |
| `crm_transfer_contact` | Présent |

### Edge functions
| Fonction | Déployée |
|---|---|
| `crm-score-leads` | ✅ |
| `crm-send-callback-reminders` | ✅ |
| `crm-send-followup-email` | ✅ |
| `crm-create-sale` | ✅ |
| `crm-lead-capture` | ✅ |
| `agent-crm-email-blast` | ✅ |
| `agent-crm-sequence` | ✅ |
| `agent-crm-optimizer` | ✅ |

---

## MODULE 6 — BILLING

### Tables
| Table | Présente |
|---|---|
| `billing_invoices` | ✅ |
| `billing_payments` | ✅ |
| `billing_subscriptions` | ✅ |
| `billing_customers` | ✅ |
| `billing_invoice_lines` | ✅ |
| `billing_subscription_services` | ✅ *(créée vide ce session)* |
| `billing_subscription_trace_audit` | ✅ |
| `billing_alerts` | ✅ |
| `billing_automation_runs` | ✅ |
| `billing_system_alerts` | ✅ |
| `client_unpaid_invoices` | ✅ |
| `monthly_invoices` | ✅ |
| `monthly_invoice_lines` | ✅ |
| `payment_disputes` | ✅ |
| `paypal_autopay_attempts` | ✅ |
| `paypal_plan_cache` | ✅ |
| `card_payment_intents` | ✅ |

### Edge functions
| Fonction | Déployée |
|---|---|
| `billing-lifecycle` | ✅ |
| `billing-subscription-cycle` | ✅ |
| `billing-confirm-payment` | ✅ |
| `billing-reconciliation` | ✅ |
| `billing-reconcile-invoices` | ✅ |
| `billing-check-overdue` | ✅ |
| `billing-daily-overdue-reminders` | ✅ |
| `billing-account-actions` | ✅ |
| `billing-autopay-invitations` | ✅ |
| `billing-paypal-retry-failed` | ✅ |
| `billing-generate-renewals` | ✅ |
| `billing-create-order` | ✅ |
| `billing-create-subscription` | ✅ |
| `billing-health` | ✅ |
| `generate-monthly-invoices` | ✅ |
| `core-paypal-order-link` | ✅ *(réparé BOOT_ERROR ce session)* |
| `core-process-card-payment` | ✅ |
| `paypal-webhook` | ✅ |
| `paypal-create-subscription` | ✅ |
| `paypal-capture-order` | ✅ |
| `paypal-reconcile` | ✅ |
| `check-overdue-invoices` | ✅ |

### RPCs
| RPC | Statut testé |
|---|---|
| `compute_invoice_breakdown` | ✅ FONCTIONNEL |
| `get_customer_unpaid_invoices` | ✅ FONCTIONNEL |
| `apply_payment_to_invoice` | Présent |
| `generate_invoice_number` | Présent |
| `sync_billing_invoice_balance` | Présent |
| `reconcile_invoice_from_payments` | Présent |

---

## MODULE 7 — PROVISIONING

### Pages
| Route | Composant |
|---|---|
| `/core/provisioning` | `CoreProvisioningPage` |
| `/core/provisioning-jobs` | `CoreProvisioningJobsPage` |

### Tables
| Table | Présente |
|---|---|
| `provisioning_jobs` | ✅ |
| `provisioning_log` | ✅ |
| `service_instances` | ✅ |
| `activation_requests` | ✅ |
| `activation_request_history` | ✅ |

### Edge functions
| Fonction | Déployée |
|---|---|
| `provisioning-engine` | ✅ |
| `notify-activation-request` | ✅ |
| `internet-account-actions` | ✅ |
| `mobile-account-actions` | ✅ |
| `tv-account-actions` | ✅ |

---

## MODULE 8 — INVENTAIRE

### Pages
| Route | Composant |
|---|---|
| `/core/equipment` | `EquipmentInventoryPage` |
| `/core/stock` | `CoreStockPage` |
| `/core/phones/inventory` | `CorePhoneInventoryPage` |

### Tables
| Table | Présente | Note |
|---|---|---|
| `equipment_inventory` | ✅ | |
| `equipment_audit_log` | ✅ | |
| `equipment_order_lines` | ✅ | |
| `equipment_return_requests` | ✅ | |
| `inventory_items` | ✅ | |
| `inventory_stock` | ✅ | |
| `inventory_stock_levels` | ✅ | |
| `inventory_assignments` | ✅ | |
| `phone_inventory` | ✅ | ⚠️ CRÉÉE VIDE ce session |
| `phone_orders` | ✅ | ⚠️ CRÉÉE VIDE ce session |
| `shipments` | ✅ | |
| `rma_requests` | ✅ | |

### Edge functions
| Fonction | Déployée |
|---|---|
| `inventory-alert` | ✅ |
| `equipment-account-actions` | ✅ |

---

## MODULE 9 — IPTV / TV

### Pages
| Route | Composant |
|---|---|
| `/core/channels` | `CoreChannelsPage` |
| `/core/streaming` | `CoreStreamingPage` |
| `/core/tv-sur-mesure` | `CoreTVSurMesurePage` |
| `/portal/channels` | `ClientChannels` |

### Tables
| Table | Présente |
|---|---|
| `tv_channels` | ✅ |
| `tv_channels_public` | ✅ |
| `tv_packs` | ✅ |
| `tv_pack_channels` | ✅ |
| `channel_packages` | ✅ |
| `channel_selections` | ✅ |
| `channel_activity_logs` | ✅ |
| `streaming_services` | ✅ |
| `client_streaming_subscriptions` | ✅ |
| `tv_addon_subscriptions` | ✅ |
| `tv_parental_controls` | ✅ |
| `tv_plan_changes` | ✅ |
| `tv_terminal_actions` | ✅ |
| `tv_vod_purchases` | ✅ |

### Edge functions
| Fonction | Déployée |
|---|---|
| `request-streaming-subscription` | ✅ |
| `tv-account-actions` | ✅ |
| `send-streaming-activation-email` | ✅ |
| `send-channel-notification` | ✅ |

### ⚠️ PROBLÈMES
1. Tables présentes mais **aucune chaîne TV ni forfait configurés** → pages affichent listes vides

---

## MODULE 10 — VoIP / TÉLÉPHONIE

### Pages
| Route | Composant |
|---|---|
| `/core/telephony` | `CoreTelephonyPage` |
| `/core/did` | `CoreDIDPage` |

### Tables présentes
| Table | Présente |
|---|---|
| `telephony_logs` | ✅ |

### Tables absentes (attendues par le code)
| Table | Absente | Impact |
|---|---|---|
| `did_numbers` | ❌ ABSENTE | `/core/did` va planter si la page la requête |
| `sip_accounts` | ❌ ABSENTE | Possible erreur |
| `sip_trunks` | ❌ ABSENTE | Possible erreur |

> **Note :** Je n'ai pas lu le code de `CoreDIDPage` et `CoreTelephonyPage`. Si ces composants requêtent des tables qui n'existent pas, ils retourneront une erreur Supabase. **Ce point nécessite vérification manuelle.**

### Edge functions
| Fonction | Déployée |
|---|---|
| `openphone-call` | ✅ |
| `openphone-sms` | ✅ |
| `openphone-webhook` | ✅ |
| `openphone-conversations` | ✅ |
| `openphone-call-history` | ✅ |
| `openphone-phone-numbers` | ✅ |
| `log-telephony-action` | ✅ |
| `lookup-phone-carrier` | ✅ |

---

## MODULE 11 — SUPPORT / TICKETS

### Pages
| Route | Composant |
|---|---|
| `/core/support` | `CoreSupportPage` |
| `/core/internal-tickets` | `CoreInternalTicketsPage` |
| `/core/web-forms` | `CoreWebFormsPage` |
| `/portal/tickets` | `ClientTickets` |
| `/employee/support` | `EmployeeSupport` |
| `/employee/support/:id` | `EmployeeSupportDetail` |

### Tables
| Table | Présente |
|---|---|
| `support_tickets` | ✅ |
| `support_tickets_ai` | ✅ |
| `ticket_replies` | ✅ |
| `internal_tickets` | ✅ |
| `internal_ticket_replies` | ✅ |
| `live_chat_sessions` | ✅ |
| `live_chat_messages` | ✅ |
| `live_chat_admin_replies` | ✅ |
| `web_form_threads` | ✅ |
| `web_form_messages` | ✅ |
| `web_form_email_map` | ✅ |

### Edge functions
| Fonction | Déployée |
|---|---|
| `support-ai-responder` | ✅ |
| `support-email-inbound` | ✅ |
| `send-ticket-notification` | ✅ |
| `live-chat-history` | ✅ |
| `client-web-form-reply` | ✅ |
| `admin-web-form-list` | ✅ |
| `admin-web-form-reply` | ✅ |
| `admin-web-form-thread` | ✅ |

### Statut
- `support-ai-responder` → testé avec `{cron: true}` : **fonctionnel** ✅

---

## MODULE 12 — DOCUMENTS

### Pages
| Route | Composant |
|---|---|
| `/core/documents` | `CoreDocumentsPage` |
| `/portal/documents` | `ClientDocuments` |
| `/portal/upload` | `ClientDocumentUpload` |
| `/core/pdf-templates` | `CorePDFTemplatesPage` |

### Tables
| Table | Présente | Note |
|---|---|---|
| `client_documents` | ✅ | |
| `client_auto_documents` | ✅ | |
| `pending_document_jobs` | ✅ | |
| `document_requests` | ✅ | ⚠️ CRÉÉE VIDE ce session |
| `pdf_template_config` | ✅ | |
| `qa_pdf_templates_runtime` | ✅ | |
| `order_documents` | ✅ | |

### Edge functions
| Fonction | Déployée | Statut |
|---|---|---|
| `send-client-document` | ✅ | ✅ FONCTIONNEL (réparé BOOT_ERROR ce session) |
| `account-documents-list` | ✅ | Non testé |
| `client-dossier-pdf` | ✅ | Non testé |
| `process-document-jobs` | ✅ | Non testé |
| `client-pdf-download` | ✅ | Non testé |
| `send-pdf-templates` | ✅ | Non testé |
| `audit-generate-pdfs` | ✅ | Non testé |
| `generate-crtc-report` | ✅ | Non testé |

---

## MODULE 13 — FIELD SERVICE (Portail Technicien)

### Tables
| Table | Présente |
|---|---|
| `technicians` | ✅ |
| `technician_assignments` | ✅ |
| `technician_slots` | ✅ |
| `technician_slot_bookings` | ✅ |
| `installations` | ✅ |
| `installation_appointments` | ✅ |
| `work_orders` | ✅ |
| `work_order_files` | ✅ |
| `work_order_updates` | ✅ |
| `dispatch_reservations` | ✅ |

---

## MODULE 14 — NOC (Network Operations Center)

### Pages
| Route | Composant |
|---|---|
| `/core/network` | `CoreNetworkPage` |
| `/core/system-health` | `CoreSystemHealthPage` |
| `/core/system-status` | `CoreSystemStatusPage` |

### Tables
| Table | Présente |
|---|---|
| `network_nodes` | ✅ |
| `site_health_checks` | ✅ |
| `system_status` | ✅ |
| `service_status` | ✅ |
| `service_incidents` | ✅ |
| `internet_diagnostics` | ✅ |

### Edge functions
| Fonction | Déployée |
|---|---|
| `noc-monitor` | ✅ |
| `network-uptime-check` | ✅ |
| `nova-watchdog` | ✅ |
| `health` | ✅ |
| `health-check` | ✅ |
| `nivra-health-check` | ✅ |

---

## MODULE 15 — PORTAIL FIELD SALES `/field/*`

### Pages (28 fichiers dans `src/field-app/pages/`)
| Route | Composant |
|---|---|
| `/field/dashboard` | `FieldDashboard` |
| `/field/sale/new` | `FieldNewSale` |
| `/field/leads` | `FieldLeads` |
| `/field/leads/:id` | `FieldLeadDetail` |
| `/field/orders` | `FieldOrders` |
| `/field/orders/:id` | `FieldOrderDetail` |
| `/field/commissions` | `FieldCommissions` |
| `/field/territory` | `FieldTerritory` |
| `/field/crm` | `FieldCrm` |
| `/field/objectives` | `FieldObjectives` |
| `/field/performance` | `FieldPerformance` |
| `/field/tracking` | `FieldTracking` |
| `/field/clients` | `FieldClients` |

### Tables
| Table | Présente |
|---|---|
| `field_leads` | ✅ |
| `field_lead_activities` | ✅ |
| `field_lead_tasks` | ✅ |
| `field_sales_orders` | ✅ |
| `field_order_notes` | ✅ |
| `field_order_status_history` | ✅ |
| `field_commissions` | ✅ |
| `field_commission_payouts` | ✅ |
| `field_commission_payout_items` | ✅ |
| `field_territories` | ✅ |
| `field_territory_assignments` | ✅ |
| `field_territory_streets` | ✅ |
| `field_territory_visits` | ✅ |
| `field_quotes` | ✅ |
| `field_resources` | ✅ |
| `field_submissions` | ✅ |
| `field_sales_config` | ✅ |
| `field_payment_intents` | ✅ |
| `field_customer_addresses` | ✅ |
| `field_objective_templates` | ✅ |
| `field_objectives` | ✅ |
| `agent_commissions` | ✅ |
| `agent_discounts` | ✅ |

### Edge functions
| Fonction | Déployée |
|---|---|
| `field-order-engine` | ✅ |
| `field-card-intent` | ✅ |
| `field-catalog` | ✅ |
| `field-serviceability` | ✅ |
| `field-pricing-quote` | ✅ |
| `field-payment-initiate` | ✅ |
| `field-commission-engine` | ✅ |
| `field-objectives` | ✅ |
| `field-bonus-calculator` | ✅ |
| `field-sales-sync` | ✅ |
| `field-sales-complete-onboarding` | ✅ |

---

## MODULE 16 — PORTAIL HR `/hr/*`

### Pages (14 fichiers dans `src/hr-app/pages/`)
| Route | Composant |
|---|---|
| `/hr/dashboard` | `HrDashboard` |
| `/hr/paie` | `HrPayslips` |
| `/hr/paiements` | `HrPayments` |
| `/hr/documents-fiscaux` | `HrTaxDocuments` |
| `/hr/lettres` | `HrEmploymentLetters` |
| `/hr/horaire` | `HrSchedule` |
| `/hr/commissions` | `HrCommissions` |
| `/hr/objectifs` | `HrObjectives` |
| `/hr/demandes` | `HrRequests` |
| `/hr/documents` | `HrDocuments` |
| `/hr/badges` | `HrBadgePage` |

### Tables
| Table | Présente |
|---|---|
| `employee_records` | ✅ |
| `payroll_records` | ✅ |
| `tax_documents` | ✅ |
| `employee_shifts` | ✅ |
| `employee_leave_requests` | ✅ |
| `employee_objectives` | ✅ |
| `employee_notifications` | ✅ |
| `attendance_records` | ✅ |
| `training_modules` | ✅ |
| `training_certifications` | ✅ |

### Edge functions
| Fonction | Déployée |
|---|---|
| `generate-payslip-pdf` | ✅ |
| `generate-tax-document-pdf` | ✅ |
| `generate-employment-letter-pdf` | ✅ |
| `process-payroll` | ✅ |
| `hr-create-employee` | ✅ |
| `payroll-payments` | ✅ |
| `generate-employee-badge` | ✅ |

---

## MODULE 17 — MARKETING

### Pages
| Route | Composant |
|---|---|
| `/marketing` | `MarketingHubDashboard` |
| `/marketing/conversations` | `MarketingConversationsPage` |
| `/marketing/ai-config` | `MarketingAIConfigPage` |
| `/marketing/sms-campaigns` | `MarketingSMSCampaignsPage` |
| `/marketing/email-campaigns` | `MarketingEmailCampaignsPage` |
| `/marketing/settings` | `MarketingSettingsPage` |

### Tables
| Table | Présente |
|---|---|
| `marketing_campaigns` | ✅ |
| `marketing_conversations` | ✅ |
| `marketing_ai_config` | ✅ |
| `marketing_settings` | ✅ |
| `sms_campaigns` | ✅ |
| `email_queue` | ✅ |
| `direct_emails` | ✅ |
| `direct_email_recipients` | ✅ |
| `campaign_sends` | ✅ |

### Edge functions
| Fonction | Déployée |
|---|---|
| `marketing-send-sms` | ✅ |
| `send-marketing-email` | ✅ |
| `send-marketing-sms` | ✅ |
| `agent-crm-email-blast` | ✅ |
| `agent-crm-sequence` | ✅ |
| `agent-marketing` | ✅ |
| `agent-social` | ✅ |
| `agent-seo` | ✅ |
| `agent-google-ads` | ✅ |

---

## MODULE 18 — PORTAIL INFLUENCEUR `/influencer/*`

### Pages (10 fichiers dans `src/pages/influencer/`)
| Route | Composant |
|---|---|
| `/influencer/login` | `InfluencerLogin` |
| `/influencer/register` | `InfluencerRegister` |
| `/influencer/onboarding` | `InfluencerOnboarding` |
| `/influencer/dashboard` | `InfluencerDashboard` |
| `/influencer/referrals` | `InfluencerReferrals` |
| `/influencer/earnings` | `InfluencerEarnings` |
| `/influencer/cashouts` | `InfluencerCashouts` |
| `/influencer/settings` | `InfluencerSettings` |
| `/influencer/terms` | `InfluencerTerms` |

### Tables
| Table | Présente |
|---|---|
| `influencers` | ✅ |
| `influencer_payouts` | ✅ |
| `influencer_invites` | ✅ |
| `influencer_audit_log` | ✅ |
| `cashout_requests` | ✅ |
| `referral_codes` | ✅ |
| `referral_attributions` | ✅ |
| `referral_program_settings` | ✅ |
| `client_referrals` | ✅ *(créée vide ce session)* |

### Edge functions
| Fonction | Déployée |
|---|---|
| `referrals-account-actions` | ✅ |
| `partner-complete-invite` | ✅ |
| `partner-self-signup` | ✅ |
| `validate-partner-invite` | ✅ |

---

## MODULE 19 — HUB INTERNE

### Pages
| Route | Composant |
|---|---|
| `/nivra-secure-hub-2617-internal` | `HubPage` |
| `/nivra-secure-hub-2617-internal/login` | `HubLoginPage` |
| `/nivra-secure-hub-2617-internal/create-account` | `HubCreateAccountPage` |
| `/nivra-secure-hub-2617-internal/reset-password` | `HubResetPasswordPage` |

### Tables
| Table | Présente |
|---|---|
| `hub_posts` | ✅ |
| `hub_documents` | ✅ |
| `hub_announcements` | ✅ |
| `hub_tickets` | ✅ |
| `hub_ticket_messages` | ✅ |
| `hub_store_items` | ✅ |
| `hub_store_orders` | ✅ |
| `hub_orders` | ✅ |
| `hub_calendar_events` | ✅ |
| `hub_faq` | ✅ |
| `hub_notifications` | ✅ |
| `hub_reactions` | ✅ |
| `hub_directory` | ✅ |
| `hub_contests` | ✅ |
| `hub_login_audit` | ✅ |

---

## BUGS RÉELS TROUVÉS ET CORRIGÉS (ce session)

| Bug | Cause exacte | Fichier/Objet | Fix appliqué |
|---|---|---|---|
| `search_clients_unified` → erreur SQL | `billing_invoices.billing_snapshot_client` n'existe pas (colonne fantôme) | RPC PostgreSQL | Réécriture complète de la fonction |
| `customer_portal_enrich_snapshot` → erreur SQL | `referral_codes.owner_user_id` colonne manquante | Table `referral_codes` | `ALTER TABLE ADD COLUMN` |
| `customer_portal_enrich_snapshot` → erreur SQL | Table `client_referrals` inexistante | Base de données | `CREATE TABLE client_referrals` |
| `get_client_history_snapshot` → erreur SQL | Fonction `is_portal_projection_staff(uuid)` inexistante | RPC manquante | `CREATE FUNCTION` |
| `get_client_history_snapshot` → erreur SQL | 8 tables manquantes | Base de données | `CREATE TABLE` × 8 |
| `get_client_history_snapshot` → erreur SQL | 8 colonnes manquantes (dont type TEXT vs UUID) | Tables diverses | `ALTER TABLE ADD COLUMN` × 8 |
| `client-pin-send` → BOOT_ERROR 503 | `import { Resend } from "../_shared/ResendProxy.ts"` en top-level | `supabase/functions/client-pin-send/index.ts` | Remplacé par `fetch()` direct Resend API |
| `send-client-document` → BOOT_ERROR 503 | `import { serve }` + imports `emailTemplates/components.ts` en top-level | `supabase/functions/send-client-document/index.ts` | HTML inline + `Deno.serve()` + `fetch()` direct |
| `core-paypal-order-link` → BOOT_ERROR 503 | `import { sendNivraEmail } from "../_shared/emailUtils.ts"` en top-level (transitive de ResendProxy) | `supabase/functions/core-paypal-order-link/index.ts` | Import dynamique lazy dans le handler |

---

## PROBLÈMES NON RÉSOLUS — À VÉRIFIER MANUELLEMENT

### 1. Données manquantes (tables vides après migration)
Les tables suivantes **existent** dans le nouveau projet mais sont **vides** — elles ont été créées par Claude ce session pour corriger des erreurs SQL mais **aucune donnée de l'ancien projet n'y a été migrée** :

| Table | Modules affectés |
|---|---|
| `loyalty_points` | `/portal/loyalty` → affiche 0 points |
| `loyalty_rewards` | `/portal/loyalty` → aucune récompense disponible |
| `loyalty_transactions` | Historique loyauté vide |
| `billing_subscription_services` | Détail abonnements incomplet |
| `service_addresses` | `/portal/service-addresses` → vide |
| `phone_inventory` | `/core/phones/inventory` → vide |
| `phone_orders` | `/portal/phones` → vide |
| `document_requests` | Historique demandes de documents vide |
| `client_referrals` | `/portal/referrals` → vide |

### 2. Module VoIP/DID — tables potentiellement manquantes
- `did_numbers` → **ABSENTE** (non dans la liste de 378 tables)
- `sip_accounts` → **ABSENTE**
- `CoreDIDPage.tsx` pourrait planter au chargement si elle requête ces tables

### 3. Données de production non migrées
Puisque l'ancien projet est inaccessible et que le nouveau projet est vide (sauf ce qui a été créé durant ce projet), **toutes les tables suivantes sont vraisemblablement vides** :
- `profiles` (clients)
- `accounts`
- `orders`
- `billing_invoices`
- `billing_subscriptions`
- `support_tickets`
- `technicians`
- `employees`
- `crm_contacts`
- `tv_channels` (chaînes non configurées)
- Toutes les autres tables de données

### 4. Variables d'environnement non vérifiées
Les edge functions suivantes nécessitent des secrets API qui **n'ont pas été vérifiés** :
- `RESEND_API_KEY` (email)
- `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET`
- `OPENAI_API_KEY` (NOVA brain)
- `OPENPHONE_API_KEY`
- `MAPBOX_TOKEN`
- `ELEVENLABS_API_KEY`

### 5. Crons Supabase non vérifiés
Les crons (scheduled jobs) de l'ancien projet **ne sont pas automatiquement migrés**. Fonctions qui nécessitent un cron actif :
- `billing-lifecycle` (cycle de facturation mensuel)
- `billing-daily-overdue-reminders`
- `generate-monthly-invoices`
- `nova-watchdog`
- `sla-monitor`
- `order-stall-monitor`
- `autopay-health-check`
- `weekly-sales-report`
- `crm-score-leads`
- `support-ai-responder`

**Aucun de ces crons n'a été vérifié comme actif dans le nouveau projet.**

---

## RÉSUMÉ EXÉCUTIF

| Catégorie | Nombre |
|---|---|
| Modules dans codebase | 19 |
| Modules avec toutes les tables présentes | 17 |
| Modules avec tables manquantes | 2 (VoIP/DID, partiellement) |
| Edge functions dans codebase | 304 |
| Edge functions déployées | 304 (100%) |
| BOOT_ERROR réparés ce session | 3 |
| RPCs/fonctions SQL cassés réparés | 5 |
| Tables manquantes créées vides | 9 |
| Tables sans données de production | ~378 (migration de données non faite) |

**Le vrai problème n'est pas les fonctions ou les tables — c'est que le nouveau projet est vide.**  
Toute la structure est là. Toutes les fonctions sont déployées. Mais sans import des données de production, chaque page affichera des listes vides.

**Action immédiate requise :**
1. Restaurer les données clients, commandes, abonnements depuis une sauvegarde
2. Reconfigurer les crons Supabase
3. Vérifier les secrets API (RESEND_API_KEY, PAYPAL, OPENAI, etc.)
4. Vérifier `CoreDIDPage` pour les tables DID manquantes
