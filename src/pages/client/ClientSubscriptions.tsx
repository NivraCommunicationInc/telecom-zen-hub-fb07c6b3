import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ClientSubscriptions = () => {
  const { user } = useAuth();

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ["client-subscriptions-all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-500",
    cancelled: "bg-red-500/20 text-red-500",
    paused: "bg-amber-500/20 text-amber-500",
  };

  const statusLabels: Record<string, string> = {
    active: "Actif",
    cancelled: "Annulé",
    paused: "Suspendu",
  };

  const billingCycleLabels: Record<string, string> = {
    monthly: "Mensuel",
    yearly: "Annuel",
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Mes abonnements</h1>
          <p className="text-muted-foreground mt-1">Gérez vos abonnements et forfaits</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-cyan-400" />
              Abonnements actifs et historique
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : subscriptions && subscriptions.length > 0 ? (
              <div className="space-y-4">
                {subscriptions.map((sub: any) => (
                  <div
                    key={sub.id}
                    className="p-6 bg-accent/50 rounded-lg border border-border"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-display text-xl font-bold text-foreground">
                            {sub.plan_name}
                          </h3>
                          <Badge className={statusColors[sub.status] || "bg-muted"}>
                            {statusLabels[sub.status] || sub.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Montant</p>
                            <p className="text-lg font-bold text-foreground">
                              {Number(sub.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                              <span className="text-sm font-normal text-muted-foreground">
                                /{sub.billing_cycle === "monthly" ? "mois" : "an"}
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Cycle</p>
                            <p className="text-foreground">
                              {billingCycleLabels[sub.billing_cycle] || sub.billing_cycle}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Date de début</p>
                            <p className="text-foreground">
                              {format(new Date(sub.start_date), "d MMMM yyyy", { locale: fr })}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Prochaine facturation</p>
                            <p className="text-foreground flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              {sub.next_billing_date
                                ? format(new Date(sub.next_billing_date), "d MMMM yyyy", { locale: fr })
                                : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                      {sub.status === "active" && (
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            Modifier
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600">
                            Annuler
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">Vous n'avez pas encore d'abonnement</p>
                <Button variant="hero">Voir les forfaits</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
};

export default ClientSubscriptions;