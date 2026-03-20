/**
 * Step indicator for the guided sale flow.
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
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {STEP_ORDER.map((step, i) => {
        const isCompleted = completedSteps.includes(step);
        const isCurrent = step === currentStep;
        const isPast = i < currentIdx;
        const canClick = onStepClick && (isCompleted || isPast);

        return (
          <div key={step} className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onStepClick(step)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                isCurrent && "bg-[#22C55E] text-white",
                (isPast || isCompleted) && !isCurrent && "bg-[#F0FDF4] text-[#16A34A]",
                !isCurrent && !isPast && !isCompleted && "bg-[#F3F4F6] text-[#9CA3AF]",
                canClick && "cursor-pointer hover:opacity-80",
                !canClick && !isCurrent && "cursor-default"
              )}
            >
              {(isPast || isCompleted) && !isCurrent ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className="h-4 w-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold border-current">
                  {i + 1}
                </span>
              )}
              <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
            </button>
            {i < STEP_ORDER.length - 1 && (
              <div className={cn(
                "w-4 h-0.5 rounded-full flex-shrink-0",
                i < currentIdx ? "bg-[#22C55E]" : "bg-[#E5E7EB]"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
