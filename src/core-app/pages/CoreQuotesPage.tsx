/**
 * Core Admin Quotes List — Review, approve, and manage all quotes with enriched tracking columns.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuotesList } from "@/shared-ops/useQuotesList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, Eye, AlertCircle, UserPlus, ArrowRightCircle, Download, Link2, CheckCircle, Plus } from "lucide-react";
import { downloadQuotePDF, getQuotePublicUrl } from "@/shared-ops/quoteOperations";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

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

const TABS = [
  { value: "all", label: "Toutes" },
  { value: "pending_review", label: "En révision" },
  { value: "draft", label: "Brouillons" },
  { value: "approved", label: "Approuvées" },
  { value: "sent", label: "Envoyées" },
  { value: "accepted", label: "Acceptées" },
  { value: "rejected", label: "Rejetées" },
  { value: "converted", label: "Converties" },
];

type SourceFilter = "all" | "employee" | "core";

export default function CoreQuotesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [convertedFilter, setConvertedFilter] = useState<string>("all");

  const { data: quotes, isLoading } = useQuotesList({
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  });

  const filtered = (quotes || []).filter((q: any) => {
    if (sourceFilter !== "all" && q.source_portal !== sourceFilter) return false;
    if (convertedFilter === "converted" && !q.converted_order_id) return false;
    if (convertedFilter === "not_converted" && q.converted_order_id) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      q.quote_number?.toLowerCase().includes(s) ||
      q.prospect_name?.toLowerCase().includes(s) ||
      q.prospect_email?.toLowerCase().includes(s)
    );
  });

  const pendingCount = (quotes || []).filter((q: any) => q.status === "pending_review").length;

  const handleQuickAction = async (action: string, quote: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (action === "pdf") {
        await downloadQuotePDF(quote.id);
        toast.success("PDF téléchargé");
      } else if (action === "copylink" && quote.public_token) {
        navigator.clipboard.writeText(getQuotePublicUrl(quote.public_token));
        toast.success("Lien copié");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Soumissions</h1>
          <p className="text-sm text-muted-foreground">Gestion complète des soumissions</p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge variant="outline" className="gap-1 text-amber-600 border-amber-500/30">
              <AlertCircle className="h-3 w-3" /> {pendingCount} en attente d'approbation
            </Badge>
          )}
          <Button onClick={() => navigate("/core/quotes/new")} className="gap-2">
            <Plus className="h-4 w-4" /> Nouvelle soumission
          </Button>
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="flex-wrap h-auto gap-1">
          {TABS.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filters row */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Chercher par numéro, nom ou courriel..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5">
          {(["all", "employee", "core"] as SourceFilter[]).map(s => (
            <Button key={s} size="sm" variant={sourceFilter === s ? "default" : "outline"} onClick={() => setSourceFilter(s)} className="text-xs h-8">
              {s === "all" ? "Toutes sources" : s === "employee" ? "Employé" : "Core"}
            </Button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[
            { value: "all", label: "Toutes" },
            { value: "converted", label: "Converties" },
            { value: "not_converted", label: "Non converties" },
          ].map(f => (
            <Button key={f.value} size="sm" variant={convertedFilter === f.value ? "default" : "outline"} onClick={() => setConvertedFilter(f.value)} className="text-xs h-8">
              {f.label}
            </Button>
          ))}
        </div>
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
                <th className="text-left p-3 font-medium">Client / Prospect</th>
                <th className="text-left p-3 font-medium">Source</th>
                <th className="text-left p-3 font-medium">Statut</th>
                <th className="text-right p-3 font-medium">Mensuel</th>
                <th className="text-right p-3 font-medium">Total</th>
                <th className="text-left p-3 font-medium">Dernier envoi</th>
                <th className="text-left p-3 font-medium">Relance</th>
                <th className="text-left p-3 font-medium">Validité</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q: any) => {
                const st = STATUS_LABELS[q.status] || { label: q.status, variant: "secondary" as const };
                const clientName = q.is_prospect
                  ? (q.prospect_name || q.prospect_email || "Prospect")
                  : (q.prospect_name || "Client");
                const isExpired = q.valid_until && new Date(q.valid_until) < new Date();
                return (
                  <tr
                    key={q.id}
                    className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/core/quotes/${q.id}`)}
                  >
                    <td className="p-3 font-mono text-xs">{q.quote_number}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{clientName}</span>
                        {q.is_prospect && <UserPlus className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[10px]">{q.source_portal === "employee" ? "Employé" : "Core"}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={st.variant}>{st.label}</Badge>
                        {q.converted_order_id && <CheckCircle className="h-3 w-3 text-emerald-600" />}
                      </div>
                    </td>
                    <td className="p-3 text-right font-medium">{Number(q.total_monthly || 0).toFixed(2)} $</td>
                    <td className="p-3 text-right font-medium">{Number(q.total_due_now || 0).toFixed(2)} $</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {q.last_sent_at ? format(new Date(q.last_sent_at), "d MMM yyyy", { locale: fr }) : "—"}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {q.last_followup_at ? format(new Date(q.last_followup_at), "d MMM", { locale: fr }) : "—"}
                    </td>
                    <td className="p-3 text-xs">
                      {q.valid_until ? (
                        <span className={isExpired ? "text-destructive" : "text-muted-foreground"}>
                          {format(new Date(q.valid_until), "d MMM yyyy", { locale: fr })}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/core/quotes/${q.id}`)} title="Voir">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={(e) => handleQuickAction("pdf", q, e)} title="PDF">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {q.public_token && (
                          <Button size="sm" variant="ghost" onClick={(e) => handleQuickAction("copylink", q, e)} title="Copier lien">
                            <Link2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
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
