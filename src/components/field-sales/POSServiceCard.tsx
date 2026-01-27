/**
 * POSServiceCard - Quick-tap service card for POS interface
 */
import { Check, Plus, Minus, Zap, Star, Wifi, Tv, Smartphone, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FieldSalesOffer } from "@/hooks/useFieldSalesOffers";

interface POSServiceCardProps {
  offer: FieldSalesOffer;
  isSelected: boolean;
  quantity: number;
  onToggle: () => void;
  onQuantityChange: (delta: number) => void;
  compact?: boolean;
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
    case "internet": return "from-cyan-500 to-blue-600";
    case "tv": return "from-purple-500 to-pink-600";
    case "mobile": return "from-green-500 to-emerald-600";
    case "bundle": return "from-orange-500 to-amber-600";
    default: return "from-slate-500 to-slate-600";
  }
};

export function POSServiceCard({
  offer,
  isSelected,
  quantity,
  onToggle,
  onQuantityChange,
  compact = false,
}: POSServiceCardProps) {
  const Icon = getCategoryIcon(offer.category);
  const features = offer.features_json as { badge?: string; speed?: string; features?: string[] } | null;
  
  return (
    <div
      className={cn(
        "relative rounded-xl border-2 transition-all cursor-pointer overflow-hidden group",
        isSelected
          ? "border-orange-500 bg-orange-500/10 shadow-lg shadow-orange-500/20"
          : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50"
      )}
      onClick={onToggle}
    >
      {/* Featured badge */}
      {offer.is_featured && (
        <div className="absolute top-0 right-0">
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[9px] px-2 py-0.5 font-bold rounded-bl-lg">
            <Star className="h-2.5 w-2.5 inline mr-0.5" />
            TOP
          </div>
        </div>
      )}

      {/* Discount badge */}
      {offer.discount_percent && offer.discount_percent > 0 && (
        <div className="absolute top-0 left-0">
          <div className="bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[9px] px-2 py-0.5 font-bold rounded-br-lg">
            -{offer.discount_percent}%
          </div>
        </div>
      )}

      <div className={cn("p-3", compact && "p-2.5")}>
        {/* Header */}
        <div className="flex items-start gap-2.5 mb-2">
          <div className={cn(
            "p-2 rounded-lg bg-gradient-to-br text-white shrink-0",
            getCategoryColor(offer.category)
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "text-white font-semibold leading-tight line-clamp-2",
              compact ? "text-sm" : "text-sm"
            )}>
              {offer.name_fr}
            </h3>
            {features?.speed && (
              <p className="text-xs text-cyan-400 font-medium mt-0.5 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {features.speed}
              </p>
            )}
          </div>
        </div>

        {/* Features preview */}
        {!compact && features?.features && features.features.length > 0 && (
          <div className="mb-2 pl-10">
            <p className="text-[10px] text-slate-400 line-clamp-2">
              {features.features.slice(0, 2).join(" • ")}
            </p>
          </div>
        )}

        {/* Price section */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xl font-bold text-white">
              {(offer.price_monthly || 0).toFixed(2)}
              <span className="text-sm text-slate-400 font-normal">$/mois</span>
            </p>
            {(offer.price_setup || 0) > 0 && (
              <p className="text-[10px] text-slate-500">
                +{offer.price_setup?.toFixed(2)}$ installation
              </p>
            )}
          </div>

          {/* Selection indicator */}
          {isSelected && (
            <div className="flex items-center gap-1">
              {offer.category === "mobile" && (
                <div className="flex items-center bg-slate-800 rounded-lg" onClick={e => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-white"
                    onClick={(e) => { e.stopPropagation(); onQuantityChange(-1); }}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-white font-medium w-5 text-center text-sm">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-white"
                    onClick={(e) => { e.stopPropagation(); onQuantityChange(1); }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
