import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ClientAuthProvider } from "@/hooks/useClientAuth";
import { EmployeeAuthProvider } from "@/hooks/useEmployeeAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import About from "./pages/About";
import Careers from "./pages/Careers";
import JobApplication from "./pages/JobApplication";
import FAQ from "./pages/FAQ";
import Contact from "./pages/Contact";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import ServicesDetail from "./pages/ServicesDetail";
import InternetPlans from "./pages/InternetPlans";
import TVPlans from "./pages/TVPlans";
import MobilePlans from "./pages/MobilePlans";
import StreamingPlans from "./pages/StreamingPlans";
import NotFound from "./pages/NotFound";
// Legal pages
import ConditionsDeService from "./pages/legal/ConditionsDeService";
import InstallationRendezvous from "./pages/legal/InstallationRendezvous";
import ModalitesPaiement from "./pages/legal/ModalitesPaiement";
import EquipementGarantie from "./pages/legal/EquipementGarantie";
import SupportEtPlaintes from "./pages/legal/SupportEtPlaintes";
import ConfidentialiteLoi25 from "./pages/legal/ConfidentialiteLoi25";
import FraisPossibles from "./pages/legal/FraisPossibles";
import APropos from "./pages/APropos";
import Aide from "./pages/Aide";
import NotAuthorized from "./pages/NotAuthorized";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminBootstrap from "./pages/admin/AdminBootstrap";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminClients from "./pages/admin/AdminClients";
import AdminServices from "./pages/admin/AdminServices";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminRequests from "./pages/admin/AdminRequests";
import AdminContracts from "./pages/admin/AdminContracts";
import AdminActivityLogs from "./pages/admin/AdminActivityLogs";
import AdminAppointments from "./pages/admin/AdminAppointments";
import AdminCareers from "./pages/admin/AdminCareers";
import AdminApplications from "./pages/admin/AdminApplications";
import AdminTickets from "./pages/admin/AdminTickets";
import AdminChannels from "./pages/admin/AdminChannels";
import AdminTechnicians from "./pages/admin/AdminTechnicians";
import ProtectedRoute from "./components/admin/ProtectedRoute";
import ClientProtectedRoute from "./components/client/ClientProtectedRoute";
import ClientSecurityCheck from "./components/client/ClientSecurityCheck";
import ClientAuth from "./pages/client/ClientAuth";
import ClientSuspended from "./pages/client/ClientSuspended";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientAppointments from "./pages/client/ClientAppointments";
import ClientInvoices from "./pages/client/ClientInvoices";
import ClientTickets from "./pages/client/ClientTickets";
import ClientServices from "./pages/client/ClientServices";
import ClientProfile from "./pages/client/ClientProfile";
import ClientPayments from "./pages/client/ClientPayments";
import ClientOrders from "./pages/client/ClientOrders";
import ClientContracts from "./pages/client/ClientContracts";
import ClientNewOrder from "./pages/client/ClientNewOrder";
import ClientOrderConfirmation from "./pages/client/ClientOrderConfirmation";
import ClientChannels from "./pages/client/ClientChannels";
import ClientInternetOrder from "./pages/client/ClientInternetOrder";
import ClientTVOrder from "./pages/client/ClientTVOrder";
import ClientEquipmentReplacement from "./pages/client/ClientEquipmentReplacement";
import ClientCancellations from "./pages/client/ClientCancellations";
import ClientAccessBlocked from "./pages/client/ClientAccessBlocked";
import ClientMonthlyInvoices from "./pages/client/ClientMonthlyInvoices";
import AdminReplacements from "./pages/admin/AdminReplacements";
import AdminCancellations from "./pages/admin/AdminCancellations";
import AdminEmployees from "./pages/admin/AdminEmployees";
import AdminPromotions from "./pages/admin/AdminPromotions";
import AdminAccounts from "./pages/admin/AdminAccounts";
import AdminStreaming from "./pages/admin/AdminStreaming";
import AdminStreamingCatalog from "./pages/admin/AdminStreamingCatalog";
import AdminSystemStatus from "./pages/admin/AdminSystemStatus";
import AdminInternalTickets from "./pages/admin/AdminInternalTickets";
import AdminEmailActivity from "./pages/admin/AdminEmailActivity";
import AdminAccount from "./pages/admin/AdminAccount";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUsersAccess from "./pages/admin/AdminUsersAccess";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import AdminResetPassword from "./pages/admin/AdminResetPassword";
import AdminPDFTest from "./pages/admin/AdminPDFTest";
import AdminQA from "./pages/admin/AdminQA";
import AdminRecouvrement from "./pages/admin/AdminRecouvrement";
import AdminPaymentDisputes from "./pages/admin/AdminPaymentDisputes";
import AdminSite from "./pages/admin/AdminSite";
import DynamicPage from "./pages/DynamicPage";
import EmployeeLogin from "./pages/employee/EmployeeLogin";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeClients from "./pages/employee/EmployeeClients";
import EmployeeOrders from "./pages/employee/EmployeeOrders";
import EmployeeBilling from "./pages/employee/EmployeeBilling";
import EmployeeCancellations from "./pages/employee/EmployeeCancellations";
import EmployeePaymentDisputes from "./pages/employee/EmployeePaymentDisputes";
import EmployeeTickets from "./pages/employee/EmployeeTickets";
import EmployeeLayout from "./components/employee/EmployeeLayout";
import EmployeeErrorBoundary from "./components/employee/EmployeeErrorBoundary";
import EmployeeProtectedRoute from "./components/employee/EmployeeProtectedRoute";
import { lazy, Suspense } from "react";

// DEV-ONLY imports (lazy to avoid bundling in production)
const AdminQABlockStatus = lazy(() => import("./pages/admin/AdminQABlockStatus"));
const AdminQAEmployeeSmoke = lazy(() => import("./pages/admin/AdminQAEmployeeSmoke"));
const AdminQAEmployeeCancellations = lazy(() => import("./pages/admin/AdminQAEmployeeCancellations"));
const AdminQAEmployeeDisputes = lazy(() => import("./pages/admin/AdminQAEmployeeDisputes"));
const AdminQAEmployeeTickets = lazy(() => import("./pages/admin/AdminQAEmployeeTickets"));
const AdminQAEmployeeClients = lazy(() => import("./pages/admin/AdminQAEmployeeClients"));
const AdminQAEmployeeOrders = lazy(() => import("./pages/admin/AdminQAEmployeeOrders"));
const AdminQAEmployeeBilling = lazy(() => import("./pages/admin/AdminQAEmployeeBilling"));
const AdminQAEmployeeSidebar = lazy(() => import("./pages/admin/AdminQAEmployeeSidebar"));
const AdminQAAdminAsEmployee = lazy(() => import("./pages/admin/AdminQAAdminAsEmployee"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes - No auth provider needed */}
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<ServicesDetail />} />
            <Route path="/internet" element={<InternetPlans />} />
            <Route path="/tv" element={<TVPlans />} />
            <Route path="/mobile" element={<MobilePlans />} />
            <Route path="/streaming" element={<StreamingPlans />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/apply" element={<JobApplication />} />
            <Route path="/apply/:jobId" element={<JobApplication />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfUse />} />
            <Route path="/not-authorized" element={<NotAuthorized />} />
            {/* Legal pages */}
            <Route path="/conditions-de-service" element={<ConditionsDeService />} />
            <Route path="/installation-rendezvous" element={<InstallationRendezvous />} />
            <Route path="/modalites-paiement" element={<ModalitesPaiement />} />
            <Route path="/equipement-garantie" element={<EquipementGarantie />} />
            <Route path="/support-et-plaintes" element={<SupportEtPlaintes />} />
            <Route path="/confidentialite-loi25" element={<ConfidentialiteLoi25 />} />
            <Route path="/frais-possibles" element={<FraisPossibles />} />
            <Route path="/a-propos" element={<APropos />} />
            <Route path="/aide" element={<Aide />} />
            {/* Admin Routes - Wrapped with AuthProvider (admin storage key) */}
            <Route path="/admin/login" element={<AuthProvider><AdminLogin /></AuthProvider>} />
            <Route path="/admin/reset-password" element={<AuthProvider><AdminResetPassword /></AuthProvider>} />
            <Route path="/admin/bootstrap" element={<AuthProvider><AdminBootstrap /></AuthProvider>} />
            <Route path="/admin" element={<AuthProvider><ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/orders" element={<AuthProvider><ProtectedRoute requireAdmin><AdminOrders /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/clients" element={<AuthProvider><ProtectedRoute requireAdmin><AdminClients /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/services" element={<AuthProvider><ProtectedRoute requireAdmin><AdminServices /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/billing" element={<AuthProvider><ProtectedRoute requireAdmin><AdminBilling /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/requests" element={<AuthProvider><ProtectedRoute requireAdmin><AdminRequests /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/contracts" element={<AuthProvider><ProtectedRoute requireAdmin><AdminContracts /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/activity" element={<AuthProvider><ProtectedRoute requireAdmin><AdminActivityLogs /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/appointments" element={<AuthProvider><ProtectedRoute requireAdmin><AdminAppointments /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/careers" element={<AuthProvider><ProtectedRoute requireAdmin><AdminCareers /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/applications" element={<AuthProvider><ProtectedRoute requireAdmin><AdminApplications /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/tickets" element={<AuthProvider><ProtectedRoute requireAdmin><AdminTickets /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/channels" element={<AuthProvider><ProtectedRoute requireAdmin><AdminChannels /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/technicians" element={<AuthProvider><ProtectedRoute requireAdmin><AdminTechnicians /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/replacements" element={<AuthProvider><ProtectedRoute requireAdmin><AdminReplacements /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/cancellations" element={<AuthProvider><ProtectedRoute requireAdmin><AdminCancellations /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/employees" element={<AuthProvider><ProtectedRoute requireAdmin><AdminEmployees /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/promotions" element={<AuthProvider><ProtectedRoute requireAdmin><AdminPromotions /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/accounts" element={<AuthProvider><ProtectedRoute requireAdmin><AdminAccounts /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/recouvrement" element={<AuthProvider><ProtectedRoute requireAdmin><AdminRecouvrement /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/streaming" element={<AuthProvider><ProtectedRoute requireAdmin><AdminStreaming /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/streaming-catalog" element={<AuthProvider><ProtectedRoute requireAdmin><AdminStreamingCatalog /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/system-status" element={<AuthProvider><ProtectedRoute requireAdmin><AdminSystemStatus /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/internal-tickets" element={<AuthProvider><ProtectedRoute requireAdmin><AdminInternalTickets /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/email-activity" element={<AuthProvider><ProtectedRoute requireAdmin><AdminEmailActivity /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/account" element={<AuthProvider><ProtectedRoute requireAdmin><AdminAccount /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/users" element={<AuthProvider><ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/users-access" element={<AuthProvider><ProtectedRoute requireAdmin><AdminUsersAccess /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/audit-log" element={<AuthProvider><ProtectedRoute requireAdmin><AdminAuditLog /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/pdf-test" element={<AuthProvider><ProtectedRoute requireAdmin><AdminPDFTest /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/qa" element={<AuthProvider><ProtectedRoute requireAdmin><AdminQA /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/payment-disputes" element={<AuthProvider><ProtectedRoute requireAdmin><AdminPaymentDisputes /></ProtectedRoute></AuthProvider>} />
            <Route path="/admin/site" element={<AuthProvider><ProtectedRoute requireAdmin><AdminSite /></ProtectedRoute></AuthProvider>} />
            {/* Dynamic pages from site_pages */}
            <Route path="/page/:slug" element={<DynamicPage />} />
            {import.meta.env.DEV && (
              <>
                <Route path="/qa/block-status" element={<Suspense fallback={<div>Loading...</div>}><AdminQABlockStatus /></Suspense>} />
                <Route path="/qa/block-status/:mode" element={<Suspense fallback={<div>Loading...</div>}><AdminQABlockStatus /></Suspense>} />
                <Route path="/qa/employee-smoke" element={<Suspense fallback={<div>Loading...</div>}><AdminQAEmployeeSmoke /></Suspense>} />
                <Route path="/qa/employee/clients" element={<Suspense fallback={<div>Loading...</div>}><AdminQAEmployeeClients /></Suspense>} />
                <Route path="/qa/employee/orders" element={<Suspense fallback={<div>Loading...</div>}><AdminQAEmployeeOrders /></Suspense>} />
                <Route path="/qa/employee/billing" element={<Suspense fallback={<div>Loading...</div>}><AdminQAEmployeeBilling /></Suspense>} />
                <Route path="/qa/employee/cancellations" element={<Suspense fallback={<div>Loading...</div>}><AdminQAEmployeeCancellations /></Suspense>} />
                <Route path="/qa/employee/payment-disputes" element={<Suspense fallback={<div>Loading...</div>}><AdminQAEmployeeDisputes /></Suspense>} />
                <Route path="/qa/employee/tickets" element={<Suspense fallback={<div>Loading...</div>}><AdminQAEmployeeTickets /></Suspense>} />
                <Route path="/qa/employee/sidebar" element={<Suspense fallback={<div>Loading...</div>}><AdminQAEmployeeSidebar /></Suspense>} />
                <Route path="/qa/admin-as-employee" element={<Suspense fallback={<div>Loading...</div>}><AdminQAAdminAsEmployee /></Suspense>} />
              </>
            )}
            {/* Employee Portal Routes - Single EmployeeAuthProvider for ALL /employee/* routes */}
            <Route
              path="/employee"
              element={
                <EmployeeAuthProvider>
                  <EmployeeErrorBoundary>
                    <Outlet />
                  </EmployeeErrorBoundary>
                </EmployeeAuthProvider>
              }
            >
              {/* Login is public but within the same provider */}
              <Route path="login" element={<EmployeeLogin />} />
              
              {/* Protected routes */}
              <Route element={<EmployeeProtectedRoute />}>
                <Route element={<EmployeeLayout />}>
                  <Route index element={<EmployeeDashboard />} />
                  <Route path="clients" element={<EmployeeClients />} />
                  <Route path="orders" element={<EmployeeOrders />} />
                  <Route path="billing" element={<EmployeeBilling />} />
                  <Route path="cancellations" element={<EmployeeCancellations />} />
                  <Route path="payment-disputes" element={<EmployeePaymentDisputes />} />
                  <Route path="tickets" element={<EmployeeTickets />} />
                </Route>
              </Route>
            </Route>
            {/* Client Portal Routes - Wrapped with ClientAuthProvider (portal storage key) */}
            <Route path="/portal/auth" element={<ClientAuthProvider><ClientAuth /></ClientAuthProvider>} />
            <Route path="/portal/suspended" element={<ClientAuthProvider><ClientSuspended /></ClientAuthProvider>} />
            <Route path="/portal/access-blocked" element={<ClientAuthProvider><ClientProtectedRoute allowBlocked><ClientAccessBlocked /></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientDashboard /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/appointments" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientAppointments /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/orders" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientOrders /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/new-order" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientNewOrder /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/order-confirmation" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientOrderConfirmation /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/invoices" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientInvoices /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/monthly-invoices" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientMonthlyInvoices /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/services" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientServices /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/tickets" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientTickets /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/channels" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientChannels /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/internet" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientInternetOrder /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/tv-order" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientTVOrder /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/replacement" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientEquipmentReplacement /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/cancellations" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientCancellations /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/profile" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientProfile /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/payments" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientPayments /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            <Route path="/portal/contracts" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientContracts /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
            
            {/* Catch-all 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;