/**
 * ActionBar — Grouped action buttons with hierarchy
 * Primary action = solid, secondary = outline, danger = destructive
 */
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ActionBarProps {
  children: ReactNode;
  className?: string;
  align?: "left" | "right" | "between";
}

export function ActionBar({ children, className, align = "right" }: ActionBarProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 flex-wrap",
      align === "right" && "justify-end",
      align === "left" && "justify-start",
      align === "between" && "justify-between",
      className
    )}>
      {children}
    </div>
  );
}
