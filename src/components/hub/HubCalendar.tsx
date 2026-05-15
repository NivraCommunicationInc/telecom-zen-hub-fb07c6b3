import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const TYPE_COLORS: Record<string, string> = {
  formation: "bg-emerald-100 text-emerald-700",
  contest: "bg-pink-100 text-pink-700",
  meeting: "bg-blue-100 text-blue-700",
  deadline: "bg-amber-100 text-amber-700",
  maintenance: "bg-red-100 text-red-700",
  general: "bg-slate-100 text-slate-700",
  other: "bg-slate-100 text-slate-700",
};

export default function HubCalendar() {
  const { data, isLoading } = useQuery({
    queryKey: ["hub-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_calendar_events")
        .select("*")
        .gte("start_date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-3xl space-y-2">
      {(!data || data.length === 0) ? (
        <div className="text-center py-16">
          <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Aucun événement à venir.</p>
        </div>
      ) : (
        data.map((ev: any) => {
          const d = new Date(ev.start_date);
          return (
            <div key={ev.id} className="flex gap-3 rounded-xl border border-border bg-card p-4">
              <div className="text-center shrink-0 w-14">
                <div className="text-[10px] font-bold uppercase text-violet-700">{format(d, "MMM", { locale: fr })}</div>
                <div className="text-2xl font-bold text-foreground leading-none">{format(d, "d")}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{format(d, "HH:mm")}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${TYPE_COLORS[ev.event_type] || TYPE_COLORS.general}`}>
                    {ev.event_type}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-foreground">{ev.title}</h3>
                {ev.description && <p className="text-xs text-muted-foreground mt-0.5">{ev.description}</p>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
