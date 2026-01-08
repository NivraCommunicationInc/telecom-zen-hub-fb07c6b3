import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AppRoutes from "@/components/AppRoutes";
import ChatbotWidget from "@/components/chatbot/ChatbotWidget";
import { DevOverflowDetector } from "@/components/DevOverflowDetector";
import { DevOverflowAudit } from "@/components/DevOverflowAudit";

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
          {/* DEV-ONLY: Full 12-check audit UI - only with ?dev_overflow_audit=1 */}
          {import.meta.env.DEV && <DevOverflowAudit />}
          <AppRoutes />
          <ChatbotWidget />
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
