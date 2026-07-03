/**
 * CoaxialSurvey — shared 3-question coaxial cable questionnaire used
 * before scheduling an installation. Result is stored on
 * `orders.coaxial_survey` for the technician to see.
 */
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Cable } from "lucide-react";

export interface CoaxialAnswers {
  has_outlet: "yes" | "no" | null;
  outlet_works: "yes" | "unknown" | "no" | null;
  outlet_count: number | null;
}

interface Props {
  value: CoaxialAnswers;
  onChange: (v: CoaxialAnswers) => void;
  variant?: "compact" | "full";
  className?: string;
}

const emptyAnswers: CoaxialAnswers = { has_outlet: null, outlet_works: null, outlet_count: null };

export function initialCoaxialAnswers(): CoaxialAnswers {
  return { ...emptyAnswers };
}

export default function CoaxialSurvey({ value, onChange, variant = "compact", className }: Props) {
  const [local, setLocal] = useState<CoaxialAnswers>(value ?? emptyAnswers);
  useEffect(() => setLocal(value ?? emptyAnswers), [value]);

  const patch = (p: Partial<CoaxialAnswers>) => {
    const next = { ...local, ...p };
    setLocal(next);
    onChange(next);
  };

  const isDark = variant === "compact";
  const cardBg = isDark ? "bg-white/5" : "bg-white";
  const border = isDark ? "border-white/10" : "border-neutral-200";
  const textPrim = isDark ? "text-white" : "text-neutral-900";
  const textMuted = isDark ? "text-white/60" : "text-neutral-500";
  const selectedCls = isDark
    ? "border-violet-400 bg-violet-500/20 text-violet-100"
    : "border-violet-600 bg-violet-50 text-violet-900";

  const opt = (active: boolean) =>
    cn(
      "flex-1 h-11 rounded-xl border text-sm font-medium transition-colors",
      active ? selectedCls : cn(cardBg, border, textPrim, "hover:bg-white/10"),
    );

  return (
    <div className={cn("space-y-4", className)}>
      <div className={cn("flex items-start gap-2", textPrim)}>
        <Cable className="h-4 w-4 mt-1 text-violet-400 flex-shrink-0" />
        <p className="text-sm font-semibold">Prise coaxiale</p>
      </div>

      <div className="space-y-1">
        <p className={cn("text-xs", textMuted)}>Avez-vous une prise coaxiale (câble noir rond) chez vous ?</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => patch({ has_outlet: "yes" })} className={opt(local.has_outlet === "yes")}>Oui</button>
          <button type="button" onClick={() => patch({ has_outlet: "no", outlet_works: null, outlet_count: 0 })} className={opt(local.has_outlet === "no")}>Non</button>
        </div>
      </div>

      {local.has_outlet === "yes" && (
        <>
          <div className="space-y-1">
            <p className={cn("text-xs", textMuted)}>La prise est-elle fonctionnelle ?</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => patch({ outlet_works: "yes" })} className={opt(local.outlet_works === "yes")}>Oui</button>
              <button type="button" onClick={() => patch({ outlet_works: "unknown" })} className={opt(local.outlet_works === "unknown")}>Je ne sais pas</button>
              <button type="button" onClick={() => patch({ outlet_works: "no" })} className={opt(local.outlet_works === "no")}>Non</button>
            </div>
          </div>

          <div className="space-y-1">
            <p className={cn("text-xs", textMuted)}>Combien de prises actives dans le logement ?</p>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => patch({ outlet_count: n })}
                  className={cn(
                    "h-10 w-10 rounded-lg border text-sm font-semibold transition-colors",
                    local.outlet_count === n ? selectedCls : cn(cardBg, border, textPrim, "hover:bg-white/10"),
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Returns true if the survey has enough answers to move to the next step. */
export function isCoaxialSurveyComplete(v: CoaxialAnswers): boolean {
  if (v?.has_outlet === "no") return true;
  if (v?.has_outlet === "yes" && v?.outlet_works && (v?.outlet_count ?? 0) > 0) return true;
  return false;
}
