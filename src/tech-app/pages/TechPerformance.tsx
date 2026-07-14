/**
 * TechPerformance — KPIs, installations, taux de réussite, commissions.
 */
import { useEffect, useState } from "react";
import { TrendingUp, CheckCircle2, DollarSign, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import TechHeader from "../components/TechHeader";

export default function TechPerformance() {
  const [stats, setStats] = useState({ total: 0, completed: 0, cancelled: 0, avgMinutes: 0, month: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data } = await supabase
        .from("technician_assignments")
        .select("status, created_at, completed_at, started_at")
        .eq("technician_id", user.id)
        .limit(500);
      const rows = data ?? [];
      const completed = rows.filter((r: any) => r.status === "completed");
      const cancelled = rows.filter((r: any) => r.status === "cancelled" || r.status === "missed");
      const monthCount = completed.filter((r: any) => r.completed_at && r.completed_at >= monthStart).length;
      const durations = completed
        .map((r: any) => r.started_at && r.completed_at ? (new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 60000 : null)
        .filter(Boolean) as number[];
      const avg = durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0;
      setStats({ total: rows.length, completed: completed.length, cancelled: cancelled.length, avgMinutes: avg, month: monthCount });
      setLoading(false);
    })();
  }, []);

  const successRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <>
      <TechHeader title="Performance" subtitle="Rapports & commissions" back />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>
      ) : (
        <>
          <section className="px-4 mt-4">
            <div className="rounded-2xl bg-zinc-900 text-white p-5">
              <p className="text-[10px] font-black italic uppercase tracking-widest text-amber-400">Ce mois</p>
              <p className="mt-1 text-3xl font-black italic">{stats.month}</p>
              <p className="text-[11px] text-zinc-400 uppercase tracking-wider">installations terminées</p>
            </div>
          </section>

          <section className="px-4 mt-4 grid grid-cols-2 gap-2">
            <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Taux réussite" value={`${successRate}%`} />
            <Kpi icon={<Clock className="h-4 w-4" />} label="Durée moyenne" value={stats.avgMinutes ? `${stats.avgMinutes} min` : "—"} />
            <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Total carrière" value={String(stats.completed)} />
            <Kpi icon={<DollarSign className="h-4 w-4" />} label="Annulées" value={String(stats.cancelled)} />
          </section>

          <section className="px-4 mt-5 mb-8">
            <h2 className="tp-italic-label text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">Commissions récentes</h2>
            <div className="p-4 rounded-xl bg-white border border-zinc-200 text-center">
              <p className="text-[13px] text-zinc-500">Aucune commission à afficher. Consulte ton compte de paie pour le détail.</p>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-white border border-zinc-200">
      <div className="flex items-center gap-1.5 text-zinc-500">{icon}<span className="text-[10px] font-black italic uppercase tracking-wider">{label}</span></div>
      <p className="mt-1 text-xl font-black italic text-zinc-900">{value}</p>
    </div>
  );
}
