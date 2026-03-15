/**
 * coreRoutes — Route definition for the Nivra Core internal app.
 * Import this into the main router when ready to mount at /core.
 */
import { Navigate, type RouteObject } from "react-router-dom";
import { lazy } from "react";

const CoreAppLayout = lazy(() => import("@/core-app/CoreAppLayout"));

// Dashboard
const DashboardPage = lazy(() => import("@/core-app/pages/DashboardPage"));
const CoreActivityPage = lazy(() => import("@/core-app/pages/CoreActivityPage"));
const CoreLiveActivityPage = lazy(() => import("@/core-app/pages/CoreLiveActivityPage"));
const CoreSystemStatusPage = lazy(() => import("@/core-app/pages/CoreSystemStatusPage"));

// Operations
const WorkQueuePage = lazy(() => import("@/core-app/pages/WorkQueuePage"));
const OrdersPage = lazy(() => import("@/core-app/pages/OrdersPage"));
const CoreOrderDetail = lazy(() => import("@/core-app/pages/CoreOrderDetail"));
const CorePOSPage = lazy(() => import("@/core-app/pages/CorePOSPage"));
const CoreKYCPage = lazy(() => import("@/core-app/pages/CoreKYCPage"));
const AppointmentsPage = lazy(() => import("@/core-app/pages/AppointmentsPage"));
const CoreRequestsPage = lazy(() => import("@/core-app/pages/CoreRequestsPage"));
const CoreActivationsPage = lazy(() => import("@/core-app/pages/CoreActivationsPage"));
const CoreInstallationsPage = lazy(() => import("@/core-app/pages/CoreInstallationsPage"));

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
const CoreReferralTermsPage = lazy(() => import("@/core-app/pages/CoreReferralTermsPage"));

// Support
const CoreSupportPage = lazy(() => import("@/core-app/pages/CoreSupportPage"));
const CoreInternalTicketsPage = lazy(() => import("@/core-app/pages/CoreInternalTicketsPage"));
const CoreWebFormsPage = lazy(() => import("@/core-app/pages/CoreWebFormsPage"));
const CoreTelephonyPage = lazy(() => import("@/core-app/pages/CoreTelephonyPage"));

// HR
const CoreCareersPage = lazy(() => import("@/core-app/pages/CoreCareersPage"));
const CoreApplicationsPage = lazy(() => import("@/core-app/pages/CoreApplicationsPage"));

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

export const coreRoutes: RouteObject = {
  path: "/core",
  element: <CoreAppLayout />,
  children: [
    { index: true, element: <Navigate to="dashboard" replace /> },
    // Dashboard
    { path: "dashboard", element: <DashboardPage /> },
    { path: "activity", element: <CoreActivityPage /> },
    { path: "live-activity", element: <CoreLiveActivityPage /> },
    { path: "system-status", element: <CoreSystemStatusPage /> },
    // Operations
    { path: "work-queue", element: <WorkQueuePage /> },
    { path: "orders", element: <OrdersPage /> },
    { path: "orders/:orderId", element: <CoreOrderDetail /> },
    { path: "pos", element: <CorePOSPage /> },
    { path: "kyc", element: <CoreKYCPage /> },
    { path: "appointments", element: <AppointmentsPage /> },
    { path: "requests", element: <CoreRequestsPage /> },
    { path: "activations", element: <CoreActivationsPage /> },
    // Clients
    { path: "clients", element: <ClientsPage /> },
    { path: "clients/:clientId", element: <CoreClientProfile /> },
    { path: "accounts", element: <AccountsPage /> },
    { path: "accounts/:accountId", element: <CoreAccountDetail /> },
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
    { path: "referral-terms", element: <CoreReferralTermsPage /> },
    // Support
    { path: "support", element: <CoreSupportPage /> },
    { path: "internal-tickets", element: <CoreInternalTicketsPage /> },
    { path: "web-forms", element: <CoreWebFormsPage /> },
    { path: "telephony", element: <CoreTelephonyPage /> },
    // HR
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
    { path: "my-account", element: <CoreMyAccountPage /> },
    { path: "settings", element: <CoreSettingsPage /> },
    { path: "stock", element: <CoreStockPage /> },
    { path: "equipment", element: <EquipmentInventoryPage /> },
  ],
};
