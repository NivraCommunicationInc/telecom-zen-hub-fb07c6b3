/**
 * CoreContestsPage — Transferred from AdminContests.tsx
 * Contest management
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Search, Plus, Users, Calendar } from "lucide-react";

export default function CoreContestsPage() {
  const [search, setSearch] = useState("");
  const { data: contests = [] } = useQuery({
    queryKey: ["core-contests"],
    queryFn: async () => {
      const { data } = await supabase.from("contests" as any).select("*").order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Concours</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Gestion des concours et tirages</p></div>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="w-4 h-4" /> Nouveau concours</Button>
      </div>
      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
        <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" /></div>
      <div className="space-y-2">
        {contests.length === 0 ? (
          <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucun concours configuré</div>
        ) : contests.map((c: any) => (
          <div key={c.id} className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-400" /><h3 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">{c.name || c.title}</h3></div>
              <Badge className={c.is_active ? "bg-emerald-600/15 text-emerald-400 border-0" : "bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-label))] border-0"}>{c.is_active ? "Actif" : "Inactif"}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
