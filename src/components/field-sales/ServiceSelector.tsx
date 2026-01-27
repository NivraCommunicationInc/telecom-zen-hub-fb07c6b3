/**
 * ServiceSelector - Multi-service selection for field sales
 * Uses real offers from the site, supports multiple selections
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, Plus, Minus, Wifi, Tv, Smartphone, Package } from "lucide-react";
import { useFieldSalesOffers, FieldSalesOffer, SelectedService, calculateFieldSalesTotals } from "@/hooks/useFieldSalesOffers";

interface ServiceSelectorProps {
  selectedServices: SelectedService[];
  onServicesChange: (services: SelectedService[]) => void;
}

const CATEGORY_CONFIG = {
  internet: { icon: Wifi, label: "Internet", color: "text-blue-400" },
  tv: { icon: Tv, label: "Télévision", color: "text-purple-400" },
  mobile: { icon: Smartphone, label: "Mobile", color: "text-green-400" },
  bundle: { icon: Package, label: "Forfaits", color: "text-orange-400" },
};

export function ServiceSelector({ selectedServices, onServicesChange }: ServiceSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<string>("internet");
  const { data: offers = [], isLoading } = useFieldSalesOffers();

  const categories = [...new Set(offers.map(o => o.category))];
  
  const isSelected = (offerId: string) => selectedServices.some(s => s.offerId === offerId);
  
  const getQuantity = (offerId: string) => {
    const service = selectedServices.find(s => s.offerId === offerId);
    return service?.quantity || 0;
  };

  const toggleService = (offer: FieldSalesOffer) => {
    if (isSelected(offer.id)) {
      onServicesChange(selectedServices.filter(s => s.offerId !== offer.id));
    } else {
      onServicesChange([
        ...selectedServices,
        {
          offerId: offer.id,
          name: offer.name_fr,
          category: offer.category,
          priceMonthly: offer.price_monthly || 0,
          priceSetup: offer.price_setup || 0,
          quantity: 1,
        },
      ]);
    }
  };

  const updateQuantity = (offerId: string, delta: number) => {
    onServicesChange(
      selectedServices.map(s => {
        if (s.offerId === offerId) {
          const newQty = Math.max(1, s.quantity + delta);
          return { ...s, quantity: newQty };
        }
        return s;
      })
    );
  };

  const filteredOffers = offers.filter(o => o.category === activeCategory);
  const totals = calculateFieldSalesTotals(selectedServices);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="w-full grid grid-cols-4 bg-slate-800/50 border border-slate-700">
          {categories.map(cat => {
            const config = CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG];
            const Icon = config?.icon || Package;
            const count = selectedServices.filter(s => s.category === cat).length;
            
            return (
              <TabsTrigger 
                key={cat} 
                value={cat}
                className="relative data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
              >
                <Icon className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">{config?.label || cat}</span>
                {count > 0 && (
                  <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center bg-orange-500 text-white text-[10px]">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Offers Grid */}
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {filteredOffers.length === 0 ? (
          <p className="text-center text-slate-400 py-8">Aucune offre disponible</p>
        ) : (
          filteredOffers.map(offer => {
            const selected = isSelected(offer.id);
            const features = offer.features_json as { badge?: string; features?: string[]; speed?: string } | null;
            
            return (
              <Card 
                key={offer.id}
                className={`border transition-all cursor-pointer ${
                  selected 
                    ? "border-orange-500 bg-orange-500/10" 
                    : "border-slate-700/50 bg-slate-800/50 hover:border-slate-600"
                }`}
                onClick={() => toggleService(offer)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {features?.badge && (
                          <Badge className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] px-1.5 py-0">
                            {features.badge}
                          </Badge>
                        )}
                        <h3 className="text-white font-medium">{offer.name_fr}</h3>
                      </div>
                      {features?.speed && (
                        <p className="text-sm text-cyan-400 font-medium">{features.speed}</p>
                      )}
                      {offer.description_fr && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{offer.description_fr}</p>
                      )}
                      
                      {/* Features list (collapsed) */}
                      {features?.features && features.features.length > 0 && (
                        <div className="mt-2">
                          <p className="text-[10px] text-slate-500">
                            {features.features.slice(0, 3).join(" • ")}
                            {features.features.length > 3 && ` +${features.features.length - 3}`}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right ml-3">
                      <p className="text-lg font-bold text-orange-400">
                        {(offer.price_monthly || 0).toFixed(2)} $
                        <span className="text-xs text-slate-400 font-normal">/mois</span>
                      </p>
                      {(offer.price_setup || 0) > 0 && (
                        <p className="text-xs text-slate-500">
                          +{offer.price_setup?.toFixed(2)} $ install.
                        </p>
                      )}
                      {offer.discount_percent && (
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px] mt-1">
                          -{offer.discount_percent}%
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Selection indicator + quantity */}
                  {selected && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <Check className="h-4 w-4" />
                        <span className="text-sm">Sélectionné</span>
                      </div>
                      
                      {offer.category === "mobile" && (
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-400 hover:text-white"
                            onClick={() => updateQuantity(offer.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-white w-6 text-center">{getQuantity(offer.id)}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-400 hover:text-white"
                            onClick={() => updateQuantity(offer.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Cart Summary */}
      {selectedServices.length > 0 && (
        <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-amber-500/10 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm flex items-center justify-between">
              <span>Panier ({selectedServices.length} service{selectedServices.length > 1 ? "s" : ""})</span>
              <span className="text-orange-400">{totals.total.toFixed(2)} $ total</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Mensuel</span>
                <span>{totals.monthlySubtotal.toFixed(2)} $</span>
              </div>
              {totals.activationFee > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Frais d'activation {selectedServices.length > 1 ? "(forfait groupé)" : ""}</span>
                  <span>{totals.activationFee.toFixed(2)} $</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>TPS (5%)</span>
                <span>{totals.tps.toFixed(2)} $</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>TVQ (9.975%)</span>
                <span>{totals.tvq.toFixed(2)} $</span>
              </div>
              <div className="flex justify-between text-white font-bold pt-1 border-t border-slate-700">
                <span>1ère facture</span>
                <span className="text-orange-400">{totals.firstMonthTotal.toFixed(2)} $</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Récurrent mensuel</span>
                <span>{totals.recurringMonthly.toFixed(2)} $</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
