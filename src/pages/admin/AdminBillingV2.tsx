/**
 * Admin Billing V2 - New billing system management
 * Based on billing_customers, billing_subscriptions, billing_invoices tables
 */

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  CreditCard, 
  Users, 
  FileText, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Search,
  Eye,
  DollarSign,
  Calendar,
  Loader2,
  Play,
  TrendingUp,
  Plus,
  Download,
  Upload
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  useBillingCustomers,
  useBillingSubscriptions,
  useBillingInvoices,
  useBillingStats,
  useConfirmPayment,
  type BillingInvoice,
  type BillingSubscription,
  type BillingCustomer,
  BILLING_INVOICE_STATUS_LABELS,
  BILLING_INVOICE_STATUS_COLORS,
  BILLING_SUBSCRIPTION_STATUS_LABELS,
  BILLING_SUBSCRIPTION_STATUS_COLORS,
} from "@/lib/billing";
import { LegacyInvoiceImportDialog } from "@/components/admin/billing/LegacyInvoiceImportDialog";
import { CreateInvoiceDialog } from "@/components/admin/billing/CreateInvoiceDialog";
import { InvoiceAdjustmentDialog } from "@/components/admin/billing/InvoiceAdjustmentDialog";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(amount || 0);

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "N/A";
  return format(new Date(dateStr), "d MMM yyyy", { locale: fr });
};

const AdminBillingV2 = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [paymentReference, setPaymentReference] = useState("");
  const [isMigrating, setIsMigrating] = useState(false);
  
  // New dialogs
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [adjustmentInvoice, setAdjustmentInvoice] = useState<BillingInvoice | null>(null);

  // Data hooks
  const { data: stats, isLoading: statsLoading } = useBillingStats();
  const { data: customers, isLoading: customersLoading } = useBillingCustomers();
  const { data: subscriptions, isLoading: subscriptionsLoading } = useBillingSubscriptions();
  const { data: invoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useBillingInvoices();

  const confirmPayment = useConfirmPayment();

  // Filter invoices by search
  const filteredInvoices = invoices?.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const customerName = `${inv.customer?.first_name || ""} ${inv.customer?.last_name || ""}`.toLowerCase();
    const email = inv.customer?.email?.toLowerCase() || "";
    const invoiceNum = inv.invoice_number?.toLowerCase() || "";
    return customerName.includes(query) || email.includes(query) || invoiceNum.includes(query);
  });

  // Handle payment confirmation
  const handleConfirmPayment = async () => {
    if (!selectedInvoice) return;

    try {
      await confirmPayment.mutateAsync({
        invoice_id: selectedInvoice.id,
        payment_reference: paymentReference || undefined,
      });

      toast({
        title: "Paiement confirmé",
        description: `Facture ${selectedInvoice.invoice_number} marquée comme payée`,
      });

      setConfirmDialogOpen(false);
      setSelectedInvoice(null);
      setPaymentReference("");
      refetchInvoices();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Échec de la confirmation",
        variant: "destructive",
      });
    }
  };

  // Run migration
  const handleMigration = async (dryRun: boolean) => {
    setIsMigrating(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing-migrate-clients", {
        body: { dry_run: dryRun },
      });

      if (error) throw error;

      toast({
        title: dryRun ? "Simulation terminée" : "Migration terminée",
        description: `${data.customers_migrated} clients migrés, ${data.subscriptions_created} abonnements créés`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur de migration",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsMigrating(false);
    }
  };

  // Trigger manual cron
  const handleTriggerCron = async (functionName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(functionName);
      if (error) throw error;

      toast({
        title: "Exécution terminée",
        description: JSON.stringify(data, null, 2).substring(0, 200),
      });
      refetchInvoices();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Facturation V2</h1>
            <p className="text-muted-foreground">Nouveau système de facturation prepaid</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* NEW: Import from legacy */}
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
            >
              <Download className="h-4 w-4 mr-2" />
              Importer Legacy
            </Button>
            
            {/* NEW: Create manual invoice */}
            <Button
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Créer facture
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleTriggerCron("billing-generate-renewals")}
              disabled={isMigrating}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Renouvellements
            </Button>
            <Button
              variant="outline"
              onClick={() => handleTriggerCron("billing-check-overdue")}
              disabled={isMigrating}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Non-renouvellements
            </Button>
          </div>
        </div>

        {/* Post-Update Validation Banner */}
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-amber-800 dark:text-amber-200">Post-update validation:</span>
                <code className="bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded text-xs font-mono">
                  scripts/billing_v2_post_update_checks.sql
                </code>
                <Badge variant="outline" className="border-amber-600 text-amber-700 dark:text-amber-300">
                  10/10 PASS required
                </Badge>
              </div>
              <a
                href="/admin/billing-playbook"
                className="text-xs text-amber-700 dark:text-amber-300 hover:underline"
              >
                Voir documentation →
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Clients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {statsLoading ? "..." : stats?.totalCustomers || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Abonnements actifs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-500" />
                {statsLoading ? "..." : stats?.totalSubscriptions || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-amber-500" />
                {statsLoading ? "..." : formatCurrency(stats?.pendingAmount || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenus (payés)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                {statsLoading ? "..." : formatCurrency(stats?.paidAmount || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Aperçu</TabsTrigger>
            <TabsTrigger value="invoices">Factures</TabsTrigger>
            <TabsTrigger value="subscriptions">Abonnements</TabsTrigger>
            <TabsTrigger value="customers">Clients</TabsTrigger>
            <TabsTrigger value="migration">Migration</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Factures en attente de paiement</CardTitle>
                <CardDescription>Factures pending à confirmer</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Facture</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Échéance</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices
                      ?.filter((i) => i.status === "pending")
                      .slice(0, 10)
                      .map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono">{invoice.invoice_number}</TableCell>
                          <TableCell>
                            {invoice.customer?.first_name} {invoice.customer?.last_name}
                            <br />
                            <span className="text-xs text-muted-foreground">{invoice.customer?.email}</span>
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(invoice.total)}</TableCell>
                          <TableCell>{formatDate(invoice.due_date)}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setConfirmDialogOpen(true);
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Confirmer
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    {(!invoices || invoices.filter((i) => i.status === "pending").length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Aucune facture en attente
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle>Toutes les factures</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setImportDialogOpen(true)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Importer
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setCreateDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Créer
                    </Button>
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-64"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {invoicesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Facture</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Échéance</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices?.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono">{invoice.invoice_number}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{invoice.type}</Badge>
                          </TableCell>
                          <TableCell>
                            {invoice.customer?.first_name} {invoice.customer?.last_name}
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(invoice.total)}</TableCell>
                          <TableCell>
                            <Badge className={BILLING_INVOICE_STATUS_COLORS[invoice.status]}>
                              {BILLING_INVOICE_STATUS_LABELS[invoice.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(invoice.due_date)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {invoice.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedInvoice(invoice);
                                    setConfirmDialogOpen(true);
                                  }}
                                  title="Confirmer paiement"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAdjustmentInvoice(invoice);
                                  setAdjustmentDialogOpen(true);
                                }}
                                title="Ajuster la facture"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!filteredInvoices || filteredInvoices.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Aucune facture trouvée
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscriptions Tab */}
          <TabsContent value="subscriptions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Abonnements</CardTitle>
              </CardHeader>
              <CardContent>
                {subscriptionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Prix</TableHead>
                        <TableHead>Cycle</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscriptions?.map((sub) => (
                        <TableRow key={sub.id}>
                          <TableCell>
                            {sub.customer?.first_name} {sub.customer?.last_name}
                            <br />
                            <span className="text-xs text-muted-foreground">{sub.customer?.email}</span>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{sub.plan_name}</div>
                            <div className="text-xs text-muted-foreground">{sub.plan_code}</div>
                          </TableCell>
                          <TableCell className="font-semibold">{formatCurrency(sub.plan_price)}/mois</TableCell>
                          <TableCell>
                            {formatDate(sub.cycle_start_date)} → {formatDate(sub.cycle_end_date)}
                          </TableCell>
                          <TableCell>
                            <Badge className={BILLING_SUBSCRIPTION_STATUS_COLORS[sub.status]}>
                              {BILLING_SUBSCRIPTION_STATUS_LABELS[sub.status]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!subscriptions || subscriptions.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Aucun abonnement
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customers Tab */}
          <TabsContent value="customers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Clients facturés</CardTitle>
              </CardHeader>
              <CardContent>
                {customersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Téléphone</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Créé le</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers?.map((customer) => (
                        <TableRow key={customer.id}>
                          <TableCell className="font-medium">
                            {customer.first_name} {customer.last_name}
                          </TableCell>
                          <TableCell>{customer.email}</TableCell>
                          <TableCell>{customer.phone}</TableCell>
                          <TableCell>
                            <Badge
                              variant={customer.status === "active" ? "default" : "destructive"}
                            >
                              {customer.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(customer.created_at)}</TableCell>
                        </TableRow>
                      ))}
                      {(!customers || customers.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Aucun client
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Migration Tab */}
          <TabsContent value="migration" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Migration des clients existants</CardTitle>
                <CardDescription>
                  Migrer les clients du système legacy vers le nouveau système de facturation V2
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => handleMigration(true)}
                    disabled={isMigrating}
                  >
                    {isMigrating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Eye className="h-4 w-4 mr-2" />
                    Simulation (dry run)
                  </Button>
                  <Button
                    onClick={() => handleMigration(false)}
                    disabled={isMigrating}
                  >
                    {isMigrating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Play className="h-4 w-4 mr-2" />
                    Exécuter la migration
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setImportDialogOpen(true)}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Importer factures legacy
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  La simulation affiche ce qui serait migré sans modifier les données.
                  L'exécution crée les clients et abonnements dans le nouveau système.
                  <br /><br />
                  <strong>Import factures legacy:</strong> Sélectionnez les factures individuelles de l'ancien système (table billing) à téléporter vers Facturation V2.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Confirm Payment Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmer le paiement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="font-medium">{selectedInvoice?.invoice_number}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedInvoice?.customer?.first_name} {selectedInvoice?.customer?.last_name}
                </p>
                <p className="text-lg font-bold mt-2">
                  {formatCurrency(selectedInvoice?.total || 0)}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Référence de paiement (optionnel)</Label>
                <Input
                  placeholder="ex: Interac #12345"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleConfirmPayment} disabled={confirmPayment.isPending}>
                {confirmPayment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmer le paiement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Legacy Dialog */}
        <LegacyInvoiceImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
        />

        {/* Create Invoice Dialog */}
        <CreateInvoiceDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />

        {/* Invoice Adjustment Dialog */}
        <InvoiceAdjustmentDialog
          open={adjustmentDialogOpen}
          onOpenChange={setAdjustmentDialogOpen}
          invoice={adjustmentInvoice}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminBillingV2;
