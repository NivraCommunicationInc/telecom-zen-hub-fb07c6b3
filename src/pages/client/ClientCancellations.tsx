import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useWriteGuard } from "@/hooks/useWriteGuard";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { 
  XCircle, Plus, ArrowLeft, Calendar, Clock, CheckCircle, 
  AlertTriangle, Loader2, FileX, Info
} from "lucide-react";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { usePortalActivityLog } from "@/hooks/usePortalActivityLog";
import { checkAccountBlockedForAction } from "@/lib/accountBlockCheck";
import { useClientBlockStatus } from "@/hooks/useClientBlockStatus";
import BlockedActionWrapper from "@/components/client/BlockedActionWrapper";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";

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
  under_review: { label: "En révision", color: "bg-blue-500/20 text-blue-500", icon: Clock },
  awaiting_client: { label: "Information requise", color: "bg-purple-100 text-purple-700", icon: AlertTriangle },
  approved: { label: "Approuvé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  scheduled: { label: "Planifié", color: "bg-teal-100 text-teal-700", icon: Calendar },
  completed: { label: "Complété", color: "bg-muted text-muted-foreground", icon: CheckCircle },
  declined: { label: "Refusé", color: "bg-red-100 text-red-700", icon: XCircle },
};

const ClientCancellations = () => {
  const { user } = useClientAuth();
  const { isAccountBlocked } = useClientBlockStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = usePortalActivityLog();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [newRequest, setNewRequest] = useState({
    service_type: "" as ServiceType | "",
    service_identifier: "",
    reason_code: "" as ReasonCode | "",
    reason_details: "",
    requested_effective_date: "",
  });

  // Fetch cancellation requests from canonical snapshot
  const { data: canonical, isLoading } = useCanonicalClientData(user?.id);
  const requests = ((canonical?.cancellationRequests || []) as any[]).slice().sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (request: typeof newRequest) => {
      const { data, error } = await portalSupabase
        .from("service_cancellation_requests")
        .insert([{
          user_id: user?.id as string,
          service_type: request.service_type as ServiceType,
          service_identifier: request.service_identifier || null,
          reason_code: request.reason_code as ReasonCode,
          reason_details: request.reason_details || null,
          requested_effective_date: request.requested_effective_date || null,
          created_by_role: "client",
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["canonical-client-data", user?.id] });
      logActivity("create", "cancellation_request", data.id, { 
        service_type: data.service_type,
        request_number: data.request_number 
      });
      toast({ 
        title: "Demande soumise", 
        description: `Votre demande ${data.request_number} a été reçue.` 
      });
      setCreateDialogOpen(false);
      setNewRequest({
        service_type: "",
        service_identifier: "",
        reason_code: "",
        reason_details: "",
        requested_effective_date: "",
      });
    },
    onError: () => {
      toast({ 
        title: "Erreur", 
        description: "Impossible de soumettre la demande", 
        variant: "destructive" 
      });
    },
  });

  const writeGuard = useWriteGuard();

  const handleSubmit = writeGuard(() => {
    if (!newRequest.service_type || !newRequest.reason_code) {
      toast({ 
        title: "Champs requis", 
        description: "Veuillez remplir tous les champs obligatoires", 
        variant: "destructive" 
      });
      return;
    }
    createMutation.mutate(newRequest);
  });

  // Detail view
  if (selectedRequest) {
    const statusInfo = statusConfig[selectedRequest.status as CancellationStatus] || statusConfig.requested;
    const StatusIcon = statusInfo.icon;

    return (
      <ClientLayout>
        <div className="space-y-6">
          <Button variant="ghost" onClick={() => setSelectedRequest(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux demandes
          </Button>

          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileX className="w-5 h-5" />
                    Demande {selectedRequest.request_number}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Soumise le {format(new Date(selectedRequest.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </div>
                <Badge className={statusInfo.color}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusInfo.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
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

              {/* Reason */}
              <div>
                <Label className="text-muted-foreground text-xs">Raison</Label>
                <p className="font-medium">{reasonCodeLabels[selectedRequest.reason_code as ReasonCode]}</p>
                {selectedRequest.reason_details && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedRequest.reason_details}</p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                {selectedRequest.requested_effective_date && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Date demandée</Label>
                    <p className="font-medium">
                      {format(new Date(selectedRequest.requested_effective_date), "d MMMM yyyy", { locale: fr })}
                    </p>
                  </div>
                )}
                {selectedRequest.effective_date && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Date effective</Label>
                    <p className="font-medium text-primary">
                      {format(new Date(selectedRequest.effective_date), "d MMMM yyyy", { locale: fr })}
                    </p>
                  </div>
                )}
              </div>

              {/* Public message from staff */}
              {selectedRequest.public_message && (
                <div className="p-4 bg-secondary rounded-lg">
                  <Label className="text-muted-foreground text-xs">Message de Nivra</Label>
                  <p className="mt-1">{selectedRequest.public_message}</p>
                </div>
              )}

              {/* Decline reason */}
              {selectedRequest.status === "declined" && selectedRequest.decline_reason && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-red-500 mb-2">
                    <XCircle className="w-4 h-4" />
                    <span className="font-medium">Raison du refus</span>
                  </div>
                  <p className="text-sm">{selectedRequest.decline_reason}</p>
                </div>
              )}

              {/* Status timeline */}
              <div className="border-t pt-4">
                <Label className="text-muted-foreground text-xs mb-3 block">Historique</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Demande soumise</span>
                    <span className="text-muted-foreground ml-auto">
                      {format(new Date(selectedRequest.created_at), "d MMM HH:mm", { locale: fr })}
                    </span>
                  </div>
                  {selectedRequest.processed_at && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span>Traité par {selectedRequest.processed_by_name || "Nivra"}</span>
                      <span className="text-muted-foreground ml-auto">
                        {format(new Date(selectedRequest.processed_at), "d MMM HH:mm", { locale: fr })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileX className="w-6 h-6" />
              Annulation de service
            </h1>
            <p className="text-muted-foreground">Gérez vos demandes d'annulation</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle demande
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Demande d'annulation</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Service Type */}
                <div className="space-y-2">
                  <Label>Type de service *</Label>
                  <Select
                    value={newRequest.service_type}
                    onValueChange={(v) => setNewRequest({ ...newRequest, service_type: v as ServiceType })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un service" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(serviceTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Service Identifier */}
                {(newRequest.service_type === "mobile" || newRequest.service_type === "internet") && (
                  <div className="space-y-2">
                    <Label>
                      {newRequest.service_type === "mobile" ? "Numéro de téléphone" : "Adresse du service"}
                    </Label>
                    <Input
                      value={newRequest.service_identifier}
                      onChange={(e) => setNewRequest({ ...newRequest, service_identifier: e.target.value })}
                      placeholder={newRequest.service_type === "mobile" ? "XXX-XXX-XXXX" : "123 rue Exemple"}
                    />
                  </div>
                )}

                {/* Reason Code */}
                <div className="space-y-2">
                  <Label>Raison de l'annulation *</Label>
                  <Select
                    value={newRequest.reason_code}
                    onValueChange={(v) => setNewRequest({ ...newRequest, reason_code: v as ReasonCode })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une raison" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(reasonCodeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reason Details */}
                <div className="space-y-2">
                  <Label>Détails (optionnel)</Label>
                  <Textarea
                    value={newRequest.reason_details}
                    onChange={(e) => setNewRequest({ ...newRequest, reason_details: e.target.value })}
                    placeholder="Expliquez votre situation..."
                    rows={3}
                  />
                </div>

                {/* Requested Effective Date */}
                <div className="space-y-2">
                  <Label>Date d'annulation souhaitée (optionnel)</Label>
                  <Input
                    type="date"
                    value={newRequest.requested_effective_date}
                    min={format(addDays(new Date(), 1), "yyyy-MM-dd")}
                    onChange={(e) => setNewRequest({ ...newRequest, requested_effective_date: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Si non spécifié, l'annulation sera effective à la fin de votre période de facturation.
                  </p>
                </div>

                {/* Info box */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <div className="flex gap-2">
                    <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-500">
                      Votre demande sera examinée par notre équipe. Vous recevrez une confirmation par courriel.
                    </p>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Annuler
                </Button>
                <BlockedActionWrapper action="request" showInlineNotice={isAccountBlocked}>
                  <Button onClick={handleSubmit} disabled={isAccountBlocked || createMutation.isPending || writeGuard.isReadOnly} title={writeGuard.disabledReason}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Soumettre la demande
                  </Button>
                </BlockedActionWrapper>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : requests && requests.length > 0 ? (
          <div className="space-y-3">
            {requests.map((request: any) => {
              const statusInfo = statusConfig[request.status as CancellationStatus] || statusConfig.requested;
              const StatusIcon = statusInfo.icon;
              return (
                <Card 
                  key={request.id} 
                  className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedRequest(request)}
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
                            {reasonCodeLabels[request.reason_code as ReasonCode]} • 
                            {format(new Date(request.created_at), " d MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <Badge className={statusInfo.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusInfo.label}
                      </Badge>
                    </div>
                    {request.effective_date && (
                      <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        Date effective: {format(new Date(request.effective_date), "d MMMM yyyy", { locale: fr })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileX className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucune demande d'annulation</h3>
              <p className="text-muted-foreground text-center mb-4">
                Vous n'avez soumis aucune demande d'annulation de service.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle demande
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientCancellations;
