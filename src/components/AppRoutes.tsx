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

// Field Portal (lazy-loaded, fully isolated)
const FieldAppLayout = lazy(() => import("@/field-app/FieldAppLayout"));

// RH Portal (lazy-loaded, fully isolated)
const RhAppLayout = lazy(() => import("@/rh-app/RhAppLayout"));
const RhProtectedRoute = lazy(() => import("@/rh-app/components/RhProtectedRoute"));
const RhDashboard = lazy(() => import("@/rh-app/pages/RhDashboard"));
const RhPayslips = lazy(() => import("@/rh-app/pages/RhPayslips"));
const RhTaxDocuments = lazy(() => import("@/rh-app/pages/RhTaxDocuments"));
const RhEmploymentLetters = lazy(() => import("@/rh-app/pages/RhEmploymentLetters"));
const RhSchedule = lazy(() => import("@/rh-app/pages/RhSchedule"));
const RhCommissions = lazy(() => import("@/rh-app/pages/RhCommissions"));
const RhNotifications = lazy(() => import("@/rh-app/pages/RhNotifications"));
const RhProfile = lazy(() => import("@/rh-app/pages/RhProfile"));
const RhObjectives = lazy(() => import("@/rh-app/pages/RhObjectives"));
const FieldProtectedRoute = lazy(() => import("@/field-app/components/FieldProtectedRoute"));
const FieldDashboard = lazy(() => import("@/field-app/pages/FieldDashboard"));
const FieldLeads = lazy(() => import("@/field-app/pages/FieldLeads"));
const FieldNewLead = lazy(() => import("@/field-app/pages/FieldNewLead"));
const FieldLeadDetail = lazy(() => import("@/field-app/pages/FieldLeadDetail"));
const FieldOffers = lazy(() => import("@/field-app/pages/FieldOffers"));
const FieldSubmissions = lazy(() => import("@/field-app/pages/FieldSubmissions"));
const FieldOrderDetail = lazy(() => import("@/field-app/pages/FieldOrderDetail"));
const FieldTracking = lazy(() => import("@/field-app/pages/FieldTracking"));
const FieldTerritory = lazy(() => import("@/field-app/pages/FieldTerritory"));
const FieldClients = lazy(() => import("@/field-app/pages/FieldClients"));
const FieldObjectives = lazy(() => import("@/field-app/pages/FieldObjectives"));
const FieldCommissions = lazy(() => import("@/field-app/pages/FieldCommissions"));
const FieldMyPay = lazy(() => import("@/field-app/pages/FieldMyPay"));
const FieldProfile = lazy(() => import("@/field-app/pages/FieldProfile"));
const FieldSecurity = lazy(() => import("@/field-app/pages/FieldSecurity"));
const FieldNewSale = lazy(() => import("@/field-app/pages/FieldNewSale"));
const FieldSaleSuccess = lazy(() => import("@/field-app/pages/FieldSaleSuccess"));
const FieldPerformance = lazy(() => import("@/field-app/pages/FieldPerformance"));
const FieldDailyReport = lazy(() => import("@/field-app/pages/FieldDailyReport"));
const FieldNotifications = lazy(() => import("@/field-app/pages/FieldNotifications"));
const FieldClientLookup = lazy(() => import("@/field-app/pages/FieldClientLookup"));
const FieldResources = lazy(() => import("@/field-app/pages/FieldResources"));
const EmployeeDashboard = lazy(() => import("@/employee-app/pages/EmployeeDashboard"));
const EmployeeWorkQueue = lazy(() => import("@/employee-app/pages/EmployeeWorkQueue"));
const EmployeeOrders = lazy(() => import("@/employee-app/pages/EmployeeOrders"));
const EmployeeOrderDetail = lazy(() => import("@/employee-app/pages/EmployeeOrderDetail"));
const EmployeeCreateOrder = lazy(() => import("@/employee-app/pages/EmployeeCreateOrder"));
const EmployeeClients = lazy(() => import("@/employee-app/pages/EmployeeClients"));
const EmployeeClientDetail = lazy(() => import("@/employee-app/pages/EmployeeClientDetail"));
const EmployeePayments = lazy(() => import("@/employee-app/pages/EmployeePayments"));
const EmployeeKYC = lazy(() => import("@/employee-app/pages/EmployeeKYC"));
const EmployeeActivations = lazy(() => import("@/employee-app/pages/EmployeeActivations"));
const EmployeeSupport = lazy(() => import("@/employee-app/pages/EmployeeSupport"));
const EmployeeSupportDetail = lazy(() => import("@/employee-app/pages/EmployeeSupportDetail"));
const EmployeeAudit = lazy(() => import("@/employee-app/pages/EmployeeAudit"));
const EmployeeProfile = lazy(() => import("@/employee-app/pages/EmployeeProfile"));
const EmployeeSecurity = lazy(() => import("@/employee-app/pages/EmployeeSecurity"));
const EmployeeEquipment = lazy(() => import("@/employee-app/pages/EmployeeEquipment"));
const EmployeeAppointments = lazy(() => import("@/employee-app/pages/EmployeeAppointments"));
const EmployeeAppointmentDetail = lazy(() => import("@/employee-app/pages/EmployeeAppointmentDetail"));
const EmployeeInvoiceDetail = lazy(() => import("@/employee-app/pages/EmployeeInvoiceDetail"));
const EmployeeSubscriptionDetail = lazy(() => import("@/employee-app/pages/EmployeeSubscriptionDetail"));
const EmployeeAccounts = lazy(() => import("@/employee-app/pages/EmployeeAccounts"));
const EmployeeAccountDetail = lazy(() => import("@/employee-app/pages/EmployeeAccountDetail"));
const EmployeeQuotes = lazy(() => import("@/employee-app/pages/EmployeeQuotes"));
const EmployeeCreateQuote = lazy(() => import("@/employee-app/pages/EmployeeCreateQuote"));
const EmployeeQuoteDetail = lazy(() => import("@/employee-app/pages/EmployeeQuoteDetail"));

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
// Field Management
const CoreFieldAgentsPage = lazy(() => import("@/core-app/pages/CoreFieldAgentsPage"));
const CoreCommissionWithdrawalsPage = lazy(() => import("@/core-app/pages/CoreCommissionWithdrawalsPage"));
// Partners
const CoreReferralsPage = lazy(() => import("@/core-app/pages/CoreReferralsPage"));
const CoreReferralRewardsPage = lazy(() => import("@/core-app/pages/CoreReferralRewardsPage"));
const CoreReferralTermsPage = lazy(() => import("@/core-app/pages/CoreReferralTermsPage"));
// Support
const CoreSupportPage = lazy(() => import("@/core-app/pages/CoreSupportPage"));
const CoreInternalTicketsPage = lazy(() => import("@/core-app/pages/CoreInternalTicketsPage"));
const CoreWebFormsPage = lazy(() => import("@/core-app/pages/CoreWebFormsPage"));
const CoreTelephonyPage = lazy(() => import("@/core-app/pages/CoreTelephonyPage"));
// HR & Payroll
const HrDashboardPage = lazy(() => import("@/core-app/pages/hr/HrDashboardPage"));
const HrEmployeesPage = lazy(() => import("@/core-app/pages/hr/HrEmployeesPage"));
const HrCreateEmployeePage = lazy(() => import("@/core-app/pages/hr/HrCreateEmployeePage"));
const HrOnboardingPage = lazy(() => import("@/core-app/pages/hr/HrOnboardingPage"));
const HrPayrollPage = lazy(() => import("@/core-app/pages/hr/HrPayrollPage"));
const HrCommissionsPage = lazy(() => import("@/core-app/pages/hr/HrCommissionsPage"));
const HrTimePage = lazy(() => import("@/core-app/pages/hr/HrTimePage"));
const HrSchedulesPage = lazy(() => import("@/core-app/pages/hr/HrSchedulesPage"));
const HrDocumentsPage = lazy(() => import("@/core-app/pages/hr/HrDocumentsPage"));
const HrTaxDocumentsPage = lazy(() => import("@/core-app/pages/hr/HrTaxDocumentsPage"));
const HrRequestsPage = lazy(() => import("@/core-app/pages/hr/HrRequestsPage"));
const HrAuditPage = lazy(() => import("@/core-app/pages/hr/HrAuditPage"));
const CoreEmployee360 = lazy(() => import("@/core-app/pages/CoreEmployee360"));
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
const CoreQuotesPage = lazy(() => import("@/core-app/pages/CoreQuotesPage"));
const CoreQuoteDetail = lazy(() => import("@/core-app/pages/CoreQuoteDetail"));
const CoreCreateQuote = lazy(() => import("@/core-app/pages/CoreCreateQuote"));

// Public pages (lazy-loaded for code splitting)
const Index = lazy(() => import("@/pages/Index"));
const About = lazy(() => import("@/pages/About"));
const Careers = lazy(() => import("@/pages/Careers"));
const JobApplication = lazy(() => import("@/pages/JobApplication"));
const FAQ = lazy(() => import("@/pages/FAQ"));
const Contact = lazy(() => import("@/pages/Contact"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const TermsOfUse = lazy(() => import("@/pages/TermsOfUse"));
const ServicesDetail = lazy(() => import("@/pages/ServicesDetail"));
const InternetPlans = lazy(() => import("@/pages/InternetPlans"));
const TVPlans = lazy(() => import("@/pages/TVPlans"));
const MobilePlans = lazy(() => import("@/pages/MobilePlans"));
const MobileCoverage = lazy(() => import("@/pages/MobileCoverage"));
const StreamingPlans = lazy(() => import("@/pages/StreamingPlans"));
const DevLogin = lazy(() => import("@/pages/DevLogin"));
const E2eInstallTest = lazy(() => import("@/pages/E2eInstallTest"));
const VerifyIdentity = lazy(() => import("@/pages/VerifyIdentity"));
const NotAuthorized = lazy(() => import("@/pages/NotAuthorized"));
const APropos = lazy(() => import("@/pages/APropos"));
const Aide = lazy(() => import("@/pages/Aide"));
const DynamicPage = lazy(() => import("@/pages/DynamicPage"));
const Contest = lazy(() => import("@/pages/Contest"));
const TrackOrder = lazy(() => import("@/pages/TrackOrder"));
const Parrainage = lazy(() => import("@/pages/Parrainage"));
const StatusPage = lazy(() => import("@/pages/StatusPage"));
const Install = lazy(() => import("@/pages/Install"));
const ComparePlans = lazy(() => import("@/pages/ComparePlans"));
const TVConfigurator = lazy(() => import("@/pages/TVConfigurator"));
const GuestCheckout = lazy(() => import("@/pages/GuestCheckout"));
const PublicQuotePage = lazy(() => import("@/pages/PublicQuote"));
const QuoteCheckoutPage = lazy(() => import("@/pages/QuoteCheckout"));

// Legal pages (lazy-loaded)
const ConditionsDeService = lazy(() => import("@/pages/legal/ConditionsDeService"));
const InstallationRendezvous = lazy(() => import("@/pages/legal/InstallationRendezvous"));
const ModalitesPaiement = lazy(() => import("@/pages/legal/ModalitesPaiement"));
const EquipementGarantie = lazy(() => import("@/pages/legal/EquipementGarantie"));
const SupportEtPlaintes = lazy(() => import("@/pages/legal/SupportEtPlaintes"));
const ConfidentialiteLoi25 = lazy(() => import("@/pages/legal/ConfidentialiteLoi25"));
const FraisPossibles = lazy(() => import("@/pages/legal/FraisPossibles"));
const RefundPolicy = lazy(() => import("@/pages/legal/RefundPolicy"));
const PrivacyPolicyPage = lazy(() => import("@/pages/legal/PrivacyPolicyPage"));
const TermsAndConditions = lazy(() => import("@/pages/legal/TermsAndConditions"));

// Admin pages (lazy-loaded)
const AdminLogin = lazy(() => import("@/pages/admin/AdminLogin"));
const AdminBootstrap = lazy(() => import("@/pages/admin/AdminBootstrap"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminOrders = lazy(() => import("@/pages/admin/AdminOrders"));
const AdminOrderDetail = lazy(() => import("@/pages/admin/AdminOrderDetail"));
const AdminQueues = lazy(() => import("@/pages/admin/AdminQueues"));
const AdminClients = lazy(() => import("@/pages/admin/AdminClients"));
const AdminServices = lazy(() => import("@/pages/admin/AdminServices"));
const AdminBilling = lazy(() => import("@/pages/admin/AdminBilling"));
const BillingV2Playbook = lazy(() => import("@/pages/admin/BillingV2Playbook"));
const AdminRequests = lazy(() => import("@/pages/admin/AdminRequests"));
const AdminContracts = lazy(() => import("@/pages/admin/AdminContracts"));
const AdminActivityLogs = lazy(() => import("@/pages/admin/AdminActivityLogs"));
const AdminAppointments = lazy(() => import("@/pages/admin/AdminAppointments"));
const AdminCareers = lazy(() => import("@/pages/admin/AdminCareers"));
const AdminApplications = lazy(() => import("@/pages/admin/AdminApplications"));
const AdminTickets = lazy(() => import("@/pages/admin/AdminTickets"));
const AdminChannels = lazy(() => import("@/pages/admin/AdminChannels"));
const AdminTechnicians = lazy(() => import("@/pages/admin/AdminTechnicians"));
const AdminReplacements = lazy(() => import("@/pages/admin/AdminReplacements"));
const AdminCancellations = lazy(() => import("@/pages/admin/AdminCancellations"));
const AdminEmployees = lazy(() => import("@/pages/admin/AdminEmployees"));
const AdminPromotions = lazy(() => import("@/pages/admin/AdminPromotions"));
const AdminAccounts = lazy(() => import("@/pages/admin/AdminAccounts"));
const AdminStreaming = lazy(() => import("@/pages/admin/AdminStreaming"));
const AdminStreamingCatalog = lazy(() => import("@/pages/admin/AdminStreamingCatalog"));
const AdminSystemStatus = lazy(() => import("@/pages/admin/AdminSystemStatus"));
const AdminSystemHealth = lazy(() => import("@/pages/admin/AdminSystemHealth"));
const AdminInternalTickets = lazy(() => import("@/pages/admin/AdminInternalTickets"));
const AdminEmailActivity = lazy(() => import("@/pages/admin/AdminEmailActivity"));
const AdminEmailDeliverability = lazy(() => import("@/pages/admin/AdminEmailDeliverability"));
const AdminAccount = lazy(() => import("@/pages/admin/AdminAccount"));
const AdminAccountProfile = lazy(() => import("@/pages/admin/AdminAccountProfile"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminUsersAccess = lazy(() => import("@/pages/admin/AdminUsersAccess"));
const AdminAuditLog = lazy(() => import("@/pages/admin/AdminAuditLog"));
const AdminResetPassword = lazy(() => import("@/pages/admin/AdminResetPassword"));
const AdminChangeCredentials = lazy(() => import("@/pages/admin/AdminChangeCredentials"));
const AdminPDFTemplatesV2 = lazy(() => import("@/pages/admin/AdminPDFTemplatesV2"));
const AdminQA = lazy(() => import("@/pages/admin/AdminQA"));
const AdminSystemAudit = lazy(() => import("@/pages/admin/AdminSystemAudit"));
const AdminRecouvrement = lazy(() => import("@/pages/admin/AdminRecouvrement"));
const AdminPaymentDisputes = lazy(() => import("@/pages/admin/AdminPaymentDisputes"));
const AdminPayments = lazy(() => import("@/pages/admin/AdminPayments"));
const AdminInvoices = lazy(() => import("@/pages/admin/AdminInvoices"));
const AdminInvoiceDetail = lazy(() => import("@/pages/admin/AdminInvoiceDetail"));
const AdminPaymentsV2 = lazy(() => import("@/pages/admin/AdminPaymentsV2"));
const AdminSite = lazy(() => import("@/pages/admin/AdminSite"));
const AdminSecurityEvents = lazy(() => import("@/pages/admin/AdminSecurityEvents"));
const AdminMaintenance = lazy(() => import("@/pages/admin/AdminMaintenance"));
const AdminSecurityGuardian = lazy(() => import("@/pages/admin/AdminSecurityGuardian"));
const AdminContests = lazy(() => import("@/pages/admin/AdminContests"));
const AdminWebForms = lazy(() => import("@/pages/admin/AdminWebForms"));
const AdminTelephony = lazy(() => import("@/pages/admin/AdminTelephony"));
const AdminMarketing = lazy(() => import("@/pages/admin/AdminMarketing"));
const AdminCommunicationEmail = lazy(() => import("@/pages/admin/AdminCommunicationEmail"));
const AdminCommunicationSMS = lazy(() => import("@/pages/admin/AdminCommunicationSMS"));
const AdminReferrals = lazy(() => import("@/pages/admin/AdminReferrals"));
const AdminReferralInfluencers = lazy(() => import("@/pages/admin/AdminReferralInfluencers"));
const AdminReferralInfluencerDetail = lazy(() => import("@/pages/admin/AdminReferralInfluencerDetail"));
const AdminReferralCodes = lazy(() => import("@/pages/admin/AdminReferralCodes"));
const AdminReferralAttributions = lazy(() => import("@/pages/admin/AdminReferralAttributions"));
const AdminReferralCommissions = lazy(() => import("@/pages/admin/AdminReferralCommissions"));
const AdminReferralCashouts = lazy(() => import("@/pages/admin/AdminReferralCashouts"));
const AdminReferralSettings = lazy(() => import("@/pages/admin/AdminReferralSettings"));
const AdminPartnerTerms = lazy(() => import("@/pages/admin/AdminPartnerTerms"));
const LiveActivityPage = lazy(() => import("@/pages/admin/LiveActivityPage"));
const AdminDocumentRequests = lazy(() => import("@/pages/admin/AdminDocumentRequests"));
const AdminContestedInvoices = lazy(() => import("@/pages/admin/AdminContestedInvoices"));
const AdminContestedPayments = lazy(() => import("@/pages/admin/AdminContestedPayments"));
const AdminWorkQueue = lazy(() => import("@/pages/admin/AdminWorkQueue"));
const AdminSubscriptions = lazy(() => import("@/pages/admin/AdminSubscriptions"));
const AdminSubscriptionDetail = lazy(() => import("@/pages/admin/AdminSubscriptionDetail"));
const AdminNotificationsSettings = lazy(() => import("@/pages/admin/AdminNotificationsSettings"));
const AdminNotifications = lazy(() => import("@/pages/admin/AdminNotifications"));
const AdminPOS = lazy(() => import("@/pages/admin/AdminPOS"));
const AdminIdentityVerification = lazy(() => import("@/pages/admin/AdminIdentityVerification"));
const AdminKYCVerifications = lazy(() => import("@/pages/admin/AdminKYCVerifications"));
import ProtectedRoute from "@/components/admin/ProtectedRoute";

// Influencer Portal (lazy-loaded)
const InfluencerLogin = lazy(() => import("@/pages/influencer/InfluencerLogin"));
const InfluencerOnboarding = lazy(() => import("@/pages/influencer/InfluencerOnboarding"));
const InfluencerRegister = lazy(() => import("@/pages/influencer/InfluencerRegister"));
const InfluencerResetPassword = lazy(() => import("@/pages/influencer/InfluencerResetPassword"));
const InfluencerDashboard = lazy(() => import("@/pages/influencer/InfluencerDashboard"));
const InfluencerReferrals = lazy(() => import("@/pages/influencer/InfluencerReferrals"));
const InfluencerEarnings = lazy(() => import("@/pages/influencer/InfluencerEarnings"));
const InfluencerCashouts = lazy(() => import("@/pages/influencer/InfluencerCashouts"));
const InfluencerSettings = lazy(() => import("@/pages/influencer/InfluencerSettings"));
const InfluencerTerms = lazy(() => import("@/pages/influencer/InfluencerTerms"));
import { InfluencerAuthProvider } from "@/hooks/useInfluencerAuth";
const InfluencerProtectedRoute = lazy(() => import("@/components/influencer/InfluencerProtectedRoute"));
const PartnerTermsAcceptanceGuard = lazy(() => import("@/components/influencer/PartnerTermsAcceptanceGuard"));

// Client portal pages (lazy-loaded)
const ClientAuth = lazy(() => import("@/pages/client/ClientAuth"));
const ClientSuspended = lazy(() => import("@/pages/client/ClientSuspended"));
const ClientDashboard = lazy(() => import("@/pages/client/ClientDashboard"));
const ClientAppointments = lazy(() => import("@/pages/client/ClientAppointments"));
const ClientInvoices = lazy(() => import("@/pages/client/ClientInvoices"));
const ClientTickets = lazy(() => import("@/pages/client/ClientTickets"));
const ClientServices = lazy(() => import("@/pages/client/ClientServices"));
const ClientProfile = lazy(() => import("@/pages/client/ClientProfile"));
const ClientPayments = lazy(() => import("@/pages/client/ClientPayments"));
const ClientBillingHub = lazy(() => import("@/pages/client/ClientBillingHub"));
const ClientOrders = lazy(() => import("@/pages/client/ClientOrders"));
const ClientContracts = lazy(() => import("@/pages/client/ClientContracts"));
const ClientNewOrder = lazy(() => import("@/pages/client/ClientNewOrder"));
const ClientOrderConfirmation = lazy(() => import("@/pages/client/ClientOrderConfirmation"));
const ClientChannels = lazy(() => import("@/pages/client/ClientChannels"));
const ClientEquipmentReplacement = lazy(() => import("@/pages/client/ClientEquipmentReplacement"));
const ClientCancellations = lazy(() => import("@/pages/client/ClientCancellations"));
const ClientAccessBlocked = lazy(() => import("@/pages/client/ClientAccessBlocked"));
const ClientMonthlyInvoices = lazy(() => import("@/pages/client/ClientMonthlyInvoices"));
const ClientWebForms = lazy(() => import("@/pages/client/ClientWebForms"));
const ClientDocumentUpload = lazy(() => import("@/pages/client/ClientDocumentUpload"));
const ClientDocuments = lazy(() => import("@/pages/client/ClientDocuments"));
const ClientIdentityVerification = lazy(() => import("@/pages/client/ClientIdentityVerification"));
const ClientResetPassword = lazy(() => import("@/pages/client/ClientResetPassword"));
const ClientServiceAddresses = lazy(() => import("@/pages/client/ClientServiceAddresses"));
const ClientVerifyEmail = lazy(() => import("@/pages/client/ClientVerifyEmail"));
const ClientRescheduleAppointment = lazy(() => import("@/pages/client/ClientRescheduleAppointment"));
const PaymentReturn = lazy(() => import("@/pages/client/PaymentReturn"));
const PaymentCancelled = lazy(() => import("@/pages/client/PaymentCancelled"));
import ClientProtectedRoute from "@/components/client/ClientProtectedRoute";
import ClientSecurityCheck from "@/components/client/ClientSecurityCheck";
const ClientReferrals = lazy(() => import("@/pages/client/ClientReferrals"));

// Staff portal pages (lazy-loaded)
const StaffLogin = lazy(() => import("@/pages/staff/StaffLogin"));
const StaffOnboarding = lazy(() => import("@/pages/staff/StaffOnboarding"));
const StaffAdminDashboard = lazy(() => import("@/pages/staff/StaffAdminDashboard"));
const StaffEmployeeDashboard = lazy(() => import("@/pages/staff/StaffEmployeeDashboard"));
const StaffTechnicianDashboard = lazy(() => import("@/pages/staff/StaffTechnicianDashboard"));
const StaffClients = lazy(() => import("@/pages/staff/StaffClients"));
const StaffClientDetail = lazy(() => import("@/pages/staff/StaffClientDetail"));
const StaffOrders = lazy(() => import("@/pages/staff/StaffOrders"));
const StaffOrderDetail = lazy(() => import("@/pages/staff/StaffOrderDetail"));
const StaffTickets = lazy(() => import("@/pages/staff/StaffTickets"));
const StaffTicketDetail = lazy(() => import("@/pages/staff/StaffTicketDetail"));
const StaffAppointments = lazy(() => import("@/pages/staff/StaffAppointments"));
const StaffAppointmentDetail = lazy(() => import("@/pages/staff/StaffAppointmentDetail"));
const StaffBilling = lazy(() => import("@/pages/staff/StaffBilling"));
const StaffBillingDetail = lazy(() => import("@/pages/staff/StaffBillingDetail"));
const StaffStreaming = lazy(() => import("@/pages/staff/StaffStreaming"));
const StaffTvChannels = lazy(() => import("@/pages/staff/StaffTvChannels"));
const StaffNotes = lazy(() => import("@/pages/staff/StaffNotes"));
const StaffAccount = lazy(() => import("@/pages/staff/StaffAccount"));
const StaffPOS = lazy(() => import("@/pages/staff/StaffPOS"));
const StaffNotifications = lazy(() => import("@/pages/staff/StaffNotifications"));
const TechnicianPOS = lazy(() => import("@/pages/staff/TechnicianPOS"));
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

// Global Suspense fallback for lazy routes
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      <p className="text-sm text-muted-foreground">Chargement...</p>
    </div>
  </div>
);

const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoader />}>
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
      <Route path="/commander" element={<MaintenanceGuard><Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}><GuestCheckout /></Suspense></MaintenanceGuard>} />
      <Route path="/install" element={<Install />} />
      {/* DEV-ONLY: Routes stripped from production builds */}
      {!import.meta.env.PROD && <Route path="/dev-login" element={<DevLogin />} />}
      {!import.meta.env.PROD && <Route path="/e2e-install-test" element={<E2eInstallTest />} />}
      
      {/* Identity verification - QR code scan from mobile */}
      <Route path="/verify-id" element={<VerifyIdentity />} />
      
      {/* Public Quote View (no login required) */}
      <Route path="/quote" element={<MaintenanceGuard><Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}><PublicQuotePage /></Suspense></MaintenanceGuard>} />
      <Route path="/quote-checkout" element={<MaintenanceGuard><Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}><QuoteCheckoutPage /></Suspense></MaintenanceGuard>} />
      
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
      {/* Core login removed — all access through /hub */}
      <Route path="/core/login" element={<Navigate to="/hub" replace />} />

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
          {/* Quotes */}
          <Route path="quotes" element={<Suspense fallback={null}><CoreQuotesPage /></Suspense>} />
          <Route path="quotes/new" element={<Suspense fallback={null}><CoreCreateQuote /></Suspense>} />
          <Route path="quotes/:quoteId" element={<Suspense fallback={null}><CoreQuoteDetail /></Suspense>} />
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
          {/* Field Management */}
          <Route path="field-agents" element={<Suspense fallback={null}><CoreFieldAgentsPage /></Suspense>} />
          <Route path="commission-withdrawals" element={<Suspense fallback={null}><CoreCommissionWithdrawalsPage /></Suspense>} />
          {/* Partners */}
          <Route path="referrals" element={<Suspense fallback={null}><CoreReferralsPage /></Suspense>} />
          <Route path="referral-rewards" element={<Suspense fallback={null}><CoreReferralRewardsPage /></Suspense>} />
          <Route path="referral-terms" element={<Suspense fallback={null}><CoreReferralTermsPage /></Suspense>} />
          {/* Support */}
          <Route path="support" element={<Suspense fallback={null}><CoreSupportPage /></Suspense>} />
          <Route path="internal-tickets" element={<Suspense fallback={null}><CoreInternalTicketsPage /></Suspense>} />
          <Route path="web-forms" element={<Suspense fallback={null}><CoreWebFormsPage /></Suspense>} />
          <Route path="telephony" element={<Suspense fallback={null}><CoreTelephonyPage /></Suspense>} />
          {/* HR & Payroll */}
          <Route path="hr" element={<Suspense fallback={null}><HrDashboardPage /></Suspense>} />
          <Route path="hr/employees" element={<Suspense fallback={null}><HrEmployeesPage /></Suspense>} />
          <Route path="hr/employees/new" element={<Suspense fallback={null}><HrCreateEmployeePage /></Suspense>} />
          <Route path="hr/employees/:id" element={<Suspense fallback={null}><CoreEmployee360 /></Suspense>} />
          <Route path="hr/onboarding" element={<Suspense fallback={null}><HrOnboardingPage /></Suspense>} />
          <Route path="hr/payroll" element={<Suspense fallback={null}><HrPayrollPage /></Suspense>} />
          <Route path="hr/commissions" element={<Suspense fallback={null}><HrCommissionsPage /></Suspense>} />
          <Route path="hr/time" element={<Suspense fallback={null}><HrTimePage /></Suspense>} />
          <Route path="hr/schedules" element={<Suspense fallback={null}><HrSchedulesPage /></Suspense>} />
          <Route path="hr/documents" element={<Suspense fallback={null}><HrDocumentsPage /></Suspense>} />
          <Route path="hr/tax-documents" element={<Suspense fallback={null}><HrTaxDocumentsPage /></Suspense>} />
          <Route path="hr/requests" element={<Suspense fallback={null}><HrRequestsPage /></Suspense>} />
          <Route path="hr/careers" element={<Suspense fallback={null}><CoreCareersPage /></Suspense>} />
          <Route path="hr/applications" element={<Suspense fallback={null}><CoreApplicationsPage /></Suspense>} />
          <Route path="hr/audit" element={<Suspense fallback={null}><HrAuditPage /></Suspense>} />
          {/* Legacy HR routes */}
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
      <Route path="/hub" element={<Suspense fallback={<div className="min-h-screen bg-white" />}><HubPage /></Suspense>} />
      <Route path="/hub/login" element={<Suspense fallback={<div className="min-h-screen bg-white" />}><HubLoginPage /></Suspense>} />

      {/* ============================================ */}
      {/* EMPLOYEE PORTAL — Operational Workspace       */}
      {/* ============================================ */}
      <Route path="/employee" element={<Suspense fallback={<div className="min-h-screen bg-white" />}><EmployeeProtectedRoute /></Suspense>}>
        <Route element={<Suspense fallback={null}><EmployeeAppLayout /></Suspense>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Suspense fallback={null}><EmployeeDashboard /></Suspense>} />
          <Route path="work-queue" element={<Suspense fallback={null}><EmployeeWorkQueue /></Suspense>} />
          <Route path="orders" element={<Suspense fallback={null}><EmployeeOrders /></Suspense>} />
          <Route path="orders/new" element={<Suspense fallback={null}><EmployeeCreateOrder /></Suspense>} />
          <Route path="orders/:orderId" element={<Suspense fallback={null}><EmployeeOrderDetail /></Suspense>} />
          <Route path="clients" element={<Suspense fallback={null}><EmployeeClients /></Suspense>} />
          <Route path="clients/:clientId" element={<Suspense fallback={null}><EmployeeClientDetail /></Suspense>} />
          <Route path="accounts" element={<Suspense fallback={null}><EmployeeAccounts /></Suspense>} />
          <Route path="accounts/:accountId" element={<Suspense fallback={null}><EmployeeAccountDetail /></Suspense>} />
          <Route path="payments" element={<Suspense fallback={null}><EmployeePayments /></Suspense>} />
          <Route path="kyc" element={<Suspense fallback={null}><EmployeeKYC /></Suspense>} />
          <Route path="activations" element={<Suspense fallback={null}><EmployeeActivations /></Suspense>} />
          <Route path="appointments" element={<Suspense fallback={null}><EmployeeAppointments /></Suspense>} />
          <Route path="appointments/:appointmentId" element={<Suspense fallback={null}><EmployeeAppointmentDetail /></Suspense>} />
          <Route path="invoices/:invoiceId" element={<Suspense fallback={null}><EmployeeInvoiceDetail /></Suspense>} />
          <Route path="subscriptions/:subscriptionId" element={<Suspense fallback={null}><EmployeeSubscriptionDetail /></Suspense>} />
          <Route path="support" element={<Suspense fallback={null}><EmployeeSupport /></Suspense>} />
          <Route path="support/:ticketId" element={<Suspense fallback={null}><EmployeeSupportDetail /></Suspense>} />
          <Route path="equipment" element={<Suspense fallback={null}><EmployeeEquipment /></Suspense>} />
          <Route path="audit" element={<Suspense fallback={null}><EmployeeAudit /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={null}><EmployeeProfile /></Suspense>} />
          <Route path="security" element={<Suspense fallback={null}><EmployeeSecurity /></Suspense>} />
          <Route path="quotes" element={<Suspense fallback={null}><EmployeeQuotes /></Suspense>} />
          <Route path="quotes/new" element={<Suspense fallback={null}><EmployeeCreateQuote /></Suspense>} />
          <Route path="quotes/:quoteId" element={<Suspense fallback={null}><EmployeeQuoteDetail /></Suspense>} />
        </Route>
      </Route>

      {/* ============================================ */}
      {/* FIELD PORTAL — Field Sales Workspace          */}
      {/* ============================================ */}
      <Route path="/field" element={<Suspense fallback={<div className="min-h-screen bg-white" />}><FieldProtectedRoute /></Suspense>}>
        <Route element={<Suspense fallback={null}><FieldAppLayout /></Suspense>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Suspense fallback={null}><FieldDashboard /></Suspense>} />
          <Route path="sale/new" element={<Suspense fallback={null}><FieldNewSale /></Suspense>} />
          <Route path="sale/success" element={<Suspense fallback={null}><FieldSaleSuccess /></Suspense>} />
          <Route path="leads" element={<Suspense fallback={null}><FieldLeads /></Suspense>} />
          <Route path="leads/new" element={<Suspense fallback={null}><FieldNewLead /></Suspense>} />
          <Route path="leads/:leadId" element={<Suspense fallback={null}><FieldLeadDetail /></Suspense>} />
          <Route path="offers" element={<Suspense fallback={null}><FieldOffers /></Suspense>} />
          <Route path="submissions" element={<Suspense fallback={null}><FieldSubmissions /></Suspense>} />
          <Route path="orders/:orderId" element={<Suspense fallback={null}><FieldOrderDetail /></Suspense>} />
          <Route path="tracking" element={<Suspense fallback={null}><FieldTracking /></Suspense>} />
          <Route path="commissions" element={<Suspense fallback={null}><FieldCommissions /></Suspense>} />
          <Route path="my-pay" element={<Suspense fallback={null}><FieldMyPay /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={null}><FieldProfile /></Suspense>} />
          <Route path="security" element={<Suspense fallback={null}><FieldSecurity /></Suspense>} />
          <Route path="performance" element={<Suspense fallback={null}><FieldPerformance /></Suspense>} />
          <Route path="daily-report" element={<Suspense fallback={null}><FieldDailyReport /></Suspense>} />
          <Route path="notifications" element={<Suspense fallback={null}><FieldNotifications /></Suspense>} />
          <Route path="address-lookup" element={<Suspense fallback={null}><FieldClientLookup /></Suspense>} />
          <Route path="territory" element={<Suspense fallback={null}><FieldTerritory /></Suspense>} />
          <Route path="clients" element={<Suspense fallback={null}><FieldClients /></Suspense>} />
          <Route path="objectives" element={<Suspense fallback={null}><FieldObjectives /></Suspense>} />
          <Route path="resources" element={<Suspense fallback={null}><FieldResources /></Suspense>} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Route>

      {/* ============================================ */}
      {/* NIVRA RH — Employee HR Portal                 */}
      {/* ============================================ */}
      <Route path="/rh" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><RhProtectedRoute /></Suspense>}>
        <Route element={<Suspense fallback={null}><RhAppLayout /></Suspense>}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Suspense fallback={null}><RhDashboard /></Suspense>} />
          <Route path="paie" element={<Suspense fallback={null}><RhPayslips /></Suspense>} />
          <Route path="documents-fiscaux" element={<Suspense fallback={null}><RhTaxDocuments /></Suspense>} />
          <Route path="lettres" element={<Suspense fallback={null}><RhEmploymentLetters /></Suspense>} />
          <Route path="horaire" element={<Suspense fallback={null}><RhSchedule /></Suspense>} />
          <Route path="commissions" element={<Suspense fallback={null}><RhCommissions /></Suspense>} />
          <Route path="notifications" element={<Suspense fallback={null}><RhNotifications /></Suspense>} />
          <Route path="profil" element={<Suspense fallback={null}><RhProfile /></Suspense>} />
          <Route path="objectifs" element={<Suspense fallback={null}><RhObjectives /></Suspense>} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Route>
      </Route>

      {/* Catch-all redirect (no visible 404 page) */}
      <Route path="*" element={<Navigate to="/hub" replace />} />
    </Routes>
    </Suspense>
  );
};

export default AppRoutes;
