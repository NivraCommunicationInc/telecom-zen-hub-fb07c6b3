/**
 * coreRoutes — Route definition for the Nivra Core internal app.
 * Import this into the main router when ready to mount at /core.
 */
import { Navigate, type RouteObject } from "react-router-dom";
import { lazy } from "react";

const CoreAppLayout = lazy(() => import("@/core-app/CoreAppLayout"));
const DashboardPage = lazy(() => import("@/core-app/pages/DashboardPage"));
const WorkQueuePage = lazy(() => import("@/core-app/pages/WorkQueuePage"));
const OrdersPage = lazy(() => import("@/core-app/pages/OrdersPage"));
const CoreOrderDetail = lazy(() => import("@/core-app/pages/CoreOrderDetail"));
const AccountsPage = lazy(() => import("@/core-app/pages/AccountsPage"));
const ClientsPage = lazy(() => import("@/core-app/pages/ClientsPage"));
const CoreClientProfile = lazy(() => import("@/core-app/pages/CoreClientProfile"));
const CoreAccountDetail = lazy(() => import("@/core-app/pages/CoreAccountDetail"));
const InvoicesPage = lazy(() => import("@/core-app/pages/InvoicesPage"));
const CoreInvoiceDetail = lazy(() => import("@/core-app/pages/CoreInvoiceDetail"));
const PaymentsPage = lazy(() => import("@/core-app/pages/PaymentsPage"));
const SubscriptionsPage = lazy(() => import("@/core-app/pages/SubscriptionsPage"));
const SubscriptionDetailPage = lazy(() => import("@/core-app/pages/SubscriptionDetailPage"));
const AppointmentsPage = lazy(() => import("@/core-app/pages/AppointmentsPage"));
const CorePOSPage = lazy(() => import("@/core-app/pages/CorePOSPage"));
const EquipmentInventoryPage = lazy(() => import("@/core-app/pages/EquipmentInventoryPage"));
const CoreKYCPage = lazy(() => import("@/core-app/pages/CoreKYCPage"));
const CoreSettingsPage = lazy(() => import("@/core-app/pages/CoreSettingsPage"));
const CoreStaffPage = lazy(() => import("@/core-app/pages/CoreStaffPage"));
const CoreChannelsPage = lazy(() => import("@/core-app/pages/CoreChannelsPage"));
const CoreStockPage = lazy(() => import("@/core-app/pages/CoreStockPage"));
const CoreSupportPage = lazy(() => import("@/core-app/pages/CoreSupportPage"));
const CorePromotionsPage = lazy(() => import("@/core-app/pages/CorePromotionsPage"));

export const coreRoutes: RouteObject = {
  path: "/core",
  element: <CoreAppLayout />,
  children: [
    { index: true, element: <Navigate to="dashboard" replace /> },
    { path: "dashboard", element: <DashboardPage /> },
    { path: "work-queue", element: <WorkQueuePage /> },
    { path: "orders", element: <OrdersPage /> },
    { path: "orders/:orderId", element: <CoreOrderDetail /> },
    { path: "accounts", element: <AccountsPage /> },
    { path: "accounts/:accountId", element: <CoreAccountDetail /> },
    { path: "clients", element: <ClientsPage /> },
    { path: "clients/:clientId", element: <CoreClientProfile /> },
    { path: "invoices", element: <InvoicesPage /> },
    { path: "invoices/:invoiceId", element: <CoreInvoiceDetail /> },
    { path: "payments", element: <PaymentsPage /> },
    { path: "subscriptions", element: <SubscriptionsPage /> },
    { path: "subscriptions/:id", element: <SubscriptionDetailPage /> },
    { path: "appointments", element: <AppointmentsPage /> },
    { path: "pos", element: <CorePOSPage /> },
    { path: "equipment", element: <EquipmentInventoryPage /> },
    { path: "kyc", element: <CoreKYCPage /> },
    { path: "settings", element: <CoreSettingsPage /> },
    { path: "staff", element: <CoreStaffPage /> },
    { path: "channels", element: <CoreChannelsPage /> },
    { path: "stock", element: <CoreStockPage /> },
    { path: "support", element: <CoreSupportPage /> },
    { path: "promotions", element: <CorePromotionsPage /> },
  ],
};
