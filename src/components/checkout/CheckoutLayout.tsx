import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CheckoutLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  isFrench?: boolean;
}

export const CheckoutLayout = ({ children, sidebar, isFrench = true }: CheckoutLayoutProps) => {
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Summary Toggle */}
      <div className="lg:hidden sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border p-4">
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => setShowMobileSummary(!showMobileSummary)}
        >
          <span className="font-medium">
            {isFrench ? "Afficher le résumé" : "Show summary"}
          </span>
          {showMobileSummary ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </Button>
        
        {showMobileSummary && (
          <div className="mt-4 animate-fade-in">
            {sidebar}
          </div>
        )}
      </div>

      {/* Desktop Two-Column Layout */}
      <div className="container max-w-7xl mx-auto px-4 py-6 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column - Form/Steps */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {children}
          </div>
          
          {/* Right Column - Order Summary (Desktop) */}
          <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
            <div className="sticky top-6">
              {sidebar}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutLayout;
