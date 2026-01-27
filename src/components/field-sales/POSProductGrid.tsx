/**
 * POSProductGrid - Professional product grid with compatibility checking
 */
import { FieldSalesOffer, SelectedService } from "@/hooks/useFieldSalesOffers";
import { getOfferCompatibilityStatus } from "@/hooks/useServiceCompatibility";
import { POSServiceCard } from "./POSServiceCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Search, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface POSProductGridProps {
  offers: FieldSalesOffer[];
  allOffers: FieldSalesOffer[];
  selectedServices: SelectedService[];
  onToggleService: (offer: FieldSalesOffer) => void;
  onQuantityChange: (offerId: string, delta: number) => void;
  isMobile?: boolean;
  emptyMessage?: string;
}

export function POSProductGrid({
  offers,
  allOffers,
  selectedServices,
  onToggleService,
  onQuantityChange,
  isMobile = false,
  emptyMessage = "Aucun service disponible",
}: POSProductGridProps) {
  const getQuantity = (offerId: string) => {
    const service = selectedServices.find(s => s.offerId === offerId);
    return service?.quantity || 0;
  };

  const handleToggle = (offer: FieldSalesOffer) => {
    const status = getOfferCompatibilityStatus(offer, selectedServices, allOffers);
    
    if (!status.canSelect && !status.isSelected) {
      toast.error("Service incompatible", {
        description: status.incompatibleReason,
        duration: 5000,
      });
      return;
    }
    
    onToggleService(offer);
  };

  if (offers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-20 h-20 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4 border border-slate-700/50">
          <Search className="h-10 w-10 text-slate-600" />
        </div>
        <p className="text-slate-400 text-center font-semibold text-lg">{emptyMessage}</p>
        <p className="text-slate-500 text-sm text-center mt-2 max-w-xs">
          Essayez de modifier vos filtres ou votre recherche pour trouver d'autres services
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4">
        {/* Compatibility warning if services selected */}
        {selectedServices.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-200 font-medium">Règles de compatibilité</p>
                <p className="text-[11px] text-amber-300/70 mt-0.5">
                  Les forfaits TV incluant Internet bloquent l'ajout d'un plan Internet séparé. Un seul forfait TV/Internet par adresse.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className={cn(
          "grid gap-4",
          isMobile ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        )}>
          {offers.map(offer => {
            const status = getOfferCompatibilityStatus(offer, selectedServices, allOffers);
            
            return (
              <POSServiceCard
                key={offer.id}
                offer={offer}
                isSelected={status.isSelected}
                quantity={getQuantity(offer.id)}
                onToggle={() => handleToggle(offer)}
                onQuantityChange={(delta) => onQuantityChange(offer.id, delta)}
                compact={isMobile}
                disabled={!status.canSelect && !status.isSelected}
                disabledReason={status.incompatibleReason}
              />
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
