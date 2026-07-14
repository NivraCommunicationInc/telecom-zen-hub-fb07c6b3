import { STEP_ORDER, STEP_META, stepIndex, type Step } from "@/tech/lib/steps";
import { Check } from "lucide-react";

export function StepRail({ current }: { current: Step }) {
  const currentIdx = stepIndex(current);
  return (
    <aside className="tk-runner__rail">
      <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(var(--tk-fg-dim))", marginBottom: 12, fontWeight: 700 }}>
        Progression
      </div>
      {STEP_ORDER.filter((s) => s !== "closed").map((s, i) => {
        const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "future";
        return (
          <div key={s} className="tk-step-row" data-state={state}>
            <div className="tk-step-num">{state === "done" ? <Check size={14} /> : i + 1}</div>
            <div>{STEP_META[s].short}</div>
          </div>
        );
      })}
    </aside>
  );
}

export function MobileProgress({ current }: { current: Step }) {
  const currentIdx = stepIndex(current);
  const total = STEP_ORDER.length - 1; // exclude 'closed'
  const pct = Math.round((currentIdx / total) * 100);
  return (
    <div className="tk-runner__mobile-progress">
      <span style={{ fontWeight: 700, color: "hsl(var(--tk-fg))" }}>{currentIdx + 1}/{total}</span>
      <div className="tk-progress-bar"><div className="tk-progress-bar__fill" style={{ width: `${pct}%` }} /></div>
      <span>{STEP_META[current].short}</span>
    </div>
  );
}
