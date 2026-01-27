/**
 * POSSearchBar - Enhanced search and filter bar for POS
 */
import { Search, Star, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface POSSearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showFeatured: boolean;
  onFeaturedToggle: () => void;
  showDiscounted: boolean;
  onDiscountedToggle: () => void;
  featuredCount: number;
  discountedCount: number;
}

export function POSSearchBar({
  searchQuery,
  onSearchChange,
  showFeatured,
  onFeaturedToggle,
  showDiscounted,
  onDiscountedToggle,
  featuredCount,
  discountedCount,
}: POSSearchBarProps) {
  const hasActiveFilters = showFeatured || showDiscounted;

  return (
    <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/30">
      <div className="flex items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Rechercher un service..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-10 h-11 bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-orange-500/50 focus:ring-orange-500/20"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-slate-400 hover:text-white"
              onClick={() => onSearchChange("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onFeaturedToggle}
            className={cn(
              "h-11 px-3 border-2 transition-all",
              showFeatured
                ? "border-orange-500 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                : "border-slate-700/50 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-white"
            )}
          >
            <Star className={cn("h-4 w-4 mr-1.5", showFeatured && "fill-current")} />
            <span className="hidden sm:inline">Populaires</span>
            {featuredCount > 0 && (
              <Badge className={cn(
                "ml-1.5 h-5 min-w-5 p-0 flex items-center justify-center text-[10px]",
                showFeatured ? "bg-orange-500 text-white" : "bg-slate-700 text-slate-300"
              )}>
                {featuredCount}
              </Badge>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDiscountedToggle}
            className={cn(
              "h-11 px-3 border-2 transition-all",
              showDiscounted
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                : "border-slate-700/50 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-white"
            )}
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Promos</span>
            {discountedCount > 0 && (
              <Badge className={cn(
                "ml-1.5 h-5 min-w-5 p-0 flex items-center justify-center text-[10px]",
                showDiscounted ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-300"
              )}>
                {discountedCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Active filters indicator */}
      {hasActiveFilters && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-slate-500">Filtres actifs:</span>
          {showFeatured && (
            <Badge 
              variant="outline" 
              className="text-orange-400 border-orange-500/30 bg-orange-500/10 cursor-pointer hover:bg-orange-500/20"
              onClick={onFeaturedToggle}
            >
              <Star className="h-3 w-3 mr-1 fill-current" />
              Populaires
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
          {showDiscounted && (
            <Badge 
              variant="outline" 
              className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 cursor-pointer hover:bg-emerald-500/20"
              onClick={onDiscountedToggle}
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Promos
              <X className="h-3 w-3 ml-1" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
