import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import About from "./pages/About";
import Careers from "./pages/Careers";
import FAQ from "./pages/FAQ";
import BookConsultation from "./pages/BookConsultation";
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
import ProtectedRoute from "./components/admin/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/book" element={<BookConsultation />} />
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
            <Route path="/not-authorized" element={<NotAuthorized />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
