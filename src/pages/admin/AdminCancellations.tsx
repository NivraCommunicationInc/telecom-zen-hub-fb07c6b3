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
import { adminClient as supabase } from "@/integrations/backend";
import { 
  FileX, Search, ArrowLeft, Calendar, Clock, CheckCircle, 
  XCircle, AlertTriangle, User, Mail, Phone, RefreshCw,
  MessageSquare, Loader2, Filter
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useAuth } from "@/hooks/useAuth";

type ServiceType = "mobile" | "internet" | "tv" | "security" | "streaming" | "bundle";
type ReasonCode = "price" | "moving" | "not_needed" | "service_issue" | "billing_issue" | "other";
type CancellationStatus = "requested" | "under_review" | "awaiting_client" | "approved" | "scheduled" | "completed" | "declined";

const serviceTypeLabels: Record<ServiceType, string> = {
  mobile: "Mobile",
  internet: "Internet",
  tv: "Télévision",
  security: "Sécurité",
  streaming: "Streaming",
  bundle: "Forfait combiné",
};

const reasonCodeLabels: Record<ReasonCode, string> = {
  price: "Prix trop élevé",
  moving: "Déménagement",
  not_needed: "Service non nécessaire",
  service_issue: "Problème de service",
  billing_issue: "Problème de facturation",
  other: "Autre raison",
};

const statusConfig: Record<CancellationStatus, { label: string; color: string; icon: any }> = {
  requested: { label: "Demandé", color: "bg-amber-500/20 text-amber-500", icon: Clock },
  under_review: { label: "En révision", color: "bg-blue-500/20 text-blue-500", icon: RefreshCw },
  awaiting_client: { label: "Info requise", color: "bg-purple-500/20 text-purple-500", icon: AlertTriangle },
  approved: { label: "Approuvé", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle },
  scheduled: { label: "Planifié", color: "bg-cyan-500/20 text-cyan-500", icon: Calendar },
  completed: { label: "Complété", color: "bg-muted text-muted-foreground", icon: CheckCircle },
  declined: { label: "Refusé", color: "bg-red-500/20 text-red-500", icon: XCircle },
};

const AdminCancellations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const { user } = useAuth();
  
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("details");
  
  // Update form state
  const [updateData, setUpdateData] = useState({
    status: "",
    effective_date: "",
    staff_notes: "",
    decline_reason: "",
    public_message: "",
  });
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);

  // Fetch all cancellation requests with client info
  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ["admin-cancellation-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_cancellation_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch profiles
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((r: any) => r.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, phone, client_number")
          .in("user_id", userIds);

        return data.map((request: any) => ({
          ...request,
          profile: profiles?.find((p: any) => p.user_id === request.user_id) || null,
        }));
      }
      return data || [];
    },
  });

  // Filtered requests
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (serviceTypeFilter !== "all" && r.service_type !== serviceTypeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches = 
          r.request_number?.toLowerCase().includes(q) ||
          r.profile?.full_name?.toLowerCase().includes(q) ||
          r.profile?.email?.toLowerCase().includes(q) ||
          r.profile?.client_number?.toLowerCase().includes(q) ||
          r.service_identifier?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [requests, statusFilter, serviceTypeFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    if (!requests) return {};
    const counts: Record<string, number> = { total: requests.length };
    Object.keys(statusConfig).forEach(status => {
      counts[status] = requests.filter((r: any) => r.status === status).length;
    });
    return counts;
  }, [requests]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: { id: string; [key: string]: any }) => {
      const { id, ...updateFields } = updates;
      
      // Get current user info for audit
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
        .from("service_cancellation_requests")
        .update(updateFields)
        .eq("id", id);
      if (error) throw error;
      return { id, ...updateFields };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["admin-cancellation-requests"] });
      logActivity("update", "cancellation_request", data.id, { status: data.status });
      toast({ title: "Demande mise à jour" });
      if (selectedRequest?.id === data.id) {
        setSelectedRequest((prev: any) => ({ ...prev, ...data }));
      }
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour", variant: "destructive" });
    },
  });

  const handleStatusChange = (newStatus: CancellationStatus) => {
    if (newStatus === "declined") {
      setDeclineDialogOpen(true);
      return;
    }
    if ((newStatus === "scheduled" || newStatus === "completed") && !updateData.effective_date) {
      toast({ 
        title: "Date requise", 
        description: "Veuillez définir une date effective", 
        variant: "destructive" 
      });
      return;
    }
    updateMutation.mutate({
      id: selectedRequest.id,
      status: newStatus,
      effective_date: updateData.effective_date || null,
      public_message: updateData.public_message || null,
    });
  };

  const handleDecline = () => {
    if (!updateData.decline_reason.trim()) {
      toast({ 
        title: "Raison requise", 
        description: "Veuillez expliquer la raison du refus", 
        variant: "destructive" 
      });
      return;
    }
    updateMutation.mutate({
      id: selectedRequest.id,
      status: "declined",
      decline_reason: updateData.decline_reason,
      public_message: updateData.public_message || null,
    });
    setDeclineDialogOpen(false);
  };

  const handleSaveNotes = () => {
    updateMutation.mutate({
      id: selectedRequest.id,
      staff_notes: updateData.staff_notes,
    });
  };

  // Initialize form when selecting a request
  const handleSelectRequest = (request: any) => {
    setSelectedRequest(request);
    setUpdateData({
      status: request.status,
      effective_date: request.effective_date || "",
      staff_notes: request.staff_notes || "",
      decline_reason: request.decline_reason || "",
      public_message: request.public_message || "",
    });
    setActiveTab("details");
  };

  // Detail View
  if (selectedRequest) {
    const statusInfo = statusConfig[selectedRequest.status as CancellationStatus] || statusConfig.requested;
    const StatusIcon = statusInfo.icon;
    const isReadOnly = selectedRequest.status === "completed";

    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setSelectedRequest(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à la liste
            </Button>
            <Badge variant="outline" className="font-mono">
              {selectedRequest.request_number}
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <FileX className="w-5 h-5" />
                      Demande d'annulation
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
                      {/* Service Info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground text-xs">Type de service</Label>
                          <p className="font-medium">{serviceTypeLabels[selectedRequest.service_type as ServiceType]}</p>
                        </div>
                        {selectedRequest.service_identifier && (
                          <div>
                            <Label className="text-muted-foreground text-xs">Identifiant</Label>
                            <p className="font-medium">{selectedRequest.service_identifier}</p>
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Reason */}
                      <div>
                        <Label className="text-muted-foreground text-xs">Raison</Label>
                        <p className="font-medium">{reasonCodeLabels[selectedRequest.reason_code as ReasonCode]}</p>
                        {selectedRequest.reason_details && (
                          <p className="text-sm text-muted-foreground mt-1 p-3 bg-accent/50 rounded-lg">
                            {selectedRequest.reason_details}
                          </p>
                        )}
                      </div>

                      <Separator />

                      {/* Dates */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground text-xs">Date de demande</Label>
                          <p className="font-medium">
                            {format(new Date(selectedRequest.created_at), "d MMMM yyyy HH:mm", { locale: fr })}
                          </p>
                        </div>
                        {selectedRequest.requested_effective_date && (
                          <div>
                            <Label className="text-muted-foreground text-xs">Date souhaitée par client</Label>
                            <p className="font-medium">
                              {format(new Date(selectedRequest.requested_effective_date), "d MMMM yyyy", { locale: fr })}
                            </p>
                          </div>
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="actions" className="space-y-4 pt-4">
                      {isReadOnly ? (
                        <div className="p-4 bg-muted rounded-lg text-center text-muted-foreground">
                          Cette demande est complétée et ne peut plus être modifiée.
                        </div>
                      ) : (
                        <>
                          {/* Effective Date */}
                          <div className="space-y-2">
                            <Label>Date effective d'annulation</Label>
                            <Input
                              type="date"
                              value={updateData.effective_date}
                              onChange={(e) => setUpdateData({ ...updateData, effective_date: e.target.value })}
                            />
                          </div>

                          {/* Public Message */}
                          <div className="space-y-2">
                            <Label>Message au client (visible par le client)</Label>
                            <Textarea
                              value={updateData.public_message}
                              onChange={(e) => setUpdateData({ ...updateData, public_message: e.target.value })}
                              placeholder="Message optionnel pour le client..."
                              rows={3}
                            />
                          </div>

                          {/* Status Actions */}
                          <Separator />
                          <div className="space-y-3">
                            <Label>Changer le statut</Label>
                            <div className="grid grid-cols-2 gap-2">
                              <Button 
                                variant="outline" 
                                onClick={() => handleStatusChange("under_review")}
                                disabled={updateMutation.isPending}
                              >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                En révision
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={() => handleStatusChange("awaiting_client")}
                                disabled={updateMutation.isPending}
                              >
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                Info requise
                              </Button>
                              <Button 
                                variant="outline" 
                                className="border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
                                onClick={() => handleStatusChange("approved")}
                                disabled={updateMutation.isPending}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Approuver
                              </Button>
                              <Button 
                                variant="outline" 
                                className="border-cyan-500/50 text-cyan-500 hover:bg-cyan-500/10"
                                onClick={() => handleStatusChange("scheduled")}
                                disabled={updateMutation.isPending || !updateData.effective_date}
                              >
                                <Calendar className="w-4 h-4 mr-2" />
                                Planifier
                              </Button>
                              <Button 
                                variant="outline" 
                                className="border-primary text-primary hover:bg-primary/10"
                                onClick={() => handleStatusChange("completed")}
                                disabled={updateMutation.isPending || !updateData.effective_date}
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Compléter
                              </Button>
                              <Button 
                                variant="outline" 
                                className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                                onClick={() => handleStatusChange("declined")}
                                disabled={updateMutation.isPending}
                              >
                                <XCircle className="w-4 h-4 mr-2" />
                                Refuser
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </TabsContent>

                    <TabsContent value="notes" className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Notes internes (non visibles par le client)</Label>
                        <Textarea
                          value={updateData.staff_notes}
                          onChange={(e) => setUpdateData({ ...updateData, staff_notes: e.target.value })}
                          placeholder="Notes pour l'équipe..."
                          rows={6}
                        />
                      </div>
                      <Button onClick={handleSaveNotes} disabled={updateMutation.isPending}>
                        {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Sauvegarder les notes
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Client Info */}
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Client
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedRequest.profile ? (
                    <>
                      <div>
                        <Label className="text-muted-foreground text-xs">Nom</Label>
                        <p className="font-medium">{selectedRequest.profile.full_name || "—"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{selectedRequest.profile.email}</span>
                      </div>
                      {selectedRequest.profile.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{selectedRequest.profile.phone}</span>
                        </div>
                      )}
                      {selectedRequest.profile.client_number && (
                        <Badge variant="outline" className="font-mono">
                          {selectedRequest.profile.client_number}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">Client introuvable</p>
                  )}
                </CardContent>
              </Card>

              {/* Processing Info */}
              {selectedRequest.processed_at && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Traitement</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <Label className="text-muted-foreground text-xs">Traité par</Label>
                      <p>{selectedRequest.processed_by_name || "—"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Date</Label>
                      <p>{format(new Date(selectedRequest.processed_at), "d MMM yyyy HH:mm", { locale: fr })}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Decline Dialog */}
          <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Refuser la demande</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Raison du refus *</Label>
                  <Textarea
                    value={updateData.decline_reason}
                    onChange={(e) => setUpdateData({ ...updateData, decline_reason: e.target.value })}
                    placeholder="Expliquez pourquoi cette demande est refusée..."
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message au client</Label>
                  <Textarea
                    value={updateData.public_message}
                    onChange={(e) => setUpdateData({ ...updateData, public_message: e.target.value })}
                    placeholder="Message optionnel..."
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>
                  Annuler
                </Button>
                <Button variant="destructive" onClick={handleDecline} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmer le refus
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileX className="w-6 h-6" />
              Demandes d'annulation
            </h1>
            <p className="text-muted-foreground">Gérez les demandes d'annulation de services</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{stats.total || 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          {Object.entries(statusConfig).map(([status, config]) => (
            <Card key={status} className="bg-card border-border">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{stats[status] || 0}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(statusConfig).map(([value, config]) => (
                    <SelectItem key={value} value={value}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les services</SelectItem>
                  {Object.entries(serviceTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRequests.length > 0 ? (
          <div className="space-y-3">
            {filteredRequests.map((request: any) => {
              const statusInfo = statusConfig[request.status as CancellationStatus] || statusConfig.requested;
              const StatusIcon = statusInfo.icon;
              return (
                <Card 
                  key={request.id} 
                  className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => handleSelectRequest(request)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-accent">
                          <FileX className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{request.request_number}</span>
                            <Badge variant="outline" className="text-xs">
                              {serviceTypeLabels[request.service_type as ServiceType]}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {request.profile?.full_name || request.profile?.email || "Client"} • 
                            {format(new Date(request.created_at), " d MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileX className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucune demande</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all" || serviceTypeFilter !== "all" 
                  ? "Aucune demande ne correspond à vos critères." 
                  : "Aucune demande d'annulation en attente."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminCancellations;
