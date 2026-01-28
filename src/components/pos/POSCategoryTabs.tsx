import { Wifi, Tv, Smartphone, Package, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export type POSCategory = "all" | "internet" | "tv" | "mobile" | "bundle";

interface POSCategoryTabsProps {
  activeCategory: POSCategory;
  onCategoryChange: (category: POSCategory) => void;
  selectedCounts: Record<string, number>;
}

const categories: { id: POSCategory; label: string; icon: any; color: string }[] = [
  { id: "all", label: "Tous les services", icon: LayoutGrid, color: "from-orange-500 to-amber-500" },
  { id: "internet", label: "Internet", icon: Wifi, color: "from-cyan-500 to-blue-600" },
  { id: "tv", label: "TV + Internet", icon: Tv, color: "from-purple-500 to-pink-600" },
  { id: "mobile", label: "Mobile", icon: Smartphone, color: "from-green-500 to-emerald-600" },
  { id: "bundle", label: "Forfaits Combo", icon: Package, color: "from-orange-500 to-red-600" },
];

export function POSCategoryTabs({ activeCategory, onCategoryChange, selectedCounts }: POSCategoryTabsProps) {
  return (
    <div className="border-b border-slate-700/50 bg-slate-900/30">
      <ScrollArea className="w-full">
        <div className="flex items-center gap-2 p-3">
          {categories.map(cat => {
            const Icon = cat.icon;
            const count = cat.id === "all" 
              ? Object.values(selectedCounts).reduce((a, b) => a + b, 0) 
              : selectedCounts[cat.id] || 0;
            const isActive = activeCategory === cat.id;
            
            return (
              <Button
                key={cat.id}
                variant="ghost"
                onClick={() => onCategoryChange(cat.id)}
                className={cn(
                  "shrink-0 h-10 px-4 rounded-full transition-all",
                  isActive
                    ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                    : "bg-slate-800/50 text-slate-400 hover:text-white border border-slate-700/50"
                )}
              >
                <Icon className="h-4 w-4 mr-2" />
                {cat.label}
                {count > 0 && (
                  <Badge className="ml-2 h-5 min-w-5 p-0 flex items-center justify-center bg-white/20 text-white text-[10px]">
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
