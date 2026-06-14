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
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all border-2",
                    isCompleted && "bg-emerald-500 border-emerald-500 text-white",
                    isCurrent && "border-violet-500 text-white",
                    !isCompleted && !isCurrent && "bg-white/[0.06] border-white/20 text-white/40",
                    isClickable && "cursor-pointer hover:scale-105"
                  )}
                  style={isCurrent ? {
                    background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                    boxShadow: '0 0 0 3px rgba(124,58,237,0.25), 0 4px 12px rgba(124,58,237,0.4)',
                  } : undefined}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                </button>
                <span className={cn(
                  "mt-1.5 text-xs font-semibold",
                  isCompleted && "text-emerald-400",
                  isCurrent && "text-violet-300",
                  !isCompleted && !isCurrent && "text-white/35"
                )}>
                  {isFrench ? step.labelFr : step.labelEn}
                </span>
              </div>
              
              {index < steps.length - 1 && (
                <div
                  className="h-0.5 flex-1 mx-1 -mt-5 rounded-full transition-all duration-500"
                  style={{
                    background: currentStep > step.id
                      ? 'linear-gradient(90deg, #10B981, #059669)'
                      : 'rgba(255,255,255,0.08)',
                  }}
                />
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
                  isCompleted && "bg-emerald-500/15 text-emerald-400",
                  isCurrent && "bg-violet-600 text-white",
                  !isCompleted && !isCurrent && "bg-white/[0.06] text-white/35"
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
