/**
 * WithdrawalTimeline — Visual timeline for withdrawal request lifecycle.
 */
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Clock, Check, X, CreditCard, Send } from "lucide-react";

interface Props {
  withdrawal: any;
}

interface Step {
  label: string;
  date: string | null;
  icon: typeof Clock;
  active: boolean;
  completed: boolean;
  color: string;
}

export default function WithdrawalTimeline({ withdrawal }: Props) {
  const w = withdrawal;
  const isCancelled = w.status === "cancelled";
  const isRejected = w.status === "rejected";

  const steps: Step[] = [
    {
      label: "Demandé",
      date: w.created_at,
      icon: Send,
      active: true,
      completed: true,
      color: "text-blue-600",
    },
    {
      label: isRejected ? "Rejeté" : isCancelled ? "Annulé" : "Approuvé",
      date: w.reviewed_at || null,
      icon: isRejected || isCancelled ? X : Check,
      active: w.status !== "pending",
      completed: w.status !== "pending",
      color: isRejected || isCancelled ? "text-destructive" : "text-emerald-600",
    },
    {
      label: "Payé",
      date: w.paid_at || null,
      icon: CreditCard,
      active: w.status === "paid",
      completed: w.status === "paid",
      color: "text-emerald-600",
    },
  ];

  // Remove "Payé" step if rejected/cancelled
  const visibleSteps = isRejected || isCancelled ? steps.slice(0, 2) : steps;

  return (
    <div className="flex items-start gap-0 py-2">
      {visibleSteps.map((step, i) => (
        <div key={step.label} className="flex items-start flex-1">
          <div className="flex flex-col items-center">
            <div className={cn(
              "h-7 w-7 rounded-full flex items-center justify-center border-2 transition-colors",
              step.completed
                ? `${step.color} border-current bg-current/10`
                : "text-muted-foreground border-border bg-muted"
            )}>
              <step.icon className="h-3.5 w-3.5" />
            </div>
            <p className={cn("text-[10px] font-medium mt-1", step.completed ? step.color : "text-muted-foreground")}>{step.label}</p>
            {step.date && <p className="text-[9px] text-muted-foreground">{format(new Date(step.date), "dd/MM HH:mm")}</p>}
          </div>
          {i < visibleSteps.length - 1 && (
            <div className={cn("flex-1 h-0.5 mt-3.5 mx-1", step.completed ? "bg-emerald-400" : "bg-border")} />
          )}
        </div>
      ))}
    </div>
  );
}
