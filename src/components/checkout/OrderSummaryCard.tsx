/**
 * Rogers-style "Sommaire du panier" (Cart Summary)
 * Collapsible sections: Frais mensuels, Frais uniques
 * "Ce qu'il faut savoir" checklist at bottom
 */
import { Receipt, Calendar, Shield, Info, Check, ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface LineItem {
  label: string;
  amount: number;
  description?: string;
  isMonthly?: boolean;
  isDiscount?: boolean;
  isFree?: boolean;
  strikethroughAmount?: number;
}

interface OrderSummaryCardProps {
  isFrench?: boolean;
  monthlyItems?: LineItem[];
  oneTimeItems?: LineItem[];
  tpsAmount?: number;
  tvqAmount?: number;
  totalDueNow?: number;
  monthlyTotal?: number;
  nextBillingDate?: string;
  billingCycleDay?: number;
  onEditSection?: (section: string) => void;
  showTrustBadges?: boolean;
  className?: string;
  children?: React.ReactNode;
  /** Rogers "Ce qu'il faut savoir" items */
  infoItems?: string[];
}

export const OrderSummaryCard = ({
  isFrench = true,
  monthlyItems = [],
  oneTimeItems = [],
  tpsAmount = 0,
  tvqAmount = 0,
  totalDueNow = 0,
  monthlyTotal = 0,
  nextBillingDate,
  billingCycleDay,
  onEditSection,
  showTrustBadges = true,
  className,
  children,
  infoItems = [],
}: OrderSummaryCardProps) => {
  const [expanded, setExpanded] = useState(true);

  // Calculate monthly subtotal with taxes
  const monthlyTPS = monthlyTotal * 0.05;
  const monthlyTVQ = monthlyTotal * 0.09975;
  const monthlyTotalAfterTax = monthlyTotal + monthlyTPS + monthlyTVQ;

  // Calculate one-time subtotal
  const oneTimeSubtotal = oneTimeItems.reduce((sum, item) => {
    return sum + (item.isDiscount ? -Math.abs(item.amount) : item.amount);
  }, 0);
  const oneTimeTPS = Math.max(0, oneTimeSubtotal) * 0.05;
  const oneTimeTVQ = Math.max(0, oneTimeSubtotal) * 0.09975;
  const oneTimeTotalAfterTax = Math.max(0, oneTimeSubtotal + oneTimeTPS + oneTimeTVQ);

  return (
    <div className={cn("bg-white border border-slate-200 rounded-lg", className)}>
      {/* Header - Rogers style */}
      <button
        className="w-full flex items-center justify-between px-6 py-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-slate-700" />
          <h3 className="text-lg font-bold text-slate-900">
            {isFrench ? "Sommaire du panier" : "Cart summary"}
          </h3>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-500" />
        )}
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          {/* ── Frais mensuels ── */}
          {monthlyItems.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-bold text-slate-900 mb-3">
                {isFrench ? "Frais mensuels" : "Monthly charges"}
              </h4>
              <div className="space-y-2">
                {monthlyItems.map((item, i) => (
                  <div key={i} className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                      <p className="text-sm text-slate-700">{item.label}</p>
                      {item.description && (
                        <p className="text-xs text-slate-500">{item.description}</p>
                      )}
                    </div>
                    <span className={cn(
                      "text-sm text-slate-900 whitespace-nowrap",
                      item.isDiscount && "text-emerald-600"
                    )}>
                      {item.isDiscount && "-"}{item.amount.toFixed(2)} $/{isFrench ? "mois" : "mo"}
                    </span>
                  </div>
                ))}
              </div>

              <Separator className="my-3" />

              <div className="flex justify-between text-sm">
                <span className="text-slate-600">{isFrench ? "Sous-total" : "Subtotal"}</span>
                <span className="text-slate-900">{monthlyTotal.toFixed(2)} $/{isFrench ? "mois" : "mo"}</span>
              </div>

              {/* Tax breakdown */}
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-500">{isFrench ? "TPS/TVH sur le forfait et les options" : "GST/HST"}</span>
                <span className="text-slate-700">{monthlyTPS.toFixed(2)} $/{isFrench ? "mois" : "mo"}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-500">{isFrench ? "TVP/TVQ sur le forfait et les options" : "PST/QST"}</span>
                <span className="text-slate-700">{monthlyTVQ.toFixed(2)} $/{isFrench ? "mois" : "mo"}</span>
              </div>

              {/* Monthly total after taxes - Rogers big number style */}
              <div className="flex justify-between items-baseline mt-4">
                <span className="text-sm font-bold text-slate-900">
                  {isFrench ? "Frais mensuels totaux après taxes" : "Total monthly after taxes"}
                </span>
                <div className="text-right">
                  <span className="text-3xl font-bold text-slate-900">
                    {Math.floor(monthlyTotalAfterTax).toLocaleString("fr-CA")}
                  </span>
                  <span className="text-sm font-bold text-slate-900 align-top">
                    ,{((monthlyTotalAfterTax % 1) * 100).toFixed(0).padStart(2, "0")} $
                  </span>
                  <span className="text-sm text-slate-500 ml-0.5">
                    /{isFrench ? "mois" : "mo"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Frais uniques ── */}
          {oneTimeItems.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-bold text-slate-900 mb-3">
                {isFrench ? "Frais uniques" : "One-time charges"}
              </h4>
              <div className="space-y-2">
                {oneTimeItems.map((item, i) => (
                  <div key={i} className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                      <p className="text-sm text-slate-700">{item.label}</p>
                      {item.description && (
                        <p className="text-xs text-slate-500">{item.description}</p>
                      )}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      {item.strikethroughAmount !== undefined && (
                        <span className="text-xs text-slate-400 line-through mr-1">
                          {item.strikethroughAmount.toFixed(2)} $
                        </span>
                      )}
                      <span className={cn(
                        "text-sm text-slate-900",
                        item.isDiscount && "text-emerald-600",
                        item.isFree && "text-slate-600"
                      )}>
                        {item.isFree ? (isFrench ? "Gratuite" : "Free") : 
                         `${item.isDiscount ? "-" : ""}${item.amount.toFixed(2)} $`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-3" />

              <div className="flex justify-between text-sm">
                <span className="text-slate-600">{isFrench ? "Sous-total" : "Subtotal"}</span>
                <span className="text-slate-900">{Math.max(0, oneTimeSubtotal).toFixed(2)} $</span>
              </div>

              {/* One-time total - Rogers big number */}
              <div className="flex justify-between items-baseline mt-4">
                <span className="text-sm font-bold text-slate-900">
                  {isFrench ? "Total des frais uniques après taxes" : "Total one-time after taxes"}
                </span>
                <div className="text-right">
                  <span className="text-3xl font-bold text-slate-900">
                    {Math.floor(oneTimeTotalAfterTax).toLocaleString("fr-CA")}
                  </span>
                  <span className="text-sm font-bold text-slate-900 align-top">
                    ,{((oneTimeTotalAfterTax % 1) * 100).toFixed(0).padStart(2, "0")} $
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Ce qu'il faut savoir ── */}
          {infoItems.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <h4 className="text-sm font-bold text-slate-900 mb-3">
                {isFrench ? "Ce qu'il faut savoir" : "Good to know"}
              </h4>
              <ul className="space-y-2.5">
                {infoItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check className="w-5 h-5 text-slate-700 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-700 leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Return policy ── */}
          {showTrustBadges && (
            <div className="mt-5 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                {isFrench 
                  ? "Retours sans souci, sans frais dans les 15 jours" 
                  : "Hassle-free returns within 15 days"}
              </p>
            </div>
          )}

          {/* Additional content */}
          {children}
        </div>
      )}
    </div>
  );
};

export default OrderSummaryCard;
