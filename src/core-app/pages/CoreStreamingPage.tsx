/**
 * CoreStreamingPage — Transferred from AdminStreaming.tsx
 * Streaming+ catalog management
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Film, Search, Plus, Star, Globe, Tv } from "lucide-react";

export default function CoreStreamingPage() {
  const [search, setSearch] = useState("");

  const { data: catalog = [] } = useQuery({
    queryKey: ["core-streaming-catalog"],
    queryFn: async () => {
      const { data } = await supabase.from("streaming_catalog" as any).select("*").order("name");
      return (data as any[]) || [];
    },
  });

  const filtered = catalog.filter((c: any) => !search || c.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Streaming+</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Catalogue des services de streaming</p></div>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="w-4 h-4" /> Ajouter</Button>
      </div>

      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
        <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" /></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-[hsl(var(--core-text-label))]">
            {catalog.length === 0 ? "Aucun service de streaming configuré" : "Aucun résultat"}
          </div>
        ) : filtered.map((s: any) => (
          <div key={s.id} className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
            <div className="flex items-center gap-2 mb-2"><Film className="w-4 h-4 text-violet-400" /><Badge className="bg-violet-500/15 text-violet-400 border-0 text-[10px]">{s.type || "Streaming"}</Badge></div>
            <h3 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">{s.name}</h3>
            <p className="text-xs text-[hsl(var(--core-text-secondary))] mt-1">{s.description || "—"}</p>
            {s.price && <p className="text-lg font-bold text-emerald-400 mt-2">{Number(s.price).toFixed(2)}$/mois</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
