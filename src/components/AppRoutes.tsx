import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ClientAuthProvider } from "@/hooks/useClientAuth";
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
import MobileCoverage from "@/pages/MobileCoverage";
import StreamingPlans from "@/pages/StreamingPlans";
import NotFound from "@/pages/NotFound";
import NotAuthorized from "@/pages/NotAuthorized";
import APropos from "@/pages/APropos";
import Aide from "@/pages/Aide";
import DynamicPage from "@/pages/DynamicPage";
import Contest from "@/pages/Contest";
import TrackOrder from "@/pages/TrackOrder";
import StatusPage from "@/pages/StatusPage";
import Install from "@/pages/Install";

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
import BillingV2Playbook from "@/pages/admin/BillingV2Playbook";
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
import AdminSite from "@/pages/admin/AdminSite";
import AdminSecurityEvents from "@/pages/admin/AdminSecurityEvents";
import AdminMaintenance from "@/pages/admin/AdminMaintenance";
import AdminSecurityGuardian from "@/pages/admin/AdminSecurityGuardian";
import AdminContests from "@/pages/admin/AdminContests";
import AdminWebForms from "@/pages/admin/AdminWebForms";
import AdminTelephony from "@/pages/admin/AdminTelephony";
import AdminMarketing from "@/pages/admin/AdminMarketing";
import AdminCommunicationEmail from "@/pages/admin/AdminCommunicationEmail";
import AdminCommunicationSMS from "@/pages/admin/AdminCommunicationSMS";
import AdminReferrals from "@/pages/admin/AdminReferrals";
import AdminReferralInfluencers from "@/pages/admin/AdminReferralInfluencers";
import AdminReferralInfluencerDetail from "@/pages/admin/AdminReferralInfluencerDetail";
import AdminReferralCodes from "@/pages/admin/AdminReferralCodes";
import AdminReferralAttributions from "@/pages/admin/AdminReferralAttributions";
import AdminReferralCommissions from "@/pages/admin/AdminReferralCommissions";
import AdminReferralCashouts from "@/pages/admin/AdminReferralCashouts";
import AdminReferralSettings from "@/pages/admin/AdminReferralSettings";
import AdminPartnerTerms from "@/pages/admin/AdminPartnerTerms";
import LiveActivityPage from "@/pages/admin/LiveActivityPage";
import AdminDocumentRequests from "@/pages/admin/AdminDocumentRequests";
import ProtectedRoute from "@/components/admin/ProtectedRoute";

// Influencer Portal
import InfluencerLogin from "@/pages/influencer/InfluencerLogin";
import InfluencerOnboarding from "@/pages/influencer/InfluencerOnboarding";
import InfluencerRegister from "@/pages/influencer/InfluencerRegister";
import InfluencerResetPassword from "@/pages/influencer/InfluencerResetPassword";
import InfluencerDashboard from "@/pages/influencer/InfluencerDashboard";
import InfluencerReferrals from "@/pages/influencer/InfluencerReferrals";
import InfluencerEarnings from "@/pages/influencer/InfluencerEarnings";
import InfluencerCashouts from "@/pages/influencer/InfluencerCashouts";
import InfluencerSettings from "@/pages/influencer/InfluencerSettings";
import InfluencerTerms from "@/pages/influencer/InfluencerTerms";
import { InfluencerAuthProvider } from "@/hooks/useInfluencerAuth";
import InfluencerProtectedRoute from "@/components/influencer/InfluencerProtectedRoute";
import PartnerTermsAcceptanceGuard from "@/components/influencer/PartnerTermsAcceptanceGuard";

// Client portal pages
import ClientAuth from "@/pages/client/ClientAuth";
import ClientSuspended from "@/pages/client/ClientSuspended";
import ClientDashboard from "@/pages/client/ClientDashboard";
import ClientAppointments from "@/pages/client/ClientAppointments";
import ClientInvoices from "@/pages/client/ClientInvoices";
import ClientTickets from "@/pages/client/ClientTickets";
import ClientServices from "@/pages/client/ClientServices";
import ClientProfile from "@/pages/client/ClientProfile";
import ClientPayments from "@/pages/client/ClientPayments";
import ClientOrders from "@/pages/client/ClientOrders";
import ClientContracts from "@/pages/client/ClientContracts";
import ClientNewOrder from "@/pages/client/ClientNewOrder";
import ClientOrderConfirmation from "@/pages/client/ClientOrderConfirmation";
import ClientChannels from "@/pages/client/ClientChannels";
import ClientInternetOrder from "@/pages/client/ClientInternetOrder";
import ClientTVOrder from "@/pages/client/ClientTVOrder";
import ClientEquipmentReplacement from "@/pages/client/ClientEquipmentReplacement";
import ClientCancellations from "@/pages/client/ClientCancellations";
import ClientAccessBlocked from "@/pages/client/ClientAccessBlocked";
import ClientMonthlyInvoices from "@/pages/client/ClientMonthlyInvoices";
import ClientWebForms from "@/pages/client/ClientWebForms";
import ClientDocumentUpload from "@/pages/client/ClientDocumentUpload";
import ClientResetPassword from "@/pages/client/ClientResetPassword";
import ClientVerifyEmail from "@/pages/client/ClientVerifyEmail";
import ClientRescheduleAppointment from "@/pages/client/ClientRescheduleAppointment";
import ClientProtectedRoute from "@/components/client/ClientProtectedRoute";
import ClientSecurityCheck from "@/components/client/ClientSecurityCheck";

// Staff portal pages
import StaffLogin from "@/pages/staff/StaffLogin";
import StaffAdminDashboard from "@/pages/staff/StaffAdminDashboard";
import StaffEmployeeDashboard from "@/pages/staff/StaffEmployeeDashboard";
import StaffTechnicianDashboard from "@/pages/staff/StaffTechnicianDashboard";
import StaffLayout from "@/components/staff/StaffLayout";
import StaffAdminLayout from "@/components/staff/StaffAdminLayout";

// DEV-ONLY imports (lazy to avoid bundling in production)
const AdminQABlockStatus = lazy(() => import("@/pages/admin/AdminQABlockStatus"));

/**
 * AppRoutes - All application routes
 * 
 * Structure:
 * - Public routes: Wrapped with MaintenanceGuard
 * - Admin routes: NEVER wrapped with MaintenanceGuard (admins always have access)
 * - Portal routes: Wrapped with MaintenanceGuard
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
      <Route path="/mobile-coverage" element={<MaintenanceGuard><PublicLayout><MobileCoverage /></PublicLayout></MaintenanceGuard>} />
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
      <Route path="/concours" element={<MaintenanceGuard><PublicLayout><Contest /></PublicLayout></MaintenanceGuard>} />
      <Route path="/track-order" element={<MaintenanceGuard><PublicLayout><TrackOrder /></PublicLayout></MaintenanceGuard>} />
      <Route path="/status" element={<PublicLayout><StatusPage /></PublicLayout>} />
      <Route path="/install" element={<Install />} />
      
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
      <Route path="/admin/billing-playbook" element={<AuthProvider><ProtectedRoute requireAdmin><BillingV2Playbook /></ProtectedRoute></AuthProvider>} />
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
      <Route path="/admin/live-activity" element={<AuthProvider><ProtectedRoute requireAdmin><LiveActivityPage /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/audit-log" element={<AuthProvider><ProtectedRoute requireAdmin><AdminAuditLog /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/pdf-test" element={<AuthProvider><ProtectedRoute requireAdmin><AdminPDFTest /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/qa" element={<AuthProvider><ProtectedRoute requireAdmin><AdminQA /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/payment-disputes" element={<AuthProvider><ProtectedRoute requireAdmin><AdminPaymentDisputes /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/site" element={<AuthProvider><ProtectedRoute requireAdmin><AdminSite /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/security-events" element={<AuthProvider><ProtectedRoute requireAdmin><AdminSecurityEvents /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/maintenance" element={<AuthProvider><ProtectedRoute requireAdmin><AdminMaintenance /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/security-guardian" element={<AuthProvider><ProtectedRoute requireAdmin><AdminSecurityGuardian /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/concours" element={<AuthProvider><ProtectedRoute requireAdmin><AdminContests /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/formulaire-web" element={<AuthProvider><ProtectedRoute requireAdmin><AdminWebForms /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/telephony" element={<AuthProvider><ProtectedRoute requireAdmin><AdminTelephony /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/marketing" element={<AuthProvider><ProtectedRoute requireAdmin><AdminMarketing /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/communication-email" element={<AuthProvider><ProtectedRoute requireAdmin><AdminCommunicationEmail /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/communication-sms" element={<AuthProvider><ProtectedRoute requireAdmin><AdminCommunicationSMS /></ProtectedRoute></AuthProvider>} />
      {/* Admin Referral Program */}
      <Route path="/admin/referrals" element={<AuthProvider><ProtectedRoute requireAdmin><AdminReferrals /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/referrals/influencers" element={<AuthProvider><ProtectedRoute requireAdmin><AdminReferralInfluencers /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/referrals/influencers/:id" element={<AuthProvider><ProtectedRoute requireAdmin><AdminReferralInfluencerDetail /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/referrals/codes" element={<AuthProvider><ProtectedRoute requireAdmin><AdminReferralCodes /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/referrals/attributions" element={<AuthProvider><ProtectedRoute requireAdmin><AdminReferralAttributions /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/referrals/parrainages" element={<Navigate to="/admin/referrals/attributions" replace />} />
      <Route path="/admin/referrals/commissions" element={<AuthProvider><ProtectedRoute requireAdmin><AdminReferralCommissions /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/referrals/cashouts" element={<AuthProvider><ProtectedRoute requireAdmin><AdminReferralCashouts /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/referrals/settings" element={<AuthProvider><ProtectedRoute requireAdmin><AdminReferralSettings /></ProtectedRoute></AuthProvider>} />
      <Route path="/admin/referrals/terms" element={<AuthProvider><ProtectedRoute requireAdmin><AdminPartnerTerms /></ProtectedRoute></AuthProvider>} />
      {/* Document Requests */}
      <Route path="/admin/document-requests" element={<AuthProvider><ProtectedRoute requireAdmin><AdminDocumentRequests /></ProtectedRoute></AuthProvider>} />

      {/* ============================================ */}
      {/* INFLUENCER PORTAL */}
      {/* ============================================ */}
      <Route path="/influencer/login" element={<InfluencerLogin />} />
      <Route path="/influencer/register" element={<InfluencerRegister />} />
      <Route path="/influencer/reset-password" element={<InfluencerResetPassword />} />
      <Route path="/influencer/onboarding" element={<InfluencerOnboarding />} />
      <Route path="/influencer/terms" element={<InfluencerAuthProvider><InfluencerProtectedRoute><InfluencerTerms /></InfluencerProtectedRoute></InfluencerAuthProvider>} />
      <Route path="/influencer/dashboard" element={<InfluencerAuthProvider><InfluencerProtectedRoute><PartnerTermsAcceptanceGuard><InfluencerDashboard /></PartnerTermsAcceptanceGuard></InfluencerProtectedRoute></InfluencerAuthProvider>} />
      <Route path="/influencer/referrals" element={<InfluencerAuthProvider><InfluencerProtectedRoute><PartnerTermsAcceptanceGuard><InfluencerReferrals /></PartnerTermsAcceptanceGuard></InfluencerProtectedRoute></InfluencerAuthProvider>} />
      <Route path="/influencer/earnings" element={<InfluencerAuthProvider><InfluencerProtectedRoute><PartnerTermsAcceptanceGuard><InfluencerEarnings /></PartnerTermsAcceptanceGuard></InfluencerProtectedRoute></InfluencerAuthProvider>} />
      <Route path="/influencer/cashouts" element={<InfluencerAuthProvider><InfluencerProtectedRoute><PartnerTermsAcceptanceGuard><InfluencerCashouts /></PartnerTermsAcceptanceGuard></InfluencerProtectedRoute></InfluencerAuthProvider>} />
      <Route path="/influencer/settings" element={<InfluencerAuthProvider><InfluencerProtectedRoute><InfluencerSettings /></InfluencerProtectedRoute></InfluencerAuthProvider>} />
      <Route path="/influencer" element={<Navigate to="/influencer/dashboard" replace />} />

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
      {/* CLIENT PORTAL ROUTES - Wrapped with MaintenanceGuard */}
      {/* ============================================ */}
      <Route path="/portal/auth" element={<MaintenanceGuard><ClientAuthProvider><ClientAuth /></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/suspended" element={<MaintenanceGuard><ClientAuthProvider><ClientSuspended /></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/access-blocked" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute allowBlocked><ClientAccessBlocked /></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientDashboard /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/appointments" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientAppointments /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/orders" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientOrders /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/new-order" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientNewOrder /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/order-confirmation" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientOrderConfirmation /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/invoices" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientInvoices /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/monthly-invoices" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientMonthlyInvoices /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/services" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientServices /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/tickets" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientTickets /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/channels" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientChannels /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/internet" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientInternetOrder /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/tv-order" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientTVOrder /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/replacement" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientEquipmentReplacement /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/cancellations" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientCancellations /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/profile" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientProfile /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/payments" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientPayments /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/contracts" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientContracts /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/web-forms" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientWebForms /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      
      {/* New client action routes from email links */}
      <Route path="/portal/upload" element={<MaintenanceGuard><ClientAuthProvider><ClientDocumentUpload /></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/reset-password" element={<MaintenanceGuard><ClientResetPassword /></MaintenanceGuard>} />
      <Route path="/portal/verify" element={<MaintenanceGuard><ClientVerifyEmail /></MaintenanceGuard>} />
      <Route path="/portal/reschedule" element={<MaintenanceGuard><ClientAuthProvider><ClientRescheduleAppointment /></ClientAuthProvider></MaintenanceGuard>} />
      
      {/* Legacy URL redirects for email links */}
      <Route path="/verify" element={<Navigate to="/portal/verify" replace />} />
      <Route path="/reset" element={<Navigate to="/portal/reset-password" replace />} />
      
      {/* ============================================ */}
      {/* CLIENT-TO-PORTAL REDIRECTS (SPA fallback) */}
      {/* ============================================ */}
      <Route path="/client" element={<Navigate to="/portal" replace />} />
      <Route path="/client/new-order" element={<Navigate to="/portal/new-order" replace />} />
      <Route path="/client/internet-order" element={<Navigate to="/portal/internet" replace />} />
      <Route path="/client/tv-order" element={<Navigate to="/portal/tv-order" replace />} />
      <Route path="/client/services" element={<Navigate to="/portal/services" replace />} />
      <Route path="/client/dashboard" element={<Navigate to="/portal" replace />} />
      <Route path="/client/appointments" element={<Navigate to="/portal/appointments" replace />} />
      <Route path="/client/invoices" element={<Navigate to="/portal/invoices" replace />} />
      <Route path="/client/monthly-invoices" element={<Navigate to="/portal/monthly-invoices" replace />} />
      <Route path="/client/tickets" element={<Navigate to="/portal/tickets" replace />} />
      <Route path="/client/channels" element={<Navigate to="/portal/channels" replace />} />
      <Route path="/client/profile" element={<Navigate to="/portal/profile" replace />} />
      <Route path="/client/payments" element={<Navigate to="/portal/payments" replace />} />
      <Route path="/client/contracts" element={<Navigate to="/portal/contracts" replace />} />
      <Route path="/client/orders" element={<Navigate to="/portal/orders" replace />} />
      <Route path="/client/order-confirmation" element={<Navigate to="/portal/order-confirmation" replace />} />
      <Route path="/client/replacement" element={<Navigate to="/portal/replacement" replace />} />
      <Route path="/client/cancellations" element={<Navigate to="/portal/cancellations" replace />} />
      <Route path="/client/auth" element={<Navigate to="/portal/auth" replace />} />
      <Route path="/client/suspended" element={<Navigate to="/portal/suspended" replace />} />
      <Route path="/client/access-blocked" element={<Navigate to="/portal/access-blocked" replace />} />
      <Route path="/client/*" element={<Navigate to="/portal" replace />} />
      
      {/* ============================================ */}
      {/* STAFF PORTAL ROUTES - NO MaintenanceGuard (always accessible) */}
      {/* ============================================ */}
      <Route path="/staff" element={<StaffLogin />} />

      {/* Staff Admin: use the dedicated /admin portal (secret code + full features) */}
      <Route path="/staff/admin" element={<Navigate to="/admin" replace />} />
      <Route path="/staff/admin/*" element={<Navigate to="/admin" replace />} />

      {/* Staff Employee */}
      <Route path="/staff/employee" element={
        <StaffLayout requiredRole="employee">
          <StaffEmployeeDashboard />
        </StaffLayout>
      } />

      {/* Staff Technician */}
      <Route path="/staff/technician" element={
        <StaffLayout requiredRole="technician">
          <StaffTechnicianDashboard />
        </StaffLayout>
      } />

      {/* Staff Employee */}
      <Route path="/staff/employee" element={
        <StaffLayout requiredRole="employee">
          <StaffEmployeeDashboard />
        </StaffLayout>
      } />
      
      {/* Staff Technician */}
      <Route path="/staff/technician" element={
        <StaffLayout requiredRole="technician">
          <StaffTechnicianDashboard />
        </StaffLayout>
      } />
      
      {/* Catch-all 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
