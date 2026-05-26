/**
 * CoreInternalTicketsPage — Transferred from AdminInternalTickets.tsx
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Search, Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CoreInternalTicketsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: tickets = [] } = useQuery({
    queryKey: ["core-internal-tickets", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("support_tickets" as any)
        .select("*")
        .eq("is_internal", true)
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data } = await q;
      return (data as any[]) || [];
    },
  });
  const statusColors: Record<string, string> = { open: "bg-sky-500/15 text-sky-400", in_progress: "bg-amber-500/15 text-amber-400", resolved: "bg-emerald-500/15 text-emerald-400", closed: "bg-[hsl(220,15%,20%)] text-[hsl(var(--core-text-label))]" };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Tickets internes</h1><p className="text-sm text-[hsl(var(--core-text-secondary))]">Tickets d'opérations internes</p></div>
        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="w-4 h-4" /> Nouveau ticket</Button>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" /><Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-40 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="open">Ouvert</SelectItem><SelectItem value="in_progress">En cours</SelectItem><SelectItem value="resolved">Résolu</SelectItem><SelectItem value="closed">Fermé</SelectItem></SelectContent></Select>
      </div>
      <div className="space-y-2">{tickets.length === 0 ? <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucun ticket interne</div> : tickets.map((t: any) => (
        <div key={t.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between">
          <div><p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{t.ticket_number || t.id?.slice(0,8)} — {t.subject || t.title}</p><p className="text-xs text-[hsl(var(--core-text-secondary))]">{t.category || "Opérations"} · {t.created_at && format(new Date(t.created_at), "d MMM yyyy", { locale: fr })}</p></div>
          <Badge className={statusColors[t.status] || statusColors.open}>{t.status}</Badge>
        </div>
      ))}</div>
    </div>
  );
}
