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
  { id: 1, labelFr: "Adresse", labelEn: "Address" },
  { id: 2, labelFr: "Forfait", labelEn: "Plan" },
  { id: 3, labelFr: "Options", labelEn: "Options" },
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
    <div className="w-full">
      {/* Desktop Progress */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between">
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
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200",
                      isCompleted && "bg-primary text-primary-foreground",
                      isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                      !isCompleted && !isCurrent && "bg-muted text-muted-foreground",
                      isClickable && "cursor-pointer hover:scale-105"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step.id
                    )}
                  </button>
                  <span 
                    className={cn(
                      "mt-2 text-xs font-medium transition-colors",
                      (isCompleted || isCurrent) ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {isFrench ? step.labelFr : step.labelEn}
                  </span>
                </div>
                
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div 
                    className={cn(
                      "h-0.5 flex-1 mx-2 transition-colors",
                      currentStep > step.id ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile Progress - contained horizontal scroll, no page-level overflow */}
      <div className="md:hidden w-full max-w-full">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {steps.map((step) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div 
                key={step.id}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-all",
                  isCompleted && "bg-primary/10 text-primary",
                  isCurrent && "bg-primary text-primary-foreground",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <span>{step.id}</span>
                )}
                <span className="truncate max-w-[60px]">{isFrench ? step.labelFr : step.labelEn}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CheckoutProgress;
