/**
 * CoreAppLayout — Base layout shell for the Nivra Core internal admin application.
 * This will serve as the root layout for all Core screens.
 * 
 * Nivra Core is the central source of truth for:
 * - Pricing, orders, invoices, payments
 * - Account & subscription management
 * - Operational workflows & provisioning
 */
import { ReactNode } from "react";

interface CoreAppLayoutProps {
  children: ReactNode;
}

const CoreAppLayout = ({ children }: CoreAppLayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header placeholder */}
      <header className="sticky top-0 z-50 h-12 border-b border-border bg-background/95 backdrop-blur flex items-center px-4">
        <span className="font-semibold text-sm tracking-tight">Nivra Core</span>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="px-4 py-4">
          {children}
        </div>
      </main>
    </div>
  );
};

export default CoreAppLayout;
