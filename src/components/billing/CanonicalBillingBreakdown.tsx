/**
 * CanonicalBillingBreakdown — SINGLE reusable 3-section billing display
 * 
 * Section A: Recurring monthly services (what the customer pays every month)
 * Section B: One-time fees (activation, equipment, delivery, installation)
 * Section C: First payment / Today (one-time + first month - discounts + taxes)
 * 
 * All values come from the canonical pricing_snapshot. Zero client-side math.
 */
import { Separator } from "@/components/ui/separator";
import { 
  Receipt, Zap, CreditCard, Calendar,
  Wifi, Tv, Smartphone, Shield, MonitorPlay, Package, Truck, Wrench
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──

export interface RecurringLineItem {
  label: string;
  amount: number;
  category?: "Internet" | "TV" | "Mobile" | "Sécurité" | "Streaming" | "Extras" | string;
  description?: string;
}

export interface OneTimeLineItem {
  label: string;
  amount: number;
  type?: "activation" | "installation" | "equipment" | "delivery" | "sim" | "other";
  description?: string;
  strikethroughAmount?: number;
  isFree?: boolean;
  isCredit?: boolean;
}

export interface CanonicalBreakdownData {
  // Section A — Recurring
  recurringItems: RecurringLineItem[];
  recurringSubtotal: number;
  /** Monthly taxes (on recurring only — for future monthly display) */
  monthlyTps: number;
  monthlyTvq: number;
  monthlyTotal: number; // recurringSubtotal + monthlyTps + monthlyTvq

  // Section B — One-time
  oneTimeItems: OneTimeLineItem[];
  oneTimeSubtotal: number;

  // Section C — First payment today
  /** Discount applied to recurring (first month) */
  discountLabel?: string;
  discountAmount: number;
  /** Net recurring for first month after discount */
  firstMonthRecurringNet: number;
  /** Taxes on today's total (one-time + first month net) */
  todayTps: number;
  todayTvq: number;
  /** Grand total due today */
  todayTotal: number;

  // Optional display
  promoCode?: string;
  nextBillingDate?: string;
  billingCycleDay?: number;
}

interface CanonicalBillingBreakdownProps {
  data: CanonicalBreakdownData;
  /** Compact mode for sidebars */
  compact?: boolean;
  /** Show or hide individual sections */
  showRecurring?: boolean;
  showOneTime?: boolean;
  showTodayTotal?: boolean;
  className?: string;
}

// ── Helpers ──

const fmt = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

const categoryIcon = (cat?: string) => {
  switch (cat) {
    case "Internet": return <Wifi className="w-3.5 h-3.5 text-purple-500" />;
    case "TV": return <Tv className="w-3.5 h-3.5 text-pink-500" />;
    case "Mobile": return <Smartphone className="w-3.5 h-3.5 text-blue-500" />;
    case "Sécurité": return <Shield className="w-3.5 h-3.5 text-emerald-500" />;
    case "Streaming": return <MonitorPlay className="w-3.5 h-3.5 text-orange-500" />;
    default: return <Package className="w-3.5 h-3.5 text-muted-foreground" />;
  }
};

const oneTimeIcon = (type?: string) => {
  switch (type) {
    case "activation": return <Zap className="w-3.5 h-3.5" />;
    case "installation": return <Wrench className="w-3.5 h-3.5" />;
    case "delivery": return <Truck className="w-3.5 h-3.5" />;
    case "sim": return <CreditCard className="w-3.5 h-3.5" />;
    case "equipment": return <Tv className="w-3.5 h-3.5" />;
    default: return <Package className="w-3.5 h-3.5" />;
  }
};

// ── Component ──

export function CanonicalBillingBreakdown({
  data,
  compact = false,
  showRecurring = true,
  showOneTime = true,
  showTodayTotal = true,
  className,
}: CanonicalBillingBreakdownProps) {
  const {
    recurringItems, recurringSubtotal, monthlyTps, monthlyTvq, monthlyTotal,
    oneTimeItems, oneTimeSubtotal,
    discountLabel, discountAmount, firstMonthRecurringNet,
    todayTps, todayTvq, todayTotal,
    promoCode, nextBillingDate, billingCycleDay,
  } = data;

  return (
    <div className={cn("space-y-5", className)}>
      {/* ════════════════════════════════════════════
          SECTION A: Services mensuels (récurrent)
          ════════════════════════════════════════════ */}
      {showRecurring && recurringItems.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-purple-500" />
            Mensuel (récurrent)
          </h4>
          <div className="space-y-2 text-sm">
            {recurringItems.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {categoryIcon(item.category)}
                  <span className="text-muted-foreground">{item.label}</span>
                </div>
                <span className="text-foreground font-medium whitespace-nowrap">
                  {fmt(item.amount)}/mois
                </span>
              </div>
            ))}

            <Separator className="my-2" />

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sous-total mensuel</span>
              <span className="text-foreground font-medium">{fmt(recurringSubtotal)}/mois</span>
            </div>

            {!compact && (
              <>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>TPS (5%)</span>
                  <span>{fmt(monthlyTps)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>TVQ (9.975%)</span>
                  <span>{fmt(monthlyTvq)}</span>
                </div>
              </>
            )}
            {compact && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>TPS + TVQ</span>
                <span>{fmt(monthlyTps + monthlyTvq)}/mois</span>
              </div>
            )}

            <div className="flex justify-between items-baseline mt-2 pt-2 border-t border-purple-500/30">
              <span className="text-sm font-bold text-purple-500">Total mensuel estimé</span>
              <span className="text-lg font-bold text-purple-500">{fmt(monthlyTotal)}/mois</span>
            </div>

            {nextBillingDate && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <Calendar className="w-3 h-3" />
                <span>Prochaine facturation: {nextBillingDate}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          SECTION B: Frais uniques
          ════════════════════════════════════════════ */}
      {showOneTime && oneTimeItems.length > 0 && (
        <div className={showRecurring ? "border-t border-border pt-4" : ""}>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-500" />
            Frais uniques
          </h4>
          <div className="space-y-2 text-sm">
            {oneTimeItems.map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                  {oneTimeIcon(item.type)}
                  <span>{item.label}</span>
                </div>
                <div className="text-right whitespace-nowrap">
                  {item.strikethroughAmount !== undefined && (
                    <span className="text-xs text-muted-foreground line-through mr-1">
                      {fmt(item.strikethroughAmount)}
                    </span>
                  )}
                  <span className={cn(
                    "text-foreground font-medium",
                    item.isCredit && "text-emerald-500",
                    item.isFree && "text-muted-foreground"
                  )}>
                    {item.isFree ? "Gratuit" : item.isCredit ? `-${fmt(item.amount)}` : fmt(item.amount)}
                  </span>
                </div>
              </div>
            ))}

            <Separator className="my-2" />

            <div className="flex justify-between font-medium">
              <span className="text-foreground">Total frais uniques</span>
              <span className="text-foreground">{fmt(Math.max(0, oneTimeSubtotal))}</span>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          SECTION C: Total à payer aujourd'hui
          ════════════════════════════════════════════ */}
      {showTodayTotal && (
        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-cyan-500" />
            Paiement aujourd'hui
          </h4>
          <div className="space-y-2 text-sm">
            {/* One-time fees subtotal */}
            {oneTimeSubtotal > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Frais uniques</span>
                <span>{fmt(oneTimeSubtotal)}</span>
              </div>
            )}

            {/* First month recurring gross */}
            <div className="flex justify-between text-muted-foreground">
              <span>Services 1er mois</span>
              <span>{fmt(recurringSubtotal)}</span>
            </div>

            {/* Discount on recurring */}
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-500">
                <span>
                  {discountLabel || (promoCode ? `Rabais (${promoCode})` : "Rabais nouveau client")}
                </span>
                <span>-{fmt(discountAmount)}</span>
              </div>
            )}

            {/* Net recurring after discount (only if discount applied) */}
            {discountAmount > 0 && (
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Net 1er mois après rabais</span>
                <span>{fmt(firstMonthRecurringNet)}</span>
              </div>
            )}

            <Separator className="my-2" />

            {/* Taxes on today */}
            <div className="flex justify-between text-muted-foreground">
              <span>TPS (5%)</span>
              <span>{fmt(todayTps)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>TVQ (9.975%)</span>
              <span>{fmt(todayTvq)}</span>
            </div>

            {/* Grand total */}
            <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-cyan-500/50">
              <span className="font-bold text-foreground">Total à payer aujourd'hui</span>
              <span className="text-2xl font-bold text-cyan-500">{fmt(todayTotal)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Frais uniques + 1er mois, taxes incluses</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default CanonicalBillingBreakdown;
