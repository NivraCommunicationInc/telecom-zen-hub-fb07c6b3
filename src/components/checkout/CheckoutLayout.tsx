/**
 * Nivra Telecom Checkout Layout — Bell/Rogers/Telus grade
 * Two-column: form left, sticky summary right
 * Light background #F5F7FA, white cards, corporate blue #0066CC
 */
import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp, ShoppingCart, ShieldCheck, Zap, HeadphonesIcon, FileCheck2 } from "lucide-react";

interface CheckoutLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  isFrench?: boolean;
}

export const CheckoutLayout = ({ children, sidebar, isFrench = true }: CheckoutLayoutProps) => {
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  const trustSignals = isFrench
    ? [
        { icon: FileCheck2, label: "Sans contrat" },
        { icon: ShieldCheck, label: "Sans vérification de crédit" },
        { icon: Zap, label: "Activation rapide" },
        { icon: HeadphonesIcon, label: "Support québécois" },
      ]
    : [
        { icon: FileCheck2, label: "No contract" },
        { icon: ShieldCheck, label: "No credit check" },
        { icon: Zap, label: "Fast activation" },
        { icon: HeadphonesIcon, label: "Quebec-based support" },
      ];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Trust bar — desktop only */}
      <div className="hidden lg:block bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-center gap-8">
          {trustSignals.map((t) => (
            <div key={t.label} className="flex items-center gap-1.5 text-xs text-[#6B7280]">
              <t.icon className="w-4 h-4 text-[#00A651]" />
              <span className="font-medium">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Summary Toggle */}
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-[#E5E7EB] shadow-sm">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-[#1A1A2E]"
          onClick={() => setShowMobileSummary(!showMobileSummary)}
        >
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#0066CC]" />
            <span className="font-semibold text-base">
              {isFrench ? "Sommaire du panier" : "Cart summary"}
            </span>
          </div>
          {showMobileSummary ? (
            <ChevronUp className="w-5 h-5 text-[#6B7280]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#6B7280]" />
          )}
        </button>

        {showMobileSummary && (
          <div className="px-4 pb-4 border-t border-[#E5E7EB] bg-[#F5F7FA] animate-fade-in">
            {sidebar}
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-[#1A1A2E] tracking-tight">
            {isFrench ? "Finaliser votre commande" : "Complete your order"}
          </h1>
          <p className="mt-2 text-sm text-[#6B7280]">
            {isFrench
              ? "Quelques étapes simples pour activer votre service Nivra."
              : "A few simple steps to activate your Nivra service."}
          </p>
        </div>

        {/* Mobile trust bar */}
        <div className="lg:hidden flex flex-wrap gap-x-4 gap-y-2 mb-6">
          {trustSignals.map((t) => (
            <div key={t.label} className="flex items-center gap-1.5 text-[11px] text-[#6B7280]">
              <t.icon className="w-3.5 h-3.5 text-[#00A651]" />
              <span className="font-medium">{t.label}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            {children}
          </div>

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
