import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { Calendar, FileText, Package, MessageSquare, ArrowRight, Tv, Wifi, Clock, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import TVOrderStatusTracker from "@/components/client/TVOrderStatusTracker";
import ServiceCountdown from "@/components/client/ServiceCountdown";
import ClientBalanceSummary from "@/components/client/ClientBalanceSummary";

const ClientDashboard = () => {
  const { user } = useClientAuth();

  const { data: appointments } = useQuery({
    queryKey: ["client-appointments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
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

  // PREPAID TERMINOLOGY - No debt language (impayé/dette/overdue)
  const statusConfig: Record<string, { color: string; label: string }> = {
    pending: { color: "bg-secondary text-foreground border-border", label: "En attente" },
    paid: { color: "bg-success/15 text-success border-success/30", label: "Payé" },
    overdue: { color: "bg-destructive/10 text-destructive border-destructive/30", label: "Renouvellement requis" },
    expired: { color: "bg-destructive/10 text-destructive border-destructive/30", label: "Expiré (non renouvelé)" },
    not_renewed: { color: "bg-muted text-muted-foreground border-border", label: "Non renouvelé" },
    open: { color: "bg-primary/10 text-primary border-primary/30", label: "Ouvert" },
    closed: { color: "bg-muted text-muted-foreground border-border", label: "Fermé" },
    scheduled: { color: "bg-primary/10 text-primary border-primary/30", label: "Planifié" },
    completed: { color: "bg-success/15 text-success border-success/30", label: "Terminé" },
    cancelled: { color: "bg-destructive/10 text-destructive border-destructive/30", label: "Annulé" },
    active: { color: "bg-success/15 text-success border-success/30", label: "Actif" },
    paused: { color: "bg-secondary text-foreground border-border", label: "En pause" },
    suspended: { color: "bg-destructive/10 text-destructive border-destructive/30", label: "Suspendu (litige)" },
  };

  const statCardClass = "bg-card/95 border-border shadow-sm hover:bg-secondary/40 transition-colors";
  const sectionCardClass = "bg-card/95 border-border shadow-sm";
  const rowClass = "flex justify-between items-center p-4 bg-background rounded-xl border border-border hover:bg-secondary/50 transition-colors";
  const actionButtonClass = "text-muted-foreground hover:text-foreground hover:bg-secondary";
  const metricIconClass = "w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center";
  const metricIconInnerClass = "w-6 h-6 text-primary";
  const listIconClass = "w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center";
  const listIconInnerClass = "w-5 h-5 text-primary";

  return (
    <ClientLayout>
      <div className="space-y-8" data-testid="portal-dashboard">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-background via-secondary/50 to-background border border-border p-6 lg:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <h1 className="font-display text-3xl lg:text-4xl font-bold text-foreground" data-testid="dashboard-greeting">
              Bonjour, {user?.user_metadata?.full_name?.split(" ")[0] || "Client"} 👋
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">Bienvenue dans votre espace client Nivra</p>
          </div>
        </div>

        {/* TV Order Status Tracker */}
        {orders && orders.length > 0 && (
          <TVOrderStatusTracker orders={orders} />
        )}

        {/* Prepaid Status: Balance + Service Countdown */}
        {user?.id && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ClientBalanceSummary userId={user.id} />
            <ServiceCountdown userId={user.id} />
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className={statCardClass}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={metricIconClass}>
                <Calendar className={metricIconInnerClass} />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{appointments?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Rendez-vous</p>
              </div>
            </CardContent>
          </Card>

          <Card className={statCardClass}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={metricIconClass}>
                <Package className={metricIconInnerClass} />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{orders?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Commandes</p>
              </div>
            </CardContent>
          </Card>

          <Card className={statCardClass}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={metricIconClass}>
                <FileText className={metricIconInnerClass} />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{invoices?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Factures</p>
              </div>
            </CardContent>
          </Card>

          <Card className={statCardClass}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={metricIconClass}>
                <Wifi className={metricIconInnerClass} />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{subscriptions?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Services actifs</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Appointments */}
          <Card className={sectionCardClass}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                <Calendar className="w-5 h-5 text-primary" />
                Prochains rendez-vous
              </CardTitle>
              <Link to="/portal/appointments">
                <Button variant="ghost" size="sm" className={actionButtonClass}>
                  Voir tout <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {appointments && appointments.length > 0 ? (
                <div className="space-y-3">
                  {appointments.map((apt: any) => (
                    <div key={apt.id} className={rowClass}>
                      <div className="flex items-center gap-3">
                        <div className={listIconClass}>
                          <Clock className={listIconInnerClass} />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{apt.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(apt.scheduled_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${statusConfig[apt.status]?.color || statusConfig.scheduled.color} border`}>
                        {statusConfig[apt.status]?.label || apt.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-6">Aucun rendez-vous à venir</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Tickets */}
          <Card className={sectionCardClass}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                <MessageSquare className="w-5 h-5 text-primary" />
                Tickets récents
              </CardTitle>
              <Link to="/portal/tickets">
                <Button variant="ghost" size="sm" className={actionButtonClass}>
                  Voir tout <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {tickets && tickets.length > 0 ? (
                <div className="space-y-3">
                  {tickets.map((ticket: any) => (
                    <div key={ticket.id} className={rowClass}>
                      <div>
                        <p className="font-medium text-foreground">{ticket.subject}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                        </p>
                      </div>
                      <Badge className={`${statusConfig[ticket.status]?.color || statusConfig.open.color} border`}>
                        {statusConfig[ticket.status]?.label || ticket.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-3">Aucun ticket</p>
                  <Link to="/portal/tickets">
                    <Button variant="outline" size="sm" className="border-border text-foreground hover:bg-secondary">
                      Créer un ticket
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card className={sectionCardClass}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                <FileText className="w-5 h-5 text-primary" />
                Factures récentes
              </CardTitle>
              <Link to="/portal/invoices">
                <Button variant="ghost" size="sm" className={actionButtonClass}>
                  Voir tout <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {invoices && invoices.length > 0 ? (
                <div className="space-y-3">
                  {invoices.map((invoice: any) => (
                    <div key={invoice.id} className={rowClass}>
                      <div>
                        <p className="font-medium font-mono text-foreground">
                          {invoice.invoice_number || invoice.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {Number(invoice.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </p>
                      </div>
                      <Badge className={`${statusConfig[invoice.status]?.color || statusConfig.pending.color} border`}>
                        {statusConfig[invoice.status]?.label || invoice.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-6">Aucune facture</p>
              )}
            </CardContent>
          </Card>

          {/* Active Subscriptions & Streaming */}
          <Card className={sectionCardClass}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                <Activity className="w-5 h-5 text-primary" />
                Services actifs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {subscriptions && subscriptions.length > 0 && subscriptions.map((sub: any) => (
                  <div key={sub.id} className="flex justify-between items-center p-4 bg-background rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      <div className={listIconClass}>
                        <Wifi className={listIconInnerClass} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{sub.plan_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {Number(sub.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/{sub.billing_cycle === "monthly" ? "mois" : "an"}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${statusConfig.active.color} border`}>Actif</Badge>
                  </div>
                ))}
                
                {streamingSubscriptions && streamingSubscriptions.length > 0 && streamingSubscriptions.map((sub: any) => (
                  <div key={sub.id} className="flex justify-between items-center p-4 bg-background rounded-xl border border-border">
                    <div className="flex items-center gap-3">
                      <div className={listIconClass}>
                        <Tv className={listIconInnerClass} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{sub.streaming_services?.name || "Service Streaming"}</p>
                        <p className="text-sm text-muted-foreground">
                          {sub.monthly_price ? `${Number(sub.monthly_price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois` : "—"}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${statusConfig[sub.status]?.color || statusConfig.active.color} border`}>
                      {statusConfig[sub.status]?.label || sub.status}
                    </Badge>
                  </div>
                ))}
                
                {(!subscriptions || subscriptions.length === 0) && (!streamingSubscriptions || streamingSubscriptions.length === 0) && (
                  <p className="text-muted-foreground text-center py-6">Aucun service actif</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientDashboard;
