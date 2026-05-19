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
const CoreEmployee360 = lazy(() => import("@/core-app/pages/CoreEmployee360"));

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
  ],
};
