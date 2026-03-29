/**
 * HrTaxDocumentsPage — Admin management of tax documents (T4/RL-1 internal summaries).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileText, Loader2, Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  generated: { label: "Généré", variant: "default" },
  sent: { label: "Envoyé", variant: "default" },
  acknowledged: { label: "Accusé reçu", variant: "default" },
};

export default function HrTaxDocumentsPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [search, setSearch] = useState("");

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["hr-tax-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_documents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const empIds = [...new Set(data.map((d: any) => d.user_id))];
      if (empIds.length) {
        const { data: records } = await supabase
          .from("employee_records")
          .select("id, first_name, last_name, employee_number, user_id")
          .in("user_id", empIds);
        const map = Object.fromEntries((records || []).map((r: any) => [r.user_id, r]));
        return data.map((d: any) => ({ ...d, _emp: map[d.user_id] || null }));
      }
      return data;
    },
  });

  const markSentMut = useMutation({
    mutationFn: async (id: string) => {
      const doc = docs.find((d: any) => d.id === id);
      if (doc && !doc.pdf_url) {
        throw new Error("Impossible de marquer comme envoyé sans PDF généré");
      }
      const { error } = await supabase
        .from("tax_documents")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document marqué comme envoyé");
      qc.invalidateQueries({ queryKey: ["hr-tax-documents"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const years = [...new Set(docs.map((d: any) => d.tax_year))].sort((a, b) => b - a);

  const filtered = docs.filter((d: any) => {
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (filterYear !== "all" && String(d.tax_year) !== filterYear) return false;
    if (search) {
      const s = search.toLowerCase();
      const name = d._emp ? `${d._emp.first_name} ${d._emp.last_name}`.toLowerCase() : "";
      if (!name.includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Documents fiscaux — Administration
        </h1>
        <p className="text-xs text-muted-foreground">
          Sommaires fiscaux internes (T4/RL-1) · Avertissement : ces documents sont des sommaires internes et ne constituent pas des documents fiscaux officiels.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher employé…" className="h-7 text-xs w-48" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="h-7 text-xs w-32"><SelectValue placeholder="Année" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes années</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucun document fiscal trouvé.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Employé</TableHead>
                  <TableHead className="text-[10px]">Type</TableHead>
                  <TableHead className="text-[10px]">Année</TableHead>
                  <TableHead className="text-[10px]">Revenu</TableHead>
                  <TableHead className="text-[10px]">Retenues</TableHead>
                  <TableHead className="text-[10px]">Statut</TableHead>
                  <TableHead className="text-[10px]">PDF</TableHead>
                  <TableHead className="text-[10px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d: any) => {
                  const st = STATUS_MAP[d.status] || { label: d.status, variant: "secondary" as const };
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="text-xs">
                        {d._emp ? `${d._emp.first_name} ${d._emp.last_name}` : (d.user_id || "—").slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{d.document_type}</TableCell>
                      <TableCell className="text-xs">{d.tax_year}</TableCell>
                      <TableCell className="text-xs">{d.data_json?.total_income ? `${Number(d.data_json.total_income).toFixed(2)} $` : "—"}</TableCell>
                      <TableCell className="text-xs">{d.total_deductions ? `${Number(d.total_deductions).toFixed(2)} $` : "—"}</TableCell>
                      <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                      <TableCell>
                        {d.pdf_url ? (
                          <a href={d.pdf_url} target="_blank" rel="noreferrer" className="text-primary text-xs flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />Voir
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {d.status === "generated" && d.pdf_url && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                            disabled={markSentMut.isPending}
                            onClick={() => markSentMut.mutate(d.id)}>
                            <Send className="h-3 w-3" />Marquer envoyé
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
