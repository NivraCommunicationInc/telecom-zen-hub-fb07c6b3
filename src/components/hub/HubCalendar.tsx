import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Loader2, ChevronLeft, ChevronRight, List, LayoutGrid, X } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isPast, isToday,
} from "date-fns";
import { fr } from "date-fns/locale";

const TYPE_COLORS: Record<string, string> = {
  formation: "bg-emerald-100 text-emerald-700 border-emerald-300",
  contest: "bg-pink-100 text-pink-700 border-pink-300",
  meeting: "bg-blue-100 text-blue-700 border-blue-300",
  deadline: "bg-amber-100 text-amber-700 border-amber-300",
  maintenance: "bg-red-100 text-red-700 border-red-300",
  general: "bg-slate-100 text-slate-700 border-slate-300",
  other: "bg-slate-100 text-slate-700 border-slate-300",
};

type ViewMode = "month" | "list";

export default function HubCalendar() {
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  // Fetch a generous range so month-grid and list both work without refetch on nav
  const rangeStart = useMemo(() => startOfMonth(subMonths(cursor, 1)).toISOString(), [cursor]);
  const rangeEnd = useMemo(() => endOfMonth(addMonths(cursor, 2)).toISOString(), [cursor]);

  const { data, isLoading } = useQuery({
    queryKey: ["hub-calendar", rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_calendar_events")
        .select("*")
        .gte("start_date", rangeStart)
        .lte("start_date", rangeEnd)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const events = data || [];
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const eventsByDay = new Map<string, any[]>();
  for (const ev of events) {
    const k = format(new Date(ev.start_date), "yyyy-MM-dd");
    (eventsByDay.get(k) || eventsByDay.set(k, []).get(k))!.push(ev);
  }

  return (
    <div className="max-w-4xl space-y-3">
      {/* Header — month navigation + view toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(subMonths(cursor, 1))}
            className="h-9 w-9 rounded-lg hover:bg-secondary flex items-center justify-center"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="h-9 px-3 rounded-lg hover:bg-secondary text-xs font-semibold"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="h-9 w-9 rounded-lg hover:bg-secondary flex items-center justify-center"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-2 text-sm font-bold text-foreground capitalize">
            {format(cursor, "MMMM yyyy", { locale: fr })}
          </h2>
        </div>
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
          <button
            onClick={() => setView("month")}
            className={`h-8 px-2 rounded text-xs font-medium flex items-center gap-1 ${view === "month" ? "bg-violet-600 text-white" : "text-muted-foreground hover:bg-secondary"}`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Mois
          </button>
          <button
            onClick={() => setView("list")}
            className={`h-8 px-2 rounded text-xs font-medium flex items-center gap-1 ${view === "list" ? "bg-violet-600 text-white" : "text-muted-foreground hover:bg-secondary"}`}
          >
            <List className="h-3.5 w-3.5" /> Liste
          </button>
        </div>
      </div>

      {events.length === 0 && (
        <div className="text-center py-16 rounded-xl border border-dashed border-border bg-card">
          <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucun contenu disponible pour le moment.</p>
        </div>
      )}

      {events.length > 0 && view === "month" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/30">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div key={d} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center py-2">{d}</div>
            ))}
          </div>
          {/* Grid */}
          <div className="grid grid-cols-7 auto-rows-[minmax(86px,_auto)]">
            {days.map((d) => {
              const k = format(d, "yyyy-MM-dd");
              const dayEvents = eventsByDay.get(k) || [];
              const inMonth = isSameMonth(d, cursor);
              const past = isPast(d) && !isToday(d);
              return (
                <div
                  key={k}
                  className={`border-r border-b border-border p-1.5 ${!inMonth ? "bg-muted/20" : ""} ${past ? "opacity-60" : ""}`}
                >
                  <div className={`text-[11px] font-semibold mb-1 flex items-center justify-end ${isToday(d) ? "text-violet-700" : inMonth ? "text-foreground" : "text-muted-foreground"}`}>
                    {isToday(d) && <span className="mr-auto inline-block h-1.5 w-1.5 rounded-full bg-violet-600" />}
                    {format(d, "d")}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev: any) => (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEvent(ev)}
                        className={`w-full text-left text-[10px] truncate rounded px-1 py-0.5 border ${TYPE_COLORS[ev.event_type] || TYPE_COLORS.general} hover:opacity-80`}
                        title={ev.title}
                      >
                        {ev.title}
                      </button>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] text-muted-foreground px-1">+{dayEvents.length - 3} autres</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {events.length > 0 && view === "list" && (
        <div className="space-y-2">
          {events.map((ev: any) => {
            const d = new Date(ev.start_date);
            const past = isPast(d) && !isToday(d);
            return (
              <button
                key={ev.id}
                onClick={() => setSelectedEvent(ev)}
                className={`w-full flex gap-3 rounded-xl border border-border bg-card p-4 text-left hover:border-violet-300 transition ${past ? "opacity-60" : ""}`}
              >
                <div className="text-center shrink-0 w-14">
                  <div className="text-[10px] font-bold uppercase text-violet-700">{format(d, "MMM", { locale: fr })}</div>
                  <div className="text-2xl font-bold text-foreground leading-none">{format(d, "d")}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{format(d, "HH:mm")}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 border ${TYPE_COLORS[ev.event_type] || TYPE_COLORS.general}`}>
                      {ev.event_type}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{ev.title}</h3>
                  {ev.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ev.description}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Event detail modal */}
      {selectedEvent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-card rounded-2xl border border-border max-w-md w-full p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <span className={`text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 border ${TYPE_COLORS[selectedEvent.event_type] || TYPE_COLORS.general}`}>
                {selectedEvent.event_type}
              </span>
              <button
                onClick={() => setSelectedEvent(null)}
                className="h-8 w-8 rounded-lg hover:bg-secondary flex items-center justify-center"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="text-base font-bold text-foreground">{selectedEvent.title}</h3>
            <div className="text-xs text-muted-foreground">
              {format(new Date(selectedEvent.start_date), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
              {selectedEvent.end_date && (
                <> — {format(new Date(selectedEvent.end_date), "HH:mm", { locale: fr })}</>
              )}
            </div>
            {selectedEvent.description && (
              <p className="text-sm text-foreground whitespace-pre-line">{selectedEvent.description}</p>
            )}
            {selectedEvent.location && (
              <div className="text-xs text-muted-foreground"><strong className="text-foreground">Lieu :</strong> {selectedEvent.location}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
