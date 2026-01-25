import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { Calendar, FileText, Package, MessageSquare, CreditCard, ArrowRight, Tv, Wifi, Clock, TrendingUp, Activity } from "lucide-react";
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

  const statusConfig: Record<string, { color: string; label: string }> = {
    pending: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "En attente" },
    paid: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Payé" },
    overdue: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "En retard" },
    open: { color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", label: "Ouvert" },
    closed: { color: "bg-slate-500/20 text-slate-400 border-slate-500/30", label: "Fermé" },
    scheduled: { color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", label: "Planifié" },
    completed: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Terminé" },
    cancelled: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Annulé" },
    active: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Actif" },
    paused: { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "En pause" },
    suspended: { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Suspendu" },
  };

  return (
    <ClientLayout>
      <div className="space-y-8" data-testid="portal-dashboard">
        {/* Welcome Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/10 via-teal-500/5 to-transparent border border-cyan-500/20 p-6 lg:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <h1 className="font-display text-3xl lg:text-4xl font-bold text-white" data-testid="dashboard-greeting">
              Bonjour, {user?.user_metadata?.full_name?.split(" ")[0] || "Client"} 👋
            </h1>
            <p className="text-slate-400 mt-2 text-lg">Bienvenue dans votre espace client Nivra</p>
          </div>
        </div>

        {/* TV Order Status Tracker */}
        {orders && orders.length > 0 && (
          <TVOrderStatusTracker orders={orders} />
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-800/30 border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/50 transition-colors">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{appointments?.length || 0}</p>
                <p className="text-sm text-slate-400">Rendez-vous</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/30 border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/50 transition-colors">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Package className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{orders?.length || 0}</p>
                <p className="text-sm text-slate-400">Commandes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/30 border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/50 transition-colors">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <FileText className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{invoices?.length || 0}</p>
                <p className="text-sm text-slate-400">Factures</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/30 border-slate-700/30 backdrop-blur-sm hover:bg-slate-800/50 transition-colors">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                <Wifi className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{subscriptions?.length || 0}</p>
                <p className="text-sm text-slate-400">Services actifs</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming Appointments */}
          <Card className="bg-slate-800/30 border-slate-700/30 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Calendar className="w-5 h-5 text-cyan-400" />
                Prochains rendez-vous
              </CardTitle>
              <Link to="/portal/appointments">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  Voir tout <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {appointments && appointments.length > 0 ? (
                <div className="space-y-3">
                  {appointments.map((apt: any) => (
                    <div key={apt.id} className="flex justify-between items-center p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                          <Clock className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{apt.title}</p>
                          <p className="text-sm text-slate-400">
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
                <p className="text-slate-500 text-center py-6">Aucun rendez-vous à venir</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Tickets */}
          <Card className="bg-slate-800/30 border-slate-700/30 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <MessageSquare className="w-5 h-5 text-cyan-400" />
                Tickets récents
              </CardTitle>
              <Link to="/portal/tickets">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  Voir tout <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {tickets && tickets.length > 0 ? (
                <div className="space-y-3">
                  {tickets.map((ticket: any) => (
                    <div key={ticket.id} className="flex justify-between items-center p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-colors">
                      <div>
                        <p className="font-medium text-white">{ticket.subject}</p>
                        <p className="text-sm text-slate-400">
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
                  <p className="text-slate-500 mb-3">Aucun ticket</p>
                  <Link to="/portal/tickets">
                    <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800">
                      Créer un ticket
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card className="bg-slate-800/30 border-slate-700/30 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <FileText className="w-5 h-5 text-cyan-400" />
                Factures récentes
              </CardTitle>
              <Link to="/portal/invoices">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                  Voir tout <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {invoices && invoices.length > 0 ? (
                <div className="space-y-3">
                  {invoices.map((invoice: any) => (
                    <div key={invoice.id} className="flex justify-between items-center p-4 bg-slate-900/50 rounded-xl border border-slate-700/30 hover:border-slate-600/50 transition-colors">
                      <div>
                        <p className="font-medium font-mono text-white">
                          {invoice.invoice_number || invoice.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-slate-400">
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
                <p className="text-slate-500 text-center py-6">Aucune facture</p>
              )}
            </CardContent>
          </Card>

          {/* Active Subscriptions & Streaming */}
          <Card className="bg-slate-800/30 border-slate-700/30 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg text-white">
                <Activity className="w-5 h-5 text-cyan-400" />
                Services actifs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {subscriptions && subscriptions.length > 0 && subscriptions.map((sub: any) => (
                  <div key={sub.id} className="flex justify-between items-center p-4 bg-slate-900/50 rounded-xl border border-slate-700/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <Wifi className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{sub.plan_name}</p>
                        <p className="text-sm text-slate-400">
                          {Number(sub.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/{sub.billing_cycle === "monthly" ? "mois" : "an"}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Actif</Badge>
                  </div>
                ))}
                
                {streamingSubscriptions && streamingSubscriptions.length > 0 && streamingSubscriptions.map((sub: any) => (
                  <div key={sub.id} className="flex justify-between items-center p-4 bg-slate-900/50 rounded-xl border border-slate-700/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                        <Tv className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{sub.streaming_services?.name || "Service Streaming"}</p>
                        <p className="text-sm text-slate-400">
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
                  <p className="text-slate-500 text-center py-6">Aucun service actif</p>
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
