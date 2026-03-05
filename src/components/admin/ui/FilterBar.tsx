/**
 * FilterBar — Search + filters bar for admin list pages
 */
import { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode; // Filter selects, buttons etc.
  actions?: ReactNode; // Right-side actions (Create, Export)
  className?: string;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Rechercher…",
  children,
  actions,
  className,
}: FilterBarProps) {
  return (
    <div className={cn(
      "flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl border border-border bg-card",
      className
    )}>
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 h-10 text-sm bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground"
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onSearchChange("")}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Filters */}
      {children && (
        <div className="flex items-center gap-2 flex-wrap">
          {children}
        </div>
      )}

      {/* Right actions */}
      {actions && (
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
