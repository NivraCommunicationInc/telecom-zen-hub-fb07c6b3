import { Loader2, Radio } from "lucide-react";
import { useTechnicianAssignment } from "@/hooks/useTechnicianAssignment";
import TechnicianStatusTimeline from "./TechnicianStatusTimeline";

interface TechLiveTrackerProps {
  orderId: string | null | undefined;
}

const LIVE_STATUSES = new Set(["en_route", "arrived", "in_progress"]);

export default function TechLiveTracker({ orderId }: TechLiveTrackerProps) {
  const { data: assignment, isLoading } = useTechnicianAssignment(orderId);

  if (!orderId) return null;
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="w-3 h-3 animate-spin" />
        Chargement du suivi technicien...
      </div>
    );
  }
  if (!assignment) return null;

  const isLive = LIVE_STATUSES.has(assignment.status);

  return (
    <div className="mt-3 rounded-xl border border-border bg-card/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        {isLive ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            Suivi en direct
          </span>
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">Statut du technicien</span>
        )}
      </div>
      <TechnicianStatusTimeline
        currentStatus={assignment.status}
        etaText={assignment.eta_text}
        scheduledDate={assignment.scheduled_date}
        scheduledTimeStart={assignment.scheduled_time_start}
      />
    </div>
  );
}
