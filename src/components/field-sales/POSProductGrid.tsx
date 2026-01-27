/**
 * POSProductGrid - Professional product grid display for POS
 */
import { FieldSalesOffer, SelectedService } from "@/hooks/useFieldSalesOffers";
import { POSServiceCard } from "./POSServiceCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface POSProductGridProps {
  offers: FieldSalesOffer[];
  selectedServices: SelectedService[];
  onToggleService: (offer: FieldSalesOffer) => void;
  onQuantityChange: (offerId: string, delta: number) => void;
  isMobile?: boolean;
  emptyMessage?: string;
}

export function POSProductGrid({
  offers,
  selectedServices,
  onToggleService,
  onQuantityChange,
  isMobile = false,
  emptyMessage = "Aucun service disponible",
}: POSProductGridProps) {
  const isSelected = (offerId: string) => selectedServices.some(s => s.offerId === offerId);
  const getQuantity = (offerId: string) => {
    const service = selectedServices.find(s => s.offerId === offerId);
    return service?.quantity || 0;
  };

  if (offers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
          <Search className="h-8 w-8 text-slate-600" />
        </div>
        <p className="text-slate-400 text-center font-medium">{emptyMessage}</p>
        <p className="text-slate-500 text-sm text-center mt-1">
          Essayez de modifier vos filtres ou votre recherche
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4">
        <div className={cn(
          "grid gap-3",
          isMobile ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-3"
        )}>
          {offers.map(offer => (
            <POSServiceCard
              key={offer.id}
              offer={offer}
              isSelected={isSelected(offer.id)}
              quantity={getQuantity(offer.id)}
              onToggle={() => onToggleService(offer)}
              onQuantityChange={(delta) => onQuantityChange(offer.id, delta)}
              compact={isMobile}
            />
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
