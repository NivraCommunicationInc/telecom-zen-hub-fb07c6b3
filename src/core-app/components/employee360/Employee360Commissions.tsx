import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  pending_activation: "secondary",
  pending: "secondary",
  validated: "outline",
  approved: "default",
  payable: "default",
  included_in_payroll: "default",
  paid: "default",
  clawback: "destructive",
  rejected: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  pending_activation: "En attente",
  pending: "En attente",
  validated: "Validée",
  approved: "Approuvée",
  payable: "Payable",
  included_in_payroll: "Dans paie",
  paid: "Payée",
  clawback: "Clawback",
  rejected: "Rejetée",
};

type Props = { userId: string };

export default function Employee360Commissions({ userId }: Props) {
  // Canonical source = unified_commissions view (employee_id covers both sales + field).
  const { data: unified, isLoading } = useQuery({
    queryKey: ["e360-unified-comm", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unified_commissions")
        .select("id, employee_id, source, amount, status, reference_id, created_at, paid_at, validated_at")
        .eq("employee_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        // Fallback: read both base tables if the view is unavailable for this user.
        const [{ data: s }, { data: f }] = await Promise.all([
          supabase.from("sales_commissions").select("id, salesperson_id, commission_amount, status, converted_order_id, order_id, created_at, paid_at").eq("salesperson_id", userId).order("created_at", { ascending: false }).limit(100),
          supabase.from("field_commissions").select("id, agent_id, amount, status, field_order_id, created_at, paid_at").eq("agent_id", userId).order("created_at", { ascending: false }).limit(100),
        ]);
        return [
          ...((s ?? []).map((r: any) => ({ id: r.id, source: "sales", amount: r.commission_amount, status: r.status, reference_id: r.converted_order_id || r.order_id, created_at: r.created_at, paid_at: r.paid_at }))),
          ...((f ?? []).map((r: any) => ({ id: r.id, source: "field", amount: r.amount, status: r.status, reference_id: r.field_order_id, created_at: r.created_at, paid_at: r.paid_at }))),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      return data ?? [];
    },
  });

  const allComm = unified ?? [];

  const totals = {
    total: allComm.reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0),
    payable: allComm.filter((c: any) => ["payable", "approved", "validated"].includes(c.status)).reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0),
    paid: allComm.filter((c: any) => ["paid", "included_in_payroll"].includes(c.status)).reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0),
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total commissions</p><p className="text-lg font-semibold text-foreground">{totals.total.toFixed(2)} $</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Payable</p><p className="text-lg font-semibold text-primary">{totals.payable.toFixed(2)} $</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Payée / dans paie</p><p className="text-lg font-semibold text-foreground">{totals.paid.toFixed(2)} $</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Historique des commissions ({allComm.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : allComm.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Aucune commission trouvée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Référence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allComm.map((c: any) => (
                  <TableRow key={`${c.source}-${c.id}`}>
                    <TableCell className="text-xs">{format(new Date(c.created_at), "dd MMM yyyy", { locale: fr })}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{c.source === "sales" ? "Ventes" : "Terrain"}</Badge></TableCell>
                    <TableCell className="font-medium">{Number(c.amount ?? 0).toFixed(2)} $</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[c.status] as any || "secondary"}>
                        {STATUS_LABELS[c.status] || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{c.reference_id ? String(c.reference_id).slice(0, 8) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
