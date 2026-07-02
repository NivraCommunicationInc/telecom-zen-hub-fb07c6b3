/**
 * Nivra Telecom Checkout Progress — Bell/Rogers/Telus grade
 * Numbered steps with connector, blue active / green complete / grey future
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
  onStepClick,
}: CheckoutProgressProps) => {
  return (
    <div className="w-full mb-6 bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-5 lg:p-6">
      {/* Desktop */}
      <div className="hidden md:flex items-start">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isClickable = onStepClick && (isCompleted || isCurrent);

          return (
            <div key={step.id} className="flex items-start flex-1">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <button
                  onClick={() => isClickable && onStepClick?.(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all border-2",
                    isCompleted && "bg-[#00A651] border-[#00A651] text-white shadow-sm",
                    isCurrent && "bg-[#0066CC] border-[#0066CC] text-white shadow-md ring-4 ring-[#0066CC]/15",
                    !isCompleted && !isCurrent && "bg-white border-[#E5E7EB] text-[#6B7280]",
                    isClickable && "cursor-pointer hover:scale-105",
                  )}
                >
                  {isCompleted ? <Check className="w-5 h-5" /> : step.id}
                </button>
                <span
                  className={cn(
                    "mt-2 text-xs font-semibold text-center leading-tight",
                    isCompleted && "text-[#00A651]",
                    isCurrent && "text-[#0066CC]",
                    !isCompleted && !isCurrent && "text-[#6B7280]",
                  )}
                >
                  {isFrench ? step.labelFr : step.labelEn}
                </span>
              </div>

              {index < steps.length - 1 && (
                <div className="h-0.5 flex-1 mx-1 mt-5 rounded-full bg-[#E5E7EB] overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-500",
                      currentStep > step.id ? "bg-[#00A651] w-full" : "w-0",
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
            {isFrench ? "Étape" : "Step"} {currentStep} / {steps.length}
          </span>
          <span className="text-sm font-semibold text-[#0066CC]">
            {isFrench
              ? steps.find((s) => s.id === currentStep)?.labelFr
              : steps.find((s) => s.id === currentStep)?.labelEn}
          </span>
        </div>
        <div className="w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#0066CC] transition-all duration-500 rounded-full"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {steps.map((step) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0 border",
                  isCompleted && "bg-[#00A651]/10 text-[#00A651] border-[#00A651]/30",
                  isCurrent && "bg-[#0066CC] text-white border-[#0066CC]",
                  !isCompleted && !isCurrent && "bg-white text-[#6B7280] border-[#E5E7EB]",
                )}
              >
                {isCompleted ? <Check className="w-3 h-3" /> : <span>{step.id}</span>}
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
