import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AppRoutes from "@/components/AppRoutes";
import ChatbotWidget from "@/components/chatbot/ChatbotWidget";
import { DevOverflowDetector } from "@/components/DevOverflowDetector";
import { AppModeGate, InstallPrompt, NotificationPrompt } from "@/components/pwa";
import LockdownGuard from "@/components/LockdownGuard";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
      refetchOnWindowFocus: false,
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
              <ChatbotWidget />
            </AppModeGate>
          </LockdownGuard>
          <InstallPrompt />
          <NotificationPrompt />
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
