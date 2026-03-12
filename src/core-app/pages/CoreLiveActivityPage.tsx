/**
 * CoreLiveActivityPage — Transferred from LiveActivityPage.tsx
 * Real-time activity monitoring
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Activity, Users, ShoppingCart, LogIn, Clock, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CoreLiveActivityPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: presenceData = [], refetch } = useQuery({
    queryKey: ["core-live-presence"],
    queryFn: async () => {
      const { data } = await supabase.from("user_presence" as any).select("*").order("last_seen_at", { ascending: false }).limit(50);
      return data || [];
    },
    refetchInterval: autoRefresh ? 5000 : false,
  });

  const { data: recentActions = [] } = useQuery({
    queryKey: ["core-live-actions"],
    queryFn: async () => {
      const { data } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Activité en direct</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Monitoring temps réel</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <span className="text-xs text-[hsl(var(--core-text-label))]">Auto-refresh</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 border-[hsl(220,15%,20%)] bg-transparent text-[hsl(var(--core-text-secondary))]">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Online users */}
      <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Utilisateurs en ligne</h2>
          <Badge className="bg-emerald-600/15 text-emerald-400 border-0 text-[10px]">{presenceData.length}</Badge>
        </div>
        {presenceData.length === 0 ? (
          <p className="text-sm text-[hsl(var(--core-text-label))]">Aucun utilisateur en ligne</p>
        ) : (
          <div className="space-y-2">
            {presenceData.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 py-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-sm text-[hsl(var(--core-text-primary))]">{u.email || u.user_id?.slice(0, 8)}</span>
                <span className="text-xs text-[hsl(var(--core-text-label))] ml-auto">{u.current_page || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent actions */}
      <div className="rounded-xl border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Actions récentes</h2>
        </div>
        <div className="space-y-2">
          {recentActions.map((a: any) => (
            <div key={a.id} className="flex items-center gap-3 py-1.5 text-sm">
              <Clock className="w-3.5 h-3.5 text-[hsl(var(--core-text-label))] shrink-0" />
              <span className="text-[hsl(var(--core-text-secondary))]">{a.actor_name || "Système"}</span>
              <span className="text-[hsl(var(--core-text-label))]">{a.action}</span>
              <span className="text-[hsl(var(--core-text-label))] ml-auto text-xs">
                {a.created_at ? new Date(a.created_at).toLocaleTimeString("fr-CA") : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
