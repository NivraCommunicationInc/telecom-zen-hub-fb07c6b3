import { CheckCircle, Calendar, UserCheck, Truck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface TechnicianStatusTimelineProps {
  currentStatus: string;
}

const TECHNICIAN_STATUSES = [
  { key: "scheduled", label: "Planifié", icon: Calendar },
  { key: "confirmed", label: "Confirmé", icon: UserCheck },
  { key: "en_route", label: "En route", icon: Truck },
  { key: "completed", label: "Complété", icon: Wrench },
];

const getStatusIndex = (status: string): number => {
  const statusMap: Record<string, number> = {
    scheduled: 0,
    pending: 0,
    confirmed: 1,
    en_route: 2,
    in_progress: 2,
    completed: 3,
    cancelled: -1,
  };
  return statusMap[status?.toLowerCase()] ?? 0;
};

const TechnicianStatusTimeline = ({ currentStatus }: TechnicianStatusTimelineProps) => {
  const currentIndex = getStatusIndex(currentStatus);
  const isCancelled = currentStatus?.toLowerCase() === "cancelled";

  if (isCancelled) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
        <p className="text-red-500 font-medium">Rendez-vous annulé</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-border" />
        <div 
          className="absolute top-4 left-0 h-0.5 bg-accent transition-all duration-500"
          style={{ width: `${(currentIndex / (TECHNICIAN_STATUSES.length - 1)) * 100}%` }}
        />
        
        {TECHNICIAN_STATUSES.map((status, index) => {
          const Icon = status.icon;
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <div key={status.key} className="flex flex-col items-center relative z-10">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  isCompleted 
                    ? "bg-accent text-accent-foreground" 
                    : "bg-muted border border-border text-muted-foreground",
                  isCurrent && "ring-2 ring-accent ring-offset-2 ring-offset-background"
                )}
              >
                {isCompleted && index < currentIndex ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span 
                className={cn(
                  "text-xs mt-2 text-center max-w-[80px]",
                  isCompleted ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {status.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TechnicianStatusTimeline;
