/**
 * CoreDocumentsPage — Transferred from AdminDocumentRequests.tsx
 * Client document requests and file management
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Search, Download, Eye, Clock, CheckCircle, AlertTriangle, RefreshCw, Send, User } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

export default function CoreDocumentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["core-doc-requests", statusFilter],
    queryFn: async () => {
      let q = supabase.from("document_requests" as any).select("*").order("created_at", { ascending: false }).limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data } = await q;
      return (data as any[]) || [];
    },
  });

  const filtered = requests.filter((r: any) =>
    !search || [r.client_name, r.client_email, r.document_type].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await supabase.from("document_requests" as any).update({ status }).eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-doc-requests"] });
      toast.success("Statut mis à jour");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Documents</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Demandes de documents clients</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="processing">Traitement</SelectItem>
            <SelectItem value="ready">Prêt</SelectItem>
            <SelectItem value="sent">Envoyé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucune demande de document</div>
        ) : (
          filtered.map((r: any) => (
            <div key={r.id} className="p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{r.document_type || "Document"}</p>
                  <p className="text-xs text-[hsl(var(--core-text-secondary))]">{r.client_name || r.client_email || "Client"}</p>
                  <p className="text-[11px] text-[hsl(var(--core-text-label))]">
                    {r.created_at && format(new Date(r.created_at), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-secondary))] border-0">{r.status || "pending"}</Badge>
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: r.id, status: "processing" })}
                  className="border-[hsl(220,15%,20%)] bg-transparent text-[hsl(var(--core-text-secondary))] text-xs">
                  Traiter
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
