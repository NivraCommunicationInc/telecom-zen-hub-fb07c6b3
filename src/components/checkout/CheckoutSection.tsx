import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
}

export const CheckoutSection = ({
  title,
  description,
  icon: Icon,
  iconColor = "text-primary",
  children,
  className,
  headerAction,
}: CheckoutSectionProps) => {
  return (
    <Card className={cn("bg-card border shadow-sm", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              {Icon && <Icon className={cn("w-5 h-5", iconColor)} />}
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="text-sm">
                {description}
              </CardDescription>
            )}
          </div>
          {headerAction}
        </div>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
};

export default CheckoutSection;
