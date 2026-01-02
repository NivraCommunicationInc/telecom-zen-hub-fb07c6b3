import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, Unlock, RotateCcw, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { flagClientForRiskAtomic, liftClientSuspensionAtomic } from "@/lib/securityUtils";

interface AdminSecurityControlsProps {
  clientId: string;
  clientEmail?: string;
  securityStatus: string;
  securityAlertLevel: string;
  securityReason?: string | null;
  securityFlaggedAt?: string | null;
  securityFlaggedOrderId?: string | null;
  securityRequiresPinReset: boolean;
  onUpdate: () => void;
}

const AdminSecurityControls = ({
  clientId,
  clientEmail,
  securityStatus,
  securityAlertLevel,
  securityReason,
  securityFlaggedAt,
  securityFlaggedOrderId,
  securityRequiresPinReset,
  onUpdate,
}: AdminSecurityControlsProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [requirePinReset, setRequirePinReset] = useState(true);
  const [reactivateServices, setReactivateServices] = useState(false);
  const [liftReason, setLiftReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState<"risk" | "fraud" | "lift" | null>(null);

  const isSuspended = securityStatus === "suspended";
  const hasAlert = securityAlertLevel !== "none" && securityAlertLevel;

  const handleLiftSuspension = async () => {
    setLoading(true);
    try {
      const result = await liftClientSuspensionAtomic(
        clientId,
        user?.id || "",
        user?.email || "Admin",
        "admin",
        requirePinReset,
        reactivateServices,
        liftReason || undefined
      );

      if (!result.success) {
        toast.error(result.error || "Échec de la levée de suspension");
        return;
      }

      toast.success(
        reactivateServices && result.suspendedServicesCount 
          ? `Suspension levée. ${result.suspendedServicesCount} service(s) réactivé(s).`
          : "Suspension levée avec succès"
      );
      
      setDialogOpen(null);
      setLiftReason("");
      
      // Force refresh to get updated data
      onUpdate();
    } catch (err: any) {
      console.error("Error lifting suspension:", err);
      toast.error(`Erreur: ${err.message || "Échec de la levée de suspension"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFlagClient = async (level: "risk" | "fraud") => {
    setLoading(true);
    try {
      const result = await flagClientForRiskAtomic({
        clientId,
        alertLevel: level,
        reason: `Manually flagged as ${level} by admin`,
        actionById: user?.id,
        actionByName: user?.email || "Admin",
        actionByRole: "admin",
      });

      if (!result.success) {
        toast.error(result.error || `Échec du signalement ${level}`);
        return;
      }

      const servicesMsg = result.suspendedServicesCount 
        ? ` ${result.suspendedServicesCount} service(s) suspendu(s).` 
        : "";
      const appointmentsMsg = result.suspendedAppointmentsCount 
        ? ` ${result.suspendedAppointmentsCount} rendez-vous en attente.`
        : "";

      toast.success(
        `Client signalé comme ${level === "fraud" ? "fraude" : "risque"}.${servicesMsg}${appointmentsMsg}`
      );
      
      setDialogOpen(null);
      
      // Force refresh to get updated data
      onUpdate();
    } catch (err: any) {
      console.error("Error flagging client:", err);
      toast.error(`Erreur: ${err.message || "Échec du signalement"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={isSuspended ? "border-destructive" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isSuspended ? (
            <ShieldAlert className="h-5 w-5 text-destructive" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          )}
          Contrôles de sécurité
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="font-medium">Statut:</span>
          <Badge variant={isSuspended ? "destructive" : "default"}>
            {securityStatus === "suspended" ? "SUSPENDU" : "ACTIF"}
          </Badge>
        </div>

        {hasAlert && (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="font-medium">Niveau d'alerte:</span>
            <Badge variant="destructive">
              {securityAlertLevel === "fraud" ? "FRAUDE" : "RISQUE"}
            </Badge>
          </div>
        )}

        {securityFlaggedAt && (
          <div className="text-sm text-muted-foreground">
            <p>Signalé: {format(new Date(securityFlaggedAt), "PPp")}</p>
            {securityReason && <p>Raison: {securityReason}</p>}
            {securityFlaggedOrderId && (
              <p className="font-mono text-xs">Commande: {securityFlaggedOrderId.slice(0, 8)}...</p>
            )}
          </div>
        )}

        {securityRequiresPinReset && (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <RotateCcw className="h-4 w-4" />
            Réinitialisation du NIP requise
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {isSuspended ? (
            <AlertDialog open={dialogOpen === "lift"} onOpenChange={(open) => setDialogOpen(open ? "lift" : null)}>
              <AlertDialogTrigger asChild>
                <Button className="w-full" variant="default" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Unlock className="h-4 w-4 mr-2" />}
                  Lever la suspension
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Lever la suspension du client</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cela restaurera l'accès du client à son portail.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="require-pin-reset"
                      checked={requirePinReset}
                      onCheckedChange={setRequirePinReset}
                    />
                    <Label htmlFor="require-pin-reset">
                      Exiger la réinitialisation du NIP
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="reactivate-services"
                      checked={reactivateServices}
                      onCheckedChange={setReactivateServices}
                    />
                    <Label htmlFor="reactivate-services">
                      Réactiver les services suspendus
                    </Label>
                  </div>
                  <div>
                    <Label htmlFor="lift-reason">Raison (optionnel)</Label>
                    <Textarea
                      id="lift-reason"
                      placeholder="Raison de la levée de suspension..."
                      value={liftReason}
                      onChange={(e) => setLiftReason(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleLiftSuspension} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Confirmer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div className="flex gap-2">
              <AlertDialog open={dialogOpen === "risk"} onOpenChange={(open) => setDialogOpen(open ? "risk" : null)}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1" disabled={loading}>
                    {loading && dialogOpen === "risk" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Signaler Risque
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Signaler comme Risque?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cela suspendra l'accès au portail client, suspendra tous les services actifs et signalera pour examen de risque.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleFlagClient("risk")} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Confirmer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog open={dialogOpen === "fraud"} onOpenChange={(open) => setDialogOpen(open ? "fraud" : null)}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="flex-1" disabled={loading}>
                    {loading && dialogOpen === "fraud" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Signaler Fraude
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Signaler comme Fraude?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cela suspendra immédiatement l'accès au portail client, suspendra tous les services actifs et les rendez-vous, et signalera pour enquête de fraude.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleFlagClient("fraud")} disabled={loading}>
                      {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      Confirmer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminSecurityControls;
