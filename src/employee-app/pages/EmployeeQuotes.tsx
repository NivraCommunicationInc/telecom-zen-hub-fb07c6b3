/**
 * Employee Quotes Hub — Browse, filter, and manage quotes with tabs and actions.
 */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { useQuotesList } from "@/shared-ops/useQuotesList";
import { logFollowUp, duplicateQuote, sendQuote } from "@/shared-ops/quoteOperations";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, FileText, Eye, Copy, Send, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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
  { value: "draft", label: "Brouillons" },
  { value: "pending_review", label: "En révision" },
  { value: "sent", label: "Envoyées" },
  { value: "viewed", label: "Consultées" },
  { value: "accepted", label: "Acceptées" },
  { value: "rejected", label: "Rejetées" },
  { value: "converted", label: "Converties" },
];

export default function EmployeeQuotes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preFilterClientId = searchParams.get("clientId");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: quotes, isLoading } = useQuotesList({
    sourcePortal: "employee",
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  });

  const filtered = (quotes || []).filter((q: any) => {
    if (preFilterClientId && q.customer_user_id !== preFilterClientId) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      q.quote_number?.toLowerCase().includes(s) ||
      q.prospect_name?.toLowerCase().includes(s) ||
      q.prospect_email?.toLowerCase().includes(s)
    );
  });

  const handleAction = async (action: string, quote: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (action === "duplicate") {
        const newQ = await duplicateQuote(quote.id, session.user.id, "employee");
        toast.success("Soumission dupliquée");
        queryClient.invalidateQueries({ queryKey: ["quotes-list"] });
        navigate(employeePath(`/quotes/${newQ.id}`));
      } else if (action === "send") {
        await sendQuote(quote.id, session.user.id, "employee");
        toast.success("Soumission envoyée");
        queryClient.invalidateQueries({ queryKey: ["quotes-list"] });
      } else if (action === "followup") {
        await logFollowUp(quote.id, session.user.id, "employee");
        toast.success("Relance enregistrée");
        queryClient.invalidateQueries({ queryKey: ["quotes-list"] });
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getClientName = (q: any) => {
    if (q.is_prospect) return q.prospect_name || q.prospect_email || "Prospect";
    return q.prospect_name || "—"; // We'll enhance with joined profile data
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Soumissions</h1>
          <p className="text-sm text-muted-foreground">
            {preFilterClientId ? "Soumissions pour ce client" : "Gérer les soumissions client"}
          </p>
        </div>
        <Button
          onClick={() => navigate(employeePath(preFilterClientId ? `/quotes/new?clientId=${preFilterClientId}` : "/quotes/new"))}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> Nouvelle soumission
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList className="flex-wrap h-auto gap-1">
          {TABS.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Chercher par numéro, nom ou courriel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">Aucune soumission trouvée</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left p-3 font-medium">Numéro</th>
                <th className="text-left p-3 font-medium">Client / Prospect</th>
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
                const clientName = q.is_prospect
                  ? (q.prospect_name || q.prospect_email || "Prospect")
                  : (q.quote_number ? "Client" : "—");
                return (
                  <tr key={q.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs">{q.quote_number}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{clientName}</span>
                        {q.is_prospect && <Badge variant="outline" className="text-[9px]">Prospect</Badge>}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </td>
                    <td className="p-3 text-right font-medium">{Number(q.total_monthly || 0).toFixed(2)} $</td>
                    <td className="p-3 text-right font-medium">{Number(q.total_due_now || 0).toFixed(2)} $</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {q.created_at ? format(new Date(q.created_at), "d MMM yyyy", { locale: fr }) : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => navigate(employeePath(`/quotes/${q.id}`))}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleAction("duplicate", q)} title="Dupliquer">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {q.status === "approved" && (
                          <Button size="sm" variant="ghost" onClick={() => handleAction("send", q)} title="Envoyer">
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {["sent", "viewed"].includes(q.status) && (
                          <Button size="sm" variant="ghost" onClick={() => handleAction("followup", q)} title="Relancer">
                            <RefreshCw className="h-3.5 w-3.5" />
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
