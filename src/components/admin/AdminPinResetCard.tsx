import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import { KeyRound, RefreshCw, Loader2, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface AdminPinResetCardProps {
  clientId: string;
  clientUserId: string;
  clientName?: string;
  hasPin: boolean;
  isLockedOut: boolean;
  onPinChanged?: () => void;
}

export const AdminPinResetCard = ({
  clientId,
  clientUserId,
  clientName,
  hasPin,
  isLockedOut,
  onPinChanged,
}: AdminPinResetCardProps) => {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useActivityLog();
  const canResetPin = (role as string) === "admin" || (role as string) === "employee";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleResetPin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast({ title: "Le NIP doit contenir exactement 4 chiffres", variant: "destructive" });
      return;
    }

    if (newPin !== confirmPin) {
      toast({ title: "Les NIP ne correspondent pas", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          client_pin: newPin,
          pin_failed_attempts: 0,
          pin_lockout_until: null,
        })
        .eq("user_id", clientUserId);

      if (error) throw error;

      await logActivity("reset_client_pin", "client", clientId, {
        client_name: clientName,
        was_locked_out: isLockedOut,
      }, {
        changedField: "client_pin",
        reason: "Réinitialisation du NIP client par admin/employé",
      });

      toast({ title: "NIP réinitialisé avec succès" });
      setDialogOpen(false);
      setNewPin("");
      setConfirmPin("");
      onPinChanged?.();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockAccount = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          pin_failed_attempts: 0,
          pin_lockout_until: null,
        })
        .eq("user_id", clientUserId);

      if (error) throw error;

      await logActivity("unlock_client_pin", "client", clientId, {
        client_name: clientName,
      }, {
        changedField: "pin_lockout",
        reason: "Déverrouillage du compte par admin/employé",
      });

      toast({ title: "Compte déverrouillé" });
      onPinChanged?.();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setNewPin("");
    setConfirmPin("");
    setShowPin(false);
  };

  if (!canResetPin) return null;

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="py-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="w-4 h-4 text-primary" />
            Sécurité NIP client
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
            <div>
              <p className="text-sm font-medium">Statut du NIP</p>
              <div className="flex items-center gap-2 mt-1">
                {hasPin ? (
                  <Badge variant="outline" className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Configuré
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                    <XCircle className="w-3 h-3 mr-1" />
                    Non configuré
                  </Badge>
                )}
                {isLockedOut && (
                  <Badge variant="destructive">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Verrouillé
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {isLockedOut && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnlockAccount}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Déverrouiller
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                {hasPin ? "Réinitialiser" : "Définir"}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Le NIP protège l'accès au profil client. Seuls Admin et Employé peuvent le réinitialiser.
          </p>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {hasPin ? "Réinitialiser" : "Définir"} le NIP client
            </DialogTitle>
            <DialogDescription>
              Définissez un nouveau NIP pour {clientName || "ce client"}. Cette action sera journalisée.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nouveau NIP (4 chiffres)</Label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="text-center text-xl tracking-[0.5em] pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowPin(!showPin)}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Confirmer le NIP</Label>
              <Input
                type={showPin ? "text" : "password"}
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="text-center text-xl tracking-[0.5em]"
              />
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-600">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Cette action sera enregistrée dans le journal d'activité.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isLoading}>
              Annuler
            </Button>
            <Button onClick={handleResetPin} disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {hasPin ? "Réinitialiser" : "Définir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
