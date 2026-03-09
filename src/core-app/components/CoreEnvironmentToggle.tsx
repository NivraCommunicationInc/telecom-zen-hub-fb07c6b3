/**
 * CoreEnvironmentToggle — shared live/test/all filter for Core list pages.
 */
import type { EnvironmentFilter } from "@/core-app/hooks/useEnvironmentFilter";
import { cn } from "@/lib/utils";

const OPTIONS: { value: EnvironmentFilter; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "test", label: "Test" },
  { value: "all", label: "Tout" },
];

interface Props {
  value: EnvironmentFilter;
  onChange: (v: EnvironmentFilter) => void;
}

export function CoreEnvironmentToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-lg border border-[hsl(220,15%,18%)] bg-[hsl(220,20%,10%)] p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1 text-[11px] font-medium rounded-md transition-colors",
            value === opt.value
              ? opt.value === "test"
                ? "bg-amber-500/20 text-amber-400"
                : opt.value === "live"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-[hsl(220,15%,18%)] text-white"
              : "text-[hsl(220,10%,45%)] hover:text-[hsl(220,10%,65%)]"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Small TEST badge for table rows */
export function TestBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/25">
      TEST
    </span>
  );
}
