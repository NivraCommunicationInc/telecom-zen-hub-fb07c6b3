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
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] overflow-hidden">
      {/* Header with progress */}
      <div className="px-3.5 py-3 border-b border-[hsl(220,15%,14%)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(220,10%,40%)]">
            Traitement
          </h3>
          <span className="text-[10px] font-mono text-emerald-400 tabular-nums">
            {completedCount}/{steps.length}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1 rounded-full bg-[hsl(220,15%,14%)] overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
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
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left transition-all duration-150 group",
                isActive
                  ? "bg-emerald-600/15 border border-emerald-500/25"
                  : "border border-transparent hover:bg-[hsl(220,15%,14%)] hover:border-[hsl(220,15%,20%)]"
              )}
            >
              {/* Status icon */}
              <span className="shrink-0">
                {isActive ? (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                    {idx + 1}
                  </span>
                ) : isCompleted ? (
                  <CheckCircle2 className="w-[18px] h-[18px] text-emerald-500" />
                ) : isBlocked ? (
                  <AlertTriangle className="w-[18px] h-[18px] text-red-400" />
                ) : (
                  <span className="flex items-center justify-center w-5 h-5 rounded-full border border-[hsl(220,15%,25%)] text-[10px] font-medium text-[hsl(220,10%,40%)]">
                    {idx + 1}
                  </span>
                )}
              </span>

              {/* Label */}
              <span
                className={cn(
                  "text-[12px] truncate flex-1",
                  isActive
                    ? "text-emerald-400 font-semibold"
                    : isCompleted
                    ? "text-[hsl(220,10%,60%)]"
                    : isBlocked
                    ? "text-red-400"
                    : "text-[hsl(220,10%,50%)] group-hover:text-[hsl(220,10%,70%)]"
                )}
              >
                {step.label}
              </span>

              {/* Optional tag */}
              {step.optional && !isActive && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(220,15%,14%)] text-[hsl(220,10%,35%)] uppercase tracking-wider font-medium">
                  opt
                </span>
              )}

              {/* Active indicator */}
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
