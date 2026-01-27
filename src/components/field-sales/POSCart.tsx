/**
 * POSCart - Professional shopping cart sidebar for POS with billing breakdown
 */
import { ShoppingCart, Trash2, X, Receipt, CreditCard, FileText, AlertTriangle, Wifi, Tv, Smartphone, Package } from "lucide-react";
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

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "internet": return Wifi;
    case "tv": return Tv;
    case "mobile": return Smartphone;
    default: return Package;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case "internet": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    case "tv": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "mobile": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "bundle": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    default: return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  }
};

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
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-slate-950 border-l border-slate-700/50">
      {/* Cart Header */}
      <div className="p-4 border-b border-slate-700/50 bg-slate-900/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/30">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Panier</h3>
              <p className="text-xs text-slate-400">
                {itemCount} article{itemCount !== 1 ? "s" : ""} sélectionné{itemCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {services.length > 0 && (
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
        <div className="p-4 space-y-3">
          {services.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4 border border-slate-700/50">
                <ShoppingCart className="h-10 w-10 text-slate-600" />
              </div>
              <p className="text-slate-400 font-semibold text-lg">Panier vide</p>
              <p className="text-slate-500 text-sm mt-2 max-w-[200px] mx-auto">
                Sélectionnez des services dans le catalogue pour les ajouter au panier
              </p>
            </div>
          ) : (
            services.map((service) => {
              const Icon = getCategoryIcon(service.category);
              
              return (
                <div
                  key={service.offerId}
                  className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Category icon */}
                    <div className={cn("p-2 rounded-lg border", getCategoryColor(service.category))}>
                      <Icon className="h-4 w-4" />
                    </div>
                    
                    {/* Service info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-semibold text-sm line-clamp-2">
                        {service.name}
                      </h4>
                      <p className="text-xs text-slate-400 capitalize mt-0.5">{service.category}</p>
                      {service.quantity > 1 && (
                        <Badge variant="outline" className="mt-1.5 text-[10px] border-slate-600 text-slate-300">
                          Quantité: {service.quantity}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Price and remove */}
                    <div className="text-right shrink-0">
                      <p className="text-orange-400 font-bold">
                        {(service.priceMonthly * service.quantity).toFixed(2)}$
                      </p>
                      <p className="text-[10px] text-slate-500">/mois</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 mt-1"
                        onClick={() => onRemoveService(service.offerId)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Cart Summary */}
      {services.length > 0 && (
        <div className="border-t border-slate-700/50 bg-slate-900/90 backdrop-blur-sm">
          <div className="p-4 space-y-3">
            {/* Billing breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Mensuel récurrent</span>
                <span className="text-white font-semibold">{totals.monthlySubtotal.toFixed(2)}$</span>
              </div>
              
              {totals.setupSubtotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Installation</span>
                  <span className="text-white">{totals.setupSubtotal.toFixed(2)}$</span>
                </div>
              )}
              
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

            {/* Checkout Button */}
            <Button
              onClick={onCheckout}
              className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-lg shadow-xl shadow-orange-500/30 transition-all hover:shadow-orange-500/40"
            >
              <CreditCard className="h-5 w-5 mr-2" />
              Procéder au paiement
            </Button>

            {/* Info text */}
            <p className="text-center text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <FileText className="h-3 w-3" />
              Contrat et facture générés automatiquement
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
