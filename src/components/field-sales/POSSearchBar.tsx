/**
 * POSSearchBar - Search and filter for POS catalog
 */
import { useState } from "react";
import { Search, X, Star, Sparkles, Filter } from "lucide-react";
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
  return (
    <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher un service, forfait..."
          className="pl-10 pr-10 bg-slate-800/50 border-slate-600 text-white h-11 placeholder:text-slate-500"
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

      {/* Quick Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <button
          onClick={onFeaturedToggle}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0",
            showFeatured
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600"
          )}
        >
          <Star className="h-3 w-3" />
          Populaires
          {featuredCount > 0 && (
            <Badge className="h-4 min-w-4 p-0 text-[9px] bg-amber-500/30 text-amber-300">
              {featuredCount}
            </Badge>
          )}
        </button>

        <button
          onClick={onDiscountedToggle}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap shrink-0",
            showDiscounted
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : "bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:border-slate-600"
          )}
        >
          <Sparkles className="h-3 w-3" />
          Promos
          {discountedCount > 0 && (
            <Badge className="h-4 min-w-4 p-0 text-[9px] bg-emerald-500/30 text-emerald-300">
              {discountedCount}
            </Badge>
          )}
        </button>
      </div>
    </div>
  );
}
