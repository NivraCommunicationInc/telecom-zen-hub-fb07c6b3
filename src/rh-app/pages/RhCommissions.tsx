/**
 * RhCommissions — Employee's commission history (read-only).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Loader2 } from "lucide-react";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  pending: { label: "En attente", variant: "secondary" },
  approved: { label: "Approuvé", variant: "outline" },
  paid: { label: "Payé", variant: "default" },
  disputed: { label: "Contesté", variant: "secondary" },
};

export default function RhCommissions() {
  const { data: commissions, isLoading } = useQuery({
    queryKey: ["rh-commissions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("sales_commissions")
        .select("*")
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const totalPaid = commissions?.filter((c: any) => c.status === "paid").reduce((sum: number, c: any) => sum + Number(c.amount), 0) ?? 0;
  const totalPending = commissions?.filter((c: any) => c.status === "pending" || c.status === "approved").reduce((sum: number, c: any) => sum + Number(c.amount), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-emerald-600" />
          Mes commissions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Historique de vos commissions sur ventes</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Total payé</p>
            <p className="text-2xl font-bold text-foreground">{fmt(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">En attente</p>
            <p className="text-2xl font-bold text-foreground">{fmt(totalPending)}</p>
          </CardContent>
        </Card>
      </div>

      {!commissions?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune commission enregistrée.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {commissions.map((c: any) => {
            const status = STATUS_MAP[c.status] || { label: c.status, variant: "secondary" as const };
            return (
              <Card key={c.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex items-center justify-between py-3 px-5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {c.description || c.commission_type || "Commission"}
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("fr-CA")}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-foreground">{fmt(Number(c.amount))}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
