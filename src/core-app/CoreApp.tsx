/**
 * CoreApp — Root component for standalone Core deployment.
 * Own QueryClient, BrowserRouter, Toaster — fully independent of the main site App.tsx.
 */
import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { CORE_BASE } from "@/core-app/lib/corePaths";

// Core pages (lazy-loaded)
const CoreAppLayout = lazy(() => import("./CoreAppLayout"));
const CoreProtectedRoute = lazy(() => import("./components/CoreProtectedRoute"));
const CoreLoginPage = lazy(() => import("./pages/CoreLoginPage"));

// Dashboard
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const CoreActivityPage = lazy(() => import("./pages/CoreActivityPage"));
const CoreLiveActivityPage = lazy(() => import("./pages/CoreLiveActivityPage"));
const CoreSystemStatusPage = lazy(() => import("./pages/CoreSystemStatusPage"));

// Operations
const WorkQueuePage = lazy(() => import("./pages/WorkQueuePage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const CoreOrderDetail = lazy(() => import("./pages/CoreOrderDetail"));
const CorePOSPage = lazy(() => import("./pages/CorePOSPage"));
const CoreKYCPage = lazy(() => import("./pages/CoreKYCPage"));
const AppointmentsPage = lazy(() => import("./pages/AppointmentsPage"));
const CoreRequestsPage = lazy(() => import("./pages/CoreRequestsPage"));
const CoreActivationsPage = lazy(() => import("./pages/CoreActivationsPage"));

// Clients
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const CoreClientProfile = lazy(() => import("./pages/CoreClientProfile"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));
const CoreAccountDetail = lazy(() => import("./pages/CoreAccountDetail"));
const CoreDocumentsPage = lazy(() => import("./pages/CoreDocumentsPage"));

// Billing
const CoreBillingPage = lazy(() => import("./pages/CoreBillingPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const CoreInvoiceDetail = lazy(() => import("./pages/CoreInvoiceDetail"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const CoreTransactionsPage = lazy(() => import("./pages/CoreTransactionsPage"));
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage"));
const SubscriptionDetailPage = lazy(() => import("./pages/SubscriptionDetailPage"));
const CorePDFTemplatesPage = lazy(() => import("./pages/CorePDFTemplatesPage"));
const CoreRecouvrementPage = lazy(() => import("./pages/CoreRecouvrementPage"));
const CoreContestedPaymentsPage = lazy(() => import("./pages/CoreContestedPaymentsPage"));
const CoreContestedInvoicesPage = lazy(() => import("./pages/CoreContestedInvoicesPage"));

// Catalogue
const CoreServicesPage = lazy(() => import("./pages/CoreServicesPage"));
const CoreCatalogPage = lazy(() => import("./pages/CoreCatalogPage"));
const CoreTVSurMesurePage = lazy(() => import("./pages/CoreTVSurMesurePage"));
const CoreChannelsPage = lazy(() => import("./pages/CoreChannelsPage"));
const CoreStreamingPage = lazy(() => import("./pages/CoreStreamingPage"));
const CoreContractsPage = lazy(() => import("./pages/CoreContractsPage"));

// Marketing
const CorePromotionsPage = lazy(() => import("./pages/CorePromotionsPage"));
const CoreContestsPage = lazy(() => import("./pages/CoreContestsPage"));
const CoreEmailMarketingPage = lazy(() => import("./pages/CoreEmailMarketingPage"));
const CoreCommunicationEmailPage = lazy(() => import("./pages/CoreCommunicationEmailPage"));
const CoreCommunicationSMSPage = lazy(() => import("./pages/CoreCommunicationSMSPage"));

// Partners
const CoreReferralsPage = lazy(() => import("./pages/CoreReferralsPage"));
const CoreReferralTermsPage = lazy(() => import("./pages/CoreReferralTermsPage"));

// Support
const CoreSupportPage = lazy(() => import("./pages/CoreSupportPage"));
const CoreInternalTicketsPage = lazy(() => import("./pages/CoreInternalTicketsPage"));
const CoreWebFormsPage = lazy(() => import("./pages/CoreWebFormsPage"));
const CoreTelephonyPage = lazy(() => import("./pages/CoreTelephonyPage"));

// HR & Payroll
const HrDashboardPage = lazy(() => import("./pages/hr/HrDashboardPage"));
const HrEmployeesPage = lazy(() => import("./pages/hr/HrEmployeesPage"));
const HrOnboardingPage = lazy(() => import("./pages/hr/HrOnboardingPage"));
const HrPayrollPage = lazy(() => import("./pages/hr/HrPayrollPage"));
const HrCommissionsPage = lazy(() => import("./pages/hr/HrCommissionsPage"));
const HrTimePage = lazy(() => import("./pages/hr/HrTimePage"));
const HrPlaceholderPage = lazy(() => import("./pages/hr/HrPlaceholderPage"));
const CoreCareersPage = lazy(() => import("./pages/CoreCareersPage"));
const CoreApplicationsPage = lazy(() => import("./pages/CoreApplicationsPage"));
const CoreEmployee360 = lazy(() => import("./pages/CoreEmployee360"));

// System
const CoreNotificationsPage = lazy(() => import("./pages/CoreNotificationsPage"));
const CoreMaintenancePage = lazy(() => import("./pages/CoreMaintenancePage"));
const CoreEmailActivityPage = lazy(() => import("./pages/CoreEmailActivityPage"));
const CoreSiteSettingsPage = lazy(() => import("./pages/CoreSiteSettingsPage"));
const CoreUsersAccessPage = lazy(() => import("./pages/CoreUsersAccessPage"));
const CoreAuditLogPage = lazy(() => import("./pages/CoreAuditLogPage"));
const CoreSecurityEventsPage = lazy(() => import("./pages/CoreSecurityEventsPage"));
const CoreSecurityGuardianPage = lazy(() => import("./pages/CoreSecurityGuardianPage"));
const CoreSystemAuditPage = lazy(() => import("./pages/CoreSystemAuditPage"));
const CoreStaffPage = lazy(() => import("./pages/CoreStaffPage"));
const CoreMyAccountPage = lazy(() => import("./pages/CoreMyAccountPage"));
const CoreSettingsPage = lazy(() => import("./pages/CoreSettingsPage"));
const CoreStockPage = lazy(() => import("./pages/CoreStockPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
    },
    mutations: { retry: 1 },
  },
});

const CoreLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,8%)]">
    <div className="flex flex-col items-center gap-3">
      <p className="text-xl font-semibold text-white tracking-tight">Nivra Telecom</p>
      <p className="text-sm text-[hsl(220,10%,50%)]">Chargement…</p>
    </div>
  </div>
);

const S = ({ children }: { children: React.ReactNode }) => <Suspense fallback={null}>{children}</Suspense>;

const CoreApp = () => {
  const routerBase = CORE_BASE || "/";

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <BrowserRouter basename={routerBase}>
        <Suspense fallback={<CoreLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<CoreLoginPage />} />
            <Route path="/" element={<CoreProtectedRoute />}>
              <Route element={<CoreAppLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                {/* Dashboard */}
                <Route path="dashboard" element={<S><DashboardPage /></S>} />
                <Route path="activity" element={<S><CoreActivityPage /></S>} />
                <Route path="live-activity" element={<S><CoreLiveActivityPage /></S>} />
                <Route path="system-status" element={<S><CoreSystemStatusPage /></S>} />
                {/* Operations */}
                <Route path="work-queue" element={<S><WorkQueuePage /></S>} />
                <Route path="orders" element={<S><OrdersPage /></S>} />
                <Route path="orders/:orderId" element={<S><CoreOrderDetail /></S>} />
                <Route path="pos" element={<S><CorePOSPage /></S>} />
                <Route path="kyc" element={<S><CoreKYCPage /></S>} />
                <Route path="appointments" element={<S><AppointmentsPage /></S>} />
                <Route path="requests" element={<S><CoreRequestsPage /></S>} />
                <Route path="activations" element={<S><CoreActivationsPage /></S>} />
                {/* Clients */}
                <Route path="clients" element={<S><ClientsPage /></S>} />
                <Route path="clients/:clientId" element={<S><CoreClientProfile /></S>} />
                <Route path="accounts" element={<S><AccountsPage /></S>} />
                <Route path="accounts/:accountId" element={<S><CoreAccountDetail /></S>} />
                <Route path="documents" element={<S><CoreDocumentsPage /></S>} />
                {/* Billing */}
                <Route path="billing" element={<S><CoreBillingPage /></S>} />
                <Route path="invoices" element={<S><InvoicesPage /></S>} />
                <Route path="invoices/:invoiceId" element={<S><CoreInvoiceDetail /></S>} />
                <Route path="payments" element={<S><PaymentsPage /></S>} />
                <Route path="transactions" element={<S><CoreTransactionsPage /></S>} />
                <Route path="subscriptions" element={<S><SubscriptionsPage /></S>} />
                <Route path="subscriptions/:id" element={<S><SubscriptionDetailPage /></S>} />
                <Route path="pdf-templates" element={<S><CorePDFTemplatesPage /></S>} />
                <Route path="recouvrement" element={<S><CoreRecouvrementPage /></S>} />
                <Route path="contested-payments" element={<S><CoreContestedPaymentsPage /></S>} />
                <Route path="contested-invoices" element={<S><CoreContestedInvoicesPage /></S>} />
                {/* Catalogue */}
                <Route path="services" element={<S><CoreServicesPage /></S>} />
                <Route path="catalog" element={<S><CoreCatalogPage /></S>} />
                <Route path="tv-sur-mesure" element={<S><CoreTVSurMesurePage /></S>} />
                <Route path="channels" element={<S><CoreChannelsPage /></S>} />
                <Route path="streaming" element={<S><CoreStreamingPage /></S>} />
                <Route path="contracts" element={<S><CoreContractsPage /></S>} />
                {/* Marketing */}
                <Route path="promotions" element={<S><CorePromotionsPage /></S>} />
                <Route path="contests" element={<S><CoreContestsPage /></S>} />
                <Route path="email-marketing" element={<S><CoreEmailMarketingPage /></S>} />
                <Route path="communication-email" element={<S><CoreCommunicationEmailPage /></S>} />
                <Route path="communication-sms" element={<S><CoreCommunicationSMSPage /></S>} />
                {/* Partners */}
                <Route path="referrals" element={<S><CoreReferralsPage /></S>} />
                <Route path="referral-terms" element={<S><CoreReferralTermsPage /></S>} />
                {/* Support */}
                <Route path="support" element={<S><CoreSupportPage /></S>} />
                <Route path="internal-tickets" element={<S><CoreInternalTicketsPage /></S>} />
                <Route path="web-forms" element={<S><CoreWebFormsPage /></S>} />
                <Route path="telephony" element={<S><CoreTelephonyPage /></S>} />
                {/* HR & Payroll */}
                <Route path="hr" element={<S><HrDashboardPage /></S>} />
                <Route path="hr/employees" element={<S><HrEmployeesPage /></S>} />
                <Route path="hr/employees/new" element={<S><HrCreateEmployeePage /></S>} />
                <Route path="hr/employees/:id" element={<S><CoreEmployee360 /></S>} />
                <Route path="hr/onboarding" element={<S><HrOnboardingPage /></S>} />
                <Route path="hr/payroll" element={<S><HrPayrollPage /></S>} />
                <Route path="hr/commissions" element={<S><HrCommissionsPage /></S>} />
                <Route path="hr/time" element={<S><HrTimePage /></S>} />
                <Route path="hr/schedules" element={<S><HrPlaceholderPage /></S>} />
                <Route path="hr/documents" element={<S><HrPlaceholderPage /></S>} />
                <Route path="hr/tax-documents" element={<S><HrPlaceholderPage /></S>} />
                <Route path="hr/requests" element={<S><HrPlaceholderPage /></S>} />
                <Route path="hr/careers" element={<S><CoreCareersPage /></S>} />
                <Route path="hr/applications" element={<S><CoreApplicationsPage /></S>} />
                <Route path="hr/audit" element={<S><HrPlaceholderPage /></S>} />
                {/* Legacy HR */}
                <Route path="careers" element={<S><CoreCareersPage /></S>} />
                <Route path="applications" element={<S><CoreApplicationsPage /></S>} />
                {/* System */}
                <Route path="notifications" element={<S><CoreNotificationsPage /></S>} />
                <Route path="maintenance" element={<S><CoreMaintenancePage /></S>} />
                <Route path="email-activity" element={<S><CoreEmailActivityPage /></S>} />
                <Route path="site-settings" element={<S><CoreSiteSettingsPage /></S>} />
                <Route path="users-access" element={<S><CoreUsersAccessPage /></S>} />
                <Route path="audit-log" element={<S><CoreAuditLogPage /></S>} />
                <Route path="security-events" element={<S><CoreSecurityEventsPage /></S>} />
                <Route path="security-guardian" element={<S><CoreSecurityGuardianPage /></S>} />
                <Route path="system-audit" element={<S><CoreSystemAuditPage /></S>} />
                <Route path="staff" element={<S><CoreStaffPage /></S>} />
                <Route path="my-account" element={<S><CoreMyAccountPage /></S>} />
                <Route path="settings" element={<S><CoreSettingsPage /></S>} />
                <Route path="stock" element={<S><CoreStockPage /></S>} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default CoreApp;
