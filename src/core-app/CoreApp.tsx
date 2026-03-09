/**
 * CoreApp — Root component for standalone Core deployment.
 * Own QueryClient, BrowserRouter, Toaster — fully independent of the main site App.tsx.
 */
import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { CORE_BASE, corePath } from "@/core-app/lib/corePaths";
import { Terminal } from "lucide-react";

// Core pages (lazy-loaded)
const CoreAppLayout = lazy(() => import("./CoreAppLayout"));
const CoreProtectedRoute = lazy(() => import("./components/CoreProtectedRoute"));
const CoreLoginPage = lazy(() => import("./pages/CoreLoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const WorkQueuePage = lazy(() => import("./pages/WorkQueuePage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const SubscriptionsPage = lazy(() => import("./pages/SubscriptionsPage"));
const SubscriptionDetailPage = lazy(() => import("./pages/SubscriptionDetailPage"));
const AppointmentsPage = lazy(() => import("./pages/AppointmentsPage"));
const CoreOrderDetail = lazy(() => import("./pages/CoreOrderDetail"));
const CoreAccountDetail = lazy(() => import("./pages/CoreAccountDetail"));
const CoreInvoiceDetail = lazy(() => import("./pages/CoreInvoiceDetail"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 10,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

const CoreLoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,8%)]">
    <div className="flex flex-col items-center gap-4">
      <div className="h-10 w-10 rounded-lg bg-emerald-600 flex items-center justify-center">
        <Terminal className="h-5 w-5 text-white animate-pulse" />
      </div>
      <p className="text-sm text-[hsl(220,10%,50%)]">Chargement de Nivra Core…</p>
    </div>
  </div>
);

/**
 * Route structure mirrors the main app's /core/* routes,
 * but here paths are relative to root (/) since Core IS the root app
 * when deployed standalone on app.nivra-telecom.ca.
 *
 * We use a CORE_BASE_PATH env var to allow the same code to work
 * under both /core (embedded) and / (standalone).
 */
const BASE = import.meta.env.VITE_CORE_BASE_PATH || "/core";

const CoreApp = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <BrowserRouter>
      <Suspense fallback={<CoreLoadingFallback />}>
        <Routes>
          {/* Login — no auth required */}
          <Route path={`${BASE}/login`} element={<CoreLoginPage />} />

          {/* Protected routes */}
          <Route path={BASE} element={<CoreProtectedRoute />}>
            <Route element={<CoreAppLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Suspense fallback={null}><DashboardPage /></Suspense>} />
              <Route path="work-queue" element={<Suspense fallback={null}><WorkQueuePage /></Suspense>} />
              <Route path="orders" element={<Suspense fallback={null}><OrdersPage /></Suspense>} />
              <Route path="orders/:orderId" element={<Suspense fallback={null}><CoreOrderDetail /></Suspense>} />
              <Route path="accounts" element={<Suspense fallback={null}><AccountsPage /></Suspense>} />
              <Route path="accounts/:accountId" element={<Suspense fallback={null}><CoreAccountDetail /></Suspense>} />
              <Route path="invoices" element={<Suspense fallback={null}><InvoicesPage /></Suspense>} />
              <Route path="invoices/:invoiceId" element={<Suspense fallback={null}><CoreInvoiceDetail /></Suspense>} />
              <Route path="payments" element={<Suspense fallback={null}><PaymentsPage /></Suspense>} />
              <Route path="subscriptions" element={<Suspense fallback={null}><SubscriptionsPage /></Suspense>} />
              <Route path="subscriptions/:id" element={<Suspense fallback={null}><SubscriptionDetailPage /></Suspense>} />
              <Route path="appointments" element={<Suspense fallback={null}><AppointmentsPage /></Suspense>} />
            </Route>
          </Route>

          {/* Catch-all → redirect to dashboard */}
          <Route path="*" element={<Navigate to={`${BASE}/dashboard`} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </QueryClientProvider>
);

export default CoreApp;
