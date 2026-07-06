/**
 * coreRoutes — Route definition for the Nivra Core internal app.
 * Import this into the main router when ready to mount at /core.
 */
import { Navigate, type RouteObject } from "react-router-dom";
import { lazy } from "react";

const CoreAppLayout = lazy(() => import("@/core-app/CoreAppLayout"));

// Dashboard
const DashboardPage = lazy(() => import("@/core-app/pages/DashboardPage"));
const CoreAIConsolePage = lazy(() => import("@/core-app/pages/CoreAIConsolePage"));
const CoreActivityPage = lazy(() => import("@/core-app/pages/CoreActivityPage"));
const CoreLiveActivityPage = lazy(() => import("@/core-app/pages/CoreLiveActivityPage"));
const CoreSystemStatusPage = lazy(() => import("@/core-app/pages/CoreSystemStatusPage"));
const CoreSystemHealthPage = lazy(() => import("@/core-app/pages/CoreSystemHealthPage"));

// Operations
const WorkQueuePage = lazy(() => import("@/core-app/pages/WorkQueuePage"));
const CoreAcademyPage = lazy(() => import("@/core-app/pages/CoreAcademyPage"));
const CoreSLAPage = lazy(() => import("@/core-app/pages/CoreSLAPage"));
const OrdersPage = lazy(() => import("@/core-app/pages/OrdersPage"));
const CoreOrderDetail = lazy(() => import("@/core-app/pages/CoreOrderDetail"));
const CorePOSPage = lazy(() => import("@/core-app/pages/CorePOSPage"));
const CoreKYCPage = lazy(() => import("@/core-app/pages/CoreKYCPage"));
const AppointmentsPage = lazy(() => import("@/core-app/pages/AppointmentsPage"));
const CoreAppointmentSlotsPage = lazy(() => import("@/core-app/pages/CoreAppointmentSlotsPage"));
const CoreAppointmentDetail = lazy(() => import("@/core-app/pages/CoreAppointmentDetail"));
const CoreRequestsPage = lazy(() => import("@/core-app/pages/CoreRequestsPage"));
const CoreWifiRequestsPage = lazy(() => import("@/core-app/pages/CoreActivationRequestsPage"));
const CoreInstallationsPage = lazy(() => import("@/core-app/pages/CoreInstallationsPage"));
const CoreTechnicianMobilePage = lazy(() => import("@/core-app/pages/CoreTechnicianMobilePage"));
const CoreCancellationsPage = lazy(() => import("@/core-app/pages/CoreCancellationsPage"));
const CorePlanChangesPage = lazy(() => import("@/core-app/pages/CorePlanChangesPage"));
const CorePauseRequestsPage = lazy(() => import("@/core-app/pages/CorePauseRequestsPage"));
const CoreReturnsPage = lazy(() => import("@/core-app/pages/CoreReturnsPage"));
const CoreTechnicianMapPage = lazy(() => import("@/core-app/pages/CoreTechnicianMapPage"));

// Clients
const ClientsPage = lazy(() => import("@/core-app/pages/ClientsPage"));
const CoreClientProfile = lazy(() => import("@/core-app/pages/CoreClientProfile"));
const AccountsPage = lazy(() => import("@/core-app/pages/AccountsPage"));
const CoreAccountDetail = lazy(() => import("@/core-app/pages/CoreAccountDetail"));
const CoreDocumentsPage = lazy(() => import("@/core-app/pages/CoreDocumentsPage"));

// Billing
const CoreBillingPage = lazy(() => import("@/core-app/pages/CoreBillingPage"));
const InvoicesPage = lazy(() => import("@/core-app/pages/InvoicesPage"));
const CoreInvoiceDetail = lazy(() => import("@/core-app/pages/CoreInvoiceDetail"));
const PaymentsPage = lazy(() => import("@/core-app/pages/PaymentsPage"));
const CoreTransactionsPage = lazy(() => import("@/core-app/pages/CoreTransactionsPage"));
const SubscriptionsPage = lazy(() => import("@/core-app/pages/SubscriptionsPage"));
const SubscriptionDetailPage = lazy(() => import("@/core-app/pages/SubscriptionDetailPage"));
const CorePDFTemplatesPage = lazy(() => import("@/core-app/pages/CorePDFTemplatesPage"));
const CoreRecouvrementPage = lazy(() => import("@/core-app/pages/CoreRecouvrementPage"));
const CoreContestedPaymentsPage = lazy(() => import("@/core-app/pages/CoreContestedPaymentsPage"));
const CoreContestedInvoicesPage = lazy(() => import("@/core-app/pages/CoreContestedInvoicesPage"));

// Catalogue
const CoreServicesPage = lazy(() => import("@/core-app/pages/CoreServicesPage"));
const CoreCatalogPage = lazy(() => import("@/core-app/pages/CoreCatalogPage"));
const CoreTVSurMesurePage = lazy(() => import("@/core-app/pages/CoreTVSurMesurePage"));
const CoreChannelsPage = lazy(() => import("@/core-app/pages/CoreChannelsPage"));
const CoreStreamingPage = lazy(() => import("@/core-app/pages/CoreStreamingPage"));
const CoreContractsPage = lazy(() => import("@/core-app/pages/CoreContractsPage"));

// Marketing
const CorePromotionsPage = lazy(() => import("@/core-app/pages/CorePromotionsPage"));
const CoreContestsPage = lazy(() => import("@/core-app/pages/CoreContestsPage"));
const CoreEmailMarketingPage = lazy(() => import("@/core-app/pages/CoreEmailMarketingPage"));
const CoreCommunicationEmailPage = lazy(() => import("@/core-app/pages/CoreCommunicationEmailPage"));
const CoreCommunicationSMSPage = lazy(() => import("@/core-app/pages/CoreCommunicationSMSPage"));

// Partners
const CoreReferralsPage = lazy(() => import("@/core-app/pages/CoreReferralsPage"));
const CoreReferralRewardsPage = lazy(() => import("@/core-app/pages/CoreReferralRewardsPage"));
const CoreReferralTermsPage = lazy(() => import("@/core-app/pages/CoreReferralTermsPage"));

// Support
const CoreSupportPage = lazy(() => import("@/core-app/pages/CoreSupportPage"));
const CoreInternalTicketsPage = lazy(() => import("@/core-app/pages/CoreInternalTicketsPage"));
const CoreWebFormsPage = lazy(() => import("@/core-app/pages/CoreWebFormsPage"));
const CoreTelephonyPage = lazy(() => import("@/core-app/pages/CoreTelephonyPage"));

// HR & Payroll
const HrDashboardPage = lazy(() => import("@/core-app/pages/hr/HrDashboardPage"));
const HrEmployeesPage = lazy(() => import("@/core-app/pages/hr/HrEmployeesPage"));
const HrOnboardingPage = lazy(() => import("@/core-app/pages/hr/HrOnboardingPage"));
const HrPayrollPage = lazy(() => import("@/core-app/pages/hr/HrPayrollPage"));
const HrCommissionsPage = lazy(() => import("@/core-app/pages/hr/HrCommissionsPage"));
const HrTimePage = lazy(() => import("@/core-app/pages/hr/HrTimePage"));
const HrSchedulesPage = lazy(() => import("@/core-app/pages/hr/HrSchedulesPage"));
const HrDocumentsPage = lazy(() => import("@/core-app/pages/hr/HrDocumentsPage"));
const HrTaxDocumentsPage = lazy(() => import("@/core-app/pages/hr/HrTaxDocumentsPage"));
const HrRequestsPage = lazy(() => import("@/core-app/pages/hr/HrRequestsPage"));
const HrAuditPage = lazy(() => import("@/core-app/pages/hr/HrAuditPage"));
const HrCreateEmployeePage = lazy(() => import("@/core-app/pages/hr/HrCreateEmployeePage"));
const CoreCareersPage = lazy(() => import("@/core-app/pages/CoreCareersPage"));
const CoreApplicationsPage = lazy(() => import("@/core-app/pages/CoreApplicationsPage"));
const CoreInterviewsPage = lazy(() => import("@/core-app/pages/CoreInterviewsPage"));
const CoreCareerEmailTemplatesPage = lazy(() => import("@/core-app/pages/hr/CoreCareerEmailTemplatesPage"));
const CoreEmployee360 = lazy(() => import("@/core-app/pages/CoreEmployee360"));
const CoreCommissionWithdrawalsPage = lazy(() => import("@/core-app/pages/CoreCommissionWithdrawalsPage"));
const CoreCommissionGridPage = lazy(() => import("@/core-app/pages/CoreCommissionGridPage"));

// CRM Call Center (admin oversight: assign, monitor, KPIs)
const CoreCrm = lazy(() => import("@/core-app/pages/CoreCrm"));

// System
const CoreNotificationsPage = lazy(() => import("@/core-app/pages/CoreNotificationsPage"));
const CoreMaintenancePage = lazy(() => import("@/core-app/pages/CoreMaintenancePage"));
const CoreEmailActivityPage = lazy(() => import("@/core-app/pages/CoreEmailActivityPage"));
const CoreSiteSettingsPage = lazy(() => import("@/core-app/pages/CoreSiteSettingsPage"));
const CoreUsersAccessPage = lazy(() => import("@/core-app/pages/CoreUsersAccessPage"));
const CoreAuditLogPage = lazy(() => import("@/core-app/pages/CoreAuditLogPage"));
const CoreSecurityEventsPage = lazy(() => import("@/core-app/pages/CoreSecurityEventsPage"));
const CoreSecurityGuardianPage = lazy(() => import("@/core-app/pages/CoreSecurityGuardianPage"));
const CoreSystemAuditPage = lazy(() => import("@/core-app/pages/CoreSystemAuditPage"));
const CoreStaffPage = lazy(() => import("@/core-app/pages/CoreStaffPage"));
const CoreMyAccountPage = lazy(() => import("@/core-app/pages/CoreMyAccountPage"));
const CoreSettingsPage = lazy(() => import("@/core-app/pages/CoreSettingsPage"));
const CoreStockPage = lazy(() => import("@/core-app/pages/CoreStockPage"));
const EquipmentInventoryPage = lazy(() => import("@/core-app/pages/EquipmentInventoryPage"));
const CorePhoneOrdersPage = lazy(() => import("@/core-app/pages/CorePhoneOrdersPage"));
const CorePhoneInventoryPage = lazy(() => import("@/core-app/pages/CorePhoneInventoryPage"));
const CoreAutomationPage = lazy(() => import("@/core-app/pages/CoreAutomationPage"));
const CoreAnalyticsPage = lazy(() => import("@/core-app/pages/CoreAnalyticsPage"));
const CoreFinancePage = lazy(() => import("@/core-app/pages/CoreFinancePage"));
const CoreSOPsPage = lazy(() => import("@/core-app/pages/CoreSOPsPage"));
const CoreSupportMetricsPage = lazy(() => import("@/core-app/pages/CoreSupportMetricsPage"));

// Supplier Accounts (admin only)
const SupplierAccountsPage = lazy(() => import("@/core-app/pages/SupplierAccountsPage"));
const SupplierAccountNewPage = lazy(() => import("@/core-app/pages/SupplierAccountNewPage"));
const SupplierAccountDetailPage = lazy(() => import("@/core-app/pages/SupplierAccountDetailPage"));

// NOVA Brain
const NovaBrainPage = lazy(() => import("@/core-app/pages/NovaBrainPage"));

// Network & Provisioning
const CoreNetworkPage = lazy(() => import("@/core-app/pages/CoreNetworkPage"));
const CoreNocPage = lazy(() => import("@/core-app/pages/CoreNocPage"));
const CoreProvisioningPage = lazy(() => import("@/core-app/pages/CoreProvisioningPage"));
const CoreProvisioningJobsPage = lazy(() => import("@/core-app/pages/CoreProvisioningJobsPage"));
const CoreDIDPage = lazy(() => import("@/core-app/pages/CoreDIDPage"));
const CoreCoveragePage = lazy(() => import("@/core-app/pages/CoreCoveragePage"));

// Sales & CRM extras
const CoreRmaPage = lazy(() => import("@/core-app/pages/CoreRmaPage"));
const CoreReviewsPage = lazy(() => import("@/core-app/pages/CoreReviewsPage"));
const CoreQuotesPage = lazy(() => import("@/core-app/pages/CoreQuotesPage"));
const CoreQuoteDetail = lazy(() => import("@/core-app/pages/CoreQuoteDetail"));
const CoreAgentDiscounts = lazy(() => import("@/core-app/pages/CoreAgentDiscounts"));
const CoreFieldAgentsPage = lazy(() => import("@/core-app/pages/CoreFieldAgentsPage"));
const CoreFieldSubmissionsPage = lazy(() => import("@/core-app/pages/CoreFieldSubmissionsPage"));
const CoreGrilleCanaux = lazy(() => import("@/core-app/pages/CoreGrilleCanaux"));
const CoreRevenueAssurancePage = lazy(() => import("@/core-app/pages/CoreRevenueAssurancePage"));
const CoreActivationQueuePage = lazy(() => import("@/core-app/pages/CoreActivationQueuePage"));

// Support extras
const CoreComplaintsPage = lazy(() => import("@/core-app/pages/CoreComplaintsPage"));
const CoreSupportAIPage = lazy(() => import("@/core-app/pages/CoreSupportAIPage"));

// System / Admin extras
const CoreRetentionPage = lazy(() => import("@/core-app/pages/CoreRetentionPage"));
const CoreAgentMonitorPage = lazy(() => import("@/core-app/pages/CoreAgentMonitorPage"));
const CoreAgentControlCenter = lazy(() => import("@/core-app/pages/CoreAgentControlCenter"));
const CoreAnalyticsDashboardPage = lazy(() => import("@/core-app/pages/CoreAnalyticsDashboardPage"));
const CoreSyncMonitorPage = lazy(() => import("@/core-app/pages/CoreSyncMonitorPage"));
const CoreSEOPage = lazy(() => import("@/core-app/pages/CoreSEOPage"));
const CoreMarketingAgentPage = lazy(() => import("@/core-app/pages/CoreMarketingAgentPage"));
const CoreSocialMediaPage = lazy(() => import("@/core-app/pages/CoreSocialMediaPage"));
const CoreEmailComposePage = lazy(() => import("@/core-app/pages/CoreEmailComposePage"));
const CoreHubManagementPage = lazy(() => import("@/core-app/pages/CoreHubManagementPage"));

// Marketing Hub
const MarketingHubDashboard = lazy(() => import("@/core-app/pages/marketing/MarketingHubDashboard"));
const MarketingConversationsPage = lazy(() => import("@/core-app/pages/marketing/MarketingConversationsPage"));
const MarketingAIConfigPage = lazy(() => import("@/core-app/pages/marketing/MarketingAIConfigPage"));
const MarketingSMSCampaignsPage = lazy(() => import("@/core-app/pages/marketing/MarketingSMSCampaignsPage"));
const MarketingEmailCampaignsPage = lazy(() => import("@/core-app/pages/marketing/MarketingEmailCampaignsPage"));
const MarketingSettingsPage = lazy(() => import("@/core-app/pages/marketing/MarketingSettingsPage"));
const MarketingAudiencesPage = lazy(() => import("@/core-app/pages/marketing/MarketingAudiencesPage"));
const MarketingTemplatesPage = lazy(() => import("@/core-app/pages/marketing/MarketingTemplatesPage"));
const MarketingCampaignsPage = lazy(() => import("@/core-app/pages/marketing/MarketingCampaignsPage"));
const MarketingContactsPage = lazy(() => import("@/core-app/pages/marketing/MarketingContactsPage"));
const MarketingAnalyticsPage = lazy(() => import("@/core-app/pages/marketing/MarketingAnalyticsPage"));
const MarketingAutomationsPage = lazy(() => import("@/core-app/pages/marketing/MarketingAutomationsPage"));
const MarketingPlanningPage = lazy(() => import("@/core-app/pages/marketing/MarketingPlanningPage"));
const MarketingLiveChatPage = lazy(() => import("@/core-app/pages/marketing/MarketingLiveChatPage"));
const MarketingPushCampaignsPage = lazy(() => import("@/core-app/pages/marketing/MarketingPushCampaignsPage"));

export const coreRoutes: RouteObject = {
  path: "/core",
  element: <CoreAppLayout />,
  children: [
    { index: true, element: <Navigate to="dashboard" replace /> },
    // Dashboard
    { path: "dashboard", element: <DashboardPage /> },
    { path: "ai-console", element: <CoreAIConsolePage /> },
    { path: "activity", element: <CoreActivityPage /> },
    { path: "live-activity", element: <CoreLiveActivityPage /> },
    { path: "system-status", element: <CoreSystemStatusPage /> },
    { path: "system-health", element: <CoreSystemHealthPage /> },
    { path: "analytics", element: <CoreAnalyticsPage /> },
    { path: "finance", element: <CoreFinancePage /> },
    { path: "sops", element: <CoreSOPsPage /> },
    { path: "support-metrics", element: <CoreSupportMetricsPage /> },
    // Operations
    { path: "work-queue", element: <WorkQueuePage /> },
    { path: "academy", element: <CoreAcademyPage /> },
    { path: "sla", element: <CoreSLAPage /> },
    { path: "orders", element: <OrdersPage /> },
    { path: "orders/:orderId", element: <CoreOrderDetail /> },
    { path: "pos", element: <CorePOSPage /> },
    { path: "kyc", element: <CoreKYCPage /> },
    { path: "appointments", element: <AppointmentsPage /> },
    { path: "appointments/slots", element: <CoreAppointmentSlotsPage /> },
    { path: "appointments/:id", element: <CoreAppointmentDetail /> },
    { path: "requests", element: <CoreRequestsPage /> },
    { path: "wifi-requests", element: <CoreWifiRequestsPage /> },
    { path: "activations", element: <Navigate to="/core/wifi-requests" replace /> },
    { path: "installations", element: <CoreInstallationsPage /> },
    { path: "technician", element: <CoreTechnicianMobilePage /> },
    { path: "technicians/map", element: <CoreTechnicianMapPage /> },
    { path: "cancellations", element: <CoreCancellationsPage /> },
    { path: "plan-changes", element: <CorePlanChangesPage /> },
    { path: "pause-requests", element: <CorePauseRequestsPage /> },
    { path: "returns", element: <CoreReturnsPage /> },
    // Clients
    { path: "clients", element: <ClientsPage /> },
    { path: "clients/:clientId", element: <CoreClientProfile /> },
    { path: "accounts", element: <AccountsPage /> },
    { path: "accounts/:accountId", element: <CoreAccountDetail /> },
    { path: "crm", element: <CoreCrm /> },
    { path: "documents", element: <CoreDocumentsPage /> },
    // Billing
    { path: "billing", element: <CoreBillingPage /> },
    { path: "invoices", element: <InvoicesPage /> },
    { path: "invoices/:invoiceId", element: <CoreInvoiceDetail /> },
    { path: "payments", element: <PaymentsPage /> },
    { path: "transactions", element: <CoreTransactionsPage /> },
    { path: "subscriptions", element: <SubscriptionsPage /> },
    { path: "subscriptions/:id", element: <SubscriptionDetailPage /> },
    { path: "pdf-templates", element: <CorePDFTemplatesPage /> },
    { path: "recouvrement", element: <CoreRecouvrementPage /> },
    { path: "contested-payments", element: <CoreContestedPaymentsPage /> },
    { path: "contested-invoices", element: <CoreContestedInvoicesPage /> },
    // Catalogue
    { path: "services", element: <CoreServicesPage /> },
    { path: "catalog", element: <CoreCatalogPage /> },
    { path: "tv-sur-mesure", element: <CoreTVSurMesurePage /> },
    { path: "channels", element: <CoreChannelsPage /> },
    { path: "streaming", element: <CoreStreamingPage /> },
    { path: "contracts", element: <CoreContractsPage /> },
    // Marketing
    { path: "promotions", element: <CorePromotionsPage /> },
    { path: "contests", element: <CoreContestsPage /> },
    { path: "email-marketing", element: <CoreEmailMarketingPage /> },
    { path: "communication-email", element: <CoreCommunicationEmailPage /> },
    { path: "communication-sms", element: <CoreCommunicationSMSPage /> },
    // Partners
    { path: "referrals", element: <CoreReferralsPage /> },
    { path: "referral-rewards", element: <CoreReferralRewardsPage /> },
    { path: "referral-terms", element: <CoreReferralTermsPage /> },
    // Support
    { path: "support", element: <CoreSupportPage /> },
    { path: "internal-tickets", element: <CoreInternalTicketsPage /> },
    { path: "web-forms", element: <CoreWebFormsPage /> },
    { path: "telephony", element: <CoreTelephonyPage /> },
    // HR & Payroll
    { path: "hr", element: <HrDashboardPage /> },
    { path: "hr/employees", element: <HrEmployeesPage /> },
    { path: "hr/employees/new", element: <HrCreateEmployeePage /> },
    { path: "hr/employees/:id", element: <CoreEmployee360 /> },
    { path: "hr/onboarding", element: <HrOnboardingPage /> },
    { path: "hr/payroll", element: <HrPayrollPage /> },
    { path: "hr/commissions", element: <HrCommissionsPage /> },
    { path: "hr/time", element: <HrTimePage /> },
    { path: "hr/schedules", element: <HrSchedulesPage /> },
    { path: "hr/documents", element: <HrDocumentsPage /> },
    { path: "hr/tax-documents", element: <HrTaxDocumentsPage /> },
    { path: "hr/requests", element: <HrRequestsPage /> },
    { path: "hr/careers", element: <CoreCareersPage /> },
    { path: "hr/applications", element: <CoreApplicationsPage /> },
    { path: "hr/interviews", element: <CoreInterviewsPage /> },
    { path: "hr/email-templates", element: <CoreCareerEmailTemplatesPage /> },
    { path: "hr/commission-withdrawals", element: <CoreCommissionWithdrawalsPage /> },
    { path: "hr/audit", element: <HrAuditPage /> },
    // Legacy redirects
    { path: "careers", element: <CoreCareersPage /> },
    { path: "applications", element: <CoreApplicationsPage /> },
    // System
    { path: "notifications", element: <CoreNotificationsPage /> },
    { path: "maintenance", element: <CoreMaintenancePage /> },
    { path: "email-activity", element: <CoreEmailActivityPage /> },
    { path: "site-settings", element: <CoreSiteSettingsPage /> },
    { path: "users-access", element: <CoreUsersAccessPage /> },
    { path: "audit-log", element: <CoreAuditLogPage /> },
    { path: "security-events", element: <CoreSecurityEventsPage /> },
    { path: "security-guardian", element: <CoreSecurityGuardianPage /> },
    { path: "system-audit", element: <CoreSystemAuditPage /> },
    { path: "staff", element: <CoreStaffPage /> },
    { path: "staff/:userId", element: <CoreEmployee360 /> },
    { path: "my-account", element: <CoreMyAccountPage /> },
    { path: "settings", element: <CoreSettingsPage /> },
    { path: "stock", element: <CoreStockPage /> },
    { path: "equipment", element: <EquipmentInventoryPage /> },
    { path: "phones", element: <CorePhoneOrdersPage /> },
    { path: "phones/inventory", element: <CorePhoneInventoryPage /> },
    { path: "automation", element: <CoreAutomationPage /> },
    // Supplier Accounts (admin only)
    { path: "supplier-accounts", element: <SupplierAccountsPage /> },
    { path: "supplier-accounts/new", element: <SupplierAccountNewPage /> },
    { path: "supplier-accounts/:id", element: <SupplierAccountDetailPage /> },

    // NOVA Brain
    { path: "brain", element: <NovaBrainPage /> },

    // Network & Provisioning
    { path: "network", element: <CoreNetworkPage /> },
    { path: "noc", element: <CoreNocPage /> },
    { path: "provisioning", element: <CoreProvisioningPage /> },
    { path: "provisioning-jobs", element: <CoreProvisioningJobsPage /> },
    { path: "did", element: <CoreDIDPage /> },
    { path: "coverage", element: <CoreCoveragePage /> },

    // Sales & CRM extras
    { path: "rma", element: <CoreRmaPage /> },
    { path: "reviews", element: <CoreReviewsPage /> },
    { path: "quotes", element: <CoreQuotesPage /> },
    { path: "quotes/:id", element: <CoreQuoteDetail /> },
    { path: "agent-discounts", element: <CoreAgentDiscounts /> },
    { path: "field-agents", element: <CoreFieldAgentsPage /> },
    { path: "field-submissions", element: <CoreFieldSubmissionsPage /> },
    { path: "grille-canaux", element: <CoreGrilleCanaux /> },
    { path: "revenue-assurance", element: <CoreRevenueAssurancePage /> },
    { path: "activation-queue", element: <CoreActivationQueuePage /> },
    { path: "commissions/grille", element: <CoreCommissionGridPage /> },

    // Support extras
    { path: "complaints", element: <CoreComplaintsPage /> },
    { path: "support-ai", element: <CoreSupportAIPage /> },

    // System / Admin extras
    { path: "retention", element: <CoreRetentionPage /> },
    { path: "monitor", element: <CoreAgentMonitorPage /> },
    { path: "agent-center", element: <CoreAgentControlCenter /> },
    { path: "analytics-ai", element: <CoreAnalyticsDashboardPage /> },
    { path: "sync-monitor", element: <CoreSyncMonitorPage /> },
    { path: "seo", element: <CoreSEOPage /> },
    { path: "marketing-agent", element: <CoreMarketingAgentPage /> },
    { path: "social-media", element: <CoreSocialMediaPage /> },
    { path: "email/compose", element: <CoreEmailComposePage /> },
    { path: "nivra-secure-hub-2617-internal", element: <CoreHubManagementPage /> },

    // Marketing Hub
    { path: "marketing", element: <Navigate to="/marketing" replace /> },
    { path: "marketing/conversations", element: <Navigate to="/marketing/conversations" replace /> },
    { path: "marketing/ai-config", element: <Navigate to="/marketing/ai-config" replace /> },
    { path: "marketing/sms-campaigns", element: <Navigate to="/marketing/sms-campaigns" replace /> },
    { path: "marketing/email-campaigns", element: <Navigate to="/marketing/campaigns" replace /> },
    { path: "marketing/audiences", element: <Navigate to="/marketing/audiences" replace /> },
    { path: "marketing/templates", element: <Navigate to="/marketing/templates" replace /> },
    { path: "marketing/campaigns", element: <Navigate to="/marketing/campaigns" replace /> },
    { path: "marketing/contacts", element: <Navigate to="/marketing/contacts" replace /> },
    { path: "marketing/analytics", element: <Navigate to="/marketing/analytics" replace /> },
    { path: "marketing/automations", element: <Navigate to="/marketing/automations" replace /> },
    { path: "marketing/planning", element: <Navigate to="/marketing/planning" replace /> },
    { path: "marketing/push-campaigns", element: <Navigate to="/marketing/push-campaigns" replace /> },
    { path: "marketing/live-chat", element: <Navigate to="/marketing/live-chat" replace /> },
    { path: "marketing/settings", element: <Navigate to="/marketing/settings" replace /> },
  ],
};
