import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { KeyRound, Shield, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export const ClientPinManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [formData, setFormData] = useState({
    currentPin: "",
    newPin: "",
    confirmPin: "",
  });

  useEffect(() => {
    const checkPin = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("client_pin")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        setHasPin(!!data?.client_pin);
      } catch (error) {
        console.error("Error checking PIN:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkPin();
  }, [user?.id]);

  const handleSavePin = async () => {
    // Validate
    if (formData.newPin.length !== 4 || !/^\d{4}$/.test(formData.newPin)) {
      toast({ title: "Le NIP doit contenir exactement 4 chiffres", variant: "destructive" });
      return;
    }

    if (formData.newPin !== formData.confirmPin) {
      toast({ title: "Les NIP ne correspondent pas", variant: "destructive" });
      return;
    }

    if (hasPin) {
      // Verify current PIN
      const { data: profile } = await supabase
        .from("profiles")
        .select("client_pin")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (profile?.client_pin !== formData.currentPin) {
        toast({ title: "NIP actuel incorrect", variant: "destructive" });
        return;
      }
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          client_pin: formData.newPin,
          pin_failed_attempts: 0,
          pin_lockout_until: null,
        })
        .eq("user_id", user?.id);

      if (error) throw error;

      toast({ 
        title: hasPin ? "NIP modifié avec succès" : "NIP créé avec succès",
        description: "Ce NIP sera requis pour que notre personnel accède à votre profil."
      });
      setHasPin(true);
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
      <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <p className="font-medium text-foreground">NIP client (4 chiffres)</p>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {hasPin ? (
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle className="w-3 h-3" />
                NIP configuré
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="w-3 h-3" />
                Non configuré - Recommandé pour votre sécurité
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={() => setDialogOpen(true)}>
          {hasPin ? "Modifier" : "Créer"}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {hasPin ? "Modifier votre NIP client" : "Créer votre NIP client"}
            </DialogTitle>
            <DialogDescription>
              Ce NIP sécurise l'accès à votre profil lorsque vous contactez notre service client ou que notre personnel a besoin d'accéder à vos informations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {hasPin && (
              <div className="space-y-2">
                <Label>NIP actuel</Label>
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
              </div>
            )}

            <div className="space-y-2">
              <Label>{hasPin ? "Nouveau NIP" : "NIP"} (4 chiffres)</Label>
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
              {hasPin ? "Modifier" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
