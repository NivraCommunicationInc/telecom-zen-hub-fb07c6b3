import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ShoppingCart, 
  ChevronDown, 
  ChevronUp, 
  Receipt, 
  FileText,
  Smartphone,
  Wifi,
  Tv,
  Shield,
  MonitorPlay,
  Package,
  Truck,
  CreditCard,
  Wrench,
  Zap
} from "lucide-react";

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
}

interface Channel {
  id: string;
  name: string;
  category: string;
  price: number;
}

interface StreamingService {
  id: string;
  name: string;
  monthly_price: number;
}

interface ProfessionalOrderSummaryProps {
  selectedServices: Service[];
  selectedMobileServices: Service[];
  mobileLineQuantities: Record<string, number>;
  totalMobileLineQuantity: number;
  selectedPaidChannels: Channel[];
  paidChannelTotal: number;
  selectedStreamingAddons?: StreamingService[];
  streamingAddonsTotal?: number;
  monthlyRecurring: number;
  oneTimeFees: number;
  oneTimeFeesGross?: number; // Before credits
  activationFee: number;
  deliveryFee: number;
  installationFee: number;
  terminalFee: number;
  routerFee: number;
  simFee: number;
  simCreditAmount?: number; // Credit for SIM fee
  simDeliveryCreditAmount?: number; // Credit for SIM delivery
  terminalQuantity: number;
  baseAmount: number;
  tpsAmount: number;
  tvqAmount: number;
  totalAmount: number;
  oneTimeFeesWithTax: number;
  monthlyRecurringWithTax: number;
  hasMobileService: boolean;
  hasTVService: boolean;
  hasInternetService: boolean;
  isEquipmentOnlyOrder: boolean;
  isDeliveryOnlyOrder: boolean;
  deliveryChoice: "standard" | "uber" | "shipHome" | null;
  installationChoice: "auto" | "technician" | null;
  onContinue?: () => void;
  continueDisabled?: boolean;
  showBillPreview?: boolean;
  isMobile?: boolean;
}

const categoryIcons: Record<string, any> = {
  Mobile: Smartphone,
  Internet: Wifi,
  TV: Tv,
  Streaming: MonitorPlay,
  Sécurité: Shield,
  Extras: Package,
};

export const ProfessionalOrderSummary: React.FC<ProfessionalOrderSummaryProps> = ({
  selectedServices,
  selectedMobileServices,
  mobileLineQuantities,
  totalMobileLineQuantity,
  selectedPaidChannels,
  paidChannelTotal,
  selectedStreamingAddons = [],
  streamingAddonsTotal = 0,
  monthlyRecurring,
  oneTimeFees,
  oneTimeFeesGross,
  activationFee,
  deliveryFee,
  installationFee,
  terminalFee,
  routerFee,
  simFee,
  simCreditAmount = 0,
  simDeliveryCreditAmount = 0,
  terminalQuantity,
  baseAmount,
  tpsAmount,
  tvqAmount,
  totalAmount,
  oneTimeFeesWithTax,
  monthlyRecurringWithTax,
  hasMobileService,
  hasTVService,
  hasInternetService,
  isEquipmentOnlyOrder,
  isDeliveryOnlyOrder,
  deliveryChoice,
  installationChoice,
  onContinue,
  continueDisabled = false,
  showBillPreview = false,
  isMobile = false,
}) => {
  const [showOneTimeFeeDetails, setShowOneTimeFeeDetails] = useState(false);
  const [showTaxDetails, setShowTaxDetails] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(isMobile);

  // Calculate total credits
  const totalCredits = simCreditAmount + simDeliveryCreditAmount;

  // Get delivery method label
  const getDeliveryLabel = () => {
    if (isDeliveryOnlyOrder) {
      if (deliveryChoice === "uber") return "Livraison Express Uber";
      if (deliveryChoice === "shipHome") return "Expédition à domicile";
      return "Livraison standard";
    }
    if (installationChoice === "auto") return "Frais de livraison (QC)";
    if (installationChoice === "technician") return "Installation technicien";
    return null;
  };

  const summaryContent = (
    <div className="space-y-4">
      {/* SECTION A: Monthly Recurring */}
      <div>
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
          <Receipt className="w-4 h-4 text-cyan-500" />
          Mensuel (récurrent)
        </h4>
        <div className="space-y-2 text-sm">
          {/* Internet */}
          {selectedServices.filter(s => s.category === "Internet").map(s => (
            <div key={s.id} className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Wifi className="w-3 h-3 text-purple-500" />
                <span className="text-muted-foreground">Internet</span>
              </div>
              <span className="text-foreground font-medium">{Number(s.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
            </div>
          ))}
          {/* TV */}
          {selectedServices.filter(s => s.category === "TV").map(s => (
            <div key={s.id} className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Tv className="w-3 h-3 text-pink-500" />
                <span className="text-muted-foreground">TV — {s.name}</span>
              </div>
              <span className="text-foreground font-medium">{Number(s.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
            </div>
          ))}
          {/* Security */}
          {selectedServices.filter(s => s.category === "Sécurité").map(s => (
            <div key={s.id} className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Shield className="w-3 h-3 text-emerald-500" />
                <span className="text-muted-foreground">Sécurité maison</span>
              </div>
              <span className="text-foreground font-medium">{Number(s.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
            </div>
          ))}
          {/* Mobile - per plan */}
          {selectedMobileServices.map(s => {
            const qty = mobileLineQuantities[s.id] || 1;
            return (
              <div key={s.id} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-3 h-3 text-blue-500" />
                  <span className="text-muted-foreground">
                    Mobile — {s.name} {qty > 1 && <span className="text-blue-500">(×{qty} lignes)</span>}
                  </span>
                </div>
                <span className="text-foreground font-medium">{(Number(s.price) * qty).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
              </div>
            );
          })}
          {/* Streaming */}
          {selectedServices.filter(s => s.category === "Streaming").map(s => (
            <div key={s.id} className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MonitorPlay className="w-3 h-3 text-orange-500" />
                <span className="text-muted-foreground">Streaming — {s.name}</span>
              </div>
              <span className="text-foreground font-medium">{Number(s.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
            </div>
          ))}
          {/* Streaming+ Add-ons */}
          {selectedStreamingAddons.length > 0 && (
            <>
              {selectedStreamingAddons.map(s => (
                <div key={s.id} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <MonitorPlay className="w-3 h-3 text-cyan-500" />
                    <span className="text-muted-foreground">Streaming+ — {s.name}</span>
                  </div>
                  <span className="text-cyan-500 font-medium">+{Number(s.monthly_price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
              ))}
            </>
          )}
          {/* Premium/Paid Channels */}
          {paidChannelTotal > 0 && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Tv className="w-3 h-3 text-amber-500" />
                <span className="text-muted-foreground">Chaînes premium ({selectedPaidChannels.length})</span>
              </div>
              <span className="text-amber-500 font-medium">+{paidChannelTotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
            </div>
          )}
          
          <Separator className="my-2" />
          <div className="flex justify-between items-center font-medium">
            <span className="text-foreground">Total mensuel estimé</span>
            <span className="text-cyan-500">{monthlyRecurring.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
          </div>
        </div>
      </div>

      {/* SECTION B: One-Time Fees */}
      {oneTimeFees > 0 && (
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Frais uniques (une seule fois)
            </h4>
            <button
              onClick={() => setShowOneTimeFeeDetails(!showOneTimeFeeDetails)}
              className="text-xs text-cyan-500 hover:text-cyan-400 flex items-center gap-1 underline"
            >
              {showOneTimeFeeDetails ? "Masquer" : "Voir le détail"}
              {showOneTimeFeeDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          
          <div className="flex justify-between items-center text-sm font-medium mb-2">
            <span className="text-foreground">Total frais uniques</span>
            <span className="text-foreground">{oneTimeFees.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
          </div>
          
          {showOneTimeFeeDetails && (
            <div className="bg-accent/30 rounded-lg p-3 space-y-1.5 text-sm">
              {!isEquipmentOnlyOrder && activationFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Zap className="w-3 h-3" />
                    Frais d'activation {(() => {
                      const count = [hasInternetService, hasTVService, hasMobileService].filter(Boolean).length;
                      return count >= 2 ? "(forfait groupé)" : "(1 service)";
                    })()}
                  </span>
                  <span>{activationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
              )}
              {simFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-3 h-3" />
                    Carte(s) SIM physique(s) ×{totalMobileLineQuantity}
                  </span>
                  <span>{simFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
              )}
              {deliveryFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Truck className="w-3 h-3" />
                    {getDeliveryLabel()}
                  </span>
                  <span>{deliveryFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
              )}
              {installationFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Wrench className="w-3 h-3" />
                    Installation technicien
                  </span>
                  <span>{installationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
              )}
              {terminalFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Tv className="w-3 h-3" />
                    Terminal TV ×{terminalQuantity}
                  </span>
                  <span>{terminalFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
              )}
              {routerFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Wifi className="w-3 h-3" />
                    Routeur Nivra Born Wifi
                  </span>
                  <span>{routerFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
              )}
              
              {/* SIM Credits Section - only show if there are credits */}
              {totalCredits > 0 && (
                <>
                  <Separator className="my-2" />
                  {simCreditAmount > 0 && (
                    <div className="flex justify-between text-emerald-500">
                      <span className="flex items-center gap-2">
                        <CreditCard className="w-3 h-3" />
                        Crédit — Carte SIM offerte {totalMobileLineQuantity > 1 ? `(×${totalMobileLineQuantity})` : ""}
                      </span>
                      <span>-{simCreditAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  )}
                  {simDeliveryCreditAmount > 0 && (
                    <div className="flex justify-between text-emerald-500">
                      <span className="flex items-center gap-2">
                        <Truck className="w-3 h-3" />
                        Crédit — Livraison SIM offerte
                      </span>
                      <span>-{simDeliveryCreditAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  )}
                </>
              )}
              
              <p className="text-xs text-muted-foreground italic pt-1">Les frais uniques sont facturés une seule fois.</p>
            </div>
          )}
        </div>
      )}

      {/* SECTION C: Taxes */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-foreground">Taxes applicables</h4>
          <button
            onClick={() => setShowTaxDetails(!showTaxDetails)}
            className="text-xs text-cyan-500 hover:text-cyan-400 flex items-center gap-1 underline"
          >
            {showTaxDetails ? "Masquer" : "Voir le détail"}
            {showTaxDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
        
        {showTaxDetails && (
          <div className="bg-accent/30 rounded-lg p-3 space-y-1.5 text-sm mb-3">
            <div className="flex justify-between text-muted-foreground">
              <span>Sous-total avant taxes</span>
              <span>{baseAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>TPS (5%)</span>
              <span>{tpsAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>TVQ (9.975%)</span>
              <span>{tvqAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between font-medium">
              <span>Total taxes</span>
              <span>{(tpsAmount + tvqAmount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Taxes (TPS + TVQ)</span>
          <span className="text-foreground">{(tpsAmount + tvqAmount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
        </div>
      </div>

      {/* TOTAL */}
      <div className="border-t-2 border-cyan-500/30 pt-4">
        <div className="flex justify-between items-center">
          <span className="font-bold text-lg text-foreground">Total à payer aujourd'hui</span>
          <span className="font-bold text-2xl text-cyan-500">{totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Taxes incluses • Montants estimatifs</p>
      </div>

      {/* Bill Previews (optional) */}
      {showBillPreview && (
        <div className="border-t border-border pt-4 space-y-4">
          {/* First Bill Preview */}
          <Card className="bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border-cyan-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-cyan-500" />
                Aperçu 1ère facture (aujourd'hui)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              {activationFee > 0 && <div className="flex justify-between"><span>Activation</span><span>{activationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
              {simFee > 0 && <div className="flex justify-between"><span>SIM ×{totalMobileLineQuantity}</span><span>{simFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
              {deliveryFee > 0 && <div className="flex justify-between"><span>Livraison</span><span>{deliveryFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
              {installationFee > 0 && <div className="flex justify-between"><span>Installation</span><span>{installationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
              {terminalFee > 0 && <div className="flex justify-between"><span>Terminal ×{terminalQuantity}</span><span>{terminalFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
              {routerFee > 0 && <div className="flex justify-between"><span>Routeur</span><span>{routerFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
              <Separator className="my-1" />
              <div className="flex justify-between font-medium text-cyan-500">
                <span>Total aujourd'hui</span>
                <span>{oneTimeFeesWithTax.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
              </div>
            </CardContent>
          </Card>

          {/* Second Bill Preview */}
          <Card className="bg-gradient-to-br from-purple-500/5 to-pink-500/5 border-purple-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-500" />
                Aperçu 2e facture (mensuelle)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1">
              {selectedServices.filter(s => s.category !== "Mobile").map(s => (
                <div key={s.id} className="flex justify-between">
                  <span>{s.category}</span>
                  <span>{Number(s.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
              ))}
              {selectedMobileServices.map(s => {
                const qty = mobileLineQuantities[s.id] || 1;
                return (
                  <div key={s.id} className="flex justify-between">
                    <span>Mobile ×{qty}</span>
                    <span>{(Number(s.price) * qty).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                  </div>
                );
              })}
              {paidChannelTotal > 0 && <div className="flex justify-between"><span>Chaînes ({selectedPaidChannels.length})</span><span>{paidChannelTotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>}
              <Separator className="my-1" />
              <div className="flex justify-between font-medium text-purple-500">
                <span>Total mensuel</span>
                <span>{monthlyRecurringWithTax.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Prochaine facturation: le 1er de chaque mois</p>
            </CardContent>
          </Card>
          
          <p className="text-[10px] text-muted-foreground text-center italic">
            Montants estimatifs. Taxes calculées selon l'adresse de service.
          </p>
        </div>
      )}

      {/* Continue Button */}
      {onContinue && (
        <Button variant="hero" className="w-full" size="lg" onClick={onContinue} disabled={continueDisabled}>
          Continuer
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Collapsible open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
        <Card className="bg-card border-cyan-500/30 fixed bottom-0 left-0 right-0 z-50 rounded-b-none shadow-2xl">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="w-5 h-5 text-cyan-500" />
                  Résumé de commande
                </CardTitle>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-cyan-500">{totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                  {isCollapsed ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 max-h-[60vh] overflow-y-auto">
              {summaryContent}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Card className="bg-card border-cyan-500/30 sticky top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-cyan-500" />
          Résumé de commande
        </CardTitle>
      </CardHeader>
      <CardContent>
        {selectedServices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Sélectionnez des services pour commencer</p>
          </div>
        ) : (
          summaryContent
        )}
      </CardContent>
    </Card>
  );
};

export default ProfessionalOrderSummary;
