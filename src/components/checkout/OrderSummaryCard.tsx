import { Receipt, Edit2, Calendar, Shield, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LineItem {
  label: string;
  amount: number;
  description?: string;
  isMonthly?: boolean;
  isDiscount?: boolean;
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
}: OrderSummaryCardProps) => {
  return (
    <Card className={cn("bg-card border shadow-lg", className)}>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Receipt className="w-5 h-5 text-primary" />
          {isFrench ? "Résumé de commande" : "Order Summary"}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-5">
        {/* Monthly Recurring Section */}
        {monthlyItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isFrench ? "Mensuel" : "Monthly"}
              </h4>
              {onEditSection && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-primary hover:text-primary/80"
                  onClick={() => onEditSection("plan")}
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  {isFrench ? "Modifier" : "Edit"}
                </Button>
              )}
            </div>
            
            <div className="space-y-2">
              {monthlyItems.map((item, index) => (
                <div key={index} className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                  <span className={cn(
                    "text-sm font-medium",
                    item.isDiscount ? "text-emerald-600" : "text-foreground"
                  )}>
                    {item.isDiscount && "-"}${item.amount.toFixed(2)}/{isFrench ? "mois" : "mo"}
                  </span>
                </div>
              ))}
            </div>
            
            {monthlyTotal > 0 && (
              <div className="flex justify-between items-center pt-2 border-t border-dashed">
                <span className="text-sm font-medium text-muted-foreground">
                  {isFrench ? "Sous-total mensuel" : "Monthly subtotal"}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  ${monthlyTotal.toFixed(2)}/{isFrench ? "mois" : "mo"}
                </span>
              </div>
            )}
          </div>
        )}

        {monthlyItems.length > 0 && oneTimeItems.length > 0 && (
          <Separator />
        )}

        {/* One-Time Fees Section */}
        {oneTimeItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {isFrench ? "Frais uniques" : "One-Time Fees"}
              </h4>
              {onEditSection && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-xs text-primary hover:text-primary/80"
                  onClick={() => onEditSection("equipment")}
                >
                  <Edit2 className="w-3 h-3 mr-1" />
                  {isFrench ? "Modifier" : "Edit"}
                </Button>
              )}
            </div>
            
            <div className="space-y-2">
              {oneTimeItems.map((item, index) => (
                <div key={index} className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                  <span className={cn(
                    "text-sm",
                    item.isDiscount ? "text-emerald-600 font-medium" : "text-foreground"
                  )}>
                    {item.isDiscount && "-"}${Math.abs(item.amount).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Taxes */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isFrench ? "Taxes" : "Taxes"}
          </h4>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">TPS (5%)</span>
            <span>${tpsAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">TVQ (9.975%)</span>
            <span>${tvqAmount.toFixed(2)}</span>
          </div>
        </div>

        <Separator />

        {/* Total Due Now */}
        <div className="bg-primary/5 -mx-6 px-6 py-4 rounded-b-lg">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isFrench ? "Total à payer aujourd'hui" : "Total due today"}
              </p>
            </div>
            <span className="text-2xl font-bold text-primary">
              ${totalDueNow.toFixed(2)}
            </span>
          </div>
          
          {/* Next Billing Info */}
          {(nextBillingDate || billingCycleDay) && (
            <div className="mt-3 pt-3 border-t border-primary/10">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>
                  {isFrench ? "Prochaine facturation" : "Next billing"}:
                  {nextBillingDate && ` ${nextBillingDate}`}
                  {billingCycleDay && ` (${isFrench ? "jour" : "day"} ${billingCycleDay})`}
                </span>
              </div>
            </div>
          )}
          
          {monthlyTotal > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <Info className="w-3.5 h-3.5" />
              <span>
                {isFrench 
                  ? `Mensualité: $${monthlyTotal.toFixed(2)}/mois (après activation)`
                  : `Monthly: $${monthlyTotal.toFixed(2)}/mo (after activation)`}
              </span>
            </div>
          )}
        </div>

        {/* Trust Badges */}
        {showTrustBadges && (
          <div className="pt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>
                {isFrench 
                  ? "Paiement sécurisé et crypté" 
                  : "Secure and encrypted payment"}
              </span>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                {isFrench ? "Aucune vérification de crédit" : "No credit check"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {isFrench ? "Garantie 1 an" : "1-year warranty"}
              </Badge>
            </div>
          </div>
        )}

        {/* Additional content (terms checkbox, buttons, etc.) */}
        {children}
      </CardContent>
    </Card>
  );
};

export default OrderSummaryCard;
