import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Wrench,
  Package,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AppointmentHistoryTimelineProps {
  appointments: any[];
  onSelectAppointment?: (apt: any) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending_scheduling: { label: "À planifier", color: "bg-amber-500", icon: Clock },
  scheduled: { label: "Planifié", color: "bg-cyan-500", icon: Clock },
  modified: { label: "Modifié", color: "bg-purple-500", icon: Edit },
  cancelled: { label: "Annulé", color: "bg-red-500", icon: XCircle },
  completed: { label: "Terminé", color: "bg-emerald-500", icon: CheckCircle },
  technician_assigned: { label: "Technicien assigné", color: "bg-blue-500", icon: Wrench },
  pending_verification: { label: "Vérification", color: "bg-amber-500", icon: AlertTriangle },
  pending_payment: { label: "Paiement", color: "bg-orange-500", icon: Package },
  in_progress: { label: "En cours", color: "bg-indigo-500", icon: Wrench },
};

export const AppointmentHistoryTimeline = ({
  appointments,
  onSelectAppointment,
}: AppointmentHistoryTimelineProps) => {
  if (!appointments || appointments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Aucun historique de rendez-vous</p>
      </div>
    );
  }

  // Sort by date descending
  const sortedAppointments = [...appointments].sort(
    (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
  );

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

        <div className="space-y-4">
          {sortedAppointments.map((apt, index) => {
            const status = STATUS_CONFIG[apt.status] || STATUS_CONFIG.scheduled;
            const StatusIcon = status.icon;
            const aptDate = new Date(apt.scheduled_at);

            return (
              <div
                key={apt.id}
                className="relative pl-10 cursor-pointer hover:bg-muted/50 p-3 rounded-lg -ml-3 transition-colors"
                onClick={() => onSelectAppointment?.(apt)}
              >
                {/* Timeline dot */}
                <div
                  className={`absolute left-2.5 w-4 h-4 rounded-full ${status.color} flex items-center justify-center`}
                >
                  <StatusIcon className="w-2.5 h-2.5 text-white" />
                </div>

                {/* Content */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-cyan-400">
                      {apt.appointment_number || `#${apt.id?.slice(0, 8)}`}
                    </span>
                    <Badge variant="outline" className={`text-[10px] ${status.color.replace('bg-', 'text-')}/80`}>
                      {status.label}
                    </Badge>
                  </div>

                  <p className="text-sm font-medium">{apt.title}</p>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(aptDate, "d MMM yyyy", { locale: fr })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(aptDate, "HH:mm")}
                    </span>
                  </div>

                  {apt.technician?.full_name && (
                    <p className="text-xs text-blue-400 flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      {apt.technician.full_name}
                    </p>
                  )}

                  {apt.cancellation_reason && (
                    <p className="text-xs text-red-400 italic">
                      Raison: {apt.cancellation_reason}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
};
