import { CheckCircle, Calendar, UserCheck, Truck, MapPin, Wrench, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TechnicianStatusTimelineProps {
  currentStatus: string;
  techName?: string | null;
  etaText?: string | null;
  scheduledDate?: string | null;
  scheduledTimeStart?: string | null;
}

const STEPS = [
  { key: "scheduled",   label: "Planifié",   icon: Calendar  },
  { key: "confirmed",   label: "Confirmé",   icon: UserCheck },
  { key: "en_route",    label: "En route",   icon: Truck     },
  { key: "arrived",     label: "Arrivé",     icon: MapPin    },
  { key: "in_progress", label: "En cours",   icon: Wrench    },
  { key: "completed",   label: "Complété",   icon: CheckCircle },
];

const STATUS_INDEX: Record<string, number> = {
  scheduled: 0,
  pending:   0,
  confirmed: 1,
  en_route:  2,
  arrived:   3,
  in_progress: 4,
  completed: 5,
  cancelled: -1,
  missed:    -1,
  rescheduled: -1,
};

const STATUS_COLOR: Record<string, string> = {
  scheduled:    "text-slate-400",
  confirmed:    "text-blue-400",
  en_route:     "text-orange-400",
  arrived:      "text-cyan-400",
  in_progress:  "text-violet-400",
  completed:    "text-emerald-400",
};

const ACTIVE_BG: Record<string, string> = {
  scheduled:    "bg-slate-500",
  confirmed:    "bg-blue-500",
  en_route:     "bg-orange-500",
  arrived:      "bg-cyan-500",
  in_progress:  "bg-violet-500",
  completed:    "bg-emerald-500",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled:    "Rendez-vous planifié",
  confirmed:    "Rendez-vous confirmé",
  en_route:     "Le technicien est en route",
  arrived:      "Le technicien est arrivé",
  in_progress:  "Installation en cours",
  completed:    "Installation complétée",
};

const TechnicianStatusTimeline = ({
  currentStatus,
  techName,
  etaText,
  scheduledDate,
  scheduledTimeStart,
}: TechnicianStatusTimelineProps) => {
  const normalized = currentStatus?.toLowerCase() ?? "scheduled";
  const currentIndex = STATUS_INDEX[normalized] ?? 0;
  const isCancelled = normalized === "cancelled" || normalized === "missed";
  const isRescheduled = normalized === "rescheduled";

  if (isCancelled) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3">
        <XCircle className="w-5 h-5 text-red-400 shrink-0" />
        <p className="text-sm text-red-300 font-medium">Rendez-vous annulé ou manqué</p>
      </div>
    );
  }

  if (isRescheduled) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3">
        <Clock className="w-5 h-5 text-amber-400 shrink-0" />
        <p className="text-sm text-amber-300 font-medium">Rendez-vous replanifié — une nouvelle date vous sera communiquée</p>
      </div>
    );
  }

  const progress = currentIndex >= 0 ? (currentIndex / (STEPS.length - 1)) * 100 : 0;
  const activeBg = ACTIVE_BG[normalized] ?? "bg-slate-500";
  const statusLabel = STATUS_LABEL[normalized] ?? currentStatus;
  const statusColor = STATUS_COLOR[normalized] ?? "text-slate-400";

  return (
    <div className="space-y-4">
      {/* Status headline */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={cn("text-sm font-semibold", statusColor)}>{statusLabel}</p>
          {techName && (
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Technicien: {techName}
            </p>
          )}
        </div>
        {normalized === "en_route" && etaText && (
          <div className="rounded-full bg-orange-500/15 border border-orange-500/30 px-3 py-1 text-xs font-semibold text-orange-300 flex items-center gap-1.5 shrink-0">
            <Clock className="w-3 h-3" /> ETA {etaText}
          </div>
        )}
        {normalized === "scheduled" && scheduledDate && scheduledTimeStart && (
          <div className="rounded-full bg-slate-700/50 border border-slate-600/50 px-3 py-1 text-xs text-slate-300 flex items-center gap-1.5 shrink-0">
            <Calendar className="w-3 h-3" /> {scheduledDate} {scheduledTimeStart?.slice(0, 5)}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all duration-700", activeBg)}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-start justify-between relative">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={step.key} className="flex flex-col items-center gap-1.5" style={{ width: `${100 / STEPS.length}%` }}>
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                  isDone   && `${activeBg} text-white`,
                  isCurrent && `${activeBg} text-white ring-2 ring-offset-2 ring-offset-background ring-current`,
                  isPending  && "bg-muted border border-border text-muted-foreground",
                )}
              >
                {isDone ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>
              <span className={cn(
                "text-[10px] text-center leading-tight",
                (isDone || isCurrent) ? "text-foreground font-medium" : "text-muted-foreground",
              )}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TechnicianStatusTimeline;
