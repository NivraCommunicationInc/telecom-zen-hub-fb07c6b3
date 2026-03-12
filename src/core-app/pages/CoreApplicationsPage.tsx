/** CoreApplicationsPage — Transferred from AdminApplications.tsx */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Search } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CoreApplicationsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data: apps = [] } = useQuery({ queryKey: ["core-applications", statusFilter], queryFn: async () => { let q = supabase.from("job_applications" as any).select("*").order("created_at", { ascending: false }).limit(200); if (statusFilter !== "all") q = q.eq("status", statusFilter); const { data } = await q; return (data as any[]) || []; } });
  const statusColors: Record<string, string> = { new: "bg-sky-500/15 text-sky-400", reviewed: "bg-amber-500/15 text-amber-400", interview: "bg-violet-500/15 text-violet-400", hired: "bg-emerald-500/15 text-emerald-400", rejected: "bg-red-500/15 text-red-400" };
  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Candidatures</h1><p className="text-sm text-[hsl(var(--core-text-secondary))]">Gestion des candidatures</p></div>
      <div className="flex items-center gap-3"><div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" /><Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" /></div>
        <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-40 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toutes</SelectItem><SelectItem value="new">Nouvelle</SelectItem><SelectItem value="reviewed">Examinée</SelectItem><SelectItem value="interview">Entrevue</SelectItem><SelectItem value="hired">Embauché</SelectItem><SelectItem value="rejected">Refusée</SelectItem></SelectContent></Select></div>
      <div className="space-y-2">{apps.length === 0 ? <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucune candidature</div> : apps.map((a: any) => (
        <div key={a.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between"><div><p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{a.full_name || a.name}</p><p className="text-xs text-[hsl(var(--core-text-secondary))]">{a.email} · {a.position || "—"} · {a.created_at && format(new Date(a.created_at), "d MMM yyyy", { locale: fr })}</p></div><Badge className={statusColors[a.status] || statusColors.new}>{a.status}</Badge></div>
      ))}</div>
    </div>
  );
}
