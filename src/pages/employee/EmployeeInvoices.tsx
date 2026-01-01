import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  LogOut,
  RefreshCw,
  Search,
  ArrowLeft,
  Eye,
  User,
  Calendar,
  Clock,
  DollarSign,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-yellow-500/20 text-yellow-600" },
  paid: { label: "Payée", color: "bg-emerald-500/20 text-emerald-600" },
  overdue: { label: "En retard", color: "bg-red-500/20 text-red-600" },
  cancelled: { label: "Annulée", color: "bg-gray-500/20 text-gray-600" },
};

const EmployeeInvoices = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create invoice dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    client_email: "",
    subtotal: "",
    delivery_fee: "0",
    activation_fee: "0",
    installation_fee: "0",
    due_date: format(addDays(new Date(), 15), "yyyy-MM-dd"),
    notes: "",
  });

  useEffect(() => {
    const stored = localStorage.getItem("nivra_employee_session");
    if (!stored) {
      navigate("/employee/login");
      return;
    }
    try {
      const s = JSON.parse(stored);
      if (!s.permissions?.can_generate_invoices && !s.permissions?.can_edit_invoices) {
        toast({ title: "Accès refusé", variant: "destructive" });
        navigate("/employee");
        return;
      }
      setSession(s);
    } catch {
      navigate("/employee/login");
    }
  }, [navigate, toast]);

  // Handle action param
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "new" && session?.permissions?.can_generate_invoices) {
      setShowCreateDialog(true);
      searchParams.delete("action");
      setSearchParams(searchParams);
    }
  }, [searchParams, session]);

  const fetchInvoices = async () => {
    if (!session?.token) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_invoices", params: { limit: 200 } },
      });
      if (error) throw error;
      setInvoices(data?.invoices || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClients = async () => {
    if (!session?.token) return;
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_clients", params: { limit: 500 } },
      });
      if (error) throw error;
      setClients(data?.clients || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  useEffect(() => {
    if (session?.token) {
      fetchInvoices();
      fetchClients();
    }
  }, [session?.token]);

  const handleCreateInvoice = async () => {
    if (!session?.permissions?.can_generate_invoices) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    const client = clients.find(c => c.email === newInvoice.client_email);
    if (!client) {
      toast({ title: "Client non trouvé", variant: "destructive" });
      return;
    }
    const subtotal = parseFloat(newInvoice.subtotal);
    if (isNaN(subtotal) || subtotal <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: {
          action: "create_invoice",
          params: {
            user_id: client.user_id,
            client_email: newInvoice.client_email,
            subtotal,
            delivery_fee: parseFloat(newInvoice.delivery_fee) || 0,
            activation_fee: parseFloat(newInvoice.activation_fee) || 0,
            installation_fee: parseFloat(newInvoice.installation_fee) || 0,
            due_date: newInvoice.due_date,
            notes: newInvoice.notes,
          },
        },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Facture créée", description: `Numéro: ${data.invoice?.invoice_number}` });
      setShowCreateDialog(false);
      setNewInvoice({
        client_email: "",
        subtotal: "",
        delivery_fee: "0",
        activation_fee: "0",
        installation_fee: "0",
        due_date: format(addDays(new Date(), 15), "yyyy-MM-dd"),
        notes: "",
      });
      fetchInvoices();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("nivra_employee_session");
    navigate("/employee/login");
  };

  const filteredInvoices = invoices.filter(invoice => {
    if (!search) return true;
    return invoice.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      invoice.client_email?.toLowerCase().includes(search.toLowerCase());
  });

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/employee">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <FileText className="w-6 h-6 text-purple-500" />
              <h1 className="font-display font-bold text-lg">Factures</h1>
            </div>
            <div className="flex items-center gap-2">
              {session?.permissions?.can_generate_invoices && (
                <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />
                {format(lastRefresh, "HH:mm")}
              </span>
              <Button variant="outline" size="sm" onClick={fetchInvoices} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par numéro ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucune facture trouvée
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facture #</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créée le</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoice_number || "N/A"}</TableCell>
                      <TableCell>{invoice.client_email || "N/A"}</TableCell>
                      <TableCell className="font-medium">${invoice.amount?.toFixed(2) || "0.00"}</TableCell>
                      <TableCell>
                        {invoice.due_date ? format(new Date(invoice.due_date), "d MMM yyyy", { locale: fr }) : "N/A"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusLabels[invoice.status]?.color || "bg-gray-500/20"}>
                          {statusLabels[invoice.status]?.label || invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(invoice.created_at), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedInvoice(invoice)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {!session?.permissions?.can_confirm_payments && (
          <p className="text-xs text-muted-foreground text-center">
            Note: Seul un administrateur peut confirmer les paiements.
          </p>
        )}
      </main>

      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {selectedInvoice?.invoice_number || "Facture"}
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              <Badge className={statusLabels[selectedInvoice.status]?.color}>
                {statusLabels[selectedInvoice.status]?.label || selectedInvoice.status}
              </Badge>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedInvoice.client_email || "N/A"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span>
                    Échéance: {selectedInvoice.due_date 
                      ? format(new Date(selectedInvoice.due_date), "d MMMM yyyy", { locale: fr })
                      : "N/A"}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                {selectedInvoice.subtotal && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span>${selectedInvoice.subtotal?.toFixed(2)}</span>
                  </div>
                )}
                {selectedInvoice.tps_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TPS</span>
                    <span>${selectedInvoice.tps_amount?.toFixed(2)}</span>
                  </div>
                )}
                {selectedInvoice.tvq_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVQ</span>
                    <span>${selectedInvoice.tvq_amount?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>${selectedInvoice.amount?.toFixed(2) || "0.00"}</span>
                </div>
              </div>

              {selectedInvoice.paid_at && (
                <div className="bg-emerald-500/10 p-3 rounded text-sm text-emerald-600">
                  Payée le {format(new Date(selectedInvoice.paid_at), "d MMMM yyyy à HH:mm", { locale: fr })}
                </div>
              )}

              {selectedInvoice.notes && (
                <div className="bg-muted/50 p-3 rounded text-sm">
                  <p className="font-medium mb-1">Notes:</p>
                  <p className="text-muted-foreground">{selectedInvoice.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Nouvelle facture
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select
                value={newInvoice.client_email}
                onValueChange={(value) => setNewInvoice({ ...newInvoice, client_email: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.email || ""}>
                      {client.full_name || client.email} - {client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sous-total *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    value={newInvoice.subtotal}
                    onChange={(e) => setNewInvoice({ ...newInvoice, subtotal: e.target.value })}
                    className="pl-10"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date d'échéance *</Label>
                <Input
                  type="date"
                  value={newInvoice.due_date}
                  onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Frais livraison</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newInvoice.delivery_fee}
                  onChange={(e) => setNewInvoice({ ...newInvoice, delivery_fee: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Frais activation</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newInvoice.activation_fee}
                  onChange={(e) => setNewInvoice({ ...newInvoice, activation_fee: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Frais installation</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newInvoice.installation_fee}
                  onChange={(e) => setNewInvoice({ ...newInvoice, installation_fee: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={newInvoice.notes}
                onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                placeholder="Notes internes..."
                rows={3}
              />
            </div>

            <div className="bg-muted/50 p-3 rounded text-sm space-y-1">
              <div className="flex justify-between">
                <span>Sous-total</span>
                <span>${parseFloat(newInvoice.subtotal || "0").toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Frais</span>
                <span>${(parseFloat(newInvoice.delivery_fee || "0") + parseFloat(newInvoice.activation_fee || "0") + parseFloat(newInvoice.installation_fee || "0")).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>TPS (5%)</span>
                <span>Calculé automatiquement</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>TVQ (9.975%)</span>
                <span>Calculé automatiquement</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateInvoice} disabled={isSubmitting || !newInvoice.client_email || !newInvoice.subtotal}>
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
              Créer la facture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeInvoices;
