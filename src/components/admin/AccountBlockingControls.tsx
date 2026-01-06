import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Ban, Globe, Loader2, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AccountBlockingControlsProps {
  clientId: string;
  clientEmail?: string;
  accountStatus: "active" | "blocked";
  onlineAccessStatus: "active" | "blocked";
  blockedReason?: string | null;
  blockedAt?: string | null;
  blockedBy?: string | null;
  blockedByRole?: string | null;
  onUpdate: (updatedProfile: any) => void;
}

const AccountBlockingControls = ({
  clientId,
  clientEmail,
  accountStatus,
  onlineAccessStatus,
  blockedReason,
  blockedAt,
  blockedBy,
  blockedByRole,
  onUpdate,
}: AccountBlockingControlsProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dialogType, setDialogType] = useState<"account" | "online" | null>(null);
  const [reason, setReason] = useState("");
  const [isBlocking, setIsBlocking] = useState(true);

  const isAccountBlocked = accountStatus === "blocked";
  const isOnlineBlocked = onlineAccessStatus === "blocked";

  const handleToggle = async () => {
    if (!reason.trim() && isBlocking) {
      toast.error("Une raison est requise pour bloquer");
      return;
    }

    setLoading(true);
    try {
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (dialogType === "account") {
        updates.account_status = isBlocking ? "blocked" : "active";
      } else if (dialogType === "online") {
        updates.online_access_status = isBlocking ? "blocked" : "active";
      }

      // When blocking, update blocked metadata
      if (isBlocking) {
        updates.blocked_reason = reason.trim();
        updates.blocked_at = new Date().toISOString();
        updates.blocked_by = user?.id;
        updates.blocked_by_role = "admin"; // Could also check for employee role
      } else {
        // When unblocking, clear reason only if both are now active
        const willAccountBeActive = dialogType === "account" ? true : accountStatus === "active";
        const willOnlineBeActive = dialogType === "online" ? true : onlineAccessStatus === "active";
        
        if (willAccountBeActive && willOnlineBeActive) {
          updates.blocked_reason = null;
          updates.blocked_at = null;
          updates.blocked_by = null;
          updates.blocked_by_role = null;
        }
      }

      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", clientId)
        .select()
        .single();

      if (error) throw error;

      // Log to activity_logs
      await supabase.from("activity_logs").insert({
        user_id: user?.id || clientId,
        actor_email: user?.email,
        actor_name: user?.email?.split("@")[0] || "Admin",
        actor_role: "admin",
        entity_type: "profile",
        entity_id: clientId,
        action: isBlocking ? "block" : "unblock",
        changed_field: dialogType === "account" ? "account_status" : "online_access_status",
        old_value: dialogType === "account" ? accountStatus : onlineAccessStatus,
        new_value: isBlocking ? "blocked" : "active",
        reason: reason.trim() || `${dialogType} ${isBlocking ? "blocked" : "unblocked"}`,
        details: {
          client_email: clientEmail,
          blocked_reason: isBlocking ? reason.trim() : null,
        },
      });

      toast.success(
        isBlocking
          ? `${dialogType === "account" ? "Compte" : "Accès portail"} bloqué`
          : `${dialogType === "account" ? "Compte" : "Accès portail"} débloqué`
      );

      onUpdate(data);
      setDialogType(null);
      setReason("");
    } catch (err: any) {
      console.error("Error updating block status:", err);
      toast.error(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (type: "account" | "online", blocking: boolean) => {
    setDialogType(type);
    setIsBlocking(blocking);
    setReason("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ban className="h-5 w-5" />
          Blocage du compte
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Account Status */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Statut compte:</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isAccountBlocked ? "destructive" : "default"}>
              {isAccountBlocked ? "BLOQUÉ" : "ACTIF"}
            </Badge>
            <Button
              variant={isAccountBlocked ? "default" : "outline"}
              size="sm"
              onClick={() => openDialog("account", !isAccountBlocked)}
            >
              {isAccountBlocked ? "Débloquer" : "Bloquer"}
            </Button>
          </div>
        </div>
        {isAccountBlocked && (
          <p className="text-xs text-muted-foreground ml-6">
            Le client peut voir ses factures/contrats mais ne peut pas passer de commandes
          </p>
        )}

        {/* Online Access Status */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Accès portail:</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isOnlineBlocked ? "destructive" : "default"}>
              {isOnlineBlocked ? "BLOQUÉ" : "ACTIF"}
            </Badge>
            <Button
              variant={isOnlineBlocked ? "default" : "outline"}
              size="sm"
              onClick={() => openDialog("online", !isOnlineBlocked)}
            >
              {isOnlineBlocked ? "Débloquer" : "Bloquer"}
            </Button>
          </div>
        </div>
        {isOnlineBlocked && (
          <p className="text-xs text-muted-foreground ml-6">
            Le client ne peut pas accéder au portail /portal/*
          </p>
        )}

        {/* Block Info */}
        {(isAccountBlocked || isOnlineBlocked) && blockedAt && (
          <div className="mt-4 p-3 bg-destructive/10 rounded-lg text-sm space-y-1">
            <p><strong>Bloqué le:</strong> {format(new Date(blockedAt), "PPP 'à' HH:mm")}</p>
            {blockedReason && <p><strong>Raison:</strong> {blockedReason}</p>}
            {blockedByRole && <p><strong>Par:</strong> {blockedByRole}</p>}
          </div>
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={dialogType !== null} onOpenChange={(open) => !open && setDialogType(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isBlocking
                  ? `Bloquer ${dialogType === "account" ? "le compte" : "l'accès portail"}?`
                  : `Débloquer ${dialogType === "account" ? "le compte" : "l'accès portail"}?`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isBlocking ? (
                  dialogType === "account" ? (
                    "Le client pourra toujours accéder au portail mais ne pourra plus passer de commandes, soumettre des demandes, ou modifier ses services."
                  ) : (
                    "Le client sera complètement bloqué de l'accès au portail /portal/*. Il verra une page de blocage avec la raison."
                  )
                ) : (
                  "Le client retrouvera l'accès immédiatement."
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            {isBlocking && (
              <div className="py-4">
                <Label htmlFor="block-reason">Raison du blocage (obligatoire)</Label>
                <Textarea
                  id="block-reason"
                  placeholder="Ex: Factures impayées, comportement abusif, fraude suspectée..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-2"
                  rows={3}
                />
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleToggle} 
                disabled={loading || (isBlocking && !reason.trim())}
                className={isBlocking ? "bg-destructive hover:bg-destructive/90" : ""}
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {isBlocking ? "Bloquer" : "Débloquer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default AccountBlockingControls;