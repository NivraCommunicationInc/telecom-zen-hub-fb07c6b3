import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { 
  AlertTriangle, Search, ArrowLeft, Clock, CheckCircle, 
  XCircle, RefreshCw, MessageSquare, Loader2, Filter, 
  DollarSign, User, FileText, Eye
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useAuth } from "@/hooks/useAuth";

type DisputeStatus = "submitted" | "under_review" | "awaiting_client" | "resolved_approved" | "resolved_rejected";
type ReasonCode = "duplicate_charge" | "incorrect_amount" | "service_not_received" | "unauthorized" | "fraud" | "other";

const reasonCodeLabels: Record<ReasonCode, string> = {
  duplicate_charge: "Frais en double",
  incorrect_amount: "Montant incorrect",
  service_not_received: "Service non reçu",
  unauthorized: "Paiement non autorisé",
  fraud: "Fraude suspectée",
  other: "Autre raison",
};

const statusConfig: Record<DisputeStatus, { label: string; color: string; icon: any }> = {
  submitted: { label: "Soumise", color: "bg-amber-500/20 text-amber-500", icon: Clock },
  under_review: { label: "En examen", color: "bg-blue-500/20 text-blue-500", icon: RefreshCw },
  awaiting_client: { label: "Info requise", color: "bg-purple-500/20 text-purple-500", icon: AlertTriangle },
  resolved_approved: { label: "Approuvée", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle },
  resolved_rejected: { label: "Rejetée", color: "bg-red-500/20 text-red-500", icon: XCircle },
};

const AdminPaymentDisputes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const { user } = useAuth();
  
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("details");
  
  const [updateData, setUpdateData] = useState({
    public_message: "",
    staff_notes: "",
    resolution_notes: "",
    rejection_reason: "",
  });
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [requestInfoDialogOpen, setRequestInfoDialogOpen] = useState(false);

  // Fetch all disputes with client/payment info
  const { data: disputes, isLoading, refetch } = useQuery({
    queryKey: ["admin-payment-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_disputes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((d: any) => d.user_id))];
        const paymentIds = [...new Set(data.map((d: any) => d.payment_id))];
        
        const [profilesRes, paymentsRes] = await Promise.all([
          supabase.from("profiles").select("user_id, email, full_name, phone, client_number").in("user_id", userIds),
          supabase.from("billing_invoices").select("id, invoice_number, total, status, payment_method, created_at").in("id", paymentIds),
        ]);

        return data.map((dispute: any) => ({
          ...dispute,
          profile: profilesRes.data?.find((p: any) => p.user_id === dispute.user_id) || null,
          payment: paymentsRes.data?.find((p: any) => p.id === dispute.payment_id) || null,
        }));
      }
      return data || [];
    },
  });

  const filteredDisputes = useMemo(() => {
    if (!disputes) return [];
    return disputes.filter((d: any) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches = 
          d.dispute_number?.toLowerCase().includes(q) ||
          d.profile?.full_name?.toLowerCase().includes(q) ||
          d.profile?.email?.toLowerCase().includes(q) ||
          d.profile?.client_number?.toLowerCase().includes(q) ||
          d.payment?.invoice_number?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [disputes, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    if (!disputes) return {};
    const counts: Record<string, number> = { total: disputes.length };
    Object.keys(statusConfig).forEach(status => {
      counts[status] = disputes.filter((d: any) => d.status === status).length;
    });
    return counts;
  }, [disputes]);

  const updateMutation = useMutation({
    mutationFn: async (updates: { id: string; [key: string]: any }) => {
      const { id, ...updateFields } = updates;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user?.id)
        .single();

      updateFields.updated_at = new Date().toISOString();
      updateFields.processed_by_id = user?.id;
      updateFields.processed_by_name = profile?.full_name || user?.email;
      updateFields.processed_at = new Date().toISOString();

      const { error } = await supabase
        .from("payment_disputes")
        .update(updateFields)
        .eq("id", id);
      if (error) throw error;
      return { id, ...updateFields };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-payment-disputes"] });
      logActivity("update", "payment_dispute", data.id, { status: data.status });
      toast({ title: "Contestation mise à jour" });
      if (selectedDispute?.id === data.id) {
        setSelectedDispute((prev: any) => ({ ...prev, ...data }));
      }
      setRejectDialogOpen(false);
      setApproveDialogOpen(false);
      setRequestInfoDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour", variant: "destructive" });
    },
  });

  const handleSetUnderReview = () => {
    updateMutation.mutate({
      id: selectedDispute.id,
      status: "under_review",
    });
  };

  const handleRequestInfo = () => {
    if (!updateData.public_message.trim()) {
      toast({ title: "Message requis", description: "Veuillez expliquer l'information requise", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: selectedDispute.id,
      status: "awaiting_client",
      public_message: updateData.public_message,
    });
  };

  const handleApprove = () => {
    if (!updateData.resolution_notes.trim()) {
      toast({ title: "Notes requises", description: "Veuillez expliquer la résolution", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: selectedDispute.id,
      status: "resolved_approved",
      resolution_notes: updateData.resolution_notes,
    });
  };

  const handleReject = () => {
    if (!updateData.rejection_reason.trim()) {
      toast({ title: "Raison requise", description: "Veuillez expliquer la raison du rejet", variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      id: selectedDispute.id,
      status: "resolved_rejected",
      rejection_reason: updateData.rejection_reason,
    });
  };

  const handleSaveNotes = () => {
    updateMutation.mutate({
      id: selectedDispute.id,
      staff_notes: updateData.staff_notes,
    });
  };

  const handleSelectDispute = (dispute: any) => {
    setSelectedDispute(dispute);
    setUpdateData({
      public_message: dispute.public_message || "",
      staff_notes: dispute.staff_notes || "",
      resolution_notes: dispute.resolution_notes || "",
      rejection_reason: dispute.rejection_reason || "",
    });
    setActiveTab("details");
  };

  // Detail View
  if (selectedDispute) {
    const statusInfo = statusConfig[selectedDispute.status as DisputeStatus] || statusConfig.submitted;
    const StatusIcon = statusInfo.icon;
    const isResolved = selectedDispute.status?.startsWith("resolved");

    return (
      <AdminLayout>
        <div className="space-y-6" data-testid="admin-dispute-detail">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setSelectedDispute(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à la liste
            </Button>
            <Badge variant="outline" className="font-mono">
              {selectedDispute.dispute_number}
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      Contestation de paiement
                    </CardTitle>
                    <Badge className={statusInfo.color}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusInfo.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="w-full grid grid-cols-3">
                      <TabsTrigger value="details">Détails</TabsTrigger>
                      <TabsTrigger value="actions">Actions</TabsTrigger>
                      <TabsTrigger value="notes">Notes internes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="space-y-4 pt-4">
                      {/* Payment Info */}
                      <div className="p-4 bg-accent/50 rounded-lg">
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <DollarSign className="w-4 h-4" />
                          Paiement contesté
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label className="text-muted-foreground text-xs">Facture</Label>
                            <p className="font-mono">{selectedDispute.payment?.invoice_number || "-"}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Montant</Label>
                            <p className="font-medium">{Number(selectedDispute.payment?.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Méthode</Label>
                            <p>{selectedDispute.payment?.payment_method_type || "-"}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground text-xs">Statut paiement</Label>
                            <p>{selectedDispute.payment?.status || "-"}</p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Reason */}
                      <div>
                        <Label className="text-muted-foreground text-xs">Raison de contestation</Label>
                        <p className="font-medium">{reasonCodeLabels[selectedDispute.reason_code as ReasonCode]}</p>
                        {selectedDispute.client_message && (
                          <p className="text-sm text-muted-foreground mt-2 p-3 bg-accent/50 rounded-lg">
                            "{selectedDispute.client_message}"
                          </p>
                        )}
                      </div>

                      <Separator />

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground text-xs">Date de soumission</Label>
                          <p className="font-medium">
                            {format(new Date(selectedDispute.created_at), "d MMMM yyyy HH:mm", { locale: fr })}
                          </p>
                        </div>
                        {selectedDispute.processed_at && (
                          <div>
                            <Label className="text-muted-foreground text-xs">Traité le</Label>
                            <p className="font-medium">
                              {format(new Date(selectedDispute.processed_at), "d MMMM yyyy HH:mm", { locale: fr })}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Resolution/Rejection Info */}
                      {selectedDispute.resolution_notes && (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                          <h4 className="font-medium text-emerald-500 mb-2">Résolution</h4>
                          <p className="text-sm">{selectedDispute.resolution_notes}</p>
                        </div>
                      )}
                      {selectedDispute.rejection_reason && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                          <h4 className="font-medium text-red-500 mb-2">Raison du rejet</h4>
                          <p className="text-sm">{selectedDispute.rejection_reason}</p>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="actions" className="space-y-4 pt-4">
                      {isResolved ? (
                        <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                          Cette contestation est résolue et ne peut plus être modifiée.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Label>Actions disponibles</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Button 
                              variant="outline" 
                              onClick={handleSetUnderReview}
                              disabled={updateMutation.isPending || selectedDispute.status === "under_review"}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              En examen
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => setRequestInfoDialogOpen(true)}
                              disabled={updateMutation.isPending}
                            >
                              <AlertTriangle className="w-4 h-4 mr-2" />
                              Demander info
                            </Button>
                            <Button 
                              variant="outline" 
                              className="border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
                              onClick={() => setApproveDialogOpen(true)}
                              disabled={updateMutation.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Approuver
                            </Button>
                            <Button 
                              variant="outline" 
                              className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                              onClick={() => setRejectDialogOpen(true)}
                              disabled={updateMutation.isPending}
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Rejeter
                            </Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="notes" className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Notes internes (non visibles par le client)</Label>
                        <Textarea
                          value={updateData.staff_notes}
                          onChange={(e) => setUpdateData({ ...updateData, staff_notes: e.target.value })}
                          placeholder="Notes internes..."
                          rows={6}
                        />
                        <Button 
                          onClick={handleSaveNotes} 
                          disabled={updateMutation.isPending}
                          className="w-full"
                        >
                          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Sauvegarder les notes
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Client Info */}
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Client
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-muted-foreground text-xs">Nom</Label>
                    <p className="font-medium">{selectedDispute.profile?.full_name || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Courriel</Label>
                    <p className="text-sm">{selectedDispute.profile?.email || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Téléphone</Label>
                    <p className="text-sm">{selectedDispute.profile?.phone || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">No. client</Label>
                    <p className="font-mono text-sm">{selectedDispute.profile?.client_number || "-"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Chronologie
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { status: "submitted", label: "Soumise", date: selectedDispute.created_at },
                      { status: "under_review", label: "En examen" },
                      { status: "awaiting_client", label: "Info requise" },
                      { status: "resolved_approved", label: "Approuvée" },
                      { status: "resolved_rejected", label: "Rejetée" },
                    ].map((step, index) => {
                      const isActive = selectedDispute.status === step.status;
                      const isPast = Object.keys(statusConfig).indexOf(selectedDispute.status) >= Object.keys(statusConfig).indexOf(step.status);
                      const isResolution = step.status.startsWith("resolved");
                      const showStep = !isResolution || selectedDispute.status === step.status;
                      
                      if (!showStep && isResolution) return null;
                      
                      return (
                        <div key={step.status} className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${isActive ? "bg-primary" : isPast ? "bg-muted-foreground" : "bg-muted"}`} />
                          <div className="flex-1">
                            <p className={`text-sm ${isActive ? "font-medium" : "text-muted-foreground"}`}>
                              {step.label}
                            </p>
                            {step.date && (
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(step.date), "d MMM yyyy HH:mm", { locale: fr })}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Request Info Dialog */}
          <Dialog open={requestInfoDialogOpen} onOpenChange={setRequestInfoDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Demander des informations</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Message au client (REQUIS)</Label>
                  <Textarea
                    value={updateData.public_message}
                    onChange={(e) => setUpdateData({ ...updateData, public_message: e.target.value })}
                    placeholder="Expliquez quelles informations vous avez besoin..."
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRequestInfoDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleRequestInfo} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Envoyer la demande
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Approve Dialog */}
          <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Approuver la contestation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Notes de résolution (REQUIS)</Label>
                  <Textarea
                    value={updateData.resolution_notes}
                    onChange={(e) => setUpdateData({ ...updateData, resolution_notes: e.target.value })}
                    placeholder="Expliquez la résolution..."
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleApprove} disabled={updateMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Confirmer l'approbation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Reject Dialog */}
          <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rejeter la contestation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Raison du rejet (REQUIS)</Label>
                  <Textarea
                    value={updateData.rejection_reason}
                    onChange={(e) => setUpdateData({ ...updateData, rejection_reason: e.target.value })}
                    placeholder="Expliquez pourquoi la contestation est rejetée..."
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleReject} disabled={updateMutation.isPending} variant="destructive">
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Confirmer le rejet
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AdminLayout>
    );
  }

  // List View
  return (
    <AdminLayout>
      <div className="space-y-6" data-testid="admin-payment-disputes-page">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Contestations de paiement</h1>
            <p className="text-muted-foreground mt-1">Gérez les contestations des clients</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{stats.total || 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          {Object.entries(statusConfig).map(([status, config]) => (
            <Card key={status} className="bg-card border-border">
              <CardContent className="pt-4">
                <p className="text-2xl font-bold">{stats[status] || 0}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par numéro, client, facture..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <SelectItem key={status} value={status}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Contestations ({filteredDisputes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredDisputes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucune contestation trouvée
              </div>
            ) : (
              <div className="space-y-3">
                {filteredDisputes.map((dispute: any) => {
                  const statusInfo = statusConfig[dispute.status as DisputeStatus] || statusConfig.submitted;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <div
                      key={dispute.id}
                      className="p-4 bg-accent/50 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                      onClick={() => handleSelectDispute(dispute)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{dispute.dispute_number}</span>
                            <Badge className={statusInfo.color} variant="secondary">
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{dispute.profile?.full_name || "Client"}</p>
                          <p className="text-xs text-muted-foreground">
                            Facture: {dispute.payment?.invoice_number || "-"} • 
                            {Number(dispute.payment?.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {reasonCodeLabels[dispute.reason_code as ReasonCode]}
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{format(new Date(dispute.created_at), "d MMM yyyy", { locale: fr })}</p>
                          <p>{format(new Date(dispute.created_at), "HH:mm", { locale: fr })}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminPaymentDisputes;
