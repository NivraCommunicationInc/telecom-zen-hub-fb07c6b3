import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useLocation } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AppRoutes from "@/components/AppRoutes";
import NivraChat from "@/components/chatbot/NivraChat";

/**
 * FIX 4 — Chat widget is restricted to public marketing pages and the client portal.
 * Internal staff portals (Core, Field, Employee, RH, Hub, Marketing back-office)
 * never render the chat widget.
 */
const INTERNAL_ROUTE_PREFIXES = [
  "/core",
  "/field",
  "/employee",
  "/staff",
  "/hr",
  "/rh",
  "/nivra-secure-hub-2617-internal",
  "/admin",
  "/technician",
  "/influencer",
  "/commander",
];

const ChatWidgetGate = () => {
  const { pathname } = useLocation();
  const isInternal = INTERNAL_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (isInternal) return null;
  return <NivraChat />;
};
import CookieConsent from "@/components/CookieConsent";
import { DevOverflowDetector } from "@/components/DevOverflowDetector";
import { AppModeGate, InstallPrompt, NotificationPrompt, SWUpdateHandler } from "@/components/pwa";
import LockdownGuard from "@/components/LockdownGuard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      // Tighter freshness: 30s default so views update naturally between Realtime events
      staleTime: 30 * 1000,
      gcTime: 1000 * 60 * 30, // 30 minutes cache time
      // Refresh stale data on window focus / reconnect — cheap and bounded by staleTime.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // No global polling — realtime + focus/reconnect is enough; pages opt-in to refetchInterval when needed
      refetchInterval: false,
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
          {/* DEV-ONLY: Overflow detector - only active in development */}
          {import.meta.env.DEV && <DevOverflowDetector />}
          {/* SECURITY: Total lockdown guard - blocks entire site when activated */}
          <LockdownGuard>
            {/* AppModeGate wraps routes to block rendering until PWA mode is determined */}
            <AppModeGate>
              <AppRoutes />
              <ChatWidgetGate />
            </AppModeGate>
          </LockdownGuard>
          <InstallPrompt />
          <NotificationPrompt />
          <SWUpdateHandler />
          <CookieConsent />
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
