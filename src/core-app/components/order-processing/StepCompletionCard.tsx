/**
 * StepCompletionCard — green "Complété" summary banner shown at the top of a
 * completed step. Renders a label, who/when, and a key-value details grid.
 */
import { CheckCircle2 } from "lucide-react";

export interface CompletionDetail {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}

interface Props {
  title: string;
  by?: string | null;
  at?: string | Date | null;
  details?: CompletionDetail[];
}

function fmtDate(d: string | Date | null | undefined): string | null {
  if (!d) return null;
  try {
    return new Date(d).toLocaleString("fr-CA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(d);
  }
}

export function StepCompletionCard({ title, by, at, details = [] }: Props) {
  const visibleDetails = details.filter(
    (d) => d.value !== null && d.value !== undefined && String(d.value).trim() !== "" && String(d.value) !== "—"
  );
  const formattedAt = fmtDate(at);

  return (
    <div className="bg-green-950/50 border border-green-700/50 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-green-900/60 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-4 w-4 text-green-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-green-300">
              Complété
            </span>
            <span className="text-sm font-medium text-green-100">{title}</span>
          </div>
          {(by || formattedAt) && (
            <p className="text-[11px] text-green-300/70 mt-0.5">
              {by ? <>par <span className="font-medium text-green-200">{by}</span></> : null}
              {by && formattedAt ? " · " : null}
              {formattedAt}
            </p>
          )}
          {visibleDetails.length > 0 && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {visibleDetails.map((d, i) => (
                <div key={i} className="flex justify-between gap-2 text-xs">
                  <span className="text-green-300/70">{d.label}</span>
                  <span
                    className={`text-green-100 font-medium text-right truncate ${
                      d.mono ? "font-mono" : ""
                    }`}
                  >
                    {String(d.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
