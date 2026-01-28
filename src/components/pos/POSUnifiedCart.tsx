/**
 * POSUnifiedCart - Complete cart with services, equipment, and adjustments
 */
import { ShoppingCart, Trash2, X, Receipt, CreditCard, Wifi, Tv, Smartphone, Package, Shield, Truck, Wrench, DollarSign, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SelectedService } from "@/hooks/useFieldSalesOffers";
import { EquipmentItem } from "./POSEquipmentSelector";
import { AdjustmentItem } from "./POSAdjustments";
import { POSCartTotals } from "@/hooks/useUnifiedPOS";
import { cn } from "@/lib/utils";

interface POSUnifiedCartProps {
  services: SelectedService[];
  equipment: EquipmentItem[];
  adjustments: AdjustmentItem[];
  totals: POSCartTotals;
  onRemoveService: (offerId: string) => void;
  onRemoveEquipment: (id: string) => void;
  onRemoveAdjustment: (id: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  isOpen?: boolean;
}

const getServiceIcon = (category: string) => {
  switch (category) {
    case "internet": return Wifi;
    case "tv": return Tv;
    case "mobile": return Smartphone;
    default: return Package;
  }
};

const getServiceColor = (category: string) => {
  switch (category) {
    case "internet": return "bg-cyan-500/20 text-cyan-400";
    case "tv": return "bg-purple-500/20 text-purple-400";
    case "mobile": return "bg-emerald-500/20 text-emerald-400";
    default: return "bg-slate-500/20 text-slate-400";
  }
};

const getEquipmentIcon = (type: EquipmentItem["type"]) => {
  switch (type) {
    case "router": return Wifi;
    case "decoder": return Tv;
    case "sim": return Smartphone;
    case "security": return Shield;
  }
};

const getAdjustmentIcon = (type: AdjustmentItem["type"]) => {
  switch (type) {
    case "delivery": return Truck;
    case "installation": return Wrench;
    case "credit": return DollarSign;
    case "fee": return FileText;
    default: return DollarSign;
  }
};

export function POSUnifiedCart({
  services,
  equipment,
  adjustments,
  totals,
  onRemoveService,
  onRemoveEquipment,
  onRemoveAdjustment,
  onClearCart,
  onCheckout,
  isOpen = true,
}: POSUnifiedCartProps) {
  const [servicesOpen, setServicesOpen] = useState(true);
  const [equipmentOpen, setEquipmentOpen] = useState(true);
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(true);

  const totalItems = services.reduce((sum, s) => sum + s.quantity, 0) + 
                     equipment.reduce((sum, e) => sum + e.quantity, 0) +
                     adjustments.length;
  
  const isEmpty = services.length === 0 && equipment.length === 0 && adjustments.length === 0;

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950 border-l border-slate-700/50">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50 bg-slate-900/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/30">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Panier</h3>
              <p className="text-xs text-slate-400">
                {totalItems} article{totalItems !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {!isEmpty && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={onClearCart}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Vider
            </Button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {isEmpty ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4 border border-slate-700/50">
                <ShoppingCart className="h-10 w-10 text-slate-600" />
              </div>
              <p className="text-slate-400 font-semibold text-lg">Panier vide</p>
              <p className="text-slate-500 text-sm mt-2 max-w-[200px] mx-auto">
                Ajoutez des services, équipements ou ajustements
              </p>
            </div>
          ) : (
            <>
              {/* Services Section */}
              {services.length > 0 && (
                <Collapsible open={servicesOpen} onOpenChange={setServicesOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-orange-400" />
                      <span className="text-white font-medium text-sm">Services ({services.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-orange-400 font-bold text-sm">{totals.monthlySubtotal.toFixed(2)}$/mois</span>
                      {servicesOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {services.map(service => {
                      const Icon = getServiceIcon(service.category);
                      return (
                        <div key={service.offerId} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                          <div className={cn("p-1.5 rounded-lg", getServiceColor(service.category))}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{service.name}</p>
                            {service.quantity > 1 && (
                              <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-300 mt-1">
                                Qté: {service.quantity}
                              </Badge>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-orange-400 font-bold text-sm">{(service.priceMonthly * service.quantity).toFixed(2)}$</p>
                            <p className="text-[10px] text-slate-500">/mois</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => onRemoveService(service.offerId)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Equipment Section */}
              {equipment.length > 0 && (
                <Collapsible open={equipmentOpen} onOpenChange={setEquipmentOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-4 w-4 text-cyan-400" />
                      <span className="text-white font-medium text-sm">Équipements ({equipment.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-cyan-400 font-bold text-sm">{totals.equipmentTotal.toFixed(2)}$</span>
                      {equipmentOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {equipment.map(item => {
                      const Icon = getEquipmentIcon(item.type);
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                          <div className="p-1.5 rounded-lg bg-cyan-500/20">
                            <Icon className="h-4 w-4 text-cyan-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{item.name}</p>
                            {item.serialNumber && (
                              <p className="text-[10px] text-slate-500 truncate">S/N: {item.serialNumber}</p>
                            )}
                            {item.quantity > 1 && (
                              <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-300 mt-1">
                                Qté: {item.quantity}
                              </Badge>
                            )}
                          </div>
                          <p className="text-cyan-400 font-bold text-sm shrink-0">{(item.price * item.quantity).toFixed(2)}$</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => onRemoveEquipment(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Adjustments Section */}
              {adjustments.length > 0 && (
                <Collapsible open={adjustmentsOpen} onOpenChange={setAdjustmentsOpen}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-purple-400" />
                      <span className="text-white font-medium text-sm">Ajustements ({adjustments.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-bold text-sm",
                        totals.adjustmentsTotal >= 0 ? "text-red-400" : "text-emerald-400"
                      )}>
                        {totals.adjustmentsTotal >= 0 ? "+" : ""}{totals.adjustmentsTotal.toFixed(2)}$
                      </span>
                      {adjustmentsOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    {adjustments.map(item => {
                      const Icon = getAdjustmentIcon(item.type);
                      const isCredit = item.amount < 0;
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30">
                          <div className={cn(
                            "p-1.5 rounded-lg",
                            isCredit ? "bg-emerald-500/20" : "bg-red-500/20"
                          )}>
                            <Icon className={cn("h-4 w-4", isCredit ? "text-emerald-400" : "text-red-400")} />
                          </div>
                          <p className="flex-1 text-white text-sm truncate">{item.name}</p>
                          <p className={cn(
                            "font-bold text-sm shrink-0",
                            isCredit ? "text-emerald-400" : "text-red-400"
                          )}>
                            {item.amount >= 0 ? "+" : ""}{item.amount.toFixed(2)}$
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => onRemoveAdjustment(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Summary */}
      {!isEmpty && (
        <div className="border-t border-slate-700/50 bg-slate-900/90 backdrop-blur-sm">
          <div className="p-4 space-y-3">
            {/* Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Services mensuels</span>
                <span className="text-white font-semibold">{totals.monthlySubtotal.toFixed(2)}$</span>
              </div>
              
              {totals.setupSubtotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Frais installation services</span>
                  <span className="text-white">{totals.setupSubtotal.toFixed(2)}$</span>
                </div>
              )}
              
              {totals.equipmentTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Équipements</span>
                  <span className="text-white">{totals.equipmentTotal.toFixed(2)}$</span>
                </div>
              )}
              
              {totals.activationFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    Activation
                    {services.length > 1 && (
                      <Badge className="text-[8px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Forfait groupé
                      </Badge>
                    )}
                  </span>
                  <span className="text-white">{totals.activationFee.toFixed(2)}$</span>
                </div>
              )}
              
              {adjustments.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Ajustements</span>
                  <span className={totals.adjustmentsTotal < 0 ? "text-emerald-400" : "text-red-400"}>
                    {totals.adjustmentsTotal >= 0 ? "+" : ""}{totals.adjustmentsTotal.toFixed(2)}$
                  </span>
                </div>
              )}

              <Separator className="bg-slate-700/50" />
              
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">TPS (5%)</span>
                <span className="text-slate-400">{totals.tps.toFixed(2)}$</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">TVQ (9.975%)</span>
                <span className="text-slate-400">{totals.tvq.toFixed(2)}$</span>
              </div>
            </div>

            <Separator className="bg-slate-700/50" />

            {/* Totals */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs text-slate-400">Première facture</p>
                  <p className="text-3xl font-black text-white">{totals.firstMonthTotal.toFixed(2)}$</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Récurrent/mois</p>
                  <p className="text-lg font-bold text-orange-400">{totals.recurringMonthly.toFixed(2)}$</p>
                </div>
              </div>
            </div>

            {/* Checkout */}
            <Button
              onClick={onCheckout}
              className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-lg shadow-xl shadow-orange-500/30"
            >
              <CreditCard className="h-5 w-5 mr-2" />
              Procéder au paiement
            </Button>

            <p className="text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <Receipt className="h-3 w-3" />
              Contrat et facture générés automatiquement
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
