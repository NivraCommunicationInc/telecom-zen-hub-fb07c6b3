import React from "react";
import { cn } from "@/lib/utils";
import {
  Layers,
  ShoppingCart,
  CreditCard,
  Users,
  Ticket,
  Settings,
} from "lucide-react";

export type ActivityFilterCategory =
  | "all"
  | "orders"
  | "payments"
  | "clients"
  | "tickets"
  | "system";

interface FilterTab {
  id: ActivityFilterCategory;
  label: string;
  icon: React.ElementType;
  color: string;
}

const FILTER_TABS: FilterTab[] = [
  { id: "all", label: "Tout", icon: Layers, color: "text-primary" },
  { id: "orders", label: "Commandes", icon: ShoppingCart, color: "text-amber-600" },
  { id: "payments", label: "Paiements", icon: CreditCard, color: "text-emerald-600" },
  { id: "clients", label: "Clients", icon: Users, color: "text-blue-600" },
  { id: "tickets", label: "Tickets", icon: Ticket, color: "text-orange-600" },
  { id: "system", label: "Système", icon: Settings, color: "text-slate-600" },
];

interface ActivityFilterTabsProps {
  activeFilter: ActivityFilterCategory;
  onFilterChange: (filter: ActivityFilterCategory) => void;
  counts?: Record<ActivityFilterCategory, number>;
}

export const ActivityFilterTabs: React.FC<ActivityFilterTabsProps> = ({
  activeFilter,
  onFilterChange,
  counts,
}) => {
  return (
    <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg overflow-x-auto">
      {FILTER_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeFilter === tab.id;
        const count = counts?.[tab.id];

        return (
          <button
            key={tab.id}
            onClick={() => onFilterChange(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
              isActive
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4",
                isActive ? tab.color : "text-muted-foreground"
              )}
            />
            <span>{tab.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  "ml-1 px-1.5 py-0.5 text-[10px] rounded-full",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ActivityFilterTabs;
