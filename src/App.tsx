import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import About from "./pages/About";
import Careers from "./pages/Careers";
import JobApplication from "./pages/JobApplication";
import FAQ from "./pages/FAQ";
import BookConsultation from "./pages/BookConsultation";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import ServicesDetail from "./pages/ServicesDetail";
import InternetPlans from "./pages/InternetPlans";
import TVPlans from "./pages/TVPlans";
import MobilePlans from "./pages/MobilePlans";
import NotFound from "./pages/NotFound";
import NotAuthorized from "./pages/NotAuthorized";
import AdminLogin from "./pages/admin/AdminLogin";
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
import TechnicianProtectedRoute from "./components/technician/TechnicianProtectedRoute";
import ClientAuth from "./pages/client/ClientAuth";
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
import TechnicianAuth from "./pages/technician/TechnicianAuth";
import TechnicianDashboard from "./pages/technician/TechnicianDashboard";
import AdminReplacements from "./pages/admin/AdminReplacements";
import AdminEmployees from "./pages/admin/AdminEmployees";
import AdminPromotions from "./pages/admin/AdminPromotions";
import AdminAccounts from "./pages/admin/AdminAccounts";
import AdminStreaming from "./pages/admin/AdminStreaming";
import EmployeeProtectedRoute from "./components/employee/EmployeeProtectedRoute";
import EmployeeLogin from "./pages/employee/EmployeeLogin";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeOrders from "./pages/employee/EmployeeOrders";
import EmployeeAppointments from "./pages/employee/EmployeeAppointments";
import EmployeeTickets from "./pages/employee/EmployeeTickets";
import EmployeeClients from "./pages/employee/EmployeeClients";
import EmployeeInvoices from "./pages/employee/EmployeeInvoices";
import EmployeeStreaming from "./pages/employee/EmployeeStreaming";

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
              <Route path="/careers" element={<Careers />} />
              <Route path="/apply" element={<JobApplication />} />
              <Route path="/apply/:jobId" element={<JobApplication />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/book" element={<BookConsultation />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfUse />} />
              <Route path="/admin/login" element={<AdminLogin />} />
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
              {/* Employee Portal Routes */}
              <Route path="/employee/login" element={<EmployeeLogin />} />
              <Route path="/employee" element={<EmployeeProtectedRoute><EmployeeDashboard /></EmployeeProtectedRoute>} />
              <Route path="/employee/orders" element={<EmployeeProtectedRoute><EmployeeOrders /></EmployeeProtectedRoute>} />
              <Route path="/employee/appointments" element={<EmployeeProtectedRoute><EmployeeAppointments /></EmployeeProtectedRoute>} />
              <Route path="/employee/tickets" element={<EmployeeProtectedRoute><EmployeeTickets /></EmployeeProtectedRoute>} />
              <Route path="/employee/clients" element={<EmployeeProtectedRoute><EmployeeClients /></EmployeeProtectedRoute>} />
              <Route path="/employee/invoices" element={<EmployeeProtectedRoute><EmployeeInvoices /></EmployeeProtectedRoute>} />
              <Route path="/employee/streaming" element={<EmployeeProtectedRoute><EmployeeStreaming /></EmployeeProtectedRoute>} />
              {/* Client Portal Routes */}
              <Route path="/portal/auth" element={<ClientAuth />} />
              <Route path="/portal" element={<ClientProtectedRoute><ClientDashboard /></ClientProtectedRoute>} />
              <Route path="/portal/appointments" element={<ClientProtectedRoute><ClientAppointments /></ClientProtectedRoute>} />
              <Route path="/portal/orders" element={<ClientProtectedRoute><ClientOrders /></ClientProtectedRoute>} />
              <Route path="/portal/new-order" element={<ClientProtectedRoute><ClientNewOrder /></ClientProtectedRoute>} />
              <Route path="/portal/order-confirmation" element={<ClientProtectedRoute><ClientOrderConfirmation /></ClientProtectedRoute>} />
              <Route path="/portal/invoices" element={<ClientProtectedRoute><ClientInvoices /></ClientProtectedRoute>} />
              <Route path="/portal/services" element={<ClientProtectedRoute><ClientServices /></ClientProtectedRoute>} />
              <Route path="/portal/tickets" element={<ClientProtectedRoute><ClientTickets /></ClientProtectedRoute>} />
              <Route path="/portal/channels" element={<ClientProtectedRoute><ClientChannels /></ClientProtectedRoute>} />
              <Route path="/portal/internet" element={<ClientProtectedRoute><ClientInternetOrder /></ClientProtectedRoute>} />
              <Route path="/portal/tv-order" element={<ClientProtectedRoute><ClientTVOrder /></ClientProtectedRoute>} />
              <Route path="/portal/replacement" element={<ClientProtectedRoute><ClientEquipmentReplacement /></ClientProtectedRoute>} />
              <Route path="/portal/profile" element={<ClientProtectedRoute><ClientProfile /></ClientProtectedRoute>} />
              <Route path="/portal/payments" element={<ClientProtectedRoute><ClientPayments /></ClientProtectedRoute>} />
              <Route path="/portal/contracts" element={<ClientProtectedRoute><ClientContracts /></ClientProtectedRoute>} />
              {/* Technician Portal Routes */}
              <Route path="/technician/auth" element={<TechnicianAuth />} />
              <Route path="/technician" element={<TechnicianProtectedRoute><TechnicianDashboard /></TechnicianProtectedRoute>} />
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
