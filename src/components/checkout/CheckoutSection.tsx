/**
 * Nivra Checkout Section — Bell/Rogers/Telus grade
 * White card, blue title with icon, subtle separator
 */
import { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface CheckoutSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  iconColor?: string;
  children: ReactNode;
  className?: string;
  headerAction?: ReactNode;
  isCompleted?: boolean;
  completedSummary?: ReactNode;
  onEdit?: () => void;
}

export const CheckoutSection = ({
  title,
  description,
  icon: Icon,
  children,
  className,
  headerAction,
  isCompleted = false,
  completedSummary,
  onEdit,
}: CheckoutSectionProps) => {
  if (isCompleted && completedSummary) {
    return (
      <div className={cn("bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-5", className)}>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-[#00A651]/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-[#00A651]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-[#1A1A2E]">{title}</h2>
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="text-sm text-[#0066CC] hover:text-[#0052A3] font-medium hover:underline"
                >
                  Modifier
                </button>
              )}
            </div>
            <div className="mt-1 text-sm text-[#6B7280]">{completedSummary}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className={cn("bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-5 sm:p-6", className)}>
      <header className="mb-5 pb-4 border-b border-[#E5E7EB]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {Icon && (
              <div className="w-9 h-9 rounded-lg bg-[#0066CC]/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-[#0066CC]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-[#1A1A2E] leading-tight">{title}</h2>
              {description && (
                <p className="mt-1 text-sm text-[#6B7280] leading-relaxed">{description}</p>
              )}
            </div>
          </div>
          {headerAction && <div className="flex-shrink-0">{headerAction}</div>}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
};

export default CheckoutSection;
