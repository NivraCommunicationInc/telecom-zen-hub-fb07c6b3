import { adminClient as supabase } from "@/integrations/backend";
import { useAuth } from "@/hooks/useAuth";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";

export type ActionType =
  | "service_add"
  | "service_change"
  | "service_remove"
  | "plan_change"
  | "channels_change"
  | "equipment_request"
  | "equipment_change"
  | "equipment_assigned"
  | "billing_adjustment"
  | "credit_add"
  | "credit_remove"
  | "balance_add"
  | "balance_remove"
  | "pin_set"
  | "pin_change"
  | "pin_reset"
  | "authorized_user_add"
  | "authorized_user_edit"
  | "authorized_user_remove"
  | "fraud_flag"
  | "fraud_removed"
  | "risk_flag"
  | "risk_removed"
  | "status_hold"
  | "status_active"
  | "status_suspended"
  | "note_add"
  | "note_edit"
  | "appointment_create"
  | "appointment_change"
  | "appointment_cancel"
  | "profile_update"
  | "identity_update"
  | "ticket_status_change"
  | "order_status_change"
  | "subscription_change"
  | "document_upload"
  | "document_delete"
  | "account_create"
  | "technician_assigned"
  | "installation_status_change";

export type EntityType =
  | "profile"
  | "service"
  | "order"
  | "ticket"
  | "billing"
  | "pin"
  | "authorized_user"
  | "appointment"
  | "document"
  | "subscription"
  | "account"
  | "equipment";

interface LogClientActivityParams {
  clientId: string;
  actionType: ActionType;
  entityType: EntityType;
  entityId?: string;
  summary: string;
  beforeData?: Record<string, any>;
  afterData?: Record<string, any>;
}

/**
 * Hook for logging client activity
 * Returns a function to log activities for a specific client
 */
export const useClientActivityLog = () => {
  const { user } = useAuth();
  const { isAdmin } = useRoleAccess();
  const { toast } = useToast();

  const logClientActivity = useCallback(
    async ({
      clientId,
      actionType,
      entityType,
      entityId,
      summary,
      beforeData,
      afterData,
    }: LogClientActivityParams) => {
      if (!user) {
        console.error("Cannot log activity: No user logged in");
        return;
      }

      try {
        // Fetch actor info
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", user.id)
          .maybeSingle();

        // Determine role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        const actorRole = roleData?.role || "unknown";
        const actorName = profile?.full_name || profile?.email || "Unknown";

        const { error } = await supabase.from("client_activity_logs").insert({
          client_id: clientId,
          actor_user_id: user.id,
          actor_name: actorName,
          actor_role: actorRole,
          action_type: actionType,
          entity_type: entityType,
          entity_id: entityId || null,
          summary,
          before_data: beforeData || null,
          after_data: afterData || null,
        });

        if (error) {
          console.error("Failed to log client activity:", error);
          // Only show warning toast to admin
          if (isAdmin) {
            toast({
              title: "Journal: échec d'enregistrement",
              description: error.message,
              variant: "destructive",
            });
          }
        }
      } catch (err) {
        console.error("Error logging client activity:", err);
        if (isAdmin) {
          toast({
            title: "Journal: échec d'enregistrement",
            variant: "destructive",
          });
        }
      }
    },
    [user, isAdmin, toast]
  );

  return { logClientActivity };
};

/**
 * Standalone function for logging (when hook cannot be used)
 */
export const logClientActivityDirect = async ({
  clientId,
  actorUserId,
  actorName,
  actorRole,
  actionType,
  entityType,
  entityId,
  summary,
  beforeData,
  afterData,
}: {
  clientId: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  actionType: ActionType;
  entityType: EntityType;
  entityId?: string;
  summary: string;
  beforeData?: Record<string, any>;
  afterData?: Record<string, any>;
}) => {
  try {
    const { error } = await supabase.from("client_activity_logs").insert({
      client_id: clientId,
      actor_user_id: actorUserId,
      actor_name: actorName,
      actor_role: actorRole,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId || null,
      summary,
      before_data: beforeData || null,
      after_data: afterData || null,
    });

    if (error) {
      console.error("Failed to log client activity:", error);
    }
  } catch (err) {
    console.error("Error logging client activity:", err);
  }
};

// Action type labels in French
export const actionTypeLabels: Record<ActionType, string> = {
  service_add: "Ajout de service",
  service_change: "Modification de service",
  service_remove: "Suppression de service",
  plan_change: "Changement de forfait",
  channels_change: "Modification des chaînes",
  equipment_request: "Demande d'équipement",
  equipment_change: "Modification d'équipement",
  equipment_assigned: "Équipement attribué",
  billing_adjustment: "Ajustement de facturation",
  credit_add: "Ajout de crédit",
  credit_remove: "Retrait de crédit",
  balance_add: "Ajout au solde",
  balance_remove: "Retrait du solde",
  pin_set: "Définition du NIP",
  pin_change: "Changement du NIP",
  pin_reset: "Réinitialisation du NIP",
  authorized_user_add: "Ajout d'utilisateur autorisé",
  authorized_user_edit: "Modification d'utilisateur autorisé",
  authorized_user_remove: "Suppression d'utilisateur autorisé",
  fraud_flag: "Signalement fraude",
  fraud_removed: "Retrait signalement fraude",
  risk_flag: "Signalement risque",
  risk_removed: "Retrait signalement risque",
  status_hold: "Mise en attente du compte",
  status_active: "Activation du compte",
  status_suspended: "Suspension du compte",
  note_add: "Ajout de note",
  note_edit: "Modification de note",
  appointment_create: "Création de rendez-vous",
  appointment_change: "Modification de rendez-vous",
  appointment_cancel: "Annulation de rendez-vous",
  profile_update: "Mise à jour du profil",
  identity_update: "Mise à jour de l'identité",
  ticket_status_change: "Changement de statut du ticket",
  order_status_change: "Changement de statut de commande",
  subscription_change: "Modification d'abonnement",
  document_upload: "Téléversement de document",
  document_delete: "Suppression de document",
  account_create: "Création de compte",
  technician_assigned: "Technicien assigné",
  installation_status_change: "Changement de statut d'installation",
};
