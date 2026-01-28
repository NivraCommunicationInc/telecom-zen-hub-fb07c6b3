/**
 * StaffClientServicesSection - View and manage client services
 * Displays all service instances for a client with management actions
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Textarea } from "@/components/ui/textarea";
import { 
  Wifi, Tv, Phone, Shield, Play, Package,
  Pause, PlayCircle, Edit, Trash2, AlertCircle,
  Loader2, RefreshCw, Settings
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { createAuditNote } from "@/lib/clientAuditNotes";

interface StaffClientServicesSectionProps {
  clientId: string;
  staffUserId: string;
  staffUserName?: string;
}

const serviceTypeIcons: Record<string, any> = {
  mobile: Phone,
  internet: Wifi,
  tv: Tv,
  security: Shield,
  streaming: Play,
  other: Package,
};

const serviceTypeLabels: Record<string, string> = {
  mobile: "Mobile",
  internet: "Internet",
  tv: "Télévision",
  security: "Sécurité",
  streaming: "Streaming",
  other: "Autre",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Actif", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  suspended: { label: "Suspendu", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  pending: { label: "En attente", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  cancelled: { label: "Annulé", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function StaffClientServicesSection({
  clientId,
  staffUserId,
  staffUserName,
}: StaffClientServicesSectionProps) {
  const queryClient = useQueryClient();
  const [selectedService, setSelectedService] = useState<any>(null);
  const [actionType, setActionType] = useState<"suspend" | "activate" | "cancel" | null>(null);
  const [reason, setReason] = useState("");

  // Fetch service instances
  const { data: services, isLoading, refetch } = useQuery({
    queryKey: ["staff-client-services", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_instances")
        .select("*")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!clientId,
  });

  // Update service status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      serviceId,
      newStatus,
      reason,
    }: {
      serviceId: string;
      newStatus: string;
      reason: string;
    }) => {
      const { error } = await supabase
        .from("service_instances")
        .update({
          status: newStatus,
          status_reason: reason,
          status_changed_at: new Date().toISOString(),
          status_changed_by: staffUserId,
        })
        .eq("id", serviceId);

      if (error) throw error;

      // Create audit note
      await createAuditNote({
        clientId,
        eventType: "service_modified",
        message: `Service ${selectedService?.plan_name} - Statut changé vers ${newStatus}. Raison: ${reason}`,
        metadata: {
          service_id: serviceId,
          service_type: selectedService?.service_type,
          old_status: selectedService?.status,
          new_status: newStatus,
        },
        actorId: staffUserId,
        actorRole: "employee",
        actorName: staffUserName,
      });
    },
    onSuccess: () => {
      toast.success("Statut du service mis à jour");
      queryClient.invalidateQueries({ queryKey: ["staff-client-services", clientId] });
      queryClient.invalidateQueries({ queryKey: ["staff-client-internal-notes", clientId] });
      closeActionDialog();
    },
    onError: (error: any) => {
      toast.error("Erreur: " + (error.message || "Impossible de modifier le service"));
    },
  });

  const closeActionDialog = () => {
    setSelectedService(null);
    setActionType(null);
    setReason("");
  };

  const handleStatusAction = (service: any, action: "suspend" | "activate" | "cancel") => {
    setSelectedService(service);
    setActionType(action);
  };

  const confirmAction = () => {
    if (!selectedService || !actionType || !reason.trim()) {
      toast.error("Veuillez fournir une raison");
      return;
    }

    const newStatus =
      actionType === "suspend" ? "suspended" :
      actionType === "activate" ? "active" :
      "cancelled";

    updateStatusMutation.mutate({
      serviceId: selectedService.id,
      newStatus,
      reason: reason.trim(),
    });
  };

  const getActionDialogTitle = () => {
    switch (actionType) {
      case "suspend": return "Suspendre le service";
      case "activate": return "Activer le service";
      case "cancel": return "Annuler le service";
      default: return "";
    }
  };

  const getActionDialogDescription = () => {
    switch (actionType) {
      case "suspend":
        return "Le service sera suspendu temporairement. Le client ne pourra plus l'utiliser jusqu'à réactivation.";
      case "activate":
        return "Le service sera réactivé et le client pourra l'utiliser immédiatement.";
      case "cancel":
        return "Le service sera définitivement annulé. Cette action est irréversible.";
      default:
        return "";
    }
  };

  const Icon = (type: string) => serviceTypeIcons[type] || Package;

  return (
    <>
      <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-teal-400" />
              Services actifs ({services?.length || 0})
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              className="text-slate-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
            </div>
          ) : !services?.length ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Aucun service actif</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {services.map((service: any) => {
                  const IconComponent = serviceTypeIcons[service.service_type] || Package;
                  const statusInfo = statusConfig[service.status] || statusConfig.active;

                  return (
                    <div
                      key={service.id}
                      className="p-4 rounded-lg border border-slate-700/50 bg-slate-800/30"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-teal-500/20">
                            <IconComponent className="h-5 w-5 text-teal-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{service.plan_name}</p>
                            <p className="text-sm text-slate-400">
                              {serviceTypeLabels[service.service_type] || service.service_type}
                            </p>
                            {service.monthly_price && (
                              <p className="text-sm text-teal-400 font-medium mt-1">
                                {service.monthly_price.toFixed(2)} $/mois
                              </p>
                            )}
                            {service.start_date && (
                              <p className="text-xs text-slate-500 mt-1">
                                Depuis le {format(new Date(service.start_date), "d MMMM yyyy", { locale: fr })}
                              </p>
                            )}
                            {service.status_reason && service.status !== "active" && (
                              <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {service.status_reason}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                          
                          <div className="flex items-center gap-1">
                            {service.status === "active" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusAction(service, "suspend")}
                                className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-8 px-2"
                              >
                                <Pause className="h-4 w-4" />
                              </Button>
                            )}
                            {service.status === "suspended" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusAction(service, "activate")}
                                className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-8 px-2"
                              >
                                <PlayCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {service.status !== "cancelled" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStatusAction(service, "cancel")}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Action Confirmation Dialog */}
      <Dialog open={!!actionType} onOpenChange={() => closeActionDialog()}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {actionType === "suspend" && <Pause className="h-5 w-5 text-amber-400" />}
              {actionType === "activate" && <PlayCircle className="h-5 w-5 text-green-400" />}
              {actionType === "cancel" && <Trash2 className="h-5 w-5 text-red-400" />}
              {getActionDialogTitle()}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {getActionDialogDescription()}
            </DialogDescription>
          </DialogHeader>

          {selectedService && (
            <div className="py-4">
              <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 mb-4">
                <p className="text-white font-medium">{selectedService.plan_name}</p>
                <p className="text-sm text-slate-400">
                  {serviceTypeLabels[selectedService.service_type]}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-300">
                  Raison (obligatoire) *
                </label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Expliquez la raison de cette action..."
                  className="bg-slate-800/50 border-slate-600 text-white resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={closeActionDialog}
              className="text-slate-400"
            >
              Annuler
            </Button>
            <Button
              onClick={confirmAction}
              disabled={!reason.trim() || updateStatusMutation.isPending}
              className={
                actionType === "cancel"
                  ? "bg-red-600 hover:bg-red-700"
                  : actionType === "suspend"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-green-600 hover:bg-green-700"
              }
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
