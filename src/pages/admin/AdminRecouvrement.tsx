import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  AlertTriangle, 
  Search, 
  ExternalLink, 
  FileText, 
  MessageSquare, 
  Mail, 
  RefreshCw,
  Filter,
  DollarSign,
  Clock,
  Users,
  Ban,
  Phone,
  Loader2,
  XCircle
} from "lucide-react";
import { Link } from "react-router-dom";
import { calculateDaysSinceSuspension, getSuspensionBucket, isNumberAtRisk, BILLING_CONSTANTS } from "@/lib/billingCycleUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface RecoveryAccount {
  id: string;
  client_id: string;
  account_number: string;
  account_name: string | null;
  billing_cycle_day: number | null;
  status: string | null;
  created_at: string;
  number_lost_at?: string | null;
  number_lost_reason?: string | null;
  recouvrement_reminder_sent_at?: string | null;
  // Joined data
  client_name?: string;
  client_email?: string;
  latest_invoice_id?: string;
  latest_invoice_number?: string;
  latest_invoice_amount?: number;
  latest_invoice_due_date?: string;
  payment_method?: string;
  days_since_suspension?: number;
}

const AdminRecouvrement = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [daysBucketFilter, setDaysBucketFilter] = useState<string>("all");
  
  // Dialog states
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [numberLostDialogOpen, setNumberLostDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<RecoveryAccount | null>(null);
  const [noteText, setNoteText] = useState("");
  const [numberLostReason, setNumberLostReason] = useState("");
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  // Fetch accounts with overdue invoices - primary source: invoices with status overdue
  const { data: recoveryAccounts, isLoading, refetch } = useQuery({
    queryKey: ["recovery-accounts", statusFilter],
    queryFn: async () => {
      // 1. First fetch all overdue invoices from monthly_invoices
      const { data: overdueMonthlyInvoices, error: monthlyError } = await supabase
        .from("monthly_invoices")
        .select("id, invoice_number, total, due_date, client_id, status")
        .eq("status", "overdue")
        .order("due_date", { ascending: true });

      if (monthlyError) throw monthlyError;

      // 2. Fetch all overdue invoices from billing table
      const { data: overdueBillingInvoices, error: billingError } = await supabase
        .from("billing")
        .select("id, invoice_number, amount, due_date, user_id, status, payment_reference")
        .eq("status", "overdue")
        .order("due_date", { ascending: true });

      if (billingError) throw billingError;

      // 3. Also get invoices that are past due date but not marked as overdue yet
      const today = new Date().toISOString().split('T')[0];
      
      const { data: pastDueMonthly } = await supabase
        .from("monthly_invoices")
        .select("id, invoice_number, total, due_date, client_id, status")
        .in("status", ["issued", "pending", "partial"])
        .lt("due_date", today)
        .order("due_date", { ascending: true });

      const { data: pastDueBilling } = await supabase
        .from("billing")
        .select("id, invoice_number, amount, due_date, user_id, status, payment_reference")
        .in("status", ["pending", "partial", "issued"])
        .lt("due_date", today)
        .order("due_date", { ascending: true });

      // 4. Combine all client IDs that have overdue/past due invoices
      const clientIdsFromMonthly = [
        ...(overdueMonthlyInvoices?.map(i => i.client_id) || []),
        ...(pastDueMonthly?.map(i => i.client_id) || [])
      ];
      const clientIdsFromBilling = [
        ...(overdueBillingInvoices?.map(i => i.user_id) || []),
        ...(pastDueBilling?.map(i => i.user_id) || [])
      ];
      const allClientIds = [...new Set([...clientIdsFromMonthly, ...clientIdsFromBilling])];

      if (allClientIds.length === 0) {
        return [];
      }

      // 5. Fetch accounts for these clients
      const { data: accounts, error: accountsError } = await supabase
        .from("accounts")
        .select(`
          id,
          client_id,
          account_number,
          account_name,
          billing_cycle_day,
          status,
          created_at,
          number_lost_at,
          number_lost_reason,
          recouvrement_reminder_sent_at
        `)
        .in("client_id", allClientIds);

      if (accountsError) throw accountsError;

      // 6. Also fetch accounts that are already marked as suspended/overdue/expired
      const { data: statusBasedAccounts, error: statusError } = await supabase
        .from("accounts")
        .select(`
          id,
          client_id,
          account_number,
          account_name,
          billing_cycle_day,
          status,
          created_at,
          number_lost_at,
          number_lost_reason,
          recouvrement_reminder_sent_at
        `)
        .or("status.eq.suspended,status.eq.overdue,status.eq.expired,status.eq.number_lost");

      if (statusError) throw statusError;

      // Combine and dedupe accounts
      const allAccounts = [...(accounts || []), ...(statusBasedAccounts || [])];
      const uniqueAccounts = allAccounts.filter((account, index, self) =>
        index === self.findIndex(a => a.id === account.id)
      );

      // 7. Get all unique client IDs from combined accounts
      const finalClientIds = [...new Set(uniqueAccounts.map(a => a.client_id))];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", finalClientIds);

      // Combine all invoices for lookup
      const allMonthlyInvoices = [...(overdueMonthlyInvoices || []), ...(pastDueMonthly || [])];
      const allBillingInvoices = [...(overdueBillingInvoices || []), ...(pastDueBilling || [])];

      const enrichedAccounts: RecoveryAccount[] = uniqueAccounts.map(account => {
        const profile = profiles?.find(p => p.user_id === account.client_id);
        
        // Find the oldest unpaid invoice for this client
        const clientMonthlyInvoices = allMonthlyInvoices.filter(i => i.client_id === account.client_id);
        const clientBillingInvoices = allBillingInvoices.filter(i => i.user_id === account.client_id);
        
        // Get the oldest invoice (earliest due date)
        const oldestMonthly = clientMonthlyInvoices[0];
        const oldestBilling = clientBillingInvoices[0];
        
        let latestInvoice: any = null;
        if (oldestMonthly && oldestBilling) {
          latestInvoice = new Date(oldestMonthly.due_date) < new Date(oldestBilling.due_date) 
            ? oldestMonthly 
            : oldestBilling;
        } else {
          latestInvoice = oldestMonthly || oldestBilling;
        }
        
        let daysSince = 0;
        if (latestInvoice?.due_date) {
          daysSince = calculateDaysSinceSuspension(new Date(latestInvoice.due_date));
        }

        return {
          ...account,
          client_name: profile?.full_name || "—",
          client_email: profile?.email,
          latest_invoice_id: latestInvoice?.id,
          latest_invoice_number: latestInvoice?.invoice_number,
          latest_invoice_amount: latestInvoice?.total || latestInvoice?.amount || 0,
          latest_invoice_due_date: latestInvoice?.due_date,
          payment_method: latestInvoice?.payment_reference?.includes("etransfer") ? "etransfer" : "credit_card",
          days_since_suspension: daysSince,
        };
      });

      // Only return accounts that have overdue invoices or are in a problem status
      return enrichedAccounts.filter(a => 
        a.latest_invoice_id || 
        a.status === 'suspended' || 
        a.status === 'overdue' || 
        a.status === 'expired' ||
        a.status === 'number_lost'
      );
    },
  });

  // Filter accounts
  const filteredAccounts = recoveryAccounts?.filter(account => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !account.client_name?.toLowerCase().includes(query) &&
        !account.account_number?.toLowerCase().includes(query) &&
        !account.client_email?.toLowerCase().includes(query)
      ) {
        return false;
      }
    }

    if (statusFilter !== "all" && account.status !== statusFilter) {
      return false;
    }

    if (paymentMethodFilter !== "all" && account.payment_method !== paymentMethodFilter) {
      return false;
    }

    if (daysBucketFilter !== "all") {
      const bucket = getSuspensionBucket(account.days_since_suspension || 0);
      if (bucket !== daysBucketFilter) {
        return false;
      }
    }

    return true;
  }) || [];

  // Stats
  const stats = {
    total: recoveryAccounts?.length || 0,
    suspended: recoveryAccounts?.filter(a => a.status === "suspended").length || 0,
    overdue: recoveryAccounts?.filter(a => a.status === "overdue").length || 0,
    atRisk: recoveryAccounts?.filter(a => isNumberAtRisk(a.days_since_suspension || 0)).length || 0,
    numberLost: recoveryAccounts?.filter(a => a.number_lost_at).length || 0,
    totalOwed: recoveryAccounts?.reduce((sum, a) => sum + (a.latest_invoice_amount || 0), 0) || 0,
  };

  // Add internal note mutation
  const addNoteMutation = useMutation({
    mutationFn: async ({ clientId, note }: { clientId: string; note: string }) => {
      const { error } = await supabase
        .from("client_internal_notes")
        .insert({
          client_id: clientId,
          body: note,
          note_type: "recouvrement",
          created_by_role: "admin",
          created_by_user_id: user?.id || "",
          created_by_name: "Admin",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note ajoutée avec succès");
      setNoteDialogOpen(false);
      setNoteText("");
      setSelectedAccount(null);
    },
    onError: () => {
      toast.error("Erreur lors de l'ajout de la note");
    },
  });

  // Send reminder email
  const sendReminderMutation = useMutation({
    mutationFn: async (account: RecoveryAccount) => {
      if (!account.client_email) throw new Error("Pas d'email client");

      // Call the billing notification edge function
      const { error } = await supabase.functions.invoke("send-billing-notification", {
        body: {
          email: account.client_email,
          name: account.client_name,
          type: "invoice_overdue",
          invoiceNumber: account.latest_invoice_number,
          amount: account.latest_invoice_amount,
          dueDate: account.latest_invoice_due_date,
          notes: `Rappel de recouvrement - ${account.days_since_suspension} jours depuis l'échéance`,
        },
      });

      if (error) throw error;

      // Update account with reminder sent timestamp
      const { error: updateError } = await supabase
        .from("accounts")
        .update({ recouvrement_reminder_sent_at: new Date().toISOString() })
        .eq("id", account.id);

      if (updateError) throw updateError;

      // Log the reminder in internal notes
      await supabase.from("client_internal_notes").insert({
        client_id: account.client_id,
        body: `Rappel de recouvrement envoyé par email. Montant dû: ${account.latest_invoice_amount?.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}. Jours depuis échéance: ${account.days_since_suspension}`,
        note_type: "recouvrement",
        created_by_role: "admin",
        created_by_user_id: user?.id || "",
        created_by_name: "Système (Rappel automatique)",
      });
    },
    onSuccess: () => {
      toast.success("Rappel envoyé avec succès");
      setReminderDialogOpen(false);
      setSelectedAccount(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  // Mark number as lost mutation
  const markNumberLostMutation = useMutation({
    mutationFn: async ({ accountId, clientId, reason }: { accountId: string; clientId: string; reason: string }) => {
      const { error } = await supabase
        .from("accounts")
        .update({
          number_lost_at: new Date().toISOString(),
          number_lost_reason: reason,
          number_lost_by: user?.id,
          status: "number_lost",
        })
        .eq("id", accountId);

      if (error) throw error;

      // Log in internal notes
      await supabase.from("client_internal_notes").insert({
        client_id: clientId,
        body: `⚠️ NUMÉRO MARQUÉ COMME PERDU - Après 90+ jours sans renouvellement, un nouveau numéro sera requis pour réactiver. Raison: ${reason}`,
        note_type: "recouvrement",
        created_by_role: "admin",
        created_by_user_id: user?.id || "",
        created_by_name: "Admin",
      });
    },
    onSuccess: () => {
      toast.success("Numéro marqué comme perdu");
      setNumberLostDialogOpen(false);
      setNumberLostReason("");
      setSelectedAccount(null);
      queryClient.invalidateQueries({ queryKey: ["recovery-accounts"] });
      refetch();
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const handleAddNote = () => {
    if (!selectedAccount || !noteText.trim()) return;
    addNoteMutation.mutate({ clientId: selectedAccount.client_id, note: noteText });
  };

  const handleSendReminder = async () => {
    if (!selectedAccount) return;
    setIsSendingReminder(true);
    try {
      await sendReminderMutation.mutateAsync(selectedAccount);
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleMarkNumberLost = () => {
    if (!selectedAccount || !numberLostReason.trim()) return;
    markNumberLostMutation.mutate({
      accountId: selectedAccount.id,
      clientId: selectedAccount.client_id,
      reason: numberLostReason,
    });
  };

  const getStatusBadge = (account: RecoveryAccount) => {
    const daysSince = account.days_since_suspension || 0;
    
    if (account.number_lost_at) {
      return <Badge className="bg-purple-600/20 text-purple-600">Numéro perdu</Badge>;
    }
    
    if (isNumberAtRisk(daysSince)) {
      return <Badge className="bg-red-600/20 text-red-600">Numéro à risque (90+ jours)</Badge>;
    }
    
    switch (account.status) {
      case "suspended":
        return <Badge className="bg-red-500/20 text-red-500">Service en suspension</Badge>;
      case "overdue":
        return <Badge className="bg-amber-500/20 text-amber-500">Paiement en retard</Badge>;
      case "expired":
        return <Badge className="bg-red-600/20 text-red-600">Expiré</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-500">{account.status || "—"}</Badge>;
    }
  };

  const getDaysBadge = (days: number) => {
    if (days >= 90) return <Badge className="bg-red-600/20 text-red-600">{days} jours</Badge>;
    if (days >= 60) return <Badge className="bg-red-500/20 text-red-500">{days} jours</Badge>;
    if (days >= 30) return <Badge className="bg-amber-500/20 text-amber-500">{days} jours</Badge>;
    return <Badge className="bg-yellow-500/20 text-yellow-500">{days} jours</Badge>;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Recouvrement</h1>
            <p className="text-muted-foreground mt-1">
              Comptes avec paiements en retard et services suspendus
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* 90+ Days Warning Banner */}
        {stats.atRisk > 0 && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-500">
                    {stats.atRisk} compte(s) à risque de perte de numéro
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Après {BILLING_CONSTANTS.NUMBER_LOSS_DAYS} jours sans renouvellement, le numéro peut devenir irrécupérable. 
                    Une réactivation exigera l'attribution d'un nouveau numéro.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Ban className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Suspendus</p>
                  <p className="text-2xl font-bold text-red-500">{stats.suspended}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">En retard</p>
                  <p className="text-2xl font-bold text-amber-500">{stats.overdue}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">À risque</p>
                  <p className="text-2xl font-bold text-red-600">{stats.atRisk}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Perdus</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.numberLost}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total dû</p>
                  <p className="text-lg font-bold text-emerald-500">
                    {stats.totalOwed.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filtres:</span>
              </div>
              
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher client, compte..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="suspended">Suspendu</SelectItem>
                  <SelectItem value="overdue">En retard</SelectItem>
                  <SelectItem value="expired">Expiré</SelectItem>
                  <SelectItem value="number_lost">Numéro perdu</SelectItem>
                </SelectContent>
              </Select>

              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Méthode paiement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes méthodes</SelectItem>
                  <SelectItem value="etransfer">E-Transfer</SelectItem>
                  <SelectItem value="credit_card">Carte crédit</SelectItem>
                </SelectContent>
              </Select>

              <Select value={daysBucketFilter} onValueChange={setDaysBucketFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Jours depuis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="0-30">0-30 jours</SelectItem>
                  <SelectItem value="31-60">31-60 jours</SelectItem>
                  <SelectItem value="61-90">61-90 jours</SelectItem>
                  <SelectItem value="90+">90+ jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Recovery Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Comptes en recouvrement ({filteredAccounts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredAccounts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Aucun compte en recouvrement</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Compte</TableHead>
                      <TableHead>Bill Cycle</TableHead>
                      <TableHead>Facture impayée</TableHead>
                      <TableHead>Montant dû</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Jours</TableHead>
                      <TableHead>Dernier rappel</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAccounts.map((account) => (
                      <TableRow 
                        key={account.id} 
                        className={
                          account.number_lost_at 
                            ? "bg-purple-500/5" 
                            : isNumberAtRisk(account.days_since_suspension || 0) 
                              ? "bg-red-500/5" 
                              : ""
                        }
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{account.client_name}</p>
                            <p className="text-xs text-muted-foreground">{account.client_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-sm">{account.account_number}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{account.billing_cycle_day || "—"}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-mono text-sm">{account.latest_invoice_number || "—"}</p>
                            {account.latest_invoice_due_date && (
                              <p className="text-xs text-muted-foreground">
                                Éch: {format(new Date(account.latest_invoice_due_date), "d MMM yyyy", { locale: fr })}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-red-500">
                            {(account.latest_invoice_amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(account)}
                        </TableCell>
                        <TableCell>
                          {getDaysBadge(account.days_since_suspension || 0)}
                        </TableCell>
                        <TableCell>
                          {account.recouvrement_reminder_sent_at ? (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(account.recouvrement_reminder_sent_at), "d MMM HH:mm", { locale: fr })}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {/* Client Profile Link */}
                            <Link to={`/admin/clients?id=${account.client_id}`}>
                              <Button variant="ghost" size="sm" title="Voir profil client">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </Link>
                            
                            {/* Invoice Link */}
                            {account.latest_invoice_id && (
                              <Link to={`/admin/billing?invoice=${account.latest_invoice_id}`}>
                                <Button variant="ghost" size="sm" title="Voir facture">
                                  <FileText className="w-4 h-4" />
                                </Button>
                              </Link>
                            )}
                            
                            {/* Add Note */}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              title="Ajouter note"
                              onClick={() => {
                                setSelectedAccount(account);
                                setNoteDialogOpen(true);
                              }}
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Button>
                            
                            {/* Send Reminder */}
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              title="Envoyer rappel"
                              onClick={() => {
                                setSelectedAccount(account);
                                setReminderDialogOpen(true);
                              }}
                              disabled={!account.client_email}
                            >
                              <Mail className="w-4 h-4" />
                            </Button>
                            
                            {/* Mark Number Lost (only for 90+ days) */}
                            {isNumberAtRisk(account.days_since_suspension || 0) && !account.number_lost_at && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                title="Marquer numéro comme perdu"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => {
                                  setSelectedAccount(account);
                                  setNumberLostDialogOpen(true);
                                }}
                              >
                                <Phone className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Note Dialog */}
        <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une note de recouvrement</DialogTitle>
              <DialogDescription>
                Cette note sera visible dans l'historique du client.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Client</Label>
                <p className="text-sm text-muted-foreground">{selectedAccount?.client_name}</p>
                <p className="text-xs text-muted-foreground">{selectedAccount?.client_email}</p>
              </div>
              <div>
                <Label>Note</Label>
                <Textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Ajouter une note concernant ce compte..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleAddNote} disabled={!noteText.trim() || addNoteMutation.isPending}>
                {addNoteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Ajouter la note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send Reminder Dialog */}
        <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Envoyer un rappel de paiement</DialogTitle>
              <DialogDescription>
                Un email de rappel sera envoyé au client avec les détails de la facture.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Client:</span>
                  <span className="font-medium">{selectedAccount?.client_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Email:</span>
                  <span className="font-medium">{selectedAccount?.client_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Facture:</span>
                  <span className="font-mono">{selectedAccount?.latest_invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Montant dû:</span>
                  <span className="font-bold text-red-500">
                    {selectedAccount?.latest_invoice_amount?.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Jours depuis échéance:</span>
                  <span className="font-medium">{selectedAccount?.days_since_suspension} jours</span>
                </div>
              </div>
              
              {selectedAccount?.recouvrement_reminder_sent_at && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <p className="text-sm text-amber-600">
                    Dernier rappel envoyé le {format(new Date(selectedAccount.recouvrement_reminder_sent_at), "d MMMM yyyy à HH:mm", { locale: fr })}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSendReminder} disabled={isSendingReminder}>
                {isSendingReminder && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Envoyer le rappel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mark Number Lost Dialog */}
        <Dialog open={numberLostDialogOpen} onOpenChange={setNumberLostDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-500">
                <AlertTriangle className="w-5 h-5" />
                Marquer le numéro comme perdu
              </DialogTitle>
              <DialogDescription>
                Cette action indique que le numéro de téléphone du client est irrécupérable après 90+ jours sans renouvellement.
                Un nouveau numéro sera requis pour toute réactivation future.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <p className="text-sm font-medium text-red-600 mb-2">⚠️ Attention</p>
                <p className="text-sm text-muted-foreground">
                  Cette action est irréversible. Le client sera informé qu'un nouveau numéro sera attribué lors de la réactivation.
                </p>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Client:</span>
                  <span className="font-medium">{selectedAccount?.client_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Compte:</span>
                  <span className="font-mono">{selectedAccount?.account_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Jours depuis échéance:</span>
                  <span className="font-bold text-red-500">{selectedAccount?.days_since_suspension} jours</span>
                </div>
              </div>

              <div>
                <Label>Raison / Notes</Label>
                <Textarea
                  value={numberLostReason}
                  onChange={(e) => setNumberLostReason(e.target.value)}
                  placeholder="Indiquer la raison..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNumberLostDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleMarkNumberLost} 
                disabled={!numberLostReason.trim() || markNumberLostMutation.isPending}
              >
                {markNumberLostMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirmer - Numéro perdu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminRecouvrement;
