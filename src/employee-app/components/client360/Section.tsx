/**
 * Section — Reusable collapsible card section for Client 360.
 */
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  locked?: boolean;
  defaultOpen?: boolean;
  badge?: string | number;
  badgeColor?: string;
}

export function Section({ title, icon, children, locked, defaultOpen = true, badge, badgeColor }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-[hsl(220,15%,12%)] bg-[hsl(220,20%,8%)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left"
      >
        {open ? <ChevronDown className="h-3 w-3 text-[hsl(220,10%,30%)]" /> : <ChevronRight className="h-3 w-3 text-[hsl(220,10%,30%)]" />}
        <span className="text-[hsl(220,10%,38%)]">{icon}</span>
        <h3 className="text-xs font-semibold text-[hsl(220,10%,55%)] uppercase tracking-wider">{title}</h3>
        {badge != null && (
          <span className={cn(
            "ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold",
            badgeColor ?? "text-blue-400 bg-blue-500/10"
          )}>
            {badge}
          </span>
        )}
        {locked && (
          <span className="ml-auto text-[9px] text-[hsl(220,10%,28%)] bg-[hsl(220,15%,11%)] px-1.5 py-0.5 rounded font-mono">
            LECTURE SEULE
          </span>
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
