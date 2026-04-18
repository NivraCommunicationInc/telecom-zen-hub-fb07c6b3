/**
 * CoreWorkflowNav — Dark-native step navigation for order processing
 * Ops-grade vertical stepper with status indicators and progress tracking
 */
import { cn } from "@/lib/utils";
import { WorkflowStep, WorkflowStepId } from "@/core-app/hooks/useOrderProcessing";
import { CheckCircle2, Circle, AlertTriangle, ChevronRight } from "lucide-react";

interface Props {
  steps: WorkflowStep[];
  activeStep: WorkflowStepId;
  onStepClick: (id: WorkflowStepId) => void;
}

export function CoreWorkflowNav({ steps, activeStep, onStepClick }: Props) {
  const completedCount = steps.filter(s => s.status === "completed").length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div className="rounded-xl border border-core-border bg-core-card overflow-hidden">
      {/* Header with progress */}
      <div className="px-3.5 py-3 border-b border-core-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-core-muted">
            Étapes
          </h3>
          <span className="text-[10px] font-mono text-core-accent tabular-nums">
            {completedCount}/{steps.length}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1 rounded-full bg-core-border overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-core-accent to-core-accent-soft transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <nav className="p-1.5 space-y-0.5">
        {steps.map((step, idx) => {
          const isActive = step.id === activeStep;
          const isCompleted = step.status === "completed";
          const isBlocked = step.status === "blocked";

          return (
            <button
              key={step.id}
              onClick={() => onStepClick(step.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-150 group",
                isActive
                  ? "bg-core-accent/15 border border-core-accent/30"
                  : "border border-transparent hover:bg-core-card-raised hover:border-core-border"
              )}
            >
              {/* Status icon */}
              <span className="shrink-0">
                {isActive ? (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-core-accent text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                ) : isCompleted ? (
                  <CheckCircle2 className="w-[18px] h-[18px] text-core-success" />
                ) : isBlocked ? (
                  <AlertTriangle className="w-[18px] h-[18px] text-core-danger" />
                ) : (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full border border-core-border-strong text-[10px] font-medium text-core-muted">
                    {idx + 1}
                  </span>
                )}
              </span>

              {/* Label */}
              <span
                className={cn(
                  "text-[12px] truncate flex-1",
                  isActive
                    ? "text-core-accent font-semibold"
                    : isCompleted
                    ? "text-core-fg/70"
                    : isBlocked
                    ? "text-core-danger"
                    : "text-core-muted group-hover:text-core-fg"
                )}
              >
                {step.label}
              </span>

              {/* Optional tag */}
              {step.optional && !isActive && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-core-border text-core-muted-soft uppercase tracking-wider font-medium">
                  opt
                </span>
              )}

              {/* Active indicator */}
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-core-accent shrink-0" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
