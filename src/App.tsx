import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AppRoutes from "@/components/AppRoutes";
import ChatbotWidget from "@/components/chatbot/ChatbotWidget";
import { DevOverflowDetector } from "@/components/DevOverflowDetector";
import { AppModeGate, InstallPrompt, NotificationPrompt, SWUpdateHandler } from "@/components/pwa";
import LockdownGuard from "@/components/LockdownGuard";

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

/**
 * HydrationSignal — fires once on first React paint to swap
 * pre-rendered HTML for the live React tree (zero blank flash).
 */
function HydrationSignal() {
  useEffect(() => {
    document.documentElement.classList.add("app-hydrated");
  }, []);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <HydrationSignal />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {import.meta.env.DEV && <DevOverflowDetector />}
          <LockdownGuard>
            <AppModeGate>
              <AppRoutes />
              <ChatbotWidget />
            </AppModeGate>
          </LockdownGuard>
          <InstallPrompt />
          <NotificationPrompt />
          <SWUpdateHandler />
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
