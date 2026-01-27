/**
 * POSCart - Shopping cart sidebar/drawer for POS
 */
import { ShoppingCart, Trash2, X, Receipt, CreditCard, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SelectedService, calculateFieldSalesTotals } from "@/hooks/useFieldSalesOffers";
import { cn } from "@/lib/utils";

interface POSCartProps {
  services: SelectedService[];
  onRemoveService: (offerId: string) => void;
  onClearCart: () => void;
  onCheckout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function POSCart({
  services,
  onRemoveService,
  onClearCart,
  onCheckout,
  isOpen = true,
  onClose,
}: POSCartProps) {
  const totals = calculateFieldSalesTotals(services);
  const itemCount = services.reduce((sum, s) => sum + s.quantity, 0);

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full bg-slate-900/95 border-l border-slate-700/50">
      {/* Cart Header */}
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <ShoppingCart className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold">Panier</h3>
              <p className="text-xs text-slate-400">{itemCount} article{itemCount > 1 ? "s" : ""}</p>
            </div>
          </div>
          {services.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={onClearCart}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Vider
            </Button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {services.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">Panier vide</p>
              <p className="text-xs text-slate-600 mt-1">Sélectionnez des services</p>
            </div>
          ) : (
            services.map((service) => (
              <div
                key={service.offerId}
                className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white text-sm font-medium truncate">
                      {service.name}
                    </h4>
                    <p className="text-xs text-slate-400 capitalize">{service.category}</p>
                    {service.quantity > 1 && (
                      <Badge variant="outline" className="mt-1 text-[10px] border-slate-600 text-slate-300">
                        Qté: {service.quantity}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-orange-400 font-semibold text-sm">
                      {(service.priceMonthly * service.quantity).toFixed(2)}$
                      <span className="text-slate-500 font-normal">/mois</span>
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 mt-1"
                      onClick={() => onRemoveService(service.offerId)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Cart Summary */}
      {services.length > 0 && (
        <div className="border-t border-slate-700/50 p-4 space-y-3 bg-slate-800/30">
          {/* Breakdown */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Mensuel</span>
              <span>{totals.monthlySubtotal.toFixed(2)}$</span>
            </div>
            {totals.activationFee > 0 && (
              <div className="flex justify-between text-slate-400">
                <span className="flex items-center gap-1">
                  Activation
                  {services.length > 1 && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 border-emerald-500/30 text-emerald-400">
                      Forfait
                    </Badge>
                  )}
                </span>
                <span>{totals.activationFee.toFixed(2)}$</span>
              </div>
            )}
            <div className="flex justify-between text-slate-500 text-xs">
              <span>TPS (5%)</span>
              <span>{totals.tps.toFixed(2)}$</span>
            </div>
            <div className="flex justify-between text-slate-500 text-xs">
              <span>TVQ (9.975%)</span>
              <span>{totals.tvq.toFixed(2)}$</span>
            </div>
          </div>

          <Separator className="bg-slate-700/50" />

          {/* Total */}
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs text-slate-400">1ère facture</p>
              <p className="text-2xl font-bold text-white">{totals.firstMonthTotal.toFixed(2)}$</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Récurrent/mois</p>
              <p className="text-sm font-semibold text-orange-400">{totals.recurringMonthly.toFixed(2)}$</p>
            </div>
          </div>

          {/* Checkout Button */}
          <Button
            onClick={onCheckout}
            className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-lg shadow-lg shadow-orange-500/30"
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Procéder au paiement
          </Button>

          {/* Quick info */}
          <p className="text-center text-[10px] text-slate-500">
            <FileText className="h-3 w-3 inline mr-1" />
            Contrat et reçu générés automatiquement
          </p>
        </div>
      )}
    </div>
  );
}
