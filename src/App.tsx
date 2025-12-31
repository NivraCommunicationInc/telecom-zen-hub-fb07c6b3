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
import ProtectedRoute from "./components/admin/ProtectedRoute";
import ClientProtectedRoute from "./components/client/ClientProtectedRoute";
import ClientAuth from "./pages/client/ClientAuth";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientAppointments from "./pages/client/ClientAppointments";
import ClientInvoices from "./pages/client/ClientInvoices";
import ClientTickets from "./pages/client/ClientTickets";
import ClientSubscriptions from "./pages/client/ClientSubscriptions";
import ClientProfile from "./pages/client/ClientProfile";
import ClientPayments from "./pages/client/ClientPayments";
import ClientOrders from "./pages/client/ClientOrders";
import ClientContracts from "./pages/client/ClientContracts";
import ClientNewOrder from "./pages/client/ClientNewOrder";
const queryClient = new QueryClient();

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
              {/* Client Portal Routes */}
              <Route path="/portal/auth" element={<ClientAuth />} />
              <Route path="/portal" element={<ClientProtectedRoute><ClientDashboard /></ClientProtectedRoute>} />
              <Route path="/portal/appointments" element={<ClientProtectedRoute><ClientAppointments /></ClientProtectedRoute>} />
              <Route path="/portal/orders" element={<ClientProtectedRoute><ClientOrders /></ClientProtectedRoute>} />
              <Route path="/portal/new-order" element={<ClientProtectedRoute><ClientNewOrder /></ClientProtectedRoute>} />
              <Route path="/portal/invoices" element={<ClientProtectedRoute><ClientInvoices /></ClientProtectedRoute>} />
              <Route path="/portal/subscriptions" element={<ClientProtectedRoute><ClientSubscriptions /></ClientProtectedRoute>} />
              <Route path="/portal/tickets" element={<ClientProtectedRoute><ClientTickets /></ClientProtectedRoute>} />
              <Route path="/portal/profile" element={<ClientProtectedRoute><ClientProfile /></ClientProtectedRoute>} />
              <Route path="/portal/payments" element={<ClientProtectedRoute><ClientPayments /></ClientProtectedRoute>} />
              <Route path="/portal/contracts" element={<ClientProtectedRoute><ClientContracts /></ClientProtectedRoute>} />
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
