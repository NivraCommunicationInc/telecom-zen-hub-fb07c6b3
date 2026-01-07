import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery } from "@tanstack/react-query";
import { portalSupabase } from "@/integrations/backend/portalClient";
import { Calendar, FileText, Package, MessageSquare, CreditCard, ArrowRight, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import TVOrderStatusTracker from "@/components/client/TVOrderStatusTracker";

const ClientDashboard = () => {
  const { user } = useClientAuth();

  const { data: appointments } = useQuery({
    queryKey: ["client-appointments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // SECURITY: Filter by client_id to ensure users only see their own appointments
      const { data } = await portalSupabase
        .from("appointments")
        .select("*")
        .eq("client_id", user.id)
        .order("scheduled_at", { ascending: true })
        .limit(3);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: orders } = useQuery({
    queryKey: ["client-orders", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // SECURITY: Filter by user_id to ensure users only see their own orders
      const { data } = await portalSupabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: invoices } = useQuery({
    queryKey: ["client-invoices", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // SECURITY: Filter by user_id to ensure users only see their own invoices
      const { data } = await portalSupabase
        .from("billing")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: tickets } = useQuery({
    queryKey: ["client-tickets", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // SECURITY: Filter by user_id to ensure users only see their own tickets
      const { data } = await portalSupabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: subscriptions } = useQuery({
    queryKey: ["client-subscriptions", user?.id],
    queryFn: async () => {
      const { data } = await portalSupabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user?.id)
        .eq("status", "active");
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch streaming subscriptions
  const { data: streamingSubscriptions } = useQuery({
    queryKey: ["client-streaming-subscriptions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await portalSupabase
        .from("client_streaming_subscriptions")
        .select("*, streaming_services(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const statusColors: Record<string, string> = {
    pending: "text-amber-500",
    paid: "text-emerald-500",
    overdue: "text-red-500",
    open: "text-cyan-500",
    closed: "text-muted-foreground",
    scheduled: "text-cyan-500",
    completed: "text-emerald-500",
    cancelled: "text-red-500",
  };

  return (
    <ClientLayout>
      <div className="space-y-8" data-testid="portal-dashboard">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground" data-testid="dashboard-greeting">
            Bonjour, {user?.user_metadata?.full_name?.split(" ")[0] || "Client"}!
          </h1>
          <p className="text-muted-foreground mt-1">Bienvenue dans votre espace client</p>
        </div>


        {/* TV Order Status Tracker */}
        {orders && orders.length > 0 && (
          <TVOrderStatusTracker orders={orders} />
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{appointments?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Rendez-vous</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{orders?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Commandes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <FileText className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{invoices?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Factures</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{subscriptions?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Abonnements</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Upcoming Appointments */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-cyan-400" />
                Prochains rendez-vous
              </CardTitle>
              <Link to="/portal/appointments">
                <Button variant="ghost" size="sm">
                  Voir tout <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {appointments && appointments.length > 0 ? (
                <div className="space-y-3">
                  {appointments.map((apt: any) => (
                    <div key={apt.id} className="flex justify-between items-center p-3 bg-accent/50 rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">{apt.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(apt.scheduled_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                        </p>
                      </div>
                      <span className={`text-sm ${statusColors[apt.status] || ""}`}>
                        {apt.status === "scheduled" ? "Planifié" : apt.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Aucun rendez-vous à venir</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Tickets */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                Tickets récents
              </CardTitle>
              <Link to="/portal/tickets">
                <Button variant="ghost" size="sm">
                  Voir tout <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {tickets && tickets.length > 0 ? (
                <div className="space-y-3">
                  {tickets.map((ticket: any) => (
                    <div key={ticket.id} className="flex justify-between items-center p-3 bg-accent/50 rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">{ticket.subject}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                        </p>
                      </div>
                      <span className={`text-sm capitalize ${statusColors[ticket.status] || ""}`}>
                        {ticket.status === "open" ? "Ouvert" : ticket.status === "closed" ? "Fermé" : ticket.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-3">Aucun ticket</p>
                  <Link to="/portal/tickets">
                    <Button variant="outline" size="sm">Créer un ticket</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5 text-cyan-400" />
                Factures récentes
              </CardTitle>
              <Link to="/portal/invoices">
                <Button variant="ghost" size="sm">
                  Voir tout <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {invoices && invoices.length > 0 ? (
                <div className="space-y-3">
                  {invoices.map((invoice: any) => (
                    <div key={invoice.id} className="flex justify-between items-center p-3 bg-accent/50 rounded-lg">
                      <div>
                        <p className="font-medium text-foreground font-mono">
                          {invoice.invoice_number || invoice.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {Number(invoice.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </p>
                      </div>
                      <span className={`text-sm capitalize ${statusColors[invoice.status] || ""}`}>
                        {invoice.status === "paid" ? "Payé" : invoice.status === "pending" ? "En attente" : invoice.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Aucune facture</p>
              )}
            </CardContent>
          </Card>

          {/* Active Subscriptions */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                Abonnements actifs
              </CardTitle>
              <Link to="/portal/subscriptions">
                <Button variant="ghost" size="sm">
                  Gérer <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {subscriptions && subscriptions.length > 0 ? (
                <div className="space-y-3">
                  {subscriptions.map((sub: any) => (
                    <div key={sub.id} className="flex justify-between items-center p-3 bg-accent/50 rounded-lg">
                      <div>
                        <p className="font-medium text-foreground">{sub.plan_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {Number(sub.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/{sub.billing_cycle === "monthly" ? "mois" : "an"}
                        </p>
                      </div>
                      <span className="text-sm text-emerald-500">Actif</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Aucun abonnement actif</p>
              )}
            </CardContent>
          </Card>

          {/* Streaming Subscriptions */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Tv className="w-5 h-5 text-purple-400" />
                Mes abonnements Streaming
              </CardTitle>
            </CardHeader>
            <CardContent>
              {streamingSubscriptions && streamingSubscriptions.length > 0 ? (
                <div className="space-y-3">
                  {streamingSubscriptions.map((sub: any) => {
                    const statusColors: Record<string, string> = {
                      active: "bg-emerald-500/20 text-emerald-500",
                      paused: "bg-amber-500/20 text-amber-500",
                      cancelled: "bg-red-500/20 text-red-500",
                      suspended: "bg-red-500/20 text-red-500",
                    };
                    const statusLabels: Record<string, string> = {
                      active: "Actif",
                      paused: "En pause",
                      cancelled: "Annulé",
                      suspended: "Suspendu",
                    };
                    return (
                      <div key={sub.id} className="flex justify-between items-center p-3 bg-accent/50 rounded-lg">
                        <div>
                          <p className="font-medium text-foreground">{sub.streaming_services?.name || "Service Streaming"}</p>
                          <p className="text-sm text-muted-foreground">
                            {sub.monthly_price ? `${Number(sub.monthly_price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois` : "—"}
                            {sub.start_date && ` • Depuis ${format(new Date(sub.start_date), "d MMM yyyy", { locale: fr })}`}
                          </p>
                        </div>
                        <Badge className={statusColors[sub.status] || statusColors.active}>
                          {statusLabels[sub.status] || sub.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">Aucun abonnement streaming actif.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientDashboard;