/**
 * Core Admin Quotes List — Review, approve, and manage all quotes.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuotesList } from "@/shared-ops/useQuotesList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Eye, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  pending_review: { label: "En révision", variant: "outline" },
  approved: { label: "Approuvée", variant: "default" },
  sent: { label: "Envoyée", variant: "default" },
  viewed: { label: "Consultée", variant: "outline" },
  accepted: { label: "Acceptée", variant: "default" },
  rejected: { label: "Rejetée", variant: "destructive" },
  expired: { label: "Expirée", variant: "secondary" },
  converted: { label: "Convertie", variant: "default" },
};

export default function CoreQuotesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: quotes, isLoading } = useQuotesList({
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  });

  const filtered = (quotes || []).filter((q: any) => {
    if (!search) return true;
    return q.quote_number?.toLowerCase().includes(search.toLowerCase());
  });

  const pendingCount = (quotes || []).filter((q: any) => q.status === "pending_review").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Soumissions</h1>
          <p className="text-sm text-muted-foreground">Gestion complète des soumissions</p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500/30">
            <AlertCircle className="h-3 w-3" /> {pendingCount} en attente d'approbation
          </Badge>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Chercher par numéro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending_review">En révision</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="approved">Approuvée</SelectItem>
            <SelectItem value="sent">Envoyée</SelectItem>
            <SelectItem value="accepted">Acceptée</SelectItem>
            <SelectItem value="rejected">Rejetée</SelectItem>
            <SelectItem value="converted">Convertie</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Aucune soumission</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left p-3 font-medium">Numéro</th>
                <th className="text-left p-3 font-medium">Source</th>
                <th className="text-left p-3 font-medium">Statut</th>
                <th className="text-right p-3 font-medium">Mensuel</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q: any) => {
                const st = STATUS_LABELS[q.status] || { label: q.status, variant: "secondary" as const };
                return (
                  <tr key={q.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs">{q.quote_number}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px]">{q.source_portal === "employee" ? "Employé" : "Core"}</Badge>
                    </td>
                    <td className="p-3"><Badge variant={st.variant}>{st.label}</Badge></td>
                    <td className="p-3 text-right font-medium">{Number(q.total_monthly || 0).toFixed(2)} $</td>
                    <td className="p-3 text-right font-medium">{Number(q.total_due_now || 0).toFixed(2)} $</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {q.created_at ? format(new Date(q.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/core/quotes/${q.id}`)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Voir
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
