/**
 * HrDocumentsPage — Admin management of employment letters (demandes, approbation, PDF).
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
import { FileText, Loader2, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  requested: { label: "Demandée", variant: "outline" },
  approved: { label: "Approuvée", variant: "default" },
  generated: { label: "Générée", variant: "default" },
  sent: { label: "Envoyée", variant: "default" },
  rejected: { label: "Rejetée", variant: "destructive" },
};

export default function HrDocumentsPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data: letters = [], isLoading } = useQuery({
    queryKey: ["hr-employment-letters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employment_letters")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const empIds = [...new Set(data.map((l: any) => l.employee_id))];
      if (empIds.length) {
        const { data: records } = await supabase
          .from("employee_records")
          .select("id, first_name, last_name, employee_number, user_id")
          .in("user_id", empIds);
        const map = Object.fromEntries((records || []).map((r: any) => [r.user_id, r]));
        return data.map((l: any) => ({ ...l, _emp: map[l.employee_id] || null }));
      }
      return data;
    },
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, any> = { status };
      if (status === "approved") {
        const { data: { user } } = await supabase.auth.getUser();
        updates.approved_by = user?.id;
        updates.approved_at = new Date().toISOString();
      }
      const { error } = await supabase.from("employment_letters").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(`Lettre → ${STATUS_MAP[vars.status]?.label || vars.status}`);
      qc.invalidateQueries({ queryKey: ["hr-employment-letters"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const filtered = letters.filter((l: any) => {
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      const name = l._emp ? `${l._emp.first_name} ${l._emp.last_name}`.toLowerCase() : "";
      if (!name.includes(s) && !(l._emp?.employee_number || "").toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Documents RH — Lettres d'emploi
        </h1>
        <p className="text-xs text-muted-foreground">Gestion des demandes de lettres, approbation et génération PDF</p>
      </div>

      <div className="flex items-center gap-3">
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
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune lettre trouvée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Employé</TableHead>
                  <TableHead className="text-[10px]">Type</TableHead>
                  <TableHead className="text-[10px]">Statut</TableHead>
                  <TableHead className="text-[10px]">Demandé le</TableHead>
                  <TableHead className="text-[10px]">PDF</TableHead>
                  <TableHead className="text-[10px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l: any) => {
                  const st = STATUS_MAP[l.status] || { label: l.status, variant: "secondary" as const };
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">
                        {l._emp ? `${l._emp.first_name} ${l._emp.last_name}` : l.employee_id.slice(0, 8)}
                        {l._emp?.employee_number && <span className="ml-1 text-[10px] text-muted-foreground">({l._emp.employee_number})</span>}
                      </TableCell>
                      <TableCell className="text-xs">{l.letter_type}</TableCell>
                      <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                      <TableCell className="text-[10px]">{format(new Date(l.created_at), "d MMM yyyy", { locale: fr })}</TableCell>
                      <TableCell>
                        {l.pdf_url ? (
                          <a href={l.pdf_url} target="_blank" rel="noreferrer" className="text-primary text-xs flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" />Voir
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {l.status === "requested" && (
                            <>
                              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                                disabled={updateStatusMut.isPending}
                                onClick={() => updateStatusMut.mutate({ id: l.id, status: "approved" })}>
                                <CheckCircle className="h-3 w-3" />Approuver
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-destructive"
                                disabled={updateStatusMut.isPending}
                                onClick={() => updateStatusMut.mutate({ id: l.id, status: "rejected" })}>
                                <XCircle className="h-3 w-3" />Rejeter
                              </Button>
                            </>
                          )}
                        </div>
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
