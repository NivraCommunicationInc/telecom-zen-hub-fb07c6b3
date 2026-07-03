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
  const [mode, setMode] = useState<"month" | "week" | "day">("month");

  const days = useMemo(() => {
    const start = mode === "month"
      ? startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 })
      : mode === "week"
        ? startOfWeek(cursor, { weekStartsOn: 0 })
        : cursor;
    const end = mode === "month"
      ? endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })
      : mode === "week"
        ? endOfWeek(cursor, { weekStartsOn: 0 })
        : cursor;
    const list: Date[] = [];
    let d = start;
    while (d <= end) { list.push(d); d = addDays(d, 1); }
    return list;
  }, [cursor, mode]);

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

  const moveCursor = (direction: -1 | 1) => {
    if (mode === "month") setCursor(addMonths(cursor, direction));
    if (mode === "week") setCursor(addDays(cursor, direction * 7));
    if (mode === "day") setCursor(addDays(cursor, direction));
  };

  const title = mode === "month"
    ? format(cursor, "MMMM yyyy", { locale: fr })
    : mode === "week"
      ? `Semaine du ${format(startOfWeek(cursor, { weekStartsOn: 0 }), "d MMM", { locale: fr })}`
      : format(cursor, "EEEE d MMMM yyyy", { locale: fr });

  const renderAppointmentButton = (a: any, compact = false) => {
    const color = STATUS_COLOR[a.status || "scheduled"] || "#0066CC";
    return (
      <button
        key={a.id}
        onClick={() => onSelect(a)}
        className={`w-full text-left flex items-start gap-2 rounded px-2 py-1.5 hover:bg-[hsl(220,15%,14%)] transition-colors ${compact ? "text-[10px]" : "text-xs"}`}
        title={`${a.title} — ${a.client_email || ""}`}
      >
        <span className="h-2 w-2 rounded-full shrink-0 mt-1" style={{ background: color }} />
        <span className="min-w-0">
          <span className="block text-slate-200 font-medium truncate">{a.scheduled_at?.slice(11, 16)} · {a.title || "Rendez-vous"}</span>
          <span className="block text-slate-500 truncate">{a.client_email || a.service_address || "—"}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(220,15%,16%)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => moveCursor(-1)}
            className="p-1 rounded hover:bg-[hsl(220,15%,16%)] text-slate-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-white capitalize min-w-[140px] text-center">
            {title}
          </span>
          <button
            onClick={() => moveCursor(1)}
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
        <div className="flex items-center gap-3 text-[10px]">
          <div className="flex items-center rounded-md border border-[hsl(220,15%,18%)] p-0.5 bg-[hsl(220,20%,8%)]">
            {([
              ["month", "Mois"],
              ["week", "Semaine"],
              ["day", "Jour"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition ${mode === value ? "bg-emerald-600/20 text-emerald-300" : "text-slate-500 hover:text-slate-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
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

      {mode !== "day" && (
        <div className="grid grid-cols-7 border-b border-[hsl(220,15%,16%)]">
          {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((d, i) => (
            <div key={d} className={`px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider border-r border-[hsl(220,15%,16%)] last:border-r-0 ${i === 0 ? "text-red-400" : "text-slate-400"}`}>
              {d}
            </div>
          ))}
        </div>
      )}

      <div className={`grid ${mode === "day" ? "grid-cols-1" : "grid-cols-7"}`}>
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
                  return renderAppointmentButton(a, true);
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
