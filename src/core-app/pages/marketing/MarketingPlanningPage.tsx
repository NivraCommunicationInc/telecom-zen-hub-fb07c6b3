/** MarketingPlanningPage — calendrier des campagnes planifiées. */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarClock, Clock, Mail, Plus, Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import MarketingNav from "./MarketingNav";
import { MKCard, MKCardHeader, MKPage, MKStat } from "./_marketing-ui";

type PlannedCampaign = {
  id: string;
  name: string;
  status: string;
  channel: string;
  subject: string | null;
  scheduled_at: string | null;
  total_recipients: number;
  sent_count: number;
  created_at: string;
};

export default function MarketingPlanningPage() {
  const [rows, setRows] = useState<PlannedCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("mkt_campaigns")
        .select("id,name,status,channel,subject,scheduled_at,total_recipients,sent_count,created_at")
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .limit(100);
      setRows((data ?? []) as PlannedCampaign[]);
      setLoading(false);
    })();
  }, []);

  const today = startOfDay(new Date());
  const scheduled = useMemo(() => rows.filter((r) => r.status === "scheduled"), [rows]);
  const drafts = useMemo(() => rows.filter((r) => r.status === "draft"), [rows]);
  const overdue = useMemo(() => scheduled.filter((r) => r.scheduled_at && isBefore(new Date(r.scheduled_at), today)), [scheduled, today]);
  const upcoming = useMemo(() => scheduled.filter((r) => r.scheduled_at && isAfter(new Date(r.scheduled_at), today)), [scheduled, today]);

  return (
    <MKPage
      title="Planification"
      subtitle="Calendrier de lancement, brouillons et campagnes programmées."
      actions={
        <Button asChild className="rounded-full font-black">
          <Link to="/marketing/campaigns"><Plus className="mr-2 h-4 w-4" /> Nouvelle campagne</Link>
        </Button>
      }
    >
      <MarketingNav />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MKStat label="Programmées" value={scheduled.length} icon={CalendarClock} />
        <MKStat label="À venir" value={upcoming.length} icon={Clock} accent="hsl(var(--success))" />
        <MKStat label="En retard" value={overdue.length} icon={Clock} accent="hsl(var(--destructive))" />
        <MKStat label="Brouillons" value={drafts.length} icon={Mail} accent="hsl(var(--muted-foreground))" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <MKCard>
          <MKCardHeader title="Calendrier des lancements" />
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement…</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Aucune campagne dans le calendrier.</div>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((c) => (
                <div key={c.id} className="grid gap-3 px-5 py-4 md:grid-cols-[150px_1fr_auto] md:items-center">
                  <div>
                    <div className="text-sm font-black text-foreground">
                      {c.scheduled_at ? format(new Date(c.scheduled_at), "d MMM", { locale: fr }) : "Non planifiée"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.scheduled_at ? format(new Date(c.scheduled_at), "HH:mm", { locale: fr }) : "Brouillon"}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="rounded-full capitalize">{c.status}</Badge>
                      <Badge variant="outline" className="rounded-full capitalize">{c.channel}</Badge>
                      <span className="truncate text-sm font-black text-foreground">{c.name}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{c.subject ?? "Sujet à compléter"}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {c.total_recipients}</span>
                    <span className="inline-flex items-center gap-1"><Send className="h-3.5 w-3.5" /> {c.sent_count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </MKCard>

        <MKCard>
          <MKCardHeader title="File de lancement" />
          <div className="space-y-3 p-5">
            {upcoming.slice(0, 6).map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-secondary/40 p-4">
                <div className="text-sm font-black text-foreground">{c.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {c.scheduled_at ? format(new Date(c.scheduled_at), "d MMM yyyy · HH:mm", { locale: fr }) : "Non planifiée"}
                </div>
              </div>
            ))}
            {upcoming.length === 0 && <div className="text-sm text-muted-foreground">Aucun lancement à venir.</div>}
          </div>
        </MKCard>
      </div>
    </MKPage>
  );
}