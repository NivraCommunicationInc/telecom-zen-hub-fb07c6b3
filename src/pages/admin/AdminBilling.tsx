import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-500",
  paid: "bg-emerald-500/20 text-emerald-500",
  overdue: "bg-red-500/20 text-red-500",
  cancelled: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  pending: "En attente",
  paid: "Payé",
  overdue: "En retard",
  cancelled: "Annulé",
};

const AdminBilling = () => {
  const { data: billing, isLoading } = useQuery({
    queryKey: ["admin-billing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing")
        .select("*, profiles!billing_user_id_fkey(email, full_name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Facturation</h1>
          <p className="text-muted-foreground mt-1">Gérer les factures et paiements</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-cyan-400" />
              Historique de facturation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : billing && billing.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">ID</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Montant</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Échéance</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Payé le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billing.map((bill: any) => (
                      <tr key={bill.id} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="py-3 px-4 text-sm text-foreground font-mono">
                          {bill.id.slice(0, 8)}...
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-foreground">{bill.profiles?.full_name || "N/A"}</p>
                          <p className="text-xs text-muted-foreground">{bill.profiles?.email}</p>
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground font-medium">
                          {Number(bill.amount).toLocaleString("fr-CA", {
                            style: "currency",
                            currency: "CAD",
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {bill.due_date
                            ? format(new Date(bill.due_date), "d MMM yyyy", { locale: fr })
                            : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={statusColors[bill.status] || "bg-muted"}>
                            {statusLabels[bill.status] || bill.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {bill.paid_at
                            ? format(new Date(bill.paid_at), "d MMM yyyy", { locale: fr })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune facture pour le moment</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminBilling;
