import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ArrowLeft, 
  Search, 
  Loader2, 
  TrendingUp, 
  RefreshCw, 
  AlertCircle, 
  AlertTriangle,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  DollarSign
} from "lucide-react";
import { adminClient } from "@/integrations/backend/adminClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Label } from "@/components/ui/label";

type AttributionStatus = "pending" | "approved" | "rejected" | "hold" | "disputed";

interface Attribution {
  id: string;
  applied_at: string;
  customer_email: string | null;
  customer_discount_amount: number;
  status: string;
  fraud_flag_level: string | null;
  fraud_notes: string | null;
  influencer_id: string;
  referral_code_id: string;
  order_id: string | null;
  referral_codes: {
    code: string;
    influencers: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string;
    } | null;
  } | null;
}

const AdminReferralAttributions = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Action dialog state
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: AttributionStatus | null;
    attribution: Attribution | null;
  }>({ open: false, action: null, attribution: null });
  const [actionNote, setActionNote] = useState("");
  const [commissionAmount, setCommissionAmount] = useState("");

  const { data: attributions, isLoading, error, refetch } = useQuery({
    queryKey: ["referral-attributions", searchTerm, statusFilter],
    queryFn: async () => {
      let query = adminClient
        .from("referral_attributions")
        .select(`
          *,
          referral_codes(code, influencers(id, first_name, last_name, email))
        `)
        .order("applied_at", { ascending: false });

      if (searchTerm) {
        query = query.ilike("customer_email", `%${searchTerm}%`);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Attribution[];
    },
  });

  // Get referral program settings for commission calculation
  const { data: settings } = useQuery({
    queryKey: ["referral-program-settings"],
    queryFn: async () => {
      const { data, error } = await adminClient
        .from("referral_program_settings")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Mutation to update attribution status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ 
      attributionId, 
      newStatus, 
      note,
      commission
    }: { 
      attributionId: string; 
      newStatus: AttributionStatus; 
      note: string;
      commission?: number;
    }) => {
      // F33-1/F33-14 — All writes on referral_attributions AND commission_ledger_entries
      // are consolidated in the server-side Edge Function. The unique index on
      // (attribution_id, type) guarantees no double commission on approve→reject→approve.
      const { error } = await adminClient.functions.invoke("admin-referrals-manage", {
        body: {
          action: "attribution.decide",
          attribution_id: attributionId,
          decision: newStatus,
          note,
          commission: commission ?? 0,
        },
      });
      if (error) throw error;
      return { attributionId, newStatus };
    },
    onSuccess: (_, variables) => {
      const statusLabels: Record<AttributionStatus, string> = {
        approved: "approuvé",
        rejected: "rejeté",
        hold: "mis en attente",
        disputed: "contesté",
        pending: "en attente",
      };
      toast.success(`Parrainage ${statusLabels[variables.newStatus]}`);
      queryClient.invalidateQueries({ queryKey: ["referral-attributions"] });
      queryClient.invalidateQueries({ queryKey: ["commission-ledger"] });
      setActionDialog({ open: false, action: null, attribution: null });
      setActionNote("");
      setCommissionAmount("");
    },
    onError: (error: any) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const openActionDialog = (action: AttributionStatus, attribution: Attribution) => {
    // Commission formula: Influencer gets 50% of what client paid after discount
    // Since discount = 50% of services, client paid = discount amount
    // So influencer commission = 50% of client paid = 50% of discount amount
    const customerDiscount = Number(attribution.customer_discount_amount) || 0;
    const defaultCommission = customerDiscount / 2; // 50% of what client paid
    setCommissionAmount(defaultCommission.toFixed(2));
    setActionNote("");
    setActionDialog({ open: true, action, attribution });
  };

  const handleConfirmAction = () => {
    if (!actionDialog.action || !actionDialog.attribution) return;

    updateStatusMutation.mutate({
      attributionId: actionDialog.attribution.id,
      newStatus: actionDialog.action,
      note: actionNote,
      commission: actionDialog.action === "approved" ? parseFloat(commissionAmount) || 0 : undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">En attente</Badge>;
      case "approved":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approuvé</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejeté</Badge>;
      case "hold":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">En révision</Badge>;
      case "disputed":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Contesté</Badge>;
      case "paid":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Payé</Badge>;
      default:
        return <Badge variant="outline">{status || "—"}</Badge>;
    }
  };

  const getFraudBadge = (level: string | null) => {
    if (!level || level === "none") return null;
    if (level === "low") {
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500/30">Risque faible</Badge>;
    }
    if (level === "medium") {
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Risque moyen</Badge>;
    }
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Risque élevé</Badge>;
  };

  const getActionDialogContent = () => {
    const { action, attribution } = actionDialog;
    if (!action || !attribution) return null;

    const configs: Record<AttributionStatus, { title: string; description: string; color: string; showCommission: boolean }> = {
      approved: {
        title: "Approuver ce parrainage",
        description: "La commission sera créditée au compte de l'influenceur et disponible pour retrait.",
        color: "text-green-500",
        showCommission: true,
      },
      rejected: {
        title: "Rejeter ce parrainage",
        description: "Aucune commission ne sera accordée. Si une commission avait déjà été créditée, elle sera annulée.",
        color: "text-red-500",
        showCommission: false,
      },
      hold: {
        title: "Mettre en attente",
        description: "Le parrainage sera mis en attente pour révision ultérieure.",
        color: "text-orange-500",
        showCommission: false,
      },
      disputed: {
        title: "Marquer comme contesté",
        description: "Le parrainage sera marqué comme contesté. Toute commission précédente sera annulée.",
        color: "text-purple-500",
        showCommission: false,
      },
      pending: {
        title: "Remettre en attente",
        description: "Le parrainage sera remis en statut en attente.",
        color: "text-yellow-500",
        showCommission: false,
      },
    };

    const config = configs[action];

    return (
      <>
        <DialogHeader>
          <DialogTitle className={config.color}>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Client:</span>
              <p className="font-medium">{attribution.customer_email || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Code:</span>
              <p className="font-mono font-medium">{attribution.referral_codes?.code || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Influenceur:</span>
              <p className="font-medium">
                {attribution.referral_codes?.influencers 
                  ? `${attribution.referral_codes.influencers.first_name || ""} ${attribution.referral_codes.influencers.last_name || ""}`.trim() || attribution.referral_codes.influencers.email
                  : "—"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Rabais client:</span>
              <p className="font-medium">${Number(attribution.customer_discount_amount || 0).toFixed(2)}</p>
            </div>
          </div>

          {config.showCommission && (
            <div className="space-y-2">
              <Label htmlFor="commission">Montant de la commission (CAD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="commission"
                  type="number"
                  step="0.01"
                  min="0"
                  value={commissionAmount}
                  onChange={(e) => setCommissionAmount(e.target.value)}
                  className="pl-9"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Rabais client: ${(Number(attribution.customer_discount_amount || 0)).toFixed(2)} → 
                Commission (50% du montant payé): ${(Number(attribution.customer_discount_amount || 0) / 2).toFixed(2)}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="note">Note (optionnelle)</Label>
            <Textarea
              id="note"
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder="Ajouter une note..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setActionDialog({ open: false, action: null, attribution: null })}
          >
            Annuler
          </Button>
          <Button 
            onClick={handleConfirmAction}
            disabled={updateStatusMutation.isPending}
            className={action === "approved" ? "bg-green-600 hover:bg-green-700" : 
                       action === "rejected" ? "bg-red-600 hover:bg-red-700" :
                       action === "disputed" ? "bg-purple-600 hover:bg-purple-700" :
                       ""}
          >
            {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmer
          </Button>
        </DialogFooter>
      </>
    );
  };

  if (error) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/admin/referrals">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Parrainages</h1>
            </div>
          </div>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Erreur de chargement: {(error as Error).message}</span>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Réessayer
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/referrals">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Parrainages</h1>
            <p className="text-muted-foreground">
              Liste des attributions de parrainage - Cliquez sur le menu ⋯ pour approuver, rejeter, mettre en attente ou contester
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {attributions && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-yellow-500/10 border-yellow-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-yellow-500">
                  {attributions.filter(a => a.status === "pending").length}
                </p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </CardContent>
            </Card>
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-green-500">
                  {attributions.filter(a => a.status === "approved").length}
                </p>
                <p className="text-xs text-muted-foreground">Approuvés</p>
              </CardContent>
            </Card>
            <Card className="bg-red-500/10 border-red-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-500">
                  {attributions.filter(a => a.status === "rejected").length}
                </p>
                <p className="text-xs text-muted-foreground">Rejetés</p>
              </CardContent>
            </Card>
            <Card className="bg-orange-500/10 border-orange-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-orange-500">
                  {attributions.filter(a => a.status === "hold").length}
                </p>
                <p className="text-xs text-muted-foreground">En révision</p>
              </CardContent>
            </Card>
            <Card className="bg-purple-500/10 border-purple-500/30">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-purple-500">
                  {attributions.filter(a => a.status === "disputed").length}
                </p>
                <p className="text-xs text-muted-foreground">Contestés</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par email client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="approved">Approuvés</SelectItem>
                  <SelectItem value="rejected">Rejetés</SelectItem>
                  <SelectItem value="hold">En révision</SelectItem>
                  <SelectItem value="disputed">Contestés</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Influenceur</TableHead>
                  <TableHead className="text-right">Rabais</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Fraude</TableHead>
                  <TableHead className="text-right w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : !attributions || attributions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <TrendingUp className="w-10 h-10 opacity-50" />
                        <p>Aucun parrainage trouvé</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  attributions.map((attr) => {
                    const influencer = attr.referral_codes?.influencers;
                    return (
                      <TableRow key={attr.id}>
                        <TableCell className="text-muted-foreground">
                          {attr.applied_at
                            ? new Date(attr.applied_at).toLocaleDateString("fr-CA")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{attr.customer_email || "—"}</span>
                        </TableCell>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                            {attr.referral_codes?.code || "—"}
                          </code>
                        </TableCell>
                        <TableCell>
                          {influencer ? (
                            <Link 
                              to={`/admin/referrals/influencers/${influencer.id}`}
                              className="hover:text-primary"
                            >
                              {influencer.first_name || "—"} {influencer.last_name || ""}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${Number(attr.customer_discount_amount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>{getStatusBadge(attr.status)}</TableCell>
                        <TableCell>
                          {attr.fraud_flag_level && attr.fraud_flag_level !== "none" ? (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4 text-orange-500" />
                              {getFraudBadge(attr.fraud_flag_level)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Aucun</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {attr.status !== "approved" && (
                                <DropdownMenuItem 
                                  onClick={() => openActionDialog("approved", attr)}
                                  className="text-green-600"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approuver
                                </DropdownMenuItem>
                              )}
                              {attr.status !== "rejected" && (
                                <DropdownMenuItem 
                                  onClick={() => openActionDialog("rejected", attr)}
                                  className="text-red-600"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Rejeter
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {attr.status !== "hold" && (
                                <DropdownMenuItem 
                                  onClick={() => openActionDialog("hold", attr)}
                                  className="text-orange-600"
                                >
                                  <Clock className="w-4 h-4 mr-2" />
                                  Mettre en attente
                                </DropdownMenuItem>
                              )}
                              {attr.status !== "disputed" && (
                                <DropdownMenuItem 
                                  onClick={() => openActionDialog("disputed", attr)}
                                  className="text-purple-600"
                                >
                                  <Ban className="w-4 h-4 mr-2" />
                                  Contester
                                </DropdownMenuItem>
                              )}
                              {attr.status !== "pending" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => openActionDialog("pending", attr)}
                                  >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Remettre en attente
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Action Dialog */}
      <Dialog 
        open={actionDialog.open} 
        onOpenChange={(open) => !open && setActionDialog({ open: false, action: null, attribution: null })}
      >
        <DialogContent>
          {getActionDialogContent()}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminReferralAttributions;