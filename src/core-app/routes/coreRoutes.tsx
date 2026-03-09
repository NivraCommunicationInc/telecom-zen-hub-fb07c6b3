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
const AccountsPage = lazy(() => import("@/core-app/pages/AccountsPage"));
const InvoicesPage = lazy(() => import("@/core-app/pages/InvoicesPage"));
const PaymentsPage = lazy(() => import("@/core-app/pages/PaymentsPage"));
const SubscriptionsPage = lazy(() => import("@/core-app/pages/SubscriptionsPage"));
const SubscriptionDetailPage = lazy(() => import("@/core-app/pages/SubscriptionDetailPage"));
const AppointmentsPage = lazy(() => import("@/core-app/pages/AppointmentsPage"));

export const coreRoutes: RouteObject = {
  path: "/core",
  element: <CoreAppLayout />,
  children: [
    { index: true, element: <Navigate to="dashboard" replace /> },
    { path: "dashboard", element: <DashboardPage /> },
    { path: "work-queue", element: <WorkQueuePage /> },
    { path: "orders", element: <OrdersPage /> },
    { path: "accounts", element: <AccountsPage /> },
    { path: "invoices", element: <InvoicesPage /> },
    { path: "payments", element: <PaymentsPage /> },
    { path: "subscriptions", element: <SubscriptionsPage /> },
    { path: "appointments", element: <AppointmentsPage /> },
  ],
};
