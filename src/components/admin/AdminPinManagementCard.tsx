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
import { Textarea } from "@/components/ui/textarea";
import { adminClient as supabase } from "@/integrations/backend";
import { useToast } from "@/hooks/use-toast";
import { Shield, KeyRound, AlertTriangle, Loader2, CheckCircle, Eye, EyeOff, RotateCcw } from "lucide-react";
import { hashPin, isValidPin, DEFAULT_PIN } from "@/lib/pinUtils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface AdminPinManagementCardProps {
  client: {
    id: string;
    user_id: string;
    email?: string;
    full_name?: string;
  };
  pinStatus: {
    hasPin: boolean;
    isDefault: boolean;
    lastUpdated?: string;
  };
  onPinChanged: () => void;
  staffUser: {
    id: string;
    name: string;
    role: string;
  };
}

export const AdminPinManagementCard = ({
  client,
  pinStatus,
  onPinChanged,
  staffUser,
}: AdminPinManagementCardProps) => {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"set" | "reset">("set");
  const [isLoading, setIsLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [reason, setReason] = useState("");

  const logPinChange = async (action: string) => {
    try {
      await supabase.from("client_pin_logs").insert({
        client_id: client.user_id,
        client_email: client.email,
        changed_by_id: staffUser.id,
        changed_by_name: staffUser.name,
        changed_by_role: staffUser.role,
        action,
        reason: reason || null,
      });
    } catch (error) {
      console.error("Error logging PIN change:", error);
    }
  };

  const handleSetPin = async () => {
    if (!isValidPin(newPin)) {
      toast({ title: "Le NIP doit contenir exactement 4 chiffres", variant: "destructive" });
      return;
    }
    if (newPin !== confirmPin) {
      toast({ title: "Les NIP ne correspondent pas", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const hashedPin = await hashPin(newPin);
      
      const { error } = await supabase
        .from("profiles")
        .update({
          client_pin_hash: hashedPin,
          pin_is_default: false,
          pin_failed_attempts: 0,
          pin_lockout_until: null,
        })
        .eq("user_id", client.user_id);

      if (error) throw error;

      await logPinChange(pinStatus.hasPin ? "change" : "set");

      toast({ title: "NIP modifié avec succès" });
      setDialogOpen(false);
      resetForm();
      onPinChanged();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsLoading(true);
    try {
      const hashedPin = await hashPin(DEFAULT_PIN);
      
      const { error } = await supabase
        .from("profiles")
        .update({
          client_pin_hash: hashedPin,
          pin_is_default: true,
          pin_failed_attempts: 0,
          pin_lockout_until: null,
        })
        .eq("user_id", client.user_id);

      if (error) throw error;

      await logPinChange("reset_to_default");

      toast({ 
        title: "NIP réinitialisé", 
        description: `Le NIP a été réinitialisé au NIP par défaut (${DEFAULT_PIN}). Le client devra le changer.` 
      });
      setDialogOpen(false);
      resetForm();
      onPinChanged();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setNewPin("");
    setConfirmPin("");
    setReason("");
    setShowPin(false);
  };

  const openDialog = (mode: "set" | "reset") => {
    setDialogMode(mode);
    resetForm();
    setDialogOpen(true);
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-5 h-5 text-primary" />
            NIP client de sécurité
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* PIN Status */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Statut:</span>
              <Badge variant={pinStatus.hasPin ? "default" : "outline"}>
                {pinStatus.hasPin ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Configuré
                  </span>
                ) : (
                  "Non configuré"
                )}
              </Badge>
            </div>

            {pinStatus.isDefault && (
              <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-xs text-amber-600">
                  NIP par défaut — Le client doit le changer
                </span>
              </div>
            )}

            {pinStatus.lastUpdated && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Dernière mise à jour:</span>
                <span>{format(new Date(pinStatus.lastUpdated), "d MMM yyyy HH:mm", { locale: fr })}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDialog("set")}
              className="flex-1"
            >
              <KeyRound className="w-4 h-4 mr-2" />
              {pinStatus.hasPin ? "Modifier" : "Définir"}
            </Button>
            {pinStatus.hasPin && !pinStatus.isDefault && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openDialog("reset")}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {dialogMode === "set" 
                ? (pinStatus.hasPin ? "Modifier le NIP client" : "Définir le NIP client")
                : "Réinitialiser le NIP"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "set"
                ? `Définir un nouveau NIP pour ${client.full_name || client.email}`
                : `Réinitialiser le NIP au NIP par défaut (${DEFAULT_PIN})`}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === "set" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <Label>Confirmer</Label>
                  <Input
                    type={showPin ? "text" : "password"}
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••"
                    className="text-center text-xl tracking-[0.5em]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Raison du changement (optionnel)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Demande du client par téléphone..."
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-600">Attention</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Le NIP sera réinitialisé à <strong>{DEFAULT_PIN}</strong>. Le client devra le changer lors de sa prochaine action sensible.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Raison de la réinitialisation</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Client a oublié son NIP..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isLoading}>
              Annuler
            </Button>
            <Button
              onClick={dialogMode === "set" ? handleSetPin : handleResetToDefault}
              disabled={isLoading || (dialogMode === "set" && (newPin.length !== 4 || newPin !== confirmPin))}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {dialogMode === "set" ? "Enregistrer" : "Réinitialiser"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
