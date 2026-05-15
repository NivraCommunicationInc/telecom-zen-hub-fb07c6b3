/**
 * HubContests — Active and past contests with countdown timer.
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Target, Trophy, Gift } from "lucide-react";

export default function HubContests() {
  const { data, isLoading } = useQuery({
    queryKey: ["hub-contests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hub_contests")
        .select("*")
        .order("end_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const now = Date.now();
  const active = (data || []).filter((c: any) => new Date(c.end_date).getTime() > now && new Date(c.start_date).getTime() <= now);
  const upcoming = (data || []).filter((c: any) => new Date(c.start_date).getTime() > now);
  const past = (data || []).filter((c: any) => new Date(c.end_date).getTime() <= now);

  if (!active.length && !upcoming.length && !past.length) {
    return (
      <div className="text-center py-16">
        <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Aucun concours pour l'instant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {!!active.length && (
        <Section title="🔥 Concours actifs">
          {active.map((c: any) => <ContestCard key={c.id} contest={c} active />)}
        </Section>
      )}
      {!!upcoming.length && (
        <Section title="🗓️ À venir">
          {upcoming.map((c: any) => <ContestCard key={c.id} contest={c} />)}
        </Section>
      )}
      {!!past.length && (
        <Section title="🏆 Concours passés">
          {past.map((c: any) => <ContestCard key={c.id} contest={c} ended />)}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ContestCard({ contest, active = false, ended = false }: { contest: any; active?: boolean; ended?: boolean }) {
  const [countdown, setCountdown] = useState(formatCountdown(contest.end_date));
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setCountdown(formatCountdown(contest.end_date)), 1000);
    return () => clearInterval(t);
  }, [active, contest.end_date]);

  return (
    <article className={`rounded-2xl border p-4 ${active ? "border-violet-500/40 bg-violet-50/30 dark:bg-violet-950/20" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-bold text-foreground">{contest.title}</h4>
          {contest.description && <p className="text-sm text-muted-foreground mt-1">{contest.description}</p>}
          {contest.rules && <p className="text-xs text-muted-foreground mt-2 italic">📋 {contest.rules}</p>}
          {contest.prize && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1 text-xs font-semibold text-yellow-800 dark:text-yellow-300">
              <Gift className="h-3.5 w-3.5" /> {contest.prize}{contest.prize_value ? ` — ${Number(contest.prize_value).toFixed(0)} $` : ""}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          {active && <div className="text-[11px] font-mono font-bold text-violet-600">{countdown}</div>}
          {ended && contest.winner_id && <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600"><Trophy className="h-3.5 w-3.5" /> Gagnant</div>}
          {!active && !ended && <div className="text-[11px] text-muted-foreground">Bientôt</div>}
        </div>
      </div>
    </article>
  );
}

function formatCountdown(end: string): string {
  const ms = new Date(end).getTime() - Date.now();
  if (ms <= 0) return "Terminé";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms / 3_600_000) % 24);
  const m = Math.floor((ms / 60_000) % 60);
  const s = Math.floor((ms / 1000) % 60);
  if (d > 0) return `${d}j ${h}h ${m}m`;
  return `${h}h ${m}m ${s.toString().padStart(2, "0")}s`;
}
