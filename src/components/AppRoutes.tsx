import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import MaintenanceGuard from "@/components/MaintenanceGuard";
import { PublicLayout } from "@/components/PublicLayout";
import { lazy, Suspense } from "react";

// Public pages
import Index from "@/pages/Index";
import About from "@/pages/About";
import Careers from "@/pages/Careers";
import JobApplication from "@/pages/JobApplication";
import FAQ from "@/pages/FAQ";
import Contact from "@/pages/Contact";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfUse from "@/pages/TermsOfUse";
import ServicesDetail from "@/pages/ServicesDetail";
import InternetPlans from "@/pages/InternetPlans";
import TVPlans from "@/pages/TVPlans";
import MobilePlans from "@/pages/MobilePlans";
import StreamingPlans from "@/pages/StreamingPlans";
import NotFound from "@/pages/NotFound";
import NotAuthorized from "@/pages/NotAuthorized";
import APropos from "@/pages/APropos";
import Aide from "@/pages/Aide";
import DynamicPage from "@/pages/DynamicPage";

// Legal pages
import ConditionsDeService from "@/pages/legal/ConditionsDeService";
import InstallationRendezvous from "@/pages/legal/InstallationRendezvous";
import ModalitesPaiement from "@/pages/legal/ModalitesPaiement";
import EquipementGarantie from "@/pages/legal/EquipementGarantie";
import SupportEtPlaintes from "@/pages/legal/SupportEtPlaintes";
import ConfidentialiteLoi25 from "@/pages/legal/ConfidentialiteLoi25";
import FraisPossibles from "@/pages/legal/FraisPossibles";
import RefundPolicy from "@/pages/legal/RefundPolicy";
import PrivacyPolicyPage from "@/pages/legal/PrivacyPolicyPage";
import TermsAndConditions from "@/pages/legal/TermsAndConditions";

// Admin pages
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminBootstrap from "@/pages/admin/AdminBootstrap";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminClients from "@/pages/admin/AdminClients";
import AdminServices from "@/pages/admin/AdminServices";
import AdminBilling from "@/pages/admin/AdminBilling";
import AdminRequests from "@/pages/admin/AdminRequests";
import AdminContracts from "@/pages/admin/AdminContracts";
import AdminActivityLogs from "@/pages/admin/AdminActivityLogs";
import AdminAppointments from "@/pages/admin/AdminAppointments";
import AdminCareers from "@/pages/admin/AdminCareers";
import AdminApplications from "@/pages/admin/AdminApplications";
import AdminTickets from "@/pages/admin/AdminTickets";
import AdminChannels from "@/pages/admin/AdminChannels";
import AdminTechnicians from "@/pages/admin/AdminTechnicians";
import AdminReplacements from "@/pages/admin/AdminReplacements";
import AdminCancellations from "@/pages/admin/AdminCancellations";
import AdminEmployees from "@/pages/admin/AdminEmployees";
import AdminPromotions from "@/pages/admin/AdminPromotions";
import AdminAccounts from "@/pages/admin/AdminAccounts";
import AdminStreaming from "@/pages/admin/AdminStreaming";
import AdminStreamingCatalog from "@/pages/admin/AdminStreamingCatalog";
import AdminSystemStatus from "@/pages/admin/AdminSystemStatus";
import AdminInternalTickets from "@/pages/admin/AdminInternalTickets";
import AdminEmailActivity from "@/pages/admin/AdminEmailActivity";
import AdminAccount from "@/pages/admin/AdminAccount";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminUsersAccess from "@/pages/admin/AdminUsersAccess";
import AdminAuditLog from "@/pages/admin/AdminAuditLog";
import AdminResetPassword from "@/pages/admin/AdminResetPassword";
import AdminPDFTest from "@/pages/admin/AdminPDFTest";
import AdminQA from "@/pages/admin/AdminQA";
import AdminRecouvrement from "@/pages/admin/AdminRecouvrement";
import AdminPaymentDisputes from "@/pages/admin/AdminPaymentDisputes";
import AdminPaymentVerification from "@/pages/admin/AdminPaymentVerification";
import AdminSite from "@/pages/admin/AdminSite";
import AdminSecurityEvents from "@/pages/admin/AdminSecurityEvents";
import AdminMaintenance from "@/pages/admin/AdminMaintenance";
import AdminSecurityGuardian from "@/pages/admin/AdminSecurityGuardian";
import AdminCryptoSettings from "@/pages/admin/AdminCryptoSettings";
import AdminCryptoPayments from "@/pages/admin/AdminCryptoPayments";
import AdminCryptoIPNLogs from "@/pages/admin/AdminCryptoIPNLogs";
import ProtectedRoute from "@/components/admin/ProtectedRoute";

// Client Portal pages
import PortalAuth from "@/pages/portal/PortalAuth";
import PortalDashboard from "@/pages/portal/PortalDashboard";
import PortalNewOrder from "@/pages/portal/PortalNewOrder";
import PortalOrders from "@/pages/portal/PortalOrders";
import PortalContracts from "@/pages/portal/PortalContracts";
import PortalPayments from "@/pages/portal/PortalPayments";
import PortalSupport from "@/pages/portal/PortalSupport";

// DEV-ONLY imports (lazy to avoid bundling in production)
const AdminQABlockStatus = lazy(() => import("@/pages/admin/AdminQABlockStatus"));

/**
 * AppRoutes - All application routes
 * 
 * Structure:
 * - Public routes: Wrapped with MaintenanceGuard
 * - Admin routes: NEVER wrapped with MaintenanceGuard (admins always have access)
 * - Client Portal: PIN-authenticated client access
 */
const AppRoutes = () => {
  return (
    <Routes>
      {/* ============================================ */}
      {/* PUBLIC ROUTES - Wrapped with MaintenanceGuard + PublicLayout */}
      {/* ============================================ */}
      <Route path="/" element={<MaintenanceGuard><PublicLayout><Index /></PublicLayout></MaintenanceGuard>} />
      <Route path="/about" element={<MaintenanceGuard><PublicLayout><About /></PublicLayout></MaintenanceGuard>} />
      <Route path="/services" element={<MaintenanceGuard><PublicLayout><ServicesDetail /></PublicLayout></MaintenanceGuard>} />
      <Route path="/internet" element={<MaintenanceGuard><PublicLayout><InternetPlans /></PublicLayout></MaintenanceGuard>} />
      <Route path="/tv" element={<MaintenanceGuard><PublicLayout><TVPlans /></PublicLayout></MaintenanceGuard>} />
      <Route path="/mobile" element={<MaintenanceGuard><PublicLayout><MobilePlans /></PublicLayout></MaintenanceGuard>} />
      <Route path="/streaming" element={<MaintenanceGuard><PublicLayout><StreamingPlans /></PublicLayout></MaintenanceGuard>} />
      <Route path="/careers" element={<MaintenanceGuard><PublicLayout><Careers /></PublicLayout></MaintenanceGuard>} />
      <Route path="/apply" element={<MaintenanceGuard><PublicLayout><JobApplication /></PublicLayout></MaintenanceGuard>} />
      <Route path="/apply/:jobId" element={<MaintenanceGuard><PublicLayout><JobApplication /></PublicLayout></MaintenanceGuard>} />
      <Route path="/faq" element={<MaintenanceGuard><PublicLayout><FAQ /></PublicLayout></MaintenanceGuard>} />
      <Route path="/contact" element={<MaintenanceGuard><PublicLayout><Contact /></PublicLayout></MaintenanceGuard>} />
      <Route path="/privacy" element={<MaintenanceGuard><PublicLayout><PrivacyPolicy /></PublicLayout></MaintenanceGuard>} />
      <Route path="/terms" element={<MaintenanceGuard><PublicLayout><TermsOfUse /></PublicLayout></MaintenanceGuard>} />
      <Route path="/not-authorized" element={<MaintenanceGuard><PublicLayout><NotAuthorized /></PublicLayout></MaintenanceGuard>} />
      
      {/* Legal pages */}
      <Route path="/conditions-de-service" element={<MaintenanceGuard><PublicLayout><ConditionsDeService /></PublicLayout></MaintenanceGuard>} />
      <Route path="/installation-rendezvous" element={<MaintenanceGuard><PublicLayout><InstallationRendezvous /></PublicLayout></MaintenanceGuard>} />
      <Route path="/modalites-paiement" element={<MaintenanceGuard><PublicLayout><ModalitesPaiement /></PublicLayout></MaintenanceGuard>} />
      <Route path="/equipement-garantie" element={<MaintenanceGuard><PublicLayout><EquipementGarantie /></PublicLayout></MaintenanceGuard>} />
      <Route path="/support-et-plaintes" element={<MaintenanceGuard><PublicLayout><SupportEtPlaintes /></PublicLayout></MaintenanceGuard>} />
      <Route path="/confidentialite-loi25" element={<MaintenanceGuard><PublicLayout><ConfidentialiteLoi25 /></PublicLayout></MaintenanceGuard>} />
      <Route path="/frais-possibles" element={<MaintenanceGuard><PublicLayout><FraisPossibles /></PublicLayout></MaintenanceGuard>} />
      <Route path="/refund-policy" element={<MaintenanceGuard><PublicLayout><RefundPolicy /></PublicLayout></MaintenanceGuard>} />
      <Route path="/privacy-policy" element={<MaintenanceGuard><PublicLayout><PrivacyPolicyPage /></PublicLayout></MaintenanceGuard>} />
      <Route path="/terms-and-conditions" element={<MaintenanceGuard><PublicLayout><TermsAndConditions /></PublicLayout></MaintenanceGuard>} />
      <Route path="/a-propos" element={<MaintenanceGuard><PublicLayout><APropos /></PublicLayout></MaintenanceGuard>} />
      <Route path="/aide" element={<MaintenanceGuard><PublicLayout><Aide /></PublicLayout></MaintenanceGuard>} />
      
      {/* Dynamic pages from site_pages */}
      <Route path="/page/:slug" element={<MaintenanceGuard><PublicLayout><DynamicPage /></PublicLayout></MaintenanceGuard>} />

      {/* ============================================ */}
      {/* ADMIN ROUTES - NO MaintenanceGuard (always accessible) */}
      {/* ============================================ */}
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
      <Route path="/admin/payment-verification" element={<AuthProvider><ProtectedRoute requireAdmin><AdminPaymentVerification /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/site" element={<AuthProvider><ProtectedRoute requireAdmin><AdminSite /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/security-events" element={<AuthProvider><ProtectedRoute requireAdmin><AdminSecurityEvents /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/maintenance" element={<AuthProvider><ProtectedRoute requireAdmin><AdminMaintenance /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/security-guardian" element={<AuthProvider><ProtectedRoute requireAdmin><AdminSecurityGuardian /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/crypto-settings" element={<AuthProvider><ProtectedRoute requireAdmin><AdminCryptoSettings /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/crypto-payments" element={<AuthProvider><ProtectedRoute requireAdmin><AdminCryptoPayments /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/crypto-ipn-logs" element={<AuthProvider><ProtectedRoute requireAdmin><AdminCryptoIPNLogs /></ProtectedRoute></AuthProvider>} />

      {/* DEV-ONLY routes */}
      {import.meta.env.DEV && (
        <>
          <Route path="/qa/block-status" element={<Suspense fallback={<div>Loading...</div>}><AdminQABlockStatus /></Suspense>} />
          <Route path="/qa/block-status/:mode" element={<Suspense fallback={<div>Loading...</div>}><AdminQABlockStatus /></Suspense>} />
        </>
      )}
      
      {/* EMPLOYEE PORTAL DISABLED - All /employee/* routes redirect to NotFound */}
      <Route path="/employee/*" element={<NotFound />} />
      <Route path="/employee" element={<NotFound />} />
      
      {/* ============================================ */}
      {/* CLIENT PORTAL ROUTES */}
      {/* ============================================ */}
      <Route path="/portal" element={<Navigate to="/portal/dashboard" replace />} />
      <Route path="/portal/auth" element={<PortalAuth />} />
      <Route path="/portal/dashboard" element={<PortalDashboard />} />
      <Route path="/portal/new-order" element={<PortalNewOrder />} />
      <Route path="/portal/orders" element={<PortalOrders />} />
      <Route path="/portal/contracts" element={<PortalContracts />} />
      <Route path="/portal/payments" element={<PortalPayments />} />
      <Route path="/portal/support" element={<PortalSupport />} />
      {/* Additional portal routes for order flows */}
      <Route path="/portal/internet" element={<PortalNewOrder />} />
      <Route path="/portal/tv-order" element={<PortalNewOrder />} />
      <Route path="/portal/mobile-order" element={<PortalNewOrder />} />
      <Route path="/portal/streaming-order" element={<PortalNewOrder />} />

      {/* 404 Catch-all */}
      <Route path="*" element={<MaintenanceGuard><PublicLayout><NotFound /></PublicLayout></MaintenanceGuard>} />
    </Routes>
  );
};

export default AppRoutes;
