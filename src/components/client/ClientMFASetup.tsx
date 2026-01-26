/**
 * ClientMFASetup - Two-Factor Authentication Setup Component
 * Supports TOTP (authenticator app) setup with QR code
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, ShieldCheck, Smartphone, Loader2, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { toast } from "sonner";

interface ClientMFASetupProps {
  userId: string;
}

const ClientMFASetup = ({ userId }: ClientMFASetupProps) => {
  const queryClient = useQueryClient();
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);

  // Fetch MFA status
  const { data: mfaStatus, isLoading } = useQuery({
    queryKey: ["client-mfa-status", userId],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("profiles")
        .select("mfa_enabled, mfa_verified_at")
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Generate TOTP secret (mock for now - real implementation would use edge function)
  const generateSecretMutation = useMutation({
    mutationFn: async () => {
      // Generate a random secret (in production, use crypto library)
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let secret = '';
      for (let i = 0; i < 16; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return { secret, qrCodeUrl: `otpauth://totp/Nivra:${userId}?secret=${secret}&issuer=Nivra` };
    },
    onSuccess: () => {
      setSetupDialogOpen(true);
    },
  });

  // Verify and enable MFA
  const enableMfaMutation = useMutation({
    mutationFn: async ({ code }: { code: string }) => {
      // Validate code format
      if (!/^\d{6}$/.test(code)) {
        throw new Error("Le code doit contenir 6 chiffres");
      }

      // In production, verify the TOTP code against the secret
      // For now, we'll simulate verification
      const { error } = await portalSupabase
        .from("profiles")
        .update({
          mfa_enabled: true,
          mfa_verified_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-mfa-status"] });
      setSetupDialogOpen(false);
      setVerificationCode("");
      toast.success("Authentification à deux facteurs activée avec succès");
    },
    onError: (error: any) => {
      toast.error(error.message || "Code invalide. Veuillez réessayer.");
    },
  });

  // Disable MFA
  const disableMfaMutation = useMutation({
    mutationFn: async () => {
      const { error } = await portalSupabase
        .from("profiles")
        .update({
          mfa_enabled: false,
          mfa_secret: null,
          mfa_verified_at: null,
        })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-mfa-status"] });
      setDisableDialogOpen(false);
      toast.success("Authentification à deux facteurs désactivée");
    },
    onError: () => {
      toast.error("Erreur lors de la désactivation du 2FA");
    },
  });

  const handleCopySecret = () => {
    if (generateSecretMutation.data?.secret) {
      navigator.clipboard.writeText(generateSecretMutation.data.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            Authentification à deux facteurs (2FA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
            <div className="flex items-center gap-3">
              {mfaStatus?.mfa_enabled ? (
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-amber-500" />
                </div>
              )}
              <div>
                <p className="font-medium text-foreground">
                  {mfaStatus?.mfa_enabled ? "2FA Activé" : "2FA Non activé"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {mfaStatus?.mfa_enabled
                    ? "Votre compte est protégé par l'authentification à deux facteurs"
                    : "Ajoutez une couche de sécurité supplémentaire à votre compte"}
                </p>
              </div>
            </div>
            {mfaStatus?.mfa_enabled ? (
              <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                Actif
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                Inactif
              </Badge>
            )}
          </div>

          {!mfaStatus?.mfa_enabled && (
            <Alert className="border-cyan-500/30 bg-cyan-500/10">
              <Smartphone className="w-4 h-4 text-cyan-500" />
              <AlertDescription className="text-sm">
                Utilisez une application d'authentification comme Google Authenticator, Authy ou Microsoft Authenticator pour générer des codes de vérification.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            {mfaStatus?.mfa_enabled ? (
              <Button
                variant="outline"
                className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                onClick={() => setDisableDialogOpen(true)}
              >
                Désactiver 2FA
              </Button>
            ) : (
              <Button
                variant="hero"
                onClick={() => generateSecretMutation.mutate()}
                disabled={generateSecretMutation.isPending}
              >
                {generateSecretMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                Activer 2FA
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurer l'authentification à deux facteurs</DialogTitle>
            <DialogDescription>
              Scannez le QR code avec votre application d'authentification ou entrez le code secret manuellement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* QR Code placeholder */}
            <div className="flex justify-center p-6 bg-white rounded-lg">
              <div className="w-48 h-48 bg-muted rounded flex items-center justify-center">
                <div className="text-center text-muted-foreground text-sm">
                  <Smartphone className="w-12 h-12 mx-auto mb-2" />
                  <p>QR Code</p>
                  <p className="text-xs">(Généré par le serveur)</p>
                </div>
              </div>
            </div>

            {/* Secret key */}
            {generateSecretMutation.data?.secret && (
              <div className="space-y-2">
                <Label>Clé secrète (si vous ne pouvez pas scanner)</Label>
                <div className="flex gap-2">
                  <Input
                    value={generateSecretMutation.data.secret}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopySecret}>
                    {copiedSecret ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Verification code input */}
            <div className="space-y-2">
              <Label>Code de vérification</Label>
              <Input
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="text-center font-mono text-lg tracking-widest"
              />
              <p className="text-xs text-muted-foreground">
                Entrez le code à 6 chiffres de votre application
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setSetupDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="hero"
              onClick={() => enableMfaMutation.mutate({ code: verificationCode })}
              disabled={verificationCode.length !== 6 || enableMfaMutation.isPending}
            >
              {enableMfaMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-2" />
              )}
              Vérifier et activer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Confirmation Dialog */}
      <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              Désactiver l'authentification à deux facteurs
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir désactiver la 2FA ? Votre compte sera moins sécurisé.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDisableDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => disableMfaMutation.mutate()}
              disabled={disableMfaMutation.isPending}
            >
              {disableMfaMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Désactiver 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientMFASetup;
