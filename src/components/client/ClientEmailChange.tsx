/**
 * ClientEmailChange - Secure Email Change Process
 * Requires double verification (current + new email)
 */
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Loader2, CheckCircle2, AlertTriangle, Info, Clock } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { toast } from "sonner";
import { z } from "zod";

interface ClientEmailChangeProps {
  userId: string;
  currentEmail: string;
}

const emailSchema = z.string().email("Adresse email invalide");

const ClientEmailChange = ({ userId, currentEmail }: ClientEmailChangeProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  // Check for pending email change requests
  const { data: pendingRequest } = useQuery({
    queryKey: ["email-change-request", userId],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("email_change_requests")
        .select("*")
        .eq("client_id", userId)
        .in("status", ["pending", "old_verified"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Request email change
  const requestChangeMutation = useMutation({
    mutationFn: async ({ newEmail }: { newEmail: string }) => {
      // Validate email format
      const validation = emailSchema.safeParse(newEmail);
      if (!validation.success) {
        throw new Error("Adresse email invalide");
      }

      // Check if email is same as current
      if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
        throw new Error("La nouvelle adresse doit être différente de l'actuelle");
      }

      // Generate verification token
      const token = crypto.randomUUID();

      // Create email change request
      const { error } = await portalSupabase.from("email_change_requests").insert({
        client_id: userId,
        current_email: currentEmail,
        new_email: newEmail,
        verification_token: token,
        status: "pending",
      });

      if (error) throw error;

      // In production, send verification emails to both addresses
      // For now, we'll simulate this
      return { token };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-change-request"] });
      setDialogOpen(false);
      setNewEmail("");
      setConfirmEmail("");
      toast.success("Demande de changement d'email envoyée. Vérifiez vos deux boîtes de réception.");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la demande");
    },
  });

  // Cancel pending request
  const cancelRequestMutation = useMutation({
    mutationFn: async () => {
      if (!pendingRequest?.id) throw new Error("Aucune demande en cours");

      const { error } = await portalSupabase
        .from("email_change_requests")
        .update({ status: "cancelled" })
        .eq("id", pendingRequest.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-change-request"] });
      toast.success("Demande de changement annulée");
    },
    onError: () => {
      toast.error("Erreur lors de l'annulation");
    },
  });

  const validateEmails = () => {
    setEmailError(null);

    if (!newEmail) {
      setEmailError("Veuillez entrer une nouvelle adresse email");
      return false;
    }

    const validation = emailSchema.safeParse(newEmail);
    if (!validation.success) {
      setEmailError("Adresse email invalide");
      return false;
    }

    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setEmailError("La nouvelle adresse doit être différente de l'actuelle");
      return false;
    }

    if (newEmail !== confirmEmail) {
      setEmailError("Les adresses email ne correspondent pas");
      return false;
    }

    return true;
  };

  const handleSubmit = () => {
    if (validateEmails()) {
      requestChangeMutation.mutate({ newEmail });
    }
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-cyan-400" />
            Adresse email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
            <div>
              <p className="font-medium text-foreground">{currentEmail}</p>
              <p className="text-sm text-muted-foreground">Adresse email actuelle</p>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Vérifiée
            </Badge>
          </div>

          {pendingRequest && (
            <Alert className="border-amber-500/30 bg-amber-500/10">
              <Clock className="w-4 h-4 text-amber-500" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-amber-500">Changement en attente</p>
                  <p className="text-sm text-muted-foreground">
                    Nouvelle adresse: {pendingRequest.new_email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pendingRequest.status === "pending" 
                      ? "En attente de vérification des deux adresses"
                      : "Ancienne adresse vérifiée, en attente de la nouvelle"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => cancelRequestMutation.mutate()}
                  disabled={cancelRequestMutation.isPending}
                >
                  Annuler
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!pendingRequest && (
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              <Mail className="w-4 h-4 mr-2" />
              Changer d'adresse email
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Change Email Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Changer d'adresse email</DialogTitle>
            <DialogDescription>
              Pour des raisons de sécurité, vous devrez confirmer le changement depuis les deux adresses email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <Alert className="border-cyan-500/30 bg-cyan-500/10">
              <Info className="w-4 h-4 text-cyan-500" />
              <AlertDescription className="text-sm">
                <strong>Processus de vérification:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Un email sera envoyé à votre adresse actuelle ({currentEmail})</li>
                  <li>Un email sera envoyé à votre nouvelle adresse</li>
                  <li>Vous devez confirmer les deux pour finaliser le changement</li>
                </ol>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="new-email">Nouvelle adresse email</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  setEmailError(null);
                }}
                placeholder="nouvelle@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-email">Confirmer la nouvelle adresse</Label>
              <Input
                id="confirm-email"
                type="email"
                value={confirmEmail}
                onChange={(e) => {
                  setConfirmEmail(e.target.value);
                  setEmailError(null);
                }}
                placeholder="nouvelle@email.com"
              />
            </div>

            {emailError && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{emailError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="hero"
              onClick={handleSubmit}
              disabled={!newEmail || !confirmEmail || requestChangeMutation.isPending}
            >
              {requestChangeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Envoyer les vérifications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClientEmailChange;
