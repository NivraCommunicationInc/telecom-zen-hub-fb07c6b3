import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  pending: "outline",
  approved: "default",
  paid: "default",
  cancelled: "destructive",
};

type Props = { userId: string };

export default function Employee360Payroll({ userId }: Props) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["e360-payroll", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_entries")
        .select("*, pay_periods(*)")
        .eq("employee_id", userId)
        .order("created_at", { ascending: false })
        .limit(24);
      return data ?? [];
    },
  });

  if (isLoading) {
    return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const totalGross = entries?.reduce((s, e) => s + (e.gross_pay ?? 0), 0) ?? 0;
  const totalNet = entries?.reduce((s, e) => s + (e.net_pay ?? 0), 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Fiches de paie</p><p className="text-lg font-semibold text-foreground">{entries?.length ?? 0}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total brut</p><p className="text-lg font-semibold text-foreground">{totalGross.toFixed(2)} $</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total net</p><p className="text-lg font-semibold text-primary">{totalNet.toFixed(2)} $</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Fiches de paie</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!entries?.length ? (
            <p className="p-4 text-sm text-muted-foreground">Aucune fiche de paie.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Période</TableHead>
                  <TableHead>Brut</TableHead>
                  <TableHead>Déductions</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const period = e.pay_periods as any;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">
                        {period ? `${format(new Date(period.start_date), "dd MMM", { locale: fr })} – ${format(new Date(period.end_date), "dd MMM yyyy", { locale: fr })}` : "—"}
                      </TableCell>
                      <TableCell className="font-medium">{(e.gross_pay ?? 0).toFixed(2)} $</TableCell>
                      <TableCell className="text-muted-foreground">{(e.total_deductions ?? 0).toFixed(2)} $</TableCell>
                      <TableCell className="font-medium">{(e.net_pay ?? 0).toFixed(2)} $</TableCell>
                      <TableCell><Badge variant={STATUS_COLORS[e.status] as any || "secondary"}>{e.status}</Badge></TableCell>
                      <TableCell>{e.pdf_url ? <a href={e.pdf_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs">Voir PDF</a> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
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
