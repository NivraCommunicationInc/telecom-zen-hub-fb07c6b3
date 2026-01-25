/**
 * StaffClientDetail - Employee portal client profile view
 * Completely isolated from admin portal - uses staff-specific data access
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  User, ArrowLeft, Phone, Mail, MapPin, Calendar, 
  FileText, ShoppingCart, DollarSign, Ticket, Tv,
  Clock, CheckCircle, XCircle, AlertTriangle, Loader2,
  Building, CreditCard, Hash, RefreshCw, Eye, Shield
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import StaffBackground from "@/components/staff/StaffBackground";
import { useStaffClientAccess } from "@/components/staff/StaffClientAccessGate";
import { StaffClientAccessGate } from "@/components/staff/StaffClientAccessGate";

export default function StaffClientDetail() {
  const { id: clientId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { checkAccess, revokeAccess } = useStaffClientAccess();
  
  const [showAccessGate, setShowAccessGate] = useState(false);
  const [hasVerifiedAccess, setHasVerifiedAccess] = useState(false);

  // Check access on mount
  useEffect(() => {
    if (clientId) {
      const hasAccess = checkAccess(clientId);
      if (hasAccess) {
        setHasVerifiedAccess(true);
      } else {
        setShowAccessGate(true);
      }
    }
  }, [clientId, checkAccess]);

  // Fetch client profile
  const { data: client, isLoading: clientLoading, refetch: refetchClient } = useQuery({
    queryKey: ["staff-client-profile", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", clientId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!clientId && hasVerifiedAccess,
  });

  // Fetch client orders
  const { data: orders } = useQuery({
    queryKey: ["staff-client-orders", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && hasVerifiedAccess,
  });

  // Fetch client billing
  const { data: billing } = useQuery({
    queryKey: ["staff-client-billing", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("billing")
        .select("*")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && hasVerifiedAccess,
  });

  // Fetch client tickets
  const { data: tickets } = useQuery({
    queryKey: ["staff-client-tickets", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && hasVerifiedAccess,
  });

  // Fetch client appointments
  const { data: appointments } = useQuery({
    queryKey: ["staff-client-appointments", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", clientId)
        .order("scheduled_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId && hasVerifiedAccess,
  });

  const handleAccessGranted = () => {
    setHasVerifiedAccess(true);
    setShowAccessGate(false);
  };

  const handleEndSession = () => {
    if (clientId) {
      revokeAccess(clientId);
    }
    navigate("/staff/clients");
    toast.success("Session client terminée");
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      pending: { label: "En attente", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
      processing: { label: "En cours", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      completed: { label: "Terminé", className: "bg-green-500/20 text-green-400 border-green-500/30" },
      cancelled: { label: "Annulé", className: "bg-red-500/20 text-red-400 border-red-500/30" },
      paid: { label: "Payé", className: "bg-green-500/20 text-green-400 border-green-500/30" },
      open: { label: "Ouvert", className: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
      in_progress: { label: "En cours", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
      resolved: { label: "Résolu", className: "bg-green-500/20 text-green-400 border-green-500/30" },
      scheduled: { label: "Planifié", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    };
    const config = configs[status] || { label: status, className: "bg-slate-500/20 text-slate-400" };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // Show loading or access gate
  if (!hasVerifiedAccess) {
    return (
      <div className="min-h-screen relative">
        <StaffBackground />
        
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          {showAccessGate ? (
            <StaffClientAccessGate
              clientId={clientId || ""}
              isOpen={true}
              onClose={() => navigate("/staff/clients")}
              onAccessGranted={handleAccessGranted}
            />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
          )}
        </div>
      </div>
    );
  }

  if (clientLoading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center">
        <StaffBackground />
        <Loader2 className="h-10 w-10 animate-spin text-teal-400 z-10" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen relative">
        <StaffBackground />
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen gap-4">
          <AlertTriangle className="h-12 w-12 text-amber-400" />
          <p className="text-white text-lg">Client non trouvé</p>
          <Button onClick={() => navigate("/staff/clients")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux clients
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <StaffBackground />
      
      <div className="relative z-10 p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate("/staff/clients")}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 shadow-lg">
                <User className="h-6 w-6 text-slate-900" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{client.full_name || "Client"}</h1>
                <p className="text-slate-400">{client.client_number || client.email}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-teal-500/20 text-teal-400 border-teal-500/30 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Session sécurisée
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetchClient()}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={handleEndSession}
              className="border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              Terminer la session
            </Button>
          </div>
        </div>

        {/* Client Info Card */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <User className="h-5 w-5 text-teal-400" />
              Informations du client
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">Nom complet</p>
                  <p className="text-white font-medium">{client.full_name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Email
                  </p>
                  <p className="text-white">{client.email || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Téléphone
                  </p>
                  <p className="text-white">{client.phone || "-"}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Adresse de service
                  </p>
                  <p className="text-white">
                    {client.service_address || "-"}
                    {client.service_city && `, ${client.service_city}`}
                    {client.service_postal_code && ` ${client.service_postal_code}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Building className="h-3 w-3" /> Adresse de facturation
                  </p>
                  <p className="text-white">
                    {client.service_address || "-"}
                    {client.service_city && `, ${client.service_city}`}
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Hash className="h-3 w-3" /> Numéro client
                  </p>
                  <p className="text-white font-mono">{client.client_number || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Client depuis
                  </p>
                  <p className="text-white">
                    {client.created_at ? format(new Date(client.created_at), "d MMMM yyyy", { locale: fr }) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Statut</p>
                  {getStatusBadge(client.account_status || "active")}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="bg-slate-800/50 border border-slate-700 grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="orders" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Commandes
            </TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
              <DollarSign className="h-4 w-4 mr-2" />
              Facturation
            </TabsTrigger>
            <TabsTrigger value="tickets" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
              <Ticket className="h-4 w-4 mr-2" />
              Tickets
            </TabsTrigger>
            <TabsTrigger value="appointments" className="data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-400">
              <Calendar className="h-4 w-4 mr-2" />
              RDV
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="mt-4">
            <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white">Commandes ({orders?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {!orders?.length ? (
                  <p className="text-slate-400 text-center py-8">Aucune commande</p>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-3">
                      {orders.map((order: any) => (
                        <Link
                          key={order.id}
                          to={`/staff/orders/${order.id}`}
                          className="block p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-teal-500/50 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-mono font-semibold text-white group-hover:text-teal-400 transition-colors">{order.order_number}</p>
                              <p className="text-sm text-slate-400">{order.service_type}</p>
                            </div>
                            <div className="text-right">
                              {getStatusBadge(order.status)}
                              <p className="text-lg font-semibold text-teal-400 mt-1">
                                {order.total_amount?.toFixed(2)} $
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            {format(new Date(order.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="mt-4">
            <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white">Facturation ({billing?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {!billing?.length ? (
                  <p className="text-slate-400 text-center py-8">Aucune facture</p>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-3">
                      {billing.map((bill: any) => (
                        <Link
                          key={bill.id}
                          to={`/staff/billing/${bill.id}`}
                          className="block p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-teal-500/50 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-mono font-semibold text-white group-hover:text-teal-400 transition-colors">{bill.invoice_number || "Facture"}</p>
                              <p className="text-sm text-slate-400">
                                Échéance: {bill.due_date ? format(new Date(bill.due_date), "d MMM yyyy", { locale: fr }) : "-"}
                              </p>
                            </div>
                            <div className="text-right">
                              {getStatusBadge(bill.status)}
                              <p className="text-lg font-semibold text-teal-400 mt-1">
                                {bill.amount?.toFixed(2)} $
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tickets" className="mt-4">
            <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white">Tickets support ({tickets?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {!tickets?.length ? (
                  <p className="text-slate-400 text-center py-8">Aucun ticket</p>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-3">
                      {tickets.map((ticket: any) => (
                        <Link
                          key={ticket.id}
                          to={`/staff/tickets/${ticket.id}`}
                          className="block p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-teal-500/50 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-white group-hover:text-teal-400 transition-colors">{ticket.subject}</p>
                              <p className="text-sm text-slate-400 font-mono">{ticket.ticket_number}</p>
                            </div>
                            {getStatusBadge(ticket.status)}
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            {format(new Date(ticket.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appointments" className="mt-4">
            <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white">Rendez-vous ({appointments?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent>
                {!appointments?.length ? (
                  <p className="text-slate-400 text-center py-8">Aucun rendez-vous</p>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-3">
                      {appointments.map((apt: any) => (
                        <Link
                          key={apt.id}
                          to={`/staff/appointments/${apt.id}`}
                          className="block p-4 rounded-lg border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 hover:border-teal-500/50 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-white group-hover:text-teal-400 transition-colors">{apt.title}</p>
                              <p className="text-sm text-slate-400">
                                {format(new Date(apt.scheduled_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })}
                              </p>
                            </div>
                            {getStatusBadge(apt.status)}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
