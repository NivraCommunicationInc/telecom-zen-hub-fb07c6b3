/**
 * MarketingAnalyticsPage — KPIs & performance des envois marketing.
 * Lit mkt_send_log + mkt_campaigns pour delivered/opened/clicked/bounced.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MKPage, MKCard, MKCardHeader, MKStat } from "./_marketing-ui";
import MarketingNav from "./MarketingNav";
import { Send, CheckCircle2, Eye, MousePointerClick, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Campaign = { id: string; name: string; status: string; sent_count: number; delivered_count: number; opened_count: number; clicked_count: number; bounced_count: number; complained_count: number; created_at: string };

export default function MarketingAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [totals, setTotals] = useState({ sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: camps } = await supabase.from("mkt_campaigns")
          .select("id, name, status, sent_count, delivered_count, opened_count, clicked_count, bounced_count, complained_count, created_at")
          .order("created_at", { ascending: false }).limit(50);
        setCampaigns((camps as any) ?? []);
        const t = (camps ?? []).reduce((acc: any, c: any) => ({
          sent: acc.sent + (c.sent_count ?? 0),
          delivered: acc.delivered + (c.delivered_count ?? 0),
          opened: acc.opened + (c.opened_count ?? 0),
          clicked: acc.clicked + (c.clicked_count ?? 0),
          bounced: acc.bounced + (c.bounced_count ?? 0),
          complained: acc.complained + (c.complained_count ?? 0),
        }), { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 });
        setTotals(t);
      } finally { setLoading(false); }
    })();
  }, []);

  const rate = (num: number, den: number) => den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "—";

  return (
    <MKPage title="Analytics" subtitle="Performance des envois email marketing">
      <MarketingNav />
      {loading ? (
        <div className="p-8 flex items-center justify-center text-[#888]"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Chargement…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <MKStat label="Envoyés" value={totals.sent} icon={Send} />
            <MKStat label="Livrés" value={totals.delivered} icon={CheckCircle2} accent="#10B981" hint={rate(totals.delivered, totals.sent)} />
            <MKStat label="Ouverts" value={totals.opened} icon={Eye} accent="#7C3AED" hint={rate(totals.opened, totals.delivered)} />
            <MKStat label="Clics" value={totals.clicked} icon={MousePointerClick} accent="#3B82F6" hint={rate(totals.clicked, totals.delivered)} />
            <MKStat label="Bounces" value={totals.bounced} icon={AlertTriangle} accent="#F59E0B" hint={rate(totals.bounced, totals.sent)} />
            <MKStat label="Plaintes" value={totals.complained} icon={XCircle} accent="#EF4444" />
          </div>

          <MKCard>
            <MKCardHeader title="Campagnes récentes" />
            {campaigns.length === 0 ? (
              <div className="p-8 text-center text-[#888]">Aucune campagne pour l'instant. Créez-en une depuis <span className="text-white">Campagnes</span>.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[#888] text-xs uppercase tracking-wider">
                    <tr className="border-b border-[#1E1E2E]">
                      <th className="p-3 text-left">Campagne</th>
                      <th className="p-3 text-left">Statut</th>
                      <th className="p-3 text-right">Envoyés</th>
                      <th className="p-3 text-right">Livrés</th>
                      <th className="p-3 text-right">Ouverts</th>
                      <th className="p-3 text-right">Clics</th>
                      <th className="p-3 text-right">Bounces</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map(c => (
                      <tr key={c.id} className="border-b border-[#1E1E2E] hover:bg-[#1E1E2E]/30">
                        <td className="p-3 text-white">{c.name}</td>
                        <td className="p-3"><Badge variant="outline" className="border-[#1E1E2E] text-[#888] capitalize">{c.status}</Badge></td>
                        <td className="p-3 text-right tabular-nums text-white">{c.sent_count ?? 0}</td>
                        <td className="p-3 text-right tabular-nums text-[#10B981]">{c.delivered_count ?? 0}</td>
                        <td className="p-3 text-right tabular-nums text-[#7C3AED]">{c.opened_count ?? 0}</td>
                        <td className="p-3 text-right tabular-nums text-[#3B82F6]">{c.clicked_count ?? 0}</td>
                        <td className="p-3 text-right tabular-nums text-[#F59E0B]">{c.bounced_count ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </MKCard>
        </>
      )}
    </MKPage>
  );
}
