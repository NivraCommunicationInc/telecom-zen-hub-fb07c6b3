/**
 * WorkflowStepNav — Left-side vertical step navigator
 * White background, clear status indicators
 */
import { cn } from "@/lib/utils";
import { WorkflowStep, WorkflowStepId } from "@/hooks/useOrderProcessing";
import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";

interface Props {
  steps: WorkflowStep[];
  activeStep: WorkflowStepId;
  onStepClick: (id: WorkflowStepId) => void;
}

const STATUS_ICON = {
  pending: <Circle className="w-4 h-4 text-gray-400" />,
  completed: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
  blocked: <AlertTriangle className="w-4 h-4 text-red-500" />,
};

export function WorkflowStepNav({ steps, activeStep, onStepClick }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-3">
        Étapes de traitement
      </h3>
      <nav className="space-y-0.5">
        {steps.map((step, idx) => {
          const isActive = step.id === activeStep;
          return (
            <button
              key={step.id}
              onClick={() => onStepClick(step.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left transition-colors text-sm",
                isActive
                  ? "bg-gray-900 text-white font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <span className={cn(isActive && "text-white")}>
                {isActive ? (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white text-gray-900 text-[10px] font-bold">{idx + 1}</span>
                ) : (
                  STATUS_ICON[step.status]
                )}
              </span>
              <span className="truncate">{step.label}</span>
              {step.optional && !isActive && (
                <span className="ml-auto text-[10px] text-gray-400">opt.</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
