/**
 * ClientAccountDeletion - Account deletion/deactivation request (Loi 25)
 * Allows clients to request account deactivation or full deletion
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, Loader2, AlertTriangle, Clock, XCircle, Info, CheckCircle2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ClientAccountDeletionProps {
  userId: string;
}

type RequestType = "deactivation" | "deletion";

const ClientAccountDeletion = ({ userId }: ClientAccountDeletionProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>("deactivation");
  const [reason, setReason] = useState("");

  // Fetch existing deletion request
  const { data: existingRequest, isLoading } = useQuery({
    queryKey: ["deletion-request", userId],
    queryFn: async () => {
      const { data, error } = await portalSupabase
        .from("account_deletion_requests")
        .select("*")
        .eq("client_id", userId)
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Submit deletion request
  const submitRequestMutation = useMutation({
    mutationFn: async ({ type, reason }: { type: RequestType; reason: string }) => {
      const { error } = await portalSupabase.from("account_deletion_requests").insert({
        client_id: userId,
        request_type: type,
        reason: reason || null,
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deletion-request"] });
      setDialogOpen(false);
      setConfirmDialogOpen(false);
      setReason("");
      toast.success("Votre demande a été soumise. Nous vous contacterons sous 48h.");
    },
    onError: () => {
      toast.error("Erreur lors de la soumission de la demande");
    },
  });

  // Cancel deletion request
  const cancelRequestMutation = useMutation({
    mutationFn: async () => {
      if (!existingRequest?.id) throw new Error("Aucune demande en cours");

      const { error } = await portalSupabase
        .from("account_deletion_requests")
        .update({ status: "cancelled" })
        .eq("id", existingRequest.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deletion-request"] });
      toast.success("Demande annulée avec succès");
    },
    onError: () => {
      toast.error("Erreur lors de l'annulation");
    },
  });

  const handleSubmit = () => {
    setConfirmDialogOpen(true);
  };

  const confirmSubmit = () => {
    submitRequestMutation.mutate({ type: requestType, reason });
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
          <CardTitle className="flex items-center gap-2 text-red-500">
            <Trash2 className="w-5 h-5" />
            Suppression du compte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {existingRequest ? (
            <div className="space-y-4">
              <Alert className="border-amber-500/30 bg-amber-500/10">
                <Clock className="w-4 h-4 text-amber-500" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium text-amber-500">
                      Demande de {existingRequest.request_type === "deletion" ? "suppression" : "désactivation"} en cours
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Soumise le {format(new Date(existingRequest.requested_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                    <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                      {existingRequest.status === "pending" ? "En attente de traitement" : "Approuvée"}
                    </Badge>
                  </div>
                </AlertDescription>
              </Alert>

              {existingRequest.status === "pending" && (
                <Button
                  variant="outline"
                  onClick={() => cancelRequestMutation.mutate()}
                  disabled={cancelRequestMutation.isPending}
                >
                  {cancelRequestMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Annuler la demande
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Conformément à la Loi 25 du Québec et au RGPD, vous pouvez demander la désactivation ou la suppression complète de votre compte et de vos données personnelles.
              </p>

              <Alert className="border-cyan-500/30 bg-cyan-500/10">
                <Info className="w-4 h-4 text-cyan-500" />
                <AlertDescription className="text-sm">
                  <strong>Important:</strong> Avant de supprimer votre compte, vous pouvez télécharger vos données personnelles via la section "Export des données".
                </AlertDescription>
              </Alert>

              <Button
                variant="outline"
                className="border-red-500/30 text-red-500 hover:bg-red-500/10"
                onClick={() => setDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Demander la suppression
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              Demande de suppression de compte
            </DialogTitle>
            <DialogDescription>
              Cette action ne peut pas être annulée une fois approuvée. Veuillez choisir le type de demande.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            <RadioGroup value={requestType} onValueChange={(value) => setRequestType(value as RequestType)}>
              <div className="flex items-start gap-3 p-4 border rounded-lg hover:border-cyan-500/50 transition-colors">
                <RadioGroupItem value="deactivation" id="deactivation" />
                <div className="flex-1">
                  <Label htmlFor="deactivation" className="font-medium cursor-pointer">
                    Désactivation temporaire
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Votre compte sera désactivé mais vos données seront conservées. Vous pourrez réactiver votre compte plus tard.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 border rounded-lg border-red-500/30 hover:border-red-500/50 transition-colors">
                <RadioGroupItem value="deletion" id="deletion" />
                <div className="flex-1">
                  <Label htmlFor="deletion" className="font-medium cursor-pointer text-red-500">
                    Suppression définitive
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Toutes vos données personnelles seront supprimées de façon permanente après un délai de 30 jours.
                  </p>
                </div>
              </div>
            </RadioGroup>

            <div className="space-y-2">
              <Label htmlFor="reason">Raison (optionnel)</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Dites-nous pourquoi vous souhaitez quitter..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleSubmit}
            >
              Continuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              Confirmer la demande
            </AlertDialogTitle>
            <AlertDialogDescription>
              {requestType === "deletion" ? (
                <>
                  Êtes-vous sûr de vouloir demander la <strong>suppression définitive</strong> de votre compte ? 
                  Toutes vos données seront supprimées de façon permanente après un délai de 30 jours.
                </>
              ) : (
                <>
                  Êtes-vous sûr de vouloir demander la <strong>désactivation</strong> de votre compte ?
                  Vous ne pourrez plus accéder à vos services tant que le compte n'est pas réactivé.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSubmit}
              className="bg-red-500 hover:bg-red-600"
              disabled={submitRequestMutation.isPending}
            >
              {submitRequestMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Confirmer la demande
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ClientAccountDeletion;
