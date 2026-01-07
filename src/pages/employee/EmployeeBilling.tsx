import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreditCard, Search, Eye, CheckCircle, Clock, AlertCircle, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useEmployeeBillingList } from "@/hooks/useEmployeeBillingList";

const EmployeeBilling = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    const timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Fetch billing from server endpoint
  const { billing, total, isLoading, error } = useEmployeeBillingList(
    page,
    pageSize,
    statusFilter,
    debouncedSearch
  );

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-500",
    paid: "bg-emerald-500/20 text-emerald-500",
    overdue: "bg-red-500/20 text-red-500",
    partial: "bg-blue-500/20 text-blue-500",
    cancelled: "bg-muted text-muted-foreground",
    received_pending_verification: "bg-purple-500/20 text-purple-500",
  };

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    paid: "Payé",
    overdue: "En retard",
    partial: "Partiel",
    cancelled: "Annulé",
    received_pending_verification: "En vérification",
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Facturation</h1>
          <p className="text-muted-foreground mt-1">Consulter les factures</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par numéro..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
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

        {/* Permission error */}
        {error && (
          <Card className="bg-destructive/10 border-destructive/20">
            <CardContent className="p-4 flex items-center gap-3">
              <Lock className="w-5 h-5 text-destructive" />
              <span className="text-destructive">
                {error instanceof Error && error.message.includes("Permission") 
                  ? "Vous n'avez pas la permission de voir la facturation."
                  : "Erreur lors du chargement de la facturation."}
              </span>
            </CardContent>
          </Card>
        )}

        {/* Invoices List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Factures ({total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : billing && billing.length > 0 ? (
              <>
                <div className="space-y-2">
                  {billing.map((invoice: any) => (
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
                          <p className="text-sm text-muted-foreground">
                            {invoice.client_email}
                            {invoice.client_email?.includes("***") && (
                              <Lock className="inline w-3 h-3 ml-1 text-muted-foreground" />
                            )}
                          </p>
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
            ) : !error ? (
              <p className="text-center py-8 text-muted-foreground">Aucune facture trouvée</p>
            ) : null}
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
                  <p className="text-sm flex items-center gap-1">
                    {selectedInvoice.client_email}
                    {selectedInvoice.client_email?.includes("***") && (
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="text-sm">{format(new Date(selectedInvoice.created_at), "d MMMM yyyy", { locale: fr })}</p>
                </div>
              </div>

              {selectedInvoice.due_date && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Échéance: </span>
                    {format(new Date(selectedInvoice.due_date), "d MMMM yyyy", { locale: fr })}
                  </p>
                </div>
              )}

              {selectedInvoice.etransfer_status && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Statut e-Transfer: {selectedInvoice.etransfer_status}</p>
                </div>
              )}

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Pour enregistrer un paiement ou modifier cette facture, déverrouillez d'abord le compte client avec le NIP.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmployeeBilling;
