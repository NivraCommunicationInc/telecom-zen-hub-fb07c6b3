import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Plus, Eye, DollarSign, AlertTriangle, FileDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-500",
  paid: "bg-emerald-500/20 text-emerald-500",
  overdue: "bg-red-500/20 text-red-500",
  cancelled: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  pending: "En attente",
  paid: "Payé",
  overdue: "En retard",
  cancelled: "Annulé",
};

const AdminBilling = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [newInvoice, setNewInvoice] = useState({
    user_id: "",
    amount: "",
    due_date: "",
    notes: "",
  });

  const { data: billing, isLoading } = useQuery({
    queryKey: ["admin-billing"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing")
        .select("*, profiles!billing_user_id_fkey(email, full_name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["admin-clients-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .order("full_name");

      if (error) throw error;
      return data;
    },
  });

  // Auto-apply late fees to overdue invoices
  const applyLateFeeMutation = useMutation({
    mutationFn: async (bill: any) => {
      const lateFee = Number(bill.amount) * 0.05;
      const { error } = await supabase
        .from("billing")
        .update({
          fees: (Number(bill.fees) || 0) + lateFee,
          late_fee_applied: true,
          status: "overdue",
        })
        .eq("id", bill.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
    },
  });

  // Check for overdue invoices on load
  useEffect(() => {
    if (billing) {
      billing.forEach((bill: any) => {
        if (
          bill.status === "pending" &&
          bill.due_date &&
          isPast(parseISO(bill.due_date)) &&
          !bill.late_fee_applied
        ) {
          applyLateFeeMutation.mutate(bill);
        }
      });
    }
  }, [billing]);

  const filteredBilling = billing?.filter((bill: any) => {
    if (activeTab === "all") return true;
    if (activeTab === "overdue") return bill.status === "overdue";
    if (activeTab === "pending") return bill.status === "pending";
    if (activeTab === "paid") return bill.status === "paid";
    return true;
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (invoice: typeof newInvoice) => {
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase
        .from("billing")
        .insert({
          user_id: invoice.user_id,
          amount: parseFloat(invoice.amount),
          due_date: invoice.due_date || null,
          notes: invoice.notes,
          invoice_number: invoiceNumber,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
      logActivity("create", "invoice", data.id, { amount: data.amount });
      toast({ title: "Facture créée avec succès" });
      setCreateDialogOpen(false);
      setNewInvoice({ user_id: "", amount: "", due_date: "", notes: "" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const updateBillingMutation = useMutation({
    mutationFn: async (bill: any) => {
      const { error } = await supabase
        .from("billing")
        .update({
          amount: bill.amount,
          fees: bill.fees,
          credits: bill.credits,
          status: bill.status,
          notes: bill.notes,
          paid_at: bill.status === "paid" ? new Date().toISOString() : bill.paid_at,
        })
        .eq("id", bill.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
      logActivity("update", "invoice", selectedBill?.id, { status: selectedBill?.status });
      toast({ title: "Facture mise à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const markAsPaid = (bill: any) => {
    updateBillingMutation.mutate({ ...bill, status: "paid" });
    setDetailsDialogOpen(false);
  };

  const handleViewDetails = (bill: any) => {
    setSelectedBill({ ...bill });
    setDetailsDialogOpen(true);
  };

  const calculateTotal = (bill: any) => {
    const base = Number(bill.amount) || 0;
    const fees = Number(bill.fees) || 0;
    const credits = Number(bill.credits) || 0;
    return base + fees - credits;
  };

  const exportInvoicePDF = (bill: any) => {
    const total = calculateTotal(bill);
    const clientName = bill.profiles?.full_name || "Client";
    const clientEmail = bill.profiles?.email || "";
    const invoiceNum = bill.invoice_number || bill.id.slice(0, 8);
    const dueDate = bill.due_date ? format(new Date(bill.due_date), "d MMMM yyyy", { locale: fr }) : "N/A";
    const createdDate = format(new Date(bill.created_at), "d MMMM yyyy", { locale: fr });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Facture ${invoiceNum}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .logo { font-size: 24px; font-weight: bold; color: #0891b2; }
          .invoice-title { font-size: 28px; font-weight: bold; text-align: right; }
          .invoice-num { color: #666; text-align: right; }
          .section { margin-bottom: 30px; }
          .label { color: #666; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
          .value { font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f5f5f5; text-align: left; padding: 12px; border-bottom: 2px solid #ddd; }
          td { padding: 12px; border-bottom: 1px solid #eee; }
          .amount { text-align: right; }
          .total-row { font-weight: bold; background: #f9f9f9; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          .status-paid { background: #d1fae5; color: #059669; }
          .status-pending { background: #fef3c7; color: #d97706; }
          .status-overdue { background: #fee2e2; color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">NIVRA</div>
          <div>
            <div class="invoice-title">FACTURE</div>
            <div class="invoice-num">${invoiceNum}</div>
          </div>
        </div>
        
        <div class="section">
          <div class="label">Facturer à</div>
          <div class="value"><strong>${clientName}</strong></div>
          <div class="value">${clientEmail}</div>
        </div>
        
        <div style="display: flex; gap: 60px;">
          <div class="section">
            <div class="label">Date de création</div>
            <div class="value">${createdDate}</div>
          </div>
          <div class="section">
            <div class="label">Date d'échéance</div>
            <div class="value">${dueDate}</div>
          </div>
          <div class="section">
            <div class="label">Statut</div>
            <div class="value">
              <span class="status status-${bill.status}">${statusLabels[bill.status] || bill.status}</span>
            </div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="amount">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Montant de base</td>
              <td class="amount">${Number(bill.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</td>
            </tr>
            ${Number(bill.fees) > 0 ? `
            <tr>
              <td>Frais supplémentaires ${bill.late_fee_applied ? "(incluant frais de retard 5%)" : ""}</td>
              <td class="amount">+${Number(bill.fees).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</td>
            </tr>
            ` : ""}
            ${Number(bill.credits) > 0 ? `
            <tr>
              <td>Crédits appliqués</td>
              <td class="amount">-${Number(bill.credits).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</td>
            </tr>
            ` : ""}
            <tr class="total-row">
              <td>Total</td>
              <td class="amount">${total.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</td>
            </tr>
          </tbody>
        </table>
        
        ${bill.notes ? `
        <div class="section">
          <div class="label">Notes</div>
          <div class="value">${bill.notes}</div>
        </div>
        ` : ""}
        
        <div class="footer">
          <p>Nivra Inc. • Courtier télécom indépendant</p>
          <p>Cette facture a été générée automatiquement.</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }

    toast({ title: "Facture PDF prête à imprimer" });
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Facturation</h1>
            <p className="text-muted-foreground mt-1">Gérer les factures et paiements</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle facture
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Créer une facture</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Client</Label>
                  <Select
                    value={newInvoice.user_id}
                    onValueChange={(v) => setNewInvoice({ ...newInvoice, user_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client: any) => (
                        <SelectItem key={client.user_id} value={client.user_id}>
                          {client.full_name || client.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Montant</Label>
                  <Input
                    type="number"
                    value={newInvoice.amount}
                    onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Date d'échéance</Label>
                  <Input
                    type="date"
                    value={newInvoice.due_date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={newInvoice.notes}
                    onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                    placeholder="Description de la facture..."
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createInvoiceMutation.mutate(newInvoice)}
                  disabled={!newInvoice.user_id || !newInvoice.amount}
                >
                  Créer la facture
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold text-foreground">
                  {billing?.filter((b: any) => b.status === "pending").length || 0}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En retard</p>
                <p className="text-2xl font-bold text-foreground">
                  {billing?.filter((b: any) => b.status === "overdue").length || 0}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payé ce mois</p>
                <p className="text-2xl font-bold text-foreground">
                  {billing
                    ?.filter((b: any) => b.status === "paid")
                    .reduce((sum: number, b: any) => sum + Number(b.amount), 0)
                    .toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                Factures
              </CardTitle>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">Toutes</TabsTrigger>
                  <TabsTrigger value="pending">En attente</TabsTrigger>
                  <TabsTrigger value="overdue">En retard</TabsTrigger>
                  <TabsTrigger value="paid">Payées</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredBilling && filteredBilling.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nº</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Montant</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Frais</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Échéance</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBilling.map((bill: any) => (
                      <tr key={bill.id} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="py-3 px-4 text-sm text-foreground font-mono">
                          {bill.invoice_number || bill.id.slice(0, 8)}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-foreground">{bill.profiles?.full_name || "N/A"}</p>
                          <p className="text-xs text-muted-foreground">{bill.profiles?.email}</p>
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">
                          {Number(bill.amount).toLocaleString("fr-CA", {
                            style: "currency",
                            currency: "CAD",
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">
                          {Number(bill.fees || 0).toLocaleString("fr-CA", {
                            style: "currency",
                            currency: "CAD",
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground font-medium">
                          {calculateTotal(bill).toLocaleString("fr-CA", {
                            style: "currency",
                            currency: "CAD",
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {bill.due_date
                            ? format(new Date(bill.due_date), "d MMM yyyy", { locale: fr })
                            : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={statusColors[bill.status] || "bg-muted"}>
                            {statusLabels[bill.status] || bill.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewDetails(bill)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => exportInvoicePDF(bill)}>
                              <FileDown className="w-4 h-4" />
                            </Button>
                            {bill.status !== "paid" && (
                              <Button
                                size="sm"
                                variant="hero"
                                onClick={() => markAsPaid(bill)}
                              >
                                <DollarSign className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune facture pour le moment</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Détails de la facture</DialogTitle>
            </DialogHeader>
            {selectedBill && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Montant de base</Label>
                    <Input
                      type="number"
                      value={selectedBill.amount}
                      onChange={(e) =>
                        setSelectedBill({ ...selectedBill, amount: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Statut</Label>
                    <Select
                      value={selectedBill.status}
                      onValueChange={(v) => setSelectedBill({ ...selectedBill, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">En attente</SelectItem>
                        <SelectItem value="paid">Payé</SelectItem>
                        <SelectItem value="overdue">En retard</SelectItem>
                        <SelectItem value="cancelled">Annulé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Frais supplémentaires</Label>
                    <Input
                      type="number"
                      value={selectedBill.fees || 0}
                      onChange={(e) =>
                        setSelectedBill({ ...selectedBill, fees: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Crédits</Label>
                    <Input
                      type="number"
                      value={selectedBill.credits || 0}
                      onChange={(e) =>
                        setSelectedBill({ ...selectedBill, credits: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Montant de base:</span>
                    <span>
                      {Number(selectedBill.amount).toLocaleString("fr-CA", {
                        style: "currency",
                        currency: "CAD",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Frais:</span>
                    <span>
                      +{Number(selectedBill.fees || 0).toLocaleString("fr-CA", {
                        style: "currency",
                        currency: "CAD",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Crédits:</span>
                    <span>
                      -{Number(selectedBill.credits || 0).toLocaleString("fr-CA", {
                        style: "currency",
                        currency: "CAD",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t border-border">
                    <span>Total:</span>
                    <span>
                      {calculateTotal(selectedBill).toLocaleString("fr-CA", {
                        style: "currency",
                        currency: "CAD",
                      })}
                    </span>
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={selectedBill.notes || ""}
                    onChange={(e) =>
                      setSelectedBill({ ...selectedBill, notes: e.target.value })
                    }
                    placeholder="Notes internes..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      updateBillingMutation.mutate(selectedBill);
                      setDetailsDialogOpen(false);
                    }}
                  >
                    Enregistrer
                  </Button>
                  <Button variant="outline" onClick={() => exportInvoicePDF(selectedBill)}>
                    <FileDown className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                  {selectedBill.status !== "paid" && (
                    <Button variant="hero" onClick={() => markAsPaid(selectedBill)}>
                      <DollarSign className="w-4 h-4 mr-2" />
                      Marquer payé
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminBilling;
