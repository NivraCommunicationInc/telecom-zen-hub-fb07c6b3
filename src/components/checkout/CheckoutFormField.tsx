import { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface CheckoutFormFieldProps {
  label: string;
  htmlFor?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export const CheckoutFormField = ({
  label,
  htmlFor,
  helperText,
  error,
  required,
  children,
  className,
}: CheckoutFormFieldProps) => {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label
        htmlFor={htmlFor}
        className={cn(
          "text-sm font-medium",
          error ? "text-red-600" : "text-[#1A1A2E]",
        )}
      >
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </Label>

      <div
        className={cn(
          "[&_input]:border-[#E5E7EB] [&_input]:rounded-lg [&_input]:h-11",
          "[&_input:focus-visible]:border-[#0066CC] [&_input:focus-visible]:ring-2 [&_input:focus-visible]:ring-[#0066CC]/15",
          "[&_textarea]:border-[#E5E7EB] [&_textarea]:rounded-lg",
          "[&_textarea:focus-visible]:border-[#0066CC] [&_textarea:focus-visible]:ring-2 [&_textarea:focus-visible]:ring-[#0066CC]/15",
          error && "[&_input]:border-red-500 [&_textarea]:border-red-500",
        )}
      >
        {children}
      </div>

      {helperText && !error && (
        <p className="text-xs text-[#6B7280]">{helperText}</p>
      )}

      {error && (
        <p className="text-xs text-red-600 font-medium">{error}</p>
      )}
    </div>
  );
};

export default CheckoutFormField;
