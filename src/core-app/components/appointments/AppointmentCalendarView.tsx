/**
 * AppointmentCalendarView — Compact month grid for Nivra Core /appointments.
 * Reads the same `appointments` list already fetched by the parent page.
 * Color codes per status:
 *   confirmé / planifié  → #0066CC (bleu)
 *   complété             → #00A651 (vert)
 *   annulé               → gris
 *   no-show              → rouge
 *   replanifié           → ambre
 */
import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay, isSameMonth, addMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  scheduled: "#0066CC",
  confirmed: "#0066CC",
  in_progress: "#0066CC",
  completed: "#00A651",
  cancelled: "#9CA3AF",
  no_show: "#DC2626",
  rescheduled: "#F59E0B",
};

interface Props {
  appointments: any[];
  onSelect: (apt: any) => void;
}

export function AppointmentCalendarView({ appointments, onSelect }: Props) {
  const [cursor, setCursor] = useState(() => new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const list: Date[] = [];
    let d = start;
    while (d <= end) { list.push(d); d = addDays(d, 1); }
    return list;
  }, [cursor]);

  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    appointments.forEach((a) => {
      if (!a.scheduled_at) return;
      const k = a.scheduled_at.slice(0, 10);
      const arr = m.get(k) || [];
      arr.push(a);
      m.set(k, arr);
    });
    return m;
  }, [appointments]);

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(220,15%,16%)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor(addMonths(cursor, -1))}
            className="p-1 rounded hover:bg-[hsl(220,15%,16%)] text-slate-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-white capitalize min-w-[140px] text-center">
            {format(cursor, "MMMM yyyy", { locale: fr })}
          </span>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="p-1 rounded hover:bg-[hsl(220,15%,16%)] text-slate-300"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="ml-2 text-[11px] text-emerald-400 hover:underline"
          >
            Aujourd'hui
          </button>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          {[
            { c: "#0066CC", l: "Confirmé" },
            { c: "#00A651", l: "Complété" },
            { c: "#9CA3AF", l: "Annulé" },
            { c: "#DC2626", l: "No-show" },
            { c: "#F59E0B", l: "Replanifié" },
          ].map(x => (
            <span key={x.l} className="flex items-center gap-1 text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ background: x.c }} /> {x.l}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-[hsl(220,15%,16%)]">
        {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((d, i) => (
          <div key={d} className={`px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider border-r border-[hsl(220,15%,16%)] last:border-r-0 ${i === 0 ? "text-red-400" : "text-slate-400"}`}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = format(d, "yyyy-MM-dd");
          const list = byDay.get(key) || [];
          const isCur = isSameMonth(d, cursor);
          const isToday = isSameDay(d, new Date());
          return (
            <div
              key={i}
              className={`min-h-[92px] border-r border-b border-[hsl(220,15%,16%)] last:border-r-0 p-1.5 ${isCur ? "bg-[hsl(220,20%,10%)]" : "bg-[hsl(220,20%,8%)]"}`}
            >
              <div className={`text-[11px] font-semibold mb-1 ${isToday ? "text-emerald-400" : isCur ? "text-slate-200" : "text-slate-600"}`}>
                {format(d, "d")}
              </div>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((a) => {
                  const color = STATUS_COLOR[a.status || "scheduled"] || "#0066CC";
                  return (
                    <button
                      key={a.id}
                      onClick={() => onSelect(a)}
                      className="w-full text-left flex items-center gap-1 rounded px-1 py-0.5 text-[10px] hover:bg-[hsl(220,15%,14%)] transition-colors"
                      title={`${a.title} — ${a.client_email || ""}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-slate-300 truncate">
                        {a.scheduled_at?.slice(11, 16)} {a.title || a.client_email}
                      </span>
                    </button>
                  );
                })}
                {list.length > 3 && (
                  <div className="text-[9px] text-slate-500 pl-2">+{list.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
