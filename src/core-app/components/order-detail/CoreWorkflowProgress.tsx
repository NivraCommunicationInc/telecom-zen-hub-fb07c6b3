/**
 * CoreWorkflowProgress — Horizontal top progress bar for order processing.
 *
 * Renders all 11 workflow steps as numbered pills along a horizontal track
 * with connecting lines, status colors (completed/active/blocked/pending),
 * and a global progress percentage. Clicking a pill jumps to that step.
 *
 * Pairs with the vertical CoreWorkflowNav sidebar in CoreOrderDetail.
 */
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { WorkflowStep, WorkflowStepId } from "@/core-app/hooks/useOrderProcessing";

interface Props {
  steps: WorkflowStep[];
  activeStep: WorkflowStepId;
  onStepClick: (id: WorkflowStepId) => void;
}

export function CoreWorkflowProgress({ steps, activeStep, onStepClick }: Props) {
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div className="rounded-xl border border-core-border bg-core-card p-4">
      {/* Top row: title + progress text */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-core-muted">
            Progression du dossier
          </h2>
          <p className="text-[10px] text-core-muted-soft mt-0.5">
            {completedCount} sur {steps.length} étapes complétées
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-32 rounded-full bg-core-border overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-core-accent to-core-accent-soft transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[11px] font-mono font-semibold text-core-accent tabular-nums">
            {progress}%
          </span>
        </div>
      </div>

      {/* Horizontal step rail */}
      <div className="flex items-center gap-0 overflow-x-auto pb-1 -mx-1 px-1">
        {steps.map((step, idx) => {
          const isActive = step.id === activeStep;
          const isCompleted = step.status === "completed";
          const isBlocked = step.status === "blocked";
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center shrink-0">
              <button
                onClick={() => onStepClick(step.id)}
                title={step.label}
                className={cn(
                  "group flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-all duration-150",
                  isActive ? "bg-core-accent/10" : "hover:bg-core-card-raised"
                )}
              >
                {/* Numbered circle */}
                <span
                  className={cn(
                    "flex items-center justify-center w-7 h-7 rounded-full border-2 text-[11px] font-bold transition-all",
                    isActive &&
                      "bg-core-accent border-core-accent text-white shadow-[0_0_16px_-4px_hsl(var(--core-accent)/0.6)]",
                    !isActive && isCompleted &&
                      "bg-core-success/15 border-core-success text-core-success",
                    !isActive && !isCompleted && isBlocked &&
                      "bg-core-danger/15 border-core-danger text-core-danger",
                    !isActive && !isCompleted && !isBlocked &&
                      "bg-core-bg border-core-border text-core-muted group-hover:border-core-accent/40 group-hover:text-core-fg"
                  )}
                >
                  {isCompleted && !isActive ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : isBlocked && !isActive ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : (
                    idx + 1
                  )}
                </span>

                {/* Label */}
                <span
                  className={cn(
                    "text-[10px] font-medium whitespace-nowrap max-w-[88px] truncate",
                    isActive
                      ? "text-core-accent font-semibold"
                      : isCompleted
                      ? "text-core-fg/80"
                      : isBlocked
                      ? "text-core-danger"
                      : "text-core-muted group-hover:text-core-fg"
                  )}
                >
                  {step.label}
                </span>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "h-[2px] w-6 mx-0.5 rounded-full transition-colors",
                    isCompleted ? "bg-core-success/40" : "bg-core-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CoreWorkflowProgress;
