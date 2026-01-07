import { useState } from "react";
import EmployeeLayout from "@/components/employee/EmployeeLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Search, Eye, Phone, Mail, MapPin, Package, CreditCard, MessageSquare, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const EmployeeClients = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch clients
  const { data: clients, isLoading } = useQuery({
    queryKey: ["employee-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch client-specific data when selected
  const { data: clientOrders } = useQuery({
    queryKey: ["employee-client-orders", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", selectedClient.user_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientBilling } = useQuery({
    queryKey: ["employee-client-billing", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data } = await supabase
        .from("billing")
        .select("*")
        .eq("user_id", selectedClient.user_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientTickets } = useQuery({
    queryKey: ["employee-client-tickets", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", selectedClient.user_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedClient?.user_id,
  });

  const { data: clientAccounts } = useQuery({
    queryKey: ["employee-client-accounts", selectedClient?.user_id],
    queryFn: async () => {
      if (!selectedClient?.user_id) return [];
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("client_id", selectedClient.user_id);
      return data || [];
    },
    enabled: !!selectedClient?.user_id,
  });

  const filteredClients = clients?.filter((client: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      client.full_name?.toLowerCase().includes(q) ||
      client.first_name?.toLowerCase().includes(q) ||
      client.last_name?.toLowerCase().includes(q) ||
      client.email?.toLowerCase().includes(q) ||
      client.phone?.includes(q) ||
      client.client_number?.toLowerCase().includes(q)
    );
  });

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-500",
    frozen: "bg-blue-500/20 text-blue-500",
    suspended: "bg-red-500/20 text-red-500",
    hold: "bg-amber-500/20 text-amber-500",
  };

  const handleViewClient = (client: any) => {
    setSelectedClient(client);
    setDetailsOpen(true);
  };

  return (
    <EmployeeLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground mt-1">Rechercher et consulter les profils clients</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email, téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Clients List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Liste des clients ({filteredClients?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : filteredClients && filteredClients.length > 0 ? (
              <div className="space-y-2">
                {filteredClients.map((client: any) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">
                          {(client.first_name?.[0] || client.full_name?.[0] || "?").toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {client.full_name || `${client.first_name || ""} ${client.last_name || ""}`.trim() || "Sans nom"}
                        </p>
                        <p className="text-sm text-muted-foreground">{client.email}</p>
                        {client.client_number && (
                          <p className="text-xs text-muted-foreground font-mono">{client.client_number}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={statusColors[client.account_status] || statusColors.active}>
                        {client.account_status === "active" ? "Actif" : 
                         client.account_status === "suspended" ? "Suspendu" :
                         client.account_status === "frozen" ? "Gelé" : 
                         client.account_status || "Actif"}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => handleViewClient(client)}>
                        <Eye className="w-4 h-4 mr-1" /> Voir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">Aucun client trouvé</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedClient?.full_name || `${selectedClient?.first_name || ""} ${selectedClient?.last_name || ""}`.trim()}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info">Informations</TabsTrigger>
                <TabsTrigger value="orders">Commandes</TabsTrigger>
                <TabsTrigger value="billing">Facturation</TabsTrigger>
                <TabsTrigger value="tickets">Tickets</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedClient?.email || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedClient?.phone || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {selectedClient?.service_address ? 
                          `${selectedClient.service_address}, ${selectedClient.service_city || ""}` : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Statut compte:</span>
                      <Badge className={statusColors[selectedClient?.account_status] || statusColors.active}>
                        {selectedClient?.account_status || "Actif"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Accès portail:</span>
                      <Badge variant="outline">
                        {selectedClient?.online_access_status || "Actif"}
                      </Badge>
                    </div>
                    {clientAccounts && clientAccounts[0] && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Nº compte:</span>
                        <span className="text-sm font-mono">{clientAccounts[0].account_number}</span>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="orders" className="space-y-3 mt-4">
                {clientOrders && clientOrders.length > 0 ? (
                  clientOrders.map((order: any) => (
                    <div key={order.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{order.order_number || order.service_type}</span>
                        </div>
                        <Badge variant="outline">{order.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-muted-foreground">Aucune commande</p>
                )}
              </TabsContent>

              <TabsContent value="billing" className="space-y-3 mt-4">
                {clientBilling && clientBilling.length > 0 ? (
                  clientBilling.map((invoice: any) => (
                    <div key={invoice.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium font-mono">{invoice.invoice_number || "—"}</span>
                        </div>
                        <Badge variant="outline">{invoice.status}</Badge>
                      </div>
                      <p className="text-sm font-medium mt-1">
                        {Number(invoice.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-muted-foreground">Aucune facture</p>
                )}
              </TabsContent>

              <TabsContent value="tickets" className="space-y-3 mt-4">
                {clientTickets && clientTickets.length > 0 ? (
                  clientTickets.map((ticket: any) => (
                    <div key={ticket.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{ticket.subject}</span>
                        </div>
                        <Badge variant="outline">{ticket.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ticket.ticket_number} • {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-muted-foreground">Aucun ticket</p>
                )}
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </EmployeeLayout>
  );
};

export default EmployeeClients;
