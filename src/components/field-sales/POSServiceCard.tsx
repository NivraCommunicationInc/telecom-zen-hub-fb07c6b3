/**
 * POSServiceCard - Professional POS service card with compatibility awareness
 */
import { Check, Plus, Minus, Zap, Star, Wifi, Tv, Smartphone, Package, AlertTriangle, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { FieldSalesOffer } from "@/hooks/useFieldSalesOffers";

interface POSServiceCardProps {
  offer: FieldSalesOffer;
  isSelected: boolean;
  quantity: number;
  onToggle: () => void;
  onQuantityChange: (delta: number) => void;
  compact?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "internet": return Wifi;
    case "tv": return Tv;
    case "mobile": return Smartphone;
    default: return Package;
  }
};

const getCategoryGradient = (category: string) => {
  switch (category) {
    case "internet": return "from-cyan-500 to-blue-600";
    case "tv": return "from-purple-500 to-pink-600";
    case "mobile": return "from-green-500 to-emerald-600";
    case "bundle": return "from-orange-500 to-amber-600";
    default: return "from-slate-500 to-slate-600";
  }
};

const getCategoryBg = (category: string) => {
  switch (category) {
    case "internet": return "bg-cyan-500/10 border-cyan-500/30";
    case "tv": return "bg-purple-500/10 border-purple-500/30";
    case "mobile": return "bg-emerald-500/10 border-emerald-500/30";
    case "bundle": return "bg-orange-500/10 border-orange-500/30";
    default: return "bg-slate-500/10 border-slate-500/30";
  }
};

export function POSServiceCard({
  offer,
  isSelected,
  quantity,
  onToggle,
  onQuantityChange,
  compact = false,
  disabled = false,
  disabledReason,
}: POSServiceCardProps) {
  const Icon = getCategoryIcon(offer.category);
  const features = offer.features_json as { badge?: string; speed?: string; features?: string[] } | null;
  
  const handleClick = () => {
    if (!disabled) {
      onToggle();
    }
  };

  const cardContent = (
    <div
      className={cn(
        "relative rounded-xl border-2 transition-all overflow-hidden group",
        disabled 
          ? "opacity-50 cursor-not-allowed border-slate-700/30 bg-slate-800/20" 
          : isSelected
            ? "cursor-pointer border-orange-500 bg-gradient-to-br from-orange-500/15 to-amber-500/10 shadow-lg shadow-orange-500/20"
            : "cursor-pointer border-slate-700/50 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800/60 hover:shadow-md"
      )}
      onClick={handleClick}
    >
      {/* Top badges row */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between pointer-events-none">
        {/* Featured badge */}
        {offer.is_featured && !disabled && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[9px] px-2.5 py-0.5 font-bold rounded-br-lg flex items-center gap-1">
            <Star className="h-2.5 w-2.5" />
            POPULAIRE
          </div>
        )}
        {!offer.is_featured && <div />}
        
        {/* Discount badge */}
        {offer.discount_percent && offer.discount_percent > 0 && !disabled && (
          <div className="bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[9px] px-2.5 py-0.5 font-bold rounded-bl-lg">
            -{offer.discount_percent}%
          </div>
        )}
      </div>

      {/* Disabled overlay */}
      {disabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 z-10">
          <div className="flex items-center gap-2 text-slate-400 bg-slate-800/80 px-3 py-2 rounded-lg">
            <Lock className="h-4 w-4" />
            <span className="text-xs font-medium">Non disponible</span>
          </div>
        </div>
      )}

      <div className={cn("p-4", compact && "p-3", (offer.is_featured || (offer.discount_percent && offer.discount_percent > 0)) && "pt-6")}>
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          {/* Category icon */}
          <div className={cn(
            "p-2.5 rounded-xl bg-gradient-to-br text-white shrink-0 shadow-lg",
            getCategoryGradient(offer.category)
          )}>
            <Icon className="h-5 w-5" />
          </div>
          
          {/* Name and speed */}
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "text-white font-bold leading-tight",
              compact ? "text-sm" : "text-base",
              "line-clamp-2"
            )}>
              {offer.name_fr}
            </h3>
            {features?.speed && (
              <div className="flex items-center gap-1.5 mt-1">
                <Zap className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-sm font-semibold text-cyan-400">{features.speed}</span>
              </div>
            )}
          </div>

          {/* Selection indicator */}
          {isSelected && (
            <div className="shrink-0">
              <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Check className="h-4 w-4 text-white" />
              </div>
            </div>
          )}
        </div>

        {/* Features preview */}
        {!compact && features?.features && features.features.length > 0 && (
          <div className="mb-3 space-y-1">
            {features.features.slice(0, 3).map((feat, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <div className="w-1 h-1 rounded-full bg-slate-500 mt-1.5 shrink-0" />
                <span className="line-clamp-1">{feat}</span>
              </div>
            ))}
            {features.features.length > 3 && (
              <p className="text-[10px] text-slate-500 pl-3">+{features.features.length - 3} autres avantages</p>
            )}
          </div>
        )}

        {/* Price section */}
        <div className={cn(
          "flex items-end justify-between pt-3 border-t",
          isSelected ? "border-orange-500/30" : "border-slate-700/50"
        )}>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black text-white">
                {(offer.price_monthly || 0).toFixed(2)}
              </span>
              <span className="text-sm text-slate-400">$/mois</span>
            </div>
            {(offer.price_setup || 0) > 0 && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                +{offer.price_setup?.toFixed(2)}$ frais installation
              </p>
            )}
          </div>

          {/* Quantity controls for mobile */}
          {isSelected && offer.category === "mobile" && (
            <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700" onClick={e => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700"
                onClick={(e) => { e.stopPropagation(); onQuantityChange(-1); }}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-white font-bold w-8 text-center">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-700"
                onClick={(e) => { e.stopPropagation(); onQuantityChange(1); }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Add button for non-selected */}
          {!isSelected && !disabled && (
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-400 text-white font-bold shadow-lg shadow-orange-500/20"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  // Wrap in tooltip if disabled with reason
  if (disabled && disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {cardContent}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs bg-slate-800 border-slate-700 text-white">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs">{disabledReason}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}
