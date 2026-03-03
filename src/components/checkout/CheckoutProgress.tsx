/**
 * Rogers-style Checkout Progress
 * Minimal step indicator - horizontal numbered steps
 * Green checkmark for completed, bold for current
 */
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  labelFr: string;
  labelEn: string;
}

interface CheckoutProgressProps {
  currentStep: number;
  steps?: Step[];
  isFrench?: boolean;
  onStepClick?: (step: number) => void;
}

const defaultSteps: Step[] = [
  { id: 1, labelFr: "Coordonnées", labelEn: "Contact" },
  { id: 2, labelFr: "Renseignements", labelEn: "Details" },
  { id: 3, labelFr: "Forfait", labelEn: "Plan" },
  { id: 4, labelFr: "Paiement", labelEn: "Payment" },
  { id: 5, labelFr: "Confirmation", labelEn: "Confirmation" },
];

export const CheckoutProgress = ({ 
  currentStep, 
  steps = defaultSteps, 
  isFrench = true,
  onStepClick 
}: CheckoutProgressProps) => {
  return (
    <div className="w-full mb-8">
      {/* Desktop Progress - Rogers style horizontal line */}
      <div className="hidden md:flex items-center">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isClickable = onStepClick && (isCompleted || isCurrent);

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <button
                  onClick={() => isClickable && onStepClick?.(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all border-2",
                    isCompleted && "bg-emerald-500 border-emerald-500 text-white",
                    isCurrent && "bg-white border-slate-900 text-slate-900",
                    !isCompleted && !isCurrent && "bg-white border-slate-300 text-slate-400",
                    isClickable && "cursor-pointer hover:scale-105"
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                </button>
                <span className={cn(
                  "mt-1.5 text-xs font-medium",
                  (isCompleted || isCurrent) ? "text-slate-900" : "text-slate-400"
                )}>
                  {isFrench ? step.labelFr : step.labelEn}
                </span>
              </div>
              
              {index < steps.length - 1 && (
                <div className={cn(
                  "h-0.5 flex-1 mx-1 -mt-5",
                  currentStep > step.id ? "bg-emerald-500" : "bg-slate-200"
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Progress - pill chips */}
      <div className="md:hidden w-full">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" 
             style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {steps.map((step) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            return (
              <div 
                key={step.id}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium flex-shrink-0",
                  isCompleted && "bg-emerald-50 text-emerald-700",
                  isCurrent && "bg-slate-900 text-white",
                  !isCompleted && !isCurrent && "bg-slate-100 text-slate-400"
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : <span>{step.id}</span>}
                <span className="truncate max-w-[70px]">{isFrench ? step.labelFr : step.labelEn}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CheckoutProgress;
