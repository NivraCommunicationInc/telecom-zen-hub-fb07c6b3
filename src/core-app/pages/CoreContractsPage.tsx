/**
 * CoreContractsPage — Transferred from AdminContracts.tsx
 * Contract management and generation
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Search, Download, Eye, Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CoreContractsPage() {
  const [search, setSearch] = useState("");
  const { data: contracts = [] } = useQuery({
    queryKey: ["core-contracts"],
    queryFn: async () => {
      const { data } = await supabase.from("contracts" as any).select("*").order("created_at", { ascending: false }).limit(200);
      return (data as any[]) || [];
    },
  });

  const filtered = contracts.filter((c: any) => !search || [c.client_name, c.contract_number].join(" ").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Contrats</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Gestion des contrats de service</p></div>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="w-4 h-4" /> Nouveau contrat</Button>
      </div>
      <div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
        <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" /></div>
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[hsl(var(--core-text-label))]">{contracts.length === 0 ? "Aucun contrat" : "Aucun résultat"}</div>
        ) : filtered.map((c: any) => (
          <div key={c.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between">
            <div className="flex items-center gap-3"><FileText className="w-4 h-4 text-sky-400 shrink-0" />
              <div><p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{c.contract_number || c.id?.slice(0,8)}</p>
                <p className="text-xs text-[hsl(var(--core-text-secondary))]">{c.client_name || "—"}</p></div></div>
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600/15 text-emerald-400 border-0 text-[10px]">{c.status || "active"}</Badge>
              <Button size="sm" variant="outline" className="border-[hsl(220,15%,20%)] bg-transparent text-[hsl(var(--core-text-secondary))]"><Eye className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
