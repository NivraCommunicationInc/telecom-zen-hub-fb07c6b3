/**
 * CoreReferralsPage — Transferred from AdminReferrals.tsx
 * Referral / affiliate program management
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Search, DollarSign, QrCode, TrendingUp, Settings } from "lucide-react";

export default function CoreReferralsPage() {
  const [search, setSearch] = useState("");

  const { data: influencers = [] } = useQuery({
    queryKey: ["core-influencers"],
    queryFn: async () => {
      const { data } = await supabase.from("influencers" as any).select("*").order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const { data: codes = [] } = useQuery({
    queryKey: ["core-referral-codes"],
    queryFn: async () => {
      const { data } = await supabase.from("referral_codes" as any).select("*").order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const { data: cashouts = [] } = useQuery({
    queryKey: ["core-cashouts"],
    queryFn: async () => {
      const { data } = await supabase.from("cashout_requests").select("*, influencers(display_name, email)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Parrainage</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Programme de parrainage et d'affiliation</p></div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-emerald-400" /><span className="text-xs text-[hsl(var(--core-text-label))]">Influenceurs</span></div>
          <p className="text-2xl font-bold text-[hsl(var(--core-text-primary))]">{influencers.length}</p>
        </div>
        <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
          <div className="flex items-center gap-2 mb-1"><QrCode className="w-4 h-4 text-sky-400" /><span className="text-xs text-[hsl(var(--core-text-label))]">Codes actifs</span></div>
          <p className="text-2xl font-bold text-[hsl(var(--core-text-primary))]">{codes.filter((c: any) => c.is_active).length}</p>
        </div>
        <div className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-amber-400" /><span className="text-xs text-[hsl(var(--core-text-label))]">Cashouts en attente</span></div>
          <p className="text-2xl font-bold text-[hsl(var(--core-text-primary))]">{cashouts.filter((c: any) => c.status === "pending").length}</p>
        </div>
      </div>

      <Tabs defaultValue="influencers" className="space-y-4">
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,20%)]">
          <TabsTrigger value="influencers" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Influenceurs</TabsTrigger>
          <TabsTrigger value="codes" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Codes</TabsTrigger>
          <TabsTrigger value="cashouts" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Cashouts</TabsTrigger>
        </TabsList>

        <TabsContent value="influencers" className="space-y-2">
          {influencers.map((i: any) => (
            <div key={i.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between">
              <div><p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{i.display_name || i.email}</p>
                <p className="text-xs text-[hsl(var(--core-text-secondary))]">{i.email}</p></div>
              <Badge className={i.is_active ? "bg-emerald-600/15 text-emerald-400 border-0" : "bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-label))] border-0"}>{i.is_active ? "Actif" : "Inactif"}</Badge>
            </div>
          ))}
          {influencers.length === 0 && <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucun influenceur</div>}
        </TabsContent>

        <TabsContent value="codes" className="space-y-2">
          {codes.map((c: any) => (
            <div key={c.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between">
              <div><p className="text-sm font-medium font-mono text-emerald-400">{c.code}</p>
                <p className="text-xs text-[hsl(var(--core-text-secondary))]">Utilisations: {c.usage_count || 0}</p></div>
              <Badge className={c.is_active ? "bg-emerald-600/15 text-emerald-400 border-0" : "bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-label))] border-0"}>{c.is_active ? "Actif" : "Inactif"}</Badge>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="cashouts" className="space-y-2">
          {cashouts.map((c: any) => (
            <div key={c.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between">
              <div><p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{(c as any).influencers?.display_name} — {c.amount?.toFixed(2)}$</p>
                <p className="text-xs text-[hsl(var(--core-text-secondary))]">{c.method} · {c.destination}</p></div>
              <Badge className={c.status === "pending" ? "bg-amber-500/15 text-amber-400 border-0" : c.status === "approved" ? "bg-emerald-600/15 text-emerald-400 border-0" : "bg-red-500/15 text-red-400 border-0"}>{c.status}</Badge>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
