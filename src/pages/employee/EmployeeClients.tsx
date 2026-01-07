import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Users, Search, Eye, Phone, Mail, MapPin, Package, CreditCard, 
  MessageSquare, Lock, Unlock, AlertTriangle, Tv, ChevronLeft, ChevronRight 
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useEmployeeClientsList } from "@/hooks/useEmployeeClientsList";
import { useEmployeeClient360 } from "@/hooks/useEmployeeClient360";
import { EmployeePinGateModal } from "@/components/employee/EmployeePinGateModal";

const EmployeeClients = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Fetch clients list from server (masked by default)
  const { clients, total, isLoading, refetch } = useEmployeeClientsList(
    page,
    pageSize,
    debouncedSearch
  );

  // Fetch selected client details (masked or full based on unlock)
  const clientData = useEmployeeClient360(selectedClientId, selectedAccountId || undefined);

  const statusColors: Record<string, string> = {
    active: "bg-emerald-500/20 text-emerald-500",
    frozen: "bg-blue-500/20 text-blue-500",
    suspended: "bg-red-500/20 text-red-500",
    hold: "bg-amber-500/20 text-amber-500",
  };

  const handleViewClient = (client: any) => {
    setSelectedClientId(client.user_id);
    setSelectedAccountId(null);
    setDetailsOpen(true);
  };

  const handleUnlockSuccess = () => {
    setPinModalOpen(false);
    clientData.invalidate();
    clientData.refetch();
  };

  const handleRequestUnlock = () => {
    // Set the first account as target for unlock
    if (clientData.accounts?.length > 0) {
      setSelectedAccountId(clientData.accounts[0].id);
    }
    setPinModalOpen(true);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
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
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Clients List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Clients ({total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : clients && clients.length > 0 ? (
              <>
                <div className="space-y-2">
                  {clients.map((client: any) => (
                    <div
                      key={client.user_id}
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
                            {client.full_name ||
                              `${client.first_name || ""} ${client.last_name || ""}`.trim() ||
                              "Sans nom"}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {client.masked && <Lock className="w-3 h-3" />}
                            <span>{client.email || "—"}</span>
                          </div>
                          {client.client_number && (
                            <p className="text-xs text-muted-foreground font-mono">{client.client_number}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={statusColors[client.account_status] || statusColors.active}>
                          {client.account_status === "active"
                            ? "Actif"
                            : client.account_status === "suspended"
                              ? "Suspendu"
                              : client.account_status === "frozen"
                                ? "Gelé"
                                : client.account_status || "Actif"}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => handleViewClient(client)}>
                          <Eye className="w-4 h-4 mr-1" /> Voir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      Page {page + 1} sur {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.max(0, page - 1))}
                        disabled={page === 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                        disabled={page >= totalPages - 1}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
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
            <DialogTitle className="flex items-center gap-2">
              {clientData.profile?.full_name ||
                `${clientData.profile?.first_name || ""} ${clientData.profile?.last_name || ""}`.trim() ||
                "Client"}
              {clientData.unlocked ? (
                <Badge variant="outline" className="ml-2 text-emerald-500 border-emerald-500">
                  <Unlock className="w-3 h-3 mr-1" /> Déverrouillé
                </Badge>
              ) : (
                <Badge variant="outline" className="ml-2 text-amber-500 border-amber-500">
                  <Lock className="w-3 h-3 mr-1" /> Données masquées
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {clientData.isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Chargement...</div>
          ) : (
            <ScrollArea className="max-h-[70vh]">
              {/* PIN Required Alert */}
              {!clientData.unlocked && (
                <Alert className="mb-4 border-amber-500/50 bg-amber-500/10">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>
                      NIP requis pour accéder aux informations complètes et aux actions sensibles.
                    </span>
                    <Button size="sm" onClick={handleRequestUnlock}>
                      <Lock className="w-4 h-4 mr-2" />
                      Déverrouiller
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="info">Informations</TabsTrigger>
                  <TabsTrigger value="orders">Commandes</TabsTrigger>
                  <TabsTrigger value="billing">Facturation</TabsTrigger>
                  <TabsTrigger value="tickets" disabled={!clientData.unlocked}>
                    Tickets {!clientData.unlocked && <Lock className="w-3 h-3 ml-1" />}
                  </TabsTrigger>
                  <TabsTrigger value="streaming" disabled={!clientData.unlocked}>
                    Streaming {!clientData.unlocked && <Lock className="w-3 h-3 ml-1" />}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className={clientData.profile?.masked ? "text-muted-foreground italic" : ""}>
                          {clientData.profile?.email || "—"}
                          {clientData.profile?.masked && " (masqué)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className={clientData.profile?.masked ? "text-muted-foreground italic" : ""}>
                          {clientData.profile?.phone || "—"}
                          {clientData.profile?.masked && " (masqué)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className={clientData.profile?.masked ? "text-muted-foreground italic" : ""}>
                          {clientData.profile?.service_address
                            ? `${clientData.profile.service_address}, ${clientData.profile.service_city || ""}`
                            : "—"}
                          {clientData.profile?.masked && " (masqué)"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Statut compte:</span>
                        <Badge className={statusColors[clientData.profile?.account_status] || statusColors.active}>
                          {clientData.profile?.account_status || "Actif"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Accès portail:</span>
                        <Badge variant="outline">{clientData.profile?.online_access_status || "Actif"}</Badge>
                      </div>
                      {clientData.accounts?.[0] && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Nº compte:</span>
                          <span className="text-sm font-mono">{clientData.accounts[0].account_number}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="orders" className="space-y-3 mt-4">
                  {clientData.orders && clientData.orders.length > 0 ? (
                    clientData.orders.map((order: any) => (
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
                  {clientData.billing && clientData.billing.length > 0 ? (
                    clientData.billing.map((invoice: any) => (
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
                  {!clientData.unlocked ? (
                    <Alert className="border-amber-500/50 bg-amber-500/10">
                      <Lock className="w-4 h-4 text-amber-500" />
                      <AlertDescription>
                        Déverrouillage NIP requis pour voir les tickets.
                      </AlertDescription>
                    </Alert>
                  ) : clientData.tickets && clientData.tickets.length > 0 ? (
                    clientData.tickets.map((ticket: any) => (
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

                <TabsContent value="streaming" className="space-y-3 mt-4">
                  {!clientData.unlocked ? (
                    <Alert className="border-amber-500/50 bg-amber-500/10">
                      <Lock className="w-4 h-4 text-amber-500" />
                      <AlertDescription>
                        Déverrouillage NIP requis pour voir les abonnements streaming.
                      </AlertDescription>
                    </Alert>
                  ) : clientData.streaming && clientData.streaming.length > 0 ? (
                    clientData.streaming.map((sub: any) => (
                      <div key={sub.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tv className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{sub.streaming_services?.name || "Service"}</span>
                          </div>
                          <Badge variant="outline">{sub.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {Number(sub.monthly_price || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-4 text-muted-foreground">Aucun abonnement</p>
                  )}
                </TabsContent>
              </Tabs>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* PIN Gate Modal */}
      {selectedAccountId && clientData.profile && (
        <EmployeePinGateModal
          isOpen={pinModalOpen}
          onClose={() => setPinModalOpen(false)}
          onUnlocked={handleUnlockSuccess}
          account={{
            id: selectedAccountId,
            clientId: selectedClientId!,
            clientName: clientData.profile?.full_name || "Client",
            accountNumber: clientData.accounts?.[0]?.account_number || "",
          }}
        />
      )}
    </>
  );
};

export default EmployeeClients;
