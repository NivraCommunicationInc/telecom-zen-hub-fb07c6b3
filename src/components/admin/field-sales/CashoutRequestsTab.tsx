/**
 * CashoutRequestsTab - Manage commission withdrawal requests from field sales reps
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { adminClient as adminSupabase } from "@/integrations/backend/adminClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Loader2,
  AlertCircle,
  Mail,
  Banknote,
} from "lucide-react";

interface CashoutRequest {
  id: string;
  request_number: string | null;
  salesperson_id: string;
  salesperson_name?: string;
  amount: number;
  method: string;
  destination: string;
  status: string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export function CashoutRequestsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<CashoutRequest | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [action, setAction] = useState<"approve" | "reject" | "pay" | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch cashout requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ["field-sales-cashout-requests", statusFilter],
    queryFn: async () => {
      let query = adminSupabase
        .from("field_sales_cashout_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get salesperson names
      if (data && data.length > 0) {
        const salespersonIds = [...new Set(data.map(r => r.salesperson_id))];
        const { data: profiles } = await adminSupabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", salespersonIds);

        return data.map(request => ({
          ...request,
          salesperson_name: profiles?.find(p => p.user_id === request.salesperson_id)?.full_name || "—",
        })) as CashoutRequest[];
      }

      return data as CashoutRequest[];
    },
  });

  // Process request mutation
  const processRequestMutation = useMutation({
    mutationFn: async ({ 
      requestId, 
      newStatus, 
      note 
    }: { 
      requestId: string; 
      newStatus: string; 
      note?: string 
    }) => {
      const { data: { session } } = await adminSupabase.auth.getSession();
      
      const updateData: any = {
        status: newStatus,
        admin_note: note || null,
        reviewed_by: session?.user?.id,
        reviewed_at: new Date().toISOString(),
      };

      if (newStatus === "paid") {
        updateData.paid_at = new Date().toISOString();
      }

      const { error } = await adminSupabase
        .from("field_sales_cashout_requests")
        .update(updateData)
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Demande mise à jour" });
      queryClient.invalidateQueries({ queryKey: ["field-sales-cashout-requests"] });
      setActionDialogOpen(false);
      setSelectedRequest(null);
      setAction(null);
      setAdminNote("");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-400 border-0"><Clock className="w-3 h-3 mr-1" />En attente</Badge>;
      case "approved":
        return <Badge className="bg-blue-500/20 text-blue-400 border-0"><CheckCircle className="w-3 h-3 mr-1" />Approuvée</Badge>;
      case "paid":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-0"><DollarSign className="w-3 h-3 mr-1" />Payée</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejetée</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "interac":
        return <Mail className="h-4 w-4 text-orange-400" />;
      case "cheque":
        return <Banknote className="h-4 w-4 text-blue-400" />;
      case "cash":
        return <DollarSign className="h-4 w-4 text-emerald-400" />;
      default:
        return <Wallet className="h-4 w-4 text-slate-400" />;
    }
  };

  const handleAction = (request: CashoutRequest, actionType: "approve" | "reject" | "pay") => {
    setSelectedRequest(request);
    setAction(actionType);
    setActionDialogOpen(true);
  };

  const confirmAction = () => {
    if (!selectedRequest || !action) return;

    const statusMap = {
      approve: "approved",
      reject: "rejected",
      pay: "paid",
    };

    processRequestMutation.mutate({
      requestId: selectedRequest.id,
      newStatus: statusMap[action],
      note: adminNote,
    });
  };

  // Calculate stats
  const stats = {
    pending: requests?.filter(r => r.status === "pending").length || 0,
    pendingAmount: requests?.filter(r => r.status === "pending").reduce((sum, r) => sum + r.amount, 0) || 0,
    approved: requests?.filter(r => r.status === "approved").length || 0,
    approvedAmount: requests?.filter(r => r.status === "approved").reduce((sum, r) => sum + r.amount, 0) || 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-400" />
              <div>
                <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
                <p className="text-xs text-amber-400/70">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-amber-400" />
              <div>
                <p className="text-2xl font-bold text-amber-400">${stats.pendingAmount.toFixed(2)}</p>
                <p className="text-xs text-amber-400/70">À traiter</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-blue-400">{stats.approved}</p>
                <p className="text-xs text-blue-400/70">Approuvées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-blue-400">${stats.approvedAmount.toFixed(2)}</p>
                <p className="text-xs text-blue-400/70">À payer</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-orange-400" />
                Demandes de retrait
              </CardTitle>
              <CardDescription>Gérez les demandes de paiement des commissions</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-slate-900/50 border-slate-700">
                <SelectValue placeholder="Filtrer" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="approved">Approuvées</SelectItem>
                <SelectItem value="paid">Payées</SelectItem>
                <SelectItem value="rejected">Rejetées</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !requests || requests.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucune demande de retrait</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="text-slate-400">N° Demande</TableHead>
                  <TableHead className="text-slate-400">Représentant</TableHead>
                  <TableHead className="text-slate-400">Montant</TableHead>
                  <TableHead className="text-slate-400">Méthode</TableHead>
                  <TableHead className="text-slate-400">Statut</TableHead>
                  <TableHead className="text-slate-400">Date</TableHead>
                  <TableHead className="text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id} className="border-slate-700">
                    <TableCell className="font-mono text-white">
                      {request.request_number || request.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-white">
                      {request.salesperson_name}
                    </TableCell>
                    <TableCell className="font-bold text-emerald-400">
                      ${request.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getMethodIcon(request.method)}
                        <span className="text-slate-300 capitalize">{request.method}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(request.status)}
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {format(new Date(request.created_at), "dd MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {request.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAction(request, "approve")}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAction(request, "reject")}
                              className="text-red-400 hover:text-red-300"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {request.status === "approved" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(request, "pay")}
                            className="border-emerald-500 text-emerald-400"
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Marquer payé
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              {action === "approve" && "Approuver la demande"}
              {action === "reject" && "Rejeter la demande"}
              {action === "pay" && "Marquer comme payée"}
            </DialogTitle>
            <DialogDescription>
              {selectedRequest && (
                <span>
                  Demande de {selectedRequest.salesperson_name} pour ${selectedRequest.amount.toFixed(2)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedRequest && (
              <div className="p-4 bg-slate-800 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Montant</span>
                  <span className="text-white font-bold">${selectedRequest.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Méthode</span>
                  <span className="text-white capitalize">{selectedRequest.method}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Destination</span>
                  <span className="text-white">{selectedRequest.destination}</span>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm text-slate-400 mb-2 block">Note administrative (optionnel)</label>
              <Textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Ajouter une note..."
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialogOpen(false)}
              className="border-slate-700"
            >
              Annuler
            </Button>
            <Button
              onClick={confirmAction}
              disabled={processRequestMutation.isPending}
              className={
                action === "reject" 
                  ? "bg-red-500 hover:bg-red-400" 
                  : "bg-emerald-500 hover:bg-emerald-400"
              }
            >
              {processRequestMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {action === "approve" && "Approuver"}
              {action === "reject" && "Rejeter"}
              {action === "pay" && "Confirmer paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
