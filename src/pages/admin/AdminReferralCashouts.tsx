import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  DollarSign,
  Loader2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const AdminReferralCashouts = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCashout, setSelectedCashout] = useState<any>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | "pay" | null>(null);
  const [adminNote, setAdminNote] = useState("");

  // Fetch cashout requests
  const { data: cashouts, isLoading } = useQuery({
    queryKey: ["cashout-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashout_requests")
        .select(`
          *,
          influencers(first_name, last_name, email, payout_email)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Process cashout mutation
  const processCashout = useMutation({
    mutationFn: async ({
      cashoutId,
      action,
      note,
    }: {
      cashoutId: string;
      action: "approve" | "reject" | "pay";
      note: string;
    }) => {
      const cashout = cashouts?.find((c) => c.id === cashoutId);
      if (!cashout) throw new Error("Cashout not found");

      const adminUserId = user?.id;
      if (!adminUserId) {
        throw new Error("Session admin manquante. Veuillez vous reconnecter.");
      }

      const updateCashoutStatus = async (nextStatus: "approved" | "rejected" | "paid") => {
        const { data, error } = await supabase
          .from("cashout_requests")
          .update({
            status: nextStatus,
            admin_note: nextStatus === "rejected" ? note : note || null,
            reviewed_by: adminUserId,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", cashoutId)
          .select("id,status")
          .single();

        if (error) throw error;

        // RLS can result in "0 rows updated" with no error unless we force .single()
        if (!data || data.status !== nextStatus) {
          throw new Error("La mise à jour n'a pas été enregistrée (permissions/session).");
        }
      };

      if (action === "approve") {
        await updateCashoutStatus("approved");
      } else if (action === "reject") {
        await updateCashoutStatus("rejected");
      } else if (action === "pay") {
        // Update cashout status
        await updateCashoutStatus("paid");

        // Create payout record
        const { error: payoutError } = await supabase.from("influencer_payouts").insert({
          influencer_id: cashout.influencer_id,
          cashout_request_id: cashoutId,
          amount: cashout.amount,
          method: cashout.method,
          paid_by: adminUserId,
        });
        if (payoutError) throw payoutError;

        // Create ledger debit entry
        const { error: ledgerError } = await supabase.from("commission_ledger_entries").insert({
          influencer_id: cashout.influencer_id,
          type: "payout_debit",
          amount: -Math.abs(Number(cashout.amount)),
          status: "paid",
          notes: `Paiement ${cashout.request_number}`,
          created_by: adminUserId,
        });
        if (ledgerError) throw ledgerError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cashout-requests"] });
      setSelectedCashout(null);
      setActionType(null);
      setAdminNote("");
      
      const messages = {
        approve: "Demande approuvée",
        reject: "Demande rejetée",
        pay: "Paiement effectué",
      };
      toast.success(messages[variables.action]);
    },
    onError: (error: Error) => {
      toast.error(`Erreur: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "requested":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">En attente</Badge>;
      case "under_review":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">En révision</Badge>;
      case "approved":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approuvé</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejeté</Badge>;
      case "paid":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">Payé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCashouts = cashouts?.filter((c) => c.status === "requested" || c.status === "under_review");
  const approvedCashouts = cashouts?.filter((c) => c.status === "approved");
  const completedCashouts = cashouts?.filter((c) => c.status === "paid" || c.status === "rejected");

  const renderTable = (items: typeof cashouts, showActions = false) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Numéro</TableHead>
          <TableHead>Influenceur</TableHead>
          <TableHead>Montant</TableHead>
          <TableHead>Méthode</TableHead>
          <TableHead>Destination</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead>Date</TableHead>
          {showActions && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items?.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showActions ? 8 : 7} className="text-center py-8 text-muted-foreground">
              Aucune demande
            </TableCell>
          </TableRow>
        ) : (
          items?.map((cashout) => (
            <TableRow key={cashout.id}>
              <TableCell className="font-mono text-sm">{cashout.request_number}</TableCell>
              <TableCell>
                <Link 
                  to={`/admin/referrals/influencers/${cashout.influencer_id}`}
                  className="hover:text-primary"
                >
                  <div>
                    <p className="font-medium">
                      {cashout.influencers?.first_name} {cashout.influencers?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{cashout.influencers?.email}</p>
                  </div>
                </Link>
              </TableCell>
              <TableCell className="font-bold text-lg">${Number(cashout.amount).toFixed(2)}</TableCell>
              <TableCell className="capitalize">{cashout.method}</TableCell>
              <TableCell className="text-sm max-w-[200px] truncate">{cashout.destination}</TableCell>
              <TableCell>{getStatusBadge(cashout.status)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(cashout.created_at).toLocaleDateString("fr-CA")}
              </TableCell>
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {cashout.status === "requested" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-500 border-green-500/30 hover:bg-green-500/10"
                          onClick={() => {
                            setSelectedCashout(cashout);
                            setActionType("approve");
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                          onClick={() => {
                            setSelectedCashout(cashout);
                            setActionType("reject");
                          }}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rejeter
                        </Button>
                      </>
                    )}
                    {cashout.status === "approved" && (
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={() => {
                          setSelectedCashout(cashout);
                          setActionType("pay");
                        }}
                      >
                        <DollarSign className="w-4 h-4 mr-1" />
                        Marquer payé
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

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
            <h1 className="text-2xl font-bold text-foreground">Demandes de Retrait</h1>
            <p className="text-muted-foreground">Gérez les demandes de paiement des influenceurs</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4 flex items-center gap-4">
              <Clock className="w-10 h-10 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold">{pendingCashouts?.length || 0}</p>
                <p className="text-xs text-muted-foreground">
                  ${pendingCashouts?.reduce((s, c) => s + Number(c.amount), 0).toFixed(2) || "0.00"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-4 flex items-center gap-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Approuvés</p>
                <p className="text-2xl font-bold">{approvedCashouts?.length || 0}</p>
                <p className="text-xs text-muted-foreground">
                  ${approvedCashouts?.reduce((s, c) => s + Number(c.amount), 0).toFixed(2) || "0.00"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardContent className="p-4 flex items-center gap-4">
              <DollarSign className="w-10 h-10 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total payé</p>
                <p className="text-2xl font-bold">
                  ${completedCashouts
                    ?.filter((c) => c.status === "paid")
                    .reduce((s, c) => s + Number(c.amount), 0)
                    .toFixed(2) || "0.00"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <AlertCircle className="w-4 h-4" />
              En attente ({pendingCashouts?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              À payer ({approvedCashouts?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Historique ({completedCashouts?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : (
                  renderTable(pendingCashouts, true)
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approved">
            <Card>
              <CardContent className="p-0">
                {renderTable(approvedCashouts, true)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed">
            <Card>
              <CardContent className="p-0">
                {renderTable(completedCashouts, false)}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "Approuver la demande"}
              {actionType === "reject" && "Rejeter la demande"}
              {actionType === "pay" && "Confirmer le paiement"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve" &&
                `Approuver le retrait de $${Number(selectedCashout?.amount).toFixed(2)} pour ${selectedCashout?.influencers?.first_name} ${selectedCashout?.influencers?.last_name}?`}
              {actionType === "reject" &&
                "Veuillez fournir une raison pour le rejet."}
              {actionType === "pay" &&
                `Confirmer que le paiement de $${Number(selectedCashout?.amount).toFixed(2)} a été effectué via ${selectedCashout?.method}?`}
            </DialogDescription>
          </DialogHeader>

          {selectedCashout && (
            <div className="py-4 space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Numéro:</span>
                  <span className="font-mono">{selectedCashout.request_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant:</span>
                  <span className="font-bold">${Number(selectedCashout.amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Méthode:</span>
                  <span className="capitalize">{selectedCashout.method}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Destination:</span>
                  <span>{selectedCashout.destination}</span>
                </div>
              </div>

              {(actionType === "reject" || actionType === "pay") && (
                <div className="space-y-2">
                  <Label>
                    {actionType === "reject" ? "Raison du rejet *" : "Notes (optionnel)"}
                  </Label>
                  <Textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder={
                      actionType === "reject"
                        ? "Expliquez pourquoi la demande est rejetée..."
                        : "Référence de transaction, notes..."
                    }
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Annuler
            </Button>
            <Button
              onClick={() =>
                processCashout.mutate({
                  cashoutId: selectedCashout.id,
                  action: actionType!,
                  note: adminNote,
                })
              }
              disabled={
                processCashout.isPending ||
                (actionType === "reject" && !adminNote.trim())
              }
              className={
                actionType === "reject"
                  ? "bg-red-600 hover:bg-red-700"
                  : actionType === "pay"
                  ? "bg-purple-600 hover:bg-purple-700"
                  : ""
              }
            >
              {processCashout.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {actionType === "approve" && "Approuver"}
              {actionType === "reject" && "Rejeter"}
              {actionType === "pay" && "Confirmer le paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminReferralCashouts;
