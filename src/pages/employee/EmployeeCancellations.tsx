// Employee Cancellations Page - Updated imports to use employeeClient
import { useState, useMemo } from "react";
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
import { employeeClient as employeeSupabase } from "@/integrations/supabase/employeeClient";
import { 
  FileX, Search, ArrowLeft, Calendar, Clock, CheckCircle, 
  XCircle, AlertTriangle, User, Mail, Phone, RefreshCw,
  Loader2, Filter
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useEmployeeActivityLog } from "@/hooks/useEmployeeActivityLog";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";

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

const EmployeeCancellations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useEmployeeActivityLog();
  const { user } = useEmployeeAuth();
  
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("details");
  
  const [updateData, setUpdateData] = useState({
    status: "",
    effective_date: "",
    staff_notes: "",
    decline_reason: "",
    public_message: "",
  });
  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["employee-cancellation-requests"],
    queryFn: async () => {
      const { data, error } = await employeeSupabase
        .from("service_cancellation_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((r: any) => r.user_id))];
        const { data: profiles } = await employeeSupabase
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
          r.profile?.client_number?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [requests, statusFilter, serviceTypeFilter, searchQuery]);

  const stats = useMemo(() => {
    if (!requests) return {};
    const counts: Record<string, number> = { total: requests.length };
    Object.keys(statusConfig).forEach(status => {
      counts[status] = requests.filter((r: any) => r.status === status).length;
    });
    return counts;
  }, [requests]);

  const updateMutation = useMutation({
    mutationFn: async (updates: { id: string; [key: string]: any }) => {
      const { id, ...updateFields } = updates;
      
      const { data: profile } = await employeeSupabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user?.id)
        .single();

      updateFields.updated_at = new Date().toISOString();
      updateFields.processed_by_id = user?.id;
      updateFields.processed_by_name = profile?.full_name || user?.email;
      updateFields.processed_at = new Date().toISOString();

      const { error } = await employeeSupabase
        .from("service_cancellation_requests")
        .update(updateFields)
        .eq("id", id);
      if (error) throw error;
      return { id, ...updateFields };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["employee-cancellation-requests"] });
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
      <>
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
                          <div className="space-y-2">
                            <Label>Date effective d'annulation</Label>
                            <Input
                              type="date"
                              value={updateData.effective_date}
                              onChange={(e) => setUpdateData({ ...updateData, effective_date: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Message au client (visible par le client)</Label>
                            <Textarea
                              value={updateData.public_message}
                              onChange={(e) => setUpdateData({ ...updateData, public_message: e.target.value })}
                              placeholder="Message optionnel pour le client..."
                              rows={3}
                            />
                          </div>

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
                          placeholder="Notes internes..."
                          rows={6}
                        />
                        <Button onClick={handleSaveNotes} disabled={updateMutation.isPending}>
                          Sauvegarder les notes
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Client Info Sidebar */}
            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Informations client
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-muted-foreground text-xs">Nom</Label>
                    <p className="font-medium">{selectedRequest.profile?.full_name || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Email</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Mail className="w-3 h-3" />
                      {selectedRequest.profile?.email || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Téléphone</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Phone className="w-3 h-3" />
                      {selectedRequest.profile?.phone || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">No. Client</Label>
                    <p className="font-mono text-sm">{selectedRequest.profile?.client_number || "-"}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Decline Dialog */}
        <Dialog open={declineDialogOpen} onOpenChange={setDeclineDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Refuser la demande</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Raison du refus (obligatoire)</Label>
                <Textarea
                  value={updateData.decline_reason}
                  onChange={(e) => setUpdateData({ ...updateData, decline_reason: e.target.value })}
                  placeholder="Expliquez la raison du refus..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeclineDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDecline}
                disabled={updateMutation.isPending}
              >
                Confirmer le refus
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // List View
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Annulations</h1>
          <p className="text-muted-foreground">Gestion des demandes d'annulation</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.entries(statusConfig).map(([status, config]) => (
            <Card 
              key={status} 
              className={`cursor-pointer transition-all ${statusFilter === status ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <config.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{stats[status] || 0}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{config.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par numéro, nom, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <SelectItem key={status} value={status}>{config.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Type de service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {Object.entries(serviceTypeLabels).map(([type, label]) => (
                    <SelectItem key={type} value={type}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground">
                Aucune demande d'annulation trouvée
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredRequests.map((request: any) => {
                  const statusInfo = statusConfig[request.status as CancellationStatus] || statusConfig.requested;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <div
                      key={request.id}
                      onClick={() => handleSelectRequest(request)}
                      className="p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-medium">{request.request_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {request.profile?.full_name || "Client inconnu"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm">{serviceTypeLabels[request.service_type as ServiceType]}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(request.created_at), "d MMM yyyy", { locale: fr })}
                            </p>
                          </div>
                          <Badge className={statusInfo.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
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
    </div>
  );
};

export default EmployeeCancellations;

