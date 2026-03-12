/**
 * CoreRequestsPage — Transferred from AdminRequests.tsx
 * Contact requests / form submissions management
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Eye, Send, Search, RefreshCw, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  new: "bg-sky-500/15 text-sky-400",
  in_progress: "bg-amber-500/15 text-amber-400",
  resolved: "bg-emerald-500/15 text-emerald-400",
  closed: "bg-[hsl(220,15%,20%)] text-[hsl(var(--core-text-label))]",
};

export default function CoreRequestsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["core-requests", statusFilter],
    queryFn: async () => {
      let q = supabase.from("contact_requests").select("*").order("created_at", { ascending: false }).limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data } = await q;
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from("contact_requests").update({ status } as any).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-requests"] });
      toast.success("Statut mis à jour");
    },
  });

  const filtered = requests.filter((r: any) =>
    !search || [r.name, r.email, r.subject, r.message].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Demandes</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">{requests.length} demandes</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="new">Nouveau</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="resolved">Résolu</SelectItem>
            <SelectItem value="closed">Fermé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.map((r: any) => (
          <div key={r.id} onClick={() => setSelected(r)}
            className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] cursor-pointer hover:border-emerald-600/30 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-[hsl(var(--core-text-label))]" />
                <span className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{r.name || r.email}</span>
              </div>
              <Badge className={statusColors[r.status] || statusColors.new}>{r.status}</Badge>
            </div>
            <p className="text-sm text-[hsl(var(--core-text-secondary))] font-medium">{r.subject || "Sans sujet"}</p>
            <p className="text-xs text-[hsl(var(--core-text-label))] mt-1 line-clamp-1">{r.message}</p>
            <p className="text-[11px] text-[hsl(var(--core-text-label))] mt-1">
              {r.created_at && format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: fr })}
            </p>
          </div>
        ))}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg bg-[hsl(220,15%,11%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]">
          <DialogHeader><DialogTitle>{selected?.subject || "Demande"}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-[hsl(var(--core-text-label))]">Nom:</span> {selected.name}</div>
                <div><span className="text-[hsl(var(--core-text-label))]">Email:</span> {selected.email}</div>
                <div><span className="text-[hsl(var(--core-text-label))]">Téléphone:</span> {selected.phone || "—"}</div>
                <div><span className="text-[hsl(var(--core-text-label))]">Statut:</span> <Badge className={statusColors[selected.status]}>{selected.status}</Badge></div>
              </div>
              <div className="p-3 rounded-md bg-[hsl(220,15%,14%)]">
                <p className="text-sm text-[hsl(var(--core-text-secondary))]">{selected.message}</p>
              </div>
              <div className="flex gap-2">
                {["new", "in_progress", "resolved", "closed"].map((s) => (
                  <Button key={s} size="sm" variant={selected.status === s ? "default" : "outline"}
                    onClick={() => { updateStatus.mutate({ id: selected.id, status: s }); setSelected({ ...selected, status: s }); }}
                    className={selected.status === s ? "bg-emerald-600 text-white" : "border-[hsl(220,15%,20%)] bg-transparent text-[hsl(var(--core-text-secondary))]"}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
