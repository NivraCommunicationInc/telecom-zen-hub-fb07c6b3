import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ClientAuthProvider } from "@/hooks/useClientAuth";
import MaintenanceGuard from "@/components/MaintenanceGuard";
import { PublicLayout } from "@/components/PublicLayout";
import { lazy, Suspense } from "react";

// Hub pages
const HubPage = lazy(() => import("@/pages/hub/HubPage"));
const HubLoginPage = lazy(() => import("@/pages/hub/HubLoginPage"));
const HubProtectedRoute = lazy(() => import("@/components/hub/HubProtectedRoute"));

// Employee Portal (lazy-loaded, fully isolated)
const EmployeeAppLayout = lazy(() => import("@/employee-app/EmployeeAppLayout"));
const EmployeeProtectedRoute = lazy(() => import("@/employee-app/components/EmployeeProtectedRoute"));
const EmployeeDashboard = lazy(() => import("@/employee-app/pages/EmployeeDashboard"));
const EmployeeWorkQueue = lazy(() => import("@/employee-app/pages/EmployeeWorkQueue"));
const EmployeeOrders = lazy(() => import("@/employee-app/pages/EmployeeOrders"));
const EmployeeOrderDetail = lazy(() => import("@/employee-app/pages/EmployeeOrderDetail"));
const EmployeeClients = lazy(() => import("@/employee-app/pages/EmployeeClients"));
const EmployeeClientDetail = lazy(() => import("@/employee-app/pages/EmployeeClientDetail"));
const EmployeePayments = lazy(() => import("@/employee-app/pages/EmployeePayments"));
const EmployeeKYC = lazy(() => import("@/employee-app/pages/EmployeeKYC"));
const EmployeeActivations = lazy(() => import("@/employee-app/pages/EmployeeActivations"));
const EmployeeSupport = lazy(() => import("@/employee-app/pages/EmployeeSupport"));
const EmployeeAudit = lazy(() => import("@/employee-app/pages/EmployeeAudit"));
const EmployeeProfile = lazy(() => import("@/employee-app/pages/EmployeeProfile"));
const EmployeeSecurity = lazy(() => import("@/employee-app/pages/EmployeeSecurity"));

// Nivra Core internal app (lazy-loaded, fully isolated)
const CoreAppLayout = lazy(() => import("@/core-app/CoreAppLayout"));
const CoreProtectedRoute = lazy(() => import("@/core-app/components/CoreProtectedRoute"));
const CoreLoginPage = lazy(() => import("@/core-app/pages/CoreLoginPage"));
// Dashboard
const CoreDashboard = lazy(() => import("@/core-app/pages/DashboardPage"));
const CoreActivityPage = lazy(() => import("@/core-app/pages/CoreActivityPage"));
const CoreLiveActivityPage = lazy(() => import("@/core-app/pages/CoreLiveActivityPage"));
const CoreSystemStatusPage = lazy(() => import("@/core-app/pages/CoreSystemStatusPage"));
// Operations
const CoreWorkQueue = lazy(() => import("@/core-app/pages/WorkQueuePage"));
const CoreOrders = lazy(() => import("@/core-app/pages/OrdersPage"));
const CoreOrderDetail = lazy(() => import("@/core-app/pages/CoreOrderDetail"));
const CorePOSPage = lazy(() => import("@/core-app/pages/CorePOSPage"));
const CoreKYCPage = lazy(() => import("@/core-app/pages/CoreKYCPage"));
const CoreAppointments = lazy(() => import("@/core-app/pages/AppointmentsPage"));
const CoreAppointmentDetail = lazy(() => import("@/core-app/pages/CoreAppointmentDetail"));
const CoreRequestsPage = lazy(() => import("@/core-app/pages/CoreRequestsPage"));
const CoreActivationsPage = lazy(() => import("@/core-app/pages/CoreActivationsPage"));
// Clients
const CoreClients = lazy(() => import("@/core-app/pages/ClientsPage"));
const CoreClientProfile = lazy(() => import("@/core-app/pages/CoreClientProfile"));
const CoreAccounts = lazy(() => import("@/core-app/pages/AccountsPage"));
const CoreAccountDetail = lazy(() => import("@/core-app/pages/CoreAccountDetail"));
const CoreDocumentsPage = lazy(() => import("@/core-app/pages/CoreDocumentsPage"));
// Billing
const CoreBillingPage = lazy(() => import("@/core-app/pages/CoreBillingPage"));
const CoreInvoices = lazy(() => import("@/core-app/pages/InvoicesPage"));
const CoreInvoiceDetail = lazy(() => import("@/core-app/pages/CoreInvoiceDetail"));
const CorePayments = lazy(() => import("@/core-app/pages/PaymentsPage"));
const CoreTransactionsPage = lazy(() => import("@/core-app/pages/CoreTransactionsPage"));
const CoreSubscriptions = lazy(() => import("@/core-app/pages/SubscriptionsPage"));
const CoreSubscriptionDetail = lazy(() => import("@/core-app/pages/SubscriptionDetailPage"));
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
import DevLogin from "@/pages/DevLogin";
import E2eInstallTest from "@/pages/E2eInstallTest";
import VerifyIdentity from "@/pages/VerifyIdentity";
import NotAuthorized from "@/pages/NotAuthorized";
import APropos from "@/pages/APropos";
import Aide from "@/pages/Aide";
import DynamicPage from "@/pages/DynamicPage";
import Contest from "@/pages/Contest";
import TrackOrder from "@/pages/TrackOrder";
import Parrainage from "@/pages/Parrainage";
import StatusPage from "@/pages/StatusPage";
import Install from "@/pages/Install";
import ComparePlans from "@/pages/ComparePlans";
import TVConfigurator from "@/pages/TVConfigurator";

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
import AdminOrderDetail from "@/pages/admin/AdminOrderDetail";
import AdminQueues from "@/pages/admin/AdminQueues";
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
import AdminSystemHealth from "@/pages/admin/AdminSystemHealth";
import AdminInternalTickets from "@/pages/admin/AdminInternalTickets";
import AdminEmailActivity from "@/pages/admin/AdminEmailActivity";
import AdminEmailDeliverability from "@/pages/admin/AdminEmailDeliverability";
import AdminAccount from "@/pages/admin/AdminAccount";
import AdminAccountProfile from "@/pages/admin/AdminAccountProfile";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminUsersAccess from "@/pages/admin/AdminUsersAccess";
import AdminAuditLog from "@/pages/admin/AdminAuditLog";
import AdminResetPassword from "@/pages/admin/AdminResetPassword";
import AdminChangeCredentials from "@/pages/admin/AdminChangeCredentials";
import AdminPDFTemplatesV2 from "@/pages/admin/AdminPDFTemplatesV2";
import AdminQA from "@/pages/admin/AdminQA";
import AdminSystemAudit from "@/pages/admin/AdminSystemAudit";
import AdminRecouvrement from "@/pages/admin/AdminRecouvrement";
import AdminPaymentDisputes from "@/pages/admin/AdminPaymentDisputes";
import AdminPayments from "@/pages/admin/AdminPayments";
import AdminInvoices from "@/pages/admin/AdminInvoices";
import AdminInvoiceDetail from "@/pages/admin/AdminInvoiceDetail";
import AdminPaymentsV2 from "@/pages/admin/AdminPaymentsV2";
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
import AdminContestedInvoices from "@/pages/admin/AdminContestedInvoices";
import AdminContestedPayments from "@/pages/admin/AdminContestedPayments";
import AdminWorkQueue from "@/pages/admin/AdminWorkQueue";
import AdminSubscriptions from "@/pages/admin/AdminSubscriptions";
import AdminSubscriptionDetail from "@/pages/admin/AdminSubscriptionDetail";
import AdminNotificationsSettings from "@/pages/admin/AdminNotificationsSettings";
import AdminNotifications from "@/pages/admin/AdminNotifications";
import AdminPOS from "@/pages/admin/AdminPOS";
import AdminIdentityVerification from "@/pages/admin/AdminIdentityVerification";
import AdminKYCVerifications from "@/pages/admin/AdminKYCVerifications";
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
import ClientBillingHub from "@/pages/client/ClientBillingHub";
import ClientOrders from "@/pages/client/ClientOrders";
import ClientContracts from "@/pages/client/ClientContracts";
import ClientNewOrder from "@/pages/client/ClientNewOrder";
import ClientOrderConfirmation from "@/pages/client/ClientOrderConfirmation";
import ClientChannels from "@/pages/client/ClientChannels";
import ClientEquipmentReplacement from "@/pages/client/ClientEquipmentReplacement";
import ClientCancellations from "@/pages/client/ClientCancellations";
import ClientAccessBlocked from "@/pages/client/ClientAccessBlocked";
import ClientMonthlyInvoices from "@/pages/client/ClientMonthlyInvoices";
import ClientWebForms from "@/pages/client/ClientWebForms";
import ClientDocumentUpload from "@/pages/client/ClientDocumentUpload";
import ClientDocuments from "@/pages/client/ClientDocuments";
import ClientIdentityVerification from "@/pages/client/ClientIdentityVerification";
import ClientResetPassword from "@/pages/client/ClientResetPassword";
import ClientServiceAddresses from "@/pages/client/ClientServiceAddresses";
import ClientVerifyEmail from "@/pages/client/ClientVerifyEmail";
import ClientRescheduleAppointment from "@/pages/client/ClientRescheduleAppointment";
import PaymentReturn from "@/pages/client/PaymentReturn";
import PaymentCancelled from "@/pages/client/PaymentCancelled";
import ClientProtectedRoute from "@/components/client/ClientProtectedRoute";
import ClientSecurityCheck from "@/components/client/ClientSecurityCheck";
import ClientReferrals from "@/pages/client/ClientReferrals";

// Staff portal pages
import StaffLogin from "@/pages/staff/StaffLogin";
import StaffOnboarding from "@/pages/staff/StaffOnboarding";
import StaffAdminDashboard from "@/pages/staff/StaffAdminDashboard";
import StaffEmployeeDashboard from "@/pages/staff/StaffEmployeeDashboard";
import StaffTechnicianDashboard from "@/pages/staff/StaffTechnicianDashboard";
import StaffClients from "@/pages/staff/StaffClients";
import StaffClientDetail from "@/pages/staff/StaffClientDetail";
import StaffOrders from "@/pages/staff/StaffOrders";
import StaffOrderDetail from "@/pages/staff/StaffOrderDetail";
import StaffTickets from "@/pages/staff/StaffTickets";
import StaffTicketDetail from "@/pages/staff/StaffTicketDetail";
import StaffAppointments from "@/pages/staff/StaffAppointments";
import StaffAppointmentDetail from "@/pages/staff/StaffAppointmentDetail";
import StaffBilling from "@/pages/staff/StaffBilling";
import StaffBillingDetail from "@/pages/staff/StaffBillingDetail";
import StaffStreaming from "@/pages/staff/StaffStreaming";
import StaffTvChannels from "@/pages/staff/StaffTvChannels";
import StaffNotes from "@/pages/staff/StaffNotes";
import StaffAccount from "@/pages/staff/StaffAccount";
import StaffPOS from "@/pages/staff/StaffPOS";
import StaffNotifications from "@/pages/staff/StaffNotifications";
import TechnicianPOS from "@/pages/staff/TechnicianPOS";
import StaffLayout from "@/components/staff/StaffLayout";
import StaffAdminLayout from "@/components/staff/StaffAdminLayout";
import { StaffProtectedRoute } from "@/components/staff/StaffProtectedRoute";

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
const AdminProtectedOutlet = () => (
  <AuthProvider>
    <ProtectedRoute requireAdmin>
      <Outlet />
    </ProtectedRoute>
  </AuthProvider>
);

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
      <Route path="/compare" element={<MaintenanceGuard><PublicLayout><ComparePlans /></PublicLayout></MaintenanceGuard>} />
      <Route path="/television-sur-mesure" element={<MaintenanceGuard><PublicLayout><TVConfigurator /></PublicLayout></MaintenanceGuard>} />
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
      <Route path="/parrainage" element={<MaintenanceGuard><PublicLayout><Parrainage /></PublicLayout></MaintenanceGuard>} />
      <Route path="/status" element={<PublicLayout><StatusPage /></PublicLayout>} />
      <Route path="/install" element={<Install />} />
      {/* DEV-ONLY: Routes stripped from production builds */}
      {!import.meta.env.PROD && <Route path="/dev-login" element={<DevLogin />} />}
      {!import.meta.env.PROD && <Route path="/e2e-install-test" element={<E2eInstallTest />} />}
      
      {/* Identity verification - QR code scan from mobile */}
      <Route path="/verify-id" element={<VerifyIdentity />} />
      
      {/* Dynamic pages from site_pages */}
      <Route path="/page/:slug" element={<MaintenanceGuard><PublicLayout><DynamicPage /></PublicLayout></MaintenanceGuard>} />

      {/* ============================================ */}
      {/* ADMIN ROUTES - NO MaintenanceGuard (always accessible) */}
      {/* ============================================ */}
      <Route path="/admin/login" element={<AuthProvider><AdminLogin /></AuthProvider>} />
      <Route path="/admin/reset-password" element={<AuthProvider><AdminResetPassword /></AuthProvider>} />
      <Route path="/admin/bootstrap" element={<AuthProvider><AdminBootstrap /></AuthProvider>} />

      <Route path="/admin" element={<AdminProtectedOutlet />}>
        <Route index element={<AdminDashboard />} />
        <Route path="change-credentials" element={<AdminChangeCredentials />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<AdminOrderDetail />} />
        <Route path="queues" element={<AdminQueues />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="billing" element={<AdminBilling />} />
        <Route path="requests" element={<AdminRequests />} />
        <Route path="billing-playbook" element={<BillingV2Playbook />} />
        <Route path="contracts" element={<AdminContracts />} />
        <Route path="activity" element={<AdminActivityLogs />} />
        <Route path="appointments" element={<AdminAppointments />} />
        <Route path="careers" element={<AdminCareers />} />
        <Route path="applications" element={<AdminApplications />} />
        <Route path="tickets" element={<AdminTickets />} />
        <Route path="channels" element={<AdminChannels />} />
        <Route path="technicians" element={<AdminTechnicians />} />
        <Route path="replacements" element={<AdminReplacements />} />
        <Route path="cancellations" element={<AdminCancellations />} />
        <Route path="employees" element={<AdminEmployees />} />
        <Route path="promotions" element={<AdminPromotions />} />
        <Route path="accounts" element={<AdminAccounts />} />
        <Route path="accounts/:accountId" element={<AdminAccountProfile />} />
        <Route path="recouvrement" element={<AdminRecouvrement />} />
        <Route path="streaming" element={<AdminStreaming />} />
        <Route path="streaming-catalog" element={<AdminStreamingCatalog />} />
        <Route path="system-status" element={<AdminSystemStatus />} />
        <Route path="internal-tickets" element={<AdminInternalTickets />} />
        <Route path="email-activity" element={<AdminEmailActivity />} />
        <Route path="email-deliverability" element={<AdminEmailDeliverability />} />
        <Route path="account" element={<AdminAccount />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users-access" element={<AdminUsersAccess />} />
        <Route path="live-activity" element={<LiveActivityPage />} />
        <Route path="audit-log" element={<AdminAuditLog />} />
        <Route path="pdf-templates-v2" element={<AdminPDFTemplatesV2 />} />
        <Route path="qa" element={<AdminQA />} />
        <Route path="payment-disputes" element={<AdminPaymentDisputes />} />
        <Route path="contested-invoices" element={<AdminContestedInvoices />} />
        <Route path="contested-payments" element={<AdminContestedPayments />} />
        <Route path="site" element={<AdminSite />} />
        <Route path="security-events" element={<AdminSecurityEvents />} />
        <Route path="maintenance" element={<AdminMaintenance />} />
        <Route path="security-guardian" element={<AdminSecurityGuardian />} />
        <Route path="concours" element={<AdminContests />} />
        <Route path="formulaire-web" element={<AdminWebForms />} />
        <Route path="telephony" element={<AdminTelephony />} />
        <Route path="marketing" element={<AdminMarketing />} />
        <Route path="communication-email" element={<AdminCommunicationEmail />} />
        <Route path="communication-sms" element={<AdminCommunicationSMS />} />

        {/* Admin Referral Program */}
        <Route path="referrals" element={<AdminReferrals />} />
        <Route path="referrals/influencers" element={<AdminReferralInfluencers />} />
        <Route path="referrals/influencers/:id" element={<AdminReferralInfluencerDetail />} />
        <Route path="referrals/codes" element={<AdminReferralCodes />} />
        <Route path="referrals/attributions" element={<AdminReferralAttributions />} />
        <Route path="referrals/parrainages" element={<Navigate to="/admin/referrals/attributions" replace />} />
        <Route path="referrals/commissions" element={<AdminReferralCommissions />} />
        <Route path="referrals/cashouts" element={<AdminReferralCashouts />} />
        <Route path="referrals/settings" element={<AdminReferralSettings />} />
        <Route path="referrals/terms" element={<AdminPartnerTerms />} />

        {/* Document Requests */}
        <Route path="document-requests" element={<AdminDocumentRequests />} />

        {/* Notifications */}
        <Route path="notifications-settings" element={<AdminNotificationsSettings />} />
        <Route path="notifications" element={<AdminNotifications />} />

        {/* Field Sales Admin - Redirect to POS */}
        <Route path="field-sales" element={<Navigate to="/admin/pos" replace />} />
        <Route path="pos" element={<AdminPOS />} />
        <Route path="payments" element={<AdminPaymentsV2 />} />
        <Route path="payments/legacy" element={<Navigate to="/admin/payments" replace />} />
        <Route path="invoices" element={<AdminInvoices />} />
        <Route path="invoices/:invoiceId" element={<AdminInvoiceDetail />} />
        <Route path="work-queue" element={<AdminWorkQueue />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        <Route path="subscriptions/:subscriptionId" element={<AdminSubscriptionDetail />} />

        {/* Identity Verification Admin */}
        <Route path="identity-verification" element={<AdminIdentityVerification />} />
        <Route path="kyc-verifications" element={<AdminKYCVerifications />} />

        {/* System Audit - READ-ONLY */}
        <Route path="system-audit" element={<AdminSystemAudit />} />
        
        {/* System Health - Carrier-grade monitoring */}
        <Route path="system-health" element={<AdminSystemHealth />} />
      </Route>

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
      
      {/* LEGACY STAFF ROUTES */}
      <Route path="/technician/*" element={<Navigate to="/staff" replace />} />
      <Route path="/technician" element={<Navigate to="/staff" replace />} />
      <Route path="/portal/login" element={<Navigate to="/portal/auth" replace />} />
      
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
      <Route path="/portal/checkout" element={<Navigate to="/portal/new-order" replace />} />
      <Route path="/portal/order-confirmation" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientOrderConfirmation /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/invoices" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientInvoices /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/monthly-invoices" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientMonthlyInvoices /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/services" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientServices /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/my-services" element={<Navigate to="/portal/services" replace />} />
      <Route path="/portal/tickets" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientTickets /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/channels" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientChannels /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/internet" element={<Navigate to="/portal/new-order" replace />} />
      <Route path="/portal/tv-order" element={<Navigate to="/portal/new-order" replace />} />
      <Route path="/portal/replacement" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientEquipmentReplacement /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/cancellations" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientCancellations /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/profile" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientProfile /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/payments" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientPayments /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/billing" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientBillingHub /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/contracts" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientContracts /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/web-forms" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientWebForms /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/documents" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientDocuments /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/identity-verification" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientIdentityVerification /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/service-addresses" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientServiceAddresses /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/referrals" element={<MaintenanceGuard><ClientAuthProvider><ClientProtectedRoute><ClientSecurityCheck><ClientReferrals /></ClientSecurityCheck></ClientProtectedRoute></ClientAuthProvider></MaintenanceGuard>} />
      
      {/* New client action routes from email links */}
      <Route path="/portal/upload" element={<MaintenanceGuard><ClientAuthProvider><ClientDocumentUpload /></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/reset-password" element={<MaintenanceGuard><ClientResetPassword /></MaintenanceGuard>} />
      <Route path="/portal/verify" element={<MaintenanceGuard><ClientVerifyEmail /></MaintenanceGuard>} />
      <Route path="/portal/reschedule" element={<MaintenanceGuard><ClientAuthProvider><ClientRescheduleAppointment /></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/payment-success" element={<MaintenanceGuard><ClientAuthProvider><PaymentReturn /></ClientAuthProvider></MaintenanceGuard>} />
      <Route path="/portal/payment-cancelled" element={<MaintenanceGuard><ClientAuthProvider><PaymentCancelled /></ClientAuthProvider></MaintenanceGuard>} />
      
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
      <Route path="/staff/setup" element={<StaffOnboarding />} />

      {/* Staff Admin: use the dedicated /admin portal (secret code + full features) */}
      <Route path="/staff/admin" element={<Navigate to="/admin" replace />} />
      <Route path="/staff/admin/*" element={<Navigate to="/admin" replace />} />

      {/* Staff Dashboard - redirect based on role */}
      <Route path="/staff/dashboard" element={
        <StaffLayout requiredRole="employee">
          <StaffEmployeeDashboard />
        </StaffLayout>
      } />

      {/* Staff Clients */}
      <Route path="/staff/clients" element={<StaffLayout requiredRole="employee"><StaffClients /></StaffLayout>} />
      <Route path="/staff/clients/:id" element={<StaffLayout requiredRole="employee"><StaffClientDetail /></StaffLayout>} />

      {/* Staff Orders */}
      <Route path="/staff/orders" element={<StaffLayout requiredRole="employee"><StaffOrders /></StaffLayout>} />
      <Route path="/staff/orders/:id" element={<StaffLayout requiredRole="employee"><StaffOrderDetail /></StaffLayout>} />

      {/* Staff Tickets */}
      <Route path="/staff/tickets" element={<StaffLayout requiredRole="employee"><StaffTickets /></StaffLayout>} />
      <Route path="/staff/tickets/:id" element={<StaffLayout requiredRole="employee"><StaffTicketDetail /></StaffLayout>} />

      {/* Staff Appointments */}
      <Route path="/staff/appointments" element={<StaffLayout requiredRole="employee"><StaffAppointments /></StaffLayout>} />
      <Route path="/staff/appointments/:id" element={<StaffLayout requiredRole="employee"><StaffAppointmentDetail /></StaffLayout>} />

      {/* Staff Billing */}
      <Route path="/staff/billing" element={<StaffLayout requiredRole="employee"><StaffBilling /></StaffLayout>} />
      <Route path="/staff/billing/:id" element={<StaffLayout requiredRole="employee"><StaffBillingDetail /></StaffLayout>} />

      {/* Staff TV & Streaming */}
      <Route path="/staff/tv-channels" element={<StaffLayout requiredRole="employee"><StaffTvChannels /></StaffLayout>} />
      <Route path="/staff/streaming" element={<StaffLayout requiredRole="employee"><StaffStreaming /></StaffLayout>} />

      {/* Staff Notes, Notifications & Account */}
      <Route path="/staff/notes" element={<StaffLayout requiredRole="employee"><StaffNotes /></StaffLayout>} />
      <Route path="/staff/notifications" element={<StaffLayout requiredRole="employee"><StaffNotifications /></StaffLayout>} />
      <Route path="/staff/account" element={<StaffLayout requiredRole="employee"><StaffAccount /></StaffLayout>} />

      {/* Staff POS */}
      <Route path="/staff/pos" element={<StaffLayout requiredRole="employee"><StaffPOS /></StaffLayout>} />

      {/* Technician POS */}
      <Route path="/staff/technician/pos" element={<StaffLayout requiredRole="technician"><TechnicianPOS /></StaffLayout>} />

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

      {/* Field Sales Portal - Redirect to Admin POS */}
      <Route path="/field-sales/*" element={<Navigate to="/admin/pos" replace />} />

      {/* ============================================ */}
      {/* NIVRA CORE — Internal Operations App        */}
      {/* ============================================ */}
      {/* Partner aliases (prevents 404 when base-path env differs) */}
      <Route path="/referrals" element={<Navigate to="/core/referrals" replace />} />
      <Route path="/referral-rewards" element={<Navigate to="/core/referral-rewards" replace />} />
      <Route path="/referral-terms" element={<Navigate to="/core/referral-terms" replace />} />
      {/* Public: Core login (no auth required) */}
      <Route path="/core/login" element={<Suspense fallback={<div className="min-h-screen bg-[hsl(220,20%,8%)]" />}><CoreLoginPage /></Suspense>} />

      {/* Protected: All /core/* routes behind auth gate */}
      <Route path="/core" element={<Suspense fallback={<div className="min-h-screen bg-[hsl(220,20%,8%)]" />}><CoreProtectedRoute /></Suspense>}>
        <Route element={<CoreAppLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          {/* Dashboard */}
          <Route path="dashboard" element={<Suspense fallback={null}><CoreDashboard /></Suspense>} />
          <Route path="activity" element={<Suspense fallback={null}><CoreActivityPage /></Suspense>} />
          <Route path="live-activity" element={<Suspense fallback={null}><CoreLiveActivityPage /></Suspense>} />
          <Route path="system-status" element={<Suspense fallback={null}><CoreSystemStatusPage /></Suspense>} />
          {/* Operations */}
          <Route path="work-queue" element={<Suspense fallback={null}><CoreWorkQueue /></Suspense>} />
          <Route path="orders" element={<Suspense fallback={null}><CoreOrders /></Suspense>} />
          <Route path="orders/:orderId" element={<Suspense fallback={null}><CoreOrderDetail /></Suspense>} />
          <Route path="pos" element={<Suspense fallback={null}><CorePOSPage /></Suspense>} />
          <Route path="kyc" element={<Suspense fallback={null}><CoreKYCPage /></Suspense>} />
          <Route path="appointments" element={<Suspense fallback={null}><CoreAppointments /></Suspense>} />
          <Route path="appointments/:id" element={<Suspense fallback={null}><CoreAppointmentDetail /></Suspense>} />
          <Route path="requests" element={<Suspense fallback={null}><CoreRequestsPage /></Suspense>} />
          <Route path="activations" element={<Suspense fallback={null}><CoreActivationsPage /></Suspense>} />
          {/* Clients */}
          <Route path="clients" element={<Suspense fallback={null}><CoreClients /></Suspense>} />
          <Route path="clients/:clientId" element={<Suspense fallback={null}><CoreClientProfile /></Suspense>} />
          <Route path="accounts" element={<Suspense fallback={null}><CoreAccounts /></Suspense>} />
          <Route path="accounts/:accountId" element={<Suspense fallback={null}><CoreAccountDetail /></Suspense>} />
          <Route path="documents" element={<Suspense fallback={null}><CoreDocumentsPage /></Suspense>} />
          {/* Billing */}
          <Route path="billing" element={<Suspense fallback={null}><CoreBillingPage /></Suspense>} />
          <Route path="invoices" element={<Suspense fallback={null}><CoreInvoices /></Suspense>} />
          <Route path="invoices/:invoiceId" element={<Suspense fallback={null}><CoreInvoiceDetail /></Suspense>} />
          <Route path="payments" element={<Suspense fallback={null}><CorePayments /></Suspense>} />
          <Route path="transactions" element={<Suspense fallback={null}><CoreTransactionsPage /></Suspense>} />
          <Route path="subscriptions" element={<Suspense fallback={null}><CoreSubscriptions /></Suspense>} />
          <Route path="subscriptions/:id" element={<Suspense fallback={null}><CoreSubscriptionDetail /></Suspense>} />
          <Route path="pdf-templates" element={<Suspense fallback={null}><CorePDFTemplatesPage /></Suspense>} />
          <Route path="recouvrement" element={<Suspense fallback={null}><CoreRecouvrementPage /></Suspense>} />
          <Route path="contested-payments" element={<Suspense fallback={null}><CoreContestedPaymentsPage /></Suspense>} />
          <Route path="contested-invoices" element={<Suspense fallback={null}><CoreContestedInvoicesPage /></Suspense>} />
          {/* Catalogue */}
          <Route path="services" element={<Suspense fallback={null}><CoreServicesPage /></Suspense>} />
          <Route path="catalog" element={<Suspense fallback={null}><CoreCatalogPage /></Suspense>} />
          <Route path="tv-sur-mesure" element={<Suspense fallback={null}><CoreTVSurMesurePage /></Suspense>} />
          <Route path="channels" element={<Suspense fallback={null}><CoreChannelsPage /></Suspense>} />
          <Route path="streaming" element={<Suspense fallback={null}><CoreStreamingPage /></Suspense>} />
          <Route path="contracts" element={<Suspense fallback={null}><CoreContractsPage /></Suspense>} />
          {/* Marketing */}
          <Route path="promotions" element={<Suspense fallback={null}><CorePromotionsPage /></Suspense>} />
          <Route path="contests" element={<Suspense fallback={null}><CoreContestsPage /></Suspense>} />
          <Route path="email-marketing" element={<Suspense fallback={null}><CoreEmailMarketingPage /></Suspense>} />
          <Route path="communication-email" element={<Suspense fallback={null}><CoreCommunicationEmailPage /></Suspense>} />
          <Route path="communication-sms" element={<Suspense fallback={null}><CoreCommunicationSMSPage /></Suspense>} />
          {/* Partners */}
          <Route path="referrals" element={<Suspense fallback={null}><CoreReferralsPage /></Suspense>} />
          <Route path="referral-rewards" element={<Suspense fallback={null}><CoreReferralRewardsPage /></Suspense>} />
          <Route path="referral-terms" element={<Suspense fallback={null}><CoreReferralTermsPage /></Suspense>} />
          {/* Support */}
          <Route path="support" element={<Suspense fallback={null}><CoreSupportPage /></Suspense>} />
          <Route path="internal-tickets" element={<Suspense fallback={null}><CoreInternalTicketsPage /></Suspense>} />
          <Route path="web-forms" element={<Suspense fallback={null}><CoreWebFormsPage /></Suspense>} />
          <Route path="telephony" element={<Suspense fallback={null}><CoreTelephonyPage /></Suspense>} />
          {/* HR */}
          <Route path="careers" element={<Suspense fallback={null}><CoreCareersPage /></Suspense>} />
          <Route path="applications" element={<Suspense fallback={null}><CoreApplicationsPage /></Suspense>} />
          {/* System */}
          <Route path="notifications" element={<Suspense fallback={null}><CoreNotificationsPage /></Suspense>} />
          <Route path="maintenance" element={<Suspense fallback={null}><CoreMaintenancePage /></Suspense>} />
          <Route path="email-activity" element={<Suspense fallback={null}><CoreEmailActivityPage /></Suspense>} />
          <Route path="site-settings" element={<Suspense fallback={null}><CoreSiteSettingsPage /></Suspense>} />
          <Route path="users-access" element={<Suspense fallback={null}><CoreUsersAccessPage /></Suspense>} />
          <Route path="audit-log" element={<Suspense fallback={null}><CoreAuditLogPage /></Suspense>} />
          <Route path="security-events" element={<Suspense fallback={null}><CoreSecurityEventsPage /></Suspense>} />
          <Route path="security-guardian" element={<Suspense fallback={null}><CoreSecurityGuardianPage /></Suspense>} />
          <Route path="system-audit" element={<Suspense fallback={null}><CoreSystemAuditPage /></Suspense>} />
          <Route path="staff" element={<Suspense fallback={null}><CoreStaffPage /></Suspense>} />
          <Route path="my-account" element={<Suspense fallback={null}><CoreMyAccountPage /></Suspense>} />
          <Route path="settings" element={<Suspense fallback={null}><CoreSettingsPage /></Suspense>} />
          <Route path="stock" element={<Suspense fallback={null}><CoreStockPage /></Suspense>} />
        </Route>
      </Route>

      {/* ============================================ */}
      {/* INTERNAL HUB — Secure Staff Gateway          */}
      {/* ============================================ */}
      <Route path="/hub/login" element={<Suspense fallback={<div className="min-h-screen bg-[hsl(220,20%,6%)]" />}><HubLoginPage /></Suspense>} />
      <Route path="/hub" element={<Suspense fallback={<div className="min-h-screen bg-[hsl(220,20%,6%)]" />}><HubProtectedRoute /></Suspense>}>
        <Route index element={<Suspense fallback={null}><HubPage /></Suspense>} />
      </Route>

      {/* ============================================ */}
      {/* EMPLOYEE PORTAL — Operational Workspace       */}
      {/* ============================================ */}
      <Route path="/employee" element={<Suspense fallback={<div className="min-h-screen bg-[hsl(220,20%,6%)]" />}><EmployeeProtectedRoute /></Suspense>}>
        <Route element={<Suspense fallback={null}><EmployeeAppLayout /></Suspense>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Suspense fallback={null}><EmployeeDashboard /></Suspense>} />
          <Route path="work-queue" element={<Suspense fallback={null}><EmployeeWorkQueue /></Suspense>} />
          <Route path="orders" element={<Suspense fallback={null}><EmployeeOrders /></Suspense>} />
          <Route path="orders/:orderId" element={<Suspense fallback={null}><EmployeeOrderDetail /></Suspense>} />
          <Route path="clients" element={<Suspense fallback={null}><EmployeeClients /></Suspense>} />
          <Route path="clients/:clientId" element={<Suspense fallback={null}><EmployeeClientDetail /></Suspense>} />
          <Route path="payments" element={<Suspense fallback={null}><EmployeePayments /></Suspense>} />
          <Route path="kyc" element={<Suspense fallback={null}><EmployeeKYC /></Suspense>} />
          <Route path="activations" element={<Suspense fallback={null}><EmployeeActivations /></Suspense>} />
          <Route path="support" element={<Suspense fallback={null}><EmployeeSupport /></Suspense>} />
          <Route path="audit" element={<Suspense fallback={null}><EmployeeAudit /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={null}><EmployeeProfile /></Suspense>} />
          <Route path="security" element={<Suspense fallback={null}><EmployeeSecurity /></Suspense>} />
        </Route>
      </Route>

      {/* Catch-all 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
