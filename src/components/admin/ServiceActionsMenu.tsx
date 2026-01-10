/**
 * Service Actions Menu - Admin controls for Cancel/Pause/Technical Issue
 * Integrates with service_instances and sends emails + audit notes
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  MoreVertical, Pause, Play, XCircle, AlertTriangle, 
  Loader2, CheckCircle 
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import AuditNotes from "@/lib/clientAuditNotes";

interface ServiceActionsMenuProps {
  serviceInstance: {
    id: string;
    user_id: string;
    service_type: string;
    plan_name?: string;
    status: string;
    order_id?: string;
  };
  clientEmail?: string;
  clientName?: string;
  onStatusChanged?: () => void;
}

type ActionType = 'pause' | 'resume' | 'cancel' | 'technical_issue';

const statusConfig = {
  active: { color: "bg-emerald-500/20 text-emerald-500", label: "Actif" },
  paused: { color: "bg-amber-500/20 text-amber-500", label: "Suspendu" },
  suspended: { color: "bg-amber-500/20 text-amber-500", label: "Suspendu" },
  cancelled: { color: "bg-red-500/20 text-red-500", label: "Annulé" },
  technical_issue: { color: "bg-orange-500/20 text-orange-500", label: "Problème technique" },
  pending: { color: "bg-blue-500/20 text-blue-500", label: "En attente" },
};

export const ServiceActionsMenu = ({
  serviceInstance,
  clientEmail,
  clientName,
  onStatusChanged,
}: ServiceActionsMenuProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [reason, setReason] = useState("");

  const actionLabels: Record<ActionType, { title: string; description: string; buttonText: string; status: string }> = {
    pause: {
      title: "Suspendre le service",
      description: "Le service sera temporairement suspendu. Le client en sera notifié par email.",
      buttonText: "Suspendre",
      status: "paused",
    },
    resume: {
      title: "Réactiver le service",
      description: "Le service sera réactivé. Le client en sera notifié par email.",
      buttonText: "Réactiver",
      status: "active",
    },
    cancel: {
      title: "Annuler le service",
      description: "Le service sera définitivement annulé. Cette action est irréversible.",
      buttonText: "Annuler le service",
      status: "cancelled",
    },
    technical_issue: {
      title: "Signaler un problème technique",
      description: "Le service sera marqué comme ayant un problème technique. Le client en sera notifié.",
      buttonText: "Signaler le problème",
      status: "technical_issue",
    },
  };

  const updateServiceMutation = useMutation({
    mutationFn: async ({ action, reason }: { action: ActionType; reason: string }) => {
      const actionInfo = actionLabels[action];
      const now = new Date().toISOString();
      
      // Update service_instances table
      const { error: updateError } = await supabase
        .from("service_instances")
        .update({
          status: actionInfo.status,
          status_reason: reason,
          status_changed_at: now,
          status_changed_by: user?.id,
          updated_at: now,
        })
        .eq("id", serviceInstance.id);

      if (updateError) throw updateError;

      // Create audit note
      await AuditNotes.serviceModified(
        serviceInstance.user_id,
        serviceInstance.plan_name || serviceInstance.service_type,
        action === 'cancel' ? 'removed' : 'modified',
        user?.id || '',
        'admin'
      );

      // Send email notification
      if (clientEmail) {
        try {
          await supabase.functions.invoke("send-service-status-email", {
            body: {
              client_email: clientEmail,
              client_name: clientName,
              service_name: serviceInstance.plan_name || serviceInstance.service_type,
              new_status: actionInfo.status,
              reason: reason,
              action_type: action,
            },
          });
        } catch (emailErr) {
          console.error("Failed to send service status email:", emailErr);
        }
      }

      return { action, status: actionInfo.status };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["service-instances"] });
      queryClient.invalidateQueries({ queryKey: ["client-services"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      
      toast({
        title: "Service mis à jour",
        description: `Le service a été ${data.action === 'pause' ? 'suspendu' : data.action === 'resume' ? 'réactivé' : data.action === 'cancel' ? 'annulé' : 'signalé comme problématique'}`,
      });
      
      setDialogOpen(false);
      setReason("");
      setActionType(null);
      onStatusChanged?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le service",
        variant: "destructive",
      });
    },
  });

  const handleAction = (action: ActionType) => {
    setActionType(action);
    setDialogOpen(true);
  };

  const confirmAction = () => {
    if (!actionType) return;
    updateServiceMutation.mutate({ action: actionType, reason });
  };

  const currentStatus = serviceInstance.status;
  const isPaused = currentStatus === 'paused' || currentStatus === 'suspended';
  const isCancelled = currentStatus === 'cancelled';
  const hasTechnicalIssue = currentStatus === 'technical_issue';
  const statusInfo = statusConfig[currentStatus as keyof typeof statusConfig] || statusConfig.pending;

  return (
    <>
      <div className="flex items-center gap-2">
        <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
        
        {!isCancelled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isPaused || hasTechnicalIssue ? (
                <DropdownMenuItem onClick={() => handleAction('resume')}>
                  <Play className="w-4 h-4 mr-2 text-emerald-500" />
                  Réactiver
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => handleAction('pause')}>
                  <Pause className="w-4 h-4 mr-2 text-amber-500" />
                  Suspendre
                </DropdownMenuItem>
              )}
              
              <DropdownMenuItem onClick={() => handleAction('technical_issue')}>
                <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />
                Problème technique
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={() => handleAction('cancel')}
                className="text-red-500 focus:text-red-500"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Annuler le service
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionType === 'pause' && <Pause className="w-5 h-5 text-amber-500" />}
              {actionType === 'resume' && <Play className="w-5 h-5 text-emerald-500" />}
              {actionType === 'cancel' && <XCircle className="w-5 h-5 text-red-500" />}
              {actionType === 'technical_issue' && <AlertTriangle className="w-5 h-5 text-orange-500" />}
              {actionType && actionLabels[actionType].title}
            </DialogTitle>
            <DialogDescription>
              {actionType && actionLabels[actionType].description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Service: {serviceInstance.plan_name || serviceInstance.service_type}</p>
              <p className="text-xs text-muted-foreground">Client: {clientName || clientEmail}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Raison (obligatoire)</Label>
              <Textarea
                id="reason"
                placeholder="Décrivez la raison de cette action..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={confirmAction}
              disabled={!reason.trim() || updateServiceMutation.isPending}
              variant={actionType === 'cancel' ? 'destructive' : 'default'}
            >
              {updateServiceMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                actionType && actionLabels[actionType].buttonText
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ServiceActionsMenu;
