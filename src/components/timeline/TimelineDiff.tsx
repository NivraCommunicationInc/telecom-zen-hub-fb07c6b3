/**
 * TimelineDiff — Renders a compact before / after diff for a timeline event.
 * Only shows keys that actually changed between `before` and `after`. Falls
 * back to the raw payload when neither is provided.
 */
import { useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
}

const MASK_KEYS = new Set([
  "client_pin_hash",
  "pin_hash",
  "password",
  "password_hash",
  "otp",
  "token",
  "access_token",
  "refresh_token",
]);

function fmt(value: unknown): string {
  if (value === null || value === undefined || value === "") return "∅";
  if (typeof value === "string") {
    if (value.length > 80) return value.slice(0, 80) + "…";
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    const s = JSON.stringify(value);
    return s.length > 80 ? s.slice(0, 80) + "…" : s;
  } catch {
    return String(value);
  }
}

function mask(key: string, value: unknown): unknown {
  if (MASK_KEYS.has(key)) return value ? "••••" : value;
  return value;
}

export function TimelineDiff({ before, after, details }: Props) {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const rows = useMemo(() => {
    if (!before && !after) return [];
    const keys = new Set<string>([
      ...Object.keys(before ?? {}),
      ...Object.keys(after ?? {}),
    ]);
    const out: { key: string; from: unknown; to: unknown }[] = [];
    keys.forEach((k) => {
      const a = before?.[k];
      const b = after?.[k];
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        out.push({ key: k, from: mask(k, a), to: mask(k, b) });
      }
    });
    return out;
  }, [before, after]);

  if (rows.length > 0) {
    return (
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.key}
            className="grid grid-cols-[minmax(120px,auto)_1fr_auto_1fr] items-center gap-2 text-[11px]"
          >
            <span className="font-mono text-muted-foreground">{r.key}</span>
            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-300 line-through">
              {fmt(r.from)}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
              {fmt(r.to)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: raw payload
  if (!details || Object.keys(details).length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground italic">
        {isFr ? "Aucun détail supplémentaire." : "No additional details."}
      </p>
    );
  }
  return (
    <pre className="overflow-x-auto rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
      {JSON.stringify(details, null, 2)}
    </pre>
  );
}

export default TimelineDiff;
