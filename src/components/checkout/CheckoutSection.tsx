/**
 * Rogers-style Checkout Section
 * Collapsible sections with green checkmark when completed
 * Clean white card with subtle border, no heavy shadows
 */
import { ReactNode, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
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
  /** Section is completed and collapsed with green checkmark */
  isCompleted?: boolean;
  /** Summary text shown when collapsed (e.g. name, email) */
  completedSummary?: ReactNode;
  /** Allow expanding completed sections */
  onEdit?: () => void;
}

export const CheckoutSection = ({
  title,
  description,
  icon: Icon,
  iconColor = "text-slate-600",
  children,
  className,
  headerAction,
  isCompleted = false,
  completedSummary,
  onEdit,
}: CheckoutSectionProps) => {
  if (isCompleted && completedSummary) {
    return (
      <div className={cn("border-b border-slate-200 pb-6 mb-6", className)}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="text-sm text-red-600 hover:text-red-700 font-medium hover:underline"
                >
                  Modifier
                </button>
              )}
            </div>
            <div className="mt-1 text-sm text-slate-600">{completedSummary}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("mb-8", className)}>
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
      {headerAction && (
        <div className="mt-4">{headerAction}</div>
      )}
    </div>
  );
};

export default CheckoutSection;
