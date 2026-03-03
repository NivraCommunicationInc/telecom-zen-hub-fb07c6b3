/**
 * Rogers-style Checkout Layout
 * Two-column: form left, sticky summary right
 * Clean white background, minimal borders
 */
import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";

interface CheckoutLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  isFrench?: boolean;
}

export const CheckoutLayout = ({ children, sidebar, isFrench = true }: CheckoutLayoutProps) => {
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Summary Toggle - Rogers style */}
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-slate-900"
          onClick={() => setShowMobileSummary(!showMobileSummary)}
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-slate-600" />
            <span className="font-semibold text-base">
              {isFrench ? "Sommaire du panier" : "Cart summary"}
            </span>
          </div>
          {showMobileSummary ? (
            <ChevronUp className="w-5 h-5 text-slate-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-500" />
          )}
        </button>
        
        {showMobileSummary && (
          <div className="px-4 pb-4 border-t border-slate-100 bg-slate-50 animate-fade-in">
            {sidebar}
          </div>
        )}
      </div>

      {/* Desktop Two-Column Layout - Rogers style */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        {/* Page Title - Rogers "Caisse" */}
        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-8">
          {isFrench ? "Caisse" : "Checkout"}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column - Form/Steps */}
          <div className="lg:col-span-7 xl:col-span-8">
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
