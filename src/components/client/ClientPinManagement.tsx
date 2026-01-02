import { useState, useEffect } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Shield, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { hashPin, isValidPin, DEFAULT_PIN } from "@/lib/pinUtils";

interface PinStatus {
  hasPin: boolean;
  isDefault: boolean;
}

export const ClientPinManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pinStatus, setPinStatus] = useState<PinStatus>({ hasPin: false, isDefault: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [formData, setFormData] = useState({
    currentPin: "",
    newPin: "",
    confirmPin: "",
  });

  const checkPinStatus = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("client_pin_hash, pin_is_default")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setPinStatus({
        hasPin: !!data?.client_pin_hash,
        isDefault: data?.pin_is_default || false,
      });
    } catch (error) {
      console.error("Error checking PIN:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkPinStatus();
  }, [user?.id]);

  const handleSavePin = async () => {
    // Validate new PIN
    if (!isValidPin(formData.newPin)) {
      toast({ title: "Le NIP doit contenir exactement 4 chiffres", variant: "destructive" });
      return;
    }

    if (formData.newPin !== formData.confirmPin) {
      toast({ title: "Les NIP ne correspondent pas", variant: "destructive" });
      return;
    }

    // If user already has a PIN (and it's not default for first change), verify current
    if (pinStatus.hasPin && !pinStatus.isDefault) {
      if (!formData.currentPin || formData.currentPin.length !== 4) {
        toast({ title: "Veuillez entrer votre NIP actuel", variant: "destructive" });
        return;
      }

      // Verify current PIN using the database function
      const { data: isValid, error: verifyError } = await supabase
        .rpc('verify_pin', { user_id_input: user?.id, pin_input: formData.currentPin });

      if (verifyError || !isValid) {
        toast({ title: "NIP actuel incorrect", variant: "destructive" });
        return;
      }
    }

    // For default PIN, verify it matches default
    if (pinStatus.isDefault && formData.currentPin) {
      if (formData.currentPin !== DEFAULT_PIN) {
        toast({ title: "NIP actuel incorrect", variant: "destructive" });
        return;
      }
    }

    setIsSaving(true);
    try {
      const hashedPin = await hashPin(formData.newPin);

      const { error } = await supabase
        .from("profiles")
        .update({ 
          client_pin_hash: hashedPin,
          pin_is_default: false,
          pin_failed_attempts: 0,
          pin_lockout_until: null,
        })
        .eq("user_id", user?.id);

      if (error) throw error;

      // Log the change
      await supabase.from("client_pin_logs").insert({
        client_id: user?.id,
        changed_by_id: user?.id,
        changed_by_role: "client",
        action: pinStatus.isDefault ? "forced_change" : (pinStatus.hasPin ? "change" : "set"),
      });

      toast({ 
        title: pinStatus.hasPin ? "NIP modifié avec succès" : "NIP créé avec succès",
        description: "Ce NIP sera requis pour que notre personnel accède à votre profil."
      });
      setPinStatus({ hasPin: true, isDefault: false });
      setDialogOpen(false);
      setFormData({ currentPin: "", newPin: "", confirmPin: "" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setFormData({ currentPin: "", newPin: "", confirmPin: "" });
    setShowPin(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Chargement...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Default PIN Warning Banner */}
      {pinStatus.isDefault && (
        <div className="p-4 rounded-lg bg-amber-500/15 border border-amber-500/30 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-600">Changez votre NIP pour votre sécurité</p>
              <p className="text-sm text-muted-foreground mt-1">
                Votre compte utilise le NIP par défaut. Pour protéger vos informations, veuillez créer un nouveau NIP personnel.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => setDialogOpen(true)}
              >
                <KeyRound className="w-4 h-4 mr-2" />
                Changer mon NIP maintenant
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <p className="font-medium text-foreground">NIP client (4 chiffres)</p>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {pinStatus.hasPin ? (
              pinStatus.isDefault ? (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  NIP par défaut — À changer
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle className="w-3 h-3" />
                  NIP personnalisé configuré
                </span>
              )
            ) : (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="w-3 h-3" />
                Non configuré — Recommandé pour votre sécurité
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => setDialogOpen(true)}>
          {pinStatus.hasPin ? "Modifier" : "Créer"}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {pinStatus.isDefault 
                ? "Créer votre NIP personnel"
                : pinStatus.hasPin 
                  ? "Modifier votre NIP client" 
                  : "Créer votre NIP client"}
            </DialogTitle>
            <DialogDescription>
              {pinStatus.isDefault
                ? "Remplacez le NIP par défaut par un NIP personnel de votre choix pour sécuriser votre compte."
                : "Ce NIP sécurise l'accès à votre profil lorsque vous contactez notre service client."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current PIN - required if has non-default PIN */}
            {pinStatus.hasPin && (
              <div className="space-y-2">
                <Label>
                  {pinStatus.isDefault 
                    ? `NIP actuel (par défaut: ${DEFAULT_PIN})`
                    : "NIP actuel"}
                </Label>
                <div className="relative">
                  <Input
                    type={showPin ? "text" : "password"}
                    maxLength={4}
                    value={formData.currentPin}
                    onChange={(e) => setFormData({ ...formData, currentPin: e.target.value.replace(/\D/g, "") })}
                    placeholder="••••"
                    className="pr-10"
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
                {pinStatus.isDefault && (
                  <p className="text-xs text-muted-foreground">
                    Le NIP par défaut est <strong>{DEFAULT_PIN}</strong>
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>{pinStatus.hasPin ? "Nouveau NIP" : "NIP"} (4 chiffres)</Label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  maxLength={4}
                  value={formData.newPin}
                  onChange={(e) => setFormData({ ...formData, newPin: e.target.value.replace(/\D/g, "") })}
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
                value={formData.confirmPin}
                onChange={(e) => setFormData({ ...formData, confirmPin: e.target.value.replace(/\D/g, "") })}
                placeholder="••••"
                className="text-center text-xl tracking-[0.5em]"
              />
            </div>

            <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p className="font-medium mb-1">Pourquoi un NIP?</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Protège votre compte contre les accès non autorisés</li>
                <li>Requis par notre personnel pour accéder à votre profil</li>
                <li>Ne le partagez jamais par téléphone ou courriel</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Annuler
            </Button>
            <Button onClick={handleSavePin} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {pinStatus.hasPin ? "Modifier" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
