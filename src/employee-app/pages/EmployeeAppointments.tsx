/**
 * EmployeeAppointments — Appointment management view using shared-ops.
 */
import { useNavigate } from "react-router-dom";
import { Calendar, Loader2, MapPin, Phone, User, Clock, ArrowUpRight, Plus } from "lucide-react";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { useAppointmentsList } from "@/shared-ops/hooks/useAppointmentDetail";
import { useState } from "react";
import { CreateAppointmentDialog } from "@/employee-app/components/CreateAppointmentDialog";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

type FilterKey = "all" | "today" | "upcoming" | "past";

export default function EmployeeAppointments() {
  usePortalRealtime(["appointments"], [["employee-appointments"]]);
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useAppointmentsList();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);

  const filtered = items.filter((a: any) => {
    const d = new Date(a.scheduled_at);
    if (filter === "today") return isToday(d);
    if (filter === "upcoming") return !isPast(d) && !isToday(d);
    if (filter === "past") return isPast(d) && !isToday(d);
    return true;
  });

  const todayCount = items.filter((a: any) => isToday(new Date(a.scheduled_at))).length;

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      scheduled: "text-blue-400 bg-blue-500/10",
      confirmed: "text-emerald-400 bg-emerald-500/10",
      in_progress: "text-indigo-400 bg-indigo-500/10",
      completed: "text-emerald-400 bg-emerald-500/10",
      cancelled: "text-red-400 bg-red-500/10",
      no_show: "text-amber-400 bg-amber-500/10",
    };
    return map[s] ?? "text-muted-foreground bg-muted";
  };

  const filters: { key: FilterKey; label: string }[] = [
    { key: "all", label: `Tous (${items.length})` },
    { key: "today", label: `Aujourd'hui (${todayCount})` },
    { key: "upcoming", label: "À venir" },
    { key: "past", label: "Passés" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Rendez-vous</h1>
          <p className="text-sm text-muted-foreground">{todayCount} rendez-vous aujourd'hui</p>
        </div>
        <button onClick={() => setShowCreateAppointment(true)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Nouveau rendez-vous
        </button>
      </div>

      <div className="flex gap-2">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
              filter === f.key
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-card text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Aucun rendez-vous.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((apt: any) => {
            const d = new Date(apt.scheduled_at);
            const dateLabel = isToday(d) ? "Aujourd'hui" : isTomorrow(d) ? "Demain" : format(d, "d MMM yyyy", { locale: fr });
            return (
              <button
                key={apt.id}
                onClick={() => navigate(employeePath(`/appointments/${apt.id}`))}
                className="w-full text-left p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{apt.appointment_number ?? "—"}</span>
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium", statusColor(apt.status ?? "scheduled"))}>
                        {apt.status ?? "scheduled"}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{apt.title}</p>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {dateLabel} {format(d, "HH:mm")}
                      </span>
                      {apt.clientName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" /> {apt.clientName}
                        </span>
                      )}
                      {apt.clientPhone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {apt.clientPhone}
                        </span>
                      )}
                      {apt.service_address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {apt.service_address}{apt.service_city ? `, ${apt.service_city}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>
      )}
      <CreateAppointmentDialog open={showCreateAppointment} onOpenChange={setShowCreateAppointment} />
    </div>
  );
}
