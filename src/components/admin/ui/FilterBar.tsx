/**
 * FilterBar — Flat operational toolbar (NO card container)
 * Search + inline filters + right-side actions
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
  resultCount?: number;
  resultLabel?: string;
  className?: string;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Rechercher…",
  children,
  actions,
  resultCount,
  resultLabel = "résultat",
  className,
}: FilterBarProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Main toolbar row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm bg-secondary/40 border-border text-foreground placeholder:text-muted-foreground"
          />
          {searchValue && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onSearchChange("")}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Inline filters */}
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

      {/* Result count */}
      {resultCount !== undefined && (
        <div className="text-xs text-muted-foreground border-b border-border/50 pb-2">
          {resultCount} {resultLabel}{resultCount !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
