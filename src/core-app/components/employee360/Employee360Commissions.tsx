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
  validated: "outline",
  payable: "default",
  included_in_payroll: "default",
  paid: "default",
  clawback: "destructive",
  rejected: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  pending_activation: "En attente",
  validated: "Validée",
  payable: "Payable",
  included_in_payroll: "Dans paie",
  paid: "Payée",
  clawback: "Clawback",
  rejected: "Rejetée",
};

type Props = { userId: string };

export default function Employee360Commissions({ userId }: Props) {
  const { data: salesComm, isLoading: loadSales } = useQuery({
    queryKey: ["e360-sales-comm", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_commissions")
        .select("*")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: fieldComm, isLoading: loadField } = useQuery({
    queryKey: ["e360-field-comm", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("field_commissions")
        .select("*")
        .eq("salesperson_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const loading = loadSales || loadField;
  const allComm = [
    ...(salesComm?.map((c) => ({ ...c, source: "sales" as const })) ?? []),
    ...(fieldComm?.map((c) => ({ ...c, source: "field" as const, amount: c.commission_amount })) ?? []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const totals = {
    total: allComm.reduce((s, c) => s + (c.amount ?? 0), 0),
    payable: allComm.filter((c) => c.status === "payable").reduce((s, c) => s + (c.amount ?? 0), 0),
    paid: allComm.filter((c) => c.status === "paid" || c.status === "included_in_payroll").reduce((s, c) => s + (c.amount ?? 0), 0),
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
          {loading ? (
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
                {allComm.map((c) => (
                  <TableRow key={`${c.source}-${c.id}`}>
                    <TableCell className="text-xs">{format(new Date(c.created_at), "dd MMM yyyy", { locale: fr })}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{c.source === "sales" ? "Ventes" : "Terrain"}</Badge></TableCell>
                    <TableCell className="font-medium">{(c.amount ?? 0).toFixed(2)} $</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[c.status] as any || "secondary"}>
                        {STATUS_LABELS[c.status] || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.order_id?.slice(0, 8) || "—"}</TableCell>
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
