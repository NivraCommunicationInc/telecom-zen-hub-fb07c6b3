import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Pin, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-slate-100 text-slate-700",
  pricing: "bg-amber-100 text-amber-700",
  system: "bg-blue-100 text-blue-700",
  contest: "bg-pink-100 text-pink-700",
  urgent: "bg-red-100 text-red-700",
  formation: "bg-emerald-100 text-emerald-700",
  policy: "bg-violet-100 text-violet-700",
};

export default function HubAnnouncements() {
  const { data, isLoading } = useQuery({
    queryKey: ["hub-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_announcements")
        .select("*")
        .eq("is_published", true)
        .order("is_pinned", { ascending: false })
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16">
        <Megaphone className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Aucune annonce pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {data.map((a: any) => (
        <article key={a.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {a.is_pinned && <Pin className="h-3.5 w-3.5 text-violet-600" />}
            <span className={`text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5 ${CATEGORY_COLORS[a.category] || CATEGORY_COLORS.general}`}>
              {a.category}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {a.published_at && formatDistanceToNow(new Date(a.published_at), { addSuffix: true, locale: fr })}
            </span>
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1">{a.title}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{a.content}</p>
        </article>
      ))}
    </div>
  );
}
