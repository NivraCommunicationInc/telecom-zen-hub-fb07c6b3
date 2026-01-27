/**
 * POSCategoryTabs - Category filter tabs for POS interface
 */
import { Wifi, Tv, Smartphone, Package, Grid3X3, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type POSCategory = "all" | "internet" | "tv" | "mobile" | "bundle";

interface CategoryConfig {
  id: POSCategory;
  label: string;
  icon: React.ElementType;
  color: string;
  gradient: string;
}

const CATEGORIES: CategoryConfig[] = [
  { 
    id: "all", 
    label: "Tous", 
    icon: Grid3X3, 
    color: "text-slate-400",
    gradient: "from-slate-500 to-slate-600"
  },
  { 
    id: "internet", 
    label: "Internet", 
    icon: Wifi, 
    color: "text-cyan-400",
    gradient: "from-cyan-500 to-blue-600"
  },
  { 
    id: "tv", 
    label: "TV", 
    icon: Tv, 
    color: "text-purple-400",
    gradient: "from-purple-500 to-pink-600"
  },
  { 
    id: "mobile", 
    label: "Mobile", 
    icon: Smartphone, 
    color: "text-green-400",
    gradient: "from-green-500 to-emerald-600"
  },
  { 
    id: "bundle", 
    label: "Forfaits", 
    icon: Package, 
    color: "text-orange-400",
    gradient: "from-orange-500 to-amber-600"
  },
];

interface POSCategoryTabsProps {
  activeCategory: POSCategory;
  onCategoryChange: (category: POSCategory) => void;
  counts?: Record<POSCategory, number>;
  selectedCounts?: Record<string, number>;
}

export function POSCategoryTabs({ 
  activeCategory, 
  onCategoryChange, 
  counts,
  selectedCounts = {},
}: POSCategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-4 scrollbar-hide">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;
        const count = counts?.[cat.id] || 0;
        const selectedCount = cat.id === "all" 
          ? Object.values(selectedCounts).reduce((sum, c) => sum + c, 0)
          : selectedCounts[cat.id] || 0;

        return (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all whitespace-nowrap shrink-0",
              isActive
                ? `border-transparent bg-gradient-to-r ${cat.gradient} text-white shadow-lg`
                : "border-slate-700/50 bg-slate-800/30 text-slate-400 hover:border-slate-600 hover:text-white"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium">{cat.label}</span>
            {selectedCount > 0 && (
              <Badge 
                className={cn(
                  "h-5 min-w-5 p-0 flex items-center justify-center text-[10px]",
                  isActive 
                    ? "bg-white/20 text-white" 
                    : "bg-orange-500/20 text-orange-400"
                )}
              >
                {selectedCount}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
