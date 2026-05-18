/**
 * Step indicator — Dark Navy/Purple, 5 clean steps.
 * Used inside the field portal sale flow.
 */
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { STEP_ORDER, STEP_LABELS, type FieldSaleStep } from "@/field-app/lib/fieldSaleTypes";

interface Props {
  currentStep: FieldSaleStep;
  onStepClick?: (step: FieldSaleStep) => void;
  completedSteps?: FieldSaleStep[];
}

export default function SaleStepIndicator({ currentStep, onStepClick, completedSteps = [] }: Props) {
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  return (
    <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
      {STEP_ORDER.map((step, i) => {
        const isCompleted = completedSteps.includes(step);
        const isCurrent = step === currentStep;
        const isPast = i < currentIdx;
        const canClick = onStepClick && (isCompleted || isPast);
        const reached = isCurrent || isPast || isCompleted;

        return (
          <div key={step} className="flex items-center gap-1 flex-1 min-w-0">
            <button
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onStepClick(step)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap",
                isCurrent && "bg-[hsl(var(--field-accent))] text-white shadow-[0_4px_16px_-4px_hsl(var(--field-accent)/0.6)]",
                (isPast || isCompleted) && !isCurrent &&
                  "bg-[hsl(var(--field-accent)/0.15)] text-[hsl(var(--field-accent-glow))] border border-[hsl(var(--field-accent)/0.3)]",
                !reached && "bg-[hsl(var(--field-card))] text-[hsl(var(--field-text-dim))] border border-[hsl(var(--field-border-subtle))]",
                canClick && "cursor-pointer hover:opacity-90 hover:scale-[1.02]",
                !canClick && !isCurrent && "cursor-default"
              )}
            >
              {(isPast || isCompleted) && !isCurrent ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span
                  className={cn(
                    "h-5 w-5 rounded-full border flex items-center justify-center text-[10px] font-bold",
                    isCurrent ? "border-white/60 bg-gray-800/10" : "border-current"
                  )}
                >
                  {i + 1}
                </span>
              )}
              <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
            </button>
            {i < STEP_ORDER.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1 rounded-full min-w-[12px] transition-colors",
                  i < currentIdx
                    ? "bg-[hsl(var(--field-accent))]"
                    : "bg-[hsl(var(--field-border-subtle))]"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
