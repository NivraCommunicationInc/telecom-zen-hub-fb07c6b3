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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Ban
} from "lucide-react";
import { Link } from "react-router-dom";
import { calculateDaysSinceSuspension, getSuspensionBucket, isNumberAtRisk } from "@/lib/billingCycleUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface RecoveryAccount {
  id: string;
  client_id: string;
  account_number: string;
  account_name: string | null;
  billing_cycle_day: number | null;
  status: string | null;
  created_at: string;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [daysBucketFilter, setDaysBucketFilter] = useState<string>("all");
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<RecoveryAccount | null>(null);
  const [noteText, setNoteText] = useState("");

  // Fetch suspended/overdue accounts
  const { data: recoveryAccounts, isLoading, refetch } = useQuery({
    queryKey: ["recovery-accounts", statusFilter],
    queryFn: async () => {
      // Get accounts with suspended status or missing billing cycle day
      const { data: accounts, error: accountsError } = await supabase
        .from("accounts")
        .select(`
          id,
          client_id,
          account_number,
          account_name,
          billing_cycle_day,
          status,
          created_at
        `)
        .or("status.eq.suspended,status.eq.overdue,status.eq.expired");

      if (accountsError) throw accountsError;

      // Fetch client profiles for names
      const clientIds = [...new Set(accounts?.map(a => a.client_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", clientIds);

      // Fetch latest unpaid invoices for these accounts
      const accountIds = accounts?.map(a => a.id) || [];
      const { data: invoices } = await supabase
        .from("monthly_invoices")
        .select("id, invoice_number, total, due_date, client_id, status")
        .in("client_id", clientIds)
        .in("status", ["issued", "overdue", "partial"])
        .order("due_date", { ascending: false });

      // Also check billing table for invoices
      const { data: billingInvoices } = await supabase
        .from("billing")
        .select("id, invoice_number, amount, due_date, user_id, status, payment_reference")
        .in("user_id", clientIds)
        .in("status", ["pending", "overdue", "partial"])
        .order("due_date", { ascending: false });

      // Map and enrich accounts
      const enrichedAccounts: RecoveryAccount[] = (accounts || []).map(account => {
        const profile = profiles?.find(p => p.user_id === account.client_id);
        const latestInvoice = invoices?.find(i => i.client_id === account.client_id) ||
          billingInvoices?.find(i => i.user_id === account.client_id);
        
        // Calculate days since suspension based on invoice due date
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
          latest_invoice_amount: (latestInvoice as any)?.total || (latestInvoice as any)?.amount || 0,
          latest_invoice_due_date: latestInvoice?.due_date,
          payment_method: (latestInvoice as any)?.payment_reference?.includes("etransfer") ? "etransfer" : "credit_card",
          days_since_suspension: daysSince,
        };
      });

      return enrichedAccounts;
    },
  });

  // Filter accounts
  const filteredAccounts = recoveryAccounts?.filter(account => {
    // Search filter
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

    // Status filter
    if (statusFilter !== "all" && account.status !== statusFilter) {
      return false;
    }

    // Payment method filter
    if (paymentMethodFilter !== "all" && account.payment_method !== paymentMethodFilter) {
      return false;
    }

    // Days bucket filter
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
    totalOwed: recoveryAccounts?.reduce((sum, a) => sum + (a.latest_invoice_amount || 0), 0) || 0,
  };

  const handleAddNote = async () => {
    if (!selectedAccount || !noteText.trim()) return;

    try {
      const { error } = await supabase
        .from("client_internal_notes")
        .insert({
          client_id: selectedAccount.client_id,
          body: noteText,
          note_type: "recouvrement",
          created_by_role: "admin",
          created_by_user_id: (await supabase.auth.getUser()).data.user?.id || "",
          created_by_name: "Admin",
        });

      if (error) throw error;
      toast.success("Note ajoutée avec succès");
      setNoteDialogOpen(false);
      setNoteText("");
      setSelectedAccount(null);
    } catch (error) {
      toast.error("Erreur lors de l'ajout de la note");
    }
  };

  const getStatusBadge = (status: string | null, daysSince: number) => {
    if (isNumberAtRisk(daysSince)) {
      return <Badge className="bg-red-600/20 text-red-600">Numéro à risque (90+ jours)</Badge>;
    }
    
    switch (status) {
      case "suspended":
        return <Badge className="bg-red-500/20 text-red-500">Service en suspension</Badge>;
      case "overdue":
        return <Badge className="bg-amber-500/20 text-amber-500">Paiement en retard</Badge>;
      case "expired":
        return <Badge className="bg-red-600/20 text-red-600">Expiré</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-500">{status || "—"}</Badge>;
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

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total comptes</p>
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
                  <p className="text-xs text-muted-foreground">Numéros à risque</p>
                  <p className="text-2xl font-bold text-red-600">{stats.atRisk}</p>
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
                  <p className="text-xs text-muted-foreground">Montant total dû</p>
                  <p className="text-2xl font-bold text-emerald-500">
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
                </SelectContent>
              </Select>

              <Select value="all" onValueChange={setPaymentMethodFilter}>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Compte</TableHead>
                    <TableHead>Bill Cycle</TableHead>
                    <TableHead>Facture impayée</TableHead>
                    <TableHead>Montant dû</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Jours depuis</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id} className={isNumberAtRisk(account.days_since_suspension || 0) ? "bg-red-500/5" : ""}>
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
                        {getStatusBadge(account.status, account.days_since_suspension || 0)}
                      </TableCell>
                      <TableCell>
                        {getDaysBadge(account.days_since_suspension || 0)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Link to={`/admin/clients?id=${account.client_id}`}>
                            <Button variant="ghost" size="sm" title="Voir profil client">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          {account.latest_invoice_id && (
                            <Link to={`/admin/billing?invoice=${account.latest_invoice_id}`}>
                              <Button variant="ghost" size="sm" title="Voir facture">
                                <FileText className="w-4 h-4" />
                              </Button>
                            </Link>
                          )}
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
                          <Button variant="ghost" size="sm" title="Envoyer rappel" disabled>
                            <Mail className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Note Dialog */}
        <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une note de recouvrement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Client</Label>
                <p className="text-sm text-muted-foreground">{selectedAccount?.client_name}</p>
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
              <Button onClick={handleAddNote} disabled={!noteText.trim()}>
                Ajouter la note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminRecouvrement;
