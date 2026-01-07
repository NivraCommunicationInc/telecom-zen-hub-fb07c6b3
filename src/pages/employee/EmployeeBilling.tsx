import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CreditCard, Search, Eye, DollarSign, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { employeeSupabase } from "@/integrations/supabase/employeeClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";

const EmployeeBilling = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useEmployeeAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [updateStatusOpen, setUpdateStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["employee-billing"],
    queryFn: async () => {
      const { data, error } = await employeeSupabase
        .from("billing")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reference }: { id: string; status: string; reference?: string }) => {
      const updateData: any = { 
        status,
        ...(status === "paid" && { paid_at: new Date().toISOString() }),
        ...(reference && { payment_reference: reference }),
      };

      // Handle e-transfer specific statuses
      if (["etransfer_pending", "etransfer_received", "etransfer_verified"].includes(status)) {
        updateData.etransfer_status = status.replace("etransfer_", "");
      }

      const { error } = await employeeSupabase
        .from("billing")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;

      // Log activity
      await employeeSupabase.from("activity_logs").insert({
        user_id: user?.id || "system",
        entity_type: "billing",
        entity_id: id,
        action: "status_updated",
        details: { new_status: status, reference },
        actor_role: "employee",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-billing"] });
      toast({ title: "Statut mis à jour" });
      setUpdateStatusOpen(false);
      setDetailsOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const filteredInvoices = invoices?.filter((invoice: any) => {
    const matchesSearch = !searchQuery || 
      invoice.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.client_email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-500",
    paid: "bg-emerald-500/20 text-emerald-500",
    overdue: "bg-red-500/20 text-red-500",
    partial: "bg-blue-500/20 text-blue-500",
    cancelled: "bg-muted text-muted-foreground",
  };

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    paid: "Payé",
    overdue: "En retard",
    partial: "Partiel",
    cancelled: "Annulé",
  };

  const handleUpdateStatus = () => {
    if (!selectedInvoice || !newStatus) return;
    updateStatusMutation.mutate({
      id: selectedInvoice.id,
      status: newStatus,
      reference: paymentReference || undefined,
    });
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Facturation</h1>
          <p className="text-muted-foreground mt-1">Gérer les factures et paiements</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par numéro, email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="paid">Payé</SelectItem>
              <SelectItem value="overdue">En retard</SelectItem>
              <SelectItem value="partial">Partiel</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Invoices List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Factures ({filteredInvoices?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : filteredInvoices && filteredInvoices.length > 0 ? (
              <div className="space-y-2">
                {filteredInvoices.map((invoice: any) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                        {invoice.status === "paid" ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : invoice.status === "overdue" ? (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-amber-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-foreground font-mono">
                          {invoice.invoice_number || "—"}
                        </p>
                        <p className="text-sm text-muted-foreground">{invoice.client_email}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(invoice.created_at), "d MMM yyyy", { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-medium">
                          {Number(invoice.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </p>
                        {invoice.etransfer_status && (
                          <p className="text-xs text-muted-foreground">
                            e-Transfer: {invoice.etransfer_status}
                          </p>
                        )}
                      </div>
                      <Badge className={statusColors[invoice.status] || statusColors.pending}>
                        {statusLabels[invoice.status] || invoice.status}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => { setSelectedInvoice(invoice); setDetailsOpen(true); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground">Aucune facture trouvée</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoice Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Facture {selectedInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Montant</p>
                  <p className="text-lg font-bold">
                    {Number(selectedInvoice.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Statut</p>
                  <Badge className={statusColors[selectedInvoice.status]}>
                    {statusLabels[selectedInvoice.status] || selectedInvoice.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="text-sm">{selectedInvoice.client_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="text-sm">{format(new Date(selectedInvoice.created_at), "d MMMM yyyy", { locale: fr })}</p>
                </div>
              </div>

              {selectedInvoice.etransfer_status && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Statut e-Transfer: {selectedInvoice.etransfer_status}</p>
                  {selectedInvoice.etransfer_reference && (
                    <p className="text-xs text-muted-foreground">Ref: {selectedInvoice.etransfer_reference}</p>
                  )}
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={() => { setNewStatus(selectedInvoice.status); setUpdateStatusOpen(true); }}
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Modifier le statut
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={updateStatusOpen} onOpenChange={setUpdateStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le statut de paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nouveau statut</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="paid">Payé</SelectItem>
                  <SelectItem value="partial">Partiel</SelectItem>
                  <SelectItem value="overdue">En retard</SelectItem>
                  <SelectItem value="etransfer_pending">e-Transfer en attente</SelectItem>
                  <SelectItem value="etransfer_received">e-Transfer reçu</SelectItem>
                  <SelectItem value="etransfer_verified">e-Transfer vérifié</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Référence de paiement (optionnel)</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Numéro de confirmation..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateStatusOpen(false)}>Annuler</Button>
            <Button onClick={handleUpdateStatus} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? "Mise à jour..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmployeeBilling;
