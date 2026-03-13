import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ShoppingCart, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrencyCAD } from "@/lib/pricing/money";

export interface AuthoritativeCheckoutPricing {
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
  orderNumber?: string;
  invoiceNumber?: string;
  paymentNumber?: string;
}

interface ProfessionalOrderSummaryProps {
  pricing: AuthoritativeCheckoutPricing | null;
  isLoading?: boolean;
  isMobile?: boolean;
  selectedServicesCount?: number;
  onContinue?: () => void;
  continueDisabled?: boolean;
}

const formatCurrency = (value: unknown) => formatCurrencyCAD(value);

export const ProfessionalOrderSummary: React.FC<ProfessionalOrderSummaryProps> = ({
  pricing,
  isLoading = false,
  isMobile = false,
  selectedServicesCount = 0,
  onContinue,
  continueDisabled = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(isMobile);

  const summaryContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Sous-total autoritatif</span>
          <span className="text-foreground font-medium">
            {pricing ? formatCurrency(pricing.subtotal) : "—"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">TPS</span>
          <span className="text-foreground">{pricing ? formatCurrency(pricing.gst) : "—"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">TVQ</span>
          <span className="text-foreground">{pricing ? formatCurrency(pricing.qst) : "—"}</span>
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex justify-between items-center">
          <span className="font-semibold text-foreground">Total autoritatif</span>
          <span className="text-xl font-bold text-primary">
            {pricing ? formatCurrency(pricing.total) : "—"}
          </span>
        </div>
      </div>

      {pricing?.orderNumber && (
        <div className="grid grid-cols-1 gap-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded-md bg-accent/30">
            <span className="text-muted-foreground">Commande</span>
            <span className="font-mono text-foreground">{pricing.orderNumber}</span>
          </div>
          {pricing.invoiceNumber && (
            <div className="flex items-center justify-between p-2 rounded-md bg-accent/30">
              <span className="text-muted-foreground">Facture</span>
              <span className="font-mono text-foreground">{pricing.invoiceNumber}</span>
            </div>
          )}
          {pricing.paymentNumber && (
            <div className="flex items-center justify-between p-2 rounded-md bg-accent/30">
              <span className="text-muted-foreground">Paiement</span>
              <span className="font-mono text-foreground">{pricing.paymentNumber}</span>
            </div>
          )}
        </div>
      )}

      {!pricing && !isLoading && (
        <p className="text-xs text-muted-foreground">
          En attente de la réponse autoritative de Nivra Core.
        </p>
      )}

      {isLoading && (
        <p className="text-xs text-muted-foreground">Mise à jour du pricing autoritatif...</p>
      )}

      {onContinue && (
        <Button variant="hero" className="w-full" size="lg" onClick={onContinue} disabled={continueDisabled || !pricing}>
          Continuer
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
        <Card className="bg-card border-border fixed bottom-0 left-0 right-0 z-50 rounded-b-none shadow-2xl">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  Résumé de commande
                </CardTitle>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-primary">
                    {pricing ? formatCurrency(pricing.total) : "—"}
                  </span>
                  {isCollapsed ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 max-h-[60vh] overflow-y-auto">{summaryContent}</CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Card className="bg-card border-border sticky top-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Résumé de commande
          </CardTitle>
          {selectedServicesCount > 0 && <Badge variant="secondary">{selectedServicesCount} service(s)</Badge>}
        </div>
      </CardHeader>
      <CardContent>{summaryContent}</CardContent>
    </Card>
  );
};

export default ProfessionalOrderSummary;
