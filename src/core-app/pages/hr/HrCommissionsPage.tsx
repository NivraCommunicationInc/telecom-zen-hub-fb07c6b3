/**
 * HrCommissionsPage — Real commissions admin: lifecycle, bulk actions, links.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TrendingUp, Loader2, CheckCircle, XCircle, DollarSign, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_activation: { label: "En attente", variant: "secondary" },
  pending: { label: "En attente", variant: "secondary" },
  validated: { label: "Validée", variant: "default" },
  payable: { label: "Payable", variant: "default" },
  included_in_payroll: { label: "Incluse paie", variant: "outline" },
  paid: { label: "Payée", variant: "default" },
  rejected: { label: "Rejetée", variant: "destructive" },
  clawback: { label: "Clawback", variant: "destructive" },
};

export default function HrCommissionsPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ["hr-commissions-admin"],
    queryFn: async () => {
      let query = supabase
        .from("sales_commissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      
      const { data, error } = await query;
      if (error) throw error;

      // Enrich with salesperson names
      const spIds = [...new Set(data.map((c: any) => c.salesperson_id))];
      if (spIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", spIds);
        const map = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
        return data.map((c: any) => ({ ...c, _profile: map[c.salesperson_id] || null }));
      }
      return data;
    },
  });

  // Bulk status update
  const bulkUpdateMut = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updates: Record<string, any> = { status };
      if (status === "validated") {
        updates.validated_at = new Date().toISOString();
        updates.validated_by = user?.id;
      }
      if (status === "paid") {
        updates.paid_at = new Date().toISOString();
        updates.paid_by = user?.id;
      }
      
      for (const id of ids) {
        const { error } = await supabase.from("sales_commissions").update(updates).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      toast.success(`${vars.ids.length} commission(s) → ${STATUS_CONFIG[vars.status]?.label || vars.status}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["hr-commissions-admin"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const filtered = commissions.filter((c: any) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      const name = c._profile?.full_name?.toLowerCase() || "";
      if (!name.includes(s) && !c.id.includes(s)) return false;
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c: any) => c.id)));
    }
  };

  const selectedIds = [...selected];
  const fmt = (n: number) => `${n.toFixed(2)} $`;

  // KPIs
  const totalAmount = commissions.reduce((s: number, c: any) => s + (c.commission_amount || 0), 0);
  const pendingCount = commissions.filter((c: any) => ["pending", "pending_activation"].includes(c.status)).length;
  const payableCount = commissions.filter((c: any) => c.status === "payable").length;
  const paidCount = commissions.filter((c: any) => c.status === "paid" || c.status === "included_in_payroll").length;

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Commissions — Administration
        </h1>
        <p className="text-xs text-muted-foreground">Lifecycle complet : validation, paiement, clawback</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Total commissions</p>
          <p className="text-lg font-bold text-primary">{fmt(totalAmount)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">En attente</p>
          <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Payables</p>
          <p className="text-lg font-bold text-green-600">{payableCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Payées</p>
          <p className="text-lg font-bold">{paidCount}</p>
        </CardContent></Card>
      </div>

      {/* Filters + bulk */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher employé…" className="h-7 text-xs w-48" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="pending_activation">Pending activation</SelectItem>
            <SelectItem value="validated">Validée</SelectItem>
            <SelectItem value="payable">Payable</SelectItem>
            <SelectItem value="included_in_payroll">Incluse paie</SelectItem>
            <SelectItem value="paid">Payée</SelectItem>
            <SelectItem value="rejected">Rejetée</SelectItem>
            <SelectItem value="clawback">Clawback</SelectItem>
          </SelectContent>
        </Select>

        {selectedIds.length > 0 && (
          <div className="flex gap-1 ml-auto">
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
              disabled={bulkUpdateMut.isPending}
              onClick={() => bulkUpdateMut.mutate({ ids: selectedIds, status: "validated" })}>
              <CheckCircle className="h-3 w-3" />Valider ({selectedIds.length})
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
              disabled={bulkUpdateMut.isPending}
              onClick={() => bulkUpdateMut.mutate({ ids: selectedIds, status: "payable" })}>
              <DollarSign className="h-3 w-3" />Payable
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
              disabled={bulkUpdateMut.isPending}
              onClick={() => bulkUpdateMut.mutate({ ids: selectedIds, status: "paid" })}>
              <DollarSign className="h-3 w-3" />Marquer payée
            </Button>
            <Button size="sm" variant="destructive" className="h-7 text-[10px] gap-1"
              disabled={bulkUpdateMut.isPending}
              onClick={() => bulkUpdateMut.mutate({ ids: selectedIds, status: "rejected" })}>
              <XCircle className="h-3 w-3" />Rejeter
            </Button>
            <Button size="sm" variant="destructive" className="h-7 text-[10px] gap-1"
              disabled={bulkUpdateMut.isPending}
              onClick={() => bulkUpdateMut.mutate({ ids: selectedIds, status: "clawback" })}>
              <RotateCcw className="h-3 w-3" />Clawback
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune commission trouvée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={selected.size === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="text-[10px]">Employé</TableHead>
                  <TableHead className="text-[10px]">Vente</TableHead>
                  <TableHead className="text-[10px]">Taux</TableHead>
                  <TableHead className="text-[10px]">Commission</TableHead>
                  <TableHead className="text-[10px]">Bonus</TableHead>
                  <TableHead className="text-[10px]">Statut</TableHead>
                  <TableHead className="text-[10px]">Date</TableHead>
                  <TableHead className="text-[10px]">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c: any) => {
                  const st = STATUS_CONFIG[c.status] || { label: c.status, variant: "secondary" as const };
                  return (
                    <TableRow key={c.id} className={selected.has(c.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                      </TableCell>
                      <TableCell className="text-xs">{c._profile?.full_name || c.salesperson_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs">{fmt(c.sale_amount)}</TableCell>
                      <TableCell className="text-xs">{(c.commission_rate * 100).toFixed(0)}%</TableCell>
                      <TableCell className="text-xs font-medium text-primary">{fmt(c.commission_amount)}</TableCell>
                      <TableCell className="text-xs">{c.bonus_amount ? fmt(c.bonus_amount) : "—"}</TableCell>
                      <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                      <TableCell className="text-[10px]">{format(new Date(c.created_at), "d MMM yyyy", { locale: fr })}</TableCell>
                      <TableCell className="text-[10px] max-w-[120px] truncate">{c.notes || c.rejection_reason || "—"}</TableCell>
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
