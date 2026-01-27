/**
 * POSCategoryTabs - Premium category navigation for POS
 */
import { Wifi, Tv, Smartphone, Package, LayoutGrid, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export type POSCategory = "all" | "internet" | "tv" | "mobile" | "bundle";

interface CategoryConfig {
  id: POSCategory;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  gradient: string;
  activeGradient: string;
  iconBg: string;
}

const CATEGORIES: CategoryConfig[] = [
  { 
    id: "all", 
    label: "Tous les services", 
    shortLabel: "Tous",
    icon: LayoutGrid, 
    gradient: "from-slate-600 to-slate-700",
    activeGradient: "from-orange-500 to-amber-500",
    iconBg: "bg-slate-600"
  },
  { 
    id: "internet", 
    label: "Internet", 
    shortLabel: "Internet",
    icon: Wifi, 
    gradient: "from-cyan-600 to-blue-600",
    activeGradient: "from-cyan-500 to-blue-500",
    iconBg: "bg-cyan-500"
  },
  { 
    id: "tv", 
    label: "TV + Internet", 
    shortLabel: "TV",
    icon: Tv, 
    gradient: "from-purple-600 to-pink-600",
    activeGradient: "from-purple-500 to-pink-500",
    iconBg: "bg-purple-500"
  },
  { 
    id: "mobile", 
    label: "Mobile", 
    shortLabel: "Mobile",
    icon: Smartphone, 
    gradient: "from-emerald-600 to-green-600",
    activeGradient: "from-emerald-500 to-green-500",
    iconBg: "bg-emerald-500"
  },
  { 
    id: "bundle", 
    label: "Forfaits Combo", 
    shortLabel: "Combo",
    icon: Package, 
    gradient: "from-orange-600 to-amber-600",
    activeGradient: "from-orange-500 to-amber-500",
    iconBg: "bg-orange-500"
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
  const totalSelected = Object.values(selectedCounts).reduce((sum, c) => sum + c, 0);

  return (
    <div className="border-b border-slate-700/50 bg-slate-900/30 backdrop-blur-sm">
      <ScrollArea className="w-full">
        <div className="flex gap-2 p-3">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            const selectedCount = cat.id === "all" 
              ? totalSelected
              : selectedCounts[cat.id] || 0;
            const offerCount = counts?.[cat.id] || 0;

            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                className={cn(
                  "relative flex items-center gap-2.5 px-4 py-3 rounded-xl transition-all whitespace-nowrap shrink-0",
                  "border-2 font-semibold",
                  isActive
                    ? `border-transparent bg-gradient-to-r ${cat.activeGradient} text-white shadow-lg`
                    : "border-slate-700/50 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-white hover:bg-slate-800"
                )}
              >
                {/* Icon */}
                <div className={cn(
                  "p-1.5 rounded-lg",
                  isActive ? "bg-white/20" : cat.iconBg + "/20"
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                
                {/* Label */}
                <span className="text-sm hidden sm:block">{cat.label}</span>
                <span className="text-sm sm:hidden">{cat.shortLabel}</span>

                {/* Selected count badge */}
                {selectedCount > 0 && (
                  <Badge 
                    className={cn(
                      "h-5 min-w-5 p-0 flex items-center justify-center text-[10px] font-bold",
                      isActive 
                        ? "bg-white text-orange-600" 
                        : "bg-orange-500 text-white"
                    )}
                  >
                    {selectedCount}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  );
}
