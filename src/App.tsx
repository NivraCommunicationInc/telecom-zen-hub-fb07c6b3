import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ClientAuthProvider } from "@/hooks/useClientAuth";
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
import ClientMonthlyInvoices from "./pages/client/ClientMonthlyInvoices";
import AdminReplacements from "./pages/admin/AdminReplacements";
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
          <AuthProvider>
            <Routes>
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
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/reset-password" element={<AdminResetPassword />} />
              <Route path="/admin/bootstrap" element={<AdminBootstrap />} />
              <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/orders" element={<ProtectedRoute requireAdmin><AdminOrders /></ProtectedRoute>} />
              <Route path="/admin/clients" element={<ProtectedRoute requireAdmin><AdminClients /></ProtectedRoute>} />
              <Route path="/admin/services" element={<ProtectedRoute requireAdmin><AdminServices /></ProtectedRoute>} />
              <Route path="/admin/billing" element={<ProtectedRoute requireAdmin><AdminBilling /></ProtectedRoute>} />
              <Route path="/admin/requests" element={<ProtectedRoute requireAdmin><AdminRequests /></ProtectedRoute>} />
              <Route path="/admin/contracts" element={<ProtectedRoute requireAdmin><AdminContracts /></ProtectedRoute>} />
              <Route path="/admin/activity" element={<ProtectedRoute requireAdmin><AdminActivityLogs /></ProtectedRoute>} />
              <Route path="/admin/appointments" element={<ProtectedRoute requireAdmin><AdminAppointments /></ProtectedRoute>} />
              <Route path="/admin/careers" element={<ProtectedRoute requireAdmin><AdminCareers /></ProtectedRoute>} />
              <Route path="/admin/applications" element={<ProtectedRoute requireAdmin><AdminApplications /></ProtectedRoute>} />
              <Route path="/admin/tickets" element={<ProtectedRoute requireAdmin><AdminTickets /></ProtectedRoute>} />
              <Route path="/admin/channels" element={<ProtectedRoute requireAdmin><AdminChannels /></ProtectedRoute>} />
              <Route path="/admin/technicians" element={<ProtectedRoute requireAdmin><AdminTechnicians /></ProtectedRoute>} />
              <Route path="/admin/replacements" element={<ProtectedRoute requireAdmin><AdminReplacements /></ProtectedRoute>} />
              <Route path="/admin/employees" element={<ProtectedRoute requireAdmin><AdminEmployees /></ProtectedRoute>} />
              <Route path="/admin/promotions" element={<ProtectedRoute requireAdmin><AdminPromotions /></ProtectedRoute>} />
              <Route path="/admin/accounts" element={<ProtectedRoute requireAdmin><AdminAccounts /></ProtectedRoute>} />
              <Route path="/admin/streaming" element={<ProtectedRoute requireAdmin><AdminStreaming /></ProtectedRoute>} />
              <Route path="/admin/streaming-catalog" element={<ProtectedRoute requireAdmin><AdminStreamingCatalog /></ProtectedRoute>} />
              <Route path="/admin/system-status" element={<ProtectedRoute requireAdmin><AdminSystemStatus /></ProtectedRoute>} />
              <Route path="/admin/internal-tickets" element={<ProtectedRoute requireAdmin><AdminInternalTickets /></ProtectedRoute>} />
              <Route path="/admin/email-activity" element={<ProtectedRoute requireAdmin><AdminEmailActivity /></ProtectedRoute>} />
              <Route path="/admin/account" element={<ProtectedRoute requireAdmin><AdminAccount /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
              <Route path="/admin/users-access" element={<ProtectedRoute requireAdmin><AdminUsersAccess /></ProtectedRoute>} />
              <Route path="/admin/audit-log" element={<ProtectedRoute requireAdmin><AdminAuditLog /></ProtectedRoute>} />
              <Route path="/admin/pdf-test" element={<ProtectedRoute requireAdmin><AdminPDFTest /></ProtectedRoute>} />
              {/* Client Portal Routes */}
              <Route path="/portal/auth" element={<ClientAuthProvider><ClientAuth /></ClientAuthProvider>} />
              <Route path="/portal/suspended" element={<ClientAuthProvider><ClientSuspended /></ClientAuthProvider>} />
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
              <Route path="/portal/profile" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientProfile /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
              <Route path="/portal/payments" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientPayments /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
              <Route path="/portal/contracts" element={<ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientContracts /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider>} />
              <Route path="/not-authorized" element={<NotAuthorized />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;